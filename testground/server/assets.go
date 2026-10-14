package main

// What the program carries: the sim, the testground page and a trimmed file list, embedded by
// the release build. Run from a checkout (go run), it serves them from the repository instead.

import (
	"bytes"
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed all:embedded
var embedded embed.FS

type assets struct {
	sim      fs.FS  // dist/forever
	web      fs.FS  // the testground page
	listfile []byte // FDID;path lines for the client tables and weapon sounds
	bundled  bool
}

func loadAssets(dev bool) (*assets, error) {
	if !dev {
		if _, err := fs.Stat(embedded, "embedded/sim/index.html"); err == nil {
			sim, _ := fs.Sub(embedded, "embedded/sim")
			web, _ := fs.Sub(embedded, "embedded/web")
			list, _ := fs.ReadFile(embedded, "embedded/listfile.csv")
			return &assets{sim: sim, web: web, listfile: list, bundled: true}, nil
		}
	}
	// From the repository: find it upwards from here.
	repo, err := findRepo()
	if err != nil {
		return nil, err
	}
	list := trimListfile(filepath.Join(repo, "tools", "db2tool", "listfile.csv"))
	return &assets{
		sim:      os.DirFS(filepath.Join(repo, "dist", "forever")),
		web:      os.DirFS(filepath.Join(repo, "testground", "web")),
		listfile: list,
	}, nil
}

// trimListfile keeps the lines the program uses: client tables and weapon sounds.
func trimListfile(path string) []byte {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var out []byte
	for _, line := range bytes.Split(data, []byte("\n")) {
		if i := bytes.IndexByte(line, ';'); i > 0 {
			p := line[i+1:]
			if bytes.HasPrefix(p, []byte("dbfilesclient/")) || bytes.HasPrefix(p, []byte("sound/item/weapons/")) {
				out = append(append(out, line...), '\n')
			}
		}
	}
	return out
}

func findRepo() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}
	for {
		if exists(filepath.Join(dir, "testground", "web", "index.html")) {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}
