#!/usr/bin/python

# Decodes the ItemSparse rows in a hotfix cache and says where they disagree with the sim's item
# database. Hotfixes are applied on top of the shipped DB2s and never appear in a static export,
# so this is the only way to check item stats against what the client is actually running.
#
#   python tools/data_watch/hotfix_items.py --cache <DBCache.bin>
#   python tools/data_watch/hotfix_items.py --cache <DBCache.bin> --all   # agreements too
#
# What this does NOT do: convert an allocation back into a stat amount. StatPercentEditor is a
# share of an item-level budget, not a number of points, and turning one into the other needs the
# budget curve. So the comparison here is which stats an item carries, not how much - which is
# still enough to catch an item the sim thinks is statless.
#
# Worth knowing before reading too much into a disagreement: the sim's items come from Wowhead's
# live gear planner, which already reflects hotfixes. This is a second opinion on that, not a
# replacement for it.

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbd
import hotfix_cache

ITEMSPARSE = 0x919BE54E
# DB2 stat ids -> the sim's Stat enum. Only the primaries; the rest of the DB2 ids are ratings
# that Classic items do not carry.
DB2_TO_SIM = {3: 1, 4: 0, 5: 3, 6: 4, 7: 2}
SIM_NAME = {0: 'strength', 1: 'agility', 2: 'stamina', 3: 'intellect', 4: 'spirit'}
DB_JSON = 'assets/database/db.json'


def rows(cache, build):
    """Decoded ItemSparse hotfix rows, keyed by item id."""
    fields = dbd.parse(dbd.definition('ItemSparse'), build)
    out = {}
    for table_hash, record_id, size, _status, data in hotfix_cache.read(cache)[2]:
        if table_hash != ITEMSPARSE or size == 0:
            continue
        row, used = dbd.decode(fields, data)
        if used != size:
            sys.exit(f'item {record_id}: layout consumed {used} of {size} bytes - wrong build?')
        out[record_id] = row
    return out


def stats(row):
    return {DB2_TO_SIM[s] for s, v in zip(row['StatModifier_bonusStat'], row['StatPercentEditor']) if v > 0 and s in DB2_TO_SIM}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', required=True)
    parser.add_argument('--build', default='', help='client build, e.g. 1.60.1.69893; read from the cache by default')
    parser.add_argument('--all', action='store_true', help='also count the items that agree')
    args = parser.parse_args()

    repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _version, build, _records = hotfix_cache.read(args.cache)
    build = args.build or f'1.60.1.{build}'
    sim = {int(i['id']): i for i in json.load(open(os.path.join(repo, DB_JSON)))['items']}

    agree, disagree = 0, []
    for item_id, row in rows(args.cache, build).items():
        if item_id not in sim:
            continue
        live = stats(row)
        have = {i for i in DB2_TO_SIM.values() if sim[item_id]['stats'][i]}
        if not live and not have:
            continue
        if live == have:
            agree += 1
        else:
            disagree.append((item_id, sim[item_id]['name'], live, have))

    print(f'build {build}: {agree} items agree with the client, {len(disagree)} disagree')
    for item_id, name, live, have in sorted(disagree):
        missing = ', '.join(SIM_NAME[s] for s in sorted(live - have)) or '-'
        extra = ', '.join(SIM_NAME[s] for s in sorted(have - live)) or '-'
        print(f'  {item_id:>6}  {name:<38} client has: {missing:<28} sim has instead: {extra}')
    if args.all:
        print(f'\n({agree} agreed and are not listed)')


if __name__ == '__main__':
    main()
