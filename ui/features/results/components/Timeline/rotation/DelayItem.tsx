import type { DelayItem as DelayItemModel } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface DelayItemProps {
	item: DelayItemModel;
	index: number;
}

/** Sits in the cast band and behind the cast bar, which carries z-1. */
export const DelayItem = ({ item, index }: DelayItemProps) => (
	<div
		data-testid="rotation-item-delay"
		className="ui-timeline-item top-(--rotation-item-top) h-(--rotation-item-h) w-timeline-segment bg-[rgb(220_80_80/0.35)]"
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}
	/>
);
