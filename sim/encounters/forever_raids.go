package encounters

import (
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

// Our Forever encounter presets, from master's sim/encounters. Forever's tier 1 opens with
// Barrow Deeps (10), Hyjal Summit (20) and Onyxia's Lair (40); only Onyxia has an encounter to
// build, she returns unchanged from Classic. The other two have a name, a size and a date and
// nothing else, so they stay unregistered. Level 63 raid boss armor is 3731 throughout.
func addForeverRaids() {
	addLevel60("Classic")
	addVaelastraszTheCorrupt("Classic")
	addOnyxia("Classic")
}

func addLevel60(bossPrefix string) {
	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: bossPrefix,
		Config: &proto.Target{
			Id:        213336,
			Name:      "Level 60",
			Level:     63,
			MobType:   proto.MobType_MobTypeUnknown,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      127_393,
				stats.Armor:       3731,
				stats.AttackPower: 805,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2,
			MinBaseDamage: 3000,
			DamageSpread:  0.3333,
			ParryHaste:    true,
			TargetInputs:  []*proto.TargetInput{},
		},
	})
	core.AddPresetEncounter("Level 60", []string{
		bossPrefix + "/Level 60",
	})
}

// Onyxia's stats are Classic Era's. The phase two air phase is not modelled, so this sims the
// ground phases only, which is what a damage preset wants from her anyway.
func addOnyxia(bossPrefix string) {
	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: bossPrefix,
		Config: &proto.Target{
			Id:        10184,
			Name:      "Onyxia's Lair Onyxia",
			Level:     63,
			MobType:   proto.MobType_MobTypeDragonkin,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      1_085_000,
				stats.Armor:       3731,
				stats.AttackPower: 805,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2,
			MinBaseDamage: 3800,
			DamageSpread:  0.3333,
			ParryHaste:    true,
			TargetInputs:  []*proto.TargetInput{},
		},
	})
	core.AddPresetEncounter("Onyxia's Lair Onyxia", []string{
		bossPrefix + "/Onyxia's Lair Onyxia",
	})
}

func addVaelastraszTheCorrupt(bossPrefix string) {
	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: bossPrefix,
		Config: &proto.Target{
			Id:        13020,
			Name:      "Blackwing Lair Vaelastrasz the Corrupt",
			Level:     63,
			MobType:   proto.MobType_MobTypeDragonkin,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      3_331_000,
				stats.Armor:       3731,
				stats.AttackPower: 805,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2,
			MinBaseDamage: 5000,
			DamageSpread:  0.333,
			ParryHaste:    true,
		},
		AI: func() core.TargetAI { return &vaelastraszAI{} },
	})
	core.AddPresetEncounter("Blackwing Lair Vaelastrasz the Corrupt", []string{
		bossPrefix + "/Blackwing Lair Vaelastrasz the Corrupt",
	})
}

// Only Essence of the Red is modelled (500 mana, 50 energy, 20 rage a second for 4 minutes),
// as on master; the rest of the fight was copied from Season of Discovery there and never verified.
type vaelastraszAI struct {
	Target       *core.Target
	essenceOfRed *core.Spell
}

func (ai *vaelastraszAI) Initialize(target *core.Target, _ *proto.Target) {
	ai.Target = target
	actionID := core.ActionID{SpellID: 23513}
	player := &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
	manaMetrics := player.NewManaMetrics(actionID)
	energyMetrics := player.NewEnergyMetrics(actionID)
	rageMetrics := player.NewRageMetrics(actionID)

	ai.essenceOfRed = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID: actionID,
		ProcMask: core.ProcMaskEmpty,
		Cast: core.CastConfig{
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Minute * 4,
			},
		},
		Dot: core.DotConfig{
			Aura:          core.Aura{Label: "Essence of the Red"},
			NumberOfTicks: 240,
			TickLength:    time.Second,
			OnTick: func(sim *core.Simulation, target *core.Unit, _ *core.Dot) {
				if target.HasManaBar() {
					target.AddMana(sim, 500, manaMetrics)
				}
				if target.HasEnergyBar() {
					target.AddEnergy(sim, 50, energyMetrics)
				}
				if target.HasRageBar() {
					target.AddRage(sim, 20, rageMetrics)
				}
			},
		},
		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			spell.Dot(target).Apply(sim)
		},
	})
}

func (ai *vaelastraszAI) Reset(*core.Simulation) {}

func (ai *vaelastraszAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget
	if target == nil {
		// Individual non-tank sims still want the essence on the player.
		target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
	}
	if ai.essenceOfRed.CanCast(sim, target) {
		ai.essenceOfRed.Cast(sim, target)
	}
	ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
}
