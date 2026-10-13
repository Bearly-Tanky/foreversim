import { GearPicker } from '@features/gear/components/GearPicker';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { GemSummary } from '@features/gear/components/SummaryTable';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { useSimReady } from '@sim/hooks/useSimReady';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';

import { GearPresets } from '../GearPresets';

export const GearTabBody = () => {
	const ready = useSimReady();
	const selector = useSelectorModalState();

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<TabPanelColumns.Left variant="auto-columns">
				<GearPicker ready={ready} />
				<div className="grid grid-flow-row grid-cols-2 gap-section max-md:grid-cols-1">
					<GemSummary />
				</div>
			</TabPanelColumns.Left>
			<TabPanelColumns.Right>
				<GearPresets />
			</TabPanelColumns.Right>
			<SelectorModal state={selector} />
		</OpenSelectorModalContext>
	);
};
