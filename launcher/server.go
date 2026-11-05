package main

// HTTP-Server: liefert die App-Dateien und die Schnittstelle /api/… für js/storage.js (ServerStore).

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	cookieName = "ordonota"
	maxBody    = 512 << 20 // Datenbanken mit vielen Fotos können groß werden
)

// Nur diese Teile des Programmordners werden ausgeliefert (nie z. B. ref/ mit echten Namen).
var staticAllowed = []string{"index.html", "css/", "js/", "logo/", "demo/"}

type server struct {
	files   fs.FS // App-Dateien: Programmordner oder ins Programm eingebaut
	token   string
	port    int
	version string
	cfg     *config

	mu        sync.Mutex
	lastSeen  time.Time
	lockOwner string // deviceId, die zuletzt über diesen Server einen Lock geschrieben hat

	pickFolder func() (string, error) // Ordner-Dialog des Systems (in Tests ersetzbar)
}

func (s *server) touch() {
	s.mu.Lock()
	s.lastSeen = time.Now()
	s.mu.Unlock()
}

func (s *server) idle() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastSeen.IsZero() {
		return 0
	}
	return time.Since(s.lastSeen)
}

func (s *server) seen() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.lastSeen.IsZero()
}

func (s *server) folder() (folder, bool) {
	d := s.cfg.get().DataDir
	return folder{dir: d}, d != ""
}

func (s *server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/start", s.handleStart)
	mux.HandleFunc("/api/", s.handleAPI)
	mux.HandleFunc("/", s.handleStatic)
	return s.checkHost(mux)
}

// checkHost lässt nur Anfragen an 127.0.0.1/localhost mit unserem Port zu (Schutz vor DNS-Rebinding).
func (s *server) checkHost(next http.Handler) http.Handler {
	p := strconv.Itoa(s.port)
	ok := map[string]bool{"127.0.0.1:" + p: true, "localhost:" + p: true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ok[r.Host] {
			http.Error(w, "unzulässiger Host", http.StatusForbidden)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// /start?t=KENNWORT setzt das Cookie und leitet zur App weiter. So steht das Kennwort nicht dauerhaft in der Adresse.
func (s *server) handleStart(w http.ResponseWriter, r *http.Request) {
	if subtle.ConstantTimeCompare([]byte(r.URL.Query().Get("t")), []byte(s.token)) != 1 {
		http.Error(w, "Bitte OrdoNota über das Startprogramm öffnen.", http.StatusUnauthorized)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: s.token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: 400 * 24 * 3600})
	http.Redirect(w, r, "/index.html", http.StatusSeeOther)
}

func (s *server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "nicht erlaubt", http.StatusMethodNotAllowed)
		return
	}
	p := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
	if p == "" || p == "." {
		http.Redirect(w, r, "/index.html", http.StatusSeeOther)
		return
	}
	allowed := false
	for _, a := range staticAllowed {
		if p == a || (strings.HasSuffix(a, "/") && strings.HasPrefix(p, a)) {
			allowed = true
		}
	}
	if !allowed || !fs.ValidPath(p) {
		http.NotFound(w, r)
		return
	}
	fh, err := s.files.Open(p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer fh.Close()
	fi, err := fh.Stat()
	rs, seekable := fh.(io.ReadSeeker)
	if err != nil || fi.IsDir() || !seekable {
		http.NotFound(w, r)
		return
	}
	// Die App lädt ihre Dateien mit ?v=…; index.html selbst immer frisch holen
	if p == "index.html" {
		w.Header().Set("Cache-Control", "no-cache")
	}
	// ServeContent statt ServeFile: ServeFile leitet /index.html auf / um
	http.ServeContent(w, r, fi.Name(), fi.ModTime(), rs)
}

func (s *server) authorized(r *http.Request) bool {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(s.token)) == 1
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func (s *server) handleAPI(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		fail(w, http.StatusUnauthorized, "Bitte OrdoNota über das Startprogramm öffnen.")
		return
	}
	// Schreibende Anfragen nur mit eigenem Kopf: fremde Seiten können ihn nicht ohne CORS-Freigabe setzen
	if r.Method != http.MethodGet && r.Header.Get("X-OrdoNota") != "1" {
		fail(w, http.StatusForbidden, "Anfrage abgelehnt")
		return
	}
	s.touch()
	route := strings.TrimPrefix(r.URL.Path, "/api/")
	switch {
	case route == "alive":
		writeJSON(w, 200, map[string]any{"ok": true, "version": s.version})
		return
	case route == "info" && r.Method == http.MethodGet:
		d := s.cfg.get().DataDir
		writeJSON(w, 200, map[string]any{"dataDir": d, "name": filepath.Base(d), "version": s.version})
		return
	case route == "folder" && r.Method == http.MethodPost:
		var body struct{ Path string }
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body); err != nil {
			fail(w, 400, "ungültige Anfrage")
			return
		}
		p, err := checkDir(body.Path)
		if err != nil {
			fail(w, 400, err.Error())
			return
		}
		if err := s.cfg.setDataDir(p); err != nil {
			fail(w, 500, err.Error())
			return
		}
		logf("Datenordner: %s", p)
		writeJSON(w, 200, map[string]any{"dataDir": p, "name": filepath.Base(p)})
		return
	case route == "pick" && r.Method == http.MethodPost:
		if s.pickFolder == nil {
			writeJSON(w, 200, map[string]any{"unavailable": true})
			return
		}
		p, err := s.pickFolder()
		switch {
		case errors.Is(err, errCancel):
			writeJSON(w, 200, map[string]any{"cancel": true})
		case errors.Is(err, errNoDialog):
			writeJSON(w, 200, map[string]any{"unavailable": true})
		case err != nil:
			fail(w, 500, err.Error())
		default:
			writeJSON(w, 200, map[string]any{"path": p})
		}
		return
	}

	f, ok := s.folder()
	if !ok {
		fail(w, http.StatusConflict, "nofolder")
		return
	}
	switch {
	case (route == "probe" || route == "move") && r.Method == http.MethodPost:
		var body struct {
			Path    string
			Backups bool
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body); err != nil {
			fail(w, 400, "ungültige Anfrage")
			return
		}
		p, err := checkDir(body.Path)
		if err != nil {
			fail(w, 400, err.Error())
			return
		}
		t := folder{dir: p}
		same := sameDir(f.dir, p)
		if route == "probe" {
			writeJSON(w, 200, map[string]any{"path": p, "name": filepath.Base(p), "hasDb": modified(t.dbPath()) != "", "same": same})
			return
		}
		if same {
			fail(w, 400, "Das ist bereits der aktuelle Datenordner.")
			return
		}
		if err := f.copyTo(t, body.Backups); err != nil {
			code := 500
			if errors.Is(err, errExists) {
				code = 409
			}
			fail(w, code, err.Error())
			return
		}
		if err := s.cfg.setDataDir(p); err != nil {
			fail(w, 500, err.Error())
			return
		}
		logf("Datenordner gewechselt: %s → %s", f.dir, p)
		writeJSON(w, 200, map[string]any{"dataDir": p, "name": filepath.Base(p), "modified": modified(t.dbPath())})
	case route == "db" && r.Method == http.MethodGet:
		b, mod, err := f.readDB()
		if errors.Is(err, errMissing) {
			fail(w, 404, "missing")
			return
		}
		if err != nil {
			fail(w, 500, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Modified", mod)
		w.Write(b)
	case route == "db/stat" && r.Method == http.MethodGet:
		mod := modified(f.dbPath())
		writeJSON(w, 200, map[string]any{"exists": mod != "", "modified": mod})
	case route == "db" && r.Method == http.MethodPut:
		data, err := readBody(r)
		if err != nil {
			fail(w, 400, err.Error())
			return
		}
		keep, _ := strconv.Atoi(r.Header.Get("X-Backup-Keep"))
		mod, err := f.writeDB(data, r.Header.Get("X-Expect"), r.Header.Get("X-Force") == "1", keep)
		if errors.Is(err, errConflict) {
			fail(w, http.StatusConflict, "conflict")
			return
		}
		if err != nil {
			fail(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, map[string]any{"modified": mod})
	case route == "backups" && r.Method == http.MethodGet:
		names, err := f.listBackups()
		if err != nil {
			fail(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, names)
	case route == "backups" && r.Method == http.MethodPost:
		data, err := readBody(r)
		if err != nil {
			fail(w, 400, err.Error())
			return
		}
		keep, _ := strconv.Atoi(r.Header.Get("X-Backup-Keep"))
		if keep < 1 {
			keep = 10
		}
		if err := f.writeBackup(data, keep); err != nil {
			fail(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	case strings.HasPrefix(route, "backups/") && r.Method == http.MethodGet:
		b, err := f.readBackup(strings.TrimPrefix(route, "backups/"))
		switch {
		case errors.Is(err, errBadName):
			fail(w, 400, err.Error())
		case errors.Is(err, errMissing):
			fail(w, 404, "missing")
		case err != nil:
			fail(w, 500, err.Error())
		default:
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Write(b)
		}
	case route == "conflicts" && r.Method == http.MethodGet:
		names, err := f.conflicts()
		if err != nil {
			fail(w, 500, err.Error())
			return
		}
		writeJSON(w, 200, names)
	case route == "lock" && r.Method == http.MethodGet:
		b, err := f.readLock()
		if errors.Is(err, errMissing) {
			writeJSON(w, 200, nil)
			return
		}
		if err != nil {
			fail(w, 500, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(b)
	case route == "lock" && r.Method == http.MethodPut:
		data, err := readBody(r)
		var l struct{ DeviceId string }
		if err == nil {
			err = json.Unmarshal(data, &l)
		}
		if err != nil {
			fail(w, 400, "ungültiger Lock")
			return
		}
		if err := f.writeLock(data); err != nil {
			fail(w, 500, err.Error())
			return
		}
		s.mu.Lock()
		s.lockOwner = l.DeviceId
		s.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
	case route == "lock" && r.Method == http.MethodDelete:
		if err := f.removeLock(); err != nil {
			fail(w, 500, err.Error())
			return
		}
		s.mu.Lock()
		s.lockOwner = ""
		s.mu.Unlock()
		writeJSON(w, 200, map[string]any{"ok": true})
	default:
		fail(w, 404, "unbekannt")
	}
}

// sameDir: zeigen beide Pfade auf denselben Ordner (auch über Verknüpfungen)?
func sameDir(a, b string) bool {
	fa, err1 := os.Stat(a)
	fb, err2 := os.Stat(b)
	if err1 != nil || err2 != nil {
		return filepath.Clean(a) == filepath.Clean(b)
	}
	return os.SameFile(fa, fb)
}

func readBody(r *http.Request) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
	if err != nil {
		return nil, err
	}
	if len(b) > maxBody {
		return nil, errors.New("Datei zu groß")
	}
	if len(b) == 0 {
		return nil, errors.New("leer")
	}
	return b, nil
}

// releaseOwnLock entfernt beim Beenden den Lock, wenn er noch von dieser Sitzung stammt.
func (s *server) releaseOwnLock() {
	s.mu.Lock()
	owner := s.lockOwner
	s.mu.Unlock()
	f, ok := s.folder()
	if owner == "" || !ok {
		return
	}
	b, err := f.readLock()
	if err != nil {
		return
	}
	var l struct{ DeviceId string }
	if json.Unmarshal(b, &l) == nil && l.DeviceId == owner {
		f.removeLock()
		logf("Lock freigegeben")
	}
}
