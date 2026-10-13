"""How many talent builds a character could actually spend, per class.

Written because "run every talent configuration" keeps sounding like a big job rather than
an impossible one, and the only way to settle that is to count. Three rules, all enforced:
a talent's rank cap, the row gate - five points per row already spent in that tree - and the
prerequisite arrows, where a talent with an arrow into it needs its source maxed.

Row by row, memoised on (row, points spent above, which prerequisite targets are maxed),
which is everything a later row can depend on.

    python tools/talents/count_builds.py [points]   # points defaults to 51, level 60

Run at 1.60.1.69893 it gives 89,776,730,783,606,094 for a warrior. Enforcing the arrows cuts
the count about fourfold from the same walk without them, which is a lot and nowhere near
enough: at a second a simulated build that is still two billion years.
"""
#
# Three rules, all enforced: a talent's rank cap, the row gate (five points per row already
# spent in that tree), and the prerequisite arrows - a talent with an arrow into it needs
# its source maxed. The arrows are what the earlier count skipped.
#
# Row by row, memoised on (row, points above, which prerequisite targets are maxed), which
# is everything a later row can depend on.
import json
import sys
from itertools import product

def count_tree(talents, budget):
    rows = {}
    for t in talents:
        rows.setdefault(t['location']['rowIdx'], []).append(t)
    order = sorted(rows)
    for r in order:
        rows[r].sort(key=lambda t: t['location']['colIdx'])

    targets = {}
    for t in talents:
        pr = t.get('prereqLocation')
        if pr:
            targets.setdefault((pr['rowIdx'], pr['colIdx']), len(targets))

    # Legal ways to fill each row, precomputed: (points, mask bits set, needs-mask bits).
    per_row = []
    for r in order:
        moves = []
        for combo in product(*[range(t['maxPoints'] + 1) for t in rows[r]]):
            spent = sum(combo)
            if spent > budget:
                continue
            need = 0
            gains = 0
            any_points = False
            for t, p in zip(rows[r], combo):
                loc = (t['location']['rowIdx'], t['location']['colIdx'])
                if p > 0:
                    any_points = True
                    pr = t.get('prereqLocation')
                    if pr is not None:
                        bit = targets.get((pr['rowIdx'], pr['colIdx']))
                        if bit is None:
                            need = -1
                            break
                        need |= 1 << bit
                if loc in targets and p == t['maxPoints']:
                    gains |= 1 << targets[loc]
            if need == -1:
                continue
            moves.append((spent, need, gains, any_points))
        per_row.append((5 * r, moves))

    memo = {}
    def go(i, before, mask):
        if i == len(per_row):
            return {before: 1}
        key = (i, before, mask)
        hit = memo.get(key)
        if hit is not None:
            return hit
        gate, moves = per_row[i]
        out = {}
        for spent, need, gains, any_points in moves:
            if before + spent > budget:
                continue
            if any_points and (before < gate or (need & mask) != need):
                continue
            for s, n in go(i + 1, before + spent, mask | gains).items():
                out[s] = out.get(s, 0) + n
        memo[key] = out
        return out

    return go(0, 0, 0)

BUDGET = int(sys.argv[1]) if len(sys.argv) > 1 else 51

total_all = {}
for cls in ['druid','hunter','mage','paladin','priest','rogue','shaman','warlock','warrior']:
    trees = json.load(open(f'ui/sim/talents/trees/{cls}.json'))
    per = [count_tree(t['talents'], BUDGET) for t in trees]
    total = 0
    for a, na in per[0].items():
        for b, nb in per[1].items():
            c = BUDGET - a - b
            if c < 0:
                continue
            nc = per[2].get(c)
            if nc:
                total += na * nb * nc
    total_all[cls] = total
    print(f"{cls:9} {total:>24,}", flush=True)
print()
print(f"{'total':9} {sum(total_all.values()):>24,}")
