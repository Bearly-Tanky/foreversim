package hunter

import (
	"github.com/wowsims/forever/sim/core"
)

// Sniper Shot from the beta client (1310687, 1310785, 1310786): a 4 sec cast on a 15 sec cooldown
// for 365 mana at every rank, adding 160/225/295 to a normalized weapon shot.
func (hunter *Hunter) registerSniperShotSpell() {
	if !hunter.Talents.SniperShot {
		return
	}

	rank := spellData.SniperShot.Highest()
	flatBonus := rank.DamageEffect().Average(core.CharacterLevel)

	hunter.SniperShot = hunter.RegisterRangedSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ClassSpellMask: HunterSpellSniperShot,
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
				Timer:    hunter.NewTimer(),
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
