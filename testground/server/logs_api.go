package main

// The combat log endpoints: the logs in the game folder, the fights in one, one player's fight.

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	logCacheMu sync.Mutex
	logCache   struct {
		key    string
		reader *logReader
		lines  []logLine
		fights []*logFight
	}
)

func (a *app) logsDir() (string, error) {
	folder, err := a.gameFolder()
	if err != nil {
		return "", err
	}
	return filepath.Join(folder, "Logs"), nil
}

// handleLogs: GET /api/logs → the combat logs, newest first.
func (a *app) handleLogs(w http.ResponseWriter, _ *http.Request) {
	dir, err := a.logsDir()
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	paths, _ := filepath.Glob(filepath.Join(dir, "WoWCombatLog*.txt"))
	files := []map[string]any{}
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			continue
		}
		files = append(files, map[string]any{"name": filepath.Base(p), "size": info.Size(), "modified": info.ModTime().Unix()})
	}
	sort.Slice(files, func(i, j int) bool { return files[i]["modified"].(int64) > files[j]["modified"].(int64) })
	writeJSON(w, map[string]any{"dir": dir, "files": files})
}

// loadLog reads a log once and keeps it while it is the one being looked at.
func (a *app) loadLog(name string) (*logReader, []logLine, []*logFight, error) {
	dir, err := a.logsDir()
	if err != nil {
		return nil, nil, nil, err
	}
	name = filepath.Base(name)
	if !strings.HasPrefix(name, "WoWCombatLog") {
		return nil, nil, nil, os.ErrNotExist
	}
	path := filepath.Join(dir, name)
	info, err := os.Stat(path)
	if err != nil {
		return nil, nil, nil, err
	}
	key := path + "|" + strconv.FormatInt(info.Size(), 10) + "|" + info.ModTime().Format(time.RFC3339Nano)
	logCacheMu.Lock()
	defer logCacheMu.Unlock()
	if logCache.key != key {
		r, lines, err := readLog(path)
		if err != nil {
			return nil, nil, nil, err
		}
		logCache.key, logCache.reader, logCache.lines, logCache.fights = key, r, lines, r.fights(lines)
	}
	return logCache.reader, logCache.lines, logCache.fights, nil
}

// handleLogFights: GET /api/logs/fights?file=… → the fights in it.
func (a *app) handleLogFights(w http.ResponseWriter, r *http.Request) {
	reader, _, fights, err := a.loadLog(r.URL.Query().Get("file"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"version": reader.version, "advanced": reader.advanced, "fights": fights})
}

// handleLogEvents: GET /api/logs/events?file=…&fight=N&guid=… → one player's fight.
func (a *app) handleLogEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	reader, lines, fights, err := a.loadLog(q.Get("file"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	id, _ := strconv.Atoi(q.Get("fight"))
	if id < 0 || id >= len(fights) {
		http.Error(w, "no such fight", http.StatusNotFound)
		return
	}
	fight := fights[id]
	guid := q.Get("guid")
	var player *logPlayer
	for _, p := range fight.Players {
		if p.GUID == guid {
			player = p
		}
	}
	if player == nil {
		http.Error(w, "that player did no damage in this fight", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"fight": fight, "player": player, "events": reader.playerEvents(lines, fight, guid)})
}
