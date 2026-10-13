package database

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
)

func TestMergeReplacesPseudoStats(t *testing.T) {
	pseudoStats := func(dodge float64) []float64 {
		values := make([]float64, len(proto.PseudoStat_name))
		values[proto.PseudoStat_PseudoStatDodgePercent] = dodge
		return values
	}

	db := NewWowDatabase()
	db.MergeItem(&proto.UIItem{Id: 1, PseudoStats: pseudoStats(1)})
	db.MergeItem(&proto.UIItem{Id: 1, PseudoStats: pseudoStats(2)})
	if got := db.Items[1].PseudoStats; !slices.Equal(got, pseudoStats(2)) {
		t.Errorf("item pseudo stats after a second merge = %v, want the second's", got)
	}

	db.MergeEnchant(&proto.UIEnchant{EffectId: 1, PseudoStats: pseudoStats(1)})
	db.MergeEnchant(&proto.UIEnchant{EffectId: 1, PseudoStats: pseudoStats(2)})
	if got := db.Enchants[EnchantToDBKey(&proto.UIEnchant{EffectId: 1})].PseudoStats; !slices.Equal(got, pseudoStats(2)) {
		t.Errorf("enchant pseudo stats after a second merge = %v, want the second's", got)
	}
}
