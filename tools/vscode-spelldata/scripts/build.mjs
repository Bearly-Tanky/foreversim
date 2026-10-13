import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

import { manifestText } from './manifest.mjs';

const source = dirname(dirname(fileURLToPath(import.meta.url)));
const installed = join(source, '..', '..', '.vscode', 'extensions', 'wowsims-spelldata');
const outputs = ['package.json', 'README.md', join('out', 'extension.js')];

async function buildInto(target) {
	const tsc = spawnSync(join(source, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', source], { stdio: 'inherit' });
	if (tsc.status !== 0) {
		process.exit(tsc.status ?? 1);
	}

	rmSync(target, { recursive: true, force: true });
	mkdirSync(join(target, 'out'), { recursive: true });
	await build({
		absWorkingDir: source,
		entryPoints: ['src/extension.ts'],
		outfile: join(target, 'out', 'extension.js'),
		bundle: true,
		platform: 'node',
		format: 'cjs',
		target: 'node20',
		external: ['vscode'],
		minify: true,
		logLevel: 'warning',
	});
	writeFileSync(join(target, 'package.json'), manifestText(JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))));
	copyFileSync(join(source, 'README.md'), join(target, 'README.md'));
}

function filesUnder(dir) {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter(entry => entry.isFile())
		.map(entry => relative(dir, join(entry.parentPath, entry.name)));
}

if (process.argv.includes('--check')) {
	const fresh = mkdtempSync(join(tmpdir(), 'wowsims-spelldata-'));
	try {
		await buildInto(fresh);
		const stale = outputs.filter(file => {
			const committed = join(installed, file);
			return !existsSync(committed) || !readFileSync(committed).equals(readFileSync(join(fresh, file)));
		});
		const extra = existsSync(installed) ? filesUnder(installed).filter(file => !outputs.includes(file)) : [];
		if (stale.length > 0 || extra.length > 0) {
			const where = relative(process.cwd(), installed);
			for (const file of stale) {
				console.error(`${join(where, file)} is not what the build writes`);
			}
			for (const file of extra) {
				console.error(`${join(where, file)} is not a build output`);
			}
			console.error('run `make vscode-spelldata` and commit the result');
			process.exit(1);
		}
		console.log(`${relative(process.cwd(), installed)} matches a fresh build`);
	} finally {
		rmSync(fresh, { recursive: true, force: true });
	}
} else {
	await buildInto(installed);
	console.log(`built ${relative(process.cwd(), installed)}`);
}
