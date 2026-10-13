import type { CastLog } from '@sim/proto/combat_log';

export interface GcdSegmentTooltipProps {
	log: CastLog;
}

export const GcdSegmentTooltip = ({ log }: GcdSegmentTooltipProps) => (
	<div className="ui-timeline-tooltip">
		<span>
			{log.actionId!.name} — {log.gcd.toFixed(2)}s GCD ({log.timestamp.toFixed(2)}s → {(log.timestamp + log.gcd).toFixed(2)}s)
		</span>
	</div>
);
