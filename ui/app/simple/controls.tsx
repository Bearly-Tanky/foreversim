import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SelectOption<T extends string | number> {
	value: T;
	label: string;
}

export interface SelectProps<T extends string | number> {
	value: T;
	options: ReadonlyArray<SelectOption<T>>;
	onChange: (value: T) => void;
	label: string;
	className?: string;
	testId?: string;
}

/** A native select: keyboard, screen readers and phones all handle it without help. */
export const Select = <T extends string | number>({ value, options, onChange, label, className, testId }: SelectProps<T>) => (
	<select
		aria-label={label}
		value={String(value)}
		data-testid={testId}
		onChange={event => {
			const chosen = options.find(option => String(option.value) === event.target.value);
			if (chosen) onChange(chosen.value);
		}}
		className={clsx(
			'h-10 w-full cursor-pointer rounded-lg border border-surface-border bg-black/40 px-3 text-white hover:border-gray-600 focus:border-primary focus:outline-none',
			className,
		)}>
		{options.map(option => (
			<option key={String(option.value)} value={String(option.value)} className="bg-background">
				{option.label}
			</option>
		))}
	</select>
);

export interface SegmentedOption<T> {
	value: T;
	label: ReactNode;
}

export interface SegmentedProps<T> {
	value: T | null;
	options: ReadonlyArray<SegmentedOption<T>>;
	onChange: (value: T) => void;
	label: string;
	testId?: string;
}

/** A row of mutually exclusive buttons. `null` selects none, for a value set some other way. */
export const Segmented = <T,>({ value, options, onChange, label, testId }: SegmentedProps<T>) => (
	<div
		role="radiogroup"
		aria-label={label}
		className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-surface-border bg-black/40 p-1"
		data-testid={testId}>
		{options.map((option, index) => {
			const selected = option.value === value;
			return (
				<button
					key={index}
					type="button"
					role="radio"
					aria-checked={selected}
					data-active={selected ? '' : undefined}
					onClick={() => onChange(option.value)}
					className="rounded-md px-3 py-1.5 text-sm font-bold text-gray-300 hover:bg-surface-hover hover:text-white data-active:bg-primary data-active:text-primary-foreground">
					{option.label}
				</button>
			);
		})}
	</div>
);
