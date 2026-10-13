package hunter

import (
	"time"

	"github.com/wowsims/forever/sim/core"
)

// Devilsaur Eye (19991) and Devilsaur Tooth (19992) are not here: the Forever client reworked them
// into a root on Beasts (24352) and a cheaper Revive Pet (24353), neither of which the sim models.
func init() {
	// Knight-Lieutenant's and Blood Guard's Chain Gauntlets
	// Equip: Reduces the mana cost of your Arcane Shot by 15 (23157).
	for _, itemID := range []int32{16403, 16530} {
		core.NewItemEffect(itemID, func(agent core.Agent) {
			agent.GetCharacter().AddStaticMod(core.SpellModConfig{
				ClassMask: HunterSpellArcaneShot,
				Kind:      core.SpellMod_PowerCost_Flat,
				IntValue:  -15,
			})
		})
	}

	// Renataki's Charm of Beasts
	// https://www.wowhead.com/forever/item=19953/renatakis-charm-of-beasts
	//
	// Use: Instantly clears the cooldowns of Aimed Shot, Multishot, Volley, and Arcane Shot (24531).
	// 3 min cooldown, 10 sec on the burst trinket category. Volley has no cooldown to clear, and
	// Aimed Shot and Multi-Shot share one timer, as Arcane Shot does with Summon Hawk.
	core.NewItemEffect(19953, func(agent core.Agent) {
		hunter := agent.(HunterAgent).GetHunter()
		shots := func() []*core.Spell {
			return core.FilterSlice([]*core.Spell{hunter.AimedShot, hunter.MultiShot, hunter.ArcaneShot},
				func(spell *core.Spell) bool { return spell != nil })
		}

		spell := hunter.RegisterSpell(core.SpellConfig{
			ActionID: core.ActionID{ItemID: 19953},
			ProcMask: core.ProcMaskEmpty,
			Flags:    core.SpellFlagNoOnCastComplete,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    hunter.NewTimer(),
					Duration: time.Minute * 3,
				},
				SharedCD: core.Cooldown{
					Timer:    hunter.GetOffensiveTrinketCD(),
					Duration: time.Second * 10,
				},
			},

			ApplyEffects: func(_ *core.Simulation, _ *core.Unit, _ *core.Spell) {
				for _, shot := range shots() {
					shot.CD.Reset()
				}
			},
		})

		hunter.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeDPS,
			ShouldActivate: func(sim *core.Simulation, _ *core.Character) bool {
				// Only worth it with a shot to bring back.
				for _, shot := range shots() {
					if !shot.CD.IsReady(sim) {
						return true
					}
				}
				return false
			},
		})
	})
}
