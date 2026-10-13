#!/usr/bin/env python3
"""Summarise what changed between two Wowhead gear-planner payloads.

    python wowhead_diff.py OLD.txt NEW.txt > report.md

The payload is a JS file of WH.setPageData("wow.gearPlanner.<game>.<section>", {...}); calls.
Wowhead serves the same bytes until its data changes (checked: two fetches hash identically),
so the watch workflow compares files first and only calls this when they differ.
"""
import json
import re
import sys

CALL = re.compile(r'WH\.setPageData\("wow\.gearPlanner\.[^.]+\.([^"]+)",\s*')
SHOW = 25  # names listed per bucket; the counts are always complete


TRAILING_COMMA = re.compile(r",(\s*[}\]])")


def parse(text):
    # Sections are JS object literals, not strict JSON: Wowhead leaves a trailing comma before
    # the closing brace. Cut each call's argument out, drop those commas, then load it.
    # ponytail: regex comma strip, would mangle a string value containing ",}" - none seen; move to a JS parser if one appears.
    out = {}
    calls = list(CALL.finditer(text))
    for m, nxt in zip(calls, calls[1:] + [None]):
        chunk = text[m.end(): nxt.start() if nxt else len(text)].rstrip().rstrip(";").rstrip()
        chunk = chunk[:-1] if chunk.endswith(")") else chunk
        out[m.group(1)] = json.loads(TRAILING_COMMA.sub(r"\1", chunk))
    return out


def canon(v):
    # Wowhead reshuffles list order between otherwise identical payloads (on 2026-09-26 twelve
    # talents "changed" only because their effect rows swapped places), so lists compare as multisets.
    if isinstance(v, dict):
        return {k: canon(x) for k, x in v.items()}
    if isinstance(v, list):
        return sorted((canon(x) for x in v), key=lambda x: json.dumps(x, sort_keys=True))
    return v


def diff_section(old, new):
    if not isinstance(old, dict) or not isinstance(new, dict):
        return None if canon(old) == canon(new) else ([], [], ["(whole section)"])
    added = sorted(set(new) - set(old))
    removed = sorted(set(old) - set(new))
    changed = sorted(k for k in set(old) & set(new) if canon(old[k]) != canon(new[k]))
    return added, removed, changed


def label(section, key):
    item = section.get(key) if isinstance(section, dict) else None
    name = item.get("name") if isinstance(item, dict) else None
    return f"{key} {name}" if name else str(key)


def report(old_text, new_text):
    old, new = parse(old_text), parse(new_text)
    lines, total = [], 0
    for name in sorted(set(old) | set(new)):
        d = diff_section(old.get(name, {}), new.get(name, {}))
        if not d or not any(d):
            continue
        added, removed, changed = d
        total += len(added) + len(removed) + len(changed)
        lines.append(f"### {name}: +{len(added)} added, -{len(removed)} removed, ~{len(changed)} changed")
        for tag, keys, src in (("added", added, new.get(name, {})),
                               ("removed", removed, old.get(name, {})),
                               ("changed", changed, new.get(name, {}))):
            if keys:
                shown = ", ".join(label(src, k) for k in keys[:SHOW])
                more = f" … and {len(keys) - SHOW} more" if len(keys) > SHOW else ""
                lines.append(f"- {tag}: {shown}{more}")
    sections = sum(1 for l in lines if l.startswith("###"))
    head = f"**{total} changed entries across {sections} sections**"
    return "\n".join([head, ""] + lines) if total else "No data differences (payload bytes changed only)."


def _selftest():
    a = 'WH.setPageData("wow.gearPlanner.classicplus.item", {"1":{"name":"A"},"2":{"name":"B"},});\n'
    b = 'WH.setPageData("wow.gearPlanner.classicplus.item", {"1":{"name":"A2"},"3":{"name":"C"}});\n'
    r = report(a, b)
    assert "+1 added, -1 removed, ~1 changed" in r, r
    assert "3 C" in r and "2 B" in r and "1 A2" in r, r
    assert report(a, a).startswith("No data differences"), report(a, a)
    t1 = 'WH.setPageData("wow.gearPlanner.classicplus.talent", {"9":{"ranks":[{"spell":1},{"spell":2}]}});\n'
    t2 = 'WH.setPageData("wow.gearPlanner.classicplus.talent", {"9":{"ranks":[{"spell":2},{"spell":1}]}});\n'
    assert report(t1, t2).startswith("No data differences"), report(t1, t2)


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        _selftest()
        print("ok")
    else:
        with open(sys.argv[1], encoding="utf-8") as f1, open(sys.argv[2], encoding="utf-8") as f2:
            print(report(f1.read(), f2.read()))
