import { SavedGear } from '@features/gear/components/SavedGear';
import { gearSetData, serializeGearSet } from '@features/gear/components/SavedGear/utils';
import { useSavedGear } from '@features/gear/hooks/useSavedGear';
import { useSavedPanel } from '@features/hooks/useSavedPanel';
import { applyBuild } from '@features/settings/model/apply_build';
import { EquipmentSpec, UnitStats } from '@generated/proto/common';
import { SavedGearSet } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useReadyStoreSubscribe } from '@sim/hooks/useReadyStoreSubscribe';
import { useSimReady } from '@sim/hooks/useSimReady';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { PresetGear } from '@sim/presets/types';
import { Stats } from '@sim/proto/stats';
import { batch } from '@sim/state/batch';
import { subscribePlayerChange, subscribeSimChange } from '@sim/state/subscriptions';
import { Chip } from '@ui-kit/Chip';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { LocaleHtml, Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { useId, useMemo } from 'react';

import { buildCategories, isBuildActive } from '../preset_build_state';
import type { PresetBuild } from '../preset_utils';
import { PresetConfigurationPicker } from '../PresetConfigurationPicker';
import { PresetGroupPicker, usePresetFilterPhase } from '../PresetGroupPicker';

const GEAR_PRESETS = [PresetConfigurationCategory.Gear];

/**
 * The gear tab's right column. When any build or gear preset carries a phase or a group, the two
 * flat pickers collapse into one phase-filtered group picker with a section each — the same switch
 * `gear_tab.ts` makes, and the reason the two layouts share one owner.
 */
export const GearPresets = () => {
	const presets = useSpecPresets();
	const grouped = useMemo(
		() => [...(presets.builds ?? []), ...presets.gear].some(preset => preset.phase !== undefined || preset.group !== undefined),
		[presets],
	);

	if (!grouped) {
		return (
			<>
				<PresetConfigurationPicker categories={GEAR_PRESETS} />
				<SavedGear />
			</>
		);
	}

	return <GroupedGearPresets />;
};

const GroupedGearPresets = () => {
	const host = useSimHost();
	const { player, sim } = host;
	const presets = useSpecPresets();
	const ready = useSimReady();
	const buildTooltipId = useId();
	const gearTooltipId = useId();

	const builds = useMemo(() => (presets.builds ?? []).filter(build => !!build.gear), [presets]);
	const gearPresets = presets.gear;

	const filter = usePresetFilterPhase(useMemo(() => [...builds, ...gearPresets], [builds, gearPresets]));

	const buildsActive = useReadyStoreSubscribe(subscribeSimChange(sim), () => builds.map(build => isBuildActive(build, host, GEAR_PRESETS)), ready);

	const gearData = useMemo(
		() =>
			ready
				? gearPresets.map(preset =>
						SavedGearSet.create({ gear: sim.db.lookupEquipmentSpec(preset.gear).asSpec(), bonusStatsStats: new Stats().toProto() }),
					)
				: [],
		[ready, gearPresets, sim],
	);
	const current = useStoreSubscribe(subscribePlayerChange(player), () => gearSetData(player));

	const savedPanel = useSavedPanel({
		label: i18n.t('gear_tab.gear_sets.gear_set'),
		storage: useSavedGear(),
		current,
		serialize: serializeGearSet,
		load: entry =>
			batch(() => {
				player.setGear(sim.db.lookupEquipmentSpec(entry.data.gear || EquipmentSpec.create()));
				player.setBonusStats(Stats.fromProto(entry.data.bonusStatsStats || UnitStats.create()));
			}),
	});

	const loadGearPreset = (preset: PresetGear) => {
		batch(() => {
			player.setGear(sim.db.lookupEquipmentSpec(preset.gear));
			player.setBonusStats(new Stats());
		});
		preset.onLoad?.(player);
	};

	const sections = [
		...(builds.length
			? [
					{
						title: i18n.t('gear_tab.preset_configurations.title'),
						tooltip: i18n.t('gear_tab.preset_configurations.tooltip'),
						items: ready
							? builds.map((build, index) => ({
									key: `${index}-${build.name}`,
									phase: build.phase,
									group: build.group,
									node: (
										<Chip
											as="button"
											nameAs="span"
											label={build.name}
											active={buildsActive?.[index]}
											onSelect={() => {
												applyBuild(build, host);
												filter.selectPhase(build.phase);
											}}
											nameProps={{ role: 'button' }}
											rootProps={{ type: 'button', ...tooltipAnchorProps(buildTooltipId, build.name) }}
										/>
									),
								}))
							: [],
					},
				]
			: []),
		...(gearPresets.length
			? [
					{
						title: i18n.t('gear_tab.gear_sets.title'),
						items: ready
							? gearPresets.map((preset, index) => ({
									key: preset.name,
									phase: preset.phase,
									group: preset.group,
									node: (
										<Chip
											label={preset.name}
											active={SavedGearSet.equals(gearData[index], current)}
											disabled={!!preset.enableWhen && !preset.enableWhen(player)}
											tooltip={preset.tooltip}
											chipTooltipId={gearTooltipId}
											onSelect={() => loadGearPreset(preset)}
										/>
									),
								}))
							: [],
						// An empty title renders an empty heading, which is how the pre-port layout put the
						// user's own saved sets under the grouped presets without repeating "Gear Sets".
						footer: (
							<SavedDataPanel
								title=""
								className="mt-4"
								nameLabel={i18n.t('gear_tab.gear_sets.gear_set_name')}
								saveButtonText={i18n.t('gear_tab.gear_sets.save_gear_set')}
								presets={[]}
								{...savedPanel}
							/>
						),
					},
				]
			: []),
	];

	return (
		<div data-testid="preset-configuration-picker-root" data-saved-data-manager="">
			<PresetGroupPicker sections={sections} phases={filter.phases} phase={filter.phase} onSelectPhase={filter.selectPhase} />
			<Tooltip
				id={buildTooltipId}
				render={({ activeAnchor }) => {
					const build = builds.find(candidate => candidate.name === activeAnchor?.getAttribute('data-tooltip-content'));
					return build ? <PresetBuildTooltip build={build} /> : null;
				}}
			/>
			{/* The default preset-gear tooltip is the BIS disclaimer, which is two `<p>`s of markup. */}
			<Tooltip
				id={gearTooltipId}
				place="bottom"
				render={({ content }) => (typeof content === 'string' && content ? <LocaleHtml html={content} /> : null)}
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
