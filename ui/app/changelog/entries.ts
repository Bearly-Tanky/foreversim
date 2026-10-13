// What the fork changed to turn the Classic sim into a Forever sim, grouped by what a
// reader would look for rather than by the order it happened. Every entry names the pull
// requests that carried it and, where the change came from published Forever information,
// the place it was read from.
//
// The file has two breaks in its history. On 23 September the sim moved onto the official
// WoWSims Forever engine; the first sections cover that and what has changed since. Before
// that, on 17 September, the beta client was datamined: 'The beta client' is largely a record
// of where the BlizzCon 2026 demo tooltips had it wrong, and everything after it was read off
// those tooltips, because that was all there was.

export type Source = {
	label: string;
	url: string;
};

export type Entry = {
	title: string;
	prs: Array<number>;
	// What changed in the simulator.
	changed: string;
	// What it does to the numbers, compared with the Classic Era sim this fork started from.
	effect: string;
	sources?: Array<Source>;
};

export type Section = {
	title: string;
	intro: string;
	entries: Array<Entry>;
};

const blizzardPanel: Source = {
	label: "Blizzard: World of Warcraft: Forever What's Next panel recap",
	url: 'https://news.blizzard.com/en-us/article/24303862/world-of-warcraft-forever-whats-next-panel-recap',
};
const blizzardAnnounce: Source = {
	label: "Blizzard: World of Warcraft at BlizzCon 2026, Discover What's Next",
	url: 'https://news.blizzard.com/en-us/article/24301145/world-of-warcraft-at-blizzcon-2026-discover-whats-next',
};
const wowheadOverview: Source = {
	label: 'Wowhead: World of Warcraft: Forever overview (features, zones, raids)',
	url: 'https://www.wowhead.com/forever/guide/overview-features-zones-raids',
};
const wowheadRoadmap: Source = {
	label: 'Wowhead: Forever content release roadmap',
	url: 'https://www.wowhead.com/forever/guide/content-release-roadmap',
};
const wowheadRacials: Source = {
	label: 'Wowhead: all racials and race-class combinations in Forever',
	url: 'https://www.wowhead.com/forever/guide/new-race-class-combinations',
};
const wowheadTalents: Source = {
	label: 'Wowhead: Forever talent calculator (built from the BlizzCon demo, to be refreshed from the beta client)',
	url: 'https://www.wowhead.com/forever/talent-calc',
};
const communityTalents: Source = {
	label: 'Community talent calculators rebuilt from the BlizzCon demo tooltips (wowforevertalents.com, zockify.com)',
	url: 'https://wowforevertalents.com/',
};
const worldBuffsReport: Source = {
	label: 'N_Tys, 13 September: world buffs will not work in Forever raids (from Savix)',
	url: 'https://x.com/N_Tys26/status/2099230107147931731',
};
const worldBuffsClip: Source = {
	label: 'Savix on Twitch: WoW: Forever will not have world buffs in raids',
	url: 'https://www.twitch.tv/savix/clip/NastySillyWerewolfCclamChamp-V04O2vDDSTTAnULX',
};
const talentDataset: Source = {
	label: "The wow-forever-talent-calc dataset behind wowforevertalents.com, read off the demo video (MIT; the icons and crops are Blizzard's)",
	url: 'https://github.com/Deradon/wow-forever-talent-calc',
};
const upstream: Source = {
	label: 'classic-legacy, the Classic-based engine this sim ran on until the September 2026 switch',
	url: 'https://github.com/ElliotWood/Forever/tree/classic-legacy',
};
const betaClient: Source = {
	label: 'wago.tools: the Forever beta client data tables, build 1.60.1.69913',
	url: 'https://wago.tools/db2/SpellEffect?build=1.60.1.69913',
};
const wowsims: Source = {
	label: 'WoWSims, whose open-source simulators this sim is built on, under their MIT licence',
	url: 'https://github.com/wowsims',
};
const build70009: Source = {
	label: 'wago.tools: what changed between beta builds 1.60.1.69977 and 1.60.1.70009',
	url: 'https://wago.tools/builds-diff?to=1.60.1.70009&from=1.60.1.69977',
};
const wowheadGearPlanner: Source = {
	label: "Wowhead's Forever gear planner data, which the watcher reads",
	url: 'https://nether.wowhead.com/forever/data/gear-planner?dv=100',
};
const rageReport: Source = {
	label: '#252: BrawnyBravo measures white-hit rage from public beta combat logs',
	url: 'https://github.com/ElliotWood/Forever/issues/252',
};
const blizzardForever: Source = {
	label: "Blizzard: World of Warcraft: Forever, the official page the site's art and colours come from",
	url: 'https://worldofwarcraft.blizzard.com/en-us/forever',
};

export const sections: Array<Section> = [
	{
		title: 'The switch to the official engine',
		intro: "On 23 September the sim moved off the Classic-based engine it had been forked from and onto the engine the WoWSims team was building for Forever, whose spell data is generated from the beta client's own tables. Every spec was ported across first, and the switch waited until each one simmed within a few percent of the old engine on equal stats. The old engine is kept on the classic-legacy branch.",
		entries: [
			{
				title: 'The sim runs on the official WoWSims Forever engine',
				prs: [264, 266, 272, 274, 275, 276, 277, 278, 279, 304, 305, 320, 323, 417],
				changed:
					"Each class was ported onto the official engine's skeleton one at a time, mage first as the pilot, then priest, warlock, shaman, rogue, druid, hunter, warrior and paladin. Values are read from the generated client tables wherever those agree with what this sim had already verified; where they disagree the client settles it, and where the generator drops a number (damage ranges stored as their average, percentage mana costs, per combo point damage, threat) this sim's value is kept and the gap logged. Our item data, gear presets, set bonuses and every page (landing, changelog, evidence, scrub, stat weights, arena, rankings, best in slot) came across with it, and the old addresses redirect to the new ones.",
				effect: 'Every number on the site since 23 September comes from the new engine. Old share links, JSON exports and Wowhead Classic gear planner links still open, with their gear and talents. The raid sim page did not survive: the official engine has none, and its old address now lands on the homepage.',
				sources: [wowsims, upstream],
			},
			{
				title: 'The switch waited on a spec-by-spec parity check',
				prs: [306, 307, 310, 325, 330, 336, 357, 369, 376, 395, 396],
				changed:
					'A repeatable check ran all fifteen arena specs on both engines with the same talents, rotation, weapons and stats, and every gap over a percent was traced to one side or the other. Where the client said the old engine was wrong, the old engine was fixed; where it said the new one was, the new one was. Retribution, for instance, started 8.1% apart: the old engine applied Two-Handed Weapon Specialization to the Holy seal hits and always landed Echo of Command, where the client makes the first Physical only and the second a chance.',
				effect: 'Retribution finished 0.8% apart, the warrior 1.0% on equal stats and 2.5% in gear, the bear 1.2% and 0.4%, the Smite priest level. The old engine took about thirty fixes of its own in those two days, which is why the classic-legacy branch does not read quite like the site that ran on it.',
			},
			{
				title: "Forever's rules, re-applied on the new core",
				prs: [266, 280, 336, 377],
				changed:
					"The official engine had no ruleset setting, so the Forever rules apply unconditionally and Classic Era Rules are gone. Three of this sim's rules were already there from client data: which dots can crit is the spell row's own flag, bonus healing's damage half is written on the items, and the core has no Classic world buffs at all. Gear hit and crit paying into both pools, the professions and the rage rules were added. The core also moved from TBC's level 70 numbers to level 60's: armor, glancing blows, spirit regeneration, each class's base stats and base crit, and defense counting towards the chance to be missed.",
				effect: 'Base crit alone was the warrior 1.14% higher and the hunter 1.53% lower than a level 60 character has. Casters no longer lose the hit on items the client writes as melee hit.',
				sources: [upstream],
			},
			{
				title: "The shared raid buffs and debuffs at the client's ranks",
				prs: [307, 331, 341, 345, 370, 383, 404, 422, 469],
				changed:
					"The new engine's shared buffs and debuffs still held TBC's numbers. Each now reads the Forever client's rank: Faerie Fire and Curse of Recklessness 505 armor, Sunder Armor and Expose Armor 450 a stack or combo point, Battle Shout 139 attack power for 3 min, Hunter's Mark a flat 71 ranged attack power, Strength of Earth 53, Grace of Air 89, Mana Spring 25 mana per 5, Leader of the Pack 3% crit, Moonkin Aura 3%, Arcane Brilliance 31 Intellect, Divine Spirit 40 Spirit, Power Infusion 20% magic damage rather than haste, Thunder Clap's slow 20%. Trueshot Aura grants rank 4's 75 ranged attack power, because the client cut rank 5 to 50.",
				effect: "The TBC Battle Shout alone was worth 3 to 9% to every melee spec. Hunter's Mark had been TBC's 440 ranged attack power, with melee attack power on top; correcting it and the totems took the hunters down 10.9%, the fury warrior 6.4% and retribution 4.9%, and frost mage 5.6% from Mana Spring halving.",
			},
			{
				title: 'Items, sets and consumables on the new database',
				prs: [320, 333, 334, 335, 340, 352, 354, 407, 421, 423, 440],
				changed:
					"Our Forever item data was merged into the official database, the client winning wherever it has the row: 1,489 items the beta client does not ship, all 1,147 random suffixes, the set bonuses and 29 item effects the old engine simulated. The client's item rows carry no armor, so 3,810 items had come across with none, the tank warrior's preset among them; shields took their block value from a TBC table; and 203 Classic PvP pieces were still in sets Forever moved onto new items. Classic consumables did nothing at all, because the client gives Classic elixirs no type, and they now work beside Juju, R.O.I.D.S., Rumsey Rum and Dragonbreath Chili slots.",
				effect: "The tank warrior's preset had come to 511 armor against the old engine's 8,594, which doubled its damage taken. The consumables were most of why the new engine's pages first simmed 4 to 14% below the live site. Blade of Eternal Darkness, Highborne Research Tablet and Depleted Eye of Influence stopped proccing on every hit, since the client gives them no rate.",
			},
			{
				title: "Upstream's work, merged while it was public",
				prs: [308, 383, 389, 420, 427, 440, 459],
				changed:
					"Upstream's own commits were merged in rather than copied, so the shared history stayed intact: their warrior and paladin, a spell store that reads every spell straight off the client, generated buffs and debuffs, racials rebuilt from the client, spell interrupt flags and a database regenerated from each new beta build. Where their code and this sim's client-verified behaviour disagreed, the client decided.",
				effect: "Upstream's Holy Shield added 0.3% block rather than 30%, a percent read twice; fixing it on the way in kept protection paladin from losing 9 to 14%. Old share links keep their gear and talents across the renumbered buff fields, and reset buffs to the spec's defaults with a notice.",
				sources: [wowsims],
			},
			{
				title: 'wowsims/forever went private, and the sim carries on',
				prs: [428, 463, 471, 475],
				changed:
					'On 25 September the WoWSims team made their Forever repository private, over AI-made tier lists built from unfinished sims. The upstream merge now skips quietly and would resume on its own if the repository came back. The homepage no longer links the build arena or the damage comparison, and carries an acknowledgement of the announcement; both pages still exist at their addresses. Nothing on the site links back to the official project for money or support.',
				effect: 'The engine is carried forward here on its own, and client data is pulled from Blizzard directly (see Update DB below), so a new beta build still reaches the sim the day it ships.',
			},
		],
	},
	{
		title: 'Talents and rotations on the new engine',
		intro: 'Since the switch: every talent re-audited against the client, the ones that were empty stubs filled in, lower spell ranks made castable, and the 24 September beta patch.',
		entries: [
			{
				title: 'Every talent re-audited against the client',
				prs: [429, 432],
				changed:
					"An audit read each talent's client data against what the sim applies and found 28 wrong, plus Omen of Clarity missing and Spirit Weapons incomplete; each claim was re-checked before changing code. Hot Streak is spent by the next Pyroblast, Arcane Blast's stacks leave out Arcane Missiles, Blizzard and Flamestrike, Stormstrike boosts only its caster's Lightning Bolt, Chain Lightning and Earth Shock, Murder is Humanoid and Giant only, and the rest are masks narrowed or widened to the client's spell lists. A second pass found 16 more: Life Tap is a plain mana gain that no damage talent scales, Demonic Brand is 65 to 68 plus 7.8% of shadow spell power rather than the BlizzCon 39 to 42, and Thorns is 22 a hit.",
				effect: 'Fire mage fell 22.0% and shadow 4.1%; Beast Mastery gained 14.6%, balance 11.8% and feral cat 4.2 to 4.7%. Each move was traced to its fix by reverting the fixes one at a time.',
			},
			{
				title: 'Talents that were empty stubs',
				prs: [461, 465, 466, 467],
				changed:
					"A sweep for talents that did nothing found four. Improved Healing takes 15% off Penance's mana cost. Demonic Pact keeps the Demonic Sacrifice buff while a different demon is out, so a Pact warlock now sacrifices one before the pull, picked beside the pet. The talented Mana Tide Totem restores the party's mana, the shaman's included. Improved Cone of Cold and Improved Frost Nova apply their ladders.",
				effect: 'Demonic Pact 411 to 456 with the Imp sacrificed (+10.9%); Elemental with Mana Tide +2.7% alone, +2.4% with full party buffs; the Smite build 561.6 to 566.7. No shipped rotation casts Cone of Cold or Frost Nova.',
			},
			{
				title: 'Lower spell ranks, and rotations that cast them',
				prs: [447, 448, 449, 450, 451, 452],
				changed:
					"Fireball, Frostbolt, Arcane Missiles, Shadow Bolt, Wrath and Starfire register every rank, so a rotation can cast a lower one; every talent reaches every rank. Each spec's best build was searched rank by rank and mana threshold by mana threshold, and a low-rank rotation was kept only where it cleared 1%. The sim gives a lower rank its full spell power, as the beta does at level 20; whether level 60 adds a penalty is unconfirmed, and the arena tags these rotations so.",
				effect: "Smite +40.8% (rank 2 below 40% mana), balance +14.8% (Starfire rank 1 below 20%), fire +10.2%, elemental +3.6%. Most of fire's gain is dropping an over-cautious mana budget rather than the lower rank, and balance's launch rotation gains 3.2% the same way. No warlock rank wins: Life Tap means the warlock is short of cast time, not mana.",
			},
			{
				title: 'Beta build 70009 and the 24 September patch notes',
				prs: [438, 441, 476],
				changed:
					'Build 1.60.1.70009 changed 2,668 rows in the tables the sim reads. The spell data, items and talent trees were regenerated: Improved Holy Strike and Crusade left the paladin trees, Mangle became Primal Bite and Primal Fury became Blood Frenzy, and saved talent strings were re-encoded. The patch notes were implemented where the client states them: Holy Power masks, Vengeance at 3 stacks, Twist of Light cheapening the seal, Hot Streak at 20 sec, Bloodthrill on all main-hand melee, Improved Slam’s cooldown, Rage of the Farseer without cast speed, Gnome Eureka at 10%, Wizard Oil 24 and one air totem per party.',
				effect: "The warrior's Bastion and Focused Rage swap, Thorns scaling with spell power and Furious Howl's cut are not simulated yet, because the client does not carry them.",
				sources: [build70009],
			},
			{
				title: 'Smaller fixes since the switch',
				prs: [431, 456, 460, 464],
				changed:
					"Stat weights never calculated Intellect for the paladins, reported by AdamRC. A cap of 200 auras on one target stopped a full raid of casters from running at all. Druids drank potions in cat and bear form on cooldown and dropped out of form every two minutes. Penance's three bolts land on the cast and at 1 and 2 sec, as the client states, rather than spread evenly over the channel.",
				effect: "With Champion of the Light, Intellect is retribution's best stat on the test build, 3.30 attack power a point against Strength's 2.50. The bear's arena number had fallen from 410 to 153 from the potion bug.",
			},
		],
	},
	{
		title: 'Where the numbers come from now',
		intro: 'How client data reaches the sim, how it is watched for change, and how each ability says what it rests on.',
		entries: [
			{
				title: "Client data straight from Blizzard's CDN, daily",
				prs: [389, 420, 427, 475, 476],
				changed:
					"The database, the spell store and everything generated from them are built from the beta build on Blizzard's CDN, with the client's hotfix cache applied on top. Update DB does this every day on its own: it regenerates the data, re-blesses the test results, runs the full tests, merges and deploys. A failure opens one issue rather than a broken site.",
				effect: 'A new beta build or a hotfix reaches the sim the day it ships, without waiting on anyone else to regenerate it. Its first merged run brought in 70009 with the hotfixes as of 26 September.',
			},
			{
				title: 'Watchers on Wowhead and the client build',
				prs: [215, 267, 390, 391, 438],
				changed:
					"A scheduled job reads Wowhead's Forever gear planner data and opens a pull request listing every item and enchant that changed; a second watches the client build and reports what moved in the tables the sim reads. Both merge themselves, because they only change a snapshot and a report, never the sim's data or rules.",
				effect: 'Nothing Wowhead or Blizzard changes goes unnoticed. The first run found 4,492 items Wowhead had added; 69977 changed nothing the sim reads, and 70009 changed 2,668 rows.',
				sources: [wowheadGearPlanner],
			},
			{
				title: 'Hotfixes checked, not assumed',
				prs: [217, 219],
				changed:
					'Blizzard tunes values after a build ships, and those hotfixes never reach a datamining site. The client keeps one cache file per table it has hotfixed, and a table with nothing to cache gets a 4 byte stub, so the file sizes say which tables have changed.',
				effect: 'On 19 September the client held 1.3 MB of item hotfixes and a 4 byte Spell stub: no spell value in the sim was stale. The daily Update DB now applies the hotfixes itself.',
			},
			{
				title: 'Every ability says where its numbers came from',
				prs: [221, 223, 244, 245, 250, 251, 432, 468],
				changed:
					"Every ability the sim registers is classified as read from the Forever client, confirmed unchanged from Classic, or still carrying an assumption that it names. On screen, an assumed ability's icon carries a small gold dot, and the evidence page lists all of them with the tooltip, the assumption and the file. An entry can also record a measurement from the game itself.",
				effect: 'By 19 September the unreviewed count reached nought: 297 unchanged from Classic, 656 from the client, 43 assumed. Every damaging spell in an arena build now has an entry, which took the rogue’s unconfirmed share of damage from 40% to nought and enhancement’s from 24.5%.',
			},
			{
				title: "Asking beta players for their client's files",
				prs: [231, 232, 233, 234, 235, 236, 237, 238, 239, 246, 248, 249],
				changed:
					"The homepage asks beta players for two files. DBCache.bin holds the hotfixes their client downloaded and nothing about them. DamageMeter.bin is the client's own damage meter, the only measurement there is while Forever blocks addons from reading damage; it carries the names of everyone the player grouped with, so the scrub page takes the names out in the browser before anything is sent, and the upload refuses a file that has not been scrubbed. Neither needs a GitHub account. The Discord link inherited from upstream went, since it was never this project's.",
				effect: "The first meter file was the first time anything in the sim was checked against a running game: Earth Shock rank 1's biggest hit was 20 where the client says 17 to 19 plus 0.5 a level, and Healing Wave rank 1's 46 against 34 to 44 plus 0.7. The client data held.",
			},
		],
	},
	{
		title: 'The beta client',
		intro: 'Everything in the sections below this one was read off BlizzCon 2026 demo tooltips. On 17 September the beta client was datamined, and the numbers came from its own data tables instead: build 1.60.1.69913 on wago.tools, read against Classic Era 1.15.9.69722 and diffed spell by spell. What it found is below, and most of it is the fork having been wrong. This was all done on the old engine; the new one reads the same client tables directly, and the fixes it did not already have were carried across.',
		entries: [
			{
				title: 'The client is the source now, not a screenshot',
				prs: [180, 181, 182, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 214],
				changed:
					"Talent values come from the client's rank curves, spell power coefficients from SpellEffect.EffectBonusCoefficient, and each rank's damage is scaled to level 60 by the client's own per-level points. Every class's spellbook was diffed against Classic Era to catch abilities Forever changed without announcing. tools/data_watch/spell_client.py reads any of it on demand, and a watcher opens a pull request when the client build moves.",
				effect: "The checklist said the level 30 cap meant the beta would settle neither the level 60 ranks nor the coefficients. That was wrong: the cap limits what a tester can play, not what the client ships. 586 abilities now carry the client's numbers, 246 are confirmed unchanged from Classic, and 41 still hold a value the client does not settle.",
				sources: [betaClient],
			},
			{
				title: 'The raid buffs were still Classic’s',
				prs: [200, 228, 241, 242],
				changed:
					"sim/core never got a beta pass while the nine class passes ran, so every raid buff kept Classic Era's numbers. Battle Shout gave 232 attack power against Forever's 139, Blessing of Might 185 against 133, and Trueshot Aura 100 melee attack power that Forever's version does not grant at all. Windfury Totem, Strength of Earth, Grace of Air, Mark of the Wild, Shadow Weaving, Curse of Recklessness and Hunter's Mark were all out too.",
				effect: 'Roughly 300 attack power every melee build was carrying and should not have been, while casters got none of it. Fury fell 10.8%, the rogues 9 to 11%, enhancement 8.1%, retribution 4.4%; every mage, elemental, moonkin and shadow priest moved less than half a percent. The melee half of the damage comparison had been about 11% too high against the caster half. Two days later the durations followed: Battle Shout lasts 3 min and the Strength of Earth and Grace of Air totems 5, where the code had Classic’s 2 (Battle Shout’s own comment already said 3), and Curse of Recklessness stopped handing the boss 90 attack power, a clause Forever’s tooltip deleted and a value check could not see.',
				sources: [betaClient],
			},
			{
				title: 'Rage conversion used XOR where it meant a square',
				prs: [201],
				changed:
					'GetRageConversion read `attacker_level^2`. In Go `^` is a bitwise XOR, not a power, so level 60 was treated as 60 XOR 2 = 62 and the conversion came out 198.37 instead of Classic’s 230.60. The under-45 branch had the same typo.',
				effect: 'Every rage user generated 16.2% too much rage. Fury felt it hardest because the surplus went straight into Heroic Strike: 39.7 Heroic Strikes against 9.8 white main-hand swings, with 26 rage wasted out of 1876 generated. Fury fell another 3.5%, the bear tank 2.8%.',
			},
			{
				title: 'Boss debuffs, and a misread in the warrior pass',
				prs: [202, 230],
				changed:
					"Demoralizing Shout 146 to 204 attack power and 30 to 45 seconds, Demoralizing Roar 138 to 204, Curse of Weakness -31 to -37, Judgement of Wisdom 10 to 40 seconds. The warrior pass had asked for Demoralizing Shout to go the other way, to 140, reading the client's -196 as Classic's 140 plus the talent's 40%. That compares the client's untalented base points against the sim's level-adjusted value; Era settles it. The talent was then multiplied on top as well, and that was wrong: Forever folds Improved Demoralizing Shout and Roar into the base value, the ratios to Era are exactly the talent's 1.40 and 1.48, so the shout was taking 285 attack power off the boss rather than 204.",
				effect: 'Damage taken fell about 2.8% on all three tanks, and #230 gave back about 2.7% of it when the double count came out. Following the pass as written would have made the debuff 30% weaker instead of 40% stronger.',
				sources: [betaClient],
			},
			{
				title: 'Every item set Forever changed',
				prs: [203, 206, 207, 333, 334, 335, 354],
				changed:
					"ItemSetSpell says 109 of 531 sets have different bonuses to Classic, and 38 of those are sets the sim implements. Dungeon sets 1 and 2 moved from 2/4/6/8 thresholds to 2/3/4/5/6, so a set pays out fully at six pieces instead of eight and the four piece is now a PvP break with nothing for a sim to do. Crusader's Wrath and The Furious Storm are 65 spell power where the sim had 95, and Rogue Armor Energize gives 20 energy where it had 35. The Scholomance and Stratholme sets, Imperial Plate, Ironweave, Spirit of Eskhandar and nine PvP sets moved with them.",
				effect: "No Launch gear set completes any of them, so the damage comparison does not move; this is for people simming their own gear. Three things fell out along the way: Wildheart Raiment was declared twice and which copy applied depended on package registration order, The Five Thunders' six piece was repeating its own two piece instead of granting spell damage, and Cadaverous Garb's five piece was adding 2 hit rating where its comment said 2%. The sets came across to the new engine in the switch, and the Classic PvP pieces left their sets altogether: Forever moved its PvP sets onto new items, and a rogue's pre-raid Champion's Guard pair had still been paying 40 attack power.",
				sources: [betaClient],
			},
			{
				title: 'Hand of Justice procs at 1%',
				prs: [204, 349],
				changed:
					"Era's tooltip hardcodes a 2% chance and the client holds 2. Forever's reads “${$h/3}% chance on Melee hit” with the chance field at 3, and adds that attacks against Dwarves are three times as likely. The field is still a percent, so the division is the new part.",
				effect: 'A warrior loses about 1%. It is the only item proc Forever changed that any shipped gear set equips; the other 38 sit on items no preset uses. This one is a reading of a tooltip formula rather than a value in a column, so it is the change here most worth a second opinion. The new engine had no extra attacks at all until the switch gave it a hook, so Hand of Justice and Hack and Slash did nothing there; both now pull the next swing forward, at the client’s 1% and a 2 sec cooldown for Hand of Justice.',
				sources: [betaClient],
			},
			{
				title: 'Arms was wearing Fury’s weapons',
				prs: [208],
				changed:
					"A build takes its gear from the raid preset whose talent tree matches, and the warrior had one preset. So the Arms build in the damage comparison was handed Fury's dual-wield set: 70.92 off-hand swings at 124 damage each, against 32.37 main-hand at 396, and 26.46% of white hits missing. Arms has no Dual Wield Specialization to pay for that, and its Two-Handed Weapon Specialization was doing nothing at all. It now has its own two-handed Launch set, the way the rogue already had one set for Mutilate and another for Sinister Strike.",
				effect: 'Arms gains 9% on identical buffs and rotation, and moves from twelfth to ninth. It does not close the gap to Fury, which is worth saying plainly: Fury generates 1470 melee rage to Arms’ 640, and that is Forever’s own Dual Wield Specialization doubling off-hand rage, confirmed in the client.',
			},
			{
				title: 'Abilities describe themselves again',
				prs: [209, 210, 221, 223],
				changed:
					"ui/core/spells carries a name and a tooltip for every ability the sim registers, written from the implementation's own numbers, and a test keeps it true. Nothing read it at runtime. Now the damage tables take the name from it when Wowhead has none, and abilities Forever changed show the manifest's tooltip instead of Wowhead's Classic entry.",
				effect: "Lava Burst was 17% of the elemental shaman's damage and arrived as a blank row, because Wowhead has never heard of Forever's spell id. Hovering Lightning Bolt quoted Classic's 265 mana and 3 second cast over a spell the sim runs at 220 and 2.5. The manifest was also filing damage and tick counts as spell ids, so Rend's `damage: 5` rendered as Death Touch; 14 such entries went.",
			},
			{
				title: 'Paladin: Improved Seals and Judgement',
				prs: [211],
				changed:
					"Improved Seals is a percent modifier, so it scales a whole spell. The sim multiplied the base damage roll by it and left the spell power coefficient's share out, which meant a paladin got less of the talent the more spell power he carried. Forever also widened it from “your Seal of Righteousness and Judgement of Righteousness” to “your Seals and Judgements”. Judgement was also deactivating the seal on every cast, where Forever's tooltip says in as many words that it does not consume it.",
				effect: 'Retribution gains 6.2%, 1.4% of it from the talent and 4.7% from the seal staying up; protection gains 1.8%. Both were reported by AdamRC in the Forever Discord.',
				sources: [betaClient],
			},
			{
				title: 'Warlock: Shadow Mastery, twice on one spell and never on another',
				prs: [212],
				changed:
					"Classic's Shadow Mastery carries a spell effectiveness modifier that scales base points only, so four spells were singled out to multiply their own base damage and opt out of the spell multiplier. Forever dropped that effect, leaving two straight percent modifiers. The exclusion list had also drifted: Siphon Life multiplied its base damage and was never in it, so it took the talent twice, and Drain Soul was in the list but multiplied nothing, so it took none at all.",
				effect: 'Affliction gains 0.3%. The gains and the Siphon Life loss nearly cancel, which is how a genuine double-count was worth almost nothing and stayed hidden. Found by sweeping for the shape of the paladin bug rather than by noticing it.',
				sources: [betaClient],
			},
			{
				title: 'A crash on crit heals',
				prs: [199],
				changed:
					'Blood Craze is a heal over time and carries no DefenseType, because heals are not defended against. Under the Forever ruleset every dot can crit, so its first crit tick reached a panic meant to catch damage spells with no DefenseType. Helpful spells now take the 150% heal crit instead.',
				effect: 'Any warrior with a point in Blood Craze took the whole simulation down with a stack trace.',
			},
			{
				title: 'Every item proc, read one at a time',
				prs: [224, 225, 226, 227, 243, 244, 245],
				changed:
					"Every item proc the sim registers was diffed against the client. Most were retuned: Ragehammer's 20 flat damage is 102 attack power in Forever, its wording changed along with the number, and a straight swap would have given 102 damage a swing. Some were redesigned: Skullflame Shield steals 270 with no spell power coefficient where it stole 35 at a coefficient of 1.0, and The Cruel Hand of Timmy steals life instead of lowering stats. Frightalon and Smolderweb's Eye lost their damage for utility, and the Eye had been registered as a damage cooldown firing for nothing. Expose Armor is 450 a combo point, read from a field a base-points reader sees as nought, and Improved Expose Armor no longer touches armor. The Firestone is a spell crit and fire damage imbue with no proc.",
				effect: "Only Rivenspike, halved from 200 armor a stack to 100, touched a shipped gear set: the warrior lost about 0.4%. The Hand of Antu'sul and the Emerald Dragon Whelp's Acid Spit hit about six times harder than they did. By the end every ability the sim registered said where its numbers came from.",
				sources: [betaClient],
			},
			{
				title: 'Shadow Weaving is the priest’s own buff',
				prs: [222, 229],
				changed:
					'Forever turned Shadow Weaving from a shadow vulnerability on the target into a buff on the priest, and the priest code already applied it that way. The raid debuff panel still offered the Classic version under Forever, because the test fixture blanked it by hand rather than the engine refusing it, and a two or three point priest wore spell ids Forever had deleted.',
				effect: 'Any shadow spec could switch on a free 10% shadow vulnerability that does not exist in Forever, on top of the priest’s own buff. The panel stopped offering it under Forever.',
				sources: [betaClient],
			},
			{
				title: 'Spearing Strike, which no rotation cast',
				prs: [218],
				changed:
					'Spearing Strike is new in Forever, and the warrior pass implemented it and noted that no rotation cast it. The Arms 39/12/0 build spends a point on it. It goes in after Mortal Strike in both warrior rotations. An audit of every castable spell against the shipped rotations turned up the rest, most correctly absent.',
				effect: 'Arms 625.8 to 632.4 DPS on its own gear (+1.05%). Nothing else moves; neither the Fury build nor the test build takes the talent.',
			},
			{
				title: 'Every enchant checked against the client',
				prs: [299, 366],
				changed:
					"All 173 enchants were read against the client's enchant table and 55 corrected. Health and mana enchants are stamina and intellect, most minor and lesser values went up, glove Greater Agility and Strength give 10, Weapon Spell Power is 30 spell power rather than damage only, and the two-handed Impact enchants did nothing at all before. Crusader is 100 Strength at level 60; the new engine had carried TBC's 60.",
				effect: 'Imported gear resolves, because 20 enchant ids moved to Forever’s new ones. A rogue with Crusader on both weapons gained about 1% on the new engine.',
				sources: [betaClient],
			},
			{
				title: 'A second client check, against a combat log',
				prs: [300, 301, 302],
				changed:
					"A local beta client and a beta combat log settled a batch the tables alone could not. Rip, Ferocious Bite, Eviscerate, Rupture and Expose Armor refund 80% of their Energy on a miss; the log shows 28 of 35 back on a missed Eviscerate. Judgement of Righteousness is a melee attack that crits for 200%, as the log's one crit shows. Shield Block blocks two attacks, Sweeping Strikes lasts 20 sec, and the hunter pet's top Bite is 81 to 99, where a typo had 81 to 91.",
				effect: 'Retribution and protection gained 0.2 to 2.3% from the judgement crits alone, feral 0.8 to 2.5% and the rogues up to 2.6% from the refunds.',
			},
			{
				title: 'Reading the client, written down',
				prs: [186, 187, 213],
				changed:
					'spell_client.py reads a spell as the sim needs it, spell_diff.py and set_diff.py diff ids and set bonuses between the two clients, and talent_text_diff.py compares talent wording with the numbers stripped out.',
				effect: 'The last one exists because curves say what a talent’s values are and not what it applies to, which is how Improved Seals passed a value check while pointing at the wrong spells. 231 talents read differently in Forever.',
			},
		],
	},
	{
		title: 'The rules of the game',
		intro: 'Engine rules Forever changes. Until the switch they were gated on a Forever Rules setting, with Classic Era Rules under Sim Options; the official engine is Forever-only, so since 23 September they simply apply.',
		entries: [
			{
				title: 'A Forever ruleset, on by default',
				prs: [1, 43, 266],
				changed: 'The sim carried a ruleset setting, Forever or Classic Era. New sessions started on Forever; the header said which one was running.',
				effect: 'Every change below was gated on it, and flipping to Classic Era Rules simulated the Classic sim the fork came from. The official engine has no such setting, so the toggle went with the switch; the classic-legacy branch still has it.',
				sources: [upstream],
			},
			{
				title: 'Periodic damage can crit',
				prs: [1, 16, 266, 311, 313, 317, 318, 362, 364, 372, 394],
				changed:
					'Damage-over-time ticks and bleeds roll for critical strikes. It was a blanket rule read from the wording of the new talents (Pandemic, and the "non-periodic" qualifiers on others), with Ignite excluded since it is already a share of a crit. The client settles it per spell: each row carries a Periodic Can Crit flag, and the new engine reads it. Siphon Life, Deep Wounds, Devouring Plague and Lacerating Strikes do not carry it; Deadly Poison, Serpent Sting and Flame Shock do, and Serpent Sting rolls the ranged crit table because the client files it as a ranged attack.',
				effect: 'Every dot-heavy build gained; the warlock builds and the shadow priest most of all. The four that lost their crits cost their specs a fraction of a percent on average, and up to 3% on the settings that lean on them.',
				sources: [communityTalents, wowheadTalents],
			},
			{
				title: 'Hit and crit from gear count for every kind of attack',
				prs: [18, 266, 325],
				changed:
					"An item's melee and spell hit are summed and paid into both pools, and the same for crit. Attribute conversions are untouched. The new engine got the same rule in the switch.",
				effect: 'Hybrids and casters stop wasting the melee hit and crit on their gear, and hunters and enhancement stop wasting spell crit. On the old engine it had counted every rated item twice once the database paid the rating into both pools itself: Bloodvine Vest’s 2% spell hit came out as 4%, and fixing it cost the melee specs 4 to 9%.',
				sources: [blizzardPanel],
			},
			{
				title: 'Bonus healing carries a damage component',
				prs: [19, 266],
				changed:
					'A third of the healing power on gear was added to spell damage. The client writes the damage half on the item itself (Hide of the Wild: 42 healing and 14 spell damage), so the new engine adds nothing, which would count it twice.',
				effect: 'Healing gear becomes usable by damage casters; the smite priest and the paladins gain the most.',
				sources: [blizzardPanel],
			},
			{
				title: 'Rage from white hits is flat',
				prs: [253, 266, 387, 389, 392, 395],
				changed:
					'Measured from public beta combat logs: a landed auto attack pays rage by weapon speed, not damage, and a miss, dodge or parry pays nothing. The rate is 3.46 times the weapon’s speed one-handed and 4.5 two-handed, off-hand swings pay half, and a hit taken pays its damage before armor times 10 over maximum health. Heroic Strike and Cleave replace the next swing, as the client flags them and 13 of 14 Heroic Strikes in the beta log land on it, where upstream had made them instant.',
				effect: "Classic pays by damage, and a raid-geared warrior swings well past the roughly 280 damage where the two agree on a 2.6 sec one-hander, so the flat rule took the arena warrior's best build from 1002.2 to 885.2 DPS. The 3.46 rate and the halved off hand cost the dual-wield warrior another 10.6%, the new damage-taken rule the bear 19%. Upstream's instant Heroic Strike had run Cleave off the global cooldown on top of every swing.",
				sources: [rageReport],
			},
			{
				title: 'The old raid debuffs are personal now',
				prs: [15, 65, 66, 69, 222, 272, 275],
				changed:
					"Improved Shadow Bolt, Shadow Weaving, Improved Scorch, Winter's Chill and Stormstrike's Nature vulnerability only raise the damage of the caster who applied them. Improved Shadow Bolt lasts a flat twelve seconds. The raid panel no longer offers them under Forever.",
				effect: 'Stacking casters loses its Classic payoff: four warlocks no longer share one Improved Shadow Bolt, and a fire mage is not buffing the raid with Scorch. Each caster keeps their own bonus. Shadow Weaving had slipped through as a raid debuff until #222; on the new engine each class port applies its own to its caster alone.',
				sources: [blizzardPanel],
			},
			{
				title: 'World buffs do not work inside raids',
				prs: [89, 91, 266],
				changed:
					"Rallying Cry, Songflower, Darkmoon Faire, Warchief's Blessing, the Dire Maul tribute buffs and Spirit of Zandalar are ignored under Forever Rules, off in every default, and the World Buffs section only shows under Classic Era Rules.",
				effect: 'Every number on the site fell by a quarter to two fifths against the world-buffed Classic sims, and the gap between physical and caster specs narrowed from 30 to 21 points, because those buffs paid out in crit and attack power. Reported from the demo, not yet in patch notes. The official engine has no Classic world buffs to switch off.',
				sources: [worldBuffsReport, worldBuffsClip],
			},
			{
				title: 'Racials reworked, the Skyborne, six new race and class pairings',
				prs: [20, 21, 59, 440],
				changed:
					"Every race has two actives and two passives. The resistance racials are gone; weapon skill racials became crit while the weapon is held; Blood Fury, Expansive Mind, Elune's Light, Big Game Hunter and the Skyborne racials are modelled. Dwarf shamans, Undead paladins and the rest of the new pairings can be simulated.",
				effect: 'Race choice moves numbers by a few percent as before, but for different reasons; a Skyborne is available to Warrior, Hunter, Rogue, Druid, Horde Shaman and Alliance Mage. On the new engine the racials were rebuilt from the client by upstream and merged in.',
				sources: [wowheadRacials, blizzardAnnounce],
			},
			{
				title: 'Profession passives with published numbers',
				prs: [75, 266],
				changed: 'Skinning is +5% damage against Beasts and Dragonkin; Mining is +5% health.',
				effect: 'Only shows against a target of those types; Molten Core bosses are not, so the presets are unaffected.',
				sources: [blizzardPanel],
			},
			{
				title: 'Baseline ability changes',
				prs: [77],
				changed:
					'Slam no longer resets the swing timer, Thunder Clap works in Defensive Stance, Improved Shield Wall shortens the cooldown, Tactical Mastery is baseline. Victory Rush is not modelled (it needs a killing blow).',
				effect: 'Warrior only; nothing concrete has been published for the other classes yet.',
				sources: [blizzardPanel],
			},
		],
	},
	{
		title: 'Talents',
		intro: 'The nine Forever talent trees, read from BlizzCon demo tooltips, and what the sim does with them.',
		entries: [
			{
				title: 'Nine classes on the Forever trees',
				prs: [2, 1, 3, 5, 6, 8, 10, 11, 12, 13, 261, 279, 441],
				changed:
					"The trees were imported from tooltip data extracted at BlizzCon, then each class converted: new talents implemented where the tooltip gave enough to go on (Mangle, Berserk, Eclipse, Lava Burst, Lightning Overload, Maelstrom Weapon, Mutilate, Arcane Blast, Hot Streak, Ice Lance, Sniper Shot, Lone Wolf, Weaponmaster, Bloodthrill, Penance, Holy Nova, the paladin's Holy Strike and its dependents, and more), and Classic talents that Forever removed taken out.",
				effect: "Every build on the site is a Forever build. Talent strings are positional, so a Classic talent string will not load. On the new engine the trees are generated from the client's own talent tables; the hunter's parked Improved Serpent Sting node is dropped so our strings load unchanged, and saved strings were re-encoded when build 70009 took two talents out of the paladin trees.",
				sources: [communityTalents, wowheadTalents],
			},
			{
				title: 'The trees look and read like the published ones',
				prs: [44, 58, 60, 62, 48],
				changed:
					'New talents have icons and tooltips; positions match the published grids; Improved Fireball and the five-rank Shatter came back; talents the sim does not read are marked as such in the picker.',
				effect: 'What you click is what the sim runs, and the picker tells you when it is not.',
				sources: [wowheadTalents, communityTalents],
			},
			{
				title: 'Talent numbers audited against the tooltips',
				prs: [73, 47, 9, 17],
				changed:
					"Eight discrepancies fixed (Precision as spell hit, Holy Shield, Barrage on Aimed Shot, Mind Flay and Pyroblast base damage, Call of Flame on Lava Burst and Flame Shock, Savage Fury on Shred); the paladin's Forever talents implemented; the talents whose per-rank scaling was never shown are listed for the beta.",
				effect: 'Shadow priest +20% from Mind Flay alone, Elemental +5%, the rest one or two percent. Higher ranks of the demo-only talents are extrapolated from rank one until the beta shows them.',
				sources: [communityTalents],
			},
			{
				title: 'The community builds, everywhere',
				prs: [63, 71, 67, 78],
				changed:
					"Thirty-one community builds are talent presets in their specs, listed under each class on the homepage, and each spec's automatic rotation follows the build's tree (a Fire build casts the Fire rotation, a Mutilate rogue uses daggers).",
				effect: 'The rankings and the spec pages simulate the builds people are actually discussing.',
			},
			{
				title: 'Three paladin talents scale with the points spent on them',
				prs: [132],
				changed:
					"#126 put per-rank numbers into the trees on the understanding that the sim already scaled with points, and three paladin talents did not. Sacred Duty gave 2% Stamina at both ranks where the tree reads 2%/4%, Shield Specialization absorbed 10% and returned mana on 33% of blocks at every rank where the tree reads 10/20/30% and 33/66/100%, and Instrument of Law shaved half a second off Hammer of Wrath and 10% threat at both ranks where the tree reads 0.5/1 sec and 10%/20%. All three read the tree's numbers now. None is confirmed: only rank 1 was shown on the demo, so the beta checklist keeps them.",
				effect: 'Protection 418 to 425 DPS and 557 to 571 threat on the ranked build; retribution 624 to 626 DPS and 584 to 521 threat, an instant Hammer of Wrath for twice the threat reduction.',
				sources: [communityTalents],
			},
			{
				title: 'Two hunter talents stop promising a scaling they never had',
				prs: [134],
				changed:
					'#126 put per-rank numbers into the trees on the understanding that the sim already scaled with points, and for the hunter the tree was the side that overreached. Deadly Aspects read a 2/4/6/8/10% chance of +30/60/90/120/150% attack speed for 12/24/36/48/60 sec where the sim scales only the chance, as the Classic Improved Aspect of the Hawk it is built from does; the tree now scales the chance alone. Rapid Recuperation read 15/30 sec where the sim holds the window at 15, the way Resourcefulness and Expose Prey hold theirs. The other five stamped hunter talents were checked rank by rank and already agreed. None is confirmed: only rank 1 was shown on the demo, so the beta checklist keeps them and gains one.',
				effect: 'No simulated number moves; the talent picker stops showing a five point Deadly Aspects as +150% attack speed for a minute.',
				sources: [communityTalents],
			},
			{
				title: 'Four druid talents where the tree and the sim disagreed',
				prs: [135],
				changed:
					"The same audit as #132, run over the druid. Natural Reaction rolled a flat 20% chance at 5 Rage on a dodge at every rank where the tree reads 20/40/60/80/100% and its own dodge half already scaled, so the proc scales now. Three tables went the other way, because repeating rank 1 would have left the extra points inert: Furor now reads 20/40/60/80/100% for its shift chance, Energy carryover and cap and 2/4/6/8/10 Energy per second out of form, Primal Fury reads 50%/100% on both halves, and Eclipse's third rank reads the 0.51 sec that three ranks of 0.17 make rather than a rounded half second. None is confirmed - only rank 1 was shown on the demo - so the beta checklist keeps all four and gains two entries.",
				effect: 'The tank build gets Rage on every dodge instead of one in five: 739.6 to 740.8 DPS and 2250 to 2257 threat, with dodge worth far more to it than before. Balance and feral are unchanged.',
				sources: [communityTalents],
			},
			{
				title: 'Fingers of Frost pays for its second point, Shatter shows all five ranks',
				prs: [136],
				changed:
					'The same #126 assumption that caught the paladins caught the mage twice. Fingers of Frost proced on 15% of chills at either rank where the tree reads 15%/30%, so the second point did nothing; it is read per point now. Shatter has run to five ranks since the trees were corrected, but its rank table stopped at three, so 4/5 and 5/5 showed no number in the picker; it reads 10/20/30/40/50, which is what the sim already applied. Neither is confirmed - the demo showed Fingers of Frost only at rank 1 and Shatter only at Rank 3/3, where it read 50% - so the beta checklist keeps both.',
				effect: 'Frost 528 to 559 DPS on the ranked build, from twice as many Fingers of Frost procs and the Ice Lances they pay for. Arcane and fire are unchanged.',
				sources: [communityTalents],
			},
			{
				title: 'Warlock talents stop scaling past the top of their scale',
				prs: [137],
				changed:
					"The warlock carried ten of #126's per-rank stamps and the two worst divergences were not among them. Shadow and Flame read its 20% chance not to consume Immolate per point, so at 5/5 Conflagrate never consumed Immolate, and Decimation cut Soul Fire's minute cooldown by 45% per point, so 2/2 left six seconds. Both read flat in the tree and are flat now. The other way round, the per-rank pass had scaled slots that are not magnitudes - Improved Drains' execute threshold, Decimation's window, Demonic Brand's duration, stacks and damage, Improved Shadow Bolt's debuff length and Aftermath's Daze, which reached a certain Daze and a 250% slow at 5/5 - and those go back to rank 1's value, which is what the sim has always applied. Only rank 1 of every warlock talent was ever displayed, so the beta checklist keeps all of them and grows from four entries to twelve.",
				effect: 'Shadow and Flame 671.5 to 670.2 DPS on the ranked build; no preset rotation casts Soul Fire, so Decimation does not move the other three. Four of the ten stamped talents turn out to have no implementation in the sim at all.',
				sources: [communityTalents],
			},
			{
				title: 'The rogue picker stops promising two things the sim never rolled',
				prs: [138],
				changed:
					"Cutthroat read a flat 3% chance at all five ranks because the datamined pass copied rank 1 into the rest, while the sim has always rolled 3% per point, so a 5/5 rogue was told 3% and got 15%; the tree scales the chance now and keeps the 10 sec duration. Quietus extrapolated its execute threshold along with its damage, so the picker offered 'targets below 175% health' at 5/5, where the sim holds rank 1's 35% because a threshold cannot scale. The three stamped rogue overrides were checked against the code and their numbers hold, but the calculator they were checked against is rebuilt from the same demo footage, so the reasons say extrapolated rather than confirmed.",
				effect: 'No simulated number moves, every rogue result is unchanged. What the picker shows is now what the sim rolls.',
				sources: [communityTalents],
			},
			{
				title: 'The warrior picker stops promising what the sim does not roll',
				prs: [139],
				changed:
					"Three warrior talents described something the sim never applies. Unbridled Wrath and Improved Shield Wall repeated rank 1 at every rank, a 12% chance and 5.5 min, where the sim reads the 12% per point and takes another 5.5 min off the cooldown for the second point, so the picker showed points that buy nothing. Enrage promised 30/60/90/120/150%, a chance no roll can meet, extrapolated from Classic's Enrage where that scale is the damage bonus and the chance is flat at every rank; the tree now reads the capped 30/60/90/100/100 the sim rolls. Weaponmaster's numbers, the fourth checked, match the sim exactly. Nothing here is confirmed: only rank 1 was shown on the demo, so the beta checklist keeps all four and gains an entry for Enrage.",
				effect: 'No simulated number moves. What the picker shows a warrior is what the sim does with the points.',
				sources: [communityTalents],
			},
			{
				title: 'Two shaman talents stop promising a scaling they never had',
				prs: [140],
				changed:
					'#126 put per-rank numbers into the trees from a community talent calculator that extrapolates every number in a tooltip, and two shaman talents came out promising more than the talent gives. Maelstrom Weapon read 5 to 25 stacks lasting 30 to 150 sec where five stacks of 4% per point already reach a free instant Lightning Bolt at 5/5, and Improved Stormstrike read a 30 sec window at rank 2 where both ranks run 15 sec. Both tables now read what the sim applies, and only the per-point halves scale. The rest of the shaman tree already agreed. Elemental Fury also missed Fire Nova Totem entirely, where Searing and Magma Totem were named by hand.',
				effect: 'The picker no longer shows shaman numbers the sim will not honour, and Fire Nova Totem crits for the full Elemental Fury bonus. No ranked build changes, none of the shipped rotations drops Fire Nova Totem.',
				sources: [communityTalents],
			},
			{
				title: 'Tests that pin the trees together',
				prs: [68],
				changed:
					'Go tests check that every tree, its proto message, the class tree sizes and every shipped build agree, and that every build link on the homepage names a real preset.',
				effect: 'Three separate incidents in this program would have been caught before deploy.',
			},
		],
	},
	{
		title: 'Content and items',
		intro: "Forever launches on 4 November 2026 with Onyxia's Lair and Molten Core as its first raids (9 December), and nothing past them.",
		entries: [
			{
				title: 'The item pool is launch content only',
				prs: [46, 25, 27, 29],
				changed:
					"Blackwing Lair, Zul'Gurub, Ahn'Qiraj and Naxxramas items, sets and effects are out of the database; the sim's phases are Forever's tiers; Onyxia is the one tier 1 encounter with a known fight.",
				effect: 'Gear pickers and the best in slot page only show what exists at launch. The two new raids (Barrow Deeps, Hyjal Summit) have no encounter until their bosses are announced.',
				sources: [wowheadOverview, wowheadRoadmap, blizzardAnnounce],
			},
			{
				title: 'Launch gear for every spec',
				prs: [26, 28],
				changed:
					'Pre-raid gear sets generated from the launch pool for the specs that had none (Retribution, Protection Paladin, Smite Priest and others), named as tiers in the UI.',
				effect: 'Every spec in the rankings wears comparable, launch-tier gear.',
			},
		],
	},
	{
		title: 'Specs and rotations',
		intro: 'What runs, and what was made to run properly.',
		entries: [
			{
				title: 'Smite Priest',
				prs: [31],
				changed: 'A holy damage priest, which Classic never had a reason to run.',
				effect: 'One more spec in the rankings.',
			},
			{
				title: 'Rotations that use the kit',
				prs: [35, 36, 37, 24, 49],
				changed:
					'The protection warrior stopped running the fury priority, the balance druid casts more than Wrath rank four, the arcane mage stopped going out of mana on Arcane Blast stacks, the feral got its bleeds and a rotation.',
				effect: 'Several specs moved by a large fraction of their DPS; these were bugs in the shipped presets, not Forever changes.',
			},
			{
				title: 'Warlock rotations by build',
				prs: [100],
				changed:
					'Demonic Pact runs with the Imp sacrificed, a Succubus out and Soul Link up; DS/Ruin summons its own Imp before sacrificing; every warlock keeps Immolate up, curses when nobody else has, and drinks when mana allows. Shadow and Flame has its own rotation. One raid preset per tree carries the pet setup each rotation expects, and the community builds are preset builds.',
				effect: 'Demonic Pact +41%, Deep Affliction +13%, DS/Ruin Pandemic +3%, Shadow and Flame +4% at two minutes; more at five, where Life Tap was a tenth of the fight.',
			},
			{
				title: "Feral cat: Tiger's Fury as the energy engine",
				prs: [105],
				changed:
					"Tiger's Fury takes Wrath's shape (no Energy cost, 30 sec cooldown) so King of the Jungle's 60 Energy is a cooldown rather than something to spam, the cat rotation casts it on cooldown, and Rake is dropped: it cost two fifths of the cat's Energy for a twentieth of its damage.",
				effect: "The ranked Feral Cat build goes from 393 to 478 DPS on a two minute fight, still the lowest of the melee, because Forever's Furor no longer hands out 40 Energy per shift.",
				sources: [communityTalents],
			},
			{
				title: 'Warlock: Decimation stops boosting everything',
				prs: [115],
				changed:
					"Decimation multiplied the warlock's whole damage output below 35% health, where the tooltip gives the bonus to the Shadow Bolt and Searing Pain that trigger it, and Demonic Knowledge paid its spell damage out with no demon summoned. The four rotations also start a dot refresh while the dot is still ticking instead of after it falls off.",
				effect: 'Demonic Pact -0.5%, Deep Affliction +0.7%, DS/Ruin Pandemic +0.7%, Shadow and Flame +0.6% on a two minute fight; Immolate and Corruption uptime up by a fifth and a twentieth.',
				sources: [communityTalents],
			},
			{
				title: 'Warrior: the off-hand misses again, and arms strikes',
				prs: [108],
				changed:
					"Queuing Heroic Strike lifted the dual wield miss penalty for the whole character instead of for the queued swing, so a Fury build's off-hand auto attacks almost never missed. The DPS priority list had no Mortal Strike line, so the ranked Arms build ran a Fury rotation, and Protection never cast Thunder Clap even though Forever allows it in Defensive Stance.",
				effect: 'Fury -1.5%, Arms +5.2%, Protection +1.8% DPS and +4.9% threat on a two minute fight.',
				sources: [communityTalents],
			},
			{
				title: 'Paladin: Holy Strike on its tooltip, Judgement paying its talents',
				prs: [109],
				changed:
					"Holy Strike was guessed at 110% weapon damage on a six second cooldown, and it was 40% of the retribution paladin's damage; the published tooltip is 40% weapon damage plus 36 to 46 Holy damage on a twelve second cooldown for 20 mana. Judgement no longer suppresses cast triggers, so Sanctified Judgement refunds mana and Swift Judgement's free cast stops being permanent. Retribution twists Seal of Command into Righteousness rather than the other way round, drinks its own potion and rune, casts Hammer of Wrath in the execute window, and fills spare globals with Consecration.",
				effect: 'Retribution goes from 780 to 679 DPS on a two minute fight and protection from 331 to 284, the rotation work giving back about half of what the ability correction took.',
			},
			{
				title: 'Hunter: the cat bites, Serpent Sting waits for mana',
				prs: [110],
				changed:
					"The pet's Bite was gated behind a focus income no pet can reach, so the cat only clawed; Serpent Sting was refreshed with a third of the dot still running and is the hunter's worst shot per point of mana, so it now waits until the dot is nearly gone and is skipped under thirty percent mana. Volley's crit bonus folded Mortal Shots in as a multiplier, and Lethal Attacks missed spell crit.",
				effect: 'Marksmanship +14 DPS at two minutes and +22 at five, Beast Mastery +2 and +7, Survival +2 and +10; the Marksmanship hunter spends 25 fewer seconds out of mana on a five minute fight.',
			},
			{
				title: 'Priest: Power Infusion returns, and Power in Light stays up',
				prs: [113],
				changed:
					"Power Infusion, the thirty-one point talent the Smite build spends its deepest point on, was commented out of the sim entirely. It is cast again. Holy Fire is now recast as its dot runs out rather than after it has dropped, so Power in Light no longer falls off for five seconds in every fifteen, Inner Focus goes on Smite instead of Penance, and Shadow Word: Pain and a downranked Smite fill the gaps a five minute fight opens. Devouring Plague registered only its first five ranks and was locked to the Undead, so the shadow rotation's Devouring Plague line did nothing at all for the ranked Dwarf.",
				effect: 'Smite +7.1% at two minutes and +5.6% at five; Shadow +0.3% and +0.4%.',
				sources: [communityTalents],
			},
			{
				title: 'Rogue: a rotation for the Hemorrhage build',
				prs: [111],
				changed:
					'The auto rotation only knew Mutilate, Backstab and Sinister Strike, so a Subtlety build that had spent fifteen points on Hemorrhage never cast it, and Rupture was in no rogue rotation at all, leaving Serrated Blades and Thousand Cuts reading off a debuff nobody applied. Hemorrhage gets its own list with Rupture and a Vanish-Premeditation-Ambush opener. Venom now reaches a Deadly Poison that is already ticking, and the Assassination list finishes at four combo points instead of letting nine a fight fall off the cap.',
				effect: 'Subtlety Hemo 582 to 709 DPS and Assassination Mutilate 638 to 696 on a two minute fight; Combat was measured against the same changes and kept its rotation.',
				sources: [communityTalents],
			},
			{
				title: 'Enhancement shaman: a rotation, and an off-hand that works',
				prs: [112],
				changed:
					"The enhancement priority list asked whether Strength of Earth Totem was up using the wrong rank's aura, so the shaman re-dropped it every global until it ran out of mana and never reached Stormstrike or Earth Shock; the totem lines now read how long each totem has left. Windfury Totem, which shared the air slot with Grace of Air and buffed nothing, is gone. The off-hand weapon imbue was never read at all, Windfury's extra attacks always came from the main hand, and Elemental Weapons was applied twice to Windfury's bonus attack power.",
				effect: 'The ranked Enhancement 16/35/0 build goes from 473 to 724 DPS at two minutes and from 458 to 699 at five, and is no longer the lowest non-tank.',
				sources: [communityTalents],
			},
			{
				title: 'Mage: Ignite paid the same crit twice',
				prs: [114],
				changed:
					"Ignite's ticks re-applied the Improved Scorch stacks and Curse of Elements that the critical strike had already carried, and a crit landing after the dot had ticked restarted it with the old damage still in the pool, so the talent paid out 62% of the crit it lit instead of 40%. Fingers of Frost handed the Shatter crit to the Frostbolt already half cast without spending the charge on it. Arcane Missiles stopped at rank 7 because its registration loop predated the AQ ranks, and the arcane rotation now holds three Arcane Blast stacks before spending them. Mana gems no longer spend the shared conjured cooldown on the smallest gem.",
				effect: 'Fire -7.6%, Frost -4.0%, Arcane +8.9% on a two minute fight; the three mage builds land within 90 DPS of each other instead of 300.',
				sources: [communityTalents],
			},
			{
				title: 'Mage: Clearcasting was never spent',
				prs: [273],
				changed:
					"Clearcasting skipped being consumed whenever the spell cost nothing, and Clearcasting is what makes a spell cost nothing, so every proc ran its full 15 seconds of free casting. It is now spent by the next spell with a mana cost. The shaman's and priest's equivalents were checked and never had the problem. Found while porting the mage onto the new engine.",
				effect: 'Frost fell 13.9% and arcane 0.4% on average, far more with no buffs: frost 33.4% on a long fight. Fire does not take Arcane Concentration.',
			},
			{
				title: 'Bear tank: Lacerate instead of Swipe',
				prs: [116],
				changed:
					"The bear spent its spare rage on Swipe, which returns eight damage and twenty-six threat per rage against Lacerate's seventy-one and one hundred and fifty-two, so Lacerate takes the rage dump. The cat's Claw line no longer fires at the Energy where Shred has just gone out of reach, Furor's out of form Energy scales with rank like the rest of the talent, and Moonkin Form finally grants its armor.",
				effect: 'Bear Tank +20% DPS and +35% threat, Feral Cat +1%, on a two minute fight.',
				sources: [communityTalents],
			},
			{
				title: 'Talents stop borrowing each other\u2019s tooltips',
				prs: [122],
				changed:
					"Reported in the Forever Discord: the warlock tree showed Shadow Mastery twice. Where a Forever talent had no Classic spell ids of its own, the tree generator gave it the ids of whichever Classic talent the dataset had matched it to by description, and the sim then let the database name, draw and link that other talent instead. Forty-two talents across all nine classes were affected: Malevolence read as Shadow Mastery, the druid's Genesis read as Fire Power, Spirit Weapons read as Parry. Each now carries its own name, description and per-rank numbers from the datamined set, and the generator only trusts a spell id when the database agrees it is the same talent.",
				effect: 'Every talent names itself. No talent string, position or simulated number changes.',
			},
			{
				title: 'Season of Discovery leftovers removed',
				prs: [82, 83, 67],
				changed:
					'The Warden (tank) shaman, a Season of Discovery spec that came with the upstream code, is gone; the healing specs and the bear, which have no working sim, no longer carry Classic builds.',
				effect: 'The site only offers what Forever has and the sim can run.',
				sources: [upstream],
			},
		],
	},
	{
		title: 'The build arena',
		intro: 'The arena searches the talent trees for each spec and runs every build it finds in one fixed environment, so two numbers on it can be compared. It is a way to find bugs and good builds in this sim, not a balance claim, and since 26 September it is no longer linked from the homepage.',
		entries: [
			{
				title: 'Every build brings the same consumables',
				prs: [254, 458, 460],
				changed:
					"The arena claimed a fixed environment, but each spec brought its own test fixture's consumables: both paladins and the feral tank had no weapon imbue at all, four specs carried Windfury, and the warrior and rogue had no flask. There are now three lists, caster, ranged and melee, because Elemental Sharpening Stone gives melee crit and takes ranged crit; class imbues such as Windfury Weapon and the poisons still override them. Casters and the hunter get Demonic Rune and Mageblood beside their potion, and melee a Mighty Rage Potion. The mana potion on the caster list had never been drunk, because the arena never registered it.",
				effect: 'The gap between the top two specs, warrior and retribution, went from 19.6% to 2.3%: the warrior was never a third over-modelled, it was this and the rage rule stacked. The potion actually drunk, the rune and Mageblood took Smite up 38.3%, elemental 5.8%, the warlock 4.9% and the hunter 4.6%.',
			},
			{
				title: 'The talent search, rebuilt on the new engine',
				prs: [253, 430, 445, 446, 454],
				changed:
					"The search runs every build on its own core, which took balance from 171.5 sec to 37.5 with identical numbers, and runs on a home machine because GitHub's six hour limit was already too tight. The switch left it on fifteen fixed builds until it was ported. It now also tries every two-tree split at 20/31, 21/30, 30/21 and 31/20, skips specs whose code has not changed, drops carried builds a new patch made illegal, and climbs each tree on that tree's own rotation.",
				effect: "Builds published by MythicSim, a fork of this engine from before the switch, run here as comparison rows. Several beat our best for their tree, Marksmanship by 7% and Subtlety by 4.8%, because every climb had used the spec's single top rotation; that is fixed.",
			},
			{
				title: 'One row per build, readable on a phone',
				prs: [442, 451, 453, 455, 462],
				changed:
					"The page listed every talent build on every gear set, 3,454 rows with the same talents up to eight times. It now shows each build once on its spec's standard launch set, the best build per tree by default, with every build a toggle away. A row shows the spec, the tree split, the DPS and a link to the build in Wowhead's Forever talent calculator; tapping it opens the talent string, gear, rotation and consumables. Rotations built on lower ranks carry an unconfirmed tag.",
				effect: '290 rows instead of 3,454, and nothing scrolls sideways on a 412 pixel phone, where the DPS column had been off screen.',
			},
		],
	},
	{
		title: 'The site',
		intro: 'Pages and tooling around the sim.',
		entries: [
			{
				title: 'DPS rankings from one raid',
				prs: [54, 74, 78, 81, 87, 88],
				changed:
					'One 25-player raid with a slot per community build, one run, one encounter, one set of buffs; both warlock curses up; rows named by spec and build.',
				effect: "The only page where every build's number comes from the same fight.",
			},
			{
				title: 'Rankings in launch gear',
				prs: [106, 455],
				changed:
					'Every ranked build wears a Launch set: the best pre-raid gear in the launch item pool by its own stat weights, built by one tool for all sixteen specs, raid drops and faction-locked items left out. Before, rogues ranked in Pre-BiS, casters in thin Classic sets and the cat in eight Wildheart pieces and nine empty slots.',
				effect: 'The rankings compare specs rather than gear tiers; casters and the cat moved most. The sets had since drifted, built from different database snapshots and some carrying PvP rank or Ahn’Qiraj pieces, at item level 63.1 to 69.4. All seventeen were regenerated from one pre-raid pool with every raid and world boss left out, and sit at 60.4 to 63.6.',
			},
			{
				title: 'Two bugs only a raid could show',
				prs: [411, 412],
				changed:
					"A warlock that was not first in the raid never saw its own Curse of the Elements, because the curse was tagged with the caster's raid slot and the rotation looked for it untagged, so it recast the curse every global cooldown. Two hunters kept knocking each other's Serpent Sting off the target and recasting it. Single-player sims put everyone in the first slot alone, so no spec page or test could see either.",
				effect: 'The rankings raid had all four warlock builds at 3.9 to 10 DPS; Demonic Pact came back to 478.8. Marksmanship went from 482 to 544 and Survival from 442 to 488, each now matching its number alone.',
			},
			{
				title: 'The damage table says what it is',
				prs: [120],
				changed:
					'Raised in the Forever Discord: a public ranking advertises results nothing has proven, on a fork still being written. The page carried six notes on how the raid was assembled and not one on where the numbers came from. It is called Damage comparison now, the rank column is gone, and a block above the table says where the numbers came from and that the table is here to find bugs in this sim. The URL is unchanged. That block said there was no beta client, which was true when it was written; it now names the client build and what the client still does not settle.',
				effect: 'The page reads as what it has always been used for, a self-check, rather than a balance claim.',
			},
			{
				title: 'The raid builder offers every build',
				prs: [121],
				changed:
					"The picker at the top of the raid tab offered one icon per spec, so the only way into a raid was a spec's own default build and the twenty-six community builds the damage table ranks could not be put in one. It now offers all twenty-six, grouped by class, each dropping a player with that build's talents and name. Both pages read the same list, so neither can drift from the other. The mage's three raid presets also all carried the same talents, which are Frost's, so dragging in a Fire or Arcane mage gave a Frost one and the three could not be told apart.",
				effect: 'A raid could be built out of the community builds without editing talents by hand. The raid sim did not survive the switch, since the official engine has none.',
			},
			{
				title: 'The damage table comes off the homepage',
				prs: [124, 471],
				changed:
					"The site called itself WoWSims - Forever in its title, its homepage and the label above every sim, which is a claim it has no right to make: it is one person's fork and the WoWSims team neither builds nor reviews it. It is Forever Sim (unofficial) now, the homepage says plainly that it is not WoWSims and not affiliated, and the Patreon link is labelled as theirs. The homepage also lists what the sim cannot do yet, which at the time included the one the sim team raised: that datamined and demo tooltips are wrong often enough that a value can be read correctly and still be wrong. The beta client answered that one, and the list now carries what the client itself does not settle. The damage table comes off the homepage with it and is marked not to be indexed, though it stays at its URL.",
				effect: 'Nobody arrives thinking this is the official sim, and the limits are on the front page rather than buried. After wowsims/forever went private, the build arena came off the homepage too.',
			},
			{
				title: 'The upstream project\u2019s name and Patreon come off the site',
				prs: [125, 233, 263, 428],
				changed:
					"The Patreon button in every header pointed at the upstream project's page, and their name was still in the homepage copy, the toast titles, the exported stat weight labels and the default export filename. The Patreon link and its component are gone, nothing on the site solicits money for anyone, and the homepage introduces itself as an unofficial personal sim without borrowing a name to do it. The GitHub link also defaulted to the upstream repository in a local build, which is now this fork. The MIT licence keeps the original copyright, as it must.",
				effect: "Nothing on the site trades on a name or a donation page that is not its own. The Discord link that came with the fork went the same way, and the homepage credits WoWSims' open-source simulators under their MIT licence instead. The switch brought the official engine's Patreon, Discord and GitHub links back in, and they came out again.",
			},
			{
				title: 'Every talent describes itself, not its Classic ancestor',
				prs: [126],
				changed:
					"Reported in the Forever Discord: Improved Revenge still read as a stun chance when Forever made it damage. The sim had it right at 20% a point; the tooltip was the Classic one, because a talent with no text of its own falls back to the Classic database and the two share a name. #122 only caught talents whose name had changed, so a same-name, changed-effect talent slipped through. The Classic database no longer describes any talent: all 470 carry their own name, text and per-rank numbers. Checked against the community talent calculator's source, 43 more were showing rank 1's number at every rank while the sim scaled with points, Improved Wrath reading 0.1 sec at five points where the sim gives 0.5.",
				effect: 'Every tooltip now says what the sim actually does. No simulated number changes.',
				sources: [communityTalents],
			},
			{
				title: 'Best in slot and stat weights',
				prs: [55, 56, 72, 79, 413],
				changed:
					"A best in slot page from each spec's EP weights over the launch pool, and a page comparing stat weights across specs. On the new engine every spec carries the old engine's EP weights converted to rating, and the page ranks only launch items, since the client's database holds Blackwing Lair to Naxxramas rows too.",
				effect: 'Reference pages; neither runs the sim.',
			},
			{
				title: 'Landing page, feedback and the raid sim',
				prs: [38, 41, 45, 39, 40, 32, 33, 51, 52, 53],
				changed:
					"Forever's spec list and lockup on the homepage, a dropdown per class, in-sim feedback that opens a GitHub issue with a screenshot, the raid sim reachable and working on touch screens.",
				effect: 'Site plumbing. The raid sim is gone since the switch.',
			},
			{
				title: 'Forever’s own look',
				prs: [470, 473, 474],
				changed:
					"The landing page still looked like The Burning Crusade: Illidan over Outland behind everything, a fel-green subtitle and gold accents. It now carries Blizzard's Forever Skyborne key art, with a portrait crop on phones, and a light blue sampled from it replaces the gold as the site's accent. Gold stays where it means something: an assumed number. The homepage reads WoW Forever over Sim, and the WoWSims crossed swords gave way to the in-game Challenging Shout icon, with Blizzard's trademark line as their fan-site terms require.",
				effect: "Looks only. Every text colour still passes WCAG AA over the art. The Forever logo is not used, because Blizzard's logo rules forbid use that implies endorsement.",
				sources: [blizzardForever],
			},
			{
				title: 'Publishing and checks',
				prs: [34, 57, 76, 80, 85, 86, 270],
				changed:
					"Published to GitHub Pages from master; every page opened in a headless browser before deploy and on every pull request; the sim pages generated by vite like upstream's newer sims.",
				effect: 'A build whose pages throw cannot go live; it has already stopped one. Since 21 September a pull request merges and deploys itself once the tests pass.',
				sources: [upstream],
			},
			{
				title: 'Images served from the site',
				prs: [95, 101, 103],
				changed:
					"Every icon, tree background and pet icon mirrored into the repo and loaded from there instead of Wowhead's CDN; the talents Forever added drawn from the icon names the dataset matched, or from crops of the demo video where the icon is new.",
				effect: 'Icons load on networks that reject wow.zamimg.com, and no talent shows a question mark.',
				sources: [talentDataset],
			},
			{
				title: 'Written down for the beta and for upstream',
				prs: [70, 84, 90, 264],
				changed:
					'A checklist of every demo-tooltip assumption the beta must confirm, a rules sheet of every Forever rule the sim models with its source, and a note on where upstream wowsims is heading. On the new engine the checklist lives in docs/beta-pass, one file per class; the rules sheet still describes the old engine.',
				effect: 'The beta pass is a checklist rather than an audit, and the official fork can take the data.',
				sources: [upstream],
			},
		],
	},
];
