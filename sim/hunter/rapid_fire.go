package hunter

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

func (hunter *Hunter) registerRapidFireCD() {
	rank := spellData.RapidFire.Highest()
	actionID := core.ActionID{SpellID: rank.ID}
	hasteMultiplier := 1 + rank.Effect(dbcenums.A_MOD_RANGED_HASTE, 0).Average(core.CharacterLevel)/100

	hunter.RapidFireAura = hunter.RegisterAura(core.Aura{
		Label:    "Rapid Fire",
		ActionID: actionID,
		Duration: rank.Duration(),

		// Forever: ranged and melee attack speed, where Classic's was ranged only.
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.MultiplyAttackSpeed(sim, hasteMultiplier)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.MultiplyAttackSpeed(sim, 1/hasteMultiplier)
		},
	})

	// Rapid Killing takes a minute off a rank (client curve -60000/-120000 ms). The buff a kill
	// grants (415407: 20% on the next Shot within 20 sec) is not modelled, nothing dies in a boss
	// fight.
	cooldown := max(rank.Cooldown(), rank.CategoryCooldown()) + time.Duration(spellData.RapidKilling.
		Effect(dbcenums.A_ADD_FLAT_MODIFIER, int32(dbcenums.SPELLMOD_COOLDOWN)).
		ValueAt(hunter.Talents.RapidKilling))*time.Millisecond

	hunter.RapidFire = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    rank.SpellSchool(),
		ClassSpellMask: HunterSpellRapidFire,
		ProcMask:       core.ProcMaskEmpty,

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(rank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				NonEmpty: true,
			},
			CD: core.Cooldown{
				Timer:    hunter.NewTimer(),
				Duration: cooldown,
			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return !hunter.RapidFireAura.IsActive()
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			hunter.RapidFireAura.Activate(sim)
		},

		RelatedSelfBuff: hunter.RapidFireAura,
	})

	hunter.AddMajorCooldown(core.MajorCooldown{
		Spell: hunter.RapidFire,
		Type:  core.CooldownTypeDPS,

		ShouldActivate: func(sim *core.Simulation, character *core.Character) bool {
			return !hunter.RapidFireAura.IsActive()
		},
	})
}
