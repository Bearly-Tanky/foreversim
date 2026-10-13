package arenalib

// Visiting every build worth visiting, rather than climbing from one and hoping.
//
// The count that made this possible: only 15 to 28 talents per spec can move the number at
// all. The rest are defensives, PvP talents and ones the sim does not implement, and points
// in them are interchangeable filler - every legal way of dumping them produces the same
// damage, so they are not choices and do not multiply anything. Restrict further to builds
// that max a talent or leave it alone, which is the shape optimal builds take, and a mage
// goes from 1,261,940,421 candidates to 130,983.
//
// Enumerating those is free - it is arithmetic, not simulation. Simulating them is not, so
// the enumeration is scored first by adding up what each talent was worth on its own. That
// estimate is wrong in detail, because talents interact, and it is very good at telling the
// hopeless 99% from the plausible 1%. Only the plausible ones are simulated, cheaply, and
// only the survivors of that are simulated properly.
//
// What this does and does not claim, exactly: every legal all-or-nothing build over the
// talents that matter is *considered*. The ones the additive estimate ranks highly are
// *simulated*. A build the estimate badly underrates could be missed - which is why the
// climb still runs afterwards from whatever this found, and why the page says searched
// rather than proven.

import (
	"sort"
)

// Screening resolution. Low enough that a hundred thousand of them is minutes rather than
// days, and with every run sharing a seed it is still comparing like with like. Nothing is
// published at this resolution - survivors are re-run properly.
const screenIterations = int32(200)

// How many of the enumeration to simulate at screening quality, and how many of those to
// re-run at search quality. Both wide enough that the additive estimate has to be wrong by
// a long way to lose the winner, and small enough to finish.
const (
	screenTop = 2000
	refineTop = 40
)

// Above this, the enumeration is not held in memory at all - candidates stream through a
// running top-N instead. Below it the whole thing is kept, which makes the small specs
// genuinely exhaustive rather than merely thorough.
const streamAbove = 50000

type scored struct {
	points allocation
	score  float64
}

// Every legal all-or-nothing assignment over the talents that matter, completed with filler.
//
// Depth first over the relevant talents, pruning the moment the points spent exceed what a
// character has. The completion is what makes a candidate a build: prerequisites maxed,
// row gates fed, and the remainder placed anywhere legal - anywhere, because by construction
// none of it changes the damage.
func enumerate(trees []tree, relevant map[[2]int]bool, value map[[2]int]float64, visit func(scored)) {
	type slot struct {
		tree, talent, max int
		worth             float64
	}
	slots := []slot{}
	for i, tree := range trees {
		for j, t := range tree.Talents {
			if relevant[[2]int{i, j}] {
				slots = append(slots, slot{i, j, t.MaxPoints, value[[2]int{i, j}]})
			}
		}
	}
	// Most valuable first, so the best candidates turn up early and a streaming top-N settles
	// on a good cut quickly.
	sort.Slice(slots, func(a, b int) bool { return slots[a].worth > slots[b].worth })

	points := make(allocation, len(trees))
	for i := range trees {
		points[i] = make([]int, len(trees[i].Talents))
	}

	var walk func(at int, spent int, score float64)
	walk = func(at int, spent int, score float64) {
		if at == len(slots) {
			// Handed over unfinished and unowned. Turning an assignment into a legal build
			// costs about a third of a millisecond, which is nothing for one candidate and
			// fifteen hours for a hundred and eighty million of them - so it happens after
			// the scoring has thrown almost all of them away, not before.
			visit(scored{points: points, score: score})
			return
		}

		s := slots[at]
		// Untouched.
		walk(at+1, spent, score)
		// Maxed, if there is room for it.
		if spent+s.max <= talentBudget {
			points[s.tree][s.talent] = s.max
			walk(at+1, spent+s.max, score+s.worth)
			points[s.tree][s.talent] = 0
		}
	}
	walk(0, 0, 0)
}

// Turns an assignment over the talents that matter into a build a character could spend.
//
// Prerequisites first, because a talent with an unfed arrow is not merely unfinished, it is
// illegal, and no amount of filler elsewhere fixes it. Then the row gates and the remainder.
// Filler goes wherever it is legal and never where it would change the damage, which is the
// whole reason it can be placed blindly.
func complete(trees []tree, points allocation) (allocation, bool) {
	out := points.clone()

	// Arrows can chain, so this repeats until nothing more needs feeding.
	for changed := true; changed; {
		changed = false
		for i, tree := range trees {
			byLocation := map[[2]int]int{}
			for j, t := range tree.Talents {
				byLocation[[2]int{t.Location.RowIdx, t.Location.ColIdx}] = j
			}
			for j, t := range tree.Talents {
				if out[i][j] == 0 || t.PrereqLocation == nil {
					continue
				}
				prereq, ok := byLocation[[2]int{t.PrereqLocation.RowIdx, t.PrereqLocation.ColIdx}]
				if !ok {
					return nil, false
				}
				if out[i][prereq] < tree.Talents[prereq].MaxPoints {
					out[i][prereq] = tree.Talents[prereq].MaxPoints
					changed = true
				}
			}
		}
		if out.total() > talentBudget {
			return nil, false
		}
	}

	// Row gates: a tree holding points in row N needs 5N points above them. Filler is added
	// into the shallowest rows of that same tree, which is where it can do the most good for
	// the least of it.
	for i, tree := range trees {
		for guard := 0; guard < talentBudget; guard++ {
			need := 0
			for j, t := range tree.Talents {
				if out[i][j] == 0 {
					continue
				}
				above := 0
				for k, other := range tree.Talents {
					if other.Location.RowIdx < t.Location.RowIdx {
						above += out[i][k]
					}
				}
				if short := 5*t.Location.RowIdx - above; short > need {
					need = short
				}
			}
			if need == 0 {
				break
			}
			// Shallowest first: a point in row 0 feeds every gate below it, a point in row 3
			// feeds none of them and needs feeding itself.
			placed := false
			for j, t := range tree.Talents {
				if out[i][j] >= t.MaxPoints || t.Location.RowIdx > 0 && !reachable(tree, out[i], t) {
					continue
				}
				trial := out.clone()
				trial[i][j]++
				if trial.total() <= talentBudget {
					out, placed = trial, true
					break
				}
			}
			if !placed {
				return nil, false
			}
		}
	}

	if out.total() > talentBudget {
		return nil, false
	}
	// Whatever is left goes anywhere legal. A build that cannot spend its points is not a
	// build anyone could play, so it is dropped rather than published short.
	for out.total() < talentBudget {
		placed := false
		for i, tree := range trees {
			for j, t := range tree.Talents {
				if out[i][j] >= t.MaxPoints {
					continue
				}
				trial := out.clone()
				trial[i][j]++
				if trial.valid(trees) {
					out, placed = trial, true
					break
				}
			}
			if placed {
				break
			}
		}
		if !placed {
			return nil, false
		}
	}

	if !out.valid(trees) {
		return nil, false
	}
	return out, true
}

// Whether this tree already holds enough points above a talent to put one in it.
func reachable(tree tree, points []int, t talent) bool {
	above := 0
	for k, other := range tree.Talents {
		if other.Location.RowIdx < t.Location.RowIdx {
			above += points[k]
		}
	}
	return above >= 5*t.Location.RowIdx
}

// Keeps the best n by score without holding the rest.
//
// Copies only when a candidate beats the worst it is holding, because the caller hands over
// a buffer it is still walking with. That check is also what makes a hundred million
// candidates affordable: almost none of them are ever copied.
type bestOf struct {
	n     int
	cut   float64
	full  bool
	items []scored
}

func (t *bestOf) add(item scored) {
	if t.full && item.score <= t.cut {
		return
	}
	t.items = append(t.items, scored{points: item.points.clone(), score: item.score})
	if len(t.items) > t.n*2 {
		t.trim()
	}
}

func (t *bestOf) trim() {
	sort.Slice(t.items, func(a, b int) bool { return t.items[a].score > t.items[b].score })
	if len(t.items) > t.n {
		t.items = t.items[:t.n]
		t.cut, t.full = t.items[t.n-1].score, true
	}
}

func (t *bestOf) best() []scored {
	t.trim()
	return t.items
}

// Runs the enumeration and returns the best build it can find, plus how many candidates it
// considered and how many it simulated - because those two numbers are the whole claim.
//
// Three resolutions, narrowing. Everything legal is enumerated and scored for nothing.
// The best few thousand by that score are simulated at survey quality. The best few of those
// are re-run at search quality, which is where the ordering is actually decided.
func exhaustive(
	trees []tree,
	relevant map[[2]int]bool,
	value map[[2]int]float64,
	measure func(allocation, int32) float64,
) (allocation, int, int) {
	keep := &bestOf{n: screenTop}
	considered := 0
	enumerate(trees, relevant, value, func(candidate scored) {
		considered++
		// Screened before it can take a place in the top N, not after. The additive score
		// ranks highest exactly the builds that put every point into deep, valuable talents
		// and leave none for the row gates under them - so on the seven biggest trees all
		// 2,000 places went to builds complete() then threw out, and nothing was simulated.
		if minimumSpend(trees, candidate.points) > talentBudget {
			return
		}
		keep.add(candidate)
	})
	if considered == 0 {
		return nil, 0, 0
	}

	// Completing and de-duplicating is arithmetic, so it happens up front and on one thread.
	// What is left is a list of independent sim runs, which is the only expensive part.
	seen := map[string]bool{}
	candidates := []allocation{}
	for _, candidate := range keep.best() {
		built, ok := complete(trees, candidate.points)
		if !ok {
			continue
		}
		key := built.String()
		// Duplicates are ordinary: two assignments can complete to the same build once the
		// filler is placed, and simulating one of them twice buys nothing.
		if seen[key] {
			continue
		}
		seen[key] = true
		candidates = append(candidates, built)
	}
	simulated := len(candidates)
	if simulated == 0 {
		return nil, considered, 0
	}

	scores := parallelMap(len(candidates), func(i int) float64 {
		return measure(candidates[i], screenIterations)
	})
	screened := make([]scored, len(candidates))
	for i := range candidates {
		screened[i] = scored{points: candidates[i], score: scores[i]}
	}

	sort.Slice(screened, func(a, b int) bool { return screened[a].score > screened[b].score })
	if len(screened) > refineTop {
		screened = screened[:refineTop]
	}
	simulated += len(screened)
	refined := parallelMap(len(screened), func(i int) float64 {
		return measure(screened[i].points, searchIterations)
	})
	for i := range screened {
		screened[i].score = refined[i]
	}
	sort.Slice(screened, func(a, b int) bool { return screened[a].score > screened[b].score })

	return screened[0].points, considered, simulated
}

// The fewest points any legal build containing this assignment could spend: what is chosen,
// plus the row gates beneath the deepest choice in each tree, plus any prerequisite that was
// not chosen. A lower bound, never an estimate - it only rules out what complete() would
// certainly reject, so it cannot lose a build that could have been played.
//
// Cheap on purpose. It runs once per candidate, which is forty-seven million times for a
// warlock, where complete() is a third of a millisecond each and would be four hours.
func minimumSpend(trees []tree, points allocation) int {
	total := 0
	for i, tree := range trees {
		byLocation := map[[2]int]int{}
		for j, t := range tree.Talents {
			byLocation[[2]int{t.Location.RowIdx, t.Location.ColIdx}] = j
		}
		spend := make([]int, len(tree.Talents))
		copy(spend, points[i])
		for j, t := range tree.Talents {
			if points[i][j] == 0 || t.PrereqLocation == nil {
				continue
			}
			if prereq, ok := byLocation[[2]int{t.PrereqLocation.RowIdx, t.PrereqLocation.ColIdx}]; ok && spend[prereq] < tree.Talents[prereq].MaxPoints {
				spend[prereq] = tree.Talents[prereq].MaxPoints
			}
		}

		// A point in row N needs 5N points in the rows above it. Whatever is chosen at or
		// below the deepest row cannot help pay for that row, so it is added on top.
		inTree, need := 0, 0
		for j, t := range tree.Talents {
			inTree += spend[j]
			if spend[j] == 0 {
				continue
			}
			atOrBelow := 0
			for k, other := range tree.Talents {
				if other.Location.RowIdx >= t.Location.RowIdx {
					atOrBelow += spend[k]
				}
			}
			if gate := 5*t.Location.RowIdx + atOrBelow; gate > need {
				need = gate
			}
		}
		total += max(inTree, need)
	}
	return total
}
