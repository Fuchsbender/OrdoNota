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

// waylandAppIDs: Unter Wayland übergeht Chromium --class bei App-Fenstern und meldet die app_id
// „<Browser>-127.0.0.1__start-Default“ (Pfad der Start-Adresse, Profil „Default“). Ohne passenden
// Eintrag zeigt KDE das Browser-Symbol in der Taskleiste und das Wayland-„W“ im Fenster.
// Für jeden bekannten Browser-Präfix gibt es deshalb einen versteckten Eintrag mit dem Symbol.
var waylandAppIDs = []string{"chromium", "chrome", "google-chrome", "thorium", "msedge", "microsoft-edge", "brave", "brave-browser"}

func waylandAppID(prefix string) string { return prefix + "-127.0.0.1__start-Default" }

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
	changed := removedOld
	if writeIfChanged(dir, desktopFileName, content) {
		logf("Startmenü-Eintrag angelegt: %s", filepath.Join(dir, desktopFileName))
		changed = true
	}
	for _, prefix := range waylandAppIDs {
		id := waylandAppID(prefix)
		if writeIfChanged(dir, id+".desktop", hiddenEntry(exe, icon, id)) {
			changed = true
		}
	}
	if changed {
		refreshMenuCache()
	}
}

// writeIfChanged schreibt die Datei nur, wenn sich der Inhalt geändert hat, und meldet, ob geschrieben wurde.
func writeIfChanged(dir, name, content string) bool {
	path := filepath.Join(dir, name)
	if old, err := os.ReadFile(path); err == nil && string(old) == content {
		return false
	}
	return os.MkdirAll(dir, 0o755) == nil && os.WriteFile(path, []byte(content), 0o644) == nil
}

// hiddenEntry ist ein nicht im Menü sichtbarer Eintrag, der nur Name und Symbol für die app_id liefert.
func hiddenEntry(exe, icon, wmClass string) string {
	e := desktopEntry(exe, icon)
	return strings.Replace(e, "StartupWMClass=OrdoNota\n", "StartupWMClass="+wmClass+"\nNoDisplay=true\n", 1)
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
