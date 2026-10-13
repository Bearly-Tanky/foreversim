// Reads a finished sim run and reports what its damage was made of, against the evidence
// manifest. The tier vocabulary itself lives in @sim/spells/rests, because the arena needs
// the same names without a SimResult to read them from.

import type { ActionId } from '@sim/proto/action_id';
import { spellSource } from '@sim/spells';
import { type Composition, EMPTY, type Tier, TIER_ORDER } from '@sim/spells/rests';

// The parts of a UnitMetrics this reads, so a test can hand it a plain object.
export type DamageSource = { actions: Array<{ actionId: ActionId; damage: number }>; pets: Array<DamageSource> };

export function composition(player: DamageSource): Composition {
	const damage: Composition = { ...EMPTY };
	let total = 0;

	// A pet's action is the pet's, but it is damage this build produced - the sim adds the pet's
	// damage to its owner's DPS - and the manifest knows the pet's spells too.
	for (const unit of [player, ...player.pets]) {
		for (const action of unit.actions) {
			if (action.damage <= 0) continue;
			total += action.damage;
			damage[tierOf(action.actionId)] += action.damage;
		}
	}

	if (total === 0) return { ...EMPTY };
	for (const tier of TIER_ORDER) damage[tier] /= total;
	return damage;
}

/**
 * A white swing is not an ability and has no manifest entry to have; it is weapon damage
 * times attack speed, the oldest and best-tested arithmetic in the sim. Counting it as
 * unclassified put a third of a fury warrior's damage in the doubt column and said nothing
 * true - but folding it into the settled pile would be its own quiet lie, so it gets its own
 * bucket and its own name.
 *
 * An id the manifest has genuinely never classified stays separate from a known guess. They
 * are different problems: one is a number somebody decided to estimate, the other is a
 * number nobody has looked at.
 */
function tierOf(actionId: ActionId): Tier {
	if (actionId.otherId) return 'core';
	if (!actionId.spellId) return 'unknown';
	const source = spellSource(actionId.spellId);
	if (!source) return 'unknown';
	if (source.measured) return 'measured';
	if (source.source === 'unreviewed') return 'unknown';
	return source.source;
}
