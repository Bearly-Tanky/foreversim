import { SimHostProvider } from '@sim/context/SimHostContext';
import { fakeHost } from '@sim/testing';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const applyBuild = vi.fn();
const activeNames = new Set<string>();

vi.mock('@features/settings/model/apply_build', () => ({ applyBuild: (...args: unknown[]) => applyBuild(...args) }));
vi.mock('../preset_build_state', () => ({
	buildCategories: () => ['Gear'],
	isBuildActive: (build: { name: string }) => activeNames.has(build.name),
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions());
vi.mock('@sim/hooks/useSimReady', () => ({ useSimReady: () => ready }));

let ready = true;
const { PresetConfigurationPicker } = await import('./PresetConfigurationPicker');

const setup = (builds: Array<Record<string, unknown>>, categories = ['gear']) => {
	const host = fakeHost({ individualConfig: { presets: { builds } }, getStorageKey: (part: string) => `spec${part}` });
	return render(
		<SimHostProvider host={host}>
			<PresetConfigurationPicker categories={categories as never} />
		</SimHostProvider>,
	);
};

const chips = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-testid="saved-data-set-chip"]')];

beforeEach(() => {
	applyBuild.mockClear();
	activeNames.clear();
	window.localStorage.clear();
	ready = true;
});

const phaseTabs = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-testid="preset-group-phase-tabs"] button')];

describe('PresetConfigurationPicker', () => {
	it('renders one chip per build, with the name as the clickable span', () => {
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		expect(chips(container)).toHaveLength(2);
		expect(chips(container).map(chip => chip.querySelector('[data-testid="saved-data-set-name"]')?.textContent)).toEqual(['P1', 'P2']);
		expect(chips(container)[0].querySelector('[data-testid="saved-data-set-name"]')?.getAttribute('role')).toBe('button');
	});

	// The picker is mounted in four places with different category lists, and each shows only the
	// builds touching its own categories.
	it('keeps only the builds that carry one of its categories', () => {
		const { container } = setup(
			[
				{ name: 'P1', gear: {} },
				{ name: 'P2', talents: {} },
			],
			['gear'],
		);

		expect(chips(container).map(chip => chip.textContent)).toEqual(['P1']);
	});

	it('marks the active build, and only that one', () => {
		activeNames.add('P2');
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		expect(chips(container).map(chip => chip.hasAttribute('data-active'))).toEqual([false, true]);
	});

	it('applies the build the name was clicked on', () => {
		const { container } = setup([
			{ name: 'P1', gear: {} },
			{ name: 'P2', gear: {} },
		]);

		fireEvent.click(chips(container)[1].querySelector('[data-testid="saved-data-set-name"]')!);

		expect(applyBuild).toHaveBeenCalledTimes(1);
		expect((applyBuild.mock.calls[0][0] as { name: string }).name).toBe('P2');
	});

	// Five specs have no builds at all, so nothing at all is what those panes contain.
	it('renders nothing when there are no builds', () => {
		const { container } = setup([]);

		expect(container.querySelector('[data-testid="preset-configuration-picker-root"]')).toBeNull();
		expect(container.querySelector('[data-testid="content-block"]')).toBeNull();
	});

	// Before the sim is ready, the block exists but is empty.
	it('renders the block but no chips before the sim is ready', () => {
		ready = false;
		const { container } = setup([{ name: 'P1', gear: {} }]);

		expect(container.querySelector('[data-testid="content-block"]')).not.toBeNull();
		expect(chips(container)).toHaveLength(0);
	});
});

// A spec whose builds carry a phase gets the tab bar, and only the chosen phase's chips.
describe('PresetConfigurationPicker, grouped by phase', () => {
	const phased = [
		{ name: 'La', gear: {}, phase: 1, group: 'Beast Mastery' },
		{ name: 'Lb', gear: {}, phase: 1, group: 'Survival' },
		{ name: 'T1', gear: {}, phase: 2 },
	];

	it('leaves an unphased spec on the flat picker', () => {
		const { container } = setup([{ name: 'P1', gear: {} }]);

		expect(phaseTabs(container)).toHaveLength(0);
		expect(chips(container)).toHaveLength(1);
	});

	it('shows one tab per phase and only the current phase\u2019s chips', () => {
		const { container } = setup(phased);

		expect(phaseTabs(container).map(tab => tab.textContent)).toEqual(['common.phase_names.1', 'common.phase_names.2']);
		// CURRENT_PHASE is Launch (1), and it is among the builds' phases, so that tab opens selected.
		expect(phaseTabs(container).map(tab => tab.hasAttribute('data-active'))).toEqual([true, false]);
		expect(chips(container).map(chip => chip.textContent)).toEqual(['La', 'Lb']);
	});

	it('switches the visible chips when another phase tab is clicked', () => {
		const { container } = setup(phased);

		fireEvent.click(phaseTabs(container)[1]);

		expect(chips(container).map(chip => chip.textContent)).toEqual(['T1']);
	});

	it('labels the groups only when there is more than one', () => {
		const { container } = setup(phased);

		expect([...container.querySelectorAll('[data-testid="preset-group-label"]')].map(label => label.textContent)).toEqual(['Beast Mastery', 'Survival']);
	});

	// The golden capture records a default page load as leaving `__presetFilters__` absent.
	it('writes the filter key only once a phase is chosen', () => {
		const { container } = setup(phased);

		expect(window.localStorage.getItem('spec__presetFilters__')).toBeNull();

		fireEvent.click(phaseTabs(container)[1]);

		expect(JSON.parse(window.localStorage.getItem('spec__presetFilters__')!)).toEqual({ phase: 2 });
	});

	// Applying a build from another phase jumps the bar to it, so the chip that was just clicked
	// stays on screen.
	it('follows the applied build to its phase', () => {
		const { container } = setup(phased);

		fireEvent.click(phaseTabs(container)[1]);
		fireEvent.click(chips(container)[0].querySelector('[data-testid="saved-data-set-name"]')!);

		expect(applyBuild).toHaveBeenCalledTimes(1);
		expect(JSON.parse(window.localStorage.getItem('spec__presetFilters__')!)).toEqual({ phase: 2 });
	});
});
