#!/usr/bin/python

# Which Wowhead dump does an item's stats come from, and do the two dumps agree?
#
#   python tools/data_watch/wh_compare_sources.py 16709 16731
#
# assets/db_inputs holds two gear-planner dumps: wowhead_gearplannerdb.txt (Classic Era) and
# wowhead_forever_gearplanner.txt (Forever). tools/database/gen_db reads the first. The second
# is only a snapshot for the data-change watcher. So where Forever has retuned an item, the
# sim carries the Classic value.

import json
import re
import sys

NAMES = ['strength', 'agility', 'stamina', 'intellect', 'spirit']
KEYS = {'str': 'strength', 'agi': 'agility', 'sta': 'stamina', 'int': 'intellect', 'spi': 'spirit'}
SOURCES = {
    'classic': 'assets/db_inputs/wowhead_gearplannerdb.txt',
    'forever': 'assets/db_inputs/wowhead_forever_gearplanner.txt',
}


def block(text, start):
    """The {...} starting at `start`, counting braces so a nested object does not end it early."""
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return ''


def stats_for(text, item_id):
    i = text.find(f'"{item_id}":{{')
    if i < 0:
        return None
    seg = text[i : i + 2000]
    j = seg.find('"stats":{')
    if j < 0:
        return []
    stats = json.loads(block(seg, j + len('"stats":')))
    return sorted(KEYS[k] for k in stats if k in KEYS)


def main(ids):
    dumps = {name: open(path, encoding='utf-8', errors='replace').read() for name, path in SOURCES.items()}
    sim = {int(i['id']): i for i in json.load(open('assets/database/db.json'))['items']}
    for item_id in ids:
        classic = stats_for(dumps['classic'], item_id)
        forever = stats_for(dumps['forever'], item_id)
        item = sim.get(item_id, {})
        have = sorted(NAMES[k] for k in range(5) if item.get('stats', [0] * 5)[k])
        name = re.search(r'"name":"([^"]*)"', dumps['forever'][dumps['forever'].find(f'"{item_id}":{{') :][:400])
        print(f'{item_id} {name.group(1) if name else item.get("name", "?")}')
        print(f'   classic dump : {classic}')
        print(f'   forever dump : {forever}')
        print(f'   sim database : {have}   <- follows {"classic" if have == classic else "forever" if have == forever else "neither"}')


if __name__ == '__main__':
    main([int(a) for a in sys.argv[1:]])
