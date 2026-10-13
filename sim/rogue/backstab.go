package rogue

import (
	"github.com/wowsims/forever/sim/core"
)

var backstabRank = spellData.Backstab.Highest()

func (rogue *Rogue) registerBackstabSpell() {
	baseDamage := backstabRank.DamageEffect().Average(core.CharacterLevel)
	weaponDamage := backstabRank.EffectN(2).Average(core.CharacterLevel) / 100

	// Puncturing Wounds also hands a combo point back, on effect 2 of the talent.
	extraComboPointChance := spellData.PuncturingWounds.EffectAt(2).ValueAt(rogue.Talents.PuncturingWounds) / 100
	cpMetrics := rogue.NewComboPointMetrics(core.ActionID{SpellID: spellData.PuncturingWoundsTriggered.Highest().ID})

	rogue.Backstab = rogue.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: backstabRank.ID},
		SpellSchool:    backstabRank.SpellSchool(),
		DefenseType:    backstabRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | SpellFlagBuilder | core.SpellFlagAPL,
		ClassSpellMask: RogueSpellBackstab,
		MaxRange:       core.MaxMeleeRange,

		EnergyCost: core.EnergyCostOptions{
			Cost:   int32(backstabRank.Cost()),
			Refund: backstabRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: backstabRank.GCD(),
			},
			IgnoreHaste: true,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return !rogue.PseudoStats.InFrontOfTarget && rogue.HasDagger(core.MainHand)
		},

		DamageMultiplier:         weaponDamage,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,

		BonusCoefficient: backstabRank.DamageEffect().Coeff(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			rogue.BreakStealth(sim)

			damage := baseDamage + spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower(target))
			result := spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

			if result.Landed() {
				rogue.AddComboPoints(sim, 1, spell.ComboPointMetrics())
				if extraComboPointChance > 0 && sim.Proc(extraComboPointChance, "Puncturing Wounds") {
					rogue.AddComboPoints(sim, 1, cpMetrics)
				}
			} else {
				spell.IssueRefund(sim)
			}
		},
	})
}
