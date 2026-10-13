package arenalib

import (
	googleProto "google.golang.org/protobuf/proto"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// What every build in the arena drinks and is buffed by, decided here rather than by each
// spec's own test file.
//
// The file header claims every build meets the same fixed environment, and until this existed
// that was false. Fifteen specs brought four different consumable sets from four different
// content phases, and the gaps were not small ones: both paladins and the feral tank had their
// weapon imbue commented out entirely, while warrior, hunter, rogue, tank warrior and
// enhancement all carried Windfury. Measured on the warrior, stripping its imbues cost 14.2%
// of its damage - so the leaderboard was reporting a 19.6% gap between warrior and retribution
// while handing one of them a weapon buff and the other a bare weapon.
//
// Windfury deserves a note, because it is the biggest single item here and it is not really a
// consumable at all. The old engine had nowhere to put a totem and applied it as a weapon
// imbue; this one has PartyBuffs.WindfuryTotem, so the melee and ranged lists carry it there.
// Giving it to every melee matches what the arena does everywhere else - every spec gets the
// same blessings whatever its faction. The arena is a fixed environment, not a raid roster, and
// it has never modelled faction.
//
// Three sets rather than one, because one list for all fifteen would be a different lie.
// Elemental Sharpening Stone is +2% melee crit and -2% RANGED crit, so handing the hunter the
// melee list would equalise the shopping and quietly tax the one spec that shoots. Within a
// role every spec gets the identical list; what it is worth to you is your class's business,
// which is why Mighty Rage Potion stays in the melee list even though only rage users get its
// rage; everyone gets its Strength. Same shopping list, not same benefit -
// that is the part that makes two numbers comparable.
//
// The consumables are the Classic items the Forever client ships, in the Classic slots #421
// added to ConsumesSpec. The buffs are the old engine's ForeverBuffs, field for field where the
// new protos have the field: the resistance auras and totems, Blessing of Sanctuary, Curse of
// Shadow, Curse of Weakness and Stormstrike have no slot here, and none of them moves the damage
// of a build hitting a boss that swings physical.
type Role int

const (
	Melee Role = iota
	Ranged
	Caster
)

var arenaRaidBuffs = &proto.RaidBuffs{
	ArcaneBrilliance:         true,
	PrayerOfFortitude:        true,
	PrayerOfShadowProtection: true,
	PrayerOfSpirit:           true,
	GiftOfTheWild:            true,
	Thorns:                   true,
}

// Every role's party buffs. The melee list swaps Grace of Air for Windfury Totem: since client
// build 70009 a party holds one air totem, and Windfury is the one a melee group takes.
var arenaPartyBuffs = &proto.PartyBuffs{
	BattleShout:          proto.TristateEffect_TristateEffectRegular, // Improved now means the T2 set bonus, a warrior item, not a raid buff
	BloodPact:            true,
	DevotionAura:         true,
	RetributionAura:      true,
	GraceOfAirTotem:      true,
	LeaderOfThePack:      true,
	ManaSpringTotem:      proto.TristateEffect_TristateEffectImproved,
	MoonkinAura:          true,
	StrengthOfEarthTotem: true,
	TrueshotAura:         true,
}

// World buffs do not work inside Forever raids, so the player buffs are the blessings alone.
var arenaPlayerBuffs = &proto.IndividualBuffs{
	GreaterBlessingOfKings:  true,
	GreaterBlessingOfMight:  true,
	GreaterBlessingOfWisdom: true,
}

// Improved Shadow Bolt, Shadow Weaving, Improved Scorch and Winter's Chill became personal
// buffs on their caster in Forever, so nobody applies them to the raid.
var arenaDebuffs = &proto.Debuffs{
	CurseOfElements:        true,
	CurseOfRecklessness:    true,
	DemoralizingRoar:       true,
	DemoralizingShout:      true,
	ExposeArmor:            true,
	FaerieFire:             true,
	InsectSwarm:            true,
	JudgementOfLight:       true,
	JudgementOfWisdom:      true,
	JudgementOfTheCrusader: true,
	ScorpidSting:           true,
	SunderArmor:            true,
	ThunderClap:            true,
}

func withWindfury(party *proto.PartyBuffs) *proto.PartyBuffs {
	party = googleProto.Clone(party).(*proto.PartyBuffs)
	party.WindfuryTotem = true
	party.GraceOfAirTotem = false
	return party
}

var consumesMelee = core.BuffsCombo{
	Label:   "Arena-Melee",
	Raid:    arenaRaidBuffs,
	Party:   withWindfury(arenaPartyBuffs),
	Player:  arenaPlayerBuffs,
	Debuffs: arenaDebuffs,
	Consumables: &proto.ConsumesSpec{
		BattleElixirId:    13452, // Elixir of the Mongoose
		AttackPowerBuffId: 12460, // Juju Might
		StrengthBuffId:    12451, // Juju Power
		// Drunk by everyone for its Strength; only a rage bar gets the rage. Druids wait for
		// caster form rather than pot out of Bear or Cat Form on a timer.
		PotId:             13442, // Mighty Rage Potion
		Potions:           []int32{13442},
		DragonbreathChili: true,
		FlaskId:           13510, // Flask of the Titans
		FoodId:            20452, // Smoked Desert Dumplings
		OhImbueId:         18262, // Elemental Sharpening Stone
	},
}

// The melee list with Grace of Air in the air slot, without the off-hand stone, whose ranged crit penalty is a real cost to the
// one spec that does its damage from thirty yards, and with mana consumables in place of the rage potion.
var consumesRanged = core.BuffsCombo{
	Label:   "Arena-Ranged",
	Raid:    arenaRaidBuffs,
	Party:   arenaPartyBuffs,
	Player:  arenaPlayerBuffs,
	Debuffs: arenaDebuffs,
	Consumables: &proto.ConsumesSpec{
		BattleElixirId:    13452, // Elixir of the Mongoose
		AttackPowerBuffId: 12460, // Juju Might
		StrengthBuffId:    12451, // Juju Power
		DragonbreathChili: true,
		FlaskId:           13510, // Flask of the Titans
		FoodId:            20452, // Smoked Desert Dumplings
		// The hunter's mana, as the caster list below.
		PotId:            13444, // Major Mana Potion
		Potions:          []int32{13444},
		ConjuredId:       12662, // Demonic Rune
		ConjuredItems:    []int32{12662},
		GuardianElixirId: 20007, // Mageblood Elixir
	},
}

// A three minute fight runs casters dry, so the list carries what a raider drinks for mana.
// The sim only knows a potion or a rune that is also in Potions or ConjuredItems - the UI
// sends those lists, the arena has to write them - and until they were here the Major Mana
// Potion this list has always named was never drunk. The Forever client has no battle and
// guardian elixir split, so Mageblood stacks with the flask and both elixirs. Dark Rune is not
// in its item data; Demonic Rune is.
//
// Brilliant Wizard Oil over Brilliant Mana Oil (15 mp5 in Forever): with the rest of this
// list the wizard oil is ahead for every caster, the Smite priest by the least (1.9%).
var consumesCaster = core.BuffsCombo{
	Label:   "Arena-Caster",
	Raid:    arenaRaidBuffs,
	Party:   arenaPartyBuffs,
	Player:  arenaPlayerBuffs,
	Debuffs: arenaDebuffs,
	Consumables: &proto.ConsumesSpec{
		PotId:              13444, // Major Mana Potion
		Potions:            []int32{13444},
		ConjuredId:         12662, // Demonic Rune
		ConjuredItems:      []int32{12662},
		GuardianElixirId:   20007, // Mageblood Elixir
		FlaskId:            13512, // Flask of Supreme Power
		FoodId:             20452, // Smoked Desert Dumplings
		MhImbueId:          20749, // Brilliant Wizard Oil
		SpellPowerElixirId: 13454, // Greater Arcane Elixir
		SchoolElixirId:     6373,  // Elixir of Firepower
	},
}

// A weapon imbue a class grants itself, which the role list must not overwrite.
//
// The role lists equalise what a character BUYS. Some imbues are not bought: Windfury Weapon
// is an enhancement shaman casting on their own weapons, and Instant Poison is a rogue's
// poison. Equalising those does not make a comparison fairer, it takes a class ability away -
// the first pass did exactly that and cost enhancement 23.6% of its damage, which is not a
// shaman being measured honestly, it is a shaman being disarmed.
//
// Poisons are items here (ConsumesSpec's imbue ids). Windfury Weapon is a spec option on this
// engine, so a class that casts its own sets Windfury, which takes the totem away exactly as
// the old list's imbue override did.
type ClassImbues struct {
	MainHand int32
	OffHand  int32
	Windfury bool
}

func consumesFor(role Role, imbues ClassImbues) core.BuffsCombo {
	var combo core.BuffsCombo
	switch role {
	case Ranged:
		combo = consumesRanged
	case Caster:
		combo = consumesCaster
	default:
		combo = consumesMelee
	}
	if imbues == (ClassImbues{}) {
		return combo
	}

	// Cloned, not mutated: the role lists are package level and shared by every spec, so
	// writing a shaman's Windfury into one would hand it to the next spec that ran. Cloned
	// rather than copied because a proto carries a mutex.
	combo.Consumables = googleProto.Clone(combo.Consumables).(*proto.ConsumesSpec)
	if imbues.MainHand != 0 {
		combo.Consumables.MhImbueId = imbues.MainHand
	}
	if imbues.OffHand != 0 {
		combo.Consumables.OhImbueId = imbues.OffHand
	}
	if imbues.Windfury {
		combo.Party = googleProto.Clone(combo.Party).(*proto.PartyBuffs)
		combo.Party.WindfuryTotem = false
	}
	combo.Label += "+class"
	return combo
}
