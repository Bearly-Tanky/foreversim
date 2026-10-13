import { ActionMetrics } from '@sim/proto/sim_result';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { ThreatMetricsTable } from './ThreatMetricsTable';

let result: SimResultData | null = null;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../MetricsTable/MetricsActionCell', () => ({ MetricsActionCell: ({ name }: { name: string }) => <span>{name}</span> }));

const metric = (name: string, overrides: Record<string, unknown> = {}) => {
	const base: Record<string, unknown> = {
		name,
		actionId: { toStringIgnoringTag: () => name, toString: () => name },
		unit: { isPet: false, petActionId: null },
		spellSchool: null,
		threat: 1000,
		avgThreat: 1000,
		totalThreatPercent: 50,
		threatThroughput: 40,
		casts: 10,
		isPassiveAction: false,
		avgCastThreat: 100,
		avgHitThreat: 100,
		landedHits: 10,
		landedTicks: 0,
		critPercent: 20,
		blockedCritPercent: 0,
		critTickPercent: 0,
		totalMisses: 1,
		totalMissesPercent: 10,
		misses: 1,
		missPercent: 10,
		parries: 0,
		parryPercent: 0,
		dodges: 0,
		dodgePercent: 0,
		hits: 8,
		crits: 2,
		glances: 0,
		blocks: 0,
		blockPercent: 0,
		blockedCrits: 0,
		crushes: 0,
		crushPercent: 0,
		resistedHits: 0,
		resistedCrits: 0,
		resistedTicks: 0,
		resistedCritTicks: 0,
		ticks: 0,
		critTicks: 0,
		tps: 50,
		hitAttempts: 11,
		...overrides,
	};
	base.forTarget = () => base;
	return base as unknown as ActionMetrics;
};

const pet = (name: string, overrides: Record<string, unknown> = {}) => metric(name, { unit: { isPet: true, petActionId: null }, ...overrides });

const playerResult = (actions: Array<ActionMetrics>, petActions: Array<ActionMetrics> = []) =>
	({
		filter: {},
		result: {
			getRaidIndexedPlayers: () => [
				{
					getThreatActions: () => actions,
					pets: petActions.length ? [{ name: 'Wolf', getThreatActions: () => petActions }] : [],
				},
			],
		},
	}) as unknown as SimResultData;

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const tooltipTable = () => document.querySelector('.sim-tooltip table[data-testid="metrics-table"]');

describe('ThreatMetricsTable', () => {
	beforeEach(() => {
		result = null;
		vi.spyOn(ActionMetrics, 'merge').mockImplementation(((metrics: Array<Record<string, number>>) => ({
			...metrics[0],
			threat: metrics.reduce((sum, entry) => sum + entry.threat, 0),
			tps: metrics.reduce((sum, entry) => sum + entry.tps, 0),
		})) as unknown as typeof ActionMetrics.merge);
	});

	it('builds the ten-column shell before any result', () => {
		const { container } = render(<ThreatMetricsTable />);

		expect(container.querySelector('[data-testid="threat-metrics-root"]')).toBeTruthy();
		const headers = [...container.querySelectorAll('thead th')];
		expect(headers).toHaveLength(10);
		expect(headers.filter(th => th.classList.contains('w-100'))).toEqual([headers[1]]);
		expect(rows(container)).toHaveLength(0);
	});

	// getThreatActions, not getDamageActions: a taunt has no dps and would never reach this table
	// through the damage list.
	it('opens sorted by TPS descending and keeps a pet group as a parent with its children', () => {
		result = playerResult(
			[metric('Shield Slam', { tps: 300, threat: 6000 }), metric('Taunt', { tps: 5, threat: 100 })],
			[pet('Claw', { tps: 4, threat: 80 }), pet('Bite', { tps: 6, threat: 120 })],
		);
		const { container } = render(<ThreatMetricsTable />);

		expect(rows(container).map(row => [row.cells[0].textContent, row.hasAttribute('data-child')])).toEqual([
			['Shield Slam', false],
			['Claw', false],
			['Bite', true],
			['Claw', true],
			['Taunt', false],
		]);
	});

	it('splits TPS into per-cast and per-hit threat', async () => {
		result = playerResult([metric('Shield Slam')]);
		const { container } = render(<ThreatMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.text-success')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.tooltip_table.per_cast',
			'results_tab.details.tooltip_table.per_hit',
		]);
	});

	it('breaks the hits cell down by outcome, resisted hits included', async () => {
		result = playerResult([metric('Shield Slam', { hits: 8, resistedHits: 2, crits: 2, blockedCrits: 1 })]);
		const { container } = render(<ThreatMetricsTable />);

		fireEvent.mouseEnter(rows(container)[0].cells[4]);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.hit',
			'results_tab.details.attack_types.resisted_hit',
			'results_tab.details.attack_types.critical_hit',
			'results_tab.details.attack_types.blocked_critical_hit',
		]);
	});

	it('breaks the miss cell into miss, parry and dodge', async () => {
		result = playerResult([
			metric('Shield Slam', {
				misses: 5,
				missPercent: 5,
				parries: 3,
				parryPercent: 3,
				dodges: 1,
				dodgePercent: 1,
				totalMisses: 9,
				totalMissesPercent: 9,
			}),
		]);
		const { container } = render(<ThreatMetricsTable />);

		fireEvent.mouseEnter(rows(container)[0].cells[7]);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.miss',
			'results_tab.details.attack_types.parry',
			'results_tab.details.attack_types.dodge',
		]);
	});

	it('dashes a passive action on Avg Cast and sorts it as 0', () => {
		result = playerResult([metric('Shield Slam', { tps: 300 }), metric('Thunderfury', { isPassiveAction: true, tps: 20 })]);
		const { container } = render(<ThreatMetricsTable />);

		const passive = rows(container).find(row => row.cells[0].textContent === 'Thunderfury')!;
		expect(passive.cells[3].getAttribute('data-text')).toBe('0');
		expect(passive.cells[3].textContent).toBe('-');
	});

	it('anchors the avg-cast header tooltip on the header cell itself', () => {
		const { container } = render(<ThreatMetricsTable />);
		const header = [...container.querySelectorAll('thead th')][3];

		expect(header.getAttribute('data-tooltip-id')).toBe('threat-metrics-avg-cast-header');
		expect(header.getAttribute('data-tooltip-content')).toBeTruthy();
	});
});
