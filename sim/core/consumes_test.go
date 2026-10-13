package core

import (
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	"github.com/wowsims/forever/sim/core/stats"
)

func setupConsumesSim(tweak func(*proto.RaidSimRequest)) (*Simulation, *FakeRageWarrior) {
	request := &proto.RaidSimRequest{
		SimOptions: &proto.SimOptions{
			RandomSeed: 100,
		},
		Raid: &proto.Raid{
			Parties: []*proto.Party{
				{
					Players: []*proto.Player{
						{
							Name:        "Warrior",
							Class:       proto.Class_ClassWarrior,
							Race:        proto.Race_RaceOrc,
							Buffs:       &proto.IndividualBuffs{},
							Consumables: &proto.ConsumesSpec{},
							Spec:        &proto.Player_DpsWarrior{},
							Equipment:   &proto.EquipmentSpec{},
							Rotation:    &proto.APLRotation{Type: proto.APLRotation_TypeAPL},
						},
					},
					Buffs: &proto.PartyBuffs{},
				},
			},
			Buffs: &proto.RaidBuffs{},
		},
		Encounter: &proto.Encounter{
			Targets: []*proto.Target{
				{Name: "target", Level: 63, MobType: proto.MobType_MobTypeUndead},
			},
			Duration: 180,
		},
	}
	if tweak != nil {
		tweak(request)
	}

	sim := NewSim(request, simsignals.CreateSignals())
	sim.Reset()

	return sim, sim.Raid.Parties[0].Players[0].(*FakeRageWarrior)
}

func consumesOf(request *proto.RaidSimRequest) *proto.ConsumesSpec {
	return request.Raid.Parties[0].Players[0].Consumables
}

func consumesStatDelta(t *testing.T, stat stats.Stat, tweak func(*proto.RaidSimRequest)) float64 {
	t.Helper()
	_, without := setupConsumesSim(nil)
	_, with := setupConsumesSim(tweak)
	return with.GetStat(stat) - without.GetStat(stat)
}

func TestScrollsGrantTheirClientStats(t *testing.T) {
	for _, tc := range []struct {
		name   string
		stat   stats.Stat
		amount float64
		set    func(*proto.ConsumesSpec)
	}{
		{"Scroll of Agility IV", stats.Agility, 17, func(c *proto.ConsumesSpec) { c.ScrollAgi = true }},
		{"Scroll of Strength IV", stats.Strength, 17, func(c *proto.ConsumesSpec) { c.ScrollStr = true }},
		{"Scroll of Intellect IV", stats.Intellect, 16, func(c *proto.ConsumesSpec) { c.ScrollInt = true }},
		{"Scroll of Spirit IV", stats.Spirit, 15, func(c *proto.ConsumesSpec) { c.ScrollSpi = true }},
		{"Scroll of Protection IV", stats.Armor, 240, func(c *proto.ConsumesSpec) { c.ScrollArm = true }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			delta := consumesStatDelta(t, tc.stat, func(request *proto.RaidSimRequest) {
				tc.set(consumesOf(request))
			})
			if !WithinToleranceFloat64(tc.amount, delta, 0.01) {
				t.Fatalf("%s should grant %0.0f %s, got %0.2f", tc.name, tc.amount, tc.stat.StatName(), delta)
			}
		})
	}
}

func TestScrollDoesNotStackWithTheRaidBuffOfTheSameStat(t *testing.T) {
	arcaneBrilliance := func(request *proto.RaidSimRequest) {
		request.Raid.Buffs.ArcaneBrilliance = true
	}
	buffOnly := consumesStatDelta(t, stats.Intellect, arcaneBrilliance)
	buffAndScroll := consumesStatDelta(t, stats.Intellect, func(request *proto.RaidSimRequest) {
		arcaneBrilliance(request)
		consumesOf(request).ScrollInt = true
	})

	if !WithinToleranceFloat64(buffOnly, buffAndScroll, 0.01) {
		t.Fatalf("Scroll of Intellect should not add to Arcane Brilliance: buff %0.2f, buff + scroll %0.2f", buffOnly, buffAndScroll)
	}
}

func TestElementalSharpeningStoneCritIsMeleeOnly(t *testing.T) {
	_, without := setupConsumesSim(nil)
	_, with := setupConsumesSim(func(request *proto.RaidSimRequest) {
		consumesOf(request).MhImbueId = 22756
	})

	meleeDelta := with.GetStat(stats.PhysicalCritPercent) - without.GetStat(stats.PhysicalCritPercent)
	if !WithinToleranceFloat64(2, meleeDelta, 0.001) {
		t.Fatalf("Elemental Sharpening Stone should grant 2%% melee crit, got %0.3f%%", meleeDelta)
	}

	rangedCrit := func(fw *FakeRageWarrior) float64 {
		return fw.GetStat(stats.RangedCritPercent) + fw.GetStat(stats.PhysicalCritPercent)
	}
	if rangedDelta := rangedCrit(with) - rangedCrit(without); !WithinToleranceFloat64(0, rangedDelta, 0.001) {
		t.Fatalf("Elemental Sharpening Stone should leave ranged crit alone, got %0.3f%%", rangedDelta)
	}

	pseudoStats := with.GetPseudoStatsProto()
	basePseudoStats := without.GetPseudoStatsProto()
	meleeShown := pseudoStats[proto.PseudoStat_PseudoStatMeleeCritPercent] - basePseudoStats[proto.PseudoStat_PseudoStatMeleeCritPercent]
	rangedShown := pseudoStats[proto.PseudoStat_PseudoStatRangedCritPercent] - basePseudoStats[proto.PseudoStat_PseudoStatRangedCritPercent]
	if !WithinToleranceFloat64(2, meleeShown, 0.001) || !WithinToleranceFloat64(0, rangedShown, 0.001) {
		t.Fatalf("Character stats should show +2%% melee and +0%% ranged crit, got %0.3f%% and %0.3f%%", meleeShown, rangedShown)
	}
}

func TestDenseStoneOnlyArmsTheHandItIsOn(t *testing.T) {
	for _, tc := range []struct {
		name    string
		imbueId int32
	}{
		{"Dense Sharpening Stone", 16138},
		{"Dense Weightstone", 16622},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, mainHand := setupConsumesSim(func(request *proto.RaidSimRequest) {
				consumesOf(request).MhImbueId = tc.imbueId
			})
			if mainHand.AutoAttacks.MH().BaseDamageMin != 8 || mainHand.AutoAttacks.MH().BaseDamageMax != 8 {
				t.Fatalf("%s should add 8 main hand weapon damage, got %0.2f - %0.2f",
					tc.name, mainHand.AutoAttacks.MH().BaseDamageMin, mainHand.AutoAttacks.MH().BaseDamageMax)
			}
			if mainHand.AutoAttacks.OH().BaseDamageMax != 0 || mainHand.AutoAttacks.Ranged().BaseDamageMax != 0 {
				t.Fatalf("%s on the main hand should leave the off hand and the ranged weapon alone", tc.name)
			}

			_, offHand := setupConsumesSim(func(request *proto.RaidSimRequest) {
				consumesOf(request).OhImbueId = tc.imbueId
			})
			if offHand.AutoAttacks.OH().BaseDamageMin != 8 || offHand.AutoAttacks.OH().BaseDamageMax != 8 {
				t.Fatalf("%s should add 8 off hand weapon damage, got %0.2f - %0.2f",
					tc.name, offHand.AutoAttacks.OH().BaseDamageMin, offHand.AutoAttacks.OH().BaseDamageMax)
			}
			if offHand.AutoAttacks.MH().BaseDamageMax != 0 {
				t.Fatalf("%s on the off hand should leave the main hand alone", tc.name)
			}
		})
	}
}

func TestWizardOilGrantsSpellDamage(t *testing.T) {
	delta := consumesStatDelta(t, stats.SpellDamage, func(request *proto.RaidSimRequest) {
		consumesOf(request).MhImbueId = 25121
	})
	if !WithinToleranceFloat64(24, delta, 0.01) {
		t.Fatalf("Wizard Oil should grant 24 spell damage, got %0.2f", delta)
	}
}

func TestBlessedWizardOilOnlyHelpsVersusUndead(t *testing.T) {
	_, fw := setupConsumesSim(func(request *proto.RaidSimRequest) {
		consumesOf(request).MhImbueId = 28898
	})

	if delta := fw.GetStat(stats.SpellDamage); delta != 0 {
		t.Fatalf("Blessed Wizard Oil should not grant flat spell damage, got %0.2f", delta)
	}

	attackTable := fw.AttackTables[fw.CurrentTarget.UnitIndex]
	undead := attackTable.MobTypeBonusStats[proto.MobType_MobTypeUndead][stats.SpellDamage]
	if !WithinToleranceFloat64(58, undead, 0.01) {
		t.Fatalf("Blessed Wizard Oil should grant 58 spell damage versus Undead, got %0.2f", undead)
	}
	if demon := attackTable.MobTypeBonusStats[proto.MobType_MobTypeDemon][stats.SpellDamage]; demon != 0 {
		t.Fatalf("Blessed Wizard Oil should not help versus Demons, got %0.2f", demon)
	}
}

func TestThoriumGrenadeDealsItsClientDamage(t *testing.T) {
	sim, fw := setupConsumesSim(func(request *proto.RaidSimRequest) {
		request.Raid.Parties[0].Players[0].Profession1 = proto.Profession_Engineering
		consumesOf(request).ExplosiveId = 19769
	})

	grenade := fw.GetSpell(ThoriumGrenadeActionID)
	if grenade == nil {
		t.Fatal("Thorium Grenade is not registered")
	}
	if !grenade.Cast(sim, fw.CurrentTarget) {
		t.Fatal("Thorium Grenade could not be cast")
	}
	metrics := &grenade.SpellMetrics[fw.CurrentTarget.UnitIndex]
	for range 100 {
		if metrics.TotalDamage > 0 {
			break
		}
		sim.Step()
	}

	if metrics.Hits+metrics.Crits != 1 {
		t.Fatalf("Thorium Grenade should have landed exactly once, got %d hits and %d crits", metrics.Hits, metrics.Crits)
	}
	scale := 1.0
	if metrics.Crits == 1 {
		scale = grenade.CritDamageMultiplier(fw.AttackTables[fw.CurrentTarget.UnitIndex])
	}
	if metrics.TotalDamage < 300*scale || metrics.TotalDamage > 500*scale {
		t.Fatalf("Thorium Grenade should deal %0.2f - %0.2f damage, got %0.2f", 300*scale, 500*scale, metrics.TotalDamage)
	}
}

func TestScrollOfCryoblastIsAMageScroll(t *testing.T) {
	_, warrior := setupConsumesSim(func(request *proto.RaidSimRequest) {
		consumesOf(request).ExplosiveId = CryoblastSpellID
	})
	if warrior.GetSpell(CryoblastActionID) != nil {
		t.Fatal("Scroll of Cryoblast is mage only")
	}

	sim, mage := setupConsumesSim(func(request *proto.RaidSimRequest) {
		request.Raid.Parties[0].Players[0].Class = proto.Class_ClassMage
		consumesOf(request).ExplosiveId = CryoblastSpellID
	})
	scroll := mage.GetSpell(CryoblastActionID)
	if scroll == nil {
		t.Fatal("Scroll of Cryoblast should need no Engineering")
	}
	if !scroll.Cast(sim, mage.CurrentTarget) {
		t.Fatal("Scroll of Cryoblast could not be cast")
	}
	metrics := &scroll.SpellMetrics[mage.CurrentTarget.UnitIndex]
	scale := 1.0
	if metrics.Crits == 1 {
		scale = scroll.CritDamageMultiplier(mage.AttackTables[mage.CurrentTarget.UnitIndex])
	}
	if metrics.TotalDamage < 183*scale || metrics.TotalDamage > 247*scale {
		t.Fatalf("Scroll of Cryoblast should deal %0.2f - %0.2f damage, got %0.2f", 183*scale, 247*scale, metrics.TotalDamage)
	}
}

func TestMajorHealthstoneHeal(t *testing.T) {
	sim, fw := setupConsumesSim(func(request *proto.RaidSimRequest) {
		consumes := consumesOf(request)
		consumes.ConjuredId = 9421
		consumes.ConjuredItems = []int32{9421}
	})

	healthstone := fw.GetSpell(ActionID{ItemID: 9421})
	if healthstone == nil {
		t.Fatal("Major Healthstone is not registered")
	}
	fw.RemoveHealth(sim, 2000)
	before := fw.CurrentHealth()
	if !healthstone.Cast(sim, fw.CurrentTarget) {
		t.Fatal("Major Healthstone could not be cast")
	}
	if healed := fw.CurrentHealth() - before; healed != 1440 {
		t.Fatalf("Major Healthstone should heal 1440, healed %0.2f", healed)
	}
}

func TestConjuredItemMissingFromTheDatabaseIsSkipped(t *testing.T) {
	_, fw := setupConsumesSim(func(request *proto.RaidSimRequest) {
		consumes := consumesOf(request)
		consumes.ConjuredId = 22105
		consumes.ConjuredItems = []int32{22105}
	})

	for _, spell := range fw.Spellbook {
		if spell.ActionID.IsEmptyAction() {
			t.Fatalf("A conjured item missing from the database registered a spell without an action id")
		}
	}
	for _, mcd := range fw.GetMajorCooldowns() {
		if mcd.Spell.Flags.Matches(SpellFlagConjured) {
			t.Fatalf("A conjured item missing from the database should not add a major cooldown")
		}
	}
}

// ItemSparse (70009) puts Engineering on Thorium Grenade and Dense Dynamite only; Ez-Thro
// Dynamite II, Crystal Charge and the SAF-T / EZ-Thro bombs are for everyone.
func TestOnlyEngineeringBombsNeedEngineering(t *testing.T) {
	for _, c := range []struct {
		explosiveId int32
		actionID    ActionID
		engineering bool
	}{
		{18588, EzThroDynamiteTwoActionID, false},
		{15239, CrystalChargeActionID, false},
		{19769, ThoriumGrenadeActionID, true},
		{23063, DenseDynamiteActionID, true},
		{1269334, ActionID{ItemID: 260817}, false}, // EZ-Thro Dark Bomb
		{1269161, ActionID{ItemID: 260793}, false}, // SAF-T Copper Bomb
	} {
		_, warrior := setupConsumesSim(func(request *proto.RaidSimRequest) {
			consumesOf(request).ExplosiveId = c.explosiveId
		})
		if got := warrior.GetSpell(c.actionID) != nil; got == c.engineering {
			t.Errorf("%v without Engineering: registered = %v, want %v", c.actionID, got, !c.engineering)
		}
	}
}
