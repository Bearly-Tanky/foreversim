package forever

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
	"github.com/wowsims/forever/sim/core/stats"
)

// Classic (Forever) item sets ported from master's sim/common/item_sets. Values follow master so the
// two engines agree; master's comments on how Forever rebuilt each set are kept. Master's percent
// stats map onto forever-next's percent stats (PhysicalHitPercent etc.), which ratings feed into.

func setHitPercent(pct float64) stats.Stats {
	return stats.Stats{stats.PhysicalHitPercent: pct, stats.SpellHitPercent: pct}
}

func setCritPercent(pct float64) stats.Stats {
	return stats.Stats{stats.PhysicalCritPercent: pct, stats.SpellCritPercent: pct}
}

func setResistances(n float64) stats.Stats {
	return stats.Stats{
		stats.ArcaneResistance: n,
		stats.FireResistance:   n,
		stats.FrostResistance:  n,
		stats.NatureResistance: n,
		stats.ShadowResistance: n,
	}
}

// Master's SpellPower is damage and healing.
func setSpellPower(n float64) stats.Stats {
	return stats.Stats{stats.SpellDamage: n, stats.HealingPower: n}
}

func setAttackPower(n float64) stats.Stats {
	return stats.Stats{stats.AttackPower: n, stats.RangedAttackPower: n}
}

func setStats(s stats.Stats) core.ApplySetBonus {
	return func(_ core.Agent, setBonusAura *core.Aura) {
		setBonusAura.AttachStatsBuff(s)
	}
}

// Undescribed or unsimulated bonuses (movement, CC breaks, PvP).
func setNoop(_ core.Agent, _ *core.Aura) {}

// Increases your damage against undead by 2% (master scales damage and crit multiplier).
func setUndeadSlaying(agent core.Agent, setBonusAura *core.Aura) {
	character := agent.GetCharacter()
	setBonusAura.
		ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
			for _, at := range character.AttackTables {
				if at != nil && at.Defender.MobType == proto.MobType_MobTypeUndead {
					at.DamageDealtMultiplier *= 1.02
					at.CritMultiplier *= 1.02
				}
			}
		}).
		ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
			for _, at := range character.AttackTables {
				if at != nil && at.Defender.MobType == proto.MobType_MobTypeUndead {
					at.DamageDealtMultiplier /= 1.02
					at.CritMultiplier /= 1.02
				}
			}
		})
}

// +n melee and ranged attack power against humanoids.
func setHumanoidAttackPower(n float64) core.ApplySetBonus {
	return func(agent core.Agent, setBonusAura *core.Aura) {
		character := agent.GetCharacter()
		bonus := setAttackPower(n)
		setBonusAura.
			ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					if at != nil {
						at.MobTypeBonusStats[proto.MobType_MobTypeHumanoid] = at.MobTypeBonusStats[proto.MobType_MobTypeHumanoid].Add(bonus)
					}
				}
			}).
			ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
				for _, at := range character.AttackTables {
					if at != nil {
						at.MobTypeBonusStats[proto.MobType_MobTypeHumanoid] = at.MobTypeBonusStats[proto.MobType_MobTypeHumanoid].Subtract(bonus)
					}
				}
			})
	}
}

// A melee proc that deals min..max damage of the given school, at the trigger's client chance.
func setMeleeDamageProc(agent core.Agent, setBonusAura *core.Aura, name string, triggerID, spellID int32, school core.SpellSchool, min, max float64) {
	character := agent.GetCharacter()
	procSpell := character.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: spellID},
		SpellSchool: school,
		DefenseType: core.DefenseTypeMagic,
		ProcMask:    core.ProcMaskEmpty,
		Flags:       core.SpellFlagPassiveSpell | core.SpellFlagProc,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.CalcAndDealDamage(sim, target, sim.Roll(min, max), spell.OutcomeMagicHitAndCrit)
		},
	})

	setBonusAura.AttachProcTrigger(core.ProcTrigger{
		Name:       name,
		ActionID:   core.ActionID{SpellID: triggerID},
		Callback:   core.CallbackOnSpellHitDealt,
		Outcome:    core.OutcomeLanded,
		ProcMask:   core.ProcMaskMelee,
		ProcChance: spelldata.MustFind(triggerID).StatedChance(),
		Handler: func(sim *core.Simulation, _ *core.Spell, result *core.SpellResult) {
			procSpell.Cast(sim, result.Target)
		},
	})
}

///////////////////////////////////////////////////////////////////////////
//							Crafted
///////////////////////////////////////////////////////////////////////////

var ItemSetBlackDragonMail = core.NewItemSet(core.ItemSet{
	Name: "Black Dragon Mail",
	ID:   489,
	Bonuses: map[int32]core.ApplySetBonus{
		// Improves your chance to hit by 1%.
		2: setStats(stats.Stats{stats.PhysicalHitPercent: 1}),
		// Improves your chance to get a critical strike by 2%.
		3: setStats(stats.Stats{stats.PhysicalCritPercent: 2}),
		// +10 Fire Resistance.
		4: setStats(stats.Stats{stats.FireResistance: 10}),
	},
})

var ItemSetBlueDragonMail = core.NewItemSet(core.ItemSet{
	Name: "Blue Dragon Mail",
	ID:   491,
	Bonuses: map[int32]core.ApplySetBonus{
		// +4 All Resistances.
		2: setStats(setResistances(4)),
		// Increases damage and healing done by magical spells and effects by up to 28.
		3: setStats(setSpellPower(28)),
	},
})

var ItemSetBloodsoulEmbrace = core.NewItemSet(core.ItemSet{
	Name: "Bloodsoul Embrace",
	Bonuses: map[int32]core.ApplySetBonus{
		// Restores 12 mana per 5 sec.
		2: setStats(stats.Stats{stats.MP5: 12}),
	},
})

var ItemSetBloodvineGarb = core.NewItemSet(core.ItemSet{
	Name:               "Bloodvine Garb",
	RequiredProfession: proto.Profession_Tailoring,
	Bonuses: map[int32]core.ApplySetBonus{
		// Improves your chance to get a critical strike with spells by 2%.
		3: setStats(stats.Stats{stats.SpellCritPercent: 2}),
	},
})

var ItemSetBloodTigerHarness = core.NewItemSet(core.ItemSet{
	Name: "Blood Tiger Harness",
	Bonuses: map[int32]core.ApplySetBonus{
		// Improves your chance to get a critical strike by 1%, and with spells by 1%.
		2: setStats(setCritPercent(1)),
	},
})

var ItemSetDevilsaurArmor = core.NewItemSet(core.ItemSet{
	Name: "Devilsaur Armor",
	ID:   143,
	Bonuses: map[int32]core.ApplySetBonus{
		// Improves your chance to hit by 2%. Forever's 460230 adds the spell half (aura 55).
		2: setStats(setHitPercent(2)),
	},
})

var ItemSetGreenDragonMail = core.NewItemSet(core.ItemSet{
	Name: "Green Dragon Mail",
	ID:   490,
	Bonuses: map[int32]core.ApplySetBonus{
		// Restores 3 mana per 5 sec.
		2: setStats(stats.Stats{stats.MP5: 3}),
		// Allows 15% of your Mana regeneration to continue while casting.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			setBonusAura.
				ApplyOnGain(func(_ *core.Aura, _ *core.Simulation) {
					character.PseudoStats.SpiritRegenRateCasting += 0.15
					character.UpdateManaRegenRates()
				}).
				ApplyOnExpire(func(_ *core.Aura, _ *core.Simulation) {
					character.PseudoStats.SpiritRegenRateCasting -= 0.15
					character.UpdateManaRegenRates()
				})
		},
	},
})

var ItemSetIronfeatherArmor = core.NewItemSet(core.ItemSet{
	Name: "Ironfeather Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increases damage and healing done by magical spells and effects by up to 20.
		2: setStats(setSpellPower(20)),
	},
})

var ItemSetStormshroudArmor = core.NewItemSet(core.ItemSet{
	Name: "Stormshroud Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		// 10% chance of dealing 15 to 25 Nature damage on a successful melee attack (client 18979; Era 5%).
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setMeleeDamageProc(agent, setBonusAura, "Lightning", 18979, 18980, core.SpellSchoolNature, 15, 25)
		},
		// 4% chance on melee attack of restoring 30 energy (client 23863; Era 2%).
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			if !character.HasEnergyBar() {
				return
			}
			metrics := character.NewEnergyMetrics(core.ActionID{SpellID: 23864})
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:       "Revitalize",
				ActionID:   core.ActionID{SpellID: 23863},
				Callback:   core.CallbackOnSpellHitDealt,
				Outcome:    core.OutcomeLanded,
				ProcMask:   core.ProcMaskMelee,
				ProcChance: spelldata.MustFind(23863).StatedChance(),
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					character.AddEnergy(sim, 30, metrics)
				},
			})
		},
		// +14 Attack Power.
		4: setStats(setAttackPower(14)),
	},
})

var ItemSetTheDarksoul = core.NewItemSet(core.ItemSet{
	Name: "The Darksoul",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increased Defense +20.
		2: setStats(stats.Stats{stats.DefenseRating: 20 * core.DefenseRatingPerDefenseLevel}),
	},
})

var ItemSetVolcanicArmor = core.NewItemSet(core.ItemSet{
	Name: "Volcanic Armor",
	ID:   141,
	Bonuses: map[int32]core.ApplySetBonus{
		// Beta client 1.60.1 (spell 9057): 30 to 50 Fire damage, doubled from Era's 15 to 25. The chance
		// doubled too: 9233's column is 10 (Era 5), though the description still says 5%.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			setMeleeDamageProc(agent, setBonusAura, "Firebolt Trigger (Volcanic Armor)", 9233, 9057, core.SpellSchoolFire, 30, 50)
		},
	},
})

///////////////////////////////////////////////////////////////////////////
//							PvP
///////////////////////////////////////////////////////////////////////////

var ItemSetTheHighlandersFortitude = core.NewItemSet(core.ItemSet{
	Name: "The Highlander's Fortitude",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increase Stamina +5
		2: setStats(stats.Stats{stats.Stamina: 5}),
		// +1% Crit with Spells.
		3: setStats(stats.Stats{stats.SpellCritPercent: 1}),
	},
})

///////////////////////////////////////////////////////////////////////////
//							Dungeon Set 1
///////////////////////////////////////////////////////////////////////////

// Forever rebuilt dungeon set 1. Classic's 2/4/6/8 became 2/3/4/5/6, so the whole set pays out at
// six pieces instead of eight, and every 4 piece is now a PvP break the sim has no use for. Read
// from beta client 1.60.1.69893 (ItemSetSpell), Era 1.15.9.69722 for what it replaced.
//
//	2  Increased All Resist 08 (18679), every set, where Classic gave +200 armor
//	3  a stat block: 9336 +30 attack power, 9346 +18 spell damage and healing, 13198 +15 Strength
//	4  break a snare / root / disarm, a movement speed burst, or punish the attacker - not simulated
//	5  the proc that used to sit at 6
//	6  18378 +8 mana every 5 sec, or Vitality (21347) on the two rage/energy sets
//
// Two proc values moved with it: Crusader's Wrath and The Furious Storm are 65 spell power (were 95),
// and Rogue Armor Energize gives 20 energy (was 35).

var dungeonResistBonus = setStats(setResistances(8))
var dungeonManaPerFive = setStats(stats.Stats{stats.MP5: 8})

// Vitality (21347), 15 health every 5 sec: the sim has no health regen stat and a boss fight never
// idles, so it is left unmodelled.
var dungeonVitality = setNoop

// suddenInsight is the 5 piece shared by Magister's Regalia and Vestments of the Devout: a
// spellcast has a 5% chance to restore 200 mana.
func suddenInsight(spellID int32) core.ApplySetBonus {
	return func(agent core.Agent, setBonusAura *core.Aura) {
		character := agent.GetCharacter()
		actionID := core.ActionID{SpellID: spellID}
		manaMetrics := character.NewManaMetrics(actionID)
		setBonusAura.AttachProcTrigger(core.ProcTrigger{
			ActionID:   actionID,
			Name:       "Sudden Insight",
			Callback:   core.CallbackOnCastComplete,
			ProcMask:   core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
			ProcChance: 0.05,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				if character.HasManaBar() {
					character.AddMana(sim, 200, manaMetrics)
				}
			},
		})
	}
}

// A proc granting a temporary stat buff (master's SpellPower -> damage and healing).
func setStatProc(agent core.Agent, setBonusAura *core.Aura, config core.ProcTrigger, auraLabel string, auraID int32, s stats.Stats, duration time.Duration) {
	procAura := agent.GetCharacter().NewTemporaryStatsAura(auraLabel, core.ActionID{SpellID: auraID}, s, duration)
	config.Handler = func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
		procAura.Activate(sim)
	}
	setBonusAura.AttachProcTrigger(config)
}

var ItemSetWildheartRaiment = core.NewItemSet(core.ItemSet{
	Name: "Wildheart Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +30 Attack Power, and +18 damage and healing done by magical spells and effects.
		3: setStats(setAttackPower(30).Add(setSpellPower(18))),
		// Wild Heart: a movement speed burst when struck.
		4: setNoop,
		// Nature's Bounty, moved down from 6 pieces: a spellcast returns 200 mana, a melee attack
		// 4 energy a second for 5 sec, and being struck 10 rage. The client stores no proc chance,
		// so Classic's 2% is kept.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			actionID := core.ActionID{SpellID: 450608}
			manaMetrics := character.NewManaMetrics(actionID)
			energyMetrics := character.NewEnergyMetrics(actionID)
			rageMetrics := character.NewRageMetrics(actionID)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Nature's Bounty",
				Callback:   core.CallbackOnSpellHitTaken,
				ProcMask:   core.ProcMaskMelee,
				ProcChance: 0.02,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if character.HasManaBar() {
						character.AddMana(sim, 200, manaMetrics)
					}
					if character.HasEnergyBar() {
						character.AddEnergy(sim, 20, energyMetrics)
					}
					if character.HasRageBar() {
						character.AddRage(sim, 10, rageMetrics)
					}
				},
			})
		},
		6: dungeonManaPerFive,
	},
})

var ItemSetBeaststalkerArmor = core.NewItemSet(core.ItemSet{
	Name: "Beaststalker Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +30 Attack Power.
		3: setStats(setAttackPower(30)),
		// Beast Unleashed: breaks a Root when struck.
		4: setNoop,
		// Melee and ranged autoattacks have a 5% chance to restore 200 mana. Classic had this at
		// 6 pieces, 4%, and ranged only.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			actionID := core.ActionID{SpellID: 450577}
			manaMetrics := character.NewManaMetrics(actionID)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Hunter Armor Energize",
				Callback:   core.CallbackOnSpellHitDealt,
				Outcome:    core.OutcomeLanded,
				ProcMask:   core.ProcMaskWhiteHit,
				ProcChance: 0.05,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if character.HasManaBar() {
						character.AddMana(sim, 200, manaMetrics)
					}
				},
			})
		},
		6: dungeonManaPerFive,
	},
})

var ItemSetMagistersRegalia = core.NewItemSet(core.ItemSet{
	Name: "Magister's Regalia",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +18 damage and healing done by magical spells and effects.
		3: setStats(setSpellPower(18)),
		// Freeze: roots the attacker when struck.
		4: setNoop,
		// Spellcasts have a 5% chance to restore 200 mana.
		5: suddenInsight(450527),
		6: dungeonManaPerFive,
	},
})

var ItemSetLightforgeArmor = core.NewItemSet(core.ItemSet{
	Name: "Lightforge Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +18 damage and healing done by magical spells and effects.
		3: setStats(setSpellPower(18)),
		// Rebuke: silences a caster that lands a harmful spell on you.
		4: setNoop,
		// Crusader's Wrath, moved down from 6 pieces and cut from 95 to 65 spell power.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			setStatProc(agent, setBonusAura, core.ProcTrigger{
				ActionID: core.ActionID{SpellID: 450625},
				Name:     "Item - Crusader's Wrath Proc - Lightforge Armor",
				Callback: core.CallbackOnSpellHitDealt,
				Outcome:  core.OutcomeLanded,
				ProcMask: core.ProcMaskMeleeWhiteHit,
				// The client stores no chance for it; 3 PPM is what the sim already used.
				DPM: agent.GetCharacter().NewLegacyPPMManager(3, core.ProcMaskMeleeWhiteHit),
			}, "Crusader's Wrath", 27499, setSpellPower(65), time.Second*10)
		},
		6: dungeonManaPerFive,
	},
})

var ItemSetVestmentsOfTheDevout = core.NewItemSet(core.ItemSet{
	Name: "Vestments of the Devout",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +18 damage and healing done by magical spells and effects.
		3: setStats(setSpellPower(18)),
		// Divine Protection: a damage absorb when struck.
		4: setNoop,
		// Spellcasts have a 5% chance to restore 200 mana.
		5: suddenInsight(450576),
		6: dungeonManaPerFive,
	},
})

var ItemSetShadowcraftArmor = core.NewItemSet(core.ItemSet{
	Name: "Shadowcraft Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +30 Attack Power.
		3: setStats(setAttackPower(30)),
		// Crafted Shadows: breaks a Snare when struck.
		4: setNoop,
		// Chance on melee attack to restore energy, moved down from 6 pieces and cut 35 -> 20.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			actionID := core.ActionID{SpellID: 27787}
			energyMetrics := character.NewEnergyMetrics(actionID)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID: actionID,
				Name:     "Rogue Armor Energize",
				Callback: core.CallbackOnSpellHitDealt,
				Outcome:  core.OutcomeLanded,
				ProcMask: core.ProcMaskMeleeWhiteHit,
				DPM:      character.NewLegacyPPMManager(1, core.ProcMaskMeleeWhiteHit),
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if character.HasEnergyBar() {
						character.AddEnergy(sim, 20, energyMetrics)
					}
				},
			})
		},
		6: dungeonVitality,
	},
})

var ItemSetTheElements = core.NewItemSet(core.ItemSet{
	Name: "The Elements",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +18 damage and healing done by magical spells and effects.
		3: setStats(setSpellPower(18)),
		// Electrocute: disarms an attacker.
		4: setNoop,
		// The Furious Storm, moved down from 6 pieces and cut from 95 to 65 spell power.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			setStatProc(agent, setBonusAura, core.ProcTrigger{
				ActionID:   core.ActionID{SpellID: 450626},
				Name:       "Item - The Furious Storm Proc",
				Callback:   core.CallbackOnCastComplete,
				ProcMask:   core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
				ProcChance: 0.04, // No chance in the client; Classic's 4% is kept.
			}, "The Furious Storm", 27775, setSpellPower(65), time.Second*10)
		},
		6: dungeonManaPerFive,
	},
})

var ItemSetDreadmistRaiment = core.NewItemSet(core.ItemSet{
	Name: "Dreadmist Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +18 damage and healing done by magical spells and effects.
		3: setStats(setSpellPower(18)),
		// Corrupted Fear: the attacker flees when you are struck.
		4: setNoop,
		// Spellcasts have a 5% chance to heal you for 270 to 330.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			actionID := core.ActionID{SpellID: 450585}
			healthMetrics := character.NewHealthMetrics(actionID)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Dark Reward",
				Callback:   core.CallbackOnCastComplete,
				ProcMask:   core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
				ProcChance: 0.05,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					character.GainHealth(sim, sim.Roll(270, 331), healthMetrics)
				},
			})
		},
		6: dungeonManaPerFive,
	},
})

var ItemSetBattlegearOfValor = core.NewItemSet(core.ItemSet{
	Name: "Battlegear of Valor",
	Bonuses: map[int32]core.ApplySetBonus{
		2: dungeonResistBonus,
		// +15 Strength.
		3: setStats(stats.Stats{stats.Strength: 15}),
		// Moment of Valor: breaks a Disarm when struck.
		4: setNoop,
		// Warrior's Resolve, moved down from 6 pieces: it now returns 10 Rage with the heal.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			healthMetrics := character.NewHealthMetrics(core.ActionID{SpellID: 450589})
			rageMetrics := character.NewRageMetrics(core.ActionID{SpellID: 450589})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID: core.ActionID{SpellID: 450587},
				Name:     "Warrior's Resolve",
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
		6: dungeonVitality,
	},
})

///////////////////////////////////////////////////////////////////////////
//							PvE
///////////////////////////////////////////////////////////////////////////

// The Scholomance and Stratholme sets were rebuilt by Forever the same way the dungeon sets were,
// read from ItemSetSpell in beta client 1.60.1.69893. Their 3 piece is now a proc whose chance the
// client does not store (SpellAuraOptions holds 100, which means unset), so those are described and
// left unapplied rather than given an invented rate.

var ItemSetNecropileRaiment = core.NewItemSet(core.ItemSet{
	Name: "Necropile Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		// Improves your chance to hit by 0.5% (1299734, 5 rating).
		2: setStats(setHitPercent(0.5)),
		// Necrophile Drain (1299737): no proc chance in the client, left out rather than guessed.
		3: setNoop,
		// +5 All Resistances (18676, was 15).
		4: setStats(setResistances(5)),
		// Increases damage and healing done by magical spells and effects by up to 23.
		5: setStats(setSpellPower(23)),
	},
})

var ItemSetIronweaveBattlesuit = core.NewItemSet(core.ItemSet{
	Name: "Ironweave Battlesuit",
	Bonuses: map[int32]core.ApplySetBonus{
		// +200 Armor, moved down from eight pieces.
		2: setStats(stats.Stats{stats.Armor: 200}),
		// Decreases the magical resistances of your spell targets by 5.
		3: setStats(stats.Stats{stats.SpellPiercing: 5}),
		// Increases your chance to resist Silence and Interrupt effects by 10%.
		4: setNoop,
		// Increases damage and healing done by magical spells and effects by up to 23.
		5: setStats(setSpellPower(23)),
		// Reduces damage taken while Stunned by 15%; a raid boss encounter never stuns.
		6: setNoop,
	},
})

var ItemSetThePostmaster = core.NewItemSet(core.ItemSet{
	Name: "The Postmaster",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increases run speed by 8%.
		2: setNoop,
		// Increases damage and healing done by magical spells and effects by up to 23, where
		// Classic gave 12 at four pieces.
		3: setStats(setSpellPower(23)),
		// Return to Sender: reflects the next spell cast on you after dropping below 25% health.
		4: setNoop,
		// Improves your chance to hit by 1% (432639).
		5: setStats(setHitPercent(1)),
	},
})

var ItemSetCadaverousGarb = core.NewItemSet(core.ItemSet{
	Name: "Cadaverous Garb",
	Bonuses: map[int32]core.ApplySetBonus{
		// +10 Attack Power, and movement impairing effects 10% shorter. Forever has no 2 piece.
		3: setStats(setAttackPower(10)),
		// +5 All Resistances (18676, was 15).
		4: setStats(setResistances(5)),
		// Improves your chance to hit by 2%, spells as well as melee (460230).
		5: setStats(setHitPercent(2)),
	},
})

var ItemSetBloodmailRegalia = core.NewItemSet(core.ItemSet{
	Name: "Bloodmail Regalia",
	Bonuses: map[int32]core.ApplySetBonus{
		// +10 Attack Power.
		2: setStats(setAttackPower(10)),
		// Bloodmail (1299740): no proc chance in the client, left out rather than guessed.
		3: setNoop,
		// +5 All Resistances (18676, was 15).
		4: setStats(setResistances(5)),
		// Improves your chance to crit by 1.5% (1299738, 21 rating), where Classic gave 1% parry.
		5: setStats(setCritPercent(1.5)),
	},
})

var ItemSetDeathboneGuardian = core.NewItemSet(core.ItemSet{
	Name: "Deathbone Guardian",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increased Defense +3.
		2: setStats(stats.Stats{stats.DefenseRating: 3 * core.DefenseRatingPerDefenseLevel}),
		// Deathbone Surge: 15% chance when struck to gain 70 spell damage and healing for 10 sec,
		// once a minute.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			setStatProc(agent, setBonusAura, core.ProcTrigger{
				ActionID:   core.ActionID{SpellID: 1299743},
				Name:       "Deathbone Surge",
				Callback:   core.CallbackOnSpellHitTaken,
				ProcMask:   core.ProcMaskMelee,
				ProcChance: 0.15,
				ICD:        time.Minute,
			}, "Deathbone Surge", 1299746, setSpellPower(70), time.Second*10)
		},
		// +5 All Resistances (18676, was 15).
		4: setStats(setResistances(5)),
		// Reduces the chance for your attacks to be dodged or parried by 2% (1213289).
		5: setStats(stats.Stats{stats.ExpertiseRating: 2 * core.ExpertiseRatingPerExpertisePercent}),
	},
})

var ItemSetSpidersKiss = core.NewItemSet(core.ItemSet{
	Name: "Spider's Kiss",
	Bonuses: map[int32]core.ApplySetBonus{
		// Chance on Hit: Immobilizes the target and lowers their armor by 100 for 10 sec.
		// Master applies the -100 armor to the wearer; kept so the engines agree.
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setStatProc(agent, setBonusAura, core.ProcTrigger{
				ActionID:   core.ActionID{SpellID: 17333},
				Name:       "Spider's Kiss",
				Callback:   core.CallbackOnSpellHitDealt,
				Outcome:    core.OutcomeLanded,
				ProcMask:   core.ProcMaskMelee,
				ProcChance: 0.05,
			}, "Spider's Kiss", 17333, stats.Stats{stats.Armor: -100}, time.Second*10)
		},
	},
})

var ItemSetDalRendsArms = core.NewItemSet(core.ItemSet{
	Name: "Dal'Rend's Arms",
	Bonuses: map[int32]core.ApplySetBonus{
		// +50 Attack Power.
		2: setStats(setAttackPower(50)),
	},
})

var ItemSetShardOfTheGods = core.NewItemSet(core.ItemSet{
	Name: "Shard of the Gods",
	Bonuses: map[int32]core.ApplySetBonus{
		// +10 All Resistances (master adds 15).
		2: setStats(setResistances(15)),
	},
})

var ItemSetSpiritOfEskhandar = core.NewItemSet(core.ItemSet{
	Name: "Spirit of Eskhandar",
	Bonuses: map[int32]core.ApplySetBonus{
		// +30 Attack Power against Humanoids (1298478), new in Forever.
		2: setHumanoidAttackPower(30),
		// Improves your chance to crit by 1% (1314828), new in Forever. The client doubles it at
		// night, which the sim has no clock for.
		3: setStats(setCritPercent(1)),
		// Call of Eskhandar: forever-next has no Eskhandar guardian, so the 4 piece is not simulated.
		4: setNoop,
	},
})

var ItemSetRegaliaOfUndeadCleansing = core.NewItemSet(core.ItemSet{
	Name:    "Regalia of Undead Cleansing",
	Bonuses: map[int32]core.ApplySetBonus{3: setUndeadSlaying},
})

var ItemSetUndeadSlayersArmor = core.NewItemSet(core.ItemSet{
	Name:    "Undead Slayer's Armor",
	Bonuses: map[int32]core.ApplySetBonus{3: setUndeadSlaying},
})

var ItemSetGarbOfTheUndeadSlayer = core.NewItemSet(core.ItemSet{
	Name:    "Garb of the Undead Slayer",
	Bonuses: map[int32]core.ApplySetBonus{3: setUndeadSlaying},
})

var ItemSetBattlegearOfUndeadSlaying = core.NewItemSet(core.ItemSet{
	Name:    "Battlegear of Undead Slaying",
	Bonuses: map[int32]core.ApplySetBonus{3: setUndeadSlaying},
})
