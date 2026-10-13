import { TargetedActionMetrics as TargetedActionMetricsProto } from '@generated/proto/api';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@i18n/localization', () => ({
	translateStat: (stat: unknown) => String(stat),
	translatePseudoStat: (pseudoStat: unknown) => String(pseudoStat),
}));

import { TargetedActionMetrics } from './sim_result';

// TBC calls a blocked critical hit `blockedCrit*` where MoP renamed the same three fields to
// `critBlock*`. Both names exist in the two codebases and neither is a type error against the
// other's proto, so pin TBC's.
describe('TargetedActionMetrics blocked-crit and crush getters', () => {
	const metrics = (over: Partial<TargetedActionMetricsProto>) =>
		new TargetedActionMetrics(TargetedActionMetricsProto.create(over), { iterations: 2, duration: 100 });

	it('averages blockedCrits and blockedCritDamage over the iterations', () => {
		const m = metrics({ blockedCrits: 10, blockedCritDamage: 5000 });
		expect(m.blockedCrits).toBe(5);
		expect(m.blockedCritDamage).toBe(5000);
		expect(m.avgBlockedCritDamage).toBe(2500);
	});

	it('takes blockedCritPercent against every hit attempt', () => {
		// 10 blocked crits out of 40 attempts (10 hits + 10 crits + 10 misses + 10 blocked crits).
		const m = metrics({ hits: 10, crits: 10, misses: 10, blockedCrits: 10 });
		expect(m.hitAttempts).toBe(40);
		expect(m.blockedCritPercent).toBe(25);
	});

	it('counts blocked crits and crushes as landed hits', () => {
		const m = metrics({ hits: 2, blockedCrits: 4, crushes: 6 });
		expect(m.landedHitsRaw).toBe(12);
	});

	it('exposes the TBC-only crush family', () => {
		const m = metrics({ hits: 10, crushes: 10, crushDamage: 4000 });
		expect(m.crushes).toBe(5);
		expect(m.crushDamage).toBe(4000);
		expect(m.avgCrushDamage).toBe(2000);
		expect(m.crushPercent).toBe(50);
	});
});
