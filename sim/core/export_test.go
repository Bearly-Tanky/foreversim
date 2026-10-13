package core

import (
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// The internals the tests of the generated buffs read. Those tests sit in package core_test, beside
// this file, because they import sim/core/buffs, which imports core; that import is also what
// registers the buff hooks for every other test in this directory.

func NewGeneratedBuffTestCharacter() *Character {
	char := &Character{
		Unit: Unit{
			Type:        PlayerUnit,
			Level:       60,
			auraTracker: newAuraTracker(),
			Env:         &Environment{},
		},
	}
	char.PseudoStats = stats.NewPseudoStats()
	return char
}

func NewGeneratedDebuffTestTarget() *Unit {
	target := &Unit{
		Type:        EnemyUnit,
		Index:       0,
		Level:       63,
		auraTracker: newAuraTracker(),
		Env:         &Environment{MeasuringStats: true},
	}
	target.PseudoStats = stats.NewPseudoStats()
	return target
}

func ApplyBuffEffects(agent Agent, raid *proto.RaidBuffs, party *proto.PartyBuffs, individual *proto.IndividualBuffs) {
	applyBuffEffects(agent, raid, party, individual)
}

func ApplyDebuffEffects(target *Unit, debuffs *proto.Debuffs, raid *proto.Raid) {
	applyDebuffEffects(target, 0, debuffs, raid)
}

func (character *Character) ApplyBuildPhaseAuras(phase CharacterBuildPhase) {
	character.applyBuildPhaseAuras(phase)
}

func (unit *Unit) SetStats(s stats.Stats) {
	unit.stats = s
}

func (category *ExclusiveCategory) Effects() []*ExclusiveEffect {
	return category.effects
}
