package warlock

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

// Forever's Rain of Fire is an area trigger, like Blizzard: an 8 s channel whose periodic dummy casts a
// direct Fire hit (1282385 at rank 4) on every enemy in the area every 2 seconds. Beta log 2695 (Rumble,
// rank 1) has exactly that: no damage on the cast, then 4 ticks 2 s apart on up to 5 targets, ticks crit.
func (warlock *Warlock) registerRainOfFire() {
	rank := spellData.RainOfFire.Highest()
	tickSpell := spellData.RainOfFireTriggered.Rank(rank.RankNumber())
	tick := tickSpell.DamageEffect()
	tickLength := rank.Effect(dbcenums.A_PERIODIC_DUMMY, 0).Period()
	actionID := core.ActionID{SpellID: rank.ID}

	// The tick rows lack Not a Proc (1.60.1.70205), so only listeners that can proc from procs hear them.
	tickCast := warlock.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: tickSpell.ID},
		SpellSchool:    tickSpell.SpellSchool(),
		DefenseType:    tickSpell.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagNoOnCastComplete | core.SpellFlagProc,
		ClassSpellMask: WarlockSpellRainOfFire,

		DamageMultiplierAdditive: 1,
		DamageMultiplier:         1,
		BonusCoefficient:         tick.Coeff(),
		ThreatMultiplier:         1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			// No Cannot Crit on the tick rows; log 2695 crits at 1.5x (44 -> 66).
			spell.CalcAndDealAoeDamage(sim, tick.Average(core.CharacterLevel), spell.OutcomeMagicHitAndCrit)
		},
	})

	warlock.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask: WarlockSpellRainOfFire,
		MaxRange:       float64(rank.MaxRange),

		ManaCost: core.ManaCostOptions{FlatCost: int32(rank.Cost())},
		Cast:     core.CastConfig{DefaultCast: core.Cast{GCD: rank.GCD()}},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label:    "Rain of Fire",
				ActionID: actionID,
			},
			NumberOfTicks: int32(rank.Duration() / tickLength),
			TickLength:    tickLength,
			OnTick: func(sim *core.Simulation, target *core.Unit, _ *core.Dot) {
				tickCast.Cast(sim, target)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			// The cast's own E_DUMMY lands on every enemy in the 8 yd area, as Blizzard's does.
			for _, aoeTarget := range sim.Encounter.ActiveTargetUnits {
				spell.CalcAndDealOutcome(sim, aoeTarget, spell.OutcomeMagicHitNoHitCounter)
			}
			spell.AOEDot().Apply(sim)
		},
	})
}
