import { SelectorModalTabs } from '../types';

export type TabEligibility = {
	hasEnchants: boolean;
	socketCount: number | undefined;
};

export const resolveSelectedTab = (selectedTab: SelectorModalTabs, { hasEnchants, socketCount }: TabEligibility) => {
	if (
		(selectedTab === SelectorModalTabs.Enchants && !hasEnchants) ||
		([SelectorModalTabs.Gem1, SelectorModalTabs.Gem2, SelectorModalTabs.Gem3].includes(selectedTab) && socketCount === 0)
	) {
		return SelectorModalTabs.Items;
	}
	return selectedTab;
};
