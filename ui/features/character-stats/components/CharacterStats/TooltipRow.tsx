import clsx from 'clsx';

export interface TooltipRowProps {
	label: string;
	value: string;
	className?: string;
}

export const TooltipRow = ({ label, value, className }: TooltipRowProps) => (
	<div data-testid="character-stats-tooltip-row" className={clsx('flex justify-between', className)}>
		<span className="mr-2">{label}</span>
		<span>{value}</span>
	</div>
);
