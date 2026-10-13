// @vitest-environment node
// Each case is one of the mistakes the first version of the browser scrubber made. They are
// pinned here rather than described in a comment because a privacy tool that fails open is
// worse than no privacy tool, and "it looked right" is how it got written the first time.

import { describe, expect, it } from 'vitest';

import { plausible, readRecords, scrub } from './scrub';

/** A length-prefixed, NUL-terminated string, the way the client writes one. */
function str(text: string): number[] {
	const length = text.length + 1;
	return [length & 0xff, (length >> 8) & 0xff, ...[...text].map(c => c.charCodeAt(0)), 0];
}

function u32(value: number): number[] {
	return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

/** kind, spell, spell, damage, unknown, hits, biggest - see scrub.ts for the layout. */
function record(name: string, className: string, hits: number, spellId: number, damage: number, biggest = damage): number[] {
	return [...str(name), ...str(className), ...u32(1), ...u32(spellId), ...u32(spellId), ...u32(damage), ...u32(0), ...u32(hits), ...u32(biggest)];
}

function file(...parts: number[][]): Uint8Array {
	return new Uint8Array(parts.flat());
}

describe('scrub', () => {
	it('reads what is there', () => {
		const records = readRecords(file(record('Terry Oldman', 'WARRIOR', 3, 772, 120)));
		expect(records).toEqual([{ name: 'Terry Oldman', className: 'WARRIOR', hits: 3, spellId: 772, spellAgain: 772, damage: 120, biggest: 120 }]);
	});

	// The first version replaced only at record offsets and left this copy behind.
	it('removes a name that also appears without a class after it', () => {
		const { scrubbed } = scrub(file(record('Terry Oldman', 'WARRIOR', 1, 6603, 10), str('Terry Oldman'), u32(0)));
		expect(Buffer.from(scrubbed).includes('Terry Oldman'), 'a copy of the name survived').toBe(false);
	});

	// The first version turned "Murloc Streamrunner" into "Player Streamrunner".
	it('does not corrupt a longer string a scrubbed name is a prefix of', () => {
		const { scrubbed } = scrub(file(record('Murloc', 'WARRIOR', 1, 6603, 5), str('Murloc Streamrunner'), u32(0)));
		const text = Buffer.from(scrubbed).toString('latin1');
		expect(text.includes('Player Streamrunner'), 'a longer string was corrupted by a shorter name').toBe(false);
		expect(text.includes('Murloc Streamrunner'), 'a string that was never a record was rewritten').toBe(true);
	});

	it('does not change the file length, because it holds offsets nobody has worked out', () => {
		const bytes = file(record('Bary Oldman', 'PALADIN', 4, 6603, 194));
		expect(scrub(bytes).scrubbed.length).toBe(bytes.length);
	});

	it('keeps the damage, which is the entire point of sending the file', () => {
		const bytes = file(record('Terry Oldman', 'WARRIOR', 87, 6603, 9121), record('Bary Oldman', 'PALADIN', 15, 78, 8258));
		const before = readRecords(bytes).map(r => [r.hits, r.spellId, r.damage, r.biggest]);
		const { scrubbed, namesRemoved } = scrub(bytes);
		expect(readRecords(scrubbed).map(r => [r.hits, r.spellId, r.damage, r.biggest])).toEqual(before);
		expect(namesRemoved).toBe(2);
	});

	// Found only by running the browser port against a real file: filtering nonsense records
	// out before collecting names made the browser scrub 5 names where the Python tool scrubs
	// 24. The summary is filtered; the scrubbing never is.
	it('still scrubs the name on a record whose numbers read as nonsense', () => {
		const junk = [...str('Geosculptor Yip'), ...str('PALADIN'), ...u32(1), ...u32(1), ...u32(2), ...u32(3815178240), ...u32(0), ...u32(248474), ...u32(0)];
		const bytes = file(record('Terry Oldman', 'WARRIOR', 1, 6603, 10), junk);
		expect(readRecords(bytes).filter(plausible).length, 'the nonsense record should not be summarised').toBe(1);
		const { scrubbed, namesRemoved } = scrub(bytes);
		expect(namesRemoved, "the nonsense record's name must still be scrubbed").toBe(2);
		expect(Buffer.from(scrubbed).includes('Geosculptor Yip'), 'a name survived because its record looked odd').toBe(false);
	});
});
