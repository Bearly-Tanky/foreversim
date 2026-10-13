import * as other_inputs from '@features/settings/model/other_inputs';
import { StatCapType } from '@generated/proto/api';
import { APLRotation } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { StatCap, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as HunterInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecHunter>({
	spec: Spec.SpecHunter,

	className: 'hunter-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Hunter),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	warnings: [],
	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatAgility,
		Stat.StatStrength,
		Stat.StatIntellect,
		Stat.StatMP5,
		Stat.StatAttackPower,
		Stat.StatRangedAttackPower,
		Stat.StatArmorPenetration,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeHasteRating,
		Stat.StatMeleeCritRating,
		Stat.StatExpertiseRating,
		Stat.StatPhysicalDamage,
	],
	gemStats: [Stat.StatStamina, Stat.StatAgility],
	epPseudoStats: [PseudoStat.PseudoStatRangedHitPercent, PseudoStat.PseudoStatRangedCritPercent, PseudoStat.PseudoStatRangedDps],
	consumableStats: [Stat.StatStamina, Stat.StatHealth, Stat.StatMana],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatIntellect,
			Stat.StatMP5,
			Stat.StatAttackPower,
			Stat.StatRangedAttackPower,
			Stat.StatArmorPenetration,
			Stat.StatArcaneResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatNatureResistance,
			Stat.StatShadowResistance,
		],
		[
			PseudoStat.PseudoStatMeleeHitPercent,
			PseudoStat.PseudoStatMeleeCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatRangedHitPercent,
			PseudoStat.PseudoStatRangedCritPercent,
			PseudoStat.PseudoStatRangedHastePercent,
			PseudoStat.PseudoStatExpertisePercent,
		],
	),
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotRanged, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Strength: 0.3,
			Agility: 0.64,
			Intellect: 0.02,
			AttackPower: 1,
			RangedAttackPower: 1.0,
			MeleeHit: 3.29,
			MeleeCrit: 4.45,
			SpellPower: 0.03,
			NaturePower: 0.01,
			ArcanePower: 0.01,
			SpellCrit: 0.01,
			MP5: 0.05,
			FireResistance: 0.5,
			MainHandDps: 2.11,
			OffHandDps: 1.39,
			RangedDps: 6.32,
			MeleeSpeedMultiplier: 1.39,
			RangedSpeedMultiplier: 6.32,
		}),
		softCapBreakpoints: [
			StatCap.fromPseudoStat(PseudoStat.PseudoStatRangedHitPercent, {
				breakpoints: [9],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0],
			}),
		],
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.TalentsP1.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: Presets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [HunterInputs.PetTypeInput(), HunterInputs.QuiverInput(), HunterInputs.AmmoInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [Stat.StatSpirit, Stat.StatSpellCritRating, Stat.StatSpellDamage],
	excludeBuffDebuffInputs: [],
	rotationInputs: HunterInputs.RotationInputs,
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			other_inputs.TotemTwisting,
			HunterInputs.PetUptime(),
			HunterInputs.PetSingleAbility(),
			HunterInputs.PetAttackSpeedInput(),
			other_inputs.InputDelay,
			other_inputs.DistanceFromTarget,
			other_inputs.TankAssignment,
		],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: Presets.TalentPresets,
		// Preset rotations that the user can quickly select.
		rotations: [Presets.MarksmanshipRotation, Presets.SurvivalMeleeRotation],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	// Master's one hunter rotation, whatever the talents.
	autoRotation: (_player: Player<Spec.SpecHunter>): APLRotation => APLRotation.clone(Presets.MarksmanshipRotation.rotation.rotation!),

	reforge: {},
});
