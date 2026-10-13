#!/usr/bin/python

# Are Forever's *rtng stat keys ratings or percentages?
#
#   python tools/data_watch/wh_rating_units.py
#
# It decides 930 items' crit and 399 items' hit, so it is worth settling rather than assuming.
# The test: take items that appear in both gear-planner dumps, where Classic writes a percentage
# (mlecritstrkpct, hitpct) and Forever writes the renamed key (critstrkrtng, hitrtng). If the two
# numbers are equal the key is a percentage wearing a retail name. If Forever's is larger by a
# consistent factor, it is a rating and that factor is the conversion.

import collections
import json
import os
import statistics
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wh_compare_sources import SOURCES, block

# Classic key -> the Forever key that replaced it.
RENAMES = {
    'mlecritstrkpct': 'critstrkrtng',
    'hitpct': 'hitrtng',
    'mlehitpct': 'hitrtng',
    'spldmg': 'splpwr',
    'mleatkpwr': 'atkpwr',
    'def': 'defrtng',
    'dodgepct': 'dodgertng',
    'blockpct': 'blockrtng',
    'parrypct': 'parryrtng',
}


def stats_by_id(text):
    out = {}
    i = text.find('"stats":{')
    while i >= 0:
        # The id is written a few hundred bytes before its stats block.
        head = text.rfind('"id":', max(0, i - 2000), i)
        if head >= 0:
            item_id = int(text[head + 5 : text.index(',', head)])
            out[item_id] = json.loads(block(text, i + len('"stats":')))
        i = text.find('"stats":{', i + 1)
    return out


def main():
    dumps = {name: stats_by_id(open(path, encoding='utf-8', errors='replace').read()) for name, path in SOURCES.items()}
    classic, forever = dumps['classic'], dumps['forever']
    print(f'{len(classic)} classic items, {len(forever)} forever items, {len(set(classic) & set(forever))} in both\n')

    for old, new in RENAMES.items():
        ratios, equal, examples = [], 0, []
        for item_id in set(classic) & set(forever):
            a, b = classic[item_id].get(old), forever[item_id].get(new)
            if not a or not b:
                continue
            ratios.append(b / a)
            equal += a == b
            if len(examples) < 3:
                examples.append((item_id, a, b))
        if not ratios:
            print(f'{old} -> {new}: no item carries both')
            continue
        counts = collections.Counter(round(r, 3) for r in ratios)
        print(f'{old} -> {new}: {len(ratios)} items, {equal} identical, median ratio {statistics.median(ratios):.3f}')
        print(f'   commonest ratios: {counts.most_common(3)}   e.g. {examples}')


if __name__ == '__main__':
    main()
