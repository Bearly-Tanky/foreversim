package warlock

import (
	"regexp"
	"strconv"
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// The Imp starts its next Firebolt about 0.43 sec after the last one lands: beta logs time 281
// Firebolts 2.435 sec apart (median; 2.0 sec cast, foreverlogs.gg 2687 and 2695).
func TestImpFireboltCadence(t *testing.T) {
	player := core.WithSpec(&proto.Player{
		Race: proto.Race_RaceOrc, Class: proto.Class_ClassWarlock,
		Equipment: &proto.EquipmentSpec{}, Consumables: &proto.ConsumesSpec{},
		Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
	}, &proto.Player_Warlock{Warlock: &proto.Warlock{Options: &proto.Warlock_Options{ClassOptions: &proto.WarlockOptions{
		Summon: proto.WarlockOptions_Imp,
	}}}})
	res := core.RunRaidSim(&proto.RaidSimRequest{
		Raid:       core.SinglePlayerRaidProto(player, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter:  core.MakeSingleTargetEncounter(0),
		SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: 1, Debug: true},
	})
	if res.Error != nil {
		t.Fatal(res.Error.Message)
	}

	// The first casts, before the Imp's mana runs dry.
	m := regexp.MustCompile(`\[(\d+\.\d+)\].*Casting \{SpellID: 11763\}`).FindAllStringSubmatch(res.Logs, 3)
	if len(m) < 3 {
		t.Fatalf("%d Firebolts logged, want at least 3", len(m))
	}
	first, _ := strconv.ParseFloat(m[1][1], 64)
	second, _ := strconv.ParseFloat(m[2][1], 64)
	if gap := second - first; gap < 2.39 || gap > 2.45 {
		t.Fatalf("Firebolts %.3f sec apart, want ~2.4", gap)
	}
}
