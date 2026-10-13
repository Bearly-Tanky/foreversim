import * as OtherInputs from '@features/settings/model/other_inputs';
import { StatCapType } from '@generated/proto/api';
import { APLRotation } from '@generated/proto/apl';
import { PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { StatCap, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as Presets from './presets';

export default defineSpec<Spec.SpecProtectionPaladin>({
	spec: Spec.SpecProtectionPaladin,
	enableHealing: true,

	className: 'protection-paladin-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Paladin),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	consumableStats: [Stat.StatStamina, Stat.StatHealth, Stat.StatMana, Stat.StatMP5, Stat.StatSpellDamage, Stat.StatHolyDamage],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatStrength,
		Stat.StatIntellect,
		Stat.StatSpellDamage,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeHasteRating,
		Stat.StatMeleeCritRating,
		Stat.StatArmorPenetration,
		Stat.StatExpertiseRating,
		Stat.StatSpellHitRating,
		Stat.StatSpellCritRating,
		Stat.StatDefenseRating,
		Stat.StatBlockRating,
		Stat.StatBlockValue,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatArmor,
		Stat.StatBonusArmor,
		Stat.StatExpertiseRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatArmor,
			Stat.StatBonusArmor,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatSpellDamage,
			Stat.StatHolyDamage,
			Stat.StatAgility,
			Stat.StatAttackPower,
			Stat.StatBlockValue,
			Stat.StatDefenseRating,
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
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatBlockPercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatParryPercent,
			PseudoStat.PseudoStatExpertisePercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		softCapBreakpoints: [
			StatCap.fromPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent, {
				breakpoints: [5.6],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0],
			}),
		],
		// Default EP weights for sorting gear in the gear picker.
		// Values for now are pre-Cata initial WAG
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Strength: 3.23,
			Agility: 18.57,
			Intellect: 0.05,
			SpellPower: 0.38,
			HolyPower: 0.29,
			SpellHit: 8.2,
			SpellCrit: 3.35,
			AttackPower: 1.0,
			MeleeCrit: 39.75,
			Armor: 1.0,
			Defense: 29.97,
			BlockValue: 17.72,
			Dodge: 219.45,
			Parry: 217.72,
			BonusArmor: 0.96,
			MainHandDps: 10.12,
		}),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: Presets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [Stat.StatMP5, Stat.StatIntellect],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			OtherInputs.TotemTwisting,
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
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: Presets.TalentPresets,
		// Preset rotations that the user can quickly select.
		rotations: [Presets.APL_P5, Presets.APL_PRESET],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (_player: Player<Spec.SpecProtectionPaladin>): APLRotation => {
		return Presets.APL_P5.rotation.rotation!;
	},

	reforge: {},
});
