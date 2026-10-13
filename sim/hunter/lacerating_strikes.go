package hunter

import (
	"time"

	"github.com/wowsims/forever/sim/core"
)

// The bleed lasts 21 sec and carries 40% of the Mongoose Bite that applied it. The tooltip gives no
// tick interval, so it ticks every 3 sec like every other bleed. Its ticks crit where the client marks
// Periodic Can Crit (1310536, set in build 70009).
func (hunter *Hunter) registerLaceratingStrikesSpell() {
	if !hunter.Talents.LaceratingStrikes {
		return
	}

	hunter.LaceratingStrikes = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       hunter.MongooseBite.ActionID.WithTag(1),
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ClassSpellMask: HunterSpellLaceratingStrikes,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagNoOnCastComplete,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Lacerating Strikes" + hunter.Label,
			},
			NumberOfTicks: 7,
			TickLength:    time.Second * 3,

			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, spellData.LaceratingStrikesTriggered.Highest().TickOutcomeHitRolled(dot))
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Dot(target).Apply(sim)
		},
	})
}

func (hunter *Hunter) procLaceratingStrikes(sim *core.Simulation, result *core.SpellResult) {
	dot := hunter.LaceratingStrikes.Dot(result.Target)
	dot.SnapshotBaseDamage = result.Damage * 0.4 / float64(dot.BaseTickCount)
	dot.SnapshotAttackerMultiplier = 1

	hunter.LaceratingStrikes.Cast(sim, result.Target)
}
