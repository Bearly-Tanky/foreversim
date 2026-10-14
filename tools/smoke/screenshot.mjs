// Screenshots a page of a locally served build, for checking layout changes by eye.
//
//   npx http-server dist -p 8080 &
//   node tools/smoke/screenshot.mjs http://localhost:8080/forever/warrior/dps/ out.png [width] [height] [waitMs] [fullPage 0|1] [actions]
//
// `actions` is an optional `;`-separated list run before the shot: `click:<css selector>`,
// `wait:<ms>`, `waitfor:<css selector>`, `type:<css selector>=<text>`.
import { chromium } from 'playwright';

const [url, out, width = '1440', height = '900', wait = '4000', full = '0', actions = ''] = process.argv.slice(2);
if (!url || !out) {
	console.error('usage: screenshot.mjs <url> <out.png> [width] [height] [waitMs] [fullPage] [actions]');
	process.exit(2);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => message.type() === 'error' && errors.push(`console: ${message.text()}`));

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(Number(wait));
for (const action of actions.split(';').filter(Boolean)) {
	const [kind, ...rest] = action.split(':');
	const arg = rest.join(':');
	if (kind === 'click') await page.click(arg);
	else if (kind === 'wait') await page.waitForTimeout(Number(arg));
	else if (kind === 'waitfor') await page.waitForSelector(arg, { timeout: 120000 });
	else if (kind === 'type') {
		const [selector, text] = arg.split('=');
		await page.fill(selector, text);
	}
}
await page.screenshot({ path: out, fullPage: full === '1' });
console.log(`saved ${out}${errors.length ? `\nerrors:\n${errors.slice(0, 10).join('\n')}` : ''}`);
await browser.close();
