// Combat logs: fights you played, read from the game's own combat log. Pick a fight and a player
// to replay it in 3D (your casts, hits and crits at their real times) and to compare it with the
// sim's rotation for your gear in a fight as long as yours.

import { RACES } from './character.js';
import { captureSimRequest, Replay, specPageFor } from './replay.js';
import { renderComparison } from './summary.js';

const fmt = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const json = async (url, options) => {
	const r = await fetch(url, options);
	if (!r.ok) throw new Error((await r.text()).trim() || r.statusText);
	return r.json();
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A logged event as the replay plays it (the shape the sim's log parser makes). */
function toReplayEvent(e) {
	const action = e.otherId
		? { spellId: 0, otherId: e.otherId, itemId: 0, tag: e.tag || 1, key: `o${e.otherId}:${e.tag || 1}` }
		: { spellId: e.spellId, otherId: 0, itemId: 0, tag: 0, key: `s${e.spellId}` };
	switch (e.type) {
		case 'damage':
			return { time: e.t, type: 'damage', action, tick: !!e.tick, outcome: e.outcome, amount: e.amount || 0, pet: !!e.pet, school: e.school || 1 };
		case 'cast':
			return { time: e.t, type: 'cast', action, castTime: e.castTime || 0 };
		case 'resource':
			return { time: e.t, type: 'resource', kind: e.kind, value: e.value, max: e.max };
		case 'auraOn':
		case 'auraOff':
			return { time: e.t, type: e.type, action };
	}
	return null;
}

/** The sim's key for an action ("{SpellID: 23894}", "{OtherID: 3, Tag: 2}"), "pet:" for a pet's. */
function simKey(e) {
	const key = e.otherId ? `{OtherID: ${e.otherId}, Tag: ${e.tag || 1}}` : `{SpellID: ${e.spellId}}`;
	return e.pet ? `pet:${key}` : key;
}

/** Casts and damage per ability, as the comparison wants them. */
function fightTotals(events, duration) {
	const actions = {};
	let total = 0;
	const casted = new Set(events.filter(e => e.type === 'cast').map(e => simKey(e)));
	for (const e of events) {
		if (e.type !== 'damage' && e.type !== 'cast') continue;
		const key = simKey(e);
		const a = (actions[key] ??= { casts: 0, damage: 0, pet: !!e.pet });
		if (e.type === 'cast') a.casts++;
		// Swings, and abilities the log shows no cast for (procs), count their hits as casts.
		else if (!e.tick && !casted.has(key)) a.casts++;
		if (e.type === 'damage') {
			a.damage += e.amount || 0;
			total += e.amount || 0;
		}
	}
	return { dps: total / Math.max(duration, 1), duration, actions };
}

export class Logs extends Replay {
	constructor(env) {
		super({ ...env });
	}

	buildPanel() {
		this.panel = document.getElementById('logs-panel');
		this.panel.innerHTML = `
			<p class="hint" style="margin:0">Replay fights you played and compare them with the sim. In the game, type <b>/combatlog</b> to start recording (and again to stop); turn on <b>Advanced Combat Logging</b> in Options → Network for resources and pets.</p>
			<div class="row"><select id="logs-file"></select><button id="logs-refresh" title="Look again">↻</button></div>
			<ul id="logs-fights" class="results logs-fights"></ul>
			<label>Player <select id="logs-player"></select></label>
			<button id="logs-replay">Replay in 3D</button>
			<label>Compare with the sim as <select id="logs-sim"></select></label>
			<button id="logs-compare">Compare with the sim</button>
			<div id="logs-info" class="hint"></div>`;
		this.panel.style.cssText = 'display:flex;flex-direction:column;gap:10px;min-height:0';
		const q = s => this.panel.querySelector(s);
		q('#logs-refresh').addEventListener('click', () => this.loadFiles());
		q('#logs-file').addEventListener('change', () => this.loadFights());
		q('#logs-player').addEventListener('change', () => (this.guid = q('#logs-player').value));
		q('#logs-replay').addEventListener('click', () => this.replay());
		q('#logs-compare').addEventListener('click', () => this.compare());
		q('#logs-sim').addEventListener('focus', () => this.renderSimChoices());
	}

	async open() {
		this.active = true;
		this.character = await this.env.getCharacter();
		if (!this.active) return;
		await this.setupScene();
		this.env.title.textContent = 'Combat logs';
		this.renderHud();
		this.renderSimChoices();
		await this.loadFiles();
	}

	say(text) {
		this.env.status.textContent = text;
	}

	async loadFiles() {
		const select = this.panel.querySelector('#logs-file');
		try {
			const { files, dir } = await json('/api/logs');
			select.innerHTML = '';
			if (!files.length) {
				select.append(new Option('No combat logs yet', ''));
				this.panel.querySelector('#logs-fights').innerHTML = '';
				this.panel.querySelector('#logs-info').textContent = `Logs appear in ${dir} once you use /combatlog in the game.`;
				return;
			}
			for (const f of files) select.append(new Option(`${new Date(f.modified * 1000).toLocaleString()} · ${fmt(f.size / 1048576, 1)} MB`, f.name));
			await this.loadFights();
		} catch (error) {
			this.say(`Logs: ${error.message}`);
		}
	}

	async loadFights() {
		const file = this.panel.querySelector('#logs-file').value;
		const list = this.panel.querySelector('#logs-fights');
		if (!file) return;
		list.innerHTML = '<li class="hint">Reading the log…</li>';
		try {
			const { fights, advanced } = await json(`/api/logs/fights?file=${encodeURIComponent(file)}`);
			this.file = file;
			this.fights = fights;
			this.panel.querySelector('#logs-info').textContent = advanced ? '' : 'Advanced Combat Logging is off in this log, so resources and pets are missing.';
			list.innerHTML = '';
			if (!fights.length) list.innerHTML = '<li class="hint">No fights in this log.</li>';
			for (const fight of [...fights].reverse()) {
				const li = document.createElement('li');
				const result = fight.success === undefined ? '' : fight.success ? ' · kill' : ' · wipe';
				li.innerHTML = `<div><span></span><small></small></div>`;
				li.querySelector('span').textContent = fight.name || 'Combat';
				li.querySelector('small').textContent = `${fight.clock} · ${fmtTime(fight.duration)}${result} · ${fight.players?.length ?? 0} players`;
				li.addEventListener('click', () => {
					list.querySelector('[data-active]')?.removeAttribute('data-active');
					li.setAttribute('data-active', '');
					this.pickFight(fight);
				});
				list.append(li);
			}
			list.querySelector('li:not(.hint)')?.click();
		} catch (error) {
			list.innerHTML = '';
			this.say(`Logs: ${error.message}`);
		}
	}

	async pickFight(fight) {
		this.fight = fight;
		const select = this.panel.querySelector('#logs-player');
		select.innerHTML = '';
		const characters = await this.gameCharacters();
		// Your own characters (saved by the addon) first, then the rest by damage.
		const mine = new Set(characters.map(c => c.name));
		const players = [...(fight.players ?? [])].sort((a, b) => (mine.has(b.name.split('-')[0]) ? 1 : 0) - (mine.has(a.name.split('-')[0]) ? 1 : 0) || b.damage - a.damage);
		for (const p of players) select.append(new Option(`${p.name} · ${fmt(p.dps)} DPS`, p.guid));
		this.guid = select.value;
		this.say(`${fight.name || 'Combat'} at ${fight.clock}: ${fmtTime(fight.duration)}. Pick a player, then replay or compare.`);
	}

	async gameCharacters() {
		this.characters ??= json('/api/game/characters').then(r => r.characters ?? []).catch(() => []);
		return this.characters;
	}

	renderSimChoices() {
		const select = this.panel.querySelector('#logs-sim');
		const keep = select.value;
		select.innerHTML = '';
		const sims = this.env.savedSims();
		if (!sims.length) select.append(new Option('No sim characters yet', ''));
		for (const sim of sims) select.append(new Option(sim.label, sim.key));
		if (keep) select.value = keep;
	}

	async fightEvents() {
		if (!this.fight || !this.guid) throw new Error('pick a fight and a player first');
		const data = await json(`/api/logs/events?file=${encodeURIComponent(this.file)}&fight=${this.fight.id}&guid=${encodeURIComponent(this.guid)}`);
		return data;
	}

	/** Dresses the 3D character as the logged player: the addon's save of them if there is one. */
	async dress(player) {
		const name = player.name.split('-')[0];
		const saved = (await this.gameCharacters()).find(c => c.name === name);
		if (!saved) return false;
		const race = RACES.find(r => r.id === saved.raceID);
		const items = Array.from({ length: 17 }, (_, i) => saved.gear?.[`slot${i}`] ?? {});
		await this.env.applySim({ player: { race: race?.sim, equipment: { items } } }, { sex: saved.sex === 3 ? 1 : 0 });
		this.character = await this.env.getCharacter();
		return true;
	}

	async replay() {
		const button = this.panel.querySelector('#logs-replay');
		button.disabled = true;
		try {
			const { events, player, fight } = await this.fightEvents();
			this.say('Dressing the character…');
			const dressed = await this.dress(player);
			const replayEvents = events.map(toReplayEvent).filter(Boolean);
			await this.playEvents(replayEvents, fight.duration);
			this.say(`${player.name} in ${fight.name || 'combat'}: ${fmt(player.dps, 1)} DPS over ${fmtTime(fight.duration)}${dressed ? '' : ' (not saved by the addon, so shown in the Gear tab’s outfit)'}`);
		} catch (error) {
			this.say(`Replay: ${error.message}`);
			console.error(error);
		} finally {
			button.disabled = false;
		}
	}

	async compare() {
		const button = this.panel.querySelector('#logs-compare');
		button.disabled = true;
		try {
			const sims = this.env.savedSims();
			const sim = sims.find(s => s.key === this.panel.querySelector('#logs-sim').value) ?? sims[0];
			if (!sim) throw new Error('set up the character in the sim first (Open the sim)');
			const { events, player, fight } = await this.fightEvents();
			const spec = await specPageFor(sim.key);
			if (!spec) throw new Error(`no sim page for ${sim.label}`);
			this.say('Opening the sim…');
			const request = await captureSimRequest(spec, text => this.say(text));
			this.say(`Simulating ${fmtTime(fight.duration)} of the sim's rotation…`);
			const health = fight.kind === 'encounter' ? 'real' : 'above';
			const reference = await json(`/api/logs/reference?duration=${fight.duration}&health=${health}`, { method: 'POST', body: request });
			const box = document.createElement('div');
			box.className = 'summary';
			this.overlay.querySelector('.summary')?.remove();
			this.overlay.append(box);
			const pressable = new Set(events.filter(e => e.type === 'cast').map(e => simKey(e)));
			await renderComparison(box, { you: fightTotals(events, fight.duration), reference }, { pressable, youLabel: player.name.split('-')[0] });
			this.say(`${player.name} against the sim's rotation as ${sim.label}.`);
		} catch (error) {
			this.say(`Compare: ${error.message}`);
			console.error(error);
		} finally {
			button.disabled = false;
		}
	}

	// The replay's "New fight" button replays the same logged fight.
	run() {
		return this.replay();
	}
}
