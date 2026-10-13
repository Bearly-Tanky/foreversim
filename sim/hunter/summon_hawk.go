package hunter

import (
	"strconv"
	"time"

	"github.com/wowsims/forever/sim/core"
)

// Summon Hawk shares its cooldown with Arcane Shot, and Ferocity and Unleashed Fury buff hawks the
// same way they buff pets (talents_beast_mastery.go).
//
// The beta client (1293241, 1293525-1293527) gives the dive bomb, 32/47/85/108 plus 5% of ranged
// attack power, the mana cost, a 6 sec cooldown and the 18 sec hawk (1293248), and caps the hawks
// out at once at its third effect, 2. Every dive bomb rank carries the client's always-hit attribute,
// so it never misses, and is never dodged or parried, and always leaves a hawk. A cast past the cap
// replaces the hawk closest to leaving.
//
// The hawk that stays is a guardian whose swings the client does not describe, so they come from beta
// logs (foreverlogs 2695 and 2701, two level 25/30 hunters, 534 landed swings at rank 1): the first
// swing lands on arrival, then one every 2.5 sec sped up by the hunter's ranged haste (its scaling
// aura 1293586 passes haste on); each deals about 0.35 of the rank's dive bomb base (11.5 vs 32,
// compared target by target with the dive bomb so armor cancels) and crits about 1% of the time.
// ponytail: the swing damage follows the rank's dive bomb base; re-fit once a level 36+ log shows rank 2.
func (hunter *Hunter) registerSummonHawkSpell(timer *core.Timer) {
	if !hunter.Talents.SummonHawk {
		return
	}

	rank := spellData.SummonHawk.Highest()
	baseDamage := rank.DamageEffect().Average(core.CharacterLevel)
	swingDamage := baseDamage * 0.35
	hawkDuration := spellData.SummonHawkTriggered.ByID(1293248).Duration()
	const swingInterval = time.Millisecond * 2500

	hawks := make([]*core.Spell, int(rank.EffectN(3).BasePoints))
	for i := range hawks {
		hawks[i] = hunter.RegisterSpell(core.SpellConfig{
			ActionID:       core.ActionID{SpellID: rank.ID, Tag: int32(i + 1)},
			SpellSchool:    rank.SpellSchool(),
			DefenseType:    core.DefenseTypeMelee,
			ClassSpellMask: HunterSpellSummonHawk,
			ProcMask:       core.ProcMaskEmpty,
			Flags:          core.SpellFlagMeleeMetrics,

			DamageMultiplier: 1,
			ThreatMultiplier: 1,

			Dot: core.DotConfig{
				Aura: core.Aura{
					Label: "Summon Hawk " + strconv.Itoa(i+1) + hunter.Label,
				},
				// The arrival swing is TickOnce below, so the hawk's 18 sec hold 7 more at 2.5 sec.
				NumberOfTicks:       int32(hawkDuration / swingInterval),
				TickLength:          swingInterval,
				AffectedByRealHaste: true,

				OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
					dot.Snapshot(target, swingDamage)
				},
				OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
					dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.Spell.OutcomeMeleeSpecialHit)
				},
			},
		})
	}

	hunter.SummonHawk = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       core.ActionID{SpellID: rank.ID},
		SpellSchool:    rank.SpellSchool(),
		DefenseType:    core.DefenseTypeMelee,
		ClassSpellMask: HunterSpellSummonHawk,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagMeleeMetrics | core.SpellFlagAPL,
		MaxRange:       float64(rank.MaxRange),

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(rank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: rank.GCD(),
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    timer,
				Duration: max(rank.Cooldown(), rank.CategoryCooldown()),
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			damage := baseDamage + 0.05*spell.RangedAttackPower(target)
			outcome := spell.OutcomeMeleeSpecialHitAndCrit
			if rank.AlwaysHits() {
				outcome = spell.OutcomeMeleeSpecialCritOnly
			}
			result := spell.CalcAndDealDamage(sim, target, damage, outcome)
			if !result.Landed() {
				return
			}

			// A free slot, or else the hawk with the least time left.
			hawk := hawks[0].Dot(target)
			for _, h := range hawks[1:] {
				if dot := h.Dot(target); hawk.IsActive() && (!dot.IsActive() || dot.RemainingDuration(sim) < hawk.RemainingDuration(sim)) {
					hawk = dot
				}
			}
			hawk.Apply(sim)
			hawk.TickOnce(sim)
		},
	})
}
