import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLRotation } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { DEFAULT_CASTER_GEM_STATS, Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as WarlockInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecWarlock>({
	spec: Spec.SpecWarlock,

	className: 'warlock-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Warlock),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatIntellect,
		Stat.StatSpellDamage,
		Stat.StatShadowDamage,
		Stat.StatFireDamage,
		Stat.StatSpellHitRating,
		Stat.StatSpellCritRating,
		Stat.StatSpellHasteRating,
		Stat.StatSpellPiercing,
		Stat.StatMP5,
	],
	// Reference stat against which to calculate EP. DPS classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellDamage,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpellDamage,
			Stat.StatShadowDamage,
			Stat.StatFireDamage,
			Stat.StatSpellPiercing,
			Stat.StatMP5,
			Stat.StatArcaneResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatNatureResistance,
			Stat.StatShadowResistance,
		],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: [...DEFAULT_CASTER_GEM_STATS, Stat.StatShadowDamage, Stat.StatFireDamage],

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,

		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Mana: 0.01,
			Intellect: 0.23,
			MP5: 0.14,
			SpellPower: 1,
			FirePower: 0.1,
			ShadowPower: 0.9,
			SpellHit: 12.79,
			SpellCrit: 7.92,
			SpellHaste: 7.83,
			Stamina: 0.01,
		}),
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 16);
		})(),

		// Default consumes settings.
		consumables: Presets.DefaultConsumables,

		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,

		// Default buffs and debuffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: Presets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,

		other: Presets.OtherDefaults,
	},

	consumableStats: [
		Stat.StatIntellect,
		Stat.StatSpirit,
		Stat.StatMP5,
		Stat.StatSpellDamage,
		Stat.StatSpellCritRating,
		Stat.StatSpellHitRating,
		Stat.StatSpellHasteRating,
		Stat.StatShadowDamage,
		Stat.StatFireDamage,
	],
	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [WarlockInputs.PetInput(), WarlockInputs.ArmorInput(), WarlockInputs.DemonicSacrificeInput(), WarlockInputs.PactSacrificeInput()],

	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [Stat.StatAttackPower],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.DistanceFromTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: Presets.TalentPresets,
		// Preset rotations that the user can quickly select.
		rotations: Presets.APLPresets,

		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
		builds: Presets.BuildPresets,
	},

	// Master's rule: Demonic Pact keeps a demon out beside the sacrifice, so it has its own rotation.
	// DS/Ruin is a rotation for a sacrificed pet, whatever tree the rest of the points sit in, and
	// Shadow and Flame adds Shadowburn on cooldown to it; otherwise the deepest tree picks.
	autoRotation: (player: Player<Spec.SpecWarlock>): APLRotation => {
		const talents = player.getTalents();
		if (talents.demonicPact) return Presets.RotationDemonicPact.rotation.rotation!;
		if (talents.demonicSacrifice && talents.ruin) {
			return (talents.shadowAndFlame ? Presets.RotationShadowAndFlame : Presets.RotationDSRuin).rotation.rotation!;
		}
		const points = player.getTalentTreePoints();
		const tree = points.indexOf(Math.max(...points));
		return [Presets.RotationAffliction, Presets.RotationDemonicPact, Presets.RotationDSRuin][tree].rotation.rotation!;
	},
	sections: [WarlockInputs.CursesSection],

	reforge: {},
});
