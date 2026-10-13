package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
)

var faerieFireRank = spellData.FaerieFire.Highest()

// Forever has no Faerie Fire (Feral): the client keeps only the Balance line (770, 778, 9749,
// 9907), so one registration serves every form.
func (druid *Druid) registerFaerieFireSpell() {
	druid.FaerieFireAuras = druid.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		// Forever has no Improved Faerie Fire node, so there are no talent points to pass.
		return buffs.FaerieFireAura(target, true, 0)
	})

	druid.FaerieFire = druid.RegisterSpell(Any, core.SpellConfig{
		ClassSpellMask: DruidSpellFaerieFire,
		ActionID:       core.ActionID{SpellID: faerieFireRank.ID},
		SpellSchool:    faerieFireRank.SpellSchool(),
		DefenseType:    faerieFireRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		Rank:           faerieFireRank.RankNumber(),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(faerieFireRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: faerieFireRank.GCD(),
			},
		},

		ThreatMultiplier: 1,
		// Two threat a level, the sim's long-standing value; the client states none.
		FlatThreatBonus: 2 * float64(core.CharacterLevel),
		MaxRange:        float64(faerieFireRank.MaxRange),

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			result := spell.CalcAndDealOutcome(sim, target, spell.OutcomeMagicHit)

			if result.Landed() {
				druid.FaerieFireAuras.Get(target).Activate(sim)
			}
		},

		RelatedAuraArrays: druid.FaerieFireAuras.ToMap(),
	})
}
