import { PriestTalents } from '@generated/proto/priest';

import { newTalentsConfig, TalentsConfig } from './config';
import PriestTalentJson from './trees/priest.json';

export const priestTalentsConfig: TalentsConfig<PriestTalents> = newTalentsConfig(PriestTalentJson);
