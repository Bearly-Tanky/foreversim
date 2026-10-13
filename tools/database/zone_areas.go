package database

import (
	"database/sql"
	"fmt"
	"slices"

	"github.com/wowsims/forever/sim/core/proto"
	"github.com/wowsims/forever/sim/core/spelldata"
)

type areaGroupMember struct {
	GroupID int32
	AreaID  int32
}

type areaTableRow struct {
	ID       int32
	Name     string
	ParentID int32
}

// Adds each zone's kinds of area from AreaGroupMember. A repeated name folds into the zone already listed.
func LoadZoneAreas(db *WowDatabase, dbHelper *DBHelper) error {
	members, err := LoadRows(dbHelper.db, `SELECT AreaGroupID, AreaID FROM AreaGroupMember ORDER BY AreaGroupID, AreaID`,
		func(rows *sql.Rows) (areaGroupMember, error) {
			var m areaGroupMember
			return m, rows.Scan(&m.GroupID, &m.AreaID)
		})
	if err != nil {
		return fmt.Errorf("loading AreaGroupMember: %w", err)
	}
	areas, err := LoadRows(dbHelper.db, `SELECT ID, AreaName_lang, ParentAreaID FROM AreaTable`,
		func(rows *sql.Rows) (areaTableRow, error) {
			var a areaTableRow
			return a, rows.Scan(&a.ID, &a.Name, &a.ParentID)
		})
	if err != nil {
		return fmt.Errorf("loading AreaTable: %w", err)
	}
	applyZoneAreas(db.Zones, members, areas)
	return nil
}

func applyZoneAreas(zones map[int32]*proto.UIZone, members []areaGroupMember, areas []areaTableRow) {
	byID := make(map[int32]areaTableRow, len(areas))
	zoneByName := map[string]int32{}
	for _, zone := range zones {
		if existing, ok := zoneByName[zone.Name]; !ok || zone.Id < existing {
			zoneByName[zone.Name] = zone.Id
		}
	}
	for _, area := range areas {
		byID[area.ID] = area
	}
	topLevelByName := map[string]int32{}
	for _, area := range areas {
		if existing, ok := topLevelByName[area.Name]; area.ParentID == 0 && (!ok || area.ID < existing) {
			topLevelByName[area.Name] = area.ID
		}
	}

	for _, m := range members {
		areaType := spelldata.AreaTypeOfGroup(m.GroupID)
		area, known := byID[m.AreaID]
		if areaType == proto.AreaType_AreaTypeUnknown || !known {
			continue
		}

		zoneID := m.AreaID
		if _, present := zones[zoneID]; !present {
			if named, ok := zoneByName[area.Name]; ok {
				zoneID = named
			} else if top, ok := topLevelByName[area.Name]; ok {
				zoneID = top
			}
			if _, present := zones[zoneID]; !present {
				zones[zoneID] = &proto.UIZone{Id: zoneID, Name: area.Name}
				zoneByName[area.Name] = zoneID
			}
		}
		zone := zones[zoneID]
		if !slices.Contains(zone.AreaTypes, areaType) {
			zone.AreaTypes = append(zone.AreaTypes, areaType)
			slices.Sort(zone.AreaTypes)
		}
	}
}
