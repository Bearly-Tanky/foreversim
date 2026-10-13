package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerDisarm() {
	disarmRank := spellData.Disarm.Highest()

	actionID := core.ActionID{SpellID: disarmRank.ID}

	// TODO: core has no disarm effect, so the aura only tracks the debuff's uptime.
	auras := warrior.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return target.GetOrRegisterAura(core.Aura{
			Label:    "Disarm-" + warrior.Label,
			ActionID: actionID,
			Duration: disarmRank.Duration(),
		})
	})

	warrior.Disarm = warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: SpellMaskDisarm,
		MaxRange:       float64(disarmRank.MaxRange),

		RageCost: core.RageCostOptions{
			Cost:   int32(disarmRank.Cost()),
			Refund: disarmRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: disarmRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(disarmRank),
			},
		},

		ThreatMultiplier: 1,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(DefensiveStance)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcAndDealOutcome(sim, target, spell.OutcomeMeleeSpecialHit)

			if result.Landed() {
				auras.Get(target).Activate(sim)
			} else {
				spell.IssueRefund(sim)
			}
		},

		RelatedAuraArrays: auras.ToMap(),
	})
}
