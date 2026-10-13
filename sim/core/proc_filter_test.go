package core

import "testing"

// The game's proc eligibility rules, as AttachProcTriggerCallback applies them before any mask
// or outcome check. Rows are the hitting spell, columns the listener.
func TestProcTriggerEligibility(t *testing.T) {
	triggers := []struct {
		name  string
		flags SpellFlag
	}{
		{"auto attack", SpellFlagNone},
		{"ability", SpellFlagNone},
		{"proc", SpellFlagProc},
		{"proc suppressing weapon procs", SpellFlagProc | SpellFlagSuppressWeaponProcs},
		{"ability suppressing weapon procs", SpellFlagSuppressWeaponProcs},
	}
	listeners := []struct {
		name   string
		config ProcTrigger
		// One expectation per trigger above.
		want [5]bool
	}{
		{"aura", ProcTrigger{}, [5]bool{true, true, false, false, true}},
		{"aura that can proc from procs", ProcTrigger{CanProcFromProcs: true}, [5]bool{true, true, true, true, true}},
		{"weapon proc", ProcTrigger{IsWeaponProc: true}, [5]bool{true, true, true, false, false}},
		{"aura marked as weapon proc", ProcTrigger{SpellFlagsExclude: SpellFlagSuppressWeaponProcs}, [5]bool{true, true, false, false, false}},
	}

	for _, listener := range listeners {
		for i, trigger := range triggers {
			unit := &Unit{}
			aura := &Aura{Unit: unit}
			spell := &Spell{ProcMask: ProcMaskMeleeMHSpecial, Flags: trigger.flags}
			result := &SpellResult{Outcome: OutcomeHit}
			fired := false

			config := listener.config
			config.Callback = CallbackOnSpellHitDealt
			config.Outcome = OutcomeLanded
			config.TriggerImmediately = true
			config.Handler = func(_ *Simulation, _ *Spell, _ *SpellResult) { fired = true }
			aura.AttachProcTriggerCallback(unit, config)
			aura.OnSpellHitDealt(aura, nil, spell, result)

			if fired != listener.want[i] {
				t.Errorf("%s hit by %s: fired=%v, want %v", listener.name, trigger.name, fired, listener.want[i])
			}
		}
	}
}
