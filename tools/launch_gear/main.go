// Builds launch-tier gear sets: the best pre-raid gear in the launch item pool.
//
// The item database is generated with everything past launch already filtered out (see
// tools/database/launch_content.go), but it keeps Molten Core and Onyxia's Lair because
// both open at launch. A launch set is what a character walks into those raids wearing,
// so their loot is excluded here as well, and the pool is every other item the spec can
// wear. Within it each slot takes the item with the highest EP against the weights in
// specs.go; those are each spec's own stat weights from its ui/<spec>/sim.ts, so the sets
// value the same things the spec pages do.
//
//	go run --tags=with_db ./tools/launch_gear -spec retribution_paladin [-dir /tmp/out]
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/wowsims/forever/assets/database"
	"github.com/wowsims/forever/sim/core/proto"
)

// Every raid and world boss. A launch set is pre-raid gear: what a character walks into the
// launch raids (Molten Core, Onyxia) wearing, so their loot is out, and so is everything from
// the raids that open later. The item database used to be generated with post-launch content
// already filtered out; the forever-next database carries every phase marked phase 1, so the
// filter has to live here. Without it the "launch" sets averaged item level 72-76 on Naxxramas
// and Ahn'Qiraj loot.
var raidZones = map[int32]bool{
	2717: true, // Molten Core
	2159: true, // Onyxia's Lair
	2677: true, // Blackwing Lair
	1977: true, // Zul'Gurub
	3429: true, // Ruins of Ahn'Qiraj
	3428: true, // Ahn'Qiraj
	3456: true, // Naxxramas
	16:   true, // Azshara (Azuregos)
	4:    true, // Blasted Lands (Lord Kazzak)
}

// Items with no drop to judge by - crafted, quest rewards, world drops, PvP rewards, raid
// turn-ins that carry no source at all - are held to the ceiling of pre-raid dungeon loot:
// Stratholme and Scholomance top out at 65. Above that it is raid-tier crafting, PvP rank
// gear and raid turn-ins.
const maxUnsourcedIlvl = 66

func preRaid(item *proto.UIItem) bool {
	dropped := false
	for _, source := range item.Sources {
		if drop := source.GetDrop(); drop != nil {
			if !raidZones[drop.ZoneId] {
				return true
			}
			dropped = true
		}
	}
	return !dropped && item.ScalingOptions[0].GetIlvl() <= maxUnsourcedIlvl && !zulGurubCrafts[item.Id]
}

// Crafts under the unsourced ceiling whose reagents only drop in Zul'Gurub.
// ponytail: listed by hand; a reagent-source check would catch any others.
var zulGurubCrafts = map[int32]bool{
	19682: true, // Bloodvine Vest
	19683: true, // Bloodvine Leggings
	19684: true, // Bloodvine Boots
}

type slot struct {
	name  string
	types []proto.ItemType
	count int
}

var slots = []slot{
	{"head", []proto.ItemType{proto.ItemType_ItemTypeHead}, 1},
	{"neck", []proto.ItemType{proto.ItemType_ItemTypeNeck}, 1},
	{"shoulder", []proto.ItemType{proto.ItemType_ItemTypeShoulder}, 1},
	{"back", []proto.ItemType{proto.ItemType_ItemTypeBack}, 1},
	{"chest", []proto.ItemType{proto.ItemType_ItemTypeChest}, 1},
	{"wrist", []proto.ItemType{proto.ItemType_ItemTypeWrist}, 1},
	{"hands", []proto.ItemType{proto.ItemType_ItemTypeHands}, 1},
	{"waist", []proto.ItemType{proto.ItemType_ItemTypeWaist}, 1},
	{"legs", []proto.ItemType{proto.ItemType_ItemTypeLegs}, 1},
	{"feet", []proto.ItemType{proto.ItemType_ItemTypeFeet}, 1},
	{"finger", []proto.ItemType{proto.ItemType_ItemTypeFinger}, 2},
	{"trinket", []proto.ItemType{proto.ItemType_ItemTypeTrinket}, 2},
	{"ranged", []proto.ItemType{proto.ItemType_ItemTypeRanged}, 1},
}

func main() {
	specName := flag.String("spec", "", "entry in specs.go, e.g. retribution_paladin")
	out := flag.String("out", "", "gear set name to write; defaults to the spec entry's")
	dir := flag.String("dir", filepath.Join("ui", "specs"), "output root; the set goes to <dir>/<class>/<spec>/gear_sets/")
	phase1 := flag.Bool("p1", false, "admit Molten Core and Onyxia loot: the phase 1 best-in-slot pool")
	flag.Parse()
	if *phase1 {
		delete(raidZones, 2717)
		delete(raidZones, 2159)
	}

	spec, ok := specs[*specName]
	if !ok {
		fmt.Fprintf(os.Stderr, "unknown spec %q\n", *specName)
		os.Exit(1)
	}
	if *out != "" {
		spec.set = *out
	}
	if spec.set == "" {
		spec.set = "launch"
	}

	db := database.Load()

	pool := []*proto.UIItem{}
	for _, item := range db.Items {
		if !spec.allows(item) || !preRaid(item) {
			continue
		}
		pool = append(pool, item)
	}

	picked := []map[string]any{}
	used := map[string]bool{}

	pick := func(matches func(*proto.UIItem) bool, count int) {
		candidates := []*proto.UIItem{}
		for _, item := range pool {
			if matches(item) {
				candidates = append(candidates, item)
			}
		}
		sort.SliceStable(candidates, func(i, j int) bool {
			return spec.ep(candidates[i], ranged) > spec.ep(candidates[j], ranged)
		})
		taken := 0
		for _, item := range candidates {
			if taken >= count {
				break
			}
			// Two rings or trinkets of the same name cannot both be worn, and the two
			// factions' copies of one PvP ring are the same ring.
			if used[item.Name] || used[fingerprint(item)] {
				continue
			}
			used[item.Name], used[fingerprint(item)] = true, true
			picked = append(picked, map[string]any{"id": item.Id})
			fmt.Printf("  %-9s %-42s ep %7.1f\n", item.Type.String()[8:], item.Name, spec.ep(item, ranged))
			taken++
		}
		for ; taken < count; taken++ {
			fmt.Printf("  %-9s (nothing matched)\n", "?")
		}
	}

	for _, s := range slots {
		pick(func(item *proto.UIItem) bool {
			for _, t := range s.types {
				if item.Type == t {
					return true
				}
			}
			return false
		}, s.count)
	}

	for _, held := range spec.pickWeapons(pool) {
		picked = append(picked, map[string]any{"id": held.item.Id})
		fmt.Printf("  %-9s %-42s ep %7.1f\n", held.item.WeaponType.String()[10:], held.item.Name, spec.ep(held.item, held.hand))
	}

	path := filepath.Join(*dir, spec.dir, "gear_sets", spec.set+".gear.json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		panic(err)
	}
	body, _ := json.Marshal(map[string]any{"items": picked})
	if err := os.WriteFile(path, append(body, '\n'), 0644); err != nil {
		panic(err)
	}
	fmt.Printf("wrote %s (%d items)\n", path, len(picked))
}
