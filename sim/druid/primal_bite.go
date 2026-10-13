package druid

import (
	"github.com/wowsims/forever/sim/core"
)

var primalBiteRank = spellData.PrimalBite.Highest()

// Primal Bite, Forever's Mangle (renamed in build 70009): 407995 and 1238069/1238070/1238073 on the
// Feral Combat line, all with ShapeshiftMask [144,0], which is Bear and Dire Bear only. Its effects
// are weapon damage and a flat bonus only (1238073): none of TBC's bleed debuff.
func (druid *Druid) registerPrimalBiteSpell() {
	if !druid.Talents.PrimalBite {
		return
	}

	druid.PrimalBite = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: primalBiteRank.ID},
		SpellSchool:    primalBiteRank.SpellSchool(),
		DefenseType:    primalBiteRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: DruidSpellPrimalBite,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		Rank:           primalBiteRank.RankNumber(),

		RageCost: core.RageCostOptions{
			Cost:   int32(primalBiteRank.Cost()),
			Refund: primalBiteRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: primalBiteRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    druid.NewTimer(),
				Duration: max(primalBiteRank.Cooldown(), primalBiteRank.CategoryCooldown()),
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1.5,
		MaxRange:         core.MaxMeleeRange,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			// Berserk lets Primal Bite strike up to 3 targets (417141 tooltip, "$s3 targets").
			numTargets := int32(1)
			if druid.BerserkAura.IsActive() {
				numTargets = min(3, sim.Environment.ActiveTargetCount())
			}

			for i := range numTargets {
				baseDamage := primalBiteRank.DamageEffect().Average(core.CharacterLevel) + spell.Unit.MHWeaponDamage(sim, spell.MeleeAttackPower(target))
				result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

				if i == 0 && !result.Landed() {
					spell.IssueRefund(sim)
				}
				target = sim.Environment.NextActiveTargetUnit(target)
			}

			// Berserk removes Primal Bite's cooldown (client 417141).
			if druid.BerserkAura.IsActive() {
				spell.CD.Reset()
			}
		},
	})
}
