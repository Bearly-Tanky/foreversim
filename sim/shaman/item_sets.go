package shaman

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

// Forever's shaman sets, ported from master.

var ItemSetTheFiveThunders = core.NewItemSet(core.ItemSet{
	Name: "The Five Thunders",
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
		// 4% chance on spell cast to increase damage and healing by up to 65 for 10 sec.
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			c := agent.GetCharacter()
			procAura := c.NewTemporaryStatsAura("The Furious Storm", core.ActionID{SpellID: 27775},
				stats.Stats{stats.SpellDamage: 65, stats.HealingPower: 65}, time.Second*10)
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				ActionID:   core.ActionID{SpellID: 450626},
				Name:       "Item - The Furious Storm Proc (Spell Cast)",
				Callback:   core.CallbackOnCastComplete,
				ProcMask:   core.ProcMaskSpellDamage | core.ProcMaskSpellHealing,
				ProcChance: 0.04,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					procAura.Activate(sim)
				},
			})
		},
		// Electrocute: disarms an attacker.
		5: func(agent core.Agent, setBonusAura *core.Aura) {},
		// +23 damage and healing done by magical spells and effects.
		6: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachStatsBuff(stats.Stats{stats.SpellDamage: 23, stats.HealingPower: 23})
		},
	},
})

// Every bonus is totem radius or healing, neither modelled (master applies none either).
var ItemSetTheEarthfury = core.NewItemSet(core.ItemSet{
	Name: "The Earthfury",
	Bonuses: map[int32]core.ApplySetBonus{
		3: func(agent core.Agent, setBonusAura *core.Aura) {},
		5: func(agent core.Agent, setBonusAura *core.Aura) {},
		8: func(agent core.Agent, setBonusAura *core.Aura) {},
	},
})

var ItemSetTheTenStorms = core.NewItemSet(core.ItemSet{
	Name: "The Ten Storms",
	Bonuses: map[int32]core.ApplySetBonus{
		// Chain Heal bounce healing. Healing is not modelled.
		3: func(agent core.Agent, setBonusAura *core.Aura) {},
		// Improves your chance to get a critical strike with Nature spells by 3%.
		5: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_BonusCrit_Percent,
				School:     core.SpellSchoolNature,
				FloatValue: 3,
			})
		},
		// Free Lightning Shield on Healing Wave targets. Healing is not modelled.
		8: func(agent core.Agent, setBonusAura *core.Aura) {},
	},
})

var ItemSetStormcallersGarb = core.NewItemSet(core.ItemSet{
	Name: "Stormcaller's Garb",
	Bonuses: map[int32]core.ApplySetBonus{
		// Lightning Bolt, Chain Lightning and Shock hits have a 20% chance to grant up to 50
		// Nature damage for 8 sec.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			c := agent.GetCharacter()
			buffAura := c.NewTemporaryStatsAura("Stormcaller's Wrath", core.ActionID{SpellID: 26121},
				stats.Stats{stats.NatureDamage: 50}, time.Second*8)
			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:             "Stormcaller Spelldamage Bonus",
				Callback:         core.CallbackOnSpellHitDealt,
				Outcome:          core.OutcomeLanded,
				ClassSpellMask:   SpellMaskLightningBolt | SpellMaskChainLightning | SpellMaskOverload | SpellMaskShock,
				CanProcFromProcs: true, // master's overloads share the Lightning Bolt / Chain Lightning spell code
				ProcChance:       0.20,
				Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
					buffAura.Activate(sim)
				},
			})
		},
		// Chain Heal cast time -0.4 sec. Healing is not modelled.
		5: func(agent core.Agent, setBonusAura *core.Aura) {},
	},
})

var ItemSetGiftOfTheGatheringStorm = core.NewItemSet(core.ItemSet{
	Name: "Gift of the Gathering Storm",
	Bonuses: map[int32]core.ApplySetBonus{
		// Increases the chain target damage multiplier of your Chain Lightning spell by 5%.
		3: func(agent core.Agent, setBonusAura *core.Aura) {
			shaman := agent.(ShamanAgent).GetShaman()
			setBonusAura.AttachAdditivePseudoStatBuff(&shaman.ChainLightningBounceBonus, 0.05)
		},
	},
})

// PvP sets: +40 Attack Power, +2% crit on Shock spells at 4 pieces, +20 Stamina.
func shamanPvPSet(name string, apAt, stamAt int32) *core.ItemSet {
	return core.NewItemSet(core.ItemSet{
		Name: name,
		Bonuses: map[int32]core.ApplySetBonus{
			apAt: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatsBuff(stats.Stats{stats.AttackPower: 40, stats.RangedAttackPower: 40})
			},
			4: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachSpellMod(core.SpellModConfig{
					Kind:       core.SpellMod_BonusCrit_Percent,
					ClassMask:  SpellMaskShock,
					FloatValue: 2,
				})
			},
			stamAt: func(agent core.Agent, setBonusAura *core.Aura) {
				setBonusAura.AttachStatBuff(stats.Stamina, 20)
			},
		},
	})
}

var ItemSetChampionsEarthshaker = shamanPvPSet("Champion's Earthshaker", 2, 6)
var ItemSetChampionsStormcaller = shamanPvPSet("Champion's Stormcaller", 2, 6)
var ItemSetWarlordsEarthshaker = shamanPvPSet("Warlord's Earthshaker", 6, 2)
