import { LOCAL_STORAGE_PREFIX } from '@sim/constants/other';

// Which interface a spec page opens in: the simple view by default, or the full ("advanced")
// simulator. A `?view=` parameter wins over the saved choice, so a link can open either one.
export type ViewMode = 'simple' | 'advanced';

export const VIEW_MODE_STORAGE_KEY = `${LOCAL_STORAGE_PREFIX}_view-mode`;

export const parseViewMode = (value: string | null | undefined): ViewMode | null => (value === 'simple' || value === 'advanced' ? value : null);

export const resolveViewMode = (search: string, saved: string | null): ViewMode =>
	parseViewMode(new URLSearchParams(search).get('view')) ?? parseViewMode(saved) ?? 'simple';

const readSaved = (): string | null => {
	try {
		return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
	} catch {
		// Storage can be blocked (private windows, embedded previews); the default still works.
		return null;
	}
};

export const readViewMode = (): ViewMode => resolveViewMode(window.location.search, readSaved());

/** Saves the choice and reloads into it. Both views share the saved character, so nothing is lost. */
export const switchViewMode = (mode: ViewMode) => {
	try {
		window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
	} catch {
		// Without storage the choice only lasts for this page load, through the parameter below.
	}
	const url = new URL(window.location.href);
	url.searchParams.set('view', mode);
	window.location.replace(url.toString());
};
