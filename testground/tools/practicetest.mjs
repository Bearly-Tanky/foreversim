// End to end: open the sim, start practice, press keys like a player, screenshot.
//   node testground/tools/practicetest.mjs <spec> <out-prefix> [keys, e.g. "1,1,2,1,3"] [seconds between presses]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec = 'warrior/dps', out = '/tmp/practice', keys = '1,2,1,3,1,2,1', gap = '1.6'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) } });
page.on('pageerror', e => console.log('pageerror', String(e)));
page.on('console', m => (m.type() === 'error' || m.type() === 'warning') && !m.text().includes('404') && console.log(m.type(), m.text().slice(0, 300)));
await page.goto(`http://127.0.0.1:8090/forever/${spec}/`, { waitUntil: 'load' });
await page.waitForTimeout(12000);
await page.goto('http://127.0.0.1:8090/#mode=practice', { waitUntil: 'load' });
await page.waitForTimeout(25000);
await page.click('#practice-start');
await page.waitForFunction(() => tgPractice.live || /^Practice:/.test(document.getElementById('status').textContent), null, { timeout: 240000 });
console.log('status:', await page.textContent('#status'));
console.log('bar:', await page.evaluate(() => tgPractice.bar.slice(0, 12).map(k => tgPractice.abilities.find(a => a.key === k)?.info.name ?? '-').join(' | ')));
await page.mouse.click(700, 300);
let i = 0;
for (const key of keys.split(',')) {
	await page.keyboard.press(key === '-' ? 'Minus' : key);
	await page.waitForTimeout(Number(gap) * 1000);
	const errText = await page.evaluate(() => document.getElementById('practice-error')?.style.opacity === '1' ? document.getElementById('practice-error').textContent : '');
	console.log(`pressed ${key}:`, await page.evaluate(() => `t=${tgPractice.state.time.toFixed(1)} ${JSON.stringify(Object.fromEntries(Object.entries(tgPractice.state.resources).map(([k, v]) => [k, Math.round(v[0])])))} dps=${document.getElementById('hud-dps').textContent}`), errText);
	if (i++ === Number(process.env.SHOT_AT ?? 3)) await page.screenshot({ path: `${out}-0.png` });
}
await page.screenshot({ path: `${out}-1.png` });
console.log('scroll:', await page.evaluate(() => [document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth].join(',')), 'bar bottom:', await page.evaluate(() => Math.round(document.querySelector('#practice-bar').getBoundingClientRect().bottom)), 'of', await page.evaluate(() => innerHeight));
await browser.close();
