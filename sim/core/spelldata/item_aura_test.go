package spelldata

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core/dbcenums"
)

func itemAuraEffect(index uint8, aura dbcenums.EffectAuraType, misc int32, points float64, target dbcenums.ImplicitTarget) Effect {
	return Effect{Index: index, Type: dbcenums.E_APPLY_AURA, Aura: aura, Misc: misc, BasePoints: points,
		Target: [2]dbcenums.ImplicitTarget{target}}
}

// 7000 is Nature Aligned 23734's three effects on the wearer; the others each put one refusal in.
func itemAuraRows() []Spell {
	return append(parseRows(),
		Spell{ID: 7000, Name: "Wearer Aura", DurationMs: 20000, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_DAMAGE_PERCENT_DONE, miscMagicSchool, 20, dbcenums.TARGET_UNIT_CASTER),
			itemAuraEffect(1, dbcenums.A_MOD_HEALING_DONE_PERCENT, miscMagicSchool, 20, dbcenums.TARGET_UNIT_CASTER),
			itemAuraEffect(2, dbcenums.A_MOD_POWER_COST_SCHOOL_PCT, miscMagicSchool, 20, dbcenums.TARGET_UNIT_CASTER),
		}},
		Spell{ID: 7100, Name: "Mixed Aura", DurationMs: 5000, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_DAMAGE_PERCENT_TAKEN, miscMagicSchool, 15, dbcenums.TARGET_UNIT_TARGET_ENEMY),
			itemAuraEffect(1, dbcenums.A_MOD_DAMAGE_PERCENT_DONE, miscAllSchools, 3, dbcenums.TARGET_UNIT_PET),
			itemAuraEffect(2, dbcenums.A_MOD_DAMAGE_DONE, 1, 10, dbcenums.TARGET_UNIT_CASTER),
		}},
		Spell{ID: 7200, Name: "Pet Armor", DurationMs: 4000, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_BASE_RESISTANCE_PCT, miscArmor, 10, dbcenums.TARGET_UNIT_PET),
		}},
		Spell{ID: 7300, Name: "Keeps Pet Armor Up", Effects: []Effect{
			{Type: dbcenums.E_APPLY_AURA, Aura: dbcenums.A_PERIODIC_TRIGGER_SPELL, PeriodMs: 3000, TriggerID: 7200},
		}},
		Spell{ID: 7400, Name: "Lets It Lapse", Effects: []Effect{
			{Type: dbcenums.E_APPLY_AURA, Aura: dbcenums.A_PERIODIC_TRIGGER_SPELL, PeriodMs: 5000, TriggerID: 7200},
		}},
		Spell{ID: 7500, Name: "Aura And Damage", DurationMs: 10000, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_DAMAGE_PERCENT_DONE, miscAllSchools, 5, dbcenums.TARGET_UNIT_CASTER),
			{Index: 1, Type: dbcenums.E_SCHOOL_DAMAGE, BasePoints: 100, Target: [2]dbcenums.ImplicitTarget{dbcenums.TARGET_UNIT_TARGET_ENEMY}},
			itemAuraEffect(2, dbcenums.A_MOD_DAMAGE_PERCENT_DONE, miscAllSchools, 5, dbcenums.TARGET_UNIT_NEARBY_ALLY),
		}},
		Spell{ID: 7600, Name: "Forest Aura", DurationMs: -1, RequiredAreas: 9161, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_DAMAGE_TAKEN, miscMagicSchool, -10, dbcenums.TARGET_UNIT_CASTER),
		}},
		Spell{ID: 7700, Name: "Arena Aura", DurationMs: -1, RequiredAreas: 9337, Effects: []Effect{
			itemAuraEffect(0, dbcenums.A_MOD_DAMAGE_PERCENT_TAKEN, miscAllSchools, -6, dbcenums.TARGET_UNIT_CASTER),
		}},
	)
}

func TestEffectsOnSplitsTheRowByTarget(t *testing.T) {
	withRows(t, itemAuraRows())
	row := Find(7100)

	for target, want := range map[AuraTarget][]int32{AuraOnEnemy: {1}, AuraOnPet: {2}, AuraOnWearer: {3}} {
		if got := EffectsOn(row, target); !slices.Equal(got, want) {
			t.Errorf("effects on %s: %v, want %v", auraTargetNames[target], got, want)
		}
	}
}

// A periodic trigger keeps its aura up only where the aura outlasts the period.
func TestEquipAuraRowFollowsATriggerThatKeepsItUp(t *testing.T) {
	withRows(t, itemAuraRows())

	if got := EquipAuraRow(Find(7300)).ID; got != 7200 {
		t.Errorf("a 3 s trigger of a 4 s aura resolved to %d, want the aura 7200", got)
	}
	if got := EquipAuraRow(Find(7400)).ID; got != 7400 {
		t.Errorf("a 5 s trigger of a 4 s aura resolved to %d, want the trigger itself", got)
	}
	if got := EquipAuraRow(Find(7000)).ID; got != 7000 {
		t.Errorf("a row of plain auras resolved to %d, want itself", got)
	}
}

func TestItemAuraUnsupported(t *testing.T) {
	withRows(t, itemAuraRows())

	for _, c := range []struct {
		name     string
		id       int32
		equipped bool
		want     []string
	}{
		{"wearer auras", 7000, false, nil},
		{"auras on every target", 7100, false, nil},
		{"an enemy aura while worn", 7100, true, []string{"effect 1 lands on an enemy while the item is worn"}},
		{"pet armor", 7200, true, []string{"effect 1 A_MOD_BASE_RESISTANCE_PCT misc 1 is not parsed on a pet"}},
		{"damage and an ally", 7500, false, []string{"effect 2 is E_SCHOOL_DAMAGE", "effect 3 lands on implicit target 3"}},
		{"no duration", 7300, false, []string{"the row states no duration", "effect 1 lands on implicit target 0"}},
		{"a terrain area", 7600, true, nil},
		{"a single zone", 7700, true, []string{"the row applies only in area group 9337, which names no area type"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := ItemAuraUnsupported(Find(c.id), c.equipped); !slices.Equal(got, c.want) {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}
