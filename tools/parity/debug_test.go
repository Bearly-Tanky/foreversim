package parity

import (
	"fmt"
	"os"
	"testing"

	"github.com/wowsims/forever/sim"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Per-action hit table and resource flow for one spec on this engine, for chasing a gap the
// parity table shows: DBG_SPEC=<name> go test --tags=with_db ./tools/parity -run TestDebugResources -v
func TestDebugResources(t *testing.T) {
	name := os.Getenv("DBG_SPEC")
	if name == "" {
		t.Skip()
	}
	sim.RegisterAll()
	var file struct {
		Profiles map[string]map[string]float64 `json:"profiles"`
		Specs    []paritySpec                  `json:"specs"`
	}
	mustReadJSON(t, "specs.json", &file)
	for _, spec := range file.Specs {
		if spec.Name != name {
			continue
		}
		debugHook = func(r *proto.RaidSimResult) {
			p := r.RaidMetrics.Parties[0].Players[0]
			for _, res := range p.Resources {
				fmt.Printf("res %v type %v events %d gain %.1f actual %.1f\n", res.Id, res.Type, res.Events, res.Gain, res.ActualGain)
			}
			for _, a := range p.Actions {
				for _, tg := range a.Targets {
					fmt.Printf("act %v casts %d hits %d miss %d dodge %d parry %d crit %d glance %d dmg %.0f\n", a.Id, tg.Casts, tg.Hits, tg.Misses, tg.Dodges, tg.Parries, tg.Crits, tg.Glances, tg.Damage)
				}
			}
		}
		runSpec(spec, file.Profiles[spec.Profile], 100)
		debugHook = nil
	}
	_ = core.CharacterLevel
}
