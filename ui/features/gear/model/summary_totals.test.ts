import { UIGem as Gem } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { gemSummaryRows } from './summary_totals';

const gem = (name: string) => ({ name }) as unknown as Gem;

describe('gemSummaryRows', () => {
	it('counts duplicates and orders by name', () => {
		expect(gemSummaryRows([gem('Zen'), gem('Adept'), gem('Zen')]).map(row => [row.gem.name, row.count])).toEqual([
			['Adept', 1],
			['Zen', 2],
		]);
	});

	it('is empty for no gems', () => {
		expect(gemSummaryRows([])).toEqual([]);
	});
});
