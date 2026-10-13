import { type Composition, type Tier, TIER_LABELS, TIER_ORDER, unsettledShare } from '@sim/spells/rests';
import { formatToPercent } from '@sim/utils/format';
import clsx from 'clsx';

// The evidence tiers' colours, shared with the evidence page's chips: gold means read the note,
// green means somebody watched it happen, and an unclassified id is drawn as a gap.
export const TIER_BG: Record<Tier, string> = {
	measured: 'bg-evidence-measured',
	forever: 'bg-evidence-forever',
	classic: 'bg-evidence-classic',
	core: 'bg-evidence-core',
	assumed: 'bg-evidence-assumed',
	unknown: 'bg-white/18',
};

/**
 * A stacked bar of where a build's damage came from, with the one number worth reading next to
 * it. Shared by the live rankings page and the precomputed arena so the two cannot start saying
 * the same thing differently. Titled rather than tooltipped: these are tables of hundreds of rows.
 */
export const RestsCell = ({ rests }: { rests: Composition }) => {
	const unsettled = unsettledShare(rests);
	const breakdown = TIER_ORDER.filter(tier => rests[tier] > 0)
		.map(tier => `${formatToPercent(rests[tier] * 100, { maximumFractionDigits: 1 })} ${TIER_LABELS[tier]}`)
		.join('\n');

	return (
		<div className="flex items-center gap-2 whitespace-nowrap" title={`Of this build's damage:\n${breakdown}`} data-testid="rests">
			<div className="flex h-3 w-24 overflow-hidden rounded-xs bg-white/5">
				{TIER_ORDER.map(tier => (
					<div key={tier} className={TIER_BG[tier]} style={{ width: `${rests[tier] * 100}%` }} />
				))}
			</div>
			<span className={clsx('w-[5ch] shrink-0 text-right', unsettled >= 0.05 ? 'font-semibold text-evidence-assumed' : 'text-gray-300')}>
				{formatToPercent(unsettled * 100, { maximumFractionDigits: 1 })}
			</span>
		</div>
	);
};
