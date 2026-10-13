package rogue

import (
	"time"

	"github.com/wowsims/forever/sim/core"
)

var stealthRank = spellData.Stealth.ByID(1784)

func (rogue *Rogue) registerStealthAura() {
	rogue.StealthAura = rogue.RegisterAura(core.Aura{
		Label:    "Stealth",
		ActionID: core.ActionID{SpellID: stealthRank.ID},
		Duration: core.NeverExpires,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			if rogue.MasterOfSubtletyAura != nil {
				rogue.MasterOfSubtletyAura.Duration = core.NeverExpires
				rogue.MasterOfSubtletyAura.Activate(sim)
			}
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			if rogue.MasterOfSubtletyAura != nil {
				rogue.MasterOfSubtletyAura.Deactivate(sim)
				rogue.MasterOfSubtletyAura.Duration = time.Second * 6
				rogue.MasterOfSubtletyAura.Activate(sim)
			}
		},
		// Stealth breaks on damage taken (if not absorbed); not modelled.
	})

	rogue.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: stealthRank.ID},
		SpellSchool:    stealthRank.SpellSchool(),
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: RogueSpellStealth,

		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    rogue.NewTimer(),
				Duration: max(stealthRank.Cooldown(), stealthRank.CategoryCooldown()),
			},
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return sim.CurrentTime < 0
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.RelatedSelfBuff.Activate(sim)
		},
		RelatedSelfBuff: rogue.StealthAura,
	})
}
