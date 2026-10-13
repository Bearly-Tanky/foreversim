import { PlayerSpecs } from '@sim/player/specs';
import { registerSpecConfig, type SpecDefinition } from '@sim/spec_config';

const modules = import.meta.glob<{ default: SpecDefinition<any> }>('../../specs/*/*/spec.{ts,tsx}');

// A spec's definition and the folder it lives in ('warrior/dps'), which is also its page path.
export type LoadedSpec = { key: string; def: SpecDefinition<any> };

// Loads and registers every spec definition, in spec order. Registering is what lets
// `new Player()` find a spec's config, the same step ui/app/spec_entry.tsx takes for one spec.
export async function loadSpecDefinitions(): Promise<Array<LoadedSpec>> {
	const loaded = await Promise.all(
		Object.entries(modules).map(async ([path, load]) => ({
			key: path.replace(/^.*specs\/(.*)\/spec\.tsx?$/, '$1'),
			def: (await load()).default,
		})),
	);
	loaded.forEach(({ def }) => registerSpecConfig(def.spec, def));
	return loaded.sort((a, b) => a.def.spec - b.def.spec);
}

export const specLaunch = (def: SpecDefinition<any>) => PlayerSpecs.fromProto(def.spec).launch.status;
