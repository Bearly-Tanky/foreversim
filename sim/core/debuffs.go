package core

import (
	"time"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// applyRaidDebuffEffects applies all raid-level debuffs based on the provided Debuffs proto.
func applyDebuffEffects(target *Unit, targetIdx int, debuffs *proto.Debuffs, raid *proto.Raid) {
	registeredBuffs().ApplyDebuffs(target, debuffs, raid)
}

func ScheduledAura(aura *Aura, options PeriodicActionOptions) {
	aura.OnReset = func(aura *Aura, sim *Simulation) {
		aura.Duration = NeverExpires
		StartPeriodicAction(sim, options)
	}
}

func SlowAura(target *Unit) *Aura {
	return castSlowReductionAura(target, "Slow", 31589, 1.5, time.Second*15)
}

func castSlowReductionAura(target *Unit, label string, spellID int32, multiplier float64, duration time.Duration) *Aura {
	aura := target.GetOrRegisterAura(Aura{Label: label, ActionID: ActionID{SpellID: spellID}, Duration: duration})
	aura.NewExclusiveEffect("CastSpdReduction", false, ExclusiveEffect{
		// How far from 1 the applied factor is, which is the scale every member
		// of the category bids on: a 33% slow outbids a 20% one. The factor is
		// 1/multiplier, so a caller stating 1.5 is a 33.3% slow.
		Priority: 1 - 1/multiplier,
		OnGain: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyCastSpeed(sim, 1/multiplier)
			ee.Aura.Unit.MultiplyRangedSpeed(sim, 1/multiplier)
		},
		OnExpire: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyCastSpeed(sim, multiplier)
			ee.Aura.Unit.MultiplyRangedSpeed(sim, multiplier)
		},
	})
	return aura
}

// A slow on casts alone, in the category Slow's cast and ranged slow takes: only the strongest applies.
func CastSpeedReductionEffect(aura *Aura, castTimeMultiplier float64) *ExclusiveEffect {
	return aura.NewExclusiveEffect("CastSpdReduction", false, ExclusiveEffect{
		Priority: 1 - 1/castTimeMultiplier,
		OnGain: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyCastSpeed(sim, 1/castTimeMultiplier)
		},
		OnExpire: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyCastSpeed(sim, castTimeMultiplier)
		},
	})
}

func ScreechAura(target *Unit) *Aura {
	return statsDebuff(target, 0, "Screech", 27051, stats.Stats{stats.AttackPower: -210}, time.Second*4)
}

// A slow the client states as a negative speed percentage makes the time between attacks, or a cast
// time, that much longer: -20 is 20% longer, which divides the speed by 1.2.
func SlowedTimeMultiplier(speedPercent float64) float64 {
	return 1 - speedPercent/100
}

func AtkSpeedReductionEffect(aura *Aura, speedMultiplier float64) *ExclusiveEffect {
	return aura.NewExclusiveEffect("AtkSpdReduction", false, ExclusiveEffect{
		// How far from 1 the applied factor is, which is the scale every member
		// of the category bids on: a 20% slow outbids a 10% one. The factor is
		// 1/speedMultiplier, so a helper stating 1.2 is a 16.67% slow.
		Priority: 1 - 1/speedMultiplier,
		OnGain: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyAttackSpeed(sim, 1/speedMultiplier)
		},
		OnExpire: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.MultiplyAttackSpeed(sim, speedMultiplier)
		},
	})
}

func statsDebuff(target *Unit, casterIndex int32, label string, spellID int32, stats stats.Stats, duration time.Duration) *Aura {
	if duration == 0 {
		duration = time.Second * 30
	}

	actionID := ActionID{SpellID: spellID}
	if casterIndex != 0 {
		actionID = actionID.WithTag(casterIndex)
	}

	aura := target.GetAuraByID(actionID)
	if aura != nil {
		return aura
	}

	return target.RegisterAura(Aura{
		Label:    label,
		ActionID: actionID,
		Duration: duration,
	}).AttachStatsBuff(stats)
}
