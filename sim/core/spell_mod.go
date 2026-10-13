package core

import (
	"fmt"
	"math"
	"slices"
	"strconv"
	"time"

	"github.com/wowsims/forever/sim/core/proto"
)

/*
SpellMod implementation.
*/

type SpellModConfig struct {
	ClassMask int64
	// The client's EffectSpellClassMask: the spells this mod names. A mod that sets both this and
	// ClassMask applies only to the spells both name.
	ClassFlags        ClassFlags
	Kind              SpellModType
	School            SpellSchool
	DefenseType       DefenseType // Only apply to spells with a matching DefenseType
	ProcMask          ProcMask
	SpellFlag         SpellFlag
	ResourceType      proto.ResourceType
	IntValue          int32
	TimeValue         time.Duration
	FloatValue        float64
	KeyValue          string
	ApplyCustom       SpellModApply
	RemoveCustom      SpellModRemove
	ResetCustom       SpellModOnReset
	ShouldApplyToPets bool
}

type SpellMod struct {
	ClassMask      int64
	ClassFlags     ClassFlags
	Kind           SpellModType
	School         SpellSchool
	DefenseType    DefenseType
	ProcMask       ProcMask
	SpellFlag      SpellFlag
	ResourceType   proto.ResourceType
	floatValue     float64
	intValue       int32
	timeValue      time.Duration
	keyValue       string
	Apply          SpellModApply
	Remove         SpellModRemove
	IsActive       bool
	AffectedSpells []*Spell
	OnReset        SpellModOnReset

	// The auras this mod has written to, for the kinds that change an aura rather than the spell
	// pointing at it. One aura is routinely shared by every rank of a family and a class mask names
	// every rank, so the value would otherwise land on that aura once per rank.
	touchedAuras []*Aura
}

// Whether the mod may write to this aura, which it may once until it gives the aura up again.
func (mod *SpellMod) claimAura(aura *Aura) bool {
	if slices.Contains(mod.touchedAuras, aura) {
		return false
	}
	mod.touchedAuras = append(mod.touchedAuras, aura)
	return true
}

// Whether the mod has written to this aura, giving it up if it has, so that turning the mod on again
// writes to it again.
func (mod *SpellMod) releaseAura(aura *Aura) bool {
	i := slices.Index(mod.touchedAuras, aura)
	if i < 0 {
		return false
	}
	mod.touchedAuras = slices.Delete(mod.touchedAuras, i, i+1)
	return true
}

type SpellModApply func(mod *SpellMod, spell *Spell)
type SpellModRemove func(mod *SpellMod, spell *Spell)
type SpellModOnReset func(mod *SpellMod)

type SpellModFunctions struct {
	Apply   SpellModApply
	Remove  SpellModRemove
	OnReset SpellModOnReset
}

func buildMod(unit *Unit, config SpellModConfig) *SpellMod {
	functions := spellModMap[config.Kind]
	if functions == nil {
		panic("SpellMod " + strconv.Itoa(int(config.Kind)) + " not implemented")
	}

	var applyFn SpellModApply
	var removeFn SpellModRemove
	var resetFn SpellModOnReset

	if config.Kind == SpellMod_Custom {
		if (config.ApplyCustom == nil) || (config.RemoveCustom == nil) {
			panic("ApplyCustom and RemoveCustom are mandatory fields for SpellMod_Custom")
		}

		applyFn = config.ApplyCustom
		removeFn = config.RemoveCustom
		resetFn = config.ResetCustom

	} else {
		applyFn = functions.Apply
		removeFn = functions.Remove
		resetFn = functions.OnReset
	}

	if config.School > SpellSchoolNone && config.Kind == SpellMod_BonusHit_Percent {
		panic("For Spell school specific hit modifiers use PseudoStats.SchoolBonusHitChance")
	}

	if (config.ResourceType > 0) && !slices.Contains([]proto.ResourceType{proto.ResourceType_ResourceTypeMana, proto.ResourceType_ResourceTypeEnergy, proto.ResourceType_ResourceTypeRage, proto.ResourceType_ResourceTypeFocus}, config.ResourceType) {
		panic(fmt.Sprintf("ResourceType %s for SpellMod is not implemented", config.ResourceType))
	}

	mod := &SpellMod{
		ClassMask:    config.ClassMask,
		ClassFlags:   config.ClassFlags,
		Kind:         config.Kind,
		School:       config.School,
		DefenseType:  config.DefenseType,
		ProcMask:     config.ProcMask,
		SpellFlag:    config.SpellFlag,
		ResourceType: config.ResourceType,
		floatValue:   config.FloatValue,
		intValue:     config.IntValue,
		timeValue:    config.TimeValue,
		keyValue:     config.KeyValue,
		Apply:        applyFn,
		Remove:       removeFn,
		IsActive:     false,
		OnReset:      resetFn,
	}

	unit.OnSpellRegistered(func(spell *Spell) {
		if shouldApply(spell, mod) {
			mod.AffectedSpells = append(mod.AffectedSpells, spell)

			if mod.IsActive {
				mod.Apply(mod, spell)
			}
		}
	})

	if mod.OnReset != nil {
		unit.RegisterResetEffect(func(s *Simulation) {
			mod.OnReset(mod)
		})
	}

	if config.ShouldApplyToPets {
		for _, pet := range unit.PetAgents {
			pet.GetPet().OnSpellRegistered(func(spell *Spell) {
				if shouldApply(spell, mod) {
					mod.AffectedSpells = append(mod.AffectedSpells, spell)
					if mod.IsActive {
						mod.Apply(mod, spell)
					}
				}
			})
			if mod.OnReset != nil {
				pet.GetPet().RegisterResetEffect(func(s *Simulation) {
					mod.OnReset(mod)
				})
			}
		}
	}

	return mod
}

func (unit *Unit) AddStaticMod(config SpellModConfig) {
	mod := buildMod(unit, config)
	mod.Activate()
}

func (unit *Unit) AddDynamicMod(config SpellModConfig) *SpellMod {
	return buildMod(unit, config)
}

func shouldApply(spell *Spell, mod *SpellMod) bool {
	if spell.Flags.Matches(SpellFlagNoSpellMods) {
		return false
	}

	if mod.ResourceType > 0 {
		if spell.Cost == nil {
			return false
		} else {
			if _, ok := spell.Cost.ResourceCostImpl.(*ManaCost); mod.ResourceType == proto.ResourceType_ResourceTypeMana && !ok {
				return false
			} else if _, ok := spell.Cost.ResourceCostImpl.(*EnergyCost); mod.ResourceType == proto.ResourceType_ResourceTypeEnergy && !ok {
				return false
			} else if _, ok := spell.Cost.ResourceCostImpl.(*RageCost); mod.ResourceType == proto.ResourceType_ResourceTypeRage && !ok {
				return false
			} else if _, ok := spell.Cost.ResourceCostImpl.(*FocusCost); mod.ResourceType == proto.ResourceType_ResourceTypeFocus && !ok {
				return false
			}
		}
	}

	if mod.ClassMask > 0 && !spell.Matches(mod.ClassMask) {
		return false
	}

	if !mod.ClassFlags.IsZero() && !spell.MatchesFlags(mod.ClassFlags) {
		return false
	}

	if mod.School > 0 && !mod.School.Matches(spell.SpellSchool) {
		return false
	}

	if mod.DefenseType > 0 && spell.DefenseType != mod.DefenseType {
		return false
	}

	if mod.ProcMask > 0 && !mod.ProcMask.Matches(spell.ProcMask) {
		return false
	}

	// A modifier on the off-hand's hits alone is one on the off-hand weapon's, and an off-hand hit
	// with no weapon behind it, such as a shield's, takes none of them.
	if mod.ProcMask > 0 && mod.ProcMask&^ProcMaskMeleeOH == 0 && !spell.Unit.AutoAttacks.IsDualWielding {
		return false
	}

	if mod.SpellFlag > 0 && !mod.SpellFlag.Matches(spell.Flags) {
		return false
	}

	return true
}

func (mod *SpellMod) UpdateIntValue(value int32) {
	if mod.IsActive {
		mod.Deactivate()
		mod.intValue = value
		mod.Activate()
	} else {
		mod.intValue = value
	}
}

func (mod *SpellMod) UpdateTimeValue(value time.Duration) {
	if mod.IsActive {
		mod.Deactivate()
		mod.timeValue = value
		mod.Activate()
	} else {
		mod.timeValue = value
	}
}

func (mod *SpellMod) UpdateFloatValue(value float64) {
	if mod.IsActive {
		mod.Deactivate()
		mod.floatValue = value
		mod.Activate()
	} else {
		mod.floatValue = value
	}
}

func (mod *SpellMod) GetIntValue() int32 {
	return mod.intValue
}

func (mod *SpellMod) GetFloatValue() float64 {
	return mod.floatValue
}

func (mod *SpellMod) GetTimeValue() time.Duration {
	return mod.timeValue
}

func (mod *SpellMod) Activate() {
	if mod.IsActive {
		return
	}

	for _, spell := range mod.AffectedSpells {
		mod.Apply(mod, spell)
	}

	mod.IsActive = true
}

func (mod *SpellMod) Deactivate() {
	if !mod.IsActive {
		return
	}

	for _, spell := range mod.AffectedSpells {
		mod.Remove(mod, spell)
	}

	mod.IsActive = false
}

// Mod implmentations
type SpellModType uint64

const (
	// Will multiply the spell.DamageDoneMultiplier. +5% = 0.05
	// Uses FloatValue
	SpellMod_DamageDone_Pct SpellModType = 1 << iota

	// Will add the value spell.DamageDoneAddMultiplier
	// Uses FloatValue
	SpellMod_DamageDone_Flat

	// Will reduce spell.Cost.PercentModifier by % amount. -5% = -0.05
	// Stacks multiplicatively with other pct cost mods.
	// Use for effects that are SPELL_AURA_MOD_POWER_COST_SCHOOL_PCT (aura 72)
	// in DBC, e.g. Elemental Precision, Pyromaniac, The Beast Within.
	// For 0 Mana cost use -2
	// Uses FloatValue
	SpellMod_PowerCost_Pct

	// Adds to spell.Cost.AdditivePercentModifier. +75% = 0.75
	// Stacks additively with other mods of this kind: bucket = 1 + sum of mods.
	// Applied on top of (multiplied with) SpellMod_PowerCost_Pct mods.
	// Use for effects that are SPELL_AURA_ADD_PCT_MODIFIER (aura 108) with
	// EffectMiscValue SPELLMOD_COST (14) in DBC — the common case for talents,
	// set bonuses and procs.
	// Uses FloatValue
	SpellMod_PowerCost_Pct_Add

	// Increases or decreases spell.Cost.FlatModifier by flat amount. -5 Mana = -5
	// Uses IntValue
	SpellMod_PowerCost_Flat

	// Will add time.Duration to spell.CD.Duration
	// Uses TimeValue
	SpellMod_Cooldown_Flat

	// Will multiply the spell CD multiplier. -5% = 0.95
	// Uses FloatValue
	SpellMod_Cooldown_Multiplier

	// Will increase the CritMultiplierAdditive. +100% = 1.0
	// Uses FloatValue
	SpellMod_CritMultiplier_Flat

	// Will multiply the CritMultiplierPct. +3% = 0.03
	// Uses FloatValue
	SpellMod_CritMultiplier_Pct

	// Will add / substract % amount from the cast time multiplier.
	// Ueses: FloatValue
	SpellMod_CastTime_Pct

	// Will add / substract time from the cast time.
	// Ueses: TimeValue
	SpellMod_CastTime_Flat

	// Add/subtract bonus crit %
	// Uses: FloatValue
	SpellMod_BonusCrit_Percent

	// Add/subtract bonus hit %
	// Uses: FloatValue
	SpellMod_BonusHit_Percent

	// Add/subtract to the dots max ticks
	// Uses: IntValue
	SpellMod_DotNumberOfTicks_Flat

	// Add/subtract to the casts gcd
	// Uses: TimeValue
	SpellMod_GlobalCooldown_Flat

	// Add/substrct to the base tick frequency
	// Uses: TimeValue
	SpellMod_DotTickLength_Flat

	// Add/subtract bonus coefficient
	// Uses: FloatValue
	SpellMod_BonusCoeffecient_Flat

	// Enables casting while moving
	SpellMod_AllowCastWhileMoving

	// Enables casting while channeling
	SpellMod_AllowCastWhileChanneling

	// Add/subtract bonus spell damage
	// Uses: FloatValue
	SpellMod_BonusSpellDamage_Flat

	// Add/subtract bonus expertise, in percent
	// Uses: FloatValue
	SpellMod_BonusExpertise_Percent

	// Add/subtract duration for associated debuff
	// Uses: KeyValue, TimeValue
	SpellMod_DebuffDuration_Flat

	// Add/subtract duration for associated self-buff
	// Uses: TimeValue
	SpellMod_BuffDuration_Flat

	// User-defined implementation
	// Uses: ApplyCustom | RemoveCustom
	SpellMod_Custom

	// Used to modify the amount of charges a spell has
	// Uses: IntValue
	SpellMod_ModCharges_Flat

	// Will multiply the dot.PeriodicDamageMultiplier. +5% = 0.05
	// Uses FloatValue
	SpellMod_DotDamageDone_Pct

	// Will increase the dot.BaseDurationMultiplier. +5% = 0.05
	// Uses FloatValue
	SpellMod_DotBaseDuration_Pct

	// Add/subtract bonus coefficient
	// Uses: FloatValue
	SpellMod_DotBonusCoeffecient_Flat

	// Will increase the spell.ThreatMultiplier. +5% = 0.05
	// Uses FloatValue
	SpellMod_ThreatMultiplier_Pct

	// Add/subtract base damage
	// Uses: FloatValue
	SpellMod_BaseDamage_Flat

	// Will multiply the spell.FlatThreatBonus. +5% = 0.05
	// Uses FloatValue
	SpellMod_FlatThreatBonus_Pct

	// Add/subtract duration from every duration the spell has: its dots and hots, its self-buff
	// and every aura array it is related to. Targets the spell does not have are left alone.
	// Uses: TimeValue
	SpellMod_Duration_Flat

	// Add/subtract to the maximum stacks of the spell's self-buff and of the stacking auras in
	// its aura arrays. Auras that do not stack stay non-stacking.
	// Uses: IntValue
	SpellMod_BuffMaxStacks_Flat

	// Add/subtract to the spell's maximum range in yards. Only spells registered with a range
	// constraint check their range at all, so the mod is inert on the others.
	// Uses: FloatValue
	SpellMod_Range_Flat

	// Will add the value to spell.DirectDamageMultiplierAdditive, which only direct hits read.
	// Uses FloatValue
	SpellMod_DirectDamageDone_Flat
)

var spellModMap = map[SpellModType]*SpellModFunctions{
	SpellMod_DamageDone_Pct: {
		Apply:  applyDamageDonePercent,
		Remove: removeDamageDonePercent,
	},

	SpellMod_DamageDone_Flat: {
		Apply:   applyDamageDoneAdd,
		Remove:  removeDamageDoneAdd,
		OnReset: onResetDamageDoneAdd,
	},

	SpellMod_PowerCost_Pct: {
		Apply:  applyPowerCostPercent,
		Remove: removePowerCostPercent,
	},

	SpellMod_PowerCost_Pct_Add: {
		Apply:  applyPowerCostPercentAdditive,
		Remove: removePowerCostPercentAdditive,
	},

	SpellMod_PowerCost_Flat: {
		Apply:  applyPowerCostFlat,
		Remove: removePowerCostFlat,
	},

	SpellMod_Cooldown_Flat: {
		Apply:  applyCooldownFlat,
		Remove: removeCooldownFlat,
	},

	SpellMod_Cooldown_Multiplier: {
		Apply:  applyCooldownMultiplier,
		Remove: removeCooldownMultiplier,
	},

	SpellMod_CritMultiplier_Flat: {
		Apply:  applyCritMultiplierFlat,
		Remove: removeCritMultiplierFlat,
	},

	SpellMod_CritMultiplier_Pct: {
		Apply:  applyCritMultiplierPct,
		Remove: removeCritMultiplierPct,
	},

	SpellMod_CastTime_Pct: {
		Apply:  applyCastTimePercent,
		Remove: removeCastTimePercent,
	},

	SpellMod_CastTime_Flat: {
		Apply:  applyCastTimeFlat,
		Remove: removeCastTimeFlat,
	},

	SpellMod_BonusCrit_Percent: {
		Apply:  applyBonusCritPercent,
		Remove: removeBonusCritPercent,
	},

	SpellMod_BonusHit_Percent: {
		Apply:  applyBonusHitPercent,
		Remove: removeBonusHitPercent,
	},

	SpellMod_DotNumberOfTicks_Flat: {
		Apply:  applyDotNumberOfTicks,
		Remove: removeDotNumberOfTicks,
	},

	SpellMod_GlobalCooldown_Flat: {
		Apply:  applyGlobalCooldownFlat,
		Remove: removeGlobalCooldownFlat,
	},
	SpellMod_DotTickLength_Flat: {
		Apply:  applyDotTickLengthFlat,
		Remove: removeDotTickLengthFlat,
	},

	SpellMod_BonusCoeffecient_Flat: {
		Apply:  applyBonusCoefficientFlat,
		Remove: removeBonusCoefficientFlat,
	},

	SpellMod_AllowCastWhileMoving: {
		Apply:  applyAllowCastWhileMoving,
		Remove: removeAllowCastWhileMoving,
	},

	SpellMod_BonusSpellDamage_Flat: {
		Apply:  applyBonusSpellDamageFlat,
		Remove: removeBonusSpellDamageFlat,
	},

	SpellMod_BonusExpertise_Percent: {
		Apply:  applyBonusExpertisePercent,
		Remove: removeBonusExpertisePercent,
	},

	SpellMod_DebuffDuration_Flat: {
		Apply:  applyDebuffDurationFlat,
		Remove: removeDebuffDurationFlat,
	},

	SpellMod_BuffDuration_Flat: {
		Apply:  applyBuffDurationFlat,
		Remove: removeBuffDurationFlat,
	},

	SpellMod_Custom: {
		// Doesn't have dedicated Apply/Remove functions as ApplyCustom/RemoveCustom is handled in buildMod()
	},

	SpellMod_ModCharges_Flat: {
		Apply:  applyModChargesFlat,
		Remove: removeModChargesFlat,
	},

	SpellMod_DotDamageDone_Pct: {
		Apply:  applyDotDamageDonePercent,
		Remove: removeDotDamageDonePercent,
	},

	SpellMod_DotBaseDuration_Pct: {
		Apply:  applyDotBaseDurationMultiplier,
		Remove: removeDotBaseDurationMultiplier,
	},

	SpellMod_DotBonusCoeffecient_Flat: {
		Apply:  applyDotBonusCoefficientFlat,
		Remove: removeDotBonusCoefficientFlat,
	},

	SpellMod_ThreatMultiplier_Pct: {
		Apply:  applyThreatMultiplierPercent,
		Remove: removeThreatMultiplierPercent,
	},

	SpellMod_BaseDamage_Flat: {
		Apply:  applyBaseDamageFlat,
		Remove: removeBaseDamageFlat,
	},

	SpellMod_FlatThreatBonus_Pct: {
		Apply:  applyFlatThreatBonusPercent,
		Remove: removeFlatThreatBonusPercent,
	},

	SpellMod_Duration_Flat: {
		Apply:  applyDurationFlat,
		Remove: removeDurationFlat,
	},

	SpellMod_BuffMaxStacks_Flat: {
		Apply:  applyBuffMaxStacksFlat,
		Remove: removeBuffMaxStacksFlat,
	},

	SpellMod_Range_Flat: {
		Apply:  applyRangeFlat,
		Remove: removeRangeFlat,
	},

	SpellMod_DirectDamageDone_Flat: {
		Apply:   applyDirectDamageDoneAdd,
		Remove:  removeDirectDamageDoneAdd,
		OnReset: onResetDirectDamageDoneAdd,
	},
}

func applyDamageDonePercent(mod *SpellMod, spell *Spell) {
	spell.DamageMultiplier *= 1 + mod.floatValue
}

func removeDamageDonePercent(mod *SpellMod, spell *Spell) {
	spell.DamageMultiplier /= 1 + mod.floatValue
}

func applyDamageDoneAdd(mod *SpellMod, spell *Spell) {
	spell.DamageMultiplierAdditive += mod.floatValue
}

func removeDamageDoneAdd(mod *SpellMod, spell *Spell) {
	spell.DamageMultiplierAdditive -= mod.floatValue
}

// Required to round floating point errors that might leak between iterations
// Edge case if many addtions / substractions with different float numbers are done in random order
func onResetDamageDoneAdd(mod *SpellMod) {
	for _, spell := range mod.AffectedSpells {
		spell.DamageMultiplierAdditive = math.Round(spell.DamageMultiplierAdditive*10000) / 10000
	}
}

func applyPowerCostPercent(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.PercentModifier *= (1 + mod.floatValue)
	}
}

func removePowerCostPercent(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.PercentModifier /= (1 + mod.floatValue)
	}
}

func applyPowerCostPercentAdditive(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.AdditivePercentModifier += mod.floatValue
	}
}

func removePowerCostPercentAdditive(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.AdditivePercentModifier -= mod.floatValue
	}
}

func applyPowerCostFlat(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.FlatModifier += mod.intValue
	}
}

func removePowerCostFlat(mod *SpellMod, spell *Spell) {
	if spell.Cost != nil {
		spell.Cost.FlatModifier -= mod.intValue
	}
}

func applyCooldownFlat(mod *SpellMod, spell *Spell) {
	spell.CD.Duration += mod.timeValue
}

func removeCooldownFlat(mod *SpellMod, spell *Spell) {
	spell.CD.Duration -= mod.timeValue
}

func applyCooldownMultiplier(mod *SpellMod, spell *Spell) {
	spell.CdMultiplier *= mod.floatValue
}

func removeCooldownMultiplier(mod *SpellMod, spell *Spell) {
	spell.CdMultiplier /= mod.floatValue
}

func applyCritMultiplierFlat(mod *SpellMod, spell *Spell) {
	spell.CritMultiplierAdditive += mod.floatValue
}

func removeCritMultiplierFlat(mod *SpellMod, spell *Spell) {
	spell.CritMultiplierAdditive -= mod.floatValue
}

func applyCritMultiplierPct(mod *SpellMod, spell *Spell) {
	spell.CritMultiplierPct *= (1 + mod.floatValue)
}

func removeCritMultiplierPct(mod *SpellMod, spell *Spell) {
	spell.CritMultiplierPct /= (1 + mod.floatValue)
}

func applyCastTimePercent(mod *SpellMod, spell *Spell) {
	spell.CastTimeMultiplier += mod.floatValue
}

func removeCastTimePercent(mod *SpellMod, spell *Spell) {
	spell.CastTimeMultiplier -= mod.floatValue
}

func applyCastTimeFlat(mod *SpellMod, spell *Spell) {
	spell.DefaultCast.CastTime += mod.timeValue
}

func removeCastTimeFlat(mod *SpellMod, spell *Spell) {
	spell.DefaultCast.CastTime -= mod.timeValue
}

func applyBonusCritPercent(mod *SpellMod, spell *Spell) {
	spell.BonusCritPercent += mod.floatValue
}

func removeBonusCritPercent(mod *SpellMod, spell *Spell) {
	spell.BonusCritPercent -= mod.floatValue
}

func applyBonusHitPercent(mod *SpellMod, spell *Spell) {
	spell.BonusHitPercent += mod.floatValue
}

func removeBonusHitPercent(mod *SpellMod, spell *Spell) {
	spell.BonusHitPercent -= mod.floatValue
}

func applyDotNumberOfTicks(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseTickCount += mod.intValue
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.BaseTickCount += mod.intValue
	}
}

func removeDotNumberOfTicks(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseTickCount -= mod.intValue
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.BaseTickCount -= mod.intValue
	}
}

func applyGlobalCooldownFlat(mod *SpellMod, spell *Spell) {
	spell.DefaultCast.GCD += mod.timeValue
}

func removeGlobalCooldownFlat(mod *SpellMod, spell *Spell) {
	spell.DefaultCast.GCD -= mod.timeValue
}

func applyDotTickLengthFlat(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseTickLength += mod.timeValue
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.BaseTickLength += mod.timeValue
	}
}

func removeDotTickLengthFlat(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseTickLength -= mod.timeValue
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.BaseTickLength -= mod.timeValue
	}
}

func applyBonusCoefficientFlat(mod *SpellMod, spell *Spell) {
	spell.BonusCoefficient += mod.floatValue
}

func removeBonusCoefficientFlat(mod *SpellMod, spell *Spell) {
	spell.BonusCoefficient -= mod.floatValue
}

func applyAllowCastWhileMoving(mod *SpellMod, spell *Spell) {
	spell.Flags |= SpellFlagCanCastWhileMoving
}

func removeAllowCastWhileMoving(mod *SpellMod, spell *Spell) {
	spell.Flags ^= SpellFlagCanCastWhileMoving
}

func applyBonusSpellDamageFlat(mod *SpellMod, spell *Spell) {
	spell.BonusSpellDamage += mod.floatValue
}

func removeBonusSpellDamageFlat(mod *SpellMod, spell *Spell) {
	spell.BonusSpellDamage -= mod.floatValue
}

func applyBonusExpertisePercent(mod *SpellMod, spell *Spell) {
	spell.BonusExpertisePercent += mod.floatValue
}

func removeBonusExpertisePercent(mod *SpellMod, spell *Spell) {
	spell.BonusExpertisePercent -= mod.floatValue
}

func modDebuffDurationFlat(mod *SpellMod, spell *Spell, value time.Duration, claim func(*Aura) bool) {
	debuffAuraArray := spell.RelatedAuraArrays[mod.keyValue]

	if debuffAuraArray == nil {
		panic("No debuff found for key: " + mod.keyValue)
	}

	for _, debuffAura := range debuffAuraArray {
		if debuffAura != nil && claim(debuffAura) {
			debuffAura.Duration += value
		}
	}
}

func applyDebuffDurationFlat(mod *SpellMod, spell *Spell) {
	modDebuffDurationFlat(mod, spell, mod.timeValue, mod.claimAura)
}

func removeDebuffDurationFlat(mod *SpellMod, spell *Spell) {
	modDebuffDurationFlat(mod, spell, -mod.timeValue, mod.releaseAura)
}

// The shared cooldown belongs to the spell rather than to the buff, so every spell the mod names
// takes it while the buff takes the duration once.
func modBuffDurationFlat(spell *Spell, value time.Duration, claim func(*Aura) bool) {
	if spell.SharedCD.Duration != 0 {
		spell.SharedCD.Duration += value
	}
	if spell.RelatedSelfBuff != nil && claim(spell.RelatedSelfBuff) {
		spell.RelatedSelfBuff.Duration += value
	}
}

func applyBuffDurationFlat(mod *SpellMod, spell *Spell) {
	modBuffDurationFlat(spell, mod.timeValue, mod.claimAura)
}

func removeBuffDurationFlat(mod *SpellMod, spell *Spell) {
	modBuffDurationFlat(spell, -mod.timeValue, mod.releaseAura)
}

func applyModChargesFlat(mod *SpellMod, spell *Spell) {
	spell.MaxCharges += int(mod.GetIntValue())
	if spell.MaxCharges < 0 {
		panic("Reducing the charges below 0 is not supported. Something seems wrong.")
	}

	if mod.GetIntValue() > 0 {
		spell.charges += int(mod.GetIntValue())
	}

	if spell.charges > spell.MaxCharges {
		spell.charges = spell.MaxCharges
	}
}

func removeModChargesFlat(mod *SpellMod, spell *Spell) {
	spell.MaxCharges -= int(mod.GetIntValue())
	if spell.MaxCharges < 0 {
		panic("Reducing the charges below 0 is not supported. Something seems wrong.")
	}

	if mod.GetIntValue() < 0 {
		spell.charges -= int(mod.GetIntValue())
	}

	if spell.charges > spell.MaxCharges {
		spell.charges = spell.MaxCharges
	}
}

func applyDotDamageDonePercent(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.PeriodicDamageMultiplier *= (1 + mod.floatValue)
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.PeriodicDamageMultiplier *= (1 + mod.floatValue)
	}
}

func removeDotDamageDonePercent(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.PeriodicDamageMultiplier /= (1 + mod.floatValue)
			}
		}
	}
	if spell.aoeDot != nil {
		spell.aoeDot.PeriodicDamageMultiplier /= (1 + mod.floatValue)
	}
}

func applyDotBaseDurationMultiplier(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseDurationMultiplier *= (1 + mod.floatValue)
			}
		}
	}

	if spell.aoeDot != nil {
		spell.aoeDot.BaseDurationMultiplier *= (1 + mod.floatValue)
	}
}

func removeDotBaseDurationMultiplier(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BaseDurationMultiplier /= (1 + mod.floatValue)
			}
		}
	}

	if spell.aoeDot != nil {
		spell.aoeDot.BaseDurationMultiplier /= (1 + mod.floatValue)
	}
}

func applyDotBonusCoefficientFlat(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BonusCoefficient += mod.floatValue
			}
		}
	}

	if spell.aoeDot != nil {
		spell.aoeDot.BonusCoefficient += mod.floatValue
	}
}

func removeDotBonusCoefficientFlat(mod *SpellMod, spell *Spell) {
	if spell.dots != nil {
		for _, dot := range spell.dots {
			if dot != nil {
				dot.BonusCoefficient -= mod.floatValue
			}
		}
	}

	if spell.aoeDot != nil {
		spell.aoeDot.BonusCoefficient -= mod.floatValue
	}
}

func applyThreatMultiplierPercent(mod *SpellMod, spell *Spell) {
	spell.ThreatMultiplier *= (1 + mod.floatValue)
}

func removeThreatMultiplierPercent(mod *SpellMod, spell *Spell) {
	spell.ThreatMultiplier /= (1 + mod.floatValue)
}

func applyBaseDamageFlat(mod *SpellMod, spell *Spell) {
	spell.BonusBaseDamage += mod.floatValue
}

func removeBaseDamageFlat(mod *SpellMod, spell *Spell) {
	spell.BonusBaseDamage -= mod.floatValue
}

func applyFlatThreatBonusPercent(mod *SpellMod, spell *Spell) {
	spell.FlatThreatBonus *= (1 + mod.floatValue)
}

func removeFlatThreatBonusPercent(mod *SpellMod, spell *Spell) {
	spell.FlatThreatBonus /= (1 + mod.floatValue)
}

// A dot belongs to the spell that ticks it, so every spell the mod names takes the value; the auras
// are shared between the ranks of a family and take it once each.
func modDurationFlat(spell *Spell, value time.Duration, claim func(*Aura) bool) {
	for _, dot := range spell.dots {
		if dot != nil {
			dot.BaseDurationFlat += value
		}
	}

	if spell.aoeDot != nil {
		spell.aoeDot.BaseDurationFlat += value
	}

	if spell.RelatedSelfBuff != nil && claim(spell.RelatedSelfBuff) {
		spell.RelatedSelfBuff.Duration += value
	}

	for _, auraArray := range spell.RelatedAuraArrays {
		for _, aura := range auraArray {
			if aura != nil && claim(aura) {
				aura.Duration += value
			}
		}
	}
}

func applyDurationFlat(mod *SpellMod, spell *Spell) {
	modDurationFlat(spell, mod.timeValue, mod.claimAura)
}

func removeDurationFlat(mod *SpellMod, spell *Spell) {
	modDurationFlat(spell, -mod.timeValue, mod.releaseAura)
}

// An aura the client never gives stacks stays at MaxStacks 0, which is what SetStacks refuses to touch.
func modBuffMaxStacksFlat(spell *Spell, value int32, claim func(*Aura) bool) {
	if spell.RelatedSelfBuff != nil && spell.RelatedSelfBuff.MaxStacks > 0 && claim(spell.RelatedSelfBuff) {
		spell.RelatedSelfBuff.MaxStacks = addBuffMaxStacks(spell.RelatedSelfBuff, value)
	}

	for _, auraArray := range spell.RelatedAuraArrays {
		for _, aura := range auraArray {
			if aura != nil && aura.MaxStacks > 0 && claim(aura) {
				aura.MaxStacks = addBuffMaxStacks(aura, value)
			}
		}
	}
}

// Both loops above skip an aura at 0 stacks, so a mod that took one there could not give them back
// when it is removed. Refusing it keeps apply and remove symmetric, the way applyModChargesFlat does.
func addBuffMaxStacks(aura *Aura, value int32) int32 {
	stacks := aura.MaxStacks + value
	if stacks <= 0 {
		panic(fmt.Sprintf("Spell mod would leave the aura %s at %d max stacks. Something seems wrong.",
			aura.Label, stacks))
	}
	return stacks
}

func applyBuffMaxStacksFlat(mod *SpellMod, spell *Spell) {
	modBuffMaxStacksFlat(spell, mod.intValue, mod.claimAura)
}

func removeBuffMaxStacksFlat(mod *SpellMod, spell *Spell) {
	modBuffMaxStacksFlat(spell, -mod.intValue, mod.releaseAura)
}

// MaxRange 0 is no range check at all, so there is nothing for the mod to move: writing to it would
// hand the spell a range the client never gave it. A spell that does state one may not be shortened
// past nothing.
func applyRangeFlat(mod *SpellMod, spell *Spell) {
	if spell.MaxRange == 0 {
		return
	}
	if spell.MaxRange+mod.floatValue <= 0 {
		panic(fmt.Sprintf("Spell mod would leave %s at %0.1f yards of range. Something seems wrong.",
			spell.ActionID, spell.MaxRange+mod.floatValue))
	}
	spell.MaxRange += mod.floatValue
}

func removeRangeFlat(mod *SpellMod, spell *Spell) {
	if spell.MaxRange == 0 {
		return
	}
	spell.MaxRange -= mod.floatValue
}

func applyDirectDamageDoneAdd(mod *SpellMod, spell *Spell) {
	spell.DirectDamageMultiplierAdditive += mod.floatValue
}

func removeDirectDamageDoneAdd(mod *SpellMod, spell *Spell) {
	spell.DirectDamageMultiplierAdditive -= mod.floatValue
}

// Required to round floating point errors that might leak between iterations
func onResetDirectDamageDoneAdd(mod *SpellMod) {
	for _, spell := range mod.AffectedSpells {
		spell.DirectDamageMultiplierAdditive = math.Round(spell.DirectDamageMultiplierAdditive*10000) / 10000
	}
}
