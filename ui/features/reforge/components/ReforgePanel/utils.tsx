import { PseudoStat, Stat } from '@generated/proto/common';
import { UnitStat } from '@sim/proto/stats';
import type { StatTooltipContent } from '@sim/spec_config';
import type { ReactNode } from 'react';

/** The stats the optimizer offers a cap for. Held as UnitStats because several are pseudo-stats. */
export const INCLUDED_STATS: UnitStat[] = [
	UnitStat.fromStat(Stat.StatSpellHitRating),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentArcane),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentFire),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentFrost),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentHoly),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentNature),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatSchoolHitPercentShadow),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent),
	UnitStat.fromStat(Stat.StatSpellCritRating),
	UnitStat.fromStat(Stat.StatSpellHasteRating),
	UnitStat.fromStat(Stat.StatMeleeHitRating),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeHitPercent),
	UnitStat.fromStat(Stat.StatMeleeCritRating),
	UnitStat.fromStat(Stat.StatMeleeHasteRating),
	UnitStat.fromStat(Stat.StatExpertiseRating),
	UnitStat.fromPseudoStat(PseudoStat.PseudoStatExpertisePercent),
	UnitStat.fromStat(Stat.StatArmorPenetration),
	UnitStat.fromStat(Stat.StatDodgeRating),
	UnitStat.fromStat(Stat.StatParryRating),
	UnitStat.fromStat(Stat.StatDefenseRating),
];

export const isIncludedStat = (unitStat: UnitStat): boolean => INCLUDED_STATS.some(included => included.equals(unitStat));

const DEFAULT_STAT_TOOLTIPS: Partial<Record<Stat, ReactNode>> = {
	[Stat.StatMeleeHasteRating]: (
		<>
			Final percentage value <strong>including</strong> all buffs/gear.
		</>
	),
	[Stat.StatSpellHasteRating]: (
		<>
			Final percentage value <strong>including</strong> all buffs/gear.
		</>
	),
};

/** The panel's own entries, overridden per stat by the spec's. Evaluated once per popover open. */
export const buildStatTooltips = (override: StatTooltipContent | undefined): Partial<Record<Stat, ReactNode>> => {
	const tooltips: Partial<Record<Stat, ReactNode>> = { ...DEFAULT_STAT_TOOLTIPS };
	for (const [stat, make] of Object.entries(override ?? {})) {
		const content = make?.();
		if (content !== undefined) tooltips[Number(stat) as Stat] = content;
	}
	return tooltips;
};
