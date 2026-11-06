//go:build linux

package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Der Eintrag muss OrdoNota.desktop heißen (wie die Fensterklasse) und den alten ordonota.desktop ersetzen.
func TestDesktopEntryName(t *testing.T) {
	logger = log.New(io.Discard, "", 0)
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("PATH", "") // kein Menü-Cache-Programm aufrufen
	dir := filepath.Join(home, ".local", "share", "applications")
	os.MkdirAll(dir, 0o755)
	old := filepath.Join(dir, "ordonota.desktop")
	os.WriteFile(old, []byte(desktopEntry("/x/OrdoNota", "/i.svg")), 0o644)

	installDesktopEntry("/x/OrdoNota", "/i.svg")

	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Fatal("alter Eintrag ordonota.desktop besteht noch")
	}
	b, err := os.ReadFile(filepath.Join(dir, "OrdoNota.desktop"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), "StartupWMClass=OrdoNota\n") || !strings.Contains(string(b), `Exec="/x/OrdoNota"`) {
		t.Fatalf("unerwarteter Inhalt:\n%s", b)
	}
}
