package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
)

var thornsRank = spellData.Thorns.Highest()

// Self-cast Thorns: the druid's own copy of the generated shield. The raid buff registers the
// external copy, and the two bid in ThornsCategory, which holds one of them at a time. Forever
// has no Brambles node, so there are no talent points to pass.
func (druid *Druid) registerThornsSpell() {
	thornsAura := buffs.ThornsAura(&druid.Unit, true, 0)

	druid.RegisterSpell(Humanoid|Moonkin|Tree, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: thornsRank.ID},
		SpellSchool:    thornsRank.SpellSchool(),
		DefenseType:    thornsRank.DefenseTypeCore(),
		Flags:          core.SpellFlagAPL | core.SpellFlagHelpful,
		ClassSpellMask: DruidSpellThorns,
		ProcMask:       core.ProcMaskEmpty,
		MaxRange:       float64(thornsRank.MaxRange),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(thornsRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: thornsRank.GCD(),
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			thornsAura.Activate(sim)
		},

		RelatedSelfBuff: thornsAura,
	})
}
