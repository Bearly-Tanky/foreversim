package core

import (
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// Forever gives the gathering professions a combat passive. Only the two with a published
// number are modelled: Skinning's 5% damage to Beasts and Dragonkin, and Mining's 5% health.
// Herbalism's is a heal over time, which the sim does not measure.
func (character *Character) applyProfessionEffects() {
	if character.HasProfession(proto.Profession_Skinning) {
		character.Env.RegisterPostFinalizeEffect(func() {
			for _, at := range character.AttackTables {
				if at.Defender.MobType == proto.MobType_MobTypeBeast || at.Defender.MobType == proto.MobType_MobTypeDragonkin {
					at.DamageDealtMultiplier *= 1.05
				}
			}
		})
	}

	if character.HasProfession(proto.Profession_Mining) {
		character.MultiplyStat(stats.Health, 1.05)
	}
}
