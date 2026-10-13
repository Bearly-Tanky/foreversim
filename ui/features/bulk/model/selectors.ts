import type { BulkSlice } from '@sim/state/sim_store';

export const canRunBatch = (slice: BulkSlice, combinationsLimit: number): boolean =>
	!slice.combinationsPending && !slice.isRunning && slice.combinations > 1 && slice.combinations <= combinationsLimit;
