import { PlayerClasses } from '@sim/player/classes/index';

import { LANDING_CLASS_ORDER } from './landing_classes';
import { LandingClassMenu } from './LandingClassMenu';
import { LandingForever, LandingProductLinks } from './LandingForever';
import { LandingHeader } from './LandingHeader';

export const LandingPage = () => (
	<>
		<div className="fixed -z-1 h-full w-full bg-landing bg-cover bg-center bg-no-repeat opacity-30 max-md:bg-landing-sm" />
		<div id="homepage" className="flex h-full flex-col">
			<LandingHeader />
			<main>
				<div className="flex h-full w-full max-w-full flex-col px-3 pt-page pb-page max-md:mb-4 lg:mx-auto lg:max-w-landing-lg xl:max-w-modal-xl xxl:max-w-landing-xxl">
					<div className="mb-page flex flex-col max-md:mb-4">
						<LandingForever />
					</div>
					<div className="flex flex-col max-lg:-mx-4">
						<LandingProductLinks />
						<div className="flex flex-wrap" id="sim-links">
							{LANDING_CLASS_ORDER.map(classId => (
								<LandingClassMenu key={classId} playerClass={PlayerClasses.fromProto(classId)} />
							))}
						</div>
					</div>
				</div>
			</main>
		</div>
	</>
);
