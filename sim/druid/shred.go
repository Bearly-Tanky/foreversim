package druid

import (
	"github.com/wowsims/forever/sim/core"
)

var shredRank = spellData.Shred.Highest()

// Forever retunes Shred to 155% weapon damage, which the client states as E_WEAPON_PERCENT_DAMAGE
// on every rank, down from Classic's 225%. The flat addend is the rank's own value.
var shredWeaponMultiplier = spellData.Shred.EffectAt(2).FractionAt(shredRank.RankNumber())

func (druid *Druid) registerShredSpell() {
	druid.Shred = druid.RegisterSpell(Cat, core.SpellConfig{
		ActionID:       core.ActionID{SpellID: shredRank.ID},
		SpellSchool:    shredRank.SpellSchool(),
		DefenseType:    shredRank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		ClassSpellMask: DruidSpellShred,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		Rank:           shredRank.RankNumber(),

		EnergyCost: core.EnergyCostOptions{
			Cost:   int32(shredRank.Cost()),
			Refund: shredRank.MissRefund(),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: shredRank.GCD(),
			},
			IgnoreHaste: true,
		},

		ExtraCastCondition: func(_ *core.Simulation, _ *core.Unit) bool {
			return !druid.PseudoStats.InFrontOfTarget && !druid.CannotShredTarget
		},

		DamageMultiplier: shredWeaponMultiplier,
		ThreatMultiplier: 1,
		MaxRange:         core.MaxMeleeRange,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := shredRank.DamageEffect().Average(core.CharacterLevel) + spell.Unit.MHWeaponDamage(sim, spell.MeleeAttackPower(target))

			result := spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeMeleeWeaponSpecialHitAndCrit)

			if result.Landed() {
				druid.AddComboPoints(sim, 1, spell.ComboPointMetrics())
			} else {
				spell.IssueRefund(sim)
			}
		},

		ExpectedInitialDamage: func(sim *core.Simulation, target *core.Unit, spell *core.Spell, _ bool) *core.SpellResult {
			baseDamage := shredRank.DamageEffect().Average(core.CharacterLevel) + spell.Unit.AutoAttacks.MH().CalculateAverageWeaponDamage(spell.MeleeAttackPower(target))
			return spell.CalcDamage(sim, target, baseDamage, spell.OutcomeExpectedMeleeWeaponSpecialHitAndCrit)
		},
	})
}

func (druid *Druid) CurrentShredCost() float64 {
	return druid.Shred.Cost.GetCurrentCost()
}
