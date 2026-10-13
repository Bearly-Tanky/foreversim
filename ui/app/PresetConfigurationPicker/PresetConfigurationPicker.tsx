import { applyBuild } from '@features/settings/model/apply_build';
import i18n from '@i18n/config';
import type { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useReadyStoreSubscribe } from '@sim/hooks/useReadyStoreSubscribe';
import { useSimReady } from '@sim/hooks/useSimReady';
import { subscribeSimChange } from '@sim/state/subscriptions';
import { Chip } from '@ui-kit/Chip';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId, useMemo } from 'react';

import { buildCategories, isBuildActive } from '../preset_build_state';
import type { PresetBuild } from '../preset_utils';
import { PresetGroupPicker, usePresetFilterPhase } from '../PresetGroupPicker';

export interface PresetConfigurationPickerProps {
	categories: Array<PresetConfigurationCategory>;
}

export const PresetConfigurationPicker = ({ categories }: PresetConfigurationPickerProps) => {
	const host = useSimHost();
	const presets = useSpecPresets();
	const ready = useSimReady();
	const tooltipId = useId();

	const builds = useMemo(() => (presets.builds ?? []).filter(build => categories.some(category => !!build[category])), [presets, categories]);
	const grouped = useMemo(() => builds.some(build => build.phase !== undefined || build.group !== undefined), [builds]);

	// The active check must never run against an uninitialised sim; `useReadyStoreSubscribe` keeps
	// that true here.
	const active = useReadyStoreSubscribe(subscribeSimChange(host.sim), () => builds.map(build => isBuildActive(build, host, categories)), ready);

	const filter = usePresetFilterPhase(builds);

	const chips = builds.map((build, index) => (
		<Chip
			key={build.name}
			as="button"
			nameAs="span"
			label={build.name}
			active={active?.[index]}
			onSelect={() => {
				applyBuild(build, host);
				filter.selectPhase(build.phase);
			}}
			nameProps={{ role: 'button' }}
			rootProps={{ type: 'button', ...tooltipAnchorProps(tooltipId, build.name) }}
		/>
	));

	if (!builds.length) return null;

	const title = i18n.t('gear_tab.preset_configurations.title');
	const tooltip = i18n.t('gear_tab.preset_configurations.tooltip');

	return (
		<div data-testid="preset-configuration-picker-root" data-saved-data-manager="">
			{grouped ? (
				<PresetGroupPicker
					phases={filter.phases}
					phase={filter.phase}
					onSelectPhase={filter.selectPhase}
					sections={[
						{
							title,
							tooltip,
							items: ready
								? builds.map((build, index) => ({ key: `${index}-${build.name}`, phase: build.phase, group: build.group, node: chips[index] }))
								: [],
						},
					]}
				/>
			) : (
				<ContentBlock config={{ header: { title, tooltip } }}>
					{ready && (
						<div className="ui-saved-data-container">
							<div className="ui-saved-data-presets" data-testid="saved-data-presets">
								{chips}
							</div>
						</div>
					)}
				</ContentBlock>
			)}
			<Tooltip
				id={tooltipId}
				render={({ activeAnchor }) => {
					const build = builds.find(candidate => candidate.name === activeAnchor?.getAttribute('data-tooltip-content'));
					return build ? <PresetBuildTooltip build={build} /> : null;
				}}
			/>
		</div>
	);
};

const PresetBuildTooltip = ({ build }: { build: PresetBuild }) => (
	<>
		<p className="mb-1">{i18n.t('common.preset.description')}</p>
		<ul className="mb-0">
			{buildCategories(build).map(category => (
				<li key={category}>{category}</li>
			))}
		</ul>
	</>
);
