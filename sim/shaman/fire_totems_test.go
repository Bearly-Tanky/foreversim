package shaman

import (
	"math"
	"testing"

	"github.com/wowsims/forever/sim/core"
)

// Rank 5 hits through 408428 (403 + 3.4 a level to 57, 0.214), not the Era row 11307 its tooltip cites.
func TestFireNovaDamage(t *testing.T) {
	e := fireNovaDamage.DamageEffect()
	if avg := e.Average(core.CharacterLevel); math.Abs(avg-420) > 0.01 || math.Abs(e.Coeff()-0.214) > 1e-6 {
		t.Fatalf("Fire Nova rank 5 averages %v at %v, want 420 at 0.214", avg, e.Coeff())
	}
}
