package main

import (
	"strings"
	"testing"
)

// Advanced info for the player: 17 fields from version 20 (with absorb), 16 before.
func advanced(modern bool, rage int) string {
	if modern {
		return "Player-1-0A,0000000000000000,4139,4139,1410,0,3200,0,1," + itoa(rage*10) + ",1000,0,1.0,2.0,1453,3.14,60"
	}
	return "Player-1-0A,0000000000000000,4139,4139,1410,0,3200,1," + itoa(rage) + ",100,0,1.0,2.0,1453,3.14,60"
}

func itoa(n int) string {
	return strings.TrimSpace(strings.Replace(string(rune('0'+n/100%10))+string(rune('0'+n/10%10))+string(rune('0'+n%10)), "\x00", "", -1))
}

func sampleLog(modern bool) string {
	header := "10/14/2026 20:00:00.000-4  COMBAT_LOG_VERSION,9,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,1.60.1,PROJECT_ID,2"
	dmg := func(amount, crit, off string) string { // suffix after advanced
		if modern {
			return amount + ",300,-1,1,0,0,0," + crit + ",nil,nil," + off + ",ST"
		}
		return amount + ",-1,1,0,0,0," + crit + ",nil,nil"
	}
	if modern {
		header = strings.Replace(header, "VERSION,9", "VERSION,22", 1)
	}
	me := `Player-1-0A,"Thrall-Nightslayer",0x511,0x0`
	boss := `Creature-0-1-2-3-12118-01,"Lucifron",0x10a48,0x0`
	dummy := `Creature-0-1-2-3-31146-01,"Training Dummy",0x10a28,0x0`
	lines := []string{
		header,
		`10/14/2026 20:00:05.000-4  ENCOUNTER_START,663,"Lucifron",9,40,409`,
		"10/14/2026 20:00:06.000-4  SWING_DAMAGE," + me + "," + boss + "," + advanced(modern, 10) + "," + dmg("500", "nil", "nil"),
		"10/14/2026 20:00:07.000-4  SWING_DAMAGE," + me + "," + boss + "," + advanced(modern, 30) + "," + dmg("900", "1", "1"),
		"10/14/2026 20:00:35.000-4  ENCOUNTER_END,663,\"Lucifron\",9,40,1",
		"10/14/2026 20:05:00.000-4  SPELL_CAST_START," + me + `,0000000000000000,nil,0x80000000,0x80000000,25289,"Slam",0x1`,
		"10/14/2026 20:05:01.500-4  SPELL_CAST_SUCCESS," + me + "," + dummy + `,25289,"Slam",0x1,` + advanced(modern, 40),
		"10/14/2026 20:05:01.500-4  SPELL_DAMAGE," + me + "," + dummy + `,25289,"Slam",0x1,` + advanced(modern, 25) + "," + dmg("1200", "1", "nil"),
		"10/14/2026 20:05:03.000-4  SWING_MISSED," + me + "," + dummy + ",DODGE,nil",
		"10/14/2026 20:05:04.000-4  SPELL_AURA_APPLIED," + me + "," + me + `,12966,"Flurry",0x1,BUFF`,
		"10/14/2026 20:05:10.000-4  SWING_DAMAGE," + me + "," + dummy + "," + advanced(modern, 50) + "," + dmg("700", "nil", "nil"),
	}
	return strings.Join(lines, "\n") + "\n"
}

func TestCombatLog(t *testing.T) {
	for _, modern := range []bool{false, true} {
		r, lines, err := readLogFrom(strings.NewReader(sampleLog(modern)))
		if err != nil {
			t.Fatal(err)
		}
		fights := r.fights(lines)
		if len(fights) != 2 {
			t.Fatalf("modern=%v: %d fights, want 2", modern, len(fights))
		}
		boss, dummy := fights[0], fights[1]
		if boss.Kind != "encounter" || boss.Name != "Lucifron" || boss.Duration != 30 || boss.Success == nil || !*boss.Success {
			t.Errorf("modern=%v: boss %+v", modern, boss)
		}
		if boss.Players[0].Damage != 1400 || boss.Players[0].Name != "Thrall-Nightslayer" {
			t.Errorf("modern=%v: boss damage %+v", modern, boss.Players[0])
		}
		if dummy.Kind != "combat" || dummy.Name != "Training Dummy" || dummy.Clock != "20:05" {
			t.Errorf("modern=%v: dummy %+v", modern, dummy)
		}

		events := r.playerEvents(lines, boss, "Player-1-0A")
		var swings []logEvent
		var rage []float64
		for _, e := range events {
			if e.Type == "damage" {
				swings = append(swings, e)
			}
			if e.Type == "resource" {
				rage = append(rage, e.Value)
			}
		}
		if len(swings) != 2 || swings[0].Amount != 500 || swings[0].Tag != 1 || swings[1].Outcome != "Crit" {
			t.Errorf("modern=%v: swings %+v", modern, swings)
		}
		if modern && swings[1].Tag != 2 {
			t.Errorf("modern: the off-hand flag was lost: %+v", swings[1])
		}
		if len(rage) != 2 || rage[0] != 10 || rage[1] != 30 {
			t.Errorf("modern=%v: rage %v", modern, rage)
		}

		events = r.playerEvents(lines, dummy, "Player-1-0A")
		got := []string{}
		for _, e := range events {
			if e.Type != "resource" {
				got = append(got, e.Type+":"+e.Outcome)
			}
		}
		if strings.Join(got, " ") != "cast: damage:Crit damage:Dodge auraOn: damage:Hit" {
			t.Errorf("modern=%v: dummy events %v", modern, got)
		}
		for _, e := range events {
			if e.Type == "cast" && (e.CastTime != 1.5 || e.T != -1.5) {
				t.Errorf("modern=%v: Slam's cast %+v", modern, e)
			}
		}
	}
}
