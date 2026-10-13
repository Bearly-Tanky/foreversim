import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

import { wowheadAnchorProps } from '../utils/wowhead';

export interface ImprovedAnchorProps {
	actionId: ActionId;
	testId: string;
	active: boolean;
	/** Which bottom corner of the icon the badge sits in: the two improved badges share the overlay and must not stack. */
	corner: 'left' | 'right';
}

export const ImprovedAnchor = ({ actionId, testId, active, corner }: ImprovedAnchorProps) => {
	const { iconUrl, href } = useActionId(actionId);
	return (
		<a
			className={clsx(
				'ui-icon-picker-swatch pointer-events-auto absolute bottom-0 size-5 min-w-5',
				corner === 'left' ? 'left-0' : 'right-0',
				active ? 'filter-none' : 'border-gray-600 grayscale',
			)}
			data-testid={testId}
			data-active={active ? '' : undefined}
			{...wowheadAnchorProps()}
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			// The glyph is a background image, so until it resolves the badge is a bare grey square. Master hid
			// exactly that window with `.icon-input-improved:not([href])`, its href being set only after the fill.
			hidden={!iconUrl}
		/>
	);
};
