package hunter

import (
	"github.com/wowsims/forever/sim/core"
)

// spellData.RaptorStrike holds the eight trainer ranks, 2973 to 14266. The client also carries two
// Season of Discovery ladders under the same name: 415335 to 415343, which the rune passive Melee
// Specialist (415352) swaps onto the action bar, and 409691 to 409755, a mana-less copy nothing
// references. The generator drops the first by its override link and the second because only the
// trainer rank carries a SpellPower row.
//
// Raptor Strike replaces the next main-hand swing rather than costing a global, so the cast the
// rotation presses only queues it; the hit lands on the swing.
func (hunter *Hunter) registerRaptorStrikeSpell() {
	rank := spellData.RaptorStrike.Highest()
	baseDamage := rank.DamageEffect().Average(core.CharacterLevel)

	hunter.RaptorStrikeHit = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID}.WithTag(1),
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ClassSpellMask: HunterSpellRaptorStrike,
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagNoOnCastComplete,
		MaxRange:       core.MaxMeleeRange,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		BonusCoefficient: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			damage := baseDamage + hunter.MHWeaponDamage(sim, spell.MeleeAttackPower(target))
			spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)
		},
	})

	hunter.RaptorStrike = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ClassSpellMask: HunterSpellRaptorStrike,
		ProcMask:       core.ProcMaskMeleeMHSpecial | core.ProcMaskMeleeMHAuto,
		Flags:          core.SpellFlagMeleeMetrics,
		MaxRange:       core.MaxMeleeRange,

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(rank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: max(rank.Cooldown(), rank.CategoryCooldown()),
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			hunter.RaptorStrikeHit.Cast(sim, target)

			if hunter.curQueueAura != nil {
				hunter.curQueueAura.Deactivate(sim)
			}
		},
	})

	hunter.makeRaptorStrikeQueueSpell()
}

func (hunter *Hunter) makeRaptorStrikeQueueSpell() {
	queueAura := hunter.RegisterAura(core.Aura{
		Label:    "Raptor Strike Queued",
		ActionID: hunter.RaptorStrike.ActionID.WithTag(3),
		Duration: core.NeverExpires,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			if hunter.curQueueAura != nil {
				hunter.curQueueAura.Deactivate(sim)
			}
			hunter.PseudoStats.DisableDWMissPenalty = true
			hunter.curQueueAura = aura
			hunter.curQueuedAutoSpell = hunter.RaptorStrike
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			hunter.PseudoStats.DisableDWMissPenalty = false
			hunter.curQueueAura = nil
			hunter.curQueuedAutoSpell = nil
		},
	})

	queueSpell := hunter.RegisterSpell(core.SpellConfig{
		ActionID:       hunter.RaptorStrike.ActionID.WithTag(3),
		ClassSpellMask: HunterSpellRaptorStrikeQueue,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return hunter.curQueueAura != queueAura &&
				hunter.CurrentMana() >= hunter.RaptorStrike.Cost.GetCurrentCost() &&
				hunter.Hardcast.Expires <= sim.CurrentTime &&
				hunter.DistanceFromTarget <= core.MaxMeleeRange &&
				hunter.RaptorStrike.IsReady(sim)
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			queueAura.Activate(sim)
		},
	})
	_ = queueSpell
}

// Returns the spell the main-hand swing should use: the queued Raptor Strike when one is waiting.
func (hunter *Hunter) TryRaptorStrike(sim *core.Simulation, mhSwingSpell *core.Spell) *core.Spell {
	if hunter.curQueuedAutoSpell != nil && hunter.curQueuedAutoSpell.CanCast(sim, hunter.CurrentTarget) {
		return hunter.curQueuedAutoSpell
	}
	return mhSwingSpell
}
