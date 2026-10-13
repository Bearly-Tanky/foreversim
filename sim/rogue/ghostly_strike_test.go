package rogue

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// No default rotation presses Ghostly Strike (14278); these two optional ones do, and the arena picks
// them per build. The Hemorrhage one only casts it while Hemorrhage is up on the target, which
// keeps Rupture's 15% bonus.
func TestGhostlyRotationsPressGhostlyStrike(t *testing.T) {
	for _, apl := range []string{"forever_hemorrhage_ghostly", "combat_backstab_ghostly"} {
		result := core.RunRaidSim(&proto.RaidSimRequest{
			Raid: core.SinglePlayerRaidProto(&proto.Player{
				Race: proto.Race_RaceHuman, Class: proto.Class_ClassRogue,
				Equipment: DefaultGear.GearSet, TalentsString: SubtletyTalents, Spec: DefaultOptions,
				Rotation: core.GetAplRotation("../../ui/specs/rogue/dps/apls", apl).Rotation,
			}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
			SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: 1},
		})
		if result.Error != nil {
			t.Fatal(result.Error.Message)
		}
		casts := int32(0)
		for _, action := range result.RaidMetrics.Parties[0].Players[0].Actions {
			if action.Id.GetSpellId() == 14278 {
				for _, target := range action.Targets {
					casts += target.Casts
				}
			}
		}
		if casts == 0 {
			t.Errorf("%s: no Ghostly Strike casts", apl)
		}
	}
}
