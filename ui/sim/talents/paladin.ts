import { PaladinTalents } from '@generated/proto/paladin';

import { newTalentsConfig, TalentsConfig } from './config';
import PaladinTalentJson from './trees/paladin.json';

export const paladinTalentsConfig: TalentsConfig<PaladinTalents> = newTalentsConfig(PaladinTalentJson);
