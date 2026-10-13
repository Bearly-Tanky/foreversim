#!/usr/bin/python

# Diffs item set bonuses between the Forever beta client and Classic Era, resolving each bonus
# spell to its name, effects and tooltip so the sim side can be written without guessing.
#
#   tools/data_watch/set_diff.py 181 184 189      # by ItemSet id
#   tools/data_watch/set_diff.py --changed        # every set whose bonuses moved
#
# ItemSetSpell holds (ItemSetID, Threshold, SpellID). Forever rebuilt most of the tier and
# dungeon sets, moving Classic's 2/4/6/8 thresholds to 2/3/4/5/6, so comparing the whole list
# per set is the only way to see what a given piece count now gives.

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spell_client import ERA, FOREVER, Client, table


def bonuses(build):
	out = {}
	for r in table(build, 'ItemSetSpell'):
		out.setdefault(int(r['ItemSetID']), []).append((int(r['Threshold']), int(r['SpellID'])))
	return {k: sorted(v) for k, v in out.items()}


def main():
	parser = argparse.ArgumentParser(description='Item set bonuses, Forever against Era.')
	parser.add_argument('sets', nargs='*', type=int, help='ItemSet ids')
	parser.add_argument('--changed', action='store_true', help='every set whose bonuses moved')
	args = parser.parse_args()

	f, e = Client(FOREVER), Client(ERA)
	fname = {int(r['ID']): r['Name_lang'] for r in table(FOREVER, 'ItemSet')}
	ename = {int(r['ID']): r['Name_lang'] for r in table(ERA, 'ItemSet')}
	fs, es = bonuses(FOREVER), bonuses(ERA)

	ids = args.sets
	if args.changed:
		ids = sorted(k for k in set(fs) | set(es) if fs.get(k) != es.get(k))
	if not ids:
		sys.exit('give set ids or --changed')

	for sid in ids:
		print(f"=== [{sid}] {fname.get(sid) or ename.get(sid)}")
		print(f"    era     {es.get(sid)}")
		print(f"    forever {fs.get(sid)}")
		for threshold, spell_id in fs.get(sid, []):
			s = f.spell(spell_id)
			if not s:
				print(f"      {threshold}pc {spell_id}: not in the client")
				continue
			effects = ', '.join(
				f"e{x['index']} effect {x['effect']}"
				+ (f" aura {x['aura']}" if x['aura'] else '')
				+ f" {x['low']}" + (f"-{x['high']}" if x['high'] != x['low'] else '')
				+ (f" trigger {x['triggerSpell']}" if x['triggerSpell'] else '')
				for x in s['effects'])
			print(f"      {threshold}pc {spell_id} {s['name']!r}: {effects}")
			if s['description']:
				print(f"           {s['description'][:150]}")


if __name__ == '__main__':
	main()
