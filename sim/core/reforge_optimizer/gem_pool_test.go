package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/forever/sim/core/stats"
)

func TestGemStatIsAllowed(t *testing.T) {
	healer := map[stats.Stat]bool{stats.HealingPower: true, stats.Intellect: true}
	caster := map[stats.Stat]bool{stats.SpellDamage: true, stats.Intellect: true}
	melee := map[stats.Stat]bool{stats.Strength: true}

	cases := []struct {
		name      string
		stat      stats.Stat
		statCount int
		epStats   map[stats.Stat]bool
		isTank    bool
		want      bool
	}{
		{"listed stat", stats.Intellect, 1, healer, false, true},
		{"unlisted stat", stats.Strength, 1, healer, false, false},
		{"stamina alone on a dps", stats.Stamina, 1, melee, false, false},
		{"stamina beside another stat", stats.Stamina, 2, melee, false, true},
		{"stamina alone on a tank", stats.Stamina, 1, melee, true, true},
		{"healing power on a spell damage spec", stats.HealingPower, 2, caster, false, true},
		{"spell damage on a healing power spec", stats.SpellDamage, 2, healer, false, true},
		{"spell damage on a melee", stats.SpellDamage, 2, melee, false, false},
	}
	for _, c := range cases {
		if got := gemStatIsAllowed(c.stat, c.statCount, c.epStats, c.isTank); got != c.want {
			t.Errorf("%s: gemStatIsAllowed = %v, want %v", c.name, got, c.want)
		}
	}
}
