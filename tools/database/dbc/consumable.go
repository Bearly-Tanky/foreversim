package dbc

import (
	"slices"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

type Consumable struct {
	Id                       int             // Item ID
	Name                     string          // Item name
	ItemLevel                int             // Item level
	RequiredLevel            int             // Required level to use
	ClassId                  int             // Item class ID (should be 0 for consumables)
	SubClassId               ConsumableClass // Item subclass ID
	IconFileDataID           int             // Icon file data ID
	SpellCategoryID          int             // Spell category ID
	SpellCategoryFlags       int             // Spell category flags
	ItemEffects              []int           // Item effect IDs
	ElixirType               int
	Duration                 int                  // In milliseconds
	CooldownDuration         int                  // In milliseconds
	CategoryCooldownDuration int                  // In milliseconds
	TypeOverride             proto.ConsumableType // Classic items the client does not type (overrides.go)
}

func (c *Consumable) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"Id":                 c.Id,
		"Name":               c.Name,
		"ItemLevel":          c.ItemLevel,
		"RequiredLevel":      c.RequiredLevel,
		"ClassId":            c.ClassId,
		"SubClassId":         c.SubClassId,
		"IconFileDataID":     c.IconFileDataID,
		"SpellCategoryID":    c.SpellCategoryID,
		"SpellCategoryFlags": c.SpellCategoryFlags,
		"ItemEffects":        c.ItemEffects,
	}
}

// ToProto converts the Consumable to a proto representation.
func (c *Consumable) ToProto() *proto.Consumable {
	return &proto.Consumable{
		Id:                       int32(c.Id),
		Type:                     c.GetConsumableType(),
		Stats:                    c.GetStatModifiers().ToProtoArray(),
		Name:                     c.Name,
		BuffsMainStat:            false, // Todo: Should be food currently, might be more in MoP, figure out how to tell
		BuffDuration:             int32(c.Duration / 1000),
		CooldownDuration:         int32(c.CooldownDuration / 1000),
		CategoryCooldownDuration: int32(c.CategoryCooldownDuration / 1000),
		CategoryId:               int32(c.SpellCategoryID),
		EffectIds:                c.GetNonStatEffectIds(),
	}
}
func (c *Consumable) GetConsumableType() proto.ConsumableType {
	if c.TypeOverride != proto.ConsumableType_ConsumableTypeUnknown {
		return c.TypeOverride
	}
	if c.SubClassId == ELIXIR {
		switch c.ElixirType {
		case 1:
			return proto.ConsumableType_ConsumableTypeGuardianElixir
		case 2:
			return proto.ConsumableType_ConsumableTypeBattleElixir
		}
	}
	if c.SubClassId == FOOD {
		return proto.ConsumableType_ConsumableTypeFood
	}
	if val, ok := consumableClassToProto[c.SubClassId]; ok {
		return val
	}
	return proto.ConsumableType_ConsumableTypeUnknown
}

func (s ConsumableClass) ToProto() proto.ConsumableType {
	if val, ok := consumableClassToProto[s]; ok {
		return val
	}
	return proto.ConsumableType_ConsumableTypeUnknown
}

// A consumable's effects that restore a resource rather than grant a stat, which the sim wires up
// separately.
var consumableRestoreEffectTypes = map[SpellEffectType]bool{
	dbcenums.E_HEAL:     true,
	dbcenums.E_ENERGIZE: true,
}

func (consumable *Consumable) GetNonStatEffectIds() []int32 {
	var effectIds []int32

	slices.Sort(consumable.ItemEffects)
	for _, effectID := range consumable.ItemEffects {
		effect := GetItemEffect(effectID)
		if effect.ID != 0 {
			if spellEffects, ok := dbcInstance.SpellEffects[effect.SpellID]; ok {
				for _, spellEffect := range spellEffects {
					if consumableRestoreEffectTypes[spellEffect.EffectType] || spellEffect.EffectAura == dbcenums.A_PERIODIC_ENERGIZE || spellEffect.EffectAura == dbcenums.A_PERIODIC_HEAL {
						effectIds = append(effectIds, int32(spellEffect.ID))
					}
					// Aura effects triggered on use (e.g. Fel Mana Potion's spell damage
					// reduction) carry the stats the sim applies as a temporary aura.
					if spellEffect.EffectType == dbcenums.E_TRIGGER_SPELL {
						for _, subEffect := range dbcInstance.SpellEffects[spellEffect.EffectTriggerSpell] {
							if _, ok := subEffect.ParseStatEffect(false, 0); ok {
								effectIds = append(effectIds, int32(subEffect.ID))
							}
						}
					}
				}
			}
		}
	}
	slices.Sort(effectIds)
	return effectIds
}
func (consumable *Consumable) GetStatModifiers() *stats.Stats {
	stats := &stats.Stats{}
	for _, effectID := range consumable.ItemEffects {
		effect := GetItemEffect(effectID)
		if effect.ID != 0 {
			if spellEffects, ok := dbcInstance.SpellEffects[effect.SpellID]; ok {
				for _, spellEffect := range spellEffects {
					stat := consumableEffectStats(spellEffect, 0)
					stats.AddInplace(&stat)
				}
			}
		}
	}
	return stats
}

// A consumable effect's stats, following what Classic and Forever consumables do beyond a plain
// stat aura: Forever's well fed buffs (a 10 s periodic trigger whose value the triggered aura takes
// from the food), triggered buffs (Blessed Sunfruit), +crit% (Elixir of the Mongoose, Grilled
// Squid) and +max mana (Flask of Distilled Wisdom). Kept here rather than in ParseStatEffect so
// item and enchant parsing is unchanged.
func consumableEffectStats(effect SpellEffect, depth int) stats.Stats {
	value := effect.EffectBasePoints + effect.EffectDieSides
	switch {
	case depth < 2 && effect.EffectAura == dbcenums.A_PERIODIC_TRIGGER_SPELL_WITH_VALUE && effect.EffectAuraPeriod == 10000:
		total := stats.Stats{}
		for _, sub := range dbcInstance.SpellEffectsInOrder(effect.EffectTriggerSpell) {
			sub.EffectBasePoints, sub.EffectDieSides = value, 0
			s := consumableEffectStats(sub, depth+1)
			total.AddInplace(&s)
		}
		return total
	case depth < 2 && effect.EffectType == dbcenums.E_TRIGGER_SPELL:
		total := stats.Stats{}
		for _, sub := range dbcInstance.SpellEffectsInOrder(effect.EffectTriggerSpell) {
			s := consumableEffectStats(sub, depth+1)
			total.AddInplace(&s)
		}
		return total
	case effect.EffectAura == dbcenums.A_MOD_CRIT_PCT && effect.EffectType == dbcenums.E_APPLY_AURA:
		return stats.Stats{proto.Stat_StatMeleeCritRating: value * core.PhysicalCritRatingPerCritPercent}
	case effect.EffectAura == dbcenums.A_MOD_MAX_POWER && effect.EffectMiscValues[0] == POWER_TYPE_MANA:
		return stats.Stats{proto.Stat_StatMana: value}
	}
	s, _ := effect.ParseStatEffect(effect.Coefficient != 0, 0)
	return s
}
