import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { describe, expect, it, vi } from 'vitest';

import { actionKinds } from './action_kinds';
import { actionKindOptions, valueKindOptions } from './kind_options';
import { valueKinds } from './value_kinds';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const player = (): any => makePlayer(APLRotation.create());

describe('valueKindOptions includeIf', () => {
	it('drops a prepull-excluded kind when isPrepull is true, and keeps it otherwise', () => {
		const notPrepull = valueKindOptions(player(), false, false).map(option => option.value);
		const prepull = valueKindOptions(player(), true, false).map(option => option.value);
		expect(notPrepull).toContain('currentTime');
		expect(prepull).not.toContain('currentTime');
	});
});

describe('actionKindOptions includeIf', () => {
	it('drops a prepull-excluded kind when isPrepull is true, and keeps it otherwise', () => {
		const notPrepull = actionKindOptions(player(), false).map(option => option.value);
		const prepull = actionKindOptions(player(), true).map(option => option.value);
		expect(notPrepull).toContain('multidot');
		expect(prepull).not.toContain('multidot');
	});
});

describe('kind tooltip', () => {
	it('wraps the short description and appends the full description when one exists', () => {
		const options = valueKindOptions(player(), false, false);
		const withFull = options.find(option => option.value === 'const');
		expect(withFull?.tooltip).toBe(`<p>${valueKinds.const.shortDescription}</p> ${valueKinds.const.fullDescription}`);
	});

	it('is just the short description when there is no full description', () => {
		const options = valueKindOptions(player(), false, false);
		const shortOnly = options.find(option => option.value === 'cmp');
		expect(valueKinds.cmp.fullDescription).toBeUndefined();
		expect(shortOnly?.tooltip).toBe(valueKinds.cmp.shortDescription);
	});
});

describe('valueKindOptions dynamicStringResolver', () => {
	it('is included whenever not prepull, and resolves through the always-empty resolver', () => {
		const options = valueKindOptions(player(), false, false);
		const generic = options.find(option => option.value === 'currentGenericResource');

		expect(generic).toBeDefined();
		expect(generic?.label).toBe('');
		expect(generic?.tooltip).toBe('');
	});

	it('is excluded during prepull', () => {
		const options = valueKindOptions(player(), true, false);
		expect(options.map(option => option.value)).not.toContain('currentGenericResource');
	});
});

describe('table insertion order', () => {
	it('valueKindOptions preserves the value-kind table order', () => {
		const order = Object.keys(valueKinds);
		const indices = valueKindOptions(player(), false, false).map(option => order.indexOf(option.value));
		expect(indices).toEqual([...indices].sort((a, b) => a - b));
		expect(new Set(indices).size).toBe(indices.length);
	});

	it('actionKindOptions preserves the action-kind table order', () => {
		const order = Object.keys(actionKinds);
		const indices = actionKindOptions(player(), false).map(option => order.indexOf(option.value));
		expect(indices).toEqual([...indices].sort((a, b) => a - b));
		expect(new Set(indices).size).toBe(indices.length);
	});
});
