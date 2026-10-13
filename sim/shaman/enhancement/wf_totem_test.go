package enhancement

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Forever's Windfury Totem is a party aura; of the imbues only a main-hand Windfury Weapon disables it
// (tooltip 16362). Flametongue's main-hand clause names Flametongue Totem (8024/16342).
func TestOnlyWindfuryWeaponDisplacesWindfuryTotem(t *testing.T) {
	totemUp := func(mh proto.ShamanImbue) bool {
		player := &proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
			Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
				{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
				{Id: 17182}, // Sulfuras, Hand of Ragnaros
			}},
			Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{
				ClassOptions: &proto.ShamanOptions{ImbueMh: mh},
			}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}
		sim := core.NewSim(&proto.RaidSimRequest{
			SimOptions: &proto.SimOptions{RandomSeed: 1},
			Raid:       core.SinglePlayerRaidProto(player, &proto.PartyBuffs{WindfuryTotem: true}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
		}, simsignals.CreateSignals())
		sim.Reset()
		return sim.Raid.Parties[0].Players[0].GetCharacter().GetAura("Windfury Totem Trigger").IsActive()
	}
	for imbue, want := range map[proto.ShamanImbue]bool{
		proto.ShamanImbue_NoImbue:           true,
		proto.ShamanImbue_FlametongueWeapon: true,
		proto.ShamanImbue_FrostbrandWeapon:  true,
		proto.ShamanImbue_WindfuryWeapon:    false,
	} {
		if got := totemUp(imbue); got != want {
			t.Errorf("main hand %v: the party's Windfury Totem procs = %v, want %v", imbue, got, want)
		}
	}
}
