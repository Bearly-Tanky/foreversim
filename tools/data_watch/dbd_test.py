#!/usr/bin/python

# python tools/data_watch/dbd_test.py
#
# The thing worth pinning is the offset arithmetic: a decoder that gets a width or an inline
# string wrong still returns a full dict of plausible numbers, so nothing downstream notices.

import struct

import dbd

DEF = """COLUMNS
int ID
locstring Name_lang
int Value
float Ratio
int Flags

LAYOUT ABCD1234
BUILD 1.0.0.1
$noninline,id$ID<32>
Name_lang
Value<32>
Ratio
Flags<u8>[3]
"""


def test_parse():
    fields = dbd.parse(DEF, '1.0.0.1')
    # ID is non-inline: it lives in the record header, so it must not be in the row.
    assert [f[0] for f in fields] == ['Name_lang', 'Value', 'Ratio', 'Flags'], fields
    assert fields[1] == ('Value', 'i', 32, True, 1)
    assert fields[3] == ('Flags', 'i', 8, False, 3)


def test_decode():
    data = b'Thunderfury\x00' + struct.pack('<if', -7, 1.5) + bytes([1, 2, 255])
    row, used = dbd.decode(dbd.parse(DEF, '1.0.0.1'), data)
    assert used == len(data), (used, len(data))
    assert row == {'Name_lang': 'Thunderfury', 'Value': -7, 'Ratio': 1.5, 'Flags': [1, 2, 255]}, row


def test_short_row_raises():
    try:
        dbd.decode(dbd.parse(DEF, '1.0.0.1'), b'x\x00\x01\x02')
    except ValueError:
        return
    raise AssertionError('a row shorter than the layout must raise, not return half a dict')


if __name__ == '__main__':
    test_parse()
    test_decode()
    test_short_row_raises()
    print('ok')
