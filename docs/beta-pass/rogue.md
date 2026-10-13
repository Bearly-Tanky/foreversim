# Rogue beta pass (17 September 2026)

Beta client `1.60.1.69893` against Classic Era `1.15.9.69722`, read with `tools/data_watch/spell_client.py`, the
talent curves with `tools/data_watch/trait_curve.mjs`, `../beta/rogue.json`, and the `SpellEquippedItems` and
`SpellAuraOptions` tables for weapon requirements and poison proc chances.

## How the numbers were read

Every level table in `sim/rogue` was checked against the Era client first. All of them matched Era except Eviscerate at
level 40 (rank 6), where the sim had 77 damage a combo point and both clients give 71; that is fixed. No rogue spell
uses `EffectRealPointsPerLevel`, so the tables are the client's base points as they stand. The client's `sp 1` on weapon
strikes is the "not set" value, and no rogue spell carries an attack power coefficient, so every attack power share in
the sim (Eviscerate's 3% a point, Rupture's, Garrote's 3%) is still Classic's.

One split to know about: the client stores Rupture as a tick of `base + perComboPoint x points` over `points + 3` ticks,
which is exactly how `RuptureDamage` and `RuptureTicks` are built, so the per tick numbers went in unchanged.

## Spells changed (old -> new, level 60 rank unless noted)

| Spell | Change |
|---|---|
| Rupture (4 ranks) | tick 60 + 8 a combo point -> 35 + 4.73 (rank 1 8 + 2 -> 5 + 1.18, rank 3 18 + 4 -> 11 + 2.37, rank 4 27 + 5 -> 16 + 2.96) |
| Expose Armor (4 ranks) | 340 armor a point x 1.5 assumed baseline talent -> 450 a point with no multiplier (rank 1 80 -> 90, rank 3 210 -> 270, rank 4 275 -> 360) |
| Instant Poison (4 ranks) | 112-148 -> 76-100 (rank 1 19-25 -> 13-17, rank 3 44-56 -> 29-37, rank 4 67-85 -> 45-57) |
| Deadly Poison (4 ranks) | tick 34 -> 23 (rank 1 9 -> 6, rank 2 13 -> 9, rank 3 20 -> 14, rank 4 27 -> 18) |
| Mutilate (4 ranks) | the demo's flat 13 outside the 75% -> ranks 1310707 / 399956 / 1241582 / 1241584 adding 23 / 33 / 48 / 67 to weapon damage before the 75% (level 60: 13 -> 50.25 a hand). Spell id 1329 -> the rank ids. |
| Hemorrhage | one rank, 17348 -> 16511 (ranks 2 and 3 are gone); plain -> normalized weapon damage (effect 17 -> 121). 100% / 145% dagger and the 15% Rupture debuff confirmed. |
| Venom | spell id 32645 (borrowed Envenom) -> 1310703; 25 Energy, 30% / 10%, 6 sec + 3 sec a point confirmed |
| Eviscerate level 40 | 77 -> 71 a combo point (sim bug; Era and Forever agree) |

Talents fixed from the client while checking the class: Serrated Blades ignored a flat 3% of armor at every rank ->
3 / 6 / 9%; Improved Expose Armor refunded 1 combo point at either rank -> 1 / 2.

Unchanged in the client and left alone: Sinister Strike, Backstab, Eviscerate (other ranks), Ambush, Garrote, Slice and
Dice (only the aura type number changed, 138 -> 319), Ghostly Strike, Riposte, Evasion, Vanish, Cold Blood, Blade Flurry,
Adrenaline Rush, Preparation, Relentless Strikes, poison proc chances (20% / 30%), Wound Poison's 30% and 15 sec.

Changed in the client but not simulated:
- Poison charges went up about 1.5x (Instant Poison VI 115 -> 175, Deadly Poison V now 180); the sim has no charges.
- Wound Poison's healing reduction rose (rank 4 135 -> 165); the sim does not model incoming healing.
- Feint rank 1's threat reduction 150 (+1 a level) -> 750 (+5 a level); the sim has never applied Feint's threat drop.
- Premeditation's window 10 -> 20 sec and cost 0 -> free; the sim grants the points and does not expire them.
- Blade Flurry's extra strike spell 22482 no longer exists (1226883 is the client's); the sim keeps 22482 as a label.

`ui/core/spells/rogue.json` has no unreviewed entries left (35 -> 0): the spells above are `forever` with tooltips, the
unchanged ones are `classic`, and Venom stays `assumed` for the one open question below.

## Checklist lines

### Rogue section
- **Resolved** `sim/rogue/backstab.go:28`, Puncturing Wounds: client curves are 10/20/30% Backstab crit and 15/30/45%
  extra combo point, the linear scaling the sim already had.
- **Resolved** `sim/rogue/expose_armor.go:11`, Expose Armor baseline: Improved Expose Armor no longer scales armor, and
  the spell itself went up to 450 a point. The sim now uses the spell's 450 with no multiplier instead of Classic's 2/2
  510 (5 points 2550 -> 2250).
- **Resolved** `sim/rogue/expose_armor.go:36`, Improved Expose Armor: 5/10 Energy confirmed, trigger stays 5 combo
  points, but the refund is 1/2 combo points rather than 1 at both ranks (fixed).
- **Resolved** `sim/rogue/hack_and_slash.go:14`: curves 1-5% extra attack, 1-5% crit, 3-15% armor, linear as assumed.
  The 200 ms extra attack cooldown is not in the client and stays an assumption in the manifest.
- **Resolved** `sim/rogue/mutilate.go:43`: 60 Energy at every rank.
- **Resolved** `sim/rogue/mutilate.go:55`: every rank and both hand strikes require a Dagger (`SpellEquippedItems`
  subclass mask 32768).
- **Resolved** `sim/rogue/mutilate.go:59`: Puncturing Wounds gives Mutilate 5/10/15%.
- **Open** `sim/rogue/poisons.go:63`, Venom and a Deadly Poison already ticking: the client stores Venom as a percent
  modifier on poison damage, which does not say whether a running periodic effect reads it at tick time or at
  application. Needs an in-game test.
- **Resolved** `sim/rogue/talents.go:273`, Cutthroat: 3/6/9/12/15%, and the 10 sec window (462707) is the same at every
  rank.
- **Resolved** `sim/rogue/talents.go:352`, Quietus: 2/4/6/8/10% below 35% health at every rank.
- **Resolved** `sim/rogue/venom.go:47`: 25 Energy (plus combo points), and Venom has its own spell, 1310703.

### Talents the sim does not read
- **Open** Rogue / Subtlety: Improved Distract. The client gives 3/5 yds and 1/2 levels of stealth detection
  (5/10 on the spell). It is utility only, no damage, healing or threat, so it stays not simulated.

### Baseline ability changes
Class spellbook (`--learned rogue`) against Era:
- **New:** Mutilate ranks 1-4 (1310707, 399956, 1241582, 1241584 with their hand strikes) and Venom (1310703). Both are
  talents the sim already implements; now on client ids and numbers. Also new but not abilities: One-Handed Axes
  (196), Journeyman Riding (33391), the Forever racials Expansive Mind (1259803), Eureka! (1259812), Touch of the Grave
  (1260189), Berserking under 20554, a transmog spell and a test dummy (4504 "Jeff Dummy 1").
- **Removed:** Hemorrhage ranks 2 and 3 (17347, 17348), Classic Berserking 26297, Command (21563), the Season of Discovery
  Envenom rune (399963) and the S03 tuning passive.
- No new baseline damage ability, so nothing else to implement.

## Needs a sim/core change (not made here)
- `core.ExposeArmorAura` (the raid debuff picker) still gives 1700 armor x 1.25 / 1.5 for Improved Expose Armor. In
  Forever it should be 2250 (450 x 5) with no talent multiplier; the rogue's own debuff already sets 2250 on cast.
