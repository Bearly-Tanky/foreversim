package main

// Updating: the program asks GitHub for the latest release of the project, and on request
// downloads its build for this system, checks it against the release's SHA256SUMS, swaps it in
// for the running program and starts it again.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Set by the release build (-ldflags "-X main.version=1.2.0").
var (
	version  = "dev"
	repoSlug = "Bearly-Tanky/foreversim"
)

type release struct {
	Tag    string `json:"tag_name"`
	Name   string `json:"name"`
	Notes  string `json:"body"`
	URL    string `json:"html_url"`
	Assets []struct {
		Name string `json:"name"`
		URL  string `json:"browser_download_url"`
	} `json:"assets"`
	checked time.Time
}

var (
	latestMu sync.Mutex
	latest   *release
	updating sync.Mutex
)

var githubClient = &http.Client{Timeout: 20 * time.Second}

func latestRelease(force bool) (*release, error) {
	latestMu.Lock()
	defer latestMu.Unlock()
	if latest != nil && !force && time.Since(latest.checked) < 30*time.Minute {
		return latest, nil
	}
	api := "https://api.github.com/repos/" + repoSlug + "/releases/latest"
	if override := os.Getenv("FOREVERSIM_RELEASES_API"); override != "" {
		api = override // for testing updates against a local copy
	}
	req, _ := http.NewRequest("GET", api, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "ForeverSim/"+version)
	resp, err := githubClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, errors.New("no releases yet")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub: %s", resp.Status)
	}
	r := &release{}
	if err := json.NewDecoder(resp.Body).Decode(r); err != nil {
		return nil, err
	}
	r.checked = time.Now()
	latest = r
	return r, nil
}

// newer reports whether version a is newer than b ("1.10.0" > "1.9.2"; a leading v is ignored).
func newer(a, b string) bool {
	pa, pb := versionParts(a), versionParts(b)
	for i := 0; i < 3; i++ {
		if pa[i] != pb[i] {
			return pa[i] > pb[i]
		}
	}
	return false
}

func versionParts(v string) [3]int {
	var out [3]int
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	for i, p := range strings.SplitN(v, ".", 3) {
		n, _ := strconv.Atoi(strings.TrimFunc(p, func(r rune) bool { return r < '0' || r > '9' }))
		out[i] = n
	}
	return out
}

func assetName() string {
	name := fmt.Sprintf("ForeverSim-%s-%s", runtime.GOOS, runtime.GOARCH)
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return name
}

// handleUpdateInfo: GET /api/update → the running version and what GitHub has.
func handleUpdateInfo(w http.ResponseWriter, r *http.Request) {
	out := map[string]any{"version": version, "dev": version == "dev"}
	rel, err := latestRelease(r.URL.Query().Get("force") == "1")
	if err != nil {
		out["error"] = err.Error()
		writeJSON(w, out)
		return
	}
	out["latest"] = strings.TrimPrefix(rel.Tag, "v")
	out["name"] = rel.Name
	out["notes"] = rel.Notes
	out["url"] = rel.URL
	out["available"] = version != "dev" && newer(rel.Tag, version)
	writeJSON(w, out)
}

// handleUpdate: POST /api/update → download, check, swap in and restart.
func (a *app) handleUpdate(w http.ResponseWriter, _ *http.Request) {
	if !updating.TryLock() {
		http.Error(w, "already updating", http.StatusConflict)
		return
	}
	defer updating.Unlock()
	if version == "dev" {
		http.Error(w, "this is a development copy: update it with git", http.StatusBadRequest)
		return
	}
	rel, err := latestRelease(true)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if !newer(rel.Tag, version) {
		http.Error(w, "already up to date", http.StatusConflict)
		return
	}
	if err := installRelease(rel); err != nil {
		log.Printf("Update failed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Updated to %s; restarting", rel.Tag)
	writeJSON(w, map[string]any{"ok": true, "version": strings.TrimPrefix(rel.Tag, "v")})
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	go a.restart()
}

func installRelease(rel *release) error {
	var binURL, sumsURL string
	for _, asset := range rel.Assets {
		switch asset.Name {
		case assetName():
			binURL = asset.URL
		case "SHA256SUMS":
			sumsURL = asset.URL
		}
	}
	if binURL == "" || sumsURL == "" {
		return fmt.Errorf("the release has no %s for this system", assetName())
	}
	sums, err := download(sumsURL)
	if err != nil {
		return err
	}
	want := ""
	for _, line := range strings.Split(string(sums), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && strings.TrimPrefix(fields[1], "*") == assetName() {
			want = fields[0]
		}
	}
	if want == "" {
		return errors.New("SHA256SUMS does not list this system's build")
	}
	bin, err := download(binURL)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(bin)
	if hex.EncodeToString(sum[:]) != strings.ToLower(want) {
		return errors.New("the download is damaged (checksum mismatch); try again")
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, _ = filepath.EvalSymlinks(exe)
	fresh := exe + ".new"
	if err := os.WriteFile(fresh, bin, 0o755); err != nil {
		return fmt.Errorf("cannot write next to the program (%v): move its folder somewhere you can write to", err)
	}
	// A running program cannot be overwritten on Windows, but it can be renamed.
	old := exe + ".old"
	_ = os.Remove(old)
	if err := os.Rename(exe, old); err != nil {
		os.Remove(fresh)
		return err
	}
	if err := os.Rename(fresh, exe); err != nil {
		_ = os.Rename(old, exe)
		return err
	}
	return nil
}

func download(url string) ([]byte, error) {
	client := &http.Client{Timeout: 10 * time.Minute}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "ForeverSim/"+version)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download %s: %s", url, resp.Status)
	}
	return io.ReadAll(resp.Body)
}

// restart stops serving and starts the (new) program in its place.
func (a *app) restart() {
	time.Sleep(300 * time.Millisecond) // let the reply reach the page
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	_ = a.http.Shutdown(ctx)
	cmd := exec.Command(a.exePath, os.Args[1:]...)
	cmd.Env = append(os.Environ(), "FOREVERSIM_RESTARTED=1")
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := cmd.Start(); err != nil {
		log.Printf("Could not start the new version: %v. Start it again by hand.", err)
	}
	os.Exit(0)
}

// cleanupOldBinary removes the program a previous update replaced.
func cleanupOldBinary(exe string) {
	old := exe + ".old"
	for i := 0; i < 20 && exists(old); i++ {
		if os.Remove(old) == nil {
			return
		}
		time.Sleep(250 * time.Millisecond)
	}
}
