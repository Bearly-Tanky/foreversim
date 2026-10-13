import { UIGem as Gem } from '@generated/proto/ui';

export interface GemSummaryData {
	gem: Gem;
	count: number;
}

export const gemSummaryRows = (gems: Gem[]): GemSummaryData[] => {
	const gemCounts: Record<string, GemSummaryData> = {};

	for (const gem of gems) {
		if (gemCounts[gem.name]) {
			gemCounts[gem.name].count += 1;
		} else {
			gemCounts[gem.name] = { gem, count: 1 };
		}
	}

	return Object.keys(gemCounts)
		.sort((a, b) => a.localeCompare(b))
		.map(gemName => gemCounts[gemName]);
};
