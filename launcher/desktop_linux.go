//go:build linux

package main

import (
	"os"
	"path/filepath"
	"strings"
)

// installDesktopEntry legt den Startmenü-Eintrag an bzw. passt ihn an, wenn der Programmordner verschoben wurde.
func installDesktopEntry(exe, icon string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	dir := filepath.Join(home, ".local", "share", "applications")
	path := filepath.Join(dir, "ordonota.desktop")
	quote := func(s string) string {
		return `"` + strings.NewReplacer(`\`, `\\\\`, `"`, `\"`, "`", "\\`", "$", `\$`).Replace(s) + `"`
	}
	content := "[Desktop Entry]\n" +
		"Type=Application\n" +
		"Name=OrdoNota\n" +
		"Comment=Notenverwaltung und Sitzpläne\n" +
		"Exec=" + quote(exe) + "\n" +
		"Icon=" + icon + "\n" +
		"Terminal=false\n" +
		"Categories=Office;Education;\n" +
		"StartupWMClass=OrdoNota\n"
	if old, err := os.ReadFile(path); err == nil && string(old) == content {
		return
	}
	if os.MkdirAll(dir, 0o755) == nil && os.WriteFile(path, []byte(content), 0o644) == nil {
		logf("Startmenü-Eintrag angelegt: %s", path)
	}
}
