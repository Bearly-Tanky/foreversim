package warlock

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/mage"
)

// A warlock that is not the raid's first player must still see its own Curse of the Elements:
// it used to recast it every GCD and do next to no damage (the DPS rankings raid).
func TestCurseOfElementsNotFirstInRaid(t *testing.T) {
	mage.RegisterMage()
	lock := &proto.Player{
		Name: "lock", Class: proto.Class_ClassWarlock, Race: proto.Race_RaceOrc, TalentsString: AfflictionTalents,
		Equipment: &proto.EquipmentSpec{},
		Spec: &proto.Player_Warlock{Warlock: &proto.Warlock{Options: &proto.Warlock_Options{ClassOptions: &proto.WarlockOptions{
			Summon: proto.WarlockOptions_Succubus, Armor: proto.WarlockOptions_DemonArmor, CurseOptions: proto.WarlockOptions_Elements}}}},
		Rotation: core.GetAplRotation("../../ui/specs/warlock/dps/apls", "affliction").Rotation,
	}
	dps := func(players ...*proto.Player) float64 {
		raid := &proto.Raid{Parties: []*proto.Party{{Players: players, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
		res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 20, RandomSeed: 1}})
		if res.Error != nil {
			t.Fatal(res.Error.Message)
		}
		return res.RaidMetrics.Parties[0].Players[len(players)-1].Dps.Avg
	}
	mageFirst := &proto.Player{Name: "mage", Class: proto.Class_ClassMage, Race: proto.Race_RaceGnome, Equipment: &proto.EquipmentSpec{},
		Spec: &proto.Player_Mage{Mage: &proto.Mage{Options: &proto.Mage_Options{ClassOptions: &proto.MageOptions{}}}}}
	alone, second := dps(lock), dps(mageFirst, lock)
	if second < alone*0.9 {
		t.Fatalf("warlock second in the raid does %.1f DPS, alone %.1f", second, alone)
	}
}
