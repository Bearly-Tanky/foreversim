import type { GameCharacter } from '@features/import-export/importers/game';
import { useEffect, useState } from 'react';

// The Forever Sim program (testground/) serves this site from the user's own computer and adds
// an API next to it: the testground, characters saved in the game, the addon that saves them.
// On the website none of it answers, and nothing that uses it shows.

let probe: Promise<boolean> | null = null;
const inDesktopApp = (): Promise<boolean> =>
	(probe ??= fetch('/api/info')
		.then(r => (r.ok ? r.json() : null))
		.then(info => info?.app === 'ForeverSim')
		.catch(() => false));

/** True when the page is served by the Forever Sim program. */
export const useInDesktopApp = (): boolean => {
	const [inApp, setInApp] = useState(false);
	useEffect(() => {
		let live = true;
		inDesktopApp().then(value => live && setInApp(value));
		return () => {
			live = false;
		};
	}, []);
	return inApp;
};

export interface AddonState {
	installed: boolean;
	version: string;
	installedVersion?: string;
}

export interface GameCharacters {
	characters: GameCharacter[];
	addon: AddonState;
}

const json = async <T>(response: Response): Promise<T> => {
	if (!response.ok) throw new Error((await response.text()).trim() || response.statusText);
	return response.json() as Promise<T>;
};

export const fetchGameCharacters = (): Promise<GameCharacters> => fetch('/api/game/characters').then(r => json<GameCharacters>(r));

export const installAddon = (): Promise<{ path: string; addon: AddonState }> => fetch('/api/game/addon', { method: 'POST' }).then(r => json(r));
