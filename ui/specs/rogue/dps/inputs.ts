import { Spec } from '@generated/proto/common';
import { Player } from '@sim/player/player';
import { CustomSection, InputConfig } from '@sim/spec_config';

// Poisons are the rogue's own imbues, which the shared imbue pickers no longer list. The values are
// the imbue ids sim/rogue/poisons.go reads off the consumes (instantImbueID, deadlyImbueID, woundImbueID).
const POISONS = [
	{ name: 'None', value: 0 },
	{ name: 'Instant Poison', value: 26891 },
	{ name: 'Deadly Poison', value: 27186 },
	{ name: 'Wound Poison', value: 27188 },
];

const poisonInput = (field: 'mhImbueId' | 'ohImbueId', label: string): InputConfig<Player<Spec.SpecRogue>> => ({
	id: `rogue-poison-${field}`,
	type: 'enum',
	label,
	values: POISONS,
	storeField: 'consumables',
	getValue: player => player.getConsumes()[field],
	setValue: (player, newValue) => {
		const consumes = player.getConsumes();
		if (consumes[field] === newValue) return;
		consumes[field] = newValue;
		player.setConsumes(consumes);
	},
});

export const PoisonsSection: CustomSection<Spec.SpecRogue> = {
	id: 'rogue-poisons',
	title: 'Poisons',
	inputs: [poisonInput('mhImbueId', 'Main Hand'), poisonInput('ohImbueId', 'Off Hand')],
};
