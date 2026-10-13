import * as PresetUtils from '@app/preset_utils';
import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, Profession, Race, UnitReference } from '@generated/proto/common';
import { RestorationDruid_Options as RestorationDruidOptions } from '@generated/proto/druid';
import { SavedTalents } from '@generated/proto/ui';

// Defaults follow master's ui/restoration_druid.
export const RestorationTalents = PresetUtils.makePresetTalents('Restoration 10/0/41', SavedTalents.create({ talentsString: '05302--5053035153113051' }));

export const DefaultOptions = RestorationDruidOptions.create({
	classOptions: {
		innervateTarget: UnitReference.create(),
	},
});

// Master sets no consumables for this spec (the old TBC flask, food and potion don't exist in the Forever client).
export const DefaultConsumables = ConsumesSpec.create({});

export const DefaultRaidBuffs = RaidBuffs.create({
	arcaneBrilliance: true,
	giftOfTheWild: true,
	prayerOfFortitude: true,
	prayerOfSpirit: true,
});

export const DefaultPartyBuffs = PartyBuffs.create({
	moonkinAura: true,
	strengthOfEarthTotem: true,
});

export const DefaultIndividualBuffs = IndividualBuffs.create({
	greaterBlessingOfKings: true,
	greaterBlessingOfMight: true,
	greaterBlessingOfWisdom: true,
});

export const DefaultDebuffs = Debuffs.create({
	faerieFire: true,
	sunderArmor: true,
});

export const OtherDefaults = {
	distanceFromTarget: 18,
	profession1: Profession.Tailoring,
	profession2: Profession.Enchanting,
	race: Race.RaceNightElf,
};
