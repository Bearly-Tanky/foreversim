import { ActionId } from '@sim/proto/action_id';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useActionId } from './useActionId';

// A filled ActionId as fill() returns one: same id fields, plus name and iconUrl.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const deferFill = () => {
	const resolvers: Array<(value: ActionId) => void> = [];
	const spy = vi.spyOn(ActionId.prototype, 'fill').mockImplementation(function (this: ActionId) {
		return new Promise<ActionId>(resolve => resolvers.push(resolve));
	});
	return { spy, resolvers };
};

const Probe = ({ actionId }: { actionId?: ActionId }) => {
	const { iconUrl, name, href, ready } = useActionId(actionId);
	return <a href={href} data-ready={String(ready)} data-icon={iconUrl} title={name} />;
};

const anchor = (container: HTMLElement) => container.querySelector('a')!;

afterEach(() => vi.restoreAllMocks());

describe('useActionId', () => {
	it('renders an already-filled id on the first pass', () => {
		const { spy } = deferFill();
		const seen: string[] = [];
		const Recorder = ({ actionId }: { actionId: ActionId }) => {
			const { iconUrl } = useActionId(actionId);
			seen.push(iconUrl);
			return null;
		};

		render(<Recorder actionId={filled(ActionId.fromSpellId(1), 'Fireball', 'fireball.jpg')} />);

		expect(seen[0]).toBe('fireball.jpg');
		expect(spy).not.toHaveBeenCalled();
	});

	it('fills an unfilled id and reports ready', async () => {
		const { resolvers } = deferFill();
		const actionId = ActionId.fromSpellId(2);
		const { container } = render(<Probe actionId={actionId} />);

		expect(anchor(container).dataset.icon).toBe('');
		expect(anchor(container).dataset.ready).toBe('false');

		await act(async () => resolvers[0](filled(actionId, 'Frostbolt', 'frostbolt.jpg')));

		expect(anchor(container).dataset.icon).toBe('frostbolt.jpg');
		expect(anchor(container).title).toBe('Frostbolt');
		expect(anchor(container).dataset.ready).toBe('true');
	});

	it('lets the current id win when an earlier fill resolves last', async () => {
		const { resolvers } = deferFill();
		const first = ActionId.fromSpellId(3);
		const second = ActionId.fromSpellId(4);
		const { container, rerender } = render(<Probe actionId={first} />);

		rerender(<Probe actionId={second} />);
		await act(async () => resolvers[1](filled(second, 'Second', 'second.jpg')));
		await act(async () => resolvers[0](filled(first, 'First', 'first.jpg')));

		expect(anchor(container).dataset.icon).toBe('second.jpg');
	});

	it('drops the previous icon in the render that changes the id', () => {
		deferFill();
		const { container, rerender } = render(<Probe actionId={filled(ActionId.fromSpellId(5), 'Old', 'old.jpg')} />);
		expect(anchor(container).dataset.icon).toBe('old.jpg');

		rerender(<Probe actionId={ActionId.fromSpellId(6)} />);

		expect(anchor(container).dataset.icon).toBe('');
	});

	// Upstream varied the reforge id here; TBC has no item reforging, and its
	// ActionId.fromItemId is (itemId, tag?, randomSuffixId?). The random suffix is
	// the equivalent url-bearing field, so the case still covers what it is for:
	// the href is derived before any fill, and re-derived when the id changes.
	it('knows the href without filling, and re-derives it when the random suffix changes', () => {
		deferFill();
		const { container, rerender } = render(<Probe actionId={ActionId.fromItemId(7, 0, 111)} />);
		expect(anchor(container).href).toContain('rand=111');

		rerender(<Probe actionId={ActionId.fromItemId(7, 0, 222)} />);

		expect(anchor(container).href).toContain('rand=222');
	});

	it('resolves an absent id to empty fields without a fill', () => {
		const { spy } = deferFill();
		const { container } = render(<Probe actionId={undefined} />);

		expect(anchor(container).dataset.icon).toBe('');
		expect(anchor(container).getAttribute('href')).toBe('');
		expect(anchor(container).dataset.ready).toBe('true');
		expect(spy).not.toHaveBeenCalled();
	});

	it('uses the spell url for a spell id', () => {
		deferFill();
		const { container } = render(<Probe actionId={ActionId.fromSpellId(8)} />);
		expect(anchor(container).href).toBe(ActionId.makeSpellUrl(8));
	});

	it('carries the rank into the spell url, and leaves it off at rank 0', () => {
		deferFill();
		const { container } = render(<Probe actionId={ActionId.fromSpellId(12297, 3)} />);
		expect(anchor(container).href).toContain('rank=3');
		expect(ActionId.makeSpellUrl(12297, 0)).not.toContain('rank=');
	});

	it('carries the trait definition alongside the rank, as wowhead expects', () => {
		deferFill();
		const { container } = render(<Probe actionId={ActionId.fromTalent(12297, 1, 135506)} />);
		expect(anchor(container).href).toContain('def=135506');
		expect(anchor(container).href).toContain('rank=1');
		expect(ActionId.makeSpellUrl(12297, 0, 0)).not.toContain('def=');
	});

	it('refetches when two talents share a spell id but not a trait definition', () => {
		const { spy } = deferFill();
		const { rerender } = render(<Probe actionId={ActionId.fromTalent(12297, 1, 135506)} />);
		expect(spy).toHaveBeenCalledTimes(1);

		rerender(<Probe actionId={ActionId.fromTalent(12297, 1, 999999)} />);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('previews rank 1 for an unspent talent rather than letting wowhead pick a default', () => {
		deferFill();
		const unspentPoints = 0;
		const { container } = render(<Probe actionId={ActionId.fromTalent(12297, Math.max(unspentPoints, 1), 135506)} />);
		expect(anchor(container).href).toContain('rank=1');
	});

	it('keeps the definition through fill, which rebuilds the id field by field', async () => {
		vi.spyOn(ActionId, 'getTooltipData').mockResolvedValue({ id: 12297, name: 'Anticipation', icon: 'ability_warrior_anticipation' } as never);

		const resolved = await ActionId.fromTalent(12297, 2, 135506).fill();

		expect(resolved.definitionId).toBe(135506);
		expect(resolved.rank).toBe(2);
		expect(ActionId.makeSpellUrl(resolved.spellId, resolved.rank, resolved.definitionId)).toContain('def=135506');
	});

	it('refetches when the rank changes, and stands pat when it does not', () => {
		const { spy } = deferFill();
		const { rerender } = render(<Probe actionId={ActionId.fromSpellId(12297, 1)} />);
		expect(spy).toHaveBeenCalledTimes(1);

		rerender(<Probe actionId={ActionId.fromSpellId(12297, 1)} />);
		expect(spy).toHaveBeenCalledTimes(1);

		rerender(<Probe actionId={ActionId.fromSpellId(12297, 2)} />);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('leaves rank and definition out of ActionId identity, so equals() and equalityKey() agree', () => {
		const talent = ActionId.fromTalent(12297, 3, 135506);
		const plain = ActionId.fromSpellId(12297);

		expect(talent.equals(plain)).toBe(true);
		expect(talent.equalityKey()).toBe(plain.equalityKey());
	});
});
