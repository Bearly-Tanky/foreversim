package main

import (
	"fmt"
	"sort"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// What each class can equip, kept in step with classToEligibleWeaponTypes,
// classToEligibleRangedWeaponTypes and classToMaxArmorType in ui/core/proto_utils/utils.ts.
// A set the tool builds has to pass the same checks the gear picker applies, or the page
// shows an item the character cannot hold.
var (
	axe     = proto.WeaponType_WeaponTypeAxe
	dagger  = proto.WeaponType_WeaponTypeDagger
	fist    = proto.WeaponType_WeaponTypeFist
	mace    = proto.WeaponType_WeaponTypeMace
	polearm = proto.WeaponType_WeaponTypePolearm
	staff   = proto.WeaponType_WeaponTypeStaff
	sword   = proto.WeaponType_WeaponTypeSword

	bow      = proto.RangedWeaponType_RangedWeaponTypeBow
	crossbow = proto.RangedWeaponType_RangedWeaponTypeCrossbow
	gun      = proto.RangedWeaponType_RangedWeaponTypeGun
	thrown   = proto.RangedWeaponType_RangedWeaponTypeThrown
	idol     = proto.RangedWeaponType_RangedWeaponTypeIdol
	libram   = proto.RangedWeaponType_RangedWeaponTypeLibram
	totem    = proto.RangedWeaponType_RangedWeaponTypeTotem
	wand     = proto.RangedWeaponType_RangedWeaponTypeWand
)

var classWeapons = map[proto.Class][]proto.WeaponType{
	proto.Class_ClassDruid:   {dagger, fist, mace, staff},
	proto.Class_ClassHunter:  {axe, dagger, fist, polearm, sword, staff},
	proto.Class_ClassMage:    {dagger, staff, sword},
	proto.Class_ClassPaladin: {axe, mace, polearm, sword},
	proto.Class_ClassPriest:  {dagger, mace, staff},
	proto.Class_ClassRogue:   {dagger, fist, mace, sword},
	proto.Class_ClassShaman:  {axe, dagger, fist, mace, staff},
	proto.Class_ClassWarlock: {dagger, staff, sword},
	proto.Class_ClassWarrior: {axe, dagger, fist, mace, polearm, staff, sword},
}

// The weapon types each class can use as a two hander.
var classTwoHanders = map[proto.Class][]proto.WeaponType{
	proto.Class_ClassDruid:   {mace, staff},
	proto.Class_ClassHunter:  {axe, polearm, sword, staff},
	proto.Class_ClassMage:    {staff},
	proto.Class_ClassPaladin: {axe, mace, polearm, sword},
	proto.Class_ClassPriest:  {staff},
	proto.Class_ClassShaman:  {axe, mace, staff},
	proto.Class_ClassWarlock: {staff},
	proto.Class_ClassWarrior: {axe, mace, polearm, staff, sword},
}

var classShields = map[proto.Class]bool{
	proto.Class_ClassPaladin: true,
	proto.Class_ClassShaman:  true,
	proto.Class_ClassWarrior: true,
}

var classRanged = map[proto.Class][]proto.RangedWeaponType{
	proto.Class_ClassDruid:   {idol},
	proto.Class_ClassHunter:  {bow, crossbow, gun},
	proto.Class_ClassMage:    {wand},
	proto.Class_ClassPaladin: {libram},
	proto.Class_ClassPriest:  {wand},
	proto.Class_ClassRogue:   {bow, crossbow, gun, thrown},
	proto.Class_ClassShaman:  {totem},
	proto.Class_ClassWarlock: {wand},
	proto.Class_ClassWarrior: {bow, crossbow, gun, thrown},
}

var classArmor = map[proto.Class]proto.ArmorType{
	proto.Class_ClassDruid:   proto.ArmorType_ArmorTypeLeather,
	proto.Class_ClassHunter:  proto.ArmorType_ArmorTypeMail,
	proto.Class_ClassMage:    proto.ArmorType_ArmorTypeCloth,
	proto.Class_ClassPaladin: proto.ArmorType_ArmorTypePlate,
	proto.Class_ClassPriest:  proto.ArmorType_ArmorTypeCloth,
	proto.Class_ClassRogue:   proto.ArmorType_ArmorTypeLeather,
	proto.Class_ClassShaman:  proto.ArmorType_ArmorTypeMail,
	proto.Class_ClassWarlock: proto.ArmorType_ArmorTypeCloth,
	proto.Class_ClassWarrior: proto.ArmorType_ArmorTypePlate,
}

// hand says which slot an item is being scored for, because weapon damage is worth a
// different amount in each: an off hand swings for less, a ranged weapon's damage only
// matters to a hunter, and a bear's or a caster's weapon does not swing at all.
type hand int

const (
	mainHand hand = iota
	offHand
	ranged
)

type held struct {
	item *proto.UIItem
	hand hand
}

// The weights are each spec's own stat weights, copied from the epWeights block of its
// ui/<spec>/sim.ts, so a launch set values what the spec's page says it values. The tanks
// are the exception: theirs are stated here and lean to threat rather than survival,
// because threat per second is what their sim measures.
// The weights below are master's, where hit, crit, haste and dodge were percentages and
// expertise and defense were points. This engine stores ratings, so each of those weights
// is divided by the rating one percent (or point) costs.
type spec struct {
	class proto.Class
	// <class>/<spec> directory under ui/specs/ and gear set name to write, "launch" by
	// default; a spec with builds that want different weapons has one entry per build,
	// all writing into the same directory.
	dir, set string
	// Weapon types the spec swings, out of what the class can wield; empty means all of them.
	weapons []proto.WeaponType
	// Ranged types narrower than the class allows, e.g. a hunter whose preset feeds arrows.
	ranged []proto.RangedWeaponType
	// A two hander is taken over a main hand and off hand when it scores higher than both.
	twoHand bool
	// Whether the off hand swings a weapon; otherwise it holds a shield or a frill.
	dualWield bool
	shield    bool
	// EP per point of weapon damage per second in each hand, zero where the weapon does
	// not swing: a caster's dagger, a bear's mace, a rogue's thrown weapon.
	mainHandDps, offHandDps, rangedDps float64
	weights                            stats.Stats
	// A fixed ranged-slot item: idols carry no stats to weigh.
	rangedItem int32
}

// fingerprint is everything about an item that a stat sheet can see. The two factions'
// PvP rewards are one item under two names, and a set is worn by one character, so two
// pieces with the same fingerprint are never taken together.
func fingerprint(item *proto.UIItem) string {
	if item == nil {
		return ""
	}
	base := item.ScalingOptions[0]
	return fmt.Sprint(item.Type, item.ArmorType, item.WeaponType, item.HandType, item.RangedWeaponType,
		base.GetStats(), base.GetWeaponDamageMin(), base.GetWeaponDamageMax(), item.WeaponSpeed)
}

func contains[T comparable](list []T, want T) bool {
	for _, have := range list {
		if have == want {
			return true
		}
	}
	return false
}

func (s spec) allows(item *proto.UIItem) bool {
	if len(item.ClassAllowlist) > 0 && !contains(item.ClassAllowlist, s.class) {
		return false
	}
	// A raid preset wears the same set as an Alliance race and as a Horde one, so a
	// piece only one faction can earn is out.
	if item.FactionRestriction != proto.UIItem_FACTION_RESTRICTION_UNSPECIFIED {
		return false
	}
	switch item.Type {
	case proto.ItemType_ItemTypeRanged:
		if s.rangedItem != 0 {
			return item.Id == s.rangedItem
		}
		allowed := classRanged[s.class]
		if len(s.ranged) > 0 {
			allowed = s.ranged
		}
		return contains(allowed, item.RangedWeaponType)
	case proto.ItemType_ItemTypeWeapon:
		switch item.WeaponType {
		case proto.WeaponType_WeaponTypeShield:
			return s.shield && classShields[s.class]
		case proto.WeaponType_WeaponTypeOffHand:
			return !s.shield && !s.dualWield
		}
		if !contains(classWeapons[s.class], item.WeaponType) {
			return false
		}
		if len(s.weapons) > 0 && !contains(s.weapons, item.WeaponType) {
			return false
		}
		if item.HandType == proto.HandType_HandTypeTwoHand {
			return s.twoHand && contains(classTwoHanders[s.class], item.WeaponType)
		}
		return true
	case proto.ItemType_ItemTypeHead, proto.ItemType_ItemTypeShoulder, proto.ItemType_ItemTypeChest,
		proto.ItemType_ItemTypeWrist, proto.ItemType_ItemTypeHands, proto.ItemType_ItemTypeWaist,
		proto.ItemType_ItemTypeLegs, proto.ItemType_ItemTypeFeet:
		// Anything up to the class's heaviest armor, as the gear picker allows: a warrior's
		// pre-raid set has leather in it where the leather has the better stats.
		return item.ArmorType <= classArmor[s.class]
	}
	return true
}

// ep scores an item for a hand, adding weapon damage for hands that swing it.
func (s spec) ep(item *proto.UIItem, h hand) float64 {
	if item == nil {
		return 0
	}
	total := 0.0
	// Stats and weapon damage live on the item's base scaling option in this db.
	base := item.ScalingOptions[0]
	// Weighed as the sim pays it: Forever's gear hit and crit count for spells and melee alike.
	itemStats := core.UnifyGearHitAndCrit(stats.FromProtoMap(base.GetStats()))
	for i := range s.weights {
		total += itemStats[i] * s.weights[i]
	}
	if item.WeaponSpeed > 0 {
		dps := (base.GetWeaponDamageMin() + base.GetWeaponDamageMax()) / 2 / item.WeaponSpeed
		switch h {
		case mainHand:
			total += dps * s.mainHandDps
		case offHand:
			total += dps * s.offHandDps
		case ranged:
			total += dps * s.rangedDps
		}
	}
	return total
}

func (s spec) pickWeapons(pool []*proto.UIItem) []held {
	best := func(h hand, match func(*proto.UIItem) bool) *proto.UIItem {
		cands := []*proto.UIItem{}
		for _, item := range pool {
			if item.Type == proto.ItemType_ItemTypeWeapon && match(item) {
				cands = append(cands, item)
			}
		}
		if len(cands) == 0 {
			return nil
		}
		sort.SliceStable(cands, func(i, j int) bool { return s.ep(cands[i], h) > s.ep(cands[j], h) })
		return cands[0]
	}
	swings := func(item *proto.UIItem) bool {
		return item.WeaponType != proto.WeaponType_WeaponTypeShield && item.WeaponType != proto.WeaponType_WeaponTypeOffHand
	}

	mh := best(mainHand, func(item *proto.UIItem) bool {
		return swings(item) && (item.HandType == proto.HandType_HandTypeMainHand || item.HandType == proto.HandType_HandTypeOneHand)
	})
	var oh *proto.UIItem
	switch {
	case s.shield:
		oh = best(offHand, func(item *proto.UIItem) bool { return item.WeaponType == proto.WeaponType_WeaponTypeShield })
	case s.dualWield:
		oh = best(offHand, func(item *proto.UIItem) bool {
			return swings(item) && fingerprint(item) != fingerprint(mh) &&
				(item.HandType == proto.HandType_HandTypeOneHand || item.HandType == proto.HandType_HandTypeOffHand)
		})
	default:
		oh = best(offHand, func(item *proto.UIItem) bool { return item.WeaponType == proto.WeaponType_WeaponTypeOffHand })
	}

	if s.twoHand {
		th := best(mainHand, func(item *proto.UIItem) bool { return item.HandType == proto.HandType_HandTypeTwoHand })
		if th != nil && s.ep(th, mainHand) > s.ep(mh, mainHand)+s.ep(oh, offHand) {
			return []held{{th, mainHand}}
		}
	}
	out := []held{}
	if mh != nil {
		out = append(out, held{mh, mainHand})
	}
	if oh != nil {
		out = append(out, held{oh, offHand})
	}
	return out
}

func w(pairs map[stats.Stat]float64) stats.Stats {
	var out stats.Stats
	for k, v := range pairs {
		out[k] = v
	}
	return out
}

var specs = map[string]spec{
	// Melee damage with a holy component; Champion of the Light scales it off Intellect.
	"retribution_paladin": {
		class: proto.Class_ClassPaladin, dir: "paladin/retribution", twoHand: true,
		mainHandDps: 12.0, weights: w(map[stats.Stat]float64{stats.Strength: 1, stats.AttackPower: 0.5, stats.Agility: 0.35,
			stats.MeleeCritRating: 12 / core.PhysicalCritRatingPerCritPercent, stats.MeleeHitRating: 14 / core.PhysicalHitRatingPerHitPercent, stats.Intellect: 0.3, stats.SpellDamage: 0.35, stats.Stamina: 0.1}),
	},
	// Threat, so damage stats lead and mitigation is a tiebreaker.
	"protection_paladin": {
		class: proto.Class_ClassPaladin, dir: "paladin/protection", shield: true,
		mainHandDps: 8.0, weights: w(map[stats.Stat]float64{stats.Strength: 1, stats.AttackPower: 0.5, stats.MeleeCritRating: 10 / core.PhysicalCritRatingPerCritPercent, stats.MeleeHitRating: 12 / core.PhysicalHitRatingPerHitPercent,
			stats.SpellDamage: 0.4, stats.Intellect: 0.2, stats.Stamina: 0.4, stats.DefenseRating: 0.5 / core.DefenseRatingPerDefenseLevel, stats.BlockValue: 0.3, stats.Armor: 0.02}),
	},
	// The rank 14 weapons all share one damage per second, so without a type list the
	// warriors tie-break onto daggers. Heroic Strike and Bloodthirst hit for weapon damage
	// and want the slow ones.
	"tank_warrior": {
		class: proto.Class_ClassWarrior, dir: "warrior/protection", shield: true,
		weapons:     []proto.WeaponType{axe, mace, sword},
		mainHandDps: 8.0, weights: w(map[stats.Stat]float64{stats.Strength: 1, stats.AttackPower: 0.5, stats.MeleeCritRating: 10 / core.PhysicalCritRatingPerCritPercent, stats.MeleeHitRating: 14 / core.PhysicalHitRatingPerHitPercent,
			stats.Stamina: 0.4, stats.DefenseRating: 0.5 / core.DefenseRatingPerDefenseLevel, stats.BlockValue: 0.3, stats.Armor: 0.02}),
	},
	"warrior": {
		class: proto.Class_ClassWarrior, dir: "warrior/dps", twoHand: true, dualWield: true,
		weapons:     []proto.WeaponType{axe, mace, sword},
		mainHandDps: 11.92, offHandDps: 4.69, weights: warriorWeights,
	},
	// The warrior's two raid builds want different weapons, the way the rogue's do. Fury is
	// the entry above and dual wields; Arms is a two hander spec - Two-Handed Weapon
	// Specialization does nothing with a weapon in each hand, and without Dual Wield
	// Specialization it carries the off hand's miss penalty for none of its damage.
	"warrior_arms": {
		class: proto.Class_ClassWarrior, dir: "warrior/dps", set: "arms_launch", twoHand: true,
		weapons:     []proto.WeaponType{axe, mace, sword},
		mainHandDps: 11.92, weights: warriorWeights,
	},
	// The rogue's two raid builds want different weapons: Mutilate needs a dagger in each
	// hand, Sinister Strike wants something slow and heavy. One set each, in the same
	// directory, named the way the rogue's other sets are.
	"rogue_backstab": {
		class: proto.Class_ClassRogue, dir: "rogue/dps", set: "backstab_launch", dualWield: true,
		weapons:     []proto.WeaponType{dagger},
		mainHandDps: 10.49, offHandDps: 3.74, weights: rogueWeights,
	},
	"rogue_sinister_strike": {
		class: proto.Class_ClassRogue, dir: "rogue/dps", set: "sinister_strike_launch", dualWield: true,
		weapons:     []proto.WeaponType{sword, mace, fist},
		mainHandDps: 10.49, offHandDps: 3.74, weights: rogueWeights,
	},
	// The ranged weapon does the damage and the melee weapons are stat sticks. Bows and
	// crossbows only, because the preset feeds Thorium Headed Arrows.
	"hunter": {
		class: proto.Class_ClassHunter, dir: "hunter/dps", twoHand: true, dualWield: true,
		ranged:      []proto.RangedWeaponType{bow, crossbow},
		mainHandDps: 2.11, offHandDps: 1.39, rangedDps: 6.32, weights: w(map[stats.Stat]float64{stats.Strength: 0.3, stats.Agility: 0.64,
			stats.Intellect: 0.02, stats.AttackPower: 1, stats.RangedAttackPower: 1, stats.MeleeHitRating: 3.29 / core.PhysicalHitRatingPerHitPercent, stats.MeleeCritRating: 4.45 / core.PhysicalCritRatingPerCritPercent,
			stats.SpellDamage: 0.03, stats.MP5: 0.05}),
	},

	// One set per mage tree: a +Fire item is worth nothing to a Frost mage, and one shared set
	// that counted every school as spell power dressed all three in each other's gear.
	"mage_frost": {
		class: proto.Class_ClassMage, dir: "mage/dps", set: "frost_launch", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Intellect: 0.49, stats.SpellDamage: 1, stats.FrostDamage: 1, stats.SpellHitRating: 18.59 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 13.91 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 6.85 / core.SpellHasteRatingPerHastePercent, stats.MP5: 0.11}),
	},
	"mage_fire": {
		class: proto.Class_ClassMage, dir: "mage/dps", set: "fire_launch", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Intellect: 0.49, stats.SpellDamage: 1, stats.FireDamage: 1, stats.SpellHitRating: 18.59 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 13.91 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 6.85 / core.SpellHasteRatingPerHastePercent, stats.MP5: 0.11}),
	},
	"mage_arcane": {
		class: proto.Class_ClassMage, dir: "mage/dps", set: "arcane_launch", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Intellect: 0.49, stats.SpellDamage: 1, stats.ArcaneDamage: 1, stats.SpellHitRating: 18.59 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 13.91 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 6.85 / core.SpellHasteRatingPerHastePercent, stats.MP5: 0.11}),
	},
	"warlock": {
		class: proto.Class_ClassWarlock, dir: "warlock/dps", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Mana: 0.01, stats.Intellect: 0.23, stats.MP5: 0.14, stats.SpellDamage: 1,
			stats.FireDamage: 0.1, stats.ShadowDamage: 0.9, stats.SpellHitRating: 12.79 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 7.92 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 7.83 / core.SpellHasteRatingPerHastePercent, stats.Stamina: 0.01}),
	},
	"shadow_priest": {
		class: proto.Class_ClassPriest, dir: "priest/dps", set: "launch", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Intellect: 0.16, stats.Spirit: 0.01, stats.SpellDamage: 1, stats.ShadowDamage: 1,
			stats.SpellHitRating: 5.51 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 5.99 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 1.65 / core.SpellHasteRatingPerHastePercent}),
	},
	// A holy caster. Spirit is worth more here than to the other casters, because
	// Forever's Spiritual Guidance turns it into spell damage as well as regen.
	"smite_priest": {
		class: proto.Class_ClassPriest, dir: "priest/dps", set: "smite_launch", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.SpellDamage: 1, stats.SpellHitRating: 14 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 10 / core.SpellCritRatingPerCritPercent,
			stats.Intellect: 0.35, stats.Spirit: 0.25, stats.MP5: 0.4, stats.Stamina: 0.05}),
	},
	"elemental_shaman": {
		class: proto.Class_ClassShaman, dir: "shaman/elemental", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.SpellDamage: 1, stats.SpellHitRating: 14 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 10 / core.SpellCritRatingPerCritPercent,
			stats.Intellect: 0.35, stats.MP5: 0.4, stats.Stamina: 0.05}),
	},
	// Windfury and Stormstrike hit for weapon damage, so the same slow types as the warriors.
	"enhancement_shaman": {
		class: proto.Class_ClassShaman, dir: "shaman/enhancement", dualWield: true,
		weapons:     []proto.WeaponType{axe, mace, fist},
		mainHandDps: 12.0, offHandDps: 12.0, weights: w(map[stats.Stat]float64{stats.AttackPower: 0.5, stats.Strength: 1, stats.Agility: 0.9, stats.MeleeCritRating: 12 / core.PhysicalCritRatingPerCritPercent,
			stats.MeleeHitRating: 14 / core.PhysicalHitRatingPerHitPercent, stats.SpellDamage: 0.2, stats.Intellect: 0.1, stats.Stamina: 0.1}),
	},
	"balance_druid": {
		class: proto.Class_ClassDruid, dir: "druid/balance", twoHand: true, rangedItem: 23197, // Idol of the Moon
		weights: w(map[stats.Stat]float64{stats.Intellect: 0.16, stats.SpellDamage: 1, stats.ArcaneDamage: 0.62,
			stats.NatureDamage: 0.38, stats.SpellHitRating: 11.75 / core.SpellHitRatingPerHitPercent, stats.SpellCritRating: 7.5 / core.SpellCritRatingPerCritPercent, stats.SpellHasteRating: 0.8 / core.SpellHasteRatingPerHastePercent}),
	},
	// A cat's weapon only contributes its stats, the claws do the swinging.
	"feral_druid": {
		class: proto.Class_ClassDruid, dir: "druid/feralcat", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Strength: 2.4, stats.Agility: 2.43, stats.Intellect: 0.61, stats.Spirit: 0.38, stats.MP5: 0.79,
			stats.AttackPower: 1, stats.FeralAttackPower: 1, stats.MeleeHitRating: 26.59 / core.PhysicalHitRatingPerHitPercent, stats.MeleeCritRating: 28.68 / core.PhysicalCritRatingPerCritPercent, stats.ExpertiseRating: 26.59 / (core.ExpertiseRatingPerExpertisePercent / 4), stats.Mana: 0.03}),
	},
	// The same goes for a bear. Stamina and armor keep it up, Agility is crit, dodge and
	// armor at once; the rest is threat.
	"feral_tank_druid": {
		class: proto.Class_ClassDruid, dir: "druid/feralbear", twoHand: true,
		weights: w(map[stats.Stat]float64{stats.Stamina: 1, stats.Agility: 0.9, stats.Strength: 0.8, stats.AttackPower: 0.4,
			stats.FeralAttackPower: 0.4, stats.MeleeCritRating: 10 / core.PhysicalCritRatingPerCritPercent, stats.MeleeHitRating: 12 / core.PhysicalHitRatingPerHitPercent, stats.DefenseRating: 0.6 / core.DefenseRatingPerDefenseLevel, stats.DodgeRating: 10 / core.DodgeRatingPerDodgePercent, stats.Armor: 0.03}),
	},
}

var rogueWeights = w(map[stats.Stat]float64{stats.Agility: 2.38, stats.Strength: 1.26, stats.AttackPower: 1, stats.SpellCritRating: 0.41 / core.SpellCritRatingPerCritPercent,
	stats.SpellHitRating: 0.94 / core.SpellHitRatingPerHitPercent, stats.MeleeHitRating: 29.44 / core.PhysicalHitRatingPerHitPercent, stats.MeleeCritRating: 17.92 / core.PhysicalCritRatingPerCritPercent})

// Fury and Arms share these, the way the rogue's two builds share rogueWeights: what they
// disagree about is the weapon, not what a point of Strength is worth.
var warriorWeights = w(map[stats.Stat]float64{stats.Strength: 2.51, stats.Agility: 1.86, stats.AttackPower: 1,
	stats.MeleeHitRating: 28.67 / core.PhysicalHitRatingPerHitPercent, stats.MeleeCritRating: 25.1 / core.PhysicalCritRatingPerCritPercent})
