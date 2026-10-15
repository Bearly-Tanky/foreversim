import { getEmptySlotIconUrl } from '@features/gear/model/empty_slot_icons';
import { ItemSlot } from '@generated/proto/common';
import { translateRace, translateSlotName } from '@i18n/localization';
import { usePlayer, useSim, useSpecPresets } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { getTalentTreePoints } from '@sim/proto/utils';
import { classTalentsConfig } from '@sim/talents/factory';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import { QUALITY_TEXT } from '@ui-kit/utils/colors';
import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { useInDesktopApp } from '../desktop_app';
import { Card, Field } from './Card';
import { gearPresetIndex, talentPresetIndex, talentSummary } from './character_model';
import { Select } from './controls';
import { GameImportDialog } from './GameImportDialog';
import { ItemPickerDialog } from './ItemPickerDialog';
import { TalentsDialog } from './TalentsDialog';

// The in-game character pane's order: armor down the left, accessories down the right, weapons along the bottom.
const LEFT_SLOTS = [
	ItemSlot.ItemSlotHead,
	ItemSlot.ItemSlotNeck,
	ItemSlot.ItemSlotShoulder,
	ItemSlot.ItemSlotBack,
	ItemSlot.ItemSlotChest,
	ItemSlot.ItemSlotWrist,
];
const RIGHT_SLOTS = [
	ItemSlot.ItemSlotHands,
	ItemSlot.ItemSlotWaist,
	ItemSlot.ItemSlotLegs,
	ItemSlot.ItemSlotFeet,
	ItemSlot.ItemSlotFinger1,
	ItemSlot.ItemSlotFinger2,
	ItemSlot.ItemSlotTrinket1,
	ItemSlot.ItemSlotTrinket2,
];
const WEAPON_SLOTS = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotRanged];

const CUSTOM = -1;

/** In the Forever Sim program: load the character the game's addon saved. */
const ImportFromGame = () => {
	const inApp = useInDesktopApp();
	const [open, setOpen] = useState(false);
	if (!inApp) return null;
	return (
		<>
			<Button size="sm" variant="outline-light" onClick={() => setOpen(true)} data-testid="simple-import-game">
				Import from the game
			</Button>
			<GameImportDialog open={open} onOpenChange={setOpen} />
		</>
	);
};

const RaceField = () => {
	const player = usePlayer();
	const race = usePlayerStore('race');
	const options = useMemo(() => player.getPlayerClass().races.map(value => ({ value, label: translateRace(value) })), [player]);
	return (
		<Field label="Race">
			<Select label="Race" value={race} options={options} onChange={value => player.setRace(value)} testId="simple-race" />
		</Field>
	);
};

const TalentsField = () => {
	const player = usePlayer();
	const presets = useSpecPresets().talents;
	const talentsString = usePlayerStore('talentsString');
	const [open, setOpen] = useState(false);
	const trees = classTalentsConfig[player.getClass()];
	const selected = talentPresetIndex(presets, talentsString);
	const options = [
		...presets.map((preset, index) => ({ value: index, label: preset.name })),
		...(selected === CUSTOM ? [{ value: CUSTOM, label: `Custom (${talentSummary(trees, getTalentTreePoints(talentsString))})` }] : []),
	];

	return (
		<Field label="Talents" hint={talentSummary(trees, getTalentTreePoints(talentsString))}>
			<div className="flex gap-2">
				<Select
					label="Talent build"
					value={selected}
					options={options}
					onChange={index => index !== CUSTOM && player.setTalentsString(presets[index].data.talentsString)}
					testId="simple-talent-preset"
				/>
				<Button variant="outline-light" className="shrink-0" onClick={() => setOpen(true)}>
					<Icon name="pencil-alt" className="mr-1.5" />
					Edit
				</Button>
			</div>
			<TalentsDialog open={open} onOpenChange={setOpen} />
		</Field>
	);
};

const GearPresetField = () => {
	const player = usePlayer();
	const sim = useSim();
	const presets = useSpecPresets().gear;
	const gear = usePlayerStore('gear');
	const selected = gearPresetIndex(presets, gear);
	const options = [
		...presets.map((preset, index) => ({ value: index, label: preset.name })),
		...(selected === CUSTOM ? [{ value: CUSTOM, label: 'Custom' }] : []),
	];

	return (
		<Select
			label="Gear set"
			value={selected}
			options={options}
			onChange={index => index !== CUSTOM && player.setGear(sim.db.lookupEquipmentSpec(presets[index].gear))}
			className="sm:w-56"
			testId="simple-gear-preset"
		/>
	);
};

const SlotButton = ({ slot, onOpen }: { slot: ItemSlot; onOpen: (slot: ItemSlot) => void }) => {
	const gear = usePlayerStore('gear');
	const equipped: EquippedItem | null = gear.getEquippedItem(slot);
	const actionId = useMemo(() => equipped?.asActionId(), [equipped]);
	const { iconUrl } = useActionId(actionId);
	const slotName = translateSlotName(slot);

	return (
		<button
			type="button"
			onClick={() => onOpen(slot)}
			className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent bg-black/30 p-2 text-left hover:border-surface-border hover:bg-surface-hover"
			aria-label={equipped ? `${slotName}: ${equipped.item.name}. Change` : `${slotName}: empty. Choose an item`}
			data-testid="simple-gear-slot">
			<img
				src={equipped ? iconUrl || getEmptySlotIconUrl(slot) : getEmptySlotIconUrl(slot)}
				alt=""
				className={clsx('size-11 shrink-0 rounded-md border border-surface-border', !equipped && 'opacity-50')}
			/>
			<span className="flex min-w-0 flex-col">
				<span className="text-xs tracking-wide text-gray-300 uppercase">{slotName}</span>
				{equipped ? (
					<>
						<span className={clsx('truncate font-bold', QUALITY_TEXT[equipped.item.quality])}>{equipped.item.name}</span>
						{equipped.enchant && <span className="truncate text-xs text-success">{equipped.enchant.name}</span>}
					</>
				) : (
					<span className="text-gray-300 italic">Empty</span>
				)}
			</span>
		</button>
	);
};

const GearSection = () => {
	const [pickerSlot, setPickerSlot] = useState<ItemSlot | null>(null);
	const slotButton = (slot: ItemSlot) => <SlotButton key={slot} slot={slot} onOpen={setPickerSlot} />;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="m-0 text-base font-bold">Gear</h3>
				<GearPresetField />
			</div>
			<div className="grid gap-2 md:grid-cols-2">
				<div className="flex flex-col gap-2">{LEFT_SLOTS.map(slotButton)}</div>
				<div className="flex flex-col gap-2">{RIGHT_SLOTS.map(slotButton)}</div>
			</div>
			<div className="grid gap-2 md:grid-cols-3">{WEAPON_SLOTS.map(slotButton)}</div>
			<ItemPickerDialog slot={pickerSlot} onClose={() => setPickerSlot(null)} />
		</div>
	);
};

export const CharacterCard = () => (
	<Card title="Your character" testId="simple-character" actions={<ImportFromGame />}>
		<div className="flex flex-col gap-5">
			<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
				<RaceField />
				<TalentsField />
			</div>
			<GearSection />
		</div>
	</Card>
);
