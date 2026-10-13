package warrior

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/stats"
)

func (warrior *Warrior) registerRecklessness() {
	recklessnessRank := spellData.Recklessness.Highest()

	actionID := core.ActionID{SpellID: recklessnessRank.ID}
	recklessnessCritValue := recklessnessRank.Effect(dbcenums.A_MOD_CRIT_PCT, 0).Average(core.CharacterLevel)
	aura := warrior.RegisterAura(core.Aura{
		Label:    "Recklessness",
		ActionID: actionID,
		Duration: recklessnessRank.Duration(),
	}).AttachStatsBuff(
		stats.Stats{
			stats.PhysicalCritPercent: recklessnessCritValue,
			stats.SpellCritPercent:    recklessnessCritValue,
		},
	).AttachMultiplicativePseudoStatBuff(
		&warrior.PseudoStats.DamageTakenMultiplier,
		1+recklessnessRank.Effect(dbcenums.A_MOD_DAMAGE_PERCENT_TAKEN, 127).Percent(),
	).
		AttachFearImmunity()

	spell := warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		DefenseType:    core.DefenseTypeMelee,
		Flags:          core.SpellFlagAPL | core.SpellFlagCastWhileIncapacitated,
		ClassSpellMask: SpellMaskRecklessness,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: recklessnessRank.GCD(),
			},
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(recklessnessRank),
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BerserkerStance)
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			aura.Activate(sim)
		},

		RelatedSelfBuff: aura,
	})

	warrior.AddMajorCooldown(core.MajorCooldown{
		Spell: spell,
		Type:  core.CooldownTypeDPS,
	})
}
