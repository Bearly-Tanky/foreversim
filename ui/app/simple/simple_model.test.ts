import { Stat } from '@generated/proto/common';
import { UIItem } from '@generated/proto/ui';
import type { SimResult } from '@sim/proto/sim_result';
import { describe, expect, it } from 'vitest';

import { resolveViewMode } from '../view_mode';
import { talentPresetIndex, talentSummary } from './character_model';
import { itemSummary, matchesQuery, statSummary } from './item_model';
import { abilityName, compareMetric, formatSigned, type ResultSummary, summarizeResult } from './simple_model';

const summary = (dps: number, stdev: number, iterations = 10000): ResultSummary => ({
	iterations,
	metrics: {
		dps: { avg: dps, stdev },
		hps: { avg: 0, stdev: 0 },
		tps: { avg: 0, stdev: 0 },
		dtps: { avg: dps, stdev },
	},
	abilities: [],
});

describe('compareMetric', () => {
	it('calls a gap inside the noise no change', () => {
		// Standard error of the gap: sqrt(2 * 100^2 / 10000) = 1.41, so 2 DPS is within two of them.
		expect(compareMetric('dps', summary(1002, 100), summary(1000, 100)).verdict).toBe('same');
	});

	it('calls a real gain better and a real loss worse', () => {
		expect(compareMetric('dps', summary(1050, 100), summary(1000, 100))).toMatchObject({ verdict: 'better', diff: 50, percent: 5 });
		expect(compareMetric('dps', summary(950, 100), summary(1000, 100)).verdict).toBe('worse');
	});

	it('treats less damage taken as better', () => {
		expect(compareMetric('dtps', summary(900, 10), summary(1000, 10)).verdict).toBe('better');
	});
});

describe('summarizeResult', () => {
	const action = (name: string, dps: number) => ({ name, dps, iconUrl: '', actionId: null });
	const result = (actions: Array<ReturnType<typeof action>>) =>
		({
			iterations: 100,
			getRaidIndexedPlayers: () => [
				{
					dps: { avg: 1000, stdev: 50 },
					hps: { avg: 0, stdev: 0 },
					tps: { avg: 0, stdev: 0 },
					dtps: { avg: 0, stdev: 0 },
					getDamageActions: () => actions,
					pets: [],
				},
			],
		}) as unknown as SimResult;

	it('lists abilities biggest first, as shares of the total, without ranks', () => {
		const out = summarizeResult(result([action('Execute (Rank 5)', 300), action('Attack', 700)]))!;
		expect(out.abilities.map(a => [a.name, a.share])).toEqual([
			['Attack', 0.7],
			['Execute', 0.3],
		]);
	});

	it('folds tiny abilities into "Everything else"', () => {
		const actions = [action('A', 500), action('B', 300), action('C', 197), action('D', 3)];
		const names = summarizeResult(result(actions))!.abilities.map(a => a.name);
		expect(names).toEqual(['A', 'B', 'C']);
	});
});

describe('formatting', () => {
	it('signs numbers with a real minus', () => {
		expect(formatSigned(12.34)).toBe('+12.3');
		expect(formatSigned(-1234.5, 0)).toBe('−1,235');
		expect(abilityName('Bloodthirst (Rank 4)')).toBe('Bloodthirst');
	});
});

describe('talents', () => {
	const trees = [{ name: 'Arms' }, { name: 'Fury' }, { name: 'Protection' }] as any;
	it('names the deepest tree', () => {
		expect(talentSummary(trees, [17, 34, 0])).toBe('Fury · 17/34/0');
		expect(talentSummary(trees, [0, 0, 0])).toBe('No talents chosen');
	});
	it('finds the matching preset', () => {
		const presets = [
			{ name: 'A', data: { talentsString: '1-2' } },
			{ name: 'B', data: { talentsString: '3-4' } },
		] as any;
		expect(talentPresetIndex(presets, '3-4')).toBe(1);
		expect(talentPresetIndex(presets, '5')).toBe(-1);
	});
});

describe('item summaries', () => {
	it('shows a combined hit/crit rating once', () => {
		const stats: number[] = [];
		stats[Stat.StatStrength] = 18;
		stats[Stat.StatMeleeHitRating] = 20;
		stats[Stat.StatSpellHitRating] = 20;
		stats[Stat.StatMeleeCritRating] = 28;
		expect(statSummary(stats)).toBe('18 Str · 20 Hit · 28 Crit');
	});

	it('adds weapon damage per second', () => {
		const item = UIItem.create({ ilvl: 63, weaponDamageMin: 153, weaponDamageMax: 256, weaponSpeed: 3.8 });
		expect(itemSummary(item)).toBe('Item level 63 · 53.8 DPS · 3.80 speed');
	});

	it('matches every search word', () => {
		expect(matchesQuery('Lionheart Helm', 'helm lion')).toBe(true);
		expect(matchesQuery('Lionheart Helm', 'crown')).toBe(false);
	});
});

describe('view mode', () => {
	it('opens the simple view unless asked otherwise', () => {
		expect(resolveViewMode('', null)).toBe('simple');
		expect(resolveViewMode('', 'advanced')).toBe('advanced');
		expect(resolveViewMode('?view=simple', 'advanced')).toBe('simple');
		expect(resolveViewMode('?view=bogus', 'nonsense')).toBe('simple');
	});
});
