package warlock

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

// Life Tap is a plain mana gain, not damage: 11689 converts ($m1 (424) + Spirit) * (1 + Improved
// Life Tap 18182) health into as much mana (the build 70009 tooltip states both sides that way), so
// no damage done / taken modifier touches either side. The client flags every rank No Threat
// (1.60.1.70205 SpellMisc Attributes[1] 0x400), so the mana adds no threat, the pet's share neither. Demonic Energies hands the pet a share of the restore (the talent's second effect,
// 50% per point).
func (warlock *Warlock) registerLifeTap() {
	rank := spellData.LifeTap.Highest()
	actionID := core.ActionID{SpellID: rank.ID}
	baseAmount := rank.EffectN(1).Average(core.CharacterLevel)
	manaMultiplier := 1 + spellData.ImprovedLifeTap.FractionAt(warlock.Talents.ImprovedLifeTap)
	petManaShare := spellData.DemonicEnergies.EffectAt(2).FractionAt(warlock.Talents.DemonicEnergies)

	manaMetrics := warlock.NewManaMetrics(actionID)
	manaMetrics.NoThreat = rank.NoThreat()
	petManaMetrics := make(map[*WarlockPet]*core.ResourceMetrics, len(warlock.BasePets))
	for _, pet := range warlock.BasePets {
		petManaMetrics[pet] = pet.NewManaMetrics(actionID)
		petManaMetrics[pet].NoThreat = rank.NoThreat()
	}

	warlock.LifeTap = warlock.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    core.DefenseTypeMagic,
		ProcMask:       core.ProcMaskSpellDamage,
		Flags:          core.SpellFlagAPL,
		ClassSpellMask: WarlockSpellLifeTap,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.GCDDefault,
			},
		},

		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			restore := (baseAmount + warlock.GetStat(stats.Spirit)) * manaMultiplier
			warlock.RemoveHealth(sim, restore)
			warlock.AddMana(sim, restore, manaMetrics)

			if petManaShare > 0 && warlock.ActivePet != nil {
				warlock.ActivePet.AddMana(sim, restore*petManaShare, petManaMetrics[warlock.ActivePet])
			}
		},
	})
}
