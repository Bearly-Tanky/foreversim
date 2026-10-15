import { Class, EquipmentSpec, ItemSpec, Profession, Race } from '@generated/proto/common';
import { nameToProfession } from '@sim/proto/names';
import type { TalentsConfig } from '@sim/talents/config';
import { serializeTalentsString } from '@sim/talents/talents_string';

// A character saved in the game by the ForeverSim addon (testground/server/addon), as the
// Forever Sim program serves it from /api/game/characters. Race and class come as the game's
// numeric IDs and talents as trait definition IDs, so no client language matters.

export interface GameItem {
	id: number;
	enchant?: number;
	gems?: number[];
	randomSuffix?: number;
}

export interface GameCharacter {
	name: string;
	realm: string;
	classID: number;
	raceID: number;
	sex?: number;
	level: number;
	gear: Record<string, GameItem>; // "slot0".."slot16", the sim's item slots
	talents?: Array<{ node: number; definition: number; ranks: number }>;
	professions?: Array<{ name: string; level: number; skillLine?: number }>;
	saved: number; // seconds since 1970
	account?: string;
}

// The game's race IDs (ChrRaces) → the sim's.
const RACE_BY_ID: Record<number, Race> = {
	1: Race.RaceHuman,
	2: Race.RaceOrc,
	3: Race.RaceDwarf,
	4: Race.RaceNightElf,
	5: Race.RaceUndead,
	6: Race.RaceTauren,
	7: Race.RaceGnome,
	8: Race.RaceTroll,
	10: Race.RaceBloodElf,
	95: Race.RaceHighOrderSkyborne,
	96: Race.RaceWindshaperSkyborne,
};

// Profession skill lines (SkillLine) → the sim's professions.
const PROFESSION_BY_SKILL_LINE: Record<number, Profession> = {
	171: Profession.Alchemy,
	164: Profession.Blacksmithing,
	333: Profession.Enchanting,
	202: Profession.Engineering,
	182: Profession.Herbalism,
	773: Profession.Inscription,
	755: Profession.Jewelcrafting,
	165: Profession.Leatherworking,
	186: Profession.Mining,
	393: Profession.Skinning,
	197: Profession.Tailoring,
};

const ITEM_SLOTS = 17;

export const gameRace = (character: GameCharacter): Race => RACE_BY_ID[character.raceID] ?? Race.RaceUnknown;

// The game's class IDs are the sim's.
export const gameClass = (character: GameCharacter): Class =>
	Object.values(Class).includes(character.classID) ? (character.classID as Class) : Class.ClassUnknown;

export const gameEquipment = (character: GameCharacter): EquipmentSpec =>
	EquipmentSpec.create({
		items: Array.from({ length: ITEM_SLOTS }, (_, slot) => {
			const item = character.gear?.[`slot${slot}`];
			if (!item?.id) return ItemSpec.create();
			return ItemSpec.create({
				id: item.id,
				enchant: item.enchant ?? 0,
				gems: (item.gems ?? []).filter((gem, i, all) => all.slice(i).some(g => g > 0)),
				randomSuffix: item.randomSuffix ?? 0,
			});
		}),
	});

export const gameProfessions = (character: GameCharacter): Profession[] =>
	(character.professions ?? [])
		.map(p => (p.skillLine && PROFESSION_BY_SKILL_LINE[p.skillLine]) || nameToProfession(p.name))
		.filter(p => p !== Profession.ProfessionUnknown)
		.slice(0, 2);

/**
 * The sim's talent string for the trait nodes the character bought: each sim talent knows its
 * trait definition, so ranks land on the right talent whatever the client's language. Ranks for
 * definitions the sim's trees do not have are reported back.
 */
export const gameTalents = (character: GameCharacter, trees: TalentsConfig<any>): { talentsString: string; unknown: number } => {
	const where = new Map<number, [number, number]>();
	trees.forEach((tree, t) => tree.talents.forEach((talent, i) => talent.definitionId && where.set(talent.definitionId, [t, i])));
	const points = trees.map(tree => tree.talents.map(() => 0));
	let unknown = 0;
	for (const { definition, ranks } of character.talents ?? []) {
		const at = where.get(definition);
		if (!at) {
			unknown += ranks;
			continue;
		}
		const [t, i] = at;
		points[t][i] = Math.min(ranks, trees[t].talents[i].maxPoints);
	}
	return { talentsString: serializeTalentsString(points), unknown };
};
