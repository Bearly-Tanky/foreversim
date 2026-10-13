#!/usr/bin/python

# Reports what a fresh talent dataset changes against the talent trees the sim runs on, per
# class and per talent, and attaches the docs/forever_beta_checklist.md lines written against
# the old numbers. The beta pass then starts from this report instead of from a grep.
#
# The sim's side is ui/core/talents/trees/<class>.json for everything structural (which
# talents exist, where they sit, how many ranks, which arrow points where) and data/ with
# overrides/ applied for the tooltip text those trees were imported from, because the tree
# json only carries text for the talents Forever added.
#
# The dataset can be in either schema. data/<class>.json is the default and is what a
# re-export of the beta client is expected to look like; a tree json in the ui/core layout is
# accepted with --tree-schema. Spell ids are only compared when the dataset carries a
# 'spellIds' list per talent, since the BlizzCon data has none and the trees' ids were picked
# by hand.
#
# Usage:
#   tools/forever_talents/diff_trees.py beta/warrior.json       # one class
#   tools/forever_talents/diff_trees.py beta/                   # every class in a directory
#   tools/forever_talents/diff_trees.py --tree-schema new/warrior.json
#   tools/forever_talents/diff_trees.py --apply-overrides       # the vendored data/ itself
#   tools/forever_talents/diff_trees.py beta/ --json > diff.json
#
# Exits 1 when anything changed, so it can gate.

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_talents import DATA_DIR, OVERRIDE_DIR, TREE_DIR, SIM_DIR, apply_overrides, camel_case

CHECKLIST = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'forever_beta_checklist.md')
REPO_DIR = os.path.join(os.path.dirname(__file__), '..', '..')

NUMBER = re.compile(r'-?\d+(?:\.\d+)?')
PLACEHOLDER = re.compile(r'\{(\d+)\}')

# Attributes the sim depends on, in the order the report prints them. 'text' and 'numbers'
# come from the tooltip and are what closes a rank 1 extrapolation.
CHANGE_ORDER = ['renamed', 'name', 'tree', 'position', 'ranks', 'spellIds', 'prereq', 'text', 'numbers']


# ---------------------------------------------------------------------------------------------
# Both schemas are flattened to one record per talent so the comparison has a single shape:
#   fieldName, name, tree, treeIdx, row, col, maxRank, spellIds, prereq, prereqPos,
#   description, ranks, notSimulated

def talents_from_data(data):
	trees = sorted(data['trees'], key=lambda t: t.get('order', 0))
	records = []
	for tree_idx, tree in enumerate(trees):
		by_id = {talent['id']: talent for talent in tree['talents']}
		for talent in sorted(tree['talents'], key=lambda t: (t['row'], t['col'])):
			requires = talent.get('requires') or []
			prereq = by_id.get(requires[0]['talent']) if requires else None
			records.append({
				'fieldName': camel_case(talent['id']),
				'name': talent.get('name'),
				'tree': tree['name'],
				'treeIdx': tree_idx,
				'row': talent['row'],
				'col': talent['col'],
				'maxRank': talent['maxRank'],
				'spellIds': talent.get('spellIds'),
				'prereq': camel_case(requires[0]['talent']) if requires else None,
				'prereqPos': (prereq['row'], prereq['col']) if prereq else None,
				'description': talent.get('description'),
				'ranks': talent.get('ranks'),
				'notSimulated': False,
			})
	return records


def talents_from_tree(trees):
	records = []
	for tree_idx, tree in enumerate(trees):
		by_pos = {(t['location']['rowIdx'], t['location']['colIdx']): t for t in tree['talents']}
		for talent in tree['talents']:
			location = talent['location']
			pre = talent.get('prereqLocation')
			prereq = by_pos.get((pre['rowIdx'], pre['colIdx'])) if pre else None
			records.append({
				'fieldName': talent['fieldName'],
				'name': talent.get('name'),
				'tree': tree['name'],
				'treeIdx': tree_idx,
				'row': location['rowIdx'],
				'col': location['colIdx'],
				'maxRank': talent['maxPoints'],
				'spellIds': talent.get('spellIds'),
				'prereq': prereq['fieldName'] if prereq else None,
				'prereqPos': (pre['rowIdx'], pre['colIdx']) if pre else None,
				'description': talent.get('description'),
				'ranks': talent.get('ranks'),
				'notSimulated': bool(talent.get('notSimulated')),
			})
	return records


def is_tree_schema(document):
	return isinstance(document, list)


def load_dataset(path, tree_schema, overrides_dir, class_name=None):
	"""One dataset file -> (class name, records)."""
	with open(path) as f:
		document = json.load(f)

	class_name = class_name or os.path.splitext(os.path.basename(path))[0].lower()
	if tree_schema or is_tree_schema(document):
		return class_name, talents_from_tree(document)

	class_name = document.get('class', class_name).lower()
	if overrides_dir:
		document = apply_overrides(document, os.path.join(overrides_dir, class_name + '.json'))
	return class_name, talents_from_data(document)


def current_talents(class_name, trees_dir, data_dir, overrides_dir):
	"""What the sim has: the tree json, with the tooltip it was imported from filled in."""
	with open(os.path.join(trees_dir, class_name + '.json')) as f:
		records = talents_from_tree(json.load(f))

	data_path = os.path.join(data_dir, class_name + '.json')
	if os.path.exists(data_path):
		with open(data_path) as f:
			data = apply_overrides(json.load(f), os.path.join(overrides_dir, class_name + '.json'))
		by_field = {talent['fieldName']: talent for talent in talents_from_data(data)}
		for record in records:
			source = by_field.get(record['fieldName'])
			if source is None:
				continue
			for key in ('name', 'description', 'ranks'):
				if record.get(key) is None:
					record[key] = source[key]

	return records


# ---------------------------------------------------------------------------------------------
# Matching. Field names are the identity the sim uses, so they go first; a talent that was
# renamed still sits in the same place with the same name, so names and positions pick up
# what the field names miss. Whatever is left is an addition or a removal.

def normalise_name(name):
	return re.sub(r'[^a-z0-9]', '', name.lower()) if name else None


def unique_index(records, key):
	index = {}
	for record in records:
		k = key(record)
		if k is not None:
			index.setdefault(k, []).append(record)
	return {k: v[0] for k, v in index.items() if len(v) == 1}


def pair_up(old, new):
	old_left, new_left = list(old), list(new)
	pairs = []
	for how, key in [
		('fieldName', lambda r: r['fieldName']),
		('name', lambda r: normalise_name(r['name'])),
		('position', lambda r: (r['treeIdx'], r['row'], r['col'])),
	]:
		old_by, new_by = unique_index(old_left, key), unique_index(new_left, key)
		for k, new_record in new_by.items():
			old_record = old_by.get(k)
			if old_record is None:
				continue
			pairs.append((old_record, new_record, how))
			old_left.remove(old_record)
			new_left.remove(new_record)
	return pairs, old_left, new_left


# ---------------------------------------------------------------------------------------------
# Tooltip numbers. Descriptions carry {0}, {1}, ... and ranks carries the values per rank, so
# rendering each rank and pulling the numbers back out gives one list per rank to compare. A
# description with the numbers written in (as a datamine may well have) renders to itself.

def format_value(value):
	if isinstance(value, float) and value.is_integer():
		return str(int(value))
	return str(value)


def render(description, values):
	def fill(match):
		i = int(match.group(1))
		return format_value(values[i]) if i < len(values) else match.group(0)
	return PLACEHOLDER.sub(fill, description)


def rank_numbers(record):
	description, ranks = record.get('description'), record.get('ranks')
	if description is None and not ranks:
		return None
	if not ranks:
		return [NUMBER.findall(description)]

	used = {int(i) for i in PLACEHOLDER.findall(description or '')}
	numbers = []
	for values in ranks:
		found = NUMBER.findall(render(description or '', values))
		# A value with no placeholder to land in is still a number the rank carries.
		found += [format_value(v) for i, v in enumerate(values) if i not in used]
		numbers.append(found)
	return numbers


def skeleton(record):
	"""The description with its numbers taken out, to tell a wording change from a number change."""
	description = record.get('description')
	if description is None:
		return None
	ranks = record.get('ranks') or []
	text = render(description, ranks[0]) if ranks else description
	text = PLACEHOLDER.sub('#', NUMBER.sub('#', text))
	return ' '.join(text.split())


# ---------------------------------------------------------------------------------------------

def position(record):
	return 'r%dc%d' % (record['row'], record['col'])


def prereq_label(record):
	if record['prereq'] is None and record['prereqPos'] is None:
		return None
	label = record['prereq'] or '?'
	if record['prereqPos']:
		label += ' (r%dc%d)' % record['prereqPos']
	return label


def compare(old, new):
	changes = []

	def change(kind, before, after):
		changes.append({'kind': kind, 'old': before, 'new': after})

	if old['fieldName'] != new['fieldName']:
		change('renamed', old['fieldName'], new['fieldName'])
	if old['name'] and new['name'] and normalise_name(old['name']) != normalise_name(new['name']):
		change('name', old['name'], new['name'])
	if old['treeIdx'] != new['treeIdx']:
		change('tree', old['tree'], new['tree'])
	if (old['row'], old['col']) != (new['row'], new['col']):
		change('position', position(old), position(new))
	if old['maxRank'] != new['maxRank']:
		change('ranks', old['maxRank'], new['maxRank'])
	if new['spellIds'] is not None and old['spellIds'] is not None and list(old['spellIds']) != list(new['spellIds']):
		change('spellIds', list(old['spellIds']), list(new['spellIds']))

	# Prerequisites compare by the talent they point at when both sides know it, so a
	# prerequisite that moved with its talent doesn't read as a new arrow.
	if old['prereq'] and new['prereq']:
		if old['prereq'] != new['prereq']:
			change('prereq', prereq_label(old), prereq_label(new))
	elif old['prereqPos'] != new['prereqPos']:
		change('prereq', prereq_label(old), prereq_label(new))

	old_skeleton, new_skeleton = skeleton(old), skeleton(new)
	if old_skeleton is not None and new_skeleton is not None and old_skeleton != new_skeleton:
		change('text', old['description'], new['description'])

	old_numbers, new_numbers = rank_numbers(old), rank_numbers(new)
	if old_numbers is not None and new_numbers is not None:
		shared = min(len(old_numbers), len(new_numbers))
		if any(old_numbers[i] != new_numbers[i] for i in range(shared)):
			change('numbers', old_numbers, new_numbers)

	changes.sort(key=lambda c: CHANGE_ORDER.index(c['kind']))
	return changes


# ---------------------------------------------------------------------------------------------
# The checklist. Each line names a sim file and line with a TODO beside a number read off the
# demo. A line is tied to a talent when the note names it, when the code under the TODO reads
# its field, or when the file is named after it. Line numbers drift as files are edited, so the
# TODO is looked up again rather than trusted.

def snake_case(field_name):
	return re.sub(r'(?<!^)(?=[A-Z])', '_', field_name).lower()


def find_todo(lines, line_no, note):
	def matches(i):
		return 0 <= i < len(lines) and 'TODO' in lines[i]

	if matches(line_no - 1):
		return line_no
	head = ' '.join(note.split()[:4]).lower()
	for distance in range(1, 12):
		for i in (line_no - 1 - distance, line_no - 1 + distance):
			if matches(i) and head in lines[i].lower():
				return i + 1
	for i, line in enumerate(lines):
		if 'TODO' in line and head in line.lower():
			return i + 1
	return None


def fields_near(lines, line_no):
	"""Talent fields the code right under a TODO reads, stopping at the next function or TODO."""
	fields = set()
	start = max(0, line_no - 3)
	for i in range(start, min(len(lines), line_no + 12)):
		line = lines[i]
		if i > line_no and (line.startswith('func ') or 'TODO' in line):
			break
		fields.update(re.findall(r'Talents\.([A-Z][A-Za-z0-9]*)', line))
	return fields


def load_checklist(path, repo_dir, classes):
	entries = {}
	section = None
	with open(path) as f:
		for line in f:
			heading = re.match(r'## (\w+)', line)
			if heading:
				section = heading.group(1).lower()
				section = section if section in classes else None
				continue
			item = re.match(r'- `(sim/[^:`]+):(\d+)` — (.*)', line.strip())
			if not item or section is None:
				continue

			file_path, line_no, note = item.group(1), int(item.group(2)), item.group(3)
			entry = {'file': file_path, 'listedLine': line_no, 'line': line_no, 'note': note, 'fields': set(), 'found': False}
			full_path = os.path.join(repo_dir, file_path)
			if os.path.exists(full_path):
				with open(full_path) as source:
					lines = source.read().splitlines()
				found = find_todo(lines, line_no, note)
				if found is not None:
					entry['line'] = found
					entry['found'] = True
					entry['fields'] = fields_near(lines, found - 1)
			entries.setdefault(section, []).append(entry)
	return entries


def checklist_for(entries, record):
	field = record['fieldName'][0].upper() + record['fieldName'][1:]
	name = record.get('name')
	matched = []
	for entry in entries:
		file_stem = os.path.splitext(os.path.basename(entry['file']))[0]
		if field in entry['fields'] or file_stem == snake_case(record['fieldName']):
			matched.append(entry)
		elif name and re.search(r'\b%s\b' % re.escape(name), entry['note'], re.IGNORECASE):
			matched.append(entry)
	return matched


def sim_files_reading(class_name, field_name):
	"""Files in sim/<class> that read the talent, for the talents no checklist line covers."""
	field = field_name[0].upper() + field_name[1:]
	pattern = re.compile(r'Talents\.%s\b' % re.escape(field))
	files = []
	class_dir = os.path.join(SIM_DIR, class_name)
	for root, _, names in os.walk(class_dir):
		for name in sorted(names):
			if not name.endswith('.go') or name.endswith('_test.go'):
				continue
			path = os.path.join(root, name)
			with open(path) as f:
				if pattern.search(f.read()):
					files.append(os.path.relpath(path, REPO_DIR))
	return files


# ---------------------------------------------------------------------------------------------

def diff_class(class_name, new_records, args, checklist):
	old_records = current_talents(class_name, args.trees, args.data, args.overrides)
	pairs, removed, added = pair_up(old_records, new_records)
	entries = checklist.get(class_name, [])

	talents = []
	covered = set()

	def attach(record, report):
		matched = checklist_for(entries, record)
		covered.update(id(e) for e in matched)
		report['checklist'] = [{
			'file': e['file'], 'line': e['line'], 'listedLine': e['listedLine'], 'note': e['note'], 'found': e['found'],
		} for e in matched]
		report['notSimulated'] = record['notSimulated']
		if not matched and not record['notSimulated']:
			report['simFiles'] = sim_files_reading(class_name, record['fieldName'])

	for old, new, how in sorted(pairs, key=lambda p: (p[1]['treeIdx'], p[1]['row'], p[1]['col'])):
		changes = compare(old, new)
		report = {
			'fieldName': new['fieldName'],
			'oldFieldName': old['fieldName'],
			'name': new['name'] or old['name'],
			'tree': new['tree'],
			'matchedBy': how,
			'status': 'changed' if changes else 'unchanged',
			'changes': changes,
		}
		if changes:
			attach(old, report)
		talents.append(report)

	for record in sorted(added, key=lambda r: (r['treeIdx'], r['row'], r['col'])):
		report = {
			'fieldName': record['fieldName'], 'name': record['name'], 'tree': record['tree'], 'status': 'added',
			'position': position(record), 'maxRank': record['maxRank'], 'description': record.get('description'),
			'ranks': record.get('ranks'), 'changes': [],
		}
		attach(record, report)
		talents.append(report)

	for record in sorted(removed, key=lambda r: (r['treeIdx'], r['row'], r['col'])):
		report = {
			'fieldName': record['fieldName'], 'name': record['name'], 'tree': record['tree'], 'status': 'removed',
			'position': position(record), 'maxRank': record['maxRank'], 'changes': [],
		}
		attach(record, report)
		talents.append(report)

	summary = {
		'changed': sum(1 for t in talents if t['status'] == 'changed'),
		'unchanged': sum(1 for t in talents if t['status'] == 'unchanged'),
		'numeric': sum(1 for t in talents if any(c['kind'] == 'numbers' for c in t['changes'])),
		'added': len(added),
		'removed': len(removed),
		'renamed': sum(1 for t in talents if any(c['kind'] == 'renamed' for c in t['changes'])),
		'checklistUncovered': sum(1 for e in entries if id(e) not in covered),
		'checklistTotal': len(entries),
	}
	return {'class': class_name, 'summary': summary, 'talents': talents}


def class_changed(result):
	s = result['summary']
	return bool(s['changed'] or s['added'] or s['removed'])


# ---------------------------------------------------------------------------------------------

def format_numbers(numbers):
	return ', '.join(numbers) if numbers else '-'


def print_class(result, out):
	s = result['summary']
	out.append('%s: %d changed, %d unchanged, %d with numeric changes (%d added, %d removed, %d renamed)' % (
		result['class'].capitalize(), s['changed'], s['unchanged'], s['numeric'], s['added'], s['removed'], s['renamed']))

	for talent in result['talents']:
		if talent['status'] == 'unchanged':
			continue

		label = talent['fieldName']
		if talent['status'] == 'changed' and talent['oldFieldName'] != talent['fieldName']:
			label = '%s -> %s' % (talent['oldFieldName'], talent['fieldName'])
		out.append('  %s / %s [%s]%s' % (talent['tree'], talent['name'] or talent['fieldName'], label,
			'' if talent['status'] == 'changed' else '  ' + talent['status'].upper()))

		if talent['status'] != 'changed':
			out.append('    %-11s %s, %d rank%s' % ('at', talent['position'], talent['maxRank'], '' if talent['maxRank'] == 1 else 's'))
			if talent['status'] == 'added' and talent.get('description'):
				out.append('    %-11s %s' % ('tooltip', talent['description']))
				for i, values in enumerate(talent.get('ranks') or []):
					out.append('    %-11s rank %d: %s' % ('', i + 1, ', '.join(format_value(v) for v in values)))

		for change in talent['changes']:
			kind = change['kind']
			if kind == 'numbers':
				out.append('    %-11s %-24s %s' % ('numbers', 'sim', 'new'))
				for i in range(max(len(change['old']), len(change['new']))):
					old = format_numbers(change['old'][i]) if i < len(change['old']) else '(no rank)'
					new = format_numbers(change['new'][i]) if i < len(change['new']) else '(no rank)'
					out.append('    %-11s %-24s %s%s' % ('  rank %d' % (i + 1), old, new, '' if old == new else '  *'))
			elif kind == 'text':
				out.append('    %-11s sim: %s' % ('text', change['old']))
				out.append('    %-11s new: %s' % ('', change['new']))
			elif kind == 'spellIds':
				out.append('    %-11s %s -> %s' % ('spell ids', change['old'], change['new']))
			else:
				out.append('    %-11s %s -> %s' % (kind, change['old'] if change['old'] is not None else 'none',
					change['new'] if change['new'] is not None else 'none'))

		for entry in talent.get('checklist', []):
			where = '%s:%d' % (entry['file'], entry['line'])
			if not entry['found']:
				where += ' (TODO not found, listed at :%d)' % entry['listedLine']
			elif entry['line'] != entry['listedLine']:
				where += ' (listed at :%d)' % entry['listedLine']
			out.append('    %-11s %s - %s' % ('checklist', where, entry['note']))
		if talent.get('notSimulated'):
			out.append('    %-11s not read by the sim' % 'sim')
		elif not talent.get('checklist') and 'simFiles' in talent:
			files = talent['simFiles']
			out.append('    %-11s %s' % ('sim', 'read in ' + ', '.join(files) if files else 'nothing in sim/%s reads this talent' % result['class']))

	if class_changed(result) and s['checklistUncovered']:
		out.append('  %d of the %d checklist lines for %s are not tied to a changed talent; they still need the pass.' % (
			s['checklistUncovered'], s['checklistTotal'], result['class'].capitalize()))


def dataset_paths(paths):
	files = []
	for path in paths:
		if os.path.isdir(path):
			files += sorted(os.path.join(path, name) for name in os.listdir(path) if name.endswith('.json'))
		else:
			files.append(path)
	return files


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument('dataset', nargs='*', help='dataset files or directories; defaults to data/')
	parser.add_argument('--tree-schema', action='store_true', help='the dataset is in the ui/core/talents/trees layout')
	parser.add_argument('--class', dest='class_name', help='class of a single dataset file that is not named after it')
	parser.add_argument('--apply-overrides', action='store_true',
		help='apply overrides/ to the dataset as the importer does; for checking the vendored data, not a datamine')
	parser.add_argument('--json', action='store_true', help='machine readable output')
	parser.add_argument('--trees', default=TREE_DIR, help='the trees the sim runs on')
	parser.add_argument('--data', default=DATA_DIR, help='the data the trees were imported from, for tooltip text')
	parser.add_argument('--overrides', default=OVERRIDE_DIR)
	parser.add_argument('--checklist', default=CHECKLIST)
	args = parser.parse_args()

	classes = {os.path.splitext(name)[0] for name in os.listdir(args.trees) if name.endswith('.json')}
	checklist = load_checklist(args.checklist, REPO_DIR, classes) if os.path.exists(args.checklist) else {}

	paths = dataset_paths(args.dataset or [DATA_DIR])
	if args.class_name and len(paths) != 1:
		parser.error('--class goes with a single dataset file')

	results = []
	for path in paths:
		class_name, records = load_dataset(path, args.tree_schema, args.overrides if args.apply_overrides else None, args.class_name)
		if class_name not in classes:
			sys.stderr.write('%s: no tree for class %r in %s\n' % (path, class_name, args.trees))
			sys.exit(2)
		results.append(diff_class(class_name, records, args, checklist))

	changed = any(class_changed(r) for r in results)
	if args.json:
		json.dump({'changed': changed, 'classes': results}, sys.stdout, indent=2)
		sys.stdout.write('\n')
	else:
		out = []
		for result in results:
			print_class(result, out)
		totals = [sum(r['summary'][k] for r in results) for k in ('changed', 'unchanged', 'numeric', 'added', 'removed')]
		out.append('Total: %d changed, %d unchanged, %d with numeric changes, %d added, %d removed.' % tuple(totals))
		print('\n'.join(out))

	sys.exit(1 if changed else 0)


if __name__ == '__main__':
	main()
