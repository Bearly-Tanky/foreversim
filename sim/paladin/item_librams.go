package paladin

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// The librams the client ships unencrypted. Item effects apply before the spells register, so a
// libram that changes a number a spell reads at registration sets it on the paladin and the spell
// picks it up; one that changes a spell's cost, cooldown or crit chance is a spell mod.
//
// Libram of Grace (22402) takes 25 mana off Cleanse, which the sim does not cast.
func init() {
	// Libram of Fervor
	// https://www.wowhead.com/forever/item=23203/libram-of-fervor
	//
	// Increases the melee attack power bonus of your Seal of the Crusader by 48 and the Holy damage
	// increase of your Judgement of the Crusader by 33.
	core.NewItemEffect(23203, func(agent core.Agent) {
		paladin := agent.(PaladinAgent).GetPaladin()
		paladin.sealOfTheCrusaderBonusAttackPower += 48
		paladin.judgementOfTheCrusaderBonus += 33
	})

	// Libram of Hope
	// https://www.wowhead.com/forever/item=22401/libram-of-hope
	//
	// Increases the duration of your Seal spells by 4 sec (27848). Classic's took 20 mana off them.
	core.NewItemEffect(22401, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask: SpellMaskAllSeals,
			Kind:      core.SpellMod_BuffDuration_Flat,
			TimeValue: time.Second * 4,
		})
	})

	// Libram of Light
	// https://www.wowhead.com/forever/item=23006/libram-of-light
	//
	// Increases healing done by Flash of Light by up to 83.
	core.NewItemEffect(23006, func(agent core.Agent) {
		agent.(PaladinAgent).GetPaladin().flashOfLightBonusHealing += 83
	})

	// Libram of Holy Alacrity
	// https://www.wowhead.com/forever/item=228175/libram-of-holy-alacrity
	//
	// Causes Holy Shock to reduce the cast time of your next Holy Light cast within 10 sec by 0.2
	// sec.
	core.NewItemEffect(228175, func(agent core.Agent) {
		paladin := agent.(PaladinAgent).GetPaladin()

		var alacrity *core.Aura
		alacrity = paladin.RegisterAura(core.Aura{
			Label:    "Holy Alacrity" + paladin.Label,
			ActionID: core.ActionID{SpellID: 449982},
			Duration: time.Second * 10,
		}).AttachSpellMod(core.SpellModConfig{
			ClassMask: SpellMaskHolyLight,
			Kind:      core.SpellMod_CastTime_Flat,
			TimeValue: -200 * time.Millisecond,
		}).AttachProcTrigger(core.ProcTrigger{
			Callback:           core.CallbackOnCastComplete,
			ClassSpellMask:     SpellMaskHolyLight,
			TriggerImmediately: true,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				alacrity.Deactivate(sim)
			},
		})

		paladin.MakeProcTriggerAura(core.ProcTrigger{
			Name:           "Libram of Holy Alacrity" + paladin.Label,
			ActionID:       core.ActionID{SpellID: 449980},
			Callback:       core.CallbackOnCastComplete,
			ClassSpellMask: SpellMaskHolyShock | SpellMaskHolyShockHeal,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				alacrity.Activate(sim)
			},
		})
	})

	// Libram of Invocation
	// https://www.wowhead.com/forever/item=249442/libram-of-invocation
	//
	// Reduces the mana cost of your Seal spells by 5%.
	core.NewItemEffect(249442, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask:  SpellMaskAllSeals,
			Kind:       core.SpellMod_PowerCost_Pct,
			FloatValue: -0.05,
		})
	})

	// Tenets of the Silver Hand
	// https://www.wowhead.com/forever/item=249397/tenets-of-the-silver-hand
	//
	// Increases your damage against Undead by 1%.
	core.NewItemEffect(249397, func(agent core.Agent) {
		character := agent.GetCharacter()
		core.MakePermanent(character.RegisterAura(core.Aura{
			Label:    "Tenets of the Silver Hand",
			ActionID: core.ActionID{SpellID: 1302545},
		})).
			ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					if at.Defender.MobType == proto.MobType_MobTypeUndead {
						at.DamageDealtMultiplier *= 1.01
					}
				}
			}).
			ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					if at.Defender.MobType == proto.MobType_MobTypeUndead {
						at.DamageDealtMultiplier /= 1.01
					}
				}
			})
	})

	// Sentinel's Libram
	// https://www.wowhead.com/forever/item=272434/sentinels-libram
	//
	// Reduces the cooldown of your Swift Judgement talent by 10 sec.
	core.NewItemEffect(272434, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask: SpellMaskSwiftJudgement,
			Kind:      core.SpellMod_Cooldown_Flat,
			TimeValue: -time.Second * 10,
		})
	})

	// Libram of Law
	// https://www.wowhead.com/forever/item=272435/libram-of-law
	//
	// Increases the damage of your Judgement ability by 4%. The client's mask names Judgement of
	// Righteousness and Judgement of Fury, not Judgement of Command.
	core.NewItemEffect(272435, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask:  SpellMaskJudgementOfRighteousness | SpellMaskJudgementOfFury,
			Kind:       core.SpellMod_DamageDone_Pct,
			FloatValue: 0.04,
		})
	})

	// Libram of Economy
	// https://www.wowhead.com/forever/item=272436/libram-of-economy
	//
	// Reduces the Mana cost of your Holy Light ability by 5%.
	core.NewItemEffect(272436, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask:  SpellMaskHolyLight,
			Kind:       core.SpellMod_PowerCost_Pct,
			FloatValue: -0.05,
		})
	})

	// Steadfast Libram
	// https://www.wowhead.com/forever/item=279247/steadfast-libram
	//
	// Increases the Block Value of your shield by 30% while Holy Shield is active.
	core.NewItemEffect(279247, func(agent core.Agent) {
		agent.(PaladinAgent).GetPaladin().holyShieldBlockValueMultiplier *= 1.3
	})

	// Libram of Infusion
	// https://www.wowhead.com/forever/item=279248/libram-of-infusion
	//
	// Increases the critical strike chance of your Holy Shock spell by 6%.
	core.NewItemEffect(279248, func(agent core.Agent) {
		agent.GetCharacter().AddStaticMod(core.SpellModConfig{
			ClassMask:  SpellMaskHolyShock | SpellMaskHolyShockHeal,
			Kind:       core.SpellMod_BonusCrit_Percent,
			FloatValue: 6,
		})
	})

	// Sanctified Orb
	// https://www.wowhead.com/forever/item=20512/sanctified-orb
	//
	// Not a libram, but the paladin's. Use: Restores 340 Mana (24865), doubled in Wasteland and
	// Haunted areas, which no encounter is. 5 min cooldown. Classic's gave 3% crit for 25 sec.
	core.NewItemEffect(20512, func(agent core.Agent) {
		character := agent.GetCharacter()
		actionID := core.ActionID{ItemID: 20512}
		manaMetrics := character.NewManaMetrics(actionID)
		manaGain := 340.0

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID:    actionID,
			SpellSchool: core.SpellSchoolHoly,
			ProcMask:    core.ProcMaskEmpty,
			Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagHelpful,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 5,
				},
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				character.AddMana(sim, manaGain, manaMetrics)
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeMana,
			ShouldActivate: func(_ *core.Simulation, character *core.Character) bool {
				return character.MaxMana()-character.CurrentMana() >= manaGain
			},
		})
	})
}
