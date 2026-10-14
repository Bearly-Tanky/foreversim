// Opens the sim from the testground's origin and prints the settings it saves.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { chromium } = createRequire(path.join(repo, 'package.json'))('playwright');
const [spec = 'warrior/dps', out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.error('pageerror', String(e)));
await page.goto(`http://127.0.0.1:8090/forever/${spec}/`, { waitUntil: 'load' });
await page.waitForTimeout(15000);
const saved = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
console.error(Object.keys(saved).map(k => `${k} ${saved[k].length}`).join('\n'));
const key = Object.keys(saved).find(k => k.endsWith('__currentSettings__'));
if (key && out) (await import('node:fs')).writeFileSync(out, saved[key]);
await browser.close();
