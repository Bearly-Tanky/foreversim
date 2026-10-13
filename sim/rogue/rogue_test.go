package rogue

import (
	"testing"

	"github.com/wowsims/forever/sim/arenalib"
	"github.com/wowsims/forever/sim/common"
	_ "github.com/wowsims/forever/sim/common" // imported to get item effects included.
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterRogue()
	common.RegisterAllEffects()
}

func TestAssassination(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		rogueSuite("forever_mutilate", AssassinationTalents),
	}))
}

func TestCombat(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		rogueSuite("combat_sinister_strike", CombatTalents),
	}))
}

func TestSubtlety(t *testing.T) {
	core.RunTestSuite(t, t.Name(), core.FullCharacterTestSuiteGenerator([]core.CharacterSuiteConfig{
		rogueSuite("forever_hemorrhage", SubtletyTalents),
	}))
}

// The three builds our Forever sim ranks: Combat swords 15/31/5, Assassination Mutilate 31/20/0
// and Subtlety Hemorrhage 9/0/42.
var CombatTalents = "00530310501-32003311201515231"
var AssassinationTalents = "00530310551021051-302303202004"
var SubtletyTalents = "125320101--5320003310013211551"

// Two daggers and nothing else. The generated item database does not carry the Forever gear our
// sim tests with and gives the rest TBC-shaped stats, so the comparison against master runs on
// the same two statless weapons on both sides instead.
var DefaultGear = core.GearSetCombo{Label: "Daggers", GearSet: daggersOnly()}

func daggersOnly() *proto.EquipmentSpec {
	items := make([]*proto.ItemSpec, proto.ItemSlot_ItemSlotRanged+1)
	for i := range items {
		items[i] = &proto.ItemSpec{}
	}
	items[proto.ItemSlot_ItemSlotMainHand] = &proto.ItemSpec{Id: 19324} // The Lobotomizer, 59-111, 1.80
	items[proto.ItemSlot_ItemSlotOffHand] = &proto.ItemSpec{Id: 19166}  // Black Amnesty, 53-100, 1.60
	return &proto.EquipmentSpec{Items: items}
}

func rogueSuite(apl string, talents string) core.CharacterSuiteConfig {
	return core.CharacterSuiteConfig{
		Class:       proto.Class_ClassRogue,
		Race:        proto.Race_RaceHuman,
		OtherRaces:  []proto.Race{proto.Race_RaceOrc},
		GearSet:     DefaultGear,
		Talents:     talents,
		Consumables: DefaultConsumables,
		SpecOptions: core.SpecOptionsCombo{Label: "Poisons", SpecOptions: DefaultOptions},
		Rotation:    core.GetAplRotation("../../ui/specs/rogue/dps/apls", apl),
		ItemFilter: core.ItemFilter{
			ArmorType: proto.ArmorType_ArmorTypeLeather,
			WeaponTypes: []proto.WeaponType{
				proto.WeaponType_WeaponTypeDagger,
				proto.WeaponType_WeaponTypeFist,
				proto.WeaponType_WeaponTypeMace,
				proto.WeaponType_WeaponTypeSword,
			},
			HandTypes: []proto.HandType{
				proto.HandType_HandTypeMainHand,
				proto.HandType_HandTypeOffHand,
				proto.HandType_HandTypeOneHand,
			},
			// Enchant effects sim/common registers that the generated database has no row for.
			EnchantBlacklist: []int32{963, 1899, 1900, 2523, 2613, 2621, 2673, 2714, 2722, 2723, 2724, 2939, 2940, 3225, 3273},
		},
	}
}

var DefaultOptions = &proto.Player_Rogue{
	Rogue: &proto.Rogue{
		Options: &proto.Rogue_Options{
			ClassOptions: &proto.RogueOptions{},
		},
	},
}

var DefaultConsumables = &proto.ConsumesSpec{
	ConjuredId: 7676,
	MhImbueId:  26891, // Instant Poison
	OhImbueId:  27186, // Deadly Poison
}

// The arena entry for this spec. Without ARENA_OUT set it only checks every build's damage against the spell manifest; see sim/arenalib.
func TestArena(t *testing.T) {
	arenalib.Run(t, arenalib.Spec{
		Dir:         "rogue",
		UI:          "rogue/dps",
		Class:       proto.Class_ClassRogue,
		Race:        proto.Race_RaceHuman,
		SpecOptions: DefaultOptions,
		Role:        arenalib.Melee,
		// Poisons are a rogue ability, not something on the vendor list. Deadly rather than Instant in
		// the off hand: Mutilate's 20% only counts against Deadly or Wound Poison, and Deadly
		// out-damages Instant for every build on launch gear (+2.4..+5.0%). Instant in the main hand,
		// which was bare: Forever's Windfury Totem no longer occupies it (#550), and Instant beats an
		// Elemental Sharpening Stone there for every build (+3.2..+4.1% vs +1.7..+1.9%).
		ClassImbues: arenalib.ClassImbues{MainHand: 26891, OffHand: 27186}, // Instant, Deadly Poison
	})
}
