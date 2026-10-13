import { RogueTalents } from '@generated/proto/rogue';

import { newTalentsConfig, TalentsConfig } from './config';
import RogueTalentJson from './trees/rogue.json';

export const rogueTalentsConfig: TalentsConfig<RogueTalents> = newTalentsConfig(RogueTalentJson);
