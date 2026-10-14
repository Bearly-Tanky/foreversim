//go:build with_db

package main

import (
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/wowsims/forever/sim"
	"github.com/wowsims/forever/sim/core"
	"github.com/wowsims/forever/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
	goproto "google.golang.org/protobuf/proto"
)

func init() {
	sim.RegisterAll()
	replayHandler = replay
	replayRequestHandler = replayRequest
}

// replayRequest runs the exact request the sim page sent its worker (binary RaidSimRequest),
// cut to one fight with the combat log on.
func replayRequest(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	request := &proto.RaidSimRequest{}
	if err := goproto.Unmarshal(body, request); err != nil {
		http.Error(w, "request: "+err.Error(), http.StatusBadRequest)
		return
	}
	seed, _ := strconv.ParseInt(r.URL.Query().Get("seed"), 10, 64)
	if seed == 0 {
		seed = time.Now().UnixNano()
	}
	request.SimOptions = &proto.SimOptions{Iterations: 1, RandomSeed: seed, Debug: true}
	request.RequestId = ""
	runAndReply(w, request, seed)
}

func runAndReply(w http.ResponseWriter, request *proto.RaidSimRequest, seed int64) {
	result := core.RunRaidSim(request)
	if result.Error != nil {
		http.Error(w, result.Error.Message, http.StatusBadRequest)
		return
	}
	player := result.RaidMetrics.Parties[0].Players[0]
	writeJSON(w, map[string]any{
		"seed":     seed,
		"duration": request.Encounter.Duration,
		"dps":      player.Dps.Avg,
		"name":     player.Name,
		"logs":     result.Logs,
	})
}

// replay runs one fight of the settings the sim page saved (an IndividualSimSettings in JSON)
// with the combat log on, the same request the sim builds for its own timeline.
func replay(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	settings := &proto.IndividualSimSettings{}
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(body, settings); err != nil {
		http.Error(w, "settings: "+err.Error(), http.StatusBadRequest)
		return
	}
	if settings.Player == nil || settings.Encounter == nil {
		http.Error(w, "settings have no player or encounter", http.StatusBadRequest)
		return
	}
	seed, _ := strconv.ParseInt(r.URL.Query().Get("seed"), 10, 64)
	if seed == 0 {
		seed = time.Now().UnixNano()
	}

	request := &proto.RaidSimRequest{
		Raid: &proto.Raid{
			Parties: []*proto.Party{{Players: []*proto.Player{settings.Player}, Buffs: settings.PartyBuffs}},
			Buffs:   settings.RaidBuffs,
			Debuffs: settings.Debuffs,
			Tanks:   settings.Tanks,
		},
		Encounter:  settings.Encounter,
		SimOptions: &proto.SimOptions{Iterations: 1, RandomSeed: seed, Debug: true},
	}
	runAndReply(w, request, seed)
}
