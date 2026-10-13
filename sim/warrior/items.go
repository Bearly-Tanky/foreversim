package warrior

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

var ItemSetBattlegearOfMight = core.NewItemSet(core.ItemSet{
	Name: "Battlegear of Might",
	ID:   209,
	Bonuses: map[int32]core.ApplySetBonus{
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.BlockValue, 30)
		},
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			warrior := agent.(WarriorAgent).GetWarrior()
			rageMetrics := warrior.NewRageMetrics(core.ActionID{SpellID: 29478})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:               "Battlegear of Might - 5PC",
				ActionID:           core.ActionID{SpellID: 21838},
				Callback:           core.CallbackOnSpellHitTaken | core.CallbackOnPeriodicDamageTaken,
				Outcome:            core.OutcomeLanded,
				RequireDamageDealt: true,
				ProcChance:         0.2,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					warrior.AddRage(sim, 1, rageMetrics)
				},
			})
		},
		8: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskSunderArmor,
				Kind:       core.SpellMod_FlatThreatBonus_Pct,
				FloatValue: 0.15,
			})
		},
	},
})

var ItemSetBattlegearOfWrath = core.NewItemSet(core.ItemSet{
	Name: "Battlegear of Wrath",
	ID:   218,
	Bonuses: map[int32]core.ApplySetBonus{
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			// Spell 23563 states 30 attack power on Battle Shout, which battle_shout.go adds through
			// the same flag the HasBsT2 option sets. The set aura toggles it so an item swap
			// that removes the pieces takes the bonus with them.
			warrior := agent.(WarriorAgent).GetWarrior()
			fromOptions := warrior.HasBsT2
			setBonusAura.
				ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
					warrior.HasBsT2 = true
				}).
				ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
					warrior.HasBsT2 = fromOptions
				})
		},
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			warrior := agent.(WarriorAgent).GetWarrior()

			var buff *core.Aura
			buff = warrior.RegisterAura(core.Aura{
				Label:    "Warrior's Wrath",
				ActionID: core.ActionID{SpellID: 21887},
				Duration: time.Second * 10,
			}).
				AttachSpellMod(core.SpellModConfig{
					ClassMask: SpellMaskOffensiveAbilities,
					Kind:      core.SpellMod_PowerCost_Flat,
					IntValue:  -5,
				}).
				AttachProcTrigger(core.ProcTrigger{
					Name:               "Warrior's Wrath - Consume",
					ClassSpellMask:     SpellMaskOffensiveAbilities,
					Callback:           core.CallbackOnCastComplete,
					TriggerImmediately: true,
					Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
						buff.Deactivate(sim)
					},
				})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:           "Battlegear of Wrath - 5PC",
				ActionID:       core.ActionID{SpellID: 21890},
				ClassSpellMask: SpellMaskOffensiveAbilities,
				Callback:       core.CallbackOnSpellHitDealt,
				Outcome:        core.OutcomeLanded,
				ProcChance:     0.2,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					buff.Activate(sim)
				},
			})
		},
		8: func(agent core.Agent, setBonusAura *core.Aura) {
			warrior := agent.(WarriorAgent).GetWarrior()

			var parry *core.Aura
			parry = warrior.RegisterAura(core.Aura{
				Label:    "Battlegear of Wrath Parry",
				ActionID: core.ActionID{SpellID: 23547},
				Duration: core.NeverExpires,
			}).
				AttachStatBuff(stats.ParryRating, 100*core.ParryRatingPerParryPercent).
				AttachProcTrigger(core.ProcTrigger{
					Name:               "Battlegear of Wrath - 8PC Consume",
					ProcMask:           core.ProcMaskMelee,
					Callback:           core.CallbackOnSpellHitTaken,
					TriggerImmediately: true,
					Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
						parry.Deactivate(sim)
					},
				})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:       "Battlegear of Wrath - 8PC",
				ActionID:   core.ActionID{SpellID: 23548},
				Callback:   core.CallbackOnSpellHitTaken,
				Outcome:    core.OutcomeBlock,
				ProcChance: 0.04,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					parry.Activate(sim)
				},
			})
		},
	},
})

var ItemSetConquerorsBattlegear = core.NewItemSet(core.ItemSet{
	Name: "Conqueror's Battlegear",
	ID:   496,
	Bonuses: map[int32]core.ApplySetBonus{
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskShouts,
				Kind:       core.SpellMod_PowerCost_Pct_Add,
				FloatValue: -0.35,
			})
		},
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			warrior := agent.(WarriorAgent).GetWarrior()
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskThunderClap,
				Kind:       core.SpellMod_DamageDone_Flat,
				FloatValue: 0.5,
			}).AttachAdditivePseudoStatBuff(&warrior.thunderClapEffectBonus, 0.5)
		},
	},
})

var ItemSetDreadnaughtsBattlegear = core.NewItemSet(core.ItemSet{
	Name: "Dreadnaught's Battlegear",
	ID:   523,
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			// Spell 28844 states 75 Revenge damage.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskRevenge,
				Kind:       core.SpellMod_BaseDamage_Flat,
				FloatValue: 75,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			// Spell 28843 states 5% chance to hit with Taunt and Challenging Shout.
			// TODO: both spells resolve on OutcomeAlwaysHit, so the bonus changes nothing until
			// they roll against the spell hit table.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskTaunt | SpellMaskChallengingShout,
				Kind:       core.SpellMod_BonusHit_Percent,
				FloatValue: 5,
			})
		},
		6: func(agent core.Agent, setBonusAura *core.Aura) {
			// Spell 28842 states 5% chance to hit with Sunder Armor, Heroic Strike, Revenge and
			// Shield Slam.
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask:  SpellMaskSunderArmor | SpellMaskHeroicStrike | SpellMaskRevenge | SpellMaskShieldSlam,
				Kind:       core.SpellMod_BonusHit_Percent,
				FloatValue: 5,
			})
		},
		8: func(agent core.Agent, setBonusAura *core.Aura) {
			// Spell 28845 states that below 20% health, healing spells cast on you gain up to 160
			// healing (spell 28846) for 5 seconds. The modelled incoming healing of the tank sim
			// bypasses the healing bonus; heals a healer unit casts on the warrior take it.
			warrior := agent.(WarriorAgent).GetWarrior()
			const cheatDeathHealing = 160
			cheatDeath := warrior.RegisterAura(core.Aura{
				Label:    "Cheat Death",
				ActionID: core.ActionID{SpellID: 28846},
				Duration: time.Second * 5,
			}).AttachAdditivePseudoStatBuff(&warrior.PseudoStats.BonusHealingTaken, cheatDeathHealing)
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:     "Cheat Death - Trigger",
				Callback: core.CallbackOnSpellHitTaken | core.CallbackOnPeriodicDamageTaken,
				Outcome:  core.OutcomeLanded,
				ExtraCondition: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) bool {
					return warrior.CurrentHealthPercent() < 0.2
				},
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					cheatDeath.Activate(sim)
				},
			})
		},
	},
})

// The Forever client ships these sets too (ItemSet 474, 511/1778 and the four PvP sets), and our
// Forever sim models them.
var ItemSetVindicatorsBattlegear = core.NewItemSet(core.ItemSet{
	Name: "Vindicator's Battlegear",
	ID:   474,
	Bonuses: map[int32]core.ApplySetBonus{
		// Increases your chance to block attacks with a shield by 2%.
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.BlockPercent, 2)
		},
		// Decreases the cooldown of Intimidating Shout by 15 sec.
		3: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask: SpellMaskIntimidatingShout,
				Kind:      core.SpellMod_Cooldown_Flat,
				TimeValue: -15 * time.Second,
			})
		},
		// Decreases the rage cost of Whirlwind by 3.
		5: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				ClassMask: SpellMaskWhirlwind,
				Kind:      core.SpellMod_PowerCost_Flat,
				IntValue:  -3,
			})
		},
	},
})

// Both of the client's ids for the set carry this name, so it is matched by name.
var ItemSetBattlegearOfHeroism = core.NewItemSet(core.ItemSet{
	Name: "Battlegear of Heroism",
	Bonuses: map[int32]core.ApplySetBonus{
		// +8 All Resistances.
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{
				stats.ArcaneResistance: 8,
				stats.FireResistance:   8,
				stats.FrostResistance:  8,
				stats.NatureResistance: 8,
				stats.ShadowResistance: 8,
			})
		},
		// Vitality: 15 health every 5 sec, which a boss fight never lets tick usefully.
		// Chance on melee attack to heal you for 88 to 132, and in Forever to return 10 Rage.
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			healthMetrics := character.NewHealthMetrics(core.ActionID{SpellID: 450589})
			rageMetrics := character.NewRageMetrics(core.ActionID{SpellID: 450589})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:     "Warrior's Resolve",
				ActionID: core.ActionID{SpellID: 450587},
				Callback: core.CallbackOnSpellHitDealt,
				Outcome:  core.OutcomeLanded,
				ProcMask: core.ProcMaskMelee,
				DPM:      character.NewLegacyPPMManager(1, core.ProcMaskMelee),
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					character.GainHealth(sim, sim.Roll(88, 133), healthMetrics)
					if character.HasRageBar() {
						character.AddRage(sim, 10, rageMetrics)
					}
				},
			})
		},
		// Moment of Valor breaks a Disarm when struck, which the sim does not model.
		// +20 Strength, where Classic gave +40 attack power.
		6: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.Strength, 20)
		},
	},
})

// The four PvP sets share one set of bonuses, in two orders.
func pvpBattlegear(name string, attackPowerAt int32, staminaAt int32) *core.ItemSet {
	return core.NewItemSet(core.ItemSet{
		Name: name,
		Bonuses: map[int32]core.ApplySetBonus{
			attackPowerAt: func(_ core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatsBuff(stats.Stats{
					stats.AttackPower:       40,
					stats.RangedAttackPower: 40,
				})
			},
			// Reduces the cooldown of your Intercept ability by 5 sec.
			4: func(_ core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachSpellMod(core.SpellModConfig{
					ClassMask: SpellMaskIntercept,
					Kind:      core.SpellMod_Cooldown_Flat,
					TimeValue: -5 * time.Second,
				})
			},
			staminaAt: func(_ core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Stamina, 20)
			},
		},
	})
}

var ItemSetChampionsBattlegear = pvpBattlegear("Champion's Battlegear", 2, 6)
var ItemSetLieutenantCommandersBattlegear = pvpBattlegear("Lieutenant Commander's Battlegear", 2, 6)
var ItemSetWarlordsBattlegear = pvpBattlegear("Warlord's Battlegear", 6, 2)
var ItemSetFieldMarshalsBattlegear = pvpBattlegear("Field Marshal's Battlegear", 6, 2)
var ItemSetChampionsBattlearmor = pvpBattlegear("Champion's Battlearmor", 2, 6)
var ItemSetLieutenantCommandersBattlearmor = pvpBattlegear("Lieutenant Commander's Battlearmor", 2, 6)

// Item effects our Forever sim models for the warrior, whose items the generated database carries.
func init() {
	core.AddEffectsToTest = false

	hamstringCostReduction := func(itemID int32, rage int32) {
		core.NewItemEffect(itemID, func(agent core.Agent) {
			warrior := agent.(WarriorAgent).GetWarrior()
			core.MakePermanent(warrior.RegisterAura(core.Aura{
				Label:    "Hamstring Rage Reduction",
				ActionID: core.ActionID{ItemID: itemID},
			}).AttachSpellMod(core.SpellModConfig{
				ClassMask: SpellMaskHamstring,
				Kind:      core.SpellMod_PowerCost_Flat,
				IntValue:  -rage,
			}))
		})
	}
	hamstringCostReduction(16484, 3) // Marshal's Plate Gauntlets
	hamstringCostReduction(16548, 3) // General's Plate Gauntlets
	hamstringCostReduction(19577, 2) // Rage of Mugamba
	hamstringCostReduction(16406, 3) // Knight-Lieutenant's Plate Gauntlets (22778)

	// Gri'lek's Charm of Might: 30 rage, 3 min cooldown.
	core.NewItemEffect(19951, func(agent core.Agent) {
		warrior := agent.(WarriorAgent).GetWarrior()
		actionID := core.ActionID{ItemID: 19951}
		rageMetrics := warrior.NewRageMetrics(actionID)

		spell := warrior.RegisterSpell(core.SpellConfig{
			ActionID:    actionID,
			SpellSchool: core.SpellSchoolPhysical,
			ProcMask:    core.ProcMaskEmpty,
			Flags:       core.SpellFlagNoOnCastComplete,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    warrior.NewTimer(),
					Duration: time.Minute * 3,
				},
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				warrior.AddRage(sim, 30, rageMetrics)
			},
		})

		warrior.AddMajorCooldown(core.MajorCooldown{
			Type:  core.CooldownTypeDPS,
			Spell: spell,
		})
	})

	// Diamond Flask
	// https://www.wowhead.com/forever/item=20130/diamond-flask
	//
	// Forever's flask is a 5 sec channel (363881) that heals and, if it runs to the end, grants 20
	// Strength for 60 sec (1318070); Classic's gave 75 Strength outright. 6 min cooldown, 1 min on
	// its own consumable category rather than the burst trinket one. The heal is left out.
	core.NewItemEffect(20130, func(agent core.Agent) {
		character := agent.GetCharacter()
		strengthAura := character.NewTemporaryStatsAura("Diamond Flask", core.ActionID{SpellID: 1318070}, stats.Stats{stats.Strength: 20}, time.Minute)

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID: core.ActionID{ItemID: 20130},
			ProcMask: core.ProcMaskEmpty,
			Flags:    core.SpellFlagNoOnCastComplete | core.SpellFlagChanneled | core.SpellFlagHelpful,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: time.Minute * 6,
				},
			},

			Hot: core.DotConfig{
				SelfOnly: true,
				Aura: core.Aura{
					Label: "CHUG! CHUG! CHUG! CHUG!",
				},
				NumberOfTicks: 5,
				TickLength:    time.Second,
				OnTick: func(sim *core.Simulation, _ *core.Unit, dot *core.Dot) {
					if dot.RemainingTicks() == 0 {
						strengthAura.Activate(sim)
					}
				},
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
				spell.SelfHot().Apply(sim)
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeDPS,
			ShouldActivate: func(_ *core.Simulation, _ *core.Character) bool {
				return false // Five seconds of channel belong before the pull; left to the APL.
			},
		})
	})

	core.AddEffectsToTest = true
}
