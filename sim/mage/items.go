package mage

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/stats"
)

var ItemSetAldorRegalia = core.NewItemSet(core.ItemSet{
	ID:   648,
	Name: "Aldor Regalia",
	Bonuses: map[int32]core.ApplySetBonus{
		4: func(_ core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_CastTime_Flat,
				TimeValue: time.Second * -24,
				ClassMask: MageSpellPresenceOfMind,
			}).AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_CastTime_Flat,
				TimeValue: time.Second * -4,
				ClassMask: MageSpellBlastWave,
			}).AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_CastTime_Flat,
				TimeValue: time.Second * -40,
				ClassMask: MageSpellIceBlock,
			})
		},
	},
})

var ItemSetTirisfalRegalia = core.NewItemSet(core.ItemSet{
	ID:   649,
	Name: "Tirisfal Regalia",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Flat,
				FloatValue: .20,
				ClassMask:  MageSpellArcaneBlast,
			}).AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_PowerCost_Pct_Add,
				FloatValue: .20,
				ClassMask:  MageSpellArcaneBlast,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			mage := agent.(MageAgent).GetMage()

			madnessAura := mage.NewTemporaryStatsAura(
				"Arcane Madness",
				core.ActionID{SpellID: 37444},
				stats.Stats{stats.SpellDamage: 70},
				time.Second*6,
			)

			setBonusAura.AttachProcTrigger(core.ProcTrigger{
				Name:     "Tirisfal 4PC",
				Callback: core.CallbackOnSpellHitDealt,
				ProcMask: core.ProcMaskSpellDamage,
				Outcome:  core.OutcomeCrit,

				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					madnessAura.Activate(sim)
				},
			})
		},
	},
})

var ItemSetTempestRegalia = core.NewItemSet(core.ItemSet{
	ID:   671,
	Name: "Tempest Regalia",
	Bonuses: map[int32]core.ApplySetBonus{
		2: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:      core.SpellMod_DotNumberOfTicks_Flat,
				IntValue:  1,
				ClassMask: MageSpellEvocation,
			})
		},
		4: func(agent core.Agent, setBonusAura *core.Aura) {
			setBonusAura.AttachSpellMod(core.SpellModConfig{
				Kind:       core.SpellMod_DamageDone_Flat,
				FloatValue: .05,
				ClassMask:  MageSpellFireball | MageSpellFrostbolt | MageSpellArcaneMissilesTick,
			})
		},
	},
})

// Jewel of Kajaro (19601) takes 2 sec off Counterspell, which the sim does not cast. Fire Ruby
// (20036) is Forever's Chaos Fire (24389): it refreshes Fire Ward and feeds the Fire damage it
// absorbed into the next Fire Blast, neither of which the sim models; Classic's mana and Fire power
// are gone from the client.
func init() {
	// Hazza'rah's Charm of Magic
	// https://www.wowhead.com/forever/item=19959/hazzarahs-charm-of-magic
	//
	// Use: Increases the critical hit chance of your Arcane spells by 5%, and increases the critical
	// hit damage of your Arcane spells by 50% for 20 sec (24544). 3 min cooldown, 20 sec on the burst
	// trinket category. The client's class mask names Arcane Explosion and Arcane Missiles only,
	// where Classic's took every Arcane spell.
	core.NewItemEffect(19959, func(agent core.Agent) {
		// The warlock tests pull the mage package in, and with it this mage-only charm.
		mageAgent, ok := agent.(MageAgent)
		if !ok {
			return
		}
		mage := mageAgent.GetMage()
		duration := time.Second * 20

		aura := mage.RegisterAura(core.Aura{
			Label:    "Arcane Potency",
			ActionID: core.ActionID{SpellID: 24544},
			Duration: duration,
		}).AttachSpellMod(core.SpellModConfig{
			Kind:       core.SpellMod_BonusCrit_Percent,
			FloatValue: 5,
			ClassMask:  MageSpellArcaneExplosion | MageSpellArcaneMissiles,
		}).AttachSpellMod(core.SpellModConfig{
			Kind:       core.SpellMod_CritMultiplier_Flat,
			FloatValue: 0.5,
			ClassMask:  MageSpellArcaneExplosion | MageSpellArcaneMissiles,
		})

		spell := mage.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{ItemID: 19959},
			SpellSchool: core.SpellSchoolArcane,
			Flags:       core.SpellFlagNoOnCastComplete,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    mage.NewTimer(),
					Duration: time.Minute * 3,
				},
				SharedCD: core.Cooldown{
					Timer:    mage.GetOffensiveTrinketCD(),
					Duration: duration,
				},
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, _ *core.Spell) {
				aura.Activate(sim)
			},
		})

		mage.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeDPS,
		})
	})
}
