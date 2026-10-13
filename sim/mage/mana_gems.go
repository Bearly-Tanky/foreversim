package mage

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/spelldata"
)

// One of each gem is carried and all four share the conjured cooldown, so a small gem that goes off
// early spends the whole cooldown. Each gem waits until every larger one has been used, which
// leaves the biggest for the first deficit that can hold it.
func (mage *Mage) registerManaGems() {
	gems := []struct {
		itemID int32
		row    *spelldata.Spell
	}{
		{5514, spellData.ConjureManaAgateTriggered.Highest()},
		{5513, spellData.ConjureManaJadeTriggered.Highest()},
		{8007, spellData.ConjureManaCitrineTriggered.Highest()},
		{8008, spellData.ConjureManaRubyTriggered.Highest()},
	}

	used := make([]bool, len(gems))
	mage.RegisterResetEffect(func(_ *core.Simulation) {
		clear(used)
	})

	largerGemLeft := func(idx int) bool {
		for larger := idx + 1; larger < len(gems); larger++ {
			if !used[larger] {
				return true
			}
		}
		return false
	}

	for idx, gem := range gems {
		actionID := core.ActionID{ItemID: gem.itemID}
		manaMetrics := mage.NewManaMetrics(actionID)
		manaGain := gem.row.EnergizeEffect().Average(core.CharacterLevel)

		spell := mage.RegisterSpell(core.SpellConfig{
			ActionID:       actionID,
			Flags:          core.SpellFlagNoOnCastComplete | core.SpellFlagAPL | core.SpellFlagHelpful,
			ClassSpellMask: MageSpellManaGem,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					// Our client-verified 2 minutes (the item's category cooldown); the generated
					// row of the triggered spell states 1 minute.
					Timer:    mage.GetConjuredCD(),
					Duration: time.Minute * 2,
				},
			},

			ExtraCastCondition: func(_ *core.Simulation, _ *core.Unit) bool {
				return !used[idx]
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				mage.AddMana(sim, manaGain, manaMetrics)
				used[idx] = true
			},
		})

		mage.AddMajorCooldown(core.MajorCooldown{
			Spell:    spell,
			Priority: int32(manaGain),
			Type:     core.CooldownTypeMana,
			ShouldActivate: func(_ *core.Simulation, character *core.Character) bool {
				if largerGemLeft(idx) {
					return false
				}
				// Only when the whole gem fits under max mana, one regen tick included.
				totalRegen := character.ManaRegenPerSecondWhileCasting() * 2
				return character.MaxMana()-(character.CurrentMana()+totalRegen) >= manaGain
			},
		})
	}
}
