import { Spec } from '@generated/proto/common';
import type { Database } from '@sim/proto/database';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	ENCHANT_NOTICES,
	ITEM_INFO_NOTICES,
	ITEM_NOTICES,
	MISSING_RANDOM_SUFFIX_WARNING,
	registerAreaStatsNotices,
	registerSetBonusNotices,
	SET_BONUS_NOTICES,
} from './item_notices';

vi.mock('@i18n/localization', () => ({
	translateAreaType: (value: number) => `area-${value}`,
	translateStat: (value: number) => `stat-${value}`,
}));

vi.mock('@sim/constants/missing_effects_auto_gen', () => ({
	MISSING_ITEM_EFFECTS: new Map([[1, ['Does a thing.']]]),
	MISSING_ENCHANT_EFFECTS: new Map([[2, ['Enchants a thing.']]]),
}));

const markup = (itemId: number, spec: Spec = Spec.SpecUnknown) => renderToStaticMarkup(ITEM_NOTICES.get(itemId)?.[spec]);
const noticeContainer = (itemId: number, spec: Spec = Spec.SpecUnknown) => render(<>{ITEM_NOTICES.get(itemId)?.[spec]}</>).container;

describe('the item notice table', () => {
	it('lists the tooltips a missing item effect carries', () => {
		const container = noticeContainer(1);
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p', 'ul']);
		const heading = container.querySelector('p')!;
		expect(heading.className).toBe('font-bold');
		expect(heading.textContent).toBe('The following item effect (on-use or proc) is not implemented!');
		const items = container.querySelectorAll('ul > li');
		expect(items).toHaveLength(1);
		expect(items[0].textContent).toBe('Does a thing.');
	});

	it('lists the tooltips a missing enchant effect carries', () => {
		const container = render(<>{ENCHANT_NOTICES.get(2)?.[Spec.SpecUnknown]}</>).container;
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p', 'ul']);
		const heading = container.querySelector('p')!;
		expect(heading.className).toBe('font-bold');
		expect(heading.textContent).toBe('The following enchant effect (on-use or proc) is not implemented!');
		const items = container.querySelectorAll('ul > li');
		expect(items).toHaveLength(1);
		expect(items[0].textContent).toBe('Enchants a thing.');
	});

	it('has no notice for an enchant whose effect is modelled', () => {
		expect(ENCHANT_NOTICES.has(34)).toBe(false);
	});

	it('renders the random suffix warning', () => {
		const container = render(<>{MISSING_RANDOM_SUFFIX_WARNING}</>).container;
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p']);
		const p = container.querySelector('p')!;
		expect(p.className).toBe('mb-0');
		expect(p.textContent).toBe('Please select a random suffix');
	});
});

describe('registerSetBonusNotices', () => {
	const SET_ID = 9999;
	const ITEM_IDS = [90001, 90002];

	afterEach(() => {
		SET_BONUS_NOTICES.delete(SET_ID);
		ITEM_IDS.forEach(id => ITEM_NOTICES.delete(id));
	});

	// The set-bonus notices are written into the same map the pickers read at runtime, which is why
	// there is one table rather than a second copy.
	it('writes a notice into the shared table for every item in the set', () => {
		SET_BONUS_NOTICES.set(SET_ID, null);
		registerSetBonusNotices({ getItemIdsForSet: (setId: number) => (setId === SET_ID ? ITEM_IDS : []) } as unknown as Database);

		for (const id of ITEM_IDS) {
			expect(markup(id)).toBe(
				'<p class="mb-1"> This item set has the following warnings:</p>' +
					'<ul class="mb-0"><li>2-piece: Not yet implemented</li><li>4-piece: Not yet implemented</li></ul>',
			);
		}
	});
});

describe('registerAreaStatsNotices', () => {
	const RUNE = 90010;
	const PLAIN = 90011;
	const db = {
		getAllItems: () => [
			{ id: RUNE, scalingOptions: { 0: { stats: { 17: 15 }, areaStats: [{ areaType: 1, stats: { 17: 29, 18: 29 } }] } } },
			{ id: PLAIN, scalingOptions: { 0: { stats: { 17: 15 }, areaStats: [] } } },
		],
	} as unknown as Database;

	afterEach(() => {
		ITEM_INFO_NOTICES.delete(RUNE);
		ITEM_INFO_NOTICES.delete(PLAIN);
	});

	it('writes an info notice naming each area and the stats it adds, and none for an item without any', () => {
		registerAreaStatsNotices(db);

		expect(renderToStaticMarkup(ITEM_INFO_NOTICES.get(RUNE))).toBe(
			'<p class="mb-1">Only while the encounter is in one of these areas:</p>' + '<ul class="mb-0"><li>area-1: +29 stat-17, +29 stat-18</li></ul>',
		);
		expect(ITEM_INFO_NOTICES.has(PLAIN)).toBe(false);
		expect(ITEM_NOTICES.has(RUNE)).toBe(false);
	});
});
