#!/usr/bin/python

# python tools/arena/background_test.py
#
# The bar and the clock are the only logic here worth pinning: everything else is a subprocess
# call or an HTTP request, and a test of those would only be testing the mocks.

import background


def test_bar():
    assert background.bar(0, 15) == '.' * 16
    assert background.bar(15, 15) == '#' * 16
    assert background.bar(7, 15).count('#') == 7  # round(16 * 7/15)
    # A run with no packages must not divide by zero.
    assert background.bar(0, 0) == '.' * 16


def test_elapsed():
    assert background.elapsed(0) == '0m 00s'
    assert background.elapsed(95) == '1m 35s'
    assert background.elapsed(3600) == '1h 00m'
    assert background.elapsed(7 * 3600 + 61) == '7h 01m'


if __name__ == '__main__':
    test_bar()
    test_elapsed()
    print('ok')
