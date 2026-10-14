import { translatePlayerClass, translatePlayerSpec } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerSpec } from '@sim/player/player_spec';
import { PlayerSpecs } from '@sim/player/specs/index';
import { textClassNameForClass, textClassNameForSpec } from '@sim/proto/utils';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Popover } from '@ui-kit/Popover';
import clsx from 'clsx';

import { SITE_BASE } from '../ProductPage/site';
import { switchViewMode } from '../view_mode';

const ROLE_LABEL = (spec: PlayerSpec<any>) => (spec.isTankSpec ? 'Tank' : spec.isHealingSpec ? 'Healer' : 'Damage');

/** "Warrior · DPS", or just "Hunter" for a class with one spec. */
export const specTitle = (spec: PlayerSpec<any>): string => {
	const className = translatePlayerClass(PlayerSpecs.getPlayerClass(spec));
	const specName = translatePlayerSpec(spec);
	return specName ? `${className} · ${specName}` : className;
};

const SpecSwitcher = ({ current }: { current: PlayerSpec<any> }) => (
	<Popover
		trigger={
			<span className="flex items-center gap-2">
				<img src={current.getIcon('medium')} alt="" className="size-7 rounded-md" />
				<span className={clsx('font-bold', textClassNameForSpec(current))}>{specTitle(current)}</span>
				<Icon name="chevron-down" className="text-sm text-gray-300" />
			</span>
		}
		triggerClassName="flex items-center rounded-lg border border-surface-border bg-black/40 px-3 py-1.5 hover:bg-surface-hover"
		triggerTestId="simple-spec-switcher"
		triggerProps={{ 'aria-label': 'Change class or spec' }}
		side="bottom"
		align="start"
		className="w-160 max-w-(--available-width) p-3">
		<div className="grid gap-1 sm:grid-cols-2">
			{PlayerClasses.naturalOrder.map(playerClass => (
				<div key={playerClass.classID} className="flex items-center gap-2 rounded-lg p-2">
					<img src={playerClass.getIcon('medium')} alt="" className="size-7 rounded-md" />
					<span className={clsx('w-20 shrink-0 font-bold', textClassNameForClass(playerClass))}>{translatePlayerClass(playerClass)}</span>
					<div className="flex flex-wrap gap-1">
						{Object.values(playerClass.specs).map((spec: PlayerSpec<any>) => (
							<a
								key={spec.specID}
								href={spec.simLink}
								data-active={spec.specID === current.specID ? '' : undefined}
								className="rounded-md border border-surface-border px-2 py-0.5 text-sm text-white no-underline hover:bg-surface-hover data-active:border-primary data-active:bg-primary data-active:text-primary-foreground">
								{translatePlayerSpec(spec) || ROLE_LABEL(spec)}
							</a>
						))}
					</div>
				</div>
			))}
		</div>
	</Popover>
);

export const SimpleHeader = ({ spec }: { spec: PlayerSpec<any> }) => (
	<header className="sticky top-0 z-header border-b border-surface-border bg-background/90 backdrop-blur-sm">
		<div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
			<a href={SITE_BASE} className="flex shrink-0 items-center gap-2 text-white no-underline" aria-label="Forever Sim home">
				<img src={`${SITE_BASE}assets/img/WoW-Simulator-Icon.png`} alt="" className="size-8" />
				<span className="text-lg font-bold max-sm:hidden">Forever Sim</span>
			</a>
			<SpecSwitcher current={spec} />
			<div className="ml-auto">
				<Button variant="outline-light" size="sm" onClick={() => switchViewMode('advanced')}>
					<Icon name="screwdriver-wrench" className="mr-1.5" />
					Advanced view
				</Button>
			</div>
		</div>
	</header>
);
