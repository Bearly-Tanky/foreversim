import { ItemSlot, PseudoStat, Stat } from '@generated/proto/common';
import * as Mechanics from '@sim/constants/mechanics';
import type { Player } from '@sim/player/player';
import { Stats, UnitStat } from '@sim/proto/stats';
import { describe, expect, it, vi } from 'vitest';

// The loader that feeds i18next is stubbed empty under vitest, so `t` would otherwise echo the key.
const STRINGS: Record<string, string> = {
	'sidebar.character_stats.percent_suffix': '%',
	'sidebar.character_stats.crit_cap.exact': 'Exact',
	'sidebar.character_stats.crit_cap.over_by': 'Over by',
	'sidebar.character_stats.crit_cap.under_by': 'Under by',
};
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => STRINGS[key] ?? key } }));

const { bonusStatClass, critCapClass, critImmunityCapDisplayString, critImmunityClass, statDisplayString } = await import('./stat_display');

const fakePlayer = (overrides: Record<string, unknown> = {}) =>
	({
		getBaseDefense: () => Mechanics.CHARACTER_LEVEL * 5,
		getEquippedItem: () => null,
		...overrides,
	}) as unknown as Player<any>;

const show = (stats: Stats, unitStat: UnitStat, includeBase?: boolean, includeGear?: boolean) =>
	statDisplayString(fakePlayer(), stats, unitStat, includeBase, includeGear);

describe('statDisplayString, defense rating', () => {
	const defense = UnitStat.fromStat(Stat.StatDefenseRating);

	it('renders as a skill level with no percent suffix and no decimals', () => {
		const stats = new Stats().withStat(Stat.StatDefenseRating, Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL * 10);
		expect(show(stats, defense)).toBe(`${Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL * 10} (10)`);
	});

	it('adds the base defense skill when the delta includes the base stage', () => {
		const stats = new Stats().withStat(Stat.StatDefenseRating, Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL * 10);
		expect(show(stats, defense, true)).toBe(`${Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL * 10} (310)`);
	});

	it('shows the skill level at zero, which the percent-bearing stats hide', () => {
		expect(show(new Stats(), defense)).toBe('0 (0)');
		expect(show(new Stats(), UnitStat.fromPseudoStat(PseudoStat.PseudoStatDodgePercent))).toBe('0.00%');
	});
});

describe('statDisplayString, TBC-only stats', () => {
	it('scales block value by the block-value multiplier pseudo stat', () => {
		const stats = new Stats().withStat(Stat.StatBlockValue, 100).withPseudoStat(PseudoStat.PseudoStatBlockValueMultiplier, 1.3);
		expect(show(stats, UnitStat.fromStat(Stat.StatBlockValue))).toBe('130');
	});

	it('renders a school damage stat as the school-plus-spell-damage total with the school bonus in brackets', () => {
		const stats = new Stats().withStat(Stat.StatFireDamage, 50).withStat(Stat.StatSpellDamage, 200);
		expect(show(stats, UnitStat.fromStat(Stat.StatFireDamage))).toBe('250 (+50)');
	});

	it('shows a weapon stone as melee crit percent only, leaving the ranged crit row at zero', () => {
		const stats = new Stats()
			.withPseudoStat(PseudoStat.PseudoStatMeleeCritPercent, 2)
			.withPseudoStat(PseudoStat.PseudoStatRangedCritPercent, 0)
			.withStat(Stat.StatMeleeCritRating, 0);

		expect(show(stats, UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeCritPercent))).toBe('2.00%');
		expect(show(stats, UnitStat.fromPseudoStat(PseudoStat.PseudoStatRangedCritPercent))).toBe('0.00%');
	});

	it('adds the ranged hit enchant rating at the gear stage only', () => {
		const rangedHit = UnitStat.fromPseudoStat(PseudoStat.PseudoStatRangedHitPercent);
		const stats = new Stats().withPseudoStat(PseudoStat.PseudoStatRangedHitPercent, 2);
		const scoped = fakePlayer({ getEquippedItem: (slot: ItemSlot) => (slot === ItemSlot.ItemSlotRanged ? { enchant: { effectId: 2523 } } : null) });

		expect(statDisplayString(scoped, stats, rangedHit, false, true)).toBe('30 (2.00%)');
		expect(statDisplayString(scoped, stats, rangedHit)).toBe('2.00%');
	});
});

describe('crit immunity readout', () => {
	// The delta is cap minus total, so a positive delta means the character is SHORT of the cap.
	it('inverts the over/under wording against the melee crit cap', () => {
		expect(critImmunityCapDisplayString(fakePlayer({ getCritImmunity: () => 1.5 }))).toBe('Under by 1.50%');
		expect(critImmunityCapDisplayString(fakePlayer({ getCritImmunity: () => -1.5 }))).toBe('Over by 1.50%');
	});

	it('reads as exact once the delta rounds to zero at two decimals', () => {
		expect(critImmunityCapDisplayString(fakePlayer({ getCritImmunity: () => 0.001 }))).toBe('Exact');
	});

	it('colours a shortfall as bad and a surplus as good, with the same two-decimal zero test', () => {
		expect(critImmunityClass(0.001)).toBe('text-white');
		expect(critImmunityClass(1.5)).toBe('text-danger');
		expect(critImmunityClass(-1.5)).toBe('text-success');
	});
});

describe('bonusStatClass', () => {
	it('is neutral at zero, green above it and red below', () => {
		expect(bonusStatClass(0)).toBe('text-white');
		expect(bonusStatClass(12)).toBe('text-success');
		expect(bonusStatClass(-12)).toBe('text-danger');
	});
});

describe('critCapClass', () => {
	it('reads the other way round: over the cap is bad', () => {
		expect(critCapClass(0)).toBe('text-white');
		expect(critCapClass(12)).toBe('text-danger');
		expect(critCapClass(-12)).toBe('text-success');
	});
});
