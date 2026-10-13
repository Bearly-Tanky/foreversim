package core

import (
	"slices"
	"testing"
)

// Masks taken from the client rows named in each case.
func TestDecodeProcTypeMask(t *testing.T) {
	cases := []struct {
		name               string
		mask               [2]uint32
		hint               ProcHint
		callback           AuraCallback
		procMask           ProcMask
		outcome            HitOutcome
		requireDamageDealt bool
		unsupported        []string
	}{
		{
			name:               "Lightning Shield, every direct hit taken",
			mask:               [2]uint32{0x222A8, 0},
			callback:           CallbackOnSpellHitTaken,
			procMask:           ProcMaskMeleeWhiteHit | ProcMaskMeleeSpecial | ProcMaskRangedAuto | ProcMaskRangedSpecial | ProcMaskSpellDamage,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:     "Striking, the harmful-spell bit alone",
			mask:     [2]uint32{0x10000, 0},
			callback: CallbackOnCastComplete,
			procMask: ProcMaskSpellDamage,
			outcome:  OutcomeEmpty,
		},
		{
			name:     "the damage-class-none bit beside the harmful-spell one, the same cast either way",
			mask:     [2]uint32{0x11000, 0},
			callback: CallbackOnCastComplete,
			procMask: ProcMaskSpellDamage,
			outcome:  OutcomeEmpty,
		},
		{
			name:               "the harmful-ability bit taken, which names no hits of its own",
			mask:               [2]uint32{0x2000, 0},
			callback:           CallbackOnSpellHitTaken,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:     "the harmful-spell bit with a crit tooltip",
			mask:     [2]uint32{0x10000, 0},
			hint:     ProcHintCrit,
			callback: CallbackOnSpellHitDealt,
			procMask: ProcMaskSpellDamage,
			outcome:  OutcomeCrit,
		},
		{
			name:               "Dual Wield Specialization, melee swings restricted to the off hand",
			mask:               [2]uint32{0x800004, 0},
			callback:           CallbackOnSpellHitDealt,
			procMask:           ProcMaskMeleeOHAuto,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:               "Bloodthrill, melee swings and abilities from the main hand alone",
			mask:               [2]uint32{0x14, 0x20},
			callback:           CallbackOnSpellHitDealt,
			procMask:           ProcMaskMeleeMH,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:               "the unknown top bit",
			mask:               [2]uint32{0x80000000, 0},
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
			unsupported:        []string{"bit 31"},
		},
		{
			name:     "Darkmoon Card: Blue Dragon, a cast tooltip on both spell bits",
			mask:     [2]uint32{0x14000, 0},
			hint:     ProcHintCastTrigger,
			callback: CallbackOnCastComplete,
			procMask: ProcMaskSpellDamage | ProcMaskSpellHealing,
			outcome:  OutcomeEmpty,
		},
		{
			name:     "both spell bits with a heal tooltip",
			mask:     [2]uint32{0x14000, 0},
			hint:     ProcHintHeals,
			callback: CallbackOnSpellHitDealt | CallbackOnHealDealt,
			procMask: ProcMaskSpellDamage | ProcMaskSpellHealing,
			outcome:  OutcomeLanded,
		},
		{
			name:     "Grand Arcanist 1231152, both spell bits on a row with no tooltip",
			mask:     [2]uint32{0x14000, 0},
			callback: CallbackOnSpellHitDealt | CallbackOnHealDealt,
			procMask: ProcMaskSpellDamage | ProcMaskSpellHealing,
			outcome:  OutcomeLanded,
		},
		{
			name:     "Clearcasting 12536, every dealt hit and both spell bits with no heal tooltip",
			mask:     [2]uint32{0x15550, 0},
			callback: CallbackOnSpellHitDealt | CallbackOnHealDealt,
			procMask: ProcMaskMeleeSpecial | ProcMaskRangedAuto | ProcMaskRangedSpecial | ProcMaskSpellDamage | ProcMaskSpellHealing,
			outcome:  OutcomeLanded,
		},
		{
			name:     "the helpful bits with a healing-spells tooltip",
			mask:     [2]uint32{0x204000, 0},
			hint:     ProcHintHeals | ProcHintPureHeal,
			callback: CallbackOnHealDealt | CallbackOnPeriodicHealDealt,
			procMask: ProcMaskSpellHealing,
			outcome:  OutcomeLanded,
		},
		{
			name:     "the helpful-spell bit alone with a heal tooltip",
			mask:     [2]uint32{0x4000, 0},
			hint:     ProcHintHeals,
			callback: CallbackOnHealDealt,
			procMask: ProcMaskSpellHealing,
			outcome:  OutcomeLanded,
		},
		{
			name:               "Holy Power 28789, the helpful-spell bit alone with no heal tooltip",
			mask:               [2]uint32{0x4000, 0},
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:               "periodic damage taken",
			mask:               [2]uint32{0x80000, 0},
			callback:           CallbackOnPeriodicDamageTaken,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:               "any damage taken",
			mask:               [2]uint32{0x100000, 0},
			callback:           CallbackOnSpellHitTaken | CallbackOnPeriodicDamageTaken,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:               "a named ability, the hint the decoder leaves to the caller",
			mask:               [2]uint32{0x222A8, 0},
			hint:               ProcHintNamedAbility,
			callback:           CallbackOnSpellHitTaken,
			procMask:           ProcMaskMeleeWhiteHit | ProcMaskMeleeSpecial | ProcMaskRangedAuto | ProcMaskRangedSpecial | ProcMaskSpellDamage,
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
		},
		{
			name:     "Battlegear of Wrath 23548, whose trigger is a block",
			mask:     [2]uint32{0x2A8, 0},
			hint:     ProcHintOutcomeTaken,
			callback: CallbackOnSpellHitTaken,
			procMask: ProcMaskMeleeWhiteHit | ProcMaskMeleeSpecial | ProcMaskRangedAuto | ProcMaskRangedSpecial,
			outcome:  OutcomeLanded,
		},
		{
			name:     "Recovery 1248761, whose trigger is the wearer's melee attack dodged or parried",
			mask:     [2]uint32{0x14, 0},
			hint:     ProcHintAttackDodged | ProcHintAttackParried,
			callback: CallbackOnSpellHitDealt,
			procMask: ProcMaskMeleeWhiteHit | ProcMaskMeleeSpecial,
			outcome:  OutcomeDodge | OutcomeParry,
		},
		{
			name:     "the wearer's attack parried alone",
			mask:     [2]uint32{0x14, 0},
			hint:     ProcHintAttackParried,
			callback: CallbackOnSpellHitDealt,
			procMask: ProcMaskMeleeWhiteHit | ProcMaskMeleeSpecial,
			outcome:  OutcomeParry,
		},
		{
			name:               "a word-1 bit",
			mask:               [2]uint32{0, 0x4},
			outcome:            OutcomeLanded,
			requireDamageDealt: true,
			unsupported:        []string{"bit 34"},
		},
	}

	for _, tc := range cases {
		info := DecodeProcTypeMask(tc.mask, tc.hint)

		if info.Callback != tc.callback {
			t.Errorf("%s: Callback = %v, want %v", tc.name, info.Callback, tc.callback)
		}
		if info.ProcMask != tc.procMask {
			t.Errorf("%s: ProcMask = %v, want %v", tc.name, info.ProcMask, tc.procMask)
		}
		if info.Outcome != tc.outcome {
			t.Errorf("%s: Outcome = %d, want %d", tc.name, info.Outcome, tc.outcome)
		}
		if info.RequireDamageDealt != tc.requireDamageDealt {
			t.Errorf("%s: RequireDamageDealt = %v, want %v", tc.name, info.RequireDamageDealt, tc.requireDamageDealt)
		}
		if !slices.Equal(info.Unsupported, tc.unsupported) {
			t.Errorf("%s: Unsupported = %v, want %v", tc.name, info.Unsupported, tc.unsupported)
		}
	}
}
