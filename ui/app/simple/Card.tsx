import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface CardProps {
	title: ReactNode;
	/** Beside the title, right-aligned. */
	actions?: ReactNode;
	className?: string;
	children: ReactNode;
	testId?: string;
}

export const Card = ({ title, actions, className, children, testId }: CardProps) => (
	<section className={clsx('rounded-xl border border-surface-border bg-panel p-5 shadow-lg backdrop-blur-sm', className)} data-testid={testId}>
		<header className="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 className="m-0 text-lg font-bold">{title}</h2>
			{actions}
		</header>
		{children}
	</section>
);

export interface FieldProps {
	label: ReactNode;
	hint?: ReactNode;
	children: ReactNode;
	className?: string;
}

/** A labelled row inside a card. */
export const Field = ({ label, hint, children, className }: FieldProps) => (
	<div className={clsx('flex flex-col gap-1.5', className)}>
		<div className="text-sm font-bold text-gray-300">{label}</div>
		{children}
		{hint && <div className="text-sm text-gray-300 opacity-75">{hint}</div>}
	</div>
);
