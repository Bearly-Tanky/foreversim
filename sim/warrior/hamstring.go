package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerHamstring() {
	// TODO: Ingame research needed if this adds flat threat
	hamstringRank := spellData.Hamstring.Highest()
	hamstringBaseDamage := hamstringRank.DamageEffect().Average(core.CharacterLevel)

	warrior.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: hamstringRank.ID},
		SpellSchool:    hamstringRank.SpellSchool(),
		DefenseType:    hamstringRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskHamstring,
		MaxRange:       core.MaxMeleeRange,

		RageCost: core.RageCostOptions{
			Cost:   int32(hamstringRank.Cost()),
			Refund: hamstringRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: hamstringRank.GCD(),
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 1,
		// Not in the client table; our Classic value until measured in game.
		ThreatMultiplier: 1.25,
		FlatThreatBonus:  1.25 * 2 * 54,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BattleStance | BerserkerStance)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcAndDealDamage(sim, target, hamstringBaseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if !result.Landed() {
				spell.IssueRefund(sim)
			}
		},
	})
}
