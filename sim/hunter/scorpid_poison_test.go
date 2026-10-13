package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Scorpid Poison (client 24587) stacks to 5 at 5 a tick each. Every landed cast used to Apply the dot,
// which wipes its stacks, so it never held more than one.
func TestScorpidPoisonStacks(t *testing.T) {
	player := &proto.Player{
		Name: "bm", Class: proto.Class_ClassHunter, Race: proto.Race_RaceOrc, TalentsString: BeastMasteryTalents,
		Equipment: WeaponsOnly, DistanceFromTarget: 30,
		Spec: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{ClassOptions: &proto.HunterOptions{
			Ammo: proto.HunterOptions_Doomshot, QuiverBonus: proto.HunterOptions_Speed15, PetType: proto.HunterOptions_Scorpid,
			PetAttackSpeed: proto.HunterOptions_OneTwo, PetUptime: 1}}}},
		Rotation: core.GetAplRotation("../../ui/specs/hunter/dps/apls", "bm").Rotation,
	}
	raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
	res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 5, RandomSeed: 1}})
	if res.Error != nil {
		t.Fatal(res.Error.Message)
	}

	var ticks int32
	var damage float64
	for _, pet := range res.RaidMetrics.Parties[0].Players[0].Pets {
		for _, action := range pet.Actions {
			if action.Id.GetSpellId() != spellData.ScorpidPoisonTriggered.Highest().ID {
				continue
			}
			for _, target := range action.Targets {
				ticks += target.Ticks
				damage += target.Damage
			}
		}
	}
	if ticks == 0 {
		t.Fatal("no Scorpid Poison tick")
	}
	// One stack ticks 5 times the pet's multipliers; held at 5 stacks a tick is near 25 times them.
	avg := damage / float64(ticks)
	t.Logf("%d ticks, %.1f a tick", ticks, avg)
	if avg < 15 {
		t.Errorf("Scorpid Poison ticks %.1f on average, want the 5-stack ~25", avg)
	}
}
