// OrdoNota-Startprogramm: startet einen kleinen Server auf 127.0.0.1, öffnet die App
// als eigenes Browserfenster und speichert direkt in den Datenordner – ohne die
// Rückfrage „Zugriff erlauben“ des Browsers. Endet, wenn das Fenster geschlossen ist.
//
// Aufruf: OrdoNota [--no-browser] [--port N] [--data ORDNER] [--config-dir ORDNER] [--app-dir ORDNER]
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"syscall"
	"time"
)

// Leerlaufzeiten, nach denen sich der Server beendet
const (
	idleAfterWindow  = 15 * time.Second // App-Fenster (eigener Browserprozess) ist zu
	idleWithoutTrack = 5 * time.Minute  // Standardbrowser: Ende nur an fehlenden Lebenszeichen erkennbar
)

func main() {
	if err := run(); err != nil {
		showError(err.Error())
		os.Exit(1)
	}
}

func run() error {
	noBrowser := flag.Bool("no-browser", false, "keinen Browser öffnen, Startadresse ausgeben (für Tests)")
	port := flag.Int("port", 0, "Port (Standard aus config.json, sonst 47110)")
	dataDir := flag.String("data", "", "Datenordner festlegen")
	cfgDir := flag.String("config-dir", "", "Ordner für Einstellungen und Browser-Profil")
	appDirFlag := flag.String("app-dir", "", "Programmordner mit index.html")
	flag.Parse()

	dir := *cfgDir
	if dir == "" {
		d, err := defaultConfigDir()
		if err != nil {
			return err
		}
		dir = d
	}
	cfg, err := loadConfig(dir)
	if err != nil {
		return err
	}
	openLog(dir, *noBrowser)

	exe, _ := os.Executable()
	exe, _ = filepath.EvalSymlinks(exe)
	// App-Dateien: angegebener Ordner, sonst neben dem Programm (z. B. Git-Ordner), sonst eingebaut
	appDir := *appDirFlag
	if appDir == "" {
		appDir = findAppDir(filepath.Dir(exe))
	}
	var files fs.FS
	source := appDir
	if appDir != "" {
		files = os.DirFS(appDir)
	} else if files = embeddedFiles(); files != nil {
		source = "eingebaut"
	} else {
		return errors.New("Die App-Dateien (index.html, js/, css/) wurden nicht gefunden. Das Startprogramm muss im OrdoNota-Ordner liegen.")
	}
	version := appVersion(files)
	logf("OrdoNota %s, App-Dateien: %s, Einstellungen: %s", version, source, dir)

	if *dataDir != "" {
		p, err := checkDir(*dataDir)
		if err != nil {
			return err
		}
		if err := cfg.setDataDir(p); err != nil {
			return err
		}
	}
	if *port == 0 {
		*port = cfg.get().Port
	}
	token, err := cfg.token()
	if err != nil {
		return err
	}
	startURL := fmt.Sprintf("http://127.0.0.1:%d/start?t=%s", *port, token)

	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(*port))
	if err != nil {
		// Läuft OrdoNota schon? Dann nur ein weiteres Fenster öffnen.
		if alreadyRunning(*port, token) {
			logf("Läuft bereits, öffne nur ein Fenster")
			if *noBrowser {
				fmt.Println(startURL)
				return nil
			}
			return openWindow(cfg, startURL, nil)
		}
		return fmt.Errorf("Port %d ist belegt. Bitte in %s einen anderen \"port\" eintragen.", *port, filepath.Join(dir, "config.json"))
	}

	if os.Getenv("ORDONOTA_NO_DESKTOP") == "" {
		installDesktopEntry(exe, writeIcon(files, dir))
	}
	s := &server{files: files, token: token, port: *port, version: version, cfg: cfg, pickFolder: pickFolderNative}
	srv := &http.Server{Handler: s.handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logf("Server: %v", err)
		}
	}()
	logf("Server läuft auf http://127.0.0.1:%d", *port)

	browserDone := make(chan struct{})
	tracked := false
	if *noBrowser {
		fmt.Println(startURL)
		os.Stdout.Sync()
	} else {
		if err := openWindow(cfg, startURL, func(cmd *exec.Cmd) {
			tracked = true
			go func() { cmd.Wait(); close(browserDone) }()
		}); err != nil {
			srv.Close()
			return err
		}
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	windowClosed := false
	started := time.Now()
loop:
	for {
		select {
		case <-stop:
			break loop
		case <-browserDone:
			browserDone = nil
			if time.Since(started) < 5*time.Second {
				// Browser mit diesem Profil lief schon und hat das Fenster übernommen
				tracked = false
				logf("Browser hat das Fenster an einen laufenden Prozess übergeben")
			} else {
				windowClosed = true
				logf("Browserfenster geschlossen")
			}
		case <-tick.C:
			if *noBrowser {
				continue
			}
			idle := s.idle()
			if !s.seen() {
				idle = time.Since(started)
			}
			// Kehrt der Browserprozess sofort zurück (Profil war schon offen), entscheiden die Lebenszeichen.
			if (windowClosed && idle > idleAfterWindow) || (!tracked && idle > idleWithoutTrack) {
				break loop
			}
		}
	}
	logf("Beende")
	s.releaseOwnLock()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	return nil
}

// openWindow öffnet die App im App-Fenster eines Chromium-Browsers, sonst im Standardbrowser.
func openWindow(cfg *config, url string, onTracked func(*exec.Cmd)) error {
	if b := findBrowser(cfg.get().Browser); b != "" {
		cmd, err := openAppWindow(b, cfg.profileDir(), url)
		if err == nil {
			logf("Browser: %s", b)
			if onTracked != nil {
				onTracked(cmd)
			}
			return nil
		}
		logf("Browser %s startet nicht: %v", b, err)
	}
	logf("Kein Chromium-Browser gefunden, öffne Standardbrowser")
	if err := openDefault(url); err != nil {
		return fmt.Errorf("Kein Browser gefunden. Bitte Google Chrome oder Microsoft Edge installieren. (%v)", err)
	}
	return nil
}

func alreadyRunning(port int, token string) bool {
	req, _ := http.NewRequest("GET", fmt.Sprintf("http://127.0.0.1:%d/api/alive", port), nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	resp, err := (&http.Client{Timeout: 2 * time.Second}).Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == 200
}

// writeIcon legt das Logo für den Startmenü-Eintrag in den Einstellungsordner.
func writeIcon(files fs.FS, dir string) string {
	b, err := fs.ReadFile(files, "logo/ordonota-logo.svg")
	if err != nil {
		return ""
	}
	p := filepath.Join(dir, "ordonota.svg")
	if old, err := os.ReadFile(p); err != nil || string(old) != string(b) {
		os.WriteFile(p, b, 0o644)
	}
	return p
}

// findAppDir sucht index.html neben dem Programm oder darüber (Mac: OrdoNota.app/Contents/MacOS).
func findAppDir(start string) string {
	d := start
	for i := 0; i < 5; i++ {
		if fi, err := os.Stat(filepath.Join(d, "index.html")); err == nil && !fi.IsDir() {
			if fi, err := os.Stat(filepath.Join(d, "js", "app.js")); err == nil && !fi.IsDir() {
				return d
			}
		}
		parent := filepath.Dir(d)
		if parent == d {
			break
		}
		d = parent
	}
	return ""
}

var versionRe = regexp.MustCompile(`APP_VERSION\s*=\s*'([^']+)'`)

func appVersion(files fs.FS) string {
	b, err := fs.ReadFile(files, "js/model.js")
	if err != nil {
		return "?"
	}
	if m := versionRe.FindSubmatch(b); m != nil {
		return string(m[1])
	}
	return "?"
}
