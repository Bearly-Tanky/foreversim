import { WarlockTalents } from '@generated/proto/warlock';

import { newTalentsConfig, TalentsConfig } from './config';
import WarlockTalentJson from './trees/warlock.json';

export const warlockTalentsConfig: TalentsConfig<WarlockTalents> = newTalentsConfig(WarlockTalentJson);
