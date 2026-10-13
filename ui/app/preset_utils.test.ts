import { Spec } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { makePresetBuildFromJSON } from './preset_utils';

const buildFrom = (player: Record<string, unknown>) =>
	makePresetBuildFromJSON('p', Spec.SpecProtectionWarrior, { player: { class: 'ClassWarrior', ...player } });

describe('makePresetBuildFromJSON player timings', () => {
	// The three tank specs' default build is an encounter-only export: it names a healing model and
	// nothing else, and proto3 hands back 0 for every scalar it does not mention. Copying that 0
	// into the build made it indistinguishable from a preset that means 0.
	it('omits the timings an encounter-only build never states', () => {
		const build = buildFrom({ healingModel: { burstWindow: 6 }, inFrontOfTarget: true });

		expect(build.settings?.playerOptions).not.toHaveProperty('reactionTimeMs');
		expect(build.settings?.playerOptions).not.toHaveProperty('channelClipDelayMs');
	});

	it('keeps the ones a build does state', () => {
		const build = buildFrom({ reactionTimeMs: 100, channelClipDelayMs: 50 });

		expect(build.settings?.playerOptions?.reactionTimeMs).toBe(100);
		expect(build.settings?.playerOptions?.channelClipDelayMs).toBe(50);
	});
});
