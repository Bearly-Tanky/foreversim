import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLRotation } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as WarriorInputs from '../shared/inputs';
import * as WarriorPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecProtectionWarrior>({
	spec: Spec.SpecProtectionWarrior,
	enableHealing: true,

	className: 'protection-warrior-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Warrior),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	epRatios: [0, 0, 0.6, 0, 1.15, 0],
	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatStrength,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeHasteRating,
		Stat.StatMeleeCritRating,
		Stat.StatArmorPenetration,
		Stat.StatExpertiseRating,
		Stat.StatDefenseRating,
		Stat.StatBlockRating,
		Stat.StatBlockValue,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatArmor,
		Stat.StatBonusArmor,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	tankRefStat: Stat.StatStamina,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatArmor,
			Stat.StatBonusArmor,
			Stat.StatStamina,
			Stat.StatStrength,
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
			PseudoStat.PseudoStatBlockPercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatParryPercent,
			PseudoStat.PseudoStatExpertisePercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Armor: 0.174,
			BonusArmor: 0.155,
			Stamina: 2.336,
			Strength: 1.555,
			Agility: 2.771,
			AttackPower: 0.32,
			MeleeHit: 1.432,
			MeleeCrit: 0.925,
			Block: 1.32,
			BlockValue: 1.373,
			Dodge: 2.606,
			Parry: 2.649,
			Defense: 3.305,
			MainHandDps: 11.92,
			OffHandDps: 4.69,
			MeleeSpeedMultiplier: 4.69,
		}),
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatMeleeHitPercent, 9);
			const expCap = new Stats().withPseudoStat(PseudoStat.PseudoStatExpertisePercent, 6.5);
			const critImmunityCap = new Stats().withPseudoStat(PseudoStat.PseudoStatReducedCritTakenPercent, 5.6);

			return hitCap.add(expCap).add(critImmunityCap);
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.ProtectionTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: WarriorPresets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	// The two Battle Shout icon toggles used to sit in `otherInputs`; icon pickers are not part
	// of the `InputConfig` union any more, so they join the player icon row.
	playerIconInputs: [WarriorInputs.ShoutPicker(), WarriorInputs.StancePicker(), WarriorInputs.BattleShoutT2()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			OtherInputs.TotemTwisting,
			WarriorInputs.StartingRage(),
			WarriorInputs.StanceSnapshot(),
			WarriorInputs.QueueDelay(),
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
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],

	encounterPicker: {
		// Whether to include 'Execute DuratFion (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: [Presets.ProtectionTalents, Presets.DeepProtectionTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_PROTECTION, Presets.ROTATION_PRESET_NO_RECK, Presets.ROTATION_PRESET_RECK],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
		builds: [Presets.BUILD_TANKY],
	},

	autoRotation: (_player: Player<Spec.SpecProtectionWarrior>): APLRotation => {
		return Presets.ROTATION_PRESET_PROTECTION.rotation.rotation!;
	},

	reforge: {},
});
