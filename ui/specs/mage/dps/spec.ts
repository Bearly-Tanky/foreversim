import * as OtherInputs from '@features/settings/model/other_inputs';
import { APLListItem, APLRotation, APLRotation_Type, APLValueVariable } from '@generated/proto/apl';
import { Cooldowns, ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import * as AplUtils from '@sim/proto/apl_utils';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { SpecRotation } from '@sim/proto/spec_types';
import { DEFAULT_CASTER_GEM_STATS, Stats, UnitStat } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as MageInputs from './inputs';
import * as Presets from './presets';
import { DefaultConsumables, DefaultDebuffs, DefaultIndividualBuffs, DefaultPartyBuffs, DefaultRaidBuffs } from './presets';

export default defineSpec<Spec.SpecMage>({
	spec: Spec.SpecMage,

	requiredTalentRows: [],
	className: 'mage-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Mage),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatIntellect,
		Stat.StatSpirit,
		Stat.StatSpellDamage,
		Stat.StatArcaneDamage,
		Stat.StatFrostDamage,
		Stat.StatFireDamage,
		Stat.StatSpellPiercing,
		Stat.StatSpellHitRating,
		Stat.StatSpellCritRating,
		Stat.StatSpellHasteRating,
		Stat.StatMana,
		Stat.StatMP5,
	],
	epPseudoStats: [PseudoStat.PseudoStatSchoolHitPercentArcane, PseudoStat.PseudoStatSchoolHitPercentFire, PseudoStat.PseudoStatSchoolHitPercentFrost],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellDamage,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpirit,
			Stat.StatSpellDamage,
			Stat.StatFrostDamage,
			Stat.StatFireDamage,
			Stat.StatArcaneDamage,
			Stat.StatArcaneResistance,
			Stat.StatFireResistance,
			Stat.StatFrostResistance,
			Stat.StatNatureResistance,
			Stat.StatShadowResistance,
		],
		[
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSchoolHitPercentArcane,
			PseudoStat.PseudoStatSchoolHitPercentFire,
			PseudoStat.PseudoStatSchoolHitPercentFrost,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
		],
	),

	modifyDisplayStats: (player: Player<Spec.SpecMage>) => {
		return {
			talents: new Stats().addPseudoStat(PseudoStat.PseudoStatSpellCritPercent, player.getTalents().arcaneInstability),
		};
	},

	gemStats: DEFAULT_CASTER_GEM_STATS,

	consumableStats: [
		Stat.StatIntellect,
		Stat.StatSpirit,
		Stat.StatMP5,
		Stat.StatMana,
		Stat.StatSpellDamage,
		Stat.StatFrostDamage,
		Stat.StatFireDamage,
		Stat.StatArcaneDamage,
		Stat.StatSpellCritRating,
		Stat.StatSpellHitRating,
		Stat.StatSpellHasteRating,
	],

	defaults: {
		// Default equipped gear.
		gear: Presets.DEFAULT_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Master's weights (percent stats per 1%), in our ratings.
		epWeights: masterEpWeights({
			Intellect: 0.49,
			SpellPower: 1,
			ArcanePower: 1,
			FirePower: 1,
			FrostPower: 1,
			SpellHit: 18.59,
			SpellCrit: 13.91,
			SpellHaste: 6.85,
			MP5: 0.11,
			FireResistance: 0.5,
		}),
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSchoolHitPercentArcane, 16);
		})(),
		// Default consumes settings.
		consumables: DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: DefaultRaidBuffs,

		partyBuffs: DefaultPartyBuffs,
		individualBuffs: DefaultIndividualBuffs,

		rotationType: APLRotation_Type.TypeAuto,
		simpleRotation: Presets.ArcaneMageSimpleRotation,
		debuffs: DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [MageInputs.MageArmorInputs()],
	rotationInputs: MageInputs.ArcaneMageRotationConfig,
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [Stat.StatMP5],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [],
		// Preset rotations that the user can quickly select.
		rotations: Presets.ROTATION_PRESETS,
		// Preset talents that the user can quickly select.
		talents: Presets.TALENT_PRESETS,
		// Preset gear configurations that the user can quickly select.
		gear: Presets.GEAR_PRESETS,
	},

	autoRotation: (player: Player<Spec.SpecMage>): APLRotation => {
		// One rotation per tree (master's rule), so a build gets the spells it took talents for.
		const points = player.getTalentTreePoints();
		const tree = points.indexOf(Math.max(...points));
		return [Presets.ROTATION_PRESET_ARCANE, Presets.ROTATION_PRESET_FIRE, Presets.ROTATION_PRESET_FROST][tree].rotation.rotation!;
	},

	simpleRotation: (_player: Player<Spec.SpecMage>, simple: SpecRotation<Spec.SpecMage>, cooldowns: Cooldowns): APLRotation => {
		const actions = AplUtils.simpleCooldownActions(cooldowns);
		const rotation = APLRotation.clone(Presets.ROTATION_PRESET_ARCANE.rotation.rotation!);

		const { conserveStart = 20, conserveEnd = 30, delayMajorCDs = 10 } = simple;

		const conserveStartString = APLValueVariable.fromJson({
			name: 'Conserve Start',
			value: { const: { val: String(conserveStart) + '%' } },
		});

		const conserveEndString = APLValueVariable.fromJson({
			name: 'Conserve End',
			value: { const: { val: String(conserveEnd) + '%' } },
		});

		const delayMajorCDsString = APLValueVariable.fromJson({
			name: 'Delay Major CDs',
			value: { const: { val: String(delayMajorCDs) + 's' } },
		});

		rotation.valueVariables[0] = conserveStartString;
		rotation.valueVariables[1] = conserveEndString;
		rotation.valueVariables[2] = delayMajorCDsString;

		return APLRotation.create({
			prepullActions: rotation.prepullActions,
			priorityList: [
				...actions.map(action =>
					APLListItem.create({
						action: action,
					}),
				),
				...rotation.priorityList,
			],
			groups: rotation.groups,
			valueVariables: rotation.valueVariables,
		});
	},

	reforge: {},
});
