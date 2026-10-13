#!/usr/bin/python

# How far apart the two Wowhead dumps are, and how much of the gap the sim is actually running.
#
#   python tools/data_watch/wh_source_audit.py            # every item in a gear set
#   python tools/data_watch/wh_source_audit.py --all      # every item in the sim's database
#
# tools/database/gen_db builds assets/database/db.json from wowhead_gearplannerdb.txt, the
# Classic Era gear planner. wowhead_forever_gearplanner.txt is Forever's own and is only kept
# as a snapshot for the data-change watcher. Where Forever has retuned an item, the sim is
# running the Classic values.

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wh_compare_sources import NAMES, SOURCES, stats_for


def gear_set_items():
    used = {}
    for path in glob.glob('ui/*/gear_sets/*.json'):
        for item in json.load(open(path)).get('items', []):
            if item.get('id'):
                used.setdefault(int(item['id']), []).append(os.path.basename(os.path.dirname(os.path.dirname(path))))
    return used


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true', help='audit every item, not only the simmed ones')
    args = parser.parse_args()

    dumps = {name: open(path, encoding='utf-8', errors='replace').read() for name, path in SOURCES.items()}
    sim = {int(i['id']): i for i in json.load(open('assets/database/db.json'))['items']}
    used = gear_set_items()
    ids = sorted(sim) if args.all else sorted(used)

    differ, missing_from_forever, same = [], 0, 0
    for item_id in ids:
        forever = stats_for(dumps['forever'], item_id)
        if forever is None:
            missing_from_forever += 1
            continue
        have = sorted(NAMES[k] for k in range(5) if sim.get(item_id, {}).get('stats', [0] * 5)[k])
        if have == forever:
            same += 1
        else:
            differ.append((item_id, sim[item_id]['name'], have, forever, sorted(set(used.get(item_id, [])))))

    print(f'{len(ids)} items checked: {same} match Forever, {len(differ)} do not, {missing_from_forever} absent from the Forever dump')
    for item_id, name, have, forever, specs in differ:
        print(f'  {item_id:>6} {name:<34} sim {have}')
        print(f'         {"":<34} forever {forever}   {", ".join(specs)}')


if __name__ == '__main__':
    main()
