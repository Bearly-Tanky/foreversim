import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { noticeIconClass, type NoticeLevel } from '@ui-kit/NoticeLevel';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId } from 'react';

import { ENCHANT_NOTICES, ITEM_INFO_NOTICES, ITEM_NOTICES } from '../../item_notices';

export interface ItemNoticeIconProps {
	itemId?: number;
	enchantId?: number;
	additionalNotice?: ReactNode;
}

export const ItemNoticeIcon = ({ itemId, enchantId, additionalNotice }: ItemNoticeIconProps) => {
	const player = usePlayer();
	const tooltipId = useId();
	const spec = player.getSpec();

	const itemNotice = itemId ? ITEM_NOTICES.get(itemId) : undefined;
	const ownNotice = itemNotice?.[spec] || itemNotice?.[Spec.SpecUnknown];
	const enchantNotice = enchantId ? ENCHANT_NOTICES.get(enchantId) : undefined;
	const ownEnchantNotice = enchantNotice?.[spec] || enchantNotice?.[Spec.SpecUnknown];
	const infoNotice = itemId ? ITEM_INFO_NOTICES.get(itemId) : undefined;

	if (!ownNotice && !ownEnchantNotice && !additionalNotice && !infoNotice) return null;

	const warns = !!ownNotice || !!ownEnchantNotice || !!additionalNotice;
	const level: NoticeLevel = warns ? 'warning' : 'info';

	return (
		<div className="relative z-1 inline">
			<button
				type="button"
				aria-label={i18n.t(warns ? 'common.list_picker.warnings' : 'common.list_picker.additional_information')}
				className={clsx(noticeIconClass(level), 'fa-xl fa-fw mr-2')}
				{...tooltipAnchorProps(tooltipId)}
			/>
			<Tooltip
				id={tooltipId}
				content={
					<div>
						{ownNotice}
						{ownEnchantNotice}
						{additionalNotice}
						{infoNotice}
					</div>
				}
				clickable
			/>
		</div>
	);
};
