# OrdoNota – Geplante Funktionen

Erledigt: A Arbeit in Teilen (1.18.0), Druckauswahl (1.19.0), B Präsentationen (1.20.0–1.22.0), D Gruppenpräsentationen (1.23.0), E Reiter „Gruppen“ (1.24.0), Reiter ein-/ausschalten (1.25.0), Moodle-Import im Test (1.26.0), F Startprogramm (1.27.0), G Datei öffnen/Ordner wechseln (1.28.0), H Reiter „Zufall“ (1.29.0).

## F) Startprogramm (Server + App-Fenster) – umgesetzt in 1.27.0

Ziel: Start per Verknüpfung, ohne die Rückfrage „Zugriff auf den Ordner erlauben“ – auf Linux, Windows und Mac, ohne dass Python o. Ä. installiert sein muss.

Entscheidungen des Nutzers: Go (ein Programm je System, gebaut auf Linux), Start per Verknüpfung, Browser im App-Fenster (`--app`). Mit Empfehlung umgesetzt (Fragen offen gelassen): Datenordner beim ersten Start wählen (Ordner-Dialog des Systems, sonst Pfad eingeben) und in einer Einstellungsdatei merken; Server endet, wenn das Fenster geschlossen ist; Weitergabe an Kollegen als ZIP mit App-Dateien und Programmen.

- `launcher/` (Go, nur Standardbibliothek): Server auf `127.0.0.1` mit festem Port (sonst gingen Gerätename und Ansicht im Browser-Speicher verloren), liefert nur die App-Dateien (`index.html`, `css/`, `js/`, `logo/`, `demo/`, `cards/`) und eine kleine Schnittstelle `/api/…` für Datenbank, Sicherungen, Lock und Konfliktkopien. Nur bekannte Dateinamen. Zugriff nur mit Kennwort-Cookie (pro Benutzer, Datei nur für ihn lesbar) und passendem `Host`.
- Browser: Chrome/Edge/Chromium/Thorium/Brave mit `--app` und eigenem Profil; sonst Standardbrowser. Zweiter Start öffnet nur ein neues Fenster.
- Linux: `.desktop`-Eintrag legt das Programm selbst an. Windows: `OrdoNota.exe` ohne Konsole. Mac: `OrdoNota.app` (Skript wählt Intel/Apple-Silicon).
- App: `NM.storage.ServerStore` (gleiche Schnittstelle wie `FolderStore`), `NM.storage.detectServer()`. Doppelklick auf `index.html` funktioniert weiter.
- Bauen: `launcher/build.sh` → `dist/`. Nur die App-Dateien kommen mit eingebauten Dateien ins Programm (`-tags embedapp`), damit es unter macOS auch nach dem Verschieben durch Gatekeeper läuft.
- Offen/später: Programmsymbol für Windows (`.ico`) und Mac (`.icns`), Signierung.

## G) Datenbank aus Datei öffnen und Datenordner wechseln – umgesetzt in 1.28.0

Anlass: Der Nutzer will Programmordner (nur lokal, per Git) und Datenordner (Synology) trennen und die Datenbank als eine Datei sichern und umziehen.

1. **Aus Datei wiederherstellen:** Einstellungen → Speicherort & Sicherungen → „Aus Datei wiederherstellen …“: eine `.nmdb`-Datei (z. B. „Verschlüsselte Kopie herunterladen“) wählen (`<input type=file>`, kein Ordnerzugriff nötig), wie `restoreBackup` öffnen (anderer Schlüssel → Passwort der Datei abfragen), aktuellen Stand vorher sichern, dann übernehmen. Auch auf dem Startbildschirm bei leerem Ordner: „Neue Datenbank anlegen“ oder „Vorhandene Datenbank aus Datei übernehmen“ (dann mit deren Passwort entsperren).
2. **Datenordner wechseln:** Einstellungen → „Datenordner wechseln …“: neuen Ordner wählen; liegt dort schon eine Datenbank → Hinweis und Abbruch (nichts überschreiben) bzw. „diese öffnen“; sonst aktuelle Datenbank dorthin schreiben, Sicherungen auf Wunsch mitkopieren, Lock im alten Ordner freigeben, neuen Ordner merken. Der alte Ordner bleibt unverändert (Hinweis: kann gelöscht werden). Für `FolderStore` und `ServerStore` (neue Schnittstelle zum Kopieren der Sicherungen bzw. Schreiben in den neuen Ordner).
3. Doku: Umzug Programmordner/Datenordner (Abschnitt 3 und 4), Git-Klon außerhalb von Synology, Update per `git pull && launcher/build.sh`.

Entscheidungen des Nutzers (Empfehlungen): Sicherungen beim Wechsel mitkopieren → fragen (nur wenn es welche gibt); Wiederherstellen aus Datei mit fremdem Passwort → das eigene Passwort bleibt (neu verschlüsselt). Im leeren Ordner übernimmt die Datei dagegen ihr eigenes Passwort.

## H) Reiter „Zufall“ – Werkzeuge für den Unterricht – umgesetzt in 1.29.0

Nur Werkzeug, **keine Eintragung in die Notenliste**. Neuer Reiter `random` („Zufall“), ein-/ausschaltbar wie die anderen.

- **Zufallszahl** von–bis (ganzzahlig), kurze Zähl-Animation, die letzten Ergebnisse daneben.
- **Personen auswählen:** Anzahl wählen, Ergebnis groß mit Foto. Haken „Keine Wiederholung“: wer dran war, kommt erst wieder, wenn alle dran waren (nur bis zum Neuladen, unabhängig vom Pool im Reiter „Ziehen“). „Heute abwesend“ aus dem Reiter „Ziehen“ gilt mit.
- **Würfel:** W4, W6, W8, W10, W12, W20, 1–6 Würfel mit Summe. Echte 3D-Körper mit eigenem kleinen Canvas-Zeichner (keine Bibliothek, Projektregel), Würfel rollen und landen mit der gewürfelten Seite nach vorn. Gegenüberliegende Seiten ergeben n + 1.
- **Karten:** 52 Karten (Poker/Rommé), 32 Karten (Skat), eigene Karten mit Text (je Zeile eine, im Kurs gespeichert: `course.randomCards`). Bilder: gemeinfreie SVGs (CC0) aus AustinGabriel/Public-Domain-and-CC0-Playing-Cards in `cards/`. Stapel immer sichtbar, mehrere Karten auf einmal, ziehen ohne Zurücklegen, die Karten fliegen vom Stapel und drehen sich um, „Neu mischen“.
- Jedes Werkzeug lässt sich im Vollbild zeigen (Beamer). Bei „Bewegung reduzieren“ keine Animation.
- Zufall über `crypto.getRandomValues`. Reine Logik in `js/random.js` (`NM.random`), Reiter `js/view-random.js`. Einstellungen (Bereich, Würfelart, Anzahl) pro Gerät in `nm.ui`.

Entscheidungen des Nutzers: eigener Reiter; Auswahl umschaltbar (Standard: unabhängig); Stapel 52, 32, eigene Texte; alle Würfel in 3D.

## I) Kartenbilder: deutsche Buchstaben B und D (offen, später)

Anlass: Die Kartenbilder in `cards/` (CC0, siehe `cards/LIZENZ.txt`) zeigen die englischen Eckbuchstaben **J** (Jack) und **Q** (Queen). Im Deutschen heißen die Karten Bube und Dame, also **B** und **D**. König (K) und Ass (A) passen schon.

- Betroffen sind 8 Dateien: `cards/{C,D,H,S}B.svg` (J → B) und `cards/{C,D,H,S}D.svg` (Q → D).
- Die Buchstaben sind **Pfade, keine `<text>`-Elemente**. Je Karte gibt es zwei Ecken (oben links und unten rechts, um 180° gedreht), in Rot bzw. Schwarz. Die beiden Pfade werden gesucht und durch B- bzw. D-Pfade in gleicher Größe, Strichstärke und Farbe ersetzt (z. B. aus einer freien Schrift umgewandelt oder von Hand gezeichnet).
- Danach `cards/LIZENZ.txt` (Abschnitt „Änderungen“) und die Doku (10c: „Die Karten zeigen J, Q, K …“) anpassen. Der Test in `run_random_check` braucht keine Änderung.
- Alternative ohne Bildbearbeitung: die Ecken in der App mit einem kleinen Feld „B“/„D“ überdecken (CSS). Das ist einfacher, sieht aber weniger sauber aus.

## C) Gamification des Pomodoro-Timers (zurückgestellt, erst auf Nachfrage des Nutzers)

**Vor Beginn die offenen Fragen unten mit dem Nutzer klären.** C ergänzt nur Felder → kein neues `SCHEMA`; `migrate()` und `tools/entschluesseln.py` (CSV-Ausgabe) mitziehen.

**Grundlage: Korrekturen zählen.** Rohdaten, keine berechneten Werte:
- `test.results[sid].done?: ISO`: Zeitpunkt, an dem die Arbeit erstmals **vollständig** eingetragen war (alle Nicht-Bonus-Aufgaben haben einen Wert, oder es gibt einen Status). Gesetzt in `view-tests.js` beim Eintragen (und beim Moodle-Import). Wird nie zurückgesetzt, außer alle Punkte werden gelöscht. Gilt analog für Präsentationen (Punkte über `G.presScores`).
- `db.focusLog: [ { date: "YYYY-MM-DD", at: ISO, min, clean: bool, corrected: n } ]`: ein Eintrag je beendetem Pomodoro (Arbeitsphase). `clean` = ohne Pause/Zurücksetzen durchgelaufen. `corrected` = Arbeiten, die während der Phase `done` bekamen. Endet die Phase, während die App gesperrt ist, kommt der Eintrag in eine Warteschlange in `localStorage` (`nm.pomodoro.pending`) und wird beim Entsperren übernommen. Der Log enthält nur Anzahlen, keine Namen.
- Badges und Streaks werden **immer berechnet** aus `focusLog`, `done`-Zeitstempeln und Testdatum (neues reines Modul `js/gamify.js`, `NM.gamify`, ohne DOM).

**Belohnungen (Vorschlag)**
- 🍅 **Tomate:** Pomodoro sauber beendet (ohne Pause/Abbruch). Faule 🥀-Tomate, wenn abgebrochen? (siehe Fragen)
- 🧺 **Ernte:** alle Pomodoros eines Durchlaufs sauber geschafft.
- 🔥 **Streak:** Werktage in Folge mit mindestens einer Tomate (Wochenenden zählen nicht als Unterbrechung; Ferien siehe Fragen). Anzeige aktuell und Rekord.
- ⚡ **Blitzkorrektur:** Test vollständig eingetragen ≤ 3 Tage nach Testdatum; 🏃 ≤ 7 Tage; Stufen einstellbar. „Vollständig“ heißt: alle aktiven Personen haben `done`.
- 📚 **Fließband:** ≥ 10 Arbeiten in einem Pomodoro korrigiert.
- 🏅 **Meilensteine:** 10/50/100/500 Tomaten bzw. korrigierte Arbeiten.

**Oberfläche**
- Kopfzeile: neben dem Timer ein kleiner Zähler „🍅 3 · 🔥 5“ (heute, Streak). Bei sauberem Phasenende eine kurze Animation (Tomate „ploppt“, ohne Animation bei „Bewegung reduzieren“) und ein Toast mit neuem Badge.
- Knopf 🏆 im Widget öffnet den Dialog „Erfolge“: Tomaten heute/Woche (Balken je Tag), Streak und Rekord, Badges (erreicht/ausstehend), Korrekturstand je Test im Schuljahr (x / n Arbeiten, Tage bis fertig).
- Im Reiter „Tests“: Fortschrittsanzeige „Korrigiert 18 / 27“ neben den Unterschriften.
- Einstellungen → Pomodoro: Haken „Belohnungen anzeigen“ (Standard an, wenn der Timer aktiv ist), Tage für Blitzkorrektur, Haken „Wochenenden unterbrechen den Streak nicht“.

**Tests:** `gamify.test.html` (Streak über Wochenenden, Blitzkorrektur-Grenzen, vollständig/unvollständig, Meilensteine), `model.test.html` (Migration `focusLog`, `done`), E2E (Pomodoro sauber beenden → Eintrag mit `corrected`, Badge-Dialog ohne Fehler).

**Offene Fragen** (Empfehlung jeweils dabei)
1. Was ist eine „gute Einheit“: nur sauber durchgelaufen (Empfehlung) oder zusätzlich mindestens n korrigierte Arbeiten?
2. Streak geräteübergreifend in der Datenbank (Empfehlung, `focusLog`) oder nur pro Gerät?
3. Ferien bei Streaks berücksichtigen (Ferientermine RLP von Hand eintragbar) oder einfach „Werktage“?
4. Sollen auch EPO-Einträge und direkt eingetragene Noten als „Korrektur“ zählen, oder nur Tests/Präsentationen?
5. Faule Tomate für abgebrochene Pomodoros zeigen oder nur positive Belohnungen (Empfehlung)?
