import { PriestOptions_Armor as Armor } from '@generated/proto/priest';
import { ActionId } from '@sim/proto/action_id';
import { PriestSpecs } from '@sim/proto/spec_types';
import * as InputHelpers from '@ui-kit/input_helpers';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const ArmorInput = <SpecType extends PriestSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, Armor>({
		fieldName: 'armor',
		values: [
			{ value: Armor.NoArmor, tooltip: 'No Inner Fire' },
			{ actionId: ActionId.fromSpellId(10952), value: Armor.InnerFire },
		],
	});
