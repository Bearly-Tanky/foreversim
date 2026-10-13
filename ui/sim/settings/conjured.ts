// The conjured items the back-end is allowed to pick from, per spec.
//
// TBC's `Player.getConsumes(true)` sends the whole eligible list rather than the one the user
// picked, so this table has to sit below the view layer. It carries only what that decision needs:
// the item id, the stats that make an item relevant to a spec, and the availability predicate. The
// picker's icons and labels stay in the settings feature, which sources its values from here.
import { Class, Spec, Stat } from '@generated/proto/common';

import type { Player, SpecConfigData } from '../player/player';

export interface ConsumableOption {
	value: number;
	stats: Array<Stat>;
	showWhen?: (player: Player<any>) => boolean;
}

export const CONJURED_CONFIG: Array<ConsumableOption> = [
	// Thistle Tea
	{ value: 7676, stats: [], showWhen: player => player.getClass() == Class.ClassRogue },
	// Major Healthstone
	{ value: 9421, stats: [Stat.StatStamina] },
	// Dark Rune
	{ value: 12662, stats: [Stat.StatIntellect] },
];

// Keeps only the options whose stats matter to this spec — the same filter the settings pickers
// apply (relevantStatOptions), expressed against the domain-layer slice of the spec config.
export function relevantConsumableOptions<SpecType extends Spec>(
	options: Array<ConsumableOption>,
	specConfig: SpecConfigData<SpecType>,
): Array<ConsumableOption> {
	const displayStatSet = new Set((specConfig.displayStats ?? []).map(us => (us.hasRootStat() ? us.getRootStat() : us.getPseudoStat())));
	const include = specConfig.includeBuffDebuffInputs ?? [];
	const exclude = specConfig.excludeBuffDebuffInputs ?? [];

	return options
		.filter(
			option =>
				option.stats.length === 0 ||
				option.stats.some(stat => displayStatSet.has(stat)) ||
				option.stats.some(stat => specConfig.epStats.includes(stat)) ||
				option.stats.some(stat => include.includes(stat)),
		)
		.filter(option => !option.stats.some(stat => exclude.includes(stat)));
}
