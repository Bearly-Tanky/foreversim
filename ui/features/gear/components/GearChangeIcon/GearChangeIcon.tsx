import type { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { getEmptyGemSocketIconUrl } from '@sim/proto/gems';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEquippedItemWowheadDataset } from '@ui-kit/hooks/useEquippedItemWowheadDataset';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId, useMemo } from 'react';

import { getEmptySlotIconUrl } from '../../model/empty_slot_icons';
import { gearChangeSockets } from './utils';

export interface GearChangeIconProps {
	slot: ItemSlot;
	/** The slot after the run. Undefined renders the empty frame, which is what an unfilled slot looks like. */
	item?: EquippedItem;
	previousItem?: EquippedItem;
}

/**
 * Parameterises the slot and the before/after pair; fixes the frame and the per-socket change
 * markers.
 */
export const GearChangeIcon = ({ slot, item, previousItem }: GearChangeIconProps) => {
	const host = useSimHost();
	const player = host.player;
	const slotName = translateSlotName(slot);
	const tooltipId = useId();

	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);

	const wowheadProps = useEquippedItemWowheadDataset(player, item);

	const sockets = useMemo(() => gearChangeSockets(item, previousItem), [item, previousItem]);

	return (
		<div className="ui-item-picker-root" data-testid="gear-change-icon">
			<div className="relative w-fit">
				<div
					className="ui-item-picker-icon-wrapper"
					data-testid="item-picker-icon-wrapper"
					style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
				/>
				<a
					className="absolute inset-0"
					data-testid="gear-change-icon-link"
					href={item ? href || undefined : undefined}
					data-whtticon={item ? 'false' : undefined}
					{...wowheadProps}
				/>
				<div className="ui-item-picker-sockets-container" data-testid="item-picker-sockets-container">
					{sockets.map(({ socketColor, gemName, changed }, gemIdx) => (
						<div
							key={gemIdx}
							className="ui-gear-change-icon-gem-socket relative size-(--gem-width) shrink-0 not-last:mr-px"
							data-testid="gem-socket-container"
							data-interactive={changed || undefined}
							style={{ backgroundImage: `url(${getEmptyGemSocketIconUrl(socketColor)})` }}
							{...(changed && gemName ? tooltipAnchorProps(`${tooltipId}-socket-${gemIdx}`) : {})}>
							{changed && <i className="fas fa-exclamation-circle ui-gear-change-icon-gem-marker block" />}
						</div>
					))}
				</div>
			</div>
			{sockets.map(({ gemName, changed }, gemIdx) =>
				changed && gemName ? (
					<Tooltip
						key={gemIdx}
						id={`${tooltipId}-socket-${gemIdx}`}
						content={
							<>
								<strong>
									{slotName} - Socket {gemIdx + 1}
								</strong>
								<br />
								{gemName}
							</>
						}
					/>
				) : null,
			)}
		</div>
	);
};
