package priest

import (
	"github.com/wowsims/forever/sim/core"
)

// The ability exists as spell 401977 on the Shadow Magic line. It has no rank subtext, so the
// generated table holds a single row.
var ShadowfiendRank = spellData.Shadowfiend.Highest()

func (priest *Priest) registerShadowfiendSpell() {
	if !priest.SelfBuffs.UseShadowfiend {
		return
	}

	actionID := core.ActionID{SpellID: ShadowfiendRank.ID}

	// Timeline aura, and what the tier 4 two piece lengthens.
	priest.ShadowfiendAura = priest.RegisterAura(core.Aura{
		ActionID: actionID,
		Label:    "Shadowfiend",
		Duration: ShadowfiendRank.Duration(),
	})

	priest.Shadowfiend = priest.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    core.SpellSchoolShadow,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: PriestSpellShadowFiend,

		// Client 401977 has no power cost row: the summon is free.
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
			CD: core.Cooldown{
				Timer:    priest.NewTimer(),
				Duration: max(ShadowfiendRank.Cooldown(), ShadowfiendRank.CategoryCooldown()),
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			priest.ShadowfiendPet.EnableWithTimeout(sim, priest.ShadowfiendPet, spell.RelatedSelfBuff.Duration)
			spell.RelatedSelfBuff.Activate(sim)
		},

		RelatedSelfBuff: priest.ShadowfiendAura,
	})

	priest.AddMajorCooldown(core.MajorCooldown{
		Spell: priest.Shadowfiend,
		Type:  core.CooldownTypeMana,
	})
}
