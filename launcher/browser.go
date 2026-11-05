package main

// Browser suchen und die App als eigenes Fenster (--app) öffnen.

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Chromium-Browser in der Reihenfolge der Vorliebe.
func browserCandidates() []string {
	switch runtime.GOOS {
	case "windows":
		var out []string
		for _, env := range []string{"ProgramFiles", "ProgramFiles(x86)", "LocalAppData"} {
			base := os.Getenv(env)
			if base == "" {
				continue
			}
			out = append(out,
				filepath.Join(base, `Google\Chrome\Application\chrome.exe`),
				filepath.Join(base, `Microsoft\Edge\Application\msedge.exe`),
				filepath.Join(base, `BraveSoftware\Brave-Browser\Application\brave.exe`),
				filepath.Join(base, `Chromium\Application\chrome.exe`),
			)
		}
		return out
	case "darwin":
		var out []string
		home, _ := os.UserHomeDir()
		for _, base := range []string{"/Applications", filepath.Join(home, "Applications")} {
			out = append(out,
				filepath.Join(base, "Google Chrome.app/Contents/MacOS/Google Chrome"),
				filepath.Join(base, "Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
				filepath.Join(base, "Chromium.app/Contents/MacOS/Chromium"),
				filepath.Join(base, "Brave Browser.app/Contents/MacOS/Brave Browser"),
				filepath.Join(base, "Thorium.app/Contents/MacOS/Thorium"),
			)
		}
		return out
	default:
		return []string{"thorium-browser", "chromium", "chromium-browser", "google-chrome-stable", "google-chrome",
			"microsoft-edge-stable", "microsoft-edge", "brave-browser", "brave"}
	}
}

func findBrowser(custom string) string {
	list := browserCandidates()
	if custom != "" {
		list = append([]string{custom}, list...)
	}
	for _, b := range list {
		if filepath.IsAbs(b) {
			if fi, err := os.Stat(b); err == nil && !fi.IsDir() {
				return b
			}
		} else if p, err := exec.LookPath(b); err == nil {
			return p
		}
	}
	return ""
}

// openAppWindow startet den Browser mit eigenem Profil. Der Prozess läuft, bis das Fenster zu ist.
func openAppWindow(browser, profile, url string) (*exec.Cmd, error) {
	cmd := exec.Command(browser,
		"--app="+url,
		"--user-data-dir="+profile,
		"--no-first-run",
		"--no-default-browser-check",
		"--class=OrdoNota",
		"--window-size=1400,900",
	)
	hideConsole(cmd)
	return cmd, cmd.Start()
}

// openDefault öffnet die Adresse im Standardbrowser (ohne App-Fenster, Ende nicht erkennbar).
func openDefault(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	hideConsole(cmd)
	return cmd.Start()
}
