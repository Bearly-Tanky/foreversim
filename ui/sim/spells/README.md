# Where every ability's numbers came from

The Go sim carries an integer for each ability and nothing else. Every name, icon and hover
tooltip the site shows is resolved in the browser from Wowhead's Classic data for that
integer, so an ability Forever changed is described by its Classic ancestor unless something
says otherwise.

That is the same trap the talent trees fell into. Forty two talents wore another talent's
tooltip, and Improved Revenge kept Classic's stun long after Forever turned it into damage,
because the two share a name. The fix there was to stop letting the Classic database
describe a Forever talent at all. These files do the same for abilities.

One file per class, plus `core.json` for the raid buffs, debuffs and racials, `common.json`
for item and enchant effects and `encounters.json` for boss mechanics. Each is an object
keyed by the spell id the sim registers.

```json
{
	"13953": {
		"ability": "Holy Strike",
		"file": "sim/paladin/holy_strike.go",
		"source": "forever",
		"foreverId": 17143,
		"tooltip": "20 Mana\nMelee Range\nInstant\n12 sec cooldown\nDeals 40% weapon damage plus 36 to 46 Holy damage.",
		"note": "Forever's own id is not in the item database, so Classic's unused 13953 lends the name and the icon."
	}
}
```

## Fields

- `ability` — what Forever calls it.
- `file` — the Go file that registers it.
- `source` — one of:
    - `classic`, Forever did not change the ability, so Wowhead's tooltip describes it and the
      site keeps showing it.
    - `forever`, Forever changed it and a published Forever source gave the numbers. `tooltip`
      is what should describe it.
    - `assumed`, Forever changed it or it is new, and at least one number is a guess. As above,
      and the number is unconfirmed.
    - `unreviewed`, not classified yet.

## What the site reads, and what it does not

`index.ts` loads these files in the browser and `ActionId.fill` takes `ability` as the name
when Wowhead has none — which is every ability Forever invented, Lava Burst's Forever ranks
and Spearing Strike among them. Those arrived in the damage table as a blank row until then.

**`tooltip` is still not rendered.** The hover text on a `forever` or `assumed` ability is
Wowhead's Classic entry, with Classic's numbers in it, which is the thing these files were
written to stop. The data is here and the test keeps it true to the sim; what is missing is
the hook into the tooltip markup.

- `foreverId` — Forever's own spell id, when it is known and differs from the one the sim
  carries.
- `tooltip` — required for `forever` and `assumed`, and rejected for `classic`. Written from
  the implementation's own numbers so the two cannot drift.
- `note` — one sentence on why the id or the number is what it is.
- `assumptions` — required for `assumed`, one short line per guessed number, phrased so a
  beta tester can check it. These feed the beta checklist.

`classic` is a claim that the ability is untouched, not a shrug. An ability nobody has
checked is `assumed` or `unreviewed`.

Each spec's `TestArena` (`sim/arenalib`) keeps the files honest: without `ARENA_OUT` set it
runs every build the arena ranks for a few iterations and fails on any spell id that deals
damage and has no entry here. It replaces `sim/spell_sources_test.go`, which walked the old
engine's syntax tree for registered ids and was lost in the engine switch; since the
classes read their ranks from the client spell store (`spellData.X.Highest()`), a walk of
the source can no longer see which rank is cast, and running the sim can.
