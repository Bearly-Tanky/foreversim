import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { ensureReady, renderVersion } from './app.js';
import { Character, RACES, SLOTS } from './character.js';
import { itemDisplay, searchItems, simItemList } from './game.js';
import { ANIM, loadModel } from './model.js';
import { Practice } from './practice.js';
import { Replay, simPages } from './replay.js';

const $ = id => document.getElementById(id);
const main = document.querySelector('main');
const status = $('status');
const title = $('title');

// --- Scene ---

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
main.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131a);
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302820, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2, 4, 3);
scene.add(sun);
const grid = new THREE.GridHelper(10, 20, 0x2a3142, 0x1c2130);
scene.add(grid);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
const controls = new OrbitControls(camera, renderer.domElement);
window.tg = { camera, controls, scene };
controls.enableDamping = true;

// The interface scales with the window: 1 at 1440×860, smaller on laptops, bigger on large monitors.
function scaleInterface() {
	const ui = Math.min(Math.max(Math.min(innerWidth / 1440, innerHeight / 860), 0.72), 2);
	document.documentElement.style.setProperty('--ui', ui.toFixed(3));
}
addEventListener('resize', scaleInterface);
scaleInterface();

function resize() {
	const { clientWidth: w, clientHeight: h } = main;
	renderer.setSize(w, h, false);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(main);
resize();

const clock = new THREE.Clock();
const tickers = new Set();
renderer.setAnimationLoop(() => {
	const delta = Math.min(clock.getDelta(), 0.1) * 1000;
	for (const tick of tickers) tick(delta);
	if (controls.enabled) controls.update();
	renderer.render(scene, camera);
});

let shown = null;
let shownTicker = null;

/** Puts an object in the middle of the scene, standing on the grid, and frames it. */
function show(object, { tick = null, spin = false } = {}) {
	if (shown && shown !== object) scene.remove(shown);
	if (shownTicker) tickers.delete(shownTicker);
	shown = object;
	shownTicker = tick;
	if (tick) tickers.add(tick);
	scene.add(object);
	frame(object);
	controls.autoRotate = spin;
	controls.autoRotateSpeed = 1.5;
}

function frame(object, { distance = 2.4 } = {}) {
	object.position.set(0, 0, 0);
	object.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(object);
	const size = box.getSize(new THREE.Vector3());
	const center = box.getCenter(new THREE.Vector3());
	object.position.y -= box.min.y;
	object.position.x -= center.x;
	object.position.z -= center.z;
	const radius = Math.max(size.x, size.y, size.z);
	controls.target.set(0, size.y * 0.55, 0);
	camera.position.set(radius * 0.25, size.y * 0.7, radius * distance);
	camera.near = radius / 100;
	camera.far = radius * 100;
	camera.updateProjectionMatrix();
	grid.scale.setScalar(Math.max(radius / 2, 0.2));
}

// --- Modes ---

const modes = { character: $('mode-character'), items: $('mode-items'), replay: $('mode-replay'), practice: $('mode-practice') };
let mode = null;
function setMode(name) {
	if (mode === 'replay' && name !== 'replay') replay.close();
	if (mode === 'practice' && name !== 'practice') practice.close();
	mode = name;
	for (const [key, panel] of Object.entries(modes)) panel.hidden = key !== name;
	for (const tab of document.querySelectorAll('[data-mode]')) tab.toggleAttribute('data-active', tab.dataset.mode === name);
	if (name === 'character') showCharacter();
	if (name === 'replay') replay.open();
	if (name === 'practice') practice.open();
}
for (const tab of document.querySelectorAll('[data-mode]')) tab.addEventListener('click', () => setMode(tab.dataset.mode));

// --- Items ---

async function showItem(itemId) {
	status.textContent = `Loading item ${itemId}…`;
	try {
		const item = await itemDisplay(itemId);
		title.innerHTML = `<span class="q${item.quality}"></span>`;
		title.firstChild.textContent = item.name;
		const group = new THREE.Group();
		let x = 0;
		for (const entry of item.models) {
			if (!entry.files.length) continue;
			const model = await loadModel(entry.files[0], { replaceable: { 2: entry.textures[0] } });
			const width = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).x;
			model.root.position.x = x;
			x += width * 1.2;
			group.add(model.root);
		}
		if (!group.children.length) throw new Error('this item has no model of its own (armor is painted on the body: try it on in Character)');
		// Weapons are modelled lying down; stand a long one on its tip, hilt up.
		const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
		const stand = new THREE.Group();
		stand.add(group);
		if (item.models.length === 1 && Math.max(size.x, size.z) > size.y * 1.5) {
			if (size.x > size.z) group.rotation.z = -Math.PI / 2;
			else group.rotation.x = Math.PI / 2;
		}
		show(stand, { spin: true });
		status.textContent = `${item.slot} · item ${itemId} · display ${item.display.ID}`;
	} catch (error) {
		status.textContent = `Item ${itemId}: ${error.message}`;
		console.error(error);
	}
}

function searchBox(input, list, onPick) {
	let timer;
	input.addEventListener('input', () => {
		clearTimeout(timer);
		timer = setTimeout(run, 250);
	});
	async function run() {
		const text = input.value.trim();
		list.innerHTML = '';
		if (text.length < 3) return;
		const items = await searchItems(text);
		if (input.value.trim() !== text) return;
		for (const item of items) {
			const li = document.createElement('li');
			li.innerHTML = `<div><span class="q${item.quality}"></span><small></small></div>`;
			li.querySelector('span').textContent = item.name;
			li.querySelector('small').textContent = `${item.slot} · ${item.id}`;
			li.addEventListener('click', () => {
				list.querySelector('[data-active]')?.removeAttribute('data-active');
				li.setAttribute('data-active', '');
				onPick(item.id);
			});
			list.append(li);
		}
	}
}
searchBox($('item-search'), $('item-results'), showItem);

// --- Character ---

const SLOT_FOR_INVENTORY = { 1: 'Head', 3: 'Shoulder', 4: 'Shirt', 5: 'Chest', 20: 'Chest', 6: 'Waist', 7: 'Legs', 8: 'Feet', 9: 'Wrist', 10: 'Hands', 16: 'Back', 19: 'Tabard', 13: 'MainHand', 17: 'MainHand', 21: 'MainHand', 14: 'OffHand', 22: 'OffHand', 23: 'OffHand', 15: 'Ranged', 25: 'Ranged', 26: 'Ranged' };
const SLOT_LABEL = { Head: 'Head', Shoulder: 'Shoulders', Back: 'Back', Chest: 'Chest', Shirt: 'Shirt', Tabard: 'Tabard', Wrist: 'Wrists', Hands: 'Hands', Waist: 'Waist', Legs: 'Legs', Feet: 'Feet', MainHand: 'Main hand', OffHand: 'Off hand', Ranged: 'Ranged' };

const state = loadState();
function loadState() {
	const fresh = { race: 1, sex: 0, gear: {}, choices: null, anim: 'Stand' };
	try {
		return { ...fresh, ...JSON.parse(localStorage.getItem('testground') ?? '{}') };
	} catch {
		return fresh;
	}
}
function saveState() {
	try {
		localStorage.setItem('testground', JSON.stringify(state));
	} catch {}
}

let character = null;
let characterKey = '';
let building = Promise.resolve();

const raceSelect = $('race');
for (const race of RACES) raceSelect.append(new Option(race.name, race.id));
raceSelect.value = state.race;
raceSelect.addEventListener('change', () => {
	state.race = Number(raceSelect.value);
	state.choices = null;
	saveState();
	showCharacter();
});
for (const button of document.querySelectorAll('[data-sex]')) {
	button.addEventListener('click', () => {
		state.sex = Number(button.dataset.sex);
		state.choices = null;
		saveState();
		showCharacter();
	});
}

const animSelect = $('anim');
animSelect.addEventListener('change', () => {
	state.anim = animSelect.value;
	saveState();
	character?.model.play(ANIM[state.anim]);
});

function showCharacter() {
	building = building.then(buildCharacter).catch(error => {
		status.textContent = `Character: ${error.message}`;
		console.error(error);
	});
	return building;
}

async function getCharacter() {
	await building;
	if (!character) await showCharacter();
	return character;
}

async function buildCharacter() {
	for (const button of document.querySelectorAll('[data-sex]')) button.toggleAttribute('data-active', Number(button.dataset.sex) === state.sex);
	const key = `${state.race}:${state.sex}`;
	if (!character || characterKey !== key) {
		status.textContent = 'Loading character model…';
		character = await Character.create(state.race, state.sex);
		characterKey = key;
		if (state.choices) character.choices = { ...character.choices, ...state.choices };
		renderCustomization();
		renderAnimations();
	} else if (state.choices) {
		character.choices = { ...character.choices, ...state.choices };
	}
	status.textContent = 'Dressing…';
	await character.dress({ gear: state.gear });
	if (mode === 'character') {
		await character.model.play(ANIM[state.anim] ?? 0);
		title.textContent = RACES.find(r => r.id === state.race)?.name ?? '';
		if (shown !== character.root) show(character.root, { tick: delta => character.update(delta) });
		status.textContent = `${RACES.find(r => r.id === state.race)?.name} ${state.sex ? 'female' : 'male'} · drag to turn, scroll to zoom`;
	}
	renderGear();
}

function renderCustomization() {
	const box = $('looks');
	box.innerHTML = '';
	for (const option of character.base.options) {
		if (option.choices.length < 2) continue;
		const label = document.createElement('label');
		label.textContent = option.name;
		const select = document.createElement('select');
		option.choices.forEach((choice, i) => select.append(new Option(choice.name && !/^\d+$/.test(choice.name) ? choice.name : `${option.name} ${i + 1}`, choice.id)));
		select.value = character.choices[option.id];
		select.addEventListener('change', () => {
			state.choices = { ...character.choices, [option.id]: Number(select.value) };
			saveState();
			showCharacter();
		});
		label.append(select);
		box.append(label);
	}
}

function renderAnimations() {
	const current = state.anim;
	animSelect.innerHTML = '';
	for (const name of Object.keys(ANIM)) if (character.model.hasAnimation(ANIM[name])) animSelect.append(new Option(name.replace(/([a-z])([A-Z0-9])/g, '$1 $2'), name));
	animSelect.value = character.model.hasAnimation(ANIM[current]) ? current : 'Stand';
	state.anim = animSelect.value;
}

async function renderGear() {
	const list = $('gear');
	const names = await simItemList();
	list.innerHTML = '';
	for (const slot of Object.keys(SLOT_LABEL)) {
		const li = document.createElement('li');
		const id = state.gear[slot];
		const item = id ? names.get(id) : null;
		li.innerHTML = `<span class="slot"></span><span class="name"></span>`;
		li.querySelector('.slot').textContent = SLOT_LABEL[slot];
		const name = li.querySelector('.name');
		name.textContent = id ? (item?.name ?? `Item ${id}`) : '—';
		if (item) name.className = `name q${item.quality}`;
		if (id) {
			const remove = document.createElement('button');
			remove.textContent = '×';
			remove.title = 'Take off';
			remove.addEventListener('click', () => {
				delete state.gear[slot];
				saveState();
				showCharacter();
			});
			li.append(remove);
		}
		list.append(li);
	}
}

searchBox($('gear-search'), $('gear-results'), async itemId => {
	const item = await itemDisplay(itemId);
	const slot = SLOT_FOR_INVENTORY[item.inventoryType];
	if (!slot) {
		status.textContent = `${item.name} is not something you can see on a character`;
		return;
	}
	state.gear[slot] = itemId;
	saveState();
	showCharacter();
});

// The sim saves each spec's settings in this origin's storage when it is opened from this
// server (http://127.0.0.1:8090/forever/).
function savedSims() {
	const out = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key?.endsWith('__currentSettings__')) continue;
		try {
			const settings = JSON.parse(localStorage.getItem(key));
			if (settings?.player?.equipment) out.push({ key, settings, label: simLabel(key, settings) });
		} catch {}
	}
	return out;
}

// The sim's page names by storage key, for labels ("Shadow Priest · Human").
let pageNames = new Map();
simPages().then(pages => {
	pageNames = new Map(pages.map(p => [`${p.key}__currentSettings__`, p.name]));
	renderSimPicker();
});

function simLabel(key, settings) {
	const name = pageNames.get(key) ?? key.replace(/^__forever_|__currentSettings__$/g, '').replace(/_+/g, ' ');
	const race = RACES.find(r => r.sim === settings.player.race)?.name;
	return race ? `${name} · ${race}` : name;
}

function renderSimPicker() {
	for (const select of document.querySelectorAll('.sim-pick')) {
		select.innerHTML = '';
		const sims = savedSims();
		select.append(new Option(sims.length ? 'Load a character from the sim…' : 'No sim characters yet (open the sim below)', ''));
		for (const sim of sims) select.append(new Option(sim.label, sim.key));
	}
}
for (const select of document.querySelectorAll('.sim-pick')) {
	select.addEventListener('focus', renderSimPicker);
	select.addEventListener('change', event => {
		const sim = savedSims().find(s => s.key === event.target.value);
		if (sim) applySim(sim.settings);
		event.target.value = '';
	});
}

function applySim(settings) {
	const player = settings.player;
	const race = RACES.find(r => r.sim === player.race);
	if (race && race.id !== state.race) {
		state.race = race.id;
		state.choices = null;
		raceSelect.value = race.id;
	}
	state.gear = {};
	(player.equipment.items ?? []).forEach((item, i) => {
		const slot = SLOTS[i];
		if (!item?.id || !slot || /^(Finger|Trinket|Neck)/.test(slot)) return;
		state.gear[slot] = item.id;
	});
	saveState();
	return showCharacter();
}

// --- Replay ---

const replay = new Replay({ scene, camera, controls, show, getCharacter, savedSims, applySim, status, title, tickers });
window.tgReplay = replay;
const practice = new Practice({ scene, camera, controls, grid, show, getCharacter, savedSims, applySim, status, title, tickers });
window.tgPractice = practice;

// --- Start ---

renderVersion($('app-footer'));
const info = await ensureReady();
status.textContent = `Reading ${info.product} ${info.gameVersion}`;
renderSimPicker();
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has('item')) {
	setMode('items');
	showItem(Number(hash.get('item')));
} else setMode(hash.get('mode') ?? 'practice');
