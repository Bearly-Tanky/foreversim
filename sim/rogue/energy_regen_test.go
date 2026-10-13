package rogue

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
)

// Energy refills smoothly at 10 a second (beta logs show no 2 s tick grid), so an empty bar
// is never more than a moment from its next point and takes 4 s to reach 40.
func TestEnergyRefillsSmoothly(t *testing.T) {
	sim, rogue := kidneyShotSim(AssassinationTalents)
	rogue.SpendEnergy(sim, rogue.CurrentEnergy(), rogue.NewEnergyMetrics(core.ActionID{OtherID: 1}))

	if got := rogue.TimeToTargetEnergy(sim, 1); got > 100*time.Millisecond {
		t.Errorf("first point of energy in %v, want <= 100ms", got)
	}
	if got := rogue.TimeToTargetEnergy(sim, 40); got < 3900*time.Millisecond || got > 4*time.Second {
		t.Errorf("40 energy in %v, want 3.9-4s", got)
	}
}
