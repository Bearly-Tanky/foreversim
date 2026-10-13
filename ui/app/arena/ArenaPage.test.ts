import { SimSettingCategories } from '@sim/constants/sim_settings';
import { PlayerSpecs } from '@sim/player/specs';
import { tryParseUrlLocation } from '@sim/state/sim_links';
import { describe, expect, it } from 'vitest';

import { bestPerTree, flags, sourceOf, talentLink, wowheadLink } from './ArenaPage';

describe('arena talent links', () => {
	it('open the spec page with only the talents', () => {
		const link = new URL(talentLink(PlayerSpecs.DpsWarrior, '30305001302-05050005525010051'), 'https://example.com');
		expect(link.pathname).toBe(PlayerSpecs.DpsWarrior.simLink);
		const parsed = tryParseUrlLocation(link);
		expect(parsed?.categories).toEqual([SimSettingCategories.Talents]);
		expect(parsed?.settings.player?.talentsString).toBe('30305001302-05050005525010051');
	});
});

describe('arena wowhead links', () => {
	it('carry the talents in our digit order under the class', () => {
		expect(wowheadLink(PlayerSpecs.DpsWarrior, '30305001302-05050005525010051')).toBe(
			'https://www.wowhead.com/forever/talent-calc/warrior/v230305001302-05050005525010051',
		);
	});
});

describe('arena row flags', () => {
	const rests = { assumed: 0, classic: 0, core: 1, forever: 0, measured: 0, unknown: 0 };
	const row = (over: object) => ({ build: 'Arms 31/20/0', rotation: 'default', rests, ...over }) as Parameters<typeof flags>[0];
	const labels = (over: object) => flags(row(over)).map(f => f.label);

	it('stay out of the way of an ordinary build', () => {
		expect(labels({})).toEqual([]);
	});
	it('mark MythicSim builds, low-rank rotations and a guessed share over 5%', () => {
		expect(labels({ build: 'MythicSim Fury 15/36/0', rotation: 'fire_lowrank', rests: { ...rests, core: 0.88, assumed: 0.12 } })).toEqual([
			'MythicSim',
			'low ranks, unconfirmed',
			'12% guessed',
		]);
		expect(labels({ rests: { ...rests, core: 0.97, unknown: 0.03 } })).toEqual([]);
	});
});

describe('arena default view', () => {
	it('keeps the best build in each tree of a spec', () => {
		const row = (talents: string, dps: number) => ({ spec: 'warrior', talents, dps }) as Parameters<typeof bestPerTree>[0][number];
		const shown = bestPerTree([row('34300003-550500005152310051', 715), row('3-550500005152310051', 700), row('55050103201-0505', 650)]);
		expect(shown.map(b => b.dps)).toEqual([715, 650]);
	});
});

describe('arena build source', () => {
	it('names the external sim a build came from, and nothing for our own', () => {
		expect(sourceOf({ build: 'MythicSim Fury 15/36/0' })).toBe('MythicSim');
		expect(sourceOf({ build: 'Arms 31/20/0' })).toBe('');
	});
});
