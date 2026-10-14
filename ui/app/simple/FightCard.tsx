import { Debuffs, IndividualBuffs, PartyBuffs, RaidBuffs } from '@generated/proto/buffs';
import { ConsumesSpec, Target as TargetProto } from '@generated/proto/common';
import { useSimHost } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { batch } from '@sim/state/batch';
import { useStore } from 'zustand';

import { Card, Field } from './Card';
import { Segmented } from './controls';

type Support = 'none' | 'raid';
type Consumables = 'off' | 'on';

const LENGTHS = [60, 120, 180, 300];
const ENEMY_COUNTS = [1, 2, 3, 5];

const formatLength = (seconds: number) => (seconds % 60 === 0 ? `${seconds / 60} min` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);

export const FightCard = () => {
	const { player, sim, individualConfig: config } = useSimHost();
	const defaults = config.defaults;
	const party = player.getParty()!;

	const raidBuffs = useStore(sim.store, s => s.raid.buffs);
	const debuffs = useStore(sim.store, s => s.raid.debuffs);
	const partyBuffs = useStore(sim.store, s => s.raid.partyBuffs[party.getIndex()]);
	const individualBuffs = usePlayerStore('buffs');
	const consumables = usePlayerStore('consumables');
	const duration = useStore(sim.store, s => s.encounter.duration);
	const targets = useStore(sim.store, s => s.encounter.targets);

	const isSupport = (raid: RaidBuffs, partyValue: PartyBuffs, individual: IndividualBuffs, debuff: Debuffs) =>
		RaidBuffs.equals(raidBuffs, raid) &&
		PartyBuffs.equals(partyBuffs, partyValue) &&
		IndividualBuffs.equals(individualBuffs, individual) &&
		Debuffs.equals(debuffs, debuff);
	const support: Support | null = isSupport(defaults.raidBuffs, defaults.partyBuffs, defaults.individualBuffs, defaults.debuffs)
		? 'raid'
		: isSupport(RaidBuffs.create(), PartyBuffs.create(), IndividualBuffs.create(), Debuffs.create())
			? 'none'
			: null;

	const setSupport = (value: Support) =>
		batch(() => {
			const raid = value === 'raid';
			sim.raid.setBuffs(raid ? defaults.raidBuffs : RaidBuffs.create());
			party.setBuffs(raid ? defaults.partyBuffs : PartyBuffs.create());
			player.setBuffs(raid ? defaults.individualBuffs : IndividualBuffs.create());
			sim.raid.setDebuffs(raid ? defaults.debuffs : Debuffs.create());
		});

	const consumablesState: Consumables | null = ConsumesSpec.equals(consumables, defaults.consumables)
		? 'on'
		: ConsumesSpec.equals(consumables, ConsumesSpec.create())
			? 'off'
			: null;

	const setEnemies = (count: number) => {
		const first = targets[0];
		sim.encounter.setTargets(Array.from({ length: count }, (_, index) => (index < targets.length ? targets[index] : TargetProto.clone(first))));
	};

	return (
		<Card title="Fight" testId="simple-fight">
			<div className="grid gap-5 sm:grid-cols-2">
				<Field
					label="Raid support"
					hint={support === null ? 'Custom buffs, set in the advanced view.' : 'Buffs from other players and debuffs on the enemy.'}>
					<Segmented<Support>
						label="Raid support"
						value={support}
						onChange={setSupport}
						options={[
							{ value: 'none', label: 'None' },
							{ value: 'raid', label: 'Full raid' },
						]}
						testId="simple-support"
					/>
				</Field>
				<Field
					label="Consumables"
					hint={consumablesState === null ? 'Custom consumables, set in the advanced view.' : 'Flasks, elixirs, food and potions.'}>
					<Segmented<Consumables>
						label="Consumables"
						value={consumablesState}
						onChange={value => player.setConsumes(value === 'on' ? defaults.consumables : ConsumesSpec.create())}
						options={[
							{ value: 'off', label: 'None' },
							{ value: 'on', label: 'Recommended' },
						]}
						testId="simple-consumables"
					/>
				</Field>
				<Field label="Fight length" hint={LENGTHS.includes(duration) ? undefined : `Currently ${formatLength(duration)}.`}>
					<Segmented<number>
						label="Fight length"
						value={LENGTHS.includes(duration) ? duration : null}
						onChange={value => sim.encounter.setDuration(value)}
						options={LENGTHS.map(value => ({ value, label: formatLength(value) }))}
						testId="simple-length"
					/>
				</Field>
				<Field label="Enemies" hint="More enemies rewards abilities that hit several targets.">
					<Segmented<number>
						label="Enemies"
						value={ENEMY_COUNTS.includes(targets.length) ? targets.length : null}
						onChange={setEnemies}
						options={ENEMY_COUNTS.map(value => ({ value, label: String(value) }))}
						testId="simple-enemies"
					/>
				</Field>
			</div>
		</Card>
	);
};
