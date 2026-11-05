package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const testToken = "0123456789abcdef0123456789abcdef0123456789abcdef"

// testServer baut einen Server mit Programmordner (inkl. ref/ mit „echten“ Daten) und leerem Datenordner.
func testServer(t *testing.T) (*server, string, string) {
	t.Helper()
	app := t.TempDir()
	for p, c := range map[string]string{
		"index.html":    "<!doctype html>",
		"js/app.js":     "// app",
		"js/model.js":   "const APP_VERSION = '9.9.9';",
		"css/app.css":   "body{}",
		"cards/HD.svg":  "<svg/>",
		"ref/noten.csv": "Echte Namen",
		"secret.nmdb":   "x",
	} {
		os.MkdirAll(filepath.Join(app, filepath.Dir(p)), 0o755)
		os.WriteFile(filepath.Join(app, p), []byte(c), 0o644)
	}
	data := t.TempDir()
	cfg, err := loadConfig(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	cfg.setDataDir(data)
	s := &server{files: os.DirFS(app), token: testToken, port: 47110, version: "9.9.9", cfg: cfg}
	return s, app, data
}

type call struct {
	method, path, body string
	cookie, header     bool
	host               string
	extra              map[string]string
}

func do(t *testing.T, s *server, c call) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(c.method, c.path, strings.NewReader(c.body))
	req.Host = "127.0.0.1:47110"
	if c.host != "" {
		req.Host = c.host
	}
	if c.cookie {
		req.AddCookie(&http.Cookie{Name: cookieName, Value: testToken})
	}
	if c.header {
		req.Header.Set("X-OrdoNota", "1")
	}
	for k, v := range c.extra {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, req)
	return w
}

func api(t *testing.T, s *server, method, path, body string, extra map[string]string) *httptest.ResponseRecorder {
	return do(t, s, call{method: method, path: path, body: body, cookie: true, header: true, extra: extra})
}

func TestZugriffsschutz(t *testing.T) {
	s, _, _ := testServer(t)
	if w := do(t, s, call{method: "GET", path: "/api/info"}); w.Code != 401 {
		t.Errorf("ohne Cookie: %d", w.Code)
	}
	if w := do(t, s, call{method: "GET", path: "/api/info", cookie: true, host: "evil.example:47110"}); w.Code != 403 {
		t.Errorf("fremder Host: %d", w.Code)
	}
	if w := do(t, s, call{method: "PUT", path: "/api/db", body: "{}", cookie: true}); w.Code != 403 {
		t.Errorf("Schreiben ohne X-OrdoNota: %d", w.Code)
	}
	if w := do(t, s, call{method: "GET", path: "/start?t=falsch"}); w.Code != 401 {
		t.Errorf("Start mit falschem Kennwort: %d", w.Code)
	}
	w := do(t, s, call{method: "GET", path: "/start?t=" + testToken})
	if w.Code != 303 || !strings.Contains(w.Header().Get("Set-Cookie"), cookieName+"="+testToken) || !strings.Contains(w.Header().Get("Set-Cookie"), "SameSite=Strict") {
		t.Errorf("Start: %d %q", w.Code, w.Header().Get("Set-Cookie"))
	}
	if w := do(t, s, call{method: "GET", path: "/api/info", cookie: true, host: "localhost:47110"}); w.Code != 200 {
		t.Errorf("localhost: %d", w.Code)
	}
}

func TestStatischeDateien(t *testing.T) {
	s, _, _ := testServer(t)
	for path, want := range map[string]int{
		"/index.html":      200,
		"/js/app.js":       200,
		"/css/app.css?v=1": 200,
		"/cards/HD.svg":    200,
		"/ref/noten.csv":   404,
		"/secret.nmdb":     404,
		"/js/":             404,
		"/":                303,
	} {
		if w := do(t, s, call{method: "GET", path: path}); w.Code != want {
			t.Errorf("%s: %d statt %d", path, w.Code, want)
		}
	}
	// Pfade mit .. werden nie ausgeliefert (nur Umleitung auf den bereinigten Pfad)
	if w := do(t, s, call{method: "GET", path: "/js/../ref/noten.csv"}); w.Code == 200 || strings.Contains(w.Body.String(), "Echte") {
		t.Errorf("..-Pfad ausgeliefert: %d", w.Code)
	}
	if w := do(t, s, call{method: "GET", path: "/cards/HD.svg"}); w.Header().Get("Content-Type") != "image/svg+xml" {
		t.Errorf("Kartenbild: Typ %q", w.Header().Get("Content-Type"))
	}
	if w := do(t, s, call{method: "GET", path: "/index.html"}); w.Body.String() != "<!doctype html>" {
		t.Errorf("index.html: %q", w.Body)
	}
}

func TestDatenbankUndKonflikt(t *testing.T) {
	s, _, data := testServer(t)
	if w := api(t, s, "GET", "/api/db", "", nil); w.Code != 404 {
		t.Fatalf("leer: %d", w.Code)
	}
	w := api(t, s, "PUT", "/api/db", `{"v":1}`, nil)
	if w.Code != 200 {
		t.Fatalf("schreiben: %d %s", w.Code, w.Body)
	}
	var r struct{ Modified string }
	json.Unmarshal(w.Body.Bytes(), &r)
	w = api(t, s, "GET", "/api/db", "", nil)
	if w.Body.String() != `{"v":1}` || w.Header().Get("X-Modified") != r.Modified {
		t.Fatalf("lesen: %s %s/%s", w.Body, w.Header().Get("X-Modified"), r.Modified)
	}
	// Anderes Gerät (Synology) ändert die Datei
	time.Sleep(20 * time.Millisecond)
	os.WriteFile(filepath.Join(data, dbFile), []byte(`{"v":99}`), 0o600)
	if w := api(t, s, "PUT", "/api/db", `{"v":2}`, map[string]string{"X-Expect": r.Modified}); w.Code != 409 {
		t.Fatalf("Konflikt nicht erkannt: %d", w.Code)
	}
	if b, _ := os.ReadFile(filepath.Join(data, dbFile)); string(b) != `{"v":99}` {
		t.Fatalf("fremde Version überschrieben: %s", b)
	}
	if w := api(t, s, "PUT", "/api/db", `{"v":3}`, map[string]string{"X-Expect": r.Modified, "X-Force": "1"}); w.Code != 200 {
		t.Fatalf("force: %d", w.Code)
	}
	if b, _ := os.ReadFile(filepath.Join(data, dbFile)); string(b) != `{"v":3}` {
		t.Fatalf("force schreibt nicht: %s", b)
	}
	// Keine Hilfsdateien liegen bleiben
	entries, _ := os.ReadDir(data)
	for _, e := range entries {
		if strings.Contains(e.Name(), ".tmp-") {
			t.Errorf("Hilfsdatei übrig: %s", e.Name())
		}
	}
}

func TestSicherungen(t *testing.T) {
	s, _, data := testServer(t)
	api(t, s, "PUT", "/api/db", `{"v":1}`, nil)
	bdir := filepath.Join(data, backupDir)
	os.MkdirAll(bdir, 0o700)
	for _, n := range []string{"notenmanager_2020-01-01_000001.nmdb", "notenmanager_2020-01-01_000002.nmdb", "notenmanager_2020-01-01_000003.nmdb", "fremd.txt"} {
		os.WriteFile(filepath.Join(bdir, n), []byte(`{"alt":true}`), 0o600)
	}
	// Speichern mit Sicherung: alter Stand wird gesichert, höchstens 3 bleiben
	if w := api(t, s, "PUT", "/api/db", `{"v":2}`, map[string]string{"X-Backup-Keep": "3"}); w.Code != 200 {
		t.Fatalf("%d", w.Code)
	}
	var names []string
	json.Unmarshal(api(t, s, "GET", "/api/backups", "", nil).Body.Bytes(), &names)
	if len(names) != 3 || names[0] <= "notenmanager_2021" {
		t.Fatalf("Sicherungen: %v", names)
	}
	if w := api(t, s, "GET", "/api/backups/"+names[0], "", nil); w.Body.String() != `{"v":1}` {
		t.Errorf("neueste Sicherung: %s", w.Body)
	}
	if _, err := os.Stat(filepath.Join(bdir, "fremd.txt")); err != nil {
		t.Errorf("fremde Datei gelöscht")
	}
	if w := api(t, s, "POST", "/api/backups", `{"v":"jetzt"}`, map[string]string{"X-Backup-Keep": "5"}); w.Code != 200 {
		t.Errorf("Jetzt sichern: %d", w.Code)
	}
	for _, bad := range []string{"../notenmanager.nmdb", "..%2Fnotenmanager.nmdb", "fremd.txt", "notenmanager_x.json"} {
		if w := api(t, s, "GET", "/api/backups/"+bad, "", nil); w.Code == 200 {
			t.Errorf("unzulässiger Name gelesen: %s", bad)
		}
	}
}

func TestKonfliktkopienUndLock(t *testing.T) {
	s, _, data := testServer(t)
	os.WriteFile(filepath.Join(data, "notenmanager_Laptop_Conflict.nmdb"), []byte("x"), 0o600)
	os.WriteFile(filepath.Join(data, "anderes_conflict.txt"), []byte("x"), 0o600)
	var names []string
	json.Unmarshal(api(t, s, "GET", "/api/conflicts", "", nil).Body.Bytes(), &names)
	if len(names) != 1 || names[0] != "notenmanager_Laptop_Conflict.nmdb" {
		t.Errorf("Konfliktkopien: %v", names)
	}
	if w := api(t, s, "GET", "/api/lock", "", nil); strings.TrimSpace(w.Body.String()) != "null" {
		t.Errorf("kein Lock: %s", w.Body)
	}
	api(t, s, "PUT", "/api/lock", `{"deviceId":"abc","device":"PC"}`, nil)
	if w := api(t, s, "GET", "/api/lock", "", nil); !strings.Contains(w.Body.String(), `"abc"`) {
		t.Errorf("Lock lesen: %s", w.Body)
	}
	// Beim Beenden: eigener Lock wird freigegeben, fremder bleibt
	s.releaseOwnLock()
	if _, err := os.Stat(filepath.Join(data, lockFile)); err == nil {
		t.Errorf("eigener Lock nicht freigegeben")
	}
	api(t, s, "PUT", "/api/lock", `{"deviceId":"abc"}`, nil)
	os.WriteFile(filepath.Join(data, lockFile), []byte(`{"deviceId":"laptop"}`), 0o600)
	s.releaseOwnLock()
	if _, err := os.Stat(filepath.Join(data, lockFile)); err != nil {
		t.Errorf("fremder Lock gelöscht")
	}
	if w := api(t, s, "DELETE", "/api/lock", "", nil); w.Code != 200 {
		t.Errorf("Lock löschen: %d", w.Code)
	}
}

func TestDatenordnerWaehlen(t *testing.T) {
	s, _, _ := testServer(t)
	s.cfg.setDataDir("")
	if w := api(t, s, "GET", "/api/db", "", nil); w.Code != 409 {
		t.Errorf("ohne Ordner: %d", w.Code)
	}
	if w := api(t, s, "POST", "/api/folder", `{"path":"relativ/pfad"}`, nil); w.Code != 400 {
		t.Errorf("relativer Pfad: %d", w.Code)
	}
	if w := api(t, s, "POST", "/api/folder", `{"path":"/gibt/es/nicht"}`, nil); w.Code != 400 {
		t.Errorf("fehlender Ordner: %d", w.Code)
	}
	neu := filepath.Join(t.TempDir(), "Synology Drive", "Noten")
	os.MkdirAll(neu, 0o700)
	if w := api(t, s, "POST", "/api/folder", `{"path":`+jsonStr(neu)+`}`, nil); w.Code != 200 {
		t.Fatalf("Ordner setzen: %d %s", w.Code, w.Body)
	}
	c2, _ := loadConfig(s.cfg.dir)
	if c2.get().DataDir != neu {
		t.Errorf("nicht gespeichert: %q", c2.get().DataDir)
	}
	var info struct{ Name string }
	json.Unmarshal(api(t, s, "GET", "/api/info", "", nil).Body.Bytes(), &info)
	if info.Name != "Noten" {
		t.Errorf("Name: %q", info.Name)
	}
	if w := api(t, s, "POST", "/api/pick", "", nil); !strings.Contains(w.Body.String(), "unavailable") {
		t.Errorf("ohne Dialog: %s", w.Body)
	}
	s.pickFolder = func() (string, error) { return "", errCancel }
	if w := api(t, s, "POST", "/api/pick", "", nil); !strings.Contains(w.Body.String(), "cancel") {
		t.Errorf("Abbruch: %s", w.Body)
	}
}

func TestTokenUndKonfig(t *testing.T) {
	dir := t.TempDir()
	c, _ := loadConfig(dir)
	t1, _ := c.token()
	t2, _ := c.token()
	if len(t1) < 32 || t1 != t2 {
		t.Errorf("Token: %q %q", t1, t2)
	}
	if c.get().Port != defaultPort {
		t.Errorf("Port: %d", c.get().Port)
	}
	os.WriteFile(filepath.Join(dir, "config.json"), []byte(`{"dataDir":"/x","port":50000,"unbekannt":1}`), 0o600)
	c, _ = loadConfig(dir)
	if c.get().Port != 50000 || c.get().DataDir != "/x" {
		t.Errorf("Konfig lesen: %+v", c.get())
	}
}

func TestAppOrdnerFinden(t *testing.T) {
	_, app, _ := testServer(t)
	mac := filepath.Join(app, "OrdoNota.app", "Contents", "MacOS")
	os.MkdirAll(mac, 0o755)
	if d := findAppDir(mac); d != app {
		t.Errorf("aus .app: %q", d)
	}
	if d := findAppDir(app); d != app {
		t.Errorf("direkt: %q", d)
	}
	if v := appVersion(os.DirFS(app)); v != "9.9.9" {
		t.Errorf("Version: %q", v)
	}
}

func jsonStr(s string) string { b, _ := json.Marshal(s); return string(b) }

func TestDatenordnerWechseln(t *testing.T) {
	s, _, data := testServer(t)
	api(t, s, "PUT", "/api/db", `{"v":1}`, nil)
	os.MkdirAll(filepath.Join(data, backupDir), 0o700)
	os.WriteFile(filepath.Join(data, backupDir, "notenmanager_2020-01-01_000001.nmdb"), []byte(`{"alt":1}`), 0o600)
	os.WriteFile(filepath.Join(data, backupDir, "fremd.txt"), []byte("x"), 0o600)

	var probe struct {
		Name        string
		HasDb, Same bool
	}
	json.Unmarshal(api(t, s, "POST", "/api/probe", `{"path":`+jsonStr(data)+`}`, nil).Body.Bytes(), &probe)
	if !probe.Same || !probe.HasDb {
		t.Errorf("aktueller Ordner: %+v", probe)
	}
	if w := api(t, s, "POST", "/api/move", `{"path":`+jsonStr(data)+`}`, nil); w.Code != 400 {
		t.Errorf("in denselben Ordner: %d", w.Code)
	}

	// Ziel mit vorhandener Datenbank: nichts überschreiben
	besetzt := t.TempDir()
	os.WriteFile(filepath.Join(besetzt, dbFile), []byte(`{"anders":1}`), 0o600)
	json.Unmarshal(api(t, s, "POST", "/api/probe", `{"path":`+jsonStr(besetzt)+`}`, nil).Body.Bytes(), &probe)
	if probe.Same || !probe.HasDb {
		t.Errorf("besetzter Ordner: %+v", probe)
	}
	if w := api(t, s, "POST", "/api/move", `{"path":`+jsonStr(besetzt)+`}`, nil); w.Code != 409 {
		t.Errorf("besetzter Ordner: %d", w.Code)
	}
	if b, _ := os.ReadFile(filepath.Join(besetzt, dbFile)); string(b) != `{"anders":1}` {
		t.Errorf("überschrieben: %s", b)
	}

	// Ohne Sicherungen
	ohne := t.TempDir()
	if w := api(t, s, "POST", "/api/move", `{"path":`+jsonStr(ohne)+`,"backups":false}`, nil); w.Code != 200 {
		t.Fatalf("Wechsel: %d %s", w.Code, w.Body)
	}
	if b, _ := os.ReadFile(filepath.Join(ohne, dbFile)); string(b) != `{"v":1}` {
		t.Errorf("Datenbank nicht kopiert: %s", b)
	}
	if _, err := os.Stat(filepath.Join(ohne, backupDir)); err == nil {
		t.Errorf("Sicherungen ungefragt kopiert")
	}
	if s.cfg.get().DataDir != ohne {
		t.Errorf("neuer Ordner nicht gemerkt")
	}
	if b, _ := os.ReadFile(filepath.Join(data, dbFile)); string(b) != `{"v":1}` {
		t.Errorf("alter Ordner verändert")
	}

	// Mit Sicherungen (vom neuen Ordner weiter)
	os.MkdirAll(filepath.Join(ohne, backupDir), 0o700)
	os.WriteFile(filepath.Join(ohne, backupDir, "notenmanager_2020-01-01_000002.nmdb"), []byte(`{"alt":2}`), 0o600)
	os.WriteFile(filepath.Join(ohne, backupDir, "fremd.txt"), []byte("x"), 0o600)
	mit := filepath.Join(t.TempDir(), "Neu ä")
	os.MkdirAll(mit, 0o700)
	if w := api(t, s, "POST", "/api/move", `{"path":`+jsonStr(mit)+`,"backups":true}`, nil); w.Code != 200 {
		t.Fatalf("Wechsel mit Sicherungen: %d %s", w.Code, w.Body)
	}
	if b, _ := os.ReadFile(filepath.Join(mit, backupDir, "notenmanager_2020-01-01_000002.nmdb")); string(b) != `{"alt":2}` {
		t.Errorf("Sicherung nicht kopiert: %s", b)
	}
	if _, err := os.Stat(filepath.Join(mit, backupDir, "fremd.txt")); err == nil {
		t.Errorf("fremde Datei mitkopiert")
	}
}
