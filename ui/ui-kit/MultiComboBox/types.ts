import type { EnumValueConfig } from '@ui-kit/EnumPicker/types';
import type { InputConfig } from '@ui-kit/input';

export interface MultiComboBoxConfig<ModObject> extends InputConfig<ModObject, Array<number>> {
	id: string;
	values: Array<EnumValueConfig>;
	placeholder?: string;
	emptyText?: string;
	removeLabel?: string;
	openLabel?: string;
}
