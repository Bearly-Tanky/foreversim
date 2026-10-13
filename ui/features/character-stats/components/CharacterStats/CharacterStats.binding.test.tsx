// What CharacterStats re-renders on. The probe mirrors the subscription set in CharacterStats.tsx,
// one assertion per store write.
//
// TBC's sheet reads more than the player: the debuffs stage comes from raid.debuffs, the weapon-stone
// offsets from the party's windfury totem, and the melee crit cap from the primary target's level. The
// MoP component subscribes to player fields only, so copying its "no longer re-renders on raid" case
// here would pin the bug rather than the behaviour.
import { SimHostProvider } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { createSimStore, patchKeyed, patchSlice, PLAYER_FIELDS, type PlayerSlice, seedKeyed, type SimStore, zeroVersions } from '@sim/state/sim_store';
import { act, render } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it } from 'vitest';
import { useStore } from 'zustand';

const KEY = 4;

const stats = (health: number) => ({ finalStats: { stats: [health] } }) as never;

const setup = () => {
	const store = createSimStore();
	seedKeyed(store, 'players', KEY, {
		name: 'P',
		race: 1,
		gear: { id: 'gear' },
		bonusStats: { id: 'bonus' },
		consumables: { id: 'consumes' },
		talentsString: '',
		inFrontOfTarget: false,
		currentStats: stats(1),
		v: zeroVersions(PLAYER_FIELDS),
	} as unknown as PlayerSlice);
	patchSlice(store, 'raid', { composition: [[KEY, null, null, null, null], [], [], [], []] });
	return { store, sim: { store }, player: { sim: { store }, storeKey: KEY } };
};

const mount = () => {
	const { store, player } = setup();
	const counts = { renders: 0, derives: 0 };

	const Probe = () => {
		const currentStats = usePlayerStore('currentStats');
		const bonusStats = usePlayerStore('bonusStats');
		const gear = usePlayerStore('gear');
		const race = usePlayerStore('race');
		const consumables = usePlayerStore('consumables');
		const talentsString = usePlayerStore('talentsString');
		const inFrontOfTarget = usePlayerStore('inFrontOfTarget');
		const debuffs = useStore(store, s => s.raid.debuffs);
		const partyBuffs = useStore(store, s => s.raid.partyBuffs);
		const targets = useStore(store, s => s.encounter.targets);
		const snapshot = useMemo(() => {
			counts.derives++;
			return { currentStats, bonusStats, gear, race, consumables, talentsString, inFrontOfTarget, debuffs, partyBuffs, targets };
		}, [currentStats, bonusStats, gear, race, consumables, talentsString, inFrontOfTarget, debuffs, partyBuffs, targets]);
		counts.renders++;
		return <span>{String(!!snapshot)}</span>;
	};

	const view = render(<SimHostProvider host={{ player } as never}>{<Probe />}</SimHostProvider>);

	return {
		unmount: () => view.unmount(),
		step: (write: (store: SimStore) => void) => {
			const before = { ...counts };
			act(() => write(store));
			return { renders: counts.renders - before.renders, derives: counts.derives - before.derives };
		},
	};
};

describe('what CharacterStats re-renders on', () => {
	it('re-renders for every player field the snapshot reads through the facades', () => {
		const h = mount();
		const once = { renders: 1, derives: 1 };

		expect(h.step(s => patchKeyed(s, 'players', KEY, { currentStats: stats(2) }, ['currentStats']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { bonusStats: { id: 'bonus2' } as never }, ['bonusStats']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { gear: { id: 'gear2' } as never }, ['gear']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { race: 2 }, ['race']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { consumables: { id: 'c2' } as never }, ['consumables']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { talentsString: 'x' }, ['talentsString']))).toEqual(once);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { inFrontOfTarget: true }, ['inFrontOfTarget']))).toEqual(once);

		h.unmount();
	});

	// The TBC-only half of the read set. Raid debuffs feed the debuffs attribution stage, the miss
	// breakdown and the crit-cap crit; party buffs decide whether a weapon stone applied; the target's
	// level sets the crit cap itself.
	it('re-renders on the raid and encounter state the facade getters reach', () => {
		const h = mount();
		const once = { renders: 1, derives: 1 };

		expect(h.step(s => patchSlice(s, 'raid', { debuffs: { faerieFire: true } as never }))).toEqual(once);
		expect(h.step(s => patchSlice(s, 'raid', { partyBuffs: [{ windfuryTotem: true }] as never }))).toEqual(once);
		expect(h.step(s => patchSlice(s, 'encounter', { targets: [{ level: 73 }] as never }))).toEqual(once);

		h.unmount();
	});

	it('stays idle for state nothing in the sheet reads', () => {
		const h = mount();
		const never = { renders: 0, derives: 0 };

		expect(h.step(s => patchSlice(s, 'sim', { iterations: 5000 }))).toEqual(never);
		expect(h.step(s => patchSlice(s, 'ui', { showEPValues: true }))).toEqual(never);
		expect(h.step(s => patchSlice(s, 'encounter', { duration: 42 }))).toEqual(never);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { name: 'Other' }, ['name']))).toEqual(never);
		expect(h.step(s => patchKeyed(s, 'players', KEY, { reactionTime: 250 }, ['reactionTime']))).toEqual(never);

		h.unmount();
	});
});
