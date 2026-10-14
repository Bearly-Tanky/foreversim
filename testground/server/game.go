// Reading the WoW install: game files by file ID, client tables as JSON rows, sound files.
package main

import (
	"bufio"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/wowsims/forever/tools/db2tool/dbd"
	"github.com/wowsims/forever/tools/db2tool/tact"
	"github.com/wowsims/forever/tools/db2tool/wdc"
)

type server struct {
	build    *tact.Build
	product  string
	listfile *tact.Listfile
	hotfixes *wdc.HotfixReader
	cacheDir string
	dbdDir   string

	mu     sync.Mutex
	tables map[string]*table

	soundOnce  sync.Once
	soundFiles []soundFile

	cdnOnce sync.Once
	cdn     *tact.Build
	cdnErr  error
}

// open reads the install at wowDir. Everything extracted or downloaded is kept under dataDir:
// cache/ (files and tables), dbd/ (table definitions), the trimmed file list and the TACT keys.
func open(wowDir, product, dataDir string) (*server, error) {
	cacheDir := filepath.Join(dataDir, "cache")
	build, err := tact.Open(wowDir, product)
	if err != nil {
		return nil, err
	}
	log.Printf("Reading %s %s (build %d)", build.Entry.Product, build.Entry.Version, build.BuildNumber)

	s := &server{
		build:    build,
		product:  product,
		listfile: &tact.Listfile{Path: filepath.Join(dataDir, "listfile.csv")},
		cacheDir: cacheDir,
		dbdDir:   filepath.Join(dataDir, "dbd"),
		tables:   map[string]*table{},
	}
	// Extracted files are kept by file ID, and a game patch can change a file under the same ID:
	// a new build starts the cache afresh.
	buildFile := filepath.Join(cacheDir, "build.txt")
	if old, _ := os.ReadFile(buildFile); strings.TrimSpace(string(old)) != strconv.Itoa(int(build.BuildNumber)) {
		if len(old) > 0 {
			log.Printf("The game was updated (build %s to %d): clearing the file cache", strings.TrimSpace(string(old)), build.BuildNumber)
		}
		_ = os.RemoveAll(filepath.Join(cacheDir, "files"))
		_ = os.WriteFile(buildFile, []byte(strconv.Itoa(int(build.BuildNumber))), 0o644)
	}
	if err := os.MkdirAll(filepath.Join(cacheDir, "files"), 0o755); err != nil {
		return nil, err
	}
	if readers, err := wdc.LoadHotfixCaches(filepath.Join(dataDir, "caches"), wowDir); err == nil {
		s.hotfixes = readers[build.BuildNumber]
	}
	if err := s.loadKeys(filepath.Join(dataDir, "TACTKeys.txt")); err != nil {
		return nil, err
	}
	return s, nil
}

// loadKeys gathers the keys for encrypted files and table sections, the way db2tool does: the
// client's own TactKey tables, then the community list.
func (s *server) loadKeys(keyFile string) error {
	keys := tact.NewKeyStore()
	lookups, err := s.table("TactKeyLookup")
	if err != nil {
		return err
	}
	tactKeys, err := s.table("TactKey")
	if err != nil {
		return err
	}
	names := map[int32]uint64{}
	for i := range lookups.rows {
		if raw := bytesOf(lookups.value(i, "TACTID")); len(raw) == 8 {
			names[lookups.rows[i].ID] = binary.LittleEndian.Uint64(raw)
		}
	}
	for i := range tactKeys.rows {
		raw := bytesOf(tactKeys.value(i, "Key"))
		if name, ok := names[tactKeys.rows[i].ID]; ok && len(raw) == 16 {
			var key [16]byte
			copy(key[:], raw)
			keys.Add(name, key)
		}
	}
	if err := tact.RefreshKeyFile(keyFile, ""); err == nil {
		_, _ = keys.LoadKeyFile(keyFile)
	}
	s.build.Keys = keys
	// The key tables were read before the keys existed; nothing else has been.
	s.tables = map[string]*table{}
	return nil
}

// fileBytes reads a game file, from the cache when it has been read before.
func (s *server) fileBytes(fdid uint32) ([]byte, error) {
	path := filepath.Join(s.cacheDir, "files", strconv.FormatUint(uint64(fdid), 10))
	if data, err := os.ReadFile(path); err == nil {
		return data, nil
	}
	data, err := s.build.OpenFileByFDID(fdid)
	if err != nil {
		// The launcher streams in data the game has not needed yet, so a file can be missing from
		// the install; Blizzard's download servers have every file of the build.
		cdn, cdnErr := s.openCDN()
		if cdnErr != nil {
			return nil, fmt.Errorf("%w (and the download servers: %v)", err, cdnErr)
		}
		if data, err = cdn.OpenFileByFDID(fdid); err != nil {
			return nil, err
		}
	}
	_ = os.WriteFile(path, data, 0o644)
	return data, nil
}

// openCDN opens the product's current build on the download servers the first time a file is
// missing locally. Its indexes are kept under cache/cdn, so later runs start quickly.
func (s *server) openCDN() (*tact.Build, error) {
	s.cdnOnce.Do(func() {
		log.Printf("A file is missing from the install; opening the download servers")
		s.cdn, s.cdnErr = tact.OpenCDN(s.product, "eu", filepath.Join(s.cacheDir, "cdn"))
		if s.cdnErr == nil {
			s.cdn.Keys = s.build.Keys
			log.Printf("Download servers have %s", s.cdn.Entry.Version)
		}
	})
	return s.cdn, s.cdnErr
}

type table struct {
	name  string
	cols  map[string]int
	names []string
	rows  []wdc.Row
	byID  map[int32]int
	index map[string]map[int64][]int
}

func (s *server) table(name string) (*table, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t, ok := s.tables[name]; ok {
		return t, nil
	}
	fdid, err := s.listfile.GetFDID("dbfilesclient/" + strings.ToLower(name) + ".db2")
	if err != nil {
		return nil, err
	}
	data, err := s.build.OpenFileByFDID(fdid)
	if err != nil {
		return nil, fmt.Errorf("table %s: %w", name, err)
	}
	path := filepath.Join(s.cacheDir, name+".db2")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return nil, err
	}
	raw, err := wdc.ReadFile(path)
	if err != nil {
		return nil, err
	}
	dbdPath, err := dbd.FetchCached(s.dbdDir, name)
	if err != nil {
		return nil, err
	}
	def, err := dbd.ReadFile(dbdPath, true)
	if err != nil {
		return nil, err
	}
	version, err := dbd.SelectVersion(def, s.build.BuildNumber)
	if err != nil {
		return nil, fmt.Errorf("table %s: %w", name, err)
	}
	decoded, err := raw.DecodeRows(def, version, s.build.BuildNumber)
	if err != nil {
		return nil, fmt.Errorf("table %s: %w", name, err)
	}
	if s.hotfixes != nil {
		if err := s.hotfixes.ApplyHotfixes(raw, def, version, s.build.BuildNumber, decoded); err != nil {
			return nil, fmt.Errorf("table %s: hotfixes: %w", name, err)
		}
	}

	t := &table{name: name, cols: map[string]int{}, rows: decoded.Rows, byID: map[int32]int{}, index: map[string]map[int64][]int{}}
	for i, d := range version.Definitions {
		t.cols[d.Name] = i
		t.names = append(t.names, d.Name)
	}
	for i, r := range t.rows {
		t.byID[r.ID] = i
	}
	s.tables[name] = t
	log.Printf("Loaded %s: %d rows", name, len(t.rows))
	return t, nil
}

func (t *table) value(i int, col string) any {
	c, ok := t.cols[col]
	if !ok {
		return nil
	}
	return t.rows[i].Values[c]
}

func (t *table) object(i int) map[string]any {
	out := map[string]any{"ID": t.rows[i].ID}
	for c, name := range t.names {
		out[name] = t.rows[i].Values[c]
	}
	return out
}

// lookup returns the rows whose column holds n, or holds it in any element of an array.
func (t *table) lookup(col string, n int64) []int {
	idx, ok := t.index[col]
	if !ok {
		idx = map[int64][]int{}
		c, known := t.cols[col]
		for i, r := range t.rows {
			if !known {
				idx[int64(r.ID)] = append(idx[int64(r.ID)], i)
				continue
			}
			for _, v := range ints(r.Values[c]) {
				idx[v] = append(idx[v], i)
			}
		}
		t.index[col] = idx
	}
	return idx[n]
}

func ints(v any) []int64 {
	switch a := v.(type) {
	case int64:
		return []int64{a}
	case uint64:
		return []int64{int64(a)}
	case []int64:
		return a
	case []uint64:
		out := make([]int64, len(a))
		for i, x := range a {
			out[i] = int64(x)
		}
		return out
	}
	return nil
}

func bytesOf(v any) []byte {
	a := ints(v)
	out := make([]byte, len(a))
	for i, x := range a {
		out[i] = byte(x)
	}
	return out
}

// sounds lists the game's sound files under a folder whose names contain every given word:
// GET /api/sounds?dir=sound/item/weapons/sword1h/&has=wood
func (s *server) sounds(w http.ResponseWriter, r *http.Request) {
	s.soundOnce.Do(func() {
		f, err := os.Open(s.listfile.Path)
		if err != nil {
			return
		}
		defer f.Close()
		scanner := bufio.NewScanner(f)
		scanner.Buffer(make([]byte, 1<<20), 1<<20)
		for scanner.Scan() {
			line := scanner.Text()
			id, path, ok := strings.Cut(line, ";")
			if !ok || !strings.HasPrefix(path, "sound/") || !strings.HasSuffix(path, ".ogg") {
				continue
			}
			fdid, err := strconv.ParseUint(id, 10, 32)
			if err == nil {
				s.soundFiles = append(s.soundFiles, soundFile{uint32(fdid), path})
			}
		}
	})
	dir := strings.ToLower(r.URL.Query().Get("dir"))
	words := strings.Fields(strings.ToLower(r.URL.Query().Get("has")))
	out := []map[string]any{}
	for _, f := range s.soundFiles {
		if !strings.HasPrefix(f.path, dir) {
			continue
		}
		name := f.path[strings.LastIndexByte(f.path, '/')+1:]
		match := true
		for _, word := range words {
			if strings.HasPrefix(word, "-") {
				match = match && !strings.Contains(name, word[1:])
			} else {
				match = match && strings.Contains(name, word)
			}
		}
		if match {
			out = append(out, map[string]any{"fdid": f.fdid, "path": f.path})
		}
	}
	writeJSON(w, out)
}

type soundFile struct {
	fdid uint32
	path string
}


func (s *server) file(w http.ResponseWriter, r *http.Request) {
	fdid, err := strconv.ParseUint(r.PathValue("fdid"), 10, 32)
	if err != nil {
		http.Error(w, "bad file id", http.StatusBadRequest)
		return
	}
	data, err := s.fileBytes(uint32(fdid))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "max-age=86400")
	_, _ = w.Write(data)
}

func (s *server) row(w http.ResponseWriter, r *http.Request) {
	t, err := s.table(r.PathValue("table"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	i, ok := t.byID[int32(id)]
	if !ok {
		writeJSON(w, nil)
		return
	}
	writeJSON(w, t.object(i))
}

func (s *server) query(w http.ResponseWriter, r *http.Request) {
	t, err := s.table(r.PathValue("table"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	q := r.URL.Query()
	col := q.Get("col")
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 200
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	out := []map[string]any{}
	switch {
	case q.Has("eq"):
		n, err := strconv.ParseInt(q.Get("eq"), 10, 64)
		if err != nil {
			http.Error(w, "bad eq", http.StatusBadRequest)
			return
		}
		for _, i := range t.lookup(col, n) {
			if len(out) == limit {
				break
			}
			out = append(out, t.object(i))
		}
	case q.Has("like"):
		needle := strings.ToLower(q.Get("like"))
		c, ok := t.cols[col]
		if !ok {
			http.Error(w, "no column "+col, http.StatusBadRequest)
			return
		}
		for i, row := range t.rows {
			if str, _ := row.Values[c].(string); strings.Contains(strings.ToLower(str), needle) {
				out = append(out, t.object(i))
				if len(out) == limit {
					break
				}
			}
		}
	default:
		writeJSON(w, map[string]any{"table": t.name, "rows": len(t.rows), "columns": t.names})
		return
	}
	writeJSON(w, out)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
