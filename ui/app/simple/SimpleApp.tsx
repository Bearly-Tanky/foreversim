import type { Spec } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { SpecDefinition } from '@sim/spec_config';
import { PortalContainerContext } from '@ui-kit/hooks/usePortalContainer';
import { ToastArea, toastManager } from '@ui-kit/Toast';
import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';

import { CrashReportDialog } from '../CrashReportDialog';
import { SimHostObject } from '../individual_sim_ui';
import { simUiAttributes, simUiClasses } from '../shell_classes';
import { CharacterCard } from './CharacterCard';
import { FightCard } from './FightCard';
import { MobileSimBar, ResultsCard } from './ResultsCard';
import { SimpleHeader } from './SimpleHeader';
import { StatValuesCard } from './StatValuesCard';

export interface SimpleAppProps<SpecType extends Spec> {
	player: Player<SpecType>;
	def: SpecDefinition<SpecType>;
}

// The simple view's page root. It builds the same host the advanced view does, so the saved
// character, the sim runs and the crash reports are shared; only the layout is its own.
export const SimpleApp = <SpecType extends Spec>({ player, def }: SimpleAppProps<SpecType>) => {
	const root = useRef<HTMLDivElement>(null);
	// The host renders the advanced view's tabs and sidebar actions into these; the simple view shows neither.
	const unusedSidebar = useRef<HTMLDivElement>(null);
	const unusedMain = useRef<HTMLDivElement>(null);
	const constructed = useRef(false);
	const [host, setHost] = useState<SimHostObject<SpecType> | null>(null);
	const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
	const spec = player.getPlayerSpec();

	useLayoutEffect(() => {
		if (constructed.current || !root.current || !unusedSidebar.current || !unusedMain.current) return;
		constructed.current = true;
		setHost(new SimHostObject({ root: root.current, sidebarActions: unusedSidebar.current, main: unusedMain.current }, player, def));
		setRootEl(root.current);
	}, [player, def]);

	return (
		<PortalContainerContext value={rootEl}>
			<SimHostProvider host={host}>
				<div ref={root} className={clsx(simUiClasses({ className: def.className, spec }), 'min-h-screen text-white')} {...simUiAttributes({ spec })}>
					<div className="fixed inset-0 -z-1 bg-sim bg-cover bg-center bg-no-repeat" />
					<div ref={unusedSidebar} hidden />
					<div ref={unusedMain} hidden />
					<SimpleHeader spec={spec} />
					{host && (
						<main className="mx-auto grid w-full max-w-7xl gap-5 px-4 pt-5 pb-32 lg:grid-cols-[minmax(0,1fr)_25rem] lg:pb-10">
							<div className="flex min-w-0 flex-col gap-5">
								<CharacterCard />
								<FightCard />
							</div>
							<div className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
								<ResultsCard />
								<StatValuesCard />
							</div>
						</main>
					)}
					{host && <MobileSimBar />}
					<ToastArea manager={toastManager} />
				</div>
				{host && <CrashReportDialog opener={host.crashReport} />}
			</SimHostProvider>
		</PortalContainerContext>
	);
};
