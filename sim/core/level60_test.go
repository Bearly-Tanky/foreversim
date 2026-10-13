package core

import (
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	"github.com/wowsims/forever/sim/core/stats"
)

func TestSpiritRegenIsLevel60(t *testing.T) {
	// 200 spirit: 12.5 + 200/4 = 62.5 mana a 2s tick for priests and mages, 15 + 200/5 = 55
	// for everyone else. Intellect does not enter into it.
	for class, wantPerTick := range map[proto.Class]float64{
		proto.Class_ClassMage:    62.5,
		proto.Class_ClassPriest:  62.5,
		proto.Class_ClassWarlock: 55,
		proto.Class_ClassDruid:   55,
	} {
		for _, intellect := range []float64{100, 400} {
			unit := Unit{}
			unit.spiritRegenBase, unit.spiritRegenPerSpirit = spiritRegenCoefficients(class)
			unit.stats[stats.Spirit] = 200
			unit.stats[stats.Intellect] = intellect
			if got := unit.SpiritManaRegenPerSecond() * 2; !WithinToleranceFloat64(wantPerTick, got, 1e-9) {
				t.Errorf("%s with %.0f intellect: %.2f mana a tick, want %.2f", class, intellect, got, wantPerTick)
			}
		}
	}
}

func TestBaseStatsAreLevel60(t *testing.T) {
	// Wowhead's Forever gear planner, level 60 rows.
	mage := BaseStats[BaseStatsKey{Race: proto.Race_RaceHuman, Class: proto.Class_ClassMage}]
	for stat, want := range map[stats.Stat]float64{stats.Health: 1370, stats.Strength: 30, stats.Agility: 35, stats.Stamina: 45, stats.Intellect: 125, stats.Spirit: 120, stats.Mana: 1213} {
		if mage[stat] != want {
			t.Errorf("human mage %s: %.0f, want %.0f", stat.StatName(), mage[stat], want)
		}
	}

	// Naked, unbuffed warrior: 1689 base health + 20 + (110 - 20) x 10 from stamina.
	sim := NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 100},
		Raid: &proto.Raid{Parties: []*proto.Party{{
			Players: []*proto.Player{{
				Race:      proto.Race_RaceHuman,
				Class:     proto.Class_ClassWarrior,
				Buffs:     &proto.IndividualBuffs{},
				Spec:      &proto.Player_DpsWarrior{},
				Equipment: &proto.EquipmentSpec{},
				Rotation:  &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			}},
			Buffs: &proto.PartyBuffs{},
		}}},
		Encounter: &proto.Encounter{Targets: []*proto.Target{{Level: 63}}, Duration: 180},
	}, simsignals.CreateSignals())
	sim.Reset()
	warrior := sim.Raid.Parties[0].Players[0].GetCharacter()
	if got := warrior.GetStat(stats.Health); got != 2609 {
		t.Errorf("naked warrior health %.0f, want 2609", got)
	}
}
