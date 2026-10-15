package main

import (
	"encoding/json"
	"testing"
)

// The shape WoW writes: tabs, ["key"] = value, list entries with -- [n] comments.
const savedSample = `
ForeverSimDB = {
	["characters"] = {
		["Thrall-Nightslayer"] = {
			["raceID"] = 2,
			["classID"] = 1,
			["name"] = "Thrall",
			["gear"] = {
				["slot14"] = {
					["id"] = 19019,
					["enchant"] = 1900,
				},
				["slot0"] = {
					["id"] = 12640,
					["gems"] = {
						0, -- [1]
						0, -- [2]
						0, -- [3]
						0, -- [4]
					},
				},
			},
			["talents"] = {
				{
					["node"] = 101,
					["definition"] = 135489,
					["ranks"] = 3,
				}, -- [1]
			},
			["realm"] = "Night\"slayer",
			["saved"] = 1792100000,
			["empty"] = {
			},
		},
	},
	["version"] = "1.0.0",
}
OtherVar = nil
`

func TestParseSavedVariables(t *testing.T) {
	vars, err := parseSavedVariables(savedSample)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := json.Marshal(vars["ForeverSimDB"])
	want := `{"characters":{"Thrall-Nightslayer":{"classID":1,"empty":{},"gear":{"slot0":{"gems":[0,0,0,0],"id":12640},"slot14":{"enchant":1900,"id":19019}},"name":"Thrall","raceID":2,"realm":"Night\"slayer","saved":1792100000,"talents":[{"definition":135489,"node":101,"ranks":3}]}},"version":"1.0.0"}`
	if string(got) != want {
		t.Errorf("got  %s\nwant %s", got, want)
	}
	if _, ok := vars["OtherVar"]; !ok {
		t.Error("OtherVar missing")
	}
}
