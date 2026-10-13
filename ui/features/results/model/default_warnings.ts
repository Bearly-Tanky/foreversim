import i18n from '@i18n/config';
import { CHARACTER_LEVEL } from '@sim/constants/mechanics';
import type { Player } from '@sim/player/player';
import { getMetaGemConditionDescription } from '@sim/proto/gems';
import { professionNames } from '@sim/proto/names';
import { getTalentPoints } from '@sim/proto/utils';
import type { SimWarning } from '@sim/sim_host';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';

// TBC talents are three free-form trees rather than MoP's row-gated ones, so there is no
// per-row requirement to check: the only thing the string can be wrong about is the point
// total. `@sim/talents/requirements` is MoP's row reader and is deliberately absent here.
const MAX_TALENT_POINTS = CHARACTER_LEVEL - 9;

export function defaultSimWarnings<SpecType extends number>(player: Player<SpecType>): Array<SimWarning> {
	return [
		{
			updateOn: subscribePlayerField(player, 'gear'),
			getContent: () => {
				if (!player.getGear().hasInactiveMetaGem()) {
					return '';
				}

				const metaGem = player.getGear().getMetaGem()!;
				return i18n.t('sidebar.warnings.meta_gem_disabled', {
					gemName: metaGem.name,
					description: getMetaGemConditionDescription(metaGem),
				});
			},
		},
		{
			updateOn: subscribeAll([
				subscribePlayerField(player, 'gear'),
				subscribePlayerField(player, 'profession1'),
				subscribePlayerField(player, 'profession2'),
			]),
			getContent: () => {
				const failedProfReqs = player.getGear().getFailedProfessionRequirements(player.getProfessions());
				if (failedProfReqs.length == 0) {
					return '';
				}

				return failedProfReqs.map(fpr =>
					i18n.t('sidebar.warnings.profession_requirement', {
						itemName: fpr.name,
						professionName: professionNames.get(fpr.requiredProfession)!,
					}),
				);
			},
		},
		{
			updateOn: subscribePlayerField(player, 'gear'),
			getContent: () => {
				const jcGems = player.getGear().getJCGems();
				if (jcGems.length <= 2) {
					return '';
				}

				return i18n.t('sidebar.warnings.too_many_jc_gems', {
					count: jcGems.length,
				});
			},
		},
		{
			updateOn: subscribePlayerField(player, 'talentsString'),
			getContent: () => {
				const talentPoints = getTalentPoints(player.getTalentsString());

				// Skipped during initial load, when the string is still empty.
				if (talentPoints == 0 || talentPoints >= MAX_TALENT_POINTS) {
					return '';
				}

				return i18n.t('sidebar.warnings.unspent_talent_points', {
					count: MAX_TALENT_POINTS - talentPoints,
				});
			},
		},
	];
}
