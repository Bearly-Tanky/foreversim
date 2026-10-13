import type { TalentsConfig } from '@sim/talents/config';
import { newTalentsConfig } from '@sim/talents/config';
import { parseTalentsString } from '@sim/talents/talents_string';
import { describe, expect, it } from 'vitest';

import { canSetPoints } from './can_set_points';
import { buildTalentGraph } from './tree_graph';

type Fake = Record<string, never>;

const ROWS = 9;
const COLS = 4;

const tree = (name: string, prereqs: Record<string, { rowIdx: number; colIdx: number }> = {}) => ({
	name,
	backgroundUrl: 'background.jpg',
	talents: Array.from({ length: ROWS * COLS }, (_, index) => {
		const location = { rowIdx: Math.floor(index / COLS), colIdx: index % COLS };
		return {
			fieldName: `talent${index}`,
			fancyName: `Talent ${index}`,
			location,
			spellId: 1000 + index,
			maxPoints: 5,
			...(prereqs[String(index)] ? { prereqLocation: prereqs[String(index)] } : {}),
		};
	}),
});

const ROOT_TALENT = { idx: 0, location: { rowIdx: 0, colIdx: 0 } };
const GATED_TALENT = { idx: 8, location: { rowIdx: 2, colIdx: 0 } };

const config: TalentsConfig<Fake> = newTalentsConfig<Fake>([tree('A', { [GATED_TALENT.idx]: ROOT_TALENT.location }), tree('B'), tree('C')]);
const graph = buildTalentGraph(config);

const at = (talentsString: string) => parseTalentsString(config, talentsString);
const can = (talentsString: string, treeIdx: number, talentIdx: number, newPoints: number) =>
	canSetPoints(config, graph, at(talentsString), treeIdx, talentIdx, newPoints);

describe('canSetPoints — adding', () => {
	it('allows a first point in row 0', () => {
		expect(can('', 0, 0, 1)).toBe(true);
	});

	it('refuses row 1 until the tree holds 5 points', () => {
		expect(can('4', 0, 4, 1)).toBe(false);
		expect(can('5', 0, 4, 1)).toBe(true);
	});

	it('counts points spent anywhere in the tree towards the tier, including the row being unlocked', () => {
		expect(can('00005', 0, 9, 1)).toBe(false);
		expect(can('000055', 0, 9, 1)).toBe(true);
	});

	it('refuses a talent whose prerequisite is not filled', () => {
		expect(can('45505', 0, 8, 1)).toBe(false);
		expect(can('55505', 0, 8, 1)).toBe(true);
	});

	it('refuses a 62nd point across all three trees', () => {
		const sixty = '5555555555555' + '-' + '5555555555555';
		expect(canSetPoints(config, graph, at(sixty), 0, 0, 5)).toBe(false);
	});
});

describe('canSetPoints — removing', () => {
	it('allows a plain decrement', () => {
		expect(can('5', 0, 0, 4)).toBe(true);
	});

	it('refuses a decrement that would strand a talent in a higher row', () => {
		expect(can('50005', 0, 0, 4)).toBe(false);
		expect(can('50005', 0, 0, 5)).toBe(true);
	});

	it('allows the same decrement once the higher row has slack under it', () => {
		expect(can('55550005', 0, 0, 4)).toBe(true);
	});

	it('refuses a decrement that would orphan a filled child', () => {
		expect(can('555550005', 0, 0, 4)).toBe(false);
	});

	it('allows the decrement once the child is empty', () => {
		expect(can('55555', 0, 0, 4)).toBe(true);
	});

	it('lets a higher row keep its points when the removal comes from that same row', () => {
		expect(can('5555000055', 0, 8, 4)).toBe(true);
	});

	it('lets an already-stranded build give points back, so an illegal import can be repaired', () => {
		const stranded = '4000' + '0000' + '1';
		expect(at(stranded)[0][8]).toBe(1);

		expect(can(stranded, 0, 8, 0)).toBe(true);
		expect(can(stranded, 0, 0, 3)).toBe(false);
	});
});
