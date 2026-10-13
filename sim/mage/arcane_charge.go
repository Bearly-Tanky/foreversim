package mage

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
)

// Forever's Arcane Blast buff (400573): each stack raises the damage of the mage's other spells and
// the cost of Arcane Blast itself. The next other damaging spell spends every stack; Arcane Missiles
// spends them as its channel starts (arcane_missiles.go).
func (mage *Mage) registerArcaneCharges() {
	if !mage.Talents.ArcaneBlast {
		return
	}

	buffRank := spellData.ArcaneBlastTriggered.Highest()
	damagePerStack := buffRank.Effect(dbcenums.A_ADD_PCT_MODIFIER, int32(dbcenums.SPELLMOD_DAMAGE)).Average(core.CharacterLevel) / 100
	costPerStack := buffRank.Effect(dbcenums.A_ADD_PCT_MODIFIER, int32(dbcenums.SPELLMOD_COST)).Average(core.CharacterLevel) / 100

	// 400573's damage mask names every mage damage spell but Arcane Blast, Arcane Missiles, Blizzard
	// and Flamestrike, whatever its tooltip says. Its DoT mask names Fireball and Frostfire Bolt only,
	// so Pyroblast's hit takes the bonus and its DoT does not.
	damageMod := mage.AddDynamicMod(core.SpellModConfig{
		ClassMask: MageSpellsAllDamaging &^ (MageSpellArcaneBlast | MageSpellArcaneMissiles | MageSpellBlizzard | MageSpellFlamestrike | MageSpellPyroblast),
		Kind:      core.SpellMod_DamageDone_Flat,
	})
	pyroblastMod := mage.AddDynamicMod(core.SpellModConfig{
		ClassMask: MageSpellPyroblast,
		Kind:      core.SpellMod_DirectDamageDone_Flat,
	})
	costMod := mage.AddDynamicMod(core.SpellModConfig{
		ClassMask: MageSpellArcaneBlast,
		Kind:      core.SpellMod_PowerCost_Pct_Add,
	})

	mage.ArcaneBlastAura = mage.RegisterAura(core.Aura{
		Label:     "Arcane Blast",
		ActionID:  core.ActionID{SpellID: buffRank.ID},
		Duration:  buffRank.Duration(),
		MaxStacks: int32(buffRank.MaxStack),
		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			damageMod.Activate()
			pyroblastMod.Activate()
			costMod.Activate()
		},
		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			damageMod.Deactivate()
			pyroblastMod.Deactivate()
			costMod.Deactivate()
		},
		OnStacksChange: func(_ *core.Aura, _ *core.Simulation, _ int32, newStacks int32) {
			damageMod.UpdateFloatValue(damagePerStack * float64(newStacks))
			pyroblastMod.UpdateFloatValue(damagePerStack * float64(newStacks))
			costMod.UpdateFloatValue(costPerStack * float64(newStacks))
		},
		OnCastComplete: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell) {
			// OnCastComplete runs after the damage is rolled, so the spell that drops the stacks is
			// still buffed by them.
			if spell.Matches(MageSpellsAllDamaging &^ (MageSpellArcaneBlast | MageSpellArcaneMissiles)) {
				aura.Deactivate(sim)
			}
		},
	})
}
