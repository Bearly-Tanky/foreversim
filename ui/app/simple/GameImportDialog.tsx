import { finishIndividualImport } from '@features/import-export/importers/finish_individual_import';
import { type GameCharacter, gameClass, gameEquipment, gameProfessions, gameRace, gameTalents } from '@features/import-export/importers/game';
import type { Class } from '@generated/proto/common';
import { translatePlayerClass } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { PlayerClasses } from '@sim/player/classes/index';
import { raceNames } from '@sim/proto/names';
import { textClassNameForClass } from '@sim/proto/utils';
import { classTalentsConfig } from '@sim/talents/factory';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { toastManager } from '@ui-kit/Toast';
import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';

import { type AddonState, fetchGameCharacters, installAddon } from '../desktop_app';

const ago = (seconds: number): string => {
	const minutes = Math.round((Date.now() / 1000 - seconds) / 60);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 48) return `${hours} h ago`;
	return `${Math.round(hours / 24)} days ago`;
};

const AddonSteps = ({ addon, onInstalled }: { addon: AddonState; onInstalled: (addon: AddonState) => void }) => {
	const [busy, setBusy] = useState(false);
	const outdated = addon.installed && addon.installedVersion !== addon.version;
	const install = async () => {
		setBusy(true);
		try {
			const result = await installAddon();
			onInstalled(result.addon);
			toastManager.add({ variant: 'success', body: `The Forever Sim addon is installed in ${result.path}.` });
		} catch (error) {
			toastManager.add({ variant: 'error', body: String((error as Error).message ?? error) });
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-surface-border bg-black/30 p-3 text-sm" data-testid="game-import-steps">
			<p className="m-0">Your character comes from the game through a small addon, Forever Sim, that saves your gear and talents.</p>
			<ol className="m-0 flex flex-col gap-1 ps-5">
				<li>
					{addon.installed && !outdated ? (
						<span>The addon is installed{addon.installedVersion ? ` (version ${addon.installedVersion})` : ''}.</span>
					) : (
						<Button size="sm" onClick={install} disabled={busy} data-testid="game-import-install">
							{outdated ? 'Update the addon' : 'Install the addon'}
						</Button>
					)}
				</li>
				<li>Log in to your character, or type /reload if you are already in the game (the game saves the addon's data then).</li>
				<li>Come back here and press Refresh.</li>
			</ol>
		</div>
	);
};

const CharacterRow = ({ character, playerClass, onImport }: { character: GameCharacter; playerClass: Class; onImport: () => void }) => {
	const charClass = gameClass(character);
	const classInfo = PlayerClasses.fromProto(charClass);
	const items = Object.keys(character.gear ?? {}).length;
	const points = (character.talents ?? []).reduce((sum, t) => sum + t.ranks, 0);
	const otherClass = charClass !== playerClass;
	return (
		<li className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border p-3" data-testid="game-import-character">
			<div className="flex min-w-0 flex-1 flex-col">
				<span className={clsx('font-bold', classInfo && textClassNameForClass(classInfo))}>
					{character.name} <span className="font-normal text-gray-300">· {character.realm}</span>
				</span>
				<span className="text-sm text-gray-300">
					Level {character.level} {raceNames.get(gameRace(character)) ?? ''} {classInfo ? translatePlayerClass(classInfo) : ''} · {items} items ·{' '}
					{points} talent points · saved {ago(character.saved)}
				</span>
			</div>
			{otherClass ? (
				<span className="text-sm text-gray-300">Open the {classInfo ? translatePlayerClass(classInfo) : 'right'} sim to import this character.</span>
			) : (
				<Button size="sm" onClick={onImport} data-testid="game-import-load">
					Import
				</Button>
			)}
		</li>
	);
};

export interface GameImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const GameImportDialog = ({ open, onOpenChange }: GameImportDialogProps) => {
	const host = useSimHost();
	const [characters, setCharacters] = useState<GameCharacter[] | null>(null);
	const [addon, setAddon] = useState<AddonState | null>(null);
	const [problem, setProblem] = useState('');

	const refresh = useCallback(async () => {
		setProblem('');
		try {
			const result = await fetchGameCharacters();
			setCharacters(result.characters);
			setAddon(result.addon);
		} catch (error) {
			setProblem(String((error as Error).message ?? error));
		}
	}, []);

	useEffect(() => {
		if (open) refresh();
	}, [open, refresh]);

	const importCharacter = async (character: GameCharacter) => {
		const charClass = gameClass(character);
		try {
			await finishIndividualImport(host, {
				charClass,
				race: gameRace(character),
				equipmentSpec: gameEquipment(character),
				talentsStr: '',
				professions: gameProfessions(character),
			});
			if (character.talents?.length) {
				const { talentsString, unknown } = gameTalents(character, classTalentsConfig[charClass]);
				host.player.setTalentsString(talentsString);
				if (unknown > 0) {
					toastManager.add({
						variant: 'warning',
						body: `${unknown} talent point${unknown === 1 ? ' is' : 's are'} in talents the sim does not know yet; check the Talents.`,
						delay: 8000,
					});
				}
			}
			onOpenChange(false);
		} catch (error) {
			toastManager.add({ variant: 'error', body: String((error as Error).message ?? error) });
		}
	};

	const playerClass = host.player.getClass();
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			size="lg"
			title="Import from the game"
			testId="game-import-dialog"
			footer={
				<div className="flex gap-2">
					<Button variant="outline-light" onClick={refresh} data-testid="game-import-refresh">
						Refresh
					</Button>
					<Button onClick={() => onOpenChange(false)}>Close</Button>
				</div>
			}>
			<div className="flex flex-col gap-4">
				{problem && <p className="m-0 text-red-400">{problem}</p>}
				{addon && (!addon.installed || addon.installedVersion !== addon.version || !characters?.length) && (
					<AddonSteps addon={addon} onInstalled={setAddon} />
				)}
				{characters === null && !problem && <p className="m-0 text-gray-300">Looking for your characters…</p>}
				{!!characters?.length && (
					<ul className="m-0 flex list-none flex-col gap-2 p-0">
						{characters.map(character => (
							<CharacterRow
								key={`${character.account}/${character.name}-${character.realm}`}
								character={character}
								playerClass={playerClass}
								onImport={() => importCharacter(character)}
							/>
						))}
					</ul>
				)}
			</div>
		</Dialog>
	);
};
