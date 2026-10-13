package warlock

import (
	"github.com/wowsims/forever/sim/core"
)

// Forever renamed Curse of Doom to Bane of Doom (603): one tick of 1742 after a minute, with a 4.0
// spell power coefficient, on the bane slot. Amplify Curse does not reach it: 18288's mask (33792)
// names Bane of Agony and Curse of Weakness only.
func (warlock *Warlock) registerCurseOfDoom() {
	rank := spellData.BaneOfDoom.Highest()
	tick := rank.PeriodicEffect()

	warlock.CurseOfDoom = warlock.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: WarlockSpellCurseOfDoom,
		MaxRange:       float64(rank.MaxRange),

		ManaCost: core.ManaCostOptions{FlatCost: int32(rank.Cost())},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: rank.GCD(),
			},
			CD: core.Cooldown{
				Timer:    warlock.NewTimer(),
				Duration: max(rank.Cooldown(), rank.CategoryCooldown()),
			},
		},

		DamageMultiplierAdditive: 1,
		DamageMultiplier:         1,
		ThreatMultiplier:         1,
		BonusCoefficient:         tick.Coeff(),

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Bane of Doom",
				Tag:   "Affliction",
			},
			NumberOfTicks:    int32(rank.Duration() / tick.Period()),
			TickLength:       tick.Period(),
			BonusCoefficient: tick.Coeff(),

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.Snapshot(target, tick.Average(core.CharacterLevel))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, periodicTickOutcome(rank, dot))
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcOutcome(sim, target, spell.OutcomeMagicHitNoHitCounter)
			if result.Landed() {
				dot := spell.Dot(target)
				warlock.takeBaneSlot(sim, target, dot.Aura)
				dot.Apply(sim)
			}
			spell.DealOutcome(sim, result)
		},

		ExpectedTickDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, useSnapshot bool) *core.SpellResult {
			dot := spell.Dot(target)
			if useSnapshot {
				return dot.CalcSnapshotDamage(sim, target, spell.OutcomeExpectedMagicAlwaysHit)
			}
			return spell.CalcPeriodicDamage(sim, target, tick.Average(core.CharacterLevel), spell.OutcomeExpectedMagicAlwaysHit)
		},
	})
}
