package druid

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

// The TBC sets the sim once carried (Malorne, Nordrassil, Thunderheart, Moonglade, the
// Gladiator sets and the Oathbound battlegear) are gone: none of their ids appears in the
// client's ItemSet table. The sets below are Forever's, ported from master.

var ItemSetFeralheartRaiment = core.NewItemSet(core.ItemSet{
	Name: "Feralheart Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		// +8 All Resistances.
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{
				stats.ArcaneResistance: 8,
				stats.FireResistance:   8,
				stats.FrostResistance:  8,
				stats.NatureResistance: 8,
				stats.ShadowResistance: 8,
			})
		},
		// Restores 8 mana per 5 sec.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.MP5, 8)
		},
		// Nature's Bounty: 2% chance to restore 200 mana on spell cast, 20 energy on a white hit,
		// or 10 rage when struck.
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			c := agent.GetCharacter()
			actionID := core.ActionID{SpellID: 450608}
			manaMetrics := c.NewManaMetrics(actionID)
			energyMetrics := c.NewEnergyMetrics(actionID)
			rageMetrics := c.NewRageMetrics(actionID)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Nature's Bounty (Mana)",
				Callback:   core.CallbackOnCastComplete,
				ProcMask:   core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
				ProcChance: 0.02,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if c.HasManaBar() {
						c.AddMana(sim, 200, manaMetrics)
					}
				},
			})
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Nature's Bounty (Energy)",
				Callback:   core.CallbackOnSpellHitDealt,
				Outcome:    core.OutcomeLanded,
				ProcMask:   core.ProcMaskMeleeWhiteHit,
				ProcChance: 0.02,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if c.HasEnergyBar() {
						c.AddEnergy(sim, 20, energyMetrics)
					}
				},
			})
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   actionID,
				Name:       "Nature's Bounty (Rage)",
				Callback:   core.CallbackOnSpellHitTaken,
				ProcMask:   core.ProcMaskMelee,
				ProcChance: 0.02,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					if c.HasRageBar() {
						c.AddRage(sim, 10, rageMetrics)
					}
				},
			})
		},
		// Wild Heart: a movement speed burst when struck.
		5: func(agent core.Agent, setBonusAura *core.Aura) {},
		// +23 damage and healing done by magical spells and effects, and +40 Attack Power.
		6: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{
				stats.SpellDamage:       23,
				stats.HealingPower:      23,
				stats.AttackPower:       40,
				stats.RangedAttackPower: 40,
			})
		},
	},
})

var ItemSetCenarionRaiment = core.NewItemSet(core.ItemSet{
	Name: "Cenarion Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		// Thorns damage and duration. Thorns is never cast on the druid's own boss fight.
		3: func(agent core.Agent, setBonusAura *core.Aura) {},
		// Improves your chance to get a critical strike with spells by 2%.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatBuff(stats.SpellCritRating, 2*core.SpellCritRatingPerCritPercent)
		},
		// Reduces the cooldown of Tranquility and Hurricane by 50%. Not applied on master either.
		8: func(agent core.Agent, setBonusAura *core.Aura) {},
	},
})

var ItemSetStormrageRaiment = core.NewItemSet(core.ItemSet{
	Name: "Stormrage Raiment",
	Bonuses: map[int32]core.ApplySetBonus{
		// Allows 15% of your Mana regeneration to continue while casting.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			c := agent.GetCharacter()
			setBonusAura.AttachAdditivePseudoStatBuff(&c.PseudoStats.SpiritRegenRateCasting, 0.15)
		},
		// Regrowth cast time -0.2 sec. Healing is not modelled.
		5: func(agent core.Agent, setBonusAura *core.Aura) {},
		// Rejuvenation duration +3 sec. Healing is not modelled.
		8: func(agent core.Agent, setBonusAura *core.Aura) {},
	},
})

var ItemSetSymbolsOfUnendingLife = core.NewItemSet(core.ItemSet{
	Name: "Symbols of Unending Life",
	Bonuses: map[int32]core.ApplySetBonus{
		// Your finishing moves refund 30 energy on a Miss, Dodge, Block, or Parry.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			c := agent.GetCharacter()
			energyMetrics := c.NewEnergyMetrics(core.ActionID{SpellID: 26107})
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:           "Symbols of Unending Life Finisher Bonus",
				Callback:       core.CallbackOnSpellHitDealt,
				Outcome:        core.OutcomeMiss | core.OutcomeDodge | core.OutcomeBlock | core.OutcomeParry,
				ClassSpellMask: DruidSpellFerociousBite | DruidSpellRip,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					c.AddEnergy(sim, 30, energyMetrics)
				},
			})
		},
	},
})

// PvP sets. The feral movement speed bonus has nothing to act on in the sim.

func druidRefugeSet(name string) *core.ItemSet {
	return core.NewItemSet(core.ItemSet{
		Name: name,
		Bonuses: map[int32]core.ApplySetBonus{
			// Increases healing done by up to 44 and damage done by up to 15 (467550).
			2: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatsBuff(stats.Stats{stats.HealingPower: 44, stats.SpellDamage: 15})
			},
			4: func(agent core.Agent, setBonusAura *core.Aura) {},
			6: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Stamina, 20)
			},
		},
	})
}

func druidSanctuarySet(name string) *core.ItemSet {
	return core.NewItemSet(core.ItemSet{
		Name: name,
		Bonuses: map[int32]core.ApplySetBonus{
			2: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Stamina, 20)
			},
			3: func(agent core.Agent, setBonusAura *core.Aura) {},
			6: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatsBuff(stats.Stats{stats.AttackPower: 40, stats.RangedAttackPower: 40})
			},
		},
	})
}

var ItemSetChampionsRefuge = druidRefugeSet("Champion's Refuge")
var ItemSetLieutenantCommandersRefuge = druidRefugeSet("Lieutenant Commander's Refuge")
var ItemSetFieldMarshalsSanctuary = druidSanctuarySet("Field Marshal's Sanctuary")
var ItemSetWarlordsSanctuary = druidSanctuarySet("Warlord's Sanctuary")
