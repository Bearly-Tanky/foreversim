import { OtherAction, Spec, TristateEffect } from '@generated/proto/common';
import { ActionId } from '@sim/proto/action_id';
import type { SpecDefinition } from '@sim/spec_config';
import { allSpellSources } from '@sim/spells';
import { describe, expect, it } from 'vitest';

import { composition } from './confidence';
import { communityBuilds, gearFor, strongestOf } from './raid';

const def = (spec: Spec, talents: Array<[string, string]>, defaultTalents = '', gear: Array<[string, number]> = []) =>
	({
		spec,
		presets: {
			talents: talents.map(([name, talentsString]) => ({ name, data: { talentsString } })),
			gear: gear.map(([name, id]) => ({ name, gear: { items: [{ id }] } })),
		},
		defaults: { talents: { talentsString: defaultTalents }, gear: { items: [] } },
	}) as unknown as SpecDefinition<any>;

describe('strongestOf', () => {
	it('ORs booleans and keeps the larger number', () => {
		const merged = strongestOf([
			{ a: false, b: TristateEffect.TristateEffectRegular, c: 0.5 },
			{ a: true, b: TristateEffect.TristateEffectImproved, c: 0.2 },
			{ a: false, b: TristateEffect.TristateEffectMissing, c: 0 },
		]);
		expect(merged).toEqual({ a: true, b: TristateEffect.TristateEffectImproved, c: 0.5 });
	});
});

describe('communityBuilds', () => {
	it('takes the talent presets named with a point split, one build each', () => {
		const warrior = def(Spec.SpecDpsWarrior, [
			['DPS', 'x'],
			['Fury 17/34/0', 'fury'],
			['Arms 39/12/0', 'arms'],
		]);
		const builds = communityBuilds([{ key: 'warrior/dps', def: warrior }]);
		expect(builds.map(build => [build.name, build.talentsString])).toEqual([
			['Fury 17/34/0', 'fury'],
			['Arms 39/12/0', 'arms'],
		]);
	});

	it('keeps a spec with no community build, named with its default point split', () => {
		const mage = def(Spec.SpecMage, [['Arcane', 'a']], '05-1-');
		const [build] = communityBuilds([{ key: 'mage/dps', def: mage }]);
		expect(build.talentsString).toBe('05-1-');
		expect(build.name).toMatch(/ 5\/1\/0$/);
	});

	it('uses the first talent preset when the default talents are empty', () => {
		const [build] = communityBuilds([{ key: 'mage/dps', def: def(Spec.SpecMage, [['Arcane', '5-1-2']]) }]);
		expect(build.talentsString).toBe('5-1-2');
		expect(build.name).toMatch(/ 5\/1\/2$/);
	});

	it("wears the spec's own Launch preset, else its default gear", () => {
		const gear = (presets: Array<[string, number]>) => gearFor({ key: 'warrior/dps', def: def(Spec.SpecDpsWarrior, [], '', presets) }).items;
		expect(
			gear([
				['P1 BiS', 1],
				['Launch (Arms)', 2],
				['Launch', 3],
			]),
		).toEqual([{ id: 3 }]);
		expect(
			gear([
				['P1 BiS', 1],
				['Backstab Launch', 2],
			]),
		).toEqual([{ id: 2 }]);
		expect(gear([['P1 BiS', 1]])).toEqual([]);
	});

	it('gives each build the launch set named for its tree', () => {
		const presets: Array<[string, number]> = [
			['Frost Launch', 1],
			['Fire Launch', 2],
			['Arcane Launch', 3],
		];
		const gear = (name: string) => gearFor({ key: 'mage/dps', name, def: def(Spec.SpecMage, [], '', presets) }).items;
		expect(gear('MythicSim Fire 12/34/5')).toEqual([{ id: 2 }]);
		expect(gear('Arcane 35/0/16')).toEqual([{ id: 3 }]);
		expect(gear('Something 1/2/3')).toEqual([{ id: 1 }]);
	});
});

describe('composition', () => {
	const settled = allSpellSources().find(([, source]) => source.source === 'forever' && !source.measured)![0];
	const action = (actionId: ActionId, damage: number) => ({ actionId, damage });

	it('splits damage by evidence tier, pets included, summing to one', () => {
		const rests = composition({
			actions: [action(ActionId.fromOtherId(OtherAction.OtherActionAttack), 300), action(ActionId.fromSpellId(settled), 100)],
			pets: [{ actions: [action(ActionId.fromSpellId(999999999), 100)], pets: [] }],
		});
		expect(rests.core).toBeCloseTo(0.6);
		expect(rests.forever).toBeCloseTo(0.2);
		expect(rests.unknown).toBeCloseTo(0.2);
	});

	it('is empty for a player that did no damage', () => {
		expect(Object.values(composition({ actions: [action(ActionId.fromSpellId(settled), 0)], pets: [] })).every(share => share === 0)).toBe(true);
	});
});
