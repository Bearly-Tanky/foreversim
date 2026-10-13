// Whether a proposed point change would leave a legal tree.
//
// A transcription of ui/core/talents/talents_picker.tsx:476-521, which asked the DOM for every
// talent's current points. Nothing here reads state: the caller passes the parsed `TalentPoints`,
// so the same rules serve the click handler and the "can this still take a point" highlight.
//
// The two branches are deliberately asymmetric and must stay so: the add branch gates on the whole
// tree total against rowIdx * pointsPerRow, while the remove branch gates on per-row totals
// accumulated down to the row above. Collapsing them into one rule breaks tier gating silently.

import { CHARACTER_LEVEL } from '@sim/constants/mechanics';
import type { TalentsConfig } from '@sim/talents/config';
import type { TalentPoints } from '@sim/talents/talents_string';
import { totalPointsSpent, treePointTotal } from '@sim/talents/talents_string';

import type { TalentGraph } from './tree_graph';

// A character earns one talent point per level from 10 onwards, so the cap follows
// CHARACTER_LEVEL: 51 at level 60.
export const MAX_POINTS_PLAYER = CHARACTER_LEVEL - 9;
const POINTS_PER_ROW = 5;

export const canSetPoints = <TalentsProto>(
	config: TalentsConfig<TalentsProto>,
	graph: TalentGraph,
	points: TalentPoints,
	treeIdx: number,
	talentIdx: number,
	newPoints: number,
): boolean => {
	const talents = config[treeIdx].talents;
	const treeGraph = graph.trees[treeIdx];
	const oldPoints = points[treeIdx][talentIdx];
	const rowIdx = talents[talentIdx].location.rowIdx;

	if (newPoints > oldPoints) {
		if (totalPointsSpent(points) + (newPoints - oldPoints) > MAX_POINTS_PLAYER) return false;
		if (treePointTotal(points, treeIdx) < rowIdx * POINTS_PER_ROW) return false;

		const prereqIdx = treeGraph.prereqIdx[talentIdx];
		if (prereqIdx >= 0 && points[treeIdx][prereqIdx] < talents[prereqIdx].maxPoints) return false;
		return true;
	}

	const strandedCount = (treePoints: number[]) => {
		const totalsByRow = Array.from({ length: graph.numRows }, () => 0);
		talents.forEach((talent, idx) => (totalsByRow[talent.location.rowIdx] += treePoints[idx]));

		let running = 0;
		const cumulativeTotalsByRow = totalsByRow.map(total => (running += total));

		return talents.filter((talent, idx) => {
			const row = talent.location.rowIdx;
			return treePoints[idx] > 0 && row > 0 && cumulativeTotalsByRow[row - 1] < row * POINTS_PER_ROW;
		}).length;
	};

	const afterRemoval = points[treeIdx].map((value, idx) => (idx === talentIdx ? newPoints : value));
	if (strandedCount(afterRemoval) > strandedCount(points[treeIdx])) return false;

	return !treeGraph.childIdxs[talentIdx].some(childIdx => points[treeIdx][childIdx] > 0);
};
