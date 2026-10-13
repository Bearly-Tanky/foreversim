package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

var hurricaneRank = spellData.Hurricane.Highest()

func (druid *Druid) registerHurricaneSpell() {
	// The tick length is on Hurricane's own periodic dummy; the damage is the spell HurricaneTriggered
	// casts each tick.
	tickLength := hurricaneRank.Effect(dbcenums.A_PERIODIC_DUMMY, 0).Period()
	hurricaneTickSpell := spellData.HurricaneTriggered.Highest()
	hurricaneTick := hurricaneTickSpell.DamageEffect()

	druid.Hurricane = druid.RegisterSpell(Humanoid|Moonkin, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: hurricaneRank.ID},
		SpellSchool:    hurricaneRank.SpellSchool(),
		DefenseType:    hurricaneRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagChanneled | core.SpellFlagAPL,
		ClassSpellMask: DruidSpellHurricane,
		MaxRange:       float64(hurricaneRank.MaxRange),
		Rank:           hurricaneRank.RankNumber(),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(hurricaneRank.Cost()),
		},
		// Forever states no cooldown on Hurricane (the client rows carry none), so the spell is
		// registered without one rather than with an invented duration.
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: hurricaneRank.GCD(),
			},
		},
		Dot: core.DotConfig{
			IsAOE: true,
			Aura: core.Aura{
				Label: "Hurricane (Aura)",
			},
			NumberOfTicks:       int32(hurricaneRank.Duration() / tickLength),
			TickLength:          tickLength,
			AffectedByCastSpeed: true,
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				druid.Hurricane.RelatedDotSpell.Cast(sim, target)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.AOEDot().Apply(sim)
		},
	})

	druid.Hurricane.RelatedDotSpell = druid.Unit.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: hurricaneTickSpell.ID},
		SpellSchool:    hurricaneRank.SpellSchool(),
		DefenseType:    hurricaneRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		ClassSpellMask: DruidSpellHurricane,
		// The tick is its own client row that the channel triggers, a proc rather than a cast. It has
		// no "can't crit" flag and the same attributes as Blizzard's tick, which crits in beta logs.
		Flags: core.SpellFlagProc,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		BonusCoefficient: hurricaneTick.Coeff(),

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			spell.CalcAndDealAoeDamage(sim, hurricaneTick.Average(core.CharacterLevel), spell.OutcomeMagicHitAndCrit)
		},
	})
}
