package protection

import (
	"testing"

	"github.com/wowsims/forever/sim/arenalib"
	"github.com/wowsims/forever/sim/common" // imported to get item effects included.
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterProtectionPaladin()
	common.RegisterAllEffects()
}

func TestProtection(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassPaladin,
			Race:       proto.Race_RaceHuman,
			OtherRaces: []proto.Race{proto.Race_RaceDwarf},

			GearSet: core.GearSetCombo{Label: "WeaponAndShield", GearSet: WeaponAndShield},

			Talents: ProtTalents,
			OtherTalentSets: []core.TalentsCombo{
				{Label: "Protection 0/45/6", Talents: ProtDeepTalents},
			},

			SpecOptions: core.SpecOptionsCombo{Label: "Protection", SpecOptions: DefaultOptions},
			Rotation:    core.GetAplRotation("../../../ui/specs/paladin/protection/apls", "default"),
			OtherRotations: []core.RotationCombo{
				core.GetAplRotation("../../../ui/specs/paladin/protection/apls", "p5"),
			},

			Consumables: DefaultConsumables,

			// Without this the boss never attacks, so nothing the spec does in response to being hit
			// can fire and the damage taken metrics are all zero.
			IsTank:           true,
			InFrontOfTarget:  true,
			StartingDistance: 5,

			ItemFilter: core.ItemFilter{
				ArmorType: proto.ArmorType_ArmorTypePlate,
				WeaponTypes: []proto.WeaponType{
					proto.WeaponType_WeaponTypeAxe,
					proto.WeaponType_WeaponTypeSword,
					proto.WeaponType_WeaponTypeMace,
					proto.WeaponType_WeaponTypeShield,
				},
				HandTypes: []proto.HandType{
					proto.HandType_HandTypeMainHand,
					proto.HandType_HandTypeOffHand,
					proto.HandType_HandTypeOneHand,
				},
				RangedWeaponTypes: []proto.RangedWeaponType{
					proto.RangedWeaponType_RangedWeaponTypeLibram,
				},
			},

			EPReferenceStat: proto.Stat_StatAttackPower,
			StatsToWeigh: []proto.Stat{
				proto.Stat_StatStrength,
				proto.Stat_StatStamina,
				proto.Stat_StatAgility,
				proto.Stat_StatAttackPower,
				proto.Stat_StatMeleeHitRating,
				proto.Stat_StatMeleeCritRating,
				proto.Stat_StatSpellDamage,
				proto.Stat_StatArmor,
				proto.Stat_StatDefenseRating,
				proto.Stat_StatBlockRating,
			},
		},
	}))
}

// Our Forever sim's builds: the P4 build it tests with, and the deep Protection preset.
var ProtTalents = "52003003-5530513321301501"
var ProtDeepTalents = "-5532513321301551-15"

// A one-hander and a shield, rows both item databases carry. The generated item database does not
// carry the Forever gear our sim tests with and gives the rest TBC-shaped stats.
var WeaponAndShield = &proto.EquipmentSpec{
	Items: []*proto.ItemSpec{
		{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
		{Id: 12584}, // Grand Marshal's Longsword
		{Id: 18825}, // Grand Marshal's Aegis
	},
}

var DefaultOptions = &proto.Player_ProtectionPaladin{
	ProtectionPaladin: &proto.ProtectionPaladin{
		Options: &proto.ProtectionPaladin_Options{
			ClassOptions: &proto.PaladinOptions{},
		},
	},
}

var DefaultConsumables = &proto.ConsumesSpec{
	FlaskId: 22854,
	FoodId:  27658,
	PotId:   22838,
}

// The arena entry for this spec. Without ARENA_OUT set it only checks every build's damage against the spell manifest; see sim/arenalib.
func TestArena(t *testing.T) {
	arenalib.Run(t, arenalib.Spec{
		Dir:         "protection_paladin",
		UI:          "paladin/protection",
		Class:       proto.Class_ClassPaladin,
		Race:        proto.Race_RaceHuman,
		SpecOptions: DefaultOptions,
		Role:        arenalib.Melee,
		IsTank:      true,
	})
}
