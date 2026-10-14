// Screenshots the testground with a given saved state, for checking by eye.
//   node testground/tools/shot.mjs <url> <out.png> '<state json or "">' [waitMs] [js to run after load] [w] [h]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [url, out, state = '', wait = '20000', script = '', w = '1280', h = '800'] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', e => console.log('pageerror', String(e)));
page.on('console', m => (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('[tg]')) && console.log(m.type(), m.text()));
const origin = new URL(url).origin;
await page.goto(origin + '/api/info');
await page.evaluate(s => {
	localStorage.clear();
	if (s) localStorage.setItem('testground', s);
}, state);
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
if (script) {
	console.log('script:', JSON.stringify(await page.evaluate(script)));
	await page.waitForTimeout(3000);
}
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
