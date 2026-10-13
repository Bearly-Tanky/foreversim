import { OtherAction } from '@generated/proto/common';
import i18n from '@i18n/config';
import { AuraStats, SpellStats, UnitMetadata } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { bucket } from '@sim/utils/collections';
import type { DropdownValueConfig } from '@ui-kit/DropdownPicker/types';

export type ACTION_ID_SET =
	| 'auras'
	| 'stackable_auras'
	| 'icd_auras'
	| 'exclusive_effect_auras'
	| 'spells'
	| 'castable_spells'
	| 'channel_spells'
	| 'dot_spells'
	| 'castable_dot_spells'
	| 'shield_spells'
	| 'non_instant_spells'
	| 'friendly_spells'
	| 'expected_dot_spells'
	| 'spells_with_travelTime'
	| 'potions'
	| 'conjured_items';

/** True when two or more of `spells` share `actionId`'s base name and tag — i.e. `actionId` has ranks. */
const spellHasRanks = (actionId: ActionId, spells: Array<AuraStats | SpellStats>) =>
	spells.filter(spell => actionId.baseName === spell.id.baseName && actionId.tag === spell.id.tag && spell.id.hasRank).length > 1;

const createSpellSubmenu = (actionId: ActionId, spells: Array<AuraStats | SpellStats>, baseMenuEntry: Array<string> = []): Array<string> =>
	spellHasRanks(actionId, spells) ? [...baseMenuEntry, actionId.nameWithoutRank] : baseMenuEntry;

/** The one list a spell may be cast from, for the spells the sim only accepts in one of them. */
export type LIST_SCOPE = 'prepull' | 'priority';

export interface ActionIdOption extends DropdownValueConfig<ActionId> {
	/**
	 * Read by the field, which drops the entries the list it is in cannot use.
	 *
	 * Master marked them with a CSS class instead and hid them with a rule scoped to the enclosing
	 * list; the port's menu renders in a portal on `document.body`, where no such rule can reach it.
	 */
	listScope?: LIST_SCOPE;
}

const listScopeOf = (spell: SpellStats): LIST_SCOPE | undefined => (spell.data.prepullOnly ? 'prepull' : spell.data.encounterOnly ? 'priority' : undefined);

export const actionIdSets: Record<
	ACTION_ID_SET,
	{
		defaultLabel: string;
		getActionIDs: (metadata: UnitMetadata) => Promise<Array<ActionIdOption>>;
	}
> = {
	auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.auras'),
		getActionIDs: async metadata => {
			const auras = metadata.getAuras();
			return auras.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, auras),
				};
			});
		},
	},
	stackable_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.stackable_auras'),
		getActionIDs: async metadata => {
			const auras = metadata.getAuras();
			return auras
				.filter(aura => aura.data.maxStacks > 0)
				.map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, auras),
					};
				});
		},
	},
	icd_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.icd_auras'),
		getActionIDs: async metadata => {
			const auras = metadata.getAuras();
			return auras
				.filter(aura => aura.data.hasIcd)
				.map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, auras),
					};
				});
		},
	},
	exclusive_effect_auras: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.exclusive_effect_auras'),
		getActionIDs: async metadata => {
			const auras = metadata.getAuras();
			return auras
				.filter(aura => aura.data.hasExclusiveEffect)
				.map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, auras),
					};
				});
		},
	},
	// Used for non categorized lists
	spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isCastable);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells, []),
				};
			});
		},
	},
	castable_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.castable_spells'),
		getActionIDs: async metadata => {
			const castableSpells = metadata.getSpells().filter(spell => spell.data.isCastable);

			// Split up non-cooldowns, cooldowns, potions and conjured items into separate sections for easier browsing.
			const { spells, cooldowns, potions, conjuredItems } = bucket(castableSpells, spell =>
				spell.data.isPotion ? 'potions' : spell.data.isConjured ? 'conjuredItems' : spell.data.isMajorCooldown ? 'cooldowns' : 'spells',
			);

			const placeholders: Array<ActionId> = [ActionId.fromOtherId(OtherAction.OtherActionPotion)];

			return [
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.spell'),
						submenu: ['spell'],
					},
				],
				(spells || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, spells, ['spell']),
						listScope: listScopeOf(actionId),
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.cooldowns'),
						submenu: ['cooldowns'],
					},
				],
				(cooldowns || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, spells, ['cooldowns']),
						listScope: listScopeOf(actionId),
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.potions'),
						submenu: ['potions'],
					},
				],
				(potions || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, spells, ['potions']),
						listScope: listScopeOf(actionId),
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.conjured_items'),
						submenu: ['conjured_items'],
					},
				],
				(conjuredItems || []).map(actionId => {
					return {
						value: actionId.id,
						submenu: createSpellSubmenu(actionId.id, spells, ['conjured_items']),
						listScope: listScopeOf(actionId),
					};
				}),
				[
					{
						value: ActionId.fromEmpty(),
						headerText: i18n.t('rotation_tab.apl.submenus.placeholders'),
						submenu: ['placeholders'],
					},
				],
				placeholders.map(actionId => {
					return {
						value: actionId,
						submenu: ['placeholders'],
						tooltip: i18n.t('rotation_tab.apl.helpers.placeholder_tooltip'),
					};
				}),
			].flat();
		},
	},
	non_instant_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.non_instant_spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isCastable && spell.data.hasCastTime);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	friendly_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.friendly_spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isCastable && spell.data.isFriendly);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	channel_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.channel_spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isCastable && spell.data.isChanneled);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	potions: {
		defaultLabel: i18n.t('rotation_tab.apl.submenus.potions'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isPotion);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	conjured_items: {
		defaultLabel: i18n.t('rotation_tab.apl.submenus.conjured_items'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isConjured);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.dot_spells'),
		getActionIDs: async metadata => {
			const spells = metadata
				.getSpells()
				.filter(spell => spell.data.hasDot)
				// filter duplicate dot entries from RelatedDotSpell
				.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index);

			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	castable_dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.castable_dot_spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.isCastable && spell.data.hasDot);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	expected_dot_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.expected_dot_spells'),
		getActionIDs: async metadata => {
			const spells = metadata
				.getSpells()
				.filter(spell => spell.data.hasExpectedTick)
				// filter duplicate dot entries from RelatedDotSpell
				.filter((value, index, self) => self.findIndex(v => v.id.anyId() === value.id.anyId()) === index);

			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	shield_spells: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.shield_spells'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.hasShield);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
	spells_with_travelTime: {
		defaultLabel: i18n.t('rotation_tab.apl.helpers.action_id_sets.spells_with_travelTime'),
		getActionIDs: async metadata => {
			const spells = metadata.getSpells().filter(spell => spell.data.hasMissileSpeed);
			return spells.map(actionId => {
				return {
					value: actionId.id,
					submenu: createSpellSubmenu(actionId.id, spells),
				};
			});
		},
	},
};
