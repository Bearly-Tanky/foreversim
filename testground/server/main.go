// Forever Sim: the sim and the 3D testground in one program. It serves both on this computer
// only (127.0.0.1), reads models, textures, sounds and game tables from the WoW install it finds
// (or is shown), runs the sim's engine for fight replays and practice, and updates itself from the
// project's GitHub releases.
//
//	ForeverSim [-port 8090] [-wow <install dir>] [-product wow_classic_beta] [-no-browser] [-dev]
//
// Settings, the log and everything extracted live in the user's config folder (ForeverSim/).
// In a checkout: cd testground && ./run.sh (serves the sim from dist/ and the page from web/).
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Set by replay.go and live.go (built with -tags=with_db, which every build uses).
var replayHandler, replayRequestHandler, liveStartHandler, liveTickHandler, liveSummaryHandler, logReferenceHandler http.HandlerFunc

type config struct {
	WowDir  string `json:"wowDir"`
	Product string `json:"product"`
}

type app struct {
	dataDir string
	exePath string
	assets  *assets
	http    *http.Server
	url     string

	mu      sync.Mutex
	cfg     config
	game    *server
	status  string // "setup", "loading", "ready" or "error"
	problem string
}

func main() {
	port := flag.Int("port", 8090, "port to listen on (this computer only)")
	wowDir := flag.String("wow", "", "World of Warcraft install folder (found automatically if left out)")
	product := flag.String("product", "", "which game of the install to read (Forever if left out)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser")
	dev := flag.Bool("dev", false, "serve the sim and the page from the repository")
	flag.Parse()

	a := &app{status: "setup"}
	base, err := os.UserConfigDir()
	if err != nil {
		base = "."
	}
	a.dataDir = filepath.Join(base, "ForeverSim")
	if err := os.MkdirAll(a.dataDir, 0o755); err != nil {
		fatal(err)
	}
	if logFile, err := os.OpenFile(filepath.Join(a.dataDir, "log.txt"), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644); err == nil {
		log.SetOutput(io.MultiWriter(os.Stderr, logFile))
	}
	a.exePath, _ = os.Executable()
	a.exePath, _ = filepath.EvalSymlinks(a.exePath)
	cleanupOldBinary(a.exePath)

	if a.assets, err = loadAssets(*dev); err != nil {
		fatal(fmt.Errorf("this program is missing its files (%v)", err))
	}
	if len(a.assets.listfile) > 0 {
		_ = os.WriteFile(filepath.Join(a.dataDir, "listfile.csv"), a.assets.listfile, 0o644)
	}

	a.cfg = a.loadConfig()
	if *wowDir != "" {
		a.cfg.WowDir = *wowDir
	}
	if *product != "" {
		a.cfg.Product = *product
	}

	// One copy at a time: if it is already running, just show it.
	ln, url, running := listen(*port)
	if running {
		fmt.Printf("Forever Sim is already running at %s\n", url)
		if !*noBrowser {
			openBrowser(url)
		}
		return
	}
	a.url = url

	a.http = &http.Server{Handler: a.routes(), ReadHeaderTimeout: 10 * time.Second}
	go a.start()

	fmt.Printf("\n  Forever Sim %s is running at %s\n  Keep this window open while you use it; close it to quit.\n  Files and settings: %s\n\n", version, url, a.dataDir)
	if !*noBrowser && os.Getenv("FOREVERSIM_RESTARTED") == "" {
		openBrowser(url)
	}
	if err := a.http.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal(err)
	}
	select {} // an update is restarting the program
}

func fatal(err error) {
	log.Printf("Forever Sim cannot start: %v", err)
	if runtime.GOOS == "windows" {
		fmt.Println("Press Enter to close.")
		fmt.Scanln()
	}
	os.Exit(1)
}

// start finds the install (configured, or the first with Forever in it) and opens it.
func (a *app) start() {
	a.mu.Lock()
	cfg := a.cfg
	a.mu.Unlock()
	if cfg.WowDir == "" {
		for _, install := range findInstalls() {
			if p := pickProduct(install, ""); p != "" {
				cfg.WowDir, cfg.Product = install.Dir, p
				log.Printf("Found World of Warcraft at %s", install.Dir)
				break
			}
		}
	}
	if cfg.WowDir == "" {
		a.setStatus("setup", "World of Warcraft was not found. Show where it is installed.")
		return
	}
	a.openGame(cfg)
}

func (a *app) openGame(cfg config) {
	install := readInstall(cfg.WowDir)
	if install == nil {
		a.setStatus("setup", fmt.Sprintf("%s is not a World of Warcraft folder (it has no .build.info).", cfg.WowDir))
		return
	}
	cfg.Product = pickProduct(install, cfg.Product)
	if cfg.Product == "" {
		a.setStatus("setup", "This World of Warcraft install has no Forever game. Install Forever with the Battle.net launcher, or choose the game below.")
		return
	}
	a.mu.Lock()
	a.cfg = cfg
	a.status, a.problem = "loading", ""
	a.mu.Unlock()
	a.saveConfig(cfg)

	game, err := open(cfg.WowDir, cfg.Product, a.dataDir)
	if err != nil {
		a.setStatus("error", fmt.Sprintf("Could not read the game files: %v", err))
		return
	}
	a.mu.Lock()
	a.game = game
	a.status = "ready"
	a.mu.Unlock()
	log.Printf("Ready: %s %s at %s", game.build.Entry.Product, game.build.Entry.Version, cfg.WowDir)
}

func (a *app) setStatus(status, problem string) {
	a.mu.Lock()
	a.status, a.problem = status, problem
	a.mu.Unlock()
	if problem != "" {
		log.Print(problem)
	}
}

func (a *app) loadConfig() config {
	var cfg config
	if data, err := os.ReadFile(filepath.Join(a.dataDir, "config.json")); err == nil {
		_ = json.Unmarshal(data, &cfg)
	}
	return cfg
}

func (a *app) saveConfig(cfg config) {
	data, _ := json.MarshalIndent(cfg, "", "  ")
	_ = os.WriteFile(filepath.Join(a.dataDir, "config.json"), data, 0o644)
}

func (a *app) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/info", a.handleInfo)
	mux.HandleFunc("GET /api/setup", a.handleSetupInfo)
	mux.HandleFunc("POST /api/setup", a.handleSetup)
	mux.HandleFunc("GET /api/update", handleUpdateInfo)
	mux.HandleFunc("POST /api/update", a.handleUpdate)
	mux.HandleFunc("GET /api/game/characters", a.handleGameCharacters)
	mux.HandleFunc("POST /api/game/addon", a.handleInstallAddon)
	mux.HandleFunc("GET /api/logs", a.handleLogs)
	mux.HandleFunc("GET /api/logs/fights", a.handleLogFights)
	mux.HandleFunc("GET /api/logs/events", a.handleLogEvents)
	mux.HandleFunc("POST /api/logs/reference", logReferenceHandler)

	// Game files: only once the install is open.
	withGame := func(h func(*server, http.ResponseWriter, *http.Request)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			a.mu.Lock()
			game := a.game
			a.mu.Unlock()
			if game == nil {
				http.Error(w, "the game files are not open yet", http.StatusServiceUnavailable)
				return
			}
			h(game, w, r)
		}
	}
	mux.HandleFunc("GET /api/file/{fdid}", withGame((*server).file))
	mux.HandleFunc("GET /api/db/{table}/{id}", withGame((*server).row))
	mux.HandleFunc("GET /api/db/{table}", withGame((*server).query))
	mux.HandleFunc("GET /api/sounds", withGame((*server).sounds))

	// The sim's engine.
	mux.HandleFunc("POST /api/replay", replayHandler)
	mux.HandleFunc("POST /api/replay-request", replayRequestHandler)
	mux.HandleFunc("POST /api/live/start", liveStartHandler)
	mux.HandleFunc("POST /api/live/tick", liveTickHandler)
	mux.HandleFunc("GET /api/live/summary", liveSummaryHandler)
	mux.HandleFunc("GET /api/specs", func(w http.ResponseWriter, _ *http.Request) {
		// The sim's spec pages, as "class/spec".
		pages, _ := fs.Glob(a.assets.sim, "*/*/index.html")
		specs := []string{}
		for _, page := range pages {
			specs = append(specs, filepath.ToSlash(filepath.Dir(page)))
		}
		writeJSON(w, specs)
	})

	mux.Handle("/forever/", http.StripPrefix("/forever/", http.FileServerFS(a.assets.sim)))
	mux.Handle("/", noCache(http.FileServerFS(a.assets.web)))
	return mux
}

func (a *app) handleInfo(w http.ResponseWriter, _ *http.Request) {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := map[string]any{"app": "ForeverSim", "version": version, "status": a.status, "problem": a.problem, "wowDir": a.cfg.WowDir}
	if a.game != nil {
		out["product"] = a.game.build.Entry.Product
		out["gameVersion"] = a.game.build.Entry.Version
		out["build"] = a.game.build.BuildNumber
	}
	writeJSON(w, out)
}

// handleSetupInfo: GET /api/setup → the installs found on this computer, for the setup screen.
func (a *app) handleSetupInfo(w http.ResponseWriter, _ *http.Request) {
	a.mu.Lock()
	cfg, status, problem := a.cfg, a.status, a.problem
	a.mu.Unlock()
	installs := findInstalls()
	if cfg.WowDir != "" {
		if install := readInstall(cfg.WowDir); install != nil {
			found := false
			for _, i := range installs {
				found = found || i.Dir == install.Dir
			}
			if !found {
				installs = append([]*wowInstall{install}, installs...)
			}
		}
	}
	writeJSON(w, map[string]any{"status": status, "problem": problem, "wowDir": cfg.WowDir, "product": cfg.Product, "installs": installs})
}

// handleSetup: POST /api/setup {wowDir, product} → open that install instead.
func (a *app) handleSetup(w http.ResponseWriter, r *http.Request) {
	var cfg config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	cfg.WowDir = strings.Trim(strings.TrimSpace(cfg.WowDir), `"`)
	if home, err := os.UserHomeDir(); err == nil && (cfg.WowDir == "~" || strings.HasPrefix(cfg.WowDir, "~/")) {
		cfg.WowDir = filepath.Join(home, strings.TrimPrefix(cfg.WowDir, "~"))
	}
	// Accept the game folder (…\_classic_beta_) or the launcher folder above it.
	if readInstall(cfg.WowDir) == nil && readInstall(filepath.Dir(cfg.WowDir)) != nil {
		cfg.WowDir = filepath.Dir(cfg.WowDir)
	}
	install := readInstall(cfg.WowDir)
	if install == nil {
		http.Error(w, "That folder is not a World of Warcraft install: pick the folder that holds Wow's .build.info (usually “World of Warcraft”).", http.StatusBadRequest)
		return
	}
	a.mu.Lock()
	a.game = nil
	a.status = "loading"
	a.mu.Unlock()
	go a.openGame(cfg)
	writeJSON(w, map[string]any{"ok": true})
}

// listen takes the port, or a nearby one. If the port answers as this program, it is already
// running and that is where to go.
func listen(port int) (net.Listener, string, bool) {
	for p := port; p < port+10; p++ {
		addr := fmt.Sprintf("127.0.0.1:%d", p)
		url := fmt.Sprintf("http://%s/", addr)
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln, url, false
		}
		client := &http.Client{Timeout: 2 * time.Second}
		if resp, err := client.Get(url + "api/info"); err == nil {
			var info struct{ App string }
			_ = json.NewDecoder(resp.Body).Decode(&info)
			resp.Body.Close()
			if info.App == "ForeverSim" {
				return nil, url, true
			}
		}
	}
	fatal(fmt.Errorf("ports %d to %d are all taken", port, port+9))
	return nil, "", false
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("Open %s in your browser.", url)
	}
}

func noCache(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		h.ServeHTTP(w, r)
	})
}
