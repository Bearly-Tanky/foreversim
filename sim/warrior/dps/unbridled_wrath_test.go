package dps

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Unbridled Wrath procs from white autos only: Heroic Strike and Cleave take the main-hand swing's
// place but never proc it (beta logs 2670/2698: 0 of 148 HS/Cleave hits, 31-59% of autos).
func TestUnbridledWrathSkipsHeroicStrikeAndCleave(t *testing.T) {
	rageFrom := func(t *testing.T, spellID int32) float64 {
		sim := core.NewSim(&proto.RaidSimRequest{
			Raid: core.SinglePlayerRaidProto(&proto.Player{
				Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarrior,
				Equipment: &proto.EquipmentSpec{}, TalentsString: FuryTalents, Spec: DefaultOptions,
				Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
			SimOptions: &proto.SimOptions{RandomSeed: 1},
		}, simsignals.CreateSignals())
		sim.Reset()
		warrior := sim.Raid.Parties[0].Players[0].(*DpsWarrior)
		warrior.AutoAttacks.CancelAutoSwing(sim)

		spell := warrior.AutoAttacks.MHAuto()
		if spellID != 0 {
			spell = warrior.GetSpell(core.ActionID{SpellID: spellID})
		}
		before := warrior.CurrentRage()
		for range 50 {
			warrior.OnSpellHitDealt(sim, spell, &core.SpellResult{Target: warrior.CurrentTarget, Outcome: core.OutcomeHit, Damage: 100})
		}
		until := 100 * time.Millisecond
		sim.AddPendingAction(core.NewDelayedAction(core.DelayedActionOptions{DoAt: until, OnAction: func(*core.Simulation) {}}))
		for sim.CurrentTime < until {
			sim.Step()
		}
		return warrior.CurrentRage() - before
	}

	if got := rageFrom(t, 0); got == 0 {
		t.Error("50 landed main-hand autos gave no Unbridled Wrath rage")
	}
	for _, c := range []struct {
		name string
		id   int32
	}{{"Heroic Strike", 25286}, {"Cleave", 20569}} {
		if got := rageFrom(t, c.id); got != 0 {
			t.Errorf("50 landed %s hits gave %.0f Unbridled Wrath rage, want 0", c.name, got)
		}
	}
}
