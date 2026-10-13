package rogue

import (
	"math"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
	"github.com/wowsims/forever/sim/core/stats"
)

var exposeArmorRank = spellData.ExposeArmor.Highest()

// Client 11198: 450 armor a combo point. The generated raid debuff is priced at five of them.
var exposeArmorPerComboPoint = math.Abs(buffs.ExposeArmorValue(0)) / 5

// Forever repurposes Improved Expose Armor: the client states an energy cost reduction
// (SPELLMOD_COST -5/-10) and a dummy of 1/2, which our Forever sim reads as combo points handed
// back on a full five point spend. The armor the debuff removes no longer scales with the talent.
func (rogue *Rogue) registerExposeArmorSpell() {
	rogue.ExposeArmorAuras = rogue.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return rogue.exposeArmorAura(target)
	})

	cpMetrics := rogue.NewComboPointMetrics(core.ActionID{SpellID: 14169})
	pointsBack := spellData.ImprovedExposeArmor.EffectAt(2).ValueAt(rogue.Talents.ImprovedExposeArmor)

	rogue.ExposeArmor = rogue.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: exposeArmorRank.ID},
		SpellSchool:    exposeArmorRank.SpellSchool(),
		DefenseType:    exposeArmorRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | SpellFlagFinisher | core.SpellFlagAPL,
		MetricSplits:   6,
		ClassSpellMask: RogueSpellExposeArmor,
		MaxRange:       core.MaxMeleeRange,

		EnergyCost: core.EnergyCostOptions{
			Cost:          int32(exposeArmorRank.Cost()),
			Refund:        exposeArmorRank.MissRefund(),
			RefundMetrics: rogue.EnergyRefundMetrics,
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: exposeArmorRank.GCD(),
			},
			IgnoreHaste: true,
			ModifyCast: func(sim *core.Simulation, spell *core.Spell, cast *core.Cast) {
				spell.SetMetricsSplit(rogue.ComboPoints())
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return rogue.ComboPoints() > 0 && rogue.CanApplyExposeArmorAura(target)
		},

		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			rogue.BreakStealth(sim)

			comboPoints := rogue.ComboPoints()
			result := spell.CalcOutcome(sim, target, spell.OutcomeMeleeSpecialHit)
			if result.Landed() {
				rogue.ExposeArmorAuras.Get(target).Activate(sim)
				rogue.ApplyFinisher(sim, spell)
				if pointsBack > 0 && comboPoints == 5 {
					rogue.AddComboPoints(sim, int32(pointsBack), cpMetrics)
				}
			} else {
				spell.IssueRefund(sim)
			}
			spell.DealOutcome(sim, result)
		},

		RelatedAuraArrays: rogue.ExposeArmorAuras.ToMap(),
	})
}

// buffs.ExposeArmorAura is fixed at five combo points; the rogue's own cast is worth the points it
// spends. Same label, id, duration and single-aura category as the generated player copy.
func (rogue *Rogue) exposeArmorAura(target *core.Unit) *core.Aura {
	var effect *core.ExclusiveEffect
	aura := target.GetOrRegisterAura(core.Aura{
		Label:    "Expose Armor (Player)",
		Tag:      buffs.ExposeArmorCategory,
		ActionID: core.ActionID{SpellID: exposeArmorRank.ID},
		Duration: buffs.ExposeArmorDuration(0),
		OnGain: func(_ *core.Aura, sim *core.Simulation) {
			effect.SetPriority(sim, rogue.GetExposeArmorValue())
		},
	})

	effect = aura.NewExclusiveEffect(buffs.ExposeArmorCategory, true, core.ExclusiveEffect{
		OnGain: func(ee *core.ExclusiveEffect, sim *core.Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stats.Armor, -ee.Priority)
		},
		OnExpire: func(ee *core.ExclusiveEffect, sim *core.Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stats.Armor, ee.Priority)
		},
	})
	return aura
}

func (rogue *Rogue) GetExposeArmorValue() float64 {
	return exposeArmorPerComboPoint * float64(rogue.ComboPoints())
}

func (rogue *Rogue) CanApplyExposeArmorAura(target *core.Unit) bool {
	aura := rogue.ExposeArmorAuras.Get(target)
	if curActive := aura.ExclusiveEffects[0].Category.GetActiveEffect(); curActive != nil {
		return rogue.GetExposeArmorValue() >= curActive.Priority
	}
	return true
}
