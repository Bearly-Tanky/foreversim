#!/usr/bin/python

# Which stat keys each Wowhead dump uses, and which ones only one of them has.
#
#   python tools/data_watch/wh_stat_keys.py
#
# Forever's gear planner does not use Classic's key names everywhere - spell power is "splpwr"
# where Classic writes "spldmg" - so overlaying one dump's stats onto the other silently drops
# every stat whose key was renamed. This is what catches that before it ships.

import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wh_compare_sources import SOURCES, block

SKIP = {'appearances', 'displayid', 'avgbuyout', 'sellprice', 'slotbak', 'sheathtype', 'dura',
        'reqlevel', 'itemSquishEraId', 'maxcount', 'cooldown', 'buyprice'}


def keys(text):
    counts = collections.Counter()
    i = text.find('"stats":{')
    while i >= 0:
        stats = json.loads(block(text, i + len('"stats":')))
        counts.update(k for k in stats if k not in SKIP)
        i = text.find('"stats":{', i + 1)
    return counts


def main():
    counts = {name: keys(open(path, encoding='utf-8', errors='replace').read()) for name, path in SOURCES.items()}
    classic, forever = counts['classic'], counts['forever']
    print(f'{len(classic)} keys in the classic dump, {len(forever)} in the forever dump\n')
    print('only in forever (a rename here means the overlay drops the stat):')
    for k, n in sorted(forever.items(), key=lambda kv: -kv[1]):
        if k not in classic:
            print(f'  {k:<22} {n:>6} items')
    print('\nonly in classic:')
    for k, n in sorted(classic.items(), key=lambda kv: -kv[1]):
        if k not in forever:
            print(f'  {k:<22} {n:>6} items')


if __name__ == '__main__':
    main()
