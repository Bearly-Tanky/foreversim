import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MANIFEST_KEYS, generatedManifest, manifestText } from '../scripts/manifest.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the manifest is the same text on every build', () => {
	assert.equal(manifestText(pkg), manifestText(structuredClone(pkg)));
	assert.equal(manifestText({ ...pkg, scripts: { other: 'x' }, devDependencies: {} }), manifestText(pkg));
});

test('the manifest carries only what VS Code reads, and says it is generated', () => {
	const manifest = generatedManifest(pkg);
	assert.deepEqual(Object.keys(manifest), [...MANIFEST_KEYS, 'x-generated']);
	assert.equal(manifest['x-generated'], 'make vscode-spelldata');
	assert.deepEqual(Object.keys(manifest.contributes), ['configuration']);
	assert.equal(manifest.main, './out/extension.js');
	assert.ok(manifest.contributes.configuration.properties['wowsims-spelldata.trace']);
});
