#!/usr/bin/env python3
"""Report which client data rows changed between two Forever beta builds, straight from wago.tools.

    python wago_db2_diff.py OLD_BUILD NEW_BUILD > report.md

Forever's beta ships under wago's `wow_classic_beta` product as 1.60.x (first seen 2026-09-16). Every build
stays downloadable, so nothing is stored: both CSVs are fetched and compared by row ID.
"""
import csv
import io
import sys
import urllib.request

# Tables the sim reads rules from. Spell mechanics, ranks, racials, talents, items, enchants.
TABLES = [
    "SpellName", "Spell", "SpellEffect", "SpellMisc", "SpellLevels", "SpellCooldowns", "SpellDuration",
    "SpellCastTimes", "SpellAuraOptions", "SpellClassOptions", "SkillLineAbility", "ChrRaces", "ChrClasses",
    # Forever's talent trees live in the retail-style Trait tables. Talent/TalentTab are Classic leftovers in
    # the beta client (identical to Era apart from a blanked class id), so diffing them would mislead.
    "TraitTree", "TraitNode", "TraitNodeEntry", "TraitDefinition", "TraitEdge", "TraitCond",
    "ItemSparse", "ItemSet", "SpellItemEnchantment",
]
SHOW = 25


def fetch(table, build):
    url = f"https://wago.tools/db2/{table}/csv?build={build}"
    req = urllib.request.Request(url, headers={"User-Agent": "wowsims-forever-data-watch"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read().decode("utf-8", "replace")


def rows(text):
    reader = csv.reader(io.StringIO(text))
    header = next(reader, [])
    return {r[0]: r for r in reader if r}, header


def diff_table(old_text, new_text):
    old, _ = rows(old_text)
    new, _ = rows(new_text)
    added = sorted(set(new) - set(old), key=int_or_str)
    removed = sorted(set(old) - set(new), key=int_or_str)
    changed = sorted((k for k in set(old) & set(new) if old[k] != new[k]), key=int_or_str)
    return added, removed, changed


def int_or_str(k):
    return (0, int(k)) if k.lstrip("-").isdigit() else (1, k)


def report(old_build, new_build, get=fetch):
    names = {}
    try:
        names, _ = rows(get("SpellName", new_build))
    except Exception:  # noqa: BLE001 - labels are a nicety, never a reason to fail
        pass
    out, total = [], 0
    for t in TABLES:
        try:
            a, r, c = diff_table(get(t, old_build), get(t, new_build))
        except Exception as e:  # noqa: BLE001 - a table missing from one build is itself worth reporting
            out.append(f"### {t}: could not compare ({e.__class__.__name__})")
            continue
        n = len(a) + len(r) + len(c)
        if not n:
            continue
        total += n
        out.append(f"### {t}: +{len(a)} added, -{len(r)} removed, ~{len(c)} changed")
        for tag, keys in (("added", a), ("removed", r), ("changed", c)):
            if keys:
                label = (lambda k: f"{k} {names[k][1]}" if t.startswith("Spell") and k in names and len(names[k]) > 1 else k)
                shown = ", ".join(label(k) for k in keys[:SHOW])
                more = f" … and {len(keys) - SHOW} more" if len(keys) > SHOW else ""
                out.append(f"- {tag}: {shown}{more}")
    link = f"Full diff: https://wago.tools/builds-diff?to={new_build}&from={old_build}"
    head = f"**Client build {old_build} → {new_build}: {total} changed rows in the sim's tables**" if total \
        else f"**Client build {old_build} → {new_build}: no changes in the sim's tables**"
    return "\n".join([head, "", link, ""] + out)


def _selftest():
    data = {
        ("SpellName", "2"): "ID,Name_lang\n10,Blizzard\n11,Frostbolt\n",
        ("Spell", "1"): "ID,Description\n10,old\n11,same\n12,gone\n",
        ("Spell", "2"): "ID,Description\n10,new\n11,same\n13,fresh\n",
    }
    r = report("1", "2", get=lambda t, b: data.get((t, b), "ID\n"))
    assert "### Spell: +1 added, -1 removed, ~1 changed" in r, r
    assert "10 Blizzard" in r and "13" in r and "12" in r, r


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        _selftest()
        print("ok")
    else:
        print(report(sys.argv[1], sys.argv[2]))
