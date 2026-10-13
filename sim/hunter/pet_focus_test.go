package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Focus comes back 10 a second (client PowerType Focus RegenCombat 10); beta log pets spend 9.5+ a second.
// A cat with no Bestial Discipline that Bites and Claws all fight should spend about that much.
func TestPetFocusRegen(t *testing.T) {
	player := &proto.Player{
		Name: "mm", Class: proto.Class_ClassHunter, Race: proto.Race_RaceOrc, TalentsString: MarksmanshipTalents,
		Equipment: WeaponsOnly, DistanceFromTarget: 30,
		Spec: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{ClassOptions: &proto.HunterOptions{
			Ammo: proto.HunterOptions_Doomshot, QuiverBonus: proto.HunterOptions_Speed15, PetType: proto.HunterOptions_Cat,
			PetAttackSpeed: proto.HunterOptions_OneTwo, PetUptime: 1}}}},
		Rotation: core.GetAplRotation("../../ui/specs/hunter/dps/apls", "mm").Rotation,
	}
	raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
	encounter := core.MakeSingleTargetEncounter(0)
	res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: encounter, SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: 1}})
	if res.Error != nil {
		t.Fatal(res.Error.Message)
	}

	cost := map[int32]float64{3009: 25, 17261: 35} // Claw, Bite
	var spent float64
	for _, pet := range res.RaidMetrics.Parties[0].Players[0].Pets {
		for _, action := range pet.Actions {
			for _, target := range action.Targets {
				spent += cost[action.Id.GetSpellId()] * float64(target.Casts)
			}
		}
	}
	// Less the full bar the pet starts with.
	perSec := (spent - 100) / encounter.Duration
	if perSec < 9.3 || perSec > 10.1 {
		t.Fatalf("pet spent %.2f focus a second, want ~10", perSec)
	}
}
