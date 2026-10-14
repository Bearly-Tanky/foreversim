// Talking to the testground server: game files and table rows, with items resolved to the
// models and textures that draw them.

// Node scripts (for probing) reach the server directly; the page uses its own origin.
const BASE = globalThis.location ? '' : 'http://127.0.0.1:8090';
const cache = new Map();

export const fetchFile = fdid => {
	if (!cache.has(`f${fdid}`)) {
		cache.set(
			`f${fdid}`,
			fetch(`${BASE}/api/file/${fdid}`).then(r => {
				if (!r.ok) throw new Error(`file ${fdid}: ${r.status}`);
				return r.arrayBuffer();
			}),
		);
	}
	return cache.get(`f${fdid}`);
};

const json = url => {
	if (!cache.has(url)) {
		cache.set(
			url,
			fetch(BASE + url).then(r => {
				if (!r.ok) throw new Error(`${url}: ${r.status}`);
				return r.json();
			}),
		);
	}
	return cache.get(url);
};

export const row = (table, id) => json(`/api/db/${table}/${id}`);
export const rowsWhere = (table, col, value, limit = 200) => json(`/api/db/${table}?col=${col}&eq=${value}&limit=${limit}`);
export const search = (table, col, text, limit = 50) => json(`/api/db/${table}?col=${col}&like=${encodeURIComponent(text)}&limit=${limit}`);

export const INVENTORY_TYPE = {
	1: 'Head',
	2: 'Neck',
	3: 'Shoulder',
	4: 'Shirt',
	5: 'Chest',
	6: 'Waist',
	7: 'Legs',
	8: 'Feet',
	9: 'Wrist',
	10: 'Hands',
	11: 'Finger',
	12: 'Trinket',
	13: 'One-hand',
	14: 'Shield',
	15: 'Ranged',
	16: 'Back',
	17: 'Two-hand',
	19: 'Tabard',
	20: 'Robe',
	21: 'Main hand',
	22: 'Off hand',
	23: 'Held in off hand',
	25: 'Thrown',
	26: 'Ranged',
};

// The sim's own item list. The client ships names for only some items (the server sends the
// rest while playing), so this fills in the names of everything the sim knows.
const SIM_TYPE = ['', 'Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Wrist', 'Hands', 'Waist', 'Legs', 'Feet', 'Finger', 'Trinket', 'Weapon', 'Ranged'];
let simItems;
export const simItemList = () =>
	(simItems ??= fetch('/forever/assets/database/db.json')
		.then(r => (r.ok ? r.json() : { items: [] }))
		.then(db => new Map(db.items.map(item => [item.id, { id: item.id, name: item.name, quality: item.quality ?? 1, slot: SIM_TYPE[item.type] ?? 'Item' }])))
		.catch(() => new Map()));

/** Items whose name has every word of the text: the sim's first, then the rest of the client's. */
export async function searchItems(text, limit = 80) {
	const words = text.toLowerCase().split(/\s+/).filter(Boolean);
	const matches = name => words.every(word => name.toLowerCase().includes(word));
	const found = [...(await simItemList()).values()].filter(item => matches(item.name)).slice(0, limit);
	const seen = new Set(found.map(item => item.id));
	for (const row of await search('ItemSparse', 'Display_lang', words[0] ?? '', 200)) {
		if (found.length >= limit) break;
		if (seen.has(row.ID) || !matches(row.Display_lang)) continue;
		found.push({ id: row.ID, name: row.Display_lang, quality: row.OverallQualityID, slot: INVENTORY_TYPE[row.InventoryType] ?? 'Other' });
	}
	return found;
}

/** The appearance an item shows by default: the one with the lowest modifier. */
export async function itemDisplay(itemId) {
	const sparse = await row('ItemSparse', itemId);
	const base = await row('Item', itemId);
	const known = globalThis.location ? (await simItemList()).get(itemId) : null;
	const modified = await rowsWhere('ItemModifiedAppearance', 'ItemID', itemId);
	if (!modified.length) throw new Error(`item ${itemId} has no appearance`);
	modified.sort((a, b) => a.ItemAppearanceModifierID - b.ItemAppearanceModifierID || a.OrderIndex - b.OrderIndex);
	const appearance = await row('ItemAppearance', modified[0].ItemAppearanceID);
	const display = await row('ItemDisplayInfo', appearance.ItemDisplayInfoID);
	if (!display) throw new Error(`item ${itemId}: no display info ${appearance.ItemDisplayInfoID}`);

	const models = [];
	for (let i = 0; i < 2; i++) {
		const resources = display.ModelResourcesID[i];
		if (!resources) continue;
		const files = await rowsWhere('ModelFileData', 'ModelResourcesID', resources);
		const textures = display.ModelMaterialResourcesID[i] ? await rowsWhere('TextureFileData', 'MaterialResourcesID', display.ModelMaterialResourcesID[i]) : [];
		models.push({ files: files.map(f => f.FileDataID ?? f.ID), textures: textures.map(t => t.FileDataID ?? t.ID) });
	}
	return {
		id: itemId,
		name: sparse?.Display_lang ?? known?.name ?? `Item ${itemId}`,
		quality: sparse?.OverallQualityID ?? known?.quality ?? 1,
		inventoryType: base?.InventoryType ?? sparse?.InventoryType ?? 0,
		slot: INVENTORY_TYPE[base?.InventoryType ?? sparse?.InventoryType] ?? known?.slot ?? 'Item',
		icon: appearance.DefaultIconFileDataID,
		display,
		models,
	};
}

/** An item's display plus the textures it paints on the body: [{section, files}]. */
export async function itemAppearance(itemId) {
	const item = await itemDisplay(itemId);
	const bodyTextures = [];
	for (const res of await rowsWhere('ItemDisplayInfoMaterialRes', 'ItemDisplayInfoID', item.display.ID)) {
		const files = await rowsWhere('TextureFileData', 'MaterialResourcesID', res.MaterialResourcesID);
		bodyTextures.push({ section: res.ComponentSection, files: files.filter(f => f.UsageType === 0).map(f => f.FileDataID) });
	}
	return { ...item, bodyTextures };
}
