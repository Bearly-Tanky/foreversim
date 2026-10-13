package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
)

var demoralizingRoarRank = spellData.DemoralizingRoar.Highest()

func (druid *Druid) registerDemoralizingRoarSpell() {
	druid.registerDemoralizingRoarAura()

	druid.DemoralizingRoar = druid.RegisterSpell(Bear, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: demoralizingRoarRank.ID},
		SpellSchool:    demoralizingRoarRank.SpellSchool(),
		DefenseType:    demoralizingRoarRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskEmpty,
		ClassSpellMask: DruidSpellDemoralizingRoar,
		Flags:          core.SpellFlagAPL,

		RageCost: core.RageCostOptions{
			Cost: int32(demoralizingRoarRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: demoralizingRoarRank.GCD(),
			},
			IgnoreHaste: true,
		},

		ThreatMultiplier: 1,
		// Two threat a level, the sim's long-standing value; the client states none.
		FlatThreatBonus: 2 * float64(core.CharacterLevel),

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			for _, aoeTarget := range druid.Env.Encounter.AllTargetUnits {
				result := spell.CalcAndDealOutcome(sim, aoeTarget, spell.OutcomeMagicHit)
				if result.Landed() {
					druid.DemoralizingRoarAuras.Get(aoeTarget).Activate(sim)
				}
			}
		},

		RelatedAuraArrays: druid.DemoralizingRoarAuras.ToMap(),
	})
}

func (druid *Druid) registerDemoralizingRoarAura() {
	druid.DemoralizingRoarAuras = druid.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
		// Forever has no Feral Aggression node, so there are no talent points to pass; the
		// generated aura carries the client's rank 5 -205 attack power.
		return buffs.DemoralizingRoarAura(target, true, 0)
	})
}
