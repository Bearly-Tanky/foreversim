import { PseudoStat, Spec } from '@generated/proto/common';
import { masterEpWeights } from '@sim/proto/master_ep_weights';
import { Stats } from '@sim/proto/stats';
import { defineSpec } from '@sim/spec_config';

import * as Presets from '../dps/presets';
import ShadowPage from '../dps/spec';

// Master ships Smite as its own sim page (ui/smite_priest). Here both pages sim the one dps priest
// spec; this one opens with master's Smite defaults and keeps its own saved settings.
export default defineSpec<Spec.SpecDpsPriest>({
	...ShadowPage,
	storageKeyPart: '_smite',
	pageTitle: 'Smite Priest',
	defaults: {
		...ShadowPage.defaults,
		// Master's smite_priest weights.
		epWeights: masterEpWeights({
			Intellect: 0.16,
			Spirit: 0.12,
			SpellPower: 1,
			HolyPower: 1,
			SpellHit: 5.51,
			SpellCrit: 6.5,
			SpellHaste: 1.65,
			MP5: 0.1,
			FireResistance: 0.5,
		}),
		gear: Presets.GEAR_SMITE_LAUNCH.gear,
		statCaps: new Stats().withPseudoStat(PseudoStat.PseudoStatSchoolHitPercentHoly, 16),
		consumables: Presets.SmiteConsumables,
		talents: Presets.TalentsLaunchSmite.data,
		other: Presets.SmiteOtherDefaults,
	},
	presets: {
		...ShadowPage.presets,
		talents: [Presets.TalentsLaunchSmite, Presets.SmiteTalents],
		rotations: [Presets.ROTATION_PRESET_SMITE],
		gear: [Presets.GEAR_SMITE_LAUNCH],
	},
});
