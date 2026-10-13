// Assembles the arena's per-spec output into the one file the site reads.
//
// Each spec's test writes its own builds, because `go test` runs packages concurrently and
// a shared file would be a race. This merges them, scores each build against the evidence
// manifest, and records which commit produced the numbers - which is the whole cache story:
// the file is the cache, the commit is the key, and the workflow that runs the arena on push
// is what invalidates it. Nothing has to notice that the sim changed, because the only thing
// that ever writes this file is a run that happened after the change.
//
// Usage: go run ./tools/arena <arena-out-dir> [ui/app/arena/results.json]
//
// Input is one JSON array of rawResult per spec: sim/arenalib's TestArena hooks write them,
// and so does tools/parity (one equal-stat build per spec) with ARENA_OUT set. ARENA_ITERATIONS (default 5000) is
// what the page says each build was run for, and ARENA_SIM names the engine that ran them.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Mirrors sim/arenalib.Result. Duplicated rather than imported because that type lives in a
// package the compiler only builds for tests.
type rawResult struct {
	Spec         string             `json:"spec"`
	Talents      string             `json:"talents"`
	Build        string             `json:"build"`
	Gear         string             `json:"gear"`
	Rotation     string             `json:"rotation"`
	Consumables  string             `json:"consumables"`
	Dps          float64            `json:"dps"`
	Damage       map[string]float64 `json:"damage"`
	WeaponDamage float64            `json:"weaponDamage"`
	Optimised    bool               `json:"optimised"`
}

// Only the fields the scoring needs; the manifest carries more.
type spellSource struct {
	Source   string          `json:"source"`
	Measured json.RawMessage `json:"measured"`
}

// What the page renders. Damage is not carried through: a few hundred builds times their
// spell breakdowns is megabytes, and the composition is the only part anyone reads.
type build struct {
	Spec     string `json:"spec"`
	Build    string `json:"build"`
	Talents  string `json:"talents"`
	Gear     string `json:"gear"`
	Rotation string `json:"rotation"`
	// Which consumable list the build drank. The arena equalises these; the page says so
	// rather than asking anyone to take it on trust.
	Consumables string             `json:"consumables"`
	Dps         float64            `json:"dps"`
	Rests       map[string]float64 `json:"rests"`
	// Average item level of the gear set, and how many slots it actually fills. Both, because
	// a set of eight items can average a respectable number while the character wearing it is
	// missing half its slots.
	Ilvl  float64 `json:"ilvl"`
	Slots int     `json:"slots"`
	// Found by searching the talent trees rather than written down by a person.
	Optimised bool `json:"optimised,omitempty"`
	// Only carried when it is not the 51 a level 60 character has.
	Points int `json:"points,omitempty"`
}

type output struct {
	// Which engine produced these: master's or forever-next's.
	Sim string `json:"sim"`
	// Which sim produced these. A page can compare it against its own build and say so when
	// the two have drifted apart.
	Commit     string    `json:"commit"`
	Generated  time.Time `json:"generated"`
	Iterations int       `json:"iterations"`
	// Which machine ran it. The long searches moved off CI onto a host with more cores and no
	// six hour job ceiling, so "where did this number come from" stopped being answerable
	// from the workflow file alone.
	Host   string  `json:"host,omitempty"`
	Builds []build `json:"builds"`
}

func main() {
	if len(os.Args) < 2 || len(os.Args) > 3 {
		fail("usage: go run ./tools/arena <arena-out-dir> [ui/app/arena/results.json]")
	}
	inDir, outPath := os.Args[1], "ui/app/arena/results.json"
	if len(os.Args) == 3 {
		outPath = os.Args[2]
	}
	iterations, err := strconv.Atoi(os.Getenv("ARENA_ITERATIONS"))
	if err != nil {
		iterations = 5000
	}
	engine := os.Getenv("ARENA_SIM")
	if engine == "" {
		engine = "forever-next"
	}

	manifest := loadManifest("ui/sim/spells")
	ilvls := loadItemLevels()
	builds := []build{}

	entries, err := os.ReadDir(inDir)
	if err != nil {
		fail("%s: %s", inDir, err)
	}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		var raw []rawResult
		read(filepath.Join(inDir, entry.Name()), &raw)
		for _, result := range raw {
			// A build that produced no damage ran into something the sim could not do with it.
			// Ranking it at zero would put it bottom of a leaderboard as though that were a
			// finding about the build rather than about the run.
			if result.Dps <= 0 {
				fmt.Fprintf(os.Stderr, "skipping %s / %s / %s: no damage\n", result.Spec, result.Build, result.Gear)
				continue
			}
			gearIlvl, slots := gearLevel(ilvls, result.Spec, result.Gear)
			builds = append(builds, build{
				Spec:        result.Spec,
				Build:       result.Build,
				Talents:     result.Talents,
				Gear:        result.Gear,
				Rotation:    result.Rotation,
				Consumables: result.Consumables,
				Dps:         result.Dps,
				Rests:       compose(result, manifest),
				Optimised:   result.Optimised,
				Points:      shortOf51(result.Talents),
				Ilvl:        gearIlvl,
				Slots:       slots,
			})
		}
	}
	if len(builds) == 0 {
		fail("no builds in %s, so there is nothing to publish", inDir)
	}

	sort.Slice(builds, func(i, j int) bool { return builds[i].Dps > builds[j].Dps })

	encoded, err := json.MarshalIndent(output{
		Sim:        engine,
		Commit:     commit(),
		Generated:  time.Now().UTC().Truncate(time.Second),
		Iterations: iterations,
		Host:       host(),
		Builds:     builds,
	}, "", "\t")
	if err != nil {
		fail("%s", err)
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		fail("%s", err)
	}
	if err := os.WriteFile(outPath, append(encoded, '\n'), 0o644); err != nil {
		fail("%s", err)
	}
	fmt.Printf("%d builds across %d specs -> %s\n", len(builds), countSpecs(builds), outPath)
}

// Share of the build's damage per evidence tier. The same composition the rankings page
// computes in the browser, and deliberately the same shape: where a number came from is
// reported, never collapsed into a score that would need weights nobody can defend.
func compose(result rawResult, manifest map[int]spellSource) map[string]float64 {
	rests := map[string]float64{"measured": 0, "forever": 0, "classic": 0, "core": 0, "assumed": 0, "unknown": 0}
	total := result.WeaponDamage
	rests["core"] = result.WeaponDamage

	for id, damage := range result.Damage {
		total += damage
		rests[tierOf(id, manifest)] += damage
	}
	if total == 0 {
		return rests
	}
	for tier := range rests {
		rests[tier] = round(rests[tier] / total)
	}
	return rests
}

func tierOf(id string, manifest map[int]spellSource) string {
	spellId, err := strconv.Atoi(id)
	if err != nil || spellId == 0 {
		return "unknown"
	}
	source, ok := manifest[spellId]
	if !ok {
		return "unknown"
	}
	if len(source.Measured) > 0 {
		return "measured"
	}
	if source.Source == "unreviewed" || source.Source == "" {
		return "unknown"
	}
	return source.Source
}

func loadManifest(dir string) map[int]spellSource {
	entries, err := os.ReadDir(dir)
	if err != nil {
		fail("%s: %s", dir, err)
	}
	manifest := map[int]spellSource{}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		var file map[string]spellSource
		read(filepath.Join(dir, entry.Name()), &file)
		for id, source := range file {
			spellId, err := strconv.Atoi(id)
			if err != nil {
				fail("%s: %q is not a spell id", entry.Name(), id)
			}
			manifest[spellId] = source
		}
	}
	return manifest
}

// The sim the numbers came from. Empty outside a checkout rather than fatal, so the merge
// still works when somebody runs it by hand.
func commit() string {
	out, err := exec.Command("git", "rev-parse", "HEAD").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// Where it ran. CI sets GITHUB_ACTIONS, everything else is a person's machine and the
// hostname is the honest answer.
func host() string {
	if os.Getenv("GITHUB_ACTIONS") != "" {
		return "github-actions"
	}
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	return name
}

// What the build spends, and zero when that is the 51 a level 60 character has - so the
// page only has to check for a number rather than compare against a constant.
//
// Counted here rather than recorded by the runner, because it is a property of the talents
// string and deriving it costs nothing, while carrying it would mean every result on disk
// had to be regenerated to gain a field the string already contains.
func shortOf51(talents string) int {
	points := 0
	for _, char := range talents {
		if char >= '0' && char <= '9' {
			points += int(char - '0')
		}
	}
	if points == 51 {
		return 0
	}
	return points
}

// Item levels, from the database the site already ships. Read here rather than recorded by
// the runner so that adding this needed no re-simulation of anything.
func loadItemLevels() map[int]int {
	ilvls := map[int]int{}
	for _, name := range []string{"db.json", "leftover_db.json"} {
		var database struct {
			Items []struct {
				Id   int `json:"id"`
				Ilvl int `json:"ilvl"`
				// forever-next's database carries the level per scaling option, the base one at "0".
				ScalingOptions map[string]struct {
					Ilvl int `json:"ilvl"`
				} `json:"scalingOptions"`
			} `json:"items"`
		}
		data, err := os.ReadFile(filepath.Join("assets", "database", name))
		if err != nil {
			continue
		}
		if json.Unmarshal(data, &database) != nil {
			continue
		}
		for _, item := range database.Items {
			if item.Ilvl == 0 {
				item.Ilvl = item.ScalingOptions["0"].Ilvl
			}
			if item.Ilvl > 0 {
				ilvls[item.Id] = item.Ilvl
			}
		}
	}
	if len(ilvls) == 0 {
		fail("no item levels in assets/database, so gear sets cannot be compared")
	}
	return ilvls
}

// The average item level of a gear set, and the number of slots it fills.
//
// Averaged over the items present rather than over seventeen slots: a set that leaves a slot
// empty has not equipped a level zero item there, it has equipped nothing, and dividing by
// slots nobody filled would understate the gear rather than describe it. The slot count is
// reported alongside so an eight item set cannot pass itself off as a full one.
func gearLevel(ilvls map[int]int, spec string, gear string) (float64, int) {
	var set struct {
		Items []struct {
			Id int `json:"id"`
		} `json:"items"`
	}
	data, err := os.ReadFile(filepath.Join("ui", "specs", specDirs[spec], "gear_sets", gear+".gear.json"))
	if err != nil {
		return 0, 0
	}
	if json.Unmarshal(data, &set) != nil {
		return 0, 0
	}

	total, known, slots := 0, 0, 0
	for _, item := range set.Items {
		if item.Id == 0 {
			continue
		}
		slots++
		if ilvl, ok := ilvls[item.Id]; ok {
			total += ilvl
			known++
		}
	}
	if known == 0 {
		return 0, slots
	}
	return float64(int(float64(total)/float64(known)*10+0.5)) / 10, slots
}

// Results are keyed by master's ui/ directory; forever-next keeps each spec under ui/specs.
// Both priests are its one DPS priest.
var specDirs = map[string]string{
	"balance_druid":       "druid/balance",
	"feral_druid":         "druid/feralcat",
	"feral_tank_druid":    "druid/feralbear",
	"elemental_shaman":    "shaman/elemental",
	"enhancement_shaman":  "shaman/enhancement",
	"hunter":              "hunter/dps",
	"mage":                "mage/dps",
	"protection_paladin":  "paladin/protection",
	"retribution_paladin": "paladin/retribution",
	"rogue":               "rogue/dps",
	"shadow_priest":       "priest/dps",
	"smite_priest":        "priest/dps",
	"tank_warrior":        "warrior/protection",
	"warlock":             "warlock/dps",
	"warrior":             "warrior/dps",
}

func countSpecs(builds []build) int {
	specs := map[string]bool{}
	for _, b := range builds {
		specs[b.Spec] = true
	}
	return len(specs)
}

// Four decimal places: a hundredth of a percent, which is finer than anything the page
// shows and keeps the committed file from churning on floating point noise.
func round(value float64) float64 {
	return float64(int64(value*10000+0.5)) / 10000
}

func read(path string, into any) {
	data, err := os.ReadFile(path)
	if err != nil {
		fail("%s: %s", path, err)
	}
	if err := json.Unmarshal(data, into); err != nil {
		fail("%s: %s", path, err)
	}
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
