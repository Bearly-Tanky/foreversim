package database

import (
	"slices"
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
	"github.com/wowsims/forever/tools/database/dbc"
)

// A chance-on-hit item whose spell is a heal over time on the wearer routes to the heal shape. Neither
// states a rate: 8348's ProcChance is the 100 that means no roll, 1297357 carries no aura options at
// all, and "Chance on hit" beside neither names a percentage, so both stay commented out.
func TestChanceOnHitHotRoutesAsAHealAndStatesNoRate(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		itemID   int
		spellID  int32
		perTick  float64
		duration time.Duration
	}{
		{6660, 8348, 13, 12 * time.Second},      // Julie's Dagger: Julie's Blessing
		{275645, 1297357, 26, 14 * time.Second}, // Reforged Spear
	} {
		item := instance.Items[tc.itemID]
		parsed := item.ToUIItem()
		parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)
		i := slices.IndexFunc(parsed.ItemEffects, func(e *proto.ItemEffect) bool { return e.BuffId == tc.spellID })
		if i < 0 {
			t.Fatalf("item %d carries no effect on %d", tc.itemID, tc.spellID)
		}

		groups := map[string]Group{}
		if got := TryParseProcEffect(parsed, parsed.ItemEffects[i], instance, groups); got != EffectParseResultRefused {
			t.Errorf("item %d parsed as %v, want refused with a reason", tc.itemID, got)
			continue
		}
		entry := groups["Procs"].Entries[0]
		r := entry.Proc
		if r.Shape != ShapeHeal || !r.IsWeaponProc || r.TriggerSpellID != int(tc.spellID) || r.BuffSpellID != int(tc.spellID) {
			t.Errorf("item %d: shape %v, weapon proc %v, trigger %d, buff %d; want a weapon proc healing through %d",
				tc.itemID, r.Shape, r.IsWeaponProc, r.TriggerSpellID, r.BuffSpellID, tc.spellID)
		}
		if want := []string{spelldata.ReasonStatesNoRate}; !slices.Equal(r.Unsupported, want) {
			t.Errorf("item %d refused for %q, want %q", tc.itemID, r.Unsupported, want)
		}

		heal := spelldata.Find(tc.spellID)
		e := heal.ProcHealEffect()
		if e.Aura != dbcenums.A_PERIODIC_HEAL || e.Target[0] != dbcenums.TARGET_UNIT_CASTER ||
			e.Average(core.CharacterLevel) != tc.perTick || e.Period() != 2*time.Second || heal.Duration() != tc.duration {
			t.Errorf("%d heals through aura %v on target %d, %v every %v for %v; want A_PERIODIC_HEAL on the caster, %v every 2s for %v",
				tc.spellID, e.Aura, e.Target[0], e.Average(core.CharacterLevel), e.Period(), heal.Duration(), tc.perTick, tc.duration)
		}
	}
}

// An on-use with no stats routes from the spell it casts: damage on the enemy it is used on or a heal
// on the wearer registers, a heal on anyone else or a spell that does neither is refused with the
// reason and listed.
func TestOnUseRoutesFromTheSpellItCasts(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		itemID  int
		spellID int32
		want    EffectParseResult
		damage  bool
		heal    bool
		reasons []string
	}{
		{219345, 443265, EffectParseResultSuccess, true, false, nil}, // Infernal Lasso: A_PERIODIC_DAMAGE, and a root it leaves out
		{16768, 20631, EffectParseResultSuccess, false, true, nil},   // Furbolg Medicine Pouch: A_PERIODIC_HEAL on the wearer
		{18637, 23064, EffectParseResultRefused, false, true,
			[]string{"the heal lands on implicit target 21, not the wearer"}}, // Major Recombobulator
		{14153, 18386, EffectParseResultRefused, false, true,
			[]string{"the heal lands on implicit target 5, not the wearer"}}, // Robe of the Void, on the pet
		{7734, 14537, EffectParseResultRefused, false, false,
			[]string{"14537 deals no damage and heals no one (E_DUMMY)"}}, // Six Demon Bag
	} {
		item := instance.Items[tc.itemID]
		parsed := item.ToUIItem()
		parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)
		i := slices.IndexFunc(parsed.ItemEffects, func(e *proto.ItemEffect) bool { return e.BuffId == tc.spellID && e.GetOnUse() != nil })
		if i < 0 {
			t.Fatalf("item %d carries no on-use effect on %d", tc.itemID, tc.spellID)
		}

		groups := map[string]Group{}
		if got := TryParseOnUseEffect(parsed, parsed.ItemEffects[i], instance, groups); got != tc.want {
			t.Errorf("item %d parsed as %v, want %v", tc.itemID, got, tc.want)
			continue
		}

		var entry *Entry
		for _, grp := range groups {
			entry = grp.Entries[0]
		}
		r := entry.Proc
		if r == nil || r.TriggerSpellID != int(tc.spellID) || (r.Shape == ShapeDamage) != tc.damage || (r.Shape == ShapeHeal) != tc.heal ||
			entry.Supported != (tc.want == EffectParseResultSuccess) {
			t.Errorf("item %d: routing %+v, supported %v; want spell %d, damage %v, heal %v", tc.itemID, r, entry.Supported, tc.spellID, tc.damage, tc.heal)
			continue
		}
		if !slices.Equal(r.Unsupported, tc.reasons) {
			t.Errorf("item %d refused for %q, want %q", tc.itemID, r.Unsupported, tc.reasons)
		}
	}
}

// An on-use whose spell raises the wearer's speeds registers as a speed buff, every speed effect of
// its row modelled.
func TestOnUseSpeedBuffRoutesAsASpeedBuff(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	for _, tc := range []struct {
		itemID  int
		spellID int32
		summary string
	}{
		{19339, 23723, "on use: 23723 (A_MOD_CASTING_SPEED_NOT_STACK)"},                      // Mind Quickening Gem
		{19343, 23733, "on use: 23733 (A_MOD_CASTING_SPEED_NOT_STACK, A_MOD_MELEE_HASTE_3)"}, // Scrolls of Blinding Light
		{22954, 28866, "on use: 28866 (A_MOD_MELEE_HASTE_3, A_MOD_RANGED_HASTE)"},            // Kiss of the Spider
	} {
		item := instance.Items[tc.itemID]
		parsed := item.ToUIItem()
		parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)
		i := slices.IndexFunc(parsed.ItemEffects, func(e *proto.ItemEffect) bool { return e.BuffId == tc.spellID && e.GetOnUse() != nil })
		if i < 0 {
			t.Fatalf("item %d carries no on-use effect on %d", tc.itemID, tc.spellID)
		}

		groups := map[string]Group{}
		if got := TryParseOnUseEffect(parsed, parsed.ItemEffects[i], instance, groups); got != EffectParseResultSuccess {
			t.Errorf("item %d parsed as %v, want registered", tc.itemID, got)
			continue
		}

		entries := groups["Speed"].Entries
		if len(entries) != 1 {
			t.Fatalf("item %d: %d entries in the Speed group, want 1", tc.itemID, len(entries))
		}
		r := entries[0].Proc
		if !entries[0].Supported || r.Shape != ShapeSpeed || r.TriggerSpellID != int(tc.spellID) ||
			r.OnUseConstructor() != "NewSpellDataSpeedOnUse" || r.Summary != tc.summary {
			t.Errorf("item %d: routing %+v, supported %v; want %d registered through NewSpellDataSpeedOnUse with %q",
				tc.itemID, r, entries[0].Supported, tc.spellID, tc.summary)
		}
	}
}

// Aegis of Preservation 19345 registers its 500 armor and lists the heal on every hit taken, 23781,
// that its buff 23780 procs.
func TestOnUseStatBuffListsTheProcItCarries(t *testing.T) {
	withDBCInputs(t)
	instance := dbc.GetDBC()

	item := instance.Items[19345]
	parsed := item.ToUIItem()
	parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)
	groups := map[string]Group{}
	if got := TryParseOnUseEffect(parsed, parsed.ItemEffects[0], instance, groups); got != EffectParseResultSuccess {
		t.Fatalf("parsed as %v, want the stat on-use registered", got)
	}

	entry := groups["Armor"].Entries[0]
	if want := "the proc the buff carries, 23781 (E_HEAL)"; !entry.Supported || entry.NotSimulated != want {
		t.Errorf("supported %v, not simulated %q; want registered with %q", entry.Supported, entry.NotSimulated, want)
	}
	if _, listed := missingEffectsMap["ItemEffects"][19345]; !listed {
		t.Errorf("19345 is not listed as missing an effect")
	}
}

// A trigger restricted to one named ability is a shape no ProcTypeMask states, so the wording is the
// only evidence there is. The rows below are the client's own, raw and rendered: the store reads the
// raw description and the item generator the rendered tooltip, and both go through this matcher.
func TestNamedAbilityWording(t *testing.T) {
	for _, tc := range []struct {
		named bool
		text  string
		why   string
	}{
		{true, "Your casts of $?s2060[Greater Heal]?s5185[Healing Touch][Greater Heal, Healing Touch] in combat grant up to $1249119s1 increased healing.",
			"Eternal Power 1249118, as the client writes it"},
		{true, "Your casts of Greater Heal in combat grant up to 40 increased healing and up to 13 increased damage for 15s.",
			"the same tooltip, rendered"},
		{true, "Your Backstab has a $m1% chance to cause your next Ambush to not require Stealth.",
			`"has" after a named ability`},
		{true, "Heals from your Earth Shield have a $s1% chance to make your next cast time heal instant cast.",
			`"have" after a named ability`},
		{true, "When you cast Chain Heal or Riptide you gain $s1 charges of Tidal Waves.",
			"a cast of one named ability"},
		{true, "Your Shock spells have a chance to deal extra damage.", "the wording the matcher already read"},
		{false, "When you cast a healing spell, gain Mana equal to $m1% of the base cost of the spell.",
			"no ability is named"},
		{false, "20% chance to regain 100 mana when you cast a Judgement.",
			"a lowercase article keeps the class of spell general"},
		{false, "Multiple casts of Divine Light do not accumulate this shield.",
			"not the caster's own casts, and not a trigger clause"},
		{false, "Your melee attacks have a chance to deal extra damage.",
			"no ability is named"},
		{false, "2% chance on successful spellcast to increase your Spirit by 150 for 15s.",
			"Darkmoon Card: Blue Dragon, which fires off any cast"},
	} {
		if got := procTooltipHints(tc.text).Matches(core.ProcHintNamedAbility); got != tc.named {
			t.Errorf("named ability = %v, want %v for %s:\n  %s", got, tc.named, tc.why, tc.text)
		}
	}
}

// The wearer's own attack dodged or parried is a trigger only in a condition clause. The same words
// state a magnitude on every expertise row, and "when you parry" is an attack the wearer takes.
func TestAttackAvoidedWording(t *testing.T) {
	const avoided = core.ProcHintAttackDodged | core.ProcHintAttackParried

	for _, tc := range []struct {
		want core.ProcHint
		text string
		why  string
	}{
		{avoided, "Permanently enchant a Melee Weapon to trigger Recovery when you are Parried or Dodged, healing you for 5% of your maximum health. Cannot occur more often than once every 10 sec.",
			"Recovery's grant 1248760, rendered"},
		{core.ProcHintAttackParried, "Whenever your melee attacks are parried, gain 10 rage.",
			"one outcome named, one bit"},
		{0, "Reduces the chance for your attacks to be dodged or parried by $s1%.",
			"Increased Expertise 1213288, a magnitude"},
		{0, "Your Taunt ability never misses, and your chance to be Dodged or Parried is reduced by $s1%.",
			"the Naxxramas tank 2P 1219540, a magnitude"},
		{0, "Instantly overpower the enemy, causing weapon damage plus $s1.  Only useable after the target dodges.  The Overpower cannot be blocked, dodged or parried.",
			"Overpower 7384, which states what it cannot be"},
		{0, "Your Shield Slam deals $s1% increased threat and its cooldown is reset if it is Dodged, Parried, or Blocked.",
			"TAQ tank 4P 1214162, one named ability rather than the wearer's attacks"},
		{0, "When you parry an attack, gain 10 rage.",
			"the wearer parrying an attack it takes"},
	} {
		if got := procTooltipHints(tc.text) & avoided; got != tc.want {
			t.Errorf("hint = %q, want %q for %s:\n  %s", formatProcHint(got), formatProcHint(tc.want), tc.why, tc.text)
		}
	}
}
