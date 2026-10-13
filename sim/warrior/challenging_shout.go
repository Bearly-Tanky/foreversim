package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerChallengingShout() {
	challengingShoutRank := spellData.ChallengingShout.Highest()

	warrior.ChallengingShout = warrior.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: challengingShoutRank.ID},
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMagic,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: SpellMaskChallengingShout,

		RageCost: core.RageCostOptions{
			Cost: int32(challengingShoutRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: challengingShoutRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(challengingShoutRank),
			},
		},

		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			for _, aoeTarget := range sim.Encounter.ActiveTargetUnits {
				spell.CalcAndDealOutcome(sim, aoeTarget, spell.OutcomeAlwaysHit)
			}
		},
	})
}
