package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/arenalib"
	"github.com/wowsims/forever/sim/common"
	_ "github.com/wowsims/forever/sim/common" // imported to get item effects included.
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterHunter()
	common.RegisterAllEffects()
}

func TestBeastMastery(t *testing.T) {
	suite := hunterSuite("bm", BeastMasteryTalents)
	// A Raptor as well, the one pet with Savage Rend.
	suite.OtherSpecOptions = []core.SpecOptionsCombo{{Label: "Raptor", SpecOptions: &proto.Player_Hunter{
		Hunter: &proto.Hunter{
			Options: &proto.Hunter_Options{
				ClassOptions: &proto.HunterOptions{
					Ammo:           proto.HunterOptions_Doomshot,
					QuiverBonus:    proto.HunterOptions_Speed15,
					PetType:        proto.HunterOptions_Raptor,
					PetAttackSpeed: proto.HunterOptions_OneTwo,
					PetUptime:      1,
				},
			},
		},
	}}}
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{suite}))
}

func TestMarksmanship(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{hunterSuite("mm", MarksmanshipTalents)}))
}

// Survival melees, as every Survival hunter in the beta logs does (foreverlogs 2716, 2721-2727, 2730:
// Raptor Strike, Strider Kick, Mongoose Bite and Immolation Trap, next to no Auto Shot). The ranged
// sv rotation never reached Strider Kick, Predator's Edge, Savage Strikes or Lacerating Strikes.
func TestSurvival(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{hunterSuite("sv_melee", SurvivalTalents)}))
}

// The three builds our Forever sim ranks: Beast Mastery 35/16/0, Marksmanship 0/39/12 and
// Survival 0/15/36.
var BeastMasteryTalents = "5520001505121251-0050551"
var MarksmanshipTalents = "-3050552301503151-50024001"
var SurvivalTalents = "-005055-550230031051220151"

// Weapons only: the generated item database does not carry most of the pre-raid set our Forever sim
// tests with yet, and gives the rest TBC-shaped stats. A hunter still needs something to shoot with,
// so the bow and a two-hander are equipped and nothing else.
var WeaponsOnly = &proto.EquipmentSpec{
	Items: []*proto.ItemSpec{
		{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
		{Id: 12784}, // Arcanite Reaper
		{},          //
		{Id: 18713}, // Rhok'delar, Longbow of the Ancient Keepers
	},
}

func hunterSuite(apl string, talents string) core.CharacterSuiteConfig {
	return core.CharacterSuiteConfig{
		Class:      proto.Class_ClassHunter,
		Race:       proto.Race_RaceOrc,
		OtherRaces: []proto.Race{proto.Race_RaceNightElf},
		GearSet:    core.GearSetCombo{Label: "Weapons", GearSet: WeaponsOnly},
		Talents:    talents,
		Rotation:   core.GetAplRotation("../../ui/specs/hunter/dps/apls", apl),
		SpecOptions: core.SpecOptionsCombo{Label: "Cat", SpecOptions: &proto.Player_Hunter{
			Hunter: &proto.Hunter{
				Options: &proto.Hunter_Options{
					ClassOptions: &proto.HunterOptions{
						Ammo:           proto.HunterOptions_Doomshot,
						QuiverBonus:    proto.HunterOptions_Speed15,
						PetType:        proto.HunterOptions_Cat,
						PetAttackSpeed: proto.HunterOptions_OneTwo,
						PetUptime:      1,
					},
				},
			},
		}},

		// Ranged abilities won't cast inside MinRangedAttackDistance.
		StartingDistance: 30,

		ItemFilter: core.ItemFilter{
			ArmorType: proto.ArmorType_ArmorTypeMail,
			RangedWeaponTypes: []proto.RangedWeaponType{
				proto.RangedWeaponType_RangedWeaponTypeBow,
				proto.RangedWeaponType_RangedWeaponTypeCrossbow,
				proto.RangedWeaponType_RangedWeaponTypeGun,
			},
			WeaponTypes: []proto.WeaponType{
				proto.WeaponType_WeaponTypeAxe,
				proto.WeaponType_WeaponTypeDagger,
				proto.WeaponType_WeaponTypeFist,
				proto.WeaponType_WeaponTypePolearm,
				proto.WeaponType_WeaponTypeStaff,
				proto.WeaponType_WeaponTypeSword,
			},
			HandTypes: []proto.HandType{
				proto.HandType_HandTypeMainHand,
				proto.HandType_HandTypeOffHand,
				proto.HandType_HandTypeOneHand,
				proto.HandType_HandTypeTwoHand,
			},
		},
	}
}

// The site's hunter options: Thorium Headed Arrows, the Classic ammo, where the suite above
// shoots TBC's Doomshot.
func TestArena(t *testing.T) {
	arenalib.Run(t, arenalib.Spec{
		Dir:   "hunter",
		UI:    "hunter/dps",
		Class: proto.Class_ClassHunter,
		Race:  proto.Race_RaceOrc,
		SpecOptions: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{
			ClassOptions: &proto.HunterOptions{
				Ammo:           proto.HunterOptions_ThoriumHeadedArrow,
				QuiverBonus:    proto.HunterOptions_Speed15,
				PetType:        proto.HunterOptions_Cat,
				PetAttackSpeed: proto.HunterOptions_OneTwo,
				PetUptime:      1,
			},
		}}},
		Role:               arenalib.Ranged,
		DistanceFromTarget: 30,
	})
}
