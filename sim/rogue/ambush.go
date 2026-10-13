package rogue

import (
	"github.com/wowsims/forever/sim/core"
)

var ambushRank = spellData.Ambush.Highest()

func (rogue *Rogue) registerAmbushSpell() {
	baseDamage := ambushRank.DamageEffect().Average(core.CharacterLevel)
	// The client states the weapon share as a percentage on effect 2 (250, where TBC had 275),
	// counting from 1 by position. Effects 1 and 2 share an aura and misc pair, so it is named
	// by position.
	weaponDamage := ambushRank.EffectN(2).Average(core.CharacterLevel) / 100

	rogue.Ambush = rogue.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: ambushRank.ID},
		SpellSchool:    ambushRank.SpellSchool(),
		DefenseType:    ambushRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | SpellFlagBuilder | core.SpellFlagAPL,
		ClassSpellMask: RogueSpellAmbush,
		MaxRange:       core.MaxMeleeRange,

		EnergyCost: core.EnergyCostOptions{
			Cost:   int32(ambushRank.Cost()),
			Refund: ambushRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: ambushRank.GCD(),
			},
			IgnoreHaste: true,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			// "Must be stealthed and behind the target" (11269 carries Backstab's behind-target attribute).
			if !rogue.HasDagger(core.MainHand) || rogue.PseudoStats.InFrontOfTarget {
				return false
			}
			// Cutthroat lets the Stealth requirement slide for a short while after a Backstab.
			return rogue.IsStealthed() || (rogue.CutthroatAura != nil && rogue.CutthroatAura.IsActive())
		},

		DamageMultiplier:         weaponDamage,
		DamageMultiplierAdditive: 1,
		ThreatMultiplier:         1,

		BonusCoefficient: ambushRank.DamageEffect().Coeff(),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			rogue.BreakStealth(sim)
			if rogue.CutthroatAura != nil {
				rogue.CutthroatAura.Deactivate(sim)
			}

			damage := baseDamage + spell.Unit.MHNormalizedWeaponDamage(sim, spell.MeleeAttackPower(target))
			result := spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMeleeSpecialNoBlockDodgeParry)

			if result.Landed() {
				rogue.AddComboPoints(sim, 1, spell.ComboPointMetrics())
			} else {
				spell.IssueRefund(sim)
			}
		},
	})
}
