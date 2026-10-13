import { Class, PseudoStat, RangedWeaponType } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { StatAttribution, Stats, UnitStat } from '@sim/proto/stats';
import { Button } from '@ui-kit/Button';
import { Skeleton } from '@ui-kit/Skeleton';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { BonusStatsLink } from './BonusStatsLink';
import { TooltipRow } from './TooltipRow';
import type { DisplayStat } from './utils/rows';
import { bonusStatClass } from './utils/stat_display';

/** The weapons whose speed the effective-weapon-speed tooltip row is meaningful for. */
const HUNTER_RANGED_TYPES = [RangedWeaponType.RangedWeaponTypeBow, RangedWeaponType.RangedWeaponTypeCrossbow, RangedWeaponType.RangedWeaponTypeGun];

export type ShowStat = (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean, includeGear?: boolean) => string;

export interface StatRowProps {
	displayStat: DisplayStat;
	bonusStats: Stats;
	attribution: StatAttribution;
	show: ShowStat;
	rangedWeapon: EquippedItem | null;
	pending?: boolean;
}

export const StatRow = ({ displayStat, bonusStats, attribution, show, rangedWeapon, pending }: StatRowProps) => {
	const player = usePlayer();
	const id = useId();
	const { stat: unitStat, notEditable } = displayStat;
	const bonusStatValue = unitStat.hasRootStat()
		? bonusStats.getStat(unitStat.getRootStat())
		: unitStat.isPseudoStat()
			? bonusStats.getPseudoStat(unitStat.getPseudoStat())
			: 0;
	const contextualClass = bonusStatClass(bonusStatValue);

	const showEffectiveWeaponSpeed =
		player.getClass() === Class.ClassHunter &&
		unitStat.equalsPseudoStat(PseudoStat.PseudoStatRangedHastePercent) &&
		!!rangedWeapon &&
		HUNTER_RANGED_TYPES.includes(rangedWeapon.item.rangedWeaponType);

	return (
		<tr data-testid="character-stats-table-row" className="ui-character-stats-row">
			<td className="ui-character-stats-label">{unitStat.getShortName(player.getClass())}</td>
			<td className="ui-character-stats-value">
				{pending ? (
					<Skeleton />
				) : (
					<>
						<div className="ui-stat-value-link-container">
							<Button variant="unstyled" data-testid="stat-value-link" className={contextualClass} {...tooltipAnchorProps(id)}>
								{`${show(attribution.final, unitStat, true, true)} `}
							</Button>
						</div>
						{!notEditable && <BonusStatsLink unitStat={unitStat} />}
						<Tooltip
							id={id}
							content={
								<div>
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.base')} value={show(attribution.base, unitStat, true)} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.gear')} value={show(attribution.gear, unitStat, false, true)} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.talents')} value={show(attribution.talents, unitStat)} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.buffs')} value={show(attribution.buffs, unitStat)} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.consumes')} value={show(attribution.consumes, unitStat)} />
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.debuffs')} value={show(attribution.debuffs, unitStat)} />
									{bonusStatValue !== 0 && (
										<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.bonus')} value={show(bonusStats, unitStat)} />
									)}
									<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.total')} value={show(attribution.final, unitStat, true, true)} />
									{showEffectiveWeaponSpeed && (
										<TooltipRow
											label={i18n.t('sidebar.character_stats.tooltip.eWS')}
											value={`${(
												rangedWeapon!.item.weaponSpeed /
												(1 + attribution.final.getPseudoStat(PseudoStat.PseudoStatRangedHastePercent) / 100)
											).toFixed(2)}s`}
										/>
									)}
								</div>
							}
						/>
					</>
				)}
			</td>
		</tr>
	);
};
