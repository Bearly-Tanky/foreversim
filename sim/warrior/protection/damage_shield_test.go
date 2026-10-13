package protection

import (
	"math"
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Drillborer Disk and Razor Gauntlets hit the boss for their flat amount on every melee hit the
// tank takes, never crit and never partially resist. Defensive Stance takes its 10% off each.
func TestDamageShields(t *testing.T) {
	gear := axeAndShield()
	gear.Items[proto.ItemSlot_ItemSlotOffHand] = &proto.ItemSpec{Id: 17066} // Drillborer Disk
	gear.Items[proto.ItemSlot_ItemSlotHands] = &proto.ItemSpec{Id: 18326}   // Razor Gauntlets
	player := core.WithSpec(&proto.Player{
		Race:          proto.Race_RaceOrc,
		Class:         proto.Class_ClassWarrior,
		Equipment:     gear,
		TalentsString: DefaultProtectionTalents,
		Rotation:      core.GetAplRotation("../../../ui/specs/warrior/protection/apls", "protection").Rotation,
	}, DefaultOptions)
	raid := core.SinglePlayerRaidProto(player, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{})
	raid.Tanks = []*proto.UnitReference{{Type: proto.UnitReference_Player, Index: 0}}

	result := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0),
		SimOptions: &proto.SimOptions{Iterations: 5, RandomSeed: 101}})
	if result.Error != nil {
		t.Fatal(result.Error.Message)
	}

	want := map[int32]float64{15438: 3, 1302193: 7}
	for _, action := range result.RaidMetrics.Parties[0].Players[0].Actions {
		perHit, ok := want[action.Id.GetSpellId()]
		if !ok {
			continue
		}
		delete(want, action.Id.GetSpellId())
		target := action.Targets[0]
		if target.Hits == 0 || target.Crits != 0 || math.Abs(target.Damage/float64(target.Hits)-perHit*0.9) > 1e-9 {
			t.Errorf("spell %d: %v damage over %d hits, %d crits, want %v a hit", action.Id.GetSpellId(), target.Damage, target.Hits, target.Crits, perHit)
		}
	}
	if len(want) > 0 {
		t.Errorf("damage shields never fired: %v", want)
	}
}
