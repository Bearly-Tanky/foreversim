package hunter

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

var ItemSetCryptstalkerArmor = core.NewItemSet(core.ItemSet{
	Name: "Cryptstalker Armor",
	ID:   530,
	Bonuses: map[int32]core.ApplySetBonus{
		// (2) Set: Increases the duration of your Rapid Fire by 4 secs.
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_BuffDuration_Flat,
				ClassMask: HunterSpellRapidFire,
				TimeValue: time.Second * 4,
			}).ExposeToAPL(28755)
		},
		// (4) Set: While your pet is active, increases Attack Power by 50 for both you and your pet.
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			hunter := agent.(HunterAgent).GetHunter()
			if hunter.Pet == nil {
				return
			}

			apBuff := stats.Stats{
				stats.AttackPower:       50,
				stats.RangedAttackPower: 50,
			}
			ownerAura := hunter.RegisterAura(core.Aura{
				Label:      "Stalker's Ally",
				ActionID:   core.ActionID{SpellID: 28757},
				Duration:   core.NeverExpires,
				BuildPhase: setBonusAura.BuildPhase,
			}).AttachStatsBuff(
				apBuff,
			)

			petAura := hunter.Pet.RegisterAura(core.Aura{
				Label:      "Stalker's Ally",
				ActionID:   core.ActionID{SpellID: 28758},
				Duration:   core.NeverExpires,
				BuildPhase: setBonusAura.BuildPhase,
			}).AttachStatsBuff(
				apBuff,
			)

			if setBonusAura.BuildPhase == core.CharacterBuildPhaseGear {
				core.MakePermanent(ownerAura)
				core.MakePermanent(petAura)
			} else {
				setBonusAura.AttachDependentAura(ownerAura).AttachDependentAura(petAura)
			}

			setBonusAura.ExposeToAPL(28756)
		},
		// (6) Set: Your ranged critical hits cause an Adrenaline Rush, granting you 50 mana.
		6: func(agent core.Agent, setBonusAura *core.Aura) {
			hunter := agent.(HunterAgent).GetHunter()
			manaMetrics := hunter.NewManaMetrics(core.ActionID{SpellID: 28753})

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:            "Adrenaline Rush",
				MetricsActionID: core.ActionID{SpellID: 28752},
				Callback:        core.CallbackOnSpellHitDealt,
				Outcome:         core.OutcomeCrit,
				ProcMask:        core.ProcMaskRanged,

				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					hunter.AddMana(sim, 50, manaMetrics)
				},
			}).ExposeToAPL(28752)
		},
		// (8) Set: Reduces the mana cost of your Multi-Shot and Aimed Shot by 20.
		8: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_PowerCost_Flat,
				ClassMask: HunterSpellMultiShot | HunterSpellAimedShot,
				IntValue:  -20,
			}).ExposeToAPL(28751)
		},
	},
})

// The bows and the mail shoulders below can be equipped by other classes, whose agents are not
// HunterAgents. Their hunter-specific effects simply do not apply to them.
func hunterFromAgent(agent core.Agent) (*Hunter, bool) {
	hunterAgent, ok := agent.(HunterAgent)
	if !ok {
		return nil, false
	}
	return hunterAgent.GetHunter(), true
}

func init() {
	// Thori'dal, the Star's Fury
	core.NewItemEffect(ThoridalTheStarsFuryItemID, func(agent core.Agent) {
		hunter, ok := hunterFromAgent(agent)
		if !ok {
			return
		}

		isEquipped := hunter.HasItemEquipped(ThoridalTheStarsFuryItemID, []proto.ItemSlot{proto.ItemSlot_ItemSlotRanged})
		buildPhase := core.Ternary(isEquipped, core.CharacterBuildPhaseGear, core.CharacterBuildPhaseNone)

		hasteAura := hunter.RegisterAura(core.Aura{
			Label:      "Legendary Bow Haste",
			ActionID:   core.ActionID{SpellID: 44972},
			Duration:   core.NeverExpires,
			BuildPhase: buildPhase,

			// Tried to do this with ExclusiveEffects but damn that was wonky and didn't work right...
			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				if hunter.quiverBonusAura != nil {
					hunter.quiverBonusAura.Deactivate(sim)
				}
			},
			OnExpire: func(aura *core.Aura, sim *core.Simulation) {
				if hunter.quiverBonusAura != nil && sim.CurrentTime > 0 {
					hunter.quiverBonusAura.Activate(sim)
				}
			},
		}).AttachMultiplicativePseudoStatBuff(
			&hunter.PseudoStats.RangedSpeedMultiplier,
			quiverHasteMultipliers[proto.HunterOptions_Speed15],
		)

		ammoAura := hunter.RegisterAura(core.Aura{
			Label:    "Requires No Ammo",
			ActionID: core.ActionID{SpellID: 46699},
			Duration: core.NeverExpires,

			OnGain: func(aura *core.Aura, sim *core.Simulation) {
				hunter.AmmoDamageBonus = 0
			},
		})

		if isEquipped {
			core.MakePermanent(hasteAura)
			core.MakePermanent(ammoAura)
		}

		hunter.RegisterItemSwapCallback([]proto.ItemSlot{proto.ItemSlot_ItemSlotRanged}, func(sim *core.Simulation, _ proto.ItemSlot) {
			if ranged := hunter.AutoAttacks.Ranged(); ranged != nil &&
				!hunter.HasItemEquipped(ThoridalTheStarsFuryItemID, []proto.ItemSlot{proto.ItemSlot_ItemSlotRanged}) {
				hunter.AmmoDamageBonus = hunter.AmmoDPS * ranged.SwingSpeed
				ranged.BaseDamageMin += hunter.AmmoDamageBonus
				ranged.BaseDamageMax += hunter.AmmoDamageBonus
			}
		})

		hunter.ItemSwap.RegisterProc(ThoridalTheStarsFuryItemID, hasteAura)
		hunter.ItemSwap.RegisterProc(ThoridalTheStarsFuryItemID, ammoAura)
	})

	// Black Bow of the Betrayer
	const BlackBowOfTheBetrayerItemID = 32336
	core.NewItemEffect(BlackBowOfTheBetrayerItemID, func(agent core.Agent) {
		hunter, ok := hunterFromAgent(agent)
		if !ok {
			return
		}

		manaMetrics := hunter.NewManaMetrics(core.ActionID{SpellID: 29471})

		procAura := hunter.MakeProcTriggerAura(core.ProcTrigger{
			Name:              "Black Bow of the Betrayer",
			MetricsActionID:   core.ActionID{ItemID: 46939},
			SpellFlagsExclude: core.SpellFlagSuppressWeaponProcs,
			Callback:          core.CallbackOnSpellHitDealt,
			Outcome:           core.OutcomeLanded,
			ProcMask:          core.ProcMaskRanged,

			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				hunter.AddMana(sim, 8, manaMetrics)
			},
		})

		hunter.ItemSwap.RegisterProc(BlackBowOfTheBetrayerItemID, procAura)
	})

	// Ashtongue Talisman of Swiftness
	const AshtongueTalismanOfSwiftnessItemID = 32487
	core.NewItemEffect(AshtongueTalismanOfSwiftnessItemID, func(agent core.Agent) {
		hunter := agent.(HunterAgent).GetHunter()
		eligibleSlots := hunter.ItemSwap.EligibleSlotsForItem(AshtongueTalismanOfSwiftnessItemID)

		statsAura := hunter.NewTemporaryStatsAura(
			"Deadly Aim",
			core.ActionID{SpellID: 40487},
			stats.Stats{
				stats.AttackPower:       275,
				stats.RangedAttackPower: 275,
			},
			time.Second*8,
		)

		procAura := hunter.MakeProcTriggerAura(core.ProcTrigger{
			Name:            "Ashtongue Talisman of Swiftness",
			MetricsActionID: core.ActionID{SpellID: 40485},
			Callback:        core.CallbackOnSpellHitDealt,
			ClassSpellMask:  HunterSpellSteadyShot,
			Outcome:         core.OutcomeLanded,
			ProcChance:      0.15,

			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				statsAura.Activate(sim)
			},
		})

		hunter.AddStatProcBuff(AshtongueTalismanOfSwiftnessItemID, statsAura, false, eligibleSlots)
		hunter.ItemSwap.RegisterProcWithSlots(AshtongueTalismanOfSwiftnessItemID, procAura, eligibleSlots)
	})

	// Talon of Al'ar
	const TalonOfAlarItemID = 30448
	core.NewItemEffect(TalonOfAlarItemID, func(agent core.Agent) {
		hunter := agent.(HunterAgent).GetHunter()

		hunter.TalonOfAlarAura = hunter.RegisterAura(core.Aura{
			Label:    "Shot Power",
			ActionID: core.ActionID{SpellID: 37508},
			Duration: time.Second*6 + 1,
		})

		procAura := hunter.MakeProcTriggerAura(core.ProcTrigger{
			Name:            "Improved Shots",
			MetricsActionID: core.ActionID{SpellID: 37507},
			Callback:        core.CallbackOnSpellHitDealt,
			ClassSpellMask:  HunterSpellArcaneShot,
			Outcome:         core.OutcomeLanded,

			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				hunter.TalonOfAlarAura.Activate(sim)
			},
		})

		hunter.ItemSwap.RegisterProc(TalonOfAlarItemID, procAura)
	})

	for _, itemID := range pvpGloveItemIDs {
		core.NewItemEffect(itemID, func(_ core.Agent) {})
	}
}

func (hunter *Hunter) talonOfAlarBonus() float64 {
	if hunter.TalonOfAlarAura.IsActive() {
		return 40
	}
	return 0
}

var pvpGloveItemIDs = []int32{23279, 22862, 16463, 16571}

func (hunter *Hunter) addPvpGloves() {
	hunter.RegisterPvPGloveMod(
		pvpGloveItemIDs,
		core.SpellModConfig{
			Kind:       core.SpellMod_DamageDone_Flat,
			ClassMask:  HunterSpellMultiShot,
			FloatValue: 0.05,
		})
}

// Classic tier and PvP sets, ported from our master sim. Bonuses master does not model (Mend Pet,
// Concussive Shot cooldown, Beast Unleashed) are left out here too.

// Nature's Ally: pet stamina and all resistances.
func attachNaturesAlly(agent core.Agent, setBonusAura *core.Aura, spellID int32, stamina float64, resistance float64) {
	hunter, ok := hunterFromAgent(agent)
	if !ok || hunter.Pet == nil {
		return
	}
	petAura := hunter.Pet.RegisterAura(core.Aura{
		Label:      "Nature's Ally",
		ActionID:   core.ActionID{SpellID: spellID},
		Duration:   core.NeverExpires,
		BuildPhase: setBonusAura.BuildPhase,
	}).AttachStatsBuff(stats.Stats{
		stats.Stamina:          stamina,
		stats.ArcaneResistance: resistance,
		stats.FireResistance:   resistance,
		stats.FrostResistance:  resistance,
		stats.NatureResistance: resistance,
		stats.ShadowResistance: resistance,
	})
	if setBonusAura.BuildPhase == core.CharacterBuildPhaseGear {
		core.MakePermanent(petAura)
	} else {
		setBonusAura.AttachDependentAura(petAura)
	}
}

var ItemSetGiantstalkerArmor = core.NewItemSet(core.ItemSet{
	Name: "Giantstalker Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		// (5) Set: Increases your pet's stamina by 30 and all spell resistances by 40.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			attachNaturesAlly(agent, setBonusAura, 21926, 30, 40)
		},
		// (8) Set: Increases the damage of Multi-shot and Volley by 15%.
		8: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Flat,
				ClassMask:  HunterSpellMultiShot | HunterSpellVolley,
				FloatValue: 0.15,
			})
		},
	},
})

var ItemSetPredatorsArmor = core.NewItemSet(core.ItemSet{
	Name: "Predator's Armor",
	Bonuses: map[int32]core.ApplySetBonus{
		// (2) Set: +20 Attack Power.
		2: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{
				stats.AttackPower:       20,
				stats.RangedAttackPower: 20,
			})
		},
		// (5) Set: Increases the duration of Serpent Sting by 3 sec, one tick.
		5: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_DotNumberOfTicks_Flat,
				ClassMask: HunterSpellSerpentSting,
				IntValue:  1,
			})
		},
	},
})

// Both of the client's ids for the set carry this name, so it is matched by name. The bonuses
// follow 1669, the Forever version.
var ItemSetBeastmasterArmor = core.NewItemSet(core.ItemSet{
	Name: "Beastmaster Armor",
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
		// Restores 8 mana per 5 sec.
		3: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.MP5, 8)
		},
		// Melee and ranged autoattacks have a 5% chance of restoring 200 mana. Classic had it
		// ranged only, at 4%.
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			character := agent.GetCharacter()
			manaMetrics := character.NewManaMetrics(core.ActionID{SpellID: 450577})
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:       "Hunter Armor Energize",
				ActionID:   core.ActionID{SpellID: 450577},
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
		// +40 Attack Power.
		6: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{
				stats.AttackPower:       40,
				stats.RangedAttackPower: 40,
			})
		},
	},
})

var ItemSetStrikersGarb = core.NewItemSet(core.ItemSet{
	Name: "Striker's Garb",
	Bonuses: map[int32]core.ApplySetBonus{
		// (3) Set: Reduces the cost of your Arcane Shots by 10%.
		3: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_PowerCost_Pct_Add,
				ClassMask:  HunterSpellArcaneShot,
				FloatValue: -0.10,
			})
		},
		// (5) Set: Reduces the cooldown of your Rapid Fire ability by 2 minutes.
		5: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_Cooldown_Flat,
				ClassMask: HunterSpellRapidFire,
				TimeValue: -2 * time.Minute,
			})
		},
	},
})

// The PvP sets pair 20 Agility with 20 Stamina; the 4-piece Concussive Shot cooldown is not
// modelled.
func pvpPursuit(name string, agilityAt int32, staminaAt int32) *core.ItemSet {
	return core.NewItemSet(core.ItemSet{
		Name: name,
		Bonuses: map[int32]core.ApplySetBonus{
			agilityAt: func(_ core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Agility, 20)
			},
			staminaAt: func(_ core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Stamina, 20)
			},
		},
	})
}

var ItemSetLieutenantCommandersPursuit = pvpPursuit("Lieutenant Commander's Pursuit", 2, 6)
var ItemSetChampionsPursuit = pvpPursuit("Champion's Pursuit", 2, 6)
var ItemSetChampionsPursuance = pvpPursuit("Champion's Pursuance", 2, 6)
var ItemSetLieutenantCommandersPursuance = pvpPursuit("Lieutenant Commander's Pursuance", 2, 6)
var ItemSetWarlordsPursuit = pvpPursuit("Warlord's Pursuit", 6, 2)
var ItemSetFieldMarshalsPursuit = pvpPursuit("Field Marshal's Pursuit", 6, 2)
