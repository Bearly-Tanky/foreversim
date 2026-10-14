# Simple view

The simulator opens in a **simple view**: one page, one button. The full interface is still there as
the **advanced view** (rotation editor, batch sims, detailed logs) and both share the same saved
character, so switching never loses a build.

## Principles

1. **One screen, one main action.** No tabs. Everything needed to answer "how much DPS does this do?"
   is visible at once, and the answer is one button away.
2. **Start from a working build.** Every spec opens with preset gear, talents and buffs, so
   Simulate gives a real number before anything is touched.
3. **Show the answer big, and how it changed.** DPS is the largest thing on the page, and after
   the second run it says how much better or worse the last change made it.
4. **Plain words.** "Raid buffs", "Fight length", "Which stats matter most". No EP, APL or iterations.
5. **Advanced stays one click away**, not deleted.

## Layout

```
┌ Forever Sim ── [Warrior · DPS ▼] ─────────────────────── Advanced view ┐
│ ┌ Your character ──────────────────────┐  ┌ Results ──────────────────┐ │
│ │ Race [Human ▼]   Talents  Fury 17/34/0 │  │ [      Simulate      ]    │ │
│ │                    [preset ▼] [Edit]  │  │      1,234 DPS            │ │
│ │ Gear  [Pre-BiS ▼]                     │  │   +23 (+1.9%) vs last run │ │
│ │ ┌ Head ─────┐   ┌ Hands ──────┐       │  │ Where the damage comes    │ │
│ │ │ ...        │   │ ...          │      │  │ from: ███ Whirlwind 31%   │ │
│ │ (6 left)       (8 right)               │  ├───────────────────────────┤ │
│ │ ┌ Main hand ┐┌ Off hand ┐┌ Ranged ┐    │  │ Which stats matter most   │ │
│ └──────────────────────────────────────┘  │ [Calculate]               │ │
│ ┌ Fight ───────────────────────────────┐  └───────────────────────────┘ │
│ │ Buffs [None|Raid]  Consumables [Off|On]                               │
│ │ Length [1|2|3|5 min]  Enemies [1|3|5]                                 │
│ └──────────────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

Slots follow the in-game character pane: head, neck, shoulders, back, chest and wrists on the left;
hands, waist, legs, feet, rings and trinkets on the right; weapons along the bottom.

On a narrow screen the columns stack, and the Simulate button and DPS stay pinned to the bottom.

## Interactions

- **Gear slot** → item picker: search, items sorted by how good they are for this character
  (using the stat values), each row showing its main stats and its score change against what is
  equipped, plus an Enchant tab for slots that take one.
- **Talents** → preset builds, or a dialog with the full tree.
- **Buffs / consumables** → "None" clears them, "Raid" or "On" restores the spec's defaults.
  Anything set in the advanced view shows as "Custom".
- **Which stats matter most** → runs the stat-weight sims, lists the top stats in DPS per point,
  and feeds those weights into the item picker's sorting.

## Code

`ui/app/simple/`: the React tree (`SimpleApp` is the page root) and `simple_model.ts`, the
DOM-free helpers it tests against. `ui/app/view_mode.ts` picks the view: `?view=advanced` or
the saved choice. The simple view builds the same `SimHostObject` the advanced one does, so
settings, persistence and sim runs are shared.
