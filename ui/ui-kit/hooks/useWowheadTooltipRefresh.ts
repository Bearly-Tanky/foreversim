import { useEffect } from 'react';

type WowheadTooltips = {
	refreshLinks?: () => void;
	triggerTooltip?: (element: Element) => void;
};

const wowheadTooltips = (): WowheadTooltips | undefined => (window as { WH?: { Tooltips?: WowheadTooltips } }).WH?.Tooltips;

let pointer: { x: number; y: number } | undefined;

const trackPointer = (event: MouseEvent) => {
	pointer = { x: event.clientX, y: event.clientY };
};

const linkUnderPointer = (): Element | null => {
	if (!pointer) return null;
	return document.elementFromPoint(pointer.x, pointer.y)?.closest('a') ?? null;
};

export const useWowheadTooltipRefresh = (token: unknown) => {
	useEffect(() => {
		document.addEventListener('mousemove', trackPointer, { passive: true });
		return () => document.removeEventListener('mousemove', trackPointer);
	}, []);

	useEffect(() => {
		const tooltips = wowheadTooltips();
		if (!tooltips) return;

		tooltips.refreshLinks?.();

		const link = linkUnderPointer();
		if (link) tooltips.triggerTooltip?.(link);
	}, [token]);
};
