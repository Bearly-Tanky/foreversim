import { ItemSlot, PseudoStat, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import type { Stats, UnitStat } from '@sim/proto/stats';
import { TONE_TEXT } from '@ui-kit/utils/colors';

/** Enchant that grants +30 ranged hit rating; the server folds it into the pseudo stat but not the rating. */
const SCOPE_HIT_ENCHANT_EFFECT_ID = 2523;
/** Enchant that grants +28 ranged crit rating, same story. */
const SCOPE_CRIT_ENCHANT_EFFECT_ID = 2724;

const SCHOOL_DAMAGE_STATS = [
	Stat.StatArcaneDamage,
	Stat.StatFireDamage,
	Stat.StatFrostDamage,
	Stat.StatHolyDamage,
	Stat.StatNatureDamage,
	Stat.StatShadowDamage,
];

/**
 * `includeBase`/`includeGear` say which stage the delta being rendered covers, because the base
 * defense skill and the scope enchants are only correct once the stage that hides them is known.
 */
export const statDisplayString = (player: Player<any>, deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean, includeGear?: boolean): string => {
	const rootStat = unitStat.hasRootStat() ? unitStat.getRootStat() : null;
	let rootRatingValue = rootStat !== null ? deltaStats.getStat(rootStat) : null;
	let percentDecimals = 2;
	let derivedPercentOrPointsValue = unitStat.convertDefaultUnitsToPercent(deltaStats.getUnitStat(unitStat));
	let displayPrefix = '';
	let displaySuffix = i18n.t('sidebar.character_stats.percent_suffix');

	if (unitStat.equalsStat(Stat.StatDefenseRating)) {
		// Defense is a skill level, not a percentage: no suffix, no decimals, and the rating is
		// always shown even at zero.
		displaySuffix = '';
		percentDecimals = 0;
		if (includeBase) {
			derivedPercentOrPointsValue! += player.getBaseDefense();
		}
	} else if (includeGear && rootRatingValue !== null && unitStat.equalsPseudoStat(PseudoStat.PseudoStatRangedHitPercent)) {
		if (player.getEquippedItem(ItemSlot.ItemSlotRanged)?.enchant?.effectId === SCOPE_HIT_ENCHANT_EFFECT_ID) {
			rootRatingValue += 30;
		}
	} else if (rootRatingValue !== null && unitStat.equalsPseudoStat(PseudoStat.PseudoStatRangedCritPercent)) {
		if (includeGear && player.getEquippedItem(ItemSlot.ItemSlotRanged)?.enchant?.effectId === SCOPE_CRIT_ENCHANT_EFFECT_ID) {
			rootRatingValue += 28;
		}
	} else if (rootStat == Stat.StatBlockValue) {
		if (rootRatingValue !== null && rootRatingValue > 0) {
			rootRatingValue *= deltaStats.getPseudoStat(PseudoStat.PseudoStatBlockValueMultiplier) || 1;
		}
	} else if (rootStat && SCHOOL_DAMAGE_STATS.includes(rootStat)) {
		// School damage reads as "total (+school)": the rating column carries the school's own
		// value plus generic spell damage, the parenthesised value is the school-only bonus.
		if (rootRatingValue !== null) {
			displayPrefix = '+';
			displaySuffix = '';
			percentDecimals = 0;
			derivedPercentOrPointsValue = rootRatingValue;
			rootRatingValue += deltaStats.getStat(Stat.StatSpellDamage);
		}
	}

	const hideRootRating =
		(rootRatingValue === null || (rootRatingValue === 0 && derivedPercentOrPointsValue !== null)) && !unitStat.equalsStat(Stat.StatDefenseRating);
	const rootRatingString = hideRootRating ? '' : String(Math.round(rootRatingValue!));
	const percentOrPointsString =
		derivedPercentOrPointsValue === null ? '' : displayPrefix + `${derivedPercentOrPointsValue.toFixed(percentDecimals)}` + displaySuffix;
	const wrappedPercentOrPointsString = hideRootRating || derivedPercentOrPointsValue === null ? percentOrPointsString : ` (${percentOrPointsString})`;
	return rootRatingString + wrappedPercentOrPointsString;
};

export const shouldShowMeleeCritCap = (player: Player<any>): boolean => player.getPlayerSpec().isMeleeDpsSpec;

export const shouldShowCritImmunity = (player: Player<any>): boolean => player.getPlayerSpec().isTankSpec;

export const meleeCritCapDisplayString = (player: Player<any>): string => {
	const playerCritCapDelta = player.getMeleeCritCap();

	if (playerCritCapDelta === 0.0) {
		return i18n.t('sidebar.character_stats.crit_cap.exact');
	}

	const prefix = playerCritCapDelta > 0 ? i18n.t('sidebar.character_stats.crit_cap.over_by') : i18n.t('sidebar.character_stats.crit_cap.under_by');
	return `${prefix} ${Math.abs(playerCritCapDelta).toFixed(2)}%`;
};

/** Reads the opposite way round to the melee crit cap: the delta is cap minus total, so positive means short of it. */
export const critImmunityCapDisplayString = (player: Player<any>): string => {
	const critImmuneDelta = player.getCritImmunity();

	if (critImmuneDelta.toFixed(2) === '0.00') {
		return i18n.t('sidebar.character_stats.crit_cap.exact');
	}

	const prefix = critImmuneDelta > 0 ? i18n.t('sidebar.character_stats.crit_cap.under_by') : i18n.t('sidebar.character_stats.crit_cap.over_by');
	return `${prefix} ${Math.abs(critImmuneDelta).toFixed(2)}%`;
};

export const bonusStatClass = (bonusStatValue: number): string =>
	bonusStatValue === 0 ? 'text-white' : TONE_TEXT[bonusStatValue > 0 ? 'positive' : 'negative'];

/** The melee crit cap reads the other way round: over the cap is bad. */
export const critCapClass = (capDelta: number): string => (capDelta === 0 ? 'text-white' : TONE_TEXT[capDelta > 0 ? 'negative' : 'positive']);

/** Crit immunity is short-of-cap, so a positive delta is the bad one; zero is tested to two decimals. */
export const critImmunityClass = (capDelta: number): string =>
	capDelta.toFixed(2) === '0.00' ? 'text-white' : TONE_TEXT[capDelta > 0 ? 'negative' : 'positive'];
