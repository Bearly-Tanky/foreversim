package classic

import (
	"time"

	"github.com/wowsims/forever/sim/common/shared"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

func init() {
	// Second Wind
	// Use: Restores 63 mana every 1 sec for 10 sec (15604). 15 min cooldown, and 10 sec on the
	// category (2554) it shares with Burst of Knowledge. The tooltip's "doubled in Mountainous
	// areas" has nothing to sim against.
	core.NewItemEffect(11819, func(agent core.Agent) {
		character := agent.GetCharacter()
		if !character.HasManaBar() {
			return
		}

		manaMetrics := character.NewManaMetrics(core.ActionID{SpellID: 15604})
		spell := character.RegisterSpell(core.SpellConfig{
			ActionID: core.ActionID{ItemID: 11819},
			ProcMask: core.ProcMaskEmpty,
			Flags:    core.SpellFlagNoOnCastComplete,
			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 15,
				},
				SharedCD: core.Cooldown{
					Timer:    character.GetOrInitSpellCategoryTimer(2554),
					Duration: time.Second * 10,
				},
			},
			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				core.StartPeriodicAction(sim, core.PeriodicActionOptions{
					Period:   time.Second,
					NumTicks: 10,
					Priority: core.ActionPriorityAuto,
					OnAction: func(sim *core.Simulation) {
						character.AddMana(sim, 63, manaMetrics)
					},
				})
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeMana,
			ShouldActivate: func(_ *core.Simulation, character *core.Character) bool {
				return character.MaxMana()-character.CurrentMana() >= 630
			},
		})
	})

	// Burst of Knowledge
	// Use: Reduces the mana cost of all spells by 150 for 10 sec (15646). 6 min cooldown, 10 sec on
	// category 2554. Master had Era's 100 on a 15 min cooldown. The client's school mask (126) leaves
	// out Physical.
	core.NewItemEffect(11832, func(agent core.Agent) {
		character := agent.GetCharacter()
		if !character.HasManaBar() {
			return
		}

		actionID := core.ActionID{ItemID: 11832}
		aura := character.RegisterAura(core.Aura{
			Label:    "Burst of Knowledge",
			ActionID: actionID,
			Duration: time.Second * 10,
		}).AttachSpellMod(core.SpellModConfig{
			Kind:         core.SpellMod_PowerCost_Flat,
			School:       core.SpellSchoolChaos,
			ResourceType: proto.ResourceType_ResourceTypeMana,
			IntValue:     -150,
		})

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID: actionID,
			ProcMask: core.ProcMaskEmpty,
			Flags:    core.SpellFlagNoOnCastComplete,
			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 6,
				},
				SharedCD: core.Cooldown{
					Timer:    character.GetOrInitSpellCategoryTimer(2554),
					Duration: time.Second * 10,
				},
			},
			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				aura.Activate(sim)
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeMana,
		})
	})

	// Essence of the Pure Flame: 13 Fire damage shield (23266).
	newDamageShieldEffect("Essence of the Pure Flame", 18815, 23266, core.SpellSchoolFire, 13)

	// The three Darkmoon-era melee procs below carry ProcChance 100 and no SpellProcsPerMinute row in
	// the client, so the rate is not stored there and master's PPM stands. The amounts are the
	// client's: base points +- half the Variance.

	// Darkmoon Card: Heroism
	// Equip: Sometimes heals bearer of 120 to 180 damage when damaging an enemy in melee (23682).
	core.NewItemEffect(19287, func(agent core.Agent) {
		character := agent.GetCharacter()
		healthMetrics := character.NewHealthMetrics(core.ActionID{SpellID: 23682})

		aura := character.MakeProcTriggerAura(core.ProcTrigger{
			Name:     "Darkmoon Card: Heroism",
			ActionID: core.ActionID{ItemID: 19287},
			Callback: core.CallbackOnSpellHitDealt,
			ProcMask: core.ProcMaskMelee,
			Outcome:  core.OutcomeLanded,
			DPM:      character.NewLegacyPPMManager(2, core.ProcMaskMelee),
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				character.GainHealth(sim, sim.Roll(120, 180), healthMetrics)
			},
		})

		character.ItemSwap.RegisterProc(19287, aura)
	})

	// Darkmoon Card: Maelstrom
	// Equip: Chance to strike your melee target with lightning for 200 to 300 Nature damage (23687).
	shared.NewProcDamageEffect(shared.ProcDamageEffect{
		ItemID:      19289,
		SpellID:     23687,
		School:      core.SpellSchoolNature,
		DefenseType: core.DefenseTypeMagic,
		MinDmg:      200,
		MaxDmg:      300,
		Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagProc,
		Trigger: core.ProcTrigger{
			Name:     "Darkmoon Card: Maelstrom",
			Callback: core.CallbackOnSpellHitDealt,
			ProcMask: core.ProcMaskMelee,
			Outcome:  core.OutcomeLanded,
		},
		TriggerDPM: func(character *core.Character) *core.DynamicProcManager {
			return character.NewLegacyPPMManager(1, core.ProcMaskMelee)
		},
	})

	// Heart of Wyrmthalak
	// Equip: Melee and Ranged attacks have a chance to deal 112 to 168 Fire damage (27655, 140
	// +-20%). Master had 120 to 180 off melee only; the client's proc flags (340) take ranged too.
	// The 0.4 PPM is master's, which it took from a wowhead comment. The triple damage to Orcs
	// has no raid boss to apply to.
	shared.NewProcDamageEffect(shared.ProcDamageEffect{
		ItemID:      22321,
		SpellID:     27655,
		School:      core.SpellSchoolFire,
		DefenseType: core.DefenseTypeMagic,
		MinDmg:      112,
		MaxDmg:      168,
		Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagProc,
		Trigger: core.ProcTrigger{
			Name:     "Heart of Wyrmthalak",
			Callback: core.CallbackOnSpellHitDealt,
			ProcMask: core.ProcMaskMeleeOrRanged,
			Outcome:  core.OutcomeLanded,
		},
		TriggerDPM: func(character *core.Character) *core.DynamicProcManager {
			return character.NewLegacyPPMManager(0.4, core.ProcMaskMeleeOrRanged)
		},
	})
}
