package core

import (
	"testing"
)

const fakeThreatSpellClassMask int64 = 1 << 0

var fakeThreatSpellActionID = ActionID{SpellID: 11597}

func (fw *FakeRageWarrior) registerFakeThreatSpell() {
	fw.RegisterSpell(SpellConfig{
		ActionID:        fakeThreatSpellActionID,
		ClassSpellMask:  fakeThreatSpellClassMask,
		FlatThreatBonus: 100,
	})
}

func TestFlatThreatBonusPctMod(t *testing.T) {
	sim := SetupFakeRageSim()
	fw := sim.Raid.Parties[0].Players[0].(*FakeRageWarrior)
	spell := fw.GetSpell(fakeThreatSpellActionID)
	attackTable := fw.AttackTables[sim.Encounter.ActiveTargetUnits[0].UnitIndex]

	threat := spell.ThreatFromDamage(sim, OutcomeHit, 0, attackTable)
	if !WithinToleranceFloat64(100, threat, 0.001) {
		t.Fatalf("Incorrect threat without a mod: Expected: %0.3f, Actual: %0.3f", 100.0, threat)
	}

	mod := fw.AddDynamicMod(SpellModConfig{
		ClassMask:  fakeThreatSpellClassMask,
		Kind:       SpellMod_FlatThreatBonus_Pct,
		FloatValue: 0.15,
	})

	mod.Activate()
	threat = spell.ThreatFromDamage(sim, OutcomeHit, 0, attackTable)
	if !WithinToleranceFloat64(115, threat, 0.001) {
		t.Fatalf("Incorrect threat with the mod active: Expected: %0.3f, Actual: %0.3f", 115.0, threat)
	}

	mod.Deactivate()
	threat = spell.ThreatFromDamage(sim, OutcomeHit, 0, attackTable)
	if !WithinToleranceFloat64(100, threat, 0.001) {
		t.Fatalf("Incorrect threat after the mod was removed: Expected: %0.3f, Actual: %0.3f", 100.0, threat)
	}
}

// A mod that names its spells by the client's class flags reaches exactly those spells: the
// family has to agree and the masks have to overlap.
func TestClassFlagsModMatching(t *testing.T) {
	mod := &SpellMod{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b0110}}}

	tests := []struct {
		name  string
		spell *Spell
		want  bool
	}{
		{"overlapping mask", &Spell{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b0100}}}, true},
		{"disjoint mask in the same family", &Spell{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b1000}}}, false},
		{"same mask in another family", &Spell{ClassFlags: ClassFlags{Family: 9, Mask: [4]uint32{0b0110}}}, false},
		{"overlap in a later word", &Spell{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0, 1}}}, false},
		{"no class flags at all", &Spell{}, false},
	}

	for _, test := range tests {
		if got := shouldApply(test.spell, mod); got != test.want {
			t.Errorf("%s: shouldApply = %v, want %v", test.name, got, test.want)
		}
	}
}

// The two masks are separate filters, so a mod that sets both applies only where both name the
// spell.
func TestModWithBothMasksRequiresBoth(t *testing.T) {
	mod := &SpellMod{
		ClassMask:  1 << 3,
		ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b0001}},
	}

	tests := []struct {
		name  string
		spell *Spell
		want  bool
	}{
		{"both", &Spell{ClassSpellMask: 1 << 3, ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b0001}}}, true},
		{"only the sim tag", &Spell{ClassSpellMask: 1 << 3}, false},
		{"only the class flags", &Spell{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{0b0001}}}, false},
	}

	for _, test := range tests {
		if got := shouldApply(test.spell, mod); got != test.want {
			t.Errorf("%s: shouldApply = %v, want %v", test.name, got, test.want)
		}
	}
}

// A mod that names no spells at all still applies to every spell, so adding the class flags
// filter cannot change any existing mod.
func TestModWithoutMasksAppliesToEverything(t *testing.T) {
	mod := &SpellMod{}
	if !shouldApply(&Spell{ClassFlags: ClassFlags{Family: 4, Mask: [4]uint32{1}}}, mod) {
		t.Error("an unfiltered mod should apply to a spell that carries class flags")
	}
}
