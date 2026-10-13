export const MANIFEST_KEYS = ['name', 'displayName', 'version', 'publisher', 'engines', 'main', 'activationEvents', 'contributes'];

export function generatedManifest(pkg) {
	const manifest = {};
	for (const key of MANIFEST_KEYS) {
		manifest[key] = pkg[key];
	}
	manifest['x-generated'] = 'make vscode-spelldata';
	return manifest;
}

export function manifestText(pkg) {
	return `${JSON.stringify(generatedManifest(pkg), null, '\t')}\n`;
}
