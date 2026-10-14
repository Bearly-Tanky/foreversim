// Turns an M2 and its textures into a Three.js object that can show or hide geosets, swap
// replaceable textures, play animations and carry things at its attachment points.

import * as THREE from 'three';

import { decodeBlp } from './blp.js';
import { fetchFile } from './game.js';
import { animData, parseM2, parseSkin, readTrack } from './m2.js';

const textures = new Map();
const images = new Map();

export function loadTexture(fdid) {
	if (!textures.has(fdid)) {
		textures.set(
			fdid,
			fetchFile(fdid).then(buffer => {
				const { width, height, rgba } = decodeBlp(buffer);
				const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
				prepareTexture(texture);
				texture.needsUpdate = true;
				return texture;
			}),
		);
	}
	return textures.get(fdid);
}

/** A texture as an image for drawing into a canvas. */
export function loadImage(fdid) {
	if (!images.has(fdid)) {
		images.set(
			fdid,
			fetchFile(fdid).then(buffer => {
				const { width, height, rgba } = decodeBlp(buffer);
				return createImageBitmap(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), width, height));
			}),
		);
	}
	return images.get(fdid);
}

export function prepareTexture(texture) {
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.anisotropy = 8;
	return texture;
}

// M2 blend modes: opaque, alpha key, alpha blend, additive (no alpha), additive, modulate, ...
function makeMaterial(m2Material, skinned) {
	const blend = m2Material?.blend ?? 0;
	const flags = m2Material?.flags ?? 0;
	const params = {
		side: flags & 0x4 ? THREE.DoubleSide : THREE.FrontSide,
		alphaTest: blend === 1 ? 0.5 : blend >= 2 ? 0.01 : 0,
		transparent: blend >= 2,
		depthWrite: blend <= 1,
	};
	if (blend === 3 || blend === 4) params.blending = THREE.AdditiveBlending;
	if (blend === 5 || blend === 6) params.blending = THREE.MultiplyBlending;
	const material = flags & 0x1 ? new THREE.MeshBasicMaterial(params) : new THREE.MeshLambertMaterial(params);
	material.userData.skinned = skinned;
	return material;
}

const ANIM = { Stand: 0, Death: 1, Walk: 4, Run: 5, Dead: 6, ShuffleLeft: 11, ShuffleRight: 12, Walkbackwards: 13, JumpStart: 37, Jump: 38, JumpEnd: 39, Fall: 40, AttackUnarmed: 16, Attack1H: 17, Attack2H: 18, Attack2HL: 19, ParryUnarmed: 20, Parry1H: 21, Parry2H: 22, ShieldBlock: 24, ReadyUnarmed: 25, Ready1H: 26, Ready2H: 27, Ready2HL: 28, ReadyBow: 29, Dodge: 30, SpellPrecast: 31, SpellCast: 32, SpellCastArea: 33, Block: 36, AttackBow: 46, ReadySpellDirected: 51, ReadySpellOmni: 52, SpellCastDirected: 53, SpellCastOmni: 54, BattleRoar: 55, ReadyAbility: 56, Special1H: 57, Special2H: 58, ShieldBash: 59, Kick: 61, AttackThrown: 62, AttackOff: 87, AttackOffPierce: 88, Attack1HPierce: 94, Attack2HLoosePierce: 95 };
export { ANIM };

export class M2Model {
	static async load(fdid) {
		const m2 = parseM2(await fetchFile(fdid));
		if (!m2.skinFileIds.length) throw new Error(`model ${fdid} has no skin`);
		const skin = parseSkin(await fetchFile(m2.skinFileIds[0]));
		return new M2Model(fdid, m2, skin);
	}

	constructor(fdid, m2, skin) {
		this.fdid = fdid;
		this.m2 = m2;
		this.skin = skin;
		this.replaceable = {};
		this.showSection = () => true;
		this.textureCache = new Map();

		const { vertexLookup, triangles } = skin;
		const n = vertexLookup.length;
		const positions = new Float32Array(n * 3);
		const normals = new Float32Array(n * 3);
		const uvs = new Float32Array(n * 2);
		const uvs2 = new Float32Array(n * 2);
		const skinIndex = new Uint16Array(n * 4);
		const skinWeight = new Float32Array(n * 4);
		const v = m2.vertices;
		for (let i = 0; i < n; i++) {
			const j = vertexLookup[i];
			positions.set(v.positions.subarray(j * 3, j * 3 + 3), i * 3);
			normals.set(v.normals.subarray(j * 3, j * 3 + 3), i * 3);
			uvs.set(v.uvs.subarray(j * 2, j * 2 + 2), i * 2);
			uvs2.set(v.uvs2.subarray(j * 2, j * 2 + 2), i * 2);
			for (let k = 0; k < 4; k++) {
				skinIndex[i * 4 + k] = v.boneIndices[j * 4 + k];
				skinWeight[i * 4 + k] = v.boneWeights[j * 4 + k] / 255;
			}
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
		geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
		geometry.setAttribute('uv1', new THREE.BufferAttribute(uvs2, 2));
		geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(triangles), 1));

		this.hasBones = m2.bones.length > 0;
		if (this.hasBones) {
			geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
			geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
			const bones = m2.bones.map(() => {
				const bone = new THREE.Bone();
				bone.matrixAutoUpdate = false;
				return bone;
			});
			this.mesh = new THREE.SkinnedMesh(geometry, []);
			this.mesh.bindMode = THREE.DetachedBindMode;
			this.mesh.bind(new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4())), new THREE.Matrix4());
			this.boneMatrices = m2.bones.map(() => new THREE.Matrix4());
		} else {
			this.mesh = new THREE.Mesh(geometry, []);
		}
		this.mesh.frustumCulled = false;
		this.mesh.name = m2.name;

		this.batches = [...skin.batches]
			.map((batch, i) => ({ ...batch, order: i, sectionId: skin.sections[batch.section]?.id ?? -1, material: makeMaterial(m2.materials[batch.material], this.hasBones) }))
			.filter(batch => skin.sections[batch.section])
			.sort((a, b) => a.priority - b.priority || a.layer - b.layer || a.order - b.order);

		// The object the outside sees: Three's Y up, facing +Z.
		this.root = new THREE.Group();
		this.inner = new THREE.Group();
		this.inner.rotation.set(-Math.PI / 2, 0, 0);
		const facing = new THREE.Group();
		facing.rotation.y = -Math.PI / 2;
		facing.add(this.inner);
		this.root.add(facing);
		this.inner.add(this.mesh);

		this.attached = new Map();
		this.anim = { index: -1, time: 0, source: null, tracks: null };
		this.animCache = new Map();
		this.globalTime = 0;
		this.updateBones();
	}

	/** Fills replaceable texture slots by M2 texture type (1 body, 2 item or cape, 6 hair, ...). */
	setReplaceable(type, texture) {
		this.replaceable[type] = texture;
	}

	async applyMaterials() {
		const { m2 } = this;
		for (const batch of this.batches) {
			const textureIndex = m2.textureCombos[batch.textureCombo];
			const texture = m2.textures[textureIndex];
			let map = null;
			if (texture?.type === 0) {
				const file = m2.textureFileIds[textureIndex];
				map = file ? await loadTexture(file).catch(() => null) : null;
			} else if (texture) {
				const r = this.replaceable[texture.type];
				map = typeof r === 'number' ? await loadTexture(r).catch(() => null) : (r ?? null);
			}
			batch.missing = texture && texture.type !== 0 && !map;
			if (batch.material.map !== map) {
				batch.material.map = map;
				batch.material.needsUpdate = true;
			}
		}
		this.rebuildGroups();
	}

	setGeosets(showSection) {
		this.showSection = showSection;
		this.rebuildGroups();
	}

	rebuildGroups() {
		const geometry = this.mesh.geometry;
		geometry.clearGroups();
		const materials = [];
		for (const batch of this.batches) {
			if (!this.showSection(batch.sectionId) || batch.missing) continue;
			const section = this.skin.sections[batch.section];
			geometry.addGroup(section.indexStart, section.indexCount, materials.length);
			materials.push(batch.material);
		}
		this.mesh.material = materials;
	}

	// --- Animation ---

	findSequence(id) {
		const sequences = this.m2.sequences;
		let index = sequences.findIndex(s => s.id === id && s.variation === 0);
		if (index < 0) index = sequences.findIndex(s => s.id === id);
		// An alias plays another sequence's data.
		for (let guard = 0; index >= 0 && sequences[index].flags & 0x40 && guard < 8; guard++) index = sequences[index].aliasNext;
		return index;
	}

	hasAnimation(id) {
		return this.findSequence(id) >= 0;
	}

	async loadSequence(index) {
		if (this.animCache.has(index)) return this.animCache.get(index);
		const promise = (async () => {
			const { m2 } = this;
			const sequence = m2.sequences[index];
			let source = m2.md20;
			if (!(sequence.flags & 0x20)) {
				const file = m2.animFiles.find(a => a.id === sequence.id && a.variation === sequence.variation);
				if (file?.fileId) source = animData(await fetchFile(file.fileId));
			}
			const tracks = m2.bones.map(bone => ({
				translation: this.trackFor(bone.translation, index, source, 'vec'),
				rotation: this.trackFor(bone.rotation, index, source, 'quat'),
				scale: this.trackFor(bone.scale, index, source, 'vec'),
			}));
			return { index, duration: sequence.duration, tracks };
		})();
		this.animCache.set(index, promise);
		return promise;
	}

	trackFor(track, index, source, kind) {
		// A track on a global sequence loops on its own clock and keeps its data in the model.
		if (track.globalSequence >= 0) {
			const keys = readTrack(this.m2.md20, this.m2.md20, track, 0, kind);
			if (keys) keys.global = this.m2.globalSequences[track.globalSequence] || 0;
			return keys;
		}
		return readTrack(this.m2.md20, source, track, index, kind);
	}

	/** Plays animation `id` (looping), or holds its first frame. Returns its length in ms, or 0 if the model has none. */
	async play(id, { loop = true, onEnd = null, blend = 150 } = {}) {
		const index = this.findSequence(id);
		if (index < 0) return 0;
		const sequence = await this.loadSequence(index);
		// The pose being left fades out over `blend` ms instead of snapping.
		if (this.anim.sequence && blend > 0) this.previous = { anim: this.anim, elapsed: 0, duration: blend };
		else this.previous = null;
		this.anim = { index, time: 0, sequence, loop, onEnd };
		return sequence.duration;
	}

	update(deltaMs) {
		this.globalTime += deltaMs;
		if (this.previous) {
			this.previous.elapsed += deltaMs;
			const p = this.previous.anim;
			p.time = Math.min(p.time + deltaMs, (p.sequence.duration || 1) - 1);
			if (this.previous.elapsed >= this.previous.duration) this.previous = null;
		}
		const anim = this.anim;
		if (anim.sequence) {
			anim.time += deltaMs;
			const duration = anim.sequence.duration || 1;
			if (anim.time >= duration) {
				if (anim.loop) anim.time %= duration;
				else {
					anim.time = duration - 1;
					const done = anim.onEnd;
					anim.onEnd = null;
					done?.();
				}
			}
		}
		this.updateBones();
	}

	updateBones() {
		if (!this.hasBones) return;
		const { bones } = this.m2;
		const tracks = this.anim.sequence?.tracks;
		const t = this.anim.time;
		const prev = this.previous;
		const prevTracks = prev?.anim.sequence?.tracks;
		const weight = prev ? Math.min(prev.elapsed / prev.duration, 1) : 1;
		const p2 = new THREE.Vector3();
		const q2 = new THREE.Quaternion();
		const s2 = new THREE.Vector3();
		const local = new THREE.Matrix4();
		const pivot = new THREE.Matrix4();
		const unpivot = new THREE.Matrix4();
		const position = new THREE.Vector3();
		const quaternion = new THREE.Quaternion();
		const scale = new THREE.Vector3();

		for (let i = 0; i < bones.length; i++) {
			const bone = bones[i];
			const track = tracks?.[i];
			position.set(0, 0, 0);
			quaternion.set(0, 0, 0, 1);
			scale.set(1, 1, 1);
			if (track) {
				sample(track.translation, t, this.globalTime, position);
				sampleQuat(track.rotation, t, this.globalTime, quaternion);
				sample(track.scale, t, this.globalTime, scale);
			}
			if (prevTracks && weight < 1) {
				const pt = prevTracks[i];
				p2.set(0, 0, 0);
				q2.set(0, 0, 0, 1);
				s2.set(1, 1, 1);
				if (pt) {
					sample(pt.translation, prev.anim.time, this.globalTime, p2);
					sampleQuat(pt.rotation, prev.anim.time, this.globalTime, q2);
					sample(pt.scale, prev.anim.time, this.globalTime, s2);
				}
				position.lerpVectors(p2, position, weight);
				quaternion.copy(q2.slerp(quaternion, weight));
				scale.lerpVectors(s2, scale, weight);
			}
			pivot.makeTranslation(bone.pivot[0], bone.pivot[1], bone.pivot[2]);
			unpivot.makeTranslation(-bone.pivot[0], -bone.pivot[1], -bone.pivot[2]);
			local.compose(position, quaternion, scale);
			local.premultiply(pivot).multiply(unpivot);
			const out = this.boneMatrices[i];
			if (bone.parent >= 0 && bone.parent < i) out.multiplyMatrices(this.boneMatrices[bone.parent], local);
			else out.copy(local);
			this.mesh.skeleton.bones[i].matrixWorld.copy(out);
		}
		for (const [, slot] of this.attached) this.placeAttachment(slot);
	}

	// --- Attachments ---

	attachmentPoint(id) {
		const index = this.m2.attachmentIndexById[id];
		if (index === undefined || index === 0xffff) return this.m2.attachments.find(a => a.id === id) ?? null;
		return this.m2.attachments[index] ?? null;
	}

	/** Hangs `object` (in WoW's axes) on attachment point `id`; it then follows that bone. */
	attach(id, object, key = id) {
		this.detach(key);
		const point = this.attachmentPoint(id);
		if (!point) return false;
		const holder = new THREE.Group();
		holder.matrixAutoUpdate = false;
		holder.add(object);
		this.inner.add(holder);
		const slot = { point, holder };
		this.attached.set(key, slot);
		this.placeAttachment(slot);
		return true;
	}

	detach(key) {
		const slot = this.attached.get(key);
		if (!slot) return;
		this.inner.remove(slot.holder);
		this.attached.delete(key);
	}

	placeAttachment({ point, holder }) {
		const offset = new THREE.Matrix4().makeTranslation(point.position[0], point.position[1], point.position[2]);
		const bone = this.boneMatrices?.[point.bone];
		holder.matrix.copy(bone ? bone.clone().multiply(offset) : offset);
		holder.matrixWorldNeedsUpdate = true;
	}
}

function keyIndex(times, t) {
	// Last key at or before t.
	let lo = 0;
	let hi = times.length - 1;
	if (t <= times[0]) return 0;
	if (t >= times[hi]) return hi;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (times[mid] <= t) lo = mid;
		else hi = mid;
	}
	return lo;
}

function localTime(keys, t, globalTime) {
	if (keys.global !== undefined) return keys.global ? globalTime % keys.global : 0;
	return t;
}

function sample(keys, t, globalTime, out) {
	if (!keys) return;
	const time = localTime(keys, t, globalTime);
	const { times, values } = keys;
	const i = keyIndex(times, time);
	const j = Math.min(i + 1, times.length - 1);
	const span = times[j] - times[i];
	const f = keys.step || span <= 0 ? 0 : Math.min(Math.max((time - times[i]) / span, 0), 1);
	out.set(
		values[i * 3] + (values[j * 3] - values[i * 3]) * f,
		values[i * 3 + 1] + (values[j * 3 + 1] - values[i * 3 + 1]) * f,
		values[i * 3 + 2] + (values[j * 3 + 2] - values[i * 3 + 2]) * f,
	);
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
function sampleQuat(keys, t, globalTime, out) {
	if (!keys) return;
	const time = localTime(keys, t, globalTime);
	const { times, values } = keys;
	const i = keyIndex(times, time);
	const j = Math.min(i + 1, times.length - 1);
	const span = times[j] - times[i];
	const f = keys.step || span <= 0 ? 0 : Math.min(Math.max((time - times[i]) / span, 0), 1);
	qa.fromArray(values, i * 4);
	qb.fromArray(values, j * 4);
	out.slerpQuaternions(qa, qb, f).normalize();
}

/** A static model (an item on the turntable), upright and facing the camera. */
export async function loadModel(fdid, { replaceable = {} } = {}) {
	const model = await M2Model.load(fdid);
	for (const [type, texture] of Object.entries(replaceable)) if (texture) model.setReplaceable(Number(type), texture);
	await model.applyMaterials();
	return model;
}
