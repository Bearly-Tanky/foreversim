import { Class, Profession, Race } from '@generated/proto/common';
import { classTalentsConfig } from '@sim/talents/factory';
import { describe, expect, it } from 'vitest';

import { type GameCharacter, gameClass, gameEquipment, gameProfessions, gameRace, gameTalents } from './game';

const trees = classTalentsConfig[Class.ClassWarrior];
const [arms0, arms1] = trees[0].talents;
const fury2 = trees[1].talents[2];

const character: GameCharacter = {
	name: 'Thrall',
	realm: 'Nightslayer',
	classID: 1,
	raceID: 95,
	level: 60,
	saved: 0,
	gear: {
		slot0: { id: 12640, gems: [0, 0, 0, 0] },
		slot14: { id: 19019, enchant: 1900 },
		slot16: { id: 18323, randomSuffix: 1200 },
	},
	talents: [
		{ node: 1, definition: arms0.definitionId!, ranks: 3 },
		{ node: 2, definition: arms1.definitionId!, ranks: 99 },
		{ node: 3, definition: fury2.definitionId!, ranks: 1 },
		{ node: 4, definition: 999999999, ranks: 2 },
	],
	professions: [
		{ name: 'Herrería', level: 300, skillLine: 164 },
		{ name: 'Mining', level: 300 },
		{ name: 'Fishing', level: 10 },
	],
};

describe('the game importer', () => {
	it('reads race and class by their game IDs', () => {
		expect(gameRace(character)).toBe(Race.RaceHighOrderSkyborne);
		expect(gameRace({ ...character, raceID: 5 })).toBe(Race.RaceUndead);
		expect(gameClass(character)).toBe(Class.ClassWarrior);
		expect(gameClass({ ...character, classID: 6 })).toBe(Class.ClassUnknown);
	});

	it('puts items in the sim slots, empty slots empty', () => {
		const items = gameEquipment(character).items;
		expect(items).toHaveLength(17);
		expect(items[0]).toMatchObject({ id: 12640, gems: [] });
		expect(items[14]).toMatchObject({ id: 19019, enchant: 1900 });
		expect(items[16]).toMatchObject({ id: 18323, randomSuffix: 1200 });
		expect(items[1].id).toBe(0);
	});

	it('maps talents by trait definition, capping ranks and counting unknown ones', () => {
		const { talentsString, unknown } = gameTalents(character, trees);
		expect(talentsString).toBe(`3${Math.min(99, arms1.maxPoints)}-001`);
		expect(unknown).toBe(2);
	});

	it('reads professions by skill line first, then by English name', () => {
		expect(gameProfessions(character)).toEqual([Profession.Blacksmithing, Profession.Mining]);
	});
});
