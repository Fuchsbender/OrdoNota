package main

// Dateizugriff auf den Datenordner – Gegenstück zu FolderStore in js/storage.js.
// Es werden nur die bekannten Dateien angefasst:
//   notenmanager.nmdb, notenmanager.lock.json, Sicherungen/notenmanager_*.nmdb
// und Konfliktkopien (notenmanager*conflict*/konflikt*) werden nur aufgelistet.

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	dbFile    = "notenmanager.nmdb"
	lockFile  = "notenmanager.lock.json"
	backupDir = "Sicherungen"
)

var (
	backupName   = regexp.MustCompile(`^notenmanager_[0-9A-Za-z_\-]+\.nmdb$`)
	conflictName = regexp.MustCompile(`(?i)^notenmanager.*(conflict|konflikt)`)
	errConflict  = errors.New("Die Datenbank wurde inzwischen von einem anderen Gerät geändert.")
	errMissing   = errors.New("Datei nicht vorhanden")
	errBadName   = errors.New("ungültiger Dateiname")
	errExists    = errors.New("Im neuen Ordner liegt bereits eine Datenbank.")
)

type folder struct{ dir string }

// stamp liefert den Zeitstempel für Sicherungen wie in js/storage.js (lokale Zeit).
func stamp(t time.Time) string { return t.Format("2006-01-02_150405") }

// modified ist die Änderungszeit als Zeichenkette ("" = Datei fehlt).
func modified(path string) string {
	fi, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return strconv.FormatInt(fi.ModTime().UnixNano(), 10)
}

func (f folder) dbPath() string { return filepath.Join(f.dir, dbFile) }

func (f folder) readDB() ([]byte, string, error) {
	b, err := os.ReadFile(f.dbPath())
	if errors.Is(err, os.ErrNotExist) {
		return nil, "", errMissing
	}
	return b, modified(f.dbPath()), err
}

// writeDB speichert die Datenbank. expect = zuletzt bekannte Änderungszeit
// ("" = noch nie gelesen, dann keine Prüfung). keep > 0: vorher den alten Stand sichern.
func (f folder) writeDB(data []byte, expect string, force bool, keep int) (string, error) {
	cur := modified(f.dbPath())
	if !force && expect != "" && cur != expect {
		return "", errConflict
	}
	if keep > 0 && cur != "" {
		if old, err := os.ReadFile(f.dbPath()); err == nil && len(old) > 0 {
			if err := f.writeBackup(old, keep); err != nil {
				logf("Sicherung fehlgeschlagen: %v", err)
			}
		}
	}
	if err := atomicWrite(f.dbPath(), data); err != nil {
		return "", err
	}
	return modified(f.dbPath()), nil
}

func (f folder) writeBackup(data []byte, keep int) error {
	bdir := filepath.Join(f.dir, backupDir)
	if err := os.MkdirAll(bdir, 0o700); err != nil {
		return err
	}
	if err := atomicWrite(filepath.Join(bdir, "notenmanager_"+stamp(time.Now())+".nmdb"), data); err != nil {
		return err
	}
	names, err := f.listBackups()
	if err != nil {
		return err
	}
	// listBackups ist absteigend sortiert: die ältesten stehen hinten
	for i := keep; i < len(names); i++ {
		os.Remove(filepath.Join(bdir, names[i]))
	}
	return nil
}

func (f folder) listBackups() ([]string, error) {
	entries, err := os.ReadDir(filepath.Join(f.dir, backupDir))
	if errors.Is(err, os.ErrNotExist) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, e := range entries {
		if !e.IsDir() && backupName.MatchString(e.Name()) {
			out = append(out, e.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(out)))
	return out, nil
}

func (f folder) readBackup(name string) ([]byte, error) {
	if !backupName.MatchString(name) {
		return nil, errBadName
	}
	b, err := os.ReadFile(filepath.Join(f.dir, backupDir, name))
	if errors.Is(err, os.ErrNotExist) {
		return nil, errMissing
	}
	return b, err
}

func (f folder) conflicts() ([]string, error) {
	entries, err := os.ReadDir(f.dir)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, e := range entries {
		n := e.Name()
		if !e.IsDir() && n != dbFile && conflictName.MatchString(n) {
			out = append(out, n)
		}
	}
	sort.Strings(out)
	return out, nil
}

func (f folder) readLock() ([]byte, error) {
	b, err := os.ReadFile(filepath.Join(f.dir, lockFile))
	if errors.Is(err, os.ErrNotExist) {
		return nil, errMissing
	}
	return b, err
}

func (f folder) writeLock(data []byte) error {
	return atomicWrite(filepath.Join(f.dir, lockFile), data)
}

func (f folder) removeLock() error {
	err := os.Remove(filepath.Join(f.dir, lockFile))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

// atomicWrite schreibt erst in eine versteckte Hilfsdatei und benennt sie dann um,
// damit Synology Drive nie eine halb geschriebene Datei überträgt.
func atomicWrite(path string, data []byte) error {
	rnd := make([]byte, 4)
	rand.Read(rnd)
	tmp := filepath.Join(filepath.Dir(path), "."+filepath.Base(path)+".tmp-"+hex.EncodeToString(rnd))
	fh, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	_, err = fh.Write(data)
	if err == nil {
		err = fh.Sync()
	}
	if cerr := fh.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(tmp, path)
	}
	if err != nil {
		os.Remove(tmp)
		return fmt.Errorf("Speichern von %s fehlgeschlagen: %w", filepath.Base(path), err)
	}
	return nil
}

// copyTo kopiert die Datenbank (und auf Wunsch die Sicherungen) in einen anderen Ordner.
// Liegt dort schon eine Datenbank, wird nichts überschrieben. Der alte Ordner bleibt unverändert.
func (f folder) copyTo(t folder, backups bool) error {
	if modified(t.dbPath()) != "" {
		return errExists
	}
	b, _, err := f.readDB()
	if err != nil {
		return err
	}
	if backups {
		names, err := f.listBackups()
		if err != nil {
			return err
		}
		if len(names) > 0 {
			if err := os.MkdirAll(filepath.Join(t.dir, backupDir), 0o700); err != nil {
				return err
			}
		}
		for _, n := range names {
			data, err := f.readBackup(n)
			if err == nil {
				err = atomicWrite(filepath.Join(t.dir, backupDir, n), data)
			}
			if err != nil {
				return err
			}
		}
	}
	// Datenbank zuletzt: Bricht etwas ab, bleibt der neue Ordner ohne Datenbank und kann erneut gewählt werden
	return atomicWrite(t.dbPath(), b)
}

// checkDir prüft einen gewählten Datenordner.
func checkDir(p string) (string, error) {
	p = strings.TrimSpace(p)
	if strings.HasPrefix(p, "~") {
		if home, err := os.UserHomeDir(); err == nil {
			p = filepath.Join(home, strings.TrimPrefix(p, "~"))
		}
	}
	if p == "" || !filepath.IsAbs(p) {
		return "", errors.New("Bitte einen vollständigen Pfad angeben.")
	}
	p = filepath.Clean(p)
	fi, err := os.Stat(p)
	if err != nil || !fi.IsDir() {
		return "", errors.New("Ordner nicht gefunden: " + p)
	}
	return p, nil
}
