import * as OtherInputs from '@features/settings/model/other_inputs';
import { StatCapType } from '@generated/proto/api';
import { APLRotation } from '@generated/proto/apl';
import { HandType, ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import * as Mechanics from '@sim/constants/mechanics';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { DEFAULT_MELEE_GEM_STATS, StatCap, Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as WarriorInputs from '../shared/inputs';
import * as WarriorPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecDpsWarrior>({
	spec: Spec.SpecDpsWarrior,

	className: 'dps-warrior-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Warrior),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStrength,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatArmorPenetration,
		Stat.StatMeleeHitRating,
		Stat.StatMeleeHasteRating,
		Stat.StatMeleeCritRating,
		Stat.StatExpertiseRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	gemStats: DEFAULT_MELEE_GEM_STATS,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatAttackPower,
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
			PseudoStat.PseudoStatExpertisePercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Strength: 2.51,
			Agility: 1.86,
			AttackPower: 1,
			MeleeHit: 28.67,
			MeleeCrit: 25.1,
			FireResistance: 0.5,
			MainHandDps: 11.92,
			OffHandDps: 4.69,
			MeleeSpeedMultiplier: 4.69,
		}),
		statCaps: (() => {
			const expCap = new Stats().withPseudoStat(PseudoStat.PseudoStatExpertisePercent, 6.5);
			return expCap;
		})(),
		softCapBreakpoints: (() => {
			const meleeHitSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatMeleeHitPercent, {
				breakpoints: [9, 28],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0.57 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT, 0],
			});

			return [meleeHitSoftCapConfig];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DpsTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: WarriorPresets.DefaultPartyBuffs,
		individualBuffs: WarriorPresets.DefaultIndividualBuffs,
		debuffs: WarriorPresets.DefaultDebuffs,
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
			OtherInputs.DistanceFromTarget,
			OtherInputs.InputDelay,
			OtherInputs.TankAssignment,
			OtherInputs.InFrontOfTarget,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [],
		// Preset talents that the user can quickly select.
		talents: [Presets.DpsTalents, Presets.FuryTalents, Presets.ArmsTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_DANCE, Presets.ROTATION_PRESET_BATTLE, Presets.ROTATION_PRESET_NO_RECK, Presets.ROTATION_PRESET_RECK],
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	// Arena (189 build/gear pairs): Dance beats No Reck on every one (+4..+16%); only 5/5 Bloodthrill
	// with a two-hander does better staying in Battle Stance (+3..+6% over Dance).
	autoRotation: (player: Player<Spec.SpecDpsWarrior>): APLRotation => {
		const battle = player.getTalents().bloodthrill === 5 && Presets.isArmsSpec(player);
		return (battle ? Presets.ROTATION_PRESET_BATTLE : Presets.ROTATION_PRESET_DANCE).rotation.rotation!;
	},

	reforge: {
		updateSoftCaps: (softCaps, player, ctx) => {
			const gear = player.getGear();
			const mainHandType = gear.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType;
			const offHandType = gear.getEquippedItem(ItemSlot.ItemSlotOffHand)?.item.handType;
			const isFury =
				mainHandType &&
				[HandType.HandTypeOneHand, HandType.HandTypeMainHand].includes(mainHandType) &&
				offHandType &&
				[HandType.HandTypeOneHand, HandType.HandTypeOffHand].includes(offHandType);

			const softCapToModify = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatMeleeHitPercent));
			if (softCapToModify) {
				if (isFury) {
					softCapToModify.breakpoints = ctx.defaults.softCapBreakpoints?.[0].breakpoints || [];
					softCapToModify.postCapEPs = ctx.defaults.softCapBreakpoints?.[0].postCapEPs || [];
				} else {
					softCapToModify.breakpoints = [9];
					softCapToModify.postCapEPs = [0];
				}
			}

			return softCaps;
		},
	},
});
