import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLRotation } from '@generated/proto/apl';
import { PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as Presets from './presets';

export default defineSpec<Spec.SpecRetributionPaladin>({
	spec: Spec.SpecRetributionPaladin,

	className: 'retribution-paladin-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Paladin),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	consumableStats: [Stat.StatMana, Stat.StatMP5],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStrength,
		Stat.StatIntellect,
		Stat.StatSpellDamage,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatArmorPenetration,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeHasteRating,
		Stat.StatMeleeCritRating,
		Stat.StatExpertiseRating,
		Stat.StatMana,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatIntellect,
			Stat.StatAttackPower,
			Stat.StatSpellDamage,
			Stat.StatMana,
			Stat.StatHealth,
			Stat.StatStamina,
			Stat.StatHolyDamage,
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
			PseudoStat.PseudoStatSpellHastePercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatExpertisePercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Strength: 2.53,
			Agility: 1.13,
			Intellect: 0.15,
			SpellPower: 0.32,
			SpellHit: 0.41,
			SpellCrit: 0.01,
			MP5: 0.05,
			AttackPower: 1,
			MeleeHit: 1.96,
			MeleeCrit: 1.16,
			FireResistance: 0.5,
			MainHandDps: 7.33,
			MeleeSpeedMultiplier: 7.33,
		}),
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatMeleeHitPercent, 9);
			const expCap = new Stats().withPseudoStat(PseudoStat.PseudoStatExpertisePercent, 6.5);

			return hitCap.add(expCap);
		})(),
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
	includeBuffDebuffInputs: [Stat.StatMP5],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.TotemTwisting, OtherInputs.InputDelay, OtherInputs.TankAssignment, OtherInputs.InFrontOfTarget],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		rotations: [Presets.APL_PRESET],
		// Preset talents that the user can quickly select.
		talents: Presets.TalentPresets,
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (_: Player<Spec.SpecRetributionPaladin>): APLRotation => {
		return Presets.APL_PRESET.rotation.rotation!;
	},

	reforge: {},
});
