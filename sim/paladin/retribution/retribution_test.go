package retribution

import (
	"testing"

	"github.com/wowsims/forever/sim/arenalib"
	"github.com/wowsims/forever/sim/common" // imported to get item effects included.
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterRetributionPaladin()
	common.RegisterAllEffects()
}

func TestRetribution(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		{
			Class:      proto.Class_ClassPaladin,
			Race:       proto.Race_RaceHuman,
			OtherRaces: []proto.Race{proto.Race_RaceDwarf},

			GearSet: core.GearSetCombo{Label: "Weapon", GearSet: WeaponOnly},

			Talents: RetTalents,
			OtherTalentSets: []core.TalentsCombo{
				{Label: "Retribution 9/0/42", Talents: RetDeepTalents},
			},

			SpecOptions: core.SpecOptionsCombo{Label: "Default", SpecOptions: DefaultOptions},
			Rotation:    core.GetAplRotation("../../../ui/specs/paladin/retribution/apls", "default"),

			Consumables: DefaultConsumables,

			ItemFilter: core.ItemFilter{
				ArmorType: proto.ArmorType_ArmorTypePlate,
				WeaponTypes: []proto.WeaponType{
					proto.WeaponType_WeaponTypeAxe,
					proto.WeaponType_WeaponTypeSword,
					proto.WeaponType_WeaponTypeMace,
					proto.WeaponType_WeaponTypePolearm,
				},
				HandTypes: []proto.HandType{proto.HandType_HandTypeTwoHand},
				RangedWeaponTypes: []proto.RangedWeaponType{
					proto.RangedWeaponType_RangedWeaponTypeLibram,
				},
			},

			EPReferenceStat: proto.Stat_StatAttackPower,
			StatsToWeigh: []proto.Stat{
				proto.Stat_StatStrength,
				proto.Stat_StatAgility,
				proto.Stat_StatIntellect,
				proto.Stat_StatAttackPower,
				proto.Stat_StatMeleeHitRating,
				proto.Stat_StatMeleeCritRating,
				proto.Stat_StatSpellDamage,
			},
		},
	}))
}

// Our Forever sim's builds: the P4/P5 Seal of Command twist build it tests with, and the deep
// Retribution preset.
var RetTalents = "550030022001--05225231001330321"
var RetDeepTalents = "51003--55225331201331321"

// Arcanite Reaper alone. The generated item database does not carry the Forever gear our sim tests
// with and gives the rest TBC-shaped stats; this row is the same in both item databases (153-256,
// 3.80), so the comparison against master runs on the same weapon.
var WeaponOnly = &proto.EquipmentSpec{
	Items: []*proto.ItemSpec{
		{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
		{Id: 12784}, // Arcanite Reaper
	},
}

var DefaultOptions = &proto.Player_RetributionPaladin{
	RetributionPaladin: &proto.RetributionPaladin{
		Options: &proto.RetributionPaladin_Options{
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
		Dir:         "retribution_paladin",
		UI:          "paladin/retribution",
		Class:       proto.Class_ClassPaladin,
		Race:        proto.Race_RaceHuman,
		SpecOptions: DefaultOptions,
		Role:        arenalib.Melee,
	})
}
