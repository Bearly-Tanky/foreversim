package buffs

import (
	"math"
	"testing"
	"time"

	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/spelldata"
)

// What each generated row reads off the store at every talent point it prices: the first amount the
// aura applies in the sim's units, how long it lasts and, for a driven cooldown, how long the caster
// waits.
func TestGeneratedRowsReadTheClientsNumbers(t *testing.T) {
	permanent := core.NeverExpires
	cases := []struct {
		name     string
		value    func(int32) float64
		duration func(int32) time.Duration
		want     []float64
		lasts    time.Duration
	}{
		{"BloodPact", BloodPactValue, BloodPactDuration, []float64{54}, permanent},
		{"BattleShout", BattleShoutValue, BattleShoutDuration, []float64{139}, 3 * time.Minute},
		{"DevotionAura", DevotionAuraValue, DevotionAuraDuration, []float64{735}, permanent},
		{"LeaderOfThePack", LeaderOfThePackValue, LeaderOfThePackDuration, []float64{3}, permanent},
		{"ManaSpringTotem", ManaSpringTotemValue, ManaSpringTotemDuration, []float64{25, 25, 27.5, 27.5, 30, 30}, permanent},
		{"ManaTideTotems", ManaTideTotemsValue, ManaTideTotemsDuration, []float64{1450.0 / 3}, 13 * time.Second},
		{"RetributionAura", RetributionAuraValue, RetributionAuraDuration, []float64{20}, permanent},
		{"ConcentrationAura", ConcentrationAuraValue, ConcentrationAuraDuration, []float64{-0.35}, permanent},
		{"TrueshotAura", TrueshotAuraValue, TrueshotAuraDuration, []float64{75}, 30 * time.Minute},
		{"AtieshWarlock", AtieshWarlockValue, AtieshWarlockDuration, []float64{33}, permanent},
		{"AtieshDruid", AtieshDruidValue, AtieshDruidDuration, []float64{11}, permanent},
		{"WindfuryTotem", WindfuryTotemValue, WindfuryTotemDuration, []float64{246}, time.Second},
		{"GreaterBlessingOfKings", GreaterBlessingOfKingsValue, GreaterBlessingOfKingsDuration, []float64{1.1}, time.Hour},
		{"GreaterBlessingOfWisdom", GreaterBlessingOfWisdomValue, GreaterBlessingOfWisdomDuration, []float64{40}, time.Hour},
		{"GreaterBlessingOfSalvation", GreaterBlessingOfSalvationValue, GreaterBlessingOfSalvationDuration, []float64{0.7}, time.Hour},
		{"GiftOfTheWild", GiftOfTheWildValue, GiftOfTheWildDuration, []float64{385}, time.Hour},
		{"Thorns", ThornsValue, ThornsDuration, []float64{18}, 10 * time.Minute},
		{"FireResistanceAura", FireResistanceAuraValue, FireResistanceAuraDuration, []float64{60}, permanent},
		{"PowerInfusions", PowerInfusionsValue, PowerInfusionsDuration, []float64{1.2}, 15 * time.Second},
		{"HuntersMark", HuntersMarkValue, HuntersMarkDuration, []float64{71}, 2 * time.Minute},
		{"CurseOfElements", CurseOfElementsValue, CurseOfElementsDuration, []float64{-75}, 5 * time.Minute},
		{"CurseOfRecklessness", CurseOfRecklessnessValue, CurseOfRecklessnessDuration, []float64{-505}, 2 * time.Minute},
		{"ExposeArmor", ExposeArmorValue, ExposeArmorDuration, []float64{-2250}, 30 * time.Second},
		{"SunderArmor", SunderArmorValue, SunderArmorDuration, []float64{-450}, 30 * time.Second},
		{"GiftOfArthas", GiftOfArthasValue, GiftOfArthasDuration, []float64{8}, 3 * time.Minute},
		{"DemoralizingShout", DemoralizingShoutValue, DemoralizingShoutDuration, []float64{-205}, 45 * time.Second},
		{"ThunderClap", ThunderClapValue, ThunderClapDuration, []float64{1 / 1.2}, 30 * time.Second},
		{"InsectSwarm", InsectSwarmValue, InsectSwarmDuration, []float64{-2}, 12 * time.Second},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			for points, want := range c.want {
				if got := c.value(int32(points)); math.Abs(got-want) > 1e-9 {
					t.Errorf("Value(%d) = %v, want %v", points, got, want)
				}
				if got := c.duration(int32(points)); got != c.lasts {
					t.Errorf("Duration(%d) = %v, want %v", points, got, c.lasts)
				}
			}
		})
	}

	cooldowns := []struct {
		name     string
		cooldown func() time.Duration
		want     time.Duration
	}{
		{"ManaTideTotems", ManaTideTotemsCooldown, 5 * time.Minute},
		{"Innervates", InnervatesCooldown, 6 * time.Minute},
		{"PowerInfusions", PowerInfusionsCooldown, 3 * time.Minute},
	}
	for _, c := range cooldowns {
		if got := c.cooldown(); got != c.want {
			t.Errorf("%s: Cooldown() = %v, want %v", c.name, got, c.want)
		}
	}
}

// The raid's Retribution Aura is a damage shield and a healing-taken row of 0. Its value is the damage
// the shield deals, whatever else the row states: the parse would attach the 0 as a multiplier of 1.
func TestMetaValueOfADamageShieldIsItsDamage(t *testing.T) {
	if got := (&Meta{Spell: spelldata.MustFind(10301)}).Value(0); got != 20 {
		t.Errorf("Retribution Aura without the skips reads %v, want the shield's 20", got)
	}
}
