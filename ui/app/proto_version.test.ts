import { Player } from '@generated/proto/api';
import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import { DpsWarrior_Options, WarriorOptions } from '@generated/proto/warrior';
import { CURRENT_API_VERSION } from '@sim/constants/other';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const added = vi.hoisted(() => vi.fn());
vi.mock('@ui-kit/Toast', () => ({ toastManager: { add: added } }));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const { updateIndividualProtoVersion } = await import('./proto_version');

const defaults = {
	raidBuffs: RaidBuffs.create({ arcaneBrilliance: true }),
	partyBuffs: PartyBuffs.create({ trueshotAura: true }),
	individualBuffs: IndividualBuffs.create({ greaterBlessingOfKings: true }),
	debuffs: Debuffs.create({ sunderArmor: true }),
	consumables: ConsumesSpec.create({ flaskId: 13510 }),
	specOptions: DpsWarrior_Options.create({ classOptions: WarriorOptions.create({ useBattleShout: true, queueDelay: 250 }) }),
};

// What an old link decodes to: noise in every renumbered field.
const settings = (apiVersion: number) =>
	IndividualSimSettings.create({
		apiVersion,
		raidBuffs: RaidBuffs.create({ thorns: true }),
		partyBuffs: PartyBuffs.create({ bloodPact: true }),
		debuffs: Debuffs.create({ giftOfArthas: true }),
		player: Player.create({
			buffs: IndividualBuffs.create({ innervates: 3 }),
			consumables: ConsumesSpec.create({ potId: 99 }),
			spec: {
				oneofKind: 'dpsWarrior',
				dpsWarrior: {
					options: DpsWarrior_Options.create({ classOptions: WarriorOptions.create({ useBattleShout: false, queueDelay: 1, startingRage: 20 }) }),
				},
			},
		}),
	});

describe('updateIndividualProtoVersion', () => {
	beforeEach(() => added.mockClear());

	it('resets a pre-17 payload’s buffs, debuffs, consumables and warrior shout options to the spec defaults, with one toast', () => {
		const proto = settings(16);

		updateIndividualProtoVersion(proto, defaults);

		expect(proto.raidBuffs).toEqual(defaults.raidBuffs);
		expect(proto.partyBuffs).toEqual(defaults.partyBuffs);
		expect(proto.debuffs).toEqual(defaults.debuffs);
		expect(proto.player?.buffs).toEqual(defaults.individualBuffs);
		expect(proto.player?.consumables).toEqual(defaults.consumables);
		const spec = proto.player?.spec;
		const classOptions = spec?.oneofKind === 'dpsWarrior' ? spec.dpsWarrior.options?.classOptions : undefined;
		expect(classOptions).toMatchObject({ useBattleShout: true, queueDelay: 250, startingRage: 20 });
		expect(added).toHaveBeenCalledTimes(1);
		expect(proto.apiVersion).toBe(CURRENT_API_VERSION);
	});

	it('copies the defaults rather than sharing them', () => {
		const proto = settings(1);

		updateIndividualProtoVersion(proto, defaults);
		proto.raidBuffs!.arcaneBrilliance = false;

		expect(defaults.raidBuffs.arcaneBrilliance).toBe(true);
	});

	it('resets a version-17 payload’s buffs and debuffs only, with one toast', () => {
		const proto = settings(17);

		updateIndividualProtoVersion(proto, defaults);

		expect(proto.raidBuffs).toEqual(defaults.raidBuffs);
		expect(proto.partyBuffs).toEqual(defaults.partyBuffs);
		expect(proto.debuffs).toEqual(defaults.debuffs);
		expect(proto.player?.buffs).toEqual(defaults.individualBuffs);
		expect(proto.player?.consumables).toEqual(ConsumesSpec.create({ potId: 99 }));
		const spec = proto.player?.spec;
		const classOptions = spec?.oneofKind === 'dpsWarrior' ? spec.dpsWarrior.options?.classOptions : undefined;
		expect(classOptions).toMatchObject({ useBattleShout: false, queueDelay: 1 });
		expect(added).toHaveBeenCalledTimes(1);
		expect(proto.apiVersion).toBe(CURRENT_API_VERSION);
	});

	it('leaves a current payload alone', () => {
		const proto = settings(CURRENT_API_VERSION);
		const before = IndividualSimSettings.clone(proto);

		updateIndividualProtoVersion(proto, defaults);

		expect(proto).toEqual(before);
		expect(added).not.toHaveBeenCalled();
	});
});
