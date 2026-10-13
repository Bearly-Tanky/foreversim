import { Icon } from '@ui-kit/Icon';
import { type ReactNode, useRef, useState } from 'react';

import { ProductPage, SITE_BASE, SITE_REPO_URL } from '../ProductPage';
import { type ActorRecord, plausible, readRecords, scrub } from './scrub';
import { toCleanPng } from './shot';
import { upload, type UploadResult } from './upload';

const ISSUE_URL = `${SITE_REPO_URL}/issues/new?template=hotfix_cache.md`;

const BUTTON_BASE =
	'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm px-5.5 py-2.5 font-semibold no-underline transition hover:-translate-y-px hover:brightness-108 focus-visible:-translate-y-px focus-visible:brightness-108 active:translate-y-0 disabled:translate-y-0 disabled:cursor-default disabled:opacity-60';
const BUTTON = `${BUTTON_BASE} border-0 bg-brand text-black shadow-[0_2px_10px] shadow-brand/25 hover:text-black`;
const BUTTON_QUIET = `${BUTTON_BASE} border border-brand bg-transparent text-white hover:bg-brand/15 hover:text-white`;
const CARD = 'flex min-w-0 flex-col gap-2 rounded-sm border border-white/14 bg-black/20 px-6 py-4';
const NOTE = 'm-0 text-sm text-gray-400';
const HINT = 'border-l-3 border-white/20 pl-4 text-sm text-gray-400';
const WARN = 'm-0 border-l-3 border-brand pl-4 text-gray-200';
const PATH = 'm-0 block rounded-sm bg-black/35 px-2 py-1 text-sm wrap-anywhere';

const totals = (records: ActorRecord[]) => {
	const byActor = new Map<string, { className: string; damage: number; hits: number }>();
	const bySpell = new Map<number, { damage: number; hits: number; biggest: number }>();
	for (const record of records.filter(plausible)) {
		const actor = byActor.get(record.name) ?? { className: record.className, damage: 0, hits: 0 };
		actor.damage += record.damage;
		actor.hits += record.hits;
		byActor.set(record.name, actor);

		const spell = bySpell.get(record.spellId) ?? { damage: 0, hits: 0, biggest: 0 };
		spell.damage += record.damage;
		spell.hits += record.hits;
		spell.biggest = Math.max(spell.biggest, record.biggest);
		bySpell.set(record.spellId, spell);
	}
	return { byActor, bySpell };
};

const Message = ({ warn, children }: { warn?: boolean; children: ReactNode }) => <p className={warn ? `${WARN} mt-4` : 'm-0 mt-4'}>{children}</p>;

const Sent = ({ result }: { result: UploadResult }) =>
	result.ok ? (
		<p className="m-0 mt-2 flex items-center gap-2 text-white">
			<Icon name="check" className="text-brand" /> Sent, thank you. Reference{' '}
			<code className="wrap-anywhere">{result.receipt.split('/').pop()!.slice(0, 8)}</code>.
		</p>
	) : (
		<Message warn>{result.error}</Message>
	);

/** Disables itself while sending, then gives way to what came back. */
const SendButton = ({ send }: { send: () => Promise<UploadResult> }) => {
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<UploadResult>();
	if (result) return <Sent result={result} />;
	return (
		<button
			className={BUTTON}
			type="button"
			disabled={sending}
			onClick={async () => {
				setSending(true);
				setResult(await send());
			}}>
			{sending ? (
				<span>Sending...</span>
			) : (
				<>
					<Icon name="paper-plane" />
					<span>Send it</span>
				</>
			)}
		</button>
	);
};

// A row rather than a table: the label takes its own line on a phone and the figures sit
// under it, instead of a table forcing a sideways scroll.
const SummaryRow = ({ label, cells }: { label: string; cells: string[] }) => (
	<li className="flex flex-wrap gap-x-4 gap-y-1 border-b border-white/8 py-1 tabular-nums">
		<span className="min-w-0 flex-[1_1_100%] wrap-anywhere text-white md:flex-[0_0_14rem]">{label}</span>
		{cells.map(cell => (
			<span key={cell} className="text-sm text-gray-400 md:flex-auto">
				{cell}
			</span>
		))}
	</li>
);

const MeterReport = ({
	name,
	scrubbed,
	records,
	namesRemoved,
	send,
}: {
	name: string;
	scrubbed: Uint8Array;
	records: ActorRecord[];
	namesRemoved: number;
	send: () => Promise<UploadResult>;
}) => {
	const { byActor, bySpell } = totals(records);
	const shown = records.filter(plausible).length;
	const [url] = useState(() => URL.createObjectURL(new Blob([scrubbed as unknown as BlobPart], { type: 'application/octet-stream' })));

	return (
		<div className="mt-4 flex flex-col gap-2">
			<p className="m-0 text-base text-gray-200">
				<strong>
					{namesRemoved} name{namesRemoved === 1 ? '' : 's'} removed
				</strong>{' '}
				from {records.length} records. Same size, every damage number untouched.
			</p>
			<p className="m-0 flex flex-wrap gap-2">
				<SendButton send={send} />
				<a className={BUTTON_QUIET} href={url} download={`scrubbed-${name}`}>
					<Icon name="download" />
					<span>Or download it</span>
				</a>
			</p>
			<p className={NOTE}>The {shown} records whose numbers read cleanly are below, exactly as they would arrive.</p>
			<ul className="m-0 mb-4 list-none p-0">
				{[...byActor.entries()].map(([actor, row]) => (
					<SummaryRow
						key={actor}
						label={actor}
						cells={[row.className, `${row.damage.toLocaleString()} damage`, `${row.hits.toLocaleString()} hits`]}
					/>
				))}
			</ul>
			<ul className="m-0 mb-4 list-none p-0">
				{[...bySpell.entries()]
					.sort((a, b) => b[1].damage - a[1].damage)
					.map(([spellId, row]) => (
						<SummaryRow
							key={spellId}
							label={`spell ${spellId}`}
							cells={[`${row.damage.toLocaleString()} damage`, `${row.hits.toLocaleString()} hits`, `${row.biggest.toLocaleString()} biggest`]}
						/>
					))}
			</ul>
		</div>
	);
};

const DropZone = ({
	id,
	title,
	hint,
	accept,
	onFile,
}: {
	id: string;
	title: string;
	hint: string;
	accept?: string;
	onFile: (file: File | undefined) => void;
}) => {
	const [over, setOver] = useState(false);
	return (
		<label
			id={id}
			data-over={over ? '' : undefined}
			className="mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-sm border-2 border-dashed border-brand/55 px-4 py-6 text-center text-gray-200 hover:border-brand hover:bg-brand/6 data-over:border-brand data-over:bg-brand/12"
			onDragOver={event => {
				event.preventDefault();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={event => {
				event.preventDefault();
				setOver(false);
				onFile(event.dataTransfer.files?.[0]);
			}}>
			<input className="hidden" type="file" accept={accept ?? ''} onChange={event => onFile(event.target.files?.[0])} />
			<Icon name="upload" className="text-2xl text-brand" />
			<span className="font-semibold text-white">{title}</span>
			<span className="text-sm text-gray-400">{hint}</span>
		</label>
	);
};

const FileTitle = ({ children }: { children: ReactNode }) => <h2 className="m-0 text-lg text-white">{children}</h2>;
const FileSub = ({ children }: { children: ReactNode }) => <p className="m-0 text-brand">{children}</p>;

export const ScrubPage = () => {
	const note = useRef('');
	const [hotfixResult, setHotfixResult] = useState<ReactNode>(null);
	const [meterResult, setMeterResult] = useState<ReactNode>(null);
	const [shotResult, setShotResult] = useState<ReactNode>(null);
	// A fresh key per file, so a second drop gets a fresh send button rather than the first one's "Sent".
	const drops = useRef(0);

	/** Re-encoded to drop everything but the pixels, shown back, then sent on a click. */
	const sendShot = async (file: File | undefined) => {
		if (!file) return;
		setShotResult(<Message>Reading {file.name}...</Message>);
		let bytes: Uint8Array;
		try {
			bytes = await toCleanPng(file);
		} catch (error) {
			setShotResult(<Message warn>Could not read that as an image: {String(error)}</Message>);
			return;
		}
		// Shown back before it goes anywhere, so the crop is checked by the person who can
		// actually tell whether a name is in it.
		setShotResult(
			<div key={++drops.current} className="mt-4">
				<p className="m-0 text-base text-gray-200">This is exactly what would be sent. Anything in it you would rather not send?</p>
				<img
					className="my-2 block max-h-80 max-w-full rounded-sm border border-white/18"
					src={URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'image/png' }))}
					alt=""
				/>
				<p className="m-0 flex flex-wrap gap-2">
					<SendButton send={() => upload('screenshot', bytes, note.current)} />
				</p>
			</div>,
		);
	};

	/** No names in it, so it goes as soon as it is dropped. */
	const sendHotfix = async (file: File | undefined) => {
		if (!file) return;
		setHotfixResult(<Message>Sending {file.name}...</Message>);
		const bytes = new Uint8Array(await file.arrayBuffer());
		setHotfixResult(<Sent result={await upload('dbcache', bytes, note.current)} />);
	};

	/** Names out first, then show what is left, then send on a deliberate click. */
	const scrubMeter = async (file: File | undefined) => {
		if (!file) return;
		setMeterResult(<Message>Reading {file.name}...</Message>);
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const { scrubbed, records, namesRemoved } = scrub(bytes);
			if (!records.length) {
				setMeterResult(
					<Message warn>
						No damage meter records in that file. If the meter had nothing in it the client writes an empty one, so fight something and copy it out
						again.
					</Message>,
				);
				return;
			}
			// Summarised from the scrubbed copy, not the original. Showing the real names back
			// would say "24 names removed" above a list of those 24 names, which reads as though
			// the scrub had not worked.
			setMeterResult(
				<MeterReport
					key={++drops.current}
					name={file.name}
					scrubbed={scrubbed}
					records={readRecords(scrubbed)}
					namesRemoved={namesRemoved}
					send={() => upload('damagemeter', scrubbed, note.current)}
				/>,
			);
		} catch (error) {
			setMeterResult(<Message warn>Could not read that file: {String(error)}</Message>);
		}
	};

	return (
		<ProductPage
			title="Send the beta's own numbers"
			subtitle={
				<>
					This sim reads Blizzard&apos;s data tables, which say what an ability is <em>meant</em> to do. Two files on your machine, and a picture of a
					tooltip, say things the tables cannot. Drop any of them below, and that is the whole job &mdash; no account, no form.
				</>
			}>
			<div className="flex flex-col gap-6 text-gray-300">
				{/* minmax(0, 1fr) rather than 1fr, because a plain 1fr track refuses to shrink below its content and that is exactly how a long file path escapes the grid. */}
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(22rem,100%),1fr))] gap-4">
					<section className={CARD}>
						<FileTitle>
							<code className="text-inherit">DBCache.bin</code>
						</FileTitle>
						<FileSub>What Blizzard changed after the build shipped</FileSub>
						<p className="m-0">
							Hotfixes never reach a datamining site. They exist only in the cache your client downloads them into, so a value this sim reads can
							be stale the moment it is tuned, and there is no way to know from outside.
						</p>
						<code className={PATH}>World of Warcraft\_classic_beta_\Cache\ADB\enUS\</code>
						<p className={NOTE}>
							Carries no character name, account, realm or Battle.net tag &mdash; it is NPC dialogue, item names and tuning rows &mdash; so it
							goes straight up.
						</p>
						<DropZone id="hotfix-drop" title="Choose DBCache.bin" hint="or drag it here" onFile={file => void sendHotfix(file)} />
						{hotfixResult}
					</section>

					<section className={CARD}>
						<FileTitle>
							<code className="text-inherit">DamageMeter.bin</code>
						</FileTitle>
						<FileSub>What the server actually paid out</FileSub>
						<p className="m-0">
							Forever blocks addons from reading damage, so the client&apos;s own meter is the only measurement there will be. It is the only
							thing that can show a number here is wrong rather than merely unverified. Twelve abilities have been confirmed this way so far, out
							of 996 &mdash; they are on the <a href={`${SITE_BASE}evidence/`}>evidence page</a>.
						</p>
						<code className={PATH}>World of Warcraft\_classic_beta_\Cache\</code>
						<div className={HINT}>
							<strong>Getting one out is fiddly. In order:</strong>
							<ol className="m-0 mt-2 flex flex-col gap-1 pl-6">
								<li>Open the damage meter and leave it open. It records nothing while it is closed.</li>
								<li>Fight things.</li>
								<li>
									Log out to character select. The file is only written when the meter flushes, and it flushes on logout &mdash; which is why
									the folder looks empty while you are still playing.
								</li>
								<li>
									<strong>Copy it out before logging back in.</strong> Logging in deletes it and starts again.
								</li>
							</ol>
						</div>
						<p className={`${WARN} text-sm`}>
							This one holds character names, yours and everyone you grouped with. They are taken out <strong>in your browser</strong> before
							anything is sent, and you get to see what is left first.
						</p>
						<DropZone id="meter-drop" title="Choose DamageMeter.bin" hint="or drag it here" onFile={file => void scrubMeter(file)} />
						{meterResult}
					</section>

					<section className={CARD}>
						<FileTitle>A screenshot</FileTitle>
						<FileSub>What the tooltip actually says</FileSub>
						<p className="m-0">
							Five bugs so far passed a number check and were wrong about what the number applied to &mdash; Improved Seals scaled half of what it
							should while every value matched. A rank curve says what a talent&apos;s numbers are, never what they do. A picture of the tooltip
							settles it, and a spellbook page settles an ability nobody has found at all.
						</p>
						<div className={HINT}>
							<strong>Most wanted right now:</strong> hunter abilities, anything a Sky Elf has that nobody else does, and any tooltip that
							disagrees with what this sim shows. The <a href={`${SITE_BASE}evidence/`}>evidence page</a> keeps the running list.
						</div>
						<p className={`${WARN} text-sm`}>
							<strong>Crop it to the tooltip.</strong> A name in a picture is pixels, and no scrubber can honestly promise to have found it.
							Everything the file carries around the picture &mdash; EXIF, GPS, camera, editor history &mdash; is dropped in your browser, but
							what is in frame is up to you.
						</p>
						<DropZone id="shot-drop" title="Choose a screenshot" hint="or drag it here" accept="image/*" onFile={file => void sendShot(file)} />
						{shotResult}
					</section>
				</div>

				<section className={CARD}>
					<label className="flex flex-col gap-1 text-gray-300">
						<span>Anything worth saying about it? Optional.</span>
						<input
							className="w-full rounded-sm border border-white/18 bg-black/35 px-3 py-2 text-white focus:border-brand focus:outline-none"
							type="text"
							maxLength={200}
							placeholder="Fury warrior, dummy, 3 min - or a tooltip that disagrees with the sim"
							onInput={event => (note.current = event.currentTarget.value)}
						/>
					</label>
					<p className={NOTE}>
						Files land in a private bucket, are read and thrown away, and are never committed to the repository. If you would rather send it
						yourself,{' '}
						<a href={ISSUE_URL} target="_blank" rel="noreferrer">
							open an issue
						</a>{' '}
						instead.
					</p>
				</section>
			</div>
		</ProductPage>
	);
};
