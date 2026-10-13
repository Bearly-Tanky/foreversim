import { IndividualSimSettings } from '@generated/proto/ui';

import { BUFFS_REWRITE_API_VERSION } from '../constants/other';
import { convertClassicSettingsJson, isClassicSettingsJson } from './classic_links';

// Settings JSON written before a proto rename. Share links are binary, so field numbers carry
// them across; only the JSON forms (autosaved settings in localStorage and the JSON importer) name
// fields and need a hand.

// Before api version 17 the buffs were TristateEffects where buffs.proto has bools, which fromJson
// cannot parse, so the whole blob would be lost. They are dropped here; `updateIndividualProtoVersion`
// then gives the settings the spec's defaults, as it does for an old binary link.
const dropPreRewriteBuffs = (json: Record<string, unknown>): Record<string, unknown> => {
	if (typeof json.apiVersion !== 'number' || json.apiVersion >= BUFFS_REWRITE_API_VERSION) return json;
	const { raidBuffs: _r, partyBuffs: _p, debuffs: _d, ...rest } = json;
	if (rest.player && typeof rest.player === 'object') {
		const { buffs: _b, consumables: _c, ...player } = rest.player as Record<string, unknown>;
		rest.player = player;
	}
	return rest;
};

// The shadow priest's Player oneof was `priest` until the spec became `dps_priest` (the sim covers
// any dps priest, not only shadow). Renames the field in place so an old blob parses.
export const migrateLegacySettingsJson = (json: unknown): unknown => {
	if (!json || typeof json !== 'object') return json;
	json = dropPreRewriteBuffs(json as Record<string, unknown>);
	const player = (json as { player?: unknown }).player;
	if (!player || typeof player !== 'object') return json;
	const spec = player as Record<string, unknown>;
	if ('priest' in spec && !('dpsPriest' in spec)) {
		const { priest, ...rest } = spec;
		return { ...(json as object), player: { ...rest, dpsPriest: priest } };
	}
	return json;
};

// JSON text in, migrated object out; a parse failure surfaces to the caller as before.
// Settings from the classic-engine site (master before the switch) are another proto altogether.
export const parseLegacySettingsJson = (text: string): unknown => {
	const json = JSON.parse(text);
	return isClassicSettingsJson(json) ? IndividualSimSettings.toJson(convertClassicSettingsJson(json)) : migrateLegacySettingsJson(json);
};
