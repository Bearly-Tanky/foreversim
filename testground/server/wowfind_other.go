//go:build !windows

package main

import (
	"os"
	"path/filepath"
)

// On Linux WoW runs under Wine: look in the usual prefixes (Battle.net in ~/Games, Lutris,
// Bottles, Steam's Proton, a plain ~/.wine).
func platformInstallDirs() []string {
	home, _ := os.UserHomeDir()
	wow := []string{filepath.Join("drive_c", "Program Files (x86)", "World of Warcraft"), filepath.Join("drive_c", "Program Files", "World of Warcraft")}
	var prefixes []string
	prefixes = append(prefixes, filepath.Join(home, ".wine"))
	for _, pattern := range []string{
		filepath.Join(home, "Games", "*"),
		filepath.Join(home, ".local", "share", "lutris", "prefixes", "*"),
		filepath.Join(home, ".var", "app", "com.usebottles.bottles", "data", "bottles", "bottles", "*"),
		filepath.Join(home, ".local", "share", "bottles", "bottles", "*"),
		filepath.Join(home, ".steam", "steam", "steamapps", "compatdata", "*", "pfx"),
		filepath.Join(home, ".local", "share", "Steam", "steamapps", "compatdata", "*", "pfx"),
		filepath.Join(home, ".var", "app", "com.valvesoftware.Steam", "data", "Steam", "steamapps", "compatdata", "*", "pfx"),
	} {
		matches, _ := filepath.Glob(pattern)
		prefixes = append(prefixes, matches...)
	}
	var dirs []string
	for _, prefix := range prefixes {
		for _, rel := range wow {
			dirs = append(dirs, filepath.Join(prefix, rel))
		}
	}
	dirs = append(dirs, filepath.Join(home, "Games", "World of Warcraft"))
	return dirs
}
