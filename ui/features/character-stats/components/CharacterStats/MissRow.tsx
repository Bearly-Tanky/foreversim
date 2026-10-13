import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { Button } from '@ui-kit/Button';
import { Skeleton } from '@ui-kit/Skeleton';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { TooltipRow } from './TooltipRow';

export type MissInfo = ReturnType<Player<any>['getMissChanceInfo']>;

/** Tank-only: the target's chance to miss, broken down into base, defense skill and debuffs. */
export const MissRow = ({ info, pending }: { info: MissInfo; pending?: boolean }) => {
	const id = useId();
	return (
		<tr data-testid="character-stats-table-row" className="ui-character-stats-row">
			<td className="ui-character-stats-label">{i18n.t('sidebar.character_stats.tank_caps.miss_label')}</td>
			<td className="ui-character-stats-value">
				{pending ? (
					<Skeleton />
				) : (
					<>
						<div className="ui-stat-value-link-container">
							<Button variant="unstyled" data-testid="stat-value-link" className="text-white" {...tooltipAnchorProps(id)}>
								{`${info.total.toFixed(2)}%`}
							</Button>
						</div>
						<Tooltip
							id={id}
							content={
								<div>
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.base')} value={`${info.base.toFixed(2)}%`} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tank_caps.defense')} value={`${info.defense.toFixed(2)}%`} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.debuffs')} value={`${info.debuffs.toFixed(2)}%`} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.total')} value={`${info.total.toFixed(2)}%`} />
								</div>
							}
						/>
					</>
				)}
			</td>
		</tr>
	);
};
