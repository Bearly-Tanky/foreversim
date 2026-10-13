package holy

import (
	"testing"

	"github.com/wowsims/forever/sim/common"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterHolyPaladin()
	common.RegisterAllEffects()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered. The empty APL
// rotation and the fake prepull (no SkipRotation) make it exercise a full environment reset, the
// path the UI's stats request takes.
func TestHolyPaladin(t *testing.T) {
	var generators []core.TestGenerator
	// Naked and one talent build per preset: the generated item database does not carry the Forever
	// gear our sim plans with, and gives the rest TBC-shaped stats.
	for _, build := range []struct{ name, talents string }{{"standard", StandardTalents}, {"holy-38-13-0", HolyHealerTalents}} {
		player := core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassPaladin,
				Race:          proto.Race_RaceHuman,
				Equipment:     &proto.EquipmentSpec{},
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: build.talents,
				Profession1:   proto.Profession_Enchanting,
				Profession2:   proto.Profession_Jewelcrafting,
				Rotation:      &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			},
			PlayerOptions,
		)
		generators = append(generators, &core.SingleCharacterStatsTestGenerator{
			Name: build.name,
			Request: &proto.ComputeStatsRequest{
				Raid: core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs),
			},
		})
	}
	core.RunTestSuite(t, t.Name(), generators)
}

// Our Forever sim's holy builds.
var StandardTalents = "05321013025131251-503210302"
var HolyHealerTalents = "25320213225131051-50323"

var FullConsumes = &proto.ConsumesSpec{
	FlaskId: 22853, // Flask of Mighty Restoration
	FoodId:  27666, // Golden Fish Sticks
	PotId:   22832, // Super Mana Potion
}

var PlayerOptions = &proto.Player_HolyPaladin{
	HolyPaladin: &proto.HolyPaladin{
		Options: &proto.HolyPaladin_Options{
			ClassOptions: &proto.PaladinOptions{},
		},
	},
}
