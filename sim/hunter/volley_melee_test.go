package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Volley is a channel, so like every other non-melee cast it holds the melee swing: no swing lands
// during the 6 sec, and the next one comes a full weapon speed after the channel ends.
func TestVolleyHoldsTheMeleeSwing(t *testing.T) {
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
	hunter.AutoAttacks.EnableAutoSwing(sim)
	hunter.AutoAttacks.StopMeleeUntil(sim, sim.CurrentTime) // a swing just landed
	if !hunter.Volley.Cast(sim, hunter.CurrentTarget) {
		t.Fatal("Volley did not cast")
	}
	channelEnd := sim.CurrentTime + hunter.Volley.AOEDot().RemainingDuration(sim)
	if got, want := hunter.AutoAttacks.MainhandSwingAt(), channelEnd+hunter.AutoAttacks.MainhandSwingSpeed(); got != want {
		t.Errorf("next melee swing at %s, want %s (a full swing after the channel ends at %s)", got, want, channelEnd)
	}
}
