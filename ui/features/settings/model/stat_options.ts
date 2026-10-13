import { Class, Faction, Stat } from '@generated/proto/common';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { IndividualSimHost } from '@sim/sim_host';
import type { IconEnumPickerConfig } from '@ui-kit/IconEnumPicker/types';
import type { IconPickerConfig } from '@ui-kit/IconPicker/types';
import type { MultiIconPickerConfig } from '@ui-kit/MultiIconPicker/types';

export interface ActionInputConfig<T> {
	actionId: ActionId;
	value: T;
	faction?: Faction;
	showWhen?: (player: Player<any>) => boolean;
}

export interface StatOption {
	stats: Array<Stat>;
	// The class that casts this buff, where one class owns it. Set by the generated buff rows.
	ownerClass?: Class;
}

export interface ItemStatOption<T> extends StatOption {
	config: ActionInputConfig<T>;
}

export interface PickerStatOption<ConfigType> extends StatOption {
	config: ConfigType;
}

export interface IconPickerStatOption extends PickerStatOption<IconPickerConfig<Player<any>, any>> {}

export interface MultiIconPickerStatOption extends PickerStatOption<MultiIconPickerConfig<Player<any>>> {}

export interface IconEnumPickerStatOption extends PickerStatOption<IconEnumPickerConfig<Player<any>, any>> {}

export type ItemStatOptions<T> = ItemStatOption<T>;
export type PickerStatOptions = IconPickerStatOption | MultiIconPickerStatOption | IconEnumPickerStatOption;
export type RenderableStatOptions = IconPickerStatOption | MultiIconPickerStatOption | IconEnumPickerStatOption;
export type StatOptions<T, Options extends ItemStatOptions<T> | PickerStatOptions> = Array<Options>;

// A spec's includeBuffDebuffInputs / excludeBuffDebuffInputs list holds stats (any option tagged
// with that stat) and input configs (that one option), so a spec can drop a single buff that shares
// its stat tag with buffs it wants to keep, e.g. Mana Tide but not Mana Spring.
export function relevantStatOptions<T, OptionsType extends ItemStatOptions<T> | PickerStatOptions>(
	options: StatOptions<T, OptionsType>,
	simUI: IndividualSimHost<any>,
): StatOptions<T, OptionsType> {
	const individualConfig = simUI.individualConfig;
	const displayStatSet = new Set(individualConfig.displayStats.map(us => (us.hasRootStat() ? us.getRootStat() : us.getPseudoStat())));
	const listed = (list: ReadonlyArray<unknown>, option: OptionsType) => list.includes(option.config) || option.stats.some(stat => list.includes(stat));

	return options
		.filter(
			option =>
				option.stats.length === 0 ||
				option.stats.some(stat => displayStatSet.has(stat)) ||
				option.stats.some(stat => individualConfig.epStats.includes(stat)) ||
				listed(individualConfig.includeBuffDebuffInputs, option),
		)
		.filter(option => !listed(individualConfig.excludeBuffDebuffInputs, option));
}

// A class never buffs itself with its own buff, so on that class's settings tab the row reads
// "(External)": an outside caster is the only source. Every other option comes back as the same
// object, so include / exclude lists that name a config keep matching it by reference.
export function applyOwnerClassLabels<OptionsType extends RenderableStatOptions>(options: ReadonlyArray<OptionsType>, player: Player<any>): OptionsType[] {
	const playerClass = player.getClass();
	return options.map(option => {
		const label = option.config.label;
		if (option.ownerClass !== playerClass || typeof label !== 'string') return option;
		return { ...option, config: { ...option.config, label: `${label} (External)` } };
	});
}

const describeInput = (config: RenderableStatOptions['config']): string =>
	config.label ?? ('actionId' in config ? `the input for spell ${config.actionId.spellId}` : 'an unlabelled input');

// A registry lists its rows in display order: a prebuilt option's config stands for that option,
// keeping the stat tags and owner class it was built with, and a literal row is written out in
// place. Both directions throw: a config with no prebuilt option, and a prebuilt option no row
// names. A regenerated registry therefore fails loudly instead of losing a row off the tab.
export function inDisplayOrder(
	prebuilt: ReadonlyArray<RenderableStatOptions>,
	rows: ReadonlyArray<RenderableStatOptions | RenderableStatOptions['config']>,
): RenderableStatOptions[] {
	const composed = rows.map(row => {
		if ('config' in row) return row;
		const option = prebuilt.find(candidate => candidate.config === row);
		if (!option) throw new Error(`the display order names ${describeInput(row)}, which no prebuilt row carries`);
		return option;
	});

	const placed = new Set(composed.map(option => option.config));
	const dropped = prebuilt.filter(option => !placed.has(option.config));
	if (dropped.length > 0) {
		throw new Error(`the display order leaves out ${dropped.map(option => describeInput(option.config)).join(', ')}`);
	}

	return composed;
}
