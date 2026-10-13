// The loading state of the sheet. TBC's crit-cap row trails the table in a tbody of its own, so it
// is the last row either way; what is pinned here is that it skeletons with its siblings instead of
// reading as settled while the stats are still in flight.
import { Class, PseudoStat, Race, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { Stats, UnitStat } from '@sim/proto/stats';
import { createSimStore, PLAYER_FIELDS, type PlayerSlice, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterStats } from './CharacterStats';

const KEY = 7;

const DISPLAY_STATS = [
	UnitStat.fromStat(Stat.StatAttackPower),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeHitPercent),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeCritPercent),
];

const CRIT_CAP_DELTA = -13;

const CRIT_CAP_INFO = {
	glancing: 24,
	suppression: 4.8,
	remainingMeleeHitCap: 0,
	remainingExpertiseCap: 0,
	debuffCrit: 0,
	specSpecificOffset: 0,
	baseCritCap: 43,
	playerCritCapDelta: CRIT_CAP_DELTA,
};

const renderStats = (settled: boolean) => {
	const store = createSimStore();
	const currentStats = settled ? { finalStats: new Stats().toProto() } : {};
	seedKeyed(store, 'players', KEY, {
		name: 'P',
		race: Race.RaceOrc,
		gear: { id: 'gear' },
		bonusStats: new Stats(),
		inFrontOfTarget: false,
		currentStats,
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);

	const player = {
		sim: { store },
		storeKey: KEY,
		// Melee DPS but not a tank: the crit cap row is shown, the miss/avoidance/crit-immunity trio is not.
		getPlayerSpec: () => ({ isTankSpec: false, isMeleeDpsSpec: true }),
		getClass: () => Class.ClassWarrior,
		getRace: () => Race.RaceOrc,
		getCurrentStats: () => currentStats,
		getDebuffStats: () => new Stats(),
		getEquippedItem: () => null,
		getMeleeCritCap: () => CRIT_CAP_DELTA,
		getMeleeCritCapInfo: () => CRIT_CAP_INFO,
	};

	const host = { player, sim: { store }, individualConfig: { displayStats: DISPLAY_STATS } } as never;
	const view = render(
		<SimHostProvider host={host}>
			<CharacterStats />
		</SimHostProvider>,
	);
	const rows = Array.from(view.container.querySelectorAll('[data-testid="character-stats-table-row"]'));
	return { view, rows };
};

// The tank trio is appended to the Defense group, so that group has to be populated for the
// rows to exist at all.
const TANK_DISPLAY_STATS = [...DISPLAY_STATS, UnitStat.fromStat(Stat.StatDefenseRating), UnitStat.fromPseudoStat(PseudoStat.PseudoStatDodgePercent)];

const MISS_INFO = { base: 5, defense: 2, debuffs: 0, total: 7 };
const AVOIDANCE_INFO = { miss: 7, dodge: 18, parry: 14, block: 25, total: 64, shear: 57 };
const CRIT_IMMUNITY_INFO = { total: 5.6, delta: 0, defense: 4.6, talents: 1 };

// The tank sheet adds three rows the DPS sheet has no equivalent for -- miss, avoidance and
// crit immunity -- appended to the Defense group. They are TBC-only, so upstream has nothing
// to compare against; what is pinned here is that they skeleton with every other row rather
// than reading as settled while the stats are still in flight.
const renderTankStats = (settled: boolean) => {
	const store = createSimStore();
	const currentStats = settled ? { finalStats: new Stats().toProto() } : {};
	seedKeyed(store, 'players', KEY, {
		name: 'P',
		race: Race.RaceOrc,
		gear: { id: 'gear' },
		bonusStats: new Stats(),
		inFrontOfTarget: true,
		currentStats,
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);

	const player = {
		sim: { store },
		storeKey: KEY,
		getPlayerSpec: () => ({ isTankSpec: true, isMeleeDpsSpec: false }),
		getClass: () => Class.ClassWarrior,
		getRace: () => Race.RaceOrc,
		getCurrentStats: () => currentStats,
		getDebuffStats: () => new Stats(),
		getEquippedItem: () => null,
		isSpec: () => false,
		getMissChanceInfo: () => MISS_INFO,
		getAvoidanceInfo: () => AVOIDANCE_INFO,
		getCritImmunityInfo: () => CRIT_IMMUNITY_INFO,
		getCritImmunity: () => CRIT_IMMUNITY_INFO.delta,
		getBaseDefense: () => 350,
	};

	const host = { player, sim: { store }, individualConfig: { displayStats: TANK_DISPLAY_STATS } } as never;
	const view = render(
		<SimHostProvider host={host}>
			<CharacterStats />
		</SimHostProvider>,
	);
	const rows = Array.from(view.container.querySelectorAll('[data-testid="character-stats-table-row"]'));
	return { view, rows };
};

const critCapRow = (rows: Array<Element>) => {
	const row = rows.at(-1)!;
	expect(row.querySelector('.ui-character-stats-label')!.textContent).toBe(i18n.t('sidebar.character_stats.melee_crit_cap'));
	return row;
};

describe('CharacterStats loading state', () => {
	it('shows a skeleton in every row, crit cap included, while the stats are still loading', () => {
		const { view, rows } = renderStats(false);

		expect(rows.length).toBe(DISPLAY_STATS.length + 1);
		expect(view.container.querySelector('table')!.getAttribute('aria-busy')).toBe('true');
		for (const row of rows) expect(row.querySelector('.ui-character-stats-value > .ui-skeleton')).not.toBeNull();
		expect(view.container.querySelectorAll('[data-testid="stat-value-link"]').length).toBe(0);
		expect(critCapRow(rows).textContent).toBe(i18n.t('sidebar.character_stats.melee_crit_cap'));
	});

	it('replaces every skeleton with its value once the stats arrive', () => {
		const { view, rows } = renderStats(true);

		expect(rows.length).toBe(DISPLAY_STATS.length + 1);
		expect(view.container.querySelector('table')!.hasAttribute('aria-busy')).toBe(false);
		expect(view.container.querySelectorAll('.ui-skeleton').length).toBe(0);
		expect(view.container.querySelectorAll('[data-testid="stat-value-link"]').length).toBe(rows.length);
		expect(critCapRow(rows).querySelector('[data-testid="stat-value-link"]')!.textContent).toContain('13.00%');
	});
});

describe('CharacterStats tank rows', () => {
	const labels = [
		i18n.t('sidebar.character_stats.tank_caps.miss_label'),
		i18n.t('sidebar.character_stats.tank_caps.avoidance_label'),
		i18n.t('sidebar.character_stats.tank_caps.crit_immunity_label'),
	];

	const tankRows = (rows: Array<Element>) => rows.filter(row => labels.includes(row.querySelector('.ui-character-stats-label')!.textContent ?? ''));

	it('skeletons miss, avoidance and crit immunity while the stats are still loading', () => {
		const { rows } = renderTankStats(false);
		const trio = tankRows(rows);

		expect(trio.length).toBe(3);
		for (const row of trio) {
			expect(row.querySelector('.ui-character-stats-value > .ui-skeleton')).not.toBeNull();
			expect(row.querySelector('[data-testid="stat-value-link"]')).toBeNull();
		}
	});

	it('replaces those three skeletons with their values once the stats arrive', () => {
		const { rows } = renderTankStats(true);
		const trio = tankRows(rows);

		expect(trio.length).toBe(3);
		for (const row of trio) {
			expect(row.querySelector('.ui-skeleton')).toBeNull();
			expect(row.querySelector('[data-testid="stat-value-link"]')).not.toBeNull();
		}
		expect(trio[0].querySelector('[data-testid="stat-value-link"]')!.textContent).toContain('7.00%');
		expect(trio[1].querySelector('[data-testid="stat-value-link"]')!.textContent).toContain('64.00%');
	});
});
