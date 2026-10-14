//go:build with_db

package main

// Practice mode: one fight of the sim's engine run live. The page sends the request the sim
// page would run, with the rotation emptied so the player is the rotation; then, as real time
// passes, it asks the engine to catch up to "now" and to use the abilities pressed. Everything
// (rage, cooldowns, the global cooldown, hit and crit rolls, procs) is the engine's.

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/simsignals"
	goproto "google.golang.org/protobuf/proto"
)

func init() {
	liveStartHandler = liveStart
	liveTickHandler = liveTick
	liveSummaryHandler = liveSummary
}

// liveSummary compares the fight just played with the sim's own rotation in the same fight.
func liveSummary(w http.ResponseWriter, r *http.Request) {
	session := liveSessionFor(r)
	if session == nil {
		http.Error(w, "no practice fight", http.StatusConflict)
		return
	}
	session.mu.Lock()
	you := map[string]*actionTotal{}
	collect := func(spells []*core.Spell, pet bool) {
		for _, spell := range spells {
			t := &actionTotal{Pet: pet}
			for _, m := range spell.SpellMetrics {
				if !spell.Flags.Matches(core.SpellFlagPassiveSpell) {
					t.Casts += float64(m.Casts)
				}
				t.Damage += m.TotalDamage
			}
			if t.Casts == 0 && t.Damage == 0 {
				continue
			}
			key := spell.ActionID.String()
			if pet {
				key = "pet:" + key
			}
			if prev := you[key]; prev != nil {
				prev.Casts += t.Casts
				prev.Damage += t.Damage
			} else {
				you[key] = t
			}
		}
	}
	collect(session.character.Spellbook, false)
	for _, pet := range session.character.Pets {
		collect(pet.Spellbook, true)
	}
	elapsed := session.sim.CurrentTime.Seconds()
	if session.ended && session.length > 0 {
		elapsed = float64(session.length)
	}
	session.mu.Unlock()

	// The sim's run started with the fight; it takes a few seconds at most.
	if session.referenceRes == nil {
		select {
		case res := <-session.reference:
			session.referenceRes = res
		case <-time.After(60 * time.Second):
			http.Error(w, "the sim's comparison run is still going", http.StatusServiceUnavailable)
			return
		}
	}
	total := 0.0
	for _, t := range you {
		total += t.Damage
	}
	writeJSON(w, map[string]any{
		"you":       map[string]any{"dps": total / max(elapsed, 1), "duration": elapsed, "actions": you},
		"reference": session.referenceRes,
	})
}

type liveSession struct {
	id          string
	mu          sync.Mutex
	sim         *core.Simulation
	character   *core.Character
	target      *core.Unit
	logs        []string
	spells      []*core.Spell
	ended       bool
	units       []*core.Unit // the player, then its pets
	attacking   bool         // auto attack switched on
	swinging    bool         // and actually swinging (switched on and facing the target)
	facing      bool
	interrupted bool
	length      int    // seconds, 0 = until reset
	health      string // "real", "above" or "below"

	reference    chan *referenceResult
	referenceRes *referenceResult
}

type actionTotal struct {
	Casts  float64 `json:"casts"`
	Damage float64 `json:"damage"`
	Pet    bool    `json:"pet"`
}

type referenceResult struct {
	Dps      float64                 `json:"dps"`
	Duration float64                 `json:"duration"`
	Actions  map[string]*actionTotal `json:"actions"`
	Error    string                  `json:"error,omitempty"`
}

// actionTotals averages an engine result's per-ability casts and damage over its fights,
// keyed like the live session's abilities ("{SpellID: 23881}"); pets' abilities are marked.
func actionTotals(p *proto.UnitMetrics, iterations int) map[string]*actionTotal {
	out := map[string]*actionTotal{}
	add := func(actions []*proto.ActionMetrics, pet bool) {
		for _, a := range actions {
			key := core.ProtoToActionID(a.Id).String()
			if pet {
				key = "pet:" + key
			}
			t := out[key]
			if t == nil {
				t = &actionTotal{Pet: pet}
				out[key] = t
			}
			for _, target := range a.Targets {
				t.Casts += float64(target.Casts) / float64(iterations)
				t.Damage += target.Damage / float64(iterations)
			}
		}
	}
	add(p.Actions, false)
	for _, pet := range p.Pets {
		add(pet.Actions, true)
	}
	return out
}

// setTargetHealth sets when the target is below 20% (and 25, 35, 45, 90%) health. The engine
// walks those phases in order, each lasting the given share of the fight from its end.
func setTargetHealth(e *proto.Encounter, health string) {
	switch health {
	case "below":
		e.ExecuteProportion_90, e.ExecuteProportion_45, e.ExecuteProportion_35, e.ExecuteProportion_25, e.ExecuteProportion_20 = 1, 1, 1, 1, 1
	case "above":
		e.ExecuteProportion_90, e.ExecuteProportion_45, e.ExecuteProportion_35, e.ExecuteProportion_25, e.ExecuteProportion_20 = 0, 0, 0, 0, 0
	default:
		// A real fight: the health falls steadily, so each phase is its share of the fight.
		e.ExecuteProportion_90, e.ExecuteProportion_45, e.ExecuteProportion_35, e.ExecuteProportion_25, e.ExecuteProportion_20 = 0.9, 0.45, 0.35, 0.25, 0.2
	}
}

// Fights by id, so two tabs each keep their own; the oldest go when there are too many.
var (
	liveMu       sync.Mutex
	liveSessions = map[string]*liveSession{}
	liveOrder    []string
)

func liveSessionFor(r *http.Request) *liveSession {
	liveMu.Lock()
	defer liveMu.Unlock()
	return liveSessions[r.URL.Query().Get("id")]
}

const liveFightLength = 60 * time.Minute

func liveStart(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	request := &proto.RaidSimRequest{}
	if err := goproto.Unmarshal(body, request); err != nil {
		http.Error(w, "request: "+err.Error(), http.StatusBadRequest)
		return
	}
	player := request.Raid.Parties[0].Players[0]
	q := r.URL.Query()
	length, _ := strconv.Atoi(q.Get("length")) // seconds; 0 runs until reset
	health := q.Get("health")                  // "real" (Execute range near the end), "above" or "below"
	if length <= 0 {
		length = 0
		if health == "real" {
			health = "above"
		}
	}
	fightLength := liveFightLength
	if length > 0 {
		fightLength = time.Duration(length) * time.Second
	}
	request.Encounter.Duration = fightLength.Seconds()
	request.Encounter.DurationVariation = 0
	setTargetHealth(request.Encounter, health)

	// The sim's own rotation in the same fight, for the comparison at the end; and how often it
	// uses each ability, so the action bar starts with the most used.
	reference := goproto.Clone(request).(*proto.RaidSimRequest)
	if length == 0 {
		reference.Encounter.Duration = 180
	}
	usage := map[string]int32{}
	{
		probe := goproto.Clone(reference).(*proto.RaidSimRequest)
		probe.SimOptions = &proto.SimOptions{Iterations: 3, RandomSeed: 1}
		if result := core.RunRaidSim(probe); result.Error == nil {
			for key, m := range actionTotals(result.RaidMetrics.Parties[0].Players[0], 3) {
				usage[key] = int32(m.Casts * 3)
			}
		}
	}

	// The player is the rotation.
	player.Rotation = &proto.APLRotation{Type: proto.APLRotation_TypeAPL}
	request.SimOptions = &proto.SimOptions{Iterations: 1, RandomSeed: time.Now().UnixNano(), Debug: true}

	session, err := newLiveSession(request)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	session.length = length
	session.health = health
	session.reference = make(chan *referenceResult, 1)
	go func() {
		reference.SimOptions = &proto.SimOptions{Iterations: 1000, RandomSeed: 7}
		result := core.RunRaidSim(reference)
		if result.Error != nil {
			session.reference <- &referenceResult{Error: result.Error.Message}
			return
		}
		p := result.RaidMetrics.Parties[0].Players[0]
		session.reference <- &referenceResult{Dps: p.Dps.Avg, Actions: actionTotals(p, 1000), Duration: reference.Encounter.Duration}
	}()
	session.id = strconv.FormatInt(time.Now().UnixNano(), 36)
	liveMu.Lock()
	liveSessions[session.id] = session
	liveOrder = append(liveOrder, session.id)
	for len(liveOrder) > 4 {
		delete(liveSessions, liveOrder[0])
		liveOrder = liveOrder[1:]
	}
	liveMu.Unlock()

	session.mu.Lock()
	defer session.mu.Unlock()
	abilities := []map[string]any{}
	for _, spell := range session.spells {
		id := spell.ActionID
		abilities = append(abilities, map[string]any{
			"key":      id.String(),
			"spellId":  id.SpellID,
			"itemId":   id.ItemID,
			"tag":      id.Tag,
			"cooldown": spell.CD.Duration.Seconds(),
			"castTime": spell.DefaultCast.CastTime.Seconds(),
			"gcd":      spell.DefaultCast.GCD.Seconds(),
			"mcd":      spell.Flags.Matches(core.SpellFlagMCD),
			"uses":     usage[id.String()],
		})
	}
	slices.SortStableFunc(abilities, func(a, b map[string]any) int { return int(b["uses"].(int32) - a["uses"].(int32)) })
	// Attack (Auto Shot for a hunter's ranged weapon) toggles auto attack.
	attack := map[string]any{"key": "attack", "spellId": 6603, "itemId": 0, "tag": 0, "cooldown": 0, "castTime": 0, "gcd": 0, "mcd": false, "uses": int32(0), "toggle": true}
	if session.character.AutoAttacks.AutoSwingRanged && !session.character.AutoAttacks.AutoSwingMelee {
		attack["spellId"] = 75
	} else if session.character.AutoAttacks.AutoSwingRanged && session.character.AutoAttacks.Ranged() != nil && session.character.Class == proto.Class_ClassHunter {
		attack["spellId"] = 75
	}
	abilities = append([]map[string]any{attack}, abilities...)
	writeJSON(w, map[string]any{"id": session.id, "name": session.character.Label, "abilities": abilities, "state": session.state(), "lines": session.takeLogs()})
}

func newLiveSession(request *proto.RaidSimRequest) (session *liveSession, err error) {
	defer func() {
		if e := recover(); e != nil {
			err = fmt.Errorf("the engine could not start this fight: %v", e)
		}
	}()
	session = &liveSession{}
	sim := core.NewSim(request, simsignals.CreateSignals())
	sim.Log = func(message string, vals ...any) {
		session.logs = append(session.logs, fmt.Sprintf("[%0.2f] "+message, append([]any{sim.CurrentTime.Seconds()}, vals...)...))
	}
	session.sim = sim
	session.character = sim.Raid.Parties[0].Players[0].GetCharacter()
	session.target = session.character.CurrentTarget

	sim.Reset()
	sim.PrePull()
	// Run the pull itself (time 0) so buffs go up, but with auto attack off, as in the game: it
	// starts when the player attacks.
	units := []*core.Unit{&session.character.Unit}
	for _, pet := range session.character.Pets {
		units = append(units, &pet.Unit)
	}
	type swing struct{ melee, ranged bool }
	saved := make([]swing, len(units))
	for i, u := range units {
		saved[i] = swing{u.AutoAttacks.AutoSwingMelee, u.AutoAttacks.AutoSwingRanged}
		u.AutoAttacks.AutoSwingMelee, u.AutoAttacks.AutoSwingRanged = false, false
	}
	session.advance(0)
	for i, u := range units {
		u.AutoAttacks.AutoSwingMelee, u.AutoAttacks.AutoSwingRanged = saved[i].melee, saved[i].ranged
	}
	session.units = units
	session.facing = true

	for _, spell := range session.character.Spellbook {
		if !spell.Flags.Matches(core.SpellFlagAPL) || spell.ActionID.IsEmptyAction() {
			continue
		}
		if spell.ActionID.SpellID == 0 && spell.ActionID.ItemID == 0 {
			continue
		}
		session.spells = append(session.spells, spell)
	}
	slices.SortStableFunc(session.spells, func(a, b *core.Spell) int {
		// Ordinary abilities first, then cooldowns, then items.
		rank := func(s *core.Spell) int {
			switch {
			case s.ActionID.ItemID != 0:
				return 2
			case s.Flags.Matches(core.SpellFlagMCD):
				return 1
			}
			return 0
		}
		return rank(a) - rank(b)
	})
	return session, nil
}

// advance runs the engine up to time t: every swing, tick and proc due by then.
func (s *liveSession) advance(t time.Duration) {
	s.at(t, nil)
}

// at runs the engine up to time t, then does `then` there (inside the engine's event loop).
func (s *liveSession) at(t time.Duration, then func(sim *core.Simulation)) {
	if s.ended {
		return
	}
	if t < s.sim.CurrentTime {
		t = s.sim.CurrentTime
	}
	reached := false
	s.sim.AddPendingAction(&core.PendingAction{
		NextActionAt: t,
		Priority:     core.ActionPriorityLow,
		OnAction: func(sim *core.Simulation) {
			reached = true
			if then != nil {
				then(sim)
			}
		},
	})
	for !reached {
		if s.sim.Step() {
			s.ended = true
			return
		}
	}
}

type tickRequest struct {
	Time   float64 `json:"time"`
	Cast   string  `json:"cast"`
	Attack string  `json:"attack"` // "start", "stop" or "toggle"

	// Where the player is, from the page's movement: yards from the target, whether moving
	// (or in the air), whether behind the target, and whether facing it.
	Distance *float64 `json:"distance"`
	Moving   bool     `json:"moving"`
	Behind   bool     `json:"behind"`
	Facing   *bool    `json:"facing"`
}

// spellRange is the range an ability needs: the engine's own, or melee reach for a melee
// ability that has none.
func spellRange(spell *core.Spell) (float64, float64) {
	if spell.MinRange != 0 || spell.MaxRange != 0 {
		return spell.MinRange, spell.MaxRange
	}
	if spell.ProcMask.Matches(core.ProcMaskMelee) {
		return 0, core.MaxMeleeRange
	}
	return 0, 0
}

// needsFacing: harmful abilities aimed at the target need the target in front, as in the game.
func needsFacing(spell *core.Spell) bool {
	return spell.ProcMask.Matches(core.ProcMaskDirect|core.ProcMaskSpellDamage) || spell.ProcMask.Matches(core.ProcMaskMeleeOrRanged)
}

// move brings the engine to where the page says the player is.
func (s *liveSession) move(sim *core.Simulation, req tickRequest) {
	c := s.character
	if req.Facing != nil {
		s.facing = *req.Facing
	}
	c.PseudoStats.InFrontOfTarget = !req.Behind
	if req.Distance != nil {
		d := max(0, *req.Distance)
		switch {
		case math.Abs(d-c.DistanceFromTarget) > 0.01:
			// The engine moves at its own speed, the same the page uses, so it arrives with it.
			c.MoveTo(d, sim)
		case req.Moving:
			// Moving without changing distance (circling, strafing, jumping): still moving.
			c.MoveDuration(120*time.Millisecond, sim)
		}
	}
	// Moving breaks a cast that cannot be cast on the move, as in the game.
	if req.Moving {
		if c.Hardcast.Expires > sim.CurrentTime && !c.Hardcast.CanMove {
			c.CancelHardcast(sim)
			s.interrupted = true
		}
		if c.IsChanneling() && c.ChanneledDot.Spell.Flags&core.SpellFlagCanCastWhileMoving == 0 {
			c.ChanneledDot.Deactivate(sim)
			s.interrupted = true
		}
	}
	// Auto attack only swings at a target in front; it picks up again when facing it.
	swinging := s.attacking && s.facing
	if swinging != s.swinging {
		s.swinging = swinging
		if swinging {
			c.AutoAttacks.EnableAutoSwing(sim)
		} else {
			c.AutoAttacks.CancelAutoSwing(sim)
		}
	}
}

// setAttacking turns auto attack (and the pets' attacks) on or off.
func (s *liveSession) setAttacking(sim *core.Simulation, on bool) {
	if on == s.attacking {
		return
	}
	s.attacking = on
	for i, u := range s.units {
		switch {
		case i == 0:
			// The player swings only at a target in front (see move); stopping is the player's alone.
			s.swinging = on && s.facing
			if s.swinging {
				u.AutoAttacks.EnableAutoSwing(sim)
			} else {
				u.AutoAttacks.CancelAutoSwing(sim)
			}
		case on:
			// Pets join in when the player attacks and keep fighting, as they do in the game.
			u.AutoAttacks.EnableAutoSwing(sim)
		}
	}
}

func liveTick(w http.ResponseWriter, r *http.Request) {
	session := liveSessionFor(r)
	if session == nil {
		http.Error(w, "this practice fight is over: start a new one", http.StatusConflict)
		return
	}
	var req tickRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	session.mu.Lock()
	defer session.mu.Unlock()
	result := map[string]any{}
	func() {
		defer func() {
			if e := recover(); e != nil {
				result["error"] = fmt.Sprint(e)
				session.ended = true
			}
		}()
		t := core.DurationFromSeconds(req.Time)
		session.at(t, func(sim *core.Simulation) { session.move(sim, req) })
		if session.interrupted {
			session.interrupted = false
			result["interrupted"] = true
		}
		if req.Attack != "" {
			session.at(t, func(sim *core.Simulation) {
				session.setAttacking(sim, req.Attack == "start" || (req.Attack == "toggle" && !session.attacking))
			})
		}
		if req.Cast != "" {
			spell := session.spellByKey(req.Cast)
			if spell == nil {
				result["refused"] = "unknown ability"
			} else {
				session.at(t, func(sim *core.Simulation) {
					c := session.character
					minR, maxR := spellRange(spell)
					switch {
					case needsFacing(spell) && !session.facing:
						result["refused"] = "you are facing the wrong way!"
						return
					case (maxR > 0 && c.DistanceFromTarget > maxR) || (minR > 0 && c.DistanceFromTarget < minR):
						result["refused"] = "out of range"
						return
					case c.Moving && spell.DefaultCast.CastTime > 0 && spell.Flags&core.SpellFlagCanCastWhileMoving == 0:
						result["refused"] = "can't do that while moving"
						return
					}
					if !spell.CanCast(sim, session.target) && !spell.CanCastOrQueue(sim, session.target) {
						result["refused"] = session.whyNot(spell)
						return
					}
					// A melee or ranged ability starts auto attack, as in the game.
					if spell.ProcMask.Matches(core.ProcMaskMeleeOrRanged) {
						session.setAttacking(sim, true)
					}
					spell.CastOrQueue(sim, session.target)
				})
			}
		}
		session.advance(t)
	}()
	result["state"] = session.state()
	result["lines"] = session.takeLogs()
	writeJSON(w, result)
}

func (s *liveSession) spellByKey(key string) *core.Spell {
	for _, spell := range s.spells {
		if spell.ActionID.String() == key {
			return spell
		}
	}
	return nil
}

func (s *liveSession) whyNot(spell *core.Spell) string {
	sim := s.sim
	switch {
	case s.character.Hardcast.Expires > sim.CurrentTime:
		return "another action is in progress"
	case !spell.IsReady(sim):
		return "not ready yet"
	case spell.DefaultCast.GCD > 0 && !s.character.GCD.IsReady(sim):
		return "global cooldown"
	}
	if spell.Cost != nil && !spell.Cost.MeetsRequirement(sim, spell) {
		switch {
		case s.character.HasRageBar():
			return "not enough rage"
		case s.character.HasEnergyBar():
			return "not enough energy"
		case s.character.HasManaBar():
			return "not enough mana"
		}
		return "not enough resources"
	}
	return "can't use that now"
}

func (s *liveSession) takeLogs() []string {
	lines := s.logs
	if lines == nil {
		lines = []string{}
	}
	s.logs = nil
	return lines
}

func (s *liveSession) state() map[string]any {
	sim := s.sim
	c := s.character
	now := sim.CurrentTime
	resources := map[string]any{}
	if c.HasRageBar() {
		resources["rage"] = []float64{c.CurrentRage(), c.MaximumRage()}
	}
	if c.HasEnergyBar() {
		resources["energy"] = []float64{c.CurrentEnergy(), c.MaximumEnergy()}
	}
	if c.HasManaBar() {
		resources["mana"] = []float64{c.CurrentMana(), c.MaxMana()}
	}
	resources["health"] = []float64{c.CurrentHealth(), c.MaxHealth()}

	spells := map[string]any{}
	for _, spell := range s.spells {
		ready := spell.ReadyAt()
		minR, maxR := spellRange(spell)
		spells[spell.ActionID.String()] = map[string]any{
			"readyIn":    max(0, (ready - now).Seconds()),
			"cooldown":   spell.CD.Duration.Seconds(),
			"usable":     spell.CanCast(sim, s.target) && (!needsFacing(spell) || s.facing),
			"outOfRange": (maxR > 0 && c.DistanceFromTarget > maxR) || (minR > 0 && c.DistanceFromTarget < minR),
		}
	}

	auraList := func(unit *core.Unit) []map[string]any {
		out := []map[string]any{}
		for _, aura := range unit.GetAuras() {
			if !aura.IsActive() || aura.ActionID.IsEmptyAction() {
				continue
			}
			permanent := aura.Duration == core.NeverExpires || aura.Duration <= 0
			entry := map[string]any{
				"key":       aura.ActionID.String(),
				"label":     aura.Label,
				"stacks":    aura.GetStacks(),
				"permanent": permanent,
			}
			if !permanent {
				entry["remaining"] = aura.RemainingDuration(sim).Seconds()
				entry["duration"] = aura.Duration.Seconds()
			}
			out = append(out, entry)
		}
		return out
	}
	auras := auraList(&c.Unit)

	// Swing timers: when each weapon swings next, and its swing time.
	aa := &c.AutoAttacks
	swing := map[string]any{}
	if s.swinging && aa.AutoSwingMelee && aa.MH() != nil {
		swing["mh"] = []float64{max(0, (aa.MainhandSwingAt() - now).Seconds()), aa.MainhandSwingSpeed().Seconds()}
		if aa.IsDualWielding {
			swing["oh"] = []float64{max(0, (aa.OffhandSwingAt() - now).Seconds()), aa.OffhandSwingSpeed().Seconds()}
		}
	}
	if s.swinging && aa.AutoSwingRanged && aa.Ranged() != nil {
		swing["ranged"] = []float64{max(0, (aa.NextRangedAttackAt() - now).Seconds()), aa.RangedSwingSpeed().Seconds()}
	}
	if c.HasEnergyBar() {
		resources["combo"] = []float64{float64(c.ComboPoints()), 5}
	}

	// The target: its debuffs, and its health as the fight's progress shows it.
	healthPct := 100.0
	switch {
	case s.health == "below":
		healthPct = 19
	case s.health == "real" && s.length > 0:
		healthPct = max(0, 100*(1-now.Seconds()/float64(s.length)))
	}

	state := map[string]any{
		"time":      now.Seconds(),
		"resources": resources,
		"spells":    spells,
		"auras":     auras,
		"swing":     swing,
		"target":    map[string]any{"auras": auraList(s.target), "health": healthPct},
		"length":    s.length,
		"gcdIn":     max(0, (c.GCD.ReadyAt() - now).Seconds()),
		"ended":     s.ended,
		"execute":   sim.IsExecutePhase20(),
		"attacking": s.attacking,
		"distance":  c.DistanceFromTarget,
		"moving":    c.Moving,
		"moveSpeed": c.GetMovementSpeed(),
	}
	if c.Hardcast.Expires > now && c.Hardcast.Spell != nil {
		state["casting"] = map[string]any{"key": c.Hardcast.Spell.ActionID.String(), "endsIn": (c.Hardcast.Expires - now).Seconds(), "castTime": c.Hardcast.Spell.DefaultCast.CastTime.Seconds()}
	}
	return state
}
