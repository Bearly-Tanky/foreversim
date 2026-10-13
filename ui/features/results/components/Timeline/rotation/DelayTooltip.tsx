import type { CastLog } from '@sim/proto/combat_log';

export interface DelayTooltipProps {
	log: CastLog;
}

export const DelayTooltip = ({ log }: DelayTooltipProps) => (
	<div className="ui-timeline-tooltip">
		<span>
			Auto delayed by {log.delayText}, was ready at {log.readyAtText}
		</span>
	</div>
);
