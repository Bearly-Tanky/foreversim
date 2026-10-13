import { makePlayer } from '@features/apl/testing';
import { APLAction, APLRotation } from '@generated/proto/apl';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionListField } from './ActionListField';

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

let actions: Array<APLAction>;
let player: ReturnType<typeof makePlayer>;

const setup = () => {
	source.listeners.clear();
	actions = [APLAction.create({ action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } } })];
	player = makePlayer(APLRotation.create(), () => source.notify());
};

const fieldConfig = () => ({
	id: 'actions',
	storeSubscribe: () => source.subscribe,
	getValue: () => actions,
	setValue: (_subject: unknown, next: Array<APLAction>) => {
		actions = next;
		source.notify();
	},
});

const mount = () =>
	render(
		<SimHostProvider host={{ player, rootElem: document.body } as never}>
			<ActionListField player={player as never} config={fieldConfig() as never} />
		</SimHostProvider>,
	);

const items = () => Array.from(document.querySelectorAll('[data-testid="list-picker-item-container"]'));

const clickItemAction = (index: number, testId: string) => {
	act(() => {
		fireEvent.click(items()[index].querySelector('[data-testid="list-picker-item-actions"]')!);
	});
	act(() => {
		fireEvent.click(document.querySelector(`[data-testid="${testId}"]`)!);
	});
};

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ActionListField', () => {
	it('copies a row, which a sequence needs as much as the priority list does', () => {
		setup();
		mount();

		clickItemAction(0, 'list-picker-item-copy');

		expect(actions).toHaveLength(2);
		// A clone, not the same message: editing the copy must not edit the row it came from.
		expect(actions[1]).not.toBe(actions[0]);
		expect(actions[1]).toEqual(actions[0]);
		expect(items()).toHaveLength(2);
	});
});
