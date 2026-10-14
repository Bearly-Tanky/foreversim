// Sounds from the WoW install: weapon swings and hits on the wooden dummy (by weapon type),
// and each spell's own precast, cast and impact sounds (spell → visual → kits → sound kits).

import { fetchFile, row, rowsWhere } from './game.js';

const json = url => fetch(url).then(r => (r.ok ? r.json() : []));

// Item subclasses of weapons → the folder of their hit sounds.
const WEAPON_FOLDER = { 0: 'axe1h', 1: 'axe2h', 4: 'mace1h', 5: 'mace2h', 6: 'axe2h', 7: 'sword1h', 8: 'sword2h', 10: 'staff', 13: 'unarmed', 15: 'dagger' };
const TWO_HANDED = new Set([1, 5, 6, 8, 10]);

export class Sounds {
	constructor() {
		this.ctx = null;
		this.buffers = new Map();
		this.spellSets = new Map();
		this.weaponSets = new Map();
		this.loops = new Map();
		try {
			this.volume = Number(localStorage.getItem('practice-volume') ?? 0.6);
		} catch {
			this.volume = 0.6;
		}
	}

	/** Browsers only allow sound after a click or key press; call this from one. */
	unlock() {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createGain();
			this.master.connect(this.ctx.destination);
		}
		this.master.gain.value = this.volume;
		if (this.ctx.state === 'suspended') this.ctx.resume();
	}

	setVolume(volume) {
		this.volume = volume;
		if (this.master) this.master.gain.value = volume;
		try {
			localStorage.setItem('practice-volume', String(volume));
		} catch {}
	}

	buffer(fdid) {
		if (!this.buffers.has(fdid)) {
			this.buffers.set(
				fdid,
				fetchFile(fdid)
					.then(data => this.ctx.decodeAudioData(data.slice(0)))
					.catch(() => null),
			);
		}
		return this.buffers.get(fdid);
	}

	/** Plays one of the files (picked at random). Returns the playing source, for loops. */
	async play(files, { gain = 1, loop = false } = {}) {
		if (!this.ctx || !files?.length || this.volume <= 0) return null;
		const buffer = await this.buffer(files[Math.floor(Math.random() * files.length)]);
		if (!buffer) return null;
		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = loop;
		const g = this.ctx.createGain();
		g.gain.value = gain;
		source.connect(g).connect(this.master);
		source.start();
		return source;
	}

	startLoop(key, files, gain = 0.7) {
		this.stopLoop(key);
		const entry = { source: null, stopped: false };
		this.loops.set(key, entry);
		this.play(files, { gain, loop: true }).then(source => {
			if (entry.stopped) source?.stop();
			else entry.source = source;
		});
	}

	stopLoop(key) {
		const entry = this.loops.get(key);
		if (!entry) return;
		entry.stopped = true;
		try {
			entry.source?.stop();
		} catch {}
		this.loops.delete(key);
	}

	stopAll() {
		for (const key of [...this.loops.keys()]) this.stopLoop(key);
	}

	async files(dir, has) {
		const list = await json(`/api/sounds?dir=${encodeURIComponent(dir)}&has=${encodeURIComponent(has)}`);
		return list.map(f => f.fdid);
	}

	/** Swing, hit, crit and miss sounds for a weapon item (or bare hands). */
	weapon(itemId) {
		const key = itemId || 0;
		if (!this.weaponSets.has(key)) {
			this.weaponSets.set(
				key,
				(async () => {
					const item = itemId ? await row('Item', itemId) : null;
					const sub = item?.ClassID === 2 ? item.SubclassID : 13;
					if ([2, 18].includes(sub)) return { ranged: true, shot: await this.files('sound/item/weapons/bow/', 'bowrelease'), hit: await this.files('sound/item/weapons/bow/', 'arrowhit') };
					if (sub === 3) return { ranged: true, shot: await this.files('sound/item/weapons/gun/', 'gunfire'), hit: await this.files('sound/item/weapons/gun/', 'impact') };
					const folder = `sound/item/weapons/${WEAPON_FOLDER[sub] ?? 'sword1h'}/`;
					let hit = await this.files(folder, 'wood -crit -shield -parry');
					let crit = await this.files(folder, 'wood crit -shield');
					if (!hit.length) hit = await this.files(folder, 'hit -crit -parry');
					if (!crit.length) crit = await this.files(folder, 'crit');
					const size = TWO_HANDED.has(sub) ? 'large' : sub === 15 || sub === 13 ? 'small' : 'medium';
					return {
						hit,
						crit: crit.length ? crit : hit,
						swing: await this.files('sound/item/weapons/weaponswings/', `mwoosh${size} -crit`),
						swingCrit: await this.files('sound/item/weapons/weaponswings/', `mwoosh${size}crit`),
						miss: await this.files('sound/item/weapons/missswings/', TWO_HANDED.has(sub) ? '2handed' : '1handed'),
					};
				})(),
			);
		}
		return this.weaponSets.get(key);
	}

	/** A spell's own sounds: the precast loop, the cast and the impact. */
	spell(spellId) {
		if (!this.spellSets.has(spellId)) {
			this.spellSets.set(
				spellId,
				(async () => {
					const out = { precast: [], cast: [], impact: [] };
					const visual = (await rowsWhere('SpellXSpellVisual', 'SpellID', spellId)).sort((a, b) => a.DifficultyID - b.DifficultyID)[0];
					if (!visual) return out;
					for (const event of await rowsWhere('SpellVisualEvent', 'SpellVisualID', visual.SpellVisualID)) {
						// Start events: 1 precast, 3 cast, 6 impact.
						const slot = { 1: 'precast', 3: 'cast', 6: 'impact' }[event.StartEvent];
						if (!slot) continue;
						for (const effect of await rowsWhere('SpellVisualKitEffect', 'ParentSpellVisualKitID', event.SpellVisualKitID)) {
							if (effect.EffectType !== 5) continue;
							for (const entry of await rowsWhere('SoundKitEntry', 'SoundKitID', effect.Effect)) out[slot].push(entry.FileDataID);
						}
					}
					return out;
				})(),
			);
		}
		return this.spellSets.get(spellId);
	}
}
