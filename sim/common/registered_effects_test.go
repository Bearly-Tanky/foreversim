//go:build with_db

// Which items and enchants the sim simulates an effect for, as a local baseline that is not tracked.
// The generated registrations are a hundred lines of ids; the baseline answers the only question a
// regeneration has to answer - what became live, and what stopped being live. A checkout without it
// writes it on the first run.
//
// Needs the database: an effect registered for an item this client does not ship is skipped, so
// without it the list would name items no sim can equip.
package common_test

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/wowsims/forever/sim/common"
	"github.com/wowsims/forever/sim/core"
)

const registeredEffectsPath = "forever/registered_effects.txt"

func TestRegisteredEffects(t *testing.T) {
	common.RegisterAllEffects()

	var out strings.Builder
	out.WriteString("# The items and enchants sim/common registers an effect for, written by\n")
	out.WriteString("# TestRegisteredEffects in sim/common. Regenerate with\n")
	out.WriteString("#   UPDATE_REGISTERED_EFFECTS=1 GOARCH=amd64 go test --tags=with_db ./sim/common/ -run TestRegisteredEffects -count=1\n")

	out.WriteString("\n# items\n")
	for _, id := range core.RegisteredItemEffectIDs() {
		fmt.Fprintf(&out, "%d %s\n", id, itemName(id))
	}

	out.WriteString("\n# enchants\n")
	for _, id := range core.RegisteredEnchantEffectIDs() {
		fmt.Fprintf(&out, "%d %s\n", id, enchantName(id))
	}

	committed, err := os.ReadFile(registeredEffectsPath)
	if os.IsNotExist(err) || os.Getenv("UPDATE_REGISTERED_EFFECTS") != "" {
		if err := os.WriteFile(registeredEffectsPath, []byte(out.String()), 0644); err != nil {
			t.Fatalf("%v", err)
		}
		t.Logf("wrote the baseline %s", registeredEffectsPath)
		return
	}
	if err != nil {
		t.Fatalf("%v", err)
	}
	if string(committed) == out.String() {
		return
	}

	for _, line := range changedLines(string(committed), out.String()) {
		t.Error(line)
	}
	t.Errorf("%s is not what the sim registers; once the moves above are the intended ones, rewrite the baseline:\n"+
		"  UPDATE_REGISTERED_EFFECTS=1 GOARCH=amd64 go test --tags=with_db ./sim/common/ -run TestRegisteredEffects -count=1",
		registeredEffectsPath)
}

// The lines one side has and the other does not, which on a sorted list is exactly what appeared and
// what vanished.
func changedLines(committed string, registered string) []string {
	was := map[string]bool{}
	for _, line := range strings.Split(committed, "\n") {
		was[line] = true
	}

	var changed []string
	now := map[string]bool{}
	for _, line := range strings.Split(registered, "\n") {
		now[line] = true
		if !was[line] && line != "" && !strings.HasPrefix(line, "#") {
			changed = append(changed, "now registered: "+line)
		}
	}

	for _, line := range strings.Split(committed, "\n") {
		if !now[line] && line != "" && !strings.HasPrefix(line, "#") {
			changed = append(changed, "no longer registered: "+line)
		}
	}

	return changed
}

func itemName(id int32) string {
	if item := core.GetItemByID(id); item != nil {
		return item.Name
	}
	if gem, ok := core.GetGemByID(id); ok {
		return gem.Name
	}
	return "?"
}

func enchantName(id int32) string {
	if enchant := core.GetEnchantByEffectID(id); enchant != nil {
		return enchant.Name
	}
	return "?"
}
