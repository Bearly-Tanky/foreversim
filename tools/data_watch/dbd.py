#!/usr/bin/python

# Reads a WoWDBDefs .dbd definition and decodes a raw DB2 row against it, which is what turns a
# hotfix cache from "4,311 rows changed in ItemSparse" into "this item's stats are now these".
#
#   python tools/data_watch/dbd.py ItemSparse 1.60.1.69893     # show the layout
#
# A .dbd is a COLUMNS block naming every field and its base type, then one LAYOUT per row format
# with the fields in their on-disk order and their widths. A build picks exactly one layout.
#
# Two things about hotfix rows in particular, both of which will silently produce nonsense if you
# get them wrong rather than failing:
#
#   - A field marked `$noninline,id$` is NOT in the row data. The id lives in the cache record's
#     own header, so reading it out of the payload shifts every field after it.
#   - Strings are inline and null-terminated here, not the string-block offsets a packed .db2 uses.

import re
import sys

BASE = {'int': 'i', 'uint': 'i', 'float': 'f', 'string': 's', 'locstring': 's'}
CACHE = __file__.rsplit('dbd.py', 1)[0] + 'dbd_cache'
URL = 'https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/{}.dbd'


def definition(name):
    """The .dbd text for a table, fetched once and kept on disk."""
    import os
    import urllib.request

    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + '.dbd')
    if not os.path.exists(path):
        urllib.request.urlretrieve(URL.format(name), path)
    return open(path, encoding='utf-8').read()


def parse(text, build):
    """(fields, comment) for one build, where a field is (name, kind, bits, signed, count)."""
    types = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line == 'COLUMNS':
            continue
        if line.startswith('LAYOUT'):
            break
        base = line.split('<')[0].split()[0]
        name = line.split()[-1].rstrip('?')
        types[name] = BASE.get(base, 'i')

    blocks = re.split(r'\nLAYOUT ', '\n' + text)
    for block in blocks[1:]:
        lines = block.splitlines()
        builds = [b.strip() for line in lines if line.startswith('BUILD ') for b in line[6:].split(',')]
        if build not in builds:
            continue
        fields = []
        for line in lines[1:]:
            line = line.strip()
            if not line or line.startswith(('BUILD', 'COMMENT', 'LAYOUT')):
                continue
            noninline = '$noninline' in line
            line = re.sub(r'^\$[^$]*\$', '', line)
            count = 1
            array = re.search(r'\[(\d+)\]$', line)
            if array:
                count = int(array.group(1))
                line = line[: array.start()]
            bits, signed = None, True
            width = re.search(r'<(u?)(\d+)>$', line)
            if width:
                signed = width.group(1) != 'u'
                bits = int(width.group(2))
                line = line[: width.start()]
            name = line
            kind = types.get(name, 'i')
            if kind in 'if' and bits is None:
                bits = 32
            if noninline:
                continue  # lives in the record header, not the row
            fields.append((name, kind, bits, signed, count))
        return fields
    sys.exit(f'no layout for build {build}')


def decode(fields, data):
    """Row bytes -> {name: value}. Raises if the row is shorter than the layout demands."""
    out, off = {}, 0
    for name, kind, bits, signed, count in fields:
        values = []
        for _ in range(count):
            if kind == 's':
                end = data.index(b'\0', off)
                values.append(data[off:end].decode('utf-8', 'replace'))
                off = end + 1
            elif kind == 'f':
                values.append(_float(data, off))
                off += 4
            else:
                values.append(_int(data, off, bits, signed))
                off += bits // 8
        out[name] = values[0] if count == 1 else values
    return out, off


def _int(data, off, bits, signed):
    if off + bits // 8 > len(data):
        raise ValueError('row shorter than layout')
    return int.from_bytes(data[off : off + bits // 8], 'little', signed=signed)


def _float(data, off):
    import struct

    if off + 4 > len(data):
        raise ValueError('row shorter than layout')
    return struct.unpack_from('<f', data, off)[0]


if __name__ == '__main__':
    import urllib.request

    name, build = sys.argv[1], sys.argv[2]
    url = f'https://raw.githubusercontent.com/wowdev/WoWDBDefs/master/definitions/{name}.dbd'
    fields = parse(urllib.request.urlopen(url).read().decode(), build)
    print(f'{name} @ {build}: {len(fields)} fields in the row')
    for f in fields:
        print('  ', f)
