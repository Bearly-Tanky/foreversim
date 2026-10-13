// Settings saved by the classic-engine Forever site (master before the switch): its share links,
// its JSON export and its autosaved localStorage blobs. They are the same IndividualSimSettings
// message by name, but a different proto: other field numbers, a percent-based Stat enum in another
// order, enum consumables, and other spec oneof names. None of them carries an api_version, which
// is how they are told apart from ours (we always stamp one).
//
// ./../proto/legacy_classic is protoc-gen-ts output for master's proto/ at f6569015f6, frozen:
//   git show <rev>:proto/<file>.proto into a dir, then
//   npx protoc --ts_opt generate_dependencies --ts_out ui/sim/proto/legacy_classic --proto_path <dir> <dir>/ui.proto
import { PseudoStat, Spec, Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import type { IMessageType } from '@protobuf-ts/runtime';

import { ENCOUNTER_DEFAULTS } from '../constants/encounter';
import {
	BLOCK_RATING_PER_BLOCK_PERCENT,
	DEFENSE_RATING_PER_DEFENSE_LEVEL,
	DODGE_RATING_PER_DODGE_PERCENT,
	EXPERTISE_RATING_PER_EXPERTISE_PERCENT,
	PARRY_RATING_PER_PARRY_PERCENT,
	PHYSICAL_CRIT_RATING_PER_CRIT_PERCENT,
	PHYSICAL_HASTE_RATING_PER_HASTE_PERCENT,
	PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
	SPELL_CRIT_RATING_PER_CRIT_PERCENT,
	SPELL_HASTE_RATING_PER_HASTE_PERCENT,
	SPELL_HIT_RATING_PER_HIT_PERCENT,
} from '../constants/mechanics';
import { CURRENT_API_VERSION } from '../constants/other';
import { getSpecConfig } from '../player/player';
import { PseudoStat as ClassicPseudoStat, Stat as ClassicStat } from '../proto/legacy_classic/common';
import { IndividualSimSettings as ClassicSettings } from '../proto/legacy_classic/ui';

type Json = Record<string, any>;

// Master's spec oneof member -> ours.
const SPEC_KEYS: Record<string, string> = {
	balanceDruid: 'balanceDruid',
	feralDruid: 'feralCatDruid',
	feralTankDruid: 'feralBearDruid',
	restorationDruid: 'restorationDruid',
	hunter: 'hunter',
	mage: 'mage',
	holyPaladin: 'holyPaladin',
	protectionPaladin: 'protectionPaladin',
	retributionPaladin: 'retributionPaladin',
	healingPriest: 'healerPriest',
	shadowPriest: 'dpsPriest',
	smitePriest: 'dpsPriest',
	rogue: 'rogue',
	elementalShaman: 'elementalShaman',
	enhancementShaman: 'enhancementShaman',
	restorationShaman: 'restorationShaman',
	warlock: 'warlock',
	warrior: 'dpsWarrior',
	tankWarrior: 'protectionWarrior',
};

// Master stat -> our stat(s) and how many of ours one of master's is worth. Master's secondaries
// are percentages (1 MeleeHit = 1% hit), ours are ratings. Names not listed map to the same name,
// or are dropped when we have no such stat (Energy, Rage, weapon skills).
const STAT_MAP: Record<string, Array<[string, number]>> = {
	StatSpellPower: [
		['StatSpellDamage', 1],
		['StatHealingPower', 1],
	],
	StatArcanePower: [['StatArcaneDamage', 1]],
	StatFirePower: [['StatFireDamage', 1]],
	StatFrostPower: [['StatFrostDamage', 1]],
	StatHolyPower: [['StatHolyDamage', 1]],
	StatNaturePower: [['StatNatureDamage', 1]],
	StatShadowPower: [['StatShadowDamage', 1]],
	StatSpellHit: [['StatSpellHitRating', SPELL_HIT_RATING_PER_HIT_PERCENT]],
	StatSpellCrit: [['StatSpellCritRating', SPELL_CRIT_RATING_PER_CRIT_PERCENT]],
	StatSpellHaste: [['StatSpellHasteRating', SPELL_HASTE_RATING_PER_HASTE_PERCENT]],
	StatSpellPenetration: [['StatSpellPiercing', 1]],
	StatMeleeHit: [['StatMeleeHitRating', PHYSICAL_HIT_RATING_PER_HIT_PERCENT]],
	StatMeleeCrit: [['StatMeleeCritRating', PHYSICAL_CRIT_RATING_PER_CRIT_PERCENT]],
	StatMeleeHaste: [['StatMeleeHasteRating', PHYSICAL_HASTE_RATING_PER_HASTE_PERCENT]],
	StatExpertise: [['StatExpertiseRating', EXPERTISE_RATING_PER_EXPERTISE_PERCENT]],
	StatDefense: [['StatDefenseRating', DEFENSE_RATING_PER_DEFENSE_LEVEL]],
	StatBlock: [['StatBlockRating', BLOCK_RATING_PER_BLOCK_PERCENT]],
	StatDodge: [['StatDodgeRating', DODGE_RATING_PER_DODGE_PERCENT]],
	StatParry: [['StatParryRating', PARRY_RATING_PER_PARRY_PERCENT]],
	PseudoStatDodge: [['PseudoStatDodgePercent', 1]],
	PseudoStatParry: [['PseudoStatParryPercent', 1]],
	BonusPhysicalDamage: [['StatPhysicalDamage', 1]],
	...Object.fromEntries(
		['Arcane', 'Fire', 'Frost', 'Holy', 'Nature', 'Shadow'].map(school => [`PseudoStatSchoolHit${school}`, [[`PseudoStatSchoolHitPercent${school}`, 1]]]),
	),
};

const enumSize = (e: object) => Object.values(e).filter(v => typeof v === 'number').length;

// `inverse` for stat weights: a weight per 1% becomes a weight per rating point.
const convertUnitStats = (classic: { stats?: number[]; pseudoStats?: number[] } | undefined, inverse = false) => {
	const stats: number[] = new Array(enumSize(Stat)).fill(0);
	const pseudoStats: number[] = new Array(enumSize(PseudoStat)).fill(0);
	const add = (classicName: string | undefined, value: number) => {
		if (!classicName || !value) return;
		for (const [name, scale] of STAT_MAP[classicName] ?? [[classicName, 1]]) {
			const v = inverse ? value / scale : value * scale;
			if (name in Stat) stats[Stat[name as keyof typeof Stat]] += v;
			else if (name in PseudoStat) pseudoStats[PseudoStat[name as keyof typeof PseudoStat]] += v;
		}
	};
	classic?.stats?.forEach((v, i) => add(ClassicStat[i], v));
	classic?.pseudoStats?.forEach((v, i) => add(ClassicPseudoStat[i], v));
	return { stats, pseudoStats };
};

const convertStatName = (name: string | undefined) => (name ? (STAT_MAP[name]?.[0][0] ?? name) : undefined);

// Master's enum consumables, by the item each one is (from master's consumables picker). Our
// ConsumesSpec keeps one item per kind, so of master's school elixirs only the first counts.
const CONSUMABLE_ITEMS: Record<string, number> = {
	ConjuredHealthstone: 5509,
	ConjuredGreaterHealthstone: 5510,
	ConjuredMajorHealthstone: 9421,
	ConjuredMinorRecombobulator: 4381,
	ConjuredDemonicRune: 12662,
	ConjuredRogueThistleTea: 7676,
	// Explosives by the value our picker and sim/core/consumes.go use (the spell); master's Solid
	// Dynamite and Goblin Land Mine have none, so they are dropped.
	ExplosiveDenseDynamite: 23063,
	ExplosiveThoriumGrenade: 19769,
	FlaskOfTheTitans: 13510,
	FlaskOfDistilledWisdom: 13511,
	FlaskOfSupremePower: 13512,
	FlaskOfChromaticResistance: 13513,
	FoodDirgesKickChimaerokChops: 21023,
	FoodGrilledSquid: 13928,
	FoodSmokedDesertDumpling: 20452,
	FoodRunnTumTuberSurprise: 18254,
	FoodBlessSunfruit: 13810,
	FoodBlessedSunfruitJuice: 13813,
	FoodNightfinSoup: 13931,
	FoodTenderWolfSteak: 18045,
	FoodSagefishDelight: 21217,
	FoodHotWolfRibs: 13851,
	FoodSmokedSagefish: 21072,
	ElixirOfSuperiorDefense: 13445,
	ElixirOfGreaterDefense: 8951,
	ElixirOfDefense: 3389,
	ElixirOfMinorDefense: 5997,
	ElixirOfFortitude: 3825,
	ElixirOfMinorFortitude: 2458,
	JujuMight: 12460,
	WinterfallFirewater: 12820,
	ElixirOfTheMongoose: 13452,
	ElixirOfGreaterAgility: 9187,
	ElixirOfAgility: 8949,
	ElixirOfLesserAgility: 3390,
	JujuPower: 12451,
	ElixirOfGiants: 9206,
	ElixirOfOgresStrength: 3391,
	GreaterHealingPotion: 1710,
	SuperiorHealingPotion: 3928,
	MajorHealingPotion: 13446,
	ManaPotion: 3827,
	GreaterManaPotion: 6149,
	SuperiorManaPotion: 13443,
	MajorManaPotion: 13444,
	MightyRagePotion: 13442,
	GreatRagePotion: 5633,
	RagePotion: 5631,
	MagicResistancePotion: 9036,
	GreaterArcaneProtectionPotion: 13461,
	GreaterFireProtectionPotion: 13457,
	GreaterFrostProtectionPotion: 13456,
	GreaterHolyProtectionPotion: 13460,
	GreaterNatureProtectionPotion: 13458,
	GreaterShadowProtectionPotion: 13459,
	GreaterStoneshieldPotion: 13455,
	LesserStoneshieldPotion: 4623,
	GreaterArcaneElixir: 13454,
	ArcaneElixir: 9155,
	ElixirOfGreaterFirepower: 21546,
	ElixirOfFirepower: 6373,
	ElixirOfFrostPower: 17708,
	ElixirOfShadowPower: 9264,
	MagebloodPotion: 20007,
	BrilliantWizardOil: 20749,
	WizardOil: 20750,
	LesserWizardOil: 20746,
	MinorWizardOil: 20744,
	BlessedWizardOil: 23123,
	BrilliantManaOil: 20748,
	LesserManaOil: 20747,
	MinorManaOil: 20745,
	ConsecratedSharpeningStone: 23122,
	ElementalSharpeningStone: 18262,
	DenseSharpeningStone: 12404,
	SolidSharpeningStone: 7964,
	DenseWeightstone: 12643,
	SolidWeightstone: 7965,
	ShadowOil: 3824,
	FrostOil: 3829,
	SpiritOfZanza: 20079,
	ROIDS: 8410,
	GroundScorpokAssay: 8412,
	CerebralCortexCompound: 8423,
	GizzardGum: 8424,
	LungJuiceCocktail: 8411,
	AlcoholRumseyRumBlackLabel: 21151,
	AlcoholRumseyRumDark: 21114,
	AlcoholRumseyRumLight: 20709,
	AlcoholGordokGreenGrog: 18269,
	AlcoholKreegsStoutBeatdown: 18284,
	// Master's rogue imbues; ours are the poison items sim/rogue/poisons.go reads.
	InstantPoison: 26891,
	DeadlyPoison: 27186,
	WoundPoison: 27188,
};

const convertConsumes = (c: Json): Json => {
	const item = (...keys: string[]) => keys.map(k => CONSUMABLE_ITEMS[c[k]]).find(id => id);
	return {
		flaskId: item('flask'),
		foodId: item('food'),
		potId: item('defaultPotion'),
		conjuredId: item('defaultConjured'),
		explosiveId: item('fillerExplosive'),
		goblinSapper: c.sapperExplosive === 'SapperGoblinSapper' || undefined,
		battleElixirId: item('agilityElixir'),
		spellPowerElixirId: item('spellPowerBuff'),
		// One school elixir here; master's mage and elemental carry Fire and Frost Power, its warlock Fire and Shadow.
		schoolElixirId: item('shadowPowerBuff', 'frostPowerBuff', 'firePowerBuff'),
		guardianElixirId: item('manaRegenElixir', 'healthElixir'),
		defenseElixirId: item('armorElixir'),
		strengthBuffId: item('strengthBuff'),
		attackPowerBuffId: item('attackPowerBuff'),
		zanzaId: item('zanzaBuff'),
		alcoholId: item('alcohol'),
		dragonbreathChili: c.dragonBreathChili || undefined,
		mhImbueId: item('mainHandImbue'),
		ohImbueId: item('offHandImbue'),
	};
};

const messageField = (type: IMessageType<any>, localName: string): IMessageType<any> => (type.fields.find(f => f.localName === localName) as any).T();

// Keeps only what `type` can hold: unknown fields, unknown enum names and wrong-typed values are
// dropped, so fromJson never throws on a proto that drifted. Master's bool buffs land on our
// TristateEffect ones as the regular effect, and its TristateEffects on our bools as `true`.
const sanitize = (json: Json, type: IMessageType<any>): Json => {
	const out: Json = {};
	for (const [key, value] of Object.entries(json ?? {})) {
		const field = type.fields.find(f => f.jsonName === key || f.name === key || f.localName === key);
		if (!field || value === undefined || value === null) continue;
		const clean = (v: any): any => {
			switch (field.kind) {
				case 'message':
					return typeof v === 'object' && !Array.isArray(v) ? sanitize(v, field.T()) : undefined;
				case 'enum': {
					const [, enumObj, prefix] = field.T();
					if (typeof v === 'boolean') return v ? Object.values(enumObj).filter(x => typeof x === 'number')[1] : undefined;
					if (typeof v === 'number') return v in enumObj ? v : undefined;
					return typeof v === 'string' && (v in enumObj || (prefix && v.slice(prefix.length) in enumObj)) ? v : undefined;
				}
				case 'scalar':
					if (field.T === 8 /* BOOL */) return typeof v === 'boolean' ? v : typeof v === 'string' ? true : undefined;
					if (field.T === 9 /* STRING */ || field.T === 12 /* BYTES */) return typeof v === 'string' ? v : undefined;
					return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))) ? v : undefined;
				default:
					return v;
			}
		};
		if (field.kind !== 'map' && field.repeat) {
			if (Array.isArray(value)) out[field.jsonName] = value.map(clean).filter(v => v !== undefined);
		} else {
			const v = clean(value);
			if (v !== undefined) out[field.jsonName] = v;
		}
	}
	return out;
};

const deepMerge = (base: Json, over: Json): Json => {
	const out: Json = { ...base };
	for (const [k, v] of Object.entries(over)) {
		out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' ? deepMerge(base[k], v) : v;
	}
	return out;
};

const PlayerType = messageField(IndividualSimSettings, 'player');
const BUFF_TYPES: Array<[string, IMessageType<any>]> = [
	['raidBuffs', messageField(IndividualSimSettings, 'raidBuffs')],
	['partyBuffs', messageField(IndividualSimSettings, 'partyBuffs')],
	['buffs', messageField(PlayerType, 'buffs')],
];

export const convertClassicSettingsJson = (classic: Json): IndividualSimSettings => {
	const c: Json = structuredClone(classic);
	const player: Json = c.player ?? {};

	// Master split buffs between raid, party and player differently: each one goes where we keep it.
	const buffs: Json = { ...c.raidBuffs, ...c.partyBuffs, ...player.buffs };
	const has = (type: IMessageType<any>, key: string) => type.fields.some(f => f.jsonName === key);
	for (const [container, type] of BUFF_TYPES) {
		const target: Json = {};
		for (const [key, value] of Object.entries(buffs)) if (has(type, key)) target[key] = value;
		if (container === 'buffs') player.buffs = target;
		else c[container] = target;
	}

	if (player.bonusStats) player.bonusStats = convertUnitStats(player.bonusStats);
	if (c.epWeightsStats) c.epWeightsStats = convertUnitStats(c.epWeightsStats, true);
	for (const key of ['dpsRefStat', 'healRefStat', 'tankRefStat']) c[key] = convertStatName(c[key]);
	for (const target of c.encounter?.targets ?? []) target.stats = convertUnitStats({ stats: target.stats }).stats;
	// Master's fight had no 45% and 90% phases. Left at 0 the fight never passes 90%, so it never
	// reaches execute range either (no Execute, no below-20% effects): take the defaults.
	if (c.encounter)
		c.encounter = {
			executeProportion45: ENCOUNTER_DEFAULTS.executeProportion45,
			executeProportion90: ENCOUNTER_DEFAULTS.executeProportion90,
			...c.encounter,
		};

	if (player.consumes) player.consumables = convertConsumes(player.consumes);
	delete player.consumes;
	delete player.database;

	const classicKey = Object.keys(SPEC_KEYS).find(k => k in player);
	if (classicKey) {
		const key = SPEC_KEYS[classicKey];
		const options: Json = player[classicKey]?.options ?? {};
		delete player[classicKey];
		// Our options nest the class-wide ones under `classOptions`; offer every field to both levels
		// and let sanitize keep the ones that exist.
		const optionsType = messageField(messageField(PlayerType, key), 'options');
		let converted = sanitize({ ...options, classOptions: options }, optionsType);
		const spec = Spec[`Spec${key[0].toUpperCase()}${key.slice(1)}` as keyof typeof Spec];
		try {
			// Whatever master had no counterpart for takes the spec's own default, not zero.
			converted = deepMerge(optionsType.toJson((getSpecConfig(spec) as any).defaults.specOptions) as Json, converted);
		} catch {
			// Spec not registered on this page (a link for another spec): no defaults to fill from.
		}
		player[key] = { options: converted };
	}
	c.player = player;

	const settings = IndividualSimSettings.fromJson(sanitize(c, IndividualSimSettings) as never, { ignoreUnknownFields: true });
	settings.apiVersion = CURRENT_API_VERSION;
	if (settings.player) settings.player.apiVersion = CURRENT_API_VERSION;
	return settings;
};

export const convertClassicSettingsBinary = (bytes: Uint8Array): IndividualSimSettings =>
	convertClassicSettingsJson(ClassicSettings.toJson(ClassicSettings.fromBinary(bytes)) as Json);

// Ours always carry an api_version; master's never do, and name a player field only master has.
const CLASSIC_ONLY_PLAYER_KEYS = ['consumes', 'isbSbFrequency', 'stormstrikeFrequency', 'database', ...Object.keys(SPEC_KEYS).filter(k => SPEC_KEYS[k] !== k)];
export const isClassicSettingsJson = (json: unknown): json is Json => {
	if (!json || typeof json !== 'object' || 'apiVersion' in json) return false;
	const player = (json as Json).player;
	return !!player && typeof player === 'object' && !('apiVersion' in player) && CLASSIC_ONLY_PLAYER_KEYS.some(k => k in player);
};
