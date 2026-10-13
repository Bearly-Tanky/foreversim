import { HunterTalents } from '@generated/proto/hunter';

import { newTalentsConfig, TalentsConfig } from './config';
import HunterTalentJson from './trees/hunter.json';

export const hunterTalentsConfig: TalentsConfig<HunterTalents> = newTalentsConfig(HunterTalentJson);
