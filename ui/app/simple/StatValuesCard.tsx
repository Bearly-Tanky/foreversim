import { calculateEp, combineScaledEpValues, epWeightsWithoutExcluded } from '@features/stat-weights/model/ep_math';
import { ErrorOutcomeType, type ProgressMetrics, type StatWeightsResult } from '@generated/proto/api';
import { translatePseudoStat, translateStat } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimStatus } from '@sim/hooks/useSimStatus';
import { useStatWeights } from '@sim/hooks/useStatWeights';
import { Stats } from '@sim/proto/stats';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { toastManager } from '@ui-kit/Toast';
import { useMemo, useState } from 'react';

import type { SimHostObject } from '../individual_sim_ui';
import { Card } from './Card';
import { METRIC_LABEL, primaryMetric } from './simple_model';

const MAX_ROWS = 8;

export const StatValuesCard = () => {
	const host = useSimHost() as SimHostObject<any>;
	const player = host.player;
	const config = host.individualConfig;
	const settings = host.statWeightActionSettings;
	const kind = primaryMetric(player.getPlayerSpec());
	const { status } = useSimStatus(host.sim);
	const [progress, setProgress] = useState<ProgressMetrics | null>(null);
	const [result, setResult] = useState<StatWeightsResult | null>(null);
	const { isRunning, abort, start } = useStatWeights({ onProgress: setProgress });

	const calculate = async () => {
		if (isRunning) return;
		setProgress(null);
		try {
			const computed = await start({
				epStats: config.epStats.filter(stat => !settings.isStatExcludedFromCalc(stat)),
				epPseudoStats: (config.epPseudoStats ?? []).filter(stat => !settings.isPseudoStatExcludedFromCalc(stat)),
				epReferenceStat: config.epReferenceStat,
			});
			if (computed.error) {
				if (computed.error.type !== ErrorOutcomeType.ErrorOutcomeAborted) toastManager.add({ variant: 'error', body: computed.error.message });
				return;
			}
			setResult(computed);
			// The item picker sorts by these, so its scores now follow this character rather than the spec's defaults.
			const normalised = calculateEp(computed, {
				dps: player.getRefStat('dpsRefStat'),
				heal: player.getRefStat('healRefStat'),
				tank: player.getRefStat('tankRefStat'),
			});
			player.setEpWeights(epWeightsWithoutExcluded(combineScaledEpValues(normalised, player.getEpRatios()), player.getEpWeights(), settings));
		} catch (error: any) {
			toastManager.add({ variant: 'error', body: error?.message || 'Calculating stat values failed. Reload the page and try again.' });
		} finally {
			setProgress(null);
		}
	};

	const rows = useMemo(() => {
		const values = result?.[kind]?.weights;
		if (!values) return [];
		const weights = Stats.fromProto(values);
		return [
			...config.epStats.map(stat => ({ name: translateStat(stat), value: weights.getStat(stat) })),
			...(config.epPseudoStats ?? []).map(stat => ({ name: translatePseudoStat(stat), value: weights.getPseudoStat(stat) })),
		]
			.filter(row => row.value > 0)
			.sort((a, b) => b.value - a.value)
			.slice(0, MAX_ROWS);
	}, [result, kind, config]);

	if (host.simDisabled) return null;

	const top = rows[0]?.value ?? 0;
	const percent = progress && progress.totalIterations > 0 ? Math.round((progress.completedIterations / progress.totalIterations) * 100) : 0;

	return (
		<Card title="Which stats matter most" testId="simple-stat-values">
			<div className="flex flex-col gap-3">
				{rows.length > 0 ? (
					<>
						<ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="simple-stat-rows">
							{rows.map(row => (
								<li key={row.name} className="flex flex-col gap-0.5">
									<div className="flex justify-between gap-2 text-sm">
										<span>{row.name}</span>
										<span className="text-gray-300 tabular-nums">
											+{row.value.toFixed(2)} {METRIC_LABEL[kind].short}
										</span>
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-black/40">
										<div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / top) * 100}%` }} />
									</div>
								</li>
							))}
						</ul>
						<p className="m-0 text-sm text-gray-300 opacity-75">
							{METRIC_LABEL[kind].short} gained per point of each stat. The item picker now ranks items with these.
						</p>
					</>
				) : (
					<p className="m-0 text-sm text-gray-300">
						Find out how much each stat is worth for this exact character. It takes longer than a normal simulation.
					</p>
				)}
				{isRunning ? (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between text-sm">
							<span>
								<Icon name="spinner" spin className="mr-2" />
								Calculating… {percent}%
							</span>
							<Button variant="link" size="inline" onClick={() => void abort()}>
								Stop
							</Button>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-black/40">
							<div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
						</div>
					</div>
				) : (
					<Button variant="outline-light" disabled={status !== 'ready'} onClick={() => void calculate()} data-testid="simple-calc-stats">
						<Icon name="calculator" className="mr-2" />
						{rows.length > 0 ? 'Recalculate' : 'Calculate stat values'}
					</Button>
				)}
			</div>
		</Card>
	);
};
