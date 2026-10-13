import { ItemSlot } from '@generated/proto/common';

const emptySlotIcons: Record<ItemSlot, string> = {
	[ItemSlot.ItemSlotHead]: '/forever/assets/item_slots/head.jpg',
	[ItemSlot.ItemSlotNeck]: '/forever/assets/item_slots/neck.jpg',
	[ItemSlot.ItemSlotShoulder]: '/forever/assets/item_slots/shoulders.jpg',
	[ItemSlot.ItemSlotBack]: '/forever/assets/item_slots/shirt.jpg',
	[ItemSlot.ItemSlotChest]: '/forever/assets/item_slots/chest.jpg',
	[ItemSlot.ItemSlotWrist]: '/forever/assets/item_slots/wrists.jpg',
	[ItemSlot.ItemSlotHands]: '/forever/assets/item_slots/hands.jpg',
	[ItemSlot.ItemSlotWaist]: '/forever/assets/item_slots/waist.jpg',
	[ItemSlot.ItemSlotLegs]: '/forever/assets/item_slots/legs.jpg',
	[ItemSlot.ItemSlotFeet]: '/forever/assets/item_slots/feet.jpg',
	[ItemSlot.ItemSlotFinger1]: '/forever/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotFinger2]: '/forever/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotTrinket1]: '/forever/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotTrinket2]: '/forever/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotMainHand]: '/forever/assets/item_slots/mainhand.jpg',
	[ItemSlot.ItemSlotOffHand]: '/forever/assets/item_slots/offhand.jpg',
	[ItemSlot.ItemSlotRanged]: '/forever/assets/item_slots/ranged.jpg',
};

export const getEmptySlotIconUrl = (slot: ItemSlot): string => emptySlotIcons[slot];
