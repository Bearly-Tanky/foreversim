import type { EquipmentSpec } from '@generated/proto/common';
import type { PresetGear, PresetTalents } from '@sim/presets/types';
import type { Gear } from '@sim/proto/gear';
import type { TalentsConfig } from '@sim/talents/config';

/** The preset the talents are, or -1 when they match none. */
export const talentPresetIndex = (presets: ReadonlyArray<PresetTalents>, talentsString: string): number =>
	presets.findIndex(preset => preset.data.talentsString === talentsString);

/** The preset the gear is, item for item (enchants may differ), or -1 when it matches none. */
export const gearPresetIndex = (presets: ReadonlyArray<PresetGear>, gear: Gear): number => {
	const equipped = gear.asSpec().items;
	const matches = (spec: EquipmentSpec) => {
		const length = Math.max(equipped.length, spec.items.length);
		for (let slot = 0; slot < length; slot++) {
			if ((equipped[slot]?.id ?? 0) !== (spec.items[slot]?.id ?? 0)) return false;
		}
		return true;
	};
	return presets.findIndex(preset => matches(preset.gear));
};

/** "Fury · 17/34/0": the tree with the most points, then every tree's points. */
export const talentSummary = (trees: TalentsConfig<any>, points: ReadonlyArray<number>): string => {
	const total = points.reduce((sum, value) => sum + value, 0);
	if (total === 0 || trees.length === 0) return 'No talents chosen';
	const main = points.indexOf(Math.max(...points));
	const split = trees.map((_, index) => points[index] ?? 0).join('/');
	return `${trees[main]?.name ?? ''} · ${split}`;
};
