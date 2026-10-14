import type { PlayerSpec } from '@sim/player/player_spec';
import type { ActionId } from '@sim/proto/action_id';
import type { SimResult } from '@sim/proto/sim_result';

// The simple view's numbers, worked out from a sim result. Nothing here touches the page.

export type MetricKind = 'dps' | 'hps' | 'tps' | 'dtps';

export interface Metric {
	avg: number;
	stdev: number;
}

export interface AbilityShare {
	name: string;
	iconUrl: string;
	/** For loading the icon when the result has not filled it in. */
	actionId: ActionId | null;
	dps: number;
	/** Of the listed abilities' total, 0 to 1. */
	share: number;
}

export interface ResultSummary {
	iterations: number;
	metrics: Record<MetricKind, Metric>;
	abilities: Array<AbilityShare>;
}

/** The number a spec is judged by: healing for healers, damage for everyone else. Tanks show more beside it. */
export const primaryMetric = (spec: PlayerSpec<any>): 'dps' | 'hps' => (spec.isHealingSpec ? 'hps' : 'dps');

export const secondaryMetrics = (spec: PlayerSpec<any>): Array<MetricKind> => (spec.isTankSpec ? ['tps', 'dtps'] : []);

export const METRIC_LABEL: Record<MetricKind, { short: string; long: string }> = {
	dps: { short: 'DPS', long: 'Damage per second' },
	hps: { short: 'HPS', long: 'Healing per second' },
	tps: { short: 'TPS', long: 'Threat per second' },
	dtps: { short: 'DTPS', long: 'Damage taken per second' },
};

/** Lower is better only for damage taken. */
export const higherIsBetter = (kind: MetricKind): boolean => kind !== 'dtps';

const MAX_ABILITIES = 6;

/** "Execute (Rank 5)" reads as "Execute"; the rank is always the highest one a level 60 has. */
export const abilityName = (name: string): string => name.replace(/\s*\(Rank \d+\)$/, '');

export const summarizeResult = (result: SimResult): ResultSummary | null => {
	const player = result.getRaidIndexedPlayers()[0];
	if (!player) return null;

	const rows = [
		...player.getDamageActions().map(action => ({ name: abilityName(action.name), iconUrl: action.iconUrl, actionId: action.actionId, dps: action.dps })),
		// A pet's damage is one row, the way the in-game meter shows it.
		...player.pets.filter(pet => pet.dps.avg > 0).map(pet => ({ name: pet.name, iconUrl: pet.iconUrl, actionId: null, dps: pet.dps.avg })),
	].sort((a, b) => b.dps - a.dps);

	const total = rows.reduce((sum, row) => sum + row.dps, 0);
	// Rows under 1% are noise at this size; they join "Everything else".
	const shown = rows.slice(0, MAX_ABILITIES).filter(row => total > 0 && row.dps / total >= 0.01);
	const rest = total - shown.reduce((sum, row) => sum + row.dps, 0);
	if (total > 0 && rest / total >= 0.005) shown.push({ name: 'Everything else', iconUrl: '', actionId: null, dps: rest });

	const metric = (distribution: { avg: number; stdev: number }): Metric => ({ avg: distribution.avg, stdev: distribution.stdev });
	return {
		iterations: result.iterations,
		metrics: { dps: metric(player.dps), hps: metric(player.hps), tps: metric(player.tps), dtps: metric(player.dtps) },
		abilities: shown.map(row => ({ ...row, share: total > 0 ? row.dps / total : 0 })),
	};
};

export type Verdict = 'better' | 'worse' | 'same';

export interface Comparison {
	diff: number;
	percent: number;
	verdict: Verdict;
}

/**
 * How a metric moved between two runs. A sim is a sample of random fights, so two runs of the
 * same character never match exactly: a difference inside two standard errors of the gap is
 * reported as no change rather than as a win or a loss.
 */
export const compareMetric = (kind: MetricKind, current: ResultSummary, previous: ResultSummary): Comparison => {
	const now = current.metrics[kind];
	const before = previous.metrics[kind];
	const diff = now.avg - before.avg;
	const percent = before.avg !== 0 ? (diff / before.avg) * 100 : 0;
	const standardError = Math.sqrt(now.stdev ** 2 / Math.max(current.iterations, 1) + before.stdev ** 2 / Math.max(previous.iterations, 1));
	if (Math.abs(diff) <= 2 * standardError) return { diff, percent, verdict: 'same' };
	const improved = higherIsBetter(kind) ? diff > 0 : diff < 0;
	return { diff, percent, verdict: improved ? 'better' : 'worse' };
};

export const formatNumber = (value: number, digits = 0): string =>
	value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatSigned = (value: number, digits = 1): string => `${value >= 0 ? '+' : '−'}${formatNumber(Math.abs(value), digits)}`;
