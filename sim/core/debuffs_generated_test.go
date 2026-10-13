package core_test

import (
	"os"
	"regexp"
	"strconv"
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/buffs"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// The raid config registers its debuffs on every enemy and each is permanent,
// so the fight starts with all of them activated; the reset that does it in the
// sim needs a whole environment, which this stands in for.
func applyGeneratedTestDebuffs(target *core.Unit, debuffs *proto.Debuffs) *core.Simulation {
	sim := &core.Simulation{}
	core.ApplyDebuffEffects(target, debuffs, &proto.Raid{})
	for _, aura := range target.GetAuras() {
		aura.Activate(sim)
	}
	return sim
}

// The six schools the client's mask 126 names: every school but physical.
var magicSchools = []stats.SchoolIndex{
	stats.SchoolIndexArcane, stats.SchoolIndexFire, stats.SchoolIndexFrost,
	stats.SchoolIndexHoly, stats.SchoolIndexNature, stats.SchoolIndexShadow,
}

func TestGeneratedCurseOfTheElementsHitsEverySchoolAndResistance(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{CurseOfElements: true})

	for _, school := range magicSchools {
		if got := target.PseudoStats.SchoolDamageTakenMultiplier[school]; got != 1.1 {
			t.Errorf("school %d takes %v times the damage, want the client's 1.1", school, got)
		}
	}
	if got := target.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexPhysical]; got != 1 {
		t.Errorf("physical damage taken is %v, want the client's mask to have left it alone", got)
	}

	for _, stat := range []stats.Stat{
		stats.ArcaneResistance, stats.FireResistance, stats.FrostResistance,
		stats.NatureResistance, stats.ShadowResistance,
	} {
		if got := target.GetStats()[stat]; got != -75 {
			t.Errorf("%s is %v, want the client's -75", stat.StatName(), got)
		}
	}

	aura := target.GetAura("Curse of the Elements (External)")
	if aura == nil {
		t.Fatalf("no aura is labelled %q; the target has %v", "Curse of the Elements (External)", targetAuraLabels(target))
	}
	if want := (core.ActionID{SpellID: 1311680, Tag: -1}); aura.ActionID != want {
		t.Errorf("the curse is %v, want %v", aura.ActionID, want)
	}
	if aura.Duration != core.NeverExpires {
		t.Errorf("the curse lasts %v, want the raid config's copy to be up all fight", aura.Duration)
	}
	if got := buffs.CurseOfElementsDuration(0); got != 5*time.Minute {
		t.Errorf("the curse is %v long before it is made permanent, want the client's 5 minutes", got)
	}
}

// Expose Armor states its armor per combo point, and the raid config's debuff
// is the five-point finisher.
func TestGeneratedExposeArmorIsTheFivePointFinisher(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{ExposeArmor: true})

	if got := target.GetStats()[stats.Armor]; got != -2250 {
		t.Errorf("armor is %v, want five times the client's -450", got)
	}

	category := target.ExclusiveEffectManager.GetExclusiveEffectCategory(buffs.ExposeArmorCategory)
	if !category.SingleAura {
		t.Error("the armor category is not single-aura, so a second armor reduction could sit next to it")
	}
	if len(category.Effects()) != 1 || category.Effects()[0].Priority != 2250 {
		t.Errorf("the category holds %d effects, first bid %v; want one bidding the magnitude 2250",
			len(category.Effects()), category.Effects()[0].Priority)
	}
}

// A stacking debuff is worth its amount once per stack, and it bids the same
// way, so that a debuff worth more than five stacks of it takes the slot.
func TestGeneratedSunderArmorPricesEveryStack(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	sim := applyGeneratedTestDebuffs(target, &proto.Debuffs{SunderArmor: true})

	sunder := target.GetAura("Sunder Armor (External)")
	if sunder == nil {
		t.Fatalf("no aura is labelled %q; the target has %v", "Sunder Armor (External)", targetAuraLabels(target))
	}
	if got := target.GetStats()[stats.Armor]; got != 0 {
		t.Errorf("a sunder with no stacks reduced armor by %v, want nothing", got)
	}

	sunder.SetStacks(sim, 5)

	if got := target.GetStats()[stats.Armor]; got != -2250 {
		t.Errorf("armor is %v, want five stacks of the client's -450", got)
	}
	category := target.ExclusiveEffectManager.GetExclusiveEffectCategory(buffs.SunderArmorCategory)
	if len(category.Effects()) != 1 || category.Effects()[0].Priority != 2250 {
		t.Errorf("the category holds %d effects, first bid %v; want one bidding the magnitude 2250",
			len(category.Effects()), category.Effects()[0].Priority)
	}
}

// Only the strongest armor reduction is on the target: the weaker one's aura is
// pushed off and its armor given back.
func TestGeneratedExposeArmorOutbidsAWeakerSunder(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	sim := applyGeneratedTestDebuffs(target, &proto.Debuffs{SunderArmor: true})
	sunder := target.GetAura("Sunder Armor (External)")
	sunder.SetStacks(sim, 1)
	if got := target.GetStats()[stats.Armor]; got != -450 {
		t.Fatalf("one stack of sunder reduced armor by %v, want the client's -450", got)
	}

	expose := core.MakePermanent(buffs.ExposeArmorAura(target, false, 0))
	expose.Activate(sim)

	if got := target.GetStats()[stats.Armor]; got != -2250 {
		t.Errorf("armor is %v, want only Expose Armor's -2250", got)
	}
	if sunder.IsActive() {
		t.Error("the weaker armor reduction is still on the target, so both apply")
	}
}

// With both in the raid config, Expose Armor is worth its full -2250 from the
// first moment and the raid's Sunder Armor is worth nothing until it has
// stacks, so the category turns the sunder away and its ramp never starts.
func TestGeneratedExposeArmorHoldsTheSlotAgainstTheRaidsSunder(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{ExposeArmor: true, SunderArmor: true})

	if got := target.GetStats()[stats.Armor]; got != -2250 {
		t.Errorf("armor is %v, want one reduction of -2250", got)
	}
	if expose := target.GetAura("Expose Armor (External)"); !expose.IsActive() {
		t.Error("Expose Armor is not on the target")
	}
	if sunder := target.GetAura("Sunder Armor (External)"); sunder.IsActive() {
		t.Error("the raid's Sunder Armor activated next to Expose Armor, so both are on the target")
	}
}

func TestGeneratedThunderClapSlowsTheTarget(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{ThunderClap: true})

	// The client's -20 is 20% more time between attacks, so the speed is divided by 1.2.
	want := 1 / core.SlowedTimeMultiplier(-20)
	if got := buffs.ThunderClapValue(0); got != want {
		t.Errorf("the clap is worth %v, want the client's -20%% as %v", got, want)
	}
	if got := target.PseudoStats.MeleeSpeedMultiplier; got != want {
		t.Errorf("the melee speed multiplier is %v, want %v", got, want)
	}
	if got := target.TotalMeleeHasteMultiplier(); got != want {
		t.Errorf("the target swings at %v times its speed, want the slow to have reached the swing timers", got)
	}
}

// Every member of the attack-speed category bids how far from 1 its multiplier
// is, so that the strongest slow on the target is the one that applies whatever
// form its source states it in.
func TestGeneratedThunderClapBidsAgainstTheHandWrittenSlows(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()
	sim := applyGeneratedTestDebuffs(target, &proto.Debuffs{ThunderClap: true})
	clap := target.GetAura("Thunder Clap (External)")

	// A hand-written slow states the multiplier the target's speed is divided
	// by, so 1.5 is a third slower and outbids the clap's sixth.
	slower := target.GetOrRegisterAura(core.Aura{
		Label:    "Hand-written Slow",
		ActionID: core.ActionID{SpellID: 27648},
		Duration: time.Second * 12,
	})
	// Through a variable, so that the test does the same float64 arithmetic the
	// helper does rather than Go's exact constant arithmetic.
	divisor := 1.5
	stronger := core.AtkSpeedReductionEffect(slower, divisor)
	if want := 1 - 1/divisor; stronger.Priority != want {
		t.Errorf("a slow that divides by %v bids %v, want the magnitude %v", divisor, stronger.Priority, want)
	}

	slower.Activate(sim)

	if got := target.PseudoStats.MeleeSpeedMultiplier; got != 1 {
		t.Errorf("the melee speed multiplier is %v, want the weaker slow taken back", got)
	}
	if got, want := target.PseudoStats.AttackSpeedMultiplier, 1/divisor; got != want {
		t.Errorf("the attack speed multiplier is %v, want the stronger slow's %v", got, want)
	}
	if !clap.IsActive() {
		t.Error("losing the category pushed the weaker aura off, which only a single-aura category may do")
	}
}

// Thunderfury's Cyclone 27648 and Thunder Clap 11581 both state -20, the same slow, so they bid
// the same. The raid's clap outlasts the proc's 12 seconds, so it keeps the category when the
// proc lands.
func TestGeneratedThunderClapOutbidsThunderfurysCyclone(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()
	sim := applyGeneratedTestDebuffs(target, &proto.Debuffs{ThunderClap: true})
	clap := target.GetAura("Thunder Clap (External)")

	cyclone := target.GetOrRegisterAura(core.Aura{
		Label:    "Cyclone",
		ActionID: core.ActionID{SpellID: 27648},
		Duration: time.Second * 12,
	})
	tied := core.AtkSpeedReductionEffect(cyclone, core.SlowedTimeMultiplier(-20))
	if clapBid := clap.ExclusiveEffects[0].Priority; tied.Priority != clapBid {
		t.Fatalf("the proc bids %v against the clap's %v, want the same -20%% slow to tie", tied.Priority, clapBid)
	}

	cyclone.Activate(sim)

	want := 1 / core.SlowedTimeMultiplier(-20)
	if got := target.PseudoStats.MeleeSpeedMultiplier; got != want {
		t.Errorf("the melee speed multiplier is %v, want the clap's %v to have stayed", got, want)
	}
	if got := target.PseudoStats.AttackSpeedMultiplier; got != 1 {
		t.Errorf("the attack speed multiplier is %v, want the tied proc to have applied nothing", got)
	}
	if got := target.TotalMeleeHasteMultiplier(); got != want {
		t.Errorf("the target swings at %v times its speed, want the clap's %v", got, want)
	}
}

// Demoralizing Roar and Demoralizing Shout are the same category, so the attack
// power comes off the target once however many of them the raid brings.
func TestGeneratedDemoralizingDebuffsApplyOnce(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{DemoralizingRoar: true, DemoralizingShout: true})

	if got := target.GetStats()[stats.AttackPower]; got != -205 {
		t.Errorf("attack power is %v, want the store's -205 once", got)
	}

	roar := target.GetAura("Demoralizing Roar (External)")
	shout := target.GetAura("Demoralizing Shout (External)")
	if roar == nil || shout == nil {
		t.Fatalf("the target has %v, want both demoralizing auras", targetAuraLabels(target))
	}
	if roar.IsActive() == shout.IsActive() {
		t.Errorf("roar active %v, shout active %v; want exactly one of them on the target",
			roar.IsActive(), shout.IsActive())
	}
}

// The two judgements are bare 40-second auras in the client; what they do to
// whoever strikes the target is the driver's proc trigger.
func TestGeneratedJudgementsCarryTheDriversProcTriggers(t *testing.T) {
	target := core.NewGeneratedDebuffTestTarget()

	applyGeneratedTestDebuffs(target, &proto.Debuffs{JudgementOfLight: true, JudgementOfWisdom: true})

	for label, want := range map[string]core.ActionID{
		"Judgement of Light (External)":  {SpellID: 20346, Tag: -1},
		"Judgement of Wisdom (External)": {SpellID: 20355, Tag: -1},
	} {
		aura := target.GetAura(label)
		if aura == nil {
			t.Fatalf("the target has %v, want an aura labelled %q", targetAuraLabels(target), label)
		}
		if aura.ActionID != want {
			t.Errorf("%s is %v, want %v", label, aura.ActionID, want)
		}
		if !aura.IsActive() {
			t.Errorf("%s is not up, want the raid config's copy to be permanent", label)
		}
		if aura.OnSpellHitTaken == nil {
			t.Errorf("%s has no proc trigger, so nothing happens to whoever strikes the target", label)
		}
	}

	if buffs.JudgementOfLightDuration(0) != time.Second*40 || buffs.JudgementOfWisdomDuration(0) != time.Second*40 {
		t.Errorf("the judgements last %v and %v before they are made permanent, want the client's 40 seconds",
			buffs.JudgementOfLightDuration(0), buffs.JudgementOfWisdomDuration(0))
	}
}

func targetAuraLabels(target *core.Unit) []string {
	labels := make([]string, 0, len(target.GetAuras()))
	for _, aura := range target.GetAuras() {
		labels = append(labels, aura.Label)
	}
	return labels
}

// The addStat call under the comment that names HuntersMarkValue.
var huntersMarkSheetRE = regexp.MustCompile(`(?s)HuntersMarkValue.*?addStat\(\s*Stat\.StatRangedAttackPower,\s*([0-9.]+)\s*\)`)

// Nothing exports a generated debuff's value to TypeScript, so the character sheet repeats
// Hunter's Mark's ranged attack power as a literal. The sheet and the sim state one number.
func TestHuntersMarkOnTheCharacterSheetMatchesTheSim(t *testing.T) {
	raw, err := os.ReadFile("../../ui/sim/player/player.ts")
	if err != nil {
		t.Fatalf("read player.ts: %v", err)
	}

	match := huntersMarkSheetRE.FindStringSubmatch(string(raw))
	if match == nil {
		t.Fatalf("player.ts credits no ranged attack power under the comment naming HuntersMarkValue; the pattern is %v", huntersMarkSheetRE)
	}

	sheet, err := strconv.ParseFloat(match[1], 64)
	if err != nil {
		t.Fatalf("player.ts credits %q ranged attack power: %v", match[1], err)
	}
	if want := buffs.HuntersMarkValue(0); sheet != want {
		t.Errorf("the sheet credits Hunter's Mark with %v ranged attack power, want the %v HuntersMarkValue states", sheet, want)
	}
}
