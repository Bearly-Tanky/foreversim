package encounters

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/stats"
)

func init() {
	AddDefaultPresetEncounter()
	addMovementAI()
	addDynamicAddsAI()
	addCustomBossAI()
	addForeverRaids()
	// Magtheridon, Serpentshrine and Mount Hyjal are TBC raids Forever does not have: their
	// packages stay (upstream's, they keep merging) but are not registered.
}

func AddSingleTargetBossEncounter(presetTarget *core.PresetTarget) {
	core.AddPresetTarget(presetTarget)
	core.AddPresetEncounter(presetTarget.Config.Name, []string{
		presetTarget.Path(),
	})
}

func AddDefaultPresetEncounter() {
	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: "Default",
		Config: &proto.Target{
			Id:        31146,
			Name:      "Raid Target",
			Level:     63,
			MobType:   proto.MobType_MobTypeMechanical,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      6_070_400,
				stats.Armor:       3731,
				stats.AttackPower: 320,
			}.ToProtoArray(),

			SpellSchool:      proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:       2,
			MinBaseDamage:    4192.05,
			DamageSpread:     0.5,
			SuppressDodge:    false,
			ParryHaste:       true,
			CanCrush:         true,
			DualWield:        false,
			DualWieldPenalty: false,
			TargetInputs:     []*proto.TargetInput{},
		},
		AI: nil,
	})
	core.AddPresetEncounter("Raid Target", []string{
		"Default/Raid Target",
	})
}
