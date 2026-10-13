package paladin

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
	"github.com/wowsims/forever/sim/core/spelldata"
)

func (paladin *Paladin) registerAuras() {
	paladin.registerDevotionAura()
	paladin.registerRetributionAura()
	paladin.registerConcentrationAura()
	paladin.registerFireResistanceAura()
	paladin.registerFrostResistanceAura()
	paladin.registerShadowResistanceAura()
}

// The rank of a paladin aura as sim/core/buffs wants it: the spell the paladin cast and its rank.
func auraRank(rank *spelldata.Spell) buffs.PaladinAuraRank {
	return buffs.PaladinAuraRank{SpellID: rank.ID, Rank: rank.RankNumber()}
}

// The castable aura spell: instant, on the GCD, free. The aura it turns on is one of the self-cast
// paladin auras in sim/core/buffs, which already sit in PaladinAuraCategory so one cast replaces the
// last.
func (paladin *Paladin) registerAuraSpell(rank *spelldata.Spell, aura *core.Aura, classMask int64) {
	paladin.RegisterSpell(core.SpellConfig{
		ActionID:       aura.ActionID,
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL | core.SpellFlagHelpful,
		ClassSpellMask: classMask,
		Rank:           rank.RankNumber(),

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: rank.GCD(),
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			aura.Activate(sim)
		},

		RelatedSelfBuff: aura,
	})
}
