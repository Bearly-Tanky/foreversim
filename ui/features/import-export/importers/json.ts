import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { Database } from '@sim/proto/database';
import { parseLegacySettingsJson } from '@sim/state/legacy_settings';

import type { ImporterDefinition } from './types';

export const JSON_IMPORTER: ImporterDefinition = {
	title: i18n.t('import.json.title'),
	allowFileUpload: true,
	onImport: async (host, data) => {
		let proto: ReturnType<typeof IndividualSimSettings.fromJson>;
		try {
			proto = IndividualSimSettings.fromJson(parseLegacySettingsJson(data) as never, { ignoreUnknownFields: true });
		} catch {
			throw new Error(i18n.t('import.json.error_invalid_json'));
		}
		if (proto.player?.equipment) {
			await Database.loadLeftoversIfNecessary(proto.player.equipment);
		}
		host.fromProto(proto);
	},
};
