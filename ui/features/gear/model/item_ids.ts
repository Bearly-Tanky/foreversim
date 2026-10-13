import { ItemRandomSuffix } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';

import { ItemListType, SelectorModalTabs } from '../types';

export const getItemIdByItemType = (tab: SelectorModalTabs, item: ItemListType | null | undefined): number | null | undefined => {
	switch (tab) {
		case SelectorModalTabs.Enchants:
			return (item as Enchant)?.effectId;
		case SelectorModalTabs.Items:
		case SelectorModalTabs.Gem1:
		case SelectorModalTabs.Gem2:
		case SelectorModalTabs.Gem3:
		case SelectorModalTabs.RandomSuffixes:
			return (item as Item | Gem | ItemRandomSuffix)?.id;
		default:
			return null;
	}
};
