// The fight the sim starts with. Written out in both
// Encounter.defaultEncounterProto() and the store's initial encounter slice, so
// they live here instead. This module is a leaf on purpose: state/sim_store.ts
// seeds itself from it and cannot import encounter.ts without a cycle.
export const ENCOUNTER_DEFAULTS = {
	// Master's fight (the Forever site before the switch): 120s, +/-15s.
	duration: 120,
	durationVariation: 15,
	executeProportion20: 0.2,
	executeProportion25: 0.25,
	executeProportion35: 0.35,
	executeProportion45: 0.45,
	executeProportion90: 0.9,
} as const;
