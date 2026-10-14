package main

// Finding World of Warcraft installs, and which of their games is Forever.

import (
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/wowsims/forever/tools/db2tool/tact"
)

type wowGame struct {
	Product string `json:"product"`
	Version string `json:"version"`
	Forever bool   `json:"forever"`
}

type wowInstall struct {
	Dir   string    `json:"dir"`
	Games []wowGame `json:"games"`
}

// readInstall lists the games an install holds (its .build.info), or nil if dir is not one.
func readInstall(dir string) *wowInstall {
	entries, err := tact.ParseBuildInfo(filepath.Join(dir, ".build.info"))
	if err != nil || len(entries) == 0 {
		return nil
	}
	install := &wowInstall{Dir: dir}
	for _, e := range entries {
		install.Games = append(install.Games, wowGame{Product: e.Product, Version: e.Version, Forever: isForever(e.Product, e.Version)})
	}
	return install
}

// isForever: Forever is the 1.60 Classic client (the classic beta before launch).
func isForever(product, version string) bool {
	return strings.HasPrefix(version, "1.60.") || product == "wow_classic_beta"
}

// pickProduct chooses the game to read: the configured one if the install has it, else Forever.
func pickProduct(install *wowInstall, configured string) string {
	for _, g := range install.Games {
		if g.Product == configured {
			return configured
		}
	}
	best := ""
	for _, g := range install.Games {
		if strings.HasPrefix(g.Version, "1.60.") {
			return g.Product
		}
		if g.Forever && best == "" {
			best = g.Product
		}
	}
	return best
}

// findInstalls looks in the usual places on this system.
func findInstalls() []*wowInstall {
	seen := map[string]bool{}
	var out []*wowInstall
	add := func(dir string) {
		dir = filepath.Clean(dir)
		if seen[strings.ToLower(dir)] {
			return
		}
		seen[strings.ToLower(dir)] = true
		if install := readInstall(dir); install != nil {
			out = append(out, install)
		}
	}
	for _, dir := range platformInstallDirs() {
		add(dir)
		// The launcher's record often points into a game folder (…\World of Warcraft\_retail_).
		add(filepath.Dir(dir))
	}
	sort.SliceStable(out, func(a, b int) bool { return hasForever(out[a]) && !hasForever(out[b]) })
	return out
}

func hasForever(install *wowInstall) bool {
	for _, g := range install.Games {
		if g.Forever {
			return true
		}
	}
	return false
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
