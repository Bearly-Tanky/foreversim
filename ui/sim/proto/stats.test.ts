import { PseudoStat, Stat } from '@generated/proto/common';
import { describe, expect, it, vi } from 'vitest';

// `stats.ts` only needs localization for display names, and `@i18n/localization` drags the whole
// i18next bootstrap in with it. Stubbing it keeps this file about the stat model.
vi.mock('@i18n/localization', () => ({
	translateStat: (stat: unknown) => String(stat),
	translatePseudoStat: (pseudoStat: unknown) => String(pseudoStat),
}));

import * as Mechanics from '../constants/mechanics';
import { displayStatOrder, Stats, UnitStat } from './stats';

describe('UnitStat', () => {
	// The MoP placeholder evaluated `displayStatOrder` at module scope against MoP's PseudoStat set
	// and threw inside getRootStat on TBC's, taking every transitive importer down with it.
	it('builds displayStatOrder at module scope over the 41-stat shape', () => {
		expect(displayStatOrder.length).toBeGreaterThan(0);
		expect(new Stats().asProtoArray().length).toBe(41);
	});

	it('roots the six school hit pseudo-stats at SpellHitRating and leaves their own root null', () => {
		const schools = [
			PseudoStat.PseudoStatSchoolHitPercentArcane,
			PseudoStat.PseudoStatSchoolHitPercentFire,
			PseudoStat.PseudoStatSchoolHitPercentFrost,
			PseudoStat.PseudoStatSchoolHitPercentHoly,
			PseudoStat.PseudoStatSchoolHitPercentNature,
			PseudoStat.PseudoStatSchoolHitPercentShadow,
		];
		for (const school of schools) {
			expect(UnitStat.fromPseudoStat(school).hasRootStat()).toBe(false);
			expect(UnitStat.getChildren(Stat.StatSpellHitRating)).toContain(school);
		}
	});

	it('roots ExpertisePercent at ExpertiseRating and converts at the gametable ratio, with no quarter-point floor', () => {
		const percent = UnitStat.fromPseudoStat(PseudoStat.PseudoStatExpertisePercent);
		expect(percent.getRootStat()).toBe(Stat.StatExpertiseRating);
		expect(UnitStat.getChildren(Stat.StatExpertiseRating)).toEqual([PseudoStat.PseudoStatExpertisePercent]);
		expect(UnitStat.fromStat(Stat.StatExpertiseRating).convertRatingToPercent(12)).toBeCloseTo(1.2);
		expect(percent.convertPercentToRating(6.5)).toBeCloseTo(6.5 * Mechanics.EXPERTISE_RATING_PER_EXPERTISE_PERCENT);
	});

	// Melee and spell hit each convert through their own constant. Forever's CombatRatings
	// gametable happens to give both the same value at level 60, where TBC's differed, so an
	// accidentally shared constant would pass unnoticed today and break on the next retune.
	it('converts melee and spell ratings through their own constants', () => {
		expect(UnitStat.fromStat(Stat.StatMeleeHitRating).convertRatingToPercent(Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT)).toBeCloseTo(1);
		expect(UnitStat.fromStat(Stat.StatSpellHitRating).convertRatingToPercent(Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT)).toBeCloseTo(1);
	});

	// The inverse of the parentStat case below: convertRatingToPercent has no branch for
	// ReducedCritTakenPercent either, so it returns null. convertEpToRatingScale declares
	// `number` and asserted that null away with `!`, handing callers a null that only blew up
	// once something did arithmetic on it - the Prot Paladin soft-cap tooltip called .toFixed()
	// on it and took the sidebar down on hover.
	it('falls back to the raw EP value when a stat has no percent conversion', () => {
		const unitStat = UnitStat.fromPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent);
		expect(unitStat.convertRatingToPercent(1)).toBeNull();
		expect(unitStat.convertEpToRatingScale(12.5)).toBe(12.5);
		expect(() => unitStat.convertEpToRatingScale(0).toFixed(2)).not.toThrow();
	});

	it('needs a parentStat to turn ReducedCritTakenPercent back into a rating', () => {
		const unitStat = UnitStat.fromPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent);
		expect(unitStat.convertPercentToRating(1)).toBeNull();
		expect(unitStat.convertPercentToRating(1, Stat.StatDefenseRating)).toBeCloseTo(
			Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL / Mechanics.MISS_DODGE_PARRY_BLOCK_CRIT_CHANCE_PER_DEFENSE,
		);
	});
});

describe('Stats.computeGapToCap', () => {
	it('divides a haste gap by the matching speed multiplier', () => {
		const stats = new Stats().withPseudoStat(PseudoStat.PseudoStatMeleeHastePercent, 10).withPseudoStat(PseudoStat.PseudoStatMeleeSpeedMultiplier, 2);
		expect(stats.computeGapToCap(UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeHastePercent), 20)).toBeCloseTo(5);
	});

	it('never reports an exactly-zero gap', () => {
		const stats = new Stats().withStat(Stat.StatMeleeHitRating, 100);
		expect(stats.computeGapToCap(UnitStat.fromStat(Stat.StatMeleeHitRating), 100)).toBeGreaterThan(0);
	});
});
