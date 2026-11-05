package main

// Einstellungen des Startprogramms (pro Benutzer, nicht in der Datenbank):
//   <Konfig>/OrdoNota/config.json   Datenordner, Port, Browser
//   <Konfig>/OrdoNota/token         Kennwort für den Zugriff auf den Server (nur für den Benutzer lesbar)
//   <Konfig>/OrdoNota/browser/      eigenes Browser-Profil für das App-Fenster
//   <Konfig>/OrdoNota/launcher.log  Protokoll des letzten Starts
// <Konfig> ist ~/.config (Linux), %AppData% (Windows) bzw. ~/Library/Application Support (Mac).

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const defaultPort = 47110

type settings struct {
	DataDir string `json:"dataDir"`
	Port    int    `json:"port"`
	Browser string `json:"browser,omitempty"` // eigener Pfad zum Browser (optional)
}

type config struct {
	dir string
	mu  sync.Mutex
	s   settings
}

func defaultConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "OrdoNota"), nil
}

func loadConfig(dir string) (*config, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	c := &config{dir: dir, s: settings{Port: defaultPort}}
	b, err := os.ReadFile(filepath.Join(dir, "config.json"))
	if err == nil {
		if err := json.Unmarshal(b, &c.s); err != nil {
			return nil, fmt.Errorf("config.json ist fehlerhaft: %w", err)
		}
	}
	if c.s.Port <= 0 || c.s.Port > 65535 {
		c.s.Port = defaultPort
	}
	return c, nil
}

func (c *config) get() settings {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.s
}

func (c *config) save() error {
	b, _ := json.MarshalIndent(c.s, "", "  ")
	return atomicWrite(filepath.Join(c.dir, "config.json"), append(b, '\n'))
}

func (c *config) setDataDir(p string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.s.DataDir = p
	return c.save()
}

// token liefert das Zugriffskennwort; beim ersten Mal wird es erzeugt.
func (c *config) token() (string, error) {
	p := filepath.Join(c.dir, "token")
	if b, err := os.ReadFile(p); err == nil && len(strings.TrimSpace(string(b))) >= 32 {
		return strings.TrimSpace(string(b)), nil
	}
	rnd := make([]byte, 24)
	if _, err := rand.Read(rnd); err != nil {
		return "", err
	}
	t := hex.EncodeToString(rnd)
	return t, atomicWrite(p, []byte(t))
}

func (c *config) profileDir() string { return filepath.Join(c.dir, "browser") }

var logger = log.New(io.Discard, "", log.LstdFlags)

func openLog(dir string, alsoStderr bool) {
	var w io.Writer = io.Discard
	if f, err := os.Create(filepath.Join(dir, "launcher.log")); err == nil {
		w = f
	}
	if alsoStderr {
		w = io.MultiWriter(w, os.Stderr)
	}
	logger = log.New(w, "", log.LstdFlags)
}

func logf(format string, a ...any) { logger.Printf(format, a...) }
