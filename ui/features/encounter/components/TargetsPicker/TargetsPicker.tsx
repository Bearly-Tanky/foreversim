import { Target as TargetProto } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Encounter } from '@sim/raid/encounter';
import { subscribeEncounterField } from '@sim/state/subscriptions';
import type { ListPickerConfig } from '@ui-kit/ListPicker';
import { ListPicker } from '@ui-kit/ListPicker';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/utils';
import { TargetPicker } from './TargetPicker';

export interface TargetsPickerProps {
	encounter: Encounter;
}

export const TargetsPicker = ({ encounter }: TargetsPickerProps) => {
	const config = useMemo(
		(): ListPickerConfig<Encounter, TargetProto> => ({
			extraClassNames: ['mb-0'],
			itemLabel: i18n.t('settings_tab.encounter.target'),
			storeSubscribe: (subject: Encounter) => subscribeEncounterField(subject, 'targets'),
			getValue: (subject: Encounter) => subject.getTargets().slice(),
			setValue: (subject: Encounter, newValue: Array<TargetProto>) => {
				trackEvent({
					action: 'settings',
					category: 'encounter',
					label: newValue.length > subject.getTargets().length ? 'add-target' : 'remove-target',
				});
				subject.setTargets(newValue);
			},
			newItem: () => Encounter.defaultTargetProto(),
			copyItem: (oldItem: TargetProto) => TargetProto.clone(oldItem),
			minimumItems: 1,
		}),
		[],
	);

	return (
		<ListPicker<Encounter, TargetProto>
			modObject={encounter}
			config={config}
			renderItem={targetIndex => <TargetPicker encounter={encounter} targetIndex={targetIndex} />}
		/>
	);
};
