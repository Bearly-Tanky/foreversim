package main

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

func platformInstallDirs() []string {
	var dirs []string
	// Where the Battle.net launcher records the install.
	for _, path := range []string{`SOFTWARE\WOW6432Node\Blizzard Entertainment\World of Warcraft`, `SOFTWARE\Blizzard Entertainment\World of Warcraft`} {
		if key, err := registry.OpenKey(registry.LOCAL_MACHINE, path, registry.QUERY_VALUE); err == nil {
			if dir, _, err := key.GetStringValue("InstallPath"); err == nil && dir != "" {
				dirs = append(dirs, dir)
			}
			key.Close()
		}
	}
	for _, drive := range []string{"C", "D", "E", "F", "G"} {
		root := drive + `:\`
		if !exists(root) {
			continue
		}
		for _, rel := range []string{`Program Files (x86)\World of Warcraft`, `Program Files\World of Warcraft`, `World of Warcraft`, `Games\World of Warcraft`, `Blizzard\World of Warcraft`, `Battle.net\World of Warcraft`} {
			dirs = append(dirs, filepath.Join(root, rel))
		}
	}
	if pf := os.Getenv("ProgramFiles(x86)"); pf != "" {
		dirs = append(dirs, filepath.Join(pf, "World of Warcraft"))
	}
	return dirs
}
