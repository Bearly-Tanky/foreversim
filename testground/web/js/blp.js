// BLP2, WoW's texture format: palettized, DXT1/3/5 or plain BGRA. Decodes the largest mip
// level to RGBA bytes, rows from the top.

export function decodeBlp(buffer) {
	const view = new DataView(buffer);
	const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
	if (magic !== 'BLP2') throw new Error(`not a BLP2 texture (${magic})`);

	const encoding = view.getUint8(8);
	const alphaDepth = view.getUint8(9);
	const alphaType = view.getUint8(10);
	const width = view.getUint32(12, true);
	const height = view.getUint32(16, true);
	const offset = view.getUint32(20, true);
	const size = view.getUint32(20 + 64, true);
	const data = new Uint8Array(buffer, offset, size);
	const out = new Uint8Array(width * height * 4);

	if (encoding === 1) {
		const palette = new Uint8Array(buffer, 148, 1024);
		const pixels = width * height;
		for (let i = 0; i < pixels; i++) {
			const p = data[i] * 4;
			out[i * 4] = palette[p + 2];
			out[i * 4 + 1] = palette[p + 1];
			out[i * 4 + 2] = palette[p];
			out[i * 4 + 3] = paletteAlpha(data, pixels, i, alphaDepth);
		}
	} else if (encoding === 2) {
		const format = alphaType === 7 ? 'dxt5' : alphaDepth > 1 ? 'dxt3' : 'dxt1';
		decodeDxt(data, width, height, format, out);
	} else if (encoding === 3) {
		for (let i = 0; i < width * height; i++) {
			out[i * 4] = data[i * 4 + 2];
			out[i * 4 + 1] = data[i * 4 + 1];
			out[i * 4 + 2] = data[i * 4];
			out[i * 4 + 3] = data[i * 4 + 3];
		}
	} else {
		throw new Error(`unknown BLP encoding ${encoding}`);
	}
	return { width, height, rgba: out, hasAlpha: alphaDepth > 0 };
}

function paletteAlpha(data, pixels, i, depth) {
	if (depth === 0) return 255;
	if (depth === 8) return data[pixels + i];
	if (depth === 1) return (data[pixels + (i >> 3)] >> (i & 7)) & 1 ? 255 : 0;
	if (depth === 4) return ((data[pixels + (i >> 1)] >> ((i & 1) * 4)) & 0xf) * 17;
	return 255;
}

function rgb565(c) {
	return [(((c >> 11) & 31) * 255) / 31, (((c >> 5) & 63) * 255) / 63, ((c & 31) * 255) / 31];
}

function decodeDxt(data, width, height, format, out) {
	const blockBytes = format === 'dxt1' ? 8 : 16;
	const blocksWide = Math.max(1, (width + 3) >> 2);
	const blocksHigh = Math.max(1, (height + 3) >> 2);
	const colors = new Uint8Array(16);
	const alphas = new Uint8Array(16);

	for (let by = 0; by < blocksHigh; by++) {
		for (let bx = 0; bx < blocksWide; bx++) {
			let p = (by * blocksWide + bx) * blockBytes;
			if (p + blockBytes > data.length) return;

			alphas.fill(255);
			if (format === 'dxt3') {
				for (let i = 0; i < 8; i++) {
					alphas[i * 2] = (data[p + i] & 0xf) * 17;
					alphas[i * 2 + 1] = (data[p + i] >> 4) * 17;
				}
				p += 8;
			} else if (format === 'dxt5') {
				const a0 = data[p];
				const a1 = data[p + 1];
				const table = [a0, a1];
				if (a0 > a1) for (let i = 1; i < 7; i++) table.push(((7 - i) * a0 + i * a1) / 7);
				else {
					for (let i = 1; i < 5; i++) table.push(((5 - i) * a0 + i * a1) / 5);
					table.push(0, 255);
				}
				let bits = 0;
				for (let i = 0; i < 6; i++) bits += data[p + 2 + i] * 2 ** (8 * i);
				for (let i = 0; i < 16; i++) {
					alphas[i] = table[Math.floor(bits / 2 ** (3 * i)) & 7];
				}
				p += 8;
			}

			const c0 = data[p] | (data[p + 1] << 8);
			const c1 = data[p + 2] | (data[p + 3] << 8);
			const a = rgb565(c0);
			const b = rgb565(c1);
			const palette = [a, b];
			if (c0 > c1 || format !== 'dxt1') {
				palette.push(a.map((v, i) => (2 * v + b[i]) / 3), a.map((v, i) => (v + 2 * b[i]) / 3));
			} else {
				palette.push(
					a.map((v, i) => (v + b[i]) / 2),
					[0, 0, 0],
				);
			}
			const transparentBlack = format === 'dxt1' && c0 <= c1;
			for (let i = 0; i < 4; i++) {
				const row = data[p + 4 + i];
				for (let j = 0; j < 4; j++) colors[i * 4 + j] = (row >> (j * 2)) & 3;
			}

			for (let y = 0; y < 4; y++) {
				const py = by * 4 + y;
				if (py >= height) continue;
				for (let x = 0; x < 4; x++) {
					const px = bx * 4 + x;
					if (px >= width) continue;
					const k = y * 4 + x;
					const c = palette[colors[k]];
					const o = (py * width + px) * 4;
					out[o] = c[0];
					out[o + 1] = c[1];
					out[o + 2] = c[2];
					out[o + 3] = transparentBlack && colors[k] === 3 ? 0 : alphas[k];
				}
			}
		}
	}
}
