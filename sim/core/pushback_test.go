package core

import (
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core/proto"
)

func TestPushBackNeverLeavesMoreThanTheCastTime(t *testing.T) {
	hc := Hardcast{Expires: time.Second, CastTime: time.Second}

	steps := []struct {
		at, moved, expires time.Duration
	}{
		{at: 10 * time.Millisecond, moved: 10 * time.Millisecond, expires: 1010 * time.Millisecond},
		{at: 20 * time.Millisecond, moved: 10 * time.Millisecond, expires: 1020 * time.Millisecond},
		{at: 20 * time.Millisecond, moved: 0, expires: 1020 * time.Millisecond},
		{at: 800 * time.Millisecond, moved: SpellPushbackDuration, expires: 1520 * time.Millisecond},
		{at: 900 * time.Millisecond, moved: 380 * time.Millisecond, expires: 1900 * time.Millisecond},
	}
	for _, step := range steps {
		if moved := hc.pushBack(step.at); moved != step.moved || hc.Expires != step.expires {
			t.Fatalf("hit at %v: moved %v to %v, want %v to %v", step.at, moved, hc.Expires, step.moved, step.expires)
		}
	}
}

// The pushback handler runs a spell batch window after the hit lands. A cast
// that completes inside that window is over: pushing it back would complete it
// a second time (issue #700).
func TestPushbackSkipsACastThatCompletedInTheBatchWindow(t *testing.T) {
	sim, fw := setupConsumesSim(func(request *proto.RaidSimRequest) {
		request.Raid.Tanks = []*proto.UnitReference{{Type: proto.UnitReference_Player, Index: 0}}
		target := request.Encounter.Targets[0]
		target.SwingSpeed, target.MinBaseDamage = 2, 100
	})
	fw.PseudoStats.PushbackChance = 1
	boss := fw.CurrentTarget
	sim.PrePull()
	runUntil := func(at time.Duration) {
		for sim.CurrentTime < at && !sim.Step() {
		}
	}

	runUntil(time.Second)
	swingAt := boss.AutoAttacks.NextAttackAt()
	completions := 0
	fw.Hardcast = Hardcast{
		Expires:  swingAt + SpellBatchWindow/2,
		Spell:    fw.AutoAttacks.MHAuto(),
		Target:   boss,
		Pushback: true,
		CastTime: time.Second,
		OnComplete: func(sim *Simulation, _ *Unit) {
			fw.HardcastAvoidanceAura.Deactivate(sim)
			completions++
		},
	}
	fw.newHardcastAction(sim)

	health := fw.CurrentHealth()
	runUntil(swingAt + time.Second)
	if fw.CurrentHealth() >= health {
		t.Fatal("the boss's swing did not land; pick another seed")
	}
	if completions != 1 {
		t.Fatalf("the cast completed %d times, want once", completions)
	}
}
