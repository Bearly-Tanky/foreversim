package buffs

import (
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
)

// The debuffs the raid puts on a target: the generated rows, then the one the client states in a
// shape no manifest row can carry.
func applyDebuffs(target *core.Unit, debuffs *proto.Debuffs, raid *proto.Raid) {
	applyGeneratedDebuffs(target, debuffs, raid)

	if debuffs.JudgementOfTheCrusader {
		core.MakePermanent(JudgementOfTheCrusaderAura(target, JudgementOfTheCrusaderMaxRank))
	}
}
