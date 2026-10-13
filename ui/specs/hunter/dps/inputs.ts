import { HandType, ItemSlot, Spec } from '@generated/proto/common';
import { HunterOptions_Ammo, HunterOptions_PetAttackSpeed, HunterOptions_PetType, HunterOptions_QuiverBonus } from '@generated/proto/hunter';
import i18n from '@i18n/config';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { HunterSpecs } from '@sim/proto/spec_types';
import * as InputHelpers from '@ui-kit/input_helpers';

export const AmmoInput = <SpecType extends HunterSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, HunterOptions_Ammo>({
		fieldName: 'ammo',
		label: i18n.t('settings_tab.other.ammo.label'),
		labelTooltip: i18n.t('settings_tab.other.ammo.tooltip'),
		numColumns: 4,
		values: [
			{
				value: HunterOptions_Ammo.AmmoNone,
				tooltip: i18n.t('settings_tab.other.ammo.no_ammo'),
			},
			{
				actionId: ActionId.fromItemId(3030),
				value: HunterOptions_Ammo.RazorArrow,
				tooltip: i18n.t('settings_tab.other.ammo.razor_arrow'),
			},
			{
				actionId: ActionId.fromItemId(11285),
				value: HunterOptions_Ammo.JaggedArrow,
				tooltip: i18n.t('settings_tab.other.ammo.jagged_arrow'),
			},
			{
				actionId: ActionId.fromItemId(19316),
				value: HunterOptions_Ammo.IceThreadedArrow,
				tooltip: i18n.t('settings_tab.other.ammo.ice_threaded_arrow'),
			},
			{
				actionId: ActionId.fromItemId(18042),
				value: HunterOptions_Ammo.ThoriumHeadedArrow,
				tooltip: i18n.t('settings_tab.other.ammo.thorium_headed_arrow'),
			},
			{
				actionId: ActionId.fromItemId(12654),
				value: HunterOptions_Ammo.Doomshot,
				tooltip: i18n.t('settings_tab.other.ammo.doomshot'),
			},
			{
				actionId: ActionId.fromItemId(3033),
				value: HunterOptions_Ammo.SolidShot,
				tooltip: i18n.t('settings_tab.other.ammo.solid_shot'),
			},
			{
				actionId: ActionId.fromItemId(11284),
				value: HunterOptions_Ammo.AccurateSlugs,
				tooltip: i18n.t('settings_tab.other.ammo.accurate_slugs'),
			},
			{
				actionId: ActionId.fromItemId(19317),
				value: HunterOptions_Ammo.IceThreadedBullet,
				tooltip: i18n.t('settings_tab.other.ammo.ice_threaded_bullet'),
			},
			{
				actionId: ActionId.fromItemId(10513),
				value: HunterOptions_Ammo.MithrilGyroShot,
				tooltip: i18n.t('settings_tab.other.ammo.mithril_gyro_shot'),
			},
			{
				actionId: ActionId.fromItemId(11630),
				value: HunterOptions_Ammo.RockshardPellets,
				tooltip: i18n.t('settings_tab.other.ammo.rockshard_pellets'),
			},
			{
				actionId: ActionId.fromItemId(15997),
				value: HunterOptions_Ammo.ThoriumShells,
				tooltip: i18n.t('settings_tab.other.ammo.thorium_shells'),
			},
			{
				actionId: ActionId.fromItemId(13377),
				value: HunterOptions_Ammo.MiniatureCannonBalls,
				tooltip: i18n.t('settings_tab.other.ammo.miniature_cannon_balls'),
			},
		],
	});

export const QuiverInput = <SpecType extends HunterSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, HunterOptions_QuiverBonus>({
		extraClassNames: ['quiver-picker'],
		fieldName: 'quiverBonus',
		label: i18n.t('settings_tab.other.quiver.label'),
		labelTooltip: i18n.t('settings_tab.other.quiver.tooltip'),
		numColumns: 4,
		values: [
			{
				color: '82e89d',
				value: HunterOptions_QuiverBonus.QuiverNone,
				tooltip: i18n.t('settings_tab.other.quiver.no_quiver'),
			},
			{
				actionId: ActionId.fromItemId(18714),
				value: HunterOptions_QuiverBonus.Speed15,
				tooltip: i18n.t('settings_tab.other.quiver.speed_15'),
			},
			{
				actionId: ActionId.fromItemId(2662),
				value: HunterOptions_QuiverBonus.Speed14,
				tooltip: i18n.t('settings_tab.other.quiver.speed_14'),
			},
			{
				actionId: ActionId.fromItemId(8217),
				value: HunterOptions_QuiverBonus.Speed13,
				tooltip: i18n.t('settings_tab.other.quiver.speed_13'),
			},
			{
				actionId: ActionId.fromItemId(7371),
				value: HunterOptions_QuiverBonus.Speed12,
				tooltip: i18n.t('settings_tab.other.quiver.speed_12'),
			},
			{
				actionId: ActionId.fromItemId(3605),
				value: HunterOptions_QuiverBonus.Speed11,
				tooltip: i18n.t('settings_tab.other.quiver.speed_11'),
			},
			{
				actionId: ActionId.fromItemId(3573),
				value: HunterOptions_QuiverBonus.Speed10,
				tooltip: i18n.t('settings_tab.other.quiver.speed_10'),
			},
		],
	});

export const PetTypeInput = <SpecType extends HunterSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, HunterOptions_PetType>({
		extraClassNames: ['pet-type-picker'],
		fieldName: 'petType',
		label: i18n.t('settings_tab.other.pet_type.label'),
		labelTooltip: i18n.t('settings_tab.other.pet_type.tooltip'),
		numColumns: 4,
		values: [
			{
				value: HunterOptions_PetType.PetNone,
				actionId: ActionId.fromPetName(''),
				tooltip: i18n.t('settings_tab.other.pet_type.no_pet'),
			},
			{
				value: HunterOptions_PetType.Bat,
				actionId: ActionId.fromPetName('Bat'),
				tooltip: i18n.t('settings_tab.other.pet_type.bat'),
			},
			{
				value: HunterOptions_PetType.Bear,
				actionId: ActionId.fromPetName('Bear'),
				tooltip: i18n.t('settings_tab.other.pet_type.bear'),
			},
			{
				value: HunterOptions_PetType.Boar,
				actionId: ActionId.fromPetName('Boar'),
				tooltip: i18n.t('settings_tab.other.pet_type.boar'),
			},
			{
				value: HunterOptions_PetType.CarrionBird,
				actionId: ActionId.fromPetName('Carrion Bird'),
				tooltip: i18n.t('settings_tab.other.pet_type.carrion_bird'),
			},
			{
				value: HunterOptions_PetType.Cat,
				actionId: ActionId.fromPetName('Cat'),
				tooltip: i18n.t('settings_tab.other.pet_type.cat'),
			},
			{
				value: HunterOptions_PetType.Crab,
				actionId: ActionId.fromPetName('Crab'),
				tooltip: i18n.t('settings_tab.other.pet_type.crab'),
			},
			{
				value: HunterOptions_PetType.Crocolisk,
				actionId: ActionId.fromPetName('Crocolisk'),
				tooltip: i18n.t('settings_tab.other.pet_type.crocolisk'),
			},
			{
				value: HunterOptions_PetType.Gorilla,
				actionId: ActionId.fromPetName('Gorilla'),
				tooltip: i18n.t('settings_tab.other.pet_type.gorilla'),
			},
			{
				value: HunterOptions_PetType.Hyena,
				actionId: ActionId.fromPetName('Hyena'),
				tooltip: i18n.t('settings_tab.other.pet_type.hyena'),
			},
			{
				value: HunterOptions_PetType.Owl,
				actionId: ActionId.fromPetName('Owl'),
				tooltip: i18n.t('settings_tab.other.pet_type.owl'),
			},
			{
				value: HunterOptions_PetType.Raptor,
				actionId: ActionId.fromPetName('Raptor'),
				tooltip: i18n.t('settings_tab.other.pet_type.raptor'),
			},
			{
				value: HunterOptions_PetType.Scorpid,
				actionId: ActionId.fromPetName('Scorpid'),
				tooltip: i18n.t('settings_tab.other.pet_type.scorpid'),
			},
			{
				value: HunterOptions_PetType.Spider,
				actionId: ActionId.fromPetName('Spider'),
				tooltip: i18n.t('settings_tab.other.pet_type.spider'),
			},
			{
				value: HunterOptions_PetType.Tallstrider,
				actionId: ActionId.fromPetName('Tallstrider'),
				tooltip: i18n.t('settings_tab.other.pet_type.tallstrider'),
			},
			{
				value: HunterOptions_PetType.Turtle,
				actionId: ActionId.fromPetName('Turtle'),
				tooltip: i18n.t('settings_tab.other.pet_type.turtle'),
			},
			{
				value: HunterOptions_PetType.WindSerpent,
				actionId: ActionId.fromPetName('Wind Serpent'),
				tooltip: i18n.t('settings_tab.other.pet_type.wind_serpent'),
			},
			{
				value: HunterOptions_PetType.Wolf,
				actionId: ActionId.fromPetName('Wolf'),
				tooltip: i18n.t('settings_tab.other.pet_type.wolf'),
			},
		],
	});

export const PetAttackSpeedInput = () =>
	InputHelpers.makeClassOptionsEnumInput<Spec.SpecHunter, HunterOptions_PetAttackSpeed>({
		fieldName: 'petAttackSpeed',
		label: i18n.t('settings_tab.other.pet_attack_speed.label'),
		labelTooltip: i18n.t('settings_tab.other.pet_attack_speed.tooltip'),
		values: [
			{ name: '1.0', value: HunterOptions_PetAttackSpeed.One },
			{ name: '1.2', value: HunterOptions_PetAttackSpeed.OneTwo },
			{ name: '1.3', value: HunterOptions_PetAttackSpeed.OneThree },
			{ name: '1.4', value: HunterOptions_PetAttackSpeed.OneFour },
			{ name: '1.5', value: HunterOptions_PetAttackSpeed.OneFive },
			{ name: '1.6', value: HunterOptions_PetAttackSpeed.OneSix },
			{ name: '1.7', value: HunterOptions_PetAttackSpeed.OneSeven },
			{ name: '2.0', value: HunterOptions_PetAttackSpeed.Two },
			{ name: '2.4', value: HunterOptions_PetAttackSpeed.TwoFour },
			{ name: '2.5', value: HunterOptions_PetAttackSpeed.TwoFive },
		],
		showWhen: (player: Player<Spec.SpecHunter>) => player.getSpecOptions().classOptions!.petType != HunterOptions_PetType.PetNone,
	});

export const PetSingleAbility = () =>
	InputHelpers.makeClassOptionsBooleanInput<Spec.SpecHunter>({
		fieldName: 'petSingleAbility',
		label: i18n.t('settings_tab.other.pet_single_ability.label'),
		labelTooltip: i18n.t('settings_tab.other.pet_single_ability.tooltip'),
	});

export const PetUptime = () =>
	InputHelpers.makeClassOptionsNumberInput<Spec.SpecHunter>({
		fieldName: 'petUptime',
		label: i18n.t('settings_tab.other.pet_uptime.label'),
		labelTooltip: i18n.t('settings_tab.other.pet_uptime.tooltip'),
		percent: true,
	});

export const RotationInputs = {
	inputs: [
		InputHelpers.makeRotationNumberInput<Spec.SpecHunter>({
			fieldName: 'viperStartManaPercent',
			label: i18n.t('rotation_tab.options.hunter.viper_start_mana_percent.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.viper_start_mana_percent.tooltip'),
			percent: true,
			positive: true,
			max: 100,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecHunter>({
			fieldName: 'viperStopManaPercent',
			label: i18n.t('rotation_tab.options.hunter.viper_stop_mana_percent.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.viper_stop_mana_percent.tooltip'),
			percent: true,
			positive: true,
			max: 100,
		}),
		InputHelpers.makeRotationBooleanInput<Spec.SpecHunter>({
			fieldName: 'meleeWeave',
			label: i18n.t('rotation_tab.options.hunter.melee_weave.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.melee_weave.tooltip'),
			showWhen: (player: Player<Spec.SpecHunter>) => player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item?.handType === HandType.HandTypeTwoHand,
		}),
		InputHelpers.makeRotationNumberInput<Spec.SpecHunter>({
			fieldName: 'timeToWeave',
			label: i18n.t('rotation_tab.options.hunter.time_to_weave.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.time_to_weave.tooltip'),
			positive: true,
			showWhen: (player: Player<Spec.SpecHunter>) =>
				player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item?.handType === HandType.HandTypeTwoHand && player.getSimpleRotation().meleeWeave,
			storeField: ['rotation', 'gear'] as const,
		}),
		InputHelpers.makeRotationBooleanInput<Spec.SpecHunter>({
			fieldName: 'useMulti',
			label: i18n.t('rotation_tab.options.hunter.use_multi.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.use_multi.tooltip'),
		}),
		InputHelpers.makeRotationBooleanInput<Spec.SpecHunter>({
			fieldName: 'useArcane',
			label: i18n.t('rotation_tab.options.hunter.use_arcane.label'),
			labelTooltip: i18n.t('rotation_tab.options.hunter.use_arcane.tooltip'),
		}),
	],
};
