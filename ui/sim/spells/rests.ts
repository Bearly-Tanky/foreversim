// How much of a build's damage rests on something nobody has settled.
//
// A ranking table invites one question it cannot normally answer: is this spec actually
// ahead, or does it merely have more of its damage in abilities that were guessed? Two
// builds a hundred DPS apart mean nothing if the leader's rotation runs through three
// unconfirmed numbers and the runner-up's does not.
//
// The evidence manifest classifies every ability the sim registers - and it covers the
// talents, the raid buffs, the debuffs and the item procs as well as the spells, because all
// of them are registered the same way. So taking each action a build actually performed,
// weighting it by its share of that build's damage, and looking up where its numbers came
// from gives an honest composition of the result rather than a verdict on it.
//
// Deliberately a composition and not a score. Collapsing four tiers into one number would
// need weights - is "read from the client" worth 0.9 of "seen in game"? - and there is no
// defensible answer, only an invented one. On a site whose whole claim is being plain about
// what is known, an invented number in the confidence column would be the worst possible
// place to put one.

export type Tier = 'measured' | 'forever' | 'classic' | 'core' | 'assumed' | 'unknown';

export const TIER_ORDER: Array<Tier> = ['measured', 'forever', 'classic', 'core', 'assumed', 'unknown'];

export const TIER_LABELS: Record<Tier, string> = {
	measured: 'seen in game',
	forever: 'read from the client',
	classic: 'unchanged from Classic',
	core: 'weapon swings, not an ability',
	assumed: 'still a guess',
	unknown: 'an ability the manifest has not classified',
};

/** Share of damage per tier, summing to 1. */
export type Composition = Record<Tier, number>;

export const EMPTY: Composition = { measured: 0, forever: 0, classic: 0, core: 0, assumed: 0, unknown: 0 };

/** The headline: everything neither settled from data, seen happen, nor plain weapon damage. */
export const unsettledShare = (c: Composition) => c.assumed + c.unknown;
