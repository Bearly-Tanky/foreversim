package paladin

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
	"github.com/wowsims/forever/sim/core/spelldata"
)

var RetributionAuraRankMap = spellData.RetributionAura

// Retribution Aura
// https://www.wowhead.com/forever/spell=10301
//
// Causes 30 Holy damage to any creature that strikes a party member within 30 yards. Players may
// only have one Aura on them per Paladin at any one time.
func (paladin *Paladin) registerRetributionAura() {
	RetributionAuraRankMap.Each(func(_ int32, rank *spelldata.Spell) {
		// The damage shield's number is the rank's first effect.
		r := auraRank(rank)
		r.Value = rank.EffectN(1).Average(core.CharacterLevel)
		aura := buffs.RetributionAuraBuff(&paladin.Character, true, r)
		paladin.registerAuraSpell(rank, aura, SpellMaskRetributionAura)
	})
}
