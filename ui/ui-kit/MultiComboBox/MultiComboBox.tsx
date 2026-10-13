import { Combobox } from '@base-ui/react/combobox';
import { Chip } from '@ui-kit/Chip';
import type { EnumValueConfig } from '@ui-kit/EnumPicker/types';
import { useInput } from '@ui-kit/hooks/useInput';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import { Icon } from '@ui-kit/Icon';
import { PickerShell } from '@ui-kit/PickerShell';
import { useMemo, useRef } from 'react';

import type { MultiComboBoxConfig } from './types';

export interface MultiComboBoxProps<ModObject> {
	modObject: ModObject;
	config: MultiComboBoxConfig<ModObject>;
	className?: string;
	testId?: string;
}

// base-ui's multi-select combobox, with the picks as chips below the field.
export const MultiComboBox = <ModObject,>({ modObject, config, className, testId }: MultiComboBoxProps<ModObject>) => {
	const { value, setValue, hidden, disabled } = useInput(modObject, config);
	const portalContainer = usePortalContainer();
	const anchor = useRef<HTMLDivElement>(null);

	const selected = useMemo(() => config.values.filter(entry => (value ?? []).includes(entry.value)), [config.values, value]);

	return (
		<PickerShell config={config} className={className} hidden={hidden} disabled={disabled} testId={testId ?? 'multi-combo-box-root'}>
			<Combobox.Root
				multiple
				items={config.values}
				value={selected}
				onValueChange={(next: Array<EnumValueConfig>) => setValue(next.map(entry => entry.value))}
				itemToStringLabel={(entry: EnumValueConfig) => entry.name}
				isItemEqualToValue={(a: EnumValueConfig, b: EnumValueConfig) => a.value === b.value}
				disabled={disabled}>
				<Combobox.InputGroup ref={anchor} className="ui-multi-combo-box-field" data-testid="multi-combo-box-field">
					<Combobox.Input id={config.id} className="ui-multi-combo-box-input" placeholder={config.placeholder} data-testid="multi-combo-box-input" />
					<Combobox.Trigger className="ui-multi-combo-box-trigger" aria-label={config.openLabel} data-testid="multi-combo-box-trigger">
						<Icon name="chevron-down" />
					</Combobox.Trigger>
				</Combobox.InputGroup>
				<Combobox.Chips className="ui-multi-combo-box-chips" data-testid="multi-combo-box-chips">
					<Combobox.Value>
						{(picks: Array<EnumValueConfig>) =>
							picks.map(entry => (
								<Combobox.Chip
									key={entry.value}
									aria-label={entry.name}
									render={props => (
										<Chip
											label={entry.name}
											nameAs="span"
											rootProps={{ ...props }}
											confirmDelete={false}
											deleteLabel={config.removeLabel}
											onDelete={() => setValue((value ?? []).filter(picked => picked !== entry.value))}
											testId="multi-combo-box-chip"
										/>
									)}
								/>
							))
						}
					</Combobox.Value>
				</Combobox.Chips>
				<Combobox.Portal container={portalContainer ?? undefined}>
					<Combobox.Positioner className="ui-multi-combo-box-positioner" anchor={anchor} align="start" sideOffset={2}>
						<Combobox.Popup className="ui-multi-combo-box-popup">
							<Combobox.Empty className="ui-multi-combo-box-empty">{config.emptyText}</Combobox.Empty>
							<Combobox.List className="ui-multi-combo-box-list" data-testid="multi-combo-box-list">
								{(entry: EnumValueConfig) => (
									<Combobox.Item key={entry.value} value={entry} className="ui-multi-combo-box-item" title={entry.tooltip}>
										<span>{entry.name}</span>
										<Combobox.ItemIndicator className="ui-multi-combo-box-indicator">
											<Icon name="check" />
										</Combobox.ItemIndicator>
									</Combobox.Item>
								)}
							</Combobox.List>
						</Combobox.Popup>
					</Combobox.Positioner>
				</Combobox.Portal>
			</Combobox.Root>
		</PickerShell>
	);
};
