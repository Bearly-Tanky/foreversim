package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerShieldBash() {
	shieldBashRank := spellData.ShieldBash.Highest()

	actionID := core.ActionID{SpellID: shieldBashRank.ID}

	warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: SpellMaskShieldBash,
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ProcMask:       core.ProcMaskMeleeOHSpecial, // struck with the shield (upstream b6ce30c972)
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		MaxRange:       core.MaxMeleeRange,

		RageCost: core.RageCostOptions{
			Cost:   int32(shieldBashRank.Cost()),
			Refund: shieldBashRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: shieldBashRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(shieldBashRank),
			},
		},

		DamageMultiplier: 1,
		// TODO: Manual review needed -- the client states no threat coefficient; 1 until measured in game.
		ThreatMultiplier: 1,
		// TODO: In-game test required
		FlatThreatBonus: 0,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.PseudoStats.CanBlock && warrior.StanceMatches(DefensiveStance|BattleStance)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := shieldBashRank.DamageEffect().Average(core.CharacterLevel)
			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if !result.Landed() {
				spell.IssueRefund(sim)
			}
		},
	})
}
