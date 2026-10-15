package main

// Combat logs: the game writes WoWCombatLog*.txt into the game folder's Logs/ when /combatlog is
// on. This reads one into fights (boss encounters, and other stretches of combat such as a
// training dummy), the players in each, and one player's fight as events the 3D replay plays.
//
// Line layout: "<date> <time>  EVENT,<source and target (8 fields)>,<spell (3)>,[advanced unit
// info],<suffix>". The header line (COMBAT_LOG_VERSION) says which layout: from version 20 the
// advanced info has an absorb field and damage has a base amount and an off-hand flag.

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

type logFight struct {
	ID       int          `json:"id"`
	Kind     string       `json:"kind"` // "encounter" or "combat"
	Name     string       `json:"name"`
	Success  *bool        `json:"success,omitempty"`
	Start    float64      `json:"start"` // seconds into the log's first day
	End      float64      `json:"end"`
	Clock    string       `json:"clock"` // when it began, hh:mm
	Duration float64      `json:"duration"`
	Players  []*logPlayer `json:"players"`

	byGUID map[string]*logPlayer
}

type logPlayer struct {
	GUID   string  `json:"guid"`
	Name   string  `json:"name"`
	Damage float64 `json:"damage"`
	DPS    float64 `json:"dps"`
}

// logEvent is one thing a player did or had happen, in the shape the replay plays.
type logEvent struct {
	T        float64 `json:"t"`
	Type     string  `json:"type"` // damage, cast, auraOn, auraOff, resource, death
	SpellID  int     `json:"spellId,omitempty"`
	Other    int     `json:"otherId,omitempty"` // 3 melee swing, 4 ranged auto
	Tag      int     `json:"tag,omitempty"`     // 1 main hand, 2 off hand
	Name     string  `json:"name,omitempty"`
	Outcome  string  `json:"outcome,omitempty"`
	Amount   float64 `json:"amount,omitempty"`
	Tick     bool    `json:"tick,omitempty"`
	Pet      bool    `json:"pet,omitempty"`
	School   int     `json:"school,omitempty"`
	CastTime float64 `json:"castTime,omitempty"`
	Kind     string  `json:"kind,omitempty"` // resource: rage, energy, mana, focus
	Value    float64 `json:"value,omitempty"`
	Max      float64 `json:"max,omitempty"`
	Target   string  `json:"target,omitempty"`
}

type logLine struct {
	t      float64
	event  string
	fields []string
}

type logReader struct {
	version  int
	advanced bool
	day0     time.Time
}

// splitFields splits on commas outside quotes and outside (…) and […].
func splitFields(s string) []string {
	var out []string
	depth, quoted, start := 0, false, 0
	for i := 0; i < len(s); i++ {
		switch c := s[i]; {
		case c == '"':
			quoted = !quoted
		case quoted:
		case c == '(' || c == '[':
			depth++
		case c == ')' || c == ']':
			depth--
		case c == ',' && depth == 0:
			out = append(out, unquote(s[start:i]))
			start = i + 1
		}
	}
	return append(out, unquote(s[start:]))
}

func unquote(s string) string {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}

// parseLine reads "10/14/2026 20:15:32.1234-4  EVENT,..." (the year and the time zone are
// optional) into seconds since the log's first day.
func (r *logReader) parseLine(line string) (logLine, bool) {
	sep := strings.Index(line, "  ")
	if sep < 0 {
		return logLine{}, false
	}
	stamp, rest := line[:sep], line[sep+2:]
	datePart, clockPart, ok := strings.Cut(stamp, " ")
	if !ok {
		return logLine{}, false
	}
	if i := strings.IndexAny(clockPart, "+-"); i > 0 {
		clockPart = clockPart[:i]
	}
	md := strings.Split(datePart, "/")
	hms := strings.Split(clockPart, ":")
	if len(md) < 2 || len(hms) != 3 {
		return logLine{}, false
	}
	month, _ := strconv.Atoi(md[0])
	day, _ := strconv.Atoi(md[1])
	year := time.Now().Year()
	if len(md) == 3 {
		year, _ = strconv.Atoi(md[2])
	}
	h, _ := strconv.Atoi(hms[0])
	m, _ := strconv.Atoi(hms[1])
	sec, _ := strconv.ParseFloat(hms[2], 64)
	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if r.day0.IsZero() {
		r.day0 = date
	}
	t := date.Sub(r.day0).Seconds() + float64(h*3600+m*60) + sec
	fields := splitFields(rest)
	return logLine{t: t, event: fields[0], fields: fields[1:]}, true
}

func (r *logReader) header(l logLine) {
	for i := 0; i+1 < len(l.fields); i += 2 {
		switch l.fields[i] {
		case "COMBAT_LOG_VERSION":
			r.version, _ = strconv.Atoi(l.fields[i+1])
		case "ADVANCED_LOG_ENABLED":
			r.advanced = l.fields[i+1] == "1"
		}
	}
	// The event's own first value is the version.
	if l.event == "COMBAT_LOG_VERSION" && len(l.fields) > 0 {
		r.version, _ = strconv.Atoi(l.fields[0])
		for i := 1; i+1 < len(l.fields); i += 2 {
			if l.fields[i] == "ADVANCED_LOG_ENABLED" {
				r.advanced = l.fields[i+1] == "1"
			}
		}
	}
}

func (r *logReader) modern() bool { return r.version >= 20 }

// advancedLen is how many advanced unit-info fields follow the spell (or the base fields).
func (r *logReader) advancedLen() int {
	if !r.advanced {
		return 0
	}
	if r.modern() {
		return 17
	}
	return 16
}

func num(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func hexInt(s string) int {
	v, _ := strconv.ParseInt(strings.TrimPrefix(s, "0x"), 16, 64)
	return int(v)
}

func isPlayer(guid string) bool { return strings.HasPrefix(guid, "Player-") }

// prefixLen: the spell fields after the 8 source/target fields.
func prefixLen(event string) int {
	if strings.HasPrefix(event, "SWING_") {
		return 0
	}
	if strings.HasPrefix(event, "SPELL_") || strings.HasPrefix(event, "RANGE_") {
		return 3
	}
	return -1
}

// damage reads a *_DAMAGE suffix from the end of the line: amount, [base amount], overkill,
// school, resisted, blocked, absorbed, critical, glancing, crushing, [off hand], [damage type].
type damageInfo struct {
	amount            float64
	school            int
	crit, glance, off bool
	blocked           bool
}

func (r *logReader) damage(fields []string) (damageInfo, bool) {
	f := fields
	if n := len(f); n > 0 && (f[n-1] == "ST" || f[n-1] == "AOE") {
		f = f[:n-1]
	}
	var d damageInfo
	if r.modern() {
		if len(f) < 11 {
			return d, false
		}
		f, d.off = f[:len(f)-1], f[len(f)-1] == "1"
	}
	n := len(f)
	if n < 9 {
		return d, false
	}
	d.crit = f[n-3] == "1"
	d.glance = f[n-2] == "1"
	d.blocked = num(f[n-5]) > 0
	d.school = hexInt(f[n-7])
	amountAt := n - 9
	if r.modern() {
		amountAt = n - 10
	}
	if amountAt < 0 {
		return d, false
	}
	d.amount = num(f[amountAt])
	return d, true
}

// readLog reads a whole log file.
func readLog(path string) (*logReader, []logLine, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()
	return readLogFrom(file)
}

func readLogFrom(src io.Reader) (*logReader, []logLine, error) {
	r := &logReader{version: 20, advanced: true}
	sc := bufio.NewScanner(src)
	sc.Buffer(make([]byte, 1<<20), 8<<20)
	var lines []logLine
	sawHeader := false
	for sc.Scan() {
		l, ok := r.parseLine(sc.Text())
		if !ok {
			continue
		}
		if l.event == "COMBAT_LOG_VERSION" {
			r.header(l)
			sawHeader = true
			continue
		}
		lines = append(lines, l)
	}
	if !sawHeader {
		r.guessLayout(lines)
	}
	return r, lines, sc.Err()
}

// guessLayout: without a header, a damage line ending in a damage type ("ST") is the modern layout.
func (r *logReader) guessLayout(lines []logLine) {
	for _, l := range lines {
		if strings.HasSuffix(l.event, "_DAMAGE") {
			last := l.fields[len(l.fields)-1]
			if last == "ST" || last == "AOE" {
				r.version = 22
			} else {
				r.version = 9
			}
			return
		}
	}
}

// fights splits the log into boss encounters and, outside them, stretches of player combat with
// no gap longer than 15 seconds.
func (r *logReader) fights(lines []logLine) []*logFight {
	var fights []*logFight
	var current *logFight
	var combat *logFight
	lastHit := -1e9
	closeCombat := func() {
		if combat != nil && combat.End-combat.Start >= 5 {
			fights = append(fights, combat)
		}
		combat = nil
	}
	targets := map[*logFight]map[string]float64{}
	for _, l := range lines {
		switch l.event {
		case "ENCOUNTER_START":
			closeCombat()
			name := ""
			if len(l.fields) > 1 {
				name = l.fields[1]
			}
			current = &logFight{Kind: "encounter", Name: name, Start: l.t, End: l.t, byGUID: map[string]*logPlayer{}}
			continue
		case "ENCOUNTER_END":
			if current != nil {
				current.End = l.t
				if len(l.fields) > 4 {
					ok := l.fields[4] == "1"
					current.Success = &ok
				}
				fights = append(fights, current)
				current = nil
			}
			continue
		}
		if !strings.HasSuffix(l.event, "_DAMAGE") || strings.HasSuffix(l.event, "_LANDED") || len(l.fields) < 8 || !isPlayer(l.fields[0]) {
			continue
		}
		fight := current
		if fight == nil {
			if combat == nil || l.t-lastHit > 15 {
				closeCombat()
				combat = &logFight{Kind: "combat", Start: l.t, End: l.t, byGUID: map[string]*logPlayer{}}
			}
			fight = combat
			lastHit = l.t
			fight.End = l.t
		}
		d, ok := r.damage(l.fields)
		if !ok {
			continue
		}
		p := fight.byGUID[l.fields[0]]
		if p == nil {
			p = &logPlayer{GUID: l.fields[0], Name: l.fields[1]}
			fight.byGUID[l.fields[0]] = p
		}
		p.Damage += d.amount
		if targets[fight] == nil {
			targets[fight] = map[string]float64{}
		}
		targets[fight][l.fields[5]] += d.amount
	}
	closeCombat()
	if current != nil {
		fights = append(fights, current)
	}
	for i, f := range fights {
		f.ID = i
		f.Duration = f.End - f.Start
		if f.Name == "" {
			best := 0.0
			for name, dmg := range targets[f] {
				if dmg > best {
					f.Name, best = name, dmg
				}
			}
		}
		for _, p := range f.byGUID {
			p.DPS = p.Damage / max(f.Duration, 1)
			f.Players = append(f.Players, p)
		}
		sort.Slice(f.Players, func(a, b int) bool { return f.Players[a].Damage > f.Players[b].Damage })
		secs := int(f.Start) % 86400
		f.Clock = fmt.Sprintf("%02d:%02d", secs/3600, secs/60%60)
	}
	return fights
}

var powerKind = map[string]string{"0": "mana", "1": "rage", "2": "focus", "3": "energy"}

// playerEvents is one player's fight: their hits (and their pets'), casts, buffs and resources,
// timed from the fight's start.
func (r *logReader) playerEvents(lines []logLine, fight *logFight, guid string) []logEvent {
	var out []logEvent
	pets := map[string]bool{}
	casting := map[int]float64{}
	lastPower := ""
	adv := r.advancedLen()
	for _, l := range lines {
		if l.t < fight.Start-30 || l.t > fight.End+1 || len(l.fields) < 8 {
			continue
		}
		t := l.t - fight.Start
		src, dst := l.fields[0], l.fields[4]
		if l.event == "SPELL_SUMMON" && src == guid {
			pets[dst] = true
		}
		pl := prefixLen(l.event)
		if pl < 0 {
			if l.event == "UNIT_DIED" && dst == guid && t >= 0 {
				out = append(out, logEvent{T: t, Type: "death"})
			}
			continue
		}
		// Advanced info: who it describes, its owner, and its power.
		base := 8 + pl
		if adv > 0 && len(l.fields) > base+adv {
			info, owner := l.fields[base], l.fields[base+1]
			if owner == guid && info != guid {
				pets[info] = true
			}
			if info == guid {
				at := base + 7
				if r.modern() {
					at = base + 8
				}
				kind := powerKind[strings.Split(l.fields[at], "|")[0]]
				if kind != "" && t >= 0 {
					cur, mx := num(strings.Split(l.fields[at+1], "|")[0]), num(strings.Split(l.fields[at+2], "|")[0])
					if kind == "rage" && mx >= 1000 {
						cur, mx = cur/10, mx/10
					}
					key := fmt.Sprintf("%s %.0f %.0f", kind, cur, mx)
					if key != lastPower {
						lastPower = key
						out = append(out, logEvent{T: t, Type: "resource", Kind: kind, Value: cur, Max: mx})
					}
				}
			}
		}
		mine := src == guid
		pet := pets[src]
		spellID, spellName, school := 0, "", 0
		if pl == 3 {
			spellID, _ = strconv.Atoi(l.fields[8])
			spellName = l.fields[9]
			school = hexInt(l.fields[10])
		}
		suffix := l.fields[base:]
		if adv > 0 && len(suffix) > adv && (strings.HasSuffix(l.event, "_DAMAGE") || l.event == "SPELL_CAST_SUCCESS") {
			suffix = suffix[adv:]
		}

		switch {
		case (mine || pet) && strings.HasSuffix(l.event, "_DAMAGE") && !strings.HasSuffix(l.event, "_LANDED"):
			if t < 0 {
				continue
			}
			d, ok := r.damage(l.fields)
			if !ok {
				continue
			}
			ev := logEvent{T: t, Type: "damage", SpellID: spellID, Name: spellName, Amount: d.amount, School: school, Pet: pet, Target: l.fields[5], Tick: strings.Contains(l.event, "PERIODIC")}
			if pl == 0 {
				ev.Other, ev.Tag, ev.School = 3, 1, 1
				if d.off {
					ev.Tag = 2
				}
			} else if strings.HasPrefix(l.event, "RANGE_") && spellID == 75 {
				ev.Other, ev.SpellID = 4, 0
			}
			switch {
			case d.crit:
				ev.Outcome = "Crit"
			case d.glance:
				ev.Outcome = "Glance"
			case d.blocked:
				ev.Outcome = "Block"
			default:
				ev.Outcome = "Hit"
			}
			out = append(out, ev)
		case (mine || pet) && strings.HasSuffix(l.event, "_MISSED"):
			if t < 0 || len(suffix) == 0 {
				continue
			}
			miss := strings.Title(strings.ToLower(suffix[0]))
			ev := logEvent{T: t, Type: "damage", SpellID: spellID, Name: spellName, Outcome: miss, School: school, Pet: pet, Target: l.fields[5]}
			if pl == 0 {
				ev.Other, ev.Tag = 3, 1
				if len(suffix) > 1 && suffix[1] == "1" {
					ev.Tag = 2
				}
			} else if strings.HasPrefix(l.event, "RANGE_") && spellID == 75 {
				ev.Other, ev.SpellID = 4, 0
			}
			out = append(out, ev)
		case mine && l.event == "SPELL_CAST_START":
			casting[spellID] = t
		case mine && l.event == "SPELL_CAST_FAILED":
			delete(casting, spellID)
		case mine && l.event == "SPELL_CAST_SUCCESS":
			if t < 0 {
				continue
			}
			ev := logEvent{T: t, Type: "cast", SpellID: spellID, Name: spellName, School: school}
			if start, ok := casting[spellID]; ok && t-start < 12 {
				ev.T, ev.CastTime = start, t-start
				delete(casting, spellID)
			}
			if spellID == 75 { // Auto Shot: the ranged swing itself.
				continue
			}
			out = append(out, ev)
		case dst == guid && (l.event == "SPELL_AURA_APPLIED" || l.event == "SPELL_AURA_REMOVED"):
			if t < 0 || len(suffix) == 0 || suffix[0] != "BUFF" {
				continue
			}
			typ := "auraOn"
			if l.event == "SPELL_AURA_REMOVED" {
				typ = "auraOff"
			}
			out = append(out, logEvent{T: t, Type: typ, SpellID: spellID, Name: spellName})
		}
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].T < out[b].T })
	return out
}
