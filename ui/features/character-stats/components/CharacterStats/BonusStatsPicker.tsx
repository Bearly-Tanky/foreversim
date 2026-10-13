import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { UnitStat } from '@sim/proto/stats';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';
import { useMemo } from 'react';

export interface BonusStatsPickerProps {
	unitStat: UnitStat;
	label: string;
	onCommit: () => void;
}

/**
 * TBC edits bonus stats on pseudo stats too — the speed multipliers have no root stat at all — so
 * the picker keys on the UnitStat rather than on a Stat.
 */
export const BonusStatsPicker = ({ unitStat, label, onCommit }: BonusStatsPickerProps) => {
	const player = usePlayer();

	const config = useMemo(
		(): NumberPickerConfig<Player<any>> => ({
			id: `character-bonus-stat-${unitStat.getKey()}`,
			label,
			extraClassNames: ['mb-0'],
			storeField: 'bonusStats',
			getValue: subject => {
				const bonusStats = subject.getBonusStats();
				return unitStat.hasRootStat() ? bonusStats.getStat(unitStat.getRootStat()) : bonusStats.getUnitStat(unitStat);
			},
			setValue: (subject, newValue) => {
				const bonusStats = subject.getBonusStats();
				subject.setBonusStats(
					unitStat.hasRootStat()
						? bonusStats.withStat(unitStat.getRootStat(), newValue)
						: unitStat.isPseudoStat()
							? bonusStats.withPseudoStat(unitStat.getPseudoStat(), newValue)
							: bonusStats.withStat(unitStat.getStat(), newValue),
				);
				onCommit();
			},
		}),
		[unitStat, label, onCommit],
	);

	return <NumberPicker modObject={player} config={config} />;
};
