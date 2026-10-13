package core

import "testing"

// A proc trigger that names its spells by the client's class flags fires on exactly those spells.
func TestProcTriggerClassFlags(t *testing.T) {
	config := ProcTrigger{ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{0b0011}}}

	tests := []struct {
		name  string
		spell *Spell
		want  bool
	}{
		{"overlapping mask", &Spell{ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{0b0010}}}, true},
		{"disjoint mask in the same family", &Spell{ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{0b0100}}}, false},
		{"same mask in another family", &Spell{ClassFlags: ClassFlags{Family: 3, Mask: [4]uint32{0b0011}}}, false},
		{"no class flags at all", &Spell{}, false},
	}

	for _, test := range tests {
		if got := config.matchesSpell(test.spell); got != test.want {
			t.Errorf("%s: matchesSpell = %v, want %v", test.name, got, test.want)
		}
	}
}

// A trigger that sets both masks fires only on the spells both name.
func TestProcTriggerWithBothMasksRequiresBoth(t *testing.T) {
	config := ProcTrigger{
		ClassSpellMask: 1 << 2,
		ClassFlags:     ClassFlags{Family: 8, Mask: [4]uint32{0b0001}},
	}

	tests := []struct {
		name  string
		spell *Spell
		want  bool
	}{
		{"both", &Spell{ClassSpellMask: 1 << 2, ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{0b0001}}}, true},
		{"only the sim tag", &Spell{ClassSpellMask: 1 << 2}, false},
		{"only the class flags", &Spell{ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{0b0001}}}, false},
	}

	for _, test := range tests {
		if got := config.matchesSpell(test.spell); got != test.want {
			t.Errorf("%s: matchesSpell = %v, want %v", test.name, got, test.want)
		}
	}
}

// Only Proc From Class Abilities asks whether the spell is a class ability at all, which either
// mask answers.
func TestProcTriggerClassSpellsOnly(t *testing.T) {
	config := ProcTrigger{ClassSpellsOnly: true}

	tests := []struct {
		name  string
		spell *Spell
		want  bool
	}{
		{"tagged by the sim", &Spell{ClassSpellMask: 1 << 5}, true},
		{"named by the client's class flags", &Spell{ClassFlags: ClassFlags{Family: 8, Mask: [4]uint32{1}}}, true},
		{"neither", &Spell{}, false},
	}

	for _, test := range tests {
		if got := config.matchesSpell(test.spell); got != test.want {
			t.Errorf("%s: matchesSpell = %v, want %v", test.name, got, test.want)
		}
	}
}
