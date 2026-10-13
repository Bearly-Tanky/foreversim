import { Class } from '@generated/proto/common';
import { LaunchStatus } from '@sim/constants/other';
import type { PlayerClass } from '@sim/player/player_class';

// The order the pre-port ui/index.html listed the classes in, which is neither alphabetical nor
// the dropdown's natural order.
export const LANDING_CLASS_ORDER: Class[] = [
	Class.ClassPriest,
	Class.ClassDruid,
	Class.ClassRogue,
	Class.ClassHunter,
	Class.ClassShaman,
	Class.ClassMage,
	Class.ClassWarlock,
	Class.ClassPaladin,
	Class.ClassWarrior,
];

// The furthest-along of the class's specs, which is what the pre-port page showed: every
// multi-spec Forever class has at least one Alpha spec and was labelled Alpha, including the three
// that also carry an Unlaunched one.
export const classLaunchStatus = (playerClass: PlayerClass<Class>): LaunchStatus =>
	Object.values(playerClass.specs).reduce<LaunchStatus>((best, spec) => Math.max(best, spec.launch.status), LaunchStatus.Unlaunched);
