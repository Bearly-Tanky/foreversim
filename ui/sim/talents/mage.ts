import { MageTalents } from '@generated/proto/mage';

import { newTalentsConfig, TalentsConfig } from './config';
import MageTalentJson from './trees/mage.json';

export const mageTalentsConfig: TalentsConfig<MageTalents> = newTalentsConfig(MageTalentJson);
