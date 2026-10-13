package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
)

var insectSwarmRank = spellData.InsectSwarm.Highest()
var insectSwarmTick = insectSwarmRank.PeriodicEffect()

func (druid *Druid) registerInsectSwarmSpell() {
	auras := druid.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		return buffs.InsectSwarmAura(target, true, 0)
	})

	druid.InsectSwarm = druid.RegisterSpell(Humanoid|Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: insectSwarmRank.ID},
		SpellSchool:    insectSwarmRank.SpellSchool(),
		DefenseType:    insectSwarmRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: DruidSpellInsectSwarm,
		Flags:          core.SpellFlagAPL | core.SpellFlagBinary,
		Rank:           insectSwarmRank.RankNumber(),

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		MaxRange:         float64(insectSwarmRank.MaxRange),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(insectSwarmRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: insectSwarmRank.GCD(),
			},
		},

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Insect Swarm",
				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					auras.Get(aura.Unit).Activate(sim)
				},
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					auras.Get(aura.Unit).Deactivate(sim)
				},
			},

			NumberOfTicks:       int32(insectSwarmRank.Duration() / insectSwarmTick.Period()),
			TickLength:          insectSwarmTick.Period(),
			AffectedByCastSpeed: false,
			BonusCoefficient:    insectSwarmTick.Coeff(),

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.Snapshot(target, insectSwarmTick.Average(core.CharacterLevel))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, periodicTickOutcome(insectSwarmRank, dot))
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHit)

			if result.Landed() {
				spell.Dot(target).Apply(sim)
			}

			spell.DealOutcome(sim, result)
		},

		RelatedAuraArrays: auras.ToMap(),
	})
}
