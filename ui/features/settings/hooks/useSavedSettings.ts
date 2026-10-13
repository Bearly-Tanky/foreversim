import { SavedSettings } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import type { SavedDataCodec } from '@ui-kit/hooks/useSavedData';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

// `debuffs.improvedSealOfTheCrusader` held the TBC talent as a bool, then as a TristateEffect;
// Forever has no talent and the field is `judgementOfTheCrusader`.
const migrateLegacyDebuffs = (json: any): any => {
	if (!json?.debuffs || !('improvedSealOfTheCrusader' in json.debuffs)) return json;
	const { improvedSealOfTheCrusader: legacy, jocRetribution2Pt4: _joc, ...debuffs } = json.debuffs;
	return {
		...json,
		debuffs: {
			...debuffs,
			judgementOfTheCrusader: legacy === true || (typeof legacy === 'string' && legacy !== 'TristateEffectMissing'),
		},
	};
};

// Saves from before api version 17 hold buffs as TristateEffects the buffs.proto bools cannot parse,
// and `useSavedData` drops any entry whose codec throws. Rather than lose the whole save, its buffs go.
const parseSavedSettings = (json: any): SavedSettings => {
	try {
		return SavedSettings.fromJson(json, { ignoreUnknownFields: true });
	} catch {
		const { raidBuffs: _r, partyBuffs: _p, playerBuffs: _i, debuffs: _d, ...rest } = json ?? {};
		return SavedSettings.fromJson(rest, { ignoreUnknownFields: true });
	}
};

const savedSettingsCodec: SavedDataCodec<SavedSettings> = {
	toJson: settings => SavedSettings.toJson(settings),
	fromJson: json => parseSavedSettings(migrateLegacyDebuffs(json)),
};

export const useSavedSettings = () => useSavedData(useSimHost().getSavedSettingsStorageKey(), savedSettingsCodec);
