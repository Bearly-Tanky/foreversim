package arenalib

// Searching the talent trees, because enumerating them is not a thing anyone can do.
//
// There are 89,776,730,783,606,094 builds a warrior could actually spend - counted by
// tools/talents/count_builds.py from the trees themselves, enforcing rank caps, row gates
// and the prerequisite arrows. Legality matters and does not rescue this: it cuts the count
// about fourfold from the same walk without the arrows, leaving two billion years at a
// second a build.
//
// Nor does restricting it to builds anyone would run. Count only the all-or-nothing ones,
// every talent maxed or untouched, which is roughly what an optimal build looks like, and a
// warrior still has 57,341,667 of them and a mage 1,261,940,421. Eighteen months and forty
// years respectively. "Try every configuration" is not a large job, it is an impossible one,
// and the honest response is not to run a subset and call it the answer.
//
// So: climb instead. Start from a build somebody already believed in, and repeatedly ask
// what one point is worth. Take the point whose removal costs least, give it to the talent
// whose addition gains most, and keep going while that trade is positive. It finds a local
// maximum rather than the global one, and the difference matters least exactly where people
// care most - near a build the community has already converged on.
//
// Two things keep it honest. The marginal pass is an approximation, because talents interact
// and measuring them one at a time cannot see that; so the combined move is measured for
// real before it is accepted, and rejected if the pair is worth less than the parts
// suggested. And every run shares a random seed, so two builds are compared over the same
// stream of rolls and the difference between them is signal rather than noise.

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync/atomic"

	"github.com/wowsims/forever/sim/core/proto"
)

// Fewer iterations while searching than when reporting: a thousand comparisons at survey
// quality beats twenty at publication quality, and the winner is re-run properly at the end.
const searchIterations = int32(2000)

// A move has to be worth more than this to be taken. Below it the trade is inside the noise
// two 2000 iteration runs can produce even on a shared seed, and chasing it would walk the
// build sideways for hours.
const minimumGain = 0.001

// A character at 60 has 51 talent points. A build holding fewer is not a choice, it is a
// mistake, and the search fixes it rather than preserving it.
const talentBudget = 51

// How many steps the climb may take. Each step costs roughly one sim run per talent, so this
// is the knob that decides whether the job finishes inside its CI timeout.
const maxSteps = 20

type talent struct {
	Name      string `json:"fancyName"`
	MaxPoints int    `json:"maxPoints"`
	Location  struct {
		RowIdx int `json:"rowIdx"`
		ColIdx int `json:"colIdx"`
	} `json:"location"`
	PrereqLocation *struct {
		RowIdx int `json:"rowIdx"`
		ColIdx int `json:"colIdx"`
	} `json:"prereqLocation"`
}

type tree struct {
	Name    string   `json:"name"`
	Talents []talent `json:"talents"`
}

// A build as points per talent, in the same row-major order the talents string uses.
type allocation [][]int

func loadTrees(class proto.Class) ([]tree, error) {
	// ClassWarrior -> warrior.
	name := strings.ToLower(strings.TrimPrefix(class.String(), "Class"))
	data, err := os.ReadFile(filepath.Join(repoRoot(), "ui", "sim", "talents", "trees", name+".json"))
	if err != nil {
		return nil, fmt.Errorf("no talent tree for %s: %w", name, err)
	}
	var trees []tree
	if err := json.Unmarshal(data, &trees); err != nil {
		return nil, err
	}
	for i := range trees {
		sort.SliceStable(trees[i].Talents, func(a, b int) bool {
			left, right := trees[i].Talents[a].Location, trees[i].Talents[b].Location
			if left.RowIdx != right.RowIdx {
				return left.RowIdx < right.RowIdx
			}
			return left.ColIdx < right.ColIdx
		})
	}
	return trees, nil
}

func parseTalents(trees []tree, talents string) allocation {
	points := make(allocation, len(trees))
	parts := strings.Split(talents, "-")
	for i := range trees {
		points[i] = make([]int, len(trees[i].Talents))
		if i >= len(parts) {
			continue
		}
		for j, char := range parts[i] {
			if j >= len(points[i]) {
				break
			}
			if char >= '0' && char <= '9' {
				points[i][j] = int(char - '0')
			}
		}
	}
	return points
}

// The inverse, in the form the sim reads. Trailing zeros are trimmed the way every talent
// calculator writes them, so an optimised build can be pasted straight into the site.
func (points allocation) String() string {
	parts := make([]string, len(points))
	for i, tree := range points {
		var sb strings.Builder
		for _, p := range tree {
			sb.WriteByte(byte('0' + p))
		}
		parts[i] = strings.TrimRight(sb.String(), "0")
	}
	// A talents string keeps its separators even when the later trees are empty, otherwise
	// the second tree's points would be read as the first tree's.
	for len(parts) > 0 && parts[len(parts)-1] == "" {
		parts = parts[:len(parts)-1]
	}
	return strings.Join(parts, "-")
}

// The tree holding the most points; the earlier tree on a tie.
func mainTree(points allocation) int {
	at := 0
	for i, tree := range points {
		if sum(tree) > sum(points[at]) {
			at = i
		}
	}
	return at
}

func (points allocation) total() int {
	sum := 0
	for _, tree := range points {
		for _, p := range tree {
			sum += p
		}
	}
	return sum
}

func (points allocation) clone() allocation {
	out := make(allocation, len(points))
	for i, tree := range points {
		out[i] = append([]int(nil), tree...)
	}
	return out
}

// Whether the game would let somebody spend points this way: every talent inside its rank
// cap, every row reached by five points per row already spent in that tree, and every talent
// with an arrow into it fed by a maxed prerequisite.
func (points allocation) valid(trees []tree) bool {
	for i, tree := range trees {
		byLocation := map[[2]int]int{}
		for j, t := range tree.Talents {
			byLocation[[2]int{t.Location.RowIdx, t.Location.ColIdx}] = j
		}

		// Points in a row are only legal once enough points sit in the rows above it, and
		// "above" means anywhere in the tree, not on the path.
		above := map[int]int{}
		for j, t := range tree.Talents {
			above[t.Location.RowIdx] += points[i][j]
		}

		for j, t := range tree.Talents {
			if points[i][j] < 0 || points[i][j] > t.MaxPoints {
				return false
			}
			if points[i][j] == 0 {
				continue
			}

			earlier := 0
			for row, p := range above {
				if row < t.Location.RowIdx {
					earlier += p
				}
			}
			if earlier < 5*t.Location.RowIdx {
				return false
			}

			if t.PrereqLocation != nil {
				prereq, ok := byLocation[[2]int{t.PrereqLocation.RowIdx, t.PrereqLocation.ColIdx}]
				if !ok || points[i][prereq] < tree.Talents[prereq].MaxPoints {
					return false
				}
			}
		}
	}
	return true
}

// Which talents can move this spec's damage at all.
//
// Most of a tree cannot. Defensives, PvP talents, the ones the sim does not implement -
// spending a point there changes nothing, and every pass that prices them spends a run to
// rediscover that. Measuring once and skipping them afterwards roughly halves the cost of a
// step, which is what pays for searching several builds instead of one.
//
// The probe deliberately leaves the legal space: it adds a point on top of the build without
// taking one away, so the character briefly holds 52. The sim does not care - it applies
// whatever the string says - and nothing probed this way is ever published. Only the answer
// "did the number move" comes back out.
//
// Conservative in the direction that matters: a talent is dropped only when the number does
// not move at all, so anything with the faintest effect stays in the search.
func relevantTalents(trees []tree, base allocation, measure func(allocation) float64, baseDps float64) (map[[2]int]bool, map[[2]int]float64) {
	relevant := map[[2]int]bool{}
	// How much the number moved, kept because it is the only free estimate of a talent's
	// worth available - and free is what makes scoring a hundred thousand builds possible.
	value := map[[2]int]float64{}

	// One probe per talent, and every probe is independent, so they go out together. Fifty
	// odd sim runs is the cheapest part of a search but it is paid once per start and once
	// per anchor, which adds up to real minutes a spec.
	type probe struct {
		at       [2]int
		points   allocation
		emptying bool
	}
	probes := []probe{}
	for i, tree := range trees {
		for j, t := range tree.Talents {
			points := base.clone()
			// Maxed where it was not, emptied where it was, so the delta is always between
			// having the talent and not having it rather than between two partial ranks.
			emptying := points[i][j] >= t.MaxPoints
			if emptying {
				points[i][j] = 0
			} else {
				points[i][j] = t.MaxPoints
			}
			probes = append(probes, probe{at: [2]int{i, j}, points: points, emptying: emptying})
		}
	}

	dps := parallelMap(len(probes), func(k int) float64 { return measure(probes[k].points) })
	for k, p := range probes {
		moved := dps[k] - baseDps
		if moved == 0 {
			continue
		}
		relevant[p.at] = true
		if p.emptying {
			moved = -moved
		}
		value[p.at] = moved
	}
	return relevant, value
}

// One evaluated build.
type candidate struct {
	points allocation
	dps    float64
}

// Holds trees at fixed point counts while everything around them is optimised.
//
// The shapes players actually compare. One held tree is 31 points for its capstone or 21 for
// the talent two rows above it, with the other 20 or 30 wherever they do most. A split holds
// all three: two trees at 20/31, 21/30, 30/21 or 31/20 and the third empty, which is the
// "20 Arms / 31 Fury" question - an unconstrained climb finds one build and says nothing about
// what the spec can do if you commit differently, which is what anyone choosing a build asks.
type anchor struct {
	holds []hold
	label string
}

type hold struct {
	tree   int
	points int
}

// Whether a build has exactly the shape the anchor asks for. A nil anchor holds nothing.
func (a *anchor) allows(points allocation) bool {
	if a == nil {
		return true
	}
	for _, h := range a.holds {
		if sum(points[h.tree]) != h.points {
			return false
		}
	}
	return true
}

func (a *anchor) holding(tree int) bool {
	for _, h := range a.holds {
		if h.tree == tree {
			return true
		}
	}
	return false
}

// Returned when a shape cannot be spent at all, so the caller can say so and move on rather
// than publish the starting build under the shape's name.
var errUnreachable = errors.New("unreachable")

// Optimise climbs from a starting build, returning the best it reached and how many sim runs
// it took to get there.
//
// The shape of each step: price every point that could be taken out, price every point that
// could be put in, then actually run the best-looking trade rather than trusting the two
// halves to add up. Talents interact - a point in Flurry is worth more next to Enrage - and
// the separable estimate is only a way of deciding what to measure properly.
func optimise(spec Spec, start TalentBuild, gear string, rotations []string, budget int) (TalentBuild, string, int, error) {
	return optimiseAnchored(spec, start, gear, rotations, budget, nil)
}

// Climbs in whichever of the rotations suits the starting build best, and says which. One
// rotation for every climb optimised a Marksmanship or Subtlety shape for the Beast Mastery or
// Combat rotation, which is not how anyone plays that tree: outside builds beat those rows by
// 5-7% in the same sim until each climb picked its own.
func optimiseAnchored(spec Spec, start TalentBuild, gear string, rotations []string, budget int, shape *anchor) (TalentBuild, string, int, error) {
	trees, err := loadTrees(spec.Class)
	if err != nil {
		return start, "", 0, err
	}

	current := parseTalents(trees, start.Talents)
	if !current.valid(trees) {
		return start, "", 0, fmt.Errorf("%s is not a legal build to start from", start.Name)
	}

	runs := atomic.Int64{}
	rotation := rotations[0]
	measure := func(points allocation) float64 {
		runs.Add(1)
		return runAt(spec, TalentBuild{Talents: points.String()}, gear, rotation, searchIterations).Dps
	}

	// The starting build has to have the shape before the climb can preserve it, so points are
	// moved into or out of the held trees first until every count is right.
	if shape != nil {
		if current, err = reshape(trees, current, *shape); err != nil {
			return TalentBuild{}, "", 0, fmt.Errorf("%w: %s", errUnreachable, err)
		}
	}

	best := candidate{points: current, dps: measure(current)}
	for _, other := range rotations[1:] {
		runs.Add(1)
		if dps := runAt(spec, TalentBuild{Talents: current.String()}, gear, other, searchIterations).Dps; dps > best.dps {
			rotation, best.dps = other, dps
		}
	}
	relevant, _ := relevantTalents(trees, current, measure, best.dps)

	// Spend anything the starting build left on the table before trading points around.
	// Not hypothetical: the mage Frost community build spends 49 of its 51 points, and
	// every run of it on this site has been two points short of a character. A trade-only
	// search would have carried that forward forever, because moving a point never notices
	// that there is a point nobody moved.
	for best.points.total() < talentBudget && int(runs.Load()) < budget {
		added := false
		for _, add := range rank(trees, best.points, measure, best.dps, true, relevant) {
			trial := best.points.clone()
			trial[add.tree][add.talent]++
			if !trial.valid(trees) || !shape.allows(trial) {
				continue
			}
			best = candidate{points: trial, dps: measure(trial)}
			added = true
			break
		}
		if !added {
			break
		}
	}

	for step := 0; step < maxSteps && int(runs.Load()) < budget; step++ {
		removals := rank(trees, best.points, measure, best.dps, false, relevant)
		additions := rank(trees, best.points, measure, best.dps, true, relevant)

		// Only the few most promising trades are run for real. The estimate is good enough to
		// rank candidates and not good enough to accept one. Legality and shape are checked
		// before choosing rather than after: a split holds all three trees, so only a trade
		// inside one tree keeps it, and a grid of the top three each way is often all
		// cross-tree, which would end the climb at its first step.
		type trade struct {
			points   allocation
			estimate float64
		}
		trades := []trade{}
		for _, add := range topN(additions, 8) {
			for _, remove := range topN(removals, 8) {
				if add.tree == remove.tree && add.talent == remove.talent || add.delta+remove.delta <= 0 {
					continue
				}
				trial := best.points.clone()
				trial[remove.tree][remove.talent]--
				trial[add.tree][add.talent]++
				if trial.valid(trees) && trial.total() == best.points.total() && shape.allows(trial) {
					trades = append(trades, trade{trial, add.delta + remove.delta})
				}
			}
		}
		sort.SliceStable(trades, func(a, b int) bool { return trades[a].estimate > trades[b].estimate })

		improved := false
		for _, trade := range topN(trades, 9) {
			if int(runs.Load()) >= budget {
				break
			}
			if dps := measure(trade.points); dps > best.dps*(1+minimumGain) {
				best = candidate{points: trade.points, dps: dps}
				improved = true
				break
			}
		}
		if !improved {
			break
		}
	}

	name := start.Name
	if best.points.String() != start.Talents {
		name = strings.TrimSuffix(start.Name, ", optimised") + ", optimised"
	}
	return TalentBuild{Name: name, Talents: best.points.String()}, rotation, int(runs.Load()), nil
}

type scoredMove struct {
	tree, talent int
	delta        float64
}

// Prices every legal single-point change of one direction, best first. The prices are
// independent sim runs, so they go out together.
func rank(trees []tree, points allocation, measure func(allocation) float64, base float64, adding bool, relevant map[[2]int]bool) []scoredMove {
	moves := []scoredMove{}
	trials := []allocation{}
	for i, tree := range trees {
		for j := range tree.Talents {
			if !relevant[[2]int{i, j}] {
				continue
			}
			trial := points.clone()
			if adding {
				if points[i][j] >= tree.Talents[j].MaxPoints {
					continue
				}
				trial[i][j]++
			} else {
				if points[i][j] == 0 {
					continue
				}
				trial[i][j]--
			}
			if !trial.valid(trees) {
				continue
			}
			moves = append(moves, scoredMove{tree: i, talent: j})
			trials = append(trials, trial)
		}
	}
	dps := parallelMap(len(trials), func(k int) float64 { return measure(trials[k]) })
	for k := range moves {
		moves[k].delta = dps[k] - base
	}
	sort.SliceStable(moves, func(a, b int) bool { return moves[a].delta > moves[b].delta })
	return moves
}

func topN[T any](items []T, n int) []T {
	if len(items) < n {
		return items
	}
	return items[:n]
}

func sum(points []int) int {
	total := 0
	for _, p := range points {
		total += p
	}
	return total
}

// Moves points into or out of each held tree until it holds exactly what the anchor asks,
// then balances the total through the trees nobody is holding.
//
// Blind on purpose - it takes from wherever is legal rather than measuring, because the
// climb that follows is what decides where points belong. This only has to produce a legal
// build of the right shape for it to start from. Trees are independent for legality (rank
// caps, row gates and arrows never cross a tree), so each held tree is fixed on its own.
func reshape(trees []tree, points allocation, shape anchor) (allocation, error) {
	out := points.clone()

	// Adds the first legal point, or removes the deepest legal one, in the trees allowed.
	step := func(inTree func(int) bool, adding bool) bool {
		for i := range trees {
			if !inTree(i) {
				continue
			}
			for k := range trees[i].Talents {
				j := k
				if !adding {
					// Deepest first: a point in the last row is never holding another one up.
					j = len(trees[i].Talents) - 1 - k
				}
				if adding && out[i][j] >= trees[i].Talents[j].MaxPoints || !adding && out[i][j] == 0 {
					continue
				}
				trial := out.clone()
				if adding {
					trial[i][j]++
				} else {
					trial[i][j]--
				}
				if trial.valid(trees) {
					out = trial
					return true
				}
			}
		}
		return false
	}

	for _, h := range shape.holds {
		only := func(i int) bool { return i == h.tree }
		for sum(out[h.tree]) < h.points {
			if !step(only, true) {
				return nil, fmt.Errorf("cannot reach %d points in %s", h.points, trees[h.tree].Name)
			}
		}
		for sum(out[h.tree]) > h.points {
			if !step(only, false) {
				return nil, fmt.Errorf("cannot come down to %d points in %s", h.points, trees[h.tree].Name)
			}
		}
	}

	// The points taken out of the held trees have to land somewhere, and the ones added to
	// them had to come from somewhere. Balanced blindly for the same reason as above.
	free := func(i int) bool { return !shape.holding(i) }
	for out.total() > talentBudget {
		if !step(free, false) {
			return nil, fmt.Errorf("cannot come down to %d points", talentBudget)
		}
	}
	for out.total() < talentBudget {
		if !step(free, true) {
			return nil, fmt.Errorf("cannot reach %d points", talentBudget)
		}
	}

	if !out.valid(trees) || !shape.allows(out) {
		return nil, fmt.Errorf("reshaping produced a build that does not hold")
	}
	return out, nil
}
