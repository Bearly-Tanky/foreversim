import type { GcdExtensionItem as GcdExtensionItemModel } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface GcdExtensionItemProps {
	item: GcdExtensionItemModel;
}

/**
 * The tail of the GCD after the cast bar ends. It carries no `data-item-index`: it names no cast of
 * its own, so hovering it should fall through to the row rather than open an empty tooltip.
 */
export const GcdExtensionItem = ({ item }: GcdExtensionItemProps) => (
	<div
		data-testid="rotation-item-gcd-extension"
		className="ui-timeline-item top-(--rotation-item-top) h-(--rotation-item-h) w-timeline-segment bg-[rgb(80_180_235/0.22)]"
		style={spanStyle(item.start, item.end - item.start)}
	/>
);
