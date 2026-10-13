import { DruidTalents } from '@generated/proto/druid';

import { newTalentsConfig, TalentsConfig } from './config';
import DruidTalentJson from './trees/druid.json';

export const druidTalentsConfig: TalentsConfig<DruidTalents> = newTalentsConfig(DruidTalentJson);
