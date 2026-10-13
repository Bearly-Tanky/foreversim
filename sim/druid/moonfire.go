package druid

import (
	"github.com/wowsims/forever/sim/core"
)

var moonfireRank = spellData.Moonfire.Highest()
var moonfireTick = moonfireRank.PeriodicEffect()

func (druid *Druid) registerMoonfireSpell() {
	druid.registerMoonfireImpactSpell()
	druid.registerMoonfireDoTSpell()
}

func (druid *Druid) registerMoonfireDoTSpell() {
	druid.Moonfire.RelatedDotSpell = druid.Unit.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: moonfireRank.ID}.WithTag(1),
		SpellSchool:    moonfireRank.SpellSchool(),
		DefenseType:    moonfireRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: DruidSpellMoonfireDoT,
		Flags:          core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Moonfire",
			},
			NumberOfTicks:       int32(moonfireRank.Duration() / moonfireTick.Period()),
			TickLength:          moonfireTick.Period(),
			AffectedByCastSpeed: false,
			BonusCoefficient:    moonfireTick.Coeff(),

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.Snapshot(target, moonfireTick.Average(core.CharacterLevel))
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, periodicTickOutcome(moonfireRank, dot))
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Dot(target).Apply(sim)
		},
	})
}

func (druid *Druid) registerMoonfireImpactSpell() {
	druid.Moonfire = druid.RegisterSpell(Humanoid|Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: moonfireRank.ID},
		SpellSchool:    moonfireRank.SpellSchool(),
		DefenseType:    moonfireRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: DruidSpellMoonfireInitial,
		Flags:          core.SpellFlagAPL,
		Rank:           moonfireRank.RankNumber(),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(moonfireRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: moonfireRank.GCD(),
			},
		},

		BonusCoefficient: moonfireRank.DamageEffect().Coeff(),
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		MaxRange:         float64(moonfireRank.MaxRange),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcDamage(sim, target, moonfireRank.DamageEffect().Roll(sim, core.CharacterLevel), spell.OutcomeMagicHitAndCrit)

			// Moonfire is one client spell, so one hit event: applying the DoT directly keeps Omen of
			// Clarity and on-hit procs from rolling a second time off it.
			if result.Landed() {
				druid.Moonfire.RelatedDotSpell.Dot(target).Apply(sim)
			}

			spell.DealDamage(sim, result)
		},
	})
}
