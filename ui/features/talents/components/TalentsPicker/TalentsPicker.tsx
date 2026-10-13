import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { TalentsConfig } from '@sim/talents/config';
import type { TalentPoints } from '@sim/talents/talents_string';
import { parseTalentsString, serializeTalentsString, totalPointsSpent } from '@sim/talents/talents_string';
import { Button } from '@ui-kit/Button';
import { useCopyToClipboard } from '@ui-kit/hooks/useCopyToClipboard';
import { useInput } from '@ui-kit/hooks/useInput';
import { useWowheadTooltipRefresh } from '@ui-kit/hooks/useWowheadTooltipRefresh';
import { Icon } from '@ui-kit/Icon';
import type { InputConfig } from '@ui-kit/input';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { MAX_POINTS_PLAYER } from '../../model/can_set_points';
import { buildTalentGraph } from '../../model/tree_graph';
import { TalentTreePicker } from './TalentTreePicker';

export interface TalentsPickerConfig<ModObject, TalentsProto> extends InputConfig<ModObject, string> {
	trees: TalentsConfig<TalentsProto>;
}

export interface TalentsPickerProps<TalentsProto> {
	config: TalentsPickerConfig<Player<any>, TalentsProto>;
}

// The picker opens on the middle tree. Below `lg` the three scroll-snap horizontally, so that
// is a scroll position rather than a selection, and the browser drives it from there.
const INITIAL_TREE_IDX = 1;

export const TalentsPicker = <TalentsProto,>({ config }: TalentsPickerProps<TalentsProto>) => {
	const player = usePlayer();
	const fallbackId = useId();
	const { value, setValue, hidden, disabled } = useInput(player, config);

	const copyTooltipId = useId();
	const { copy, copied } = useCopyToClipboard(() => player.getTalentsString());

	const treesRef = useRef<HTMLDivElement>(null);

	const graph = useMemo(() => buildTalentGraph(config.trees), [config.trees]);
	const points = useMemo(() => parseTalentsString(config.trees, value ?? ''), [config.trees, value]);

	const onChange = useCallback((next: TalentPoints) => setValue(serializeTalentsString(next)), [setValue]);

	useEffect(() => {
		const trees = treesRef.current;
		if (!trees) return;
		trees.children[INITIAL_TREE_IDX]?.scrollIntoView({ block: 'nearest', inline: 'center' });
	}, []);

	useWowheadTooltipRefresh(value);

	return (
		<PickerShell
			config={{ ...config, id: config.id ?? fallbackId }}
			className="col-span-full flex w-fit flex-row gap-section max-fhd:flex-col max-xl:m-auto max-md:w-full"
			hidden={hidden}
			disabled={disabled}>
			<div className="flex flex-col max-lg:w-full">
				<div className="mb-1 flex w-full items-center">
					<label>
						{i18n.t('talents_tab.points_remaining', { defaultValue: 'Points Remaining' })}:{' '}
						<span data-testid="talents-picker-points-remaining">{MAX_POINTS_PLAYER - totalPointsSpent(points)}</span>
					</label>
					<div className="ml-auto" data-testid="talents-picker-actions">
						<Button
							variant="outline-primary"
							size="sm"
							className="w-24"
							data-testid="copy-button"
							onClick={copy}
							{...tooltipAnchorProps(copyTooltipId)}>
							<Icon name={copied ? 'check' : 'copy'} className="mr-1" />
							{copied ? i18n.t('common.copy_button.copied') : i18n.t('talents_tab.copy_button.label')}
						</Button>
						<Tooltip id={copyTooltipId} content={i18n.t('talents_tab.copy_button.tooltip')} />
					</div>
				</div>
				<div className="flex-1 max-lg:-mx-page">
					<div className="ui-talents-picker-trees" data-testid="talents-picker-trees" ref={treesRef}>
						{config.trees.map((_, treeIdx) => (
							<TalentTreePicker key={treeIdx} config={config.trees} graph={graph} points={points} treeIdx={treeIdx} onChange={onChange} />
						))}
					</div>
				</div>
			</div>
		</PickerShell>
	);
};
