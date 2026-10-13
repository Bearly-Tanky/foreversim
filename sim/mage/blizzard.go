package mage

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

// Forever's Blizzard is an area trigger that casts a damage spell (1279949 at rank 6) every second.
func (mage *Mage) registerBlizzardSpell() {
	blizzardRank := spellData.Blizzard.Highest()
	// The damage is the spell BlizzardTriggered casts each tick, at the same rank; the tick length is
	// Blizzard's own periodic dummy.
	blizzardTickSpell := spellData.BlizzardTriggered.Rank(blizzardRank.RankNumber())
	blizzardTick := blizzardTickSpell.DamageEffect()
	tickLength := blizzardRank.Effect(dbcenums.A_PERIODIC_DUMMY, 0).Period()
	blizzardActionId := core.ActionID{SpellID: blizzardRank.ID}

	// Improved Blizzard's chill, a separate spell so Fingers of Frost can roll on it.
	var improvedBlizzard *core.Spell
	if mage.Talents.ImprovedBlizzard > 0 {
		improvedBlizzardRank := spellData.ImprovedBlizzardTriggered.Highest()
		improvedBlizzard = mage.RegisterSpell(core.SpellConfig{
			ActionID:       core.ActionID{SpellID: improvedBlizzardRank.ID},
			SpellSchool:    core.SpellSchoolFrost,
			DefenseType:    core.DefenseTypeMagic,
			ProcMask:       core.ProcMaskSpellDamageProc,
			Flags:          core.SpellFlagNoLogs | core.SpellFlagNoMetrics | core.SpellFlagNoOnCastComplete,
			ClassSpellMask: MageSpellImprovedBlizzard,
			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.CalcAndDealOutcome(sim, target, spell.OutcomeAlwaysHitNoHitCounter)
			},
		})
	}

	// The tick rows lack Not a Proc (1.60.1.70205), so only listeners that can proc from procs hear
	// them: no Arcane Concentration (log 2706: 0 of 642 tick hits) or Winter's Chill off ticks.
	blizzardTickCast := mage.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: blizzardTickSpell.ID},
		SpellSchool:    blizzardRank.SpellSchool(),
		DefenseType:    blizzardRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagNoOnCastComplete | core.SpellFlagProc,
		ClassSpellMask: MageSpellBlizzard,

		DamageMultiplier: 1,
		BonusCoefficient: blizzardTick.Coeff(),
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			// The tick row (1279949) carries no Cannot Crit bit, and beta logs show the ticks crit (foreverlogs
			// 2668: 27 of 301; 2706: 24 of 649).
			results := spell.CalcAndDealAoeDamage(sim, blizzardTick.Average(core.CharacterLevel), spell.OutcomeMagicHitAndCrit)
			if improvedBlizzard == nil {
				return
			}
			for _, result := range results {
				if result.Landed() {
					improvedBlizzard.Cast(sim, result.Target)
				}
			}
		},
	})

	mage.RegisterSpell(core.SpellConfig{
		ActionID:       blizzardActionId,
		SpellSchool:    blizzardRank.SpellSchool(),
		DefenseType:    blizzardRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask: MageSpellBlizzard,
		MaxRange:       float64(blizzardRank.MaxRange),
		ManaCost: core.ManaCostOptions{
			FlatCost: int32(blizzardRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: blizzardRank.GCD(),
			},
		},
		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label:    "Blizzard",
				ActionID: blizzardActionId,
			},
			NumberOfTicks: int32(blizzardRank.Duration() / tickLength),
			TickLength:    tickLength,
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				blizzardTickCast.Cast(sim, target)
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			// The cast's own E_DUMMY lands on every enemy in the area, so it can proc what a spell hit
			// procs (Arcane Concentration); the ticks are triggered by the area trigger and cannot.
			for _, aoeTarget := range sim.Encounter.ActiveTargetUnits {
				spell.CalcAndDealOutcome(sim, aoeTarget, spell.OutcomeMagicHitNoHitCounter)
			}
			spell.AOEDot().Apply(sim)
		},
	})
}
