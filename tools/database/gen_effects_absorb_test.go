package database

import (
	"slices"
	"strings"
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
	"github.com/wowsims/forever/tools/database/dbc"
)

func parsedItem(t *testing.T, instance *dbc.DBC, itemID int, spellID int32) (*proto.UIItem, *proto.ItemEffect) {
	t.Helper()
	item := instance.Items[itemID]
	parsed := item.ToUIItem()
	parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)
	i := slices.IndexFunc(parsed.ItemEffects, func(e *proto.ItemEffect) bool { return e.BuffId == spellID })
	if i < 0 {
		t.Fatalf("item %d carries no effect on %d", itemID, spellID)
	}
	return parsed, parsed.ItemEffects[i]
}

// An on-use whose spell puts an A_SCHOOL_ABSORB on the wearer registers through the absorb shape:
// Mark of Resolution 17759's 21956, 780 physical for 10 s. Onyxia Blood Talisman 18406's 1287808
// states 10000000000 beside the A_DUMMY its tooltip reads as Dragon Breath spells, which the client
// does not list, and Adaptive Combat Assistant 272437's 1291097 names the Nature damage 1291099 its
// shield deals when broken early; both are refused and listed.
func TestOnUseAbsorbRoutesFromTheSpellItCasts(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		itemID  int
		spellID int32
		want    EffectParseResult
		reasons []string
	}{
		{17759, 21956, EffectParseResultSuccess, nil},
		{18406, 1287808, EffectParseResultRefused, []string{
			"the absorb of 10000000000 beside an A_DUMMY absorbs only the spells a script names, which the client does not list"}},
		{272437, 1291097, EffectParseResultRefused, []string{
			"the damage of 1291099 (Sigmoid Revenge) the absorb's row names is not simulated"}},
	} {
		parsed, effect := parsedItem(t, instance, tc.itemID, tc.spellID)
		groups := map[string]Group{}
		if got := TryParseOnUseEffect(parsed, effect, instance, groups); got != tc.want {
			t.Errorf("item %d parsed as %v, want %v", tc.itemID, got, tc.want)
			continue
		}

		var entry *Entry
		for _, grp := range groups {
			entry = grp.Entries[0]
		}
		r := entry.Proc
		if r == nil || r.Shape != ShapeAbsorb || r.TriggerSpellID != int(tc.spellID) ||
			r.OnUseConstructor() != "NewSpellDataAbsorbOnUse" || entry.Supported != (tc.want == EffectParseResultSuccess) {
			t.Errorf("item %d: routing %+v, supported %v; want an absorb on-use casting %d", tc.itemID, r, entry.Supported, tc.spellID)
			continue
		}
		if !slices.Equal(r.Unsupported, tc.reasons) {
			t.Errorf("item %d refused for %q, want %q", tc.itemID, r.Unsupported, tc.reasons)
		}
		if _, listed := missingEffectsMap["ItemEffects"][int32(tc.itemID)]; listed != (tc.want != EffectParseResultSuccess) {
			t.Errorf("item %d listed as missing %v, want %v", tc.itemID, listed, tc.want != EffectParseResultSuccess)
		}
	}
}

// An item proc whose spell, or one its trigger casts, puts an absorb on the wearer routes to the absorb
// shape. Uther's Strength 11302's equip aura 8397 casts 10368 and rolls the 4 in its ProcChance
// column over the 2% its tooltip states on effect 1; Jang'thraze the Protector 9380's chance on hit
// states no rate.
func TestItemProcAbsorbRoutes(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		itemID  int
		buffID  int32
		trigger int
		want    EffectParseResult
		reasons []string
		rate    string
	}{
		{11302, 10368, 8397, EffectParseResultSuccess, nil, "trigger 8397 (4%, the column over effect 1's 2%,"},
		{9380, 11657, 11657, EffectParseResultRefused, []string{spelldata.ReasonStatesNoRate}, "trigger 11657 (0%,"},
	} {
		parsed, effect := parsedItem(t, instance, tc.itemID, tc.buffID)
		groups := map[string]Group{}
		if got := TryParseProcEffect(parsed, effect, instance, groups); got != tc.want {
			t.Errorf("item %d parsed as %v, want %v", tc.itemID, got, tc.want)
			continue
		}

		entry := groups["Procs"].Entries[0]
		r := entry.Proc
		if r.Shape != ShapeAbsorb || r.TriggerSpellID != tc.trigger || r.BuffSpellID != int(tc.buffID) ||
			r.ProcConstructor() != "NewSpellDataAbsorbProc" {
			t.Errorf("item %d: shape %v, trigger %d, buff %d, constructor %s; want an absorb proc %d -> %d",
				tc.itemID, r.Shape, r.TriggerSpellID, r.BuffSpellID, r.ProcConstructor(), tc.trigger, tc.buffID)
		}
		if !slices.Equal(r.Unsupported, tc.reasons) {
			t.Errorf("item %d refused for %q, want %q", tc.itemID, r.Unsupported, tc.reasons)
		}
		if !strings.HasPrefix(r.Summary, tc.rate) {
			t.Errorf("item %d summary %q, want it to start %q", tc.itemID, r.Summary, tc.rate)
		}
	}
}

// The chest absorption enchants' equip auras state their chance and a 5 s lockout, and each casts the
// absorb its A_PROC_TRIGGER_SPELL names.
func TestEnchantAbsorbRoutes(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		effectID int
		trigger  int
		absorb   int
	}{
		{44, 7445, 7423},         // Minor Absorption: 2%, 10 physical
		{63, 7446, 7447},         // Lesser Absorption: 5%, 25 physical
		{8220, 1249072, 1249073}, // Absorption: 25%, 50 physical
	} {
		enchant, ok := instance.EnchantsByEffectId[tc.effectID]
		if !ok {
			t.Fatalf("enchant %d is not in the enchant inputs", tc.effectID)
		}
		got := routeEnchantProcs(enchant.ProcSlots(), instance)
		if len(got) != 1 {
			t.Fatalf("enchant %d: %d routings, want 1", tc.effectID, len(got))
		}
		r := got[0]
		if r.Shape != ShapeAbsorb || r.TriggerSpellID != tc.trigger || r.BuffSpellID != tc.absorb || !r.Supported() {
			t.Errorf("enchant %d: shape %v, trigger %d, buff %d, refused for %q; want absorb %d -> %d registered",
				tc.effectID, r.Shape, r.TriggerSpellID, r.BuffSpellID, r.Reason(), tc.trigger, tc.absorb)
		}
	}
}
