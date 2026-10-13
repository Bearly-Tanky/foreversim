import i18n from '@i18n/config';
import type { UnitMetrics } from '@sim/proto/sim_result';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { noticeIconClass } from '@ui-kit/NoticeLevel';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildRotationModel } from '../../model/timeline/rotation';
import { chartSpec } from './chart/build';
import { TimelineChart } from './chart/TimelineChart';
import { ChartViewPicker } from './ChartViewPicker';
import { RotationView } from './rotation/RotationView';
import type { ChartView } from './utils';
import { resultKey } from './utils';

export interface TimelineProps {
	/** The timeline tab is open. While it is not, a finished run is held rather than drawn. */
	active: boolean;
}

const WARNING_ICON = noticeIconClass('warning');

export const Timeline = ({ active }: TimelineProps) => {
	const live = useSimResult();
	const [shown, setShown] = useState<ReturnType<typeof useSimResult>>(null);
	const [view, setView] = useState<ChartView>('rotation');
	// GCD spans are model rows and model items, not a CSS overlay: a row hidden with display still
	// owns its height in the windower's prefix sums. So the toggle rebuilds the model.
	const [showGcd, setShowGcd] = useState(false);

	// Two emits carrying the same run under the same filter draw the same timeline, so the result the
	// view holds only changes when its key does — which is what keeps a re-emit from rebuilding the model.
	useEffect(() => {
		if (!active || !live) return;
		setShown(prev => (resultKey(prev) === resultKey(live) ? prev : live));
	}, [active, live]);

	// A cleared result still emits, with an empty raid.
	const player = useMemo(() => (shown ? (shown.result.getRaidIndexedPlayers(shown.filter)[0] ?? null) : null), [shown]);
	const duration = shown ? shown.result.result.firstIterationDuration || 1 : 1;

	// The unit walk is inside the guard, not beside it: a result the model cannot be built from
	// leaves the rotation empty rather than taking the whole Results tab down with it.
	const model = useMemo(() => {
		if (!shown || !player) return null;
		try {
			return buildRotationModel({ player, targets: shown.result.getTargets(shown.filter), duration, showGcd });
		} catch (e) {
			console.log('Failed to update rotation chart: ', e);
			return null;
		}
	}, [shown, player, duration, showGcd]);

	// The rotation is the default view and the two are alternatives, so the chart's series are built
	// only once someone has asked for them — and then kept, so switching back and forth is free.
	const chartVisible = view === 'dps';
	const [armed, setArmed] = useState<{ player: UnitMetrics; duration: number } | null>(null);
	useEffect(() => {
		if (!player) setArmed(null);
		else if (chartVisible) setArmed(prev => (prev?.player === player && prev.duration === duration ? prev : { player, duration }));
	}, [chartVisible, player, duration]);

	const spec = useMemo(() => (armed ? chartSpec(armed.player, armed.duration) : null), [armed]);

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-wrap items-start gap-2">
				<div className="flex flex-col max-lg:shrink max-lg:grow max-lg:basis-full">
					<p>
						<i className={clsx(WARNING_ICON, 'fa-xl mr-2')} />
						{i18n.t('results_tab.details.timeline.disclaimer')}
					</p>
					<p>{i18n.t('results_tab.details.timeline.note')}</p>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-3 self-start">
					<BooleanPicker
						modObject={null}
						config={{
							id: 'timeline-show-gcd',
							label: i18n.t('results_tab.details.timeline.show_gcd'),
							layout: 'inline',
							extraClassNames: ['w-auto', 'whitespace-nowrap'],
							value: showGcd,
							onChange: setShowGcd,
						}}
					/>
					<ChartViewPicker value={view} onChange={setView} className="w-auto shrink-0" />
				</div>
			</div>
			<div className="grow">
				{chartVisible ? (
					<div data-testid="dps-resources-plot" className="h-128">
						<TimelineChart spec={spec} />
					</div>
				) : (
					<div data-testid="rotation-plot">
						<div className="m-auto">
							<RotationView model={model} active={active} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
