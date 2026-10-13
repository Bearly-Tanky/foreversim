package arenalib

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core"
)

// Two ways this goes wrong and neither would show up as a failure anywhere downstream - the
// arena would just publish a number for a shaman who had been quietly disarmed, or for a spec
// that inherited somebody else's weapon buff.
func TestClassImbuesOverrideTheRoleListWithoutLeaking(t *testing.T) {
	plain := consumesFor(Melee, ClassImbues{})
	if !plain.Party.WindfuryTotem {
		t.Fatal("melee should start from the role list, which has Windfury")
	}

	shaman := consumesFor(Melee, ClassImbues{Windfury: true})
	if shaman.Party.WindfuryTotem {
		t.Error("a shaman's own Windfury Weapon did not take the totem away")
	}
	// Everything else must survive the override.
	if shaman.Consumables.FlaskId != plain.Consumables.FlaskId || shaman.Party.BattleShout != plain.Party.BattleShout {
		t.Error("overriding an imbue dropped the rest of the list")
	}

	// A half override leaves the other hand alone.
	rogue := consumesFor(Melee, ClassImbues{OffHand: 26891})
	if rogue.Consumables.OhImbueId != 26891 || !rogue.Party.WindfuryTotem {
		t.Error("overriding the off-hand should keep the main hand's Windfury")
	}
	if rogue.Label != "Arena-Melee+class" {
		t.Errorf("label %q does not say the class brought its own imbue", rogue.Label)
	}

	// And none of it may have written through to the shared list.
	if again := consumesFor(Melee, ClassImbues{}); !again.Party.WindfuryTotem ||
		again.Consumables.OhImbueId != 18262 {
		t.Error("a class imbue leaked into the shared role list")
	}

	// The ranged list exists to dodge the sharpening stone's ranged crit penalty.
	if consumesFor(Ranged, ClassImbues{}).Consumables.OhImbueId != 0 {
		t.Error("the hunter list must not carry the off-hand sharpening stone")
	}
	// Casters oil their weapon; a totem would switch the oil off (see applyConsumeEffects).
	if consumesFor(Caster, ClassImbues{}).Party.WindfuryTotem {
		t.Error("the caster list must not carry Windfury")
	}
}

// Every item on the lists is one the database knows, or the sim silently skips it and the
// arena publishes a number for a spec that drank nothing.
func TestConsumablesAreInTheDatabase(t *testing.T) {
	if !core.WITH_DB {
		t.Skip("needs --tags=with_db")
	}
	for _, role := range []Role{Melee, Ranged, Caster} {
		c := consumesFor(role, ClassImbues{}).Consumables
		for name, id := range map[string]int32{
			"flask": c.FlaskId, "battle elixir": c.BattleElixirId, "food": c.FoodId, "potion": c.PotId,
			"strength": c.StrengthBuffId, "attack power": c.AttackPowerBuffId,
			"spell power": c.SpellPowerElixirId, "school elixir": c.SchoolElixirId,
			"guardian elixir": c.GuardianElixirId, "rune": c.ConjuredId,
		} {
			if id != 0 && core.GetConsumableByID(id).Id != id {
				t.Errorf("role %d: %s %d is not in the database", role, name, id)
			}
		}
	}
}

// The sim only registers a potion or a rune that is also in Potions or ConjuredItems. Naming one
// without the other is silent: the Major Mana Potion sat on the caster list undrunk that way.
// Melee is left out, see its rage potion.
func TestPotionsAndRunesAreRegistered(t *testing.T) {
	for _, role := range []Role{Ranged, Caster} {
		c := consumesFor(role, ClassImbues{}).Consumables
		if c.PotId != 0 && !slices.Contains(c.Potions, c.PotId) {
			t.Errorf("role %d: potion %d is not in Potions", role, c.PotId)
		}
		if c.ConjuredId != 0 && !slices.Contains(c.ConjuredItems, c.ConjuredId) {
			t.Errorf("role %d: rune %d is not in ConjuredItems", role, c.ConjuredId)
		}
	}
}
