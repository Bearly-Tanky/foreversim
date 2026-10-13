import * as PresetUtils from '@app/preset_utils';
import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, Profession, Race, TristateEffect } from '@generated/proto/common';
import { RetributionPaladin_Options as RetributionPaladinOptions } from '@generated/proto/paladin';
import { SavedTalents } from '@generated/proto/ui';

import DefaultApl from './apls/default.apl.json';
import LaunchGear from './gear_sets/launch.gear.json';

// Our Forever sim's Seal of Command / Seal of Righteousness twist rotation.
export const APL_PRESET = PresetUtils.makePresetAPLRotation('Basic Ret', DefaultApl);

// Our Forever sim's builds.
export const P4RetTalents = PresetUtils.makePresetTalents('P4/P5 Ret', SavedTalents.create({ talentsString: '550030022001--05225231001330321' }));
export const TalentsRetribution = PresetUtils.makePresetTalents('Retribution 9/0/42', SavedTalents.create({ talentsString: '51003--55225331201331321' }));

export const TalentPresets = [P4RetTalents, TalentsRetribution];
export const DefaultTalents = P4RetTalents;

export const DefaultOptions = RetributionPaladinOptions.create({
	classOptions: {},
});

// Defaults below are what master's ui/retribution_paladin opens with (currentSettings on a fresh
// profile); its raid-wide Battle Shout, Leader of the Pack and Moonkin are party buffs here.
// Master's Greater Firepower (21546) is Forever's Elixir of Holy Power.
export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 13512, // Flask of Supreme Power
	battleElixirId: 13452, // Elixir of the Mongoose
	spellPowerElixirId: 13454, // Greater Arcane Elixir
	schoolElixirId: 21546, // Elixir of Holy Power
	strengthBuffId: 12451, // Juju Power
	attackPowerBuffId: 12460, // Juju Might
	zanzaId: 8410, // R.O.I.D.S.
	dragonbreathChili: true,
	foodId: 13810, // Blessed Sunfruit
	potId: 13444, // Major Mana Potion
	conjuredId: 12662, // Demonic Rune
});

export const DefaultRaidBuffs = RaidBuffs.create({
	arcaneBrilliance: true,
	prayerOfSpirit: true,
	giftOfTheWild: true,
	fireResistanceAura: true,
});

export const DefaultPartyBuffs = PartyBuffs.create({
	battleShout: TristateEffect.TristateEffectImproved,
	leaderOfThePack: true,
	moonkinAura: true,
});

export const DefaultIndividualBuffs = IndividualBuffs.create({
	greaterBlessingOfKings: true,
	greaterBlessingOfWisdom: true,
	greaterBlessingOfMight: true,
});

export const DefaultDebuffs = Debuffs.create({
	curseOfRecklessness: true,
	faerieFire: true,
	giftOfArthas: true,
	judgementOfTheCrusader: true,
	judgementOfWisdom: true,
	sunderArmor: true,
});

export const OtherDefaults = {
	reactionTime: 200, // master's default
	profession1: Profession.Blacksmithing,
	profession2: Profession.Enchanting,
	distanceFromTarget: 5,
	race: Race.RaceHuman,
};

// Our Forever sim's gear presets (master ui/<spec>/gear_sets).
export const GEAR_LAUNCH = PresetUtils.makePresetGear('Launch', LaunchGear);
export const DEFAULT_GEAR = GEAR_LAUNCH;
export const GEAR_PRESETS = [GEAR_LAUNCH];
