// Share links taken from the live classic-engine site (elliotwood.github.io/Forever/classic, master
// f6569015f6): each spec page's default, via Export > Link. Master deploys no healer pages, so the
// healers get a settings blob built with master's own proto instead.
import { Class, Race, Stat } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import pako from 'pako';
import { describe, expect, it } from 'vitest';

import { CURRENT_API_VERSION } from '../constants/other';
import { Class as ClassicClass, Race as ClassicRace, Stat as ClassicStat } from '../proto/legacy_classic/common';
import { IndividualSimSettings as ClassicSettings } from '../proto/legacy_classic/ui';
import { convertClassicSettingsJson } from './classic_links';
import { parseLegacySettingsJson } from './legacy_settings';
import { tryParseUrlLocation } from './sim_links';
import LINKS from './testdata/classic_links.json';

const EXPECTED_SPEC: Record<string, string> = {
	balance_druid: 'balanceDruid',
	feral_druid: 'feralCatDruid',
	feral_tank_druid: 'feralBearDruid',
	hunter: 'hunter',
	mage: 'mage',
	protection_paladin: 'protectionPaladin',
	retribution_paladin: 'retributionPaladin',
	shadow_priest: 'dpsPriest',
	smite_priest: 'dpsPriest',
	rogue: 'rogue',
	elemental_shaman: 'elementalShaman',
	enhancement_shaman: 'enhancementShaman',
	warlock: 'warlock',
	warrior: 'dpsWarrior',
	tank_warrior: 'protectionWarrior',
};

const classicOf = (hash: string) => ClassicSettings.fromBinary(pako.inflate(Uint8Array.from(atob(hash), c => c.charCodeAt(0))));

describe('classic-engine share links', () => {
	it('has one link per spec master deploys', () => {
		expect(Object.keys(LINKS).sort()).toEqual(Object.keys(EXPECTED_SPEC).sort());
	});

	for (const [spec, hash] of Object.entries(LINKS as Record<string, string>)) {
		it(`${spec} opens on forever-next`, () => {
			const classic = classicOf(hash);
			const parsed = tryParseUrlLocation({ hash: '#' + hash, search: '' })!;
			const settings = parsed.settings;
			const player = settings.player!;

			expect(settings.apiVersion).toBe(CURRENT_API_VERSION);
			expect(player.spec.oneofKind).toBe(EXPECTED_SPEC[spec]);
			// Class and Race are numbered differently: compare by name.
			expect(Class[player.class]).toBe(ClassicClass[classic.player!.class]);
			expect(Race[player.race]).toBe(ClassicRace[classic.player!.race]);
			expect(player.talentsString).toBe(classic.player!.talentsString);
			expect(player.equipment!.items.map(i => [i.id, i.enchant])).toEqual(classic.player!.equipment!.items.map(i => [i.id, i.enchant]));
			expect(player.rotation?.type).toBe(classic.player!.rotation?.type);
			// Stat arrays are re-indexed: the boss's armor moves from master's slot to ours.
			expect(settings.encounter!.targets[0].stats[Stat.StatArmor]).toBe(classic.encounter!.targets[0].stats[ClassicStat.StatArmor]);
			expect(settings.encounter!.duration).toBe(classic.encounter!.duration);
			// Master had no 45%/90% phases; without them the fight never reaches execute range.
			expect(settings.encounter!.executeProportion90).toBe(0.9);
			expect(settings.encounter!.executeProportion45).toBe(0.45);
			// The same settings through the JSON importer / autosave path.
			const viaJson = IndividualSimSettings.fromJson(parseLegacySettingsJson(JSON.stringify(ClassicSettings.toJson(classic))) as never);
			expect(IndividualSimSettings.equals(viaJson, settings)).toBe(true);
		});
	}

	it('carries the consumables, buffs and a percent stat across', () => {
		const settings = tryParseUrlLocation({ hash: '#' + (LINKS as Record<string, string>).hunter, search: '' })!.settings;
		expect(settings.player!.consumables).toMatchObject({
			flaskId: 13512,
			foodId: 20452,
			potId: 13444,
			conjuredId: 12662,
			battleElixirId: 13452,
			guardianElixirId: 20007,
		});
		// A master RaidBuffs field that lives in our PartyBuffs.
		expect(settings.partyBuffs!.battleShout).toBeGreaterThan(0);
		// Master TristateEffect buffs onto our bools.
		expect(settings.raidBuffs!.giftOfTheWild).toBe(true);
		expect(settings.debuffs!.faerieFire).toBe(true);

		const withHit = ClassicSettings.toJson(classicOf((LINKS as Record<string, string>).hunter)) as any;
		withHit.player.bonusStats.stats[ClassicStat.StatMeleeHit] = 2;
		withHit.epWeightsStats = { stats: Object.assign(new Array(44).fill(0), { [ClassicStat.StatMeleeHit]: 20 }) };
		const converted = convertClassicSettingsJson(withHit);
		expect(converted.player!.bonusStats!.stats[Stat.StatMeleeHitRating]).toBe(20);
		expect(converted.epWeightsStats!.stats[Stat.StatMeleeHitRating]).toBe(2);
	});

	it("keeps a rogue's poisons and a caster's spell power elixir", () => {
		const consumables = (spec: string) =>
			tryParseUrlLocation({ hash: '#' + (LINKS as Record<string, string>)[spec], search: '' })!.settings.player!.consumables!;
		expect(consumables('rogue')).toMatchObject({ mhImbueId: 26891, ohImbueId: 27186 });
		// Master's elemental default carries Greater Arcane Elixir and Juju Power; both have a slot now.
		expect(consumables('elemental_shaman')).toMatchObject({ spellPowerElixirId: 13454, strengthBuffId: 12451 });
		expect(consumables('warrior')).toMatchObject({ zanzaId: 8410, alcoholId: 21151, dragonbreathChili: true });
	});

	for (const [key, expected] of [
		['healingPriest', 'healerPriest'],
		['restorationDruid', 'restorationDruid'],
		['holyPaladin', 'holyPaladin'],
		['restorationShaman', 'restorationShaman'],
	]) {
		it(`${key} (healer, not deployed on master) converts`, () => {
			const classic = ClassicSettings.create({
				player: { talentsString: '005203031302-2350510323000053', spec: { oneofKind: key, [key]: { options: {} } } as any },
			});
			const bytes = ClassicSettings.toBinary(classic);
			const hash = btoa(String.fromCharCode(...pako.deflate(bytes)));
			const player = tryParseUrlLocation({ hash: '#' + hash, search: '' })!.settings.player!;
			expect(player.spec.oneofKind).toBe(expected);
			expect(player.talentsString).toBe('005203031302-2350510323000053');
		});
	}

	it('leaves our own links alone', () => {
		const ours = IndividualSimSettings.create({ apiVersion: CURRENT_API_VERSION, player: { talentsString: '123' } });
		const hash = btoa(String.fromCharCode(...pako.deflate(IndividualSimSettings.toBinary(ours))));
		expect(IndividualSimSettings.equals(tryParseUrlLocation({ hash: '#' + hash, search: '' })!.settings, ours)).toBe(true);
	});
});
