package paladin

import (
	"github.com/wowsims/forever/sim/core"
)

var HammerOfTheRighteousRankMap = spellData.HammerOfTheRighteous

// Hammer of the Righteous
// https://www.wowhead.com/forever/spell=407632
//
// Hammer the current target and up to 3 additional nearby targets, causing Holy damage equal to 3
// times your main hand weapon's damage per second.
//
// Trained on the Protection line at level 40 (SkillLineAbility AcquireMethod 0). The tooltip says
// its cooldown is shared with Crusader Strike, a leftover: Forever has no Crusader Strike, and the
// client's cooldown category 2404 puts it with Holy Strike, so casting either puts both on
// cooldown. The weapon DPS multiple is the row's effect 2. The damage effect's ChainTargets 4 is the
// target and up to 3 more, each taking the full hit.
func (paladin *Paladin) registerHammerOfTheRighteous() {
	rank := HammerOfTheRighteousRankMap.Highest()
	weaponDPS := rank.EffectN(3).BasePoints
	maxTargets := int32(rank.EffectN(1).ChainTargets)

	paladin.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    rank.DefenseTypeCore(),
		ProcMask:       core.ProcMaskMeleeMHSpecial,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		ClassSpellMask: SpellMaskHammerOfTheRighteous,
		MaxRange:       core.MaxMeleeRange,

		ManaCost: rank.ManaCost(),
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: rank.GCD(),
			},
			CD: core.Cooldown{
				Timer:    paladin.sharedTimer(&paladin.holyStrikeTimer),
				Duration: cooldown(rank),
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			baseDamage := weaponDPS * paladin.AutoAttacks.MH().DPS()
			spell.CalcAndDealCleaveDamage(sim, target, maxTargets, baseDamage, spell.OutcomeMeleeSpecialHitAndCrit)
		},
	})
}
