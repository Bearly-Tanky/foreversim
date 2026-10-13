package core

import (
	"time"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// Exclusive categories for resistance buffs — ensures only the highest value applies per school.
const (
	ResistanceCategoryArcane = "ResistanceArcane"
	ResistanceCategoryFire   = "ResistanceFire"
	ResistanceCategoryFrost  = "ResistanceFrost"
	ResistanceCategoryNature = "ResistanceNature"
	ResistanceCategoryShadow = "ResistanceShadow"
)

// Exclusive category for flat stat buffs which don't stack with each other
// e.g. Arcane Brilliance vs Greater Arcane Elixir.
const StatBuffCategory = "StatBuff"

// The category one stat or pseudo-stat of a buff bids in alone: the buff's category, then the stat's
// name or its PseudoStats field, then whether the buff adds to it or multiplies it.
func ExclusiveStatCategory(category string, key string, multiplicative bool) string {
	return category + key + Ternary(multiplicative, "Mul", "Add")
}

func makeExclusiveFlatStatBuff(aura *Aura, stat stats.Stat, value float64, exclusiveCategory string) {
	aura.NewExclusiveEffect(ExclusiveStatCategory(exclusiveCategory, stat.StatName(), false), false, ExclusiveEffect{
		Priority: value,
		OnGain: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stat, value)
		},
		OnExpire: func(ee *ExclusiveEffect, sim *Simulation) {
			ee.Aura.Unit.AddStatDynamic(sim, stat, -value)
		},
	})
}

// Applies buffs that affect individual players.
func applyBuffEffects(agent Agent, raidBuffs *proto.RaidBuffs, partyBuffs *proto.PartyBuffs, individual *proto.IndividualBuffs) {
	registeredBuffs().ApplyBuffs(agent.GetCharacter(), raidBuffs, partyBuffs, individual)
}

// /////////////////////////////////////////////////////////////////////////
//
//	Party Buffs
//
// /////////////////////////////////////////////////////////////////////////

func ApplyFixedShoutAura(char *Character, aura *Aura, category string) {
	aura.ApplyOnInit(func(aura *Aura, sim *Simulation) {
		auras := char.GetAurasWithTag(category)
		var playerAura *Aura
		for _, bsAura := range auras {
			if bsAura.ActionID.Tag == 0 {
				playerAura = bsAura
				break
			}
		}

		if playerAura == nil {
			return
		}

		playerAura.ApplyOnGain(func(_ *Aura, _ *Simulation) {
			pa := sim.GetConsumedPendingActionFromPool()
			pa.NextActionAt = playerAura.ExpiresAt() + char.ReactionTime
			pa.OnAction = func(sim *Simulation) {
				aura.Activate(sim)

				StartPeriodicAction(sim, PeriodicActionOptions{
					Period:   aura.Duration + 1,
					NumTicks: 1,
					OnAction: func(sim *Simulation) {
						aura.Activate(sim)
					},
				})
			}
			sim.AddPendingAction(pa)
		})
	})

	ApplyFixedUptimeAura(aura, 1, aura.Duration+1, -1)
}

////////////////////////////
//  Cooldowns
////////////////////////////

// Client 1.60.1.70009: the talent 14892's rank curve reads 8/17/25% armor, the buff is 14893 for 15 sec.
func InspirationAura(unit *Unit, points int32) *Aura {
	multiplier := 1 + []float64{0, .08, .17, .25}[points]

	armorDep := unit.NewDynamicMultiplyStat(stats.Armor, multiplier)

	return unit.GetOrRegisterAura(Aura{
		Label:    "Inspiration",
		ActionID: ActionID{SpellID: 14893},
		Duration: time.Second * 15,
	}).AttachStatDependency(armorDep)
}

func ApplyInspiration(character *Character, uptime float64) {
	if uptime <= 0 {
		return
	}
	uptime = min(1, uptime)

	inspirationAura := InspirationAura(&character.Unit, 3)

	ApplyFixedUptimeAura(inspirationAura, uptime, time.Millisecond*2500, 1)
}

// Used for approximating cooldowns applied by other players to you, such as
// innervate, power infusion, etc. This is specifically for buffs
// which can be consecutively applied multiple times to a single player.
type externalConsecutiveCDApproximation struct {
	ActionID         ActionID
	AuraTag          string
	CooldownPriority int32
	Type             CooldownType
	AuraDuration     time.Duration
	AuraCD           time.Duration

	// Callback for extra activation conditions.
	ShouldActivate CooldownActivationCondition

	// Applies the buff.
	AddAura           CooldownActivation
	RelatedSelfBuff   *Aura             // Used to attach the aura to the generic spell
	RelatedAuraArrays LabeledAuraArrays // Used to attach the aura to the generic spell
}

// numSources is the number of other players assigned to apply the buff to this player.
// E.g. the number of other druids in the group casting innervate.
func registerExternalConsecutiveCDApproximation(char *Character, config externalConsecutiveCDApproximation, numSources int32) {
	if numSources == 0 {
		panic("Need at least 1 source!")
	}

	var nextExternalIndex int

	externalTimers := make([]*Timer, numSources)
	for i := 0; i < int(numSources); i++ {
		externalTimers[i] = char.NewTimer()
	}
	sharedTimer := char.NewTimer()

	spell := char.RegisterSpell(SpellConfig{
		ActionID: config.ActionID,
		Flags:    SpellFlagNoOnCastComplete | SpellFlagNoMetrics | SpellFlagNoLogs,

		Cast: CastConfig{
			CD: Cooldown{
				Timer:    sharedTimer,
				Duration: config.AuraDuration, // Assumes that multiple buffs are different sources.
			},
		},
		ExtraCastCondition: func(sim *Simulation, target *Unit) bool {
			if !externalTimers[nextExternalIndex].IsReady(sim) {
				return false
			}

			if char.HasActiveAuraWithTag(config.AuraTag) {
				return false
			}

			return true
		},

		ApplyEffects: func(sim *Simulation, _ *Unit, _ *Spell) {
			config.AddAura(sim, char)
			externalTimers[nextExternalIndex].Set(sim.CurrentTime + config.AuraCD)

			nextExternalIndex = (nextExternalIndex + 1) % len(externalTimers)

			if externalTimers[nextExternalIndex].IsReady(sim) {
				sharedTimer.Set(sim.CurrentTime + config.AuraDuration)
			} else {
				sharedTimer.Set(sim.CurrentTime + externalTimers[nextExternalIndex].TimeToReady(sim))
			}
		},
		RelatedSelfBuff:   config.RelatedSelfBuff,
		RelatedAuraArrays: config.RelatedAuraArrays,
	})

	char.AddMajorCooldown(MajorCooldown{
		Spell:    spell,
		Priority: config.CooldownPriority,
		Type:     config.Type,

		ShouldActivate: config.ShouldActivate,
	})
}
