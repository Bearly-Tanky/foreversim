package enhancement

import (
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// Windfury Weapon strikes twice with 439440, a weapon-damage special hit, and leaves the swing timer
// alone: beta log 2708 has every proc as two 439440 hits, the next auto one weapon speed after the
// last, and no 16361 buff.
func TestWindfuryWeaponStrikesTwiceWithoutSwinging(t *testing.T) {
	run := func(imbue proto.ShamanImbue) *proto.UnitMetrics {
		player := &proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
			Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
				{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
				{Id: 17182}, // Sulfuras, Hand of Ragnaros
			}},
			Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{
				ClassOptions: &proto.ShamanOptions{ImbueMh: imbue},
			}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}
		raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
		res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 20, RandomSeed: 1}})
		if res.Error != nil {
			t.Fatal(res.Error.Message)
		}
		return res.RaidMetrics.Parties[0].Players[0]
	}
	count := func(m *proto.UnitMetrics) (swings, strikes int32) {
		for _, a := range m.Actions {
			for _, tgt := range a.Targets {
				if a.Id.GetOtherId() == proto.OtherAction_OtherActionAttack && a.Id.Tag == 1 {
					swings += tgt.Casts
				}
				if a.Id.GetSpellId() == 439440 {
					strikes += tgt.Hits + tgt.Crits + tgt.Misses + tgt.Dodges + tgt.Parries + tgt.Blocks + tgt.Glances
				}
			}
		}
		return
	}

	plain, wf := run(proto.ShamanImbue_NoImbue), run(proto.ShamanImbue_WindfuryWeapon)
	for _, a := range wf.Auras {
		if a.Id.GetSpellId() == 16361 {
			t.Fatal("Windfury Weapon still raises 16361's attack power buff")
		}
	}
	plainSwings, _ := count(plain)
	swings, strikes := count(wf)
	t.Logf("swings %d -> %d, %d Windfury strikes", plainSwings, swings, strikes)
	if strikes == 0 {
		t.Fatal("Windfury Weapon never struck (439440)")
	}
	// Extra swings would add one per strike; only Flurry off the strikes' crits may add a few.
	if extra := swings - plainSwings; extra > strikes/4 {
		t.Fatalf("main-hand swings %d with Windfury vs %d without: %d more for %d strikes", swings, plainSwings, extra, strikes)
	}
}

// A shaman's own Windfury Totem (10614) procs off the party aura 10612 and hands out 10610's
// attack power for extra main-hand swings; no default APL casts it, so nothing else runs this path.
func TestWindfuryTotemSelfProcs(t *testing.T) {
	player := &proto.Player{
		Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
		Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
			{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
			{Id: 17182}, // Sulfuras, Hand of Ragnaros
		}},
		Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{ClassOptions: &proto.ShamanOptions{}}}},
		Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL, PriorityList: []*proto.APLListItem{{Action: &proto.APLAction{Action: &proto.APLAction_CastSpell{
			CastSpell: &proto.APLActionCastSpell{SpellId: &proto.ActionID{RawId: &proto.ActionID_SpellId{SpellId: 10614}}},
		}}}}},
	}
	raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
	res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 20, RandomSeed: 1}})
	if res.Error != nil {
		t.Fatal(res.Error.Message)
	}
	m := res.RaidMetrics.Parties[0].Players[0]
	var procs float64
	for _, a := range m.Auras {
		if a.Id.GetSpellId() == 10610 {
			procs = a.ProcsAvg
		}
	}
	var extra int32
	for _, a := range m.Actions {
		if a.Id.GetOtherId() == proto.OtherAction_OtherActionAttack && a.Id.Tag == 10610 {
			for _, tgt := range a.Targets {
				extra += tgt.Casts
			}
		}
	}
	if procs == 0 || extra == 0 {
		t.Fatalf("Windfury Totem: %.1f buff procs a fight, %d extra swings; want both above 0", procs, extra)
	}
}
