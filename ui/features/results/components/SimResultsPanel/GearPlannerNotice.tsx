import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';

// Takes the unlaunched notice's place for a spec that plans gear but never simulates. No pointer to
// an external healing sim: QE Live covers MoP only.
export const GearPlannerNotice = () => (
	<div className="mt-auto mr-auto mb-auto ml-auto flex max-w-100 flex-col items-center text-center" data-testid="sim-ui-gear-planner-container">
		<Icon name="screwdriver-wrench" size="3x" className="mb-2" />
		<h6>{i18n.t('sim.gear_planner.title')}</h6>
		<p>{i18n.t('sim.gear_planner.message')}</p>
	</div>
);
