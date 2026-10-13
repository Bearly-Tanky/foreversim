//go:build with_db

package sim

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
)

// ItemSparse.AllowableClass reaches the sim as the item's class allowlist, playable classes only.
func TestClassRestrictedItemsCarryTheirAllowlist(t *testing.T) {
	for id, want := range map[int32][]proto.Class{
		14152: {proto.Class_ClassMage},    // Robe of the Archmage
		19339: {proto.Class_ClassMage},    // Mind Quickening Gem, AllowableClass 31360
		19343: {proto.Class_ClassPaladin}, // Scrolls of Blinding Light
		19951: {proto.Class_ClassWarrior}, // Gri'lek's Charm of Might
		19954: {proto.Class_ClassRogue},   // Renataki's Charm of Trickery
	} {
		item := core.GetItemByID(id)
		if item == nil {
			t.Errorf("item %d is not in the database", id)
			continue
		}
		if !slices.Equal(item.ClassAllowlist, want) {
			t.Errorf("item %d %s class allowlist = %v, want %v", id, item.Name, item.ClassAllowlist, want)
		}
	}
}

// Gri'lek's Charm of Valor 19952 may only be used by a paladin: its on-use registers for a paladin
// wearing it and not for a warrior.
func TestClassRestrictedOnUseRegistersOnlyForItsClass(t *testing.T) {
	const charmID int32 = 19952

	onUseFor := func(player *proto.Player) *core.Spell {
		items := make([]*proto.ItemSpec, proto.ItemSlot_ItemSlotTrinket1+1)
		for i := range items {
			items[i] = &proto.ItemSpec{}
		}
		items[proto.ItemSlot_ItemSlotTrinket1] = &proto.ItemSpec{Id: charmID}
		player.Name = "Charm Tester"
		player.Race = proto.Race_RaceHuman
		player.Equipment = &proto.EquipmentSpec{Items: items}

		sim := core.NewSim(&proto.RaidSimRequest{
			SimOptions: &proto.SimOptions{RandomSeed: 1},
			Raid:       &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}, Buffs: &proto.PartyBuffs{}}}},
			Encounter:  STEncounter,
		}, simsignals.CreateSignals())
		return sim.Raid.Parties[0].Players[0].GetCharacter().GetSpell(core.ActionID{ItemID: charmID})
	}

	paladin := &proto.Player{Class: proto.Class_ClassPaladin, Spec: &proto.Player_RetributionPaladin{
		RetributionPaladin: &proto.RetributionPaladin{Options: &proto.RetributionPaladin_Options{ClassOptions: &proto.PaladinOptions{}}}}}
	if onUseFor(paladin) == nil {
		t.Errorf("a paladin wearing item %d has no on-use", charmID)
	}

	warrior := &proto.Player{Class: proto.Class_ClassWarrior, Spec: &proto.Player_DpsWarrior{
		DpsWarrior: &proto.DpsWarrior{Options: &proto.DpsWarrior_Options{ClassOptions: &proto.WarriorOptions{}}}}}
	if onUseFor(warrior) != nil {
		t.Errorf("a warrior wearing item %d has its on-use", charmID)
	}
}
