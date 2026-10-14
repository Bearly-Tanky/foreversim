// Saves the request the sim page runs for a spec, for testing the server by hand.
//   node testground/tools/capture.mjs warrior/dps testground/cache/warrior.req
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8090/#mode=items');
const b64 = await page.evaluate(async spec => {
	const { captureSimRequest } = await import('/js/replay.js');
	const bytes = await captureSimRequest(spec, () => {});
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}, spec);
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('saved', out, Buffer.from(b64, 'base64').length, 'bytes');
await browser.close();
