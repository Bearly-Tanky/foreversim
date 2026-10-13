package druid

import (
	"github.com/wowsims/forever/sim/core"
)

// The client carries no threat for Lacerate, so the 3.33x multiplier is still Season of Discovery's.
var lacerateRank = spellData.Lacerate.Highest()
var lacerateTick = lacerateRank.PeriodicEffect()

// The hit is a share of weapon damage per stack, which the client states on the rank's dummy
// effect (10 at every rank).
var lacerateWeaponPctPerStack = spellData.Lacerate.EffectAt(2).FractionAt(lacerateRank.RankNumber())

const LacerateMaxStacks int32 = 5

// Forever's bleed no longer scales with attack power: the client states a flat tick per stack.
func (druid *Druid) registerLacerateSpell() {
	druid.Lacerate = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: lacerateRank.ID},
		SpellSchool:    lacerateRank.SpellSchool(),
		DefenseType:    lacerateRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: DruidSpellLacerate,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		Rank:           lacerateRank.RankNumber(),

		RageCost: core.RageCostOptions{
			Cost:   int32(lacerateRank.Cost()),
			Refund: lacerateRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: lacerateRank.GCD(),
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 3.33,
		MaxRange:         core.MaxMeleeRange,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label:     "Lacerate",
				MaxStacks: LacerateMaxStacks,
				Duration:  lacerateRank.Duration(),
			},
			NumberOfTicks: int32(lacerateRank.Duration() / lacerateTick.Period()),
			TickLength:    lacerateTick.Period(),

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.SnapshotPhysical(target, lacerateTick.Average(core.CharacterLevel)*float64(dot.Aura.GetStacks()))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, periodicTickOutcome(lacerateRank, dot))
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			dot := spell.Dot(target)
			stacks := min(dot.Aura.GetStacks()+1, LacerateMaxStacks)
			baseDamage := spell.Unit.MHWeaponDamage(sim, spell.MeleeAttackPower(target)) * lacerateWeaponPctPerStack * float64(stacks)
			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

			if result.Landed() {
				if dot.IsActive() {
					dot.Refresh(sim)
					dot.AddStack(sim)
				} else {
					dot.Apply(sim)
					dot.SetStacks(sim, 1)
				}
				// Snapshot again once the stacks are in, since the damage grows with them.
				dot.TakeSnapshot(sim)
			} else {
				spell.IssueRefund(sim)
			}
		},
	})

	druid.Lacerate.ShortName = "Lacerate"
}
