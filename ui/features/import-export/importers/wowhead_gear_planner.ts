import { Class, EquipmentSpec, ItemSlot, ItemSpec, Profession, Race } from '@generated/proto/common';
import i18n from '@i18n/config';
import { CHARACTER_LEVEL } from '@sim/constants/mechanics';
import { nameToClass, nameToRace } from '@sim/proto/names';
import { WOWHEAD_DOMAIN, WOWHEAD_GEAR_PLANNER_URL } from '@sim/proto/wowhead';

import { finishIndividualImport } from './finish_individual_import';
import type { ImporterDefinition } from './types';

interface WowheadGearPlannerImportJSON {
	classId: string;
	raceId: string;
	genderId: number;
	level: number;
	specIndex: number;
	talentString: string;
	items: {
		slotId: number;
		itemId: number;
		randomEnchantId?: number;
		gemItemIds: number[];
		enchantId?: number;
	}[];
}

// Talent digits packed two per byte, 0xf closing each tree.
function readTalents(bytes: number[]): string {
	let talents = '';
	let trees = 0;
	for (const nibble of bytes.flatMap(b => [b >> 4, b & 15])) {
		if (trees >= 3) break;
		if (nibble === 15) {
			talents += '-';
			trees++;
		} else {
			talents += nibble;
		}
	}
	return talents.replace(/-+$/, '');
}

// Taken from Wowhead
function readHash(hash: string): WowheadGearPlannerImportJSON {
	const enchantOffset = 128;
	const randomEnchantOffset = 64;

	const t: WowheadGearPlannerImportJSON = {
		classId: '',
		raceId: '',
		genderId: 0,
		level: 0,
		specIndex: 0,
		talentString: '',
		items: [],
	};
	const l = /^([a-z-]+)\/([a-z-]+)(?:\/([a-zA-Z0-9_-]+))?$/.exec(hash);
	if (!l) return t;

	t.classId = l[1];
	t.raceId = l[2];

	t.level = CHARACTER_LEVEL;

	if (!l[3]) return t;

	const gearPlannerString = l[3].replace(/-/g, '+').replace(/_/g, '/');
	const gearPlannerHash = atob(gearPlannerString);
	const gearPlannerBits: number[] = [];
	for (let e = 0; e < gearPlannerHash.length; e++) {
		gearPlannerBits.push(gearPlannerHash.charCodeAt(e));
	}

	const r = gearPlannerBits.shift()!;
	if (r >= 4) {
		// Wowhead Classic's layout, the one the classic-engine site imported and exported: a gender
		// byte before the level, and 24-bit enchant spell ids.
		t.genderId = gearPlannerBits.shift()!;
		t.level = gearPlannerBits.shift()!;
		t.talentString = readTalents(gearPlannerBits.splice(0, gearPlannerBits.shift()!));
		while (gearPlannerBits.length >= 4) {
			const slotBits = gearPlannerBits.shift()!;
			const gemBits = gearPlannerBits.shift()!;
			const item: WowheadGearPlannerImportJSON['items'][number] = {
				slotId: slotBits & ~enchantOffset & ~randomEnchantOffset,
				itemId: ((gemBits & 31) << 16) | (gearPlannerBits.shift()! << 8) | gearPlannerBits.shift()!,
				randomEnchantId: undefined,
				gemItemIds: [],
				enchantId: undefined,
			};
			if (slotBits & enchantOffset) {
				item.enchantId = (gearPlannerBits.shift()! << 16) | (gearPlannerBits.shift()! << 8) | gearPlannerBits.shift()!;
			}
			if (slotBits & randomEnchantOffset) {
				const randomEnchantId = (gearPlannerBits.shift()! << 8) | gearPlannerBits.shift()!;
				item.randomEnchantId = randomEnchantId & 32768 ? randomEnchantId - 65536 : randomEnchantId;
			}
			t.items.push(item);
		}
		return t;
	}
	if (r < 4) {
		if (r > 0) {
			t.level = gearPlannerBits.shift()!;
		}
		t.talentString = '';
		if (r > 1) {
			t.talentString = readTalents(gearPlannerBits.splice(0, gearPlannerBits.shift()!));
		}
		while (gearPlannerBits.length >= 3) {
			let slotIdx = gearPlannerBits.shift()!;
			let n = 0;
			let itemID = 0;
			if (r >= 3) {
				const e = gearPlannerBits.shift()!;
				n = (e & 224) >> 5;
				itemID |= (e & 31) << 16;
			}
			itemID |= gearPlannerBits.shift()! << 8;
			itemID |= gearPlannerBits.shift()!;
			const o = (slotIdx & enchantOffset) > 0;
			const c = (slotIdx & randomEnchantOffset) > 0;
			slotIdx = slotIdx & ~enchantOffset & ~randomEnchantOffset;
			const item: WowheadGearPlannerImportJSON['items'][number] = {
				slotId: slotIdx,
				itemId: itemID,
				randomEnchantId: undefined,
				gemItemIds: [],
				enchantId: undefined,
			};

			if (o) {
				let enchantId = gearPlannerBits.shift()! << 8;
				enchantId |= gearPlannerBits.shift()!;
				item.enchantId = enchantId;
			}
			if (c) {
				let randomEnchantId = gearPlannerBits.shift()! << 8;
				randomEnchantId |= gearPlannerBits.shift()!;
				if ((randomEnchantId & 32768) > 0) {
					randomEnchantId -= 65536;
				}
				item.randomEnchantId = randomEnchantId;
			}
			while (n--) {
				let gemID = 0;
				const s = gearPlannerBits.shift()!;
				gemID |= (s & 31) << 16;
				gemID |= gearPlannerBits.shift()! << 8;
				gemID |= gearPlannerBits.shift()!;
				item.gemItemIds.push(gemID);
			}
			t.items.push(item);
		}
	}

	return t;
}

export function parseWowheadGearLink(link: string): WowheadGearPlannerImportJSON {
	const match = link.match(new RegExp(`(?:${WOWHEAD_DOMAIN}|classic)/gear-planner/(.+)`));
	if (!match) {
		throw new Error(`Invalid Wowhead Gear Planner URL ${link}, must look like "${WOWHEAD_GEAR_PLANNER_URL}/CLASS/RACE/XXXX"`);
	}
	return readHash(match[1]);
}

export const WOWHEAD_SLOT_IDS: Record<ItemSlot, number> = {
	[ItemSlot.ItemSlotHead]: 1,
	[ItemSlot.ItemSlotNeck]: 2,
	[ItemSlot.ItemSlotShoulder]: 3,
	[ItemSlot.ItemSlotBack]: 15,
	[ItemSlot.ItemSlotChest]: 5,
	[ItemSlot.ItemSlotWrist]: 9,
	[ItemSlot.ItemSlotHands]: 10,
	[ItemSlot.ItemSlotWaist]: 6,
	[ItemSlot.ItemSlotLegs]: 7,
	[ItemSlot.ItemSlotFeet]: 8,
	[ItemSlot.ItemSlotFinger1]: 11,
	[ItemSlot.ItemSlotFinger2]: 12,
	[ItemSlot.ItemSlotTrinket1]: 13,
	[ItemSlot.ItemSlotTrinket2]: 14,
	[ItemSlot.ItemSlotMainHand]: 16,
	[ItemSlot.ItemSlotOffHand]: 17,
	[ItemSlot.ItemSlotRanged]: 18,
};

export const WOWHEAD_GEAR_PLANNER_IMPORTER: ImporterDefinition = {
	title: i18n.t('import.wowhead.title'),
	allowFileUpload: true,
	onImport: async (host, url) => {
		const match = url.match(new RegExp(`www\\.wowhead\\.com/(?:${WOWHEAD_DOMAIN}|classic)/gear-planner/([a-z\\-]+)/([a-z\\-]+)/([a-zA-Z0-9_\\-]+)`));
		if (!match) {
			throw new Error(i18n.t('import.wowhead.error_invalid_url', { url }));
		}
		const missingItems: number[] = [];
		const missingEnchants: number[] = [];
		const professions: Profession[] = [];

		const parsed = parseWowheadGearLink(url);
		const charClass = nameToClass(parsed.classId.replaceAll('-', ''));
		if (charClass == Class.ClassUnknown) {
			throw new Error(i18n.t('import.wowhead.error_cannot_parse_class', { classId: parsed.classId }));
		}

		const converWowheadRace = (raceId: string): string => {
			const allianceSuffix = raceId.startsWith('alliance-') ? ' (A)' : undefined;
			const hordeSuffix = raceId.startsWith('horde-') ? ' (H)' : undefined;
			return raceId.replaceAll('alliance', '').replaceAll('horde', '').replaceAll('-', '') + (allianceSuffix ?? hordeSuffix ?? '');
		};

		const race = nameToRace(converWowheadRace(parsed.raceId));
		if (race == Race.RaceUnknown) {
			throw new Error(i18n.t('import.wowhead.error_cannot_parse_race', { raceId: parsed.raceId }));
		}

		const equipmentSpec = EquipmentSpec.create();

		parsed.items.forEach(item => {
			const dbItem = host.sim.db.getItemById(item.itemId);
			if (!dbItem) {
				missingItems.push(item.itemId);
				return;
			}
			const itemSpec = ItemSpec.create();
			itemSpec.id = item.itemId;
			const slotId = item.slotId;
			if (item.enchantId) {
				const enchant = host.sim.db.enchantSpellIdToEnchant(item.enchantId);
				if (!enchant) {
					missingEnchants.push(item.enchantId);
					return;
				}
				itemSpec.enchant = enchant.effectId;
			}
			if (item.gemItemIds) {
				itemSpec.gems = item.gemItemIds;
			}
			if (item.randomEnchantId) {
				itemSpec.randomSuffix = item.randomEnchantId;
			}
			const itemSlotEntry = Object.entries(WOWHEAD_SLOT_IDS).find(e => e[1] == slotId);
			if (itemSlotEntry != null) {
				equipmentSpec.items.push(itemSpec);
			}
		});

		await finishIndividualImport(host, {
			charClass,
			race,
			equipmentSpec,
			talentsStr: parsed.talentString ?? '',
			professions,
			missingEnchants,
			missingItems,
		});
	},
};
