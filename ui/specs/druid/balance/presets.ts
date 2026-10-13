import * as PresetUtils from '@app/preset_utils';
import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, Profession, Race, TristateEffect, UnitReference } from '@generated/proto/common';
import { BalanceDruid_Options as BalanceDruidOptions } from '@generated/proto/druid';
import { SavedTalents } from '@generated/proto/ui';

import DefaultAPL from './apls/default.apl.json';
import LaunchAPL from './apls/launch.apl.json';
import LaunchGear from './gear_sets/launch.gear.json';
import P0BisGear from './gear_sets/p0.bis.gear.json';
import P1BisGear from './gear_sets/p1.bis.gear.json';
import P2BisGear from './gear_sets/p2.bis.gear.json';

// Starfire only: better than Launch for builds without Eclipse and Improved Wrath, worse (8-27%) with them.
export const StandardRotation = PresetUtils.makePresetAPLRotation('Starfire (no Eclipse)', DefaultAPL);
// Master's Launch rotation (Wrath-led, Starfire on Eclipse), the one its arena ranks.
export const LaunchRotation = PresetUtils.makePresetAPLRotation('Launch', LaunchAPL);

export const BalanceTalents = PresetUtils.makePresetTalents('Balance', SavedTalents.create({ talentsString: '5532220115001351--505302' }));
export const MoonkinTalents = PresetUtils.makePresetTalents('Moonkin 38/0/13', SavedTalents.create({ talentsString: '5502220115501351--055003' }));

export const DefaultOptions = BalanceDruidOptions.create({
	classOptions: {
		innervateTarget: UnitReference.create(),
	},
});

// Defaults below are what master's ui/balance_druid (the Forever site before the switch) opens
// with: its page drops the Fire Resistance Aura, blessings, Judgement of Wisdom and Stormstrike
// its presets name.
export const DefaultRaidBuffs = RaidBuffs.create({
	arcaneBrilliance: true,
	fireResistanceTotem: true,
	giftOfTheWild: true,
	prayerOfSpirit: true,
});

export const DefaultPartyBuffs = PartyBuffs.create({
	manaSpringTotem: TristateEffect.TristateEffectRegular,
	moonkinAura: true,
});

export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	faerieFire: true,
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 13512, // Flask of Supreme Power
	spellPowerElixirId: 13454, // Greater Arcane Elixir
	guardianElixirId: 20007, // Mageblood Elixir
	zanzaId: 8423, // Cerebral Cortex Compound
	foodId: 18254, // Runn Tum Tuber Surprise
	potId: 13444, // Major Mana Potion
	mhImbueId: 25122, // Brilliant Wizard Oil
});

export const OtherDefaults = {
	reactionTime: 200, // master's default
	distanceFromTarget: 15,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTauren,
};

// Our Forever sim's gear presets (master ui/<spec>/gear_sets).
export const GEAR_LAUNCH = PresetUtils.makePresetGear('Launch', LaunchGear);
export const GEAR_P0_BIS = PresetUtils.makePresetGear('Pre-BiS', P0BisGear);
export const GEAR_P1_BIS = PresetUtils.makePresetGear('P1 BiS', P1BisGear);
export const GEAR_P2_BIS = PresetUtils.makePresetGear('P2 BiS', P2BisGear);
export const DEFAULT_GEAR = GEAR_P0_BIS;
export const GEAR_PRESETS = [GEAR_LAUNCH, GEAR_P0_BIS, GEAR_P1_BIS, GEAR_P2_BIS];
