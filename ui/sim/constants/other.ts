import { ProtoVersion } from '@generated/proto/common';
import { readMessageOption } from '@protobuf-ts/runtime';

// Forever's content tiers (as master): it launches 4 November 2026 with no raids, Tier 1
// (Barrow Deeps, Hyjal Summit, Onyxia) opens 9 December 2026, Tiers 2 and 3 follow in 2027.
// Labels live in common.phases / common.phase_names.
export enum Phase {
	Launch = 1,
	Tier1,
	Tier2,
	Tier3,
}

export const CURRENT_PHASE = Phase.Launch;

export enum LaunchStatus {
	Unlaunched,
	// Gear, gems, enchants, talents and the gem optimizer work. No simulation, and none planned.
	GearPlanner,
	Alpha,
	Beta,
	Launched,
}

export const CURRENT_API_VERSION: number = readMessageOption(ProtoVersion, 'proto.current_version_number')! as number;

// The upstream buff rewrite: RaidBuffs, PartyBuffs, IndividualBuffs and Debuffs moved to buffs.proto
// (renumbered, mostly bools), ConsumesSpec was renumbered and WarriorOptions field 6 changed meaning.
// Settings saved before it carry none of those in a usable form.
export const BUFFS_REWRITE_API_VERSION = 17;

// Upstream's slimmed buff manifest: RaidBuffs, PartyBuffs, IndividualBuffs and Debuffs renumbered
// again. Consumables and class options kept their numbers.
export const BUFFS_RENUMBER_API_VERSION = 18;

// Github pages serves our site under the /forever directory
export const REPO_NAME = 'forever';
export const REPO_URL = 'https://github.com/ElliotWood/Forever';
export const REPO_RELEASES_URL = `${REPO_URL}/releases`;
export const REPO_NEW_ISSUE_URL = `${REPO_URL}/issues/new`;
export const REPO_CHOOSE_NEW_ISSUE_URL = `${REPO_NEW_ISSUE_URL}/choose`;

export const SOCIALS = [{ key: 'github', href: REPO_URL, className: 'ui-social-link', icon: 'github', tooltip: 'info.github' }] as const;

export type Social = (typeof SOCIALS)[number];

// Root-relative path of the individual sim page for the given spec. Resolve it
// against the page origin at the point of use (see SimTitleDropdown) — this
// layer has no `window`. Lives here rather than in proto/utils so that
// player/specs/<class>.ts (which calls it at module scope) does not import the
// proto <-> player/specs cycle; the evaluation order of that cycle decides
// whether PlayerSpecs' lookup table is populated.
export function getSpecSitePath(classString: string, specString: string): string {
	return `/forever/${classString}/${specString}/`;
}

export const LOCAL_STORAGE_PREFIX = '__forever';

export enum SortDirection {
	ASC,
	DESC,
}
