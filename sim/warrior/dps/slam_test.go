package dps

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Build 70009: Slam's cooldown is 18s and Improved Slam 2/2 takes 3s off it.
func TestImprovedSlamShortensSlamCooldown(t *testing.T) {
	for talents, want := range map[string]time.Duration{
		ArmsTalents:              15 * time.Second,
		"32305213132515001-5502": 18 * time.Second, // Improved Slam untaken
	} {
		sim := core.NewSim(&proto.RaidSimRequest{
			Raid: core.SinglePlayerRaidProto(&proto.Player{
				Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarrior,
				Equipment: &proto.EquipmentSpec{}, TalentsString: talents, Spec: DefaultOptions,
			}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
			SimOptions: &proto.SimOptions{RandomSeed: 1},
		}, simsignals.CreateSignals())
		sim.Reset()
		slam := sim.Raid.Parties[0].Players[0].(*DpsWarrior).GetSpell(core.ActionID{SpellID: 11605})
		if slam == nil || slam.CD.Duration != want {
			t.Errorf("%s: Slam cooldown %v, want %v", talents, slam.CD.Duration, want)
		}
	}
}

// Slam is a 1.5 sec cast that resets the swing; Improved Slam makes it 0.5 sec with no swing reset.
// The rotations press it only when its cast is under 1.5 sec, so Arms 39/12 (Improved Slam 2/2)
// slams and Fury, which would lose damage to it, does not.
func TestRotationSlamsOnlyWithImprovedSlam(t *testing.T) {
	for talents, wantSlams := range map[string]bool{
		ArmsTalents: true,
		FuryTalents: false,
	} {
		result := core.RunRaidSim(&proto.RaidSimRequest{
			Raid: core.SinglePlayerRaidProto(&proto.Player{
				Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarrior,
				Equipment: TwoHandGear.GearSet, TalentsString: talents, Spec: DefaultOptions,
				Rotation: core.GetAplRotation("../../../ui/specs/warrior/dps/apls", "dps_reck").Rotation,
			}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
			SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: 1},
		})
		if result.Error != nil {
			t.Fatal(result.Error.Message)
		}
		slams := int32(0)
		for _, action := range result.RaidMetrics.Parties[0].Players[0].Actions {
			if action.Id.GetSpellId() == 11605 {
				for _, target := range action.Targets {
					slams += target.Casts
				}
			}
		}
		if got := slams > 0; got != wantSlams {
			t.Errorf("%s: %d Slams, want any = %v", talents, slams, wantSlams)
		}
	}
}
