package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerExecute() {
	executeRank := spellData.Execute.Highest()
	// TODO: The dummy effect carries the base damage; Execute has no Direct role, and both of its
	// effects share the aura/misc pair Effect() selects on.
	executeBaseDamage := executeRank.EffectN(1).Average(core.CharacterLevel)
	// The tooltip's $*10;F1: the dummy's chain amplitude, times 10, per extra point of rage.
	executeDamagePerRage := float64(executeRank.EffectN(1).ChainAmp) * 10

	var rageMetrics *core.ResourceMetrics

	spell := warrior.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: executeRank.ID},
		SpellSchool:    executeRank.SpellSchool(),
		DefenseType:    executeRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskExecute,
		MaxRange:       core.MaxMeleeRange,

		RageCost: core.RageCostOptions{
			Cost:   int32(executeRank.Cost()),
			Refund: executeRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: executeRank.GCD(),
			},
			IgnoreHaste: true,
		},

		DamageMultiplier: 1,
		// Not in the client table; our Classic value until measured in game.
		ThreatMultiplier: 1.25,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BerserkerStance|BattleStance) && sim.IsExecutePhase20()
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			extraRage := spell.Unit.CurrentRage()
			maxRage := warrior.MaximumRage() - spell.Cost.GetCurrentCost()
			if extraRage > maxRage {
				extraRage = maxRage
			}
			warrior.SpendRage(sim, extraRage, rageMetrics)
			rageMetrics.Events--

			baseDamage := executeBaseDamage + executeDamagePerRage*extraRage
			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)

			if !result.Landed() {
				spell.IssueRefund(sim)
			}
		},
	})

	rageMetrics = spell.Cost.ResourceCostImpl.(*core.RageCost).ResourceMetrics

}
