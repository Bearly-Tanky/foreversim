import { Class } from '@generated/proto/common';
import { translatePlayerClass, translatePlayerSpec } from '@i18n/localization';
import { PlayerClasses } from '@sim/player/classes/index';
import type { PlayerSpec } from '@sim/player/player_spec';
import { textClassNameForClass } from '@sim/proto/utils';
import clsx from 'clsx';

const ROLE = (spec: PlayerSpec<any>) => (spec.isTankSpec ? 'Tank' : spec.isHealingSpec ? 'Healer' : 'Damage');

// "DPS" and "Healer" already say their role, so they get no role tag.
const SAYS_ROLE = new Set(['DPS', 'Healer', 'Tank']);

// Priest's class icon is a spell icon; the class crest reads better on a card.
const classIcon = (classId: Class) =>
	classId === Class.ClassPriest ? 'https://wow.zamimg.com/images/wow/icons/large/class_priest.jpg' : PlayerClasses.fromProto(classId).getIcon('large');

/** One card per class, one button per spec: two clicks from the home page to a sim. */
export const LandingClassGrid = () => (
	<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-class-grid">
		{PlayerClasses.naturalOrder.map(playerClass => {
			const specs = Object.values(playerClass.specs) as Array<PlayerSpec<any>>;
			return (
				<section key={playerClass.classID} className="flex items-center gap-4 rounded-xl border border-surface-border bg-panel p-4 backdrop-blur-sm">
					<img src={classIcon(playerClass.classID)} alt="" className="size-14 shrink-0 rounded-lg border border-surface-border" />
					<div className="flex min-w-0 flex-col gap-2">
						<h2 className={clsx('m-0 text-lg font-bold', textClassNameForClass(playerClass))}>{translatePlayerClass(playerClass)}</h2>
						<div className="flex flex-wrap gap-1.5">
							{specs.map(spec => (
								<a
									key={spec.specID}
									href={spec.simLink}
									className="rounded-md border border-surface-border bg-black/40 px-2.5 py-1 text-sm text-white no-underline hover:border-gray-600 hover:bg-surface-hover"
									data-testid="landing-spec-link">
									{translatePlayerSpec(spec) || ROLE(spec)}
									{translatePlayerSpec(spec) && !SAYS_ROLE.has(translatePlayerSpec(spec)) && (
										<span className="ml-1.5 text-xs text-gray-300">{ROLE(spec)}</span>
									)}
								</a>
							))}
						</div>
					</div>
				</section>
			);
		})}
	</div>
);
