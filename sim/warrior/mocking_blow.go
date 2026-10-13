package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerMockingBlow() {
	mockingBlowRank := spellData.MockingBlow.Highest()
	mockingBlowBaseDamage := mockingBlowRank.DamageEffect().Average(core.CharacterLevel)

	warrior.MockingBlow = warrior.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: mockingBlowRank.ID},
		SpellSchool:    mockingBlowRank.SpellSchool(),
		DefenseType:    mockingBlowRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskMockingBlow,
		MaxRange:       float64(mockingBlowRank.MaxRange),

		RageCost: core.RageCostOptions{
			Cost:   int32(mockingBlowRank.Cost()),
			Refund: mockingBlowRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: mockingBlowRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(mockingBlowRank),
			},
		},

		DamageMultiplier: 1,
		// TODO: Test in-game
		ThreatMultiplier: 1,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BattleStance)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcAndDealDamage(sim, target, mockingBlowBaseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if !result.Landed() {
				spell.IssueRefund(sim)
			}
		},
	})
}
