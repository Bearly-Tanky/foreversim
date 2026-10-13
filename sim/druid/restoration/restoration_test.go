package restoration

import (
	"testing"

	"github.com/wowsims/forever/sim/common"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterRestorationDruid()
	common.RegisterAllEffects()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered. The empty APL
// rotation and the fake prepull (no SkipRotation) make it exercise a full environment reset, the
// path the UI's stats request takes.
func TestRestorationDruid(t *testing.T) {
	var generators []core.TestGenerator
	// Naked and one talent build per preset: the generated item database does not carry the Forever
	// gear our sim plans with, and gives the rest TBC-shaped stats.
	for _, build := range []struct{ name, talents string }{{"restoration-10-0-41", RestorationTalents}} {
		player := core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassDruid,
				Race:          proto.Race_RaceTauren,
				Equipment:     &proto.EquipmentSpec{},
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: build.talents,
				Profession1:   proto.Profession_Tailoring,
				Profession2:   proto.Profession_Enchanting,
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

// ui/specs/druid/restoration/presets.ts, master's ui/restoration_druid default.
var RestorationTalents = "05302--5053035153113051"

// The UI sets no consumables for this spec (the TBC flask, food and potion are not in the Forever client).
var FullConsumes = &proto.ConsumesSpec{}

var PlayerOptions = &proto.Player_RestorationDruid{
	RestorationDruid: &proto.RestorationDruid{
		Options: &proto.RestorationDruid_Options{
			ClassOptions: &proto.DruidOptions{},
		},
	},
}
