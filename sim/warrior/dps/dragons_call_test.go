package dps

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Dragon's Call's whelp is a gear pet: it has to be built at construction, get summoned by the
// proc, and then melee and spit Acid Spit.
func TestDragonsCallWhelp(t *testing.T) {
	player := &proto.Player{
		Name: "warrior", Class: proto.Class_ClassWarrior, Race: proto.Race_RaceOrc, TalentsString: FuryTalents,
		Equipment: weaponsOnly(10847, 0),
		Spec:      DefaultOptions,
		Rotation:  core.GetAplRotation("../../../ui/specs/warrior/dps/apls", "dps_reck").Rotation,
	}
	raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
	res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 20, RandomSeed: 1}})
	if res.Error != nil {
		t.Fatal(res.Error.Message)
	}

	pets := res.RaidMetrics.Parties[0].Players[0].Pets
	if len(pets) != 1 || pets[0].Dps.Avg <= 0 {
		t.Fatalf("expected one whelp dealing damage, got %v", pets)
	}
	for _, action := range pets[0].Actions {
		if action.Id.GetSpellId() == 9591 {
			return
		}
	}
	t.Fatal("whelp never cast Acid Spit")
}
