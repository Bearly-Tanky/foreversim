import i18n from '@i18n/config';
import { REPO_URL } from '@sim/constants/other';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useState } from 'react';

import { LandingLanguageMenu } from './LandingLanguageMenu';

const COLLAPSE_ID = 'homepageHeaderCollapse';

export const LandingHeader = () => {
	const [open, setOpen] = useState(false);
	const toggleLabel = i18n.t('landing.navigation.toggle');

	const toggler = (icon: 'bars' | 'times') => (
		<button
			className="border-0 px-3 py-1 text-lg leading-none text-white max-md:absolute max-md:top-0 max-md:right-0 md:hidden"
			type="button"
			aria-controls={COLLAPSE_ID}
			aria-expanded={open}
			aria-label={toggleLabel}
			data-testid="navbar-toggler"
			onClick={() => setOpen(current => !current)}>
			<Icon name={icon} size="2x" />
		</button>
	);

	return (
		<header>
			<div className="flex h-full w-full max-w-full px-3 pt-section max-md:pb-4 lg:mx-auto lg:max-w-landing-lg xl:max-w-modal-xl xxl:max-w-landing-xxl">
				<nav className="relative flex w-full flex-wrap items-end justify-between py-2 md:justify-start">
					<div className="order-0 flex max-md:w-full max-md:items-end max-md:justify-between">
						<a href="#" className="m-0 flex items-center p-0 text-lg whitespace-nowrap text-white">
							<img className="mr-4 w-24 max-md:w-12" src="/forever/assets/img/WoW-Simulator-Icon.png" alt="" />
							<div className="flex flex-col">
								<h2 className="m-0 text-fluid-5xl leading-none font-bold text-brand" data-testid="site-title">
									{i18n.t('landing.header.wowsims')}
								</h2>
								<h3 className="m-0 w-full text-expansion" data-testid="expansion-title">
									{i18n.t('landing.header.expansion')}
								</h3>
							</div>
						</a>
						{toggler('bars')}
					</div>
					<div
						id={COLLAPSE_ID}
						className={clsx(
							'order-2 grow basis-full items-end justify-end pt-4 pb-4 max-md:fixed max-md:inset-0 max-md:z-dropdown max-md:bg-black/90 max-md:p-4 md:order-1 md:flex md:basis-auto',
							!open && 'hidden',
						)}>
						<div className="flex flex-col max-md:relative max-md:items-start md:flex-row" data-testid="navbar-nav">
							{toggler('times')}
							<a
								href={REPO_URL}
								target="_blank"
								rel="noreferrer"
								className="ui-landing-nav-link flex items-center px-0 py-4 text-sm whitespace-nowrap md:px-2">
								<p className="m-0">
									<Icon name="github" style="brands" size="2x" />
									&nbsp;
								</p>
							</a>
							<LandingLanguageMenu />
						</div>
					</div>
				</nav>
			</div>
		</header>
	);
};
