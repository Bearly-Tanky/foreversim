// Loads every page of a built site in a headless browser and fails on the first uncaught
// error, or on a page that mounted nothing. Run against a local copy of dist, with the repo's
// assets served under it the way the makefile copies them in (dist/forever/assets):
//
//   python3 -m http.server 8080 --directory dist &
//   SITE_URL=http://localhost:8080/forever/ node tools/smoke/check_pages.mjs
//
// tsc and the unit tests both pass on a build whose pages throw at load, which has happened
// before, so this is the check that actually opens them.
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

import { chromium } from 'playwright';

const siteUrl = process.env.SITE_URL || 'http://localhost:8080/forever/';
const distDir = process.env.DIST_DIR || 'dist/forever';

// Every directory under dist/forever with an index.html is a page: the landing page, the
// product pages and the <class>/<spec> spec pages. assets/ and bundle/ hold no pages.
const pages = [];
const walk = dir => {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (!statSync(path).isDirectory()) continue;
		if (dir === distDir && (name === 'assets' || name === 'bundle')) continue;
		try {
			if (statSync(join(path, 'index.html')).isFile()) pages.push(relative(distDir, path).split(sep).join('/') + '/');
		} catch {
			// no index.html here; its children may still have one
		}
		walk(path);
	}
};
pages.push('');
walk(distDir);

// CHROMIUM_PATH points at a browser already on the machine, for running this outside CI.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let failures = 0;
for (const page of pages) {
	const tab = await browser.newPage();
	const errors = [];
	tab.on('pageerror', error => errors.push(error.message));
	// Third party icon and tooltip hosts are not what is under test and are slow.
	await tab.route(/zamimg|wowhead|googletagmanager|cloudflare/, route => route.abort());
	let text = '';
	try {
		await tab.goto(siteUrl + page, { waitUntil: 'domcontentloaded' });
		await tab.waitForTimeout(3000);
		text = (
			await tab
				.locator('#root')
				.innerText()
				.catch(() => '')
		).trim();
	} catch (error) {
		errors.push(error.message);
	}
	await tab.close();
	if (!errors.length && !text) errors.push('#root rendered no text');
	if (errors.length) {
		failures++;
		console.log(`FAIL ${page || '(landing)'}\n  ${errors.join('\n  ')}`);
	} else {
		console.log(`ok   ${page || '(landing)'}  ${text.split('\n')[0].slice(0, 70)}`);
	}
}
await browser.close();
if (failures) {
	console.log(`${failures} of ${pages.length} pages threw on load or rendered nothing`);
	process.exit(1);
}
console.log(`${pages.length} pages loaded clean`);
