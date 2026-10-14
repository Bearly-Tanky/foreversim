import type { ProgressMetrics } from '@generated/proto/api';
import type { SimHost } from '@sim/sim_host';
import { useSyncExternalStore } from 'react';

// The running sim's progress, shared by the results card and the phone's bottom bar, which can
// both start the same run.
let progress: ProgressMetrics | null = null;
const listeners = new Set<() => void>();

const setProgress = (next: ProgressMetrics | null) => {
	progress = next;
	listeners.forEach(listener => listener());
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/** Percent of the running sim's fights done, 0 when nothing is running. */
export const useSimProgress = (): number =>
	useSyncExternalStore(subscribe, () =>
		progress && progress.totalIterations > 0 ? Math.round((progress.completedIterations / progress.totalIterations) * 100) : 0,
	);

export const runSimulation = async (host: SimHost) => {
	setProgress(null);
	try {
		await host.runIndividualSim(next => setProgress(next));
	} finally {
		setProgress(null);
	}
};
