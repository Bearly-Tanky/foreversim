// Writes a redirect page at every URL the site had before the switch, into the Pages root
// that holds the built app at forever/: the live site under classic/ (master's page names)
// and the preview under next/ (already this app's page names). Pages has no server-side
// redirects, so each one is an index.html that replaces itself with the new URL, keeping
// the query and the hash: a share link is `<spec>/#<settings>` (?i= picks the categories),
// and the app reads master's link format itself (sim/state/classic_links.ts).
// Usage: node tools/old_url_redirects.mjs [pagesRoot=dist]
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'dist';
const app = path.join(root, 'forever');

// Master's page -> this app's page, both relative to the site base.
const CLASSIC = {
	'': '',
	warrior: 'warrior/dps/',
	tank_warrior: 'warrior/protection/',
	protection_paladin: 'paladin/protection/',
	retribution_paladin: 'paladin/retribution/',
	balance_druid: 'druid/balance/',
	feral_druid: 'druid/feralcat/',
	feral_tank_druid: 'druid/feralbear/',
	elemental_shaman: 'shaman/elemental/',
	enhancement_shaman: 'shaman/enhancement/',
	hunter: 'hunter/dps/',
	mage: 'mage/dps/',
	rogue: 'rogue/dps/',
	warlock: 'warlock/dps/',
	shadow_priest: 'priest/dps/',
	smite_priest: 'priest/smite/',
	arena: 'arena/',
	bis: 'bis/',
	changelog: 'changelog/',
	dps_rankings: 'dps_rankings/',
	evidence: 'evidence/',
	scrub: 'scrub/',
	stat_weights: 'stat_weights/',
	// No page of their own here: the raid sim (this app has none) and master's pop-out results
	// window (results open in the page). Both land on the sim list.
	raid: '',
	detailed_results: '',
};

// The BiS page picks its spec from the hash, and master spelled the specs differently.
const CLASSIC_BIS_HASHES = {
	'dps-warrior': 'warrior-dps',
	'tank-warrior': 'warrior-protection',
	'protection-paladin': 'paladin-protection',
	'retribution-paladin': 'paladin-retribution',
	'holy-paladin': 'paladin-holy',
	'balance-druid': 'druid-balance',
	'feral-dps-druid': 'druid-feralcat',
	'feral-tank-druid': 'druid-feralbear',
	'restoration-druid': 'druid-restoration',
	'elemental-shaman': 'shaman-elemental',
	'enhancement-shaman': 'shaman-enhancement',
	'restoration-shaman': 'shaman-restoration',
	hunter: 'hunter-dps',
	mage: 'mage-dps',
	rogue: 'rogue-dps',
	'dps-warlock': 'warlock-dps',
	'shadow-priest': 'priest-dps',
	'smite-priest': 'priest-smite',
	priest: 'priest-healer',
};

const stub = (from, to, hashes = {}) => {
	const dir = path.join(root, from);
	if (!fs.existsSync(path.join(app, to, 'index.html'))) throw new Error(`${from} -> ${to}: no such page in ${app}`);
	const target = path.relative(dir, path.join(app, to)).split(path.sep).join('/') + '/';
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, 'index.html'),
		`<!doctype html><html><head><meta charset="utf-8"><title>Moved - Forever Sim</title><meta name="robots" content="noindex">` +
			`<link rel="canonical" href="${target}"><script>var m = ${JSON.stringify(hashes)}, h = location.hash.slice(1);` +
			`location.replace('${target}' + location.search + (m[h] ? '#' + m[h] : location.hash));</script>` +
			`<noscript><meta http-equiv="refresh" content="0; url=${target}"></noscript></head>` +
			`<body><a href="${target}">This page moved. Continue.</a></body></html>\n`,
	);
	return 1;
};

let count = 0;
for (const [from, to] of Object.entries(CLASSIC)) count += stub(path.join('classic', from), to, from === 'bis' ? CLASSIC_BIS_HASHES : undefined);

// The preview used this app's own paths, so every page it had moves one-for-one.
const pages = dir =>
	fs
		.readdirSync(dir, { recursive: true })
		.filter(file => path.basename(file) === 'index.html')
		.map(file => path.dirname(file));
for (const page of pages(app)) count += stub(path.join('next', page === '.' ? '' : page), page === '.' ? '' : page);

console.log(`${count} redirect pages under ${root}/classic and ${root}/next`);
