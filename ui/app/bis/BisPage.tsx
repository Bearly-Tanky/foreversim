import type { ItemRandomSuffix } from '@generated/proto/common';
import type { UIItem as Item } from '@generated/proto/ui';
import { translateSlotName } from '@i18n/localization';
import { LaunchStatus } from '@sim/constants/other';
import { PlayerSpecs } from '@sim/player/specs';
import { ActionId } from '@sim/proto/action_id';
import { Database } from '@sim/proto/database';
import { type Stats, UnitStat } from '@sim/proto/stats';
import { textClassNameForSpec } from '@sim/proto/utils';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { type LoadedSpec, loadSpecDefinitions, specLaunch } from '../dps_rankings/spec_definitions';
import { PageSection, ProductPage } from '../ProductPage';
import { itemLevel, type RankedItem, rankGear, type SlotRanking } from './gear';
import LAUNCH_ITEM_IDS from './launch_items.json';

// Forever's launch pool: the items of the launch-content database our Classic sim was built on
// (assets/db_inputs/forever_sim_db.json, ids only). The client's database also carries the raids
// Forever does not open at launch, with nothing on the row to tell them apart.
const launchItems = new Set<number>(LAUNCH_ITEM_IDS);

type ItemDb = { items: Array<Item>; randomSuffix: (id: number) => ItemRandomSuffix | undefined };

// 'warrior/dps' -> 'warrior-dps', the page's #hash for that spec.
const specSlug = ({ key }: LoadedSpec) => key.replace('/', '-');

const specName = ({ def }: LoadedSpec) => PlayerSpecs.getFullSpecName(PlayerSpecs.fromProto(def.spec));

// Rounding first keeps an item worth nothing but its unique penalty off the page as -0.0.
const formatEP = (ep: number): string => (Math.round(ep * 10) / 10).toFixed(1);

// The weights a spec ranks by, spelled out so a reader can see what produced the order.
const weightsSummary = (epWeights: Stats, spec: LoadedSpec): string => {
	const playerClass = PlayerSpecs.getPlayerClass(PlayerSpecs.fromProto(spec.def.spec)).classID;
	return UnitStat.getAll()
		.map(unitStat => ({ name: unitStat.getFullName(playerClass), weight: epWeights.getUnitStat(unitStat) || 0 }))
		.filter(({ name, weight }) => !!name && weight !== 0)
		.map(({ name, weight }) => `${name} ${weight.toFixed(2)}`)
		.join(' · ');
};

const Loading = ({ text }: { text: string }) => (
	<p className="m-0 flex items-center gap-2 opacity-75" data-testid="bis-loading">
		<i className="fa fa-spinner fa-spin" />
		{text}
	</p>
);

const ItemCell = ({ ranked, rank }: { ranked: RankedItem; rank: number }) => (
	<td className="py-1 pr-4">
		<div className="flex items-center gap-2">
			<img className="size-6 shrink-0 rounded-xs" src={`https://wow.zamimg.com/images/wow/icons/large/${ranked.item.icon}.jpg`} alt="" loading="lazy" />
			<a
				className={clsx('hover:underline', itemQualityClassName(ranked.item.quality))}
				href={ActionId.makeItemUrl(ranked.item.id)}
				target="_blank"
				rel="noreferrer">
				{ranked.item.name}
			</a>
			{rank > 1 && <span className="text-sm opacity-60">#{rank}</span>}
		</div>
	</td>
);

// One row for the slot's pick, plus a row per item it beat, shown on demand. The banding is passed
// in rather than done with nth-child, which would count the hidden rows and stripe by accident.
const SlotRows = ({ ranking, banded }: { ranking: SlotRanking; banded: boolean }) => {
	const [open, setOpen] = useState(false);
	const [best, ...runnersUp] = ranking.ranked;
	const rowClass = 'border-t border-surface-border data-banded:bg-white/5';

	return (
		<>
			<tr className={rowClass} data-banded={banded || undefined} data-testid="bis-slot">
				<th scope="row" className="py-1 pr-4 text-left font-normal whitespace-nowrap opacity-75">
					{translateSlotName(ranking.slot)}
				</th>
				{best ? (
					<ItemCell ranked={best} rank={1} />
				) : (
					<td className="py-1 pr-4 italic opacity-75">{ranking.note || 'Nothing in the item database fits this slot.'}</td>
				)}
				<td className="py-1 pr-4 text-right tabular-nums">{best ? itemLevel(best.item) : '—'}</td>
				<td className="py-1 text-right tabular-nums">
					<span className="inline-flex items-center gap-2">
						{best ? formatEP(best.ep) : '—'}
						{runnersUp.length > 0 && (
							<button
								type="button"
								className="px-1 opacity-75 hover:opacity-100"
								aria-expanded={open}
								title={`Show the ${runnersUp.length} items this beat`}
								onClick={() => setOpen(!open)}>
								<i className={clsx('fas', open ? 'fa-chevron-up' : 'fa-chevron-down')} />
							</button>
						)}
					</span>
				</td>
			</tr>
			{runnersUp.map((ranked, index) => (
				<tr key={ranked.item.id} className={rowClass} data-banded={banded || undefined} hidden={!open}>
					<th scope="row" />
					<ItemCell ranked={ranked} rank={index + 2} />
					<td className="py-1 pr-4 text-right tabular-nums">{itemLevel(ranked.item)}</td>
					<td className="py-1 text-right tabular-nums">{formatEP(ranked.ep)}</td>
				</tr>
			))}
		</>
	);
};

const SpecGearTable = ({ spec, db }: { spec: LoadedSpec; db: ItemDb }) => {
	const epWeights = spec.def.defaults.epWeights;
	const gear = useMemo(() => rankGear(PlayerSpecs.fromProto(spec.def.spec), epWeights, db.items, db.randomSuffix), [spec, epWeights, db]);

	return (
		<div className="flex flex-col gap-3" data-testid="bis-results">
			<div className="flex flex-wrap items-baseline gap-x-4">
				<h3 className={clsx('m-0 text-lg', textClassNameForSpec(PlayerSpecs.fromProto(spec.def.spec)))}>{specName(spec)}</h3>
				<p className="m-0 text-sm opacity-75">Best of the {gear.poolSize.toLocaleString()} items in the database this spec can wear.</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse">
					<thead>
						<tr className="text-sm opacity-75">
							<th scope="col" className="pr-4 pb-2 text-left font-semibold">
								Slot
							</th>
							<th scope="col" className="pr-4 pb-2 text-left font-semibold">
								Item
							</th>
							<th scope="col" className="pr-4 pb-2 text-right font-semibold">
								ilvl
							</th>
							<th scope="col" className="pb-2 text-right font-semibold">
								EP
							</th>
						</tr>
					</thead>
					<tbody>
						{gear.slots.map((ranking, index) => (
							<SlotRows key={`${spec.key}-${ranking.slot}`} ranking={ranking} banded={index % 2 === 1} />
						))}
					</tbody>
				</table>
			</div>
			<p className="m-0 text-sm">
				<span className="mr-2 font-semibold opacity-75">EP weights used</span>
				{weightsSummary(epWeights, spec)}
			</p>
		</div>
	);
};

const hasWeights = (spec: LoadedSpec) => UnitStat.getAll().some(unitStat => !!spec.def.defaults.epWeights.getUnitStat(unitStat));

const specFromHash = (specs: Array<LoadedSpec>) => specs.find(spec => specSlug(spec) === location.hash.slice(1));

export const BisPage = () => {
	const [specs, setSpecs] = useState<Array<LoadedSpec>>([]);
	const [db, setDb] = useState<ItemDb | null>(null);
	const [spec, setSpec] = useState<LoadedSpec | null>(null);
	const [error, setError] = useState('');

	useEffect(() => {
		loadSpecDefinitions()
			.then(loaded => {
				setSpecs(loaded);
				setSpec(specFromHash(loaded) ?? loaded[0]);
			})
			.catch(() => setError('The spec list could not be loaded. Reload the page and try again.'));
		Database.get()
			.then(database =>
				setDb({ items: database.getAllItems().filter(item => launchItems.has(item.id)), randomSuffix: id => database.getRandomSuffixById(id) }),
			)
			.catch(() => setError('The item database could not be loaded. Reload the page and try again.'));
	}, []);

	useEffect(() => {
		const onHash = () => {
			const fromHash = specFromHash(specs);
			if (fromHash) setSpec(fromHash);
		};
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, [specs]);

	const choose = (key: string) => {
		const chosen = specs.find(candidate => candidate.key === key);
		if (!chosen) return;
		setSpec(chosen);
		window.history.replaceState(null, '', `#${specSlug(chosen)}`);
	};

	const gearPlanners = specs
		.filter(candidate => specLaunch(candidate.def) === LaunchStatus.GearPlanner)
		.map(specName)
		.join(', ');

	const byClass = new Map<string, Array<LoadedSpec>>();
	specs.forEach(candidate => {
		const className = PlayerSpecs.getPlayerClass(PlayerSpecs.fromProto(candidate.def.spec)).friendlyName;
		byClass.set(className, (byClass.get(className) ?? []).concat(candidate));
	});

	return (
		<ProductPage title="Best in Slot" subtitle="The highest-EP item in every slot, for each spec the sim has a page for.">
			<PageSection title="Read this first">
				<p className="m-0">
					<strong>Where the EP weights come from.</strong> Every spec ships a set of default EP weights in its sim, and its gear picker sorts items by
					them. This page uses those same weights, so a pick here is the item that sits at the top of that spec&apos;s gear picker for that slot.{' '}
					<strong>The simulator does not run on this page.</strong> Nothing here is derived live: these weights were worked out for each spec and then
					written down, so treat them as a well-kept starting point rather than an answer computed for your character. For weights derived from the
					sim against your own gear, talents and encounter, open a spec&apos;s sim and press <em>Stat Weights</em>.
				</p>
				<p className="m-0">
					<strong>Which specs are here.</strong> Every spec with a page on this site.
					{gearPlanners && (
						<>
							{' '}
							<strong>{gearPlanners}</strong> are gear planners here, without a working sim; their weights are the ones their gear picker sorts
							by, not numbers any simulation has produced.
						</>
					)}
				</p>
				<p className="m-0">
					<strong>What the item pool is.</strong> Forever launch content only: Onyxia and Molten Core, alongside the dungeon, crafted, reputation and
					PvP gear available at launch. The site&apos;s item database also holds the raids Forever does not open at launch (it comes from the game
					client, which ships them); this page leaves those out, so nothing from Blackwing Lair, Zul&apos;Gurub, Ahn&apos;Qiraj or Naxxramas can
					appear.
				</p>
				<p className="m-0">
					<strong>What EP cannot see.</strong> An EP score reads an item&apos;s stat line and its weapon damage, and nothing else. Set bonuses, on-use
					and proc effects, weapon skill and weapon specialisation talents, resistance requirements and stat caps are all invisible to it. That is why
					the rankings favour raw stats, and why a dagger can out-rank a sword for a warrior here in a way it would not in a raid.
				</p>
			</PageSection>
			<PageSection title="Gear">
				<label className="flex items-center gap-3">
					<span className="font-semibold">Spec</span>
					<select
						className="rounded-xs border border-surface-border bg-black px-2 py-1 text-white"
						value={spec?.key ?? ''}
						onChange={event => choose(event.target.value)}
						data-testid="bis-spec-picker">
						{[...byClass.entries()].map(([className, classSpecs]) => (
							<optgroup key={className} label={className}>
								{classSpecs.map(candidate => (
									<option key={candidate.key} value={candidate.key}>
										{specName(candidate)}
									</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				{error ? (
					<p className="m-0 text-danger">{error}</p>
				) : !db ? (
					<Loading text="Loading the item database…" />
				) : !spec ? (
					<Loading text="Loading the specs…" />
				) : !hasWeights(spec) ? (
					<p className="m-0 text-brand" data-testid="bis-no-weights">
						{specName(spec)} has no default EP weights on this version of the site yet, so there is nothing to rank its gear by. The weights arrive
						with the spec&apos;s presets; until then this page would only be listing items in database order.
					</p>
				) : (
					<SpecGearTable key={spec.key} spec={spec} db={db} />
				)}
			</PageSection>
		</ProductPage>
	);
};
