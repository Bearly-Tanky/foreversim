package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerSlam() {
	slamRank := spellData.Slam.Highest()
	slamBaseDamage := slamRank.DamageEffect().Average(core.CharacterLevel)

	actionID := core.ActionID{SpellID: slamRank.ID}

	warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskSlam,
		MaxRange:       core.MaxMeleeRange,

		RageCost: core.RageCostOptions{
			Cost:   int32(slamRank.Cost()),
			Refund: slamRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      slamRank.GCD(),
				CastTime: slamRank.CastTime(),
			},
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(slamRank),
			},
			IgnoreHaste: true,
			ModifyCast: func(sim *core.Simulation, spell *core.Spell, cast *core.Cast) {
				if cast.CastTime > 0 && warrior.Talents.ImprovedSlam == 0 {
					warrior.AutoAttacks.StopMeleeUntil(sim, sim.CurrentTime+cast.CastTime)
				}
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		// Not in the client table; our Classic value until measured in game.
		FlatThreatBonus: 140,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := slamBaseDamage + spell.Unit.MHWeaponDamage(sim, spell.MeleeAttackPower(target))
			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

			if !result.Landed() {
				spell.IssueRefund(sim)
			}
		},
	})
}
