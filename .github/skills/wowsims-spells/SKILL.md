---
name: wowsims-spells
description: 'Use when working on WoWSims Forever spell data: registering a spell, talent, aura, dot or proc from the client rows, porting a class to the sim/core/spelldata store, reading a row by hand off the store or through the resolvers, regenerating it from the client database, or reconciling a sim number against what the DBC says.'
argument-hint: 'Describe the spell, talent, proc or generated-data task to work on.'
---

# WoWSims Forever spell data

## Scope

- The spell store, `sim/core/spelldata`: one generated row per spell id, and the resolvers that turn a row into a spell config, an aura, a dot, a talent's modifiers or a proc listener. The warrior reads it through the resolvers; the other eight classes read its rows by hand instead, with no resolver in between.
- Regenerating it: `tools/database/gen_spelldata`, `tools/database/gen_spell_data.go`, `tools/database/gen_spell_store.go`, `tools/database/spelldata.go`.
- Reconciling a sim number that disagrees with the client data.

Not in scope: item and enchant data (`gen_db` proper), and talent _trees_ — the JSON, protos and TS configs under `ui/sim/talents` are generated from the Talent table by `tools/database/gen_protos.go`.

The full guide is `docs/spell_data.md`; this is the map.

## Architecture

- `sim/core/spelldata/spells_auto_gen.go` — generated, checked in: every spell the sim can reach, in the client's own units. 7035 rows, 9636 effects, pinned by `snapshot_test.go`.
- `sim/core/spelldata/*.go` — hand-written: the accessors (`store.go`, `spell.go`, `effect.go`, `attributes.go`, `ladder.go`) and the resolvers (`resolve_spell.go`, `resolve_aura.go`, `resolve_proc.go`, `parse_effects.go`, `item_proc.go`). `sim/core` must not import this package: the store imports core, and the import back would be a cycle.
- `sim/<class>/spell_data_auto_gen.go` — generated: a `spelldata.Ladder` per family, and no numbers of its own.
- `tools/database/overrides/spell_overrides.go` — the numbers the client does not state, each with a reason, a source and a rule that makes the generator refuse it once the client catches up.
- `assets/db_inputs/spell_store_inputs.json` — the client rows the store was built from. Gzipped despite the name; `zcat` to read it. It is what lets the store be regenerated and checked with no client database.

## Reading a row

```go
var slamRank = spellData.Slam.Highest()          // a ladder: Rank(n), Highest(), ByID(id), Len()
var slamDamage = slamRank.DamageEffect().Average(core.CharacterLevel)

rank := spellData.Defiance.Rank(points)          // rank 0 is untaken and answers Nil
spelldata.Find(id)                               // Nil where the store does not carry it; chains safely
spelldata.MustFind(id)                           // panics instead, for a spell the caller depends on
```

| on a `*Spell`                                                                    |                                                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `EffectN(n)`                                                                     | the n-th effect **by position**, counted from 1. `Effect.Index` is the client's own number, which has gaps |
| `Effect(aura, misc)`                                                             | the one effect with that aura and misc value; panics on none and on two                                    |
| `DamageEffect()`, `HealEffect()`, `EnergizeEffect()`, `PeriodicEffect()`         | the first effect of that role, or `NilEffect`                                                              |
| `CastTime()`, `Cooldown()`, `CategoryCooldown()`, `GCD()`, `Duration()`, `ICD()` | times; the client's -1 duration becomes `core.NeverExpires`                                                |
| `PowerCost(t)`                                                                   | the cost in the units the sim spends — rage off the 0-1000 bar                                             |
| `SpellSchool()`, `DefenseTypeCore()`, `MissRefund()`, `TickOutcome(dot)`         | core's own forms                                                                                           |
| `Refs()`, `Triggered()`, `Drivers()`                                             | the tooltip's spells, the ones the effects fire, the ones that fire this                                   |

| on an `*Effect`                                                  |                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `BaseValue()`                                                    | the client's number, unconverted                               |
| `Percent()`, `Tenths()`, `TimeValue()`, `Period()`               | over 100, over 10, as milliseconds, the tick interval          |
| `Average(level)`, `Min(level)`, `Max(level)`, `Roll(sim, level)` | the folded amount, the ends of the spread, and one cast's roll |
| `Coeff()`, `APCoeff()`                                           | the spell power and attack power shares                        |
| `Trigger()`                                                      | the spell the effect fires                                     |

A `Ladder` reads per rank: `ValueAt`, `FractionAt`, `MultiplierAt`, `TenthsAt`, and `EffectAt(n)` / `Effect(aura, misc)` for a rank with more than one effect. Rank 0 answers 0, so no `if rank > 0` guard.

## The resolvers

```go
func SpellConfig(unit *core.Unit, s *Spell, opts ...SpellOpt) core.SpellConfig
func AuraConfig(s *Spell, opts ...AuraOpt) core.Aura
func DotConfig(s *Spell, e *Effect, opts ...AuraOpt) core.DotConfig
func ParseStatic(character *core.Character, s *Spell, opts ...ParseOpt) *Parsed
func ParseEffects(character *core.Character, aura *core.Aura, s *Spell, opts ...ParseOpt) *Parsed
func ProcTrigger(character *core.Character, s *Spell, handler core.ProcHandler, opts ...ProcOpt) core.ProcTrigger
func ItemProcUnsupported(trigger *Spell, isWeaponProc bool) []string
```

- `SpellOpt`: `Melee(mask)`, `Magic(mask)`, `Proc()`, `Flags(f)`, `Tag(n)`.
- `AuraOpt`: `Label(name)`, `Permanent()`.
- `ParseOpt`: `Effects(...)`, `SkipEffects(...)`, `Conditional(fn)`, `IgnoreStacks()`.
- `ProcOpt`: `PPM(n)`, `Chance(f)`, `ChanceFrom(effect)`.

Each fills what the row states and nothing else; the caller adds `ApplyEffects`, the proc mask, the conditions and any flag the client does not carry. `ParseEffects` must be called before the aura activates. `*Parsed` carries `Applied` and `Skipped` — `SPELLDATA_REPORT=1` prints the skipped effects, which are what the port still has to wire by hand.

`Proc()` takes a sub-spell out of the rotation and empties the cast, cooldown and every cost the row filled, so it can resolve off the row of the ability that casts it: Whirlwind's off-hand strike takes `Melee(ProcMaskMeleeOHSpecial)`, `Proc()` and `Tag(2)` on the Whirlwind row itself, writing only `ClassSpellMask` and `ApplyEffects` by hand. A bleed row fills its damage and threat multipliers with 1 — `IsBleed` reads `SpellCategories.Mechanic` where the other `attributes.go` accessors read an `Attr` bit.

Where a spell can be cast is the row's too: `SpellConfig` fills `CastRequirement` from the stance masks, the caster aura restrictions and the shapeshift attribute bits, and core enforces it. Never write a stance or form check in `ExtraCastCondition`; the class only sets `Unit.ShapeshiftForm` (and `Unit.AutoUnshift` where leaving a form is automatic, the druid). A hand-read class takes `row.CastRequirement()`; a spell with no row states one with `core.InForms(...)`. See "Where a spell can be cast" in `docs/spell_data.md`.

## Porting a class

`docs/spell_data.md` has the checklist under "Porting a class onto the resolvers". The short form: every class file is already ladders, so dump the rows before touching a call site (the effects, the class masks each modifier names, the whole decoded `ProcTrigger`), and move goldens only for a cause you isolated by reverting one change.

## Traps

- **`--tags=with_db` is required** on any sim test run, or it panics with `No DB data for enchant with id: 2613`. That panic is the missing tag, not a broken fixture.
- **The data carries ranks the game never grants.** Fireball 38692 and Frostbolt 38697 are rank 14 entries at level 70 the generator cannot tell from the real rank 13s. Name the rank by spell id — `ByID` on a ladder — rather than reaching for the top one.
- **Rage is stored in tenths.** The client tracks a 0-1000 bar where the UI shows 0-100, so Heroic Strike reads 150 against the sim's 15. `PowerCost` and `Tenths()` divide it through; mana, energy and focus need no conversion.
- **DBC array columns are 0-based, `EffectN` is 1-based.** `EffectMiscValue_0` is the first element in the database; `EffectN(1)` is the first effect in the store, and `Effect.Index` keeps the client's number, which has gaps on 46 rows.
- **`Average` floors the whole amount, in float32.** The client resolves an amount to a whole number, so an effect with a fractional base and per-level gain answers something `BaseValue()` arithmetic in float64 does not.
- **A proc chance of 100 is not a roll.** 100 and 101 are the client's "fires on its own condition" sentinel. Read `ProcChanceSource`, never the `ProcChance` column.
- **`RequireDamageDealt` defaults true.** A listener that fires on a dodge, a parry, a miss or a block needs it false. The decoder has done that already where the tooltip named the outcome and the row carries `ProcHintOutcomeTaken`; hand-clear it only on a row whose wording yielded no hint (23547). The outcome itself is always the caller's — no `ProcTypeMask` has a bit for one.
- **A sub-second GCD must be named twice.** `core.Cast.GCDMin` overrides the global one-second floor, so Hammer of Wrath and Shadowfury set both `GCD` and `GCDMin` or `GCDTime` clamps them back up.
- **Never pick a talent's effect by which one matches the number.** Survival of the Fittest states +1/2/3% to all stats and -1/-2/-3% crit taken, and both ladders fit. What the call site does decides it, and the mod's `Kind` usually says so.
- **A per-point literal is usually right, so migrating one buys provenance, not accuracy.** Of 125 percent talents, 122 scale linearly. The ones that do not are why the rows are worth reading: Improved Righteous Fury is 16/33/50, shaman Elemental Weapons 7/14/20.
- **The `SPELLMOD_*` names are read off the talents that use them**, because the client ships no list. All 23 were confirmed against TrinityCore's `SpellModOp` and cmangos-tbc's; a value the cores name but these do not means the data changed, not that a name is missing.
- **core's `SpellSchool` bits are the client's**, so a school mask is carried rather than translated. `stats.SchoolIndex` is a separate enum for array positions and `proto.SpellSchool` a third.
- **Never delete a generated file before regenerating it.** `gen_db` imports the sim, so a class package missing its file does not compile and neither does the generator that would recreate it.
- **`make update-tests` deletes every .results before promoting .tmp.** A test that cannot run locally produces no .tmp and loses its golden outright. Check `git status -- '*.results'` for a `D` afterwards, or promote individual goldens with `cp`.
- **`rtk`-wrapped `go test` exits 0 with failing tests.** Read the summary line, not the exit code.
- **CI runs `npm run fmt` from the merge with master**, which is `npx oxfmt . --check` over the whole repository, not only `ui/`.

## When a sim number disagrees with the client

The rows are a second opinion on every number the sim already had. When they differ, decide rather than assume — and when a disagreement is left standing, say so at the call site.

Evidence that the sim is wrong: the value equals a _different_ rank's (Shield Slam 30356 is rank 6 but dealt rank 5's 381-399); the value equals a sibling spell's; the spread breaks the die-sides ladder.

Evidence that the sim is right: a uniform offset across unrelated abilities usually means the sim models something the client's base excludes — every hunter cast time is exactly +500ms, a ranged-weapon component, not three transcription slips. A coefficient read from another spell is not a disagreement either: a tick's coefficient belongs to the spell the description names.

Where the row and the tooltip disagree, the tooltip can win — Flurry's haste ladder against its buff row's flat 30 — but the decision is written at the call site, naming the wording it came from.

## Commands

```
go run ./tools/spelldata 11574                   # one row: header, ladder call, a worded line and the client's columns per effect; -json for a tool
go run ./tools/spelldata -family warrior/Execute # the ladder: one line per rank with the call reaching it, then the highest rank's row (<Family> alone where one class states it)
go run ./tools/spelldata -expr 'spellData.Execute.Rank(3)' -package warrior   # the row a ladder call names, Highest(), Rank(n) or ByID(id)
go run ./tools/spelldata -expr 'spellData.Execute.Highest().EffectN(1).Average(core.CharacterLevel)' -package warrior   # a pick followed by the store's own accessors: the value it reads, that accessor's doc comment and the row with the effect it read marked
go run ./tools/spelldata -config 'spelldata.SpellConfig(&warrior.Unit, executeRank, spelldata.Melee(core.ProcMaskMeleeMHSpecial))' -package warrior   # the config the resolver builds, each field with the step that filled it
go run ./tools/spelldata -hover sim/warrior/execute.go 12:40   # the markdown an editor hover shows at line:column (1-based); the trace on stderr
go run ./tools/spelldata -lsp                    # the same hovers as a language server on stdio
go run ./tools/database/gen_spelldata            # rewrite the store, the forms and every class file
go run ./tools/database/gen_spelldata -check     # name what is stale, write nothing (make spelldata-check)
go test ./sim/core/spelldata/ -count=1           # the store's own tests, no database needed
go test ./tools/database/ -count=1               # the regeneration from the committed inputs
go test --tags=with_db ./sim/<class>/ -count=1   # a class
git status --porcelain -- '*.results'            # empty unless a number was meant to move
```

`-lsp` answers hovers over the ids Go, APL JSON and TS state, and in Go over a ladder family, over a name bound to one of its ranks or to a value read off one — on the declaration of such a name each accessor in the chain hovers for itself — and over `spelldata.SpellConfig`, which shows the resolved config; each hover logs its trace as a `window/logMessage`. `.vscode/extensions/wowsims-spelldata` is its VS Code client, which VS Code offers to install as a workspace extension; it is built from `tools/vscode-spelldata` by `make vscode-spelldata`, never edited. `tools/zed-spelldata` is the Zed extension, and `tools/spelldata/README.md` has the Neovim and Helix snippets.

Regenerating needs `tools/database/wowsims.db`, which is gitignored and built by `make db` from a local WoW client. The checks that do not need it — the store's tests, the regeneration from `assets/db_inputs/spell_store_inputs.json` — are the ones CI runs.
