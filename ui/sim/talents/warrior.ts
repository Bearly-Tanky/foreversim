import { WarriorTalents } from '@generated/proto/warrior';

import { newTalentsConfig, TalentsConfig } from './config';
import WarriorTalentJson from './trees/warrior.json';

export const warriorTalentsConfig: TalentsConfig<WarriorTalents> = newTalentsConfig(WarriorTalentJson);
