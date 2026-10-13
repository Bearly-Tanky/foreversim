import { ArmorType, HandType, ItemSlot, ItemType, PseudoStat, Stat, WeaponType } from '@generated/proto/common';
import { UIItem } from '@generated/proto/ui';
import { PlayerSpecs } from '@sim/player/specs';
import { Stats } from '@sim/proto/stats';
import { describe, expect, it } from 'vitest';

import { computeItemEP, rankGear } from './gear';

let nextId = 1;
const item = (fields: Partial<UIItem>, stats: Partial<Record<Stat, number>> = {}, weapon?: { min: number; max: number }) =>
	UIItem.create({
		id: nextId++,
		name: `item ${nextId}`,
		...fields,
		scalingOptions: { 0: { stats, ilvl: 60, randPropPoints: 0, weaponDamageMin: weapon?.min ?? 0, weaponDamageMax: weapon?.max ?? 0 } },
	});

const warrior = PlayerSpecs.fromProto(PlayerSpecs.DpsWarrior.specID);
const strength = (mh: number, oh: number) =>
	Stats.fromMap({ [Stat.StatStrength]: 1 }, { [PseudoStat.PseudoStatMainHandDps]: mh, [PseudoStat.PseudoStatOffHandDps]: oh });
const noSuffix = () => undefined;

describe('computeItemEP', () => {
	it('reads stats off the base scaling entry and docks a unique item a hair', () => {
		const plain = item({ type: ItemType.ItemTypeNeck }, { [Stat.StatStrength]: 10 });
		const unique = item({ type: ItemType.ItemTypeNeck, unique: true }, { [Stat.StatStrength]: 10 });
		expect(computeItemEP(plain, strength(0, 0), ItemSlot.ItemSlotNeck, noSuffix)).toBe(10);
		expect(computeItemEP(unique, strength(0, 0), ItemSlot.ItemSlotNeck, noSuffix)).toBeCloseTo(9.99);
	});
});

describe('rankGear', () => {
	const plate = item({ type: ItemType.ItemTypeHead, armorType: ArmorType.ArmorTypePlate }, { [Stat.StatStrength]: 5 });
	const cloth = item({ type: ItemType.ItemTypeHead, armorType: ArmorType.ArmorTypeCloth }, { [Stat.StatStrength]: 50 });
	const ringA = item({ type: ItemType.ItemTypeFinger, name: 'Ring' }, { [Stat.StatStrength]: 9 });
	const ringB = item({ type: ItemType.ItemTypeFinger, name: 'Ring' }, { [Stat.StatStrength]: 8 });
	const ringC = item({ type: ItemType.ItemTypeFinger, name: 'Other ring' }, { [Stat.StatStrength]: 1 });
	const oneHand = (strengthOn: number) =>
		item(
			{ type: ItemType.ItemTypeWeapon, weaponType: WeaponType.WeaponTypeSword, handType: HandType.HandTypeOneHand, weaponSpeed: 2 },
			{ [Stat.StatStrength]: strengthOn },
			{ min: 20, max: 20 },
		);
	const twoHand = item(
		{ type: ItemType.ItemTypeWeapon, weaponType: WeaponType.WeaponTypeSword, handType: HandType.HandTypeTwoHand, weaponSpeed: 2 },
		{},
		{ min: 60, max: 60 },
	);
	const items = [plate, cloth, ringA, ringB, ringC, oneHand(1), oneHand(2), twoHand];
	const slot = (gear: ReturnType<typeof rankGear>, itemSlot: ItemSlot) => gear.slots.find(ranking => ranking.slot === itemSlot)!;

	it('keeps armour to the class type and pairs rings by distinct name', () => {
		const gear = rankGear(warrior, strength(1, 1), items, noSuffix);
		expect(slot(gear, ItemSlot.ItemSlotHead).ranked.map(r => r.item.id)).toEqual([plate.id]);
		expect(slot(gear, ItemSlot.ItemSlotFinger1).ranked.map(r => r.item.id)).toEqual([ringA.id, ringC.id]);
		expect(slot(gear, ItemSlot.ItemSlotFinger2).ranked.map(r => r.item.id)).toEqual([ringC.id]);
	});

	it('takes the two hander only when it beats a one hander and off hand together', () => {
		// Each one hander is 10 dps (+1 or 2 strength); the two hander is 30 dps.
		const dualWield = rankGear(warrior, strength(1, 1), items, noSuffix);
		expect(slot(dualWield, ItemSlot.ItemSlotMainHand).ranked[0].item.id).toBe(twoHand.id);
		expect(slot(dualWield, ItemSlot.ItemSlotOffHand).note).toMatch(/two hander/);

		const offHandWorthMore = rankGear(warrior, strength(1, 3), items, noSuffix);
		expect(slot(offHandWorthMore, ItemSlot.ItemSlotMainHand).ranked[0].item.handType).toBe(HandType.HandTypeOneHand);
		expect(slot(offHandWorthMore, ItemSlot.ItemSlotOffHand).ranked.length).toBeGreaterThan(0);
	});
});
