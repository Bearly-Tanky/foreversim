import { Debuffs } from '@generated/proto/buffs';
import { PseudoStat, Stat } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { Stats } from '../proto/stats';
import { Player } from './player';

// getDebuffStats reads nothing but the raid's debuffs, so the method is called against that one
// dependency rather than against a constructed Player, which needs a whole sim behind it.
const debuffStats = (debuffs: Partial<Debuffs>): Stats =>
	Player.prototype.getDebuffStats.call({
		sim: { raid: { getDebuffs: () => Debuffs.create(debuffs) } },
	} as unknown as Player<any>);

describe('Player.getDebuffStats', () => {
	// Judgement of the Crusader raises Holy damage taken and nothing else: Improved Seal of the
	// Crusader, the crit half, has no node in any Forever trait tree, so the sheet credits no crit.
	it('credits Judgement of the Crusader with no crit', () => {
		const stats = debuffStats({ judgementOfTheCrusader: true });

		expect(stats.getPseudoStat(PseudoStat.PseudoStatMeleeCritPercent)).toBe(0);
		expect(stats.getPseudoStat(PseudoStat.PseudoStatRangedCritPercent)).toBe(0);
		expect(stats.getPseudoStat(PseudoStat.PseudoStatSpellCritPercent)).toBe(0);
	});

	it('credits nothing for a debuff that moves no stat on the sheet', () => {
		const stats = debuffStats({ faerieFire: true });

		expect(stats.getPseudoStat(PseudoStat.PseudoStatMeleeCritPercent)).toBe(0);
		expect(stats.getPseudoStat(PseudoStat.PseudoStatRangedCritPercent)).toBe(0);
		expect(stats.getPseudoStat(PseudoStat.PseudoStatSpellCritPercent)).toBe(0);
	});

	// The number has to be the one HuntersMarkValue states in sim/core/debuffs_auto_gen.go,
	// or the sheet and the simulation disagree about the same debuff.
	it("credits Hunter's Mark with the ranged attack power spell 14325 states", () => {
		expect(debuffStats({ huntersMark: true }).getStat(Stat.StatRangedAttackPower)).toBe(71);
		expect(debuffStats({ huntersMark: false }).getStat(Stat.StatRangedAttackPower)).toBe(0);
	});
});
