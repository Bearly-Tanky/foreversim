package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/stats"
)

var barkskinRank = spellData.Barkskin.Highest()

// Barkskin: 20% less Physical damage taken for 15 sec, no cost. The client states the reduction on
// A_MOD_DAMAGE_PERCENT_TAKEN with school mask 1 (Physical).
func (druid *Druid) registerBarkskin() {
	actionID := core.ActionID{SpellID: barkskinRank.ID}
	multiplier := 1 + barkskinRank.Effect(dbcenums.A_MOD_DAMAGE_PERCENT_TAKEN, 1).BaseValue()/100

	barkskinAura := druid.RegisterAura(core.Aura{
		Label:    "Barkskin",
		ActionID: actionID,
		Duration: barkskinRank.Duration(),
	}).AttachMultiplicativePseudoStatBuff(&druid.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexPhysical], multiplier)

	druid.Barkskin = druid.RegisterSpell(Any, core.SpellConfig{
		ActionID:    actionID,
		SpellSchool: barkskinRank.SpellSchool(),
		DefenseType: barkskinRank.DefenseTypeCore(),
		Flags:       core.SpellFlagAPL,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    druid.NewTimer(),
				Duration: max(barkskinRank.Cooldown(), barkskinRank.CategoryCooldown()),
			},
			DefaultCast: core.Cast{
				GCD: barkskinRank.GCD(),
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			barkskinAura.Activate(sim)
			if sim.CurrentTime > 0 {
				druid.AutoAttacks.StopMeleeUntil(sim, sim.CurrentTime)
			}
		},

		RelatedSelfBuff: barkskinAura,
	})

	druid.AddMajorCooldown(core.MajorCooldown{
		Spell: druid.Barkskin.Spell,
		Type:  core.CooldownTypeSurvival,
	})
}
