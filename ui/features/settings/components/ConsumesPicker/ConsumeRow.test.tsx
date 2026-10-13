import { SimHostProvider } from '@sim/context/SimHostContext';
import { createSimStore, patchKeyed, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import type { IconEnumPickerConfig } from '@ui-kit/IconEnumPicker/types';
import { describe, expect, it } from 'vitest';

import { ConsumeRow } from './ConsumeRow';

const KEY = 2;

/** Stands in for the player: the one flag the configs below ask about, over a store the row can select from. */
class Options {
	engineer = true;
	readonly storeKey = KEY;
	readonly sim: { store: SimStore };

	constructor() {
		const store = createSimStore();
		seedKeyed(store, 'players', KEY, { profession1: 0, profession2: 0, v: zeroVersions(PLAYER_FIELDS) } as unknown as PlayerSlice);
		this.sim = { store };
	}

	changeProfession(next: number) {
		patchKeyed(this.sim.store, 'players', KEY, { profession1: next }, ['profession1']);
	}

	changeSomethingElse() {
		patchKeyed(this.sim.store, 'players', KEY, { name: 'Other' }, ['name']);
	}
}

// `iconEnumPickerShown` is satisfied only by a value that carries an actionId *and* is shown, so
// this is the shape of the engineering explosives: one real option behind a profession check.
const configFor = (shown: (options: Options) => boolean): IconEnumPickerConfig<Options, number> =>
	({
		values: [{ value: 0 }, { actionId: {} as never, value: 1, showWhen: shown }],
		equals: (a: number, b: number) => a === b,
		zeroValue: 0,
		storeSubscribe: () => (() => () => {}) as never,
		getValue: () => 0,
		setValue: () => {},
	}) as IconEnumPickerConfig<Options, number>;

const CHILD_CLASS_NAME = 'picker-group icon-group consumes-row-inputs consumes-engi';

const row = (options: Options, configs?: Array<IconEnumPickerConfig<Options, number>>, hidden?: boolean) => {
	render(
		<SimHostProvider host={{ player: options } as never}>
			<ConsumeRow name="engineering" configs={configs as never} hidden={hidden}>
				<div className={CHILD_CLASS_NAME} />
			</ConsumeRow>
		</SimHostProvider>,
	);
	return document.querySelector('[data-testid="consumes-row"]') as HTMLElement;
};

describe('ConsumeRow', () => {
	it('builds vanilla’s row: the caption first, then whatever it was given', () => {
		const element = row(new Options(), [configFor(() => true)]);

		expect(element.hasAttribute('data-input-root')).toBe(true);
		expect(element.getAttribute('data-layout')).toBe('inline');
		// A <span>: it names the row's icon group, not a form control.
		const children = Array.from(element.children);
		expect(children).toHaveLength(2);
		expect(children.map(child => child.tagName.toLowerCase())).toEqual(['span', 'div']);
		expect(children[0].className.split(' ')).toEqual(['ui-field-label']);
		expect(children[1].className).toBe(CHILD_CLASS_NAME);
	});

	it('names the row group with its caption', () => {
		const element = row(new Options(), [configFor(() => true)]);
		const caption = element.querySelector('span.ui-field-label')!;

		expect(element.getAttribute('role')).toBe('group');
		expect(element.getAttribute('aria-labelledby')).toBe(caption.id);
		expect(caption.id).not.toBe('');
	});

	// Vanilla's updateRow toggled a `hide` class and nothing more, so the pickers inside a hidden
	// row stayed mounted and kept zeroing and restoring the field they are bound to. Unmounting
	// instead would strand a selection the player can no longer use.
	it('hides the row when every picker in it is hidden, without unmounting it, and shows it again', () => {
		const options = new Options();
		row(options, [configFor(opts => opts.engineer), configFor(opts => opts.engineer)]);
		const rowElem = document.querySelector('[data-testid="consumes-row"]')!;
		expect(rowElem.hasAttribute('hidden')).toBe(false);

		options.engineer = false;
		act(() => options.changeProfession(1));
		expect(document.querySelector('[data-testid="consumes-row"]')).toBe(rowElem);
		expect(rowElem.hasAttribute('hidden')).toBe(true);
		expect(document.querySelector('.consumes-engi')).not.toBeNull();

		options.engineer = true;
		act(() => options.changeProfession(2));
		expect(rowElem.hasAttribute('hidden')).toBe(false);
	});

	it('keeps the row shown while any one of its pickers is', () => {
		const options = new Options();
		const element = row(options, [configFor(opts => opts.engineer), configFor(() => true)]);

		options.engineer = false;
		act(() => options.changeProfession(1));
		expect(document.body.contains(element)).toBe(true);
	});

	it('never hides a row that names no pickers', () => {
		const options = new Options();
		const element = row(options);
		expect(document.body.contains(element)).toBe(true);

		act(() => options.changeProfession(1));
		expect(document.body.contains(element)).toBe(true);
	});

	// A gear planner has no encounter, so it hides the miscellaneous row outright; the pickers inside
	// still have to stay mounted for the same zeroing reason as above.
	it('hides a row the caller hides, whatever its pickers say, without unmounting it', () => {
		const options = new Options();
		const element = row(options, [configFor(() => true)], true);

		expect(element.hasAttribute('hidden')).toBe(true);
		expect(document.querySelector('.consumes-engi')).not.toBeNull();

		act(() => options.changeProfession(1));
		expect(element.hasAttribute('hidden')).toBe(true);
	});

	it('re-evaluates on any player change, not only a profession change', () => {
		// TBC's rows gate on more than professions — imbues on gear, the misc row on ep weights —
		// so this subscribes to the whole player-change aggregate rather than naming individual
		// fields the way the profession-only rows would suggest.
		const options = new Options();
		row(options, [configFor(opts => opts.engineer)]);

		options.engineer = false;
		act(() => options.changeSomethingElse());
		expect(document.querySelector('[data-testid="consumes-row"]')!.hasAttribute('hidden')).toBe(true);

		options.engineer = true;
		act(() => options.changeProfession(1));
		expect(document.querySelector('[data-testid="consumes-row"]')).toBeTruthy();
	});
});
