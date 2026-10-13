import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLAction, APLListItem, APLRotation, APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { Cooldowns, ItemSlot, PseudoStat, Spec, Stat, TristateEffect } from '@generated/proto/common';
import { FeralBearDruid_Rotation as DruidRotation } from '@generated/proto/druid';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as FeralBearInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecFeralBearDruid>({
	spec: Spec.SpecFeralBearDruid,
	enableHealing: true,

	className: 'feral-bear-druid-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Druid),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	warnings: [],

	epRatios: [0, 0, 0.6, 0, 1.0, 0],
	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatAgility,
		Stat.StatStrength,
		Stat.StatAttackPower,
		Stat.StatFeralAttackPower,
		Stat.StatArmor,
		Stat.StatBonusArmor,
		Stat.StatDodgeRating,
		Stat.StatDefenseRating,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeCritRating,
		Stat.StatMeleeHasteRating,
		Stat.StatExpertiseRating,
		Stat.StatPhysicalDamage,
		Stat.StatArmorPenetration,
	],
	epPseudoStats: [],
	epReferenceStat: Stat.StatAgility,
	tankRefStat: Stat.StatStamina,
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatStamina,
			Stat.StatAgility,
			Stat.StatStrength,
			Stat.StatAttackPower,
			Stat.StatArmor,
			Stat.StatBonusArmor,
			Stat.StatDodgeRating,
			Stat.StatDefenseRating,
			Stat.StatNatureResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatArcaneResistance,
			Stat.StatShadowResistance,
		],
		[
			PseudoStat.PseudoStatMeleeHitPercent,
			PseudoStat.PseudoStatMeleeCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatExpertisePercent,
		],
	),

	defaults: {
		gear: Presets.DEFAULT_GEAR.gear,
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Armor: 3.5665,
			BonusArmor: 0.5187,
			Stamina: 7.3021,
			Strength: 2.3786,
			Agility: 4.4974,
			AttackPower: 1,
			MeleeHit: 2.9282,
			MeleeCrit: 1.5143,
			Defense: 1.8171,
			Dodge: 2.0196,
			Health: 0.4465,
		}),
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatMeleeHitPercent, 9);
			const expCap = new Stats().withPseudoStat(PseudoStat.PseudoStatExpertisePercent, 6.5);
			const critImmunityCap = new Stats().withPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent, 5.6);
			return hitCap.add(expCap).add(critImmunityCap);
		})(),
		other: Presets.OtherDefaults,
		consumables: Presets.DefaultConsumables,
		rotationType: APLRotationType.TypeAPL,
		aplRotation: Presets.ROTATION_DEFAULT.rotation.rotation!,
		talents: Presets.BearTankTalents.data,
		specOptions: Presets.DefaultOptions,
		// Master's page (currentSettings on a fresh profile); its raid-wide totems and Battle Shout
		// are party buffs here, its Stoneskin Totem has no counterpart.
		raidBuffs: RaidBuffs.create({
			fireResistanceTotem: true,
			giftOfTheWild: true,
			prayerOfFortitude: true,
		}),
		partyBuffs: PartyBuffs.create({
			battleShout: TristateEffect.TristateEffectRegular,
			graceOfAirTotem: true,
			strengthOfEarthTotem: true,
		}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			curseOfRecklessness: true,
			exposeArmor: true,
			faerieFire: true,
			giftOfArthas: true,
			sunderArmor: true,
		}),
	},

	playerIconInputs: [],
	rotationInputs: FeralBearInputs.FeralBearRotationConfig,
	includeBuffDebuffInputs: [Stat.StatStamina, Stat.StatArmor],
	excludeBuffDebuffInputs: [],
	otherInputs: {
		inputs: [
			OtherInputs.TotemTwisting,
			FeralBearInputs.StartingRage,
			OtherInputs.InputDelay,
			OtherInputs.TankAssignment,
			OtherInputs.InspirationUptime,
			OtherInputs.IncomingHps,
			OtherInputs.HealingCadence,
			OtherInputs.HealingCadenceVariation,
			OtherInputs.AbsorbFrac,
			OtherInputs.BurstWindow,
			OtherInputs.HpPercentForDefensives,
			OtherInputs.InFrontOfTarget,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotRanged],

	encounterPicker: {
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		talents: [Presets.BearTankTalents],
		// ROTATION_SIMPLE is kept in presets.ts for reference but omitted here —
		// the APL rotation is more user-friendly and handles CDs, re-shifting, and
		// on-use items more easily.
		rotations: [Presets.ROTATION_DEFAULT],
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (_player: Player<Spec.SpecFeralBearDruid>): APLRotation => {
		return Presets.ROTATION_DEFAULT.rotation.rotation!;
	},

	simpleRotation: (_player: Player<Spec.SpecFeralBearDruid>, simple: DruidRotation, _cooldowns: Cooldowns): APLRotation => {
		const doRotation = APLAction.fromJsonString(
			`{"bearOptimalRotationAction":{"maintainFaerieFire":${simple.maintainFaerieFire},"maintainDemoralizingRoar":${simple.maintainDemoralizingRoar},"maulRageThreshold":${simple.maulRageThreshold},"swipeUsage":${simple.swipeUsage},"swipeApThreshold":${simple.swipeApThreshold}}}`,
		);
		return APLRotation.create({
			priorityList: [APLListItem.create({ action: doRotation })],
		});
	},

	reforge: {},
});
