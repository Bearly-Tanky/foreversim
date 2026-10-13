import { clearMultiIconInputs } from '@features/settings/model/multi_icon';
import type { IconEnumPickerStatOption, MultiIconPickerStatOption, RenderableStatOptions } from '@features/settings/model/stat_options';
import { usePlayer, useSim } from '@sim/context/SimHostContext';
import { subscribeSimChange } from '@sim/state/subscriptions';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import { MultiIconPicker } from '@ui-kit/MultiIconPicker';

export interface StatOptionIconsProps {
	options: ReadonlyArray<RenderableStatOptions>;
}

const isMultiIcon = (option: RenderableStatOptions): option is MultiIconPickerStatOption => 'inputs' in option.config;
const isIconEnum = (option: RenderableStatOptions): option is IconEnumPickerStatOption => 'values' in option.config;

export const StatOptionIcons = ({ options }: StatOptionIconsProps) => {
	const player = usePlayer();
	const sim = useSim();
	const subscribe = subscribeSimChange(sim);

	return (
		<>
			{options.map((option, index) => {
				if (isMultiIcon(option)) {
					return (
						<MultiIconPicker
							key={index}
							modObject={player}
							config={option.config}
							subscribe={subscribe}
							onClear={() => clearMultiIconInputs(player, option.config)}
						/>
					);
				}
				if (isIconEnum(option)) {
					return <IconEnumPicker key={index} modObject={player} config={option.config} />;
				}
				return <IconPicker key={index} modObject={player} config={option.config} />;
			})}
		</>
	);
};
