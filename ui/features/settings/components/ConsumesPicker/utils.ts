import type { ConsumableStatOption } from '@features/settings/model/consumables';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import { Class, ConsumableType, Spec, type Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import type { Database } from '@sim/proto/database';
import type { TypedIconEnumPickerConfig } from '@ui-kit/input_helpers';

export type ConsumeConfig = TypedIconEnumPickerConfig<Player<any>, number>;

export interface ConsumeConfigs {
	potion: ConsumeConfig;
	conjured: ConsumeConfig;
	flask: ConsumeConfig;
	battleElixir: ConsumeConfig;
	guardianElixir: ConsumeConfig;
	food: ConsumeConfig;
	spellPowerElixir: ConsumeConfig;
	schoolElixir: ConsumeConfig;
	defenseElixir: ConsumeConfig;
	strengthBuff: ConsumeConfig;
	attackPowerBuff: ConsumeConfig;
	zanza: ConsumeConfig;
	alcohol: ConsumeConfig;
	explosive: ConsumeConfig;
	mhImbue: ConsumeConfig;
	ohImbue: ConsumeConfig;
}

const potionsFor = (player: Player<any>, db: Database, stats: Array<Stat>) => {
	const potions = db.getConsumablesByTypeAndStats(ConsumableType.ConsumableTypePotion, stats);
	if (player.getClass() === Class.ClassWarrior || player.getSpec() === Spec.SpecFeralBearDruid) return potions;
	return potions.filter(potion => potion.id !== 13442);
};

export const consumeConfigs = (
	player: Player<any>,
	db: Database,
	consumableStats: ReadonlyArray<Stat>,
	conjuredOptions: ReadonlyArray<ConsumableStatOption<number>>,
	explosiveOptions: ReadonlyArray<ConsumableStatOption<number>>,
	imbueMHOptions: ReadonlyArray<ConsumableStatOption<number>>,
	imbueOHOptions: ReadonlyArray<ConsumableStatOption<number>>,
): ConsumeConfigs => {
	const stats = [...consumableStats];
	const byType = (type: ConsumableType) => db.getConsumablesByTypeAndStats(type, stats);
	const potions = potionsFor(player, db, stats);

	return {
		potion: ConsumablesInputs.makeConsumableInput(potions, { consumesFieldName: 'potId' }, i18n.t('settings_tab.consumables.potions.combat')),
		conjured: ConsumablesInputs.makeConjuredInput([...conjuredOptions]),
		flask: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeFlask), { consumesFieldName: 'flaskId' }, ''),
		battleElixir: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeBattleElixir), { consumesFieldName: 'battleElixirId' }, ''),
		guardianElixir: ConsumablesInputs.makeConsumableInput(
			byType(ConsumableType.ConsumableTypeGuardianElixir),
			{ consumesFieldName: 'guardianElixirId' },
			'',
		),
		food: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeFood), { consumesFieldName: 'foodId' }, ''),
		spellPowerElixir: ConsumablesInputs.makeConsumableInput(
			byType(ConsumableType.ConsumableTypeSpellPowerElixir),
			{ consumesFieldName: 'spellPowerElixirId' },
			'',
		),
		schoolElixir: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeSchoolElixir), { consumesFieldName: 'schoolElixirId' }, ''),
		defenseElixir: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeDefenseElixir), { consumesFieldName: 'defenseElixirId' }, ''),
		strengthBuff: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeStrengthBuff), { consumesFieldName: 'strengthBuffId' }, ''),
		attackPowerBuff: ConsumablesInputs.makeConsumableInput(
			byType(ConsumableType.ConsumableTypeAttackPowerBuff),
			{ consumesFieldName: 'attackPowerBuffId' },
			'',
		),
		zanza: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeZanza), { consumesFieldName: 'zanzaId' }, ''),
		alcohol: ConsumablesInputs.makeConsumableInput(byType(ConsumableType.ConsumableTypeAlcohol), { consumesFieldName: 'alcoholId' }, ''),
		explosive: ConsumablesInputs.makeExplosivesInput([...explosiveOptions], i18n.t('settings_tab.consumables.engineering.explosives')),
		mhImbue: ConsumablesInputs.makeMHImbueInput([...imbueMHOptions], i18n.t('settings_tab.consumables.imbue.mhImbue')),
		ohImbue: ConsumablesInputs.makeOHImbueInput([...imbueOHOptions], i18n.t('settings_tab.consumables.imbue.ohImbue')),
	};
};
