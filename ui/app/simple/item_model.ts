import { ItemSlot, Stat } from '@generated/proto/common';
import type { UIEnchant as Enchant, UIItem as Item } from '@generated/proto/ui';

// Short stat labels for the item picker's one-line summaries; the hover tooltip has the full text.
// A melee/spell pair that carries the same number is one "Hit" (Forever's combined hit rating).
const PAIRS: Array<{ label: string; melee: Stat; spell: Stat }> = [
	{ label: 'Hit', melee: Stat.StatMeleeHitRating, spell: Stat.StatSpellHitRating },
	{ label: 'Crit', melee: Stat.StatMeleeCritRating, spell: Stat.StatSpellCritRating },
	{ label: 'Haste', melee: Stat.StatMeleeHasteRating, spell: Stat.StatSpellHasteRating },
];

const SINGLES: Array<{ label: string; stat: Stat }> = [
	{ label: 'Str', stat: Stat.StatStrength },
	{ label: 'Agi', stat: Stat.StatAgility },
	{ label: 'Sta', stat: Stat.StatStamina },
	{ label: 'Int', stat: Stat.StatIntellect },
	{ label: 'Spi', stat: Stat.StatSpirit },
	{ label: 'AP', stat: Stat.StatAttackPower },
	{ label: 'Ranged AP', stat: Stat.StatRangedAttackPower },
	{ label: 'Spell power', stat: Stat.StatSpellDamage },
	{ label: 'Healing', stat: Stat.StatHealingPower },
	{ label: 'Expertise', stat: Stat.StatExpertiseRating },
	{ label: 'Armor pen', stat: Stat.StatArmorPenetration },
	{ label: 'Defense', stat: Stat.StatDefenseRating },
	{ label: 'Dodge', stat: Stat.StatDodgeRating },
	{ label: 'Parry', stat: Stat.StatParryRating },
	{ label: 'Block', stat: Stat.StatBlockRating },
	{ label: 'Block value', stat: Stat.StatBlockValue },
];

const SCHOOL_DAMAGE: Array<{ label: string; stat: Stat }> = [
	{ label: 'Arcane dmg', stat: Stat.StatArcaneDamage },
	{ label: 'Fire dmg', stat: Stat.StatFireDamage },
	{ label: 'Frost dmg', stat: Stat.StatFrostDamage },
	{ label: 'Holy dmg', stat: Stat.StatHolyDamage },
	{ label: 'Nature dmg', stat: Stat.StatNatureDamage },
	{ label: 'Shadow dmg', stat: Stat.StatShadowDamage },
];

/** "18 Str · 20 Hit · 28 Crit", in a fixed order, at most `limit` entries. */
export const statSummary = (stats: ReadonlyArray<number>, limit = 5): string => {
	const value = (stat: Stat) => stats[stat] ?? 0;
	const parts: Array<string> = [];
	for (const { label, stat } of SINGLES.slice(0, 5)) {
		if (value(stat)) parts.push(`${Math.round(value(stat))} ${label}`);
	}
	for (const { label, melee, spell } of PAIRS) {
		const meleeValue = value(melee);
		const spellValue = value(spell);
		if (meleeValue && (meleeValue === spellValue || !spellValue)) parts.push(`${Math.round(meleeValue)} ${label}`);
		else if (spellValue && !meleeValue) parts.push(`${Math.round(spellValue)} Spell ${label.toLowerCase()}`);
		else if (meleeValue && spellValue) parts.push(`${Math.round(meleeValue)} ${label}`, `${Math.round(spellValue)} Spell ${label.toLowerCase()}`);
	}
	for (const { label, stat } of [...SINGLES.slice(5), ...SCHOOL_DAMAGE]) {
		if (value(stat)) parts.push(`${Math.round(value(stat))} ${label}`);
	}
	return parts.slice(0, limit).join(' · ');
};

export const weaponSummary = (item: Item): string | null => {
	if (!item.weaponSpeed) return null;
	const dps = (item.weaponDamageMin + item.weaponDamageMax) / 2 / item.weaponSpeed;
	return `${dps.toFixed(1)} DPS · ${item.weaponSpeed.toFixed(2)} speed`;
};

export const itemSummary = (item: Item): string => {
	const ilvl = item.scalingOptions?.[0]?.ilvl || item.ilvl;
	return [ilvl ? `Item level ${ilvl}` : '', weaponSummary(item) ?? '', statSummary(item.stats)].filter(Boolean).join(' · ');
};

export const enchantSummary = (enchant: Enchant): string => statSummary(enchant.stats, 3);

/** Trinkets mostly do their work through procs and on-use effects, which the stat score cannot see. */
export const isScoredSlot = (slot: ItemSlot): boolean => slot !== ItemSlot.ItemSlotTrinket1 && slot !== ItemSlot.ItemSlotTrinket2;

export const matchesQuery = (name: string, query: string): boolean => {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	const lower = name.toLowerCase();
	return words.every(word => lower.includes(word));
};
