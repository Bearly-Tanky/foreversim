package paladin

// Spell masks identify the paladin's spells to talents, proc triggers and spell mods.
const (
	SpellMaskNone int64 = 0

	// Abilities
	SpellMaskJudgement int64 = 1 << iota
	SpellMaskHolyStrike
	SpellMaskConsecration
	SpellMaskExorcism
	SpellMaskHammerOfWrath
	SpellMaskHolyWrath
	SpellMaskHolyLight
	SpellMaskFlashOfLight
	SpellMaskLayOnHands
	SpellMaskRighteousFury
	SpellMaskHammerOfTheRighteous

	// Talent abilities
	SpellMaskDivineFavor
	SpellMaskHolyShock
	SpellMaskHolyShockHeal
	SpellMaskHolyShield
	SpellMaskHolyShieldProc
	SpellMaskSwiftJudgement
	SpellMaskTemplarsBulwark
	SpellMaskLightsVigil
	SpellMaskLightsVigilStrike

	// Seals
	SpellMaskSealOfRighteousness
	SpellMaskSealOfCommand
	SpellMaskSealOfLight
	SpellMaskSealOfWisdom
	SpellMaskSealOfJustice
	SpellMaskSealOfTheCrusader
	SpellMaskSealOfFury

	// What the seals do on a hit
	SpellMaskSealOfRighteousnessProc
	SpellMaskSealOfCommandProc
	SpellMaskSealOfLightProc
	SpellMaskSealOfWisdomProc
	SpellMaskSealOfFuryProc

	// What Judgement unleashes
	SpellMaskJudgementOfRighteousness
	SpellMaskJudgementOfCommand
	SpellMaskJudgementOfLight
	SpellMaskJudgementOfWisdom
	SpellMaskJudgementOfJustice
	SpellMaskJudgementOfTheCrusader
	SpellMaskJudgementOfFury

	// Auras
	SpellMaskDevotionAura
	SpellMaskRetributionAura
	SpellMaskConcentrationAura
	SpellMaskFireResistanceAura
	SpellMaskFrostResistanceAura
	SpellMaskShadowResistanceAura
)

const (
	SpellMaskAllSeals = SpellMaskSealOfRighteousness |
		SpellMaskSealOfCommand |
		SpellMaskSealOfLight |
		SpellMaskSealOfWisdom |
		SpellMaskSealOfJustice |
		SpellMaskSealOfTheCrusader |
		SpellMaskSealOfFury

	SpellMaskSealProcs = SpellMaskSealOfRighteousnessProc |
		SpellMaskSealOfCommandProc |
		SpellMaskSealOfLightProc |
		SpellMaskSealOfWisdomProc |
		SpellMaskSealOfFuryProc

	SpellMaskAllJudgements = SpellMaskJudgementOfRighteousness |
		SpellMaskJudgementOfCommand |
		SpellMaskJudgementOfLight |
		SpellMaskJudgementOfWisdom |
		SpellMaskJudgementOfJustice |
		SpellMaskJudgementOfTheCrusader |
		SpellMaskJudgementOfFury

	SpellMaskAllAuras = SpellMaskDevotionAura |
		SpellMaskRetributionAura |
		SpellMaskConcentrationAura |
		SpellMaskFireResistanceAura |
		SpellMaskFrostResistanceAura |
		SpellMaskShadowResistanceAura

	// The heals Healing Light, Illumination and Divine Favor name.
	SpellMaskHealingSpells = SpellMaskHolyLight |
		SpellMaskFlashOfLight |
		SpellMaskHolyShockHeal

	// Benediction's class mask (20101) over the spells the sim registers: not Hammer of the Righteous,
	// Lay on Hands, Divine Favor, Swift Judgement or any aura but Retribution Aura.
	SpellMaskBenediction = SpellMaskAllSeals |
		SpellMaskRetributionAura |
		SpellMaskJudgement |
		SpellMaskHolyStrike |
		SpellMaskConsecration |
		SpellMaskExorcism |
		SpellMaskRighteousFury |
		SpellMaskHolyShock |
		SpellMaskHolyShockHeal |
		SpellMaskHolyShield |
		SpellMaskTemplarsBulwark

	// Divine Precision's class mask (1310904), as far as the sim casts it.
	SpellMaskDivinePrecision = SpellMaskConsecration |
		SpellMaskExorcism |
		SpellMaskHolyShock |
		SpellMaskHolyStrike |
		SpellMaskHolyWrath |
		SpellMaskLightsVigil |
		SpellMaskLightsVigilStrike
)
