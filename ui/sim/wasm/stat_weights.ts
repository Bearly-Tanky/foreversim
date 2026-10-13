import {
	ErrorOutcome,
	ErrorOutcomeType,
	ProgressMetrics,
	RaidSimResult,
	StatWeightsCalcRequest,
	StatWeightsRequest,
	StatWeightsResult,
	StatWeightsStatResultData,
} from '@generated/proto/api';
import { SimRequest } from '@worker/types';

import { SimSignals } from '../sim_signal_manager';
import { isDevMode } from '../utils/env';
import { generateRequestId, WorkerPool, WorkerProgressCallback } from '../workers/worker_pool';
import { runConcurrentSim } from './sim';

const makeAndSendWeightsError = (err: string | ErrorOutcome, onProgress: WorkerProgressCallback): StatWeightsResult => {
	const errRes = StatWeightsResult.create();
	if (typeof err === 'string') {
		console.error(err);
		errRes.error = ErrorOutcome.create({ message: err });
	} else {
		if (err.message) console.error(err.message);
		errRes.error = err;
	}
	onProgress(ProgressMetrics.create({ finalWeightResult: errRes }));
	return errRes;
};

export const runConcurrentStatWeights = async (
	request: StatWeightsRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
): Promise<StatWeightsResult> => {
	if (isDevMode()) {
		console.log('Getting stat weight sim requests.');
	}

	const newRaidSimRequestId = () => generateRequestId(SimRequest.raidSimAsync);

	const manualResponse = await workerPool.statWeightRequests(request);
	manualResponse.baseRequest!.requestId = newRaidSimRequestId();

	if (signals.abort.isTriggered()) {
		return makeAndSendWeightsError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);
	}

	let iterationsTotal = manualResponse.baseRequest!.simOptions!.iterations;
	let iterationsDone = 0;
	let simsTotal = 1;
	let simsDone = 0;

	// TBC's backend leaves RequestLow unset for the school-split hit/crit stats, whose low-side
	// modifier is always zero (sim/core/statweight.go). Skip the low sim when it is absent rather
	// than counting iterations for a request that does not exist.
	for (const statReqData of manualResponse.statSimRequests) {
		if (statReqData.requestLow) {
			iterationsTotal += statReqData.requestLow.simOptions!.iterations;
			simsTotal += 1;
		}
		iterationsTotal += statReqData.requestHigh!.simOptions!.iterations;
		simsTotal += 1;
	}

	if (isDevMode()) {
		console.log(`Need to run a total of ${simsTotal} sims and ${iterationsTotal} iterations.`);
	}

	let lastIterations = 0;
	const progressHandler = (pm: ProgressMetrics) => {
		iterationsDone += pm.completedIterations - lastIterations;
		lastIterations = pm.completedIterations;

		onProgress(
			ProgressMetrics.create({
				totalIterations: iterationsTotal,
				completedIterations: iterationsDone,
				totalSims: simsTotal,
				completedSims: simsDone,
			}),
		);

		if (pm.finalRaidResult) simsDone++;
	};

	const baseLine = await runConcurrentSim(manualResponse.baseRequest!, workerPool, progressHandler, signals);
	if (baseLine.error) return makeAndSendWeightsError(baseLine.error, onProgress);

	const calcRequest = StatWeightsCalcRequest.create({
		baseResult: baseLine,
		epReferenceStat: manualResponse.epReferenceStat,
		statSimResults: [],
	});

	for (const statReqData of manualResponse.statSimRequests) {
		if (signals.abort.isTriggered()) return makeAndSendWeightsError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);

		lastIterations = 0;
		let lowRes: RaidSimResult | undefined;
		if (statReqData.requestLow) {
			statReqData.requestLow.requestId = newRaidSimRequestId();
			lowRes = await runConcurrentSim(statReqData.requestLow, workerPool, progressHandler, signals);
			if (lowRes.error) return makeAndSendWeightsError(lowRes.error, onProgress);
		}

		lastIterations = 0;
		statReqData.requestHigh!.requestId = newRaidSimRequestId();
		const highRes = await runConcurrentSim(statReqData.requestHigh!, workerPool, progressHandler, signals);
		if (highRes.error) return makeAndSendWeightsError(highRes.error, onProgress);

		calcRequest.statSimResults.push(
			StatWeightsStatResultData.create({
				statData: statReqData.statData,
				resultLow: lowRes,
				resultHigh: highRes,
			}),
		);
	}

	if (isDevMode()) {
		console.log(`All ${simsTotal} sims finished successfully. Computing weights.`);
	}

	const weightResult = await workerPool.statWeightCompute(calcRequest);
	if (weightResult.error) return makeAndSendWeightsError(weightResult.error, onProgress);
	onProgress(ProgressMetrics.create({ finalWeightResult: weightResult }));
	return weightResult;
};
