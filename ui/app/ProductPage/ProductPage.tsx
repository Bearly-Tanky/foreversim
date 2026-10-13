import type { ReactNode } from 'react';

import { SITE_BASE } from './site';

// The chrome every Forever product page shares (changelog, evidence, scrub, arena, rankings,
// BiS, stat weights): the logo back to the landing page, a title and a one-paragraph subtitle.
export const ProductPage = ({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) => (
	<div className="flex min-h-full flex-col">
		<header className="border-b border-surface-border bg-black/30">
			<div className="flex w-full flex-wrap items-center gap-4 px-3 py-4 lg:mx-auto lg:max-w-landing-lg xl:max-w-modal-xl xxl:max-w-landing-xxl">
				<a href={SITE_BASE} className="block">
					<img className="h-auto w-56 max-w-full" src={`${SITE_BASE}assets/img/forever_logo.png`} alt="World of Warcraft: Forever" />
				</a>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<h1 className="m-0 text-2xl">{title}</h1>
					{subtitle && <p className="m-0 max-w-[70ch] opacity-75">{subtitle}</p>}
				</div>
			</div>
		</header>
		<main className="flex w-full flex-col gap-8 px-3 py-6 lg:mx-auto lg:max-w-landing-lg xl:max-w-modal-xl xxl:max-w-landing-xxl">{children}</main>
	</div>
);

// A titled block of a product page, the React form of the old ContentBlock.
export const PageSection = ({ title, id, children }: { title: ReactNode; id?: string; children: ReactNode }) => (
	<section id={id} className="flex flex-col gap-3 border border-surface-border bg-black/30 p-4">
		<h2 className="m-0 text-xl">{title}</h2>
		<div className="flex max-w-[80ch] flex-col gap-3">{children}</div>
	</section>
);
