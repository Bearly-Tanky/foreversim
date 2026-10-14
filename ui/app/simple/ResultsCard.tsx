import { useSimHost } from '@sim/context/SimHostContext';
import { useSimRun } from '@sim/hooks/useSimRun';
import { useSimStatus } from '@sim/hooks/useSimStatus';
import type { SimResult } from '@sim/proto/sim_result';
import { SimRunKind } from '@sim/state/sim_store';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import type { SimHostObject } from '../individual_sim_ui';
import { Card } from './Card';
import {
	type AbilityShare,
	compareMetric,
	type Comparison,
	formatNumber,
	formatSigned,
	METRIC_LABEL,
	type MetricKind,
	primaryMetric,
	type ResultSummary,
	secondaryMetrics,
	summarizeResult,
} from './simple_model';
import { runSimulation, useSimProgress } from './simulation';

/** The latest run and the one before it, for "compared to your last run". */
const useResultPair = (): { current: ResultSummary | null; previous: ResultSummary | null } => {
	const { raidSimResultsManager } = useSimHost() as SimHostObject<any>;
	// `getData()` builds a new object per call, so the snapshot is the result itself, which is stable.
	const latest: SimResult | null = useSyncExternalStore(raidSimResultsManager.subscribe, () => raidSimResultsManager.getData().current?.simResult ?? null);
	const [pair, setPair] = useState<{ result: SimResult | null; current: ResultSummary | null; previous: ResultSummary | null }>({
		result: null,
		current: null,
		previous: null,
	});

	useEffect(() => {
		if (!latest || latest === pair.result) return;
		setPair(before => ({ result: latest, current: summarizeResult(latest), previous: before.current }));
	}, [latest, pair.result]);

	return { current: pair.current, previous: pair.previous };
};

const VERDICT_TEXT: Record<Comparison['verdict'], string> = {
	better: 'text-success',
	worse: 'text-danger',
	same: 'text-gray-300',
};

const ComparisonLine = ({ kind, comparison }: { kind: MetricKind; comparison: Comparison }) => (
	<p className={clsx('m-0 text-center text-sm', VERDICT_TEXT[comparison.verdict])} data-testid="simple-comparison">
		{comparison.verdict === 'same' ? (
			<>
				No real change from your last run ({formatSigned(comparison.diff)} {METRIC_LABEL[kind].short} is within the normal variation)
			</>
		) : (
			<>
				<Icon name="arrow-up" className={clsx('mr-1', comparison.diff < 0 && 'rotate-180')} />
				{formatSigned(comparison.diff)} {METRIC_LABEL[kind].short} ({formatSigned(comparison.percent)}%) compared to your last run
			</>
		)}
	</p>
);

const AbilityIcon = ({ ability }: { ability: AbilityShare }) => {
	const { iconUrl } = useActionId(ability.iconUrl ? undefined : (ability.actionId ?? undefined));
	const url = ability.iconUrl || iconUrl;
	return url ? <img src={url} alt="" className="size-6 shrink-0 rounded-sm" /> : <span className="size-6 shrink-0" />;
};

const AbilityBreakdown = ({ summary }: { summary: ResultSummary }) => (
	<div className="flex flex-col gap-2" data-testid="simple-breakdown">
		<h3 className="m-0 text-sm font-bold text-gray-300">Where the damage comes from</h3>
		<ul className="m-0 flex list-none flex-col gap-1.5 p-0">
			{summary.abilities.map((ability, index) => (
				<li key={index} className="flex items-center gap-2">
					<AbilityIcon ability={ability} />
					<div className="min-w-0 flex-1">
						<div className="flex justify-between gap-2 text-sm">
							<span className="truncate">{ability.name}</span>
							<span className="shrink-0 text-gray-300 tabular-nums">{Math.round(ability.share * 100)}%</span>
						</div>
						<div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/40">
							<div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(ability.share * 100, 1)}%` }} />
						</div>
					</div>
				</li>
			))}
		</ul>
	</div>
);

export const ResultsCard = () => {
	const host = useSimHost();
	const spec = host.player.getPlayerSpec();
	const { isRunning, abort } = useSimRun(SimRunKind.IndividualSim);
	const { status } = useSimStatus(host.sim);
	const percent = useSimProgress();
	const { current, previous } = useResultPair();
	const primary = primaryMetric(spec);
	const comparison = useMemo(() => (current && previous ? compareMetric(primary, current, previous) : null), [current, previous, primary]);

	const simulate = () => {
		if (!isRunning) void runSimulation(host);
	};

	return (
		<Card title="Results" testId="simple-results">
			<div className="flex flex-col gap-4">
				{host.simDisabled ? (
					<p className="m-0 text-gray-300">This spec can be planned but not simulated yet.</p>
				) : isRunning ? (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between text-sm">
							<span>
								<Icon name="spinner" spin className="mr-2" />
								Simulating fights… {percent}%
							</span>
							<Button variant="link" size="inline" onClick={() => void abort()}>
								Stop
							</Button>
						</div>
						<div className="h-3 overflow-hidden rounded-full bg-black/40">
							<div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
						</div>
					</div>
				) : (
					<Button className="w-full py-3 text-lg font-bold" disabled={status !== 'ready'} onClick={simulate} data-testid="simple-simulate">
						<Icon name="play" className="mr-2" />
						{current ? 'Simulate again' : 'Simulate'}
					</Button>
				)}

				{current ? (
					<>
						<div className="flex flex-col items-center gap-1" data-testid="simple-primary-result">
							<div className="text-5xl leading-none font-bold tabular-nums">{formatNumber(current.metrics[primary].avg)}</div>
							<div className="text-gray-300">{METRIC_LABEL[primary].long}</div>
						</div>
						{comparison && <ComparisonLine kind={primary} comparison={comparison} />}
						{secondaryMetrics(spec).length > 0 && (
							<dl className="m-0 grid grid-cols-2 gap-2">
								{secondaryMetrics(spec).map(kind => (
									<div key={kind} className="rounded-lg bg-black/30 p-3 text-center">
										<dt className="text-sm text-gray-300">{METRIC_LABEL[kind].long}</dt>
										<dd className="m-0 text-xl font-bold tabular-nums">{formatNumber(current.metrics[kind].avg)}</dd>
									</div>
								))}
							</dl>
						)}
						{current.abilities.length > 0 && <AbilityBreakdown summary={current} />}
						<p className="m-0 text-center text-sm text-gray-300 opacity-75">Average of {formatNumber(current.iterations)} simulated fights.</p>
					</>
				) : (
					!isRunning && (
						<p className="m-0 text-center text-gray-300">
							Press Simulate to see how much {primary === 'hps' ? 'healing' : 'damage'} this character does. Change anything about your character
							and run it again to compare.
						</p>
					)
				)}
			</div>
		</Card>
	);
};

/** Phones only: the results card is far below the gear there, so the run and its number stay in reach. */
export const MobileSimBar = () => {
	const host = useSimHost();
	const { isRunning } = useSimRun(SimRunKind.IndividualSim);
	const { status } = useSimStatus(host.sim);
	const percent = useSimProgress();
	const { current, previous } = useResultPair();
	const primary = primaryMetric(host.player.getPlayerSpec());
	const comparison = current && previous ? compareMetric(primary, current, previous) : null;
	if (host.simDisabled) return null;

	return (
		<div
			className="fixed inset-x-0 bottom-0 z-header border-t border-surface-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:hidden"
			data-testid="simple-mobile-bar">
			<div className="mx-auto flex max-w-7xl items-center gap-3">
				<div className="min-w-0 flex-1">
					{current ? (
						<>
							<div className="text-xl leading-tight font-bold tabular-nums">
								{formatNumber(current.metrics[primary].avg)} {METRIC_LABEL[primary].short}
							</div>
							{comparison && comparison.verdict !== 'same' && (
								<div className={clsx('text-xs', VERDICT_TEXT[comparison.verdict])}>{formatSigned(comparison.diff)} vs last run</div>
							)}
						</>
					) : (
						<div className="text-sm text-gray-300">No result yet</div>
					)}
				</div>
				<Button className="shrink-0 px-5 py-2 font-bold" disabled={isRunning || status !== 'ready'} onClick={() => void runSimulation(host)}>
					{isRunning ? (
						<>
							<Icon name="spinner" spin className="mr-2" />
							{percent}%
						</>
					) : (
						<>
							<Icon name="play" className="mr-2" />
							Simulate
						</>
					)}
				</Button>
			</div>
		</div>
	);
};
