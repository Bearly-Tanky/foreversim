import { ShamanTalents } from '@generated/proto/shaman';

import { newTalentsConfig, TalentsConfig } from './config';
import ShamanTalentJson from './trees/shaman.json';

export const shamanTalentsConfig: TalentsConfig<ShamanTalents> = newTalentsConfig(ShamanTalentJson);
