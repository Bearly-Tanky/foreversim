import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLRotation, APLRotation_Type } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as Presets from './presets';

export default defineSpec<Spec.SpecBalanceDruid>({
	spec: Spec.SpecBalanceDruid,

	className: 'balance-druid-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Druid),
	// List any known bugs / issues here, and they'll be shown on the site.
	knownIssues: ['We need assistance testing in-game Treant base damage and spell damage scaling. If interested please join our Discord!'],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatIntellect,
		Stat.StatSpellDamage,
		Stat.StatArcaneDamage,
		Stat.StatNatureDamage,
		Stat.StatSpellHitRating,
		Stat.StatSpellCritRating,
		Stat.StatSpellHasteRating,
		Stat.StatMP5,
		Stat.StatSpirit,
	],
	epPseudoStats: [],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellDamage,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpellDamage,
			Stat.StatArcaneDamage,
			Stat.StatNatureDamage,
			Stat.StatMP5,
			Stat.StatSpirit,
			Stat.StatArcaneResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatNatureResistance,
			Stat.StatShadowResistance,
		],
		[PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent, PseudoStat.PseudoStatSpellHitPercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Intellect: 0.16,
			SpellPower: 1,
			ArcanePower: 0.62,
			NaturePower: 0.38,
			SpellHit: 11.75,
			SpellCrit: 7.5,
			SpellHaste: 0.8,
			FireResistance: 0.5,
		}),
		// Default stat caps for stat weights tab. (also needed for reforging since we don't want to reforge above stat caps)
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 16);
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.BalanceTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: Presets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,
		other: Presets.OtherDefaults,
		rotationType: APLRotation_Type.TypeAuto,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: [Presets.BalanceTalents, Presets.MoonkinTalents],
		rotations: [Presets.LaunchRotation, Presets.StandardRotation],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (_player: Player<Spec.SpecBalanceDruid>): APLRotation => {
		return Presets.LaunchRotation.rotation.rotation!;
	},

	reforge: {},
});
