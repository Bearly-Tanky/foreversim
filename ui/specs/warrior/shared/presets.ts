import { Debuffs, IndividualBuffs, PartyBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, TristateEffect } from '@generated/proto/common';

// Defaults follow master's ui/warrior and ui/tank_warrior.
export const DefaultIndividualBuffs = IndividualBuffs.create({
	greaterBlessingOfKings: true,
	greaterBlessingOfMight: true,
});

// Master's page (currentSettings on a fresh profile) has Battle Shout and Leader of the Pack as
// raid buffs; they are party buffs here. No totems.
export const DefaultPartyBuffs = PartyBuffs.create({
	battleShout: TristateEffect.TristateEffectImproved,
	leaderOfThePack: true,
});

export const DefaultDebuffs = Debuffs.create({
	curseOfRecklessness: true,
	exposeArmor: true,
	faerieFire: true,
	giftOfArthas: true,
	sunderArmor: true,
});

// Master's consumables, as the Forever client's items.
export const DefaultConsumables = ConsumesSpec.create({
	battleElixirId: 13452, // Elixir of the Mongoose
	guardianElixirId: 3825, // Elixir of Lesser Fortitude
	defenseElixirId: 13445, // Elixir of Greater Defense
	strengthBuffId: 12451, // Juju Power
	attackPowerBuffId: 12460, // Juju Might
	zanzaId: 8410, // R.O.I.D.S.
	alcoholId: 21151, // Rumsey Rum Black Label
	dragonbreathChili: true,
	foodId: 20452, // Smoked Desert Dumplings
	potId: 13442, // Mighty Rage Potion
	ohImbueId: 18262, // Elemental Sharpening Stone
	goblinSapper: true,
});
