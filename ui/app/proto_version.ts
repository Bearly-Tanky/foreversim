import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec } from '@generated/proto/common';
import type { IndividualSimSettings } from '@generated/proto/ui';
import type { WarriorOptions } from '@generated/proto/warrior';
import i18n from '@i18n/config';
import { BUFFS_RENUMBER_API_VERSION, BUFFS_REWRITE_API_VERSION, CURRENT_API_VERSION } from '@sim/constants/other';
import type { IndividualSimUIConfig } from '@sim/spec_config';
import { toastManager } from '@ui-kit/Toast';

export type ProtoVersionDefaults = Pick<
	IndividualSimUIConfig<any>['defaults'],
	'raidBuffs' | 'partyBuffs' | 'individualBuffs' | 'debuffs' | 'consumables' | 'specOptions'
>;

// Lives here rather than beside the shared migrations in `ui/sim` because it reports itself with a
// toast, and that layer may not reach `@ui-kit`.
//
// Version 18 is upstream's slimmed buff manifest, which renumbered the four buff messages again; a
// version-17 payload keeps its consumables and class options and takes the spec's buffs and debuffs.
//
// Version 17 is the upstream buff rewrite: the buff messages moved to buffs.proto and were
// renumbered, ConsumesSpec was renumbered, and WarriorOptions field 6 (our queue_delay) became
// use_battle_shout. An older share link decodes all of those against the new numbers, so what comes
// out is noise; they take the spec's defaults instead. That covers everything older too, so the
// earlier migrations (drums into party buffs at 7) went with the fields they moved.
//
// Version 16, the Forever talent rebuild, has no converter on purpose: a TBC talent string means
// nothing against a Forever tree, so the user re-picks their talents.
export function updateIndividualProtoVersion(settingsProto: IndividualSimSettings, defaults: ProtoVersionDefaults) {
	if (settingsProto.apiVersion >= CURRENT_API_VERSION) return;

	if (settingsProto.apiVersion < BUFFS_REWRITE_API_VERSION) {
		settingsProto.raidBuffs = RaidBuffs.clone(defaults.raidBuffs);
		settingsProto.partyBuffs = PartyBuffs.clone(defaults.partyBuffs);
		settingsProto.debuffs = Debuffs.clone(defaults.debuffs);
		const player = settingsProto.player;
		if (player) {
			player.buffs = IndividualBuffs.clone(defaults.individualBuffs);
			player.consumables = ConsumesSpec.clone(defaults.consumables);
			const spec = player.spec;
			const classOptions =
				spec.oneofKind === 'dpsWarrior'
					? spec.dpsWarrior.options?.classOptions
					: spec.oneofKind === 'protectionWarrior'
						? spec.protectionWarrior.options?.classOptions
						: undefined;
			if (classOptions) {
				const defaultClassOptions = (defaults.specOptions as { classOptions?: WarriorOptions }).classOptions;
				classOptions.useBattleShout = defaultClassOptions?.useBattleShout ?? false;
				classOptions.queueDelay = defaultClassOptions?.queueDelay ?? 0;
			}
		}
		toastManager.add({
			variant: 'warning',
			delay: 8000,
			body: i18n.t('protoVersion.17.body', { ns: 'updates' }),
		});
	} else if (settingsProto.apiVersion < BUFFS_RENUMBER_API_VERSION) {
		settingsProto.raidBuffs = RaidBuffs.clone(defaults.raidBuffs);
		settingsProto.partyBuffs = PartyBuffs.clone(defaults.partyBuffs);
		settingsProto.debuffs = Debuffs.clone(defaults.debuffs);
		if (settingsProto.player) {
			settingsProto.player.buffs = IndividualBuffs.clone(defaults.individualBuffs);
		}
		toastManager.add({
			variant: 'warning',
			delay: 8000,
			body: i18n.t('protoVersion.18.body', { ns: 'updates' }),
		});
	}

	settingsProto.apiVersion = CURRENT_API_VERSION;
}
