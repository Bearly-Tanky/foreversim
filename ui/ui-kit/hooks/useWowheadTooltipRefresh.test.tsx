import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWowheadTooltipRefresh } from './useWowheadTooltipRefresh';

const Probe = ({ token }: { token: unknown }) => {
	useWowheadTooltipRefresh(token);
	return null;
};

const withWowhead = () => {
	const refreshLinks = vi.fn();
	const triggerTooltip = vi.fn();
	(window as unknown as { WH: unknown }).WH = { Tooltips: { refreshLinks, triggerTooltip } };
	return { refreshLinks, triggerTooltip };
};

afterEach(() => {
	delete (window as unknown as { WH?: unknown }).WH;
	vi.restoreAllMocks();
});

describe('useWowheadTooltipRefresh', () => {
	it('refreshes once per change of the token, not on every render', () => {
		const { refreshLinks } = withWowhead();
		const { rerender } = render(<Probe token="2552-" />);
		expect(refreshLinks).toHaveBeenCalledTimes(1);

		rerender(<Probe token="2552-" />);
		expect(refreshLinks).toHaveBeenCalledTimes(1);

		rerender(<Probe token="2553-" />);
		expect(refreshLinks).toHaveBeenCalledTimes(2);
	});

	it('does nothing when the wowhead script is absent', () => {
		expect(() => render(<Probe token="2552-" />)).not.toThrow();
	});

	it('does nothing when the script loaded without the tooltip api', () => {
		(window as unknown as { WH: unknown }).WH = {};
		expect(() => render(<Probe token="2552-" />)).not.toThrow();
	});

	it('re-opens the tooltip of the link under the pointer, so it does not go stale mid-hover', () => {
		const { triggerTooltip } = withWowhead();
		const anchor = document.createElement('a');
		document.body.append(anchor);
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(anchor);

		const { rerender } = render(<Probe token="2552-" />);
		document.dispatchEvent(new MouseEvent('mousemove', { clientX: 12, clientY: 34 }));
		rerender(<Probe token="2553-" />);

		expect(triggerTooltip).toHaveBeenCalledWith(anchor);
		anchor.remove();
	});

	it('finds the link when the pointer is over something inside it', () => {
		const { triggerTooltip } = withWowhead();
		const anchor = document.createElement('a');
		const inner = document.createElement('span');
		anchor.append(inner);
		document.body.append(anchor);
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(inner);

		const { rerender } = render(<Probe token="2552-" />);
		document.dispatchEvent(new MouseEvent('mousemove', { clientX: 1, clientY: 2 }));
		rerender(<Probe token="2553-" />);

		expect(triggerTooltip).toHaveBeenCalledWith(anchor);
		anchor.remove();
	});

	it('does not trigger a tooltip when nothing is hovered', () => {
		const { triggerTooltip, refreshLinks } = withWowhead();
		render(<Probe token="2552-" />);

		expect(refreshLinks).toHaveBeenCalledTimes(1);
		expect(triggerTooltip).not.toHaveBeenCalled();
	});
});
