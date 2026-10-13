package hunter

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/sim/core/stats"
)

// Only Aspect of the Hawk is modelled. Forever changed Aspect of the Beast - rank 1 now adds 50
// melee attack power on top of making you untrackable, where Classic gave only the untrackability -
// but a hunter holds one aspect at a time, and Hawk pays 120 ranged attack power at rank 7 to
// Beast's 50 melee. Nothing a ranged hunter does would pick Beast. Aspect of the Viper is TBC's and
// does not exist on Forever.
func (hunter *Hunter) registerAspects() {
	hunter.registerAspectOfTheHawkSpell()
}

func (hunter *Hunter) registerAspectOfTheHawkSpell() {
	hawkRank := spellData.AspectOfTheHawk.Highest()
	actionID := core.ActionID{SpellID: hawkRank.ID}

	// Every rank of Deadly Aspects triggers the same Quick Shots (6150): 30% ranged haste for 12
	// sec. The points buy only the proc chance, 2% a rank.
	var quickShots *core.Aura
	if hunter.Talents.DeadlyAspects > 0 {
		quickShotsRank := spellData.AspectOfTheHawkTriggered.Highest()
		hasteMultiplier := 1 + quickShotsRank.Effect(dbcenums.A_MOD_RANGED_HASTE, 0).Average(core.CharacterLevel)/100

		quickShots = hunter.GetOrRegisterAura(core.Aura{
			Label:    "Quick Shots",
			ActionID: core.ActionID{SpellID: quickShotsRank.ID},
			Duration: quickShotsRank.Duration(),
			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.MultiplyRangedSpeed(sim, hasteMultiplier)
			},
			OnExpire: func(aura *core.Aura, sim *core.Simulation) {
				aura.Unit.MultiplyRangedSpeed(sim, 1/hasteMultiplier)
			},
		})
	}

	rap := hawkRank.Effect(dbcenums.A_MOD_RANGED_ATTACK_POWER, 0).Average(core.CharacterLevel)
	// The row states the same 2% a rank twice, once per aspect the talent covers.
	procChance := spellData.DeadlyAspects.EffectAt(1).FractionAt(hunter.Talents.DeadlyAspects)

	hunter.AspectOfTheHawkAura = hunter.GetOrRegisterAura(core.Aura{
		Label:      "Aspect of the Hawk",
		ActionID:   actionID,
		Duration:   core.NeverExpires,
		BuildPhase: core.CharacterBuildPhaseNone,
		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.AddStatDynamic(sim, stats.RangedAttackPower, rap)
		},
		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.AddStatDynamic(sim, stats.RangedAttackPower, -rap)
		},
		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if quickShots == nil || !spell.ProcMask.Matches(core.ProcMaskRangedAuto) {
				return
			}
			if sim.Proc(procChance, "Deadly Aspects") {
				quickShots.Activate(sim)
			}
		},
	})
	hunter.AspectOfTheHawkAura.NewExclusiveEffect("Aspect", true, core.ExclusiveEffect{})

	hunter.AspectOfTheHawk = hunter.RegisterSpell(core.SpellConfig{
		ActionID:       actionID,
		SpellSchool:    hawkRank.SpellSchool(),
		DefenseType:    hawkRank.DefenseTypeCore(),
		ClassSpellMask: HunterSpellAspectOfTheHawk,
		ProcMask:       core.ProcMaskEmpty,
		Flags:          core.SpellFlagAPL,

		ManaCost: core.ManaCostOptions{
			FlatCost: int32(hawkRank.Cost()),
		},
		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: hawkRank.GCD(),
			},
			IgnoreHaste: true,
		},
		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {
			return !hunter.AspectOfTheHawkAura.IsActive()
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
			hunter.AspectOfTheHawkAura.Activate(sim)
		},

		RelatedSelfBuff: hunter.AspectOfTheHawkAura,
	})
}
