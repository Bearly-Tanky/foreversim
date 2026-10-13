// TBC's backend omits RequestLow for the school-split hit/crit stats: sim/core/statweight.go
// zeroes their low-side stat modifier and only populates lowSimRequest when it is non-zero.
// Nothing in the type system catches a missing guard here — a non-null assertion on the low
// request type-checks and throws at runtime — so the absent-low path is covered explicitly.
import { ProgressMetrics, RaidSimRequest, RaidSimResult, SimOptions, StatWeightsResult } from '@generated/proto/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimSignals } from '../sim_signal_manager';
import type { WorkerPool } from '../workers/worker_pool';
import { runConcurrentStatWeights } from './stat_weights';

const runConcurrentSim = vi.hoisted(() => vi.fn());
vi.mock('./sim', () => ({ runConcurrentSim }));

const requestWithIterations = (iterations: number) => RaidSimRequest.create({ simOptions: SimOptions.create({ iterations }) });

const signals = { abort: { isTriggered: () => false } } as unknown as SimSignals;

const makePool = (statSimRequests: Array<{ requestLow?: RaidSimRequest; requestHigh: RaidSimRequest }>) =>
	({
		statWeightRequests: vi.fn(async () => ({
			baseRequest: requestWithIterations(100),
			epReferenceStat: 0,
			statSimRequests,
		})),
		statWeightCompute: vi.fn(async () => StatWeightsResult.create()),
	}) as unknown as WorkerPool;

describe('runConcurrentStatWeights', () => {
	beforeEach(() => {
		runConcurrentSim.mockReset();
		// Report one iteration per sim so the caller's progress handler runs and exposes the totals.
		runConcurrentSim.mockImplementation(async (request: RaidSimRequest, _pool: WorkerPool, onProgress: (pm: ProgressMetrics) => void) => {
			onProgress(ProgressMetrics.create({ completedIterations: request.simOptions!.iterations }));
			return RaidSimResult.create();
		});
	});

	it('skips the low sim, and its iterations, when requestLow is unset', async () => {
		const pool = makePool([{ requestHigh: requestWithIterations(30) }]);
		const progress: ProgressMetrics[] = [];

		await runConcurrentStatWeights({} as never, pool, pm => progress.push(pm), signals);

		// Baseline + high only; the absent low sim is neither run nor counted.
		expect(runConcurrentSim).toHaveBeenCalledTimes(2);
		expect(progress[0].totalSims).toBe(2);
		expect(progress[0].totalIterations).toBe(130);

		const calcRequest = vi.mocked(pool.statWeightCompute).mock.calls[0][0];
		expect(calcRequest.statSimResults[0].resultLow).toBeUndefined();
		expect(calcRequest.statSimResults[0].resultHigh).toBeDefined();
	});

	it('runs the low sim when requestLow is present', async () => {
		const pool = makePool([{ requestLow: requestWithIterations(20), requestHigh: requestWithIterations(30) }]);
		const progress: ProgressMetrics[] = [];

		await runConcurrentStatWeights({} as never, pool, pm => progress.push(pm), signals);

		expect(runConcurrentSim).toHaveBeenCalledTimes(3);
		expect(progress[0].totalSims).toBe(3);
		expect(progress[0].totalIterations).toBe(150);

		const calcRequest = vi.mocked(pool.statWeightCompute).mock.calls[0][0];
		expect(calcRequest.statSimResults[0].resultLow).toBeDefined();
	});
});
