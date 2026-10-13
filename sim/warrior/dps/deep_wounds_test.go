package dps

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Deep Wound's tick (412613) ignores caster damage modifiers (client Attributes[6] 0x20000000):
// beta logs 2705/2708 show its ticks unchanged in Defensive Stance while Thunder Clap and Rend lose 10%.
func TestDeepWoundsIgnoresStanceDamage(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		Raid: core.SinglePlayerRaidProto(&proto.Player{
			Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarrior,
			Equipment: TwoHandGear.GearSet, TalentsString: ArmsTalents, Spec: DefaultOptions,
		}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter:  core.MakeSingleTargetEncounter(0),
		SimOptions: &proto.SimOptions{RandomSeed: 1},
	}, simsignals.CreateSignals())
	sim.Reset()
	warrior := sim.Raid.Parties[0].Players[0].(*DpsWarrior)
	deepWounds := warrior.GetSpell(core.ActionID{SpellID: 412609})
	if deepWounds == nil {
		t.Fatal("Deep Wounds not registered")
	}
	warrior.PseudoStats.DamageDealtMultiplier *= 0.9 // Defensive Stance
	attackTable := warrior.AttackTables[warrior.CurrentTarget.UnitIndex]
	if got := deepWounds.AttackerDamageMultiplier(attackTable, true); got != 1 {
		t.Errorf("Deep Wounds tick multiplier %v in Defensive Stance, want 1", got)
	}
}
