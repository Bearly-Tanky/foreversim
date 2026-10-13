package druid

import (
	"github.com/wowsims/forever/sim/core"
)

var swipeRank = spellData.Swipe.Highest()

func (druid *Druid) registerSwipeBearSpell() {
	druid.Swipe = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: swipeRank.ID},
		SpellSchool:    swipeRank.SpellSchool(),
		DefenseType:    swipeRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: DruidSpellSwipe,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,

		RageCost: core.RageCostOptions{
			Cost:   int32(swipeRank.Cost()),
			Refund: swipeRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: swipeRank.GCD(),
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 1,
		// Season of Discovery's "Modifies Threat +101%", which the client does not carry.
		ThreatMultiplier: 2,
		MaxRange:         core.MaxMeleeRange,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			numHits := min(3, len(druid.Env.Encounter.AllTargetUnits))
			for i := 0; i < numHits; i++ {
				aoeTarget := druid.Env.Encounter.AllTargetUnits[i]
				spell.CalcAndDealDamage(sim, aoeTarget, swipeRank.DamageEffect().Average(core.CharacterLevel), spell.OutcomeMeleeWeaponSpecialHitAndCrit)
			}
		},
	})
}
