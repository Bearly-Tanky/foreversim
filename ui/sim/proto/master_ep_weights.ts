import { PseudoStat, Stat } from '@generated/proto/common';

import * as Mechanics from '../constants/mechanics';
import { Stats } from './stats';

// A spec's default EP weights as master (the Classic engine) writes them: primaries, power and
// resistances per point, hit/crit/haste/defense/avoidance per 1% (per defense level), in master's
// stat names. Kept in master's own terms so each spec's weights read line for line like master's.
export type MasterEpWeights = Partial<
	Record<
		| 'Strength'
		| 'Agility'
		| 'Stamina'
		| 'Intellect'
		| 'Spirit'
		| 'SpellPower'
		| 'ArcanePower'
		| 'FirePower'
		| 'FrostPower'
		| 'HolyPower'
		| 'NaturePower'
		| 'ShadowPower'
		| 'MP5'
		| 'Mana'
		| 'Health'
		| 'SpellHit'
		| 'SpellCrit'
		| 'SpellHaste'
		| 'AttackPower'
		| 'RangedAttackPower'
		| 'FeralAttackPower'
		| 'MeleeHit'
		| 'MeleeCrit'
		| 'Expertise'
		| 'Armor'
		| 'BonusArmor'
		| 'Defense'
		| 'Block'
		| 'BlockValue'
		| 'Dodge'
		| 'Parry'
		| 'FireResistance'
		| 'BonusPhysicalDamage'
		| 'MainHandDps'
		| 'OffHandDps'
		| 'RangedDps'
		| 'MeleeSpeedMultiplier'
		| 'RangedSpeedMultiplier',
		number
	>
>;

// Our weights are per rating point. Master's "spell power" items are our spell damage (the heal
// formula reads it too). Forever pays gear hit and crit into the melee and the spell pool alike
// (sim/core/forever_rules.go), and master's items carry them as both, so a point of either rating
// is worth master's melee and spell weight together.
export function masterEpWeights(w: MasterEpWeights): Stats {
	const v = (key: keyof MasterEpWeights) => w[key] ?? 0;
	const hit = v('MeleeHit') + v('SpellHit');
	const crit = v('MeleeCrit') + v('SpellCrit');
	return Stats.fromMap(
		{
			[Stat.StatStrength]: v('Strength'),
			[Stat.StatAgility]: v('Agility'),
			[Stat.StatStamina]: v('Stamina'),
			[Stat.StatIntellect]: v('Intellect'),
			[Stat.StatSpirit]: v('Spirit'),
			[Stat.StatSpellDamage]: v('SpellPower'),
			[Stat.StatArcaneDamage]: v('ArcanePower'),
			[Stat.StatFireDamage]: v('FirePower'),
			[Stat.StatFrostDamage]: v('FrostPower'),
			[Stat.StatHolyDamage]: v('HolyPower'),
			[Stat.StatNatureDamage]: v('NaturePower'),
			[Stat.StatShadowDamage]: v('ShadowPower'),
			[Stat.StatMP5]: v('MP5'),
			[Stat.StatMana]: v('Mana'),
			[Stat.StatHealth]: v('Health'),
			[Stat.StatMeleeHitRating]: hit / Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[Stat.StatSpellHitRating]: hit / Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
			[Stat.StatMeleeCritRating]: crit / Mechanics.PHYSICAL_CRIT_RATING_PER_CRIT_PERCENT,
			[Stat.StatSpellCritRating]: crit / Mechanics.SPELL_CRIT_RATING_PER_CRIT_PERCENT,
			[Stat.StatSpellHasteRating]: v('SpellHaste') / Mechanics.SPELL_HASTE_RATING_PER_HASTE_PERCENT,
			[Stat.StatAttackPower]: v('AttackPower'),
			[Stat.StatRangedAttackPower]: v('RangedAttackPower'),
			[Stat.StatFeralAttackPower]: v('FeralAttackPower'),
			[Stat.StatExpertiseRating]: v('Expertise') / Mechanics.EXPERTISE_RATING_PER_EXPERTISE_PERCENT,
			[Stat.StatArmor]: v('Armor'),
			[Stat.StatBonusArmor]: v('BonusArmor'),
			[Stat.StatDefenseRating]: v('Defense') / Mechanics.DEFENSE_RATING_PER_DEFENSE_LEVEL,
			[Stat.StatBlockRating]: v('Block') / Mechanics.BLOCK_RATING_PER_BLOCK_PERCENT,
			[Stat.StatBlockValue]: v('BlockValue'),
			[Stat.StatDodgeRating]: v('Dodge') / Mechanics.DODGE_RATING_PER_DODGE_PERCENT,
			[Stat.StatParryRating]: v('Parry') / Mechanics.PARRY_RATING_PER_PARRY_PERCENT,
			[Stat.StatFireResistance]: v('FireResistance'),
			[Stat.StatPhysicalDamage]: v('BonusPhysicalDamage'),
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: v('MainHandDps'),
			[PseudoStat.PseudoStatOffHandDps]: v('OffHandDps'),
			[PseudoStat.PseudoStatRangedDps]: v('RangedDps'),
			[PseudoStat.PseudoStatMeleeSpeedMultiplier]: v('MeleeSpeedMultiplier'),
			[PseudoStat.PseudoStatRangedSpeedMultiplier]: v('RangedSpeedMultiplier'),
		},
	);
}
