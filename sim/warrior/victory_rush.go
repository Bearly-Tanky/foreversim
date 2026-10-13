package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

// This spell works but the Sim never kills a target
func (warrior *Warrior) registerVictoryRush() {
	victoryRushRank := spellData.VictoryRush.Highest()
	victoryRushAPCoef := victoryRushRank.Effects[2].Percent()
	victoryRushHealPercent := victoryRushRank.Effects[1].Percent()
	victoriousRank := spellData.VictoryRushTriggered.Highest()

	actionID := core.ActionID{SpellID: victoryRushRank.ID}
	healthMetrics := warrior.NewHealthMetrics(actionID)

	victoriousAura := warrior.RegisterAura(core.Aura{
		Label:    "Victorious",
		ActionID: core.ActionID{SpellID: victoriousRank.ID},
		Duration: victoriousRank.Duration(),
	})

	warrior.VictoryRush = warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolPhysical,
		DefenseType:    core.DefenseTypeMelee,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskVictoryRush,
		MaxRange:       float64(victoryRushRank.MaxRange),

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: victoryRushRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(victoryRushRank),
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return victoriousAura.IsActive()
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := victoryRushRank.DamageEffect().Average(core.CharacterLevel) + victoryRushAPCoef*spell.MeleeAttackPower(target)
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)
			warrior.GainHealth(sim, warrior.MaxHealth()*victoryRushHealPercent, healthMetrics)
			victoriousAura.Deactivate(sim)
		},

		RelatedSelfBuff: victoriousAura,
	})
}
