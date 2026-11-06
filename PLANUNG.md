# OrdoNota – Geplante Funktionen

Erledigt: A Arbeit in Teilen (1.18.0), Druckauswahl (1.19.0), B Präsentationen (1.20.0–1.22.0), D Gruppenpräsentationen (1.23.0), E Reiter „Gruppen“ (1.24.0), Reiter ein-/ausschalten (1.25.0), Moodle-Import im Test (1.26.0), F Startprogramm (1.27.0), G Datei öffnen/Ordner wechseln (1.28.0), H Reiter „Zufall“ (1.29.0), N Bereich neuer Tests (1.30.0), Q Demo aus der App (1.31.0), P Programmsymbol (1.32.0), O Update-Sicherheit (1.33.0), M Reiter sortieren (1.34.0), L Spalten einklappen/bündeln (1.35.0), K Tools mit Timer (1.36.0), J Ziehen-Pools (1.37.0), R Tools je Kurs ein-/ausschalten (1.39.0), S Nachschreibtermine (1.40.0).

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

## Wunschliste vom 06.11.2026 (Reihenfolge der Umsetzung: N, Q, P, O, M, L, K, J – alle erledigt)

### J) Ziehen: mehrere Pools, eine Spalte je Pool – umgesetzt in 1.37.0

Entscheidung des Nutzers: benannte Pools, alle Ziehungen eines Pools in **einer** Notenspalte.

- Mehrere Pools pro Kurs, z. B. „HA Runde 1“ oder „Abfragen Binomische Formeln“. Auswahl des Pools oben im Reiter, „+ Neuer Pool“, umbenennen, löschen (Spalte bleibt).
- Jeder Pool hat eine Sammelspalte bei den sonstigen Leistungen. Der Spaltenkopf zeigt den **Zeitraum** der Ziehungen (z. B. „12.09.–03.10.“). Der Zeitraum wird aus den Ziehungen berechnet und nicht gespeichert.
- **Ein Pool ist nach einer Runde fertig** (Entscheidung des Nutzers): Sind weniger übrig als gewünscht, werden nur die Übrigen gezogen, danach ist der Pool abgeschlossen. Für weitere Ziehungen einen neuen Pool anlegen. Die Sammelspalte hat Gewicht 1 (änderbar wie jede Spalte).
- Der bisherige Pool bleibt als **klassischer Pool** (je Ziehung eine Spalte, automatisches Auffüllen) unverändert; alte Einzelspalten bleiben, bis man sie zusammenfasst (Entscheidung des Nutzers).
- **Prüfung auf Ziehfehler** je Pool: Note bei einer nicht gezogenen Person, gezogen ohne Note, doppelt gezogen in einer Runde, Note in einer Spalte, die zu keiner Ziehung gehört.
- **Nachträglich zusammenfassen:** Bisherige Einzelspalten „HA-Kontrolle TT.MM.“ lassen sich auswählen und zu einer Pool-Spalte zusammenfassen (Konflikte: zwei Noten für eine Person → Rückfrage).
- Rückgängig löscht nur die Noten der zurückgenommenen Ziehung aus der Sammelspalte.
- Datenmodell: `course.draw.pools: [ { id, name, half, aid, created, out, history: [ { id, date, sids, prevOut } ] } ]`. Der klassische Pool bleibt in `draw.out`/`draw.history`, damit ältere App-Versionen ihn unverändert lesen (sie sehen die Sammelspalte als normale Einzelnote). Kein neues `SCHEMA`. Der gewählte Pool gilt pro Gerät (`ui.drawPool`).

### K) Reiter „Zufall“ → „Tools“ mit Timer – umgesetzt in 1.36.0

Entscheidung des Nutzers: Reiter „Zufall“ in **„Tools“** umbenennen (die interne id `random` bleibt), dort das Werkzeug **Timer** dazu, zusätzlich als Pop-up.

- Großer Countdown mit Minuten/Sekunden, Schnellwahl (1, 2, 5, 10, 15, 20 Min.), Start/Pause/Zurücksetzen, ± 1 Min. während des Laufens.
- Designs: große Ziffern, Ring, Sanduhr, Balken (Farbwechsel gegen Ende). Signal wie beim Pomodoro (`NM.pomodoro`-Töne wiederverwenden).
- Vollbild wie bei den anderen Werkzeugen. **Pop-up** als eigenes Browserfenster, das sich auf den Beamer schieben lässt, während die App auf dem Laptop bleibt (Empfehlung; Alternative: schwebendes Fenster in der App).
- Reine Logik (Restzeit aus Startzeit/Pausen berechnen) in `js/timer.js` (`NM.timer`), Tests `tests/timer.test.html`. Pop-up als eigenes Browserfenster umgesetzt.

### L) Notenübersicht: Ziehungsspalten bündeln, Spaltengruppen ausblenden – umgesetzt in 1.35.0

Entscheidung des Nutzers: beides.

- Spaltengruppen „Klassen-/Kursarbeiten“ und „Sonstige Leistungen“ lassen sich einklappen, dann steht nur noch der Ø des Bereichs da. Zustand pro Gerät (`nm.ui`), gilt nicht für Ausdrucke.
- Ziehungsspalten (alte Einzelspalten aus dem Reiter „Ziehen“) lassen sich zu einer Gruppe „Ziehen“ einklappen. Mit J entstehen ohnehin weniger Spalten.

### M) Reiter sortierbar – umgesetzt in 1.34.0

Entscheidung des Nutzers: Reihenfolge global in der Datenbank.

- `settings.tabOrder: [ "<Reiter>" ]` (fehlt = Standardreihenfolge; unbekannte/neue Reiter hinten bzw. an ihrer Standardstelle).
- Umsortieren per Ziehen in der Reiterleiste und mit ▲▼ unter Einstellungen → Reiter, dazu „Standardreihenfolge“.

### N) Tests: „Sonstige Leistungen“ als Standard – umgesetzt in 1.30.0

- Neue Tests bekommen den Bereich „Sonstige“ statt „Klassen-/Kursarbeit“. Empfehlung: Einstellung unter „Standardwerte für neue Tests“ (`settings.testCat`, Standard `other`).

### O) Datenbank bleibt bei Updates verwendbar – umgesetzt in 1.33.0

- Testdatenbanken früherer Formate (`schema` 1–4, typische Inhalte jeder Version) als Prüfstücke in `tests/`; `model.test.html` öffnet sie mit `migrate()` und prüft, dass alles rechnet und unbekannte Felder erhalten bleiben.
- `NM.model.check(db)`: prüft nach dem Öffnen die Struktur (Verweise auf Personen, Aufgaben, Teile, Spalten) und meldet Auffälligkeiten, ohne etwas zu ändern. Aufruf in den Tests und auf Knopfdruck unter Einstellungen.

### P) Programmsymbol nur mit Logo – umgesetzt in 1.32.0

- `logo/ordonota-icon.svg`: nur das Zeichen (wie das Favicon), quadratisch, ohne Schriftzug. Wird vom Startprogramm für den Startmenü-/Taskleisten-Eintrag verwendet (das Favicon in `index.html` zeigt dasselbe Zeichen).
- Windows `.ico` und Mac `.icns` bleiben „später“ (siehe F).

### Q) Demo-Modus aus der App öffnen – umgesetzt in 1.31.0

Anlass: Im Startprogramm (App-Fenster) lässt sich die Adresse nicht um `?demo` ergänzen.

- Knopf „Demo ansehen“ auf dem Startbildschirm (Entsperren) und unter Einstellungen. Er öffnet `index.html?demo` in einem neuen Fenster, die eigene Datenbank bleibt offen und unberührt. Der Demo-Modus speichert wie bisher nichts.
- Das Startprogramm liefert `index.html?demo` schon aus (nur die Abfrage `?demo`), das prüfen und testen.

## Wunschliste vom 06.11.2026, zweiter Teil

### R) Tools je Kurs ein-/ausschalten und sortieren – umgesetzt in 1.39.0

Entscheidung des Nutzers: Auswahl **je Kurs** (wie die Reiter, in der Datenbank, auf allen Geräten gleich), Menü über einen **Knopf im Reiter „Tools“**. Neue Tools sind nicht gewünscht.

- Knopf „⚙ Werkzeuge …“ oben im Reiter öffnet ein Fenster mit einem Haken je Werkzeug und ▲▼ für die Reihenfolge, dazu „Standard“. Änderungen gelten sofort.
- Sind alle Werkzeuge aus, zeigt der Reiter einen Hinweis mit dem Knopf.
- Ein ausgeschalteter Timer läuft weiter, falls er gerade läuft (er gilt für die ganze App); nur die Kachel fehlt.
- Datenmodell: `course.tools: { off: [ids], order: [ids] }` (leer = alle an, Standardreihenfolge). Kein neues `SCHEMA`. Reine Logik `NM.model.toolList`/`setTools` mit `orderTabs`.

### S) Nachschreibtermin mit der Klassenarbeit in einer Spalte – umgesetzt in 1.40.0

Entscheidung des Nutzers: **echte Verknüpfung** (eine Spalte und eine Leistung), angelegt über einen **Knopf an der Original-Arbeit**, im Nachtermin **nur die Fehlenden** (umschaltbar).

- „+ Nachschreibtermin“ im Test legt einen neuen Test an. Aufgaben, Teile und Schlüssel werden als Vorlage übernommen, Ergebnisse und Moodle-Daten nicht. Ein bestehender Test lässt sich über „Nachschreibtermin zu“ verknüpfen oder wieder lösen.
- Notenübersicht, Notenliste, Leistungsbogen und CSV-Export zeigen eine Spalte. Wer im Nachtermin einen Eintrag hat, bekommt dessen Note (markiert mit „N“). Bei mehreren Nachterminen zählt der späteste mit Eintrag.
- Bereich, Gewicht, Halbjahr und „nicht gewertet“ kommen immer von der Arbeit (`syncMakeups`). Notenspiegel und Drittelparagraph bleiben je Test.
- Datenmodell: `a.makeupOf` (id der Arbeit). Kein neues `SCHEMA`: Ältere Versionen sehen den Nachtermin als eigenen Test mit demselben Gewicht und kommen auf dieselbe Note.

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
