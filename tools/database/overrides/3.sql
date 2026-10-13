-- Client 1.60.1.70291 moved every flat armor effect off A_MOD_RESISTANCE school 1 (aura 22, misc 1)
-- onto aura 674, which nothing here parses: Devotion Aura, Sunder Armor, Faerie Fire, Curse of
-- Recklessness, Expose Armor, Mark and Gift of the Wild all dropped out of the buff tables (#758).
-- Every 674 row in the build is armor (misc 1, school Physical), so it is read as the aura it replaced.
-- The WHERE clause stops matching if 674 ever carries anything but armor.
UPDATE SpellEffect SET EffectAura = 22
WHERE EffectAura = 674 AND EffectMiscValue_0 = 1;
