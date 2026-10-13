// The build arena: every build the sim can be given, ranked, computed ahead of time.
//
// The live rankings page runs one preset per spec in your browser, which is the ceiling of
// what a browser can be asked for and a long way short of a leaderboard. So the builds run
// headless and this page renders what they produced, with no sim in the browser at all. The
// results file is the cache and the commit that produced it is the key.

import { IndividualSimSettings } from '@generated/proto/ui';
import { CURRENT_API_VERSION } from '@sim/constants/other';
import type { PlayerSpec } from '@sim/player/player_spec';
import { PlayerSpecs } from '@sim/player/specs';
import { textClassNameForSpec } from '@sim/proto/utils';
import { type Composition, unsettledShare } from '@sim/spells/rests';
import { classTalentsConfig } from '@sim/talents/factory';
import { formatToNumber, formatToPercent } from '@sim/utils/format';
import clsx from 'clsx';
import pako from 'pako';
import { type ReactNode, useMemo, useState } from 'react';

import { ProductPage, SITE_BASE, SITE_REPO_URL } from '../ProductPage';
import { RestsCell } from '../RestsCell';
import results from './results.json';

// Results are keyed by master's ui/ directory names, which is what the arena runner writes.
// The join to forever-next's specs happens here. Both priest builds are forever-next's one
// DPS priest spec, so the name is carried rather than derived.
const SPECS: Record<string, { spec: PlayerSpec<any>; name: string }> = {
	balance_druid: { spec: PlayerSpecs.BalanceDruid, name: 'Balance Druid' },
	feral_druid: { spec: PlayerSpecs.FeralCatDruid, name: 'Feral Druid' },
	feral_tank_druid: { spec: PlayerSpecs.FeralBearDruid, name: 'Feral Tank Druid' },
	elemental_shaman: { spec: PlayerSpecs.ElementalShaman, name: 'Elemental Shaman' },
	enhancement_shaman: { spec: PlayerSpecs.EnhancementShaman, name: 'Enhancement Shaman' },
	hunter: { spec: PlayerSpecs.Hunter, name: 'Hunter' },
	mage: { spec: PlayerSpecs.Mage, name: 'Mage' },
	protection_paladin: { spec: PlayerSpecs.ProtectionPaladin, name: 'Protection Paladin' },
	retribution_paladin: { spec: PlayerSpecs.RetributionPaladin, name: 'Retribution Paladin' },
	rogue: { spec: PlayerSpecs.Rogue, name: 'Rogue' },
	shadow_priest: { spec: PlayerSpecs.DpsPriest, name: 'Shadow Priest' },
	smite_priest: { spec: PlayerSpecs.DpsPriest, name: 'Smite Priest' },
	tank_warrior: { spec: PlayerSpecs.ProtectionWarrior, name: 'Protection Warrior' },
	warlock: { spec: PlayerSpecs.Warlock, name: 'Warlock' },
	warrior: { spec: PlayerSpecs.DpsWarrior, name: 'Warrior' },
};

type Build = {
	spec: string;
	build: string;
	talents: string;
	gear: string;
	rotation: string;
	consumables: string;
	dps: number;
	rests: Composition;
	ilvl: number;
	slots: number;
	optimised?: boolean;
	points?: number;
};

type Results = { sim?: string; commit: string; generated: string; iterations: number; host?: string; builds: Array<Build> };
const data = results as Results;
const byDps = [...data.builds].sort((a, b) => b.dps - a.dps);

// The arena runs every talent build on every gear set, but this page compares talents, and specs,
// so every row wears its spec's launch set: the best pre-raid gear from one shared item pool,
// built by the same rule for every spec (tools/launch_gear), all within a few item levels of
// each other. A spec with two (rogue daggers or swords, warrior dual wield or two-hander) lets
// each build take the better. Each talent build appears once, in its best rotation.
const isLaunchSet = (gear: string) => gear === 'launch' || gear.endsWith('_launch');
const builds = (() => {
	const seen = new Set<string>();
	return byDps.filter(build => {
		const talents = `${build.spec}|${build.talents}`;
		if (!isLaunchSet(build.gear) || seen.has(talents)) return false;
		seen.add(talents);
		return true;
	});
})();

// A sim link carrying only the talents (?i=t), so opening it keeps the visitor's own gear and settings.
export const talentLink = (spec: PlayerSpec<any>, talents: string) => {
	const settings = IndividualSimSettings.create({ apiVersion: CURRENT_API_VERSION, player: { talentsString: talents } });
	const bytes = pako.deflate(IndividualSimSettings.toBinary(settings));
	return `${spec.simLink}?i=t#${btoa(String.fromCharCode(...bytes))}`;
};

// The same talents on Wowhead's Forever calculator, which reads the same digits in the same order. The v2 is
// Wowhead's hash version: it bumps it when the trees change and silently drops links on the old one.
export const wowheadLink = (spec: PlayerSpec<any>, talents: string) =>
	`https://www.wowhead.com/forever/talent-calc/${PlayerSpecs.getPlayerClass(spec).friendlyName.toLowerCase()}/v2${talents}`;

// The tree a build puts most points in, which is what "a Fury build" means. A tie goes to the
// earlier tree.
const mainTree = (build: Build) => {
	const points = split(build.talents).split('/').map(Number);
	return points.indexOf(Math.max(...points));
};
const treeName = (build: Build) => {
	const spec = SPECS[build.spec]?.spec;
	return spec ? (classTalentsConfig[spec.classID as keyof typeof classTalentsConfig]?.[mainTree(build)]?.name ?? '') : '';
};

// The default view: each spec's best build in each of its trees, so the Arms, Fury and
// Protection answers all show rather than only whichever tree wins. from is best first, so the
// first row seen for a spec and tree is its best.
export const bestPerTree = (from: Array<Build>): Array<Build> => {
	const best = new Map<string, Build>();
	for (const build of from) {
		const at = `${build.spec}|${mainTree(build)}`;
		if (!best.has(at)) best.set(at, build);
	}
	return [...best.values()].sort((a, b) => b.dps - a.dps);
};

// What the talent search was worth on each searched row, against the best written build on the
// exact same gear set and rotation: across gear sets it would be part search, part item level.
const key = (build: Build) => `${build.spec}|${build.gear}|${build.rotation}`;
const gains = (() => {
	const written = new Map<string, number>();
	for (const build of data.builds.filter(b => !b.optimised)) written.set(key(build), Math.max(written.get(key(build)) ?? 0, build.dps));
	const out = new Map<string, number>();
	for (const searched of data.builds.filter(b => b.optimised)) {
		const base = written.get(key(searched));
		if (base) out.set(`${key(searched)}|${searched.talents}`, searched.dps / base - 1);
	}
	return out;
})();

// The x/y/z everyone reads a build as, straight off the talents string.
const split = (talents: string) => {
	const trees = talents.split('-');
	while (trees.length < 3) trees.push('');
	return trees
		.slice(0, 3)
		.map(tree => [...tree].reduce((total, char) => total + (parseInt(char) || 0), 0))
		.join('/');
};

// A searched build keeps the name of the build it started from; a point split in that name is
// no longer true of it, so it is dropped and the real split printed beside it.
const displayName = (build: Build) => (build.optimised ? build.build.replace(/\s*\d+\/\d+\/\d+/, '') : build.build);
const specName = (spec: string) => SPECS[spec]?.name ?? spec;
const consumablesName = (list: string) => (list || 'unknown consumables').replace('Arena-', '').replace('+class', ' + class imbues').toLowerCase();

// External sims whose published builds the arena runs. Their builds are named after them, so the
// first word says where a row came from; add a sim here and it gets its own flag and filter pill.
const EXTERNAL_SIMS = ['MythicSim'];
export const sourceOf = (build: Pick<Build, 'build'>) => EXTERNAL_SIMS.find(sim => build.build.startsWith(sim)) ?? '';
const ALL_SOURCES = EXTERNAL_SIMS.filter(sim => builds.some(b => sourceOf(b) === sim));

const ALL_SPECS = [...new Set(builds.map(b => b.spec))].sort((a, b) => specName(a).localeCompare(specName(b)));

const PILL = 'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-sm';
const SELECT = 'rounded-sm border border-white/18 bg-black px-2 py-1 text-sm text-gray-300';
const LINK = 'text-brand hover:underline';

// The few things worth knowing about a row before opening it. Everything else waits behind the tap.
export const flags = (build: Build) => {
	const guessed = build.rests ? unsettledShare(build.rests) : 0;
	return [
		!!sourceOf(build) && {
			label: sourceOf(build),
			title: `A build from ${sourceOf(build)}, run here as written or searched on from there.`,
			className: 'border-white/30 text-white/70',
		},
		build.rotation.endsWith('_lowrank') && {
			label: 'low ranks, unconfirmed',
			title: 'Casts lower spell ranks to save mana. Nobody has confirmed Forever allows that at level 60.',
			className: 'border-brand text-brand',
		},
		guessed >= 0.05 && {
			label: `${formatToPercent(guessed * 100, { maximumFractionDigits: 0 })} guessed`,
			title: "This much of the build's damage comes from abilities whose numbers are not confirmed yet.",
			className: 'border-transparent text-white/50',
		},
	].filter(flag => !!flag);
};

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
	<>
		<dt className="text-white/50">{label}</dt>
		<dd className="m-0 min-w-0">{children}</dd>
	</>
);

const Row = ({ build, rank }: { build: Build; rank: number }) => {
	const spec = SPECS[build.spec]?.spec;
	const color = spec ? textClassNameForSpec(spec) : 'text-white';
	const gain = gains.get(`${key(build)}|${build.talents}`);

	return (
		<li className="border-b border-surface-border" data-testid="arena-row">
			<details className="group">
				<summary className="flex cursor-pointer list-none items-center gap-3 px-2 py-2 hover:bg-white/3">
					<span className="w-[2ch] shrink-0 text-right text-sm text-white/40 tabular-nums">{rank}</span>
					{spec && <img className="size-8 shrink-0" src={spec.getIcon('medium')} alt="" />}
					<span className="flex min-w-0 flex-1 flex-col">
						<span className={clsx('truncate font-semibold', color)}>{specName(build.spec)}</span>
						<span className="text-sm text-white/60 tabular-nums">
							{treeName(build)} {split(build.talents)}
						</span>
						{flags(build).length > 0 && (
							<span className="mt-0.5 flex flex-wrap gap-1">
								{flags(build).map(flag => (
									<span key={flag.label} className={clsx('rounded-full border px-1.5 text-xs', flag.className)} title={flag.title}>
										{flag.label}
									</span>
								))}
							</span>
						)}
					</span>
					<span className="flex shrink-0 flex-col items-end">
						<span className="text-lg font-semibold tabular-nums">
							{formatToNumber(build.dps, { maximumFractionDigits: 0 })} <span className="text-xs font-normal text-white/50">DPS</span>
						</span>
						{spec && (
							<a
								className={clsx(LINK, 'text-sm')}
								href={wowheadLink(spec, build.talents)}
								target="_blank"
								rel="noreferrer"
								title="Open on Wowhead's Forever talent calculator"
								data-testid="arena-wowhead-link">
								Talents ↗
							</a>
						)}
					</span>
					<span className="shrink-0 text-white/40 transition-transform group-open:rotate-90" aria-hidden>
						›
					</span>
				</summary>
				<dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 py-3 text-sm sm:pl-17">
					<Detail label="Build">
						{displayName(build)}
						{build.optimised &&
							` - found by talent search${gain !== undefined ? `, ${formatToPercent(gain * 100, { maximumFractionDigits: 1, signDisplay: 'always' })} on the best written build` : ''}`}
					</Detail>
					<Detail label="Talents">
						<code className="break-all">{build.talents}</code>
						{!!build.points && <span className="text-danger"> ({build.points} of 51 points)</span>}
						{spec && (
							<>
								{' · '}
								<a className={LINK} href={talentLink(spec, build.talents)} target="_blank" rel="noreferrer" data-testid="arena-talents-link">
									open in the sim
								</a>{' '}
								<span className="text-white/50">(keeps your gear)</span>
							</>
						)}
					</Detail>
					<Detail label="Gear">
						{build.gear}, item level {build.ilvl ? build.ilvl.toFixed(1) : '?'}
						{!!build.slots && build.slots < 15 && <span className="text-danger"> ({build.slots} slots filled)</span>}
					</Detail>
					<Detail label="Rotation">
						{build.rotation || 'default'}
						{build.rotation.endsWith('_lowrank') && (
							<span className="block text-white/60">
								Drops to lower spell ranks to save mana. The sim scores them at full strength, as the level 20 beta does; nobody has confirmed
								level 60 does too.
							</span>
						)}
					</Detail>
					<Detail label="Consumables">{consumablesName(build.consumables)}</Detail>
					<Detail label="Guessed">
						<RestsCell rests={build.rests} />
						<span className="block text-white/60">of the damage rests on unconfirmed numbers</span>
					</Detail>
				</dl>
			</details>
		</li>
	);
};

const Leaderboard = () => {
	const [showAll, setShowAll] = useState(false);
	const [spec, setSpec] = useState('');
	// undefined is every source, '' is builds written for this sim, anything else is that external sim.
	const [source, setSource] = useState<string | undefined>();

	const shown = useMemo(() => {
		const kept = builds.filter(b => (!spec || b.spec === spec) && (source === undefined || sourceOf(b) === source));
		return showAll ? kept : bestPerTree(kept);
	}, [showAll, spec, source]);

	// Admit it when the rows are not wearing comparable gear. Three item levels is about a fifth of a tier.
	const levels = shown.map(b => b.ilvl).filter(ilvl => ilvl > 0);
	const low = Math.min(...levels);
	const high = Math.max(...levels);
	const wide = levels.length > 1 && high - low > 3;

	return (
		<div className="flex w-full max-w-modal-lg flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<select className={SELECT} value={spec} onChange={event => setSpec(event.target.value)} aria-label="Spec">
					<option value="">Every spec</option>
					{ALL_SPECS.map(s => (
						<option key={s} value={s}>
							{specName(s)}
						</option>
					))}
				</select>
				<button
					className={clsx(PILL, showAll ? 'border-brand bg-brand/15 text-white' : 'border-white/30 text-gray-300 hover:bg-white/5')}
					type="button"
					aria-pressed={showAll}
					onClick={() => setShowAll(!showAll)}>
					Show all builds
				</button>
				{ALL_SOURCES.length > 0 &&
					[{ label: 'Written here', value: '' }, ...ALL_SOURCES.map(sim => ({ label: sim, value: sim }))].map(pill => (
						<button
							key={pill.label}
							className={clsx(
								PILL,
								source === pill.value ? 'border-brand bg-brand/15 text-white' : 'border-white/30 text-gray-300 hover:bg-white/5',
							)}
							type="button"
							aria-pressed={source === pill.value}
							data-testid="arena-source-pill"
							onClick={() => setSource(source === pill.value ? undefined : pill.value)}>
							{pill.label}
						</button>
					))}
			</div>
			<p className="m-0 text-sm text-white/50" data-testid="arena-count">
				{showAll ? `All ${shown.length} builds` : `${shown.length} builds, best per tree`}
				{levels.length > 0 && (
					<span className={clsx(wide && 'text-brand')} data-wide={wide || undefined}>
						{' '}
						· item level {low.toFixed(0) === high.toFixed(0) ? low.toFixed(0) : `${low.toFixed(0)}-${high.toFixed(0)}`}
						{wide && ' (some gaps are gear)'}
					</span>
				)}
			</p>
			<ol className="m-0 list-none border-t border-surface-border p-0">
				{shown.map((build, index) => (
					<Row key={`${key(build)}|${build.talents}|${build.consumables}|${build.build}`} build={build} rank={index + 1} />
				))}
			</ol>
		</div>
	);
};

const SimSource = () => {
	const commit = data.commit ? data.commit.slice(0, 7) : 'unknown';
	const commitLink = data.commit ? (
		<a className="text-brand hover:underline" href={`${SITE_REPO_URL}/commit/${data.commit}`} target="_blank" rel="noreferrer">
			<code>{commit}</code>
		</a>
	) : (
		<code>{commit}</code>
	);
	return (
		<>
			Computed from sim {commitLink} on {data.generated.slice(0, 10)}
			{data.host ? `, on ${data.host}` : ''}.{' '}
			{data.sim === 'master' ? (
				<strong className="text-brand" data-testid="arena-sim">
					These are the old master sim&apos;s numbers (the Classic Era engine this site used to run), not the forever-next engine the rest of this
					site now runs on. They move to forever-next&apos;s once the arena is rerun on it.
				</strong>
			) : (
				<span data-testid="arena-sim">
					Produced by the {data.sim ?? 'forever-next'} sim.
					{builds.every(b => b.gear.startsWith('parity')) &&
						' Until the arena runner is ported to it, each row is one build per spec from the parity check (tools/parity): equal bonus stats and statless weapons, no gear set and no consumables beyond what a class grants itself, so the gear, bracket and search columns have nothing to show yet.'}
				</span>
			)}
		</>
	);
};

// The landing page's collapsed panel: the reading is all here, just not in the way.
const Panel = ({ summary, children }: { summary: string; children: ReactNode }) => (
	<details className="w-full max-w-modal-lg border border-surface-border bg-black/50 px-4 py-3">
		<summary className="cursor-pointer text-lg font-bold">{summary}</summary>
		<div className="flex flex-col gap-3 pt-3 text-white/80">{children}</div>
	</details>
);

export const ArenaPage = () => (
	<ProductPage
		title="The build arena"
		subtitle="The best DPS talent build for every spec, one per talent tree, all on the same standard of pre-raid gear. Tap a row for details.">
		<Leaderboard />

		<Panel summary="How these numbers are made">
			<p className="m-0">
				<SimSource />
			</p>
			<p className="m-0">
				{builds.length} talent builds across {new Set(builds.map(b => b.spec)).size} specs. Every one was simulated: a character is assembled, given a
				talent build, a gear set and a rotation, and run against the same target for {formatToNumber(data.iterations)} iterations. What comes out is the
				average damage per second of those runs. Nothing is estimated, interpolated or predicted, and nothing is simulated in your browser.
			</p>
			<p className="m-0">
				The gear sets and rotations are files in the repository, written by people. The talent builds are the community ones from each spec&apos;s own
				page, plus whatever a search found on top of them. All of it runs headless when the sim changes, and the site ships the results, which is why
				the list is instant.
			</p>
			<ul className="m-0 flex flex-col gap-2 pl-6 text-sm">
				<li>
					<strong>Every build meets the same conditions.</strong> One target, one encounter length, one buff set, one consumable list for its role.
					That is what makes two numbers comparable - the live <a href={`${SITE_BASE}dps_rankings/`}>rankings page</a> achieves the same thing by
					putting everyone in one raid, which stops being possible at this count.
				</li>
				<li>
					<strong>The consumables are the arena&apos;s, and they did not used to be.</strong> Every spec brought its own list from its own test file,
					and the gaps were not small ones: both paladins and the feral tank had their weapon imbue commented out entirely, while warrior, hunter,
					rogue and tank warrior carried Windfury. Stripping the warrior&apos;s imbues costs it 14.2% - so this table was reporting a 19.6% gap
					between warrior and retribution while handing one of them a weapon buff and the other a bare weapon. It is 2.3% now, and the difference was
					never about the specs. Each row&apos;s details say which list it drank.
				</li>
				<li>
					<strong>Three lists, not one.</strong> Elemental Sharpening Stone is +2% melee crit and -2% <em>ranged</em> crit, so a single list for all
					fifteen would equalise the shopping and quietly tax the only spec that shoots. Within a role the list is identical - the same shopping list,
					not the same benefit, which is why Mighty Rage Potion stays in the melee list even though only warriors and bears get its rage; everyone
					gets its Strength. Casters and the hunter get a raider&apos;s mana: Major Mana Potion, Demonic Rune and Mageblood. What a class grants
					itself is not a consumable and is left alone: an enhancement shaman keeps Windfury Weapon and a rogue keeps its poisons. Equalising those
					took 23.6% off the shaman, which is not a shaman measured fairly, it is a shaman disarmed.
				</li>
				<li>
					<strong>Every spec wears the same standard of gear.</strong> Each row uses its spec&apos;s launch set: the best pre-raid gear from one
					shared item pool (dungeons, crafting, quests and world drops, with every raid and world boss left out), picked by the same rule for every
					spec. They land within about three item levels of each other, and the line above the list says exactly how far apart the rows you are
					looking at are. The arena sims the spec&apos;s other gear sets too; they are not shown, because they would compare gear rather than specs.
				</li>
				<li>
					<strong>Guessed</strong> is what the build&apos;s damage is made of, not a verdict on it. Each ability is weighted by its share of that
					build&apos;s damage and looked up in the <a href={`${SITE_BASE}evidence/`}>evidence manifest</a>. A build ten DPS ahead means something
					different if a quarter of it is unconfirmed. A row shows the figure once it passes 5%; every row&apos;s details have the bar.
				</li>
				<li>
					<strong>Rotations tagged low ranks</strong> drop to cheaper spell ranks as mana runs down. The sim gives every rank full spell-power
					scaling, which is what beta players see at level 20; nobody has confirmed whether Forever penalises low ranks at level 60, and if it does
					those rows will overstate the spec. The spec&apos;s normal rotation is always ranked beside them.
				</li>
				<li>
					<strong>Gear and rotations come from what is already here</strong> - the sets and priority lists on each spec&apos;s page. Nothing invents a
					better rotation than the ones people have written down, so a spec with one rotation on file gets one rotation ranked. That is a gap in the
					data, not a finding about the spec.
				</li>
				<li>
					<strong>Talents are searched, because they cannot be enumerated.</strong> A warrior has <strong>89,776,730,783,606,094</strong> builds it
					could actually spend - counted from the trees, enforcing rank caps, row gates and the prerequisite arrows. Count only the all-or-nothing
					ones, every talent maxed or untouched, and a warrior still has 57,341,667 and a mage 1,261,940,421 - eighteen months and forty years at a
					second a build. So each spec&apos;s best known build is improved one point at a time instead: price every point that could come out, price
					every point that could go in, make the best trade, repeat until no single move helps. A row&apos;s details say when it came out of that, and
					by how much it beat the best written build.
				</li>
				<li>
					<strong>What that does and does not promise.</strong> It climbs from every distinct build the spec has on file rather than only its best
					one, because a climb goes to the nearest peak. Several starts agreeing is the cheapest evidence available that the peak is not merely nearby
					- it is still not proof that nothing higher exists. It also only knows what this sim models: a talent flagged as unimplemented is worth zero
					here, so the search will happily empty it, and that is a fact about the sim rather than advice. Every build it reaches is checked against
					rank caps, row gates and prerequisites first.
				</li>
				<li>
					<strong>MythicSim</strong> rows start from builds published by MythicSim rather than ones written for this sim.
				</li>
				<li>
					<strong>A build that does not spend 51 points says so.</strong> The mage Frost community build spends 49. It is left as written rather than
					quietly corrected - it is somebody else&apos;s build - but the searched row beside it shows what those two points are worth.
				</li>
				<li>
					Tank specs are measured on damage alone and healing specs are absent, because damage is the only axis this table has. A protection paladin
					at the bottom is not a bad tank - and a searched tank build is a tank build with the mitigation optimised out of it, so read those rows as
					what the spec can do to a target dummy and nothing else.
				</li>
			</ul>
		</Panel>

		<Panel summary="Where AI comes into it, and where it does not">
			<p className="m-0">
				<strong>Not into any number on this page.</strong> The damage figures come from a simulator - an open-source engine, forked and adjusted for
				Forever. It is ordinary code doing arithmetic on the client&apos;s own data tables. No language model produces, adjusts or estimates a DPS
				figure, and the talent search is a hill climb that measures builds rather than reasons about them.
			</p>
			<p className="m-0">
				<strong>Into the code, heavily.</strong> This sim&apos;s Forever changes, the talent search, this page and most of what surrounds them were
				written by an AI assistant working to one person&apos;s direction. That is worth saying plainly, because it is exactly the situation where
				confident-sounding output is cheap and being wrong is easy.
			</p>
			<p className="m-0">
				So the checking is the point rather than an afterthought. <a href={`${SITE_BASE}evidence/`}>Every ability the sim registers</a> records where
				its numbers came from, and a test refuses to let one be added without that. The <strong>guessed</strong> figure carries it through to here: it
				is how much of a build&apos;s damage depends on something nobody has confirmed.
			</p>
		</Panel>
	</ProductPage>
);
