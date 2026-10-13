package forever

import (
	"time"

	"github.com/wowsims/forever/sim/common/shared"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
	"github.com/wowsims/forever/sim/core/stats"
)

func init() {

	// Scopes: flat ranged weapon damage (client SpellItemEnchantment effect 2, weapon damage).
	for effectID, damage := range map[int32]float64{30: 1, 32: 2, 33: 3, 663: 5, 664: 7} {
		core.NewEnchantEffect(effectID, func(agent core.Agent) {
			ranged := agent.GetCharacter().AutoAttacks.Ranged()
			ranged.BaseDamageMin += damage
			ranged.BaseDamageMax += damage
		})
	}

	// Felsteel Shield Spike
	// EffectID: 2714, Proc SpellID: 29455
	// Permanently attaches a felsteel spike to your shield that deals 26 to 38 damage to attackers whose melee attacks you block.
	// https://www.wowhead.com/forever/spell=29455
	shared.NewProcDamageEffect(shared.ProcDamageEffect{
		EnchantID: 2714,
		SpellID:   29455,
		School:    core.SpellSchoolPhysical,
		MinDmg:    26,
		MaxDmg:    38,
		IsMelee:   true,
		Flags:     core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagNoOnDamageDealt,
		Trigger: core.ProcTrigger{
			Name:       "Felsteel Shield Spike",
			Callback:   core.CallbackOnSpellHitTaken,
			ProcMask:   core.ProcMaskMelee,
			Outcome:    core.OutcomeBlock,
			ProcChance: 1,
		},
	})

	// Mongoose
	// EffectID: 2673, Proc SpellID: 28093
	// PPM: 1, ICD: 0
	// Permanently enchant a Melee Weapon to occasionally increase Agility by 120 and attack speed slightly (2%).
	core.NewEnchantEffect(2673, func(agent core.Agent) {
		character := agent.GetCharacter()
		duration := time.Second * 15

		createMongooseAuras := func(tag int32) *core.StatBuffAura {
			labelSuffix := core.Ternary(tag == 1, " (MH)", " (OH)")
			slot := core.Ternary(tag == 1, proto.ItemSlot_ItemSlotMainHand, proto.ItemSlot_ItemSlotOffHand)
			aura := character.NewTemporaryStatsAuraWrapped(
				"Lightning Speed"+labelSuffix,
				core.ActionID{SpellID: 28093}.WithTag(tag),
				stats.Stats{stats.Agility: 120},
				duration,
				func(aura *core.Aura) {
					aura.ApplyOnGain(func(aura *core.Aura, sim *core.Simulation) {
						character.MultiplyAttackSpeed(sim, 1.02)
					})
					aura.ApplyOnExpire(func(aura *core.Aura, sim *core.Simulation) {
						character.MultiplyAttackSpeed(sim, 1/1.02)
					})
				},
			)
			character.AddStatProcBuff(2673, aura, true, []proto.ItemSlot{slot})
			character.ItemSwap.RegisterWeaponEnchantBuff(aura.Aura, 2673)
			return aura
		}

		mhAuras := createMongooseAuras(1)
		ohAuras := createMongooseAuras(2)

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:         "Enchant Weapon - Mongoose",
			Callback:     core.CallbackOnSpellHitDealt,
			ActionID:     core.ActionID{SpellID: 28093},
			IsWeaponProc: true,
			DPM:          character.NewDynamicLegacyProcForEnchant(2673, 1.0, 0),
			Outcome:      core.OutcomeLanded,
			Handler: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) {
				core.Ternary(spell.IsOH(), ohAuras, mhAuras).Activate(sim)
			},
		})
	})

	// Executioner
	// EffectID: 3225, Proc SpellID: 42976
	// PPM: ?, ICD: 0
	// Permanently enchant a Melee Weapon to occasionally ignore 840 of your enemy's armor.  Requires a level 60 or higher item.
	core.NewEnchantEffect(3225, func(agent core.Agent) {
		character := agent.GetCharacter()
		duration := time.Second * 15

		aura := character.NewTemporaryStatsAura(
			"Executioner",
			core.ActionID{SpellID: 42976},
			stats.Stats{stats.ArmorPenetration: 840},
			duration,
		)
		character.AddStatProcBuff(3225, aura, true, core.AllMeleeWeaponSlots())
		character.ItemSwap.RegisterWeaponEnchantBuff(aura.Aura, 3225)

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:         "Enchant Weapon - Executioner",
			Callback:     core.CallbackOnSpellHitDealt,
			ActionID:     core.ActionID{SpellID: 28093},
			IsWeaponProc: true,
			DPM:          character.NewDynamicLegacyProcForEnchant(3225, 1.0, 0),
			Outcome:      core.OutcomeLanded,
			Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				aura.Activate(sim)
			},
		})
	})

	// Fiery Weapon (13897: 40 Fire) and Lifestealing (20004: steals 30 Shadow; only the damage is
	// simulated, not what it heals). The client states no rate for either and no beta log has them,
	// so the rate is master's classic-legacy one, as for the weapon procs in items_weapons.go: 6 and
	// 6.66 PPM.
	for _, proc := range []struct {
		enchantID int32
		name      string
		ppm       float64
		spellID   int32
	}{
		{803, "Fiery Weapon", 6, 13897},
		{1898, "Lifestealing", 6.66, 20004},
	} {
		core.NewEnchantEffect(proc.enchantID, func(agent core.Agent) {
			character := agent.GetCharacter()
			procSpell := character.GetOrRegisterSpell(shared.SpellDataProcDamageSpell(character, spelldata.MustFind(proc.spellID)))
			procSpell.Flags |= core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagProc

			aura := character.MakeProcTriggerAura(core.ProcTrigger{
				Name:               "Enchant Weapon - " + proc.name,
				Callback:           core.CallbackOnSpellHitDealt,
				ActionID:           core.ActionID{SpellID: proc.spellID},
				IsWeaponProc:       true,
				DPM:                character.NewDynamicLegacyProcForEnchant(proc.enchantID, proc.ppm, 0),
				Outcome:            core.OutcomeLanded,
				TriggerImmediately: true,
				Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
					procSpell.Cast(sim, result.Target)
				},
			})
			character.ItemSwap.RegisterEnchantProc(proc.enchantID, aura)
		})
	}

	// Deathfrost
	// EffectID: 3273, Proc SpellID: 46579, Damage SpellID: 46579, Debuff SpellID: 46629
	// Proc Chance: 50%, ICD: 25s
	// Permanently enchant a weapon so your damaging spells and melee weapon hits occasionally inflict an additional 150 Frost damage
	// and reduce the target's melee, ranged, and casting speed by 15% for 8 sec.  Requires a level 60 or higher item.
	core.NewEnchantEffect(3273, func(agent core.Agent) {
		character := agent.GetCharacter()
		duration := time.Second * 8
		effect := 0.85

		debuffArray := character.NewEnemyAuraArray(func(target *core.Unit) *core.Aura {
			return target.GetOrRegisterAura(core.Aura{
				Label:    "Deathfrost",
				Duration: duration,
				ActionID: core.ActionID{SpellID: 46629},
				OnGain: func(aura *core.Aura, sim *core.Simulation) {
					aura.Unit.MultiplyAttackSpeed(sim, effect)
					aura.Unit.MultiplyRangedSpeed(sim, effect)
					aura.Unit.MultiplyCastSpeed(sim, effect)
				},
				OnExpire: func(aura *core.Aura, sim *core.Simulation) {
					aura.Unit.MultiplyAttackSpeed(sim, 1/effect)
					aura.Unit.MultiplyRangedSpeed(sim, 1/effect)
					aura.Unit.MultiplyCastSpeed(sim, 1/effect)
				},
			})
		})

		dfSpell := character.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{SpellID: 46579},
			SpellSchool: core.SpellSchoolFrost,
			DefenseType: core.DefenseTypeMagic,
			Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell | core.SpellFlagProc,
			ProcMask:    core.ProcMaskSpellDamage,

			DamageMultiplier: 1,
			ThreatMultiplier: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.CalcAndDealDamage(sim, target, 150, spell.OutcomeMagicCrit)
			},
		})

		// Enchant 3273 carries two effects: a combat spell (Effect 1) that rolls on melee hits, and an
		// Equip aura 46662 (Effect 3) that rolls on spell damage, direct and periodic (ProcTypeMask
		// 2424832), without Can Proc From Procs. Both cast 46579. The 25 s lockout is 46662's proc
		// recovery; the combat half has none in the DBC, so the two halves share one here rather than
		// doubling the rate the old single trigger had.
		//
		// The roll and the lockout are taken in ExtraCondition, which runs synchronously in the
		// callback. The handler runs a batch window later, and hits landing on the same timestamp
		// (both hands, extra attacks, multiple targets) would all pass a lockout consumed there.
		lockout := core.Cooldown{
			Timer:    character.NewTimer(),
			Duration: time.Second * 25,
		}
		meleeDPM := character.NewFixedProcChanceManager(0.5, core.ProcMaskMelee)
		handler := func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			debuffArray.Get(result.Target).Activate(sim)
			dfSpell.Cast(sim, result.Target)
		}

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:         "Enchant Weapon - Deathfrost (Melee)",
			Callback:     core.CallbackOnSpellHitDealt,
			ActionID:     core.ActionID{SpellID: 46579},
			IsWeaponProc: true,
			Outcome:      core.OutcomeLanded,
			ExtraCondition: func(sim *core.Simulation, spell *core.Spell, _ *core.SpellResult) bool {
				if !lockout.IsReady(sim) || !meleeDPM.Proc(sim, spell.ProcMask, "Deathfrost (Melee)") {
					return false
				}
				lockout.Use(sim)
				return true
			},
			Handler: handler,
		})

		character.MakeProcTriggerAura(core.ProcTrigger{
			Name:     "Enchant Weapon - Deathfrost (Spell)",
			Callback: core.CallbackOnSpellHitDealt | core.CallbackOnPeriodicDamageDealt,
			ActionID: core.ActionID{SpellID: 46662},
			ProcMask: core.ProcMaskSpellDamage,
			Outcome:  core.OutcomeLanded,
			ExtraCondition: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) bool {
				if !lockout.IsReady(sim) || !sim.Proc(0.5, "Deathfrost (Spell)") {
					return false
				}
				lockout.Use(sim)
				return true
			},
			Handler: handler,
		})
	})

	// Scopes
	core.NewEnchantEffect(2722, func(agent core.Agent) {
		character := agent.GetCharacter()
		ranged := character.AutoAttacks.Ranged()
		ranged.BaseDamageMin += 10
		ranged.BaseDamageMax += 10
	})

	core.NewEnchantEffect(2723, func(agent core.Agent) {
		character := agent.GetCharacter()
		ranged := character.AutoAttacks.Ranged()
		ranged.BaseDamageMin += 12
		ranged.BaseDamageMax += 12
	})

	core.NewEnchantEffect(2724, func(agent core.Agent) {
		character := agent.GetCharacter()
		character.AddStat(stats.RangedCritPercent, 28.0/core.PhysicalCritRatingPerCritPercent)
	})

	movementSpeedEnchants := []int32{
		2939, // Enchant Boots - Cat's Swiftness
		2940, // Enchant Boots - Boar's Speed
	}

	for _, enchantID := range movementSpeedEnchants {
		core.NewEnchantEffect(enchantID, func(agent core.Agent) {
			character := agent.GetCharacter()
			aura := character.NewPassiveMovementSpeedAura("Minor Run Speed", core.ActionID{SpellID: 13889}, 0.08)

			character.ItemSwap.RegisterEnchantProc(enchantID, aura)
		})
	}
}
