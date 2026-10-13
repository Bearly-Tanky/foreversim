import type { ItemSlot, Spec } from '@generated/proto/common';
import type { Player } from '@sim/player/player';
import { batch } from '@sim/state/batch';

/** Exchanges the equipped item and the swap item in each of `itemSlots`, in one batch so the two writes land as a single notification. */
export const swapWithGear = <SpecType extends Spec>(player: Player<SpecType>, itemSlots: ReadonlyArray<ItemSlot>): void => {
	let newGear = player.getGear();
	let newSwapGear = player.itemSwapSettings.getGear();

	for (const slot of itemSlots) {
		const gearItem = player.getGear().getEquippedItem(slot);
		const swapItem = player.itemSwapSettings.getGear().getEquippedItem(slot);
		newGear = newGear.withEquippedItem(slot, swapItem);
		newSwapGear = newSwapGear.withEquippedItem(slot, gearItem);
	}

	batch(() => {
		player.setGear(newGear);
		player.itemSwapSettings.setGear(newSwapGear);
	});
};
