package core

import (
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	"github.com/wowsims/forever/sim/core/stats"
)

func TestGearHitAndCritApplyToEveryAttack(t *testing.T) {
	// Neltharion's Tear states only the generic hit rating, which the database reads as melee.
	equipment := Equipment{}
	equipment[proto.ItemSlot_ItemSlotTrinket1] = Item{ID: 1, Stats: stats.Stats{stats.MeleeHitRating: 20}}
	equipment[proto.ItemSlot_ItemSlotTrinket2] = Item{ID: 2, Stats: stats.Stats{stats.SpellCritRating: 14, stats.MeleeCritRating: 28}}

	got := equipment.Stats(proto.Spec_SpecUnknown)
	want := map[stats.Stat]float64{
		stats.MeleeHitRating:  20,
		stats.SpellHitRating:  20,
		stats.MeleeCritRating: 42,
		stats.SpellCritRating: 42,
	}
	for stat, value := range want {
		if !WithinToleranceFloat64(value, got[stat], 1e-9) {
			t.Errorf("%s: got %.2f, want %.2f", stat.StatName(), got[stat], value)
		}
	}
}

func professionSim(professions ...proto.Profession) *Simulation {
	player := &proto.Player{
		Name:      "Warrior",
		Class:     proto.Class_ClassWarrior,
		Buffs:     &proto.IndividualBuffs{},
		Spec:      &proto.Player_DpsWarrior{},
		Equipment: &proto.EquipmentSpec{},
		Rotation:  &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
	}
	if len(professions) > 0 {
		player.Profession1 = professions[0]
	}
	if len(professions) > 1 {
		player.Profession2 = professions[1]
	}
	sim := NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 100},
		Raid: &proto.Raid{Parties: []*proto.Party{{
			Players: []*proto.Player{player},
			Buffs:   &proto.PartyBuffs{},
		}}},
		Encounter: &proto.Encounter{
			Targets: []*proto.Target{
				{Name: "beast", Level: 63, MobType: proto.MobType_MobTypeBeast},
				{Name: "dragon", Level: 63, MobType: proto.MobType_MobTypeDragonkin},
				{Name: "humanoid", Level: 63, MobType: proto.MobType_MobTypeHumanoid},
			},
			Duration: 180,
		},
	}, simsignals.CreateSignals())
	sim.Reset()
	return sim
}

func TestForeverProfessionPassives(t *testing.T) {
	plain := professionSim().Raid.Parties[0].Players[0].GetCharacter()
	gatherer := professionSim(proto.Profession_Skinning, proto.Profession_Mining).Raid.Parties[0].Players[0].GetCharacter()

	for i, want := range []float64{1.05, 1.05, 1} {
		if got := gatherer.AttackTables[gatherer.Env.Encounter.AllTargetUnits[i].UnitIndex].DamageDealtMultiplier; got != want {
			t.Errorf("Skinning vs target %d: damage multiplier %.3f, want %.3f", i, got, want)
		}
	}

	if got, want := gatherer.GetStat(stats.Health), plain.GetStat(stats.Health)*1.05; !WithinToleranceFloat64(want, got, 1e-6) {
		t.Errorf("Mining: health %.1f, want %.1f", got, want)
	}
}
