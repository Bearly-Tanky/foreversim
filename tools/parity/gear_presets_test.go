package parity

import (
	"path/filepath"
	"slices"
	"testing"

	"github.com/wowsims/forever/sim"
	"github.com/wowsims/forever/sim/core"
)

// Every gear preset of every arena spec loads against the item database and sims: each item,
// enchant and random suffix resolves, and one iteration runs without an error. The spec's
// default preset (specs.json "gear") must exist.
func TestGearPresets(t *testing.T) {
	sim.RegisterAll()
	var file struct {
		Specs []paritySpec `json:"specs"`
	}
	mustReadJSON(t, "specs.json", &file)
	for _, spec := range file.Specs {
		dir := filepath.Join("..", "..", filepath.Dir(spec.Gear))
		presets, _ := filepath.Glob(filepath.Join(dir, "*.gear.json"))
		if !slices.Contains(presets, filepath.Join("..", "..", spec.Gear+".gear.json")) {
			t.Errorf("%s: default gear preset %s missing", spec.Name, spec.Gear)
		}
		for _, preset := range presets {
			name := filepath.Base(preset)
			gear := core.GetGearSet(dir, name[:len(name)-len(".gear.json")]).GearSet
			// The sim skips an unknown enchant silently, so check those here.
			for _, item := range gear.Items {
				if item.GetEnchant() != 0 && core.GetEnchantByEffectID(item.Enchant) == nil {
					t.Errorf("%s %s: no enchant with effect id %d", spec.Name, name, item.Enchant)
				}
			}
			res := runSpecWithGear(spec, nil, 1, gear)
			if res.Error != "" {
				t.Errorf("%s %s: %s", spec.Name, name, res.Error)
			}
			t.Logf("%-20s %-40s %7.1f dps", spec.Name, name, res.Dps)
		}
	}
}
