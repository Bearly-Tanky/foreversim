package core

import (
	"testing"

	"github.com/wowsims/forever/sim/core/stats"
)

// A buff that bids its whole amount under a category that holds one aura at a
// time, the shape AddGeneratedFlatBonus raises.
func newSingleAuraStatBuff(char *Character, label string, stat stats.Stat, amount float64) *Aura {
	aura := char.GetOrRegisterAura(Aura{
		Label:      label,
		Tag:        label,
		ActionID:   ActionID{SpellID: 100000 + int32(len(char.auras))}.WithTag(-1),
		Duration:   NeverExpires,
		BuildPhase: CharacterBuildPhaseBuffs,
	})
	aura.NewExclusiveEffect(label, true, ExclusiveEffect{
		Priority: amount,
		OnGain: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stat, amount)
		},
		OnExpire: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stat, -amount)
		},
	})
	return aura
}

// A flat bonus the client's buff data does not state raises two numbers that a
// non-stacking buff keeps apart: what the aura applies and what it bids for its
// category. A stacking buff prices the one off the other, so it refuses one.
func TestAddGeneratedFlatBonusRaisesTheBidAndTheAmount(t *testing.T) {
	char := NewGeneratedBuffTestCharacter()

	aura := newSingleAuraStatBuff(char, "Generated Battle Shout", stats.AttackPower, 139)

	AddGeneratedFlatBonus(aura, stats.AttackPower, 139, 30)
	// A second party member wearing the same set asks for the same total.
	AddGeneratedFlatBonus(aura, stats.AttackPower, 139, 30)

	if priority := aura.ExclusiveEffects[0].Priority; priority != 169 {
		t.Errorf("the category effect bids %v, want the client's 139 plus the set's 30", priority)
	}

	MakePermanent(aura)
	char.applyBuildPhaseAuras(CharacterBuildPhaseBuffs)

	if got := char.stats[stats.AttackPower]; got != 169 {
		t.Errorf("the aura applied %v attack power, want the client's 139 plus the set's 30", got)
	}
}

func TestAddGeneratedFlatBonusRefusesAnAuraThatCannotCarryOne(t *testing.T) {
	char := NewGeneratedBuffTestCharacter()

	stacking := char.GetOrRegisterAura(Aura{
		Label:     "Generated Sunder Armor",
		Tag:       "GeneratedArmorReduction",
		ActionID:  ActionID{SpellID: 25225},
		Duration:  NeverExpires,
		MaxStacks: 5,
	})
	stacking.NewExclusiveEffect("GeneratedArmorReduction", true, ExclusiveEffect{})
	assertPanics(t, "a stacking aura", func() {
		AddGeneratedFlatBonus(stacking, stats.Armor, -2600, -30)
	})

	uncontested := char.GetOrRegisterAura(Aura{
		Label:    "Generated Blood Pact",
		ActionID: ActionID{SpellID: 11767}.WithTag(-1),
		Duration: NeverExpires,
	})
	assertPanics(t, "an aura with no category", func() {
		AddGeneratedFlatBonus(uncontested, stats.Stamina, 54, 30)
	})

	contested := newSingleAuraStatBuff(char, "Generated Devotion Aura", stats.Armor, 735)
	assertPanics(t, "a base that is not what the buff bids", func() {
		AddGeneratedFlatBonus(contested, stats.Armor, 620, 30)
	})

	// A category that holds several auras at once never deactivates the one it
	// outbids, so an amount attached to the aura would apply while the effect
	// holding it did not. No generated row has that shape; the guard is for a
	// hand-written one that does.
	shared := char.GetOrRegisterAura(Aura{
		Label:    "Hand-Written Shout",
		Tag:      "GeneratedSharedCategory",
		ActionID: ActionID{SpellID: 25289}.WithTag(-2),
		Duration: NeverExpires,
	})
	shared.NewExclusiveEffect("GeneratedSharedCategory", false, ExclusiveEffect{Priority: 139})
	assertPanics(t, "a category that holds more than one aura", func() {
		AddGeneratedFlatBonus(shared, stats.AttackPower, 139, 30)
	})
}

func assertPanics(t *testing.T, what string, call func()) {
	t.Helper()
	defer func() {
		if recover() == nil {
			t.Errorf("%s took a flat bonus, which it cannot carry", what)
		}
	}()
	call()
}
