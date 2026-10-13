import type { TalentArrow } from '../../model/tree_graph';

export interface TalentReqArrowProps {
	arrow: TalentArrow;
	fulfilled: boolean;
}

const HAS_VERTICAL_LEG: ReadonlySet<TalentArrow['dir']> = new Set(['rightdown', 'leftdown']);

export const TalentReqArrow = ({ arrow, fulfilled }: TalentReqArrowProps) => (
	<div
		className="ui-talent-req-arrow"
		data-testid="talent-req-arrow"
		data-req-dir={arrow.dir}
		data-req-active={fulfilled ? 'true' : undefined}
		data-req-arrow-row-size={arrow.rowSize === undefined ? undefined : String(arrow.rowSize)}
		data-req-arrow-col-size={arrow.colSize === undefined ? undefined : String(arrow.colSize)}
		style={{
			gridRow: `${arrow.gridRow} / ${arrow.gridRowEnd}`,
			gridColumn: `${arrow.gridColumn} / ${arrow.gridColumnEnd}`,
			zIndex: arrow.zIndex,
		}}>
		{HAS_VERTICAL_LEG.has(arrow.dir) && <div />}
	</div>
);
