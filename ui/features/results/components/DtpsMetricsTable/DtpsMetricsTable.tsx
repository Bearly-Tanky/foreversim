import i18n from '@i18n/config';
import { ActionMetrics } from '@sim/proto/sim_result';
import { Tooltip } from '@ui-kit/Tooltip';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, indexMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import {
	type AttackBreakdownOptions,
	attackFormat,
	attackMetricsColumns,
	castsTooltip,
	damageBreakdownTooltip,
	hitsTooltip,
	missTooltip,
	useMetricMax,
} from '../AttackMetricsColumns';
import { createMetricsColumnHelper, metricForAnchor, MetricsTable, MetricTooltip } from '../MetricsTable';

const helper = createMetricsColumnHelper<ActionMetrics>();

/** Crushing blows land on the player, so this is the one table whose breakdowns carry them. */
const TAKEN: AttackBreakdownOptions = { crush: true };

const NO_ROWS: Array<MetricRow<ActionMetrics>> = [];

const TOOLTIP = {
	damageTaken: 'dtps-metrics-damage-taken',
	casts: 'dtps-metrics-casts',
	avgCastHeader: 'dtps-metrics-avg-cast-header',
	hits: 'dtps-metrics-hits',
	missPercent: 'dtps-metrics-miss-percent',
	missPercentHeader: 'dtps-metrics-miss-percent-header',
};

const dtpsGroups = (resultData: SimResultData): Array<Array<ActionMetrics>> => {
	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	const player = players[0];
	const targetActions = resultData.result
		.getTargets(resultData.filter)
		.flatMap(target => target.getDamageActions().map(action => action.forTarget({ player: player.unitIndex })));

	// Self-inflicted damage (sappers, ...) is one of the player's own actions
	// that happens to list the player among its targets, so getTargets() never
	// reaches it even though it already counts towards DTPS. getTargetIndex()
	// resolves a player's action against filter.target, hence `target` here
	// rather than the `player` key the enemy actions above use.
	const selfDamageActions = player
		.getDamageActions()
		.filter(action => action.targets.some(target => target.data.unitIndex === player.unitIndex))
		.map(action => action.forTarget({ target: player.unitIndex }))
		.filter(action => action.damage > 0);

	return ActionMetrics.groupById([...targetActions, ...selfDamageActions]);
};

const grouping: MetricGrouping<ActionMetrics> = {
	merge: metrics => ActionMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0].unit?.petActionId || undefined }),
	shouldCollapse: () => true,
};

export const DtpsMetricsTable = () => {
	const resultData = useSimResult();

	const rows = useMemo(() => (resultData ? buildMetricRows(dtpsGroups(resultData), grouping) : NO_ROWS), [resultData]);
	const metricsByRowId = useMemo(() => indexMetricRows(rows), [rows]);
	const maxDamage = useMetricMax(rows, metric => metric.damage);

	const columns = useMemo(
		() =>
			helper.columns([
				attackMetricsColumns.name(),
				attackMetricsColumns.primary({
					id: 'damage-taken',
					header: i18n.t('results_tab.details.columns.damage_taken'),
					total: metric => metric.avgDamage,
					value: metric => metric.damage,
					percentage: metric => metric.totalDamageTakenPercent,
					max: maxDamage,
					tooltipId: TOOLTIP.damageTaken,
				}),
				attackMetricsColumns.casts({ tooltipId: TOOLTIP.casts }),
				attackMetricsColumns.withTicks({
					id: 'avg-cast',
					header: i18n.t('results_tab.details.columns.avg_cast'),
					value: metric => metric.avgCastHit,
					tick: metric => metric.avgCastTick,
					format: attackFormat.compact,
					zeroWhen: metric => metric.isPassiveAction,
					meta: { headerTooltipId: TOOLTIP.avgCastHeader, headerTooltip: i18n.t('results_tab.details.tooltips.damage_avg_cast_tooltip') },
				}),
				attackMetricsColumns.withTicks({
					id: 'hits',
					header: i18n.t('results_tab.details.columns.hits'),
					value: metric => metric.landedHits,
					tick: metric => metric.landedTicks,
					format: attackFormat.number,
					meta: { tooltipId: TOOLTIP.hits },
				}),
				attackMetricsColumns.withTicks({
					id: 'avg-hit',
					header: i18n.t('results_tab.details.columns.avg_hit'),
					value: metric => metric.avgHit,
					tick: metric => metric.avgTick,
					format: attackFormat.compact,
				}),
				helper.accessor(row => row.metric.totalMissesPercent, {
					id: 'miss-percent',
					header: i18n.t('results_tab.details.columns.miss_percent'),
					meta: {
						tooltipId: TOOLTIP.missPercent,
						headerTooltipId: TOOLTIP.missPercentHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.hit_miss_percent_tooltip'),
					},
					cell: info => attackFormat.percent(info.getValue()),
				}),
				attackMetricsColumns.withTicks({
					id: 'crit-percent',
					header: i18n.t('results_tab.details.columns.crit_percent'),
					value: metric => metric.critPercent + metric.blockedCritPercent,
					tick: metric => metric.critTickPercent,
					format: attackFormat.percent,
				}),
				attackMetricsColumns.rate({
					id: 'dtps',
					header: i18n.t('results_tab.details.columns.dtps'),
					value: metric => metric.dps,
				}),
			]),
		[maxDamage],
	);

	const forAnchor = metricForAnchor(metricsByRowId);

	return (
		<>
			<MetricsTable rootTestId="dtps-metrics-root" columns={columns} rows={rows} sortColumnId="dtps" hasResult={!!resultData} />
			<Tooltip id={TOOLTIP.avgCastHeader} />
			<Tooltip id={TOOLTIP.missPercentHeader} />
			<MetricTooltip id={TOOLTIP.damageTaken} forAnchor={forAnchor} body={metric => damageBreakdownTooltip(metric, TAKEN)} />
			<MetricTooltip id={TOOLTIP.casts} forAnchor={forAnchor} body={metric => castsTooltip(metric, TAKEN)} />
			<MetricTooltip id={TOOLTIP.hits} forAnchor={forAnchor} body={metric => hitsTooltip(metric, TAKEN)} />
			<MetricTooltip id={TOOLTIP.missPercent} forAnchor={forAnchor} body={missTooltip} />
		</>
	);
};
