import { browserEnv } from '@app/browser_env';
import { IterationsPicker } from '@app/IterationsPicker';
import { applyIndividualDefaults, type DefaultsHost } from '@features/settings/model/apply_defaults';
import type { StatWeightsResult } from '@generated/proto/api';
import type { Spec } from '@generated/proto/common';
import { translateStat } from '@i18n/localization';
import { LaunchStatus } from '@sim/constants/other';
import { Player } from '@sim/player/player';
import { PlayerSpecs } from '@sim/player/specs';
import { textClassNameForSpec } from '@sim/proto/utils';
import { Sim } from '@sim/sim';
import { RequestTypes } from '@sim/sim_signal_manager';
import { registerSpecConfig, type SpecDefinition } from '@sim/spec_config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { ToastArea, toastManager } from '@ui-kit/Toast';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useRef, useState } from 'react';

import { PageSection, ProductPage } from '../ProductPage';
import { displayedStats, DTPS_REFERENCE_STAT, formatEp, METRIC_LABELS, metricValues, referenceStat, rowCells, WeightsMetric } from './stat_weights_model';

const DEFAULT_ITERATIONS = 1000;
const TOOLTIP_ID = 'stat-weights-cell';

// Every spec page's definition, the same modules spec_entry.tsx loads one of.
// A second page of a spec (the Smite page) is the same spec: one row each.
const defs = Object.values(import.meta.glob<SpecDefinition<any>>('../../specs/*/*/spec.{ts,tsx}', { eager: true, import: 'default' })).filter(
	def => !def.storageKeyPart,
);
defs.forEach(def => registerSpecConfig(def.spec, def));

const playerSpecOf = (def: SpecDefinition<any>) => PlayerSpecs.fromProto(def.spec);
const specName = (def: SpecDefinition<any>) => PlayerSpecs.getFullSpecName(playerSpecOf(def)).trim();
// GearPlanner and Unlaunched specs have no working sim behind them.
const simulable = (def: SpecDefinition<any>) => playerSpecOf(def).launch.status > LaunchStatus.GearPlanner;
const rowDefs = defs.filter(simulable);
const missingNames = defs.filter(def => !simulable(def)).map(specName);

const sim = new Sim({ env: browserEnv });
sim.setIterations(DEFAULT_ITERATIONS);

// Sets the sim up as if that spec's individual sim had just been opened and nothing touched, then
// issues the request its Stat Weights button would. Only the spec's own epStats are weighed: the
// pseudo-stats and resistances an individual sim adds do not compare across specs.
async function runSpecStatWeights(def: SpecDefinition<any>, onProgress: (percent: number) => void): Promise<StatWeightsResult> {
	await sim.waitForInit();
	const iterations = sim.getIterations();
	const player = new Player(playerSpecOf(def), sim);
	if (def.enableHealing) player.enableHealing();
	sim.raid.setPlayer(0, player);
	// ponytail: a stand-in host; the reforger and saved stat weight settings do not affect a run.
	applyIndividualDefaults({
		player,
		sim,
		individualConfig: def,
		reforger: null,
		statWeightActionSettings: { applyDefaults() {} },
	} as unknown as DefaultsHost<Spec>);
	def.derivedSettings?.forEach(derived => derived.apply(player, sim));
	// applyDefaults resets the iteration count.
	sim.setIterations(iterations);
	return sim.statWeights(player, def.epStats, [], def.epReferenceStat, progress =>
		onProgress(progress.totalIterations ? Math.min(100, Math.floor((100 * progress.completedIterations) / progress.totalIterations)) : 0),
	);
}

interface RowState {
	status: string;
	state?: 'running' | 'failed';
	result?: StatWeightsResult;
	iterations?: number;
	durationMs?: number;
}

export const StatWeightsPage = () => {
	const [metric, setMetric] = useState(WeightsMetric.Dps);
	const [showAll, setShowAll] = useState(false);
	const [rows, setRows] = useState<Record<number, RowState | undefined>>({});
	const [running, setRunning] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const cancelRef = useRef(false);

	const patchRow = (spec: Spec, patch: RowState) => setRows(prev => ({ ...prev, [spec]: patch }));
	const stats = displayedStats(
		metric,
		showAll,
		rowDefs.map(def => def.epStats),
	);

	const runSpecs = async (targets: Array<SpecDefinition<any>>) => {
		if (running) return;
		if (!targets.length) {
			toastManager.add({ variant: 'info', body: 'Every spec already has weights. Use a spec’s own Run button to redo one.' });
			return;
		}
		cancelRef.current = false;
		setRunning(true);
		for (const def of targets) {
			if (cancelRef.current) break;
			const iterations = sim.getIterations();
			patchRow(def.spec, { status: 'starting', state: 'running' });
			const start = performance.now();
			try {
				const result = await runSpecStatWeights(def, percent => patchRow(def.spec, { status: `${percent}%`, state: 'running' }));
				// A cancel comes back as an error on the result rather than as a throw.
				if (result.error) {
					patchRow(def.spec, { status: '' });
					break;
				}
				const durationMs = performance.now() - start;
				patchRow(def.spec, { status: `${(durationMs / 1000).toFixed(1)}s`, result, iterations, durationMs });
			} catch (error) {
				console.error(error);
				patchRow(def.spec, { status: 'failed', state: 'failed' });
				toastManager.add({ variant: 'error', body: `${specName(def)}: ${error instanceof Error ? error.message : 'stat weights failed.'}` });
				break;
			}
		}
		setRunning(false);
		setCancelling(false);
	};

	const cancel = async () => {
		cancelRef.current = true;
		setCancelling(true);
		try {
			await sim.signalManager.abortType(RequestTypes.StatWeights);
		} catch (error) {
			console.error(error);
		}
	};

	const completed = rowDefs.filter(def => rows[def.spec]?.result);
	const measured = completed.filter(def => rows[def.spec]?.durationMs);
	const perSpec = measured.length ? measured.reduce((acc, def) => acc + rows[def.spec]!.durationMs!, 0) / measured.length / 1000 : 0;
	const referenceNames = [...new Set(rowDefs.map(def => translateStat(referenceStat(metric, def.epReferenceStat))))];
	const refName = translateStat(DTPS_REFERENCE_STAT);

	return (
		<ProductPage
			title="Stat weights by spec"
			subtitle="Which stats matter for which spec: every simulated spec, run on the defaults its own sim opens with, side by side.">
			<PageSection title="Which stats matter for which spec">
				<p className="m-0">
					Each row is one simulated spec, run on the gear, talents, consumables, buffs, debuffs and encounter its own sim starts you on, with its
					default rotation. Nothing is hand-tuned, and no spec is geared for the stats it is being asked about, so these weights describe that default
					build and nothing else. Re-run them on your own gear in the spec&apos;s sim before acting on them.
				</p>
				<p className="m-0">
					{metric === WeightsMetric.Dtps
						? `Values are EP normalised against ${refName}, which the sim fixes for damage taken rather than taking it from the spec: 1.00 avoids as much damage as one point of ${refName}, and higher is better even though damage taken is what is going down.`
						: `Values are EP normalised against each spec's own reference stat, named in the second column (${referenceNames.join(', ')}): 1.00 is one point of that stat, 2.00 is worth twice as much per point. Reading down a column compares how much each spec wants a stat relative to its own reference, not how much raw output it gets, because every row is divided by a different number.`}
				</p>
				<p className="m-0">
					Hit, crit, haste and the other secondary stats are ratings, as they are on gear, so a weight is per point of rating, not per percent. A
					weight is only as good as the sample behind it: at low iteration counts a small weight is mostly noise, so hover a value for its 90%
					confidence interval before reading anything into a difference of a few hundredths. Values smaller than their own confidence interval are
					greyed out, and each row&apos;s strongest stat is highlighted.
				</p>
				<p className="m-0">
					Forever pays hit and crit rating from gear into both the melee and the spell pool. A weight is measured by adding the one stat on its own,
					outside that rule, so the melee and spell columns show each rating separately and need not match.
				</p>
				<p className="m-0">
					Nothing runs until asked. A stat weights run is two sims per stat plus a baseline, so filling all {rowDefs.length} rows is several hundred
					sims.{' '}
					{measured.length
						? `At ${sim.getIterations()} iterations this browser is averaging ${perSpec.toFixed(1)}s per spec, putting all ${rowDefs.length} at roughly ${Math.max(1, Math.round((perSpec * rowDefs.length) / 60))} minutes. ${completed.length} of ${rowDefs.length} filled in so far.`
						: `Run a single spec first to see what this browser does before committing to all ${rowDefs.length}.`}
				</p>
				{missingNames.length > 0 && (
					<p className="m-0 opacity-75">
						{missingNames.join(', ')} {missingNames.length === 1 ? 'is a gear planner' : 'are gear planners'} with no simulation behind{' '}
						{missingNames.length === 1 ? 'it' : 'them'}, so {missingNames.length === 1 ? 'it is' : 'they are'} absent from the table, and healing
						weights (HPS) are not offered for the same reason. The resistances and weapon pseudo-stats a spec&apos;s own sim also weighs are left
						out here, since neither compares across specs.
					</p>
				)}
			</PageSection>
			<section className="flex flex-col gap-3 border border-surface-border bg-black/30 p-4">
				<h2 className="m-0 text-xl">Stat weights by spec</h2>
				<div className="flex flex-wrap items-end gap-4">
					<EnumPicker
						modObject={null}
						testId="stat-weights-metric"
						config={{
							id: 'stat-weights-metric',
							label: 'Metric',
							labelTooltip: 'Which metric the weights are measured against. One run produces all of them, so switching does not re-run anything.',
							values: [WeightsMetric.Dps, WeightsMetric.Tps, WeightsMetric.Dtps].map(value => ({ name: METRIC_LABELS[value], value })),
							value: metric,
							onChange: value => setMetric(value as WeightsMetric),
						}}
					/>
					<BooleanPicker
						modObject={null}
						config={{
							id: 'stat-weights-show-all',
							label: 'Show all stats',
							labelTooltip: 'Show every stat any spec asks to have weighed, including school damage and resistances.',
							value: showAll,
							onChange: setShowAll,
						}}
					/>
					<div className="w-40">
						<IterationsPicker sim={sim} />
					</div>
					<Button
						data-testid="stat-weights-run-all"
						disabled={cancelling}
						onClick={() => (running ? void cancel() : void runSpecs(rowDefs.filter(def => !rows[def.spec]?.result)))}
						{...tooltipAnchorProps(
							TOOLTIP_ID,
							'Runs every spec that has no result yet, one after another. Specs already filled in are left alone.',
						)}>
						{cancelling ? 'Cancelling' : running ? 'Cancel' : 'Run all specs'}
					</Button>
				</div>
				<div className="max-w-full overflow-x-auto">
					<table className="border-separate border-spacing-0 whitespace-nowrap" data-testid="stat-weights-table">
						<thead>
							<tr>
								<th className="sticky left-0 z-1 border-r border-b border-surface-border bg-background p-2 text-left font-normal">Spec</th>
								<th className="border-b border-surface-border p-2 text-left font-normal">Relative to</th>
								{stats.map(stat => (
									<th key={stat} className="border-b border-surface-border p-2 text-right font-normal">
										{translateStat(stat)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rowDefs.map(def => {
								const row = rows[def.spec];
								const values = row?.result && metricValues(row.result, metric);
								const cells = rowCells(stats, def.epStats, values, row?.iterations ?? 0);
								return (
									<tr key={def.spec} className="odd:bg-table-odd even:bg-table-even" data-testid="stat-weights-row" data-state={row?.state}>
										<th className="sticky left-0 z-1 border-r border-surface-border bg-inherit p-1 text-left font-normal whitespace-normal sm:p-2 sm:whitespace-nowrap">
											<Button
												size="sm"
												className="mb-1 block sm:mr-2 sm:mb-0 sm:inline-block"
												disabled={running}
												onClick={() => void runSpecs([def])}>
												Run
											</Button>
											<a
												className={`font-bold ${textClassNameForSpec(playerSpecOf(def))}`}
												href={playerSpecOf(def).simLink}
												target="_blank"
												rel="noreferrer">
												{specName(def)}
											</a>
											<span
												className="ml-2 inline-block min-w-12 text-xs opacity-75 in-data-[state=failed]:text-danger in-data-[state=running]:text-primary"
												data-testid="stat-weights-status">
												{row?.status}
											</span>
										</th>
										<td className="p-2 opacity-75">{translateStat(referenceStat(metric, def.epReferenceStat))}</td>
										{cells.map((cell, i) => {
											const stat = stats[i];
											if (cell.kind === 'not-weighed') {
												return (
													<td
														key={stat}
														className="p-2 text-right opacity-40"
														{...tooltipAnchorProps(
															TOOLTIP_ID,
															`The ${specName(def)} sim does not ask for this stat to be weighed.`,
														)}>
														—
													</td>
												);
											}
											if (cell.kind === 'empty') return <td key={stat} className="p-2" />;
											return (
												<td
													key={stat}
													className="p-2 text-right data-best:font-bold data-best:text-brand data-noise:opacity-50"
													data-best={cell.best || undefined}
													data-noise={cell.noise || undefined}
													{...tooltipAnchorProps(
														TOOLTIP_ID,
														`${translateStat(stat)}: ${cell.ep.toFixed(3)} ±${cell.conf90.toFixed(3)} at 90% confidence, over ${row?.iterations} iterations.`,
													)}>
													{formatEp(cell.ep)}
												</td>
											);
										})}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</section>
			<Tooltip id={TOOLTIP_ID} />
			<ToastArea manager={toastManager} />
		</ProductPage>
	);
};
