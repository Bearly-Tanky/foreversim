import { IndividualSimSettings } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { migrateLegacySettingsJson, parseLegacySettingsJson } from './legacy_settings';

describe('migrateLegacySettingsJson', () => {
	it('renames the shadow priest oneof from priest to dpsPriest and keeps the rest of the player', () => {
		const migrated = migrateLegacySettingsJson({
			player: { name: 'Shadow', race: 'RaceUndead', priest: { options: { classOptions: { armor: 'InnerFire' } } } },
			settings: { iterations: 500 },
		}) as any;
		expect(migrated.player.dpsPriest).toEqual({ options: { classOptions: { armor: 'InnerFire' } } });
		expect('priest' in migrated.player).toBe(false);
		expect(migrated.player.name).toBe('Shadow');
		expect(migrated.settings).toEqual({ iterations: 500 });
		// The migrated shape is what the proto parser expects.
		const proto = IndividualSimSettings.fromJson(migrated, { ignoreUnknownFields: true });
		expect(proto.player?.spec.oneofKind).toBe('dpsPriest');
	});

	it('leaves a current blob, another spec and a non-object alone', () => {
		const current = { player: { dpsPriest: {} } };
		expect(migrateLegacySettingsJson(current)).toBe(current);
		const other = { player: { healerPriest: {} } };
		expect(migrateLegacySettingsJson(other)).toBe(other);
		expect(migrateLegacySettingsJson(null)).toBeNull();
		expect(migrateLegacySettingsJson({})).toEqual({});
	});

	it('does not overwrite a blob that somehow carries both', () => {
		const both = { player: { priest: {}, dpsPriest: { options: {} } } };
		expect(migrateLegacySettingsJson(both)).toBe(both);
	});

	it('drops the TristateEffect buffs and the consumables of a pre-17 blob so the rest still parses', () => {
		const old = {
			apiVersion: 16,
			raidBuffs: { giftOfTheWild: 'TristateEffectImproved' },
			partyBuffs: { bloodPact: 'TristateEffectRegular' },
			debuffs: { faerieFire: 'TristateEffectImproved' },
			player: { name: 'Kept', buffs: { blessingOfKings: true }, consumables: { drumsId: 'LesserDrumsOfBattle' } },
		};
		const migrated = migrateLegacySettingsJson(old) as any;
		expect(migrated).toEqual({ apiVersion: 16, player: { name: 'Kept' } });
		expect(() => IndividualSimSettings.fromJson(migrated, { ignoreUnknownFields: true })).not.toThrow();
		const current = { ...old, apiVersion: 17 };
		expect(migrateLegacySettingsJson(current)).toBe(current);
	});

	it('parses text and migrates it, and still throws on invalid JSON', () => {
		expect((parseLegacySettingsJson('{"player":{"priest":{}}}') as any).player.dpsPriest).toEqual({});
		expect(() => parseLegacySettingsJson('{not json')).toThrow();
	});
});
