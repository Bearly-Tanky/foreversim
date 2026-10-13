package feralbear

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
	"github.com/wowsims/forever/sim/druid"
)

type BearRotation struct {
	MaintainFaerieFire       bool
	MaintainDemoralizingRoar bool
	MaulRageThreshold        int32
	SwipeUsage               proto.FeralBearDruid_Rotation_SwipeUsage
	SwipeApThreshold         int32
}

func (bear *GuardianDruid) setupRotation(rotation *proto.FeralBearDruid_Rotation) {
	bear.BearRotation = BearRotation{
		MaintainFaerieFire:       rotation.MaintainFaerieFire,
		MaintainDemoralizingRoar: rotation.MaintainDemoralizingRoar,
		MaulRageThreshold:        rotation.MaulRageThreshold,
		SwipeUsage:               rotation.SwipeUsage,
		SwipeApThreshold:         rotation.SwipeApThreshold,
	}
}

func (bear *GuardianDruid) doRotation(sim *core.Simulation) {
	if !bear.GCD.IsReady(sim) {
		return
	}

	rot := &bear.BearRotation

	// Refresh Lacerate if at 5 stacks and about to expire.
	if bear.shouldSaveLacerateStacks(sim) && bear.Lacerate.CanCast(sim, bear.CurrentTarget) {
		bear.Lacerate.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Maintain Faerie Fire.
	if rot.MaintainFaerieFire && bear.FaerieFire != nil &&
		bear.FaerieFireAuras.Get(bear.CurrentTarget).ShouldRefreshExclusiveEffects(sim, 0) &&
		bear.FaerieFire.CanCast(sim, bear.CurrentTarget) {
		bear.FaerieFire.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Maintain Demoralizing Roar.
	if rot.MaintainDemoralizingRoar && bear.shouldDemoRoar(sim) &&
		bear.DemoralizingRoar.CanCast(sim, bear.CurrentTarget) {
		bear.DemoralizingRoar.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Primal Bite on cooldown.
	if bear.PrimalBite.CanCast(sim, bear.CurrentTarget) {
		bear.PrimalBite.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Swipe spam mode.
	if rot.SwipeUsage == proto.FeralBearDruid_Rotation_SwipeUsage_Spam &&
		bear.Swipe.CanCast(sim, bear.CurrentTarget) {
		bear.Swipe.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Build / maintain Lacerate stacks.
	if bear.shouldLacerate(sim) && bear.Lacerate.CanCast(sim, bear.CurrentTarget) {
		bear.Lacerate.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Swipe with enough AP.
	if bear.shouldSwipe(sim) && bear.Swipe.CanCast(sim, bear.CurrentTarget) {
		bear.Swipe.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Lacerate as filler.
	if bear.Lacerate.CanCast(sim, bear.CurrentTarget) {
		bear.Lacerate.Cast(sim, bear.CurrentTarget)
		bear.tryQueueMaul(sim)
		return
	}

	// Wait for Primal Bite if nothing else to do.
	if !bear.PrimalBite.IsReady(sim) {
		bear.WaitUntil(sim, bear.PrimalBite.ReadyAt())
	}

	bear.tryQueueMaul(sim)
}

func (bear *GuardianDruid) shouldSaveLacerateStacks(sim *core.Simulation) bool {
	dot := bear.Lacerate.CurDot()
	return dot.IsActive() &&
		dot.GetStacks() == 5 &&
		dot.RemainingDuration(sim) <= time.Millisecond*1500
}

func (bear *GuardianDruid) shouldLacerate(sim *core.Simulation) bool {
	dot := bear.Lacerate.CurDot()
	return !dot.IsActive() || dot.GetStacks() < 5
}

func (bear *GuardianDruid) shouldSwipe(sim *core.Simulation) bool {
	if bear.BearRotation.SwipeUsage != proto.FeralBearDruid_Rotation_SwipeUsage_WithEnoughAP {
		return false
	}
	dot := bear.Lacerate.CurDot()
	if !dot.IsActive() || dot.GetStacks() < 5 || dot.RemainingDuration(sim) <= time.Millisecond*3000 {
		return false
	}
	ap := bear.GetStat(stats.AttackPower)
	return ap >= float64(bear.BearRotation.SwipeApThreshold)
}

func (bear *GuardianDruid) shouldDemoRoar(sim *core.Simulation) bool {
	return bear.DemoralizingRoarAuras.Get(bear.CurrentTarget).ShouldRefreshExclusiveEffects(sim, 0)
}

func (bear *GuardianDruid) tryQueueMaul(sim *core.Simulation) {
	if bear.CurrentRage() >= float64(bear.BearRotation.MaulRageThreshold) &&
		bear.Maul.CanCast(sim, bear.CurrentTarget) {
		bear.Maul.Cast(sim, bear.CurrentTarget) // casts the queue spell (tag 1)
	}
}

func (bear *GuardianDruid) OnGCDReady(sim *core.Simulation) {
	if bear.InForm(druid.Bear) {
		bear.doRotation(sim)
	}
}
