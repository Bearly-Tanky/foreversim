package enhancement

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	"github.com/wowsims/forever/sim/core/stats"
)

// Rockbiter Weapon rank 7 is a standing +653 melee attack power aura (client 16313), not a proc, and a
// second Rockbiter weapon does not add it twice. Spirit Weapons' -30% threat becomes +30% under it.
func TestRockbiterWeaponAddsAttackPower(t *testing.T) {
	character := func(mh, oh proto.ShamanImbue, talents string) *core.Character {
		player := &proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: talents,
			Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
				{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
				{Id: 17182}, // Sulfuras, Hand of Ragnaros
			}},
			Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{
				ClassOptions: &proto.ShamanOptions{ImbueMh: mh},
				ImbueOh:      oh,
			}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}
		sim := core.NewSim(&proto.RaidSimRequest{
			SimOptions: &proto.SimOptions{RandomSeed: 1},
			Raid:       core.SinglePlayerRaidProto(player, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
			Encounter:  core.MakeSingleTargetEncounter(0),
		}, simsignals.CreateSignals())
		sim.Reset()
		return sim.Raid.Parties[0].Players[0].GetCharacter()
	}
	const none, rockbiter = proto.ShamanImbue_NoImbue, proto.ShamanImbue_RockbiterWeapon
	base := character(none, none, "").GetStat(stats.AttackPower)
	for _, c := range []struct {
		name   string
		mh, oh proto.ShamanImbue
		want   float64
	}{
		{"main hand", rockbiter, none, 653},
		{"both hands", rockbiter, rockbiter, 653},
		{"Windfury Weapon", proto.ShamanImbue_WindfuryWeapon, none, 0},
	} {
		if got := character(c.mh, c.oh, "").GetStat(stats.AttackPower) - base; got < c.want-0.01 || got > c.want+0.01 {
			t.Errorf("%s adds %.2f attack power, want %v", c.name, got, c.want)
		}
	}

	// DefaultTalents has 3/3 Elemental Weapons (+20%) and Spirit Weapons (x0.7 threat, x1.86 under Rockbiter).
	plain, imbued := character(none, none, DefaultTalents), character(rockbiter, none, DefaultTalents)
	if got := imbued.GetStat(stats.AttackPower) - plain.GetStat(stats.AttackPower); got < 783.59 || got > 783.61 {
		t.Errorf("Rockbiter with Elemental Weapons adds %.2f attack power, want 783.6", got)
	}
	if got := imbued.PseudoStats.ThreatMultiplier / plain.PseudoStats.ThreatMultiplier; got < 1.859 || got > 1.861 {
		t.Errorf("Spirit Weapons under Rockbiter: threat x%.3f of without, want x1.86", got)
	}
}
