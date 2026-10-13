import { HandType, type ItemRandomSuffix, ItemSlot, ItemType, PseudoStat, WeaponType } from '@generated/proto/common';
import type { UIItem as Item } from '@generated/proto/ui';
import type { PlayerSpec } from '@sim/player/player_spec';
import { PlayerSpecs } from '@sim/player/specs';
import { EquippedItem } from '@sim/proto/equipped_item';
import type { Stats } from '@sim/proto/stats';

// How many items each slot keeps, so a reader can see what the pick beat.
const RANKED_PER_SLOT = 5;

export interface RankedItem {
	item: Item;
	ep: number;
}

export interface SlotRanking {
	slot: ItemSlot;
	// Best first, empty when the pool holds nothing the spec can wear here.
	ranked: Array<RankedItem>;
	// Set when the slot needs explaining, e.g. an off hand given up to a two hander.
	note?: string;
}

// The armour slots: the only ones where an item's armour type decides who may wear it.
const armorSlotTypes = [
	ItemType.ItemTypeHead,
	ItemType.ItemTypeShoulder,
	ItemType.ItemTypeChest,
	ItemType.ItemTypeWrist,
	ItemType.ItemTypeHands,
	ItemType.ItemTypeWaist,
	ItemType.ItemTypeLegs,
	ItemType.ItemTypeFeet,
];

const offHandOnlyWeaponTypes = [WeaponType.WeaponTypeShield, WeaponType.WeaponTypeOffHand];

const slotItemTypes: Partial<Record<ItemSlot, ItemType>> = {
	[ItemSlot.ItemSlotHead]: ItemType.ItemTypeHead,
	[ItemSlot.ItemSlotNeck]: ItemType.ItemTypeNeck,
	[ItemSlot.ItemSlotShoulder]: ItemType.ItemTypeShoulder,
	[ItemSlot.ItemSlotBack]: ItemType.ItemTypeBack,
	[ItemSlot.ItemSlotChest]: ItemType.ItemTypeChest,
	[ItemSlot.ItemSlotWrist]: ItemType.ItemTypeWrist,
	[ItemSlot.ItemSlotHands]: ItemType.ItemTypeHands,
	[ItemSlot.ItemSlotWaist]: ItemType.ItemTypeWaist,
	[ItemSlot.ItemSlotLegs]: ItemType.ItemTypeLegs,
	[ItemSlot.ItemSlotFeet]: ItemType.ItemTypeFeet,
};

// The item level the database lists first; items carry it on their base scaling entry.
export const itemLevel = (item: Item): number => item.scalingOptions[0]?.ilvl ?? item.ilvl;

// Follows canEquipItem() in @sim/proto/items, with two deliberate differences.
//
// An armour slot takes only the class's own best armour type rather than anything up to it. A
// warrior can physically wear cloth, but no warrior raids in cloth, and EP weights that say
// nothing about armour would happily rank a cloth piece over a plate one.
//
// Dual wield is passed in rather than read off the spec, because it is decided by what the spec's
// EP weights pay for (see specDualWields).
export function canSpecUseItem(playerSpec: PlayerSpec<any>, item: Item, slot: ItemSlot, dualWields: boolean): boolean {
	const playerClass = PlayerSpecs.getPlayerClass(playerSpec);
	if (item.classAllowlist.length > 0 && !item.classAllowlist.includes(playerClass.classID)) {
		return false;
	}

	if (item.type === ItemType.ItemTypeWeapon) {
		const eligible = playerClass.weaponTypes.find(wt => wt.weaponType === item.weaponType);
		if (!eligible) return false;
		if (slot === ItemSlot.ItemSlotMainHand) {
			if (item.handType === HandType.HandTypeOffHand || offHandOnlyWeaponTypes.includes(item.weaponType)) return false;
			return item.handType !== HandType.HandTypeTwoHand || !!eligible.canUseTwoHand;
		}
		if (slot === ItemSlot.ItemSlotOffHand) {
			if (item.handType === HandType.HandTypeTwoHand || item.handType === HandType.HandTypeMainHand) return false;
			return dualWields || offHandOnlyWeaponTypes.includes(item.weaponType);
		}
		return false;
	}

	if (item.type === ItemType.ItemTypeRanged) {
		return slot === ItemSlot.ItemSlotRanged && playerClass.rangedWeaponTypes.includes(item.rangedWeaponType);
	}

	if (armorSlotTypes.includes(item.type)) {
		return item.armorType === Math.max(...playerClass.armorTypes) || !item.armorType;
	}

	return true;
}

// Mirrors Player.computeItemEP, so a pick here is the item the gear picker's EP column would put
// at the top of that slot: the item's stats and weapon damage through EquippedItem, a random
// suffix scored at its best roll, and a unique item a hair below an equal non-unique one. Gem
// sockets are left out; Forever has no gems.
export function computeItemEP(item: Item, epWeights: Stats, slot: ItemSlot, randomSuffix: (id: number) => ItemRandomSuffix | undefined): number {
	const suffixes = item.randomSuffixOptions.map(randomSuffix).filter(suffix => !!suffix);
	const eps = (suffixes.length ? suffixes : [null]).map(suffix =>
		new EquippedItem({ item, randomSuffix: suffix }).withDynamicStats().calcStats(slot).computeEP(epWeights),
	);
	return Math.max(...eps) - (item.unique ? 0.01 : 0);
}

// A spec dual wields if its own EP weights pay for an off hand's weapon damage. The weights are
// the sim's answer to "what is this spec holding", so they are asked rather than told.
export const specDualWields = (epWeights: Stats): boolean => (epWeights.getPseudoStat(PseudoStat.PseudoStatOffHandDps) || 0) > 0;

// Every slot a character fills, in the order the gear tab lists them.
export const bisSlots: Array<ItemSlot> = [
	ItemSlot.ItemSlotHead,
	ItemSlot.ItemSlotNeck,
	ItemSlot.ItemSlotShoulder,
	ItemSlot.ItemSlotBack,
	ItemSlot.ItemSlotChest,
	ItemSlot.ItemSlotWrist,
	ItemSlot.ItemSlotHands,
	ItemSlot.ItemSlotWaist,
	ItemSlot.ItemSlotLegs,
	ItemSlot.ItemSlotFeet,
	ItemSlot.ItemSlotFinger1,
	ItemSlot.ItemSlotFinger2,
	ItemSlot.ItemSlotTrinket1,
	ItemSlot.ItemSlotTrinket2,
	ItemSlot.ItemSlotMainHand,
	ItemSlot.ItemSlotOffHand,
	ItemSlot.ItemSlotRanged,
];

export interface SpecGear {
	slots: Array<SlotRanking>;
	// How many of the database's items this spec could wear anywhere, for the page to show that a
	// ranking came out of a real pool rather than a handful of leftovers.
	poolSize: number;
}

// Picks the highest-EP item for every slot out of the items the spec can wear.
//
// The two paired slots take the two best items of different names, because the rings and
// trinkets worth wearing are unique-equipped. The hands are decided together: a two hander is
// worth taking only if it beats a one hander and whatever the off hand would have held.
export function rankGear(
	playerSpec: PlayerSpec<any>,
	epWeights: Stats,
	items: Array<Item>,
	randomSuffix: (id: number) => ItemRandomSuffix | undefined,
): SpecGear {
	// A tank holds a shield, so its off hand is never a second weapon.
	const dualWields = specDualWields(epWeights) && !playerSpec.isTankSpec;

	const rankFor = (slot: ItemSlot, pool: Array<Item>): Array<RankedItem> =>
		pool
			.filter(item => canSpecUseItem(playerSpec, item, slot, dualWields))
			.map(item => ({ item, ep: computeItemEP(item, epWeights, slot, randomSuffix) }))
			.sort((a, b) => b.ep - a.ep);

	// Two rings or trinkets of the same name cannot both be worn.
	const distinctNames = (ranked: Array<RankedItem>): Array<RankedItem> => {
		const seen = new Set<string>();
		return ranked.filter(({ item }) => !seen.has(item.name) && !!seen.add(item.name));
	};

	const ofType = (itemType: ItemType) => items.filter(item => item.type === itemType);
	const slots: Partial<Record<ItemSlot, SlotRanking>> = {};

	for (const [slot, itemType] of Object.entries(slotItemTypes)) {
		const itemSlot = Number(slot) as ItemSlot;
		slots[itemSlot] = { slot: itemSlot, ranked: rankFor(itemSlot, ofType(itemType)) };
	}

	for (const [first, second, itemType] of [
		[ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2, ItemType.ItemTypeFinger],
		[ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemType.ItemTypeTrinket],
	] as Array<[ItemSlot, ItemSlot, ItemType]>) {
		const ranked = distinctNames(rankFor(first, ofType(itemType)));
		slots[first] = { slot: first, ranked };
		slots[second] = { slot: second, ranked: ranked.slice(1) };
	}

	slots[ItemSlot.ItemSlotRanged] = { slot: ItemSlot.ItemSlotRanged, ranked: rankFor(ItemSlot.ItemSlotRanged, ofType(ItemType.ItemTypeRanged)) };

	const weapons = ofType(ItemType.ItemTypeWeapon);
	const mainHand = rankFor(ItemSlot.ItemSlotMainHand, weapons);
	const twoHanders = mainHand.filter(({ item }) => item.handType === HandType.HandTypeTwoHand);
	const oneHanders = mainHand.filter(({ item }) => item.handType !== HandType.HandTypeTwoHand);
	const offHand = rankFor(ItemSlot.ItemSlotOffHand, weapons).filter(({ item }) => item.name !== oneHanders[0]?.item.name);

	const twoHandEP = twoHanders[0]?.ep ?? -Infinity;
	const oneHandEP = oneHanders.length ? oneHanders[0].ep + (offHand[0]?.ep ?? 0) : -Infinity;
	if (twoHanders.length && twoHandEP > oneHandEP) {
		slots[ItemSlot.ItemSlotMainHand] = { slot: ItemSlot.ItemSlotMainHand, ranked: twoHanders };
		slots[ItemSlot.ItemSlotOffHand] = {
			slot: ItemSlot.ItemSlotOffHand,
			ranked: [],
			note: oneHanders.length
				? `Given up to a two hander, worth ${(twoHandEP - oneHandEP).toFixed(1)} EP more than the best one hander and off hand together.`
				: 'Given up to a two hander: this spec has no one handed weapon it can use.',
		};
	} else {
		slots[ItemSlot.ItemSlotMainHand] = { slot: ItemSlot.ItemSlotMainHand, ranked: oneHanders };
		slots[ItemSlot.ItemSlotOffHand] = { slot: ItemSlot.ItemSlotOffHand, ranked: offHand };
	}

	return {
		slots: bisSlots.map(slot => ({ ...slots[slot]!, ranked: slots[slot]!.ranked.slice(0, RANKED_PER_SLOT) })),
		poolSize: items.filter(item => bisSlots.some(slot => canSpecUseItem(playerSpec, item, slot, dualWields))).length,
	};
}
