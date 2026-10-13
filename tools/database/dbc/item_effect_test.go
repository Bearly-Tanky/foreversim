package dbc

import (
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
)

func TestAddAreaStatsKeepsOneEntryPerArea(t *testing.T) {
	ap := int32(proto.Stat_StatAttackPower)
	sp := int32(proto.Stat_StatSpellDamage)
	source := map[int32]float64{ap: 29}
	opts := &proto.ScalingItemProperties{Stats: map[int32]float64{ap: 15}}

	addAreaStats(opts, proto.AreaType_AreaTypeForestGrassland, source)
	addAreaStats(opts, proto.AreaType_AreaTypeForestGrassland, map[int32]float64{ap: 1, sp: 8})
	addAreaStats(opts, proto.AreaType_AreaTypeMountainous, map[int32]float64{sp: 6})

	if got := opts.Stats[ap]; got != 15 {
		t.Errorf("the unconditional stats changed: attack power = %v, want 15", got)
	}
	if len(opts.AreaStats) != 2 {
		t.Fatalf("got %d area entries, want one per area", len(opts.AreaStats))
	}
	forest, mountain := opts.AreaStats[0], opts.AreaStats[1]
	if forest.AreaType != proto.AreaType_AreaTypeForestGrassland || forest.Stats[ap] != 30 || forest.Stats[sp] != 8 {
		t.Errorf("forest entry = %v, want attack power 30 and spell damage 8", forest)
	}
	if mountain.AreaType != proto.AreaType_AreaTypeMountainous || mountain.Stats[sp] != 6 {
		t.Errorf("mountain entry = %v, want spell damage 6", mountain)
	}
	if source[ap] != 29 {
		t.Errorf("the caller's map was written through: %v", source)
	}
}
