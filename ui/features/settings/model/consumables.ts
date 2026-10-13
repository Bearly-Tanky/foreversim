import { Class, ConsumesSpec, ItemSlot, Profession, Spec, Stat } from '@generated/proto/common';
import { Consumable } from '@generated/proto/db';
import i18n from '@i18n/config';
import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import type { ConsumableOption } from '@sim/settings/conjured';
import { batch } from '@sim/state/batch';
import { makeBooleanConsumeInput } from '@ui-kit/icon_inputs';
import { IconEnumValueConfig } from '@ui-kit/IconEnumPicker/types';
import * as InputHelpers from '@ui-kit/input_helpers';

import { ActionInputConfig, ItemStatOption } from './stat_options';
export interface ConsumableInputConfig<T> extends ActionInputConfig<T> {
	value: T;
}

export interface ConsumableStatOption<T> extends ItemStatOption<T> {
	config: ConsumableInputConfig<T>;
}

// `ui/sim/settings/conjured.ts` carries the conjured-item table as domain-layer data
// ({ value, stats, showWhen }, no ActionId) because `ui/sim` cannot import `@features`.
// This lifts it into the picker-facing shape the icon-enum factory expects.
export const conjuredStatOptionsFrom = (options: ReadonlyArray<ConsumableOption>): Array<ConsumableStatOption<number>> =>
	options.map(option => ({
		config: { actionId: ActionId.fromItemId(option.value), value: option.value, showWhen: option.showWhen },
		stats: option.stats,
	}));

export interface ConsumeInputFactoryArgs<T extends number> {
	consumesFieldName: keyof ConsumesSpec;
	// Additional callback if logic besides syncing consumes is required
	onSet?: (player: Player<any>, newValue: T) => void;
	showWhen?: (player: Player<any>) => boolean;
}

function makeConsumeInputFactory<T extends number, SpecType extends Spec>(
	args: ConsumeInputFactoryArgs<T>,
): (options: ConsumableStatOption<T>[], tooltip?: string) => InputHelpers.TypedIconEnumPickerConfig<Player<SpecType>, T> {
	return (options: ConsumableStatOption<T>[], tooltip?: string) => {
		const valueOptions = options.map(
			option =>
				({
					actionId: option.config.actionId,
					value: option.config.value,
					showWhen: (player: Player<SpecType>) =>
						(!option.config.showWhen || option.config.showWhen(player)) && (option.config.faction || player.getFaction()) == player.getFaction(),
				}) satisfies IconEnumValueConfig<Player<SpecType>, T>,
		);
		return {
			type: 'iconEnum',
			tooltip: tooltip,
			numColumns: options.length > 5 ? 2 : 1,
			values: [{ value: 0, iconUrl: '', tooltip: i18n.t('common.none') } as unknown as IconEnumValueConfig<Player<SpecType>, T>].concat(valueOptions),
			equals: (a: T, b: T) => a == b,
			zeroValue: 0 as T,
			// `raid:partyBuffs` because the main-hand imbue's showWhen reads Windfury Totem off the
			// party. Without it, turning Windfury on leaves a sharpening stone visible and set and the
			// sim applies both, until some unrelated consumable or gear write re-evaluates the row.
			storeField: ['consumables', 'gear', 'profession1', 'profession2', 'race', 'raid:partyBuffs'],
			showWhen: (player: Player<any>) => (!args.showWhen || args.showWhen(player)) && valueOptions.some(option => option.showWhen?.(player)),
			getValue: (player: Player<any>) => player.getConsumes()[args.consumesFieldName] as T,
			setValue: (player: Player<any>, newValue: number) => {
				const newConsumes = player.getConsumes();
				if (newConsumes[args.consumesFieldName] === newValue) {
					return;
				}

				(newConsumes[args.consumesFieldName] as number) = newValue;
				batch(() => {
					player.setConsumes(newConsumes);
					if (args.onSet) {
						args.onSet(player, newValue as T);
					}
				});
			},
		};
	};
}

///////////////////////////////////////////////////////////////////////////
//                                 CONJURED
///////////////////////////////////////////////////////////////////////////

export const makeConjuredInput = makeConsumeInputFactory({ consumesFieldName: 'conjuredId' });

///////////////////////////////////////////////////////////////////////////
//                               ENGINEERING
///////////////////////////////////////////////////////////////////////////

export const EzThroDynamiteTwo = {
	actionId: ActionId.fromItemId(18588),
	value: 18588,
};

export const CrystalCharge = {
	actionId: ActionId.fromItemId(11566),
	value: 15239,
};

export const ThoriumGrenade = {
	actionId: ActionId.fromItemId(15993),
	value: 19769,
	showWhen: (player: Player<any>) => player.hasProfession(Profession.Engineering),
};

export const DenseDynamite = {
	actionId: ActionId.fromItemId(18641),
	value: 23063,
	showWhen: (player: Player<any>) => player.hasProfession(Profession.Engineering),
};

// A mage's vendor scroll; it shares the explosives' 1 min cooldown, so it takes their slot.
export const ScrollOfCryoblast = {
	actionId: ActionId.fromItemId(217495),
	value: 440212,
	showWhen: (player: Player<any>) => player.getClass() == Class.ClassMage,
};

// Forever's SAF-T / EZ-Thro bombs: required level 1 and no Engineering (ItemSparse 70009).
// Keyed on the use spell, like the sim; best average damage first.
export const SaftBombs = [
	[260817, 1269334], // EZ-Thro Dark Bomb
	[260814, 1269282], // SAF-T Clever Dynamite
	[260816, 1269330], // EZ-Thro Thorium Grenade
	[260803, 1269270], // EZ-Thro Grenade
	[260805, 1269272], // SAF-T Bomb
	[260809, 1269278], // Tru-Trigger Frag Bomb
	[260798, 1269264], // SAF-T Jumbo Dynamite
	[260797, 1269216], // SAF-T Bronze Bomb
	[260795, 1269192], // EZ-Thro Copper Bomb XL
	[260792, 1269155], // SAF-T Dynamite
	[260793, 1269161], // SAF-T Copper Bomb
].map(([itemId, value]) => ({ actionId: ActionId.fromItemId(itemId), value }));

export const EXPLOSIVE_CONFIG = [
	{ config: ScrollOfCryoblast, stats: [] },
	{ config: ThoriumGrenade, stats: [] },
	{ config: DenseDynamite, stats: [] },
	{ config: CrystalCharge, stats: [] },
	{ config: EzThroDynamiteTwo, stats: [] },
	...SaftBombs.map(config => ({ config, stats: [] })),
] as ConsumableStatOption<number>[];
export const makeExplosivesInput = makeConsumeInputFactory({ consumesFieldName: 'explosiveId' });

export const GoblinSapper = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10646),
	fieldName: 'goblinSapper',
	showWhen: (player: Player<any>) => player.hasProfession(Profession.Engineering),
});

///////////////////////////////////////////////////////////////////////////
//                               WEAPON IMBUES
///////////////////////////////////////////////////////////////////////////

// Oils
export const ManaOil = {
	actionId: ActionId.fromItemId(20748),
	value: 25123,
};
export const WizardOil = {
	actionId: ActionId.fromItemId(20750),
	value: 25121,
};
export const BrilWizardOil = {
	actionId: ActionId.fromItemId(20749),
	value: 25122,
};
export const BlessedWizardOil = {
	actionId: ActionId.fromItemId(23123),
	value: 28898,
};
// Stones
export const DenseSharpeningStoneMH = {
	actionId: ActionId.fromItemId(12404),
	value: 16138,
	showWhen: (player: Player<any>) => player.getGear().hasSharpMHWeapon(),
};
export const DenseWeightstoneMH = {
	actionId: ActionId.fromItemId(12643),
	value: 16622,
	showWhen: (player: Player<any>) => player.getGear().hasBluntMHWeapon(),
};
export const ElementalSharpeningStoneMH = {
	actionId: ActionId.fromItemId(18262),
	value: 22756,
	showWhen: (player: Player<any>) => player.getGear().hasMHWeapon(),
};
export const ConsecratedSharpeningStoneMH = {
	actionId: ActionId.fromItemId(23122),
	value: 28891,
	showWhen: (player: Player<any>) => player.getGear().hasMHWeapon(),
};

export const DenseSharpeningStoneOH = {
	actionId: ActionId.fromItemId(12404),
	value: 16138,
	showWhen: (player: Player<any>) => player.getGear().hasSharpOHWeapon(),
};
export const DenseWeightstoneOH = {
	actionId: ActionId.fromItemId(12643),
	value: 16622,
	showWhen: (player: Player<any>) => player.getGear().hasBluntOHWeapon(),
};
export const ElementalSharpeningStoneOH = {
	actionId: ActionId.fromItemId(18262),
	value: 22756,
	showWhen: (player: Player<any>) => player.getGear().hasOHWeapon(),
};
export const ConsecratedSharpeningStoneOH = {
	actionId: ActionId.fromItemId(23122),
	value: 28891,
	showWhen: (player: Player<any>) => player.getGear().hasOHWeapon(),
};

// Shaman Imbues
export const ShamanImbueWindfury = {
	actionId: ActionId.fromSpellId(25505),
	value: 25505,
	showWhen: (player: Player<any>) => player.getClass() == Class.ClassShaman,
};
export const ShamanImbueFlametongue = {
	actionId: ActionId.fromSpellId(25489),
	value: 25489,
	showWhen: (player: Player<any>) => player.getClass() == Class.ClassShaman,
};

export const ShamanImbueFrostbrand = {
	actionId: ActionId.fromSpellId(25500),
	value: 25500,
	showWhen: (player: Player<any>) => player.getClass() == Class.ClassShaman,
};

export const ShamanImbueRockbiter = {
	actionId: ActionId.fromSpellId(25485),
	value: 25485,
	showWhen: (player: Player<any>) => player.getClass() == Class.ClassShaman,
};

export const IMBUE_CONFIG_MH = [
	{ config: ManaOil, stats: [Stat.StatHealingPower] },
	{ config: WizardOil, stats: [Stat.StatSpellDamage] },
	{ config: BrilWizardOil, stats: [Stat.StatSpellDamage, Stat.StatHealingPower] },
	{ config: BlessedWizardOil, stats: [Stat.StatSpellDamage] },
	{ config: DenseSharpeningStoneMH, stats: [Stat.StatAttackPower] },
	{ config: DenseWeightstoneMH, stats: [Stat.StatAttackPower] },
	{ config: ElementalSharpeningStoneMH, stats: [Stat.StatAttackPower] },
	{ config: ConsecratedSharpeningStoneMH, stats: [Stat.StatAttackPower] },
	{ config: ShamanImbueRockbiter, stats: [] },
	{ config: ShamanImbueFrostbrand, stats: [] },
	{ config: ShamanImbueFlametongue, stats: [] },
	{ config: ShamanImbueWindfury, stats: [] },
] as ConsumableStatOption<number>[];

export const IMBUE_CONFIG_OH = [
	{ config: ManaOil, stats: [Stat.StatHealingPower] },
	{ config: WizardOil, stats: [Stat.StatSpellDamage] },
	{ config: BrilWizardOil, stats: [Stat.StatSpellDamage, Stat.StatHealingPower] },
	{ config: BlessedWizardOil, stats: [Stat.StatSpellDamage] },
	{ config: DenseSharpeningStoneOH, stats: [Stat.StatAttackPower] },
	{ config: DenseWeightstoneOH, stats: [Stat.StatAttackPower] },
	{ config: ElementalSharpeningStoneOH, stats: [Stat.StatAttackPower] },
	{ config: ConsecratedSharpeningStoneOH, stats: [Stat.StatAttackPower] },
	{ config: ShamanImbueRockbiter, stats: [] },
	{ config: ShamanImbueFrostbrand, stats: [] },
	{ config: ShamanImbueFlametongue, stats: [] },
	{ config: ShamanImbueWindfury, stats: [] },
] as ConsumableStatOption<number>[];

// Specs that doesn't use Windfury and should always show imbues.
const specsWithoutWindfury = [Spec.SpecFeralBearDruid, Spec.SpecFeralCatDruid];

export const makeMHImbueInput = makeConsumeInputFactory({
	consumesFieldName: 'mhImbueId',
	showWhen: (player: Player<any>) => specsWithoutWindfury.includes(player.getSpec()) || !player.getParty() || !player.getParty()!.getBuffs().windfuryTotem,
});
export const makeOHImbueInput = makeConsumeInputFactory({
	consumesFieldName: 'ohImbueId',
	showWhen: (player: Player<any>) => player.getGear().getEquippedItem(ItemSlot.ItemSlotOffHand)?.item.weaponSpeed !== undefined,
});

///////////////////////////////////////////////////////////////////////////
//                                 SCROLLS
///////////////////////////////////////////////////////////////////////////

export const ScrollAgi = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10309),
	fieldName: 'scrollAgi',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatAgility) > 0,
});

export const ScrollStr = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10310),
	fieldName: 'scrollStr',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatStrength) > 0,
});

export const ScrollInt = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10308),
	fieldName: 'scrollInt',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatIntellect) > 0,
});

export const ScrollSpi = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10306),
	fieldName: 'scrollSpi',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatSpirit) > 0,
});

export const ScrollArm = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(10305),
	fieldName: 'scrollArm',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatArmor) > 0,
});

///////////////////////////////////////////////////////////////////////////
//                            MISCELLANEOUS
///////////////////////////////////////////////////////////////////////////

export const DragonbreathChili = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(12217),
	fieldName: 'dragonbreathChili',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatAttackPower) > 0,
});

export const BoglingRoot = makeBooleanConsumeInput({
	actionId: ActionId.fromItemId(5206),
	fieldName: 'boglingRoot',
	showWhen: (player: Player<any>) => player.getEpWeights().getStat(Stat.StatAttackPower) > 0,
});

///////////////////////////////////////////////////////////////////////////

export interface ConsumableInputOptions {
	consumesFieldName: keyof ConsumesSpec;
	setValue?: (player: Player<any>, newValue: number) => void;
	showWhen?: (player: Player<any>) => boolean;
}

export function makeConsumableInput(
	items: Consumable[],
	options: ConsumableInputOptions,
	tooltip?: string,
): InputHelpers.TypedIconEnumPickerConfig<Player<any>, number> {
	const valueOptions = items.map(item => ({
		value: item.id,
		iconUrl: item.icon,
		actionId: ActionId.fromItemId(item.id),
		tooltip: item.name,
	}));
	return {
		type: 'iconEnum',
		tooltip: tooltip,
		numColumns: items.length > 10 ? 3 : items.length > 5 ? 2 : 1,
		values: [{ value: 0, iconUrl: '', tooltip: i18n.t('common.none') }].concat(valueOptions),
		equals: (a: number, b: number) => a === b,
		zeroValue: 0,
		storeField: 'consumables',
		getValue: (player: Player<any>) => player.getConsumes()[options.consumesFieldName] as number,
		showWhen: (player: Player<any>) => !!valueOptions.length && (!options.showWhen || options.showWhen(player)),
		setValue: (player: Player<any>, newValue: number) => {
			if (options.setValue) {
				options.setValue(player, newValue);
			}

			const newConsumes = {
				...player.getConsumes(),
				[options.consumesFieldName]: newValue,
			};

			// No flask-or-elixirs rule: that is TBC's. Classic (and Forever) flasks stack with elixirs.
			player.setConsumes(newConsumes);
		},
	};
}
