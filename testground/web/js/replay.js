// Fight replay: runs one fight of a character saved in the sim, then plays it back — the
// character swinging and casting at the sim's exact times against a target dummy, with floating
// damage numbers, a live DPS meter and the ability breakdown.

import * as THREE from 'three';

import { decodeBlp } from './blp.js';
import { fetchFile, row, rowsWhere, simItemList } from './game.js';
import { ANIM, M2Model } from './model.js';

const DUMMY_MODEL = 125259; // creature/object/woodendummy.m2

// --- Getting the fight ---

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let pages;
/** The sim's pages and the storage keys they save under (specs.json, made by tools/gen_specs.py). */
export const simPages = () => (pages ??= fetch('/specs.json').then(r => (r.ok ? r.json() : [])).catch(() => []));

/** The sim page a saved character belongs to: "__forever_shadow_priest__currentSettings__" → "priest/dps". */
export async function specPageFor(key) {
	const page = (await simPages()).find(p => `${p.key}__currentSettings__` === key);
	return page?.path ?? null;
}

/**
 * Opens the sim page in a hidden frame, presses Simulate and keeps the request it sends its
 * worker, so the fight is exactly what the sim would run (rotation, buffs, encounter and all).
 */
export async function captureSimRequest(specPath, onStatus) {
	const iframe = document.createElement('iframe');
	iframe.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0';
	iframe.src = `/forever/${specPath}/?view=simple`;
	document.body.append(iframe);
	try {
		await new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
		onStatus('Loading the sim…');
		const win = iframe.contentWindow;
		let button = null;
		for (const deadline = Date.now() + 120000; Date.now() < deadline; await sleep(250)) {
			button = win.document.querySelector('[data-testid="simple-simulate"]');
			if (button && !button.disabled) break;
			// Healer specs are planned in the sim but not simulated yet: there is nothing to run.
			if (/can be planned but not simulated/i.test(win.document.body?.textContent ?? '')) throw new Error('the sim cannot simulate this spec yet (it only plans its gear), so it cannot fight here');
		}
		if (!button || button.disabled) throw new Error('the sim page did not get ready');
		const captured = new Promise((resolve, reject) => {
			const original = win.Worker.prototype.postMessage;
			win.Worker.prototype.postMessage = function (message, ...rest) {
				if (message?.msg === 'raidSimAsync' && message.inputData) {
					win.Worker.prototype.postMessage = original;
					resolve(new Uint8Array(message.inputData));
					return;
				}
				return original.call(this, message, ...rest);
			};
			setTimeout(() => reject(new Error('the sim did not start a run')), 30000);
		});
		button.click();
		return await captured;
	} finally {
		iframe.remove();
	}
}

async function runFight(request, seed) {
	const response = await fetch(`/api/replay-request${seed ? `?seed=${seed}` : ''}`, { method: 'POST', body: request });
	if (!response.ok) throw new Error(await response.text());
	return response.json();
}

// --- Reading the log ---

export function parseAction(text) {
	const out = {};
	for (const part of text.split(',')) {
		const [k, v] = part.split(':').map(s => s.trim());
		out[k] = Number(v);
	}
	const key = out.SpellID ? `s${out.SpellID}` : out.OtherID ? `o${out.OtherID}` : out.ItemID ? `i${out.ItemID}` : text;
	return { spellId: out.SpellID ?? 0, otherId: out.OtherID ?? 0, itemId: out.ItemID ?? 0, tag: out.Tag ?? 0, // Hands split only white swings; a spell's hits are one row whichever hand landed them.
		key: out.OtherID === 3 ? `${key}:${out.Tag ?? 0}` : key };
}

const LINE = /^\[([\d.]+)\] \[([^\]]+)\] (.*)$/;
const DAMAGE = /^\[Target (\d+)\] \{([^}]*)\} (tick )?(Hit|Crit|Glance|Block|CritBlock|Miss|Dodge|Parry|Resist|Immune)(?: for ([\d.]+) damage)?/;
const CAST = /^Casting \{([^}]*)\} \(Cost = [\d.]+, Cast Time = ([\d.]+)(ms|s)/;
const RESOURCE = /(?:Gained|Spent) [\d.]+ (rage|energy|mana|focus)[^(]*\(([\d.]+) --> ([\d.]+)\)(?: of ([\d.]+) total)?/i;
const AURA = /^Aura (gained|faded): \{([^}]*)\}/;

export function parseLog(logs, playerName = 'Player') {
	const events = [];
	const isPlayer = source => source.startsWith(`${playerName} (#`) || source === playerName;
	for (const line of logs.split('\n')) {
		const m = LINE.exec(line);
		if (!m) continue;
		const time = Number(m[1]);
		const source = m[2];
		const rest = m[3];
		// Pets count toward the meter but are not animated.
		const mine = isPlayer(source);
		const fromPet = !mine && source.includes(' - ');
		let d;
		if ((mine || fromPet) && (d = DAMAGE.exec(rest))) {
			const school = Number(/SpellSchool: (\d+)/.exec(rest)?.[1] ?? 1);
			events.push({ time, type: 'damage', action: parseAction(d[2]), tick: !!d[3], outcome: d[4], amount: Number(d[5] ?? 0), target: Number(d[1]), pet: fromPet, school });
			continue;
		}
		if (!mine) continue;
		if ((d = CAST.exec(rest))) {
			const castTime = Number(d[2]) / (d[3] === 'ms' ? 1000 : 1);
			events.push({ time, type: 'cast', action: parseAction(d[1]), castTime });
		} else if ((d = RESOURCE.exec(rest))) {
			events.push({ time, type: 'resource', kind: d[1].toLowerCase(), value: Number(d[3]), max: Number(d[4] ?? 100) });
		} else if ((d = AURA.exec(rest))) {
			events.push({ time, type: d[1] === 'gained' ? 'auraOn' : 'auraOff', action: parseAction(d[2]) });
		}
	}
	return events;
}

// --- Names and icons ---

export const names = new Map();
export async function actionInfo(action) {
	const key = action.key;
	if (names.has(key)) return names.get(key);
	const promise = (async () => {
		if (action.otherId === 3) return { name: action.tag === 2 ? 'Melee (off hand)' : 'Melee', icon: 'melee' };
		if (action.otherId === 4) return { name: 'Shoot', icon: 'melee' };
		if (action.itemId) {
			const item = await row('Item', action.itemId);
			const sparse = await row('ItemSparse', action.itemId);
			const known = (await simItemList()).get(action.itemId);
			return { name: sparse?.Display_lang ?? known?.name ?? `Item ${action.itemId}`, icon: item?.IconFileDataID ?? null };
		}
		const name = (await row('SpellName', action.spellId))?.Name_lang ?? `Spell ${action.spellId}`;
		const misc = (await rowsWhere('SpellMisc', 'SpellID', action.spellId))[0];
		return { name, icon: misc?.SpellIconFileDataID ?? null };
	})();
	names.set(key, promise);
	return promise;
}

const icons = new Map();
export function iconUrl(fdid) {
	if (!fdid || fdid === 'melee') return Promise.resolve(fdid === 'melee' ? 'melee' : null);
	if (!icons.has(fdid)) {
		icons.set(
			fdid,
			fetchFile(fdid)
				.then(buffer => {
					const { width, height, rgba } = decodeBlp(buffer);
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), width, height), 0, 0);
					return canvas.toDataURL();
				})
				.catch(() => null),
		);
	}
	return icons.get(fdid);
}

// --- The replay ---

// Spell schools: holy, fire, nature, frost, shadow, arcane.
const SCHOOL_COLOR = { 2: 0xffe680, 4: 0xff7a1a, 8: 0x6dff4a, 16: 0x6cc8ff, 32: 0xa050ff, 64: 0xff7cf0 };

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Replay {
	constructor(env) {
		this.env = env;
		this.panel = document.getElementById('replay-panel');
		this.overlay = document.getElementById('overlay');
		this.group = new THREE.Group();
		this.events = [];
		this.time = 0;
		this.cursor = 0;
		this.speed = 1;
		this.playing = false;
		this.floaters = [];
		this.projectiles = [];
		this.chosenKey = null;
		this.buildPanel();
	}

	buildPanel() {
		this.panel.innerHTML = `
			<p class="hint" style="margin:0">Runs one fight of a character you set up in the sim and plays it back. Open the sim from <a href="/forever/">this server</a>, pick gear and talents there, then come back.</p>
			<select id="replay-sim"></select>
			<button id="replay-run">Run a fight</button>
			<div class="row" id="replay-speed"><button data-speed="1">1×</button><button data-speed="2">2×</button><button data-speed="4">4×</button><button data-speed="8">8×</button></div>
			<label>Distance to the target <select id="replay-distance"><option value="auto">Automatic</option><option value="melee">Melee</option><option value="ranged">Ranged</option></select></label>
			<div id="replay-info" class="hint"></div>`;
		this.panel.style.cssText = 'display:flex;flex-direction:column;gap:10px';
		this.simSelect = this.panel.querySelector('#replay-sim');
		this.simSelect.addEventListener('focus', () => this.renderSims());
		this.simSelect.addEventListener('change', () => this.pickSim(this.simSelect.value));
		this.panel.querySelector('#replay-run').addEventListener('click', () => this.run());
		for (const b of this.panel.querySelectorAll('[data-speed]')) b.addEventListener('click', () => this.setSpeed(Number(b.dataset.speed)));
		this.panel.querySelector('#replay-distance').addEventListener('change', () => this.placeActors());
		this.setSpeed(1);
	}

	renderSims() {
		const sims = this.env.savedSims();
		this.simSelect.innerHTML = '';
		if (!sims.length) this.simSelect.append(new Option('No sim characters yet', ''));
		for (const sim of sims) this.simSelect.append(new Option(sim.label, sim.key));
		if (this.chosenKey && sims.some(s => s.key === this.chosenKey)) this.simSelect.value = this.chosenKey;
		else this.chosenKey = this.simSelect.value || null;
	}

	/** Dresses the character as the picked sim character right away. */
	async pickSim(key) {
		this.chosenKey = key;
		const sim = this.env.savedSims().find(s => s.key === key);
		if (!sim) return;
		this.env.status.textContent = `Dressing ${sim.label}…`;
		await this.env.applySim(sim.settings);
		this.character = await this.env.getCharacter();
		if (this.active) await this.setupScene();
		this.env.status.textContent = `${sim.label}: ready.`;
	}

	setSpeed(speed) {
		this.speed = speed;
		for (const b of this.panel.querySelectorAll('[data-speed]')) b.toggleAttribute('data-active', Number(b.dataset.speed) === speed);
	}

	async open() {
		this.renderSims();
		this.active = true;
		this.character = await this.env.getCharacter();
		if (!this.active) return;
		await this.setupScene();
		this.env.title.textContent = 'Fight replay';
		if (!this.events.length) this.env.status.textContent = 'Pick a sim character and press “Run a fight”.';
		this.renderHud();
	}

	close() {
		this.active = false;
		this.env.camera.clearViewOffset();
		this.viewW = this.viewH = 0;
		this.playing = false;
		this.overlay.innerHTML = '';
		for (const f of this.floaters) f.el.remove();
		this.floaters = [];
		if (this.character) {
			this.character.holdRanged(false);
			this.character.root.rotation.set(0, 0, 0);
			this.character.root.position.set(0, 0, 0);
		}
	}

	async setupScene() {
		if (!this.dummy) {
			this.dummy = await M2Model.load(DUMMY_MODEL);
			await this.dummy.applyMaterials();
			this.dummy.root.scale.setScalar(1.1);
			await this.dummy.play(0);
			this.group.add(this.dummy.root);
		}
		for (const child of [...this.group.children]) if (child !== this.dummy.root && child !== this.character.root) this.group.remove(child);
		this.group.add(this.character.root);
		this.placeActors();
		this.env.show(this.group, { tick: delta => this.tick(delta) });
		this.aimCamera();
	}

	isCaster() {
		return this.events.some(e => e.type === 'cast' && e.castTime > 0);
	}

	placeActors() {
		if (!this.character) return;
		const choice = this.panel.querySelector('#replay-distance').value;
		const ranged = choice === 'ranged' || (choice === 'auto' && (this.isCaster() || this.events.some(e => e.action?.otherId === 4)));
		this.distance = ranged ? 9 : 2.1;
		this.character.root.position.set(0, 0, 0);
		this.character.root.rotation.set(0, 0, 0);
		this.dummy.root.position.set(0, 0, this.distance);
		this.dummy.root.rotation.set(0, Math.PI, 0);
		this.aimCamera();
	}

	aimCamera() {
		const { camera, controls } = this.env;
		this.group.position.set(0, 0, 0);
		// From behind and beside the character, so both it and the target are in view.
		const ranged = this.distance > 4;
		controls.target.set(0, 1.0, this.distance * (ranged ? 0.42 : 0.5));
		if (ranged) camera.position.set(-2.8, 3.4, -7.8);
		else camera.position.set(-5.3, 2.4, -3.2);
		camera.near = 0.05;
		camera.far = 500;
		camera.updateProjectionMatrix();
		controls.autoRotate = false;
	}

	async run() {
		const sims = this.env.savedSims();
		const sim = sims.find(s => s.key === (this.simSelect.value || this.chosenKey)) ?? sims[0];
		if (!sim) {
			this.env.status.textContent = 'No sim characters yet: open the sim from this server first.';
			return;
		}
		this.chosenKey = sim.key;
		const button = this.panel.querySelector('#replay-run');
		button.disabled = true;
		this.playing = false;
		try {
			const spec = await specPageFor(sim.key);
			if (!spec) throw new Error(`no sim page for ${sim.label}`);
			const say = text => (this.env.status.textContent = text);
			say('Dressing the character…');
			await this.env.applySim(sim.settings);
			this.character = await this.env.getCharacter();
			say('Opening the sim…');
			const request = await captureSimRequest(spec, say);
			say('Simulating one fight…');
			const fight = await runFight(request);
			this.fight = fight;
			this.events = parseLog(fight.logs, fight.name);
			this.duration = fight.duration || Math.max(...this.events.map(e => e.time), 1);
			await this.prepare();
			await this.setupScene();
			this.restart();
			say(`${sim.label}: ${fmt(fight.dps, 1)} DPS in this fight (seed ${fight.seed})`);
		} catch (error) {
			this.env.status.textContent = `Replay: ${error.message}`;
			console.error(error);
		} finally {
			button.disabled = false;
		}
	}

	/** Works out the weapon style and preloads names and icons. */
	async prepare() {
		const gear = this.character.gear;
		const items = this.character.items ?? {};
		const twoHand = items.MainHand?.inventoryType === 17;
		const model = this.character.model;
		const pick = (...ids) => ids.find(id => model.hasAnimation(id)) ?? ANIM.Stand;
		this.style = {
			ready: this.isCaster() ? pick(ANIM.ReadySpellDirected, ANIM.ReadyUnarmed) : gear.MainHand ? pick(twoHand ? ANIM.Ready2H : ANIM.Ready1H, ANIM.ReadyUnarmed) : pick(ANIM.ReadyUnarmed),
			mainHand: gear.MainHand ? pick(twoHand ? ANIM.Attack2H : ANIM.Attack1H, ANIM.AttackUnarmed) : pick(ANIM.AttackUnarmed),
			offHand: pick(ANIM.AttackOff, ANIM.Attack1H, ANIM.AttackUnarmed),
			special: gear.MainHand ? pick(twoHand ? ANIM.Special2H : ANIM.Special1H, twoHand ? ANIM.Attack2H : ANIM.Attack1H) : pick(ANIM.AttackUnarmed),
			shoot: pick(ANIM.AttackBow, ANIM.AttackThrown),
			castLoop: pick(ANIM.ReadySpellDirected, ANIM.SpellPrecast),
			castRelease: pick(ANIM.SpellCastDirected, ANIM.SpellCast),
			instantSpell: pick(ANIM.SpellCastOmni, ANIM.SpellCast),
		};
		// A hunter shoots with the bow in hand rather than on the back.
		if (this.events.some(e => e.action?.otherId === 4) && this.character.items?.Ranged) this.character.holdRanged(true);
		// Load every animation the replay uses now, so the first swing starts on time.
		await Promise.all(Object.values(this.style).map(id => model.findSequence(id)).filter(i => i >= 0).map(i => model.loadSequence(i)));
		const dummyHits = [9, 10, 8].filter(id => this.dummy?.hasAnimation(id));
		this.dummyWound = dummyHits[0] ?? null;
		const seen = new Map();
		for (const e of this.events) if (e.action && !seen.has(e.action.key)) seen.set(e.action.key, e.action);
		await Promise.all([...seen.values()].map(async action => {
			const info = await actionInfo(action);
			info.iconUrl = await iconUrl(info.icon);
		}));
	}

	restart() {
		this.time = 0;
		this.cursor = 0;
		this.totals = new Map();
		this.total = 0;
		this.resource = null;
		this.auras = new Map();
		this.castingUntil = 0;
		this.playing = true;
		for (const f of this.floaters) f.el.remove();
		this.floaters = [];
		for (const p of this.projectiles ?? []) this.group.remove(p.orb);
		this.projectiles = [];
		for (const e of this.events) e.launched = false;
		this.character.model.play(this.style.ready);
		this.renderHud();
	}

	seek(time) {
		this.restart();
		this.silent = true;
		this.advanceTo(time);
		this.silent = false;
		this.character.model.play(this.style.ready);
	}

	tick(delta) {
		// Shift the picture left so the actors are not under the meter.
		const canvas = document.querySelector('main canvas');
		if (canvas && (canvas.clientWidth !== this.viewW || canvas.clientHeight !== this.viewH)) {
			this.viewW = canvas.clientWidth;
			this.viewH = canvas.clientHeight;
			this.env.camera.setViewOffset(this.viewW, this.viewH, Math.min(170, this.viewW * 0.14), 0, this.viewW, this.viewH);
		}
		this.character?.update(delta);
		this.dummy?.update(delta);
		if (this.playing && this.events.length) {
			const next = Math.min(this.time + (delta / 1000) * this.speed, this.duration);
			this.advanceTo(next);
			if (this.time >= this.duration) this.playing = false;
		}
		this.updateProjectiles();
		this.updateFloaters(delta);
		this.updateHud();
	}

	advanceTo(time) {
		if (!this.silent) this.launchProjectiles(time);
		while (this.cursor < this.events.length && this.events[this.cursor].time <= time) this.apply(this.events[this.cursor++]);
		this.time = time;
	}

	apply(event) {
		const model = this.character.model;
		const animate = (id, loop = false) => {
			if (!this.silent) this.animate(id, loop);
		};
		switch (event.type) {
			case 'damage': {
				const total = (this.totals.get(event.action.key) ?? { action: event.action, amount: 0, hits: 0 });
				total.amount += event.amount;
				total.hits += 1;
				this.totals.set(event.action.key, total);
				this.total += event.amount;
				if (!this.silent) {
					this.floatNumber(event);
					if (event.amount > 0 && this.dummyWound !== null && !event.tick) this.dummy.play(this.dummyWound, { loop: false, onEnd: () => this.dummy.play(0) });
				}
				// White swings animate on their damage line (they have no cast with a target).
				if (event.action.otherId === 3 && !event.pet) animate(event.action.tag === 2 ? this.style.offHand : this.style.mainHand);
				if (event.action.otherId === 4 && !event.pet) animate(this.style.shoot);
				break;
			}
			case 'cast': {
				if (event.action.otherId) break;
				if (event.castTime > 0) {
					this.castingUntil = event.time + event.castTime;
					animate(this.style.castLoop, true);
					this.pendingRelease = this.castingUntil;
				} else if (event.action.spellId) {
					// An instant: a melee special for melee, a quick cast for casters.
					animate(this.isCaster() ? this.style.instantSpell : this.style.special);
				}
				break;
			}
			case 'resource':
				this.resource = event;
				break;
			case 'auraOn':
				if (event.time > 0 && event.action.spellId) this.auras.set(event.action.key, event.action);
				break;
			case 'auraOff':
				this.auras.delete(event.action.key);
				break;
		}
		if (this.pendingRelease && this.time >= this.pendingRelease) {
			this.pendingRelease = 0;
			animate(this.style.castRelease);
		}
	}

	/** Plays an action's animation; when it ends, back to the idle one. */
	animate(id, loop = false) {
		const model = this.character.model;
		model.play(id, { loop, onEnd: loop ? null : () => model.play(this.idleAnimation()) });
	}

	idleAnimation() {
		return this.time < this.castingUntil ? this.style.castLoop : this.style.ready;
	}

	// --- Projectiles ---

	/** Spells hitting from range fly in first: launched so they land on the sim's damage time. */
	launchProjectiles(time) {
		if (this.distance <= 4) return;
		const flight = 0.35;
		for (let i = this.cursor; i < this.events.length && this.events[i].time <= time + flight; i++) {
			const e = this.events[i];
			if (e.type !== 'damage' || e.tick || e.pet || e.launched || e.action.otherId === 3) continue;
			e.launched = true;
			const color = SCHOOL_COLOR[e.school] ?? 0xffffff;
			const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
			const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
			orb.add(glow);
			this.group.add(orb);
			this.projectiles.push({ orb, start: e.time - flight, end: e.time });
		}
	}

	updateProjectiles() {
		const from = new THREE.Vector3(0.35, 1.5, 0.4);
		const to = new THREE.Vector3(0, 1.6, this.distance - 0.25);
		for (const p of [...this.projectiles]) {
			const f = (this.time - p.start) / (p.end - p.start);
			if (f >= 1 || f < -0.5) {
				this.group.remove(p.orb);
				this.projectiles.splice(this.projectiles.indexOf(p), 1);
				continue;
			}
			p.orb.visible = f >= 0;
			p.orb.position.lerpVectors(from, to, Math.max(f, 0));
			p.orb.position.y += Math.sin(Math.max(f, 0) * Math.PI) * 0.4;
		}
	}

	// --- Floating numbers ---

	floatNumber(event) {
		if (event.pet && event.amount === 0) return;
		// A spell that lands a damage-over-time effect "hits" for 0; only its ticks have numbers.
		if (event.amount === 0 && ['Hit', 'Crit', 'Glance', 'Block'].includes(event.outcome)) return;
		const el = document.createElement('div');
		el.className = 'floater';
		const crit = event.outcome === 'Crit' || event.outcome === 'CritBlock';
		if (event.amount > 0) el.textContent = fmt(event.amount);
		else el.textContent = event.outcome;
		el.dataset.kind = event.amount === 0 ? 'miss' : crit ? 'crit' : event.tick ? 'tick' : 'hit';
		this.overlay.append(el);
		this.floaters.push({ el, age: 0, x: (Math.random() - 0.5) * 0.9, crit });
		if (this.floaters.length > 30) this.floaters.shift().el.remove();
	}

	updateFloaters(delta) {
		const { camera } = this.env;
		const canvas = document.querySelector('main canvas');
		if (!this.dummy || !canvas) return;
		const head = new THREE.Vector3();
		this.dummy.root.getWorldPosition(head);
		head.y += 2.0;
		for (const f of [...this.floaters]) {
			f.age += delta / 1000;
			const life = f.crit ? 1.6 : 1.2;
			if (f.age > life) {
				f.el.remove();
				this.floaters.splice(this.floaters.indexOf(f), 1);
				continue;
			}
			const p = head.clone().add(new THREE.Vector3(f.x, f.age * 0.9, 0)).project(camera);
			const x = ((p.x + 1) / 2) * canvas.clientWidth;
			const y = ((1 - p.y) / 2) * canvas.clientHeight;
			const pop = f.crit ? 1 + Math.max(0, 0.6 - f.age * 3) : 1;
			f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${pop})`;
			f.el.style.opacity = String(Math.min(1, (life - f.age) * 2.5));
		}
	}

	// --- HUD ---

	renderHud() {
		this.overlay.innerHTML = this.events.length
			? `<div class="hud-meter"><div class="hud-dps"><b id="hud-dps">0</b> DPS</div><div id="hud-time" class="hud-sub"></div><div id="hud-resource" class="hud-resource"><i></i><span></span></div><ol id="hud-abilities"></ol><div id="hud-auras" class="hud-auras"></div></div>
				<div class="hud-bar"><button id="hud-play">❚❚</button><input id="hud-seek" type="range" min="0" max="1000" value="0" /><span id="hud-clock"></span><button id="hud-again" title="Same fight from the start">↺</button><button id="hud-new" title="Another fight with a new random seed">New fight</button></div>`
			: '';
		if (!this.events.length) return;
		this.overlay.querySelector('#hud-play').addEventListener('click', () => {
			if (this.time >= this.duration) this.restart();
			else this.playing = !this.playing;
		});
		this.overlay.querySelector('#hud-again').addEventListener('click', () => this.restart());
		this.overlay.querySelector('#hud-new').addEventListener('click', () => this.run());
		const seek = this.overlay.querySelector('#hud-seek');
		seek.addEventListener('input', () => {
			const wasPlaying = this.playing;
			this.seek((Number(seek.value) / 1000) * this.duration);
			this.playing = wasPlaying;
		});
		this.hudShownAt = -1;
	}

	updateHud() {
		if (!this.events.length || !this.overlay.querySelector('#hud-dps')) return;
		const now = performance.now();
		if (now - (this.hudShownAt ?? 0) < 100) return;
		this.hudShownAt = now;
		const elapsed = Math.max(this.time, 0.001);
		this.overlay.querySelector('#hud-dps').textContent = fmt(this.time > 1 ? this.total / elapsed : 0, 0);
		this.overlay.querySelector('#hud-time').textContent = `${fmt(this.total)} damage`;
		this.overlay.querySelector('#hud-clock').textContent = `${fmtTime(this.time)} / ${fmtTime(this.duration)}`;
		this.overlay.querySelector('#hud-play').textContent = this.playing ? '❚❚' : '▶';
		const seek = this.overlay.querySelector('#hud-seek');
		if (document.activeElement !== seek) seek.value = String(Math.round((this.time / this.duration) * 1000));

		const res = this.overlay.querySelector('#hud-resource');
		res.hidden = !this.resource;
		if (this.resource) {
			res.dataset.kind = this.resource.kind;
			res.querySelector('i').style.width = `${Math.min(100, (this.resource.value / (this.resource.max || 100)) * 100)}%`;
			res.querySelector('span').textContent = `${fmt(this.resource.value)} ${this.resource.kind}`;
		}

		const rows = [...this.totals.values()].filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
		const list = this.overlay.querySelector('#hud-abilities');
		const top = rows[0]?.amount || 1;
		list.innerHTML = '';
		for (const r of rows) {
			const info = names.get(r.action.key);
			const li = document.createElement('li');
			li.innerHTML = `<span class="icon"></span><span class="label"></span><span class="value"></span><i style="width:${(r.amount / top) * 100}%"></i>`;
			info?.then(i => {
				li.querySelector('.label').textContent = i.name.replace(/\s*\(Rank \d+\)$/, '');
				const icon = li.querySelector('.icon');
				if (i.iconUrl === 'melee') icon.textContent = '⚔';
				else if (i.iconUrl) icon.style.backgroundImage = `url(${i.iconUrl})`;
			});
			li.querySelector('.value').textContent = `${fmt(r.amount / elapsed)} · ${Math.round((r.amount / (this.total || 1)) * 100)}%`;
			list.append(li);
		}

		const auras = this.overlay.querySelector('#hud-auras');
		auras.innerHTML = '';
		for (const action of [...this.auras.values()].slice(0, 12)) {
			const span = document.createElement('span');
			names.get(action.key)?.then(i => {
				span.title = i.name;
				if (i.iconUrl && i.iconUrl !== 'melee') span.style.backgroundImage = `url(${i.iconUrl})`;
			}) ?? actionInfo(action);
			auras.append(span);
		}
	}
}
