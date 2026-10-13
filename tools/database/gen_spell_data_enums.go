package database

import (
	"fmt"

	"github.com/wowsims/forever/sim/core/dbcenums"
)

// The two enums a store effect names. Their constants live in sim/core/dbcenums, which is the
// package the store's rows name them through.
var rankEnumTypes = []struct {
	dbcType string
	name    func(value int32) (string, bool)
}{
	{"SpellEffectType", func(value int32) (string, bool) { return dbcenums.Named(dbcenums.SpellEffectType(value)) }},
	{"EffectAuraType", func(value int32) (string, bool) { return dbcenums.Named(dbcenums.EffectAuraType(value)) }},
}

// Renders the enum values the store's rows state. A value the client data carries but dbcenums has
// not named keeps its number, marked so a reader is not left looking for a constant, rather than
// failing the build.
type rankEnumNamer struct{}

func newRankEnumNamer() *rankEnumNamer {
	return &rankEnumNamer{}
}

func enumName(dbcType string, value int32) (string, bool) {
	for _, t := range rankEnumTypes {
		if t.dbcType == dbcType {
			return t.name(value)
		}
	}
	return "", false
}

func (n *rankEnumNamer) storeEffect(value dbcenums.SpellEffectType) string {
	return n.storeName("SpellEffectType", int32(value))
}

func (n *rankEnumNamer) storeAura(value dbcenums.EffectAuraType) string {
	return n.storeName("EffectAuraType", int32(value))
}

func (n *rankEnumNamer) storeName(dbcType string, value int32) string {
	name, named := enumName(dbcType, value)
	if !named {
		return fmt.Sprintf("%d /* unnamed */", value)
	}
	return "dbcenums." + name
}
