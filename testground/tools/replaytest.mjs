// End to end: open the sim (so it saves a character), then run and screenshot a fight replay.
//   node testground/tools/replaytest.mjs <spec> <out-prefix> [shots at seconds, comma separated]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec = 'warrior/dps', out = '/tmp/replay', at = '8,20'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.log('pageerror', String(e)));
page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && console.log(m.type(), m.text().slice(0, 300)));
await page.goto(`http://127.0.0.1:8090/forever/${spec}/`, { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.goto('http://127.0.0.1:8090/#mode=replay', { waitUntil: 'load' });
await page.waitForTimeout(25000);
await page.click('#replay-run');
const start = Date.now();
await page.waitForFunction(() => document.querySelector('#hud-dps') || /^Replay:/.test(document.getElementById('status').textContent), null, { timeout: 240000 });
console.log('ready after', Math.round((Date.now() - start) / 1000), 's:', await page.textContent('#status'));
let last = 0;
for (const [i, s] of at.split(',').map(Number).entries()) {
	await page.waitForTimeout((s - last) * 1000);
	last = s;
	await page.screenshot({ path: `${out}-${i}.png` });
	console.log('shot', i, await page.evaluate(() => document.getElementById('hud-clock')?.textContent));
}
await browser.close();
