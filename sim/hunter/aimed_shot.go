package hunter

import (
	"github.com/wowsims/forever/sim/core"
)

// Aimed Shot is no longer a talent. The beta client (1.60.1.69893) keeps every rank on the hunter
// with a 2 sec cast, down from 3, and a much smaller flat bonus (rank 6 600 -> 166); mana costs and
// the 6 sec cooldown are Classic's. Forever puts that cooldown on the Multi-Shot timer.
func (hunter *Hunter) registerAimedShotSpell(timer *core.Timer) {
	rank := spellData.AimedShot.Highest()
	flatBonus := rank.DamageEffect().Average(core.CharacterLevel)

	hunter.AimedShot = hunter.RegisterRangedSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ClassSpellMask: HunterSpellAimedShot,
		ProcMask:       core.ProcMaskRangedSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		MissileSpeed:   float64(rank.Speed),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(rank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				CastTime: rank.CastTime(),
			},
			CD: core.Cooldown{
				Timer:    timer,
				Duration: max(rank.Cooldown(), rank.CategoryCooldown()),
			},
		},

		BonusCoefficient: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := hunter.AutoAttacks.Ranged().CalculateNormalizedWeaponDamage(sim, spell.RangedAttackPower(target)) +
				flatBonus

			result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeRangedHitAndCrit)

			spell.WaitTravelTime(sim, func(sim *core.Simulation) {
				spell.DealDamage(sim, result)
			})
		},
	})
}
