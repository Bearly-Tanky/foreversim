import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Race } from '@generated/proto/common';
import { Rogue_Options as RogueOptions } from '@generated/proto/rogue';
import { SavedTalents } from '@generated/proto/ui';

import BackstabAPL from './apls/combat_backstab.apl.json';
import BackstabSweatyAPL from './apls/combat_backstab_sweaty.apl.json';
import SinisterStrikeAPL from './apls/combat_sinister_strike.apl.json';
import SinisterStrikeIEAAPL from './apls/combat_sinister_strike_iea.apl.json';
import SinisterStrikeSweatyAPL from './apls/combat_sinister_strike_sweaty.apl.json';
import HemorrhageAPL from './apls/forever_hemorrhage.apl.json';
import MutilateAPL from './apls/forever_mutilate.apl.json';
import BackstabLaunchGear from './gear_sets/backstab_launch.gear.json';
import CombatBackstabP1BisGear from './gear_sets/combat_backstab_p1_bis.gear.json';
import CombatBackstabP2BisGear from './gear_sets/combat_backstab_p2_bis.gear.json';
import CombatBackstabPrebisGear from './gear_sets/combat_backstab_prebis.gear.json';
import CombatSinisterStrikeP1BisGear from './gear_sets/combat_sinister_strike_p1_bis.gear.json';
import CombatSinisterStrikeP2BisGear from './gear_sets/combat_sinister_strike_p2_bis.gear.json';
import CombatSinisterStrikePrebisGear from './gear_sets/combat_sinister_strike_prebis.gear.json';
import SinisterStrikeLaunchGear from './gear_sets/sinister_strike_launch.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

// Master's rotations, talents and builds, same names and order (master ui/rogue/presets.ts).
export const ROTATION_PRESET_BACKSTAB = PresetUtils.makePresetAPLRotation('Backstab', BackstabAPL);
export const ROTATION_PRESET_SINISTER_STRIKE = PresetUtils.makePresetAPLRotation('Sinister Strike', SinisterStrikeAPL);
export const ROTATION_PRESET_BACKSTAB_SWEATY = PresetUtils.makePresetAPLRotation('Backstab (Sweaty)', BackstabSweatyAPL);
export const ROTATION_PRESET_SINISTER_STRIKE_SWEATY = PresetUtils.makePresetAPLRotation('Sinister Strike (Sweaty)', SinisterStrikeSweatyAPL);
export const ROTATION_PRESET_SINISTER_STRIKE_IEA = PresetUtils.makePresetAPLRotation('Improved Expose Armor (SS)', SinisterStrikeIEAAPL);
export const ROTATION_PRESET_MUTILATE = PresetUtils.makePresetAPLRotation('Mutilate', MutilateAPL);
export const ROTATION_PRESET_HEMORRHAGE = PresetUtils.makePresetAPLRotation('Hemorrhage', HemorrhageAPL);
export const ROTATION_PRESETS = [
	ROTATION_PRESET_BACKSTAB,
	ROTATION_PRESET_SINISTER_STRIKE,
	ROTATION_PRESET_BACKSTAB_SWEATY,
	ROTATION_PRESET_SINISTER_STRIKE_SWEATY,
	ROTATION_PRESET_SINISTER_STRIKE_IEA,
	ROTATION_PRESET_MUTILATE,
	ROTATION_PRESET_HEMORRHAGE,
];

export const BackstabTalents = PresetUtils.makePresetTalents('Backstab', SavedTalents.create({ talentsString: '005302005-30230320201515231-102' }));
export const SinisterStrikeTalents = PresetUtils.makePresetTalents('Sinister Strike', SavedTalents.create({ talentsString: '00530310501-32003311201515231' }));
export const SinisterStrikeIEATalents = PresetUtils.makePresetTalents(
	'Improved Expose Armor (SS)',
	SavedTalents.create({ talentsString: '005303125-32003311201515131' }),
);
export const MutilateTalents = PresetUtils.makePresetTalents('Mutilate', SavedTalents.create({ talentsString: '00530310551021051-302303202004' }));
// The community builds (named with their point split, so the rankings page runs them).
export const CombatDualWieldTalents = PresetUtils.makePresetTalents(
	'Combat Dual-Wield 15/33/3',
	SavedTalents.create({ talentsString: '1053231-22530300001515231-012' }),
);
export const AssassinationMutilateTalents = PresetUtils.makePresetTalents(
	'Assassination Mutilate 31/20/0',
	SavedTalents.create({ talentsString: '02532010531201051-225303000005' }),
);
export const SubtletyHemoTalents = PresetUtils.makePresetTalents(
	'Subtlety Hemo 15/0/36',
	SavedTalents.create({ talentsString: '125320101--5320003310013211551' }),
);
export const TALENT_PRESETS = [
	BackstabTalents,
	SinisterStrikeTalents,
	SinisterStrikeIEATalents,
	MutilateTalents,
	CombatDualWieldTalents,
	AssassinationMutilateTalents,
	SubtletyHemoTalents,
];
export const DefaultTalents = SinisterStrikeTalents;

export const DefaultOptions = RogueOptions.create({
	classOptions: {},
});

// Master's consumables, as the Forever client's items (master's Greater Arcane Elixir does nothing
// for a rogue and is left off). Instant/Deadly are this sim's Forever poison ids.
export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 13512, // Flask of Supreme Power
	battleElixirId: 13452, // Elixir of the Mongoose
	strengthBuffId: 12451, // Juju Power
	attackPowerBuffId: 12460, // Juju Might
	zanzaId: 8412, // Ground Scorpok Assay
	dragonbreathChili: true,
	foodId: 13928, // Grilled Squid
	conjuredId: 7676, // Thistle Tea
	mhImbueId: 26891, // Instant Poison
	ohImbueId: 27186, // Deadly Poison
	goblinSapper: true,
});

export const OtherDefaults = {
	reactionTime: 200, // master's default
	distanceFromTarget: 5,
	profession1: Profession.Engineering,
	race: Race.RaceDwarf,
};

// Our Forever sim's gear presets (master ui/<spec>/gear_sets).
export const GEAR_BACKSTAB_LAUNCH = PresetUtils.makePresetGear('Backstab Launch', BackstabLaunchGear);
export const GEAR_SINISTER_STRIKE_LAUNCH = PresetUtils.makePresetGear('Sinister Strike Launch', SinisterStrikeLaunchGear);
export const GEAR_COMBAT_BACKSTAB_PREBIS = PresetUtils.makePresetGear('Backstab Pre-BiS', CombatBackstabPrebisGear);
export const GEAR_COMBAT_SINISTER_STRIKE_PREBIS = PresetUtils.makePresetGear('Sinister Strike Pre-BiS', CombatSinisterStrikePrebisGear);
export const GEAR_COMBAT_BACKSTAB_P1_BIS = PresetUtils.makePresetGear('Backstab P1 BiS', CombatBackstabP1BisGear);
export const GEAR_COMBAT_SINISTER_STRIKE_P1_BIS = PresetUtils.makePresetGear('Sinister Strike P1 BiS', CombatSinisterStrikeP1BisGear);
export const GEAR_COMBAT_BACKSTAB_P2_BIS = PresetUtils.makePresetGear('Backstab P2 BiS', CombatBackstabP2BisGear);
export const GEAR_COMBAT_SINISTER_STRIKE_P2_BIS = PresetUtils.makePresetGear('Sinister Strike P2 BiS', CombatSinisterStrikeP2BisGear);
export const DEFAULT_GEAR = GEAR_COMBAT_SINISTER_STRIKE_PREBIS;
export const GEAR_PRESETS = [
	GEAR_BACKSTAB_LAUNCH,
	GEAR_SINISTER_STRIKE_LAUNCH,
	GEAR_COMBAT_BACKSTAB_PREBIS,
	GEAR_COMBAT_SINISTER_STRIKE_PREBIS,
	GEAR_COMBAT_BACKSTAB_P1_BIS,
	GEAR_COMBAT_SINISTER_STRIKE_P1_BIS,
	GEAR_COMBAT_BACKSTAB_P2_BIS,
	GEAR_COMBAT_SINISTER_STRIKE_P2_BIS,
];

export const BuildBackstab = PresetUtils.makePresetBuild('Backstab', {
	gear: GEAR_COMBAT_BACKSTAB_P2_BIS,
	talents: BackstabTalents,
	rotation: ROTATION_PRESET_BACKSTAB,
});
export const BuildSinisterStrike = PresetUtils.makePresetBuild('Sinister Strike', {
	gear: GEAR_COMBAT_SINISTER_STRIKE_P2_BIS,
	talents: SinisterStrikeTalents,
	rotation: ROTATION_PRESET_SINISTER_STRIKE,
});
export const BuildIEA = PresetUtils.makePresetBuild('IEA', {
	gear: GEAR_COMBAT_SINISTER_STRIKE_P2_BIS,
	talents: SinisterStrikeIEATalents,
	rotation: ROTATION_PRESET_SINISTER_STRIKE_IEA,
});
export const BuildMutilate = PresetUtils.makePresetBuild('Mutilate', {
	gear: GEAR_COMBAT_BACKSTAB_P2_BIS,
	talents: MutilateTalents,
	rotation: ROTATION_PRESET_MUTILATE,
});
export const BUILD_PRESETS = [BuildBackstab, BuildSinisterStrike, BuildIEA, BuildMutilate];
