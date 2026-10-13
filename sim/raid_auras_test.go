package sim

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// A full raid of casters on one boss. Every caster's per-target dots register an aura on the
// boss for every rank the caster can cast, and once every rank of the main nukes was registered
// (low-rank rotations) a 25-caster raid passed the 200 aura guard at initialisation.
func TestFullCasterRaidInitialises(t *testing.T) {
	casters := []*proto.Player{
		{Class: proto.Class_ClassWarlock, Race: proto.Race_RaceOrc, Spec: &proto.Player_Warlock{Warlock: &proto.Warlock{Options: &proto.Warlock_Options{ClassOptions: &proto.WarlockOptions{}}}}},
		{Class: proto.Class_ClassMage, Race: proto.Race_RaceGnome, Spec: &proto.Player_Mage{Mage: &proto.Mage{Options: &proto.Mage_Options{ClassOptions: &proto.MageOptions{}}}}},
		{Class: proto.Class_ClassPriest, Race: proto.Race_RaceUndead, Spec: &proto.Player_DpsPriest{DpsPriest: &proto.DpsPriest{Options: &proto.DpsPriest_Options{ClassOptions: &proto.PriestOptions{}}}}},
		{Class: proto.Class_ClassDruid, Race: proto.Race_RaceNightElf, Spec: &proto.Player_BalanceDruid{BalanceDruid: &proto.BalanceDruid{Options: &proto.BalanceDruid_Options{ClassOptions: &proto.DruidOptions{}}}}},
		{Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, Spec: &proto.Player_ElementalShaman{ElementalShaman: &proto.ElementalShaman{Options: &proto.ElementalShaman_Options{ClassOptions: &proto.ShamanOptions{}}}}},
	}
	raid := &proto.Raid{}
	for p := 0; p < 5; p++ {
		party := &proto.Party{}
		for _, c := range casters {
			player := *c
			player.Equipment = &proto.EquipmentSpec{}
			party.Players = append(party.Players, &player)
		}
		raid.Parties = append(raid.Parties, party)
	}
	result := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: STEncounter, SimOptions: SimOptions})
	if result.Error != nil {
		t.Fatalf("%.300s", result.Error.Message)
	}
}
