import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLRotation } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as PriestInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecDpsPriest>({
	spec: Spec.SpecDpsPriest,

	className: 'priest-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Priest),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [
		'Some items may display and use stats a litle higher than their original value.',
		'Procs from Weapons, Trinkets and other Items are not yet supported',
	],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatIntellect,
		Stat.StatSpellDamage,
		Stat.StatShadowDamage,
		Stat.StatHolyDamage,
		Stat.StatSpellHitRating,
		Stat.StatSpellCritRating,
		Stat.StatSpellHasteRating,
		Stat.StatMana,
		Stat.StatMP5,
		Stat.StatSpirit,
	],
	epPseudoStats: [PseudoStat.PseudoStatSchoolHitPercentShadow],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellDamage,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatMP5,
			Stat.StatSpirit,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpirit,
			Stat.StatSpellDamage,
			Stat.StatShadowDamage,
			Stat.StatHolyDamage,
			Stat.StatArcaneResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatNatureResistance,
			Stat.StatShadowResistance,
		],
		[
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
			PseudoStat.PseudoStatSchoolHitPercentShadow,
		],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Intellect: 0.16,
			Spirit: 0.01,
			SpellPower: 1,
			ShadowPower: 1,
			SpellHit: 5.51,
			SpellCrit: 5.99,
			SpellHaste: 1.65,
			FireResistance: 0.5,
		}),
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSchoolHitPercentShadow, 16);
		})(),
		// Default consumes settings.
		consumables: Presets.ShadowConsumables,
		// Default talents.
		talents: Presets.TalentsP1Shadow.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,

		partyBuffs: Presets.DefaultPartyBuffs,

		individualBuffs: Presets.DefaultIndividualBuffs,

		debuffs: Presets.DefaultDebuffs,

		other: Presets.ShadowOtherDefaults,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [PriestInputs.ShadowformInput(), PriestInputs.ShadowfiendInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.ChannelClipDelay, OtherInputs.TankAssignment, OtherInputs.DistanceFromTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: [Presets.TalentsP1Shadow, Presets.ShadowTalents],
		rotations: [Presets.ROTATION_PRESET_SHADOW],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (player: Player<Spec.SpecDpsPriest>): APLRotation => {
		return player.getTalents().shadowform ? Presets.ROTATION_PRESET_SHADOW.rotation.rotation! : Presets.ROTATION_PRESET_SMITE.rotation.rotation!;
	},

	reforge: {},
});
