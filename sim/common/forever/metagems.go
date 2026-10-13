package forever

// No meta gems are modelled. This build ships no gem system at all: GemProperties.db2
// extracts to 212 bytes with zero rows, and none of the 22 gem item ids this file used
// to register appears in ItemSparse, which holds 19,171 items. The absence is the
// client's, not the extractor's.
