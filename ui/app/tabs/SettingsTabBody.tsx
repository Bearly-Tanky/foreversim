import { EncounterPicker, SavedEncounter } from '@features/encounter';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { ConsumesPicker, CustomSection, OtherSettings, PlayerSettings, RaidBuffs, SavedSettings } from '@features/settings';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import { applyOwnerClassLabels, relevantStatOptions } from '@features/settings/model/stat_options';
import i18n from '@i18n/config';
import { PresetConfigurationCategory } from '@sim/constants/preset_categories';
import { usePlayer, useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { CONJURED_CONFIG, relevantConsumableOptions } from '@sim/settings/conjured';
import { ContentBlock } from '@ui-kit/ContentBlock';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import { useMemo } from 'react';

import { PresetConfigurationPicker } from '../PresetConfigurationPicker';

const SETTINGS_PRESETS = [PresetConfigurationCategory.Encounter, PresetConfigurationCategory.Settings];
const GEAR_PLANNER_PRESETS = [PresetConfigurationCategory.Settings];

export const SettingsTabBody = () => {
	const host = useSimHost();
	const config = useSpecConfig();
	const player = usePlayer();
	const ready = useSimReady();

	const options = useMemo(
		() => ({
			buffs: applyOwnerClassLabels(relevantStatOptions(BuffDebuffInputs.BUFFS_CONFIG, host), player),
			partyBuffs: applyOwnerClassLabels(relevantStatOptions(BuffDebuffInputs.PARTY_BUFFS_CONFIG, host), player),
			debuffs: applyOwnerClassLabels(relevantStatOptions(BuffDebuffInputs.DEBUFFS_CONFIG, host), player),
			debuffsMisc: applyOwnerClassLabels(relevantStatOptions(BuffDebuffInputs.DEBUFFS_MISC_CONFIG, host), player),
			conjured: ConsumablesInputs.conjuredStatOptionsFrom(relevantConsumableOptions(CONJURED_CONFIG, config)),
			explosive: relevantStatOptions(ConsumablesInputs.EXPLOSIVE_CONFIG, host),
			imbueMH: relevantStatOptions(ConsumablesInputs.IMBUE_CONFIG_MH, host),
			imbueOH: relevantStatOptions(ConsumablesInputs.IMBUE_CONFIG_OH, host),
		}),
		[host, config, player],
	);

	const itemSwapSlots = config.itemSwapSlots || [];
	const hasOtherSettings = config.otherInputs.inputs.length > 0 || itemSwapSlots.length > 0;
	const selector = useSelectorModalState();
	// A gear planner never runs an encounter, so only the sections that change the character's stats are shown:
	// no encounter, debuffs or saved encounters, and no potions or explosives.
	const gearPlanner = host.simDisabled;

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<TabPanelColumns.Left variant="settings-columns">
				<TabPanelColumns.Col>
					{ready && (
						<>
							{!gearPlanner && (
								<ContentBlock
									rootDataAttributes={{ 'data-block': 'encounter-settings' }}
									config={{ header: { title: i18n.t('settings_tab.encounter.title') } }}>
									<EncounterPicker showExecuteProportion={config.encounterPicker.showExecuteProportion} />
								</ContentBlock>
							)}
							<ContentBlock
								rootDataAttributes={{ 'data-block': 'player-settings' }}
								config={{ header: { title: i18n.t('settings_tab.player.title') } }}>
								<PlayerSettings iconInputs={config.playerIconInputs} inputs={config.playerInputs?.inputs ?? []} />
							</ContentBlock>
						</>
					)}
				</TabPanelColumns.Col>
				<TabPanelColumns.Col>
					{ready && (
						<>
							{config.sections?.map(section => (
								<CustomSection key={section.id} section={section} />
							))}
							<ContentBlock
								rootDataAttributes={{ 'data-block': 'consumes-settings' }}
								config={{ header: { title: i18n.t('settings_tab.consumables.title') } }}>
								<ConsumesPicker
									consumableStats={[...(config.consumableStats ?? []), ...config.epStats]}
									conjuredOptions={options.conjured}
									explosiveOptions={options.explosive}
									imbueMHOptions={options.imbueMH}
									imbueOHOptions={options.imbueOH}
									encounterConsumes={!gearPlanner}
								/>
							</ContentBlock>
							{hasOtherSettings && (
								<ContentBlock
									rootDataAttributes={{ 'data-block': 'other-settings' }}
									config={{ header: { title: i18n.t('settings_tab.other.title') } }}>
									<OtherSettings inputs={config.otherInputs.inputs} itemSlots={itemSwapSlots} />
								</ContentBlock>
							)}
						</>
					)}
				</TabPanelColumns.Col>
				<TabPanelColumns.Col>
					{ready && (
						<>
							<ContentBlock
								rootDataAttributes={{ 'data-block': 'buffs-settings' }}
								config={{
									header: {
										title: i18n.t('settings_tab.raid_buffs.title'),
										tooltip: i18n.t('settings_tab.raid_buffs.tooltip'),
										className: 'flex-col',
									},
									withoutBody: options.buffs.length === 0,
									bodyClassName: 'grid grid-cols-1 xl:grid-cols-2 gap-3 fhd:grid-cols-3',
								}}
								headerChildren={<p className="text-sm">{i18n.t('settings_tab.raid_buffs.description')}</p>}>
								<RaidBuffs options={options.buffs} miscOptions={[]} />
							</ContentBlock>
							{options.partyBuffs.length > 0 && (
								<ContentBlock
									rootDataAttributes={{ 'data-block': 'party-buffs-settings' }}
									config={{
										header: {
											title: i18n.t('settings_tab.party_buffs.title'),
											tooltip: i18n.t('settings_tab.party_buffs.tooltip'),
											className: 'flex-col',
										},
										bodyClassName: 'grid grid-cols-1 xl:grid-cols-2 gap-3 fhd:grid-cols-3',
									}}
									headerChildren={<p className="text-sm">{i18n.t('settings_tab.party_buffs.description')}</p>}>
									<RaidBuffs options={options.partyBuffs} miscOptions={[]} />
								</ContentBlock>
							)}
							{!gearPlanner && (
								<ContentBlock
									rootDataAttributes={{ 'data-block': 'debuffs-settings' }}
									config={{
										header: {
											title: i18n.t('settings_tab.debuffs.title'),
											tooltip: i18n.t('settings_tab.debuffs.tooltip'),
											className: 'flex-col',
										},
										withoutBody: options.debuffs.length === 0,
										bodyClassName: 'grid grid-cols-1 xl:grid-cols-2 gap-3 fhd:grid-cols-3',
									}}>
									<RaidBuffs options={options.debuffs} miscOptions={options.debuffsMisc} />
								</ContentBlock>
							)}
						</>
					)}
				</TabPanelColumns.Col>
			</TabPanelColumns.Left>
			<TabPanelColumns.Right>
				<PresetConfigurationPicker categories={gearPlanner ? GEAR_PLANNER_PRESETS : SETTINGS_PRESETS} />
				{!gearPlanner && <SavedEncounter />}
				<SavedSettings />
			</TabPanelColumns.Right>
			<SelectorModal state={selector} id="item-swap-selector-modal" rail={false} />
		</OpenSelectorModalContext>
	);
};
