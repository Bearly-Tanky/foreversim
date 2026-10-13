package core

import "github.com/wowsims/forever/sim/core/dbcenums"

// What the client requires of the caster's form and auras.
type CastRequirement struct {
	Forms, ExcludedForms          uint64 // SpellShapeshift masks, bit form-1
	CasterForm                    bool   // castable with no form even though Forms names some
	NotShapeshifted               bool   // not castable in a shapeshift (a form that is not a stance)
	CasterAura, ExcludeCasterAura int32  // aura spell id that must / must not be active on the caster
}

func InForms(forms ...dbcenums.ShapeshiftForm) CastRequirement {
	var r CastRequirement
	for _, form := range forms {
		r.Forms |= form.Mask()
	}
	return r
}

func (r CastRequirement) Excluding(forms ...dbcenums.ShapeshiftForm) CastRequirement {
	for _, form := range forms {
		r.ExcludedForms |= form.Mask()
	}
	return r
}

func (r CastRequirement) OrCasterForm() CastRequirement {
	r.CasterForm = true
	return r
}

func (r CastRequirement) allowsForm(form dbcenums.ShapeshiftForm) bool {
	bit := form.Mask()
	if bit&r.ExcludedForms != 0 {
		return false
	}
	if bit&r.Forms != 0 {
		return true
	}
	if form != 0 && !form.IsStance() {
		return !r.NotShapeshifted && r.Forms == 0
	}
	return r.Forms == 0 || r.CasterForm
}

func (unit *Unit) aurasBySpellID(spellID int32) []*Aura {
	if spellID == 0 {
		return nil
	}
	var auras []*Aura
	for _, aura := range unit.auras {
		if aura.ActionID.SpellID == spellID {
			auras = append(auras, aura)
		}
	}
	return auras
}

func (spell *Spell) resolveCasterAuras() {
	spell.casterAuras = spell.Unit.aurasBySpellID(spell.CastRequirement.CasterAura)
	spell.excludeCasterAuras = spell.Unit.aurasBySpellID(spell.CastRequirement.ExcludeCasterAura)
}

func anyAuraActive(auras []*Aura) bool {
	for _, aura := range auras {
		if aura.IsActive() {
			return true
		}
	}
	return false
}

// unshift: castable only once Unit.AutoUnshift has left the current form.
func (spell *Spell) castRequirementFailure() (reason string, unshift bool) {
	r := &spell.CastRequirement
	unit := spell.Unit
	if !r.allowsForm(unit.ShapeshiftForm) {
		if unit.AutoUnshift == nil || !r.allowsForm(0) {
			return "wrong form", false
		}
		unshift = true
	}
	if r.CasterAura != 0 && !anyAuraActive(spell.casterAuras) {
		return "missing caster aura", false
	}
	if r.ExcludeCasterAura != 0 && anyAuraActive(spell.excludeCasterAuras) {
		return "excluded caster aura", false
	}
	return "", unshift
}
