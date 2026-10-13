package enhancement

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// Flametongue Totem (16387) adds 16389's fire hit to each landed main-hand auto. It no longer stacks
// with Windfury Totem or Flametongue Weapon (Forever beta development notes), and a main-hand
// Flametongue Weapon disables it (tooltips 8024/16342).
func TestFlametongueTotem(t *testing.T) {
	run := func(mh proto.ShamanImbue, party *proto.PartyBuffs) (autos, hits int32) {
		player := &proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
			Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
				{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
				{Id: 17182}, // Sulfuras, Hand of Ragnaros
			}},
			Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{
				ClassOptions: &proto.ShamanOptions{ImbueMh: mh},
			}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL, PriorityList: []*proto.APLListItem{{Action: &proto.APLAction{Action: &proto.APLAction_CastSpell{
				CastSpell: &proto.APLActionCastSpell{SpellId: &proto.ActionID{RawId: &proto.ActionID_SpellId{SpellId: 16387}}},
			}}}}},
		}
		raid := &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: party}}, Buffs: &proto.RaidBuffs{}, Debuffs: &proto.Debuffs{}, NumActiveParties: 1}
		res := core.RunRaidSim(&proto.RaidSimRequest{Raid: raid, Encounter: core.MakeSingleTargetEncounter(0), SimOptions: &proto.SimOptions{Iterations: 5, RandomSeed: 1}})
		if res.Error != nil {
			t.Fatal(res.Error.Message)
		}
		for _, a := range res.RaidMetrics.Parties[0].Players[0].Actions {
			for _, tgt := range a.Targets {
				if a.Id.GetOtherId() == proto.OtherAction_OtherActionAttack && a.Id.Tag == 1 {
					autos += tgt.Hits + tgt.Crits + tgt.Glances + tgt.Blocks
				}
				if a.Id.GetSpellId() == 16389 {
					hits += tgt.Hits + tgt.Crits + tgt.Misses
				}
			}
		}
		return
	}

	if autos, hits := run(proto.ShamanImbue_NoImbue, &proto.PartyBuffs{}); hits == 0 || hits != autos {
		t.Errorf("alone: %d totem hits for %d landed main-hand autos, want one each", hits, autos)
	}
	if autos, hits := run(proto.ShamanImbue_FrostbrandWeapon, &proto.PartyBuffs{}); hits == 0 || hits != autos {
		t.Errorf("Frostbrand main hand: %d totem hits for %d landed main-hand autos, want one each", hits, autos)
	}
	if _, hits := run(proto.ShamanImbue_NoImbue, &proto.PartyBuffs{WindfuryTotem: true}); hits != 0 {
		t.Errorf("with the party's Windfury Totem: %d totem hits, want 0", hits)
	}
	if _, hits := run(proto.ShamanImbue_FlametongueWeapon, &proto.PartyBuffs{}); hits != 0 {
		t.Errorf("Flametongue main hand: %d totem hits, want 0", hits)
	}
}

// The totem's hit lands as Flametongue Attack 16368 (beta log 2713), whose client row has no spell
// power coefficient and a class mask Elemental Weapons and Elemental Fury don't name; the imbue's
// hit (29469) has both.
func TestFlametongueTotemHitIsNotTheImbuesHit(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 1},
		Raid: core.SinglePlayerRaidProto(&proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
			Equipment: &proto.EquipmentSpec{Items: []*proto.ItemSpec{
				{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
				{Id: 17182}, // Sulfuras, Hand of Ragnaros
			}},
			Spec: &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{
				ClassOptions: &proto.ShamanOptions{ImbueMh: proto.ShamanImbue_FlametongueWeapon},
			}}},
			Rotation: &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter: core.MakeSingleTargetEncounter(0),
	}, simsignals.CreateSignals())
	sim.Reset()

	var totem, imbue *core.Spell
	for _, spell := range sim.Raid.Parties[0].Players[0].GetCharacter().Spellbook {
		switch spell.ActionID.SpellID {
		case 16389:
			totem = spell
		case 16344:
			imbue = spell
		}
	}
	if totem == nil || imbue == nil {
		t.Fatalf("totem hit %v, imbue hit %v: want both registered", totem, imbue)
	}
	if totem.BonusCoefficient != 0 || totem.DamageMultiplierAdditive != 1 {
		t.Errorf("totem hit: coefficient %v, additive multiplier %v, want 0 and 1", totem.BonusCoefficient, totem.DamageMultiplierAdditive)
	}
	if imbue.BonusCoefficient == 0 || imbue.DamageMultiplierAdditive == 1 {
		t.Errorf("imbue hit: coefficient %v, additive multiplier %v, want 0.1 and Elemental Weapons", imbue.BonusCoefficient, imbue.DamageMultiplierAdditive)
	}
}

// Searing Totem attacks every 2.435 sec on beta logs (2.2 sec cast plus ~0.23 sec between casts, 1,267
// attacks), so rank 6's 55 sec totem lands 22 attacks, not the 25 a bare 2.2 sec cast gives.
func TestSearingTotemAttackInterval(t *testing.T) {
	sim := core.NewSim(&proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{RandomSeed: 1},
		Raid: core.SinglePlayerRaidProto(&proto.Player{
			Name: "enh", Class: proto.Class_ClassShaman, Race: proto.Race_RaceOrc, TalentsString: DefaultTalents,
			Equipment: &proto.EquipmentSpec{},
			Spec:      &proto.Player_EnhancementShaman{EnhancementShaman: &proto.EnhancementShaman{Options: &proto.EnhancementShaman_Options{ClassOptions: &proto.ShamanOptions{}}}},
			Rotation:  &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
		}, &proto.PartyBuffs{}, &proto.RaidBuffs{}, &proto.Debuffs{}),
		Encounter: core.MakeSingleTargetEncounter(0),
	}, simsignals.CreateSignals())
	sim.Reset()

	enh := sim.Raid.Parties[0].Players[0].(*EnhancementShaman)
	dot := enh.SearingTotem.Dot(enh.CurrentTarget)
	if dot.BaseTickLength != 2430*time.Millisecond || dot.BaseTickCount != 22 {
		t.Fatalf("Searing Totem attacks every %v, %d times, want 2.43s and 22", dot.BaseTickLength, dot.BaseTickCount)
	}
}
