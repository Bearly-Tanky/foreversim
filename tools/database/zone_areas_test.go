package database

import (
	"slices"
	"testing"

	"github.com/wowsims/forever/sim/core/proto"
)

// 9161 Forest, 9165 Mountainous, 9203 Volcanic, 9324 Cavernous; 9071 is a single zone.
func TestApplyZoneAreas(t *testing.T) {
	zones := map[int32]*proto.UIZone{
		2677: {Id: 2677, Name: "Blackwing Lair"},
		3456: {Id: 3456, Name: "Naxxramas"},
	}
	areas := []areaTableRow{
		{ID: 2677, Name: "Blackwing Lair"},
		{ID: 3456, Name: "Naxxramas"},
		{ID: 16394, Name: "Naxxramas"},
		{ID: 44, Name: "Redridge Mountains"},
		{ID: 1000, Name: "Redridge Mountains", ParentID: 44},
		{ID: 1001, Name: "Lakeshire", ParentID: 44},
		{ID: 40, Name: "Westfall"},
	}
	members := []areaGroupMember{
		{9324, 2677}, {9203, 2677},
		{9202, 16394}, {9324, 3456},
		{9161, 1000}, {9165, 44}, {9161, 1001},
		{9071, 40},
		{9161, 99999},
	}

	applyZoneAreas(zones, members, areas)

	if got := zones[2677].AreaTypes; !slices.Equal(got, []proto.AreaType{proto.AreaType_AreaTypeCavernous, proto.AreaType_AreaTypeVolcanic}) {
		t.Errorf("Blackwing Lair reads %v, want Cavernous and Volcanic in enum order", got)
	}
	if got := zones[3456].AreaTypes; !slices.Equal(got, []proto.AreaType{proto.AreaType_AreaTypeHaunted, proto.AreaType_AreaTypeCavernous}) {
		t.Errorf("Naxxramas reads %v, want the second top-level row's Haunted folded into the zone the item sources know", got)
	}
	if _, dup := zones[16394]; dup {
		t.Error("the second top-level Naxxramas row became a zone of its own")
	}
	if got := zones[44]; got == nil || got.Name != "Redridge Mountains" ||
		!slices.Equal(got.AreaTypes, []proto.AreaType{proto.AreaType_AreaTypeForestGrassland, proto.AreaType_AreaTypeMountainous}) {
		t.Errorf("Redridge reads %v, want one top-level zone that is Forest and Mountainous", got)
	}
	if _, dup := zones[1000]; dup {
		t.Error("the sub-area row named like its zone became a zone of its own")
	}
	if got := zones[1001]; got == nil || !slices.Equal(got.AreaTypes, []proto.AreaType{proto.AreaType_AreaTypeForestGrassland}) {
		t.Errorf("Lakeshire reads %v, want its own Forest zone since no top-level row shares its name", got)
	}
	if _, present := zones[40]; present {
		t.Error("a single-zone group made Westfall a zone")
	}
	if _, present := zones[99999]; present {
		t.Error("an area the client does not name became a zone")
	}
}
