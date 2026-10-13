import { ItemRandomSuffix } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import { translateProtoStatName } from '@i18n/localization';
import { Phase } from '@sim/constants/other';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { EquippedItem } from '@sim/proto/equipped_item';

import { GearData, ItemData } from '../types';

export const itemsTabData = (gearData: GearData, items: Item[]): ItemData<Item, string>[] =>
	items.map(item => {
		const equippedItem = new EquippedItem({ item });
		return {
			item: item,
			id: item.id,
			actionId: equippedItem.asActionId(),
			ilvl: item.scalingOptions?.[0].ilvl || item.ilvl,
			name: item.name,
			searchText: item.name,
			quality: item.quality,
			nameDescription: item.nameDescription,
			// The db's item phases are Classic Era release phases (master's ClassicPhase). Everything in it
			// exists at Forever's launch, and master's picker shows it all by default, so it is all Launch.
			phase: Phase.Launch,
			ignoreEPFilter: false,
			onEquip: item => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(item));
				} else {
					gearData.equipItem(new EquippedItem({ item }));
				}
			},
		};
	});

const byEffectIdDescending = (itemA: Enchant, itemB: Enchant) => {
	if (itemA.effectId > itemB.effectId) return -1;
	if (itemA.effectId < itemB.effectId) return 1;
	return 0;
};

const enchantRow = (
	enchant: Enchant,
	equip: (equippedItem: EquippedItem, enchant: Enchant) => EquippedItem,
	gearData: GearData,
): ItemData<Enchant, string> => ({
	item: enchant,
	id: enchant.effectId,
	actionId: enchant.itemId ? ActionId.fromItemId(enchant.itemId) : ActionId.fromSpellId(enchant.spellId),
	name: enchant.name,
	searchText: enchant.name,
	quality: enchant.quality,
	phase: enchant.phase || 1,
	ignoreEPFilter: true,
	nameDescription: '',
	onEquip: enchant => {
		const equippedItem = gearData.getEquippedItem();
		if (equippedItem) gearData.equipItem(equip(equippedItem, enchant));
	},
});

export const enchantsTabData = (gearData: GearData, enchants: Enchant[]): ItemData<Enchant, string>[] =>
	enchants.sort(byEffectIdDescending).map(enchant => enchantRow(enchant, (equippedItem, value) => equippedItem.withEnchant(value), gearData));

export const gemsTabData = (gearData: GearData, gems: Gem[], socketIdx: number): ItemData<Gem, string>[] =>
	gems.map(gem => ({
		item: gem,
		id: gem.id,
		actionId: ActionId.fromItemId(gem.id),
		name: gem.name,
		searchText: gem.name,
		quality: gem.quality,
		phase: gem.phase,
		nameDescription: '',
		ignoreEPFilter: true,
		onEquip: gem => {
			const equippedItem = gearData.getEquippedItem();
			if (equippedItem) gearData.equipItem(equippedItem.withGem(gem, socketIdx));
		},
	}));

export const randomSuffixesTabData = (player: Player<any>, gearData: GearData, equippedItem: EquippedItem): ItemData<ItemRandomSuffix, string>[] => {
	const itemProto = equippedItem.item;
	return player.getRandomSuffixes(itemProto).map((randomSuffix: ItemRandomSuffix) => {
		const label = translateProtoStatName(randomSuffix.name);

		return {
			item: randomSuffix,
			id: randomSuffix.id,
			actionId: ActionId.fromRandomSuffix(itemProto, randomSuffix),
			name: label,
			searchText: label,
			quality: itemProto.quality,
			phase: Phase.Launch,
			nameDescription: '',
			ignoreEPFilter: true,
			onEquip: randomSuffix => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(equippedItem.item).withRandomSuffix(randomSuffix));
				}
			},
		};
	});
};
