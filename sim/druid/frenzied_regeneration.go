package druid

import (
	"time"

	"github.com/wowsims/forever/sim/core"
)

var frenziedRegenerationRank = spellData.FrenziedRegeneration.Highest()

// Converts up to 10 Rage a second into health for 10 sec. Forever keeps one rank and heals 1% of
// maximum health a point of Rage instead of Classic's flat 10 / 15 / 20; the client's periodic
// effect states only the trigger, so the share is the sim's client-read value.
func (druid *Druid) registerFrenziedRegenerationSpell() {
	actionID := core.ActionID{SpellID: frenziedRegenerationRank.ID}
	rageMetrics := druid.NewRageMetrics(actionID)
	healthMetrics := druid.NewHealthMetrics(actionID)

	numTicks := int(frenziedRegenerationRank.Duration() / time.Second)

	druid.FrenziedRegenerationAura = druid.RegisterAura(core.Aura{
		Label:    "Frenzied Regeneration",
		ActionID: actionID,
		Duration: frenziedRegenerationRank.Duration(),
	})

	druid.FrenziedRegeneration = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    frenziedRegenerationRank.SpellSchool(),
		ProcMask:       core.ProcMaskEmpty,
		ClassSpellMask: DruidSpellFrenziedRegeneration,
		Flags:          core.SpellFlagAPL | core.SpellFlagHelpful,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: frenziedRegenerationRank.GCD(),
			},
			CD: core.Cooldown{
				Timer:    druid.NewTimer(),
				Duration: max(frenziedRegenerationRank.Cooldown(), frenziedRegenerationRank.CategoryCooldown()),
			},
			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			druid.FrenziedRegenerationAura.Activate(sim)

			core.StartPeriodicAction(sim, core.PeriodicActionOptions{
				Period:   time.Second,
				NumTicks: numTicks,
				Priority: core.ActionPriorityDOT,
				OnAction: func(sim *core.Simulation) {
					if !druid.FrenziedRegenerationAura.IsActive() {
						return
					}
					rage := min(druid.CurrentRage(), 10)
					if rage > 0 {
						druid.SpendRage(sim, rage, rageMetrics)
						druid.GainHealth(sim, rage*0.01*druid.MaxHealth()*druid.PseudoStats.HealingTakenMultiplier, healthMetrics)
					}
				},
			})
		},

		RelatedSelfBuff: druid.FrenziedRegenerationAura,
	})

	druid.AddMajorCooldown(core.MajorCooldown{
		Spell: druid.FrenziedRegeneration.Spell,
		Type:  core.CooldownTypeSurvival,
	})
}
