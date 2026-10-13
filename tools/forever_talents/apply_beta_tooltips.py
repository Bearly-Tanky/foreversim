#!/usr/bin/python

# Copies tooltip text and per-rank numbers from a beta export (export_beta.py) into the talent trees the
# sim and its UI run on, ui/core/talents/trees/<class>.json. Structure is left alone: positions, ranks,
# prerequisites, renames and removals change the protos and the Go code, and belong to that pass.
#
#   tools/forever_talents/apply_beta_tooltips.py beta/            # every class in the directory
#   tools/forever_talents/apply_beta_tooltips.py beta/ --dry-run
#
# A beta tooltip that still contains a token export_beta.py does not model (<d>, <o>, <other spell d>)
# is skipped and listed, not copied: half a tooltip with a placeholder where a number was is worse than
# the old number. The rank count must also match, or the numbers belong to a different talent shape.
#
# It also rewrites assets/confirmed_talents.json from the same export: the numbers of every fully resolved
# beta tooltip, which TestConfirmedTalentRanksMatchTheSim holds the trees to. That file used to come from
# talentsforever.com, which was read off BlizzCon footage and is older than the beta client.

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_talents import TREE_DIR, camel_case


def norm(name):
	return re.sub(r'[^a-z0-9]', '', (name or '').lower())


CONFIRMED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'confirmed_talents.json')


def numbers(description, values):
	text = re.sub(r'\{(\d+)\}', lambda m: str(values[int(m.group(1))]), description)
	return [float(n) if '.' in n else int(n) for n in re.findall(r'\d+(?:\.\d+)?', text)]


def apply_class(beta_path, dry_run):
	with open(beta_path) as f:
		beta = json.load(f)
	class_name = beta['class']
	tree_path = os.path.join(TREE_DIR, class_name + '.json')
	with open(tree_path) as f:
		trees = json.load(f)

	by_field, by_name = {}, {}
	for tree in beta['trees']:
		for t in tree['talents']:
			by_field[camel_case(t['id'])] = t
			by_name[norm(t['name'])] = t

	confirmed = {}
	updated, unchanged, skipped = [], 0, []
	for tree in trees:
		for talent in tree['talents']:
			b = by_field.get(talent['fieldName']) or by_name.get(norm(talent.get('name')))
			label = f"{tree['name']} / {talent.get('name', talent['fieldName'])}"
			if b is None:
				skipped.append((label, 'not in the beta client'))
				continue
			if '<' in b['description']:
				skipped.append((label, 'beta tooltip uses a value this exporter does not resolve: ' + b['description']))
				continue
			if b['ranks'] and talent.get('ranks') and len(b['ranks'][0]) < len(talent['ranks'][0]):
				# "{0} to {1}" becoming "{0}": the client scales the value by level at runtime, so the table
				# number is not what the game shows and the range it replaced is the better reading.
				skipped.append((label, 'beta tooltip resolves fewer values than the tree: ' + b['description']))
				continue
			if len(b['ranks']) != talent['maxPoints']:
				skipped.append((label, f"rank count differs (sim {talent['maxPoints']}, beta {len(b['ranks'])})"))
				continue
			confirmed[b['name']] = [numbers(b['description'], r) for r in b['ranks']]
			if talent.get('description') == b['description'] and talent.get('ranks') == b['ranks']:
				unchanged += 1
				continue
			updated.append((label, talent.get('ranks'), b['ranks']))
			talent['description'] = b['description']
			talent['ranks'] = b['ranks']

	if not dry_run:
		with open(tree_path, 'w') as f:
			json.dump(trees, f, indent=2)
			f.write('\n')
	return class_name, updated, unchanged, skipped, confirmed, beta.get('dataSource', 'beta client')


def main():
	parser = argparse.ArgumentParser(description='Copy beta tooltips and rank numbers into the talent trees.')
	parser.add_argument('beta_dir')
	parser.add_argument('--dry-run', action='store_true')
	args = parser.parse_args()
	all_confirmed, source = {}, None
	for name in sorted(os.listdir(args.beta_dir)):
		if not name.endswith('.json'):
			continue
		class_name, updated, unchanged, skipped, confirmed, source = apply_class(os.path.join(args.beta_dir, name), args.dry_run)
		all_confirmed[class_name.title()] = confirmed
		print(f'{class_name}: {len(updated)} updated, {unchanged} already matched, {len(skipped)} skipped')
		for label, old, new in updated:
			print(f'  updated  {label}: {old[-1] if old else old} -> {new[-1]}')
		for label, why in skipped:
			print(f'  skipped  {label}: {why}')

	if not args.dry_run and all_confirmed:
		with open(CONFIRMED, 'w', newline='\r\n') as f:
			json.dump({'_readme': 'Talent rank values from the Forever beta client, numbers only, in the order they appear in each '
			                      'rank tooltip. TestConfirmedTalentRanksMatchTheSim holds the trees to them. Regenerate with '
			                      'tools/forever_talents/apply_beta_tooltips.py.',
			           'source': source, 'generated': source.split()[-1], 'talents': all_confirmed}, f, indent=1)
			f.write('\n')


if __name__ == '__main__':
	main()
