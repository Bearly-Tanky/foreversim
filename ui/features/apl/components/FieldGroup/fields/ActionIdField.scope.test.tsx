import { AplProvider } from '@features/apl/context/AplContext';
import { makePlayer } from '@features/apl/testing';
import { APLRotation } from '@generated/proto/apl';
import { ActionID } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { ActionId } from '@sim/proto/action_id';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionIdField } from './ActionIdField';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(source.subscribe));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

// Named, as `fill()` returns them: an unfilled id would send the menu icon off to fetch one.
const named = (spellId: number, name: string) => Object.assign(Object.create(ActionId.prototype), ActionId.fromSpellId(spellId), { name }) as ActionId;

const spell = (id: ActionId, flags: { prepullOnly?: boolean; encounterOnly?: boolean } = {}) => ({
	id,
	data: { isCastable: true, isPotion: false, isConjured: false, isMajorCooldown: false, prepullOnly: false, encounterOnly: false, ...flags },
});

let player: ReturnType<typeof makePlayer>;

const setup = () => {
	source.listeners.clear();
	player = makePlayer(APLRotation.create(), () => source.notify());
	const spells = [
		spell(named(1, 'Plain Spell')),
		spell(named(2, 'Prepull Spell'), { prepullOnly: true }),
		spell(named(3, 'Encounter Spell'), { encounterOnly: true }),
	];
	player.sim.getUnitMetadata = () => ({ getSpells: () => spells, getAuras: () => [], getName: () => '' });
};

const mount = (isPrepull: boolean) =>
	render(
		<SimHostProvider host={{ player, rootElem: document.body } as never}>
			<AplProvider isPrepull={isPrepull}>
				<ActionIdField
					player={player as never}
					config={{ id: 'spell', storeSubscribe: () => source.subscribe, getValue: () => ActionID.create(), setValue: () => {} } as never}
					actionIdSet="castable_spells"
					unitRefField={undefined}
					defaultUnitRef="self"
					getParentValue={() => ({})}
				/>
			</AplProvider>
		</SimHostProvider>,
	);

/** The spell bucket's own submenu, which is where `castable_spells` files every non-cooldown. */
const openSpellSubmenu = async () => {
	await act(async () => {
		fireEvent.click(screen.getByTestId('dropdown-picker-button'));
	});
	await act(async () => {
		fireEvent.click(screen.getAllByTestId('dropdown-item')[0]);
	});
	return within(screen.getByTestId('dropdown-submenu'))
		.queryAllByTestId('dropdown-picker-item')
		.map(item => item.textContent);
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ActionIdField — the list a spell may be used in', () => {
	it('offers no pre-pull-only spell outside the pre-pull list', async () => {
		setup();
		mount(false);

		expect(await openSpellSubmenu()).toEqual(['Plain Spell', 'Encounter Spell']);
	});

	it('offers no encounter-only spell inside the pre-pull list', async () => {
		setup();
		mount(true);

		expect(await openSpellSubmenu()).toEqual(['Plain Spell', 'Prepull Spell']);
	});
});
