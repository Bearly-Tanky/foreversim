package core

// What sim/core/buffs builds a generated buff with where the spell parse does not
// reach: the damage a shield deals back, the external cooldown a driven buff is
// cast on, and the flat bonus a set adds to a buff.

import (
	"fmt"
	"time"

	"github.com/wowsims/forever/sim/core/stats"
)

// The damage a damage shield deals back to whoever lands a melee hit, which
// also scales with the wearer's spell power by bonusCoefficient; the generated
// shields state none. category is the aura's own, which decides whether a
// second copy of the shield can sit next to it.
func NewDamageShield(unit *Unit, label string, actionID ActionID, duration time.Duration, category string, singleAura bool,
	school SpellSchool, damage float64, bonusCoefficient float64) *Aura {
	procSpell := unit.RegisterSpell(SpellConfig{
		ActionID:    actionID.WithTag(actionID.Tag + 2),
		SpellSchool: school,
		ProcMask:    ProcMaskEmpty,
		Flags:       SpellFlagBinary | SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		BonusCoefficient: bonusCoefficient,

		ApplyEffects: func(sim *Simulation, target *Unit, spell *Spell) {
			spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeMagicHit)
		},
	})

	aura := unit.GetOrRegisterAura(Aura{
		Label:      label,
		ActionID:   actionID,
		Duration:   TernaryDuration(duration > 0, duration, NeverExpires),
		BuildPhase: Ternary(actionID.Tag == -1, CharacterBuildPhaseBuffs, CharacterBuildPhaseNone),
	}).AttachProcTrigger(ProcTrigger{
		Name:     label + " Damage",
		Callback: CallbackOnSpellHitTaken,
		Outcome:  OutcomeLanded,
		Handler: func(sim *Simulation, spell *Spell, result *SpellResult) {
			if spell.SpellSchool.Matches(SpellSchoolPhysical) {
				procSpell.Cast(sim, spell.Unit)
			}
		},
	})

	// The shield has no stat to apply or remove: what the category decides is
	// which aura keeps its proc trigger, so the damage is the whole bid.
	if category != "" {
		aura.NewExclusiveEffect(category, singleAura, ExclusiveEffect{Priority: damage})
	}
	return aura
}

// What a driver decides about a buff other players cast on this one: how many
// of them take turns, how long each waits before casting again, whether the
// cooldown is worth a mana, a damage or a survival slot, and when the sim
// should spend it.
type GeneratedExternalCD struct {
	NumSources     int32
	Cooldown       time.Duration
	Type           CooldownType
	ShouldActivate CooldownActivationCondition
}

// The external cooldown around a generated aura, approximated by NumSources
// casters taking turns. The aura carries the buff's own label, duration and
// effects; its tag is what tells the sim the buff is already up, so a row whose
// cooldown is driven states a category for the generator to tag it with.
func NewGeneratedExternalCD(char *Character, aura *Aura, config GeneratedExternalCD) {
	if config.NumSources == 0 {
		return
	}

	// The external caster's copy of a permanent buff is up while the character
	// sheet is measured; a cooldown is not, so it keeps its effects out of the
	// stats the build phase collects.
	aura.BuildPhase = CharacterBuildPhaseNone

	registerExternalConsecutiveCDApproximation(char, externalConsecutiveCDApproximation{
		ActionID:         aura.ActionID,
		AuraTag:          aura.Tag,
		CooldownPriority: CooldownPriorityDefault,
		Type:             config.Type,
		AuraDuration:     aura.Duration,
		AuraCD:           config.Cooldown,
		ShouldActivate:   config.ShouldActivate,
		AddAura:          func(sim *Simulation, _ *Character) { aura.Activate(sim) },
		RelatedSelfBuff:  aura,
	}, config.NumSources)
}

// The second category the aura joins without an effect of its own, which is how
// the paladin auras exclude each other across schools. Only the player's own
// copy joins it: the external copy has to be able to sit next to the one the
// player casts.
func JoinSharedCategory(aura *Aura, shared string, isPlayer bool) {
	if shared == "" || !isPlayer {
		return
	}
	aura.NewExclusiveEffect(shared, true, ExclusiveEffect{})
}

// AddGeneratedFlatBonus raises a generated buff the client states as worth base
// to base+bonus, in both of the numbers a buff that does not stack keeps apart:
// what it applies and what it bids for its category. Three pieces of the
// warrior's tier 2 set are worth 30 more attack power on Battle Shout, and a
// shout worth 169 has to outbid one worth 139. The aura grants the extra amount
// for exactly as long as it holds the category, because a category that holds
// one aura at a time deactivates the copy it outbids.
//
// The aura belongs to the unit rather than to whoever raised it, so two party
// members wearing the same set ask for the same total and get it once: a call
// against an aura that already carries the bonus does nothing. One that finds
// some other amount there is reading a different buff's base and says so.
//
// The category has to hold one aura at a time. That is what makes attaching the
// extra amount to the aura the same thing as attaching it to the effect: the
// copy that loses the category is deactivated outright, so the aura is up
// exactly while its effect is the one applying.
//
// It writes Priority directly, which is only safe before the fight: an effect
// that is already active has to go through SetPriority to re-apply what it
// holds. Every caller runs while the character is being built.
func AddGeneratedFlatBonus(aura *Aura, stat stats.Stat, base float64, bonus float64) {
	if aura.MaxStacks > 0 {
		panic("a stacking aura re-prices its category effect on every stack, which would drop the bonus: " + aura.Label)
	}

	for _, effect := range aura.ExclusiveEffects {
		if effect.Category.Name != aura.Tag {
			continue
		}
		if !effect.Category.SingleAura {
			panic("a category that holds more than one aura cannot tell a flat bonus when to apply: " + aura.Label)
		}
		if effect.Priority == base+bonus {
			return
		}
		if effect.Priority != base {
			panic(fmt.Sprintf("%s bids %v, which is neither the %v it is worth nor the %v the bonus makes it",
				aura.Label, effect.Priority, base, base+bonus))
		}
		effect.Priority = base + bonus
		aura.AttachStatBuff(stat, bonus)
		return
	}

	panic("a flat bonus needs a buff that bids for its whole category: " + aura.Label)
}
