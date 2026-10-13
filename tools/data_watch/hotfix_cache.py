#!/usr/bin/python

# Reads the live client's hotfix cache, Cache/ADB/<locale>/DBCache.bin, and reports which tables
# Blizzard has changed since the build shipped.
#
#   tools/data_watch/hotfix_cache.py                      # default install path
#   tools/data_watch/hotfix_cache.py --cache <DBCache.bin>
#   tools/data_watch/hotfix_cache.py --ids 0x0ad67ebf     # record ids for one table
#
# Why this exists: every other tool here reads wago.tools, which serves a build's DB2 tables as
# they shipped. Hotfixes are applied on top of those at runtime and are never in the static data,
# so a value the sim reads from wago can be stale the moment Blizzard tunes it. This says whether
# that has happened and to what.
#
# The file is a header - magic 'XFTH', version, build, a 32 byte hash - followed by records:
#
#   char[4] magic 'XFTH'
#   int32   regionID
#   int32   pushID
#   uint32  uniqueID
#   uint32  tableHash
#   int32   recordID
#   uint32  dataSize
#   uint8   status
#   uint8   pad[3]
#   uint8   data[dataSize]
#
# A record with dataSize 0 invalidates a row rather than carrying a new one.
#
# Naming the tables: tableHash is stored in each DB2 file's own header rather than derived from
# its name, so no amount of hashing the name reproduces it - Jenkins lookup3, one-at-a-time and
# SStrHash over 38 names in 7 spellings all match nothing. But the mapping is published:
# WoWDBDefs ships a manifest of every DB2 with its tableHash, so this reads the names straight
# out of that rather than guessing.
#
# --match is the older fingerprint - which DB2's ID space contains every hotfixed record id - and
# is kept only to corroborate. It is worth much less than the manifest and it lies: on the cache
# that made this worth fixing it called LightData "SpellCategories", because record ids that land
# inside a big table's id space prove nothing.

import argparse
import collections
import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spell_client import FOREVER, table

DEFAULT_CACHE = r'C:\Program Files (x86)\World of Warcraft\_classic_beta_\Cache\ADB\enUS\DBCache.bin'

# The tables the sim reads, to fingerprint hotfixed record ids against.
REFERENCE = [
	'SpellName', 'Spell', 'SpellEffect', 'SpellMisc', 'SpellAuraOptions', 'SpellCooldowns',
	'SpellPower', 'SpellLevels', 'SpellCategories', 'SpellClassOptions', 'SpellLabel',
	'SpellDuration', 'SpellRadius', 'SpellCastTimes', 'SpellItemEnchantment', 'ItemSparse',
	'ItemEffect', 'ItemSet', 'ItemSetSpell', 'SkillLineAbility',
]


MANIFEST_URL = 'https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/manifest.json'
MANIFEST_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dbd_manifest.json')


def table_names():
	"""tableHash -> DB2 name, from WoWDBDefs. Cached on disk; absent means offline, not fatal."""
	if not os.path.exists(MANIFEST_CACHE):
		try:
			import urllib.request

			urllib.request.urlretrieve(MANIFEST_URL, MANIFEST_CACHE)
		except Exception as error:  # noqa: BLE001 - names are a convenience, the records still read
			print(f'  (no table names: {error})', file=sys.stderr)
			return {}
	return {int(e['tableHash'], 16): e['tableName'] for e in json.load(open(MANIFEST_CACHE)) if e.get('tableHash')}


def read(path):
	"""Every record in the cache, as (tableHash, recordID, dataSize, status, data)."""
	blob = open(path, 'rb').read()
	if blob[:4] != b'XFTH':
		sys.exit(f'{path} is not a hotfix cache (magic {blob[:4]!r})')
	version, build = struct.unpack_from('<II', blob, 4)
	off = 44  # magic, version, build, then a 32 byte hash
	out = []
	while off < len(blob) - 32 and blob[off:off + 4] == b'XFTH':
		_region, _push, _uid, table_hash, record_id, size = struct.unpack_from('<iiIIiI', blob, off + 4)
		status = blob[off + 28]
		off += 32
		out.append((table_hash, record_id, size, status, blob[off:off + size]))
		off += size
	return version, build, out


def sidecars(adb_dir):
	"""The named per-table caches sitting beside DBCache.bin, which answer the question directly.

	The client keeps one <Table><pid>.tmp per table it caches hotfixes for, and a table with
	nothing to cache gets a 4 byte stub. So the file sizes say which tables have been hotfixed
	without any of the tableHash guesswork: a 4 byte Spell<pid>.tmp means no spell hotfixes at
	all. The files are held open while the client runs, but their sizes are readable.
	"""
	try:
		names = [n for n in os.listdir(adb_dir) if n.endswith('.tmp')]
	except OSError:
		return
	if not names:
		return
	by_pid = collections.defaultdict(list)
	for name in sorted(names):
		stem = name[:-4]
		i = len(stem)
		while i > 0 and stem[i - 1].isdigit():
			i -= 1
		table_name, pid = stem[:i], stem[i:]
		size = os.path.getsize(os.path.join(adb_dir, name))
		by_pid[pid].append((table_name, size))
	print('\nper-table caches (4 bytes means the client has no hotfixes for that table):')
	for pid, rows in sorted(by_pid.items()):
		live = [f'{t} {s:,}' for t, s in rows if s > 4]
		empty = [t for t, s in rows if s <= 4]
		print(f'  client pid {pid}: ' + (', '.join(live) if live else 'nothing cached'))
		if empty:
			print(f'    empty: {", ".join(empty)}')


def main():
	parser = argparse.ArgumentParser(description="What the client's hotfix cache has changed.")
	parser.add_argument('--cache', default=DEFAULT_CACHE)
	parser.add_argument('--ids', help='print record ids for one tableHash, e.g. 0x0ad67ebf')
	parser.add_argument('--match', action='store_true', help='fingerprint tables against the DB2 id spaces')
	args = parser.parse_args()

	if not os.path.exists(args.cache):
		sys.exit(f'no hotfix cache at {args.cache}; pass --cache')
	version, build, records = read(args.cache)
	carrying = [r for r in records if r[2] > 0]
	print(f'{args.cache}\n  version {version}, build {build}')
	print(f'  {len(records)} records, {len(carrying)} carrying data, {len(records) - len(carrying)} invalidations')
	sidecars(os.path.dirname(args.cache))

	if args.ids:
		want = int(args.ids, 16) if args.ids.startswith('0x') else int(args.ids)
		ids = sorted(r[1] for r in records if r[0] == want)
		print(f'\n0x{want:08x}: {len(ids)} record ids')
		print('  ' + ', '.join(str(i) for i in ids[:200]))
		return

	spaces = {}
	if args.match:
		for name in REFERENCE:
			try:
				spaces[name] = {int(r['ID']) for r in table(FOREVER, name)}
			except Exception:  # noqa: BLE001 - a table missing from a build is not fatal here
				pass

	by_table = collections.defaultdict(list)
	for table_hash, record_id, size, _status, _data in carrying:
		by_table[table_hash].append((record_id, size))

	names = table_names()
	print(f'\n{len(by_table)} tables carry data:')
	for table_hash, rows in sorted(by_table.items(), key=lambda kv: -len(kv[1])):
		ids = {r[0] for r in rows}
		avg = sum(r[1] for r in rows) // len(rows)
		note = '  ' + names.get(table_hash, '(unknown table)')
		if spaces:
			hits = [(len(ids & s) / len(ids), n) for n, s in spaces.items() if len(ids & s) == len(ids)]
			hits.sort(reverse=True)
			# Appended, never substituted: the manifest name is the answer, this is only a second
			# opinion, and where they disagree it is this one that is wrong.
			note += f'  (fingerprint: {hits[0][1]}{", too few rows to trust" if len(ids) < 5 else ""})' if hits else '  (fingerprint: none)'
		print(f'  0x{table_hash:08x}  {len(rows):6d} rows  {avg:5d} bytes avg{note}')


if __name__ == '__main__':
	main()
