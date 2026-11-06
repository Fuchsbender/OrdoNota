//go:build linux

package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// desktopFileName muss genau der Fensterklasse (--class=OrdoNota, unter Wayland die app_id) entsprechen,
// sonst ordnet KWin das Fenster keinem Eintrag zu und die Taskleiste zeigt ein fremdes Symbol.
const desktopFileName = "OrdoNota.desktop"

// installDesktopEntry legt den Startmenü-Eintrag an bzw. passt ihn an, wenn der Programmordner verschoben wurde.
func installDesktopEntry(exe, icon string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	dir := filepath.Join(home, ".local", "share", "applications")
	content := desktopEntry(exe, icon)
	// alter Eintrag in Kleinbuchstaben (bis 1.37.0)
	removedOld := os.Remove(filepath.Join(dir, "ordonota.desktop")) == nil
	path := filepath.Join(dir, desktopFileName)
	if old, err := os.ReadFile(path); err == nil && string(old) == content && !removedOld {
		return
	}
	if os.MkdirAll(dir, 0o755) == nil && os.WriteFile(path, []byte(content), 0o644) == nil {
		logf("Startmenü-Eintrag angelegt: %s", path)
		refreshMenuCache()
	}
}

func desktopEntry(exe, icon string) string {
	quote := func(s string) string {
		return `"` + strings.NewReplacer(`\`, `\\\\`, `"`, `\"`, "`", "\\`", "$", `\$`).Replace(s) + `"`
	}
	return "[Desktop Entry]\n" +
		"Type=Application\n" +
		"Name=OrdoNota\n" +
		"Comment=Notenverwaltung und Sitzpläne\n" +
		"Exec=" + quote(exe) + "\n" +
		"Icon=" + icon + "\n" +
		"Terminal=false\n" +
		"Categories=Office;Education;\n" +
		"StartupWMClass=OrdoNota\n"
}

// refreshMenuCache stößt den Menü-Cache der Arbeitsumgebung an (KDE, sonst GNOME/freedesktop), falls vorhanden.
func refreshMenuCache() {
	for _, c := range [][]string{{"kbuildsycoca6"}, {"kbuildsycoca5"}, {"update-desktop-database", filepath.Join(os.Getenv("HOME"), ".local", "share", "applications")}} {
		if p, err := exec.LookPath(c[0]); err == nil {
			cmd := exec.Command(p, c[1:]...)
			if cmd.Start() == nil {
				go cmd.Wait()
			}
			return
		}
	}
}
