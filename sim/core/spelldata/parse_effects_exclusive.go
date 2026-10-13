package spelldata

import (
	"math"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

// The category each school's resistance bids in, which core's resistance consumables bid in too.
var schoolResistanceCategories = map[stats.Stat]string{
	stats.ArcaneResistance: core.ResistanceCategoryArcane,
	stats.FireResistance:   core.ResistanceCategoryFire,
	stats.FrostResistance:  core.ResistanceCategoryFrost,
	stats.NatureResistance: core.ResistanceCategoryNature,
	stats.ShadowResistance: core.ResistanceCategoryShadow,
}

// Where each attachment is applied: under the aura's own category, under a category of its stat's,
// under its school's resistance category, or by the aura itself. Answers the last.
func (p *Parsed) bid(aura *core.Aura, o *parseOptions) []*attachment {
	var live, whole []*attachment
	for _, a := range p.attachments {
		if a == nil {
			continue
		}

		rest := p.bidSchoolResistances(aura, a, o)
		switch {
		case o.exclusive:
			whole = append(whole, rest...)
		case o.perStatCategory != "":
			for _, part := range split(rest) {
				p.bidPerStat(aura, o.perStatCategory, part)
			}
		default:
			live = append(live, rest...)
		}
	}

	if o.exclusive {
		p.bidWhole(aura, o, whole)
	}
	return live
}

// Pulls the school resistances out of an attachment into their own categories and answers what is
// left of it: the attachment itself where it holds none.
func (p *Parsed) bidSchoolResistances(aura *core.Aura, a *attachment, o *parseOptions) []*attachment {
	if !o.schoolResistances || len(a.parts) == 0 {
		return []*attachment{a}
	}

	var rest []*attachment
	for _, part := range a.parts {
		category := schoolResistanceCategories[part.stat]
		if category == "" || part.multiplicative {
			rest = append(rest, part)
			continue
		}
		p.bidAlone(aura, core.ExclusiveStatCategory(category, part.key, false), part.value, part)
	}

	if len(rest) == len(a.parts) {
		return []*attachment{a}
	}
	return rest
}

// A stat bids its own value, the scale core's exclusive stat buffs bid on, and a pseudo-stat how far
// it moves the field.
func (p *Parsed) bidPerStat(aura *core.Aura, category string, part *attachment) {
	priority := magnitude(part)
	if part.statBid {
		priority = part.value
	}
	p.bidAlone(aura, core.ExclusiveStatCategory(category, part.key, part.multiplicative), priority, part)
}

func (p *Parsed) bidAlone(aura *core.Aura, category string, priority float64, a *attachment) {
	aura.NewExclusiveEffect(category, false, core.ExclusiveEffect{
		Priority: priority,
		OnGain: func(_ *core.ExclusiveEffect, sim *core.Simulation) {
			a.set(sim, p.count)
		},
		OnExpire: func(_ *core.ExclusiveEffect, sim *core.Simulation) {
			a.set(sim, 0)
		},
	})
}

// One effect for everything the parse attaches. Its priority is what the stacks it is at are worth,
// and the amounts follow it: a stacking aura bids nothing until its first stack and bids again on
// every one. The effect activates before the aura counts as up, so the level is read off the
// priority rather than off the aura. It is registered even when it holds nothing, which is what a
// single-aura category needs to shut the other copy off.
func (p *Parsed) bidWhole(aura *core.Aura, o *parseOptions, whole []*attachment) {
	perStack := 0.0
	for _, a := range p.attachments {
		if a != nil {
			perStack = magnitude(a)
			break
		}
	}

	priority := perStack
	if p.stacking {
		priority = 0
	}

	effect := aura.NewExclusiveEffect(o.category, o.singleAura, core.ExclusiveEffect{
		Priority: priority,
		OnGain: func(ee *core.ExclusiveEffect, sim *core.Simulation) {
			level := p.count
			if p.stacking && perStack != 0 {
				level *= ee.Priority / perStack
			}
			for _, a := range whole {
				a.set(sim, level)
			}
		},
		OnExpire: func(_ *core.ExclusiveEffect, sim *core.Simulation) {
			for _, a := range whole {
				a.set(sim, 0)
			}
		},
	})

	if p.stacking {
		aura.ApplyOnStacksChange(func(_ *core.Aura, sim *core.Simulation, _ int32, newStacks int32) {
			effect.SetPriority(sim, perStack*float64(newStacks))
		})
	}
}

func split(attachments []*attachment) []*attachment {
	var out []*attachment
	for _, a := range attachments {
		if len(a.parts) > 0 {
			out = append(out, a.parts...)
		} else {
			out = append(out, a)
		}
	}
	return out
}

// How strong an attachment is, as a positive number. A multiplier is judged by how far it is from 1,
// so a 20% slow (0.8) outbids a 10% one.
func magnitude(a *attachment) float64 {
	v := a.value
	if a.multiplicative {
		v -= 1
	}
	return math.Abs(v)
}
