package hunter

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Client 1.60.1.70205: Immolation and Explosive Trap's effects carry Periodic Can Crit (Attributes[8]
// 0x200), and Volley's ticks are ranged damage spells with no Cannot Crit, so all of them crit.
func TestTrapAndVolleyTicksCrit(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 1},
		Raid: &proto.Raid{Parties: []*proto.Party{{Buffs: &proto.PartyBuffs{}, Players: []*proto.Player{{
			Name: "mm", Class: proto.Class_ClassHunter, Race: proto.Race_RaceOrc, TalentsString: SurvivalTalents,
			Equipment: WeaponsOnly, Buffs: &proto.IndividualBuffs{},
			Spec: &proto.Player_Hunter{Hunter: &proto.Hunter{Options: &proto.Hunter_Options{ClassOptions: &proto.HunterOptions{
				Ammo: proto.HunterOptions_Doomshot, PetType: proto.HunterOptions_PetNone}}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}}}}},
		Encounter: core.MakeSingleTargetEncounter(0),
	}, simsignals.CreateSignals())
	sim.Reset()

	hunter := sim.Raid.Parties[0].Players[0].(HunterAgent).GetHunter()
	target := hunter.CurrentTarget
	// Explosive Trap first: it skips a target Immolation Trap is burning.
	for _, spell := range []*core.Spell{hunter.ExplosiveTrap, hunter.Volley, hunter.ImmolationTrap} {
		dot := spell.AOEDot()
		if spell == hunter.ImmolationTrap {
			dot = spell.Dot(target)
		}
		for i := 0; i < 2000; i++ {
			dot.Apply(sim)
			dot.TickOnce(sim)
		}
		m := spell.SpellMetrics[target.UnitIndex]
		if m.Crits+m.CritTicks == 0 {
			t.Errorf("%s: no tick crit in 2000 (%+v)", spell.ActionID, m)
		}
	}
}
