package database

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/wowsims/forever/sim/core/dbcenums"
	"github.com/wowsims/forever/tools/database/dbc"
)

const RankLevel = 60

func IsWeaponDamageEffect(effect dbc.SpellEffectType) bool {
	return effect == dbcenums.E_WEAPON_DAMAGE_NOSCHOOL || effect == dbcenums.E_WEAPON_DAMAGE ||
		effect == dbcenums.E_NORMALIZED_WEAPON_DMG
}

// The client states a flat threat amount on the abilities whose point is threat: Feint and Cower
// shed it, Distracting Shot adds it. 22 ranked spells across four families carry one.
func IsThreatEffect(effect dbc.SpellEffectType) bool {
	return effect == dbcenums.E_THREAT || effect == dbcenums.E_THREAT_ALL
}

func IsPeriodicAura(aura dbc.EffectAuraType) bool {
	return aura == dbcenums.A_PERIODIC_DAMAGE || aura == dbcenums.A_PERIODIC_LEECH
}

func RequireSpellCastTimes(helper *DBHelper) error {
	if helper.tableExists("SpellCastTimes") {
		return nil
	}
	return errors.New("the client database has no SpellCastTimes table, so every generated cast time would " +
		"be zero - add \"SpellCastTimes\" to tools/database/generator-settings.json and re-run `make db`")
}

// Whether the spell carries the Passive attribute: never cast, only applied.
func SpellIsPassive(db *sql.DB, spellID int32) (bool, error) {
	return spellHasAttribute(db, spellID, dbcenums.ATTR_INDEX_BASE, dbcenums.ATTR_PASSIVE)
}

// Whether the flag is set in SpellMisc.Attributes[attrIndex]; false for a spell with no SpellMisc row.
func spellHasAttribute(db *sql.DB, spellID int32, attrIndex int, flag uint32) (bool, error) {
	var set bool
	err := scanOptional(db, fmt.Sprintf(
		`SELECT (COALESCE(json_extract(Attributes, '$[%d]'), 0) & %d) != 0 FROM SpellMisc WHERE SpellID = ? AND DifficultyID = 0`,
		attrIndex, flag), spellID, &set)
	return set, err
}

// A spell with no row in one of the optional tables is ordinary - most spells have no cooldown - and
// leaves the destination at its zero, which is what core reads as "ungated". Any other error means the
// schema moved, and silently zeroing a cast time or a range on that is the failure this loader exists
// to avoid.
func scanOptional(db *sql.DB, query string, spellID int32, dest ...any) error {
	err := db.QueryRow(query, spellID).Scan(dest...)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	return err
}
