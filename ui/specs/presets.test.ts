import { druidTalentsConfig } from '@sim/talents/druid';
import { hunterTalentsConfig } from '@sim/talents/hunter';
import { mageTalentsConfig } from '@sim/talents/mage';
import { paladinTalentsConfig } from '@sim/talents/paladin';
import { priestTalentsConfig } from '@sim/talents/priest';
import { rogueTalentsConfig } from '@sim/talents/rogue';
import { shamanTalentsConfig } from '@sim/talents/shaman';
import { warlockTalentsConfig } from '@sim/talents/warlock';
import { warriorTalentsConfig } from '@sim/talents/warrior';
import { describe, expect, it } from 'vitest';

const CONFIGS: Record<string, Array<{ talents: Array<{ maxPoints: number }> }>> = {
	druid: druidTalentsConfig,
	hunter: hunterTalentsConfig,
	mage: mageTalentsConfig,
	paladin: paladinTalentsConfig,
	priest: priestTalentsConfig,
	rogue: rogueTalentsConfig,
	shaman: shamanTalentsConfig,
	warlock: warlockTalentsConfig,
	warrior: warriorTalentsConfig,
};

const presetModules = import.meta.glob('./*/*/presets.ts', { eager: true }) as Record<string, Record<string, any>>;

// Every talent preset a spec ships (most came over verbatim from master) must fit the Forever tree it
// is loaded into: a digit past the talent's max rank or past the end of a tree is silently clamped or
// dropped by the parser, which would turn a build into a different one without anyone noticing.
describe('spec talent presets', () => {
	for (const [path, mod] of Object.entries(presetModules)) {
		const className = path.split('/')[1];
		const config = CONFIGS[className];
		const presets = Object.entries(mod).filter(([, v]) => typeof v?.data?.talentsString === 'string');
		for (const [name, preset] of presets) {
			it(`${path} ${name} fits the ${className} trees`, () => {
				const trees = (preset.data.talentsString as string).split('-');
				expect(trees.length).toBeLessThanOrEqual(config.length);
				let total = 0;
				trees.forEach((tree, treeIdx) => {
					expect(tree.length, `tree ${treeIdx}`).toBeLessThanOrEqual(config[treeIdx].talents.length);
					[...tree].forEach((digit, i) => {
						expect(Number(digit), `tree ${treeIdx} talent ${i}`).toBeLessThanOrEqual(config[treeIdx].talents[i].maxPoints);
						total += Number(digit);
					});
				});
				expect(total).toBeLessThanOrEqual(51);
			});
		}
	}

	it('every spec with a presets file ships at least one talent preset', () => {
		const without = Object.entries(presetModules)
			.filter(([path]) => !path.includes('/shared/'))
			.filter(([, mod]) => !Object.values(mod).some(v => typeof v?.data?.talentsString === 'string'))
			.map(([path]) => path);
		expect(without).toEqual([]);
	});
});
