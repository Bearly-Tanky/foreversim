import { TalentsPicker } from '@features/talents/components/TalentsPicker';
import { usePlayer, useSpecPresets } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { Player } from '@sim/player/player';
import { classTalentsConfig } from '@sim/talents/factory';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { useMemo } from 'react';

export interface TalentsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const TalentsDialog = ({ open, onOpenChange }: TalentsDialogProps) => {
	const player = usePlayer();
	const presets = useSpecPresets().talents;
	const talentsString = usePlayerStore('talentsString');

	const config = useMemo(
		() => ({
			trees: classTalentsConfig[player.getClass()]!,
			storeField: 'talentsString' as const,
			getValue: (subject: Player<any>) => subject.getTalentsString(),
			setValue: (subject: Player<any>, value: string) => subject.setTalentsString(value),
		}),
		[player],
	);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			size="lg"
			title="Talents"
			testId="simple-talents-dialog"
			footer={
				<Button onClick={() => onOpenChange(false)} data-testid="simple-talents-done">
					Done
				</Button>
			}>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm text-gray-300">Start from a build:</span>
					{presets.map(preset => (
						<Button
							key={preset.name}
							size="sm"
							variant={preset.data.talentsString === talentsString ? 'primary' : 'outline-light'}
							onClick={() => player.setTalentsString(preset.data.talentsString)}>
							{preset.name}
						</Button>
					))}
				</div>
				<p className="m-0 text-sm text-gray-300">Click a talent to add a point, right-click to remove one.</p>
				<TalentsPicker config={config} />
			</div>
		</Dialog>
	);
};
