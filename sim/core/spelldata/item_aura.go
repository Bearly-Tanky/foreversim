package spelldata

import (
	"fmt"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/proto"
)

// The unit an item's aura effect lands on.
type AuraTarget uint8

const (
	AuraOnWearer AuraTarget = iota + 1
	AuraOnPet
	AuraOnEnemy
)

var auraTargets = map[dbcenums.ImplicitTarget]AuraTarget{
	dbcenums.TARGET_UNIT_CASTER: AuraOnWearer,
	dbcenums.TARGET_UNIT_PET:    AuraOnPet,
}

var auraTargetNames = map[AuraTarget]string{AuraOnWearer: "the wearer", AuraOnPet: "a pet", AuraOnEnemy: "an enemy"}

// Where the effect's aura lands, or 0 for an implicit target an item's aura does not reach. Any enemy
// target is the enemy the item answers or is used on.
func (e *Effect) AuraTarget() AuraTarget {
	if e.HitsAnEnemy() {
		return AuraOnEnemy
	}
	return auraTargets[e.Target[0]]
}

// The positions, counted from 1 the way Effects counts, of the row's aura effects that land on the
// target.
func EffectsOn(s *Spell, target AuraTarget) []int32 {
	var positions []int32
	for i := range s.Effects {
		if AppliesAura(s.Effects[i].Type) && s.Effects[i].AuraTarget() == target {
			positions = append(positions, int32(i+1))
		}
	}
	return positions
}

// The row an equip spell keeps on its targets: the spell itself, or the one its only effect casts on
// a period short enough to keep it up. Beastmaster's Boots' 27206 casts 27205, a 4 s aura on the pet,
// every 3 s.
func EquipAuraRow(s *Spell) *Spell {
	if len(s.Effects) != 1 {
		return s
	}

	e := &s.Effects[0]
	kept := Find(e.TriggerID)
	if e.Aura != dbcenums.A_PERIODIC_TRIGGER_SPELL || e.PeriodMs <= 0 || kept == Nil ||
		(kept.DurationMs >= 0 && kept.DurationMs < e.PeriodMs) {
		return s
	}
	return kept
}

// What an item's aura shape leaves out of a row, one reason per effect: an effect that is not an
// aura, one landing on a unit the shape does not reach, and one the parser skips on the unit it lands
// on; and a row restricted to an area group that names no area type. Empty means every effect of the
// row is attached. An equipped row is parsed the way ParseStatic
// parses it, onto the wearer and its pets; any other is an aura applied for the row's duration.
//
// The parser answers by parsing: each target's effects are parsed onto a character of its own that
// nothing else reads, so the generator and the sim make the same decision.
func ItemAuraUnsupported(s *Spell, equipped bool) []string {
	if s == Nil || len(s.Effects) == 0 {
		return []string{"no row in the store"}
	}

	var unsupported []string
	if !equipped && s.DurationMs == 0 {
		unsupported = append(unsupported, "the row states no duration")
	}
	if s.RequiredAreas != 0 && s.AreaType() == proto.AreaType_AreaTypeUnknown {
		unsupported = append(unsupported, fmt.Sprintf("the row applies only in area group %d, which names no area type", s.RequiredAreas))
	}

	for i := range s.Effects {
		e := &s.Effects[i]
		switch {
		case !AppliesAura(e.Type):
			unsupported = append(unsupported, fmt.Sprintf("effect %d is %v", i+1, e.Type))
		case e.AuraTarget() == 0:
			unsupported = append(unsupported, fmt.Sprintf("effect %d lands on implicit target %d", i+1, e.Target[0]))
		case equipped && e.AuraTarget() == AuraOnEnemy:
			unsupported = append(unsupported, fmt.Sprintf("effect %d lands on an enemy while the item is worn", i+1))
		}
	}

	for _, target := range []AuraTarget{AuraOnWearer, AuraOnPet, AuraOnEnemy} {
		positions := EffectsOn(s, target)
		if len(positions) == 0 || (equipped && target == AuraOnEnemy) {
			continue
		}

		for _, e := range scratchParse(s, target, equipped, positions).Skipped {
			unsupported = append(unsupported, fmt.Sprintf("effect %d %s misc %d is not parsed on %s",
				e.Index+1, auraName(e.Aura), e.Misc, auraTargetNames[target]))
		}
	}

	return unsupported
}

func scratchParse(s *Spell, target AuraTarget, equipped bool, positions []int32) *Parsed {
	scratch := core.NewCharacter(&core.Party{}, 0, &proto.Player{
		Name:      "Item Aura Scratch",
		Race:      proto.Race_RaceOrc,
		Class:     proto.Class_ClassWarrior,
		Spec:      &proto.Player_DpsWarrior{DpsWarrior: &proto.DpsWarrior{}},
		Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{}},
	})

	switch target {
	case AuraOnPet:
		scratch.Unit.Type = core.PetUnit
	case AuraOnEnemy:
		scratch.Unit.Type = core.EnemyUnit
	}

	if equipped {
		return ParseStatic(&scratch, s, Effects(positions...))
	}

	aura := scratch.RegisterAura(AuraConfig(s))
	if target == AuraOnEnemy {
		return ParseEffects(nil, aura, s, Effects(positions...))
	}
	return ParseEffects(&scratch, aura, s, Effects(positions...))
}
