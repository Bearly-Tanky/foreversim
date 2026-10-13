package balance

import (
	"math"
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	"github.com/wowsims/forever/sim/druid"
)

// Nature's Reach (16819) adds 10/20% to the range of the Balance spells its client class mask reaches;
// only its hit half was simulated, so the bonus range was missing.
func TestNaturesReachExtendsRange(t *testing.T) {
	for _, c := range []struct {
		talents string
		want    float64
	}{{"", 30}, {"000001", 33}, {"000002", 36}} {
		sim := core.NewSim(&proto.RaidSimRequest{
			SimOptions: &proto.SimOptions{RandomSeed: 1},
			Raid: &proto.Raid{Parties: []*proto.Party{{Buffs: &proto.PartyBuffs{}, Players: []*proto.Player{{
				Name: "Owl", Class: proto.Class_ClassDruid, Race: proto.Race_RaceNightElf, TalentsString: c.talents,
				Equipment: &proto.EquipmentSpec{}, Buffs: &proto.IndividualBuffs{},
				Spec: &proto.Player_BalanceDruid{BalanceDruid: &proto.BalanceDruid{
					Options: &proto.BalanceDruid_Options{ClassOptions: &proto.DruidOptions{}},
				}},
				Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
			}}}}},
			Encounter: core.MakeSingleTargetEncounter(0),
		}, simsignals.CreateSignals())
		sim.Reset()

		owl := sim.Raid.Parties[0].Players[0].(druid.DruidAgent).GetDruid()
		for name, spell := range map[string]*druid.DruidSpell{
			"Wrath": owl.Wrath, "Starfire": owl.Starfire[len(owl.Starfire)-1], "Moonfire": owl.Moonfire,
			"Hurricane": owl.Hurricane, "Faerie Fire": owl.FaerieFire,
		} {
			if got := spell.MaxRange; math.Abs(got-c.want) > 1e-9 {
				t.Errorf("%q: %s reaches %.1f yd, want %.1f", c.talents, name, got, c.want)
			}
		}
	}
}
