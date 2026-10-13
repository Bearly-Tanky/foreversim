package warrior

import (
	"github.com/wowsims/forever/sim/core"
)

func (warrior *Warrior) registerRetaliation() {
	retaliationRank := spellData.Retaliation.Highest()
	retaliationHit := spellData.RetaliationTriggered.Highest()
	retaliationHitBaseDamage := retaliationHit.DamageEffect().Average(core.CharacterLevel)

	actionID := core.ActionID{SpellID: retaliationRank.ID}

	attackSpell := warrior.RegisterSpell(core.SpellConfig{
		ClassSpellMask: SpellMaskRetaliationHit,
		ActionID:       core.ActionID{SpellID: retaliationHit.ID},
		SpellSchool:    retaliationHit.SpellSchool(),
		DefenseType:    retaliationHit.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMH,
		Flags:          core.SpellFlagMeleeMetrics,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := retaliationHitBaseDamage + warrior.MHWeaponDamage(sim, spell.MeleeAttackPower(target))
			spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)
		},
	})

	aura := warrior.RegisterAura(core.Aura{
		ActionID:  actionID,
		Label:     "Retaliation",
		Duration:  retaliationRank.Duration(),
		MaxStacks: int32(retaliationRank.ProcCharges),
		OnSpellHitTaken: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.ProcMask.Matches(core.ProcMaskMelee) && result.Landed() && result.Damage > 0 {
				attackSpell.Cast(sim, spell.Unit)
				aura.RemoveStack(sim)
			}
		},
	})

	spell := warrior.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		DefenseType:    core.DefenseTypeMelee,
		ClassSpellMask: SpellMaskRetaliation,
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: retaliationRank.GCD(),
			},
			CD: core.Cooldown{
				Timer:    warrior.NewTimer(),
				Duration: cooldownOf(retaliationRank),
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return warrior.StanceMatches(BattleStance)
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			aura.Activate(sim)
			aura.SetStacks(sim, int32(retaliationRank.ProcCharges))
		},

		RelatedSelfBuff: aura,
	})

	warrior.AddMajorCooldown(core.MajorCooldown{
		Spell: spell,
		Type:  core.CooldownTypeDPS,
		// Require manual CD usage
		ShouldActivate: func(sim *core.Simulation, character *core.Character) bool {
			return false
		},
	})
}
