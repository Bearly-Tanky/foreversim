package rogue

import (
	"github.com/wowsims/forever/sim/core"
)

var sinisterStrikeRank = spellData.SinisterStrike.Highest()

func (rogue *Rogue) registerSinisterStrikeSpell() {
	baseDamage := sinisterStrikeRank.DamageEffect().Average(core.CharacterLevel)

	rogue.SinisterStrike = rogue.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: sinisterStrikeRank.ID},
		SpellSchool:    sinisterStrikeRank.SpellSchool(),
		DefenseType:    sinisterStrikeRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | SpellFlagBuilder | core.SpellFlagAPL,
		ClassSpellMask: RogueSpellSinisterStrike,
		MaxRange:       core.MaxMeleeRange,

		EnergyCost: core.EnergyCostOptions{
			Cost:   int32(sinisterStrikeRank.Cost()),
			Refund: sinisterStrikeRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: sinisterStrikeRank.GCD(),
			},
			IgnoreHaste: true,
		},

		DamageMultiplier:         1,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,

		BonusCoefficient: sinisterStrikeRank.DamageEffect().Coeff(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			rogue.BreakStealth(sim)

			damage := baseDamage + spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower(target))
			result := spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

			if result.Landed() {
				rogue.AddComboPoints(sim, 1, spell.ComboPointMetrics())
			} else {
				spell.IssueRefund(sim)
			}
		},
	})
}
