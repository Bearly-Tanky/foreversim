package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

// TODO: Ingame test needed -- the client states no amount for the extra rage a hit taken
// generates while Berserker Rage is up; doubled.
const berserkerRageDamageTakenRageMultiplier = 2.0

func (warrior *Warrior) registerBerserkerRage() {
	berserkerRageRank := spellData.BerserkerRage.Highest()

	actionID := core.ActionID{SpellID: berserkerRageRank.ID}
	rageMetrics := warrior.NewRageMetrics(actionID)
	rageGain := spellData.ImprovedBerserkerRage.EffectAt(1).TenthsAt(warrior.Talents.ImprovedBerserkerRage)

	aura := warrior.RegisterAura(core.Aura{
		Label:    "Berserker Rage",
		ActionID: actionID,
		Duration: berserkerRageRank.Duration(),
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			warrior.MultiplyDamageTakenRageGen(berserkerRageDamageTakenRageMultiplier)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			warrior.MultiplyDamageTakenRageGen(1 / berserkerRageDamageTakenRageMultiplier)
		},
	}).
		AttachFearImmunity()

	spell := warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		ClassSpellMask: SpellMaskBerserkerRage,
		Flags:          core.SpellFlagAPL | core.SpellFlagCastWhileIncapacitated,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: berserkerRageRank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(berserkerRageRank),
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BerserkerStance)
		},
		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			if rageGain > 0 {
				warrior.AddRage(sim, rageGain, rageMetrics)
			}
			aura.Activate(sim)
		},
		RelatedSelfBuff: aura,
	})

	warrior.AddMajorCooldown(core.MajorCooldown{
		Spell: spell,
		Type:  core.CooldownTypeSurvival,
		ShouldActivate: func(s *core.Simulation, c *core.Character) bool {
			return rageGain > 0 && warrior.CurrentRage()+rageGain <= warrior.MaximumRage()
		},
	})
}
