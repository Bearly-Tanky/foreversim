package rogue

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// The Subtlety build, which takes Murder 2 and Thousand Cuts, against a humanoid, a beast and an undead.
func subtletySim() (*core.Simulation, *Rogue) {
	player := core.WithSpec(&proto.Player{
		Race:          proto.Race_RaceHuman,
		Class:         proto.Class_ClassRogue,
		Equipment:     daggersOnly(),
		Consumables:   &proto.ConsumesSpec{},
		TalentsString: SubtletyTalents,
		Rotation:      &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
	}, DefaultOptions)
	sim := core.NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 100},
		Raid:       core.SinglePlayerRaidProto(player, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter: &proto.Encounter{Duration: 180, Targets: []*proto.Target{
			{Name: "humanoid", Level: 63, MobType: proto.MobType_MobTypeHumanoid},
			{Name: "beast", Level: 63, MobType: proto.MobType_MobTypeBeast},
			{Name: "undead", Level: 63, MobType: proto.MobType_MobTypeUndead},
		}},
	}, simsignals.CreateSignals())
	sim.Reset()
	return sim, sim.Raid.Parties[0].Players[0].(RogueAgent).GetRogue()
}

func TestMurderHumanoidAndGiantOnly(t *testing.T) {
	_, rogue := subtletySim()
	humanoid := rogue.AttackTables[rogue.Env.Encounter.AllTargetUnits[0].UnitIndex]
	beast := rogue.AttackTables[rogue.Env.Encounter.AllTargetUnits[1].UnitIndex]
	undead := rogue.AttackTables[rogue.Env.Encounter.AllTargetUnits[2].UnitIndex]

	if !core.WithinToleranceFloat64(1.04, humanoid.DamageDealtMultiplier, 1e-9) || beast.DamageDealtMultiplier != 1 {
		t.Errorf("damage multipliers %v vs humanoid, %v vs beast; want 1.04 and 1", humanoid.DamageDealtMultiplier, beast.DamageDealtMultiplier)
	}
	if humanoid.CritMultiplier != undead.CritMultiplier {
		t.Errorf("crit multipliers %v vs humanoid, %v vs undead; Murder has no crit damage part", humanoid.CritMultiplier, undead.CritMultiplier)
	}
}

func TestThousandCutsDiscountPerStack(t *testing.T) {
	sim, rogue := subtletySim()
	base := rogue.Hemorrhage.Cost.GetCurrentCost()

	rogue.ThousandCutsAura.Activate(sim)
	for stacks := 1; stacks <= 6; stacks++ {
		rogue.ThousandCutsAura.AddStack(sim)
		want := base - 3*float64(min(stacks, 5))
		if got := rogue.Hemorrhage.Cost.GetCurrentCost(); got != want {
			t.Errorf("%d stacks: Hemorrhage costs %v, want %v", stacks, got, want)
		}
	}

	rogue.ThousandCutsAura.Deactivate(sim)
	if got := rogue.Hemorrhage.Cost.GetCurrentCost(); got != base {
		t.Errorf("after the buff drops Hemorrhage costs %v, want %v", got, base)
	}
}
