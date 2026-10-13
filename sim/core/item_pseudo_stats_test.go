package core

import (
	"math"
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// An item's and an enchant's percent PseudoStats reach the wearer as the back-end percent Stats, and
// the dodge they state lands on the same stat dodge rating converts into.
func TestItemAndEnchantPseudoStatsReachTheWearer(t *testing.T) {
	const testItemID, testEnchantID = 990101, 990102

	itemStats := make([]float64, stats.ProtoStatsLen)
	itemStats[stats.DodgeRating] = DodgeRatingPerDodgePercent

	itemPseudoStats := make([]float64, stats.PseudoStatsLen)
	itemPseudoStats[proto.PseudoStat_PseudoStatMeleeHitPercent] = 1
	itemPseudoStats[proto.PseudoStat_PseudoStatRangedHitPercent] = 1
	itemPseudoStats[proto.PseudoStat_PseudoStatDodgePercent] = 2
	itemPseudoStats[proto.PseudoStat_PseudoStatBlockPercent] = 3

	// Shaped like Biznicks 247x128 Accurascope (2523): ranged hit alone, and cut short the way a
	// database array may be.
	enchantPseudoStats := make([]float64, proto.PseudoStat_PseudoStatRangedHitPercent+1)
	enchantPseudoStats[proto.PseudoStat_PseudoStatRangedHitPercent] = 3

	addToDatabase(&proto.SimDatabase{
		Items: []*proto.SimItem{{
			Id:             testItemID,
			Name:           "Test Pseudo Stat Ranged",
			Type:           proto.ItemType_ItemTypeRanged,
			PseudoStats:    itemPseudoStats,
			ScalingOptions: map[int32]*proto.ScalingItemProperties{0: {Stats: map[int32]float64{int32(stats.DodgeRating): itemStats[stats.DodgeRating]}}},
		}},
		Enchants: []*proto.SimEnchant{{
			EffectId:    testEnchantID,
			Name:        "Test Pseudo Stat Scope",
			PseudoStats: enchantPseudoStats,
		}},
	})

	equipment := ProtoToEquipment(&proto.EquipmentSpec{Items: []*proto.ItemSpec{{Id: testItemID, Enchant: testEnchantID}}})
	equipStats := equipment.Stats(proto.Spec_SpecUnknown)

	for _, want := range []struct {
		stat  stats.Stat
		value float64
	}{
		{stats.PhysicalHitPercent, 1},
		{stats.RangedHitPercent, 3},
		{stats.DodgePercent, 2},
		{stats.BlockPercent, 3},
		{stats.DodgeRating, DodgeRatingPerDodgePercent},
	} {
		if got := equipStats[want.stat]; math.Abs(got-want.value) > 1e-9 {
			t.Errorf("%s from the item and its enchant: got %v, want %v", want.stat.StatName(), got, want.value)
		}
	}

	unit := &Unit{StatDependencyManager: stats.NewStatDependencyManager()}
	unit.addUniversalStatDependencies()
	unit.AddStatDependency(stats.Agility, stats.DodgeRating, 1/30.0*DodgeRatingPerDodgePercent)
	unit.FinalizeStatDeps()
	unit.stats = unit.ApplyStatDependencies(equipStats.Add(stats.Stats{stats.Agility: 30}))

	// 2% stated by the item, 1% from its rating and 1% from 30 Agility through the rating.
	if got := unit.GetDodgeFromRating(); math.Abs(got-0.04) > 1e-9 {
		t.Errorf("dodge: got %v, want 0.04", got)
	}
	if got := unit.GetBlockFromRating(); math.Abs(got-0.03) > 1e-9 {
		t.Errorf("block: got %v, want 0.03", got)
	}
}
