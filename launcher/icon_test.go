package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

// Das Programmsymbol ist das Zeichen ohne Schriftzug; das alte Symbol (ordonota.svg) wird entfernt.
func TestWriteIcon(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "ordonota.svg"), []byte("alt"), 0o644)
	files := fstest.MapFS{
		"logo/ordonota-icon.svg": {Data: []byte("<svg>zeichen</svg>")},
		"logo/ordonota-logo.svg": {Data: []byte("<svg>schriftzug</svg>")},
	}
	p := writeIcon(files, dir)
	if filepath.Base(p) != "ordonota-icon.svg" {
		t.Fatalf("falscher Pfad: %q", p)
	}
	b, _ := os.ReadFile(p)
	if !strings.Contains(string(b), "zeichen") {
		t.Fatalf("falscher Inhalt: %q", b)
	}
	if _, err := os.Stat(filepath.Join(dir, "ordonota.svg")); !os.IsNotExist(err) {
		t.Fatal("altes Symbol nicht entfernt")
	}
	// Das echte Symbol liegt im Programmordner und ist quadratisch
	real, err := os.ReadFile("../logo/ordonota-icon.svg")
	if err != nil || !strings.Contains(string(real), `width="256" height="256"`) {
		t.Fatal("logo/ordonota-icon.svg fehlt oder ist nicht quadratisch")
	}
}
