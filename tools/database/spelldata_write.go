package database

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"sort"
)

// Where the generator says what it did. -check silences it, so that a clean check prints nothing at
// all and a stale one prints the paths alone.
var progress io.Writer = os.Stderr

// Writes the rendered files, but only once the sim compiles against them - unless unchecked skips
// that.
//
// The generated files are the sim's data: one that does not compile takes the whole repository down
// with it, gen_db included, and gen_db is what rebuilds the database the generator reads. So the
// files go to a staging directory first and are type-checked there through go build's overlay,
// which lets the compiler read the staged bytes in the place of the committed ones without any of
// them being in the tree. A failure leaves the tree exactly as it was and prints what the compiler
// said.
//
// unchecked skips the staging build: a class file whose call sites cannot compile against what it
// will state until they move has to be written first, so nothing would ever write for it otherwise.
// -check is what closes the loop once they have.
func writeSpellDataFiles(files map[string][]byte, unchecked bool) error {
	if !unchecked {
		if err := buildAgainst(files); err != nil {
			return err
		}
	}

	for path, out := range files {
		if err := os.WriteFile(path, out, 0644); err != nil {
			return err
		}
	}
	return nil
}

// Type-checks the sim with the files staged in place of the committed ones.
func buildAgainst(files map[string][]byte) error {
	staging, err := os.MkdirTemp("", "spelldata-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(staging)

	overlay := map[string]string{}
	for path, out := range files {
		if filepath.Ext(path) != ".go" {
			continue
		}
		absolute, err := filepath.Abs(path)
		if err != nil {
			return err
		}

		// Numbered rather than named after the path: the staged name has to be unique, and flattening
		// a path into one cannot promise that.
		staged := filepath.Join(staging, fmt.Sprintf("%d_%s", len(overlay), filepath.Base(path)))
		if err := os.WriteFile(staged, out, 0644); err != nil {
			return err
		}
		overlay[absolute] = staged
	}

	return buildStaged(staging, overlay, packagesOf(files))
}

// The committed files that are not what the generator writes today. Named rather than rewritten:
// the caller is a check, and a check that edits the tree is not one.
func checkSpellDataFiles(files map[string][]byte) ([]string, error) {
	var stale []string
	for path, out := range files {
		committed, err := os.ReadFile(path)
		if os.IsNotExist(err) {
			stale = append(stale, path)
			continue
		}
		if err != nil {
			return nil, err
		}
		if !bytes.Equal(committed, out) {
			stale = append(stale, path)
		}
	}
	sort.Strings(stale)
	return stale, nil
}

func buildStaged(staging string, overlay map[string]string, packages []string) error {
	document, err := json.Marshal(struct{ Replace map[string]string }{overlay})
	if err != nil {
		return err
	}
	path := filepath.Join(staging, "overlay.json")
	if err := os.WriteFile(path, document, 0644); err != nil {
		return err
	}

	root, err := os.Getwd()
	if err != nil {
		return err
	}

	cmd := exec.Command(goTool(), append([]string{"build", "-overlay", path}, packages...)...)
	cmd.Dir = root
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("the sim does not compile against the generated files, so none was written:\n%s", out)
	}
	return nil
}

// The packages to type-check: the ones the rendered Go files belong to, which is the store, the
// shared enums, the buffs and one per class. The settings inputs and the proto messages are not Go.
func packagesOf(files map[string][]byte) []string {
	seen := map[string]bool{}
	for path := range files {
		if filepath.Ext(path) == ".go" {
			seen["./"+filepath.ToSlash(filepath.Dir(path))+"/"] = true
		}
	}
	return slices.Sorted(maps.Keys(seen))
}

// The go binary of the toolchain this generator was built with, so the check reads the same
// compiler the caller does.
func goTool() string {
	if root := runtime.GOROOT(); root != "" {
		path := filepath.Join(root, "bin", "go")
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	if path, err := exec.LookPath("go"); err == nil {
		return path
	}
	return "go"
}

// Regenerates every spell data file, once the sim compiles against all of them - or without that
// check when unchecked is set - and writes the client rows the store was built from beside them:
// they are what lets the store be regenerated and checked without the client database, so they are
// written from the same pass that wrote it and only once that pass has landed.
func GenerateSpellDataFiles(helper *DBHelper, unchecked bool) error {
	files, inputs, err := renderSpellDataFiles(helper)
	if err != nil {
		return err
	}
	if err := writeSpellDataFiles(files, unchecked); err != nil {
		return err
	}
	return writeStoreInputs(inputs)
}

// The committed files that no longer match what the generator writes, for a caller that wants to
// know rather than to regenerate. Silent on the way there: its output is the list it returns.
func CheckSpellDataFiles(helper *DBHelper) ([]string, error) {
	progress = io.Discard
	defer func() { progress = os.Stderr }()

	files, inputs, err := renderSpellDataFiles(helper)
	if err != nil {
		return nil, err
	}

	stale, err := checkSpellDataFiles(files)
	if err != nil {
		return nil, err
	}

	// The committed inputs are checked too, and not only the store they render: a capture that no
	// longer matches the database renders the committed store all the same - it was written from that
	// capture - so nothing else here would notice it going stale.
	current, err := storeInputsAreCurrent(inputs)
	if err != nil {
		return nil, err
	}
	if !current {
		stale = append(stale, spellStoreInputsPath)
		sort.Strings(stale)
	}
	return stale, nil
}
