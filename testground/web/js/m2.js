// M2 (chunked MD21, version 264+) and its .skin files: just enough to draw a model in its
// rest pose. Positions are WoW's (Z up); the viewer turns them to Three's Y up.

const ascii = (buffer, offset, length = 4) => String.fromCharCode(...new Uint8Array(buffer, offset, length));

/** The file's chunks by name, each as [start, size] in the file. */
function chunks(buffer) {
	const view = new DataView(buffer);
	const out = {};
	for (let p = 0; p + 8 <= buffer.byteLength; ) {
		const name = ascii(buffer, p);
		const size = view.getUint32(p + 4, true);
		out[name] = [p + 8, size];
		p += 8 + size;
	}
	return out;
}

export function parseM2(buffer) {
	const found = chunks(buffer);
	if (!found.MD21) throw new Error('not a chunked M2');
	const [base, size] = found.MD21;
	const md20 = buffer.slice(base, base + size);
	const view = new DataView(md20);
	const u32 = o => view.getUint32(o, true);
	const array = o => ({ count: u32(o), offset: u32(o + 4) });
	const fileIds = name => {
		if (!found[name]) return [];
		const [start, length] = found[name];
		return Array.from(new Uint32Array(buffer.slice(start, start + length)));
	};

	const version = u32(4);
	const name = (() => {
		const a = array(8);
		return a.count ? ascii(md20, a.offset, a.count - 1) : '';
	})();

	const vertexArray = array(60);
	const vertices = {
		count: vertexArray.count,
		positions: new Float32Array(vertexArray.count * 3),
		normals: new Float32Array(vertexArray.count * 3),
		uvs: new Float32Array(vertexArray.count * 2),
		uvs2: new Float32Array(vertexArray.count * 2),
		boneWeights: new Uint8Array(vertexArray.count * 4),
		boneIndices: new Uint8Array(vertexArray.count * 4),
	};
	for (let i = 0; i < vertexArray.count; i++) {
		const o = vertexArray.offset + i * 48;
		for (let k = 0; k < 3; k++) {
			vertices.positions[i * 3 + k] = view.getFloat32(o + k * 4, true);
			vertices.normals[i * 3 + k] = view.getFloat32(o + 20 + k * 4, true);
		}
		for (let k = 0; k < 4; k++) {
			vertices.boneWeights[i * 4 + k] = view.getUint8(o + 12 + k);
			vertices.boneIndices[i * 4 + k] = view.getUint8(o + 16 + k);
		}
		vertices.uvs[i * 2] = view.getFloat32(o + 32, true);
		vertices.uvs[i * 2 + 1] = view.getFloat32(o + 36, true);
		vertices.uvs2[i * 2] = view.getFloat32(o + 40, true);
		vertices.uvs2[i * 2 + 1] = view.getFloat32(o + 44, true);
	}

	const textureArray = array(80);
	const textures = [];
	for (let i = 0; i < textureArray.count; i++) {
		const o = textureArray.offset + i * 16;
		textures.push({ type: u32(o), flags: u32(o + 4) });
	}

	const materialArray = array(112);
	const materials = [];
	for (let i = 0; i < materialArray.count; i++) {
		const o = materialArray.offset + i * 4;
		materials.push({ flags: view.getUint16(o, true), blend: view.getUint16(o + 2, true) });
	}

	const u16s = o => {
		const a = array(o);
		return Array.from({ length: a.count }, (_, i) => view.getUint16(a.offset + i * 2, true));
	};

	const attachmentArray = array(240);
	const attachments = [];
	for (let i = 0; i < attachmentArray.count; i++) {
		const o = attachmentArray.offset + i * 40;
		attachments.push({
			id: u32(o),
			bone: view.getUint16(o + 4, true),
			position: [view.getFloat32(o + 8, true), view.getFloat32(o + 12, true), view.getFloat32(o + 16, true)],
		});
	}

	// Animations: sequences (id, variation, length) and the per-bone tracks that move them.
	const sequenceArray = array(28);
	const sequences = [];
	for (let i = 0; i < sequenceArray.count; i++) {
		const o = sequenceArray.offset + i * 64;
		sequences.push({
			id: view.getUint16(o, true),
			variation: view.getUint16(o + 2, true),
			duration: u32(o + 4),
			flags: u32(o + 12),
			aliasNext: view.getUint16(o + 62, true),
		});
	}
	const globalArray = array(20);
	const globalSequences = Array.from({ length: globalArray.count }, (_, i) => u32(globalArray.offset + i * 4));

	const boneArray = array(44);
	const track = o => ({ interpolation: view.getUint16(o, true), globalSequence: view.getInt16(o + 2, true), timestamps: array(o + 4), values: array(o + 12) });
	const bones = [];
	for (let i = 0; i < boneArray.count; i++) {
		const o = boneArray.offset + i * 88;
		bones.push({
			keyBone: view.getInt32(o, true),
			flags: u32(o + 4),
			parent: view.getInt16(o + 8, true),
			translation: track(o + 16),
			rotation: track(o + 36),
			scale: track(o + 56),
			pivot: [view.getFloat32(o + 76, true), view.getFloat32(o + 80, true), view.getFloat32(o + 84, true)],
		});
	}

	const animFiles = [];
	if (found.AFID) {
		const [start, length] = found.AFID;
		const v = new DataView(buffer, start, length);
		for (let p = 0; p + 8 <= length; p += 8) animFiles.push({ id: v.getUint16(p, true), variation: v.getUint16(p + 2, true), fileId: v.getUint32(p + 4, true) });
	}

	return {
		md20,
		sequences,
		globalSequences,
		bones,
		animFiles,
		version,
		name,
		vertices,
		textures,
		materials,
		textureCombos: u16s(128),
		attachments,
		attachmentIndexById: u16s(248),
		boundingRadius: view.getFloat32(184, true),
		skinFileIds: fileIds('SFID'),
		textureFileIds: fileIds('TXID'),
		boneFileIds: fileIds('BFID'),
		skeletonFileId: fileIds('SKID')[0] ?? 0,
	};
}

export function parseSkin(buffer) {
	const view = new DataView(buffer);
	if (ascii(buffer, 0) !== 'SKIN') throw new Error('not a skin file');
	const u16 = o => view.getUint16(o, true);
	const array = o => ({ count: view.getUint32(o, true), offset: view.getUint32(o + 4, true) });

	const lookup = array(4);
	const vertexLookup = new Uint16Array(buffer.slice(lookup.offset, lookup.offset + lookup.count * 2));
	const tris = array(12);
	const triangles = new Uint16Array(buffer.slice(tris.offset, tris.offset + tris.count * 2));

	const sectionArray = array(28);
	const sections = [];
	for (let i = 0; i < sectionArray.count; i++) {
		const o = sectionArray.offset + i * 48;
		sections.push({
			id: u16(o),
			indexStart: u16(o + 8) + (u16(o + 2) << 16),
			indexCount: u16(o + 10),
		});
	}

	const batchArray = array(36);
	const batches = [];
	for (let i = 0; i < batchArray.count; i++) {
		const o = batchArray.offset + i * 24;
		batches.push({
			flags: view.getUint8(o),
			priority: view.getInt8(o + 1),
			shader: u16(o + 2),
			section: u16(o + 4),
			material: u16(o + 10),
			layer: u16(o + 12),
			textureCount: u16(o + 14),
			textureCombo: u16(o + 16),
		});
	}

	return { vertexLookup, triangles, sections, batches };
}

/** An .anim file's data: the AFM2 chunk when chunked, else the whole file. Track offsets point into it. */
export function animData(buffer) {
	if (ascii(buffer, 0) === 'AFM2') {
		const size = new DataView(buffer).getUint32(4, true);
		return buffer.slice(8, 8 + size);
	}
	const found = chunks(buffer);
	if (found.AFM2) return buffer.slice(found.AFM2[0], found.AFM2[0] + found.AFM2[1]);
	return buffer;
}

/**
 * One track's keys for one sequence: times (ms) and values. `source` is the buffer the
 * sequence's data lives in (the model's MD20, or its .anim file); `size` the components per
 * value (3 for vectors, 4 for compressed quaternions).
 */
export function readTrack(md20, source, track, index, kind) {
	const outer = new DataView(md20);
	if (index >= track.timestamps.count || index >= track.values.count) return null;
	const timesCount = outer.getUint32(track.timestamps.offset + index * 8, true);
	const timesOffset = outer.getUint32(track.timestamps.offset + index * 8 + 4, true);
	const valuesCount = outer.getUint32(track.values.offset + index * 8, true);
	const valuesOffset = outer.getUint32(track.values.offset + index * 8 + 4, true);
	if (!timesCount || !valuesCount) return null;
	const data = new DataView(source);
	if (timesOffset + timesCount * 4 > source.byteLength) return null;

	const times = new Uint32Array(timesCount);
	for (let i = 0; i < timesCount; i++) times[i] = data.getUint32(timesOffset + i * 4, true);

	// Bezier and hermite keys carry two tangents after each value; only the value is used.
	const spline = track.interpolation >= 2 ? 3 : 1;
	const n = Math.min(timesCount, valuesCount);
	if (kind === 'quat') {
		const out = new Float32Array(n * 4);
		const stride = 8 * spline;
		if (valuesOffset + n * stride > source.byteLength) return null;
		for (let i = 0; i < n; i++) {
			for (let k = 0; k < 4; k++) {
				const v = data.getInt16(valuesOffset + i * stride + k * 2, true);
				out[i * 4 + k] = (v < 0 ? v + 32768 : v - 32767) / 32767;
			}
		}
		return { times: times.subarray(0, n), values: out, step: track.interpolation === 0 };
	}
	const out = new Float32Array(n * 3);
	const stride = 12 * spline;
	if (valuesOffset + n * stride > source.byteLength) return null;
	for (let i = 0; i < n; i++) {
		for (let k = 0; k < 3; k++) out[i * 3 + k] = data.getFloat32(valuesOffset + i * stride + k * 4, true);
	}
	return { times: times.subarray(0, n), values: out, step: track.interpolation === 0 };
}
