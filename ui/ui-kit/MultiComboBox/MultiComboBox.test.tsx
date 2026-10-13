import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MultiComboBox } from './MultiComboBox';
import type { MultiComboBoxConfig } from './types';

class Model {
	picked: Array<number> = [];
	listeners = new Set<() => void>();
	set(next: Array<number>) {
		this.picked = next;
		this.listeners.forEach(listener => listener());
	}
}

const configFor = (overrides: Partial<MultiComboBoxConfig<Model>> = {}): MultiComboBoxConfig<Model> => ({
	id: 'fruit',
	label: 'Fruit',
	placeholder: 'Pick fruit',
	emptyText: 'Nothing matches',
	removeLabel: 'Remove',
	openLabel: 'Show all',
	values: [
		{ name: 'Apple', value: 1 },
		{ name: 'Banana', value: 2 },
		{ name: 'Cherry', value: 3 },
	],
	storeSubscribe: (model: Model) => (onChange: () => void) => {
		model.listeners.add(onChange);
		return () => model.listeners.delete(onChange);
	},
	getValue: (model: Model) => model.picked,
	setValue: (model: Model, next: Array<number>) => model.set(next),
	...overrides,
});

let model: Model;
const mount = (config = configFor()) => render(<MultiComboBox modObject={model} config={config} />);
const input = () => screen.getByTestId('multi-combo-box-input') as HTMLInputElement;
const chips = () => screen.queryAllByTestId('multi-combo-box-chip').map(chip => chip.textContent);
const options = () => within(screen.getByTestId('multi-combo-box-list')).getAllByRole('option');
const open = () => fireEvent.click(screen.getByTestId('multi-combo-box-trigger'));

beforeEach(() => {
	model = new Model();
});

describe('MultiComboBox', () => {
	it('labels its input, keeps its placeholder, and shows the picks as chips below the field', () => {
		mount();

		expect(screen.getByText('Fruit').closest('label')!.getAttribute('for')).toBe('fruit');
		expect(input().id).toBe('fruit');
		expect(input().placeholder).toBe('Pick fruit');
		expect(chips()).toEqual([]);

		act(() => model.set([2]));
		expect(chips()).toEqual(['Banana']);
		expect(input().placeholder).toBe('Pick fruit');
		const field = screen.getByTestId('multi-combo-box-field');
		const chipRow = screen.getByTestId('multi-combo-box-chips');
		expect(field.contains(chipRow)).toBe(false);
		expect(field.compareDocumentPosition(chipRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('lists every option from the chevron, picked ones included, and toggles one per click', async () => {
		model.picked = [1];
		mount();

		open();
		expect(options().map(option => option.textContent)).toEqual(['Apple', 'Banana', 'Cherry']);
		expect(options()[0].getAttribute('aria-selected')).toBe('true');

		fireEvent.click(options()[2]);
		expect(model.picked).toEqual([1, 3]);
		fireEvent.click(options()[0]);
		expect(model.picked).toEqual([3]);
	});

	it('narrows the list as the input is typed into, and says so when nothing matches', () => {
		mount();

		open();
		fireEvent.change(input(), { target: { value: 'an' } });
		expect(options().map(option => option.textContent)).toEqual(['Banana']);

		fireEvent.change(input(), { target: { value: 'zz' } });
		expect(screen.getByText('Nothing matches')).toBeTruthy();
	});

	it('drops a pick through its chip', () => {
		model.picked = [1, 2];
		mount();

		fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
		expect(model.picked).toEqual([2]);
	});

	it('renders nothing when hidden', () => {
		const { container } = mount(configFor({ showWhen: () => false }));
		expect(container.firstChild).toBeNull();
	});
});

vi.mock('@ui-kit/hooks/usePortalContainer', () => ({ usePortalContainer: () => null }));
