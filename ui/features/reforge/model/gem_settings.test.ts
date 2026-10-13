import { ItemQuality, ItemSlot, Stat } from '@generated/proto/common';
import { CURRENT_PHASE, Phase } from '@sim/constants/other';
import { Stats } from '@sim/proto/stats';
import { ReforgeSettings } from '@sim/settings/reforge_settings';
import { createSimStore } from '@sim/state/sim_store';
import { describe, expect, it } from 'vitest';

const EP_STATS = [Stat.StatIntellect, Stat.StatSpellDamage, Stat.StatSpellHitRating];

const makeSettings = (phase = CURRENT_PHASE) =>
	new ReforgeSettings({ sim: { store: createSimStore(), getPhase: () => phase }, storeKey: 1 } as any, {}, EP_STATS);

describe('gem optimizer settings', () => {
	it('defaults the three gem knobs the TBC optimizer is driven by', () => {
		const settings = makeSettings();

		expect(settings.getMaxGemPhase()).toBe(CURRENT_PHASE);
		expect(settings.getMaxGemQuality()).toBe(ItemQuality.ItemQualityEpic);
		expect(settings.disableUniqueGems).toBe(false);
	});

	it('serializes the gem knobs and the spec’s gemmable stats onto ReforgeSettings', () => {
		const settings = makeSettings();
		settings.setMaxGemPhase(Phase.Tier1);
		settings.setMaxGemQuality(ItemQuality.ItemQualityRare);
		settings.setDisableUniqueGems(true);

		const proto = settings.toProto();

		expect(proto.maxGemPhase).toBe(Phase.Tier1);
		expect(proto.maxGemQuality).toBe(ItemQuality.ItemQualityRare);
		expect(proto.disableUniqueGems).toBe(true);
		expect(proto.epStats).toEqual(EP_STATS);
	});

	it('serializes caps on TBC’s stat enum, not MoP’s', () => {
		const proto = makeSettings().toProto();

		expect(proto.statCaps?.stats).toHaveLength(41);
		expect(proto.statCaps?.pseudoStats).toHaveLength(28);
		expect(proto.breakpointLimits?.stats).toHaveLength(41);
		expect(proto.breakpointLimits?.pseudoStats).toHaveLength(28);
	});

	it('round-trips the gem knobs back out of a proto', () => {
		const source = makeSettings();
		source.setMaxGemPhase(Phase.Tier3);
		source.setMaxGemQuality(ItemQuality.ItemQualityUncommon);
		source.setDisableUniqueGems(true);

		const restored = makeSettings();
		restored.fromProto(source.toProto());

		expect(restored.getMaxGemPhase()).toBe(Phase.Tier3);
		expect(restored.getMaxGemQuality()).toBe(ItemQuality.ItemQualityUncommon);
		expect(restored.disableUniqueGems).toBe(true);
	});

	it('falls back to phase 1 and epic quality when a saved proto carries neither', () => {
		const settings = makeSettings();
		settings.fromProto({ ...settings.toProto(), maxGemPhase: 0, maxGemQuality: 0 });

		expect(settings.getMaxGemPhase()).toBe(Phase.Launch);
		expect(settings.getMaxGemQuality()).toBe(ItemQuality.ItemQualityEpic);
	});

	it('applies the sim’s current phase, not the compiled-in one, when defaults are reapplied', () => {
		const settings = makeSettings(Phase.Tier3);
		settings.setMaxGemPhase(Phase.Launch);
		settings.setDisableUniqueGems(true);
		settings.setFreezeItemSlots(true);
		settings.setFrozenItemSlots([ItemSlot.ItemSlotHead]);

		settings.applyDefaults();

		expect(settings.getMaxGemPhase()).toBe(Phase.Tier3);
		expect(settings.disableUniqueGems).toBe(false);
		expect(settings.freezeItemSlots).toBe(false);
		expect(settings.statCaps).toEqual(new Stats());
	});
});
