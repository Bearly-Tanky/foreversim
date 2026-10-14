import { ItemSlot } from '@generated/proto/common';
import type { UIEnchant as Enchant, UIItem as Item } from '@generated/proto/ui';
import { translateSlotName, translateStat } from '@i18n/localization';
import { usePlayer, useSim, useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { ActionId } from '@sim/proto/action_id';
import { EquippedItem } from '@sim/proto/equipped_item';
import { subscribeSimField } from '@sim/state/subscriptions';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import { QUALITY_TEXT } from '@ui-kit/utils/colors';
import { VirtualList } from '@ui-kit/VirtualList';
import { WowheadIcon } from '@ui-kit/WowheadIcon';
import clsx from 'clsx';
import { useMemo, useRef, useState } from 'react';

import { Segmented } from './controls';
import { enchantSummary, isScoredSlot, itemSummary, matchesQuery } from './item_model';
import { METRIC_LABEL, primaryMetric } from './simple_model';

// Fewer fights than a full run: enough to rank a handful of items, quick enough to wait for.
const TEST_ITERATIONS = 3000;
const TEST_COUNT = 5;

const ROW_HEIGHT = 60;

const TestedDelta = ({ diff, unit }: { diff: number; unit: string }) => (
	<span
		className={clsx('rounded-full px-2 py-0.5 text-sm font-bold tabular-nums', diff >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger')}
		title="Simulated against what you wear now">
		{diff >= 0 ? '+' : '−'}
		{Math.abs(diff).toFixed(1)} {unit}
	</span>
);

const ScoreDelta = ({ delta, equipped }: { delta: number | null; equipped: boolean }) => {
	if (equipped) return <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary">Equipped</span>;
	if (delta === null) return null;
	if (Math.abs(delta) < 0.05) return <span className="text-sm text-gray-300 tabular-nums">±0</span>;
	return (
		<span className={clsx('text-sm font-bold tabular-nums', delta > 0 ? 'text-success' : 'text-danger')}>
			{delta > 0 ? '+' : '−'}
			{Math.abs(delta).toFixed(1)}
		</span>
	);
};

interface RowProps {
	actionId: ActionId;
	name: string;
	quality: number;
	summary: string;
	delta: number | null;
	equipped: boolean;
	onPick: () => void;
	/** The simulated change, once "Simulate top 5" has run; it replaces the score. */
	tested?: { diff: number; unit: string } | null;
}

const Row = ({ actionId, name, quality, summary, delta, equipped, onPick, tested }: RowProps) => {
	const { iconUrl, href } = useActionId(actionId);
	return (
		<div
			data-active={equipped ? '' : undefined}
			className="flex h-full items-center gap-3 rounded-lg px-2 hover:bg-surface-hover data-active:bg-primary/10"
			data-testid="simple-picker-row">
			<WowheadIcon
				actionId={actionId}
				iconUrl={iconUrl}
				href={href}
				target="_blank"
				className="size-10 shrink-0 rounded-md border border-surface-border"
			/>
			<button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Equip ${name}`}>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className={clsx('truncate font-bold', QUALITY_TEXT[quality as keyof typeof QUALITY_TEXT])}>{name}</span>
					<span className="truncate text-xs text-gray-300">{summary}</span>
				</span>
				{tested && !equipped ? <TestedDelta diff={tested.diff} unit={tested.unit} /> : <ScoreDelta delta={delta} equipped={equipped} />}
			</button>
		</div>
	);
};

type Tab = 'items' | 'enchants';

export interface ItemPickerDialogProps {
	slot: ItemSlot | null;
	onClose: () => void;
}

export const ItemPickerDialog = ({ slot, onClose }: ItemPickerDialogProps) => {
	const player = usePlayer();
	const sim = useSim();
	const config = useSpecConfig();
	const gear = usePlayerStore('gear');
	const epWeights = usePlayerStore('epWeights');
	const filters = useStoreSubscribe(subscribeSimField(sim, 'filters'), () => sim.getFilters());
	const [tab, setTab] = useState<Tab>('items');
	const [query, setQuery] = useState('');
	const [tested, setTested] = useState<Record<number, number>>({});
	const [testing, setTesting] = useState<{ done: number; total: number } | null>(null);
	const runToken = useRef(0);
	const scroller = useRef<HTMLDivElement>(null);
	const host = useSimHost();
	const metric = primaryMetric(player.getPlayerSpec());

	const equipped = slot !== null ? gear.getEquippedItem(slot) : null;
	const scored = slot !== null && isScoredSlot(slot);

	const items = useMemo(() => {
		if (slot === null) return [];
		const usable = player.filterItemData(player.getItems(slot), item => item, slot);
		const score = (item: Item) => player.computeItemEP(item, slot);
		const ilvl = (item: Item) => item.scalingOptions?.[0]?.ilvl || item.ilvl;
		return usable.filter(item => matchesQuery(item.name, query)).sort((a, b) => score(b) - score(a) || ilvl(b) - ilvl(a));
		// `epWeights` and `filters` change the scores and the usable list without changing `player`.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [player, slot, query, scored, epWeights, filters]);

	const enchants = useMemo(() => {
		if (slot === null || !equipped) return [];
		const usable = player.filterEnchantData(player.getEnchants(slot), enchant => enchant, slot, equipped);
		const score = (enchant: Enchant) => player.computeEnchantEP(enchant, equipped.item.weaponSpeed);
		return usable.filter(enchant => matchesQuery(enchant.name, query)).sort((a, b) => score(b) - score(a));
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [player, slot, equipped, query, epWeights, filters]);

	if (slot === null) return null;

	const equippedScore = equipped && scored ? player.computeItemEP(equipped.item, slot) : null;
	const equippedEnchantScore = equipped?.enchant ? player.computeEnchantEP(equipped.enchant, equipped.item.weaponSpeed) : 0;
	const canEnchant = !!equipped && player.getEnchants(slot).length > 0;
	const activeTab: Tab = canEnchant ? tab : 'items';
	const referenceStat = translateStat(config.epReferenceStat);

	const asEquipped = (item: Item): EquippedItem => {
		let next = equipped ? equipped.withItem(item) : new EquippedItem({ item });
		if (item.randomSuffixOptions.length) {
			const suffixes = player.getRandomSuffixes(item);
			const best = suffixes.reduce(
				(top, suffix) => (player.computeRandomSuffixEP(suffix) > player.computeRandomSuffixEP(top) ? suffix : top),
				suffixes[0],
			);
			if (best) next = next.withRandomSuffix(best);
		}
		return next;
	};

	const equip = (item: Item) => {
		player.equipItem(slot, asEquipped(item));
		close();
	};

	const close = () => {
		runToken.current++;
		setQuery('');
		setTab('items');
		setTested({});
		setTesting(null);
		onClose();
	};

	// Simulates the top few items against what is worn now, all on the same random fights so the
	// differences are the items' and not the dice's.
	const testTop = async () => {
		const token = ++runToken.current;
		const candidates = items.filter(item => item.id !== equipped?.item.id).slice(0, TEST_COUNT);
		const value = (outcome: Awaited<ReturnType<typeof host.runGearSim>>) =>
			Array.isArray(outcome) ? (outcome[1].raidMetrics?.parties[0]?.players[0]?.[metric]?.avg ?? null) : null;
		const savedSeed = sim.getFixedRngSeed();
		sim.setFixedRngSeed(1 + Math.floor(Math.random() * 1e9));
		setTesting({ done: 0, total: candidates.length + 1 });
		try {
			const baseline = value(await host.runGearSim(gear, () => {}, { iterations: TEST_ITERATIONS }));
			if (baseline === null || token !== runToken.current) return;
			for (const [index, item] of candidates.entries()) {
				setTesting({ done: index + 1, total: candidates.length + 1 });
				const result = value(await host.runGearSim(gear.withEquippedItem(slot, asEquipped(item)), () => {}, { iterations: TEST_ITERATIONS }));
				if (token !== runToken.current) return;
				if (result !== null) setTested(before => ({ ...before, [item.id]: result - baseline }));
			}
		} finally {
			sim.setFixedRngSeed(savedSeed);
			if (token === runToken.current) setTesting(null);
		}
	};

	const count = activeTab === 'items' ? items.length : enchants.length + 1;

	return (
		<Dialog
			open
			onOpenChange={open => !open && close()}
			size="lg"
			scrollContents
			title={translateSlotName(slot)}
			testId="simple-item-picker"
			footer={
				<div className="flex w-full items-center justify-between gap-2">
					{equipped ? (
						<Button
							variant="outline-light"
							onClick={() => {
								player.equipItem(slot, null);
								close();
							}}>
							Remove item
						</Button>
					) : (
						<span />
					)}
					<Button onClick={close}>Done</Button>
				</div>
			}>
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<label className="relative min-w-48 flex-1">
						<Icon name="magnifying-glass" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-300" />
						<input
							type="search"
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder={activeTab === 'items' ? 'Search items' : 'Search enchants'}
							aria-label="Search"
							autoFocus
							className="h-10 w-full rounded-lg border border-surface-border bg-black/40 pr-3 pl-9 text-white focus:border-primary focus:outline-none"
						/>
					</label>
					{activeTab === 'items' && !host.simDisabled && (
						<Button variant="outline-light" disabled={!!testing || items.length === 0} onClick={() => void testTop()} data-testid="simple-test-top">
							<Icon name={testing ? 'spinner' : 'play'} spin={!!testing} className="mr-1.5" />
							{testing ? `Simulating ${testing.done + 1} of ${testing.total}…` : `Simulate top ${TEST_COUNT}`}
						</Button>
					)}
					{canEnchant && (
						<Segmented
							label="Choose"
							value={activeTab}
							options={[
								{ value: 'items' as Tab, label: 'Item' },
								{ value: 'enchants' as Tab, label: 'Enchant' },
							]}
							onChange={setTab}
						/>
					)}
				</div>
				<p className="m-0 text-sm text-gray-300">
					{activeTab === 'enchants'
						? 'Best first. The number is how much better than your current enchant it is.'
						: scored
							? `Best for your character first. The number estimates how much better than what you wear it is, in points of ${referenceStat}. Simulate the top ${TEST_COUNT} for real ${METRIC_LABEL[metric].short} numbers.`
							: `Trinkets mostly work through effects a score cannot measure, so no score is shown. Simulate the top ${TEST_COUNT} to compare them.`}
				</p>
				<div ref={scroller} className="h-112 overflow-y-auto rounded-lg border border-surface-border bg-black/20 p-1" data-testid="simple-picker-list">
					{count === 0 ? (
						<p className="m-0 p-4 text-center text-gray-300">Nothing matches “{query}”.</p>
					) : (
						<VirtualList
							count={count}
							rowHeight={ROW_HEIGHT}
							getScrollElement={() => scroller.current}
							initialRect={{ width: 640, height: 392 }}
							renderRow={index => {
								if (activeTab === 'items') {
									const item = items[index];
									return (
										<Row
											actionId={ActionId.fromItem(item)}
											name={item.name}
											quality={item.quality}
											summary={itemSummary(item)}
											delta={
												equippedScore !== null
													? player.computeItemEP(item, slot) - equippedScore
													: scored
														? player.computeItemEP(item, slot)
														: null
											}
											equipped={equipped?.item.id === item.id}
											onPick={() => equip(item)}
											tested={item.id in tested ? { diff: tested[item.id], unit: METRIC_LABEL[metric].short } : null}
										/>
									);
								}
								if (index === 0) {
									return (
										<div className="flex h-full items-center gap-3 px-2">
											<span className="size-10 shrink-0" />
											<button
												type="button"
												className="flex flex-1 items-center justify-between text-left"
												onClick={() => {
													player.equipItem(slot, equipped!.withEnchant(null));
													close();
												}}>
												<span className="text-gray-300 italic">No enchant</span>
												<ScoreDelta delta={equipped?.enchant ? -equippedEnchantScore : null} equipped={!equipped?.enchant} />
											</button>
										</div>
									);
								}
								const enchant = enchants[index - 1];
								return (
									<Row
										actionId={enchant.itemId ? ActionId.fromItemId(enchant.itemId) : ActionId.fromSpellId(enchant.spellId)}
										name={enchant.name}
										quality={enchant.quality}
										summary={enchantSummary(enchant)}
										delta={player.computeEnchantEP(enchant, equipped!.item.weaponSpeed) - equippedEnchantScore}
										equipped={equipped?.enchant?.effectId === enchant.effectId}
										onPick={() => {
											player.equipItem(slot, equipped!.withEnchant(enchant));
											close();
										}}
									/>
								);
							}}
						/>
					)}
				</div>
			</div>
		</Dialog>
	);
};
