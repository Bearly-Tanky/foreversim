import type { StatWeightsResult, StatWeightValues } from '@generated/proto/api';
import { Stat } from '@generated/proto/common';
import { UnitStat } from '@sim/proto/stats';
import { stDevToConf90 } from '@sim/utils/math';

// Which of the metrics one stat weights run produces is on screen. One run fills in all of them,
// so switching never costs another sim.
export enum WeightsMetric {
	Dps,
	Tps,
	Dtps,
}

export const METRIC_LABELS: Record<WeightsMetric, string> = {
	[WeightsMetric.Dps]: 'Damage (DPS)',
	[WeightsMetric.Tps]: 'Threat (TPS)',
	[WeightsMetric.Dtps]: 'Damage taken (DTPS)',
};

// Fixed rather than derived from the rows, so a column means the same thing in every row.
export const THROUGHPUT_STATS: ReadonlyArray<Stat> = [
	Stat.StatStrength,
	Stat.StatAgility,
	Stat.StatIntellect,
	Stat.StatSpirit,
	Stat.StatAttackPower,
	Stat.StatRangedAttackPower,
	Stat.StatMeleeHitRating,
	Stat.StatMeleeCritRating,
	Stat.StatMeleeHasteRating,
	Stat.StatExpertiseRating,
	Stat.StatArmorPenetration,
	Stat.StatSpellDamage,
	Stat.StatSpellHitRating,
	Stat.StatSpellCritRating,
	Stat.StatSpellHasteRating,
	Stat.StatMP5,
];

// Damage taken is about staying alive, so the mitigation stats replace the throughput ones.
export const MITIGATION_STATS: ReadonlyArray<Stat> = [
	Stat.StatStamina,
	Stat.StatHealth,
	Stat.StatArmor,
	Stat.StatBonusArmor,
	Stat.StatDefenseRating,
	Stat.StatDodgeRating,
	Stat.StatParryRating,
	Stat.StatBlockRating,
	Stat.StatBlockValue,
];

// The sim normalises damage-taken EP against armor, not the spec's reference (DTPSReferenceStat in sim/core/statweight.go).
export const DTPS_REFERENCE_STAT = Stat.StatArmor;

export const referenceStat = (metric: WeightsMetric, specReference: Stat): Stat => (metric === WeightsMetric.Dtps ? DTPS_REFERENCE_STAT : specReference);

// With 'show all', every stat any row weighs, in enum order.
export function displayedStats(metric: WeightsMetric, showAll: boolean, epStatsPerRow: ReadonlyArray<ReadonlyArray<Stat>>): Array<Stat> {
	if (showAll) {
		const weighed = new Set(epStatsPerRow.flat());
		return [...weighed].sort((a, b) => a - b);
	}
	return [...(metric === WeightsMetric.Dtps ? MITIGATION_STATS : THROUGHPUT_STATS)];
}

export function metricValues(result: StatWeightsResult, metric: WeightsMetric): StatWeightValues | undefined {
	if (metric === WeightsMetric.Tps) return result.tps;
	if (metric === WeightsMetric.Dtps) return result.dtps;
	return result.dps;
}

export type Cell = { kind: 'not-weighed' } | { kind: 'empty' } | { kind: 'value'; ep: number; conf90: number; best: boolean; noise: boolean };

export function rowCells(stats: ReadonlyArray<Stat>, epStats: ReadonlyArray<Stat>, values: StatWeightValues | undefined, iterations: number): Array<Cell> {
	const epOf = (stat: Stat) => (values?.epValues ? UnitStat.fromStat(stat).getProtoValue(values.epValues) : 0);
	const best = Math.max(0, ...stats.filter(stat => epStats.includes(stat)).map(epOf));
	return stats.map(stat => {
		if (!epStats.includes(stat)) return { kind: 'not-weighed' };
		if (!values?.epValues) return { kind: 'empty' };
		const ep = epOf(stat);
		const stdev = values.epValuesStdev ? UnitStat.fromStat(stat).getProtoValue(values.epValuesStdev) : 0;
		const conf90 = stDevToConf90(stdev, Math.max(1, iterations));
		const isBest = best > 0 && ep === best;
		return { kind: 'value', ep, conf90, best: isBest, noise: !isBest && Math.abs(ep) < conf90 };
	});
}

// A weight a hair under zero rounds to '-0.00', which reads as a real negative.
export const formatEp = (ep: number): string => ep.toFixed(2).replace('-0.00', '0.00');
