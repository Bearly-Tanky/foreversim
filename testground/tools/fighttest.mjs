// Plays a whole timed practice fight like a simple player and screenshots the HUD and summary.
//   node testground/tools/fighttest.mjs <spec> <out-prefix> [length seconds] [health real|above|below]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec = 'warrior/dps', out = '/tmp/fight', length = '60', health = 'real'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) } });
page.on('pageerror', e => console.log('pageerror', String(e)));
page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404') && console.log(m.type(), m.text().slice(0, 300)));
await page.goto(`http://127.0.0.1:8090/forever/${spec}/`, { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.goto('http://127.0.0.1:8090/#mode=practice', { waitUntil: 'load' });
await page.waitForTimeout(20000);
await page.selectOption('#practice-length', length);
await page.selectOption('#practice-health', health);
await page.click('#practice-start');
await page.waitForFunction(() => tgPractice.live || /^Practice:/.test(document.getElementById('status').textContent), null, { timeout: 240000 });
console.log('status:', await page.textContent('#status'));
await page.mouse.click(700, 300);
await page.keyboard.press('t');
const errors = new Set();
const start = Date.now();
let shot = false;
// A simple player: press slots 1-6 in turn, about every 0.4 s.
for (let i = 0; Date.now() - start < (Number(length) + 4) * 1000; i++) {
	await page.keyboard.press(String((i % 6) + 1));
	await page.waitForTimeout(400);
	const err = await page.evaluate(() => (document.getElementById('practice-error')?.style.opacity === '1' ? document.getElementById('practice-error').textContent : ''));
	if (err) errors.add(err);
	if (!shot && Date.now() - start > 20000) {
		await page.screenshot({ path: `${out}-hud.png` });
		shot = true;
		// Pause check: the clock must hold while paused.
		await page.keyboard.press('Escape');
		const t1 = await page.evaluate(() => tgPractice.now());
		await page.waitForTimeout(1500);
		const t2 = await page.evaluate(() => tgPractice.now());
		console.log('paused clock moved', (t2 - t1).toFixed(3), 's; paused screen shown:', await page.evaluate(() => !document.getElementById('practice-paused').hidden));
		await page.keyboard.press('Escape');
	}
	if (await page.evaluate(() => !!document.querySelector('.summary table'))) break;
}
console.log('error messages seen:', [...errors].join(' | '));
await page.waitForSelector('.summary table', { timeout: 90000 });
console.log('summary:', (await page.textContent('.summary-dps')).replace(/\s+/g, ' '), '| tips:', (await page.textContent('.summary-tips').catch(() => '')).replace(/\s+/g, ' '));
await page.screenshot({ path: `${out}-summary.png` });
await browser.close();
