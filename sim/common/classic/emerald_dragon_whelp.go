package classic

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

const DragonsCall = int32(10847)

// The Emerald Dragon Whelp Dragon's Call summons. The client has no creature data, so its stats,
// melee and 50% spit rate are master's guesses from Classic logs.
type EmeraldDragonWhelp struct {
	core.Pet

	acidSpit   *core.Spell
	disabledAt time.Duration
}

func init() {
	// One whelp at a time, as on master: a proc while it is out refreshes it rather than adding
	// another. Only a Dragon's Call equipped at the start gets one.
	core.RegisterGearPetConstructor(func(character *core.Character) {
		if character.MainHand().ID == DragonsCall || character.OffHand().ID == DragonsCall {
			character.AddPet(newEmeraldDragonWhelp(character))
		}
	})
}

func newEmeraldDragonWhelp(character *core.Character) *EmeraldDragonWhelp {
	whelp := &EmeraldDragonWhelp{
		Pet: core.NewPet(core.PetConfig{
			Name:  "Emerald Dragon Whelp",
			Owner: character,
			BaseStats: stats.Stats{
				stats.Health:          1500,
				stats.Intellect:       20,
				stats.Mana:            500,
				stats.SpellDamage:     155, // master tuned 220 on its flat 374 to hit the log (~594 a spit); 438.5 + 155 keeps that
				stats.MeleeCritRating: 4.5 * core.PhysicalCritRatingPerCritPercent,
				stats.SpellCritRating: 13 * core.SpellCritRatingPerCritPercent,
			},
			StatInheritance: func(_ stats.Stats) stats.Stats { return stats.Stats{} },
			IsGuardian:      true,
		}),
	}
	whelp.Level = 55

	whelp.EnableManaBar()
	whelp.EnableAutoAttacks(whelp, core.AutoAttackOptions{
		MainHand: core.Weapon{
			BaseDamageMin: 80,
			BaseDamageMax: 100,
			SwingSpeed:    2,
			SpellSchool:   core.SpellSchoolPhysical,
		},
		AutoSwingMelee: true,
	})

	return whelp
}

func (whelp *EmeraldDragonWhelp) summon(sim *core.Simulation, duration time.Duration) {
	whelp.disabledAt = sim.CurrentTime + duration
	whelp.EnableWithTimeout(sim, whelp, duration)
}

func (whelp *EmeraldDragonWhelp) Initialize() {
	// Acid Spit (9591): 438.5 +-29.3%, so 374 to 503 Nature, where master had a flat 374.
	whelp.acidSpit = whelp.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 9591},
		SpellSchool: core.SpellSchoolNature,
		DefenseType: core.DefenseTypeMagic,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagIgnoreModifiers,

		ManaCost: core.ManaCostOptions{FlatCost: 90},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Second * 3,
			},
		},

		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		BonusCoefficient: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealDamage(sim, target, sim.Roll(374, 503), spell.OutcomeMagicHitAndCrit)
		},
	})
}

// After each swing or spit, spits half the time and otherwise waits for the next swing. The spit
// resets the swing timer, and one the whelp would not live to finish is skipped.
func (whelp *EmeraldDragonWhelp) ExecuteCustomRotation(sim *core.Simulation) {
	castEnd := sim.CurrentTime + whelp.acidSpit.CastTime()
	if castEnd < whelp.disabledAt && whelp.acidSpit.CanCast(sim, whelp.CurrentTarget) && sim.Proc(0.5, "Acid Spit Cast") {
		whelp.AutoAttacks.StopMeleeUntil(sim, castEnd)
		whelp.acidSpit.Cast(sim, whelp.CurrentTarget)
		return
	}
	whelp.WaitUntil(sim, whelp.AutoAttacks.NextAttackAt())
}

func (whelp *EmeraldDragonWhelp) Reset(sim *core.Simulation) {
	whelp.Disable(sim)
}

func (whelp *EmeraldDragonWhelp) OnEncounterStart(_ *core.Simulation) {
}

func (whelp *EmeraldDragonWhelp) GetPet() *core.Pet {
	return &whelp.Pet
}
