import { Stat } from '@generated/proto/common';
import { Stats } from '@sim/proto/stats';
import { describe, expect, it } from 'vitest';

import { displayedStats, formatEp, MITIGATION_STATS, rowCells, THROUGHPUT_STATS, WeightsMetric } from './stat_weights_model';

describe('displayedStats', () => {
	it('picks the fixed set by metric', () => {
		expect(displayedStats(WeightsMetric.Dps, false, [])).toEqual(THROUGHPUT_STATS);
		expect(displayedStats(WeightsMetric.Dtps, false, [])).toEqual(MITIGATION_STATS);
	});

	it('shows the union of weighed stats in enum order when showing all', () => {
		const rows = [
			[Stat.StatSpirit, Stat.StatAgility],
			[Stat.StatAgility, Stat.StatStrength],
		];
		expect(displayedStats(WeightsMetric.Dps, true, rows)).toEqual([Stat.StatStrength, Stat.StatAgility, Stat.StatSpirit]);
	});
});

describe('rowCells', () => {
	const stats = [Stat.StatStrength, Stat.StatAgility, Stat.StatSpirit, Stat.StatStamina];
	const epStats = [Stat.StatStrength, Stat.StatAgility, Stat.StatSpirit];
	const values = {
		epValues: Stats.fromMap({ [Stat.StatStrength]: 1, [Stat.StatAgility]: 2, [Stat.StatSpirit]: 0.01 }).toProto(),
		epValuesStdev: Stats.fromMap({ [Stat.StatStrength]: 1, [Stat.StatAgility]: 1, [Stat.StatSpirit]: 1 }).toProto(),
	};

	it('marks the best, the noise and the stats the spec does not weigh', () => {
		const cells = rowCells(stats, epStats, values, 100);
		expect(cells[3]).toEqual({ kind: 'not-weighed' });
		expect(cells[1]).toMatchObject({ kind: 'value', ep: 2, best: true, noise: false });
		expect(cells[0]).toMatchObject({ kind: 'value', ep: 1, best: false, noise: false });
		expect(cells[2]).toMatchObject({ kind: 'value', best: false, noise: true });
		expect(cells[0].kind === 'value' && cells[0].conf90).toBeCloseTo(0.1645);
	});

	it('leaves weighed cells empty before a run', () => {
		expect(rowCells(stats, epStats, undefined, 0).map(cell => cell.kind)).toEqual(['empty', 'empty', 'empty', 'not-weighed']);
	});

	it('never prints negative zero', () => {
		expect(formatEp(-0.001)).toBe('0.00');
	});
});
