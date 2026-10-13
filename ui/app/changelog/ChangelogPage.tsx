import { PageSection, ProductPage, SITE_BASE, SITE_REPO_URL } from '../ProductPage';
import { type Entry, sections, type Source } from './entries';
// Every pull request merged into master, kept current by the Update Changelog workflow.
import merged from './merged.json';

type MergedPullRequest = { number: number; title: string; mergedAt: string; url: string };
const mergedPullRequests = merged as Array<MergedPullRequest>;

const LINK = 'text-brand hover:underline';

const PrLink = ({ pr }: { pr: number }) => (
	<a className={LINK} href={`${SITE_REPO_URL}/pull/${pr}`} target="_blank" rel="noreferrer">
		#{pr}
	</a>
);

const SourceLink = ({ source }: { source: Source }) => (
	<li>
		<a href={source.url} target="_blank" rel="noreferrer">
			{source.label}
		</a>
	</li>
);

const EntryBlock = ({ entry }: { entry: Entry }) => (
	<article className="border-t border-surface-border pt-3" data-testid="changelog-entry">
		<h3 className="m-0 mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-lg">
			{entry.title}
			<span className="inline-flex flex-wrap gap-2 text-sm font-normal">
				{entry.prs.map(pr => (
					<PrLink key={pr} pr={pr} />
				))}
			</span>
		</h3>
		<dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
			<dt className="font-bold whitespace-nowrap opacity-75">What changed</dt>
			<dd className="m-0">{entry.changed}</dd>
			<dt className="font-bold whitespace-nowrap opacity-75">Effect on the sim</dt>
			<dd className="m-0">{entry.effect}</dd>
			{entry.sources && (
				<>
					<dt className="font-bold whitespace-nowrap opacity-75">Where it came from</dt>
					<dd className="m-0">
						<ul className="m-0 pl-5">
							{entry.sources.map(source => (
								<SourceLink key={source.url + source.label} source={source} />
							))}
						</ul>
					</dd>
				</>
			)}
		</dl>
	</article>
);

export const ChangelogPage = () => (
	<ProductPage
		title="What changed for Forever"
		subtitle="Every way this simulator differs from the Classic Era sim it was forked from, what each change does to the numbers, and where the Forever information came from.">
		<PageSection title="Read this first">
			<p className="m-0">
				<strong className="text-brand">Sources.</strong> Forever is not out. Until the beta, what was modelled here was read from Blizzard&apos;s
				BlizzCon 2026 announcements and panel, Wowhead&apos;s Forever guides, the community talent calculators rebuilt from the demo&apos;s tooltips,
				and reports from people who played the demo. Since 17 September the numbers come from the beta client&apos;s own data, now pulled from
				Blizzard&apos;s CDN every day with its hotfixes. Each entry below links the source it came from; what the client still does not settle is
				listed, with what would settle it, on the <a href={`${SITE_BASE}evidence/`}>evidence page</a>. The beta is still changing; expect numbers to
				move.
			</p>
			<p className="m-0">
				<strong className="text-brand">Where to read more.</strong> Each change links its pull request, which carries the full reasoning and the before
				and after numbers. The one-line rules are collected in{' '}
				<a href={`${SITE_REPO_URL}/blob/master/docs/forever_rules.md`} target="_blank" rel="noreferrer">
					the rules sheet
				</a>
				, written for the engine this sim ran on before the September switch.
			</p>
		</PageSection>
		{sections.map(section => (
			<PageSection key={section.title} title={section.title}>
				<p className="m-0 opacity-75">{section.intro}</p>
				{section.entries.map(entry => (
					<EntryBlock key={entry.title} entry={entry} />
				))}
			</PageSection>
		))}
		<PageSection title={`Every merged pull request (${mergedPullRequests.length})`}>
			<p className="m-0 opacity-75">
				The sections above are written by hand and group the work by what it did. This list is the raw record, newest first, refreshed by the build
				every time a pull request is merged.
			</p>
			<ol className="m-0 flex list-none flex-col gap-1 p-0">
				{mergedPullRequests.map(pull => (
					<li key={pull.number} className="flex flex-wrap items-baseline gap-x-3">
						<a className={LINK} href={pull.url} target="_blank" rel="noreferrer">
							#{pull.number}
						</a>
						<span className="flex-1">{pull.title}</span>
						<time className="text-sm opacity-60" dateTime={pull.mergedAt}>
							{pull.mergedAt}
						</time>
					</li>
				))}
			</ol>
		</PageSection>
	</ProductPage>
);
