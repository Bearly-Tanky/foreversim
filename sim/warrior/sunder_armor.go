package warrior

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

func (warrior *Warrior) registerSunderArmor() {
	// The client supplies Sunder Armor's flat threat per rank: 34/75/117/158/206 (build 70009).
	// The 2026-09-24 notes add "a small increase from attack power", but the E_THREAT effect
	// carries no AP coefficient in the client data, so only the flat value is modelled.
	sunderArmorRank := spellData.SunderArmor.Highest()

	actionId := core.ActionID{SpellID: sunderArmorRank.ID}

	// The generated aura is the client's rank 5 (11597, 450 armor a stack), the rank cast here.
	warrior.SunderArmorAuras = warrior.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return buffs.SunderArmorAura(target, true, 0)
	})

	warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionId,
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskSunderArmor,
		MaxRange:       core.MaxMeleeRange,

		RageCost: core.RageCostOptions{
			Cost:   int32(sunderArmorRank.Cost()),
			Refund: sunderArmorRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: sunderArmorRank.GCD(),
			},
			IgnoreHaste: true,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.CanApplySunderAura(target)
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		FlatThreatBonus:  sunderArmorRank.FindEffect(dbcenums.E_THREAT, 0, 0).Average(core.CharacterLevel),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMeleeSpecialHit)

			if result.Landed() {
				aura := warrior.SunderArmorAuras.Get(target)
				aura.Activate(sim)
				aura.AddStack(sim)
			} else {
				spell.IssueRefund(sim)
			}

			spell.DealOutcome(sim, result)
		},

		RelatedAuraArrays: warrior.SunderArmorAuras.ToMap(),
	})
}

func (warrior *Warrior) CanApplySunderAura(target *core.Unit) bool {
	return warrior.SunderArmorAuras.Get(target).IsActive() || !warrior.SunderArmorAuras.Get(target).ExclusiveEffects[0].Category.AnyActive()
}
