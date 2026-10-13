# Where the sim's game data comes from

How wowsims/sod kept Season of Discovery data current (researched 2026-09-17 from the wowsims/sod
repo and its history), and what that means for Forever. Verified findings are separate from inferences.

## Two kinds of data

| Kind | Examples | Source |
| --- | --- | --- |
| **In the client** | items, stats, sets, enchants, spell ranks, effects, cast/cooldown/duration, auras, base stats | Datamined from the client. Wowhead republishes it; wago.tools exports the raw DB2 tables per build |
| **Server-side only** | proc rates (PPM), spell coefficients, whether a dot crits, set-bonus timing, pet stats, loot | Not in any file. PTR testing, combat logs (Warcraft Logs), Wowhead dev notes, class-community confirmation |

## What SoD actually used, most important first (verified)

1. **Wowhead tooltip API**: `nether.wowhead.com/<branch>/tooltip/{item,spell}/<id>`, scraped into
   `assets/db_inputs/wowhead_*_tooltips.csv` and parsed with regexes. Regexes needed fixing every phase.
2. **Wowhead gear-planner DB**: `/data/gear-planner?dv=100` into `wowhead_gearplannerdb.txt`. Decides what
   is actually in the game (Wowhead has no "unavailable" flag; the gear planner filters those out).
3. **Rune scrapers**: `tools/scrape_runes.py`, headless Selenium over Wowhead search. Fragile.
4. **AtlasLoot**: drop and crafting sources.
5. **wago.tools DB2**: only `ItemSparse` at a hand-pinned build, for faction flags and item sets. Also used
   by hand to confirm proc masks (SpellAuraOptions).
6. **Base stats**: GameTables text files in `assets/db_inputs/basestats/`, via `tools/base_stats_parser.py`.
7. **Override files**: `tools/database/overrides.go`, `enchant_overrides.go`, `rune_overrides.go` for anything
   tooltips get wrong or leave out.

**Spell mechanics are not in the database at all.** Ranks, coefficients and racials are Go constants in
`sim/<class>/*.go` (~171 files use `BonusCoefficient`). Dot crit behaviour is a code choice
(`OutcomeSnapshotCrit` vs `OutcomeTick`).

## How they settled server-side mechanics (verified examples)

- PTR testing, written next to the constant: "PTR testing comes out to .0165563 AP scaling per CP"
  (`sim/druid/rip.go`), "1.50 PPM tested on PTR" (`sim/common/sod/item_effects/phase_5.go`).
- Warcraft Logs reports linked in code (`sim/common/guardians/emerald_dragon_whelp.go`); commit "Add delay to
  6pc application observed in logs".
- Wowhead dev notes and datamining articles cited in comments.
- Community confirmation in commit messages ("confirmed PPM", "all confirmed by Zirene").
- Regression tests freeze the numbers once agreed.

## Cadence (verified)

Manual, tied to phases and PTR: "initial phase 6 mining", "use PTR source for wowhead items", "P8 ptr db update".
Their `update_items.yml` was dispatch-only and **never ran**. The real recipe is the comment block in
`tools/database/gen_db/main.go`, then an offline `-gen=db`.

## Gotchas to carry into Forever

- **ID filters drop new content silently.** `-gen=db` keeps `item.ID < 100000`; spells scrape with `-maxid=31000`.
  SoD items were 2xxxxx. Check both before trusting a Forever import.
- **The Wowhead branch is a constant.** SoD PTR lived on a separate `classic-ptr` branch. Forever's beta/PTR may
  get its own branch too; the watcher only reads `forever`.
- Reworked items share names with originals; SoD needed name+icon dedupe plus allow/deny lists.
- The gear planner lags brand-new items behind tooltips.
- The wago build is pinned by hand.
- Put a source link beside every hand-set constant (PTR note, log URL, blue post). It is the only audit trail.

## Inferred, not verified

- Testing was organised mainly in class Discords and theorycrafting sheets; the repo names people, not sheets.
- SoD shipped inside the `wow_classic_era` product, not a separate wago.tools product. (Forever's beta did the
  same trick under `wow_classic_beta` - verified below.)

## What this fork already automates

`.github/workflows/watch_wowhead_forever.yml`, every 6 hours:
- snapshots the Wowhead Forever gear planner and opens a `data-change` PR with a readable diff
  (`docs/data-changes/`), and
- records the newest Forever client build (1.60.x) on wago.tools and opens a `data/forever-client` PR with a
  row-level diff of the sim's raw tables between builds.

It does not regenerate `db.bin` or change sim rules. That remains review work.

## Forever as of 17 Sep 2026 (verified)

- **Beta started 17 Sep; launch is 4 Nov 2026.** Beta is capped at level 30.
- **The beta client is already datamined.** wago.tools serves it under the existing `wow_classic_beta`
  product as **1.60.1** (builds 69876 and 69893 on 16 Sep). Tables download directly, e.g.
  `https://wago.tools/db2/Spell/csv?build=1.60.1.69893`. **Talent trees are in the retail-style Trait tables**
  (TraitTree, TraitNode, TraitNodeEntry, TraitDefinition, TraitEdge, TraitCond): one tree per class, 469 talents.
  The Classic `Talent`/`TalentTab` tables are leftovers, identical to Era apart from a blanked class id - do not
  read talents from them. ChrRaces gained 49 rows.
- **Vendored trees checked against the client on 17 Sep:** 461 of 470 talents match exactly (tree, row, column,
  max rank, prerequisite). Discrepancies are listed in `docs/talent-check-2026-09-17.md`.
- **Wowhead has started:** a `/forever/` database, talent calculator, and "datamined from Forever beta client"
  articles. Its gear-planner file (`nether.wowhead.com/forever/data/gear-planner`) already carries
  `classicplus` sections.
- **Item stats are deliberately hidden from datamining.** Blizzard (Aggrend, BlizzCon 2026 interview): items are
  obfuscated and their stats are unknown until one drops on a server. Gear data will come from players' loot
  uploads (Wowhead Looter) after launch, not from the client. Expect the gear planner to fill in over launch week.
- Community datamine: daybreakforever.com/datamining (reads the beta client via wago.tools, flags what is new
  versus Era/SoD, TBC Anniversary and Mists Classic).

The watch workflow now also records the newest 1.60.x client build and opens a `data/forever-client` PR with a
row-level diff of the sim's tables (Spell*, SkillLineAbility, ChrRaces, Trait*, ItemSparse, ItemSet, enchants)
whenever a new beta build lands.
