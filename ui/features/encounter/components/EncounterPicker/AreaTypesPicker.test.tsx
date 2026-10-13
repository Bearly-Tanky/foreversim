import { AreaType } from '@generated/proto/common';
import type { Encounter } from '@sim/raid/encounter';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AreaTypesPicker } from './AreaTypesPicker';

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
vi.mock('@sim/hooks/useStoreField', () => ({ useStoreField: () => source.subscribe }));
vi.mock('@ui-kit/hooks/usePortalContainer', () => ({ usePortalContainer: () => null }));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@i18n/localization', () => ({
	translateAreaType: (value: number) => `area-${value}`,
}));
const trackEvent = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/utils', () => ({ trackEvent }));

class FakeEncounter {
	areaTypes: Array<AreaType> = [];
	getAreaTypes() {
		return this.areaTypes;
	}
	setAreaTypes(next: Array<AreaType>) {
		this.areaTypes = [...next].sort((a, b) => a - b);
		source.notify();
	}
}

const mount = (encounter: FakeEncounter) => render(<AreaTypesPicker encounter={encounter as unknown as Encounter} />);
const chips = () => screen.queryAllByTestId('multi-combo-box-chip').map(chip => chip.textContent);
const options = () => within(screen.getByTestId('multi-combo-box-list')).getAllByRole('option');

beforeEach(() => {
	source.listeners.clear();
	trackEvent.mockClear();
});

describe('AreaTypesPicker', () => {
	it('labels the field with the area tooltip on the label, not inside the list', () => {
		mount(new FakeEncounter());

		const label = screen.getByText('settings_tab.encounter.area_types.label');
		expect(label.closest('label')!.getAttribute('for')).toBe('encounter-area-types');
		expect(label.getAttribute('data-tooltip-id')).toBe('encounter-area-types-tooltip');

		fireEvent.click(screen.getByTestId('multi-combo-box-trigger'));
		expect(screen.queryByText('settings_tab.encounter.area_types.tooltip')).toBeNull();
	});

	it('lists all ten kinds of area and shows the encounter set as chips', () => {
		const encounter = new FakeEncounter();
		mount(encounter);

		fireEvent.click(screen.getByTestId('multi-combo-box-trigger'));
		expect(options()).toHaveLength(10);

		act(() => encounter.setAreaTypes([AreaType.AreaTypeHaunted, AreaType.AreaTypeForestGrassland]));
		expect(chips()).toEqual([`area-${AreaType.AreaTypeForestGrassland}`, `area-${AreaType.AreaTypeHaunted}`]);
	});

	it('adds and drops kinds of area, tracking each change', () => {
		const encounter = new FakeEncounter();
		encounter.areaTypes = [AreaType.AreaTypeSnowy];
		mount(encounter);

		fireEvent.click(screen.getByTestId('multi-combo-box-trigger'));
		fireEvent.click(options().find(option => option.textContent === `area-${AreaType.AreaTypeMountainous}`)!);
		expect(encounter.areaTypes).toEqual([AreaType.AreaTypeMountainous, AreaType.AreaTypeSnowy]);
		expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ category: 'area', label: 'mountainous', value: true }));

		const removes = [...document.querySelectorAll('[aria-label="settings_tab.encounter.area_types.remove"]')];
		expect(removes).toHaveLength(2);
		fireEvent.click(removes[1]);
		expect(encounter.areaTypes).toEqual([AreaType.AreaTypeMountainous]);
		expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ category: 'area', label: 'snowy', value: false }));
	});
});
