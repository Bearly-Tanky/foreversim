import { ConsumesSpec, Stat } from '@generated/proto/common';
import type { Player } from '@sim/player/player';
import { describe, expect, it, vi } from 'vitest';

import * as ConsumablesInputs from './consumables';

interface FakeGear {
	sharpMH?: boolean;
	bluntMH?: boolean;
	sharpOH?: boolean;
	bluntOH?: boolean;
	mh?: boolean;
	oh?: boolean;
}

const playerWith = (options: { consumes?: Partial<ConsumesSpec>; ep?: Partial<Record<Stat, number>>; gear?: FakeGear } = {}) => {
	const consumes = ConsumesSpec.create(options.consumes ?? {});
	const setConsumes = vi.fn();
	const gear = options.gear ?? {};
	const player = {
		getConsumes: () => consumes,
		setConsumes,
		getEpWeights: () => ({ getStat: (stat: Stat) => options.ep?.[stat] ?? 0 }),
		getGear: () => ({
			hasSharpMHWeapon: () => !!gear.sharpMH,
			hasBluntMHWeapon: () => !!gear.bluntMH,
			hasSharpOHWeapon: () => !!gear.sharpOH,
			hasBluntOHWeapon: () => !!gear.bluntOH,
			hasMHWeapon: () => !!gear.mh,
			hasOHWeapon: () => !!gear.oh,
		}),
	} as unknown as Player<any>;
	return { player, consumes, setConsumes };
};

const SCROLLS = [
	{ name: 'agility', input: ConsumablesInputs.ScrollAgi, field: 'scrollAgi', stat: Stat.StatAgility, item: 10309 },
	{ name: 'strength', input: ConsumablesInputs.ScrollStr, field: 'scrollStr', stat: Stat.StatStrength, item: 10310 },
	{ name: 'intellect', input: ConsumablesInputs.ScrollInt, field: 'scrollInt', stat: Stat.StatIntellect, item: 10308 },
	{ name: 'spirit', input: ConsumablesInputs.ScrollSpi, field: 'scrollSpi', stat: Stat.StatSpirit, item: 10306 },
	{ name: 'protection', input: ConsumablesInputs.ScrollArm, field: 'scrollArm', stat: Stat.StatArmor, item: 10305 },
] as const;

describe('scroll consumable inputs', () => {
	it.each(SCROLLS)('binds the $name scroll to its own consumables field', ({ input, field }) => {
		const set = playerWith();
		expect(input.getValue(set.player)).toBe(false);
		input.setValue!(set.player, true);
		expect(set.setConsumes).toHaveBeenCalledWith(expect.objectContaining({ [field]: true }));

		const other = playerWith({ consumes: { [field]: true } });
		expect(input.getValue(other.player)).toBe(true);
		for (const scroll of SCROLLS) {
			expect(scroll.input.getValue(other.player)).toBe(scroll.field === field);
		}
	});

	it.each(SCROLLS)('shows the $name scroll only when that stat is worth something', ({ input, stat }) => {
		expect(input.showWhen!(playerWith().player)).toBe(false);
		expect(input.showWhen!(playerWith({ ep: { [stat]: 1 } }).player)).toBe(true);
	});

	it('points each scroll at its rank IV item', () => {
		for (const scroll of SCROLLS) {
			expect(scroll.input.actionId!.itemId).toBe(scroll.item);
		}
	});
});

describe('weapon stone imbue options', () => {
	const shown = (config: { showWhen?: (player: Player<any>) => boolean }, gear: FakeGear) => !!config.showWhen?.(playerWith({ gear }).player);

	it('offers the Dense stones by weapon family, per hand', () => {
		expect(shown(ConsumablesInputs.DenseSharpeningStoneMH, { sharpMH: true })).toBe(true);
		expect(shown(ConsumablesInputs.DenseSharpeningStoneMH, { bluntMH: true })).toBe(false);
		expect(shown(ConsumablesInputs.DenseWeightstoneMH, { bluntMH: true })).toBe(true);
		expect(shown(ConsumablesInputs.DenseWeightstoneMH, { sharpMH: true })).toBe(false);
		expect(shown(ConsumablesInputs.DenseSharpeningStoneOH, { sharpOH: true })).toBe(true);
		expect(shown(ConsumablesInputs.DenseSharpeningStoneOH, { sharpMH: true })).toBe(false);
		expect(shown(ConsumablesInputs.DenseWeightstoneOH, { bluntOH: true })).toBe(true);
		expect(shown(ConsumablesInputs.DenseWeightstoneOH, { bluntMH: true })).toBe(false);
	});

	it('offers the Elemental stone on any weapon', () => {
		expect(shown(ConsumablesInputs.ElementalSharpeningStoneMH, { mh: true })).toBe(true);
		expect(shown(ConsumablesInputs.ElementalSharpeningStoneMH, {})).toBe(false);
		expect(shown(ConsumablesInputs.ElementalSharpeningStoneOH, { oh: true })).toBe(true);
		expect(shown(ConsumablesInputs.ElementalSharpeningStoneOH, {})).toBe(false);
	});

	it('keys every imbue on the spell its item casts', () => {
		const byItem = new Map(
			[...ConsumablesInputs.IMBUE_CONFIG_MH, ...ConsumablesInputs.IMBUE_CONFIG_OH].map(option => [option.config.actionId.itemId, option.config.value]),
		);
		expect(byItem.get(12404)).toBe(16138);
		expect(byItem.get(12643)).toBe(16622);
		expect(byItem.get(18262)).toBe(22756);
		expect(byItem.get(20750)).toBe(25121);
		expect(byItem.get(23123)).toBe(28898);
	});
});

describe('explosive options', () => {
	it('keys the new explosives on their damage spell and needs Engineering', () => {
		expect(ConsumablesInputs.ThoriumGrenade).toMatchObject({ value: 19769 });
		expect(ConsumablesInputs.ThoriumGrenade.actionId.itemId).toBe(15993);
		expect(ConsumablesInputs.DenseDynamite).toMatchObject({ value: 23063 });
		expect(ConsumablesInputs.DenseDynamite.actionId.itemId).toBe(18641);

		const noProfession = { hasProfession: () => false } as unknown as Player<any>;
		const engineer = { hasProfession: () => true } as unknown as Player<any>;
		for (const config of [ConsumablesInputs.ThoriumGrenade, ConsumablesInputs.DenseDynamite]) {
			expect(config.showWhen(noProfession)).toBe(false);
			expect(config.showWhen(engineer)).toBe(true);
		}
	});
});
