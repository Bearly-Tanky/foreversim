import { Icon, type IconName } from '@ui-kit/Icon';
import { SimLinkContent } from '@ui-kit/SimLinkContent';
import type { ReactNode } from 'react';

import { SITE_BASE, SITE_REPO_URL } from '../ProductPage/site';

// What the Forever landing page says above the class menus: what this sim is, who it owes, how
// to help, and the links to its product pages. Hand-written English, as it was before the port.

const PRODUCT_LINKS: Array<{ href: string; title: string; status: string }> = [
	{ href: 'bis/', title: 'Best in Slot', status: 'Launch - Alpha' },
	{ href: 'stat_weights/', title: 'Stat Weights', status: 'Launch - Alpha' },
	{ href: 'changelog/', title: 'What changed for Forever', status: 'Changelog and sources' },
	{ href: 'evidence/', title: 'Where every number came from', status: '996 abilities, one reason each' },
];

const CTA = 'inline-flex items-center gap-2 rounded-sm border border-brand px-4 py-2 font-bold no-underline';
const CTA_LOUD = `${CTA} bg-brand text-black hover:bg-brand/80`;
const CTA_QUIET = `${CTA} text-brand hover:bg-brand/20`;

const Cta = ({ href, icon, quiet, children }: { href: string; icon: IconName; quiet?: boolean; children: ReactNode }) => (
	<a className={quiet ? CTA_QUIET : CTA_LOUD} href={`${SITE_BASE}${href}`}>
		<Icon name={icon} />
		<span>{children}</span>
	</a>
);

const Panel = ({ summary, children }: { summary: string; children: ReactNode }) => (
	<details className="border border-surface-border bg-black/50 px-4 py-3">
		<summary className="cursor-pointer text-lg font-bold">{summary}</summary>
		<div className="flex flex-col gap-3 pt-3">{children}</div>
	</details>
);

export const LandingForever = () => (
	<div className="flex w-3/4 flex-col gap-4 max-lg:w-full" data-testid="landing-forever">
		<p id="description" className="m-0 text-fluid-xl">
			An unofficial, personal sim for World of Warcraft®: Forever, the Classic+ relaunch announced at BlizzCon 2026. It carries Forever&apos;s talent
			trees, races and ruleset through every spec.
		</p>
		<p className="m-0 opacity-80">
			<strong>Unaffiliated with any official or community sim project.</strong> One person writes it, every bug here is mine, and every number is
			provisional &mdash; useful for catching the sim doing something obviously wrong, not as a statement about Forever.
		</p>
		<div className="flex flex-col gap-3 border border-brand bg-black/50 p-4" data-testid="wowsims-acknowledgement">
			<p className="m-0">
				<strong>Out of respect for WoWSims and the work they do, I have temporarily removed some features from this site</strong> &mdash; the build
				arena and the damage comparison. From the WoWSims Forever team:
			</p>
			<blockquote className="m-0 border-l-4 border-brand pl-4 italic opacity-90">
				&ldquo;We have decided to temporarily private the WoWSims Forever GitHub repo due to a number of AI-assisted tools publishing misleading results
				and tier lists using incomplete/unfinished sims. We believe that WoWSims should be a tool used to help inform the playerbase, and that means we
				have a responsibility to protect the integrity of the sims and the contributions of our developers and community. Once our code and data are far
				enough along to be able to provide more accurate and reliable results, we will make the repo public again.&rdquo;
				<footer className="mt-2 not-italic opacity-75">&mdash; Lucenia, WoWSims Forever, 26 September 2026</footer>
			</blockquote>
		</div>
		<p className="m-0 opacity-80" data-testid="licence-credit">
			Built on open-source simulator code, used under its{' '}
			<a href={`${SITE_REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noreferrer">
				MIT licence
			</a>
			.
		</p>
		<p className="m-0 text-sm opacity-60" data-testid="trademark-notice">
			World of Warcraft and Warcraft are trademarks or registered trademarks of Blizzard Entertainment, Inc., in the U.S. and/or other countries. Game
			icons &copy; Blizzard Entertainment, Inc.
		</p>
		<p className="m-0 flex flex-wrap gap-3">
			<Cta href="evidence/" icon="clipboard-check">
				Where every number came from
			</Cta>
			<Cta href="evidence/#most-wanted" icon="hand-holding-heart" quiet>
				How you can help
			</Cta>
		</p>
		<div className="flex flex-col gap-3 border border-brand bg-black/50 p-4">
			<h2 className="m-0 text-xl text-brand">Playing the beta? Two files here are worth more than anything I can datamine.</h2>
			<p className="m-0">
				This sim reads Blizzard&apos;s data tables, which say what an ability is <em>meant</em> to do. Your client holds two files that say things the
				tables cannot, and between them they close the two largest gaps on this page.
			</p>
			<ul className="m-0 flex flex-col gap-2 pl-5">
				<li>
					<strong>
						<code>DBCache.bin</code> &mdash; what Blizzard changed after the build shipped.
					</strong>{' '}
					Hotfixes never reach a datamining site, so a value here can be stale the moment it is tuned and there is no way to tell from the outside.
					Carries no personal data; send it as it is.
				</li>
				<li>
					<strong>
						<code>DamageMeter.bin</code> &mdash; what the server actually paid out.
					</strong>{' '}
					Forever blocks addons from reading damage, so the client&apos;s own meter and its combat log are the only measurements there are. Twelve
					abilities have been confirmed this way so far. It does carry character names, so it gets scrubbed in your browser first.{' '}
					<strong>Getting one out is fiddly:</strong> open the meter, fight things, log out to character select, then copy the file before logging
					back in &mdash; logging in deletes it.
				</li>
			</ul>
			<p className="m-0 flex flex-wrap gap-3">
				<Cta href="scrub/#hotfix-drop" icon="upload">
					Send DBCache.bin
				</Cta>
				<Cta href="scrub/#meter-drop" icon="upload">
					Send DamageMeter.bin
				</Cta>
			</p>
			<p className="m-0 text-sm opacity-75">
				Drag, drop, done. No account and no form. The damage meter file has its character names taken out in your browser before anything is sent.
			</p>
		</div>
		<Panel summary="Where the numbers come from">
			<p className="m-0">
				The numbers come from the beta client&apos;s own data tables rather than BlizzCon tooltips, read against Classic Era and diffed spell by spell,
				and a daily database update brings in each new client build from wago.tools. Talent values come from the client&apos;s rank curves, coefficients
				from <code>SpellEffect.EffectBonusCoefficient</code>, and each rank&apos;s damage is scaled to level 60 by the client&apos;s own per-level
				points.
			</p>
			<p className="m-0">Most of it is settled from data, a little of it has been seen happen, and it is worth being plain about which is which:</p>
			<ul className="m-0 flex flex-col gap-2 pl-5">
				<li>
					<strong>The client&apos;s tables, diffed against Classic Era.</strong> Most abilities carry the client&apos;s own numbers, and the rest are
					confirmed unchanged from Classic.
				</li>
				<li>
					<strong>Hotfixes, which the static data does not carry.</strong> The live client&apos;s own hotfix cache is read instead, and the daily
					database update applies it.
				</li>
				<li>
					<strong>Wording, not just values.</strong> A rank curve says what a talent&apos;s numbers are, not what they apply to, which is how Improved
					Seals passed a value check while scaling half of what it should.
				</li>
				<li>
					<strong>Twelve abilities have been watched happen on a running server</strong> &mdash; through the client&apos;s own damage meter, on the
					beta &mdash; and every one landed where the client&apos;s tables said it would. A few more have been settled from the beta&apos;s public
					combat logs. So the honest reading is that the method works, not that the sim is verified: the rest are internally consistent and externally
					unconfirmed.
				</li>
			</ul>
			<p className="m-0">
				<a href={`${SITE_BASE}evidence/`}>Every ability, and what is known about its numbers</a> &mdash; the whole list, filterable, with the reason
				attached to each row.
			</p>
		</Panel>
		<Panel summary="What it still cannot do">
			<p className="m-0">Every one of these can move a number, and some can move it a long way:</p>
			<ul className="m-0 flex flex-col gap-2 pl-5">
				<li>
					About twenty abilities still carry a number the client does not settle, most of them above the beta&apos;s level cap where nobody can check
					them yet. Each is named, with what would settle it, on the <a href={`${SITE_BASE}evidence/`}>evidence page</a>.
				</li>
				<li>
					The client stores what an ability does, not how the server runs it. Proc chances often read as unset, and rules like whether melee-table
					Holy damage partially resists are in no table.
				</li>
				<li>
					No healing sim runs, tank specs are measured on damage alone, and rotations are hand-written priority lists that nothing has re-tuned around
					the cooldowns Forever changed.
				</li>
			</ul>
		</Panel>
	</div>
);

// The product pages, as a row of the same cells the class menus use.
export const LandingProductLinks = () => (
	<div className="flex flex-wrap" data-testid="product-links">
		{PRODUCT_LINKS.map(link => (
			<div key={link.href} className="ui-landing-sim-link-dropdown">
				<a href={`${SITE_BASE}${link.href}`} className="ui-landing-sim-link-cell text-white" data-testid="product-link">
					<SimLinkContent iconPath={`${SITE_BASE}assets/img/WoW-Simulator-Icon.png`} title={link.title} status={link.status} />
				</a>
			</div>
		))}
	</div>
);
