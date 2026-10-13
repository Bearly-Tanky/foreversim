import { applyDefaultRotation } from '@features/settings/model/apply_defaults';
import { Debuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { EquipmentSpec, Profession } from '@generated/proto/common';
import { Player } from '@sim/player/player';
import { PlayerSpecs } from '@sim/player/specs';
import { getTalentTreePoints } from '@sim/proto/utils';
import { MAX_PARTY_SIZE } from '@sim/raid/party';
import { MAX_NUM_PARTIES } from '@sim/raid/raid';
import type { Sim } from '@sim/sim';
import { batch } from '@sim/state/batch';

import type { LoadedSpec } from './spec_definitions';

// A raid of every build over a full encounter is not free. The run has to finish while someone
// is still looking at it, and at this count the noise on a single build is a few DPS - far under
// the gaps the ranking is showing. The picker raises it for anyone who wants the error smaller.
export const DEFAULT_ITERATIONS = 1000;

export type RankingBuild = LoadedSpec & { name: string; talentsString: string };

// The community builds are the talent presets named with their point split, the same ones the
// sim page's own talent dropdown lists.
const communityBuildRegex = /\d+\/\d+\/\d+$/;

// A raid slot is a build, not a spec. A spec's community builds differ from each other in exactly
// the thing Forever changed, its talents. Each build sits on its spec's defaults - gear, consumes,
// race, rotation - with the talents and the name swapped, so two builds of one spec differ by
// talents alone. A spec with no community build keeps its default talents, named with their point
// split like the others (or, when those are empty, its first talent preset), so nothing the sim can
// run drops out.
export const communityBuilds = (specs: Array<LoadedSpec>): Array<RankingBuild> =>
	specs.flatMap(({ key, def }) => {
		const builds = def.presets.talents
			.filter(talents => communityBuildRegex.test(talents.name))
			.map(talents => ({ key, def, name: talents.name, talentsString: talents.data.talentsString }));
		if (builds.length > 0) return builds;
		// Several specs ship empty default talents; their first talent preset is what the page's dropdown offers first.
		const talentsString = def.defaults.talents.talentsString || def.presets.talents[0]?.data.talentsString || '';
		const name = `${PlayerSpecs.fromProto(def.spec).friendlyName} ${getTalentTreePoints(talentsString).join('/')}`;
		return [{ key, def, name, talentsString }];
	});

// Every spec's own sim starts with the raid buffs and debuffs that spec assumes somebody else in
// the raid is providing. A ranking has to hand all of them the same set, so take the strongest of
// each: nobody goes without a buff their own sim would have had, and nobody gets one that no
// launched spec brings. Tristate, uptime and count fields keep the larger value.
export function strongestOf<T extends object>(buffs: Array<T>): T {
	const merged: Record<string, unknown> = {};
	buffs.forEach(buff =>
		Object.entries(buff).forEach(([field, value]) => {
			if (typeof value === 'boolean') merged[field] = !!merged[field] || value;
			else if (typeof value === 'number') merged[field] = Math.max((merged[field] as number) || 0, value);
		}),
	);
	return merged as T;
}

// The gear a build wears: its spec's own Launch preset (the best pre-raid gear in the launch pool,
// the set master's rankings used), otherwise the spec's default gear. A spec with a launch set per
// tree (mage: Frost / Fire / Arcane Launch) gives each build the one named for a word in its name.
export const gearFor = ({ def, name = '' }: LoadedSpec & { name?: string }): EquipmentSpec => {
	const launch = def.presets.gear.filter(preset => /launch/i.test(preset.name));
	const words = name.toLowerCase().split(/\s+/);
	const own = launch.find(preset => words.includes(preset.name.toLowerCase().split(/\s+/)[0]));
	return (own ?? launch.find(preset => /^launch$/i.test(preset.name)) ?? launch[0])?.gear ?? def.defaults.gear;
};

export type RaidSetup = { builds: Array<RankingBuild>; missingItemIds: Array<number> };

// Mirrors a spec sim's own defaults so a build's number here means what it would mean on its own
// page, then fills a slot per build, opening as many parties as the builds need. Needs the item
// database, so call it after sim.waitForInit().
export function buildRaid(sim: Sim, allBuilds: Array<RankingBuild>): RaidSetup {
	// ponytail: a raid holds 25; past that the extra builds are dropped. Run a second raid if the build list ever outgrows it.
	const builds = allBuilds.slice(0, MAX_NUM_PARTIES * MAX_PARTY_SIZE);
	const defs = [...new Set(builds.map(build => build.def))];
	const missing = new Set<number>();

	batch(() => {
		sim.encounter.applyDefaults();
		sim.applyDefaults(false, false);
		sim.setShowDamageMetrics(true);
		sim.setIterations(DEFAULT_ITERATIONS);
		sim.raid.setNumActiveParties(Math.ceil(builds.length / MAX_PARTY_SIZE));
		sim.raid.setBuffs(RaidBuffs.create(strongestOf(defs.map(def => def.defaults.raidBuffs))));
		sim.raid.setDebuffs(Debuffs.create(strongestOf(defs.map(def => def.defaults.debuffs))));
		const partyBuffs = PartyBuffs.create(strongestOf(defs.map(def => def.defaults.partyBuffs)));
		sim.raid.getParties().forEach(party => party.setBuffs(partyBuffs));

		const tanks = builds.map((build, index) => {
			const { def } = build;
			const player = new Player(PlayerSpecs.fromProto(def.spec), sim);
			if (def.enableHealing) player.enableHealing();
			player.applySharedDefaults();
			player.setRace(def.defaults.other?.race || player.getPlayerClass().races[0]);
			const gear = gearFor(build);
			gear.items.filter(item => item.id && !sim.db.getItemById(item.id)).forEach(item => missing.add(item.id));
			player.setGear(sim.db.lookupEquipmentSpec(gear));
			player.setConsumes(def.defaults.consumables);
			applyDefaultRotation(player, def);
			player.setTalentsString(build.talentsString);
			player.setSpecOptions(def.defaults.specOptions);
			// Innervates and power infusions are cast by somebody, and nobody in this raid is casting them at anyone.
			player.setBuffs({ ...def.defaults.individualBuffs, innervates: 0, powerInfusions: 0 });
			player.setProfession1(def.defaults.other?.profession1 || Profession.Engineering);
			player.setProfession2(def.defaults.other?.profession2 ?? Profession.Jewelcrafting);
			player.setDistanceFromTarget(def.defaults.other?.distanceFromTarget || 0);
			player.setChannelClipDelay(def.defaults.other?.channelClipDelay || 0);
			player.setName(build.name);
			sim.raid.setPlayer(index, player);
			return player.getPlayerSpec().isTankSpec ? player.makeUnitReference() : null;
		});
		sim.raid.setTanks(tanks.filter(tank => tank !== null).slice(0, 3));
	});

	return { builds, missingItemIds: [...missing] };
}
