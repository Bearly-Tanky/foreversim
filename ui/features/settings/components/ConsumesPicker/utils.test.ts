import type { ConsumableStatOption } from '@features/settings/model/consumables';
import { Class, ConsumableType, Spec, type Stat } from '@generated/proto/common';
import type { Consumable } from '@generated/proto/db';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { Database } from '@sim/proto/database';
import { describe, expect, it, vi } from 'vitest';

import { consumeConfigs } from './utils';

const MIGHTY_RAGE = 13442;

const consumable = (id: number): Consumable => ({ id, name: `item ${id}`, icon: `${id}.jpg` }) as Consumable;

// One item per type, so a config that reaches for the wrong list is visible in its value ids.
const LISTS: Partial<Record<ConsumableType, Array<Consumable>>> = {
	[ConsumableType.ConsumableTypePotion]: [consumable(76089), consumable(MIGHTY_RAGE)],
	[ConsumableType.ConsumableTypeFlask]: [consumable(76085)],
	[ConsumableType.ConsumableTypeBattleElixir]: [consumable(58148)],
	[ConsumableType.ConsumableTypeGuardianElixir]: [consumable(58090)],
	[ConsumableType.ConsumableTypeFood]: [consumable(74650)],
};

const db = { getConsumablesByTypeAndStats: vi.fn((type: ConsumableType) => LISTS[type] ?? []) } as unknown as Database;

const playerOf = (playerClass: Class, spec: Spec) =>
	({
		getClass: () => playerClass,
		getSpec: () => spec,
		getFaction: () => 1,
		getConsumes: () => ({
			potId: 2,
			conjuredId: 3,
			flaskId: 4,
			battleElixirId: 5,
			guardianElixirId: 6,
			foodId: 7,
			explosiveId: 8,
			mhImbueId: 9,
			ohImbueId: 10,
		}),
	}) as unknown as Player<any>;

const option = (value: number): ConsumableStatOption<number> => ({ stats: [], config: { actionId: ActionId.fromItemId(value), value } });

const build = (player: Player<any>) => consumeConfigs(player, db, [] as Array<Stat>, [option(5512)], [option(89637)], [option(28891)], [option(28891)]);

// The zero entry every list is built with; the ids after it are what the config actually offers.
const offered = (values: Array<{ value: number }>) => values.slice(1).map(entry => entry.value);

describe('consumeConfigs', () => {
	it('drops the Mighty Rage Potion for anyone but a warrior or a feral bear druid', () => {
		const mage = build(playerOf(Class.ClassMage, Spec.SpecMage));
		expect(offered(mage.potion.values)).toEqual([76089]);
	});

	it('keeps it for a warrior and for a feral bear druid', () => {
		expect(offered(build(playerOf(Class.ClassWarrior, Spec.SpecDpsWarrior)).potion.values)).toEqual([76089, MIGHTY_RAGE]);
		expect(offered(build(playerOf(Class.ClassDruid, Spec.SpecFeralBearDruid)).potion.values)).toEqual([76089, MIGHTY_RAGE]);
	});

	it('binds each picker to its own consumables field', () => {
		const player = playerOf(Class.ClassMage, Spec.SpecMage);
		const configs = build(player);
		expect({
			potion: configs.potion.getValue(player),
			conjured: configs.conjured.getValue(player),
			flask: configs.flask.getValue(player),
			battleElixir: configs.battleElixir.getValue(player),
			guardianElixir: configs.guardianElixir.getValue(player),
			food: configs.food.getValue(player),
			explosive: configs.explosive.getValue(player),
			mhImbue: configs.mhImbue.getValue(player),
			ohImbue: configs.ohImbue.getValue(player),
		}).toEqual({
			potion: 2,
			conjured: 3,
			flask: 4,
			battleElixir: 5,
			guardianElixir: 6,
			food: 7,
			explosive: 8,
			mhImbue: 9,
			ohImbue: 10,
		});
	});

	it('takes each list from its own consumable type, and the stat-option lists from their arguments', () => {
		const configs = build(playerOf(Class.ClassMage, Spec.SpecMage));
		expect(offered(configs.flask.values)).toEqual([76085]);
		expect(offered(configs.battleElixir.values)).toEqual([58148]);
		expect(offered(configs.guardianElixir.values)).toEqual([58090]);
		expect(offered(configs.food.values)).toEqual([74650]);
		expect(offered(configs.conjured.values)).toEqual([5512]);
		expect(offered(configs.explosive.values)).toEqual([89637]);
		expect(offered(configs.mhImbue.values)).toEqual([28891]);
		expect(offered(configs.ohImbue.values)).toEqual([28891]);
	});
});
