package main

// Characters from the game: the ForeverSim addon saves each character's gear, talents and
// professions into its SavedVariables file when the player logs out or reloads; these handlers
// find those files in the WoW folder, read them, and install the addon there.

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

//go:embed all:addon
var addonFiles embed.FS

// gameFolder is the install's folder for the configured game (_classic_beta_, _classic_…), found
// by the product named in its .flavor.info.
func (a *app) gameFolder() (string, error) {
	a.mu.Lock()
	cfg := a.cfg
	a.mu.Unlock()
	if cfg.WowDir == "" {
		return "", errors.New("the WoW folder is not set yet")
	}
	dirs, _ := filepath.Glob(filepath.Join(cfg.WowDir, "_*_"))
	for _, dir := range dirs {
		flavor, err := os.ReadFile(filepath.Join(dir, ".flavor.info"))
		if err == nil && cfg.Product != "" && strings.Contains(string(flavor), cfg.Product) {
			return dir, nil
		}
	}
	// No flavor file names it: the beta's usual folder, if there.
	if dir := filepath.Join(cfg.WowDir, "_classic_beta_"); exists(dir) {
		return dir, nil
	}
	return "", fmt.Errorf("no game folder for %s in %s", cfg.Product, cfg.WowDir)
}

// handleGameCharacters: GET /api/game/characters → every character the addon saved, newest first.
func (a *app) handleGameCharacters(w http.ResponseWriter, _ *http.Request) {
	folder, err := a.gameFolder()
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	files, _ := filepath.Glob(filepath.Join(folder, "WTF", "Account", "*", "SavedVariables", "ForeverSim.lua"))
	characters := []map[string]any{}
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			continue
		}
		vars, err := parseSavedVariables(string(data))
		if err != nil {
			continue
		}
		db, _ := vars["ForeverSimDB"].(map[string]any)
		chars, _ := db["characters"].(map[string]any)
		for _, c := range chars {
			if char, ok := c.(map[string]any); ok {
				char["account"] = filepath.Base(filepath.Dir(filepath.Dir(file)))
				char["addonVersion"] = db["version"]
				characters = append(characters, char)
			}
		}
	}
	sort.SliceStable(characters, func(i, j int) bool { return number(characters[i]["saved"]) > number(characters[j]["saved"]) })
	writeJSON(w, map[string]any{"characters": characters, "addon": a.addonState(folder)})
}

func number(v any) float64 {
	f, _ := v.(float64)
	return f
}

// addonState says whether the addon is installed in the game folder, and which version.
func (a *app) addonState(folder string) map[string]any {
	toc, err := os.ReadFile(filepath.Join(folder, "Interface", "AddOns", "ForeverSim", "ForeverSim.toc"))
	bundled, _ := fs.ReadFile(addonFiles, "addon/ForeverSim/ForeverSim.toc")
	state := map[string]any{"installed": err == nil, "version": tocVersion(string(bundled))}
	if err == nil {
		state["installedVersion"] = tocVersion(string(toc))
	}
	return state
}

func tocVersion(toc string) string {
	for _, line := range strings.Split(toc, "\n") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(line), "## Version:"); ok {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// handleInstallAddon: POST /api/game/addon → copies the addon into the game's AddOns folder.
func (a *app) handleInstallAddon(w http.ResponseWriter, _ *http.Request) {
	folder, err := a.gameFolder()
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	target := filepath.Join(folder, "Interface", "AddOns")
	err = fs.WalkDir(addonFiles, "addon", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		dest := filepath.Join(target, filepath.FromSlash(strings.TrimPrefix(path, "addon")))
		if d.IsDir() {
			return os.MkdirAll(dest, 0o755)
		}
		data, err := addonFiles.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dest, data, 0o644)
	})
	if err != nil {
		http.Error(w, "could not install the addon: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "path": filepath.Join(target, "ForeverSim"), "addon": a.addonState(folder)})
}

// --- SavedVariables (Lua) ---

// parseSavedVariables reads the "Name = value" assignments WoW writes into a SavedVariables file.
// Tables whose keys are 1..n become lists; other tables become objects with string keys.
func parseSavedVariables(src string) (map[string]any, error) {
	p := &luaParser{src: src}
	out := map[string]any{}
	for {
		p.space()
		if p.pos >= len(p.src) {
			return out, nil
		}
		name := p.ident()
		if name == "" {
			return nil, p.fail("expected a variable name")
		}
		p.space()
		if !p.eat('=') {
			return nil, p.fail("expected =")
		}
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		out[name] = v
	}
}

type luaParser struct {
	src string
	pos int
}

func (p *luaParser) fail(msg string) error {
	return fmt.Errorf("SavedVariables, at %d: %s", p.pos, msg)
}

// space skips white space and -- comments.
func (p *luaParser) space() {
	for p.pos < len(p.src) {
		c := p.src[p.pos]
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			p.pos++
		case strings.HasPrefix(p.src[p.pos:], "--"):
			for p.pos < len(p.src) && p.src[p.pos] != '\n' {
				p.pos++
			}
		default:
			return
		}
	}
}

func (p *luaParser) eat(c byte) bool {
	p.space()
	if p.pos < len(p.src) && p.src[p.pos] == c {
		p.pos++
		return true
	}
	return false
}

func (p *luaParser) ident() string {
	start := p.pos
	for p.pos < len(p.src) {
		r := rune(p.src[p.pos])
		if r == '_' || unicode.IsLetter(r) || (p.pos > start && unicode.IsDigit(r)) {
			p.pos++
			continue
		}
		break
	}
	return p.src[start:p.pos]
}

func (p *luaParser) value() (any, error) {
	p.space()
	if p.pos >= len(p.src) {
		return nil, p.fail("unexpected end")
	}
	switch c := p.src[p.pos]; {
	case c == '{':
		return p.table()
	case c == '"' || c == '\'':
		return p.str()
	case c == '-' || c == '.' || (c >= '0' && c <= '9'):
		return p.num()
	default:
		word := p.ident()
		switch word {
		case "true":
			return true, nil
		case "false":
			return false, nil
		case "nil":
			return nil, nil
		}
		return nil, p.fail("unexpected " + strconv.Quote(word))
	}
}

func (p *luaParser) num() (any, error) {
	start := p.pos
	for p.pos < len(p.src) && strings.ContainsRune("+-.0123456789eExX", rune(p.src[p.pos])) {
		p.pos++
	}
	f, err := strconv.ParseFloat(p.src[start:p.pos], 64)
	if err != nil {
		return nil, p.fail("bad number " + p.src[start:p.pos])
	}
	return f, nil
}

func (p *luaParser) str() (any, error) {
	quote := p.src[p.pos]
	p.pos++
	var b strings.Builder
	for p.pos < len(p.src) {
		c := p.src[p.pos]
		p.pos++
		switch {
		case c == quote:
			return b.String(), nil
		case c == '\\' && p.pos < len(p.src):
			e := p.src[p.pos]
			p.pos++
			switch e {
			case 'n':
				b.WriteByte('\n')
			case 't':
				b.WriteByte('\t')
			case 'r':
				b.WriteByte('\r')
			default:
				if e >= '0' && e <= '9' { // \ddd
					end := p.pos - 1
					for end < len(p.src) && end < p.pos+2 && p.src[end] >= '0' && p.src[end] <= '9' {
						end++
					}
					n, _ := strconv.Atoi(p.src[p.pos-1 : end])
					b.WriteByte(byte(n))
					p.pos = end
				} else {
					b.WriteByte(e)
				}
			}
		default:
			b.WriteByte(c)
		}
	}
	return nil, p.fail("unterminated string")
}

func (p *luaParser) table() (any, error) {
	p.pos++ // {
	obj := map[string]any{}
	var list []any
	next := 1
	for {
		if p.eat('}') {
			break
		}
		var key string
		if p.eat('[') {
			k, err := p.value()
			if err != nil {
				return nil, err
			}
			if !p.eat(']') || !p.eat('=') {
				return nil, p.fail("expected ] =")
			}
			key = luaKey(k)
		} else if start := p.pos; true {
			// name = value, or a bare list value.
			if word := p.ident(); word != "" && word != "true" && word != "false" && word != "nil" {
				p.space()
				if p.eat('=') {
					key = word
				} else {
					p.pos = start
				}
			} else {
				p.pos = start
			}
		}
		v, err := p.value()
		if err != nil {
			return nil, err
		}
		if key == "" {
			key = strconv.Itoa(next)
			next++
		}
		obj[key] = v
		p.eat(',')
		p.eat(';')
	}
	// 1..n keys: a list.
	if len(obj) > 0 {
		list = make([]any, 0, len(obj))
		for i := 1; i <= len(obj); i++ {
			v, ok := obj[strconv.Itoa(i)]
			if !ok {
				return obj, nil
			}
			list = append(list, v)
		}
		return list, nil
	}
	return obj, nil
}

func luaKey(k any) string {
	switch v := k.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	}
	return fmt.Sprint(k)
}
