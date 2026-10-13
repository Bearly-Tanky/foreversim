package buffs

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

// Forever's Faerie Fire and Curse of Recklessness take the same 505 armor and do not stack it: with
// both up the target loses 505, not 1010.
func TestFaerieFireAndCurseOfRecklessnessShareTheirArmor(t *testing.T) {
	measure := func(apply ...func(*core.Unit, bool, int32) *core.Aura) float64 {
		target := shapeTarget()
		sim := &core.Simulation{}
		before := target.GetStats()[stats.Armor]
		for _, a := range apply {
			a(target, false, 0).Activate(sim)
		}
		return target.GetStats()[stats.Armor] - before
	}

	ff, cor := measure(FaerieFireAura), measure(CurseOfRecklessnessAura)
	if ff != -505 || cor != -505 {
		t.Fatalf("each alone: Faerie Fire %v armor, Curse of Recklessness %v, want -505", ff, cor)
	}
	if both := measure(FaerieFireAura, CurseOfRecklessnessAura); both != -505 {
		t.Errorf("together they take %v armor, want -505", both)
	}
}
