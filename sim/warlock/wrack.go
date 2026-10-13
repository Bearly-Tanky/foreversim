package warlock

import (
	"github.com/wowsims/forever/sim/core"
)

// Wrack is the Forever Affliction capstone (1316697): a six second shadow channel that also makes
// the warlock's Corruption and Bane of Agony on the target tick 10% harder while it runs - the
// second effect on the client's row, whose mask (1026) names those two only.
func (warlock *Warlock) registerWrack() {
	if !warlock.Talents.Wrack {
		return
	}

	rank := spellData.Wrack.Highest()
	tick := rank.PeriodicEffect()
	dotBonus := 1 + rank.EffectN(2).Percent()

	warlock.Wrack = warlock.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask: WarlockSpellWrack,
		MaxRange:       float64(rank.MaxRange),

		ManaCost: core.ManaCostOptions{FlatCost: int32(rank.Cost())},
		Cast:     core.CastConfig{DefaultCast: core.Cast{GCD: rank.GCD()}},

		DamageMultiplierAdditive: 1,
		DamageMultiplier:         1,
		ThreatMultiplier:         1,
		BonusCoefficient:         tick.Coeff(),

		Dot: core.DotConfig{
			Aura:                 core.Aura{Label: "Wrack"},
			NumberOfTicks:        int32(rank.Duration() / tick.Period()),
			TickLength:           tick.Period(),
			AffectedByCastSpeed:  true,
			HasteReducesDuration: true,
			BonusCoefficient:     tick.Coeff(),
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.Snapshot(target, tick.Average(core.CharacterLevel))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				result := dot.CalcSnapshotDamage(sim, target, periodicTickOutcome(rank, dot))
				result.Damage *= warlock.soulSiphonMultiplier(target)
				dot.Spell.DealPeriodicDamage(sim, result)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHitNoHitCounter)
			if result.Landed() {
				spell.Dot(target).Apply(sim)
			}
			spell.DealOutcome(sim, result)
		},
	})

	for _, target := range warlock.Env.Encounter.AllTargetUnits {
		target.AddDynamicDamageTakenModifier(func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult, isPeriodic bool) {
			if spell.Unit != &warlock.Unit {
				return
			}

			if isPeriodic && spell.Matches(WarlockSpellCorruption|WarlockSpellCurseOfAgony) && warlock.Wrack.Dot(result.Target).IsActive() {
				result.Damage *= dotBonus
			}
		})
	}
}
