package shaman

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/spelldata"
)

var LightningBoltRankMap = spellData.LightningBolt

// Lightning Overload's second bolt, one client row per Lightning Bolt rank (same levels, no threat).
// Its damage and coefficient are its own, so the sim reads them rather than halving the rank's.
// Client 1.60.1.70205; the talent 408438 is a dummy aura, the server picks the row.
var lightningBoltOverloadRanks = spelldata.Ranked(408439, 408440, 408441, 408442, 408443, 408472, 408473, 408474, 408475, 408477)

func (shaman *Shaman) registerLightningBoltSpell() {
	shaman.LightningBoltOverloads = make(map[int32]*core.Spell, LightningBoltRankMap.Len())
	LightningBoltRankMap.Each(func(rank int32, config *spelldata.Spell) {
		shaman.RegisterSpell(shaman.newLightningBoltSpellConfig(config, rank, false))
		shaman.LightningBoltOverloads[rank] = shaman.RegisterSpell(shaman.newLightningBoltSpellConfig(config, rank, true))
	})
}

func (shaman *Shaman) newLightningBoltSpellConfig(config *spelldata.Spell, rank int32, isElementalOverload bool) core.SpellConfig {
	damage := config.DamageEffect()
	if isElementalOverload {
		damage = lightningBoltOverloadRanks.Rank(rank).DamageEffect()
	}
	shamConfig := ShamSpellConfig{
		ActionID:            core.ActionID{SpellID: config.ID},
		Rank:                rank,
		IsElementalOverload: isElementalOverload,
		BaseFlatCost:        int32(config.Cost()),
		BonusCoefficient:    damage.Coeff(),
		BaseCastTime:        config.CastTime(),
	}
	spellConfig := shaman.newElectricSpellConfig(shamConfig)

	spellConfig.ClassSpellMask = core.TernaryInt64(isElementalOverload, SpellMaskLightningBoltOverload, SpellMaskLightningBolt)
	spellConfig.MissileSpeed = 20
	if !isElementalOverload {
		spellConfig.MaxRange = float64(config.MaxRange)
	}

	spellConfig.ApplyEffects = func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
		baseDamage := damage.Roll(sim, core.CharacterLevel)
		result := spell.CalcDamage(sim, target, baseDamage, spell.OutcomeMagicHitAndCrit)

		spell.WaitTravelTime(sim, func(sim *core.Simulation) {
			if !isElementalOverload && result.Landed() && sim.Proc(shaman.GetOverloadChance(), "Lightning Bolt Elemental Overload") {
				shaman.LightningBoltOverloads[rank].Cast(sim, target)
			}

			spell.DealDamage(sim, result)
		})
	}

	return spellConfig
}
