// The gear-planner hash is Wowhead's own format. Nothing about it is readable, so the test that
// means anything is a round trip: the *exporter* beside it carries an independent writer
// (`writeTalents`/`writeHash`), and every field the reader recovers has to come back out of what
// the writer put in.
import { WOWHEAD_DOMAIN } from '@sim/proto/wowhead';
import { describe, expect, it } from 'vitest';

import { createWowheadGearPlannerLink, type WowheadGearPlannerData } from '../exporters/wowhead_gear_planner';
import { parseWowheadGearLink } from './wowhead_gear_planner';

const link = (data: WowheadGearPlannerData, classId = 'warrior', raceId = 'human') =>
	`https://www.wowhead.com/${WOWHEAD_DOMAIN}/gear-planner/${classId}/${raceId}/${createWowheadGearPlannerLink(data)}`;

describe('parseWowheadGearLink', () => {
	it('recovers class and race from the path', () => {
		const parsed = parseWowheadGearLink(link({ level: 70, talents: '', items: [] }, 'death-knight', 'horde-blood-elf'));
		expect(parsed.classId).toBe('death-knight');
		expect(parsed.raceId).toBe('horde-blood-elf');
	});

	it('round-trips the three-tree talent string and the level', () => {
		const parsed = parseWowheadGearLink(link({ level: 70, talents: '05002001-0550000502-05032', items: [] }));
		expect(parsed.talentString).toBe('05002001-0550000502-05032');
		expect(parsed.level).toBe(70);
	});

	// An empty talent string writes three separators and nothing else, and must not come back as '---'.
	it('reads an empty talent string back as empty', () => {
		const parsed = parseWowheadGearLink(link({ level: 70, talents: '', items: [] }));
		expect(parsed.talentString).toBe('');
	});

	it('round-trips an item with an enchant, a random suffix and gems', () => {
		const parsed = parseWowheadGearLink(
			link({
				level: 70,
				talents: '05002001',
				items: [{ slotId: 1, itemId: 29011, enchantId: 28909, randomEnchantId: -5, gemItemIds: { 0: 24027, 1: 24061 } }],
			}),
		);
		expect(parsed.items).toEqual([{ slotId: 1, itemId: 29011, enchantId: 28909, randomEnchantId: -5, gemItemIds: [24027, 24061] }]);
	});

	it('round-trips a bare item, leaving the optional fields off', () => {
		const parsed = parseWowheadGearLink(link({ level: 70, talents: '05002001', items: [{ slotId: 16, itemId: 28773, gemItemIds: {} }] }));
		expect(parsed.items).toEqual([{ slotId: 16, itemId: 28773, enchantId: undefined, randomEnchantId: undefined, gemItemIds: [] }]);
	});

	// TBC has a ranged slot, which is slot id 18 and the last one the picker offers.
	it('round-trips a full seventeen-slot set, ranged included', () => {
		const items = Array.from({ length: 17 }, (_, index) => ({ slotId: index + 1, itemId: 28000 + index * 37, gemItemIds: {} }));
		const parsed = parseWowheadGearLink(link({ level: 70, talents: '05002001', items }));
		expect(parsed.items.map(item => [item.slotId, item.itemId])).toEqual(items.map(item => [item.slotId, item.itemId]));
	});

	it('rejects a link that is not a gear planner link', () => {
		expect(() => parseWowheadGearLink('https://www.wowhead.com/item=29011')).toThrow(/Invalid Wowhead Gear Planner URL/);
	});

	it('returns the class and race alone for a link with no hash', () => {
		const parsed = parseWowheadGearLink(`https://www.wowhead.com/${WOWHEAD_DOMAIN}/gear-planner/warrior/human`);
		expect(parsed.classId).toBe('warrior');
		expect(parsed.items).toEqual([]);
	});

	// The classic-engine site sent users to wowhead.com/classic/gear-planner. Its exporter wrote this
	// layout (version 6: gender, level, talents, then items with 24-bit enchant spell ids), so a
	// link built exactly as it built one has to come back out.
	it('reads a classic-engine Wowhead Classic link', () => {
		const talents = '5023000501-0050550501503051';
		let hex = talents.replaceAll('-', 'f') + 'f';
		if (hex.length % 2) hex += '0';
		const bytes = [6, 0, 60, hex.length / 2];
		for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substring(i, i + 2), 16));
		bytes.push(1 | 0x80, 0, 13404 >> 8, 13404 & 255, 0, 20034 >> 8, 20034 & 255); // head, enchanted
		bytes.push(16, 0, 18725 >> 8, 18725 & 255); // main hand, bare
		const hash = btoa(String.fromCharCode(...bytes))
			.replaceAll('/', '_')
			.replaceAll('+', '-')
			.replace(/=+$/, '');
		const parsed = parseWowheadGearLink(`https://www.wowhead.com/classic/gear-planner/hunter/troll/${hash}`);
		expect(parsed.classId).toBe('hunter');
		expect(parsed.level).toBe(60);
		expect(parsed.talentString).toBe(talents);
		expect(parsed.items).toEqual([
			{ slotId: 1, itemId: 13404, enchantId: 20034, randomEnchantId: undefined, gemItemIds: [] },
			{ slotId: 16, itemId: 18725, enchantId: undefined, randomEnchantId: undefined, gemItemIds: [] },
		]);
	});
});
