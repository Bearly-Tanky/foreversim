package hunter

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Client 1.60.1.70205 splits the traps into two cooldown categories: Immolation and Explosive Trap
// (411) and Freezing Trap (2183), 30 sec each.
func TestTrapCooldownCategories(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 1},
		Raid: &proto.Raid{Parties: []*proto.Party{{Buffs: &proto.PartyBuffs{}, Players: []*proto.Player{{
			Name: "sv", Class: proto.Class_ClassHunter, Race: proto.Race_RaceOrc, TalentsString: SurvivalTalents,
			Equipment: WeaponsOnly, Buffs: &proto.IndividualBuffs{},
			Spec: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{ClassOptions: &proto.HunterOptions{
				Ammo: proto.HunterOptions_Doomshot, PetType: proto.HunterOptions_PetNone}}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}}}}},
		Encounter: core.MakeSingleTargetEncounter(0),
	}, simsignals.CreateSignals())
	sim.Reset()

	hunter := sim.Raid.Parties[0].Players[0].(HunterAgent).GetHunter()
	if !hunter.FreezingTrap.Cast(sim, hunter.CurrentTarget) {
		t.Fatal("Freezing Trap did not cast")
	}
	if got := hunter.FreezingTrap.CD.TimeToReady(sim); got != 30*time.Second {
		t.Errorf("Freezing Trap ready in %v, want 30s", got)
	}
	if !hunter.ImmolationTrap.CD.IsReady(sim) || !hunter.ExplosiveTrap.CD.IsReady(sim) {
		t.Error("Freezing Trap locked the fire traps")
	}

	hunter.GCD.Reset()
	if !hunter.ImmolationTrap.Cast(sim, hunter.CurrentTarget) {
		t.Fatal("Immolation Trap did not cast")
	}
	if got := hunter.ExplosiveTrap.CD.TimeToReady(sim); got != 30*time.Second {
		t.Errorf("Explosive Trap ready in %v after Immolation Trap, want 30s", got)
	}
}
