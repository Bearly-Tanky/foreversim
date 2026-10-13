package dps

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Charge's rage adds no threat: every rank is flagged No Threat in the client (Attributes[1] 0x400),
// while an ordinary rage gain still adds 5 a point.
func TestChargeRageAddsNoThreat(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		Raid: core.SinglePlayerRaidProto(&proto.Player{
			Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarrior,
			Equipment: &proto.EquipmentSpec{}, TalentsString: ArmsTalents, Spec: DefaultOptions,
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter:  core.MakeSingleTargetEncounter(0),
		SimOptions: &proto.SimOptions{RandomSeed: 1},
	}, simsignals.CreateSignals())
	sim.Reset()
	warrior := sim.Raid.Parties[0].Players[0].(*DpsWarrior)
	threat := func() float64 {
		return warrior.GetSpell(core.ActionID{OtherID: proto.OtherAction_OtherActionRageGain}).SpellMetrics[0].TotalThreat
	}

	before := warrior.CurrentRage()
	warrior.GetSpell(core.ActionID{SpellID: 11578}).SkipCastAndApplyEffects(sim, warrior.CurrentTarget)
	if warrior.CurrentRage() <= before {
		t.Fatal("Charge gave no rage")
	}
	sim.Cleanup()
	if got := threat(); got != 0 {
		t.Errorf("Charge's rage added %.1f threat, want 0", got)
	}

	warrior.AddRage(sim, 10, warrior.NewRageMetrics(core.ActionID{SpellID: 2687}))
	sim.Cleanup()
	if got := threat(); got != 50 {
		t.Errorf("an ordinary 10 rage gain added %.1f threat, want 50", got)
	}
}
