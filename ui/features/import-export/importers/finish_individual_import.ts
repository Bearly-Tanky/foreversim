import type { Class, EquipmentSpec, Profession, Race } from '@generated/proto/common';
import { Database } from '@sim/proto/database';
import { classNames } from '@sim/proto/names';
import type { IndividualSimHost } from '@sim/sim_host';
import { batch } from '@sim/state/batch';
import { toastManager } from '@ui-kit/Toast';

export interface IndividualImport {
	charClass: Class;
	race: Race;
	equipmentSpec: EquipmentSpec;
	talentsStr: string;
	professions: Profession[];
	missingEnchants?: number[];
	missingItems?: number[];
}

export const finishIndividualImport = async (
	host: IndividualSimHost<any>,
	{ charClass, race, equipmentSpec, talentsStr, professions, missingEnchants = [], missingItems = [] }: IndividualImport,
): Promise<void> => {
	if (charClass != host.player.getClass()) {
		throw new Error(`Wrong Class! Expected ${host.player.getPlayerClass().friendlyName} but found ${classNames.get(charClass)}!`);
	}

	await Database.loadLeftoversIfNecessary(equipmentSpec);

	const gear = host.sim.db.lookupEquipmentSpec(equipmentSpec);

	// A talent string is positional: digit i of tree t is talents[i] of whatever tree the exporter
	// was built against. Forever's trees are a different set, so applying an imported string would
	// spend the points on other talents rather than fail. No exporter targets these trees yet.
	const importedTalents = !!talentsStr && talentsStr != '--';

	batch(() => {
		host.player.setRace(race);
		host.player.setGear(gear);
		if (professions.length > 0) {
			host.player.setProfessions(professions);
		}
	});

	if (importedTalents) {
		toastManager.add({
			variant: 'warning',
			body: 'The exported talents are for a different talent tree, so they were not imported. Set them on the Talents tab.',
			delay: 8000,
		});
	}

	if (missingItems.length == 0 && missingEnchants.length == 0) {
		toastManager.add({ variant: 'success', body: `Import successful!` });
	} else {
		toastManager.add({
			variant: 'info',
			body:
				'Import successful, but the following IDs were not found in the sim database:' +
				(missingItems.length == 0 ? '' : '\n\nItems: ' + missingItems.join(', ')) +
				(missingEnchants.length == 0 ? '' : '\n\nEnchants: ' + missingEnchants.join(', ')),
		});
	}
};
