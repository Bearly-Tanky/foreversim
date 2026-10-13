package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Two hunters on one target each keep their own Serpent Sting up. They used to remove each
// other's, recast it every few seconds and lose Aimed Shots (-11% for Marksmanship in the rankings raid).
func TestSerpentStingTwoHunters(t *testing.T) {
	hunter := func(name, talents, apl string) *proto.Player {
		return &proto.Player{
			Name: name, Class: proto.Class_ClassHunter, Race: proto.Race_RaceOrc, TalentsString: talents,
			Equipment: WeaponsOnly, DistanceFromTarget: 30,
			Spec: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{ClassOptions: &proto.HunterOptions{
				Ammo: proto.HunterOptions_Doomshot, QuiverBonus: proto.HunterOptions_Speed15, PetType: proto.HunterOptions_Cat,
				PetAttackSpeed: proto.HunterOptions_OneTwo, PetUptime: 1}}}},
			Rotation: core.GetAplRotation("../../ui/specs/hunter/dps/apls", apl).Rotation,
		}
	}
	dps := func(players ...*proto.Player) float64 {
		raid := &proto.Raid{Parties: []*proto.Party{{Players: players, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
		res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 50, RandomSeed: 1}})
		if res.Error != nil {
			t.Fatal(res.Error.Message)
		}
		return res.RaidMetrics.Parties[0].Players[0].Dps.Avg
	}
	alone := dps(hunter("mm", MarksmanshipTalents, "mm"))
	paired := dps(hunter("mm", MarksmanshipTalents, "mm"), hunter("sv", SurvivalTalents, "sv"))
	if paired < alone*0.97 {
		t.Fatalf("Marksmanship beside a second hunter does %.1f DPS, alone %.1f", paired, alone)
	}
}
