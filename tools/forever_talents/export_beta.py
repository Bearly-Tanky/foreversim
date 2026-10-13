#!/usr/bin/python

# Exports the Forever talent trees from a beta client build into the data/<class>.json schema that
# diff_trees.py and import_talents.py read, so beta day is: export, diff, fix, import.
#
#   tools/forever_talents/export_beta.py 1.60.1.69893 beta/        # writes beta/<class>.json
#
# Source is wago.tools' DB2 export of the build (cached under beta/.cache). Forever does NOT use the
# Classic Talent/TalentTab tables - in the beta those are unchanged Era leftovers. Its trees are the
# retail-style Trait tables: one TraitTree per class, the three tabs laid side by side on one canvas.
#
# Rank values: the live trait definition has a TraitDefinitionEffectPoints curve per effect and
# CurvePoint(rank) is the value at that rank (checked on Ignite 8/16/24/32/40, Ruin 20..100, Improved
# Life Tap 10/20, Deflection 2..10). Durations are stored in milliseconds and rage in tenths; the
# tooltip's own divisor ($/1000;s1, ${$m1/1000}) is applied, so {0} carries what the tooltip shows.
# Tokens this does not model ($d, other spells' values, formulas) stay literal in the description and
# show up as text changes in the diff rather than as silently wrong numbers.

import argparse
import collections
import csv
import io
import json
import os
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_talents import TREE_DIR

TABLES = ['TraitTree', 'TraitNode', 'TraitNodeEntry', 'TraitDefinition', 'TraitDefinitionEffectPoints',
          'TraitEdge', 'TraitNodeXTraitNodeEntry', 'CurvePoint', 'SpellName', 'Spell', 'SpellEffect']
CLASSES = ['druid', 'hunter', 'mage', 'paladin', 'priest', 'rogue', 'shaman', 'warlock', 'warrior']

# Canvas layout of the class trees in 1.60.1: tab origins on PosX, 600 per column and per row.
TAB_X0 = [1020, 5020, 9080]
Y0, STEP = 2130, 600

# $s1 $m1 $S1 $M1, optionally with a divisor: $/1000;s1  ${$m1/1000}  ${$m1/-10}  ${$m1/1000}.1 (one decimal)
TOKEN = re.compile(r'\$/(-?\d+);([smSM])(\d)|\$\{\$([smSM])(\d)/(-?\d+)\}(?:\.\d)?|\$([smSM])(\d)')


def table(build, name, cache):
	path = os.path.join(cache, f'{name}_{build}.csv')
	if not os.path.exists(path):
		req = urllib.request.Request(f'https://wago.tools/db2/{name}/csv?build={build}',
		                             headers={'User-Agent': 'wowsims-forever export_beta'})
		with urllib.request.urlopen(req, timeout=180) as r:
			data = r.read()
		with open(path, 'wb') as f:
			f.write(data)
	with open(path, encoding='utf-8') as f:
		return list(csv.DictReader(f))


def kebab(name):
	# "Nature's Grace" -> nature-s-grace would camel-case to natureSGrace; the sim's field is naturesGrace.
	return re.sub(r'[^a-z0-9]+', '-', name.lower().replace("'", '')).strip('-')


def norm(name):
	return re.sub(r'[^a-z0-9]', '', (name or '').lower())


def on_grid(v, hi):
	# A few nodes carry a stray extra zero (39300, 102800).
	while v > hi:
		v //= 10
	return v


def number(v):
	v = abs(v)
	return int(v) if float(v).is_integer() else round(v, 2)


class Client:
	def __init__(self, build, cache):
		t = {name: table(build, name, cache) for name in TABLES}
		self.spell_name = {r['ID']: r['Name_lang'] for r in t['SpellName']}
		self.description = {r['ID']: r['Description_lang'] for r in t['Spell']}
		self.definition = {r['ID']: r for r in t['TraitDefinition']}
		entries = {r['ID']: r for r in t['TraitNodeEntry']}
		self.node_entries = collections.defaultdict(list)
		for r in t['TraitNodeXTraitNodeEntry']:
			self.node_entries[r['TraitNodeID']].append(entries[r['TraitNodeEntryID']])
		self.curve = collections.defaultdict(dict)
		for r in t['TraitDefinitionEffectPoints']:
			self.curve[r['TraitDefinitionID']][int(r['EffectIndex'])] = r['CurveID']
		self.points = collections.defaultdict(dict)
		for r in t['CurvePoint']:
			self.points[r['CurveID']][round(float(r['Pos_0']))] = float(r['Pos_1'])
		self.base = collections.defaultdict(dict)
		for r in t['SpellEffect']:
			self.base[r['SpellID']][int(r['EffectIndex'])] = float(r['EffectBasePointsF'])
		self.nodes = collections.defaultdict(list)
		for r in t['TraitNode']:
			self.nodes[r['TraitTreeID']].append(r)
		self.edges = [r for r in t['TraitEdge'] if r['Type'] != '0']  # type 0 is drawn but not a requirement

	def value(self, def_id, spell, effect, rank):
		curve = self.curve[def_id].get(effect)
		if curve and rank in self.points[curve]:
			return self.points[curve][rank]
		return self.base[spell].get(effect, 0.0)

	def tooltip(self, def_id, spell, max_rank):
		"""Description with {i} placeholders, and the values per rank."""
		d = self.definition[def_id]
		text = d['OverrideDescription_lang'] or self.description.get(spell, '')
		slots = []

		def slot(effect, divisor):
			key = (effect, divisor)
			if key not in slots:
				slots.append(key)
			return '{%d}' % slots.index(key)

		def sub(m):
			if m.group(1):
				return slot(int(m.group(3)) - 1, int(m.group(1)))
			if m.group(4):
				return slot(int(m.group(5)) - 1, int(m.group(6)))
			return slot(int(m.group(8)) - 1, 1)

		# Colour codes and the client's hard line wraps are presentation, not wording.
		text = re.sub(r'\|c[0-9A-Fa-f]{8}|\|[rR]', '', text)
		text = TOKEN.sub(sub, text)
		# Unmodelled tokens ($d, $o1, $16922d, ${...}) keep their meaning but lose their digits, or the diff
		# would read a spell id as a tooltip number.
		text = re.sub(r'\$\{[^}]*\}(?:\.\d)?|\$(?:/-?\d+;)?(\d+)?([a-zA-Z])(\d)?', lambda m: '<%s%s>' % ('other spell ' if m.group(1) else '', m.group(2) if m.group(2) else 'formula'), text)
		text = re.sub(r'\s+', ' ', text).strip()
		ranks = [[number(self.value(def_id, spell, e, r) / div) for e, div in slots] for r in range(1, max_rank + 1)]
		return text, ranks

	def class_tree(self, sim_names):
		"""The TraitTree whose talent names overlap the sim's trees most."""
		def names(tree_id):
			return {norm(self.name_of(n)) for n in self.nodes[tree_id]}
		return max((t for t in self.nodes if len(self.nodes[t]) >= 40), key=lambda t: len(names(t) & sim_names))

	def name_of(self, node):
		es = self.node_entries.get(node['ID'])
		if not es:
			return ''
		d = self.definition[es[0]['TraitDefinitionID']]
		return d['OverrideName_lang'] or self.spell_name.get(d['SpellID'], '')


def export_class(client, class_name):
	with open(os.path.join(TREE_DIR, class_name + '.json')) as f:
		sim_trees = json.load(f)
	sim_names = {norm(t['name']) for tree in sim_trees for t in tree['talents']}
	tree_id = client.class_tree(sim_names)

	talents = []
	for node in client.nodes[tree_id]:
		entries = client.node_entries.get(node['ID'])
		if not entries:
			continue
		entry = entries[0]
		def_id = entry['TraitDefinitionID']
		spell = client.definition[def_id]['SpellID']
		name = client.name_of(node)
		x, y = on_grid(int(node['PosX']), 11000), on_grid(int(node['PosY']), 6000)
		tab = max(i for i, x0 in enumerate(TAB_X0) if x >= x0 - 100)
		max_rank = int(entry['MaxRanks'])
		description, ranks = client.tooltip(def_id, spell, max_rank)
		talents.append(dict(node=int(node['ID']), tab=tab, id=kebab(name), name=name,
		                    row=round((y - Y0) / STEP), col=round((x - TAB_X0[tab]) / STEP),
		                    maxRank=max_rank, spell=int(spell), description=description, ranks=ranks))

	# Two nodes for one spell: the client kept a stale copy. Keep the newest node.
	newest = {}
	for t in sorted(talents, key=lambda t: t['node']):
		newest[t['spell']] = t
	talents = list(newest.values())
	by_node = {t['node']: t for t in talents}
	for e in client.edges:
		left, right = by_node.get(int(e['LeftTraitNodeID'])), by_node.get(int(e['RightTraitNodeID']))
		if left and right and left['row'] <= right['row']:  # an upward edge is the reverse copy of a real one
			right.setdefault('requires', []).append({'talent': left['id']})

	# Tabs carry no names in the Trait tables; take them from the sim tree they overlap most.
	trees = []
	for tab in range(3):
		keys = {norm(t['name']) for t in talents if t['tab'] == tab}
		sim = max(sim_trees, key=lambda tr: len(keys & {norm(t['name']) for t in tr['talents']}))
		trees.append(dict(id=kebab(sim['name']), name=sim['name'], order=sim_trees.index(sim),
		                  talents=[{k: v for k, v in t.items() if k not in ('node', 'tab', 'spell')}
		                           for t in sorted(talents, key=lambda t: (t['row'], t['col'])) if t['tab'] == tab]))
	return dict(**{'class': class_name}, className=class_name.title(), dataSource=f'beta client {client.build}',
	            trees=sorted(trees, key=lambda t: t['order']))


def main():
	parser = argparse.ArgumentParser(description='Export Forever talent trees from a beta client build.')
	parser.add_argument('build', help='client build, e.g. 1.60.1.69893')
	parser.add_argument('out_dir')
	parser.add_argument('classes', nargs='*', default=CLASSES)
	args = parser.parse_args()
	cache = os.path.join(args.out_dir, '.cache')
	os.makedirs(cache, exist_ok=True)
	client = Client(args.build, cache)
	client.build = args.build
	for class_name in args.classes:
		data = export_class(client, class_name)
		with open(os.path.join(args.out_dir, class_name + '.json'), 'w') as f:
			json.dump(data, f, indent='\t')
			f.write('\n')
		count = sum(len(t['talents']) for t in data['trees'])
		print(f'{class_name}: {count} talents', file=sys.stderr)


if __name__ == '__main__':
	main()
