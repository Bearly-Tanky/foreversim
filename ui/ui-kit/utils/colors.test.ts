import { describe, expect, it } from 'vitest';

import { CLASS_BG, CLASS_BORDER, CLASS_TEXT, DANGER_TEXT, FACTION_TEXT, QUALITY_TEXT, RESOURCE_TEXT, SPELL_SCHOOL_BG, SPELL_SCHOOL_TEXT } from './colors';

const allRecords = [CLASS_BG, CLASS_BORDER, CLASS_TEXT, FACTION_TEXT, QUALITY_TEXT, RESOURCE_TEXT, SPELL_SCHOOL_BG, SPELL_SCHOOL_TEXT];

describe('colors', () => {
	it('every value of every record is a non-empty string without interpolation', () => {
		for (const record of allRecords) {
			for (const value of Object.values(record)) {
				expect(typeof value).toBe('string');
				expect((value as string).length).toBeGreaterThan(0);
				expect(value).not.toContain('${');
			}
		}
	});

	it('has 7 single spell schools and 9 multi spell schools', () => {
		expect(Object.keys(SPELL_SCHOOL_TEXT)).toHaveLength(16);
		expect(Object.keys(SPELL_SCHOOL_BG)).toHaveLength(16);
	});

	it('has all 9 classes', () => {
		expect(Object.keys(CLASS_TEXT)).toHaveLength(9);
		expect(Object.keys(CLASS_BG)).toHaveLength(9);
		expect(Object.keys(CLASS_BORDER)).toHaveLength(9);
	});

	it('grades safe/warning/danger onto the shared danger tones', () => {
		expect(DANGER_TEXT.safe).toBe('text-success');
		expect(DANGER_TEXT.warning).toContain('text-damage-partial');
		expect(DANGER_TEXT.danger).toBe('text-danger');
	});
});
