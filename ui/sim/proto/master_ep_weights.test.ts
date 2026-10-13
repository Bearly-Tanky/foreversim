import { Stat } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { masterEpWeights } from './master_ep_weights';
import { Stats } from './stats';

describe('masterEpWeights', () => {
	it('prices a gear rating point as master priced the percent it buys, melee and spell together', () => {
		const weights = masterEpWeights({ Strength: 2.51, MeleeHit: 28.67, MeleeCrit: 25.1, SpellCrit: 1 });
		// Blackhand's Breadth: 2% crit, 28 rating in our database.
		expect(new Stats().withStat(Stat.StatMeleeCritRating, 28).computeEP(weights)).toBeCloseTo(2 * 26.1);
		expect(weights.getStat(Stat.StatSpellHitRating)).toBeCloseTo(2.867);
		expect(weights.getStat(Stat.StatStrength)).toBe(2.51);
	});
});
