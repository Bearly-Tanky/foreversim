#!/usr/bin/python

# Generates the UI talent tree layout, e.g. 'ui/core/talents/trees/warlock.json', and the
# matching talents proto message from the Forever talent data in ./data.
#
# The proto field numbers and the order of the talents in the tree json have to agree,
# because FillTalentsProto maps the nth character of a talent string to field number n.
# Both are emitted in (row, col) order so they line up by construction.
#
# Usage:
#   tools/forever_talents/import_talents.py warlock            # print the proto message
#   tools/forever_talents/import_talents.py warlock --write    # also rewrite the tree json
#   tools/forever_talents/import_talents.py warlock --presentation --crops ../wow-forever-talent-calc
#                                                              # refresh only the names, icons and
#                                                                descriptions of the talents the
#                                                                database cannot name; copy the
#                                                                video icon crops
#   tools/forever_talents/import_talents.py --unranked         # list talents whose per-rank
#                                                                scaling isn't known for any class

import json
import os
import re
import shutil
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
OVERRIDE_DIR = os.path.join(os.path.dirname(__file__), 'overrides')
TREE_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ui', 'core', 'talents', 'trees')
SIM_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'sim')
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'database', 'db.json')
# The icons the site serves itself. An icon the mirror does not hold would draw a broken
# image, so a name that is not in here is no better than no name at all.
ICON_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img', 'wowhead', 'icons', 'large')
# Icon crops for talents whose icon is new to Forever, relative to the site root.
CROP_DIR = os.path.join('assets', 'img', 'talents')

# Talents that didn't exist in Classic have no spell id to give the picker. They carry their
# name, icon and tooltip through to the tree json instead, and the picker draws those.
PLACEHOLDER_SPELL_ID = 0


def camel_case(talent_id):
	head, *rest = talent_id.split('-')
	return head + ''.join(part.title() for part in rest)


def apply_overrides(data, override_path):
	if not os.path.exists(override_path):
		return data

	with open(override_path) as f:
		overrides = json.load(f)['overrides']

	by_id = {talent['id']: talent for tree in data['trees'] for talent in tree['talents']}
	by_tree = {tree['name'].lower(): tree for tree in data['trees']}
	for override in overrides:
		talent = by_id.get(override['talent'])
		if talent is None:
			# A talent the datamined pass missed entirely. 'add' carries the whole entry so
			# it survives a regenerated dataset, which would otherwise drop it again.
			entry = override.get('add')
			tree = by_tree.get(str(override.get('tree', '')).lower())
			if entry is None or tree is None:
				continue
			talent = dict(entry, id=override['talent'])
			tree['talents'].append(talent)
			by_id[talent['id']] = talent
		talent.update(override.get('set', {}))
		for key in override.get('unset', []):
			talent.pop(key, None)

	return data


def load_class(class_name):
	with open(os.path.join(DATA_DIR, class_name + '.json')) as f:
		data = json.load(f)

	return apply_overrides(data, os.path.join(OVERRIDE_DIR, class_name + '.json'))


def database_spell_ids():
	"""Spell ids the sim's database knows, and so can name, link and draw an icon for."""
	with open(DB_PATH) as f:
		return {spell['id'] for spell in json.load(f)['spellIcons']}


def database_spells():
	"""What the sim's database would call and draw for each spell id it knows."""
	with open(DB_PATH) as f:
		return {spell['id']: (spell['name'], spell.get('icon')) for spell in json.load(f)['spellIcons']}


def simulated_talents(class_name):
	"""Field names the class's Go package actually reads.

	A talent the sim never looks at still draws a box the player can spend points in, and
	since the tooltips landed it describes an effect that isn't modelled. Rather than keep
	a hand-written list in step with the code, read it back off the source: anything whose
	Go field name appears nowhere outside the generated protobuf is not simulated.
	"""
	seen = set()
	class_dir = os.path.join(SIM_DIR, class_name)
	for root, _, files in os.walk(class_dir):
		if os.sep + 'proto' + os.sep in root + os.sep:
			continue
		for name in files:
			if not name.endswith('.go') or name.startswith('_'):
				continue
			with open(os.path.join(root, name)) as f:
				seen.update(re.findall(r'\b([A-Z][A-Za-z0-9_]*)\b', f.read()))
	return seen

def sorted_talents(tree):
	return sorted(tree['talents'], key=lambda talent: (talent['row'], talent['col']))


def spell_ids(talent, existing):
	# Keep whatever the tree already used so regenerating doesn't churn icons.
	if talent['name'] in existing:
		return existing[talent['name']]

	prior = talent.get('ranksPrior') or {}
	ids = prior.get('classicSpellIds') or []
	if ids:
		return (ids + [ids[-1]] * talent['maxRank'])[:talent['maxRank']]

	return [PLACEHOLDER_SPELL_ID] * talent['maxRank']


def build_tree_json(data, existing_by_tree, simulated, known_spells, crops_from=None):
	trees = []
	for tree in sorted(data['trees'], key=lambda t: t['order']):
		existing = existing_by_tree.get(tree['name'], {})
		locations = {talent['id']: talent for talent in tree['talents']}

		talents = []
		for talent in sorted_talents(tree):
			entry = {
				'fieldName': camel_case(talent['id']),
				'location': {'rowIdx': talent['row'], 'colIdx': talent['col']},
			}

			requires = talent.get('requires') or []
			if requires:
				prereq = locations.get(requires[0]['talent'])
				if prereq is not None:
					entry['prereqLocation'] = {'rowIdx': prereq['row'], 'colIdx': prereq['col']}

			entry['spellIds'] = spell_ids(talent, existing)
			entry['maxPoints'] = talent['maxRank']

			if not any(spell_id in known_spells for spell_id in entry['spellIds']):
				add_presentation(entry, data['class'], talent, simulated, crops_from)

			talents.append(entry)

		trees.append({
			'name': tree['name'],
			'backgroundUrl': existing_by_tree.get('backgroundUrl', {}).get(tree['name'], ''),
			'talents': talents,
		})

	return trees


# A talent the database cannot name has nothing to link or draw: either Forever added it
# (spell id 0) or it came from a later expansion whose id the Classic database does not
# carry. Carry the datamined presentation through and let the picker render it locally.
def mirrored(icon):
	"""Whether the site already serves this icon."""
	return os.path.exists(os.path.join(ICON_DIR, icon + '.jpg'))


def add_presentation(entry, class_name, talent, simulated, crops_from, fallback_icon=None):
	entry['name'] = talent['name']
	if talent.get('iconSource') == 'crop':
		# A genuinely new icon: the only picture of it is the crop of the demo video frame,
		# which the picker draws from the site's own assets.
		crop = copy_icon_crop(class_name, talent, crops_from)
		if crop:
			entry['iconUrl'] = crop
		elif fallback_icon:
			# No frame to cut this one from. Keep drawing whatever the talent already drew
			# rather than fall through to the question mark; the name and the numbers below
			# are still the talent's own, and only the picture is standing in.
			entry['icon'] = fallback_icon
	elif talent.get('icon'):
		# A real Wowhead icon, even where the mirror has not been asked for it yet: naming it
		# here is what puts it on the Update Icons workflow's list, and that job has the
		# network access to fetch it. Only the crops above have no source left to fetch from.
		entry['icon'] = talent['icon']
	if talent.get('description'):
		entry['description'] = talent['description']
	if talent.get('ranks'):
		entry['ranks'] = talent['ranks']
	if entry['fieldName'][0].upper() + entry['fieldName'][1:] not in simulated:
		entry['notSimulated'] = True


def refresh_presentation(class_name, data, crops_from):
	"""Rewrites only the presentation of the tree json's unnamed talents, in place.

	The trees have been corrected by hand since they were generated (talent positions,
	a renamed talent or two), so regenerating them would reorder fields and invalidate
	every saved talent string. This keeps order, locations and spell ids as they are.
	"""
	tree_path = os.path.join(TREE_DIR, class_name + '.json')
	with open(tree_path) as f:
		trees = json.load(f)

	by_field = {camel_case(talent['id']): talent for tree in data['trees'] for talent in tree['talents']}
	# The proto field was named before the dataset settled on the talent's name.
	by_field['bloodCraze'] = by_field.get('bloodCrazed')
	known_spells = database_spells()
	simulated = simulated_talents(class_name)
	refreshed, unmatched = 0, []
	for tree in trees:
		for entry in tree['talents']:
			talent = by_field.get(entry['fieldName'])
			# The Classic database is never authoritative about a Forever talent. It named
			# the wrong talent outright where a new one had borrowed Classic spell ids, and
			# matching names are no safer: Improved Revenge is called the same thing in both
			# and Forever turned its stun into damage, so the database described an effect
			# the sim does not have. Every talent the datamined set knows is presented from
			# it, and only a talent the set has never heard of falls back to the database.
			if talent is None:
				unmatched.append(entry['fieldName'])
				continue
			first_id = next((spell_id for spell_id in entry['spellIds'] if spell_id), None)
			_, db_icon = known_spells.get(first_id, (None, None))
			add_presentation(entry, class_name, talent, simulated, crops_from, fallback_icon=db_icon)
			refreshed += 1

	with open(tree_path, 'w') as f:
		json.dump(trees, f, indent=2)
		f.write('\n')
	print('%s: refreshed %d talents' % (class_name, refreshed))
	for field_name in unmatched:
		sys.stderr.write('\t%s is not in the dataset under that name; left as is\n' % field_name)


def copy_icon_crop(class_name, talent, crops_from):
	"""Copies the talent's icon crop out of the source dataset and returns its site path.

	Without a dataset to copy from, a crop already in the tree keeps its place.
	"""
	target = os.path.join(CROP_DIR, class_name, talent['id'] + '.png')
	repo_target = os.path.join(os.path.dirname(__file__), '..', '..', target)
	if crops_from and talent.get('iconCrop'):
		source = os.path.join(crops_from, talent['iconCrop'])
		if os.path.exists(source):
			os.makedirs(os.path.dirname(repo_target), exist_ok=True)
			shutil.copyfile(source, repo_target)
	if os.path.exists(repo_target):
		return target.replace(os.sep, '/')
	return None


def build_proto(data):
	lines = ['message %sTalents {' % data['className']]
	field = 1
	for tree in sorted(data['trees'], key=lambda t: t['order']):
		lines.append('\t// %s' % tree['name'])
		for talent in sorted_talents(tree):
			name = camel_case(talent['id'])
			snake = ''.join('_' + c.lower() if c.isupper() else c for c in name)
			kind = 'bool' if talent['maxRank'] == 1 else 'int32'
			lines.append('\t%s %s = %d;' % (kind, snake, field))
			field += 1
		lines.append('')
	lines.append('}')
	return '\n'.join(lines)


# Talents where the source data repeats rank 1's numbers for every rank, so the real
# per-rank scaling is unknown. Anything implemented from these is a guess.
def unranked_talents(data):
	unranked = []
	for tree in sorted(data['trees'], key=lambda t: t['order']):
		for talent in sorted_talents(tree):
			ranks = talent.get('ranks') or []
			if talent['maxRank'] > 1 and len(ranks) > 1 and all(r == ranks[0] for r in ranks):
				unranked.append((tree['name'], talent['name'], talent['maxRank']))
	return unranked


def report_unranked():
	total = 0
	for path in sorted(os.listdir(DATA_DIR)):
		if not path.endswith('.json'):
			continue

		data = load_class(path[:-len('.json')])
		unranked = unranked_talents(data)
		total += len(unranked)
		print('%s: %d' % (data['className'], len(unranked)))
		for tree_name, name, max_rank in unranked:
			print('\t%s, %s, %d ranks' % (tree_name, name, max_rank))

	print('%d talents in total.' % total)


def main():
	if len(sys.argv) < 2:
		print(__doc__)
		sys.exit(1)

	if sys.argv[1] == '--unranked':
		report_unranked()
		return

	class_name = sys.argv[1]
	write = '--write' in sys.argv
	crops_from = sys.argv[sys.argv.index('--crops') + 1] if '--crops' in sys.argv else None
	data = load_class(class_name)

	if '--presentation' in sys.argv:
		refresh_presentation(class_name, data, crops_from)
		return

	tree_path = os.path.join(TREE_DIR, class_name + '.json')
	existing_by_tree = {}
	backgrounds = {}
	if os.path.exists(tree_path):
		with open(tree_path) as f:
			for tree in json.load(f):
				existing_by_tree[tree['name']] = {}
				backgrounds[tree['name']] = tree.get('backgroundUrl', '')

		# Index the current spell ids by talent name so they survive a regeneration.
		with open(tree_path) as f:
			current = json.load(f)
		by_field = {t['fieldName']: t['spellIds'] for tree in current for t in tree['talents']}
		for tree in data['trees']:
			existing_by_tree.setdefault(tree['name'], {})
			for talent in tree['talents']:
				field_name = camel_case(talent['id'])
				if field_name in by_field:
					existing_by_tree[tree['name']][talent['name']] = by_field[field_name]

	existing_by_tree['backgroundUrl'] = backgrounds
	trees = build_tree_json(data, existing_by_tree, simulated_talents(class_name), database_spell_ids(), crops_from)

	if write:
		with open(tree_path, 'w') as f:
			json.dump(trees, f, indent=2)
			f.write('\n')
		print('wrote ' + tree_path)

	print(build_proto(data))

	unranked = unranked_talents(data)
	if unranked:
		sys.stderr.write('%d talents have no known per-rank scaling:\n' % len(unranked))
		for tree_name, name, max_rank in unranked:
			sys.stderr.write('\t%s, %s, %d ranks\n' % (tree_name, name, max_rank))


if __name__ == '__main__':
	main()
