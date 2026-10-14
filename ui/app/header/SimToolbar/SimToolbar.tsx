import i18n from '@i18n/config';
import type { ReactNode } from 'react';

import { switchViewMode } from '../../view_mode';
import { ToolbarItem } from './ToolbarItem';

export interface SimToolbarProps {
	knownIssues: ReadonlyArray<ReactNode>;
	onOpenSettings: () => void;
}

export const SimToolbar = ({ knownIssues, onOpenSettings }: SimToolbarProps) => {
	return (
		<>
			<ToolbarItem
				className="text-link-danger"
				testId="known-issues"
				hidden={knownIssues.length === 0}
				tooltip={
					<ul className="mb-0 pl-4 text-left">
						{knownIssues.map((issue, index) => (
							<li key={index}>{issue}</li>
						))}
					</ul>
				}>
				{i18n.t('info.known_issues')}
			</ToolbarItem>

			<ToolbarItem testId="simple-view" icon="arrow-left" tooltip="Back to the simple view" onClick={() => switchViewMode('simple')}>
				Simple view
			</ToolbarItem>

			<ToolbarItem testId="sim-options" icon="cog" tooltip={i18n.t('info.sim_options')} onClick={onOpenSettings} />
		</>
	);
};
