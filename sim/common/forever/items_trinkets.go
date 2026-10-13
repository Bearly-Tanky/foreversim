package forever

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

func init() {
	// Hand of Justice: "${$h/3}% chance on Melee hit to gain $s1 extra attack", ProcChance 3 and
	// a 2 sec proc cooldown in the client's SpellAuraOptions for 15600, so 1%.
	core.NewItemEffect(11815, func(agent core.Agent) {
		character := agent.GetCharacter()
		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:               "Hand of Justice",
			ActionID:           core.ActionID{SpellID: 15600},
			Callback:           core.CallbackOnSpellHitDealt,
			ProcMask:           core.ProcMaskMelee,
			Outcome:            core.OutcomeLanded,
			ProcChance:         0.01,
			ICD:                time.Second * 2,
			TriggerImmediately: true,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				character.AutoAttacks.ExtraMHAttack(sim)
			},
		})
	})

	// Jom Gabbar
	// Use: Increases attack power by 65 and an additional 65 every 2 sec. Lasts 20 sec. (2 Min Cooldown)
	core.NewItemEffect(23570, func(agent core.Agent) {
		character := agent.GetCharacter()
		actionID := core.ActionID{SpellID: 29602}
		duration := time.Second * 20
		bonusPerStack := stats.Stats{
			stats.AttackPower:       65,
			stats.RangedAttackPower: 65,
		}

		jomGabbarAura := character.GetOrRegisterAura(core.Aura{
			Label:     "Jom Gabbar",
			ActionID:  actionID,
			Duration:  duration,
			MaxStacks: 10,
			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				core.StartPeriodicAction(sim, core.PeriodicActionOptions{
					Period:          time.Second * 2,
					NumTicks:        10,
					Priority:        core.ActionPriorityAuto,
					TickImmediately: true,
					OnAction: func(sim *core.Simulation) {
						aura.AddStack(sim)
					},
				})
			},
			OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
				character.AddStatsDynamic(sim, bonusPerStack.Multiply(float64(newStacks-oldStacks)))
			},
		})

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID: actionID,
			Flags:    core.SpellFlagNoOnCastComplete,
			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 2,
				},
				SharedCD: core.Cooldown{
					Timer:    character.GetOffensiveTrinketCD(),
					Duration: duration,
				},
			},
			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				jomGabbarAura.Activate(sim)
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeDPS,
		})
	})

	// Mark of the Champion (physical): +150 AP vs Undead and Demons.
	core.NewItemEffect(23206, func(agent core.Agent) {
		character := agent.GetCharacter()
		bonus := stats.Stats{stats.AttackPower: 150, stats.RangedAttackPower: 150}
		aura := core.MakePermanent(character.RegisterAura(core.Aura{
			Label:    "Mark of the Champion (Physical)",
			ActionID: core.ActionID{ItemID: 23206},
		})).
			ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					at.MobTypeBonusStats[proto.MobType_MobTypeUndead] = at.MobTypeBonusStats[proto.MobType_MobTypeUndead].Add(bonus)
					at.MobTypeBonusStats[proto.MobType_MobTypeDemon] = at.MobTypeBonusStats[proto.MobType_MobTypeDemon].Add(bonus)
				}
			}).
			ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					at.MobTypeBonusStats[proto.MobType_MobTypeUndead] = at.MobTypeBonusStats[proto.MobType_MobTypeUndead].Subtract(bonus)
					at.MobTypeBonusStats[proto.MobType_MobTypeDemon] = at.MobTypeBonusStats[proto.MobType_MobTypeDemon].Subtract(bonus)
				}
			})
		character.ItemSwap.RegisterProc(23206, aura)
	})

	// Mark of the Champion (spell): +85 spell damage vs Undead and Demons.
	core.NewItemEffect(23207, func(agent core.Agent) {
		character := agent.GetCharacter()
		bonus := stats.Stats{stats.SpellDamage: 85}
		aura := core.MakePermanent(character.RegisterAura(core.Aura{
			Label:    "Mark of the Champion (Spell)",
			ActionID: core.ActionID{ItemID: 23207},
		})).
			ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					at.MobTypeBonusStats[proto.MobType_MobTypeUndead] = at.MobTypeBonusStats[proto.MobType_MobTypeUndead].Add(bonus)
					at.MobTypeBonusStats[proto.MobType_MobTypeDemon] = at.MobTypeBonusStats[proto.MobType_MobTypeDemon].Add(bonus)
				}
			}).
			ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					at.MobTypeBonusStats[proto.MobType_MobTypeUndead] = at.MobTypeBonusStats[proto.MobType_MobTypeUndead].Subtract(bonus)
					at.MobTypeBonusStats[proto.MobType_MobTypeDemon] = at.MobTypeBonusStats[proto.MobType_MobTypeDemon].Subtract(bonus)
				}
			})
		character.ItemSwap.RegisterProc(23207, aura)
	})
}
