// The spec-indexed type machinery: which specs a class has, and which rotation,
// talents and options proto each spec uses. Types only - the helpers that use
// them stay in ./utils.
import { Player } from '@generated/proto/api';
import { Class, Spec } from '@generated/proto/common';
import {
	BalanceDruid,
	BalanceDruid_Options,
	BalanceDruid_Rotation,
	DruidOptions,
	DruidTalents,
	FeralBearDruid,
	FeralBearDruid_Options,
	FeralBearDruid_Rotation,
	FeralCatDruid,
	FeralCatDruid_Options,
	FeralCatDruid_Rotation,
	RestorationDruid,
	RestorationDruid_Options,
	RestorationDruid_Rotation,
} from '@generated/proto/druid';
import { Hunter, Hunter_Options, Hunter_Rotation, HunterOptions, HunterTalents } from '@generated/proto/hunter';
import { Mage, Mage_Options, Mage_Rotation, MageOptions, MageTalents } from '@generated/proto/mage';
import {
	HolyPaladin,
	HolyPaladin_Options,
	HolyPaladin_Rotation,
	PaladinOptions,
	PaladinTalents,
	ProtectionPaladin,
	ProtectionPaladin_Options,
	ProtectionPaladin_Rotation,
	RetributionPaladin,
	RetributionPaladin_Options,
	RetributionPaladin_Rotation,
} from '@generated/proto/paladin';
import {
	DpsPriest,
	DpsPriest_Options,
	DpsPriest_Rotation,
	HealerPriest,
	HealerPriest_Options,
	HealerPriest_Rotation,
	PriestOptions,
	PriestTalents,
} from '@generated/proto/priest';
import { Rogue, Rogue_Options, Rogue_Rotation, RogueOptions, RogueTalents } from '@generated/proto/rogue';
import {
	ElementalShaman,
	ElementalShaman_Options,
	ElementalShaman_Rotation,
	EnhancementShaman,
	EnhancementShaman_Options,
	EnhancementShaman_Rotation,
	RestorationShaman,
	RestorationShaman_Options,
	RestorationShaman_Rotation,
	ShamanOptions,
	ShamanTalents,
} from '@generated/proto/shaman';
import { Warlock, Warlock_Options, Warlock_Rotation, WarlockOptions, WarlockTalents } from '@generated/proto/warlock';
import {
	DpsWarrior,
	DpsWarrior_Options,
	DpsWarrior_Rotation,
	ProtectionWarrior,
	ProtectionWarrior_Options,
	ProtectionWarrior_Rotation,
	WarriorOptions,
	WarriorTalents,
} from '@generated/proto/warrior';

// Placeholder classes to fill the Unknown Spec Type Functions entry below
type UnknownSpecs = Spec.SpecUnknown;
export class UnknownRotation {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownTalents {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownClassOptions {
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {}
}
export class UnknownSpecOptions {
	classOptions: UnknownClassOptions;
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	constructor() {
		this.classOptions = new UnknownClassOptions();
	}
}

export type DruidSpecs = Spec.SpecBalanceDruid | Spec.SpecFeralCatDruid | Spec.SpecFeralBearDruid | Spec.SpecRestorationDruid;
export type HunterSpecs = Spec.SpecHunter;
export type MageSpecs = Spec.SpecMage;
export type PaladinSpecs = Spec.SpecHolyPaladin | Spec.SpecRetributionPaladin | Spec.SpecProtectionPaladin;
export type PriestSpecs = Spec.SpecDpsPriest | Spec.SpecHealerPriest;
export type RogueSpecs = Spec.SpecRogue;
export type ShamanSpecs = Spec.SpecElementalShaman | Spec.SpecEnhancementShaman | Spec.SpecRestorationShaman;
export type WarlockSpecs = Spec.SpecWarlock;
export type WarriorSpecs = Spec.SpecDpsWarrior | Spec.SpecProtectionWarrior;

export type ClassSpecs<T extends Class> = T extends Class.ClassDruid
	? DruidSpecs
	: T extends Class.ClassHunter
		? HunterSpecs
		: T extends Class.ClassMage
			? MageSpecs
			: T extends Class.ClassPaladin
				? PaladinSpecs
				: T extends Class.ClassPriest
					? PriestSpecs
					: T extends Class.ClassRogue
						? RogueSpecs
						: T extends Class.ClassShaman
							? ShamanSpecs
							: T extends Class.ClassWarlock
								? WarlockSpecs
								: T extends Class.ClassWarrior
									? WarriorSpecs
									: // Should never reach this case
										UnknownSpecs;

export type SpecClasses<T extends Spec> =
	// Druid
	T extends DruidSpecs
		? Class.ClassDruid
		: // Hunter
			T extends HunterSpecs
			? Class.ClassHunter
			: // Mage
				T extends MageSpecs
				? Class.ClassMage
				: // Paladin
					T extends PaladinSpecs
					? Class.ClassPaladin
					: // Priest
						T extends PriestSpecs
						? Class.ClassPriest
						: // Rogue
							T extends RogueSpecs
							? Class.ClassRogue
							: // Shaman
								T extends ShamanSpecs
								? Class.ClassShaman
								: // Warlock
									T extends WarlockSpecs
									? Class.ClassWarlock
									: // Warrior
										T extends WarriorSpecs
										? Class.ClassWarrior
										: // Should never reach this case
											Class.ClassUnknown;

export type SpecRotation<T extends Spec> =
	// Druid
	T extends Spec.SpecBalanceDruid
		? BalanceDruid_Rotation
		: T extends Spec.SpecFeralCatDruid
			? FeralCatDruid_Rotation
			: T extends Spec.SpecFeralBearDruid
				? FeralBearDruid_Rotation
				: T extends Spec.SpecRestorationDruid
					? RestorationDruid_Rotation
					: // Hunter
						T extends Spec.SpecHunter
						? Hunter_Rotation
						: // Mage
							T extends Spec.SpecMage
							? Mage_Rotation
							: // Paladin
								T extends Spec.SpecHolyPaladin
								? HolyPaladin_Rotation
								: T extends Spec.SpecProtectionPaladin
									? ProtectionPaladin_Rotation
									: T extends Spec.SpecRetributionPaladin
										? RetributionPaladin_Rotation
										: // Priest
											T extends Spec.SpecDpsPriest
											? DpsPriest_Rotation
											: T extends Spec.SpecHealerPriest
												? HealerPriest_Rotation
												: // Rogue
													T extends Spec.SpecRogue
													? Rogue_Rotation
													: // Shaman
														T extends Spec.SpecElementalShaman
														? ElementalShaman_Rotation
														: T extends Spec.SpecEnhancementShaman
															? EnhancementShaman_Rotation
															: T extends Spec.SpecRestorationShaman
																? RestorationShaman_Rotation
																: // Warlock
																	T extends Spec.SpecWarlock
																	? Warlock_Rotation
																	: // Warrior
																		T extends Spec.SpecDpsWarrior
																		? DpsWarrior_Rotation
																		: T extends Spec.SpecProtectionWarrior
																			? ProtectionWarrior_Rotation
																			: // Should never reach this case
																				UnknownRotation;

export type SpecTalents<T extends Spec> =
	// Druid
	T extends DruidSpecs
		? DruidTalents
		: // Hunter
			T extends HunterSpecs
			? HunterTalents
			: // Mage
				T extends MageSpecs
				? MageTalents
				: // Paladin
					T extends PaladinSpecs
					? PaladinTalents
					: // Priest
						T extends PriestSpecs
						? PriestTalents
						: // Rogue
							T extends RogueSpecs
							? RogueTalents
							: // Shaman
								T extends ShamanSpecs
								? ShamanTalents
								: // Warlock
									T extends WarlockSpecs
									? WarlockTalents
									: // Warrior
										T extends WarriorSpecs
										? WarriorTalents
										: // Should never reach this case
											UnknownTalents;

export type ClassOptions<T extends Spec> =
	// Druid
	T extends DruidSpecs
		? DruidOptions
		: // Hunter
			T extends HunterSpecs
			? HunterOptions
			: // Mage
				T extends MageSpecs
				? MageOptions
				: // Paladin
					T extends PaladinSpecs
					? PaladinOptions
					: // Priest
						T extends PriestSpecs
						? PriestOptions
						: // Rogue
							T extends RogueSpecs
							? RogueOptions
							: // Shaman
								T extends ShamanSpecs
								? ShamanOptions
								: // Warlock
									T extends WarlockSpecs
									? WarlockOptions
									: // Warrior
										T extends WarriorSpecs
										? WarriorOptions
										: // Should never reach this case
											UnknownClassOptions;

export type SpecOptions<T extends Spec> =
	// Druid
	T extends Spec.SpecBalanceDruid
		? BalanceDruid_Options
		: T extends Spec.SpecFeralCatDruid
			? FeralCatDruid_Options
			: T extends Spec.SpecFeralBearDruid
				? FeralBearDruid_Options
				: T extends Spec.SpecRestorationDruid
					? RestorationDruid_Options
					: // Hunter
						T extends Spec.SpecHunter
						? Hunter_Options
						: // Mage
							T extends Spec.SpecMage
							? Mage_Options
							: // Paladin
								T extends Spec.SpecHolyPaladin
								? HolyPaladin_Options
								: T extends Spec.SpecProtectionPaladin
									? ProtectionPaladin_Options
									: T extends Spec.SpecRetributionPaladin
										? RetributionPaladin_Options
										: // Priest
											T extends Spec.SpecDpsPriest
											? DpsPriest_Options
											: T extends Spec.SpecHealerPriest
												? HealerPriest_Options
												: // Rogue
													T extends Spec.SpecRogue
													? Rogue_Options
													: // Shaman
														T extends Spec.SpecElementalShaman
														? ElementalShaman_Options
														: T extends Spec.SpecEnhancementShaman
															? EnhancementShaman_Options
															: T extends Spec.SpecRestorationShaman
																? RestorationShaman_Options
																: // Warlock
																	T extends Spec.SpecWarlock
																	? Warlock_Options
																	: // Warrior
																		T extends Spec.SpecDpsWarrior
																		? DpsWarrior_Options
																		: T extends Spec.SpecProtectionWarrior
																			? ProtectionWarrior_Options
																			: // Should never reach this case
																				UnknownSpecOptions;

export type SpecType<T extends Spec> =
	// Druid
	T extends Spec.SpecBalanceDruid
		? BalanceDruid
		: T extends Spec.SpecFeralCatDruid
			? FeralCatDruid
			: T extends Spec.SpecFeralBearDruid
				? FeralBearDruid
				: T extends Spec.SpecRestorationDruid
					? RestorationDruid
					: // Hunter
						T extends Spec.SpecHunter
						? Hunter
						: // Mage
							T extends Spec.SpecMage
							? Mage
							: // Paladin
								T extends Spec.SpecHolyPaladin
								? HolyPaladin
								: T extends Spec.SpecProtectionPaladin
									? ProtectionPaladin
									: T extends Spec.SpecRetributionPaladin
										? RetributionPaladin
										: // Priest
											T extends Spec.SpecDpsPriest
											? DpsPriest
											: T extends Spec.SpecHealerPriest
												? HealerPriest
												: // Rogue
													T extends Spec.SpecRogue
													? Rogue
													: // Shaman
														T extends Spec.SpecElementalShaman
														? ElementalShaman
														: T extends Spec.SpecEnhancementShaman
															? EnhancementShaman
															: T extends Spec.SpecRestorationShaman
																? RestorationShaman
																: // Warlock
																	T extends Spec.SpecWarlock
																	? Warlock
																	: // Warrior
																		T extends Spec.SpecDpsWarrior
																		? DpsWarrior
																		: T extends Spec.SpecProtectionWarrior
																			? ProtectionWarrior
																			: // Should never reach this case
																				Spec.SpecUnknown;

export type SpecTypeFunctions<SpecType extends Spec> = {
	rotationCreate: () => SpecRotation<SpecType>;
	rotationEquals: (a: SpecRotation<SpecType>, b: SpecRotation<SpecType>) => boolean;
	rotationCopy: (a: SpecRotation<SpecType>) => SpecRotation<SpecType>;
	rotationToJson: (a: SpecRotation<SpecType>) => any;
	rotationFromJson: (obj: any) => SpecRotation<SpecType>;

	talentsCreate: () => SpecTalents<SpecType>;
	talentsEquals: (a: SpecTalents<SpecType>, b: SpecTalents<SpecType>) => boolean;
	talentsCopy: (a: SpecTalents<SpecType>) => SpecTalents<SpecType>;
	talentsToJson: (a: SpecTalents<SpecType>) => any;
	talentsFromJson: (obj: any) => SpecTalents<SpecType>;

	optionsCreate: () => SpecOptions<SpecType>;
	optionsEquals: (a: SpecOptions<SpecType>, b: SpecOptions<SpecType>) => boolean;
	optionsCopy: (a: SpecOptions<SpecType>) => SpecOptions<SpecType>;
	optionsToJson: (a: SpecOptions<SpecType>) => any;
	optionsFromJson: (obj: any) => SpecOptions<SpecType>;
	optionsFromPlayer: (player: Player) => SpecOptions<SpecType>;
};
