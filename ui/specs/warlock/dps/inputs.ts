import { Spec } from '@generated/proto/common';
import { WarlockOptions_Armor, WarlockOptions_CurseOptions, WarlockOptions_Summon as Summon } from '@generated/proto/warlock';
import i18n from '@i18n/config';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { WarlockSpecs } from '@sim/proto/spec_types';
import type { CustomSection } from '@sim/spec_config';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const PetInput = <SpecType extends WarlockSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, Summon>({
		fieldName: 'summon',
		values: [
			{ value: Summon.NoSummon, tooltip: 'No Pet' },
			{ actionId: ActionId.fromSpellId(691), value: Summon.Felhunter },
			{ actionId: ActionId.fromSpellId(688), value: Summon.Imp },
			{ actionId: ActionId.fromSpellId(712), value: Summon.Succubus },
			{ actionId: ActionId.fromSpellId(697), value: Summon.Voidwalker },
		],
		storeField: 'player:*' as const,
	});

// Demonic Pact keeps the buff of a demon sacrificed before the pull while `summon` is out.
export const PactSacrificeInput = <SpecType extends WarlockSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, Summon>({
		fieldName: 'pactSacrifice',
		values: [
			{ value: Summon.NoSummon, tooltip: 'No sacrifice' },
			{ actionId: ActionId.fromSpellId(18789), value: Summon.Imp },
			{ actionId: ActionId.fromSpellId(18791), value: Summon.Succubus },
			{ actionId: ActionId.fromSpellId(18792), value: Summon.Voidwalker },
		],
		showWhen: (player: Player<SpecType>) => player.getTalents().demonicPact && player.getTalents().demonicSacrifice,
		storeField: ['specOptions', 'talentsString'] as const,
	});

export const ArmorInput = <SpecType extends WarlockSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, WarlockOptions_Armor>({
		fieldName: 'armor',
		values: [
			{ value: WarlockOptions_Armor.NoArmor, tooltip: 'No Armor' },
			{ actionId: ActionId.fromSpellId(706), value: WarlockOptions_Armor.DemonArmor },
		],
	});

export const DemonicSacrificeInput = <SpecType extends WarlockSpecs>() =>
	InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
		fieldName: 'sacrificeSummon',
		id: ActionId.fromSpellId(18788),
		// `talentsString` too, because both accessors below read the talent. Without it, untalenting
		// Demonic Sacrifice leaves the icon lit and the sim reading a stale `sacrificeSummon`.
		storeField: ['specOptions', 'talentsString'] as const,
		getValue: (player: Player<SpecType>) =>
			player.getClassOptions().sacrificeSummon && player.getTalents().demonicSacrifice && player.getClassOptions().summon != Summon.NoSummon,
		setValue: (player: Player<SpecType>, newValue: boolean) => {
			const options = player.getClassOptions();
			options.sacrificeSummon = player.getTalents().demonicSacrifice ? newValue : false;
			player.setClassOptions(options);
		},
	});

const makeCursePicker = <SpecType extends WarlockSpecs>(curse: WarlockOptions_CurseOptions, spellId: number) =>
	InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
		fieldName: 'curseOptions',
		id: ActionId.fromSpellId(spellId),

		getValue: (player: Player<SpecType>) => player.getClassOptions().curseOptions === curse,

		setValue: (player: Player<SpecType>, newValue: boolean) => {
			if (!newValue) return;

			const newOptions = player.getClassOptions();
			newOptions.curseOptions = curse;

			player.setClassOptions(newOptions);
		},
	});

// The assigned-curse block is declared as data; `CustomSection` renders it from the settings tab.
export const CursesSection: CustomSection<Spec.SpecWarlock> = {
	id: 'assigned-curse-settings',
	title: i18n.t('settings_tab.other.warlock_assigned_curse.title'),
	description: i18n.t('settings_tab.other.warlock_assigned_curse.description'),
	iconInputs: [
		makeCursePicker<Spec.SpecWarlock>(WarlockOptions_CurseOptions.Agony, 11713),
		makeCursePicker<Spec.SpecWarlock>(WarlockOptions_CurseOptions.Doom, 603),
		makeCursePicker<Spec.SpecWarlock>(WarlockOptions_CurseOptions.Elements, 1311680),
		makeCursePicker<Spec.SpecWarlock>(WarlockOptions_CurseOptions.Recklessness, 704),
	],
};
