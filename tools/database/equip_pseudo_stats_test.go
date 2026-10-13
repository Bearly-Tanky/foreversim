package database

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
	"github.com/wowsims/forever/tools/database/dbc"
)

func TestEquipSpellPseudoStats(t *testing.T) {
	withDBCInputs(t)
	dbc.GetDBC()

	type pseudo = proto.PseudoStat
	for _, tc := range []struct {
		name    string
		spellID int
		want    map[pseudo]float64
	}{
		{"22780 Biznicks 247x128 Accurascope, hit on bows, guns and crossbows", 22780,
			map[pseudo]float64{proto.PseudoStat_PseudoStatRangedHitPercent: 3}},
		{"24154 Falcon's Call, hit on any weapon", 24154,
			map[pseudo]float64{proto.PseudoStat_PseudoStatMeleeHitPercent: 1, proto.PseudoStat_PseudoStatRangedHitPercent: 1}},
		{"1220596 Enchant Shield - Critical Strike, weapon and spell crit", 1220596,
			map[pseudo]float64{
				proto.PseudoStat_PseudoStatMeleeCritPercent:  1,
				proto.PseudoStat_PseudoStatRangedCritPercent: 1,
				proto.PseudoStat_PseudoStatSpellCritPercent:  1,
			}},
		{"1310308 SAF-T Ultra Precision Scope, all crit on bows, guns and crossbows", 1310308,
			map[pseudo]float64{proto.PseudoStat_PseudoStatRangedCritPercent: 2}},
		{"24156 Presence of Sight, spell hit", 24156,
			map[pseudo]float64{proto.PseudoStat_PseudoStatSpellHitPercent: 1}},
		{"25071 Enchant Cloak - Dodge", 25071,
			map[pseudo]float64{proto.PseudoStat_PseudoStatDodgePercent: 1}},
		{"13690 Enchant Shield - Lesser Block", 13690,
			map[pseudo]float64{proto.PseudoStat_PseudoStatBlockPercent: 2}},
		{"28142 Power of the Guardian, a party aura", 28142, map[pseudo]float64{}},
		{"7217 Weapon Counterweight, melee speed", 7217,
			map[pseudo]float64{proto.PseudoStat_PseudoStatMeleeHastePercent: 3}},
		{"13928 Enchant Gloves - Minor Haste, attack and cast speed", 13928,
			map[pseudo]float64{
				proto.PseudoStat_PseudoStatMeleeHastePercent:  1,
				proto.PseudoStat_PseudoStatRangedHastePercent: 1,
				proto.PseudoStat_PseudoStatSpellHastePercent:  1,
			}},
		{"22841 Arcanum of Rapidity, melee and ranged speed", 22841,
			map[pseudo]float64{
				proto.PseudoStat_PseudoStatMeleeHastePercent:  1,
				proto.PseudoStat_PseudoStatRangedHastePercent: 1,
			}},
		{"1293881 Pendulum of Doom, a zero melee speed aura", 1293881, map[pseudo]float64{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := make([]float64, stats.PseudoStatsLen)
			_, added := dbc.AddEquipSpellStats(&stats.Stats{}, got, tc.spellID)

			want := make([]float64, stats.PseudoStatsLen)
			for pseudoStat, value := range tc.want {
				want[pseudoStat] = value
			}
			if !slices.Equal(got, want) {
				t.Errorf("pseudo stats %v, want %v", got, want)
			}
			if added != (len(tc.want) > 0) {
				t.Errorf("reported added=%v with %d pseudo stats expected", added, len(tc.want))
			}
		})
	}
}

// The enchant carries what its equip spell states: 2523 applies 22780.
func TestEnchantCarriesEquipSpellPseudoStats(t *testing.T) {
	withDBCInputs(t)

	for _, enchant := range dbc.GetDBC().Enchants {
		if enchant.EffectId != 2523 {
			continue
		}
		pseudoStats := enchant.ToProto().PseudoStats
		if len(pseudoStats) <= int(proto.PseudoStat_PseudoStatRangedHitPercent) ||
			pseudoStats[proto.PseudoStat_PseudoStatRangedHitPercent] != 3 ||
			pseudoStats[proto.PseudoStat_PseudoStatMeleeHitPercent] != 0 {
			t.Errorf("enchant 2523 pseudo stats %v, want ranged hit 3 alone", pseudoStats)
		}
		return
	}
	t.Fatal("enchant 2523 is not in the enchant inputs")
}
