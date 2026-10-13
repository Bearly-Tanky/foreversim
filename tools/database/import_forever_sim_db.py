"""Writes assets/db_inputs/forever_sim_db.json: the items, enchants and random suffixes of our
Forever sim's database (ElliotWood/Forever master, assets/database/db.json), in this engine's
shapes. gen_db merges it under the client data, so it only fills in what the client does not ship.

    git -C <master checkout> show origin/master:assets/database/db.json > master_db.json
    python tools/database/import_forever_sim_db.py master_db.json assets/db_inputs/forever_sim_db.json

Master stores hit, crit, haste, dodge, parry, block and expertise as percent; this engine takes
rating, at the client's CombatRatings conversion (sim/core/base_stats_auto_gen.go).
"""
import json
import sys

# master Stat -> (this engine's Stat, rating per master unit)
STATS = {
    0: (0, 1), 1: (1, 1), 2: (2, 1), 3: (3, 1), 4: (16, 1),  # str agi sta int spi
    5: (5, 1),  # SpellPower -> SpellDamage (heals read SpellDamage here)
    6: (6, 1), 7: (7, 1), 8: (8, 1), 9: (9, 1), 10: (10, 1), 11: (11, 1),  # school damage
    12: (35, 1),  # MP5
    13: (12, 10), 14: (13, 14), 15: (14, 10),  # spell hit/crit/haste %
    16: (15, 1),  # spell penetration
    17: (17, 1),  # AP
    18: (20, 10), 19: (21, 14), 20: (22, 10),  # melee hit/crit/haste %
    21: (23, 1),
    22: (24, 10),  # expertise %: 2.5 rating per 0.25%
    23: (34, 1), 26: (31, 1), 27: (18, 1),  # mana, armor, RAP
    28: (25, 1),  # defense skill, 1 rating per point
    29: (26, 5), 30: (27, 1), 31: (28, 12), 32: (29, 15),  # block %, block value, dodge %, parry %
    33: (30, 1), 34: (33, 1),  # resilience, health
    35: (36, 1), 36: (37, 1), 37: (38, 1), 38: (39, 1), 39: (40, 1),  # resistances
    40: (32, 1), 41: (4, 1), 42: (5, 1), 43: (19, 1),  # bonus armor, healing, spell damage, feral AP
}
CLASSES = {1: 11, 2: 3, 3: 8, 4: 2, 5: 5, 6: 4, 7: 7, 8: 9, 9: 1}
RANGED_TYPES = {4: 6, 5: 7, 6: 4, 7: 8, 8: 5}
NUM_STATS = 42


def convert_stats(values):
    a = list(values) + [0] * (44 - len(values))
    # Forever pays gear hit and crit into both pools and master stores that as the same number
    # in both. This engine sums the two pools (unifyGearHitAndCrit), so count it once.
    for melee, spell in ((18, 13), (19, 14)):
        if a[melee] and a[melee] == a[spell]:
            a[spell] = 0
    out = {}
    for i, v in enumerate(a):
        if v:
            j, per = STATS[i]
            out[j] = out.get(j, 0) + round(v * per, 4)
    return out


def as_array(stats):
    a = [0] * NUM_STATS
    for k, v in stats.items():
        a[k] = v
    return a


def item(m):
    scaling = {'ilvl': m.get('ilvl', 0)}
    stats = convert_stats(m.get('stats', []))
    if m.get('bonusPhysicalDamage'):
        stats[41] = m['bonusPhysicalDamage']
    if stats:
        scaling['stats'] = {str(k): v for k, v in sorted(stats.items())}
    if m.get('weaponDamageMin'):
        scaling['weaponDamageMin'] = m['weaponDamageMin']
        scaling['weaponDamageMax'] = m['weaponDamageMax']
    out = {k: m[k] for k in ('id', 'name', 'icon', 'type', 'armorType', 'weaponType', 'handType', 'weaponSpeed',
                             'phase', 'quality', 'unique', 'setName', 'setId', 'expansion', 'factionRestriction',
                             'randomSuffixOptions', 'requiredProfession') if m.get(k)}
    if m.get('rangedWeaponType'):
        out['rangedWeaponType'] = RANGED_TYPES.get(m['rangedWeaponType'], m['rangedWeaponType'])
    if m.get('classAllowlist'):
        out['classAllowlist'] = [CLASSES[c] for c in m['classAllowlist']]
    # Rep sources name factions by a different enum here; the rest share one shape.
    sources = [s for s in m.get('sources', []) if 'rep' not in s]
    if sources:
        out['sources'] = sources
    out['scalingOptions'] = {'0': scaling}
    return out


def enchant(m):
    out = {k: v for k, v in m.items() if k not in ('stats', 'classAllowlist')}
    out['stats'] = as_array(convert_stats(m.get('stats', [])))
    if m.get('classAllowlist'):
        out['classAllowlist'] = [CLASSES[c] for c in m['classAllowlist']]
    return out


def main(src, dst):
    master = json.load(open(src, encoding='utf-8'))
    out = {
        'items': [item(m) for m in master['items']],
        'enchants': [enchant(m) for m in master['enchants']],
        # Forever's random suffixes are flat enchantments, like Classic's (see ItemEquipmentBaseStats).
        'randomSuffixes': [{'id': r['id'], 'name': r['name'], 'stats': as_array(convert_stats(r['stats']))}
                           for r in master['randomSuffixes']],
        'zones': master['zones'],
        'npcs': master['npcs'],
    }
    with open(dst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('{\n')
        for i, key in enumerate(out):
            f.write(f'"{key}":[\n')
            f.write(',\n'.join(json.dumps(x, separators=(',', ':'), ensure_ascii=False) for x in out[key]))
            f.write('\n]' + (',' if i < len(out) - 1 else '') + '\n')
        f.write('}\n')
    print({k: len(v) for k, v in out.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
