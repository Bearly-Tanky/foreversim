package restoration

import (
	"testing"

	"github.com/wowsims/forever/sim/common"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	RegisterRestorationShaman()
	common.RegisterAllEffects()
}

// Stats-only suite: this spec is a gear planner, it has no healing rotation.
// Pins the final character stats for each gear preset so the passives stay covered. The empty APL
// rotation and the fake prepull (no SkipRotation) make it exercise a full environment reset, the
// path the UI's stats request takes.
func TestRestorationShaman(t *testing.T) {
	var generators []core.TestGenerator
	// Naked, for the same reason as the DPS specs: the generated item database does not carry the
	// Forever gear our sim tests with yet.
	for _, gearSet := range []string{"naked"} {
		player := core.WithSpec(
			&proto.Player{
				Class:         proto.Class_ClassShaman,
				Race:          proto.Race_RaceDwarf,
				Equipment:     &proto.EquipmentSpec{},
				Consumables:   FullConsumes,
				Buffs:         core.FullIndividualBuffs,
				TalentsString: StandardTalents,
				Profession1:   proto.Profession_Leatherworking,
				Profession2:   proto.Profession_Enchanting,
				Rotation:      &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			},
			PlayerOptions,
		)
		generators = append(generators, &core.SingleCharacterStatsTestGenerator{
			Name: gearSet,
			Request: &proto.ComputeStatsRequest{
				Raid: core.SinglePlayerRaidProto(player, core.FullPartyBuffs, core.FullRaidBuffs, core.FullDebuffs),
			},
		})
	}
	core.RunTestSuite(t, t.Name(), generators)
}

// Forever's Restoration tree: the UI's Tank Healing preset.
var StandardTalents = "--5533523315513151"

var FullConsumes = &proto.ConsumesSpec{
	FlaskId: 22853, // Flask of Mighty Restoration
	FoodId:  27666, // Golden Fish Sticks
	PotId:   22832, // Super Mana Potion
}

var PlayerOptions = &proto.Player_RestorationShaman{
	RestorationShaman: &proto.RestorationShaman{
		Options: &proto.RestorationShaman_Options{
			ClassOptions: &proto.ShamanOptions{},
		},
	},
}
