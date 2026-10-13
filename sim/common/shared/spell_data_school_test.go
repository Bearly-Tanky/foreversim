package shared

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
)

// The generator emits a school by name and the client states it as a bit. Those only agree because
// core's SpellSchool constants were put on the client's bits, and nothing else would notice if they
// drifted apart - every conversion in core is a switch over the names.
func TestSpellSchoolBitsMatchTheClient(t *testing.T) {
	// SpellMisc.SchoolMask, as the client numbers it.
	for _, c := range []struct {
		clientBit byte
		school    core.SpellSchool
		name      string
	}{
		{1, core.SpellSchoolPhysical, "Physical"},
		{2, core.SpellSchoolHoly, "Holy"},
		{4, core.SpellSchoolFire, "Fire"},
		{8, core.SpellSchoolNature, "Nature"},
		{16, core.SpellSchoolFrost, "Frost"},
		{32, core.SpellSchoolShadow, "Shadow"},
		{64, core.SpellSchoolArcane, "Arcane"},
	} {
		if byte(c.school) != c.clientBit {
			t.Errorf("%s is bit %d in the client and %d in core", c.name, c.clientBit, byte(c.school))
		}
	}
}
