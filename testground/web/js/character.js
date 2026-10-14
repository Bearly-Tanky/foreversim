// A player character: the race's model with its customization (skin, face, hair) and the gear
// it wears — weapons, helm and shoulders as models on attachment points, armor painted into
// the body texture, and geosets (sleeves, boots, robes, capes) switched on by the items.

import * as THREE from 'three';

import { itemAppearance, row, rowsWhere } from './game.js';
import { loadImage, loadTexture, M2Model, prepareTexture } from './model.js';

export const RACES = [
	{ id: 1, name: 'Human', sim: 'RaceHuman' },
	{ id: 3, name: 'Dwarf', sim: 'RaceDwarf' },
	{ id: 4, name: 'Night Elf', sim: 'RaceNightElf' },
	{ id: 7, name: 'Gnome', sim: 'RaceGnome' },
	{ id: 2, name: 'Orc', sim: 'RaceOrc' },
	{ id: 5, name: 'Undead', sim: 'RaceUndead' },
	{ id: 6, name: 'Tauren', sim: 'RaceTauren' },
	{ id: 8, name: 'Troll', sim: 'RaceTroll' },
	{ id: 10, name: 'Blood Elf', sim: 'RaceBloodElf' },
	{ id: 95, name: 'High Order Skyborne', sim: 'RaceHighOrderSkyborne' },
	{ id: 96, name: 'Windshaper Skyborne', sim: 'RaceWindshaperSkyborne' },
];

// Sim item slots (proto ItemSlot order).
export const SLOTS = ['Head', 'Neck', 'Shoulder', 'Back', 'Chest', 'Wrist', 'Hands', 'Waist', 'Legs', 'Feet', 'Finger1', 'Finger2', 'Trinket1', 'Trinket2', 'MainHand', 'OffHand', 'Ranged'];
export const SHOWN_SLOTS = ['Head', 'Shoulder', 'Back', 'Chest', 'Shirt', 'Tabard', 'Wrist', 'Hands', 'Waist', 'Legs', 'Feet', 'MainHand', 'OffHand', 'Ranged'];

// Attachment points.
const AT = { Shield: 0, HandRight: 1, HandLeft: 2, ShoulderRight: 5, ShoulderLeft: 6, Helm: 11, Back: 12, SheathMainHand: 26, SheathOffHand: 27, SheathShield: 28, Quiver: 30 };

// Body texture sections armor paints into.
// Order armor is painted in, bottom first: a chest covers the shirt, gloves cover sleeves.
const PAINT_ORDER = ['Shirt', 'Legs', 'Feet', 'Chest', 'Wrist', 'Hands', 'Tabard', 'Waist', 'Back'];

/** The models, layouts and customization choices of a race and sex. */
export async function characterBase(raceId, sex) {
	const link = (await rowsWhere('ChrRaceXChrModel', 'ChrRacesID', raceId)).find(r => r.Sex === sex);
	if (!link) throw new Error(`no model for race ${raceId}`);
	const chrModel = await row('ChrModel', link.ChrModelID);
	const display = await row('CreatureDisplayInfo', chrModel.DisplayID);
	const modelData = await row('CreatureModelData', display.ModelID);

	const options = [];
	for (const option of (await rowsWhere('ChrCustomizationOption', 'ChrModelID', chrModel.ID)).sort((a, b) => a.OrderIndex - b.OrderIndex)) {
		const choices = (await rowsWhere('ChrCustomizationChoice', 'ChrCustomizationOptionID', option.ID)).sort((a, b) => a.OrderIndex - b.OrderIndex);
		if (choices.length) options.push({ id: option.ID, name: option.Name_lang, choices: choices.map((c, i) => ({ id: c.ID, name: c.Name_lang || `${i + 1}` })) });
	}

	const layoutId = chrModel.CharComponentTextureLayoutID;
	const layout = await row('CharComponentTextureLayouts', layoutId);
	const materials = await rowsWhere('ChrModelMaterial', 'CharComponentTextureLayoutsID', layoutId);
	const sections = {};
	for (const s of await rowsWhere('CharComponentTextureSections', 'CharComponentTextureLayoutID', layoutId)) sections[s.SectionType] = s;

	return { raceId, sex, chrModel, modelFile: modelData.FileDataID, options, layout, materials, sections };
}

/** A sensible look to start from: the first choice of everything, but with hair. */
export function defaultChoices(base) {
	const choices = {};
	for (const option of base.options) {
		const pick = /hair style/i.test(option.name) && option.choices.length > 2 ? 2 : 0;
		choices[option.id] = option.choices[pick].id;
	}
	return choices;
}

export class Character {
	static async create(raceId, sex) {
		const base = await characterBase(raceId, sex);
		const model = await M2Model.load(base.modelFile);
		return new Character(base, model);
	}

	constructor(base, model) {
		this.base = base;
		this.model = model;
		this.root = model.root;
		this.choices = defaultChoices(base);
		this.gear = {};
		this.canvases = new Map();
	}

	/** The gear, as {slot: itemId}, and the customization, as {optionId: choiceId}. */
	async dress({ gear = this.gear, choices = this.choices } = {}) {
		this.gear = gear;
		this.choices = choices;
		const { base, model } = this;

		// Customization: geosets and texture layers from every chosen element.
		const chosen = new Set(Object.values(choices));
		const geosets = new Map();
		const layers = [];
		for (const choiceId of chosen) {
			for (const element of await rowsWhere('ChrCustomizationElement', 'ChrCustomizationChoiceID', choiceId)) {
				if (element.RelatedChrCustomizationChoiceID && !chosen.has(element.RelatedChrCustomizationChoiceID)) continue;
				if (element.ChrCustomizationGeosetID) {
					const g = await row('ChrCustomizationGeoset', element.ChrCustomizationGeosetID);
					geosets.set(g.GeosetType, g.GeosetID);
				}
				if (element.ChrCustomizationMaterialID) {
					const m = await row('ChrCustomizationMaterial', element.ChrCustomizationMaterialID);
					const files = await rowsWhere('TextureFileData', 'MaterialResourcesID', m.MaterialResourcesID);
					const file = (files.find(f => f.UsageType === 0) ?? files[0])?.FileDataID;
					for (const layer of await rowsWhere('ChrModelTextureLayer', 'ChrModelTextureTargetID', m.ChrModelTextureTargetID)) {
						if (layer.CharComponentTextureLayoutsID !== base.layout.ID || !file) continue;
						layers.push({ textureType: layer.TextureType, layer: layer.Layer, blend: layer.BlendMode, mask: layer.TextureSectionTypeBitMask, file });
					}
				}
			}
		}

		// Gear.
		const items = {};
		for (const [slot, itemId] of Object.entries(gear)) {
			if (!itemId) continue;
			try {
				items[slot] = await itemAppearance(itemId);
			} catch (error) {
				console.warn(`slot ${slot}: ${error.message}`);
			}
		}
		this.items = items;
		const geosetOverride = (group, value) => geosets.set(group, value);
		const gg = slot => items[slot]?.display.GeosetGroup ?? [0, 0, 0, 0, 0, 0];
		const robe = items.Chest && gg('Chest')[2] > 0;

		if (items.Shirt || items.Chest) {
			const [sleeve] = items.Chest ? gg('Chest') : gg('Shirt');
			if (sleeve) geosetOverride(8, 1 + sleeve);
			const chest = (items.Chest ? gg('Chest') : gg('Shirt'))[1];
			if (chest) geosetOverride(10, 1 + chest);
		}
		if (items.Legs && !robe) {
			const [pants, cuffs, trousers] = gg('Legs');
			if (pants) geosetOverride(11, 1 + pants);
			if (cuffs) geosetOverride(9, 1 + cuffs);
			if (trousers) geosetOverride(13, 1 + trousers);
		}
		if (robe) geosetOverride(13, 1 + gg('Chest')[2]);
		if (items.Hands) {
			const [gloves] = gg('Hands');
			if (gloves) {
				geosetOverride(4, 1 + gloves);
				geosets.set(8, 1); // Gloves with cuffs hide sleeves.
			}
		}
		if (items.Feet) {
			const [boots, feet] = gg('Feet');
			geosetOverride(5, 1 + boots);
			if (feet) geosetOverride(20, 1 + feet);
			else geosetOverride(20, 2);
		}
		if (items.Waist && gg('Waist')[0]) geosetOverride(18, 1 + gg('Waist')[0]);
		if (items.Tabard) geosetOverride(12, 1 + (gg('Tabard')[0] || 1));
		if (items.Back) geosetOverride(15, 1 + (gg('Back')[0] || 1));

		// A helm hides hair, ears and facial hair as its race's rows say.
		const hidden = new Set();
		if (items.Head) {
			const vis = items.Head.display.HelmetGeosetVis[base.sex];
			if (vis) for (const r of await rowsWhere('HelmetGeosetData', 'HelmetGeosetVisDataID', vis)) if (r.RaceID === base.raceId) hidden.add(r.HideGeosetGroup);
		}

		model.setGeosets(id => {
			const group = Math.floor(id / 100);
			if (hidden.has(group)) return id === 0;
			if (group === 0) return id === 0 || id === (geosets.get(0) ?? -1);
			// Eye glow is for death knights and the like; off unless something turns it on.
			if (group === 17) return geosets.has(17) && id % 100 === geosets.get(17);
			return id % 100 === (geosets.get(group) ?? 1);
		});

		// Body textures: customization layers, then armor on top.
		for (const material of base.materials) {
			const canvas = await this.composite(material, layers.filter(l => l.textureType === material.TextureType), material.TextureType === 1 ? items : {});
			model.setReplaceable(material.TextureType, canvas);
		}
		if (items.Back) {
			const capeFile = items.Back.models[0]?.textures[0] ?? (await this.firstTexture(items.Back.display.ModelMaterialResourcesID[0]));
			model.setReplaceable(2, capeFile || null);
		} else {
			model.setReplaceable(2, null);
		}
		await model.applyMaterials();

		await this.attachGear(items);
	}

	async firstTexture(materialResourcesId) {
		if (!materialResourcesId) return 0;
		return (await rowsWhere('TextureFileData', 'MaterialResourcesID', materialResourcesId))[0]?.FileDataID ?? 0;
	}

	async composite(material, layers, items) {
		const key = material.TextureType;
		let entry = this.canvases.get(key);
		if (!entry) {
			const canvas = document.createElement('canvas');
			canvas.width = material.Width;
			canvas.height = material.Height;
			entry = { canvas, texture: prepareTexture(new THREE.CanvasTexture(canvas)) };
			entry.texture.flipY = false;
			this.canvases.set(key, entry);
		}
		const { canvas, texture } = entry;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const sx = canvas.width / this.base.layout.Width;
		const sy = canvas.height / this.base.layout.Height;
		const rect = section => {
			const s = this.base.sections[section];
			return s ? [s.X * sx, s.Y * sy, s.Width * sx, s.Height * sy] : null;
		};

		for (const layer of layers.sort((a, b) => a.layer - b.layer)) {
			const image = await loadImage(layer.file).catch(() => null);
			if (!image) continue;
			ctx.globalCompositeOperation = layer.blend === 4 ? 'multiply' : layer.blend === 6 ? 'overlay' : layer.blend === 7 ? 'screen' : 'source-over';
			if (layer.mask === -1) {
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
			} else {
				for (let bit = 0; bit < 32; bit++) {
					if (!(layer.mask & (1 << bit))) continue;
					const r = rect(bit);
					if (r) ctx.drawImage(image, ...r);
				}
			}
		}
		ctx.globalCompositeOperation = 'source-over';

		// Armor: each item's textures go into the body sections they name.
		for (const slot of PAINT_ORDER) {
			const item = items[slot];
			if (!item) continue;
			for (const piece of item.bodyTextures) {
				const file = await this.pickComponentTexture(piece.files);
				const image = file ? await loadImage(file).catch(() => null) : null;
				const r = rect(piece.section);
				if (image && r) ctx.drawImage(image, ...r);
			}
		}
		texture.needsUpdate = true;
		return texture;
	}

	/** Of an item's per-race and per-sex textures, the one this character wears. */
	async pickComponentTexture(files) {
		if (files.length <= 1) return files[0] ?? 0;
		const scored = [];
		for (const file of files) {
			const info = (await rowsWhere('ComponentTextureFileData', 'ID', file))[0];
			let score = 0;
			if (info) {
				if (info.RaceID === this.base.raceId) score += 4;
				else if (info.RaceID !== 0) score -= 8;
				if (info.GenderIndex === this.base.sex) score += 2;
				else if (info.GenderIndex === 2 || info.GenderIndex === 3) score += 1;
				else score -= 8;
			}
			scored.push({ file, score });
		}
		scored.sort((a, b) => b.score - a.score);
		return scored[0].file;
	}

	/** Of an item's per-race and per-sex models, the one for this character (and side, for shoulders). */
	async pickComponentModel(files, position = -1) {
		if (files.length <= 1) return files[0] ?? 0;
		const scored = [];
		for (const file of files) {
			const info = (await rowsWhere('ComponentModelFileData', 'ID', file))[0];
			let score = 0;
			if (info) {
				if (position >= 0) score += info.PositionIndex === position ? 16 : -16;
				if (info.RaceID === this.base.raceId) score += 4;
				else if (info.RaceID !== 0) score -= 8;
				if (info.GenderIndex === this.base.sex) score += 2;
				else if (info.GenderIndex === 2 || info.GenderIndex === 3) score += 1;
				else score -= 8;
			}
			scored.push({ file, score });
		}
		scored.sort((a, b) => b.score - a.score);
		return scored[0].file;
	}

	async itemModel(item, index, position = -1) {
		const entry = item.models[index];
		if (!entry?.files.length) return null;
		const file = await this.pickComponentModel(entry.files, position);
		const model = await M2Model.load(file);
		const texture = entry.textures.length > 1 ? await this.pickComponentTexture(entry.textures) : entry.textures[0];
		if (texture) model.setReplaceable(2, texture);
		await model.applyMaterials();
		model.inner.rotation.set(0, 0, 0);
		return model;
	}

	async attachGear(items) {
		const { model } = this;
		this.itemModels = [];
		for (const key of [...model.attached.keys()]) model.detach(key);
		const hang = async (slot, index, point, position = -1, key = `${slot}${index}`) => {
			const item = items[slot];
			if (!item) return;
			const m = await this.itemModel(item, index, position).catch(error => console.warn(slot, error));
			if (!m) return;
			model.attach(point, m.mesh, key);
			this.itemModels.push(m);
		};

		await hang('Head', 0, AT.Helm);
		if (items.Shoulder) {
			// Left is the first model, right the second (or the first again, mirrored by its file).
			await hang('Shoulder', 0, AT.ShoulderLeft, 0, 'ShoulderL');
			await hang('Shoulder', items.Shoulder.models[1] ? 1 : 0, AT.ShoulderRight, 1, 'ShoulderR');
		}
		await hang('MainHand', 0, AT.HandRight);
		if (items.OffHand) {
			const shield = items.OffHand.inventoryType === 14;
			await hang('OffHand', 0, shield ? AT.Shield : AT.HandLeft);
		}
		if (items.Ranged && items.Ranged.inventoryType !== 25) await hang('Ranged', 0, AT.SheathShield);
	}

	/** Moves the ranged weapon between the back and the left hand (for shooting). */
	holdRanged(inHand) {
		const slot = this.model.attached.get('Ranged0');
		if (!slot) return;
		const object = slot.holder.children[0];
		this.model.detach('Ranged0');
		// Shooting puts the melee weapons away; dressing again brings them back.
		if (inHand) for (const key of ['MainHand0', 'OffHand0']) this.model.detach(key);
		this.model.attach(inHand ? AT.HandLeft : AT.SheathShield, object, 'Ranged0');
	}

	update(deltaMs) {
		this.model.update(deltaMs);
		for (const m of this.itemModels ?? []) m.update(deltaMs);
	}
}
