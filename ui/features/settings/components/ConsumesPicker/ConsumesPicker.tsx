import type { ConsumableStatOption } from '@features/settings/model/consumables';
import * as ConsumablesInputs from '@features/settings/model/consumables';
import type { Stat } from '@generated/proto/common';
import { usePlayer } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { Database } from '@sim/proto/database';
import { IconEnumPicker } from '@ui-kit/IconEnumPicker';
import { IconPicker } from '@ui-kit/IconPicker';
import { PickerGroup } from '@ui-kit/PickerGroup';
import { useMemo } from 'react';

import { ConsumeRow } from './ConsumeRow';
import { consumeConfigs } from './utils';

export interface ConsumesPickerProps {
	consumableStats: ReadonlyArray<Stat>;
	conjuredOptions: ReadonlyArray<ConsumableStatOption<number>>;
	explosiveOptions: ReadonlyArray<ConsumableStatOption<number>>;
	imbueMHOptions: ReadonlyArray<ConsumableStatOption<number>>;
	imbueOHOptions: ReadonlyArray<ConsumableStatOption<number>>;
	// Potions, explosives and the combat-only miscellany matter inside an encounter; a gear
	// planner never runs one and passes false.
	encounterConsumes?: boolean;
}

export const ConsumesPicker = ({
	consumableStats,
	conjuredOptions,
	explosiveOptions,
	imbueMHOptions,
	imbueOHOptions,
	encounterConsumes = true,
}: ConsumesPickerProps) => {
	const player = usePlayer() as Player<any>;
	const configs = useMemo(
		() => consumeConfigs(player, Database.getSync(), consumableStats, conjuredOptions, explosiveOptions, imbueMHOptions, imbueOHOptions),
		[player, consumableStats, conjuredOptions, explosiveOptions, imbueMHOptions, imbueOHOptions],
	);

	return (
		<div className="grid gap-3 max-lg:grid-cols-3 max-md:grid-cols-1">
			{encounterConsumes && (
				<ConsumeRow name="potions" configs={[configs.potion, configs.conjured]}>
					<PickerGroup variant="icons" className="justify-end" data-testid="consumes-potions">
						<IconEnumPicker modObject={player} config={configs.potion} />
						<IconEnumPicker modObject={player} config={configs.conjured} />
					</PickerGroup>
				</ConsumeRow>
			)}
			<ConsumeRow name="elixirs">
				<PickerGroup variant="icons" className="justify-end">
					<div data-testid="consumes-flasks">
						<IconEnumPicker modObject={player} config={configs.flask} />
					</div>
					<div className="empty:hidden" data-testid="consumes-battle-elixirs">
						<IconEnumPicker modObject={player} config={configs.battleElixir} />
					</div>
					<div className="empty:hidden" data-testid="consumes-guardian-elixirs">
						<IconEnumPicker modObject={player} config={configs.guardianElixir} />
					</div>
					<IconEnumPicker modObject={player} config={configs.spellPowerElixir} />
					<IconEnumPicker modObject={player} config={configs.schoolElixir} />
					<IconEnumPicker modObject={player} config={configs.defenseElixir} />
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow name="food">
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-food">
					<IconEnumPicker modObject={player} config={configs.food} />
				</PickerGroup>
			</ConsumeRow>
			{encounterConsumes && (
				<ConsumeRow name="engineering" configs={[configs.explosive, ConsumablesInputs.GoblinSapper]}>
					<PickerGroup variant="icons" className="justify-end" data-testid="consumes-engi">
						<IconEnumPicker modObject={player} config={configs.explosive} />
						<IconPicker modObject={player} config={ConsumablesInputs.GoblinSapper} />
					</PickerGroup>
				</ConsumeRow>
			)}
			<ConsumeRow name="imbue">
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-imbue">
					<IconEnumPicker modObject={player} config={configs.mhImbue} />
					{/* Vanilla gated the off-hand imbue on the five dual-wield specs. The picker's own
					    `showWhen` is not a substitute: it tests `offHand?.item.weaponSpeed !== undefined`,
					    and `weapon_speed` is a non-optional proto3 double, so it reads 0 rather than
					    undefined for a shield or an off-hand frill and the gate never closes. */}
					{player.getPlayerSpec().canDualWield && <IconEnumPicker modObject={player} config={configs.ohImbue} />}
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow
				name="buffs"
				configs={[configs.strengthBuff, configs.attackPowerBuff, configs.zanza, configs.alcohol, ConsumablesInputs.DragonbreathChili]}>
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-buffs">
					<IconEnumPicker modObject={player} config={configs.strengthBuff} />
					<IconEnumPicker modObject={player} config={configs.attackPowerBuff} />
					<IconEnumPicker modObject={player} config={configs.zanza} />
					<IconEnumPicker modObject={player} config={configs.alcohol} />
					<IconPicker modObject={player} config={ConsumablesInputs.DragonbreathChili} />
				</PickerGroup>
			</ConsumeRow>
			<ConsumeRow
				name="scrolls"
				configs={[
					ConsumablesInputs.ScrollAgi,
					ConsumablesInputs.ScrollStr,
					ConsumablesInputs.ScrollInt,
					ConsumablesInputs.ScrollSpi,
					ConsumablesInputs.ScrollArm,
				]}>
				<PickerGroup variant="icons" className="justify-end" data-testid="consumes-scrolls">
					<IconPicker modObject={player} config={ConsumablesInputs.ScrollAgi} />
					<IconPicker modObject={player} config={ConsumablesInputs.ScrollStr} />
					<IconPicker modObject={player} config={ConsumablesInputs.ScrollInt} />
					<IconPicker modObject={player} config={ConsumablesInputs.ScrollSpi} />
					<IconPicker modObject={player} config={ConsumablesInputs.ScrollArm} />
				</PickerGroup>
			</ConsumeRow>
			{encounterConsumes && (
				<ConsumeRow name="miscellaneous" configs={[ConsumablesInputs.BoglingRoot]}>
					<PickerGroup variant="icons" className="justify-end" data-testid="consumes-misc">
						<IconPicker modObject={player} config={ConsumablesInputs.BoglingRoot} />
					</PickerGroup>
				</ConsumeRow>
			)}
		</div>
	);
};
