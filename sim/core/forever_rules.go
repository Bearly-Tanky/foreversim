package core

import "github.com/wowsims/forever/sim/core/stats"

// Forever pays hit and critical strike from gear against every kind of attack rather than
// splitting them into a melee and a spell pool. The client data states most of it as the
// generic rating, which the database reads as melee, so a caster would otherwise get no hit
// from Neltharion's Tear. Summed in percent, then paid into both pools as rating.
func UnifyGearHitAndCrit(equipStats stats.Stats) stats.Stats {
	hit := equipStats[stats.MeleeHitRating]/PhysicalHitRatingPerHitPercent + equipStats[stats.SpellHitRating]/SpellHitRatingPerHitPercent
	crit := equipStats[stats.MeleeCritRating]/PhysicalCritRatingPerCritPercent + equipStats[stats.SpellCritRating]/SpellCritRatingPerCritPercent

	equipStats[stats.MeleeHitRating] = hit * PhysicalHitRatingPerHitPercent
	equipStats[stats.SpellHitRating] = hit * SpellHitRatingPerHitPercent
	equipStats[stats.MeleeCritRating] = crit * PhysicalCritRatingPerCritPercent
	equipStats[stats.SpellCritRating] = crit * SpellCritRatingPerCritPercent
	return equipStats
}
