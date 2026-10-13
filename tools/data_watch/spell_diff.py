#!/usr/bin/python

# Diffs a list of spell ids between the Forever beta client and Classic Era, printing only the ones
# where something the sim reads has moved: duration, cooldown, cast time, cost, or any effect's
# value, coefficient, period or per-level scaling.
#
#   tools/data_watch/spell_diff.py 25289 25291 20906      # Battle Shout, Blessing of Might, Trueshot
#
# Written for the core buff audit, where the question is "did Forever change this at all", and
# spell_client.py's per-spell output is too much to read one id at a time.

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spell_client import ERA, FOREVER, Client

def sig(s):
    if not s:
        return None
    return dict(
        dur=s['durationMs'], cd=s['cooldownMs'], cast=s['castTimeMs'],
        cost=[(c['power'], c['flat'], c['pctOfBase']) for c in s['cost']],
        eff=[(e['index'], e['effect'], e['aura'], e['low'], e['high'], e['spCoefficient'],
              e['apCoefficient'], e['periodMs'], e['perLevel']) for e in s['effects']],
    )

def main(ids):
    f, e = Client(FOREVER), Client(ERA)
    for i in ids:
        fs, es = f.spell(i), e.spell(i)
        if fs is None and es is None:
            print(f'{i}\tMISSING in both'); continue
        if fs is None:
            print(f'{i}\t{es["name"]}\tREMOVED in Forever'); continue
        if es is None:
            print(f'{i}\t{fs["name"]}\tNEW in Forever'); continue
        a, b = sig(fs), sig(es)
        if a == b:
            continue
        print(f'{i}\t{fs["name"]} {fs["rank"]}')
        for k in a:
            if a[k] != b[k]:
                print(f'    {k}:\n      era     {b[k]}\n      forever {a[k]}')

if __name__ == '__main__':
    main([int(x) for x in sys.argv[1:]])
