package mage

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
	"github.com/wowsims/forever/sim/core/stats"
)

// The chosen armor is up for the whole fight. Forever has no Molten Armor, so that option, like None,
// applies nothing; Frost Armor picks the top rank of the line, Ice Armor.
func (mage *Mage) registerArmorSpells() {
	var armorRank *spelldata.Spell
	var buff stats.Stats
	var label string
	castingRegen := 0.0

	switch mage.Options.DefaultMageArmor {
	case proto.MageArmor_MageArmorFrostArmor:
		armorRank = spellData.IceArmor.Highest()
		label = "Ice Armor"
		buff = stats.Stats{
			stats.Armor:           armorRank.Effect(dbcenums.A_MOD_RESISTANCE, 1).Average(core.CharacterLevel),
			stats.FrostResistance: armorRank.Effect(dbcenums.A_MOD_RESISTANCE, 16).Average(core.CharacterLevel),
		}
	case proto.MageArmor_MageArmorMageArmor:
		armorRank = spellData.MageArmor.Highest()
		label = "Mage Armor"
		resist := armorRank.Effect(dbcenums.A_MOD_RESISTANCE, 126).Average(core.CharacterLevel)
		buff = stats.Stats{
			stats.ArcaneResistance: resist,
			stats.FireResistance:   resist,
			stats.FrostResistance:  resist,
			stats.NatureResistance: resist,
			stats.ShadowResistance: resist,
		}
		castingRegen = armorRank.Effect(dbcenums.A_MOD_MANA_REGEN_INTERRUPT, 0).Average(core.CharacterLevel) / 100
	default:
		return
	}

	core.MakePermanent(mage.RegisterAura(core.Aura{
		Label:    label,
		ActionID: core.ActionID{SpellID: armorRank.ID},
		OnGain: func(_ *core.Aura, _ *core.Simulation) {
			mage.PseudoStats.SpiritRegenRateCasting += castingRegen
			mage.UpdateManaRegenRates()
		},
		OnExpire: func(_ *core.Aura, _ *core.Simulation) {
			mage.PseudoStats.SpiritRegenRateCasting -= castingRegen
			mage.UpdateManaRegenRates()
		},
	}).AttachStatsBuff(buff))
}
