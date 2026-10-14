// Practice: you play the character. The sim's engine runs the fight live on the testground
// server; this page keeps it at "now", sends the abilities you press and draws what happens.

import * as THREE from 'three';

import { ANIM, loadTexture } from './model.js';
import { angleDiff, Mover } from './movement.js';
import { actionInfo, captureSimRequest, iconUrl, names, parseAction, parseLog, Replay, specPageFor } from './replay.js';
import { Sounds } from './sound.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const BAR_SIZE = 24; // Two rows: 1–= and Shift+1–=.
const keyLabel = i => (i < 12 ? KEYS[i] : `⇧${KEYS[i - 12]}`);

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const shortTime = s => (s >= 60 ? `${Math.ceil(s / 60)}m` : s >= 10 ? String(Math.round(s)) : s.toFixed(1));
const cleanName = name => name.replace(/\s*\(Rank \d+\)$/, '');
// The dummy's reach: ranges are measured from its edge, as the game measures from combat reach.
const DUMMY_REACH = 1.0;
const GROUND_TEXTURE = 186899; // tileset/barrens/barrensbasedirt.blp
const SCHOOL_COLOR = { 2: 0xffe680, 4: 0xff7a1a, 8: 0x6dff4a, 16: 0x6cc8ff, 32: 0xa050ff, 64: 0xff7cf0 };

/** "{SpellID: 23894, Tag: 1}" → the action shape the log parser makes, so names and icons are shared. */
const actionOf = key => parseAction(key.replace(/^pet:/, '').replace(/^\{|\}$/g, ''));

/** Resolves a name and icon (data URL) for an action, cached. */
async function infoOf(action) {
	const info = await (names.get(action.key) ?? actionInfo(action));
	info.iconUrl ??= await iconUrl(info.icon);
	return info;
}

/** Sets an element's text or style only when it changed, so the HUD does not churn the page. */
function setText(el, text) {
	if (el.textContent !== text) el.textContent = text;
}
function setStyle(el, prop, value) {
	if (el.style[prop] !== value) el.style[prop] = value;
}

// --- Why an ability cannot be used, in the game's words ---

// Warrior stances each ability needs (from the engine's own cast conditions).
const STANCES = {
	Overpower: ['Battle'],
	'Mocking Blow': ['Battle'],
	Retaliation: ['Battle'],
	'Sweeping Strikes': ['Battle'],
	Charge: ['Battle'],
	Whirlwind: ['Berserker'],
	'Berserker Rage': ['Berserker'],
	Pummel: ['Berserker'],
	Recklessness: ['Berserker'],
	Intercept: ['Berserker'],
	Disarm: ['Defensive'],
	Taunt: ['Defensive'],
	Revenge: ['Defensive'],
	'Shield Block': ['Defensive'],
	'Shield Wall': ['Defensive'],
	Execute: ['Battle', 'Berserker'],
	Hamstring: ['Battle', 'Berserker'],
	Rend: ['Battle', 'Defensive'],
	'Thunder Clap': ['Battle', 'Defensive'],
	'Shield Bash': ['Battle', 'Defensive'],
};
const FINISHERS = new Set(['Eviscerate', 'Rupture', 'Slice and Dice', 'Kidney Shot', 'Expose Armor', 'Ferocious Bite', 'Rip']);
const STEALTH = new Set(['Ambush', 'Garrote', 'Cheap Shot', 'Ravage', 'Pounce']);

// Abilities that only light up after something happens: they glow when usable.
const REACTIVE = new Set(['Overpower', 'Revenge', 'Execute', 'Mongoose Bite', 'Riposte', 'Counterattack', 'Victory Rush', 'Hammer of Wrath']);
// Procs that make another ability better: that ability glows while the buff is up.
const PROC_BUTTONS = { 'Shadow Trance': 'Shadow Bolt' };
// The engine's windows that open a reactive ability (a dodge for Overpower, a block, dodge or parry
// for Revenge): the button glows and a call-out shows as soon as the window opens, whatever the stance.
const WINDOWS = { 'Overpower Aura': 'Overpower', Revenge: 'Revenge', 'Defensive State': 'Mongoose Bite' };

export function whyNot(name, state, character) {
	const auraNames = state.auras.map(a => a.label);
	const stance = ['Battle', 'Defensive', 'Berserker'].find(s => auraNames.some(l => l.startsWith(`${s} Stance`)));
	const needs = STANCES[name];
	if (needs && stance && !needs.includes(stance)) return `Must be in ${needs.map(s => `${s} Stance`).join(' or ')}`;
	if (name === 'Charge') return 'You are in combat';
	if (name === 'Execute' && !state.execute) return 'Target must be below 20% health';
	if (name === 'Overpower' || name === 'Mongoose Bite') return 'Only usable after the target dodges';
	if (name === 'Revenge') return 'Only usable after you block, dodge or parry';
	if (name.startsWith('Shield') && character?.items?.OffHand?.inventoryType !== 14) return 'Requires a shield';
	if (FINISHERS.has(name) && !(state.resources.combo?.[0] > 0)) return 'That ability requires combo points';
	if (STEALTH.has(name)) return 'You must be stealthed';
	if (name === 'Backstab') return 'Requires a dagger in your main hand, behind the target';
	if (name === 'Raptor Strike') return 'Out of range';
	if (name === 'Conflagrate') return 'Requires Immolate on the target';
	if (name === 'Stormstrike') return 'Requires a weapon';
	return "Can't do that now";
}

export class Practice extends Replay {
	constructor(env) {
		super({ ...env, panelId: 'practice-panel' });
		this.live = false;
		this.inFlight = false;
		this.pendingCasts = [];
		this.delayed = [];
		this.state = null;
		this.abilities = [];
		this.bar = [];
		this.sounds = new Sounds();
		const volume = this.panel.querySelector('#practice-volume');
		volume.value = String(this.sounds.volume);
		volume.addEventListener('input', () => this.sounds.setVolume(Number(volume.value)));
		this.clock = { base: 0, since: 0, paused: true };
		this.mover = new Mover({ dom: document.querySelector('main canvas'), camera: env.camera });
		this.onKey = event => this.keydown(event);
		this.onVisibility = () => document.hidden && this.pause();
	}

	buildPanel() {
		this.panel = document.getElementById('practice-panel');
		this.panel.innerHTML = `
			<p class="hint" style="margin:0">Play the character yourself; the sim's engine runs the fight live. <b>1</b>–<b>=</b> and <b>Shift</b>+<b>1</b>–<b>=</b> abilities, <b>T</b> auto attack, <b>Esc</b> pause. Move like in the game: <b>W</b>/<b>S</b>, <b>A</b>/<b>D</b> turn, <b>Q</b>/<b>E</b> strafe, <b>Space</b> jump, drag with the mouse (right button turns you), wheel zooms. Face the target to attack.</p>
			<select id="practice-sim"></select>
			<div class="row">
				<label style="flex:1">Fight <select id="practice-length"><option value="0">Until I stop</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="180" selected>3 minutes</option><option value="300">5 minutes</option></select></label>
				<label style="flex:1">Target health <select id="practice-health"><option value="real">Like a boss</option><option value="above">Above 20%</option><option value="below">Below 20%</option></select></label>
			</div>
			<button id="practice-start">Start practice</button>
			<label>Sound <input id="practice-volume" type="range" min="0" max="1" step="0.05" /></label>
			<h2>Abilities</h2>
			<ul id="practice-book" class="book"></ul>`;
		this.panel.style.cssText = 'display:flex;flex-direction:column;gap:10px;min-height:0';
		this.simSelect = this.panel.querySelector('#practice-sim');
		this.simSelect.addEventListener('focus', () => this.renderSims());
		this.simSelect.addEventListener('change', () => !this.live && this.pickSim(this.simSelect.value));
		this.panel.querySelector('#practice-start').addEventListener('click', () => this.start());
		this.distance = 2.1;
	}

	async open() {
		this.renderSims();
		this.active = true;
		window.addEventListener('keydown', this.onKey);
		document.addEventListener('visibilitychange', this.onVisibility);
		this.character = await this.env.getCharacter();
		if (!this.active) return;
		await this.setupScene();
		this.env.title.textContent = 'Practice';
		if (!this.live) this.env.status.textContent = 'Pick a sim character and press “Start practice”.';
		this.renderHud();
	}

	close() {
		window.removeEventListener('keydown', this.onKey);
		document.removeEventListener('visibilitychange', this.onVisibility);
		this.pause();
		this.live = false;
		this.sounds.stopAll();
		this.leaveArena();
		super.close();
	}

	// --- The arena: ground, follow camera, movement ---

	async enterArena() {
		if (!this.ground) {
			const texture = (await loadTexture(GROUND_TEXTURE).catch(() => null))?.clone();
			if (texture) {
				texture.repeat.set(60, 60);
				texture.needsUpdate = true;
			}
			this.ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: texture, color: texture ? 0xffffff : 0x3a3328 }));
			this.ground.rotation.x = -Math.PI / 2;
			this.ground.position.y = -0.01;
		}
		this.env.scene.add(this.ground);
		if (this.env.grid) this.env.grid.visible = false;
		this.env.controls.enabled = false;
		this.mover.attach();
	}

	leaveArena() {
		this.mover.detach();
		this.env.controls.enabled = true;
		if (this.ground) this.env.scene.remove(this.ground);
		if (this.env.grid) this.env.grid.visible = true;
		this.locomotion = null;
	}

	/** The dummy stands at the middle facing −Z; the character starts in front of it, facing it. */
	placeInArena(distance) {
		this.dummy.root.position.set(0, 0, 0);
		this.dummy.root.rotation.set(0, Math.PI, 0);
		const start = new THREE.Vector3(0, 0, -(Math.max(distance, 0.5) + DUMMY_REACH));
		this.mover.place(start, 0);
		this.mover.obstacles = [{ position: this.dummy.root.position.clone(), radius: DUMMY_REACH + 0.2 }];
		this.mover.lookHeight = 1.5;
		this.mover.camDistance = distance > 10 ? 9 : 6.5;
		this.character.root.position.copy(start);
		this.character.root.rotation.set(0, 0, 0);
	}

	/** Where the player stands against the dummy, as the engine needs it. */
	where() {
		const pos = this.mover.position;
		const dummy = this.dummy.root.position;
		const to = new THREE.Vector3(dummy.x - pos.x, 0, dummy.z - pos.z);
		const centre = to.length();
		const forward = new THREE.Vector3(Math.sin(this.mover.heading), 0, Math.cos(this.mover.heading));
		return {
			distance: Math.max(0, centre - DUMMY_REACH),
			// Facing: the target in the front half, as the game's 180° arc.
			facing: centre < 0.3 || forward.dot(to) >= 0,
			// Behind: in the back half of the dummy, which faces −Z.
			behind: pos.z > dummy.z,
			moving: this.mover.state.moving,
		};
	}

	/** The looping animation movement asks for, or null when standing still. */
	locomotionAnimation() {
		const st = this.mover.state;
		if (st.airborne) return ANIM.Jump;
		if (st.running) return st.backward ? ANIM.Walkbackwards : ANIM.Run;
		if (st.turning) return st.turning > 0 ? ANIM.ShuffleLeft : ANIM.ShuffleRight;
		return null;
	}

	idleAnimation() {
		return this.locomotionAnimation() ?? super.idleAnimation();
	}

	animate(id, loop = false) {
		// On the move, the legs win: swings still land, but the run keeps playing.
		if (this.live && this.locomotionAnimation() !== null && !loop) return;
		super.animate(id, loop);
	}

	stepMovement(delta) {
		const st = this.mover.update(delta / 1000);
		const model = this.character.model;
		const root = this.character.root;
		root.position.copy(this.mover.position);
		root.rotation.y = this.mover.heading + (st.running ? st.direction : 0);
		const want = this.locomotionAnimation();
		if (want !== this.locomotion) {
			if (want !== null && model.hasAnimation(want)) model.play(want, { blend: 120 });
			else if (want === null) model.play(super.idleAnimation(), { blend: 150 });
			this.locomotion = want;
		}
		this.mover.updateCamera();
	}

	updateProjectiles() {
		if (!this.live) return super.updateProjectiles();
		const from = this.character.root.position.clone().add(new THREE.Vector3(Math.sin(this.mover.heading) * 0.4, 1.4, Math.cos(this.mover.heading) * 0.4));
		const to = this.dummy.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
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

	placeActors() {
		if (!this.character || !this.dummy) return;
		if (this.live) return;
		this.distance = this.casterHint || this.rangedHint ? 9 : 2.1;
		this.character.root.position.set(0, 0, 0);
		this.character.root.rotation.set(0, 0, 0);
		this.dummy.root.position.set(0, 0, this.distance);
		this.dummy.root.rotation.set(0, Math.PI, 0);
		this.aimCamera();
	}

	isCaster() {
		return !!this.casterHint;
	}

	// --- Starting a fight ---

	async start() {
		this.sounds.unlock();
		const sims = this.env.savedSims();
		const sim = sims.find(s => s.key === (this.simSelect.value || this.chosenKey)) ?? sims[0];
		if (!sim) {
			this.env.status.textContent = 'No sim characters yet: open the sim from this server first.';
			return;
		}
		this.chosenKey = sim.key;
		const button = this.panel.querySelector('#practice-start');
		button.disabled = true;
		this.live = false;
		this.sounds.stopAll();
		this.leaveArena();
		this.overlay.querySelector('.summary')?.remove();
		const say = text => (this.env.status.textContent = text);
		try {
			const spec = await specPageFor(sim.key);
			if (!spec) throw new Error(`no sim page for ${sim.label}`);
			say('Dressing the character…');
			await this.env.applySim(sim.settings);
			this.character = await this.env.getCharacter();
			// The sim page builds the request; ask it again whenever the character changed there.
			const settingsNow = JSON.stringify(sim.settings);
			if (!this.request || this.requestKey !== sim.key || this.requestSettings !== settingsNow) {
				say('Opening the sim…');
				this.request = await captureSimRequest(spec, say);
				this.requestKey = sim.key;
				this.requestSettings = settingsNow;
			}
			say('Starting the fight…');
			const length = this.panel.querySelector('#practice-length').value;
			const health = this.panel.querySelector('#practice-health').value;
			const response = await fetch(`/api/live/start?length=${length}&health=${health}`, { method: 'POST', body: this.request });
			if (!response.ok) throw new Error(await response.text());
			const fight = await response.json();
			this.fightName = fight.name;
			this.fightId = fight.id;
			this.abilities = fight.abilities.map(a => ({ ...a, action: a.toggle ? { spellId: a.spellId, otherId: 0, itemId: 0, tag: 0, key: `s${a.spellId}` } : actionOf(a.key) }));
			await Promise.all(this.abilities.map(async a => (a.info = await infoOf(a.action))));
			// Some spells are several engine spells under one name (each channel tick, each rank): keep one.
			const seenNames = new Set();
			this.abilities = this.abilities.filter(a => !seenNames.has(a.info.name) && seenNames.add(a.info.name));
			for (const a of this.abilities) a.name = cleanName(a.info.name);
			this.casterHint = this.abilities.slice(0, 6).some(a => a.castTime > 0.5);
			this.rangedHint = sim.settings.player.class === 'ClassHunter';
			this.loadBar(sim.key);
			this.loadSounds();

			this.events = [];
			await this.prepare();
			if (this.rangedHint && this.character.items?.Ranged) this.character.holdRanged(true);
			await this.setupScene();
			this.restart();
			this.playing = false;
			this.state = fight.state;
			await this.enterArena();
			this.placeInArena(fight.state.distance);
			this.mover.speed = fight.state.moveSpeed || 7;
			this.locomotion = null;
			this.seenAuras = new Set(fight.state.auras.map(a => a.key));
			this.usableBefore = new Map();
			this.clock = { base: 0, since: performance.now(), paused: false };
			this.time = 0;
			this.live = true;
			this.ending = false;
			this.feed(fight.lines);
			this.renderHud();
			this.renderBook();
			say(`${sim.label}: ready. Press T or an ability to start attacking.`);
		} catch (error) {
			say(`Practice: ${error.message}`);
			console.error(error);
		} finally {
			button.disabled = false;
		}
	}

	loadBar(simKey) {
		this.barKey = `practice-bar:${simKey}`;
		let saved = null;
		try {
			saved = JSON.parse(localStorage.getItem(this.barKey) ?? 'null');
		} catch {}
		const known = new Set(this.abilities.map(a => a.key));
		if (Array.isArray(saved) && saved.some(k => known.has(k))) {
			this.bar = Array.from({ length: BAR_SIZE }, (_, i) => (known.has(saved[i]) ? saved[i] : null));
		} else {
			// What the sim's own rotation uses, most used first; then unused cooldowns and items.
			const ordered = [...this.abilities.filter(a => a.uses > 0), ...this.abilities.filter(a => !a.uses && (a.mcd || a.itemId))];
			this.bar = Array.from({ length: BAR_SIZE }, (_, i) => ordered[i]?.key ?? null);
		}
		// Attack goes on the bar (first free slot of the second row) unless it was placed already.
		if (!this.bar.includes('attack')) {
			const free = this.bar.findIndex((k, i) => i >= 12 && !k);
			this.bar[free >= 0 ? free : BAR_SIZE - 1] = 'attack';
		}
	}

	saveBar() {
		try {
			localStorage.setItem(this.barKey, JSON.stringify(this.bar));
		} catch {}
	}

	loadSounds() {
		const gear = this.character.gear;
		this.weaponSounds = { mh: this.sounds.weapon(gear.MainHand), oh: this.sounds.weapon(gear.OffHand), ranged: this.sounds.weapon(gear.Ranged) };
		for (const a of this.abilities) if (a.spellId && !a.toggle) this.sounds.spell(a.spellId);
	}

	// --- Pausing ---

	now() {
		const c = this.clock;
		return c.paused ? c.base : c.base + (performance.now() - c.since) / 1000;
	}

	pause() {
		if (!this.live || this.clock.paused) return;
		this.clock = { base: this.now(), since: 0, paused: true };
		this.sounds.stopAll();
		if (!this.ending) this.overlay.querySelector('#practice-paused')?.removeAttribute('hidden');
	}

	resume() {
		if (!this.live || !this.clock.paused || this.ending) return;
		this.clock = { base: this.clock.base, since: performance.now(), paused: false };
		this.overlay.querySelector('#practice-paused')?.setAttribute('hidden', '');
	}

	// --- Input ---

	keydown(event) {
		if (!this.live || event.target.closest?.('input, select, textarea')) return;
		const code = event.code;
		if (code === 'Escape') {
			event.preventDefault();
			if (this.clock.paused) this.resume();
			else this.pause();
			return;
		}
		if (this.clock.paused) return;
		if (code === 'KeyT') {
			event.preventDefault();
			this.toggleAttack();
			return;
		}
		const digit = /^Digit(\d)$/.exec(code)?.[1];
		const key = digit ?? (code === 'Minus' ? '-' : code === 'Equal' ? '=' : null);
		if (key === null) return;
		const slot = KEYS.indexOf(key) + (event.shiftKey ? 12 : 0);
		event.preventDefault();
		this.press(slot);
	}

	toggleAttack() {
		this.pendingAttack = 'toggle';
		this.sendTick();
	}

	press(slot) {
		const key = this.bar[slot];
		if (!key || !this.live || this.clock.paused) return;
		this.sounds.unlock();
		this.flashSlot(slot);
		if (key === 'attack') {
			this.toggleAttack();
			return;
		}
		this.pendingCasts.push(key);
		this.sendTick();
	}

	// --- Keeping the engine at "now" ---

	async sendTick() {
		if (this.inFlight || !this.live || this.clock.paused) return;
		this.inFlight = true;
		try {
			const cast = this.pendingCasts.shift() ?? '';
			const attack = this.pendingAttack ?? '';
			this.pendingAttack = null;
			const response = await fetch(`/api/live/tick?id=${this.fightId}`, { method: 'POST', body: JSON.stringify({ time: this.now(), cast, attack, ...this.where() }) });
			if (!response.ok) throw new Error(await response.text());
			const result = await response.json();
			if (!this.live) return;
			const before = this.state;
			this.state = result.state;
			if (result.refused) {
				const ability = this.abilities.find(a => a.key === cast);
				this.error(result.refused === "can't use that now" && ability ? whyNot(ability.name, this.state, this.character) : result.refused);
			}
			if (result.error) this.error(`The engine stopped: ${result.error}`);
			if (result.interrupted) {
				this.error('Interrupted');
				this.sounds.stopLoop('precast');
				this.castingUntil = 0;
			}
			this.feed(result.lines);
			this.watchCasting(before, this.state);
			if (this.state.ended && !this.ending) this.finish();
		} catch (error) {
			this.error(error.message);
		} finally {
			this.inFlight = false;
			if (this.pendingCasts.length || this.pendingAttack) this.sendTick();
		}
	}

	/** New log lines: the replay's animation and numbers, as they happen. */
	feed(lines) {
		if (!lines?.length) return;
		for (const event of parseLog(lines.join('\n'), this.fightName)) {
			if (event.type === 'damage' && this.distance > 4 && !event.tick && !event.pet && event.action.otherId !== 3) {
				// From range, the spell flies first and the number shows when it lands.
				this.spawnProjectile(SCHOOL_COLOR[event.school] ?? 0xffffff, this.time, this.time + 0.3);
				this.delayed.push({ at: this.time + 0.3, event });
				continue;
			}
			this.apply(event);
		}
	}

	apply(event) {
		super.apply(event);
		this.playSound(event);
	}

	async playSound(event) {
		const s = this.sounds;
		if (!s.ctx || this.clock.paused) return;
		const missed = event.amount === 0 && ['Miss', 'Dodge', 'Parry'].includes(event.outcome);
		const crit = event.outcome === 'Crit' || event.outcome === 'CritBlock';
		if (event.type === 'damage' && !event.pet) {
			if (event.action.otherId === 3) {
				const w = await (event.action.tag === 2 ? this.weaponSounds.oh : this.weaponSounds.mh);
				if (missed) s.play(w.miss, { gain: 0.5 });
				else {
					s.play(crit ? w.swingCrit : w.swing, { gain: 0.35 });
					s.play(crit ? w.crit : w.hit, { gain: crit ? 0.9 : 0.7 });
				}
				return;
			}
			if (event.action.otherId === 4) {
				const w = await this.weaponSounds.ranged;
				s.play(w.shot, { gain: 0.6 });
				if (!missed) s.play(w.hit, { gain: 0.5 });
				return;
			}
			if (event.tick || !event.action.spellId) return;
			const spell = await s.spell(event.action.spellId);
			if (spell.impact.length) s.play(spell.impact, { gain: 0.7 });
			else if (event.school === 1 && !missed) {
				const w = await this.weaponSounds.mh;
				s.play(crit ? w.crit : w.hit, { gain: 0.8 });
			}
		} else if (event.type === 'cast' && event.action.spellId && !event.action.otherId) {
			const spell = await s.spell(event.action.spellId);
			if (event.castTime > 0) s.startLoop('precast', spell.precast.length ? spell.precast : spell.cast, 0.55);
			else s.play(spell.cast, { gain: 0.7 });
		}
	}

	/** A cast that finished plays its release sound; any end of casting stops the precast loop. */
	async watchCasting(before, after) {
		if (before?.casting && !after.casting) {
			this.sounds.stopLoop('precast');
			const ability = this.abilities.find(a => a.key === before.casting.key);
			if (ability?.spellId && before.casting.endsIn < 0.25) {
				const spell = await this.sounds.spell(ability.spellId);
				this.sounds.play(spell.cast, { gain: 0.7 });
			}
		}
	}

	spawnProjectile(color, start, end) {
		const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
		orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
		this.group.add(orb);
		this.projectiles.push({ orb, start, end });
	}

	launchProjectiles() {}

	tick(delta) {
		if (!this.live) {
			super.tick(delta);
			return;
		}
		const canvas = document.querySelector('main canvas');
		if (canvas && (canvas.clientWidth !== this.viewW || canvas.clientHeight !== this.viewH)) {
			this.viewW = canvas.clientWidth;
			this.viewH = canvas.clientHeight;
			this.env.camera.setViewOffset(this.viewW, this.viewH, Math.min(170, this.viewW * 0.14), 0, this.viewW, this.viewH);
		}
		// Paused: everything holds still.
		if (this.clock.paused) {
			this.mover.keys.clear();
			this.mover.updateCamera();
			return;
		}
		this.time = this.now();
		for (const d of [...this.delayed]) {
			if (d.at > this.time) continue;
			this.delayed.splice(this.delayed.indexOf(d), 1);
			this.apply(d.event);
		}
		const now = performance.now();
		if (now - (this.lastTick ?? 0) > 50) {
			this.lastTick = now;
			this.sendTick();
		}
		this.stepMovement(delta);
		this.character?.update(delta);
		this.dummy?.update(delta);
		this.updateProjectiles();
		this.updateFloaters(delta);
		this.updateHud();
	}

	// --- The end: you against the sim ---

	async finish() {
		this.ending = true;
		this.pause();
		this.sounds.stopAll();
		this.updateHud(true);
		const box = document.createElement('div');
		box.className = 'summary';
		box.innerHTML = '<p class="hint">Comparing with the sim’s rotation…</p>';
		this.overlay.append(box);
		try {
			const summary = await fetch(`/api/live/summary?id=${this.fightId}`).then(r => (r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t)))));
			await this.renderSummary(box, summary);
		} catch (error) {
			box.innerHTML = `<p>Could not compare: ${error.message}</p>`;
		}
	}

	async renderSummary(box, { you, reference }) {
		if (reference.error) throw new Error(reference.error);
		// The sim's numbers for a fight as long as yours.
		const scale = you.duration / (reference.duration || you.duration);
		const keys = new Set([...Object.keys(you.actions), ...Object.keys(reference.actions)]);
		const rows = [];
		for (const key of keys) {
			const mine = you.actions[key] ?? { casts: 0, damage: 0 };
			const theirs = reference.actions[key] ?? { casts: 0, damage: 0 };
			if (mine.damage <= 0 && theirs.damage <= 0 && mine.casts < 1 && theirs.casts * scale < 0.5) continue;
			const info = await infoOf(actionOf(key));
			const pet = key.startsWith('pet:');
			// The engine keeps a spell's hits with each hand apart; they are one ability here.
			const merged = rows.find(r => r.pet === pet && cleanName(r.info.name) === cleanName(info.name));
			if (merged) {
				merged.you.casts += mine.casts;
				merged.you.damage += mine.damage;
				merged.sim.casts += theirs.casts * scale;
				merged.sim.damage += theirs.damage * scale;
				if (this.abilities.some(a => a.key === key)) merged.key = key;
				continue;
			}
			rows.push({ key, info, pet, you: { casts: mine.casts, damage: mine.damage }, sim: { casts: theirs.casts * scale, damage: theirs.damage * scale } });
		}
		rows.sort((a, b) => b.sim.damage - a.sim.damage || b.you.damage - a.you.damage);
		const youTotal = rows.reduce((s, r) => s + r.you.damage, 0) || 1;
		const simTotal = rows.reduce((s, r) => s + r.sim.damage, 0) || 1;
		const ratio = you.dps / (reference.dps || 1);
		const verdict = ratio >= 1.02 ? 'You beat the sim!' : ratio >= 0.95 ? 'Very close to the sim.' : ratio >= 0.85 ? 'Not far off.' : 'Room to improve.';

		// The biggest gaps in how often things were used (only abilities you press).
		const pressable = new Set(this.abilities.map(a => a.key));
		const gap = r => pressable.has(r.key) && Math.abs(r.you.casts - r.sim.casts) >= Math.max(2, r.sim.casts * 0.2);
		const tips = rows
			.filter(gap)
			.sort((a, b) => Math.abs(b.you.casts - b.sim.casts) - Math.abs(a.you.casts - a.sim.casts))
			.slice(0, 3)
			.map(r => `${r.you.casts < r.sim.casts ? 'Use more' : 'Use less'} <b>${cleanName(r.info.name)}</b>: you ${fmt(r.you.casts)} times, the sim ${fmt(r.sim.casts)}`);

		box.innerHTML = `
			<h3>${verdict}</h3>
			<div class="summary-dps"><div><small>You</small><b>${fmt(you.dps)}</b><small>DPS</small></div><div class="vs" data-better="${ratio >= 1}">${ratio >= 1 ? '+' : '−'}${fmt(Math.abs(ratio - 1) * 100, 1)}%</div><div><small>The sim's rotation</small><b>${fmt(reference.dps)}</b><small>DPS</small></div></div>
			${tips.length ? `<ul class="summary-tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
			<div class="summary-table"><table><thead><tr><th>Ability</th><th>Your casts</th><th>Sim casts</th><th>Your damage</th><th>Sim damage</th></tr></thead><tbody></tbody></table></div>
			<p class="hint">The sim's numbers are the average of 1,000 fights with your gear, talents and buffs${Math.abs(scale - 1) > 0.01 ? `, scaled to your ${fmtTime(you.duration)}` : ''}.</p>
			<div class="row"><button id="summary-again">Fight again</button><button id="summary-close">Close</button></div>`;
		const body = box.querySelector('tbody');
		for (const r of rows.slice(0, 14)) {
			const tr = document.createElement('tr');
			tr.innerHTML = `<td><span class="icon"></span><span></span></td><td>${fmt(r.you.casts)}</td><td>${fmt(r.sim.casts, r.sim.casts < 10 ? 1 : 0)}</td><td>${Math.round((r.you.damage / youTotal) * 100)}%</td><td>${Math.round((r.sim.damage / simTotal) * 100)}%</td>`;
			tr.querySelector('td span:last-child').textContent = cleanName(r.info.name) + (r.pet ? ' (pet)' : '');
			const icon = tr.querySelector('.icon');
			if (r.info.iconUrl === 'melee') icon.textContent = '⚔';
			else if (r.info.iconUrl) icon.style.backgroundImage = `url(${r.info.iconUrl})`;
			if (gap(r)) tr.dataset.gap = r.you.casts < r.sim.casts ? 'less' : 'more';
			body.append(tr);
		}
		box.querySelector('#summary-again').addEventListener('click', () => this.start());
		box.querySelector('#summary-close').addEventListener('click', () => box.remove());
	}

	// --- HUD ---

	error(text) {
		const el = this.overlay.querySelector('#practice-error');
		if (!el) return;
		el.textContent = text[0].toUpperCase() + text.slice(1);
		el.style.opacity = '1';
		clearTimeout(this.errorTimer);
		this.errorTimer = setTimeout(() => (el.style.opacity = '0'), 1400);
	}

	alert(text, iconUrlValue) {
		const el = this.overlay.querySelector('#practice-alert');
		if (!el) return;
		el.innerHTML = `<span class="icon"></span><span></span>`;
		if (iconUrlValue && iconUrlValue !== 'melee') el.firstChild.style.backgroundImage = `url(${iconUrlValue})`;
		el.lastChild.textContent = text;
		el.classList.remove('show');
		void el.offsetWidth;
		el.classList.add('show');
	}

	flashSlot(slot) {
		const el = this.overlay.querySelector(`[data-slot="${slot}"]`);
		if (!el) return;
		el.dataset.pressed = '';
		setTimeout(() => delete el.dataset.pressed, 120);
	}

	renderHud() {
		this.hud = null;
		if (!this.live && !this.abilities.length) {
			this.overlay.innerHTML = '';
			return;
		}
		const summary = this.overlay.querySelector('.summary');
		this.overlay.innerHTML = `
			<div class="unit-frame player-frame"><div class="uf-name" id="pf-name"></div><div class="uf-bar health"><i id="pf-health"></i><span id="pf-health-text"></span></div><div class="uf-bar power" id="pf-power"><i></i><span></span></div><div class="combo" id="pf-combo" hidden></div><div class="aura-row" id="pf-auras"></div></div>
			<div class="unit-frame target-frame"><div class="uf-name">Training Dummy <small id="tf-phase"></small><em id="tf-range"></em></div><div class="uf-bar health"><i id="tf-health"></i><span id="tf-health-text"></span></div><div class="aura-row" id="tf-auras"></div></div>
			<div class="hud-meter"><div class="hud-dps"><b id="hud-dps">0</b> DPS</div><div id="hud-time" class="hud-sub"></div><ol id="hud-abilities"></ol></div>
			<div id="practice-error" class="practice-error"></div>
			<div id="practice-alert" class="practice-alert"></div>
			<div id="practice-paused" class="practice-paused" hidden><b>Paused</b><span>Press Esc or click to continue</span></div>
			<div class="practice-bottom">
				<div class="swing" id="swing"></div>
				<div id="practice-cast" class="practice-cast" hidden><i></i><span></span></div>
				<div class="practice-bar" id="practice-bar"></div>
				<div class="practice-controls"><span id="hud-clock"></span><button id="practice-finish">End fight &amp; compare</button><button id="practice-reset">Reset fight</button></div>
			</div>`;
		if (summary) this.overlay.append(summary);
		this.overlay.querySelector('#practice-reset').addEventListener('click', () => this.start());
		this.overlay.querySelector('#practice-finish').addEventListener('click', () => this.live && !this.ending && this.finish());
		this.overlay.querySelector('#practice-paused').addEventListener('click', () => this.resume());
		this.overlay.querySelector('#pf-name').textContent = this.env.savedSims().find(s => s.key === this.chosenKey)?.label ?? 'You';

		const bar = this.overlay.querySelector('#practice-bar');
		for (let i = 0; i < BAR_SIZE; i++) {
			const slot = document.createElement('button');
			slot.className = 'slot';
			slot.dataset.slot = String(i);
			slot.innerHTML = `<span class="sweep"></span><span class="cd"></span><kbd>${keyLabel(i)}</kbd>`;
			slot.addEventListener('click', () => this.press(i));
			slot.addEventListener('contextmenu', event => {
				event.preventDefault();
				this.bar[i] = null;
				this.saveBar();
				this.renderHud();
			});
			slot.addEventListener('dragover', event => event.preventDefault());
			slot.addEventListener('drop', event => {
				event.preventDefault();
				const key = event.dataTransfer.getData('text/ability');
				const from = event.dataTransfer.getData('text/slot');
				if (from !== '') this.bar[Number(from)] = this.bar[i];
				this.bar[i] = key || null;
				this.saveBar();
				this.renderHud();
			});
			const ability = this.abilities.find(a => a.key === this.bar[i]);
			if (ability) {
				slot.style.backgroundImage = ability.info.iconUrl && ability.info.iconUrl !== 'melee' ? `url(${ability.info.iconUrl})` : '';
				slot.title = `${ability.name}${ability.cooldown ? ` · ${fmt(ability.cooldown, ability.cooldown < 10 ? 1 : 0)}s cooldown` : ''}${ability.castTime ? ` · ${fmt(ability.castTime, 1)}s cast` : ''}\nRight-click to clear, drag to move.`;
				slot.draggable = true;
				slot.addEventListener('dragstart', event => {
					event.dataTransfer.setData('text/ability', ability.key);
					event.dataTransfer.setData('text/slot', String(i));
				});
			} else {
				slot.dataset.empty = '';
			}
			bar.append(slot);
		}

		const q = id => this.overlay.querySelector(id);
		this.hud = {
			dps: q('#hud-dps'),
			time: q('#hud-time'),
			clock: q('#hud-clock'),
			meter: q('#hud-abilities'),
			meterRows: new Map(),
			slots: [...this.overlay.querySelectorAll('#practice-bar .slot')].map(el => ({ el, sweep: el.querySelector('.sweep'), cd: el.querySelector('.cd'), ability: this.abilities.find(a => a.key === this.bar[Number(el.dataset.slot)]) })),
			cast: q('#practice-cast'),
			castFill: q('#practice-cast i'),
			castText: q('#practice-cast span'),
			swing: q('#swing'),
			swingBars: new Map(),
			pfHealth: q('#pf-health'),
			pfHealthText: q('#pf-health-text'),
			pfPower: q('#pf-power'),
			pfCombo: q('#pf-combo'),
			pfAuras: { el: q('#pf-auras'), items: new Map() },
			tfHealth: q('#tf-health'),
			tfHealthText: q('#tf-health-text'),
			tfPhase: q('#tf-phase'),
			tfRange: q('#tf-range'),
			tfAuras: { el: q('#tf-auras'), items: new Map() },
		};
		this.hudShownAt = 0;
	}

	renderBook() {
		const book = this.panel.querySelector('#practice-book');
		book.innerHTML = '';
		for (const ability of this.abilities) {
			const li = document.createElement('li');
			li.draggable = true;
			li.innerHTML = `<span class="icon"></span><span></span>`;
			const icon = li.querySelector('.icon');
			if (ability.info.iconUrl && ability.info.iconUrl !== 'melee') icon.style.backgroundImage = `url(${ability.info.iconUrl})`;
			li.lastChild.textContent = ability.name;
			li.title = 'Drag onto the action bar, or click to use';
			li.addEventListener('dragstart', event => event.dataTransfer.setData('text/ability', ability.key));
			li.addEventListener('click', () => {
				if (ability.key === 'attack') this.toggleAttack();
				else {
					this.pendingCasts.push(ability.key);
					this.sendTick();
				}
			});
			book.append(li);
		}
	}

	/** Keeps a keyed list of aura icons in step with the state, touching only what changed. */
	syncAuras(list, auras, { flashNew = false } = {}) {
		const live = new Set();
		for (const aura of auras) {
			live.add(aura.key);
			let item = list.items.get(aura.key);
			if (!item) {
				const el = document.createElement('span');
				el.innerHTML = '<b></b><small></small>';
				item = { el, stacks: el.firstChild, time: el.lastChild };
				infoOf(actionOf(aura.key)).then(i => {
					if (i.iconUrl && i.iconUrl !== 'melee') el.style.backgroundImage = `url(${i.iconUrl})`;
					el.title = cleanName(i.name || aura.label);
				});
				list.items.set(aura.key, item);
				list.el.append(el);
				if (flashNew && !this.seenAuras.has(aura.key)) {
					el.classList.add('new');
					setTimeout(() => el.classList.remove('new'), 1200);
				}
				this.seenAuras?.add(aura.key);
			}
			setText(item.stacks, aura.stacks > 1 ? String(aura.stacks) : '');
			setText(item.time, aura.permanent ? '' : shortTime(aura.remaining));
		}
		for (const [key, item] of list.items) {
			if (live.has(key)) continue;
			item.el.remove();
			list.items.delete(key);
		}
	}

	updateHud(force = false) {
		const h = this.hud;
		if (!this.live || !this.state || !h) return;
		const now = performance.now();
		if (!force && now - (this.hudShownAt ?? 0) < 50) return;
		this.hudShownAt = now;
		const state = this.state;
		const elapsed = Math.max(state.time, 0.001);

		setText(h.dps, fmt(state.time > 1 ? this.total / elapsed : 0));
		setText(h.time, `${fmt(this.total)} damage`);
		setText(h.clock, state.length ? `${fmtTime(state.time)} / ${fmtTime(state.length)}` : fmtTime(state.time));

		// Player frame: health, power, combo points, buffs.
		const [hp, hpMax] = state.resources.health;
		setStyle(h.pfHealth, 'width', `${(hp / hpMax) * 100}%`);
		setText(h.pfHealthText, `${fmt(hp)} / ${fmt(hpMax)}`);
		const [kind, values] = Object.entries(state.resources).find(([k]) => k !== 'health' && k !== 'combo') ?? [];
		h.pfPower.hidden = !kind;
		if (kind) {
			if (h.pfPower.dataset.kind !== kind) h.pfPower.dataset.kind = kind;
			setStyle(h.pfPower.firstChild, 'width', `${Math.min(100, (values[0] / (values[1] || 100)) * 100)}%`);
			setText(h.pfPower.lastChild, `${fmt(values[0])} / ${fmt(values[1])} ${kind}`);
		}
		const combo = state.resources.combo?.[0] ?? -1;
		h.pfCombo.hidden = combo < 0;
		if (combo >= 0) setText(h.pfCombo, '●'.repeat(combo) + '○'.repeat(Math.max(0, 5 - combo)));
		this.syncAuras(h.pfAuras, state.auras.filter(a => !a.permanent).slice(0, 20), { flashNew: true });

		// Target frame: health and debuffs.
		setStyle(h.tfHealth, 'width', `${state.target.health}%`);
		setText(h.tfHealthText, `${fmt(state.target.health)}%`);
		setText(h.tfPhase, state.execute ? '· Execute range' : '');
		const here = this.where();
		setText(h.tfRange, `${fmt(state.distance ?? here.distance, 1)} yd${here.facing ? '' : ' · behind you'}`);
		this.syncAuras(h.tfAuras, state.target.auras.slice(0, 20));

		// Action bar: cooldown sweeps, the global cooldown, what can be used, what lights up.
		const procs = new Set(state.auras.map(a => PROC_BUTTONS[a.label] ?? WINDOWS[a.label]).filter(Boolean));
		for (const slot of h.slots) {
			const ability = slot.ability;
			if (!ability) continue;
			if (ability.key === 'attack') {
				slot.el.toggleAttribute('data-active', !!state.attacking);
				continue;
			}
			const s = state.spells[ability.key];
			if (!s) continue;
			const gcd = ability.gcd > 0 ? state.gcdIn : 0;
			const wait = Math.max(s.readyIn, gcd);
			const total = s.readyIn >= gcd ? s.cooldown || 1 : 1.5;
			setStyle(slot.sweep, 'background', wait > 0 ? `conic-gradient(rgb(0 0 0 / 0.65) ${Math.round((wait / total) * 360)}deg, transparent 0)` : '');
			setText(slot.cd, s.readyIn > 1.5 ? shortTime(s.readyIn) : '');
			slot.el.toggleAttribute('data-unusable', !s.usable && wait <= 0);
			slot.el.toggleAttribute('data-range', !!s.outOfRange);
			slot.el.toggleAttribute('data-glow', (REACTIVE.has(ability.name) && s.usable) || procs.has(ability.name));
		}
		// Call-outs: a window that just opened, or a reactive ability that just became usable.
		for (const ability of this.abilities) {
			if (!REACTIVE.has(ability.name)) continue;
			const open = procs.has(ability.name) || !!state.spells[ability.key]?.usable;
			if (open && this.usableBefore.get(ability.key) === false) {
				const needs = STANCES[ability.name];
				const stance = ['Battle', 'Defensive', 'Berserker'].find(st => state.auras.some(a => a.label.startsWith(`${st} Stance`)));
				const hint = needs && stance && !needs.includes(stance) ? ` (${needs[0]} Stance)` : '';
				this.alert(`${ability.name}!${hint}`, ability.info.iconUrl);
			}
			this.usableBefore.set(ability.key, open);
		}

		// Cast bar.
		h.cast.hidden = !state.casting;
		if (state.casting) {
			const ability = this.abilities.find(a => a.key === state.casting.key);
			const total = state.casting.castTime || 1;
			setStyle(h.castFill, 'width', `${Math.min(100, (1 - state.casting.endsIn / total) * 100)}%`);
			setText(h.castText, `${ability?.name ?? 'Casting'} ${state.casting.endsIn.toFixed(1)}`);
		}

		// Swing timers: how far each weapon is into its swing.
		for (const [hand, [next, speed]] of Object.entries(state.swing ?? {})) {
			let bar = h.swingBars.get(hand);
			if (!bar) {
				const el = document.createElement('div');
				el.className = 'swing-bar';
				el.dataset.hand = hand;
				el.innerHTML = `<i></i><span>${{ mh: 'Main hand', oh: 'Off hand', ranged: 'Ranged' }[hand]}</span><b></b>`;
				h.swing.append(el);
				bar = { el, fill: el.querySelector('i'), left: el.querySelector('b') };
				h.swingBars.set(hand, bar);
			}
			setStyle(bar.fill, 'width', `${Math.round(Math.min(100, Math.max(0, (1 - next / (speed || 1)) * 100)))}%`);
			setText(bar.left, `${next.toFixed(1)}s`);
		}
		for (const [hand, bar] of h.swingBars) {
			if (state.swing?.[hand]) continue;
			bar.el.remove();
			h.swingBars.delete(hand);
		}

		// Damage meter, one row per ability, updated in place.
		const rows = [...this.totals.values()].filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
		const top = rows[0]?.amount || 1;
		const keep = new Set();
		rows.forEach((r, i) => {
			keep.add(r.action.key);
			let row = h.meterRows.get(r.action.key);
			if (!row) {
				const li = document.createElement('li');
				li.innerHTML = `<span class="icon"></span><span class="label"></span><span class="value"></span><i></i>`;
				row = { li, value: li.querySelector('.value'), fill: li.querySelector('i') };
				infoOf(r.action).then(info => {
					li.querySelector('.label').textContent = cleanName(info.name);
					const icon = li.querySelector('.icon');
					if (info.iconUrl === 'melee') icon.textContent = '⚔';
					else if (info.iconUrl) icon.style.backgroundImage = `url(${info.iconUrl})`;
				});
				h.meterRows.set(r.action.key, row);
			}
			if (h.meter.children[i] !== row.li) h.meter.insertBefore(row.li, h.meter.children[i] ?? null);
			setText(row.value, `${fmt(r.amount / elapsed)} · ${Math.round((r.amount / (this.total || 1)) * 100)}%`);
			setStyle(row.fill, 'width', `${Math.round((r.amount / top) * 100)}%`);
		});
		for (const [key, row] of h.meterRows) {
			if (keep.has(key)) continue;
			row.li.remove();
			h.meterRows.delete(key);
		}
	}
}
