import type { APLValidation } from '@generated/proto/api';
import { LogLevel } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { ListItemAction } from '@ui-kit/ListPicker';
import { NOTICE_COLOR, NOTICE_ICON, type NoticeLevel } from '@ui-kit/NoticeLevel';
import { Tooltip } from '@ui-kit/Tooltip';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

export interface AplValidationsProps {
	/** The validations for this one list item, read fresh on every `currentStats` notification. */
	getValidations: (player: Player<any>) => Array<APLValidation>;
}

const LEVEL = new Map<LogLevel, NoticeLevel>([
	[LogLevel.Information, 'info'],
	[LogLevel.Warning, 'warning'],
	[LogLevel.Error, 'error'],
]);

const HEADER = new Map<LogLevel, string>([
	[LogLevel.Information, i18n.t('common.list_picker.additional_information')],
	[LogLevel.Warning, i18n.t('common.list_picker.action_has_warnings')],
	[LogLevel.Error, i18n.t('common.list_picker.action_has_errors')],
]);

/** Written out rather than derived: `LogLevel` is a numeric enum, so iterating it yields the reverse mappings too. */
const LEVEL_CLASS = new Map<LogLevel, string>([
	[LogLevel.Undefined, 'apl-validation-undefined'],
	[LogLevel.Information, `apl-validation-information ${NOTICE_COLOR.info}`],
	[LogLevel.Warning, `apl-validation-warning ${NOTICE_COLOR.warning}`],
	[LogLevel.Error, `apl-validation-error ${NOTICE_COLOR.error}`],
]);

const sameValidations = (a: Array<APLValidation>, b: Array<APLValidation>) =>
	a.length === b.length && a.every((entry, index) => entry.logLevel === b[index].logLevel && entry.validation === b[index].validation);

interface Formatted {
	maxLogLevel: LogLevel;
	groups: Array<{ header?: string; messages: Array<string> }>;
}

/**
 * The item's validations, grouped by level and with every spell id resolved to its name.
 *
 * A message is text, never markup: the sim formats rotation-supplied group and variable names
 * straight into it, so it has to reach the tooltip as a text child and not as HTML.
 */
const format = async (validations: Array<APLValidation>): Promise<Formatted> => {
	const resolved = await Promise.all(validations.map(async entry => ({ ...entry, validation: await ActionId.replaceAllInString(entry.validation) })));
	const grouped = new Map<LogLevel, Array<string>>();
	let maxLogLevel = LogLevel.Undefined;
	for (const entry of resolved) {
		maxLogLevel = Math.max(entry.logLevel, maxLogLevel);
		const group = grouped.get(entry.logLevel);
		if (group) group.push(entry.validation);
		else grouped.set(entry.logLevel, [entry.validation]);
	}
	return { maxLogLevel, groups: Array.from(grouped, ([logLevel, messages]) => ({ header: HEADER.get(logLevel), messages })) };
};

/**
 * The warning triangle on an APL list item's header.
 *
 * The button is present but `display: none` while an item has nothing to say, which keeps the
 * header's element count stable. Formatting is asynchronous because a validation names spells by id
 * and `ActionId.replaceAllInString` resolves them.
 */
export const AplValidations = ({ getValidations }: AplValidationsProps) => {
	const player = usePlayer();
	const tooltipId = useId();
	const read = useRef(getValidations);
	read.current = getValidations;

	const subscribe = subscribePlayerField(player, 'currentStats');
	const last = useRef<Array<APLValidation>>([]);
	const validations = useStoreSubscribe(subscribe, () => {
		const next = read.current(player);
		if (!sameValidations(last.current, next)) last.current = next;
		return last.current;
	});

	const [formatted, setFormatted] = useState<Formatted | null>(null);
	useEffect(() => {
		if (!validations.length) {
			setFormatted(null);
			return;
		}
		let live = true;
		format(validations).then(next => {
			if (live) setFormatted(next);
		});
		return () => {
			live = false;
		};
	}, [validations]);

	const level = formatted ? LEVEL.get(formatted.maxLogLevel) : undefined;
	const icon = level ? NOTICE_ICON[level] : NOTICE_ICON.warning;

	return (
		<>
			<ListItemAction
				icon={icon ?? ''}
				className={formatted ? LEVEL_CLASS.get(formatted.maxLogLevel) : undefined}
				testId="apl-validations"
				hidden={!formatted}
				tooltip={i18n.t('common.list_picker.warnings')}
				tooltipId={tooltipId}
			/>
			<Tooltip
				id={tooltipId}
				// `render` wins over the anchor's own `data-tooltip-content`, which is what the fallback branch hands back.
				render={({ content }) =>
					formatted
						? formatted.groups.map((group, index) => (
								<Fragment key={index}>
									<p>{group.header}</p>
									<ul>
										{group.messages.map((message, messageIndex) => (
											<li key={messageIndex}>{message}</li>
										))}
									</ul>
								</Fragment>
							))
						: content
				}
			/>
		</>
	);
};
