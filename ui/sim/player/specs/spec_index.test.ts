// specIndex selects a spec's talent tree. It reads like a spec ordinal, nothing consumes it
// today, and a wrong value therefore sits unnoticed until something does: the pre-port tree
// shipped RestorationDruid as 3 against a three-tree class, which threw and took the rest of
// that page's construction with it, and FeralBearDruid as 2, which silently selected
// Restoration's tree. This pins every spec against the real tree data.
import { Spec } from '@generated/proto/common';
import { classTalentsConfig } from '@sim/talents/factory';
import { describe, expect, it } from 'vitest';

import { PlayerSpecs } from './index';

const EXPECTED_TREE: Partial<Record<Spec, string>> = {
	[Spec.SpecBalanceDruid]: 'Balance',
	[Spec.SpecFeralCatDruid]: 'Feral Combat',
	[Spec.SpecFeralBearDruid]: 'Feral Combat',
	[Spec.SpecRestorationDruid]: 'Restoration',
	[Spec.SpecHolyPaladin]: 'Holy',
	[Spec.SpecHealerPriest]: 'Holy',
	[Spec.SpecProtectionPaladin]: 'Protection',
	[Spec.SpecRetributionPaladin]: 'Retribution',
	[Spec.SpecElementalShaman]: 'Elemental',
	[Spec.SpecEnhancementShaman]: 'Enhancement',
	[Spec.SpecRestorationShaman]: 'Restoration',
	[Spec.SpecDpsWarrior]: 'Arms',
	[Spec.SpecProtectionWarrior]: 'Protection',
};

const ALL_SPECS = (Object.values(Spec) as Array<Spec>).filter((spec): spec is Spec => typeof spec === 'number' && spec !== Spec.SpecUnknown);

describe('specIndex', () => {
	it('covers all 18 TBC specs', () => {
		expect(ALL_SPECS.length).toBe(18);
	});

	it.each(ALL_SPECS.map(spec => [Spec[spec], spec] as const))('%s indexes a talent tree that exists', (_name, spec) => {
		const playerSpec = PlayerSpecs.fromProto(spec);
		const trees = classTalentsConfig[playerSpec.classID];

		expect(playerSpec.specIndex).toBeGreaterThanOrEqual(0);
		expect(playerSpec.specIndex).toBeLessThan(trees.length);
		expect(trees[playerSpec.specIndex]).toBeDefined();
	});

	it.each(Object.entries(EXPECTED_TREE).map(([spec, tree]) => [Spec[Number(spec) as Spec], Number(spec) as Spec, tree!] as const))(
		'%s points at its own tree',
		(_name, spec, treeName) => {
			const playerSpec = PlayerSpecs.fromProto(spec);
			expect(classTalentsConfig[playerSpec.classID][playerSpec.specIndex].name).toBe(treeName);
		},
	);
});
