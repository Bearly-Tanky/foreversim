package dps

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
	googleProto "google.golang.org/protobuf/proto"
)

// The Classic consumable slots take their stats from the client items, and Dragonbreath Chili procs.
func TestClassicConsumables(t *testing.T) {
	player := core.WithSpec(&proto.Player{
		Race:      proto.Race_RaceOrc,
		Class:     proto.Class_ClassWarrior,
		Equipment: weaponsOnly(15240, 15238),
		Consumables: &proto.ConsumesSpec{
			StrengthBuffId:    12451, // Juju Power +30 Str
			AttackPowerBuffId: 12460, // Juju Might +40 AP
			ZanzaId:           8410,  // R.O.I.D.S. +25 Str
			AlcoholId:         21151, // Rumsey Rum Black Label +15 Sta
			DefenseElixirId:   13445, // +450 armor
			FoodId:            20452, // Smoked Desert Dumplings, Forever's +20 Str well fed
			DragonbreathChili: true,
		},
		TalentsString: DpsTalents,
		Rotation:      core.GetAplRotation("../../../ui/specs/warrior/dps/apls", "dps_reck").Rotation,
	}, DefaultOptions)
	raid := core.SinglePlayerRaidProto(player, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{})
	encounter := core.MakeSingleTargetEncounter(0)

	consumesStats := func(raid *proto.Raid) stats.Stats {
		return stats.FromProtoArray(core.ComputeStats(&proto.ComputeStatsRequest{Raid: raid, Encounter: encounter}).
			RaidStats.Parties[0].Players[0].ConsumesStats.Stats)
	}
	bare := googleProto.Clone(raid).(*proto.Raid)
	bare.Parties[0].Players[0].Consumables = &proto.ConsumesSpec{}
	with, without := consumesStats(raid), consumesStats(bare)
	for stat, want := range map[stats.Stat]float64{stats.Strength: 75, stats.Stamina: 15, stats.Armor: 450} {
		if got := with[stat] - without[stat]; got != want {
			t.Errorf("consumes add %v %v, want %v", got, stat, want)
		}
	}
	if with[stats.AttackPower] <= without[stats.AttackPower]+40 {
		t.Errorf("Juju Might and the strength add only %v AP", with[stats.AttackPower]-without[stats.AttackPower])
	}

	result := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: encounter,
		SimOptions: &proto.SimOptions{Iterations: 20, RandomSeed: 101}})
	if result.Error != nil {
		t.Fatal(result.Error.Message)
	}
	for _, action := range result.RaidMetrics.Parties[0].Players[0].Actions {
		if action.Id.GetSpellId() == 15851 && action.Targets[0].Damage > 0 {
			return
		}
	}
	t.Error("Dragonbreath Chili never dealt damage")
}
