import i18n from '@i18n/config';
import { translatePseudoStat, translateStat } from '@i18n/localization';
import type { UnitStat } from '@sim/proto/stats';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps, type TooltipRefProps } from '@ui-kit/Tooltip';
import { useCallback, useId, useRef, useState } from 'react';

import { BonusStatsPicker } from './BonusStatsPicker';

export interface BonusStatsLinkProps {
	unitStat: UnitStat;
}

/** The name the bonus-stat picker is labelled with: the root stat where there is one, the pseudo stat otherwise. */
const bonusStatName = (unitStat: UnitStat): string =>
	unitStat.hasRootStat()
		? translateStat(unitStat.getRootStat())
		: unitStat.isPseudoStat()
			? translatePseudoStat(unitStat.getPseudoStat())
			: translateStat(unitStat.getStat());

export const BonusStatsLink = ({ unitStat }: BonusStatsLinkProps) => {
	const id = useId();
	const popover = useRef<TooltipRefProps>(null);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const label = `${i18n.t('sidebar.character_stats.bonus_prefix')} ${bonusStatName(unitStat)}`;
	const closePopover = useCallback(() => popover.current?.close(), []);

	return (
		<>
			<Button variant="unstyled" data-testid="add-bonus-stats" className="ml-2 text-white" aria-label={label} {...tooltipAnchorProps(`${id}-popover`)}>
				<Icon name="plus-minus" {...tooltipAnchorProps(`${id}-icon`)} />
			</Button>
			<Tooltip id={`${id}-icon`} content={label} hidden={popoverOpen} />
			<Tooltip
				ref={popover}
				id={`${id}-popover`}
				testId="bonus-stats-popover"
				className="[&_.ui-number-picker-input]:m-0 [&_.ui-number-picker-input]:w-32 [&_.ui-number-picker-input]:flex-1 [&_.ui-number-picker-root]:flex-col"
				align="start"
				place="right"
				openOnClick
				clickable
				onOpenChange={setPopoverOpen}
				content={<BonusStatsPicker unitStat={unitStat} label={label} onCommit={closePopover} />}
			/>
		</>
	);
};
