import { browserEnv } from '@app/browser_env';
import { ErrorOutcomeType, type ProgressMetrics, SimType } from '@generated/proto/api';
import { LaunchStatus } from '@sim/constants/other';
import { PlayerSpecs } from '@sim/player/specs';
import { SimResult } from '@sim/proto/sim_result';
import { textClassNameForSpec } from '@sim/proto/utils';
import { Sim } from '@sim/sim';
import { allSpellSources } from '@sim/spells';
import { type Composition, EMPTY } from '@sim/spells/rests';
import { subscribeSimField } from '@sim/state/subscriptions';
import { formatToNumber, formatToPercent } from '@sim/utils/format';
import { Button } from '@ui-kit/Button';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { Spinner } from '@ui-kit/Spinner';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { PageSection, ProductPage, SITE_BASE } from '../ProductPage';
import { RestsCell } from '../RestsCell';
import { composition } from './confidence';
import { buildRaid, communityBuilds, type RaidSetup, type RankingBuild } from './raid';
import { type LoadedSpec, loadSpecDefinitions, specLaunch } from './spec_definitions';

type Ranking = { build: RankingBuild; dps: number; rests: Composition };
type Results = { rankings: Array<Ranking>; iterations: number; duration: number };

// A spec with a sim to run; below Alpha a spec is a gear planner with no simulation behind it.
const isSimulated = ({ def }: LoadedSpec) => specLaunch(def) >= LaunchStatus.Alpha;

const sources = allSpellSources().map(([, source]) => source);
const assumedCount = sources.filter(source => source.source === 'assumed' && !source.measured).length;
const unreviewedCount = sources.filter(source => source.source === 'unreviewed' && !source.measured).length;

const LINK = 'text-brand hover:underline';

const Provenance = () => (
	<PageSection title="These numbers are provisional">
		<p className="m-0">
			The numbers here come from the beta client&apos;s own data tables rather than from BlizzCon tooltips, read against Classic Era and diffed spell by
			spell, and a daily database update brings in each new client build and Blizzard&apos;s hotfixes. Talent values come from the client&apos;s rank
			curves, coefficients from the spell tables, and each rank is scaled to level 60 by the client&apos;s per-level points. {assumedCount} abilities
			still carry a number the client does not settle
			{unreviewedCount > 0 && ` and ${unreviewedCount} have not been classified`}; each is listed, with what would settle it, on the{' '}
			<a className={LINK} href={`${SITE_BASE}evidence/`}>
				evidence page
			</a>
			.
		</p>
		<p className="m-0">
			This is an unofficial fork, not the official Forever sim, and the table is a self-check: run every build under identical conditions and a build the
			sim is getting wrong stands out. That is what it has been for. It is how the feral cat was found stuck at 398 with eight gear slots empty, the
			enhancement shaman re-dropping one totem until it ran out of mana, and the retribution paladin carrying a Holy Strike invented at nearly three times
			its published damage. Each of those is now fixed and written up in the{' '}
			<a className={LINK} href={`${SITE_BASE}changelog/`}>
				changelog
			</a>
			.
		</p>
		<p className="m-0">
			There is a second limit under the first one, and the client does not lift it: rules that live on the server rather than in a table. Proc chances the
			client leaves unset are the clearest case. A few such numbers have been settled from the beta&apos;s public combat logs, but most of what is left
			belongs to abilities above the beta&apos;s level cap, which nobody can check yet.
		</p>
		<p className="m-0">
			So: do not pick a main off this table, and do not quote it as a Forever balance claim. It is a place to catch the sim getting something obviously
			wrong, and it is still that even now the client has settled most of the inputs - a rotation nobody has tuned and a rule the data does not carry will
			both show up here as a spec in the wrong place.
		</p>
	</PageSection>
);

const Notes = ({ specs, setup }: { specs: Array<LoadedSpec>; setup: RaidSetup }) => {
	const count = setup.builds.length;
	const specCount = new Set(setup.builds.map(build => build.def.spec)).size;
	const absent = specs
		.filter(spec => !isSimulated(spec))
		.map(({ def }) => PlayerSpecs.getFullSpecName(PlayerSpecs.fromProto(def.spec)))
		.join(', ');

	return (
		<PageSection title="What these numbers are, and are not">
			<ul className="m-0 flex flex-col gap-2 pl-5">
				<li>
					All {count} builds are simulated <strong>together, as one {count}-player raid</strong>: one run, one encounter, one set of buffs, so every
					number in this table comes from the same fight. Those {count} players span {specCount} specs. Running each build on its own would give
					numbers that cannot honestly be put side by side, because each spec&apos;s own defaults differ.
				</li>
				<li>
					Each player is a <strong>community talent build</strong> on its spec&apos;s defaults - the gear, consumes and rotation its own sim page
					opens with, with the build&apos;s talents in place of the default ones. Two builds of one spec therefore differ by talents alone; the
					defaults are shared, not per-build optimised gear or rotations, and some specs&apos; defaults are better tuned than others. On this version
					of the site a spec&apos;s default rotation is not always the Forever rotation its page offers as a preset.
				</li>
				<li>
					{absent ? (
						<>
							Absent, because there is nothing to simulate: <strong>{absent}</strong> are gear planners without a working sim yet. The raid is
							therefore missing its healers, and the tank specs that are present are measured on damage alone.
						</>
					) : (
						'Every spec has a build in the raid. The tank specs are measured on damage alone.'
					)}
				</li>
				<li>
					Every build wears its spec&apos;s <strong>Launch</strong> gear set: the best pre-raid gear in the launch item pool, picked by that
					spec&apos;s own stat weights, with raid drops left out. Same tier, chosen the same way, so the table compares specs and not gear.{' '}
					{setup.missingItemIds.length > 0 && (
						<strong>
							{setup.missingItemIds.length} of the items those sets name are not in this site&apos;s item database yet, so some builds are running
							with empty slots until the Forever item data lands.
						</strong>
					)}
				</li>
				<li>
					Raid buffs, party buffs and debuffs are the strongest of what each launched spec&apos;s own sim assumes by default, given to everyone alike,
					so nobody is missing a buff it expects. Blessings and the other personal buffs are each spec&apos;s own defaults; innervates and power
					infusions are off, because nobody in the raid is casting them. <strong>No world buffs</strong>: they do not work inside Forever raids.
				</li>
				<li>
					<strong>Rests on a guess</strong> is not a verdict on the build, it is what the build&apos;s damage is made of. Every action it performed,
					its pets&apos; included, is weighted by its share of that build&apos;s damage and looked up in the{' '}
					<a className={LINK} href={`${SITE_BASE}evidence/`}>
						evidence manifest
					</a>
					, which covers the talents, buffs, debuffs and item procs as well as the spells. The figure is everything neither settled from data, seen
					happen, nor a plain weapon swing - white damage is weapon damage times attack speed, which is the oldest arithmetic in the sim and has no
					manifest entry to have. Two builds a hundred DPS apart mean different things if one of them runs its rotation through three unconfirmed
					numbers and the other does not. It is deliberately a composition and not a score: collapsing the tiers into one figure would need weights
					nobody can defend.
				</li>
				<li>
					Every run is a fresh simulation in your browser at the iteration count below. Fewer iterations means a noisier comparison; raise it if two
					specs are close.
				</li>
			</ul>
		</PageSection>
	);
};

const RankingRow = ({ ranking, topDps }: { ranking: Ranking; topDps: number }) => {
	const playerSpec = PlayerSpecs.fromProto(ranking.build.def.spec);
	const share = (ranking.dps / topDps) * 100;
	const classText = textClassNameForSpec(playerSpec);
	return (
		<tr className="border-t border-surface-border" data-testid="ranking-row">
			<td className="py-1.5 pr-4">
				<div className="flex items-center gap-2">
					<img className="size-6 shrink-0 rounded-xs" src={playerSpec.getIcon('medium')} alt="" />
					<span className="flex flex-col leading-tight">
						<span className="text-sm opacity-75">{PlayerSpecs.getFullSpecName(playerSpec)}</span>
						<span className={classText}>{ranking.build.name}</span>
					</span>
				</div>
			</td>
			<td className="py-1.5 pr-4 text-right tabular-nums">{formatToNumber(ranking.dps, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</td>
			<td className="py-1.5 pr-4">
				<div className="flex items-center gap-2">
					<div className="h-3 w-32 overflow-hidden rounded-xs bg-white/5">
						<div className={`h-full bg-current ${classText}`} style={{ width: `${share}%` }} />
					</div>
					<span className="w-[6ch] text-right tabular-nums">{formatToPercent(share, { maximumFractionDigits: 1 })}</span>
				</div>
			</td>
			<td className="py-1.5">
				<RestsCell rests={ranking.rests} />
			</td>
		</tr>
	);
};

const ResultsTable = ({ results }: { results: Results }) => {
	const topDps = results.rankings[0]?.dps || 1;
	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse text-left" data-testid="rankings-table">
				<thead>
					<tr className="text-sm opacity-75">
						<th className="pr-4 pb-2 font-semibold">Build</th>
						<th className="pr-4 pb-2 text-right font-semibold">DPS</th>
						<th className="pr-4 pb-2 font-semibold">Share of top</th>
						<th className="pb-2 font-semibold">Rests on a guess</th>
					</tr>
				</thead>
				<tbody>
					{results.rankings.map(ranking => (
						<RankingRow key={ranking.build.key + ranking.build.name} ranking={ranking} topDps={topDps} />
					))}
				</tbody>
			</table>
		</div>
	);
};

export const DpsRankingsPage = () => {
	const [sim] = useState(() => new Sim({ type: SimType.SimTypeRaid, env: browserEnv }));
	const [specs, setSpecs] = useState<Array<LoadedSpec>>([]);
	const [setup, setSetup] = useState<RaidSetup | null>(null);
	const [status, setStatus] = useState('Loading sim...');
	const [progress, setProgress] = useState<ProgressMetrics | null>(null);
	const [results, setResults] = useState<Results | null>(null);
	const [running, setRunning] = useState(false);
	const runningRef = useRef(false);
	const setupRef = useRef<RaidSetup | null>(null);

	const run = async () => {
		const raid = setupRef.current;
		if (!raid || runningRef.current) return;
		runningRef.current = true;
		setRunning(true);
		setStatus('Simulating...');
		try {
			const result = await sim.runSim({ onProgress: setProgress });
			if (result instanceof SimResult) {
				setResults(rank(raid, result));
				setStatus('');
			} else if (result.type != ErrorOutcomeType.ErrorOutcomeAborted) {
				setStatus('The sim stopped before it finished. Try running it again.');
			}
		} catch (error) {
			console.error(error);
			setStatus(error instanceof Error ? error.message : 'Something went wrong running the sim. Reload the page and try again.');
		} finally {
			setProgress(null);
			runningRef.current = false;
			setRunning(false);
		}
	};

	const runOnLoad = useEffectEvent(() => void run());

	// The encounter's default target and every build's gear are looked up in the item database, so
	// there is no raid to assemble until that has loaded. Guarded so StrictMode's second mount does
	// not build a second raid into the same sim.
	useEffect(() => {
		if (setupRef.current) return;
		setupRef.current = { builds: [], missingItemIds: [] };
		void (async () => {
			const loaded = await loadSpecDefinitions();
			await sim.waitForInit();
			const raid = buildRaid(sim, communityBuilds(loaded.filter(isSimulated)));
			setupRef.current = raid;
			setSpecs(loaded);
			setSetup(raid);
			runOnLoad();
		})().catch(error => {
			console.error(error);
			setStatus('The sim could not be loaded. Reload the page and try again.');
		});
	}, [sim]);

	const total = progress?.totalIterations || sim.getIterations();

	return (
		<ProductPage
			title="Damage comparison"
			subtitle="Every community build of every launched spec in one raid, damage only. One run, one encounter, one set of buffs, so the numbers can sit in the same table. It is here to find bugs in this sim, not to say which spec is stronger in Forever.">
			<Provenance />
			{setup && <Notes specs={specs} setup={setup} />}
			<PageSection title="Results">
				<div className="flex flex-wrap items-end gap-4">
					<Button onClick={() => void run()} disabled={running || !setup} data-testid="rankings-run">
						Run again
					</Button>
					<NumberPicker
						modObject={sim}
						testId="rankings-iterations"
						config={{
							id: 'dps-rankings-iterations',
							label: 'Iterations',
							positive: true,
							storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'iterations'),
							getValue: (sim: Sim) => sim.getIterations(),
							setValue: (sim: Sim, newValue: number) => sim.setIterations(newValue),
						}}
					/>
					{results && (
						<span className="text-sm opacity-75">
							{formatToNumber(results.iterations)} iterations, {formatToNumber(results.duration)}s encounter
						</span>
					)}
				</div>
				{(status || progress) && (
					<div className="flex items-center gap-3" data-testid="rankings-status">
						{running && <Spinner size="sm" />}
						<span>
							{progress
								? progress.presimRunning
									? 'Presimulations running...'
									: `${formatToNumber(progress.completedIterations)} / ${formatToNumber(total)} iterations`
								: status}
						</span>
					</div>
				)}
				{results && <ResultsTable results={results} />}
			</PageSection>
		</ProductPage>
	);
};

// Builds of one spec share it, so each player is matched back by its raid slot, not its spec.
function rank(setup: RaidSetup, result: SimResult): Results {
	const rankings = setup.builds
		.map((build, index) => {
			const player = result.getPlayerWithRaidIndex(index);
			return { build, dps: player?.dps.avg || 0, rests: player ? composition(player) : { ...EMPTY } };
		})
		.sort((a, b) => b.dps - a.dps);
	return { rankings, iterations: result.iterations, duration: result.duration };
}
