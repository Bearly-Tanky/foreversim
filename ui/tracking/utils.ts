// Analytics are switched off: this build sends no page views or events anywhere. The
// functions are kept so the UI's tracking calls stay in place as no-ops.

export const trackPageView = (_title: string, _slug: string) => {};

export type TrackEventProps = {
	action: 'settings' | 'sim' | 'click';
	category: string;
	label?: string;
	value?: number | string | boolean;
	additionalData?: Record<string, string | number>;
};

export const trackEvent = (_props: TrackEventProps) => {};
