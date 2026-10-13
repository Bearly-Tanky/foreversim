import { APLRotation, APLRotation_Type } from '@generated/proto/apl';
import { ActionID, Cooldowns, type Spec } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import type { Player } from '../player/player';
import { isEqualAPLRotation, renameAPLReference } from './apl_utils';

// Only the TypeSimple branch reaches the player, and none of these cases take it.
const player = null as unknown as Player<Spec>;

const rotation = (type: APLRotation_Type, spellId: number) =>
	APLRotation.create({
		type,
		priorityList: [
			{ action: { action: { oneofKind: 'castSpell', castSpell: { spellId: ActionID.create({ rawId: { oneofKind: 'spellId', spellId } }) } } } },
		],
	});

describe('isEqualAPLRotation', () => {
	it('matches an Auto rotation against the APL rotation it resolves to', () => {
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAuto, 100), rotation(APLRotation_Type.TypeAPL, 100))).toBe(true);
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAPL, 100), rotation(APLRotation_Type.TypeAuto, 100))).toBe(true);
	});

	it('still separates rotations that differ below the type', () => {
		expect(isEqualAPLRotation(player, rotation(APLRotation_Type.TypeAuto, 100), rotation(APLRotation_Type.TypeAPL, 200))).toBe(false);
	});

	it('leaves both arguments untouched', () => {
		const auto = rotation(APLRotation_Type.TypeAuto, 100);
		const apl = rotation(APLRotation_Type.TypeAPL, 100);
		isEqualAPLRotation(player, auto, apl);
		expect(auto.type).toBe(APLRotation_Type.TypeAuto);
		expect(apl.type).toBe(APLRotation_Type.TypeAPL);
	});

	it('treats a missing rotation as unequal to a present one', () => {
		expect(isEqualAPLRotation(player, undefined, rotation(APLRotation_Type.TypeAPL, 100))).toBe(false);
		expect(isEqualAPLRotation(player, undefined, undefined)).toBe(true);
	});

	// The Simple branch does reach the player, so it needs the two codec hooks it calls.
	const simplePlayer = {
		specTypeFunctions: { rotationFromJson: (json: unknown) => json, rotationEquals: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) },
	} as unknown as Player<Spec>;

	const simple = (cooldowns: Cooldowns) =>
		APLRotation.create({ type: APLRotation_Type.TypeSimple, simple: { specRotationJson: '{"spec":"Fury"}', cooldowns } });

	it('separates Simple rotations that differ only in cooldown timings', () => {
		const a = simple(Cooldowns.create({ cooldowns: [{ id: ActionID.create(), timings: [10] }] }));
		const b = simple(Cooldowns.create({ cooldowns: [{ id: ActionID.create(), timings: [20] }] }));

		expect(isEqualAPLRotation(simplePlayer, a, b)).toBe(false);
		expect(isEqualAPLRotation(simplePlayer, a, simple(Cooldowns.clone(a.simple!.cooldowns!)))).toBe(true);
	});
});

describe('renameAPLReference', () => {
	// `Action Group is used` stores the group as a bare `{name}`, which the generic walk cannot spot.
	it('renames a group inside an actionGroupUsed condition', () => {
		const rotation = APLRotation.create({
			priorityList: [{ action: { condition: { value: { oneofKind: 'actionGroupUsed', actionGroupUsed: { name: 'Cooldowns' } } } } }],
		});

		renameAPLReference(rotation, { type: 'group', oldName: 'Cooldowns', newName: 'Burst' });

		const value = rotation.priorityList[0].action!.condition!.value;
		expect(value.oneofKind === 'actionGroupUsed' && value.actionGroupUsed.name).toBe('Burst');
	});
});
