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

## T) Schnittstelle zu OrdoScripto: Trennblätter mit QR-Code, Import- und Punkte-CSV (Teil 1 umgesetzt in 1.41.0, Teil 2 offen)

Anlass: OrdoScripto (eigenes Projekt, `../OrdoScripto`) liest handschriftliche Mathe-Arbeiten per KI und schlägt Punkte vor. Es kennt **keine Namen**, nur Test-ID, Schüler-ID und Kurs. OrdoNota erzeugt diese Pseudonyme, druckt Trennblätter mit QR-Code und übernimmt am Ende die Punkte. Die Formate legt `docs/DESIGN.md` von OrdoScripto fest (Abschnitt „Schnittstellen zu OrdoNota“). Sie müssen **genau** eingehalten werden.

Ablauf: Test in OrdoNota anlegen → „Für OrdoScripto vorbereiten“ → Trennblätter drucken und Import-CSV speichern → Lehrkraft legt je Schüler das Trennblatt vor die Arbeit und scannt den Stapel → OrdoScripto liest die QR-Codes und verwirft die Trennblattseiten → … → Punkte-CSV zurück nach OrdoNota.

### Teil 1 – wird für OrdoScripto Bauplan-Schritt 3 (Scan-Import) gebraucht – umgesetzt in 1.41.0

Umgesetzt wie unten beschrieben (Doku: `DOKUMENTATION.md` 7.9 und 26.4). Abweichungen im Detail: Ein Nachschreibtermin speichert keine Kopie von `scripto`, sondern liest Test-ID und IDs der Arbeit (`NM.scripto.dataOf`), damit beide nie auseinanderlaufen. Der QR-Erzeuger kann die Versionen 1–10. Die 6 cm gelten für den Code ohne Ruhezone. Der Rundlauf in `run_tests.py` liest zusätzlich die gedruckten Trennblätter als PDF (300 dpi, Graustufen wie der Scan-Import).


- **Datenmodell:** `test.scripto?: { testId: "T-2026-0142", ids: { "<sid>": "S-7F3K9Q" }, created: "<ISO>" }`. Optionales Feld, `migrate()` braucht keinen Standardwert, `SCHEMA` bleibt. `tools/entschluesseln.py` gibt die Zuordnung mit aus.
- **Test-ID** `T-<Jahr>-<NNNN>`: Jahr der Arbeit, `NNNN` vierstellig und laufend aus `settings.scriptoSeq` (eindeutig in der Datenbank).
- **Schüler-ID** `S-` plus 6 Zeichen aus dem Base32-Alphabet in `js/crypto.js` (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, ohne I, O, 0, 1), Zufall über `crypto.getRandomValues`, eindeutig im Test. OrdoScripto prüft `^S-[A-Z0-9]{6}$`, das Alphabet ist eine Teilmenge davon.
- **Pseudonyme je Test neu**, damit OrdoScripto keine Arbeiten über Tests hinweg einer Person zuordnen kann. Ein Nachschreibtermin (`makeupOf`) übernimmt `testId` und `ids` der Klassenarbeit, weil OrdoScripto Nachschreibarbeiten in denselben Test importiert. Einmal vergebene IDs ändern sich nie. Später hinzugekommene Schüler bekommen beim nächsten Vorbereiten eine ID dazu.
- **QR-Code-Erzeuger** `js/qr.js` (`NM.qr`), rein und ohne Bibliothek (Projektregel): Byte-Modus, Fehlerkorrektur **Q** (verträgt Knicke und Scanrauschen), kleinste passende Version (der Inhalt `ORDO|T-2026-0142|S-7F3K9Q` hat 25 Zeichen → Version 3), Reed-Solomon über GF(256), alle 8 Masken mit Strafpunkten, Format-Information. Ausgabe als Modulmatrix und als SVG mit 4 Modulen Ruhezone. Unterstützt werden mindestens die Versionen 1–5.
- **QR-Inhalt:** `ORDO|<testId>|<schuelerId>`, genau so, ohne Leerzeichen oder Zeilenende.
- **Trennblätter drucken:** neuer Eintrag in der Druckauswahl des Tests (`NM.ui.printButton`), „Trennblätter für OrdoScripto“. Je aktivem Schüler eine A4-Seite mit:
  - Name und Klasse groß zum Einsortieren,
  - Titel und Datum des Tests,
  - QR-Code mittig, etwa 6 cm breit, mit der Test- und Schüler-ID als Text darunter,
  - dem Hinweis „Trennblatt – vor die Arbeit des Schülers legen“.

  Die Reihenfolge entspricht der Schülerliste. Eine Option druckt nur die Nachschreiber.
- **Import-CSV speichern:** `<testId>_import.csv`, UTF-8 ohne BOM, Semikolon, Kopfzeile `test_id;schueler_id;kurs`, je Schüler eine Zeile, `kurs` = Einstufung der Person (`U`, `G`, `E`, `E1`, `E2`, `GK`, `LK`, siehe Entscheidungen 5 und 6). **Nur diese drei Spalten**, keine Namen (OrdoScripto lehnt weitere Spalten ab).
- **Tests:** `tests/qr.test.html` (Matrixgröße je Version, Format-Bits, Reed-Solomon gegen bekannte Werte, ID-Format und Eindeutigkeit, Übernahme beim Nachschreibtermin). In `tests/run_tests.py` ein Rundlauf: Matrizen für mehrere Inhalte, Versionen und alle Masken aus der App holen, als Bild rastern und mit `zxing-cpp` lesen (`uv run --with zxing-cpp --with pillow …`). Der gelesene Text muss exakt übereinstimmen. Dieselbe Bibliothek liest die Codes später in OrdoScripto.

### Teil 2 – wird für OrdoScripto Bauplan-Schritt 7 (Export) gebraucht

- **Punkte-CSV importieren:** `<testId>_punkte.csv` mit `test_id;schueler_id;A1a;A1b;…;Summe`. Fremde Test-ID → ablehnen. Schüler-ID über `test.scripto.ids` zurück auf `sid`. Leere Werte → Status `fehlt`. Die Summe gegen die Einzelwerte prüfen, Werte über `max` melden.
- **Spalten-Zuordnung:** `A<nummer>` gegen die Aufgabennamen des Tests (normalisiert: `1a`, `A1a`, `Aufgabe 1a`). Was nicht passt, ordnet die Lehrkraft in einem Dialog zu. Bei Arbeiten in Teilen über `G.orderedTasks`.
- Vor dem Überschreiben vorhandener Punkte nachfragen.

### Entscheidungen des Nutzers (09.11.2026)

1. **G/E-Einstufung:** gilt für den ganzen Kurs und wird beim Anlegen des Kurses festgelegt. Es braucht keine Einstufung je Schüler. Die Import-CSV schreibt für alle Schüler den Wert des Kurses. OrdoNota hat dafür noch kein Feld (`G.courseLevel` meint Sek I/MSS). Neues Kursfeld `einstufung: "G" | "E" | ""` im Kursdialog, Standardwert `""` in `migrate()`. „Für OrdoScripto vorbereiten“ fragt nach, wenn es leer ist.
2. **Pseudonyme:** je Test neu.
3. **Test-ID:** fortlaufend (`settings.scriptoSeq`).
4. **Knopf** „Für OrdoScripto vorbereiten“: in der Testansicht neben dem Moodle-Import.
5. **Nachtrag 10.11.2026, ersetzt Entscheidung 1** (umgesetzt in 1.42.0): Ein Kurs ist undifferenziert (Standard), G, E, E1 oder E2. Die Einstellung gilt für alle, einzelne Personen lassen sich abweichend einstufen (`student.einstufung`). Die Import-CSV schreibt die Einstufung je Person unverändert (`U`, `G`, `E`, `E1`, `E2`). OrdoScripto zeigt sie nur an, denn die Bepunktung folgt dem Erwartungshorizont und die Noten vergibt OrdoNota bzw. die Lehrkraft (OrdoScripto angepasst: DESIGN.md, CSV-Prüfung, Migration 9). Version 1.42.0 hatte zunächst auf G/E abgebildet und für undifferenziert je Arbeit nachgefragt; das entfiel in 1.42.1.
6. **Nachtrag 10.11.2026** (umgesetzt in 1.43.1): In der Oberstufe gibt es die Einstufungen undifferenziert, **GK** (Grundkurs) und **LK** (Leistungskurs); die Sek I behält U, G, E, E1, E2. Die Einstufung des Kurses folgt der MSS-Kursart, Personen lassen sich abweichend einstufen (gemeinsame GK/LK-Kurse). Die Import-CSV schreibt `GK`/`LK` unverändert (OrdoScripto angepasst: DESIGN.md, CSV-Prüfung, Migration 10).

OrdoScripto kann Trennblätter auch selbst als PDF erzeugen, für Nutzer ohne OrdoNota. Für OrdoNota ändert das nichts: Wer OrdoNota nutzt, erzeugt IDs und Trennblätter dort, weil nur OrdoNota die Namen kennt.

## U) Farbschemata: je drei helle und drei dunkle Designs – umgesetzt in 1.43.0

Wunsch des Nutzers: In den Einstellungen lassen sich drei helle und drei dunkle Designs auswählen.

### Ausgangslage
- Alle Farben der Oberfläche sind Tokens auf `:root` in `css/app.css`. Davon gibt es 24, etwa `--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--ok`, `--danger`, `--warn` und die Notenfarben `--g-l`, `--g-s`, `--g-text`, `--bar-l`. Hart codiert sind nur Schatten, der Hintergrund von Dialogen und `#fff` auf Fotoknöpfen. Ein Design ist deshalb nur ein Satz Tokens, ein Umbau der Regeln ist nicht nötig.
- Heute sind ein helles und ein dunkles Schema eingebaut. `ui.theme` kann `auto`, `light` oder `dark` sein und wird je Gerät im Browser-Speicher gespeichert. Ausgewählt wird es in Einstellungen → „Farbschema“, umgeschaltet über das Mond-Symbol in der Kopfzeile. Das Timer-Fenster übernimmt `data-theme`.
- Ausdrucke sind immer schwarz auf weiß. Das bleibt so.

### Die sechs Designs (Farbwelten, Entscheidung des Nutzers)
| Hell | Farbwelt | Dunkel | Farbwelt |
|---|---|---|---|
| **Standard** | wie bisher, Petrol | **Standard** | wie bisher, Schiefer |
| **Salbei** | leicht grünliches Grau, gedämpfter Salbeigrün-Akzent | **Nord** | kühles Blaugrau, Eisblau-Akzent |
| **Lavendel** | zartes Fliederweiß, Lila-Akzent | **Aubergine** | dunkles Violett, helles Lila als Akzent |

Für alle sechs gilt:
- Text und `--muted` erreichen auf `--bg`, `--surface` und `--surface-2` mindestens ein Kontrastverhältnis von 4.5:1 (WCAG AA).
- `--on-accent` auf `--accent` erreicht 4.5:1.
- `--ok`, `--warn` und `--danger` bleiben grün, gelb und rot. Bei **Salbei** muss sich `--ok` vom Akzent abheben: Der Akzent wird graugrün und gedämpft, `--ok` bleibt ein sattes Grün, und Haken und Erfolgsmeldungen zeigen zusätzlich ihr Symbol.
- Die Notenfarben (grün → rot, Farbton aus der Note) bleiben gleich. Je Design werden nur Helligkeit und Sättigung (`--g-l`, `--g-s`) und die Schriftfarbe (`--g-text`) angepasst.

### Umsetzung
- **Einstellung:** `ui.theme` bleibt der Modus (`auto`, `light`, `dark`). Neu sind `ui.lightTheme` und `ui.darkTheme`, Standardwert jeweils `standard`. Wie bisher wird die Einstellung je Gerät im Browser-Speicher abgelegt (siehe Frage 2). Die Datenbank ändert sich nicht, `migrate()` und `SCHEMA` bleiben unberührt.
- **CSS:** `:root[data-theme='dark']` und `[data-theme='light']` bleiben die Standard-Designs. Die übrigen vier überschreiben nur die abweichenden Tokens, z. B. `:root[data-theme='light'][data-variant='salbei']`. Der bisherige `prefers-color-scheme`-Block bleibt als Rückfall, solange das Skript noch nicht gelaufen ist.
- **JS:** `applyTheme()` (`js/app.js`) rechnet `auto` selbst in hell oder dunkel um (`matchMedia`, mit Listener für den Systemwechsel). Danach setzt es immer beide Attribute, `data-theme` und `data-variant`. Das Timer-Fenster (`view-random.js`) übernimmt beide.
- **Kopfzeile:** Das Mond-Symbol wechselt weiter nur zwischen hell und dunkel und nimmt dabei jeweils das gewählte helle bzw. dunkle Design.
- **Einstellungen:** Unter „Farbschema“ (Wie das System / Hell / Dunkel) kommen zwei Reihen mit je drei anklickbaren Vorschaukacheln, „Helles Design“ und „Dunkles Design“. Jede Kachel zeigt eine Mini-Ansicht aus Hintergrund, Fläche, Text, Akzent und einer grünen, gelben und roten Notenzelle. Die Auswahl wirkt sofort.
- **Hart codierte Farben:** Die Schatten und den Hintergrund der Dialoge (`rgba(…)`) in Tokens (`--shadow-lg`, `--backdrop`) überführen, damit die dunklen Designs sie anpassen können.

### Tests
- Im End-to-End-Test (`run_tests.py`) wird für alle sechs Designs `data-theme`/`data-variant` gesetzt. Dann werden die berechneten Tokens ausgelesen und die Kontrastregeln oben geprüft, einschließlich `--g-text` auf den Notenfarben für die Noten 0, 5, 10 und 15.
- Weitere Prüfungen: Die Auswahl in den Einstellungen bleibt nach dem Neuladen erhalten. `auto` folgt dem System (über die Emulation von `prefers-color-scheme` im Chrome-Protokoll). Das Mond-Symbol behält das gewählte Design. Das Timer-Fenster übernimmt das Design.

### Doku und Version
- Neue Funktion, daher Minor-Version **1.43.0**.
- In `DOKUMENTATION.md` den Abschnitt Einstellungen ergänzen, dazu die Testliste 25.1 und die Einstiegspunkte in 26.4. In `README.md` einen Satz ergänzen.

### Entscheidungen des Nutzers (10.11.2026)
1. **Designs:** Farbwelten statt Kontrast- und OLED-Designs. Hell: Standard, Salbei, Lavendel. Dunkel: Standard, Nord, Aubergine.
2. **Speicherort:** je Gerät im Browser-Speicher, wie das bisherige Farbschema.
3. **Kopfzeile:** Das Mond-Symbol wechselt nur zwischen hell und dunkel, jeweils im gewählten Design.

## Wunschliste vom 10.11.2026 (Reihenfolge der Umsetzung: V, W, X, Y)

Schon vorhanden und Grundlage für alle drei: die Schnellwahl im EPO-Reiter (neueste Stunde, ++ … --, k, u/h), die Hausaufgaben-Zusätze u/h und die Zählung von k je EPO-Block.

### V) Material vergessen als Zusatz „m“ – umgesetzt in 1.44.0
- Ein Zellwert bekommt zusätzlich zu `r` und `hw` das Feld `m: 1` (Material vergessen). Eingabe z. B. `+m`, `0hm`, `m`, `km`; die Reihenfolge von h/u und m ist beliebig. `G.parseEpoCell`/`epoCellText` ziehen mit.
- Punkte: `epo.points.m`, Standard **0**, also nur gezählt; in den Block-Einstellungen änderbar wie u/h. `epoResult` liefert zusätzlich `m` (Anzahl).
- Anzeige: Knopf „m“ in der Schnellwahl, Legende, Spalte „HA“ wird zu „HA/M“ (u/h/m). Ausdrucke (EPO-Zusammenfassung, Leistungsbogen) nennen „Material vergessen: n“.
- Notfallwerkzeug: Kürzel mit m in der CSV.
- Tests: `grades.test.html` (Parser, Punkte, Zählung), E2E (Eingabe, Schnellwahl, Ausdruck).

### W) Fehlzeiten je Kurs – umgesetzt in 1.45.0
- Datenmodell `course.attendance = { "<YYYY-MM-DD>": { half, hours, abs: { "<sid>": "a" | "e" | "u" } } }`: `a` = abwesend (Entschuldigung offen), `e` = entschuldigt, `u` = unentschuldigt. `hours` = Unterrichtsstunden an diesem Tag (Standard 1, Doppelstunde 2). `half` = Halbjahr, das beim Anlegen gewählt war.
- „Heute abwesend“ (Ziehen, Gruppen, Tools) wird dauerhaft: Es liest und schreibt die Einträge des heutigen Datums. Bisher galt es nur für die Sitzung.
- EPO: Ein k in einer Stunde schreibt `a` für dieses Datum (wenn noch nichts eingetragen ist). Wird k entfernt, verschwindet ein `a`, ein `e`/`u` bleibt. Eine neue EPO-Stunde übernimmt die Abwesenden dieses Datums als k.
- Oberfläche: neue Karte „Fehlzeiten“ im Reiter „Kurs & Schüler“: Tage als Spalten, je Person a/e/u per Klick reihum, Stundenzahl je Tag, Summen je Halbjahr (Fehlstunden gesamt, davon entschuldigt, unentschuldigt, offen). Summen werden immer berechnet, nie gespeichert.
- Notenübersicht: Spalte „Fehlst.“ (eingeklappt wie die anderen Gruppen); Leistungsbogen und Druckauswahl „Fehlzeiten“ je Halbjahr.
- `migrate()`: `attendance` = `{}`; `check()` prüft die Werte. Notfallwerkzeug: Fehlzeiten in der CSV.
- Tests: neues `attendance.test.html` bzw. in `model.test.html` (Summen, Sync mit EPO, Migration), E2E (Karte, Heute abwesend bleibt nach Neuladen, EPO-k).

### X) Kachelansicht für das Tablet – umgesetzt in 1.46.0
- Im EPO-Block Knopf „▦ Kacheln“: Vollbild-Ansicht für die neueste Stunde (Stunde wählbar). Je Person eine große Kachel mit Foto, Vorname und Nachname und der aktuellen Bewertung als Farbe.
- Anordnung nach Sitzplan: Raum = der im Reiter „Sitzplan“ gewählte (`ui.seatingId`), umschaltbar; wer im Raum keinen Platz hat, steht unten in einer Reihe. Ohne Sitzplan alphabetisch im Raster.
- Tippen auf eine Kachel öffnet große Knöpfe ++ + 0 - -- k und u/h/m (wie die Schnellwahl, gleiche Logik, erneutes Tippen hebt auf). Abwesende aus W sind vorbelegt mit k.
- Für Touch: Mindestgröße der Knöpfe 44 px, keine Hover-Abhängigkeit, Esc/✕ schließt. Fotos nur, wenn „Fotos“ an ist. Nicht für den Beamer gedacht (zeigt Bewertungen).
- Tests: E2E mit Touch-Emulation (Kachel tippen, Bewertung gesetzt, Sitzplan-Positionen, ohne Sitzplan alphabetisch).

### Y) Einheitlicher Druckkopf mit Schullogo – umgesetzt in 1.47.0
- Neue Einstellungen in der Datenbank: `settings.print = { schoolName, teacher, logo }`. `logo` ist eine Data-URL (PNG/JPEG/SVG), beim Hochladen auf höchstens 600 px verkleinert (SVG bleibt). Karte „Ausdrucke“ im Reiter „Einstellungen“: Logo wählen/entfernen mit Vorschau, Schulname, Lehrkraft.
- Ein Kopf für alle Ausdrucke: `header(course, title, sub, { kicker, person, half, date, compact, … })` in `js/print.js` (umgesetzt mit den bisherigen Parametern plus Optionen). Links das Logo (max. 18 mm hoch), daneben der Schulname. Rechts Kurs (Klasse · Fach), Schuljahr bzw. Halbjahr, Lehrkraft und Datum (Datum der Leistung, sonst Druckdatum). Darunter Titel und ggf. Name der Person. Was nicht eingetragen ist, fällt weg. Ohne Logo und Schulnamen sieht der Kopf aus wie heute.
- Umstellen: Notenliste, Leistungsbögen, Ergebnisliste, Ergebnisse nach Teilen, Notenschlüssel/-spiegel, Moodle-Rückmeldung, Präsentationen (Liste, Schlüssel, leere Bögen, Bogen je Person, Handreichung), Gruppen, Sitzplan, EPO-Liste, Trennblätter. Die bisherigen Kopfvarianten (`p-header`, `p-mr-*`, `p-epo-slip-head`, `p-slip-head`) laufen in dieser einen Funktion zusammen; die Zettel zum Ausschneiden bekommen die kleine, einzeilige Variante (`compact`: Logo klein, Schulname, Name, Leistung, Datum).
- Einheitliche Formatierung: gleiche Schriftgrößen, Abstände und Tabellenstil für alle Listen (gemeinsame Klassen in der Druck-CSS), gleiche Fußzeile „OrdoNota · Seite“ entfällt weiter (Browser-Kopf/Fuß bleiben aus).
- Datenschutz: Logo und Schulname liegen nur in der verschlüsselten Datenbank, nie im Repo; Demo-Daten mit einer erfundenen „Beispielschule“ ohne Logo. `migrate()` legt `settings.print` an, `check()` prüft die Typen, Notfallwerkzeug ignoriert das Logo.
- Tests: E2E je Druckart (Kopf vorhanden, Logo als Bild, Schulname/Lehrkraft/Kurs/Datum, fehlende Angaben fallen weg, Zettel kompakt), Upload mit Verkleinerung, Speichern und Neuladen.

### Entscheidungen des Nutzers (10.11.2026)
1. **Kacheln:** nach Sitzplan, ohne Sitzplan alphabetisch.
2. **Material:** neuer Zusatz m, Standard 0 Punkte (nur gezählt), je Block änderbar.
3. **Fehlzeiten:** eigene Liste je Kurs; „Heute abwesend“ und EPO-k schreiben hinein bzw. werden daraus vorbelegt.
4. **Druckkopf:** für alle Ausdrucke; Inhalt Schullogo, Schulname, Lehrkraft, Kurs, Schuljahr und Datum; gespeichert in der (verschlüsselten) Datenbank, damit auf allen Geräten gleich.

## Z) Gemeinsames Design der Ordo-Apps (solagio-design) – erledigt in 2.0.0 (veröffentlicht am 15.11.2026)

Anlass: Alle Ordo-Apps bekommen dasselbe Erscheinungsbild. Das Design (Tokens, Blades, Bausteine mit der Vorsilbe `sd-`, Symbole aus Tabler Icons, Schrift Josefin Sans) liegt im Projekt `../Design` und kommt per Verteilskript als feste Kopie in die App. Geklärt mit dem Nutzer am 14.11.2026. **Einbau erst nach Freigabe dieses Plans.**

### Ausgangsstand (1.47.0)

- `css/app.css`: 1126 Zeilen, rund 500 Klassen, durchgehend px. Die Oberfläche entsteht in JS (`h()`), `index.html` ist nur die Hülle.
- Eigene Token-Namen (`--surface`, `--surface-2`, `--muted`, `--danger`, `--warn`, `--font`), kühle Grundfarbe, 14 px Schrift, Bedienelemente 34 bzw. 28 px.
- Rund 45 Emoji und Zeichen als Symbole. 24 Inline-Stile im JS. Dialoge sind schon `<dialog>`.
- Der End-to-End-Test hängt mit rund 500 Selektoren an den Klassennamen und prüft die Kontraste der sechs Designs.

### Entscheidungen

1. **Reihenfolge:** OrdoNota wird vor OrdoScripto umgebaut.
2. **Tiefe:** Mittelweg. Das Gerüst (Kopfzeile, Knöpfe, Felder, Dialoge, Meldungen, Anmeldung, Einstellungen) folgt dem gemeinsamen Design. Die Fachansichten (Notentabellen, Sitzplan, Gruppen, Zufall, Auslosung, Timer) behalten ihr eigenes CSS und bekommen nur die neuen Tokens und die Schrift der Überschriften.
3. **Dichte:** Gerüst im Design-Maß (16 px, Bedienelemente 40 px). Tabellen und Raster der Fachansichten bleiben dicht wie heute. Bei Touch-Bedienung überall 44 px.
4. **Farben und Namen:** Das Standard-Design übernimmt die warme Grundfarbe des gemeinsamen Designs. Die Variablennamen werden in einem Zug umgestellt, ohne Alias-Schicht: `--surface` → `--bg-card`, `--surface-2` → `--bg-raised`, `--muted` → `--text-dim`, `--danger` → `--bad`, `--warn` → `--gold`, `--font` → `--sans`. Salbei, Lavendel, Nord und Aubergine bleiben mit eigenem Akzent. Die Notenfarben (`--g-l`, `--g-s`, `--g-text`, `--bar-l`, `--override`) bleiben Zusatz der App. Akzent: `#2f6f8f` hell, `#6bb3d6` dunkel (wie bisher).
5. **Modus:** `applyTheme()` bleibt die einzige Stelle, die `data-theme` und `data-variant` setzt (wegen der sechs Designs und des Timer-Fensters). In der Kopfzeile ersetzt ein Dreifach-Schalter Hell/Dunkel/System im Aussehen von `sd-theme` das Mond-Symbol. Die Knöpfe tragen kein `data-sd-theme`, damit `solagio-design.js` nicht mitschaltet. Die Designs wählt man weiter in den Einstellungen.
6. **Symbole:** Bedienknöpfe bekommen Tabler-Symbole mit Beschriftung für Vorlesehilfen. Zeichen mit Inhalt bleiben: Pfeile im Text, Haken, Kartenfarben, 🍅 beim Pomodoro, 🎲 beim Zufall.
7. **Aufbau:** Kopfzeile, einklappbare Kursleiste und Reiter bleiben. Kopfzeile als `sd-header` mit Logo, Kursleiste eigenes CSS und optisch angeglichen, Reiter mit dem neuen Baustein `sd-tabs`.
8. **Ausdrucke** (`print.js`) bleiben unverändert. Die Beamer-Ansichten bekommen nur Tokens und Schrift.
9. **Veröffentlichung:** Zweig `design`, je Etappe ein Commit mit vollem Testlauf, am Ende eine Version 2.0.0. Push und Release nur auf Ansage.
10. **Lizenzen:** Die verteilten Dateien werden mit dem Repo öffentlich (Blades und Tabler Icons MIT, Josefin Sans OFL). Lizenzhinweise kommen in die Doku und ins Release-ZIP.
11. **Klassennamen:** Die heutigen Klassen (`btn`, `input`, `modal`, `tab` …) bleiben als Anker für JS und Tests. Der Gerüst-Teil von `app.css` wird mit den Tokens und Maßen des Designs neu geschrieben. Blades liefert die Grundlage für native Elemente. `sd-`-Bausteine kommen dort, wo neues Markup entsteht: Kopfzeile, Modus-Schalter, Reiter, Meldungen, leere Zustände, Hochladen bei den Importen.
12. **Große Schrift:** Schalter in der Kopfzeile (125 %, für Beamer und Tafel). Damit er auch in den Fachansichten wirkt, wird `app.css` von px auf rem umgestellt (Rahmenbreiten bleiben px).
13. **Browser:** Mindeststand etwa Chrome/Edge 120, Firefox 117, Safari/iOS 17.2 (Blades braucht `@layer`, verschachteltes CSS und `light-dark()`). Hinweis in README und Doku.
14. **`PRODUCT.md` und `DESIGN.md`** (für Impeccable) bleiben lokal und kommen in `.gitignore`.

### Etappen

Jede Etappe endet mit `ERGEBNIS: x von x bestanden` und einem Commit auf dem Zweig `design`.

- [x] 0. Design-Projekt 0.3.0: Baustein `sd-tabs`, rund 30 neue Symbole, Musterseite ergänzen.
- [x] 1. Vorbereitung: Zweig, `PRODUCT.md`, Vergleichsfotos aller Ansichten im Demo-Modus (hell, dunkel, 1280 und 390 px), Design-Dateien verteilen (`css/blades.min.css`, `css/solagio-design.css`, `js/solagio-design.js`, `schrift/`), `data-app="ordonota"` in `index.html`, `launcher/build.sh` und die Dateiliste des Servers um `schrift/` erweitern, Lizenzhinweise.
- [x] 2. Tokens: Namen umstellen, warme Grundfarbe, vier Varianten umschreiben, Kontrasttest anpassen. Das Timer-Fenster lädt die neuen CSS-Dateien mit.
- [x] 3. px → rem in `app.css`. Kriterium: Fotos vorher und nachher sind bei normaler Schrift gleich.
- [x] 4. Gerüst: Kopfzeile mit Logo, Modus-Schalter, große Schrift, Reiter, Kursleiste.
- [x] 5. Knöpfe, Felder, Dialoge, Meldungen, Anmeldung, Einstellungen (mit den Vorschaukacheln der Designs).
- [x] 6. Symbole statt Emoji.
- [x] 7. Fachansichten Reiter für Reiter: Tokens, Überschriften in Josefin Sans, Inline-Stile entfernen (berechnete Werte wie Notenfarben und Sitzpositionen bleiben), Timer-Fenster, Beamer-Ansichten.
- [x] 8. Abschluss: Prüfung auf Bedienbarkeit, Kontrast und schmale Bildschirme, Importe härten, Chromium, Firefox und WebKit, unter `file://` und über das Startprogramm, Doku (`DOKUMENTATION.md`, `README.md`), Version 2.0.0, Prüfung auf private Angaben vor dem Push.

### Aus der Umsetzung

- **CSS-Ebenen (Etappe 2):** Das Design wird mit `verteile.py … --ebene solagio` verteilt und steht damit in der CSS-Ebene `solagio`. `app.css` beginnt mit der Ebene `ordonota-grund`: Sie setzt alles, was `app.css` nicht selbst festlegt, auf die Vorgabe des Browsers zurück (`all: revert`), ausgenommen das Wurzelelement, Bilder, SVG und alles mit einer Klasse `sd-…` samt Inhalt. Blades wirkt in OrdoNota also nur in den `sd-`-Bausteinen; Knöpfe, Felder und Dialoge des Gerüsts stehen mit den Tokens in `app.css`. Grund: Sonst schlägt Blades in die rund 500 eigenen Klassen durch (schwebende Beschriftungen, Abstände, Feldhöhen).
- Die Design-Dateien stehen erst seit Etappe 2 in `index.html` (nicht seit Etappe 1), zusammen mit den umbenannten Tokens.
- Die Farben des Standard-Designs stehen in `app.css` noch einmal (`[data-theme='light']`, `[data-theme='dark']`), weil die Vorschaukacheln der Einstellungen ihr Design an einem inneren Element tragen. Ändern sich die Werte im Design-Projekt, hier nachziehen.
- Vergleichsfotos: `.claude/design-fotos/fotos.py <Ordner>` (nur lokal), Stand vorher in `.claude/design-fotos/vorher/`.

- **Firefox (Etappe 8):** Die Grundregel nimmt SVG über den Namensraum aus (`svg|*`), sonst verlieren in Firefox die per `<use>` eingebundenen Teile des Logos ihre Füllung. Schriftstärke 520 → 500, weil Firefox Zwischenstärken ohne passende Schrift auf fett rundet.
- **Geprüft:** Chromium (Thorium) und Firefox 160 unter `file://`, über das Startprogramm im Testlauf. **Noch offen: Safari/iOS** (auf dem Entwicklungsrechner nicht verfügbar) – vor dem Veröffentlichen an einem iPad oder Mac ansehen.
- **Audit und Härtung (15.11.2026):** `/impeccable audit` ergab 16 von 20 Punkten. Behoben: Eingabefelder der Tabellen haben einen Namen (`aria-label`, Muster „Spalte: Name“); die Reiter haben nur noch einen Tab-Halt, Pfeiltasten, Pos1 und Ende bewegen den Fokus, Eingabe- oder Leertaste wählt, der Fokus bleibt beim Wechsel auf dem Reiter; die Ansicht ist `role="tabpanel"`; Tabellenköpfe bekommen nach dem Zeichnen `scope` und `aria-sort` (`tableSemantics()` in `js/app.js`); die Anmeldeseite hat ein `main`.
- **Sitzplan per Tastatur (15.11.2026, mit dem Nutzer abgestimmt):** Karten sind fokussierbar (`role="button"`, `aria-pressed`, Name mit Reihe und Platz). Eingabe-/Leertaste wählt aus, Pfeiltasten schieben die ausgewählte Karte auf den Nachbarplatz (besetzt = tauschen), Entf nimmt sie vom Plan; ohne Platz setzt die Eingabetaste auf den ersten freien Platz. Ziehen und Tastatur teilen sich `place()` in `js/view-seating.js`. Die Gruppen haben noch keinen Tastaturweg.

### Offen

- Safari/iOS ansehen (siehe oben). Veröffentlicht wurde 2.0.0 am 15.11.2026 ohne diese Prüfung.
- Die Kursleiste nimmt auf dem Handy viel Höhe ein.
- Kontrast in der Variante Nord behoben (15.11.2026): `--text-dim` und `--bad` heller, damit Kursangabe, Bonus-Häkchen und Fehlerhinweis auch auf getönten Flächen 4,5 : 1 erreichen. Der Test prüft jetzt in allen sechs Designs auch Schrift auf den getönten Flächen der Karte.
- Touch-Bedienung nachgezogen (15.11.2026), nur bei `pointer: coarse`: Sortierknöpfe und Links mindestens 28 px, Kästchen in Tabellen 24 px, Kreuz an Chips 28 px, Klapp-Zeilen in voller Höhe, Gruppenkästen breiter. Die Datenzeilen bleiben dicht; 44 px gelten nur für das Gerüst. Der Löschknopf für Sitzplan-Fotos erscheint jetzt auch an der ausgewählten Karte (antippen) und beim Tastaturfokus. Kopfzeile: unter 860 px nur das Zeichen, die Kursauswahl gibt nach, bei großer Schrift bricht sie unter 800 px um. Gemessen in Chromium mit emuliertem Touch; echte Geräte und Safari/iOS stehen aus.
- Feinschliff (15.11.2026): Die Pfeilknöpfe der Reihenfolge-Listen (Reiter, Werkzeuge) zeigten zusätzlich die Listennummer; die zweite Kopfzeile der Notenübersicht saß knapp 3 px zu tief (heller Streifen); die Klapp-Karten in Präsentationen und Gruppen hatten keinen Pfeil, jetzt haben alle Klapp-Karten denselben gezeichneten Winkel; Abstand zwischen Knopfzeile und Feldern (Sicherheit) und unter Feldzeilen (Ziehen, Gruppen); lange Knopftexte brechen auf dem Handy um, ohne am Rand zu kleben.
- Schriftname (15.11.2026): Die gekürzte Schrift heißt jetzt intern und im CSS „Ordo Josefin“ (solagio-design 0.3.2). Die OFL behält den Namen „Josefin Sans“ dem Original vor.
- Titel der Ausdrucke in Josefin Sans: eigener kleiner Schritt nach 2.0.0, falls gewünscht.

## Wunschliste vom 18.11.2026 (Reihenfolge der Umsetzung: AA, AB, AC, AD, AE, AF, AG)

Mit dem Nutzer am 18.11.2026 geklärt (grill-me, alle Empfehlungen angenommen). Jeder Buchstabe ist eine eigene Version mit Tests.

**To-do (Stand 18.11.2026):**

- [x] **AA** Sitzplan im Beamer-Vollbild – erledigt in 2.1.0 (18.11.2026), Anordnung wie im Editor, S2/S3 wie empfohlen
- [x] **AB** Notenschlüssel: Knopf „Punkte verteilen“ – erledigt in 2.2.0 (18.11.2026)
- [x] **Vorab: Hänger im Testlauf beheben** (erledigt 19.11.2026, siehe unten „Testlauf bleibt stehen“)
- [x] **AC** Verbalbeurteilung bei I-Status – erledigt in 2.3.0 (19.11.2026), V1–V3 wie empfohlen
- [x] **AD** Personenregister (Schema 5, Migration, Zusammenführen), 2.4.0 (19.11.2026, gepusht, Release v2.4.0)
  - [x] **AD-1** Datenmodell, Umstellung, `NM.people`, Sicherung, Kopieren, Löschen, Notfallwerkzeug (19.11.2026)
  - [x] **AD-2** Seite „Personen“, Zusammenführen und Trennen, Abgleich beim Einfügen, Namen ändern → 2.4.0 (19.11.2026)
- [x] **AE** Nachteilsausgleich – erledigt in 2.5.0 (20.11.2026), gepusht, Release v2.7.0, Oberfläche wie unten beschrieben
- [x] **AF** Notizverlauf – erledigt in 2.6.0 (20.11.2026), gepusht, Release v2.7.0, Oberfläche wie unten beschrieben
- [x] **AG** Förderplan – erledigt in 2.7.0 (20.11.2026), gepusht, Release v2.7.0, Oberfläche wie unten beschrieben (Hinweis in der Kursliste als Symbol statt Text, damit die Spalte schmal bleibt)
- [x] Kompetenzanalysen und Kompetenzverlauf: am 24.11.2026 geklärt, eigener Abschnitt **AI** (Schritte AI-1 bis AI-5, Release ab 2.13.0) – AI-1 bis AI-5 erledigt am 24.11.2026, gepusht, **Release v2.13.0** veröffentlicht (24.11.2026)

**Ablauf je Buchstabe** (Projekte-CLAUDE.md): Oberfläche vorher mit `/impeccable shape` planen und bestätigen lassen → umsetzen (Hauptsitzung oder `code-umsetzen`) → Impeccable-Detektor über die geänderten UI-Dateien → `/impeccable polish` (bei Formularen auch `harden`) → Tests (`code-testlauf`) → Doku (DOKUMENTATION.md, README.md), Version (Minor), hier als erledigt abhaken → lokaler Commit. Pushen nur auf Ansage, vorher `code-pruefen`.

**Kleinigkeiten, die ohne Rückfrage ergänzt wurden** (dem Nutzer am 18.11. gemeldet, kein Widerspruch): AD – Namensänderung im Kurs fragt, ob das Register mitgeändert wird; AC – Verbalbeurteilung zuerst für Arbeiten, Präsentationen nur bei Bedarf. **Später, eigener Klärungsdurchgang:** Kompetenzanalysen sammeln und Kompetenzveränderung darstellen. Dafür ist das Personenregister (AD) die Grundlage. Weitere Verläufe hängen dort als Zeitreihe mit Datum an der Person, so wie die Fassungen des Förderplans (AG).

**Datenschutz für alles hier (gilt für AC–AG):** Nachteilsausgleiche (LRS, Dyskalkulie) und Förderpläne sind Gesundheitsdaten nach Art. 9 DSGVO, Notizen sind ebenfalls schutzwürdig. Sie erscheinen **nie** in Beamer- und Vollbildansichten, nie auf Ergebnis-, Mitarbeitszetteln oder Leistungsbögen und nie in der unverschlüsselten Schülerliste als Excel. In Exporten nur, wenn man es ausdrücklich ankreuzt. In der Notenübersicht dezent. `tools/entschluesseln.py` (CSV-Ausgabe) mitziehen. Vor dem Commit von Doku-Beispielen mit `code-pruefen` prüfen (öffentliches Repo).

### Testlauf bleibt stehen – behoben am 19.11.2026

**Ursache (19.11.2026):** Es gab keinen echten Hänger. Die App merkt sich den zuletzt gewählten Reiter im `localStorage`. Der Smoke-Test endet auf „Einstellungen“, also öffnete jeder spätere Start dort. Die 36 Stellen `br.wait("…overview-table…", 30)` nach dem Neuladen liefen deshalb jedes Mal in die vollen 30 s. Dabei fragt Python nur alle 0,2 s nach, und Browser und Python wirken untätig. Blöcke mit mehreren Neuladungen (Farbschemata, Sitzplan-Beamer, Gruppen, Druckauswahl) standen so minutenlang, `run_old_db_check` brauchte 10 × 30 s. Ein voller Lauf dauerte über 20 Minuten statt gut 3. Geprüft und ausgeschlossen: Ein echtes `window.print` blockiert Headless-Chrome nicht (es wird ignoriert, Timer und Neuzeichnen laufen weiter).

**Behoben in `tests/run_tests.py`:**
- `APP_READY` (App geladen, Ansicht gezeichnet) statt Warten auf die Notenübersicht; der Smoke-Test „App startet“ prüft weiter die Notenübersicht im frischen Profil.
- `CALL_TIMEOUT` (240 s) als feste Gesamtzeitgrenze je DevTools-Aufruf, unabhängig von anderen Meldungen.
- Ein abgebrochener Block zählt als Fehler mit Namen, die übrigen laufen in einem frischen Browser weiter.
- Am Ende stehen die Laufzeit und Blöcke über 60 s.

**Ergebnis:** drei volle Läufe hintereinander je `ERGEBNIS: 127 von 127 bestanden`, Exit-Code 0, je 199 s.

**Ursprünglicher Auftrag:**


**Befund (18.11.2026 abends):** Der volle Lauf `tests/run_tests.py` blieb dreimal hintereinander minutenlang stehen, jedes Mal an einer anderen Stelle (Reiter „Gruppen“, Farbschemata, Druckauswahl). Dabei arbeitet weder Python noch der Browser. Die Seite antwortet aber, wenn man sich von außen verbindet, und danach lief der Test einmal weiter. Einzeln, jeder Block in einem frischen Browser, sind alle 127 Tests grün und die meisten Blöcke in Sekunden fertig. Ausnahme: `run_old_db_check` braucht 270 s. Früher am selben Tag liefen zwei volle Läufe durch.

**Vorgehen:**
1. Den Hänger nachstellen, z. B. mehrere volle Läufe mit `python -u`, und die Stelle festhalten. Prüfen, ob es nur nach langer Laufzeit im selben Browser passiert.
2. Vermutungen prüfen:
   - `Browser.call` wartet ohne Zeitgrenze, weil andere CDP-Meldungen den 180-s-Timeout von `ws.recv` immer wieder zurücksetzen.
   - Der Headless-Browser zeichnet nicht mehr, und ein Test wartet auf ein Bild, einen Übergang oder eine Animation.
   - Ein Fullscreen-Zustand bleibt aus den Beamer-Tests hängen.
   - Ein echtes `window.print` wird aufgerufen.
3. Warum `run_old_db_check` so lange braucht.
4. Beheben:
   - feste Gesamtzeitgrenze je `call`/`eval` mit klarer Fehlermeldung, die den Block nennt
   - Ursache abstellen
   - ggf. ein frischer Browser je Block
5. Fertig, wenn drei volle Läufe hintereinander `ERGEBNIS: x von x bestanden` mit Exit-Code 0 melden und kein Lauf länger als etwa 10 Minuten braucht.

### AA) Sitzplan im Beamer-Vollbild

- Knopf im Reiter „Sitzplan“ wie die Beamer-Ansicht einer Arbeit (`beamerView`, `js/view-tests.js:1064`): `requestFullscreen`, Esc schließt.
- Zeigt das Raster des gewählten Raums mit den Karten wie bisher (Vorname, ggf. Nachnamensinitial, Foto, wenn nicht ausgeblendet), nur groß, mit dem Pult als Orientierung. Keine Bearbeitung.
- Nie I-Status, Ausgleiche, Notizen oder Noten.

**Entwurf der Oberfläche (`/impeccable shape`, 18.11.2026):**

- Vollbild im Stil von `.beamer` (`css/app.css:719`). Oben Kursname und Raumname, rechts eine Leiste mit Schaltern wie in der Gruppen-Beamer-Ansicht (`grp-beamer-toggle`, `js/view-groups.js:793`): „Fotos“, „Lehrersicht“, „Schließen (Esc)“.
- Das Raster des gewählten Raums (`ui.seatingId`) füllt die Fläche, die Karten skalieren mit der Raumgröße (8 × 5 ohne Rollen). Nur Vornamen (`cardNames`), groß; leere Plätze blass angedeutet, damit die Reihen erkennbar sind. Pult als Orientierung.
- Keine Bearbeitung: kein Ziehen, kein Auswählen, kein Foto-Löschknopf, keine Hinweistexte.
- Knopf „Beamer“ im Kopf des Reiters „Sitzplan“. Esc oder Verlassen des Vollbilds schließt (wie `beamerView`). Alle sechs Designs, „Bewegung reduzieren“ beachten.

**Fragen S1–S3** (am 18.11.2026 entschieden, gebaut in 2.1.0): S2 und S3 wie empfohlen. **S1 abweichend:** keine Drehung und kein Schalter „Lehrersicht“, das Vollbild zeigt den Plan genau wie im Editor (Nutzer: Wechsel nicht sinnvoll).

- **S1 Blickrichtung:** Liegt das Pult im Editor unten (Sicht der Lehrkraft), wären für die Klasse links und rechts vertauscht. → Empfehlung: Beamer zeigt immer **aus Sicht der Klasse** (Pult oben, links ist links; bei Pult unten um 180° gedreht), Schalter „Lehrersicht“ für die Ansicht wie im Editor.
- **S2 Fotos:** → Empfehlung: eigene Einstellung für den Beamer, **beim ersten Mal aus**, Schalter „Fotos“; die Wahl merkt sich das Gerät (`nm.ui`). Projizierte Fotos sind heikler, große Vornamen von hinten besser lesbar.
- **S3 Personen ohne Platz:** → Empfehlung: schmale Leiste „Noch ohne Platz: …“ mit Vornamen, nur wenn es solche gibt.

### AB) Notenschlüssel: Vorschlag „ein Punkt je Stufe“ bei wenigen Punkten (erledigt in 2.2.0)

Umgesetzt wie unten. Ergänzt: Schwellen, die schon passen, bleiben (nur Zusammenfallendes rückt); reichen die Werte nicht, entfallen über der Grenze nach der 1− auch die folgenden Stufen, unter der Grenze zuerst die 5−. Der Knopf erscheint nur, wenn danach weniger Stufen wegfallen.


Ausgangslage: Bei wenigen Punkten fallen Schwellen zusammen (18 Punkte, Grenze 50 %, ganze Punkte: 2+ und 2 ab 15, 3 und 3− ab 12). Die Warnung `unreachableNotice` (`js/view-tests.js:885`) bietet bisher nur halbe/Zehntel-Punkte und „nur ganze Noten“ an.

- **Dritter Schnellknopf** in der Warnung, z. B. „Punkte verteilen“: schreibt einen Vorschlag in die eigenen Schwellen (`custom`) des Tests bzw. Teils. Vor dem Übernehmen zeigt ein Dialog den neuen Schlüssel und alle verschobenen Stufen. Danach lässt er sich wie jede eigene Schwelle von Hand ändern.
- **Regel:** Die Grenze zum Bestehen bleibt fest (Sek I: 4− bei LIMIT, MSS: 4 Punkte bei LIMIT); die App verschiebt sie nie von sich aus. Wo Schwellen zusammenfallen, wird je ganzer Punkt (bzw. je Schritt der Genauigkeit) eine Stufe vergeben, von oben beginnend (Höchstpunktzahl → beste Stufe). Reichen die Punktwerte zwischen Grenze und Höchstpunktzahl nicht für alle Stufen, bleibt die zweitbeste Stufe (1− bzw. 14 Punkte) unerreichbar, die anderen nicht. Beispiel 18 Punkte, Sek I, 50 %: 1 ab 18, 2+ ab 17 … 4− ab 9; 1− entfällt. Die Regel kommt als reine Funktion nach `js/grades.js` und wird mit Grenzfällen getestet (wenige Punkte, halbe Punkte, MSS, eigene Schwellen vorhanden).
- Gilt auch unterhalb der Grenze (5+, 5, 5−) und für Sek I wie MSS.
- Wer die 44 % aus dem ersten Beispiel des Nutzers (18 → 1, 17 → 1−, 16 → 2+ …, 4− ab 8) bewusst will, trägt sie als eigene Schwellen ein.
- Doku: Abschnitt Notenschlüssel (DOKUMENTATION.md) um den Knopf und die Regel ergänzen.

### AC) Verbalbeurteilung bei I-Status (erledigt in 2.3.0)

I-Status = Inklusionsstatus: Es gibt einen Förderplan, die Noten zählen nicht in die Statistik (DOKUMENTATION.md:291, Bedeutung dort ergänzen). Er bleibt **pro Kurs** (zieldifferente Förderung kann je Fach verschieden sein).

- Bei Personen mit I-Status hat jedes Ergebnis einer Arbeit (auch Teile, Präsentationen bei Bedarf) ein Feld **Verbalbeurteilung** (`results[sid].verbal`, Freitext). Das Feld ist immer sichtbar, unter 4− (Sek I) bzw. unter 4 Punkten (MSS) wird es hervorgehoben und als „fehlt noch“ markiert, solange es leer ist.
- Auf dem **Ergebniszettel** steht die Verbalbeurteilung **anstelle** der Note. Schalter je Ergebnis „Note auf dem Zettel zeigen“ (`results[sid].showGrade`), voreingestellt aus, wenn eine Verbalbeurteilung vorhanden ist. Intern rechnet die App die Note weiter (Leistungsbogen, Lehrerlisten, Notenübersicht).
- Nur neue Felder → kein neues `SCHEMA`; `migrate()` muss nichts tun (Felder fehlen = leer).

**Entwurf der Oberfläche (`/impeccable shape`, 19.11.2026, Fragen V1–V3 entschieden):**

- **V1 Ort:** eigene Karte **„Verbalbeurteilungen“** im Reiter „Tests“ direkt unter der Karte „Ergebnisse“. Die Ergebnistabelle bleibt unverändert, mit ihren Tastaturwegen. Die Karte erscheint nur, wenn unter den angezeigten Personen jemand mit I-Status ist (beim Nachschreibtermin also nur die gezeigten).
  - Kopf: „Verbalbeurteilungen“, dazu als Marke „n fehlt noch“, wenn es solche gibt.
  - Je Person ein Block: Name, Note wie in der Tabelle mit Punkten („Note 5 · 5 von 20 P.“) oder der Status („fehlt“, „nachschreiben“), ein mehrzeiliges Textfeld und der Haken „Note auf dem Zettel zeigen“.
  - **„fehlt noch“:** Note unter 4− (Sek I) bzw. unter 4 Punkten (MSS), also `p < 4` in beiden Stufen, und das Textfeld leer. Dann sind der Block mit Warnfarbe und das Wort „fehlt noch“ markiert, nie nur die Farbe. Bei Status ohne Note gibt es keine Warnung.
  - In der Tabelle unter der Notenmarke der Person ein kleiner Text: „verbal fehlt“ (Warnung) bzw. „verbal ✓“. Klick darauf springt zum Textfeld.
  - Speichern beim Verlassen des Textfelds (`change`), nicht bei jedem Tastendruck. Fokus und Scrollstelle bleiben beim Neuzeichnen (`data-focus-key`).
  - Haken: gespeichert wird nur `showGrade: true`. Ohne Text gibt es nichts zu ersetzen, dann steht auf dem Zettel die Note, und der Haken ist ausgegraut mit dem Hinweis „erst mit Verbalbeurteilung“.
- **V2 Teile:** **eine** Verbalbeurteilung je Arbeit, auch bei getrennt benoteten Teilen.
- **V3 Zettel:** Ist eine Verbalbeurteilung da und der Haken aus, bleibt auf dem **Ergebniszettel** die Tabelle mit den Punkten je Aufgabe. Prozent, Note und Teilnoten entfallen, an ihrer Stelle steht „Verbalbeurteilung:“ mit dem Text (Zeilenumbrüche bleiben). Dasselbe gilt für den **Moodle-Einzelbogen mit Note**. Gilt nur, solange die Person den I-Status hat.
- **Unverändert:** Notenberechnung, Notenübersicht, Lehrerlisten (Ergebnisliste mit „(I)“ und Note), Leistungsbogen, Statistik (I-Personen zählen weiter nicht).
- **Nie:** Beamer-Ansicht, Excel-Schülerliste, Scripto-CSV. `tools/entschluesseln.py`: Verbalbeurteilung als eigene Spalte in der CSV der Ergebnisse.
- **Designs und Zugänglichkeit:** alle sechs Designs. Das Textfeld hat ein sichtbares Label mit dem Namen, die Warnung hat Text und Zeichen. Touch 44 px für den Haken.
- **Tests:** Karte nur mit I-Status; „fehlt noch“ bei `p < 4` und leer, nicht bei Status; Speichern; Zettel und Moodle-Bogen mit und ohne Haken und ohne I-Status; Teile mit einem Text; Beamer ohne Text; CSV des Notfallwerkzeugs.

### AD) Personenregister (Schema 5)

Heute gibt es keine kursübergreifende Person: Jeder Kurs hat eigene `course.students[]` mit eigenen IDs (`js/model.js:166`).

- Neu: `db.people: [ { id, last, first, created } ]`. Jede Person im Kurs bekommt `personId`. Name und Foto bleiben vorerst auch am Kurseintrag (Import, Sitzplan unverändert); ändert sich ein Name im Kurs, fragt die App, ob die Person im Register mit geändert werden soll.
- Noten, I-Status, Einstufung, Bemerkung (`course.comments`) bleiben am Kurs.
- **Migration:** `SCHEMA` 4 → 5. Für jeden Kurseintrag wird eine eigene Person angelegt, nichts wird automatisch zusammengeführt. Vorher Sicherung; Migration an der Demo-Datenbank testen.
- **Zusammenführen:** Dialog „Personen zusammenführen“ (Einstellungen oder Reiter „Kurs & Schüler“) schlägt gleiche Namen (und gleiche Moodle-Adresse) vor; der Nutzer bestätigt Paare. Zusammengeführte Personen lassen sich wieder trennen (Notizen/Ausgleiche bleiben dann bei der gewählten Person).
- **Neue Kurse / neues Schuljahr:** Beim Anlegen oder Importieren schlägt die App vorhandene Personen mit gleichem Namen vor; ohne Bestätigung entsteht eine neue Person.
- **Löschen:** Steht eine Person in keinem Kurs mehr, fragt die App, ob sie samt Notizen, Ausgleichen und Förderplan gelöscht werden soll. Im Register Hinweis „seit … in keinem Kurs“. Keine automatische Frist.
- Das Register wird so angelegt, dass weitere Verläufe (Kompetenzerhebungen) später an der Person hängen können.
- `tools/entschluesseln.py`, DOKUMENTATION.md (Datenmodell, Abschnitt Kurs & Schüler) mitziehen.

**Entwurf (`/impeccable shape`, 19.11.2026, Fragen P1–P3 entschieden, alle wie empfohlen):**

*Datenmodell*
- `db.people: [ { id, last, first, created, orphanSince? } ]`, Kurseintrag `course.students[].personId`. Invariante: Jeder Kurseintrag zeigt auf eine vorhandene Person. `orphanSince` (Datum) wird gesetzt, wenn der letzte Kurseintrag einer Person verschwindet und sie im Register bleibt, und entfernt, sobald sie wieder in einem Kurs steht.
- Name, Foto, Mail-Adresse (Moodle), I-Status, Einstufung, „Aktiv“ bleiben am Kurseintrag. Der Name im Register ist der Name der Person, die Namen in den Kursen dürfen abweichen (z. B. altes Schuljahr vor einer Namensänderung).
- Reine Logik in neuem Modul `js/people.js` (`NM.people`, ohne DOM, mit `tests/people.test.html`): `ensure(db)` (fehlende Personen anlegen, verwaiste markieren), `entries(db, pid)` (Kurseinträge einer Person), `matches(db, name)` (gleiche Namen), `suggestPairs(db)` (gleiche Namen oder gleiche Mail-Adresse in Kurseinträgen, nicht schon dieselbe Person, nicht beide im selben Kurs), `merge(db, keepId, goneId)`, `split(db, pid, entryRefs)`, `remove(db, pid)`.
- **Migration** (`SCHEMA` 4 → 5, `migrate()` ruft `NM.people.ensure`): Für jeden Kurseintrag ohne `personId` eine eigene Person mit dessen Namen, `created` = Erstellungsdatum der Datenbank. Nichts wird automatisch zusammengeführt. `ensure` läuft bei jedem Öffnen, damit auch Datenbanken mit Lücken heil werden. `check()` meldet unbekannte `personId` als Fehler und Personen ohne Kurs ohne `orphanSince` als Hinweis.
- **Sicherung:** Die erste Speicherung nach der Umstellung legt immer eine Sicherung an, unabhängig von „höchstens alle 10 Minuten“ (Umsetzung in `FolderStore` und `ServerStore` prüfen). Ältere App-Versionen öffnen die Datenbank danach nicht mehr (Meldung „neuere Version“). Das kommt in die Release-Notizen: alle Geräte zuerst aktualisieren.

*P1 Ort: eigene Seite „Personen“*
- In der Seitenleiste unter „+ Kurs anlegen“ ein Eintrag **„Personen“** (Symbol `users`), auch eingeklappt erreichbar. Er öffnet eine eigene Seite ohne Kursreiter (`ui.tab = 'people'`, nicht in `TABS`, nicht ausschaltbar, nicht sortierbar). Die Seite geht auch ohne Kurs.
- **Links die Liste:** Suche (Vor- oder Nachname), Filter „Alle / Ohne Kurs“, Zähler. Je Person Nachname, Vorname und darunter die Kurse kurz („8b M · 7b M 25/26“) oder „seit 03.11.2026 in keinem Kurs“. Sortiert nach Name, mit Tastatur bedienbar (Liste mit Pfeiltasten, Enter wählt).
- **Rechts die gewählte Person:** Name im Register (bearbeitbar), Kurse als Liste mit Schuljahr, Kurs, Name im Kurs (falls abweichend), „nicht aktiv“, Link „Zum Kurs“. Darunter Knöpfe „Mit anderer Person zusammenführen …“, „Trennen …“ (nur bei mehr als einem Kurseintrag), „Aus dem Register löschen“ (nur ohne Kurs). Platz für AF/AG (Notizen, Förderplan) ist hier vorgesehen, bleibt aber leer.
- Unter 900 px Breite: Liste und Person untereinander, „‹ Alle Personen“ führt zurück.
- Oben rechts **„Zusammenführen …“** mit Zahl der Vorschläge.

*Zusammenführen und Trennen*
- **Dialog „Personen zusammenführen“:** je Vorschlag eine Zeile „Fischer, Mia (8b Mathe) = Fischer, Mia (7b Mathe 25/26)“ mit Grund („gleicher Name“ / „gleiche Mail-Adresse“) und Haken, **nicht** vorausgewählt (bestehende Daten, kein frischer Abgleich). „Zusammenführen“ verknüpft die angehakten Paare. Die ältere Person bleibt, ihr Name gilt.
- Manuell aus der Detailansicht: „Mit anderer Person zusammenführen …“ öffnet eine Suche. Gesperrt, wenn beide im selben Kurs stehen (Hinweis dazu).
- **Trennen …:** Haken an den Kurseinträgen, die zu einer neuen Person werden. Die neue Person bekommt den Namen des ersten gewählten Eintrags. Alles, was später an der Person hängt (Notizen, Ausgleiche, Förderplan), bleibt bei der bisherigen.

*P2 Namen einfügen: Dialog, vorausgewählt*
- Nach „Namen übernehmen“: Gibt es für neue Namen Personen mit genau gleichem Vor- und Nachnamen (ohne Groß-/Kleinschreibung und Leerzeichen am Rand), die nicht schon im Kurs sind, öffnet sich **„Diese Namen gibt es schon“**. Je Name eine Zeile mit Haken „dieselbe Person“ und ihren bisherigen Kursen. Bei genau einem Treffer ist der Haken vorausgewählt, bei mehreren gibt es eine Auswahl (Standard: „neue Person“). „Übernehmen“ verknüpft, „Alle als neue Personen“ verknüpft nichts. Ohne Treffer kein Dialog.
- „+ Einzeln hinzufügen“ legt eine leere Person an. Der Abgleich passiert beim ersten Eintragen des Namens (Frage nur, wenn es genau eine passende Person gibt, die nicht im Kurs ist).

*P3 Kurs kopieren:* Die Kopie übernimmt die `personId` (dieselben Personen), ohne Dialog.

*Namen ändern*
- Ändert man Vor- oder Nachnamen im Reiter „Kurs & Schüler“, und die Person steht nur in diesem Kurs, ändert sich der Name im Register still mit.
- Steht sie in weiteren Kursen und weicht der Registername danach ab, kommt eine Rückfrage: „Auch im Personenregister ändern? (Die anderen Kurse behalten ihren Namen.)“ mit „Im Register ändern“ / „Nur in diesem Kurs“.
- Ändert man den Namen im Register, bleiben die Kursnamen unverändert. Hinweis dort: „Die Kurse behalten ihren Namen.“

*Löschen*
- Kreuz am Kurseintrag: Ist es der letzte Eintrag der Person, ergänzt die bestehende Rückfrage den Haken „Auch aus dem Personenregister löschen“ (aus). Ohne Haken bleibt die Person mit `orphanSince` = heute.
- Kurs löschen: Danach verwaiste Personen werden im Dialog gezählt, mit demselben Haken für alle.
- Im Register: „Aus dem Register löschen“ nur für Personen ohne Kurs, mit Bestätigung.

*Grenzen und Datenschutz*
- Das Register erscheint nie auf dem Beamer, nie im Ausdruck, nicht in der Excel-Schülerliste. Kein Ausdruck des Registers.
- Notfallwerkzeug: zusätzlich `Personenregister.csv` (Nachname, Vorname, Kurse, seit wann ohne Kurs) und in den Kurs-CSVs eine Spalte „Person“ (ID).
- Demo: Die Demo-Daten zeigen das Register mit den beiden Kursen. Eine Person, die in beiden Kursen steht, ist nicht nötig (Sek I und MSS), die Tests bauen solche Fälle selbst.
- Alle sechs Designs, Tastatur, Touch 44 px, „Bewegung reduzieren“.

*Tests:* Migration an jeder Datenbank aus `tests/altdaten/` (jede Person genau einmal, Noten unverändert, `check` ohne Fehler); `NM.people` als Testseite (ensure, matches, suggestPairs, merge, split, remove, orphanSince); End-to-End: Seite „Personen“, Suche, Filter, Einfügen mit Dialog, Kopieren, Namen ändern mit Rückfrage, Zusammenführen und Trennen, Löschen mit verwaisten Personen, Sicherung bei der Umstellung, Notfallwerkzeug.

*Umfang:* Das ist groß. Zum Umsetzen in zwei Commits teilen: **AD-1** Datenmodell, Migration, `NM.people`, Sicherung, Kopieren, Löschen, Notfallwerkzeug (ohne neue Seite). **AD-2** Seite „Personen“, Zusammenführen und Trennen, Abgleich beim Einfügen, Namen ändern. Version 2.4.0 erst mit AD-2. AD-1 allein wird nicht gepusht.

### AE) Nachteilsausgleich

- An der Person: `people[].ausgleiche: [ { id, art: "lrs" | "dyskalkulie" | "sonst", text?, faecher: [..], massnahmen, bis? } ]` (Art „Sonstiges“ mit Freitext; Fächer als Liste der Fachbezeichnungen; Maßnahmen als Freitext, z. B. „Rechtschreibung nicht bewertet, 25 % mehr Zeit“; „gültig bis“ optional).
- **Markierung:** Kürzel (z. B. „LRS“, „DK“) an derselben Stelle wie das „I“ (`UI.nameCells`, `js/ui.js:196`) bei der Punkteeingabe und in der Notenübersicht, nur in Kursen, deren Fach in `faecher` steht (leer = alle). Abgelaufene Ausgleiche werden im Register hervorgehoben, aber nicht mehr markiert.
- **Je Arbeit** ein Haken „Ausgleich gewährt“ (`results[sid].ausgleich: true`), damit festgehalten ist, dass der Ausgleich gewährt wurde. Die App rechnet **nichts** automatisch um und ändert nichts an der Statistik.
- Nicht im Vollbild, nicht auf Zetteln, nicht in der Excel-Schülerliste (siehe Datenschutz oben).

**Oberfläche (impeccable shape, 20.11.2026, vom Nutzer gewählt):**
- **Erfassen:** In der Detailansicht der Person (`detailCard`, `js/view-people.js`) kommt nach „Kurse“ der Abschnitt „Nachteilsausgleich“. Er zeigt eine kurze Liste mit einer Zeile je Ausgleich: Kürzel · Fächer · „bis TT.MM.JJJJ“. Darunter steht die Maßnahme, einzeilig und abgeschnitten. Abgelaufene Ausgleiche sind gedämpft und tragen „abgelaufen“. Jede Zeile hat „Ändern“. Darunter steht der Knopf „Ausgleich hinzufügen …“. Gibt es keinen Ausgleich, steht dort „Kein Nachteilsausgleich eingetragen.“
- **Dialog** (`modal`) mit Art (LRS / Dyskalkulie / Sonstiges, bei „Sonstiges“ eine Bezeichnung als Freitext, die als Kürzel dient, höchstens 6 Zeichen), Fächern, Maßnahmen (mehrzeilig) und „gültig bis“ (optional). Beim Ändern gibt es zusätzlich „Löschen“ mit Rückfrage.
- **Fächer:** Haken „alle Fächer“ (Standard). Nimmt man ihn heraus, erscheinen Haken für die Fächer aus den Kursen der Person, ohne doppelte Einträge. Verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung und Leerzeichen. Hat ein Kurs kein Fach, greifen dort nur Ausgleiche für „alle Fächer“. Kommt ein Kurs mit neuem Fach dazu, hakt man es nach.
- **Kürzel** (LRS, DK, Freitext) dezent neben dem „I“ in `UI.nameCells`. Es erscheint in der Punkteeingabe, in der Notenübersicht und in der Kursliste, nur wenn der Ausgleich gültig ist und zum Fach passt. Beim Darüberfahren steht im `title` die Art und die Maßnahme. **Nicht** in „Ziehen“ (`view-draw.js`, wird gezeigt), nicht im Beamer-Vollbild, nicht in Ausdrucken (`print.js` hängt nur „(I)“ an) und nicht im Excel-Export der Kursliste. `nameCells` zeigt die Kürzel nur mit der Option `course` (umgesetzt als Einschalten statt Abschalten: neue Ansichten zeigen dadurch von selbst nichts).
- **Haken „Ausgleich gewährt“:** In der Punkteeingabe von Arbeiten (nicht bei Präsentationen) gibt es eine schmale Spalte „Ausgleich“, nach dem Muster der Spalte „Unterschrift“. Die Spalte erscheint nur, wenn jemand im Kurs einen gültigen, passenden Ausgleich hat, und der Haken nur in diesen Zeilen. Standard: nicht gesetzt. Der Haken ändert keine Rechnung und keine Statistik.
- **Filter** auf der Personen-Seite: kein eigener Filter in AE. Kommt später mit AF/AG, wenn mehr Merkmale an der Person hängen.

### AF) Notizverlauf

- Neben der vorhandenen „Bemerkung zur Person“ (`course.comments`, erscheint auf dem Leistungsbogen) – sie bleibt unverändert. Die Notizen sind intern und werden nie gedruckt.
- An der Person: `people[].notizen: [ { id, datum, text, courseId? } ]`.
- **Detailansicht der Person** mit dem ganzen Verlauf (neueste oben), Eintrag anlegen, ändern, löschen. In der Kursansicht nach Kurs filterbar.
- **Schnelleintrag aus dem Sitzplan:** Karte wählen → „Notiz“ (Datum heute, Kurs voreingestellt). Nicht in der Beamer-Ansicht (AA).
- Symbol an der Person in der Notenübersicht, wenn Notizen vorhanden sind (öffnet die Detailansicht).

**Oberfläche (impeccable shape, 20.11.2026, vom Nutzer gewählt):**
- **Seite „Personen“:** In der Ansicht der Person steht nach „Nachteilsausgleich“ der Abschnitt „Notizen“. Oben steht immer ein Eingabefeld mit Datum (heute, änderbar), Kurs (Kurse der Person und „ohne Kurs“) und Text, dazu „Notiz speichern“. Vorgewählt ist der zuletzt geöffnete Kurs, wenn die Person darin steht, sonst „ohne Kurs“. Darunter steht der Verlauf, neueste oben: „TT.MM.JJJJ · Kurs“ und der volle Text. Rechts oben im Abschnitt filtert eine Auswahl nach Kurs (Alle Kurse, je Kurs, ohne Kurs). „Ändern“ öffnet den Eintrag an Ort und Stelle mit „Speichern“, „Abbrechen“ und „Löschen“ (mit Rückfrage). Gibt es keine Notizen, steht dort „Noch keine Notizen.“
- **Sitzplan-Editor:** An der ausgewählten Karte erscheint ein kleiner Notiz-Knopf, so wie das × zum Foto-Löschen. Mit der Tastatur öffnet N auf einer fokussierten Karte dasselbe. Es öffnet sich ein kleiner Dialog mit Datum (heute), Kurs (fest der aktuelle) und Text. Nie in der Beamer-Ansicht.
- **Notenübersicht:** Hat die Person Notizen in diesem Kurs, erscheint ein Notiz-Symbol neben dem Knopf „Bemerkung“. Beim Darüberfahren stehen Anzahl und Datum der letzten Notiz, nie der Text. Ein Klick öffnet einen Dialog mit den Notizen dieses Kurses (neueste oben) und einem Feld für eine neue Notiz. Dazu kommt der Link „Alle Notizen auf der Seite Personen ›“. Ohne Notizen gibt es kein Symbol; neue Notizen legt man dann über Sitzplan oder Personen an.
- **Selbst entschieden:** Beim **Trennen** wandern Notizen mit dem Kurs eines abgetrennten Eintrags zur neuen Person, Notizen ohne Kurs bleiben. Beim **Zusammenführen** werden die Listen zusammengelegt. Ist ein Kurs gelöscht, bleibt die Notiz mit „gelöschter Kurs“. Das Notfallwerkzeug schreibt eine eigene `Notizen.csv` (Person, Name, Datum, Kurs, Text).
- **Nie** auf Beamer oder Vollbild, nie im Ausdruck (auch nicht auf dem Leistungsbogen, dort bleibt nur die „Bemerkung“), nie im Excel-Export.

### AG) Förderplan

- An der Person: `people[].foerderplaene: [ { id, datum, schwerpunkt, von?, bis?, ziele, massnahmen } ]`, je Fortschreibung (meist halbjährlich) eine **Fassung mit Datum**; die neueste gilt. Förderschwerpunkte: Lernen, Sprache, emotionale und soziale Entwicklung, ganzheitliche Entwicklung, körperliche und motorische Entwicklung, Hören, Sehen, Sonstiges. Ziele und Maßnahmen als Freitext. **Kein Dateianhang** (Datenbankgröße; der offizielle Plan liegt in der Schulakte).
- In der Detailansicht der Person (AF), Fassungen nebeneinander vergleichbar.
- Hat eine Person einen Förderplan, in einem Kurs aber keinen I-Status: dezenter Hinweis in der Kursliste („Förderplan vorhanden, I-Status nicht gesetzt“). Nichts automatisch.

**Oberfläche (impeccable shape, 20.11.2026, vom Nutzer gewählt):**
- **Datenmodell abweichend vom Entwurf:** **mehrere Förderschwerpunkte** je Fassung: `foerderplaene: [ { id, datum, schwerpunkte: ["lernen", …], sonst?, von?, bis?, ziele, massnahmen } ]`. Mindestens ein Schwerpunkt; „Sonstiges“ braucht einen Freitext (`sonst`). `von`/`bis` sind optionale Tagesdaten (ISO).
- **Seite „Personen“:** Der Abschnitt „Förderplan“ steht nach „Notizen“. Er zeigt die **geltende Fassung** (die mit dem neuesten Datum) ganz: „Gilt seit TT.MM.JJJJ“, Schwerpunkte, Zeitraum, dann Ziele und Maßnahmen als Absätze. Darunter „Fortschreiben …“ und „Ändern“. **Frühere Fassungen** stehen eingeklappt darunter (`details`, eine Zeile je Fassung: Datum · Schwerpunkte); aufgeklappt zeigen sie den vollen Text und „Ändern“. Ohne Plan: „Kein Förderplan eingetragen.“ und „Förderplan anlegen …“.
- **Fenster** (breit, `modal`): Datum (heute), Schwerpunkte als Haken (Lernen, Sprache, emotionale und soziale Entwicklung, ganzheitliche Entwicklung, körperliche und motorische Entwicklung, Hören, Sehen, Sonstiges mit Freitext), Zeitraum von/bis, Ziele, Maßnahmen (je mehrzeilig). **„Fortschreiben …“ füllt alles mit der geltenden Fassung vor**, Datum heute, und legt beim Speichern eine **neue** Fassung an. „Ändern“ korrigiert die gewählte Fassung, dort auch „Fassung löschen“ (mit Rückfrage). Strg+Enter speichert wie bei den Notizen.
- **Vergleich:** „Fassungen vergleichen …“ (ab zwei Fassungen) öffnet ein breites Fenster mit zwei Spalten. Je Spalte wählt man oben die Fassung; vorgewählt sind links die vorherige und rechts die geltende. Die Zeilen sind Datum, Schwerpunkte, Zeitraum, Ziele und Maßnahmen. Unter 700 px stehen die Spalten untereinander. Es ist nur eine Ansicht, Änderungen werden nicht markiert.
- **Hinweis in der Kursliste** („Kurs & Schüler“): In der Spalte „I-Status“ erscheint ein dezenter Hinweis, wenn die Person einen Förderplan hat, der I-Status im Kurs aber nicht gesetzt ist („Förderplan vorhanden, I-Status nicht gesetzt“). Er ist als Knopf gebaut und springt zur Person. Sonst gibt es keine Markierung, auch kein Kürzel.
- **Trennen:** Der Förderplan bleibt bei der bisherigen Person (wie in 6.6). **Zusammenführen:** Die Fassungen werden zusammengelegt. Das Notfallwerkzeug schreibt `Foerderplaene.csv` (eine Zeile je Fassung).
- **Nie** auf Beamer oder Vollbild, nie im Ausdruck, nie im Excel-Export.

## AH) EPO-Umrechnung: Vorlagen statt Testschlüssel – erledigt in 2.8.0 (veröffentlicht am 20.11.2026)

**Problem:** Die Standardtabelle `epoDefaultTable` rechnet wie ein Testschlüssel. „Immer 0“ = 2 von 4 Punkten = 50 % ergibt in Sek I 4- (LIMIT 50 %) und in der MSS 05 („mehr als 50“ für 06). Die Symbole sind aber eine Notenskala, deren Mitte „befriedigend“ ist.

**Entscheidungen des Nutzers (20.11.2026):**
1. **Anker:** Wer immer dasselbe Symbol hat, bekommt `++` → 1 (14), `+` → 2 (11), `0` → 3 (08), `-` → 4 (05), `--` → 5 (02). Dazwischen linear: Punkte = 2 + 0,12 · Prozent, gerundet. Sek I und MSS nutzen dieselben Stufen (Sek I endet bei 14).
2. **Umsetzung über `epo.table`:** Eine Vorlage füllt die vorhandene Tabelle (Schwellen „ab“) und die Punkte je Symbol. `epoResult` und die Ausdrucke bleiben, wie sie sind, und man kann weiter von Hand anpassen.
3. **Eingebaute Vorlagen:** „0 = befriedigend“ (neuer Standard), „Mild“ und „Streng“ (um eine Tendenz = 8,33 % verschoben) und „Wie Testschlüssel“ (die bisherige Rechnung: Sek I mit LIMIT, MSS in 5-%-Schritten „mehr als“).
4. **Bestehende Blöcke** behalten ihre Tabelle. Blöcke mit der alten Standardtabelle zeigen einen Hinweis mit „Neue Vorlage anwenden“ und „So lassen“. „So lassen“ blendet ihn für diesen Block dauerhaft aus (neues Feld am Block, z. B. `epo.keepTable: true`; `migrate()`/`check()` ziehen mit).
5. **Eigene Vorlagen:** in `db.settings` (verschlüsselt, auf allen Geräten), jeweils für Sek I **oder** MSS. Inhalt: Tabelle (`mins`, `strict`) und Punkte je Symbol (`++` … `--`, `u`, `h`, `m`). Anlegen mit „Als Vorlage speichern“ im Block, Umbenennen und Löschen unter Einstellungen.
6. **Standard für neue Blöcke** wählbar unter Einstellungen, getrennt für Sek I und MSS (auch eine eigene Vorlage). Voreinstellung: „0 = befriedigend“.
7. **Bedienung im Block:** „Standard wiederherstellen“ wird ersetzt durch die Auswahl „Vorlage: …“ mit „Anwenden“. Daneben steht die geltende Vorlage oder „angepasst“, ermittelt durch Vergleich (kein Feld dafür). Das LIMIT-Feld erscheint nur bei „Wie Testschlüssel“.
8. **Unter 0 %** (nur durch Abzüge u/h/m): 5- (01) unter 0 % bis über −10 %, 6 (00) bei −10 % und weniger. Die Tabelle muss dafür negative Schwellen annehmen (Eingabe −100 bis 100, bisher 0–100 in `view-epo.js`). Damit „bei −10 % schon 6“ mit „ab“ gilt, liegt die Schwelle für 01 knapp über −10 % (oder 01 bekommt eine eigene „mehr als“-Regel; beim Bauen entscheiden und testen).
9. **Die 15 (MSS)** gibt es ab 97,5 %, ein Schnitzer ist ab 10 Stunden erlaubt (12 Stunden: 47/48 = 97,92 %). Bei Streng gibt es die 15 nur bei 100 %, die 14 ab 97,5 %.
10. **Ausdrucke** nennen die Vorlage nicht.

**Schwellen („ab“, in %; Sek I genauso ohne 15):**

| Punkte | Mild | 0 = befriedigend | Streng |
|---|---|---|---|
| 15 | 95,83 | 97,5 | 100 |
| 14 | 87,5 | 95,83 | 97,5 |
| 13 | 79,17 | 87,5 | 95,83 |
| 12 | 70,83 | 79,17 | 87,5 |
| 11 | 62,5 | 70,83 | 79,17 |
| 10 | 54,17 | 62,5 | 70,83 |
| 09 | 45,83 | 54,17 | 62,5 |
| 08 | 37,5 | 45,83 | 54,17 |
| 07 | 29,17 | 37,5 | 45,83 |
| 06 | 20,83 | 29,17 | 37,5 |
| 05 | 12,5 | 20,83 | 29,17 |
| 04 | 4,17 | 12,5 | 20,83 |
| 03 | 0 | 4,17 | 12,5 |
| 02 | (wie 03) | 0 | 0 |
| 01 | über −10 | über −10 | über −10 |
| 00 | sonst | sonst | sonst |

Probe mit 12 Stunden (max. 48 P), „0 = befriedigend“: immer `0` (24 P) → 08, immer `+` (36 P) → 11, 11× `++` + 1× `+` (47 P) → 15, immer `--` (0 P) → 02, immer `--` + `h` + `h` (−4 P, −8,33 %) → 01, −5 P (−10,4 %) → 00.

**Gestaltung (`/impeccable shape`, 20.11.2026, ohne eigene Interviewrunde, weil grill-me alles geklärt hat):**
- **Block, Karte „Einstellungen dieses EPO-Blocks“, Spalte Umrechnung:** oben die Zeile „Vorlage“ (Auswahl aus den eingebauten und den eigenen Vorlagen der Stufe) mit „Anwenden“. Dahinter steht leise „gilt: …“ oder „angepasst“. Daneben „Als Vorlage speichern“ (Name per Dialog). Die Auswahl steht auf der geltenden Vorlage, bei „angepasst“ auf dem Standard der Stufe. LIMIT nur bei „Wie Testschlüssel“ (Sek I). Die Tabelle zeigt weiter 15/14 bis 01 und nimmt −100 bis 100 an.
- **Hinweis für alte Blöcke:** gelbe Leiste (`notice warn`, wie die Schlüsselwarnung bei Tests) über der Eintragstabelle, also sichtbar ohne die Einstellungen aufzuklappen. Ein Satz mit dem Beispiel „immer 0“, dazu „Neue Vorlage anwenden“ (wendet den Standard der Stufe an) und „So lassen“. Erscheint nur, wenn der Block genau „Wie Testschlüssel“ rechnet und `keepTable` fehlt. Wer „Wie Testschlüssel“ bewusst anwendet oder als Standard gewählt hat, bekommt `keepTable` und keinen Hinweis.
- **Einstellungen:** eigene Karte „EPO-Umrechnung“ nach „Standardwerte für neue Tests“: zwei Auswahlen „Neue Blöcke Sek I“ und „Neue Blöcke MSS“, darunter die eigenen Vorlagen als Liste (Name, Stufe, Umbenennen, Löschen). Ohne eigene Vorlagen ein kurzer Satz, wo man sie anlegt. Löschen fragt nach; Blöcke behalten ihre Werte und zeigen dann „angepasst“. War die Vorlage Standard, gilt wieder „0 = befriedigend“.
- **Umsetzung von 8:** Die Schwelle für 01 ist −9,99 % („ab“), 00 gilt bei −10 % und weniger. Die Schwellen der eingebauten Vorlagen werden ungerundet gespeichert (z. B. 4,1666… %), damit genau getroffene Grenzen wie in der linearen Rechnung nach oben zählen; angezeigt werden 2 Nachkommastellen.

**Tests:** `epoResult` mit allen drei Vorlagen und der Probe oben (Sek I und MSS), negative Schwellen, Vergleich „angepasst“, eigene Vorlagen in `migrate()`/`check()`, Hinweis und „So lassen“ bei alten Blöcken, Jahrgangswechsel Sek I ↔ MSS (`model.js:437` erkennt bisher nur die alte Standardtabelle). Datenmodell: nur zusätzliche Felder (`settings` für Vorlagen und Standard, `epo.keepTable`), also kein neues `SCHEMA`; `tools/entschluesseln.py` mitziehen. Doku: DOKUMENTATION.md Abschnitte 8, 16, 24, 25.1, 26.4 und README. Version: Minor. UI: vorher `/impeccable shape` für Vorlagenauswahl, Hinweis und Einstellungen.

## AI) Kompetenztests: Kompetenzen je Aufgabe, Auswertung und Verlauf (geklärt am 24.11.2026, grill-me Q1–Q18)

**Ziel:** Aufgaben tragen Kompetenzen aus einem Katalog. OrdoNota wertet je Person und Kompetenz aus (Stufe und Prozent), zeigt den Verlauf im Kurs und im Personenregister (AD) und übernimmt die Zuordnung beim Moodle-Import aus einer Begleitdatei, die das Bauskript `moodle.py` (Skill `moodle-fragen` in der Materialsammlung) mitschreibt.

**Entscheidungen des Nutzers (24.11.2026, alle wie empfohlen, Ergänzungen vermerkt):**
1. **Keine eigene Testart.** Jeder Test kann Kompetenzen tragen (benotet oder nicht). Ein Test lässt sich mit dem vorhandenen Haken „nicht gewertet“ als reiner Kompetenztest kennzeichnen (Q20). *Ergänzung:* Nicht benotete Kompetenztests lassen sich getrennt ansehen und ausblenden (siehe 9).
2. **Katalog:** eigene Liste je Fach, für alle Kurse gemeinsam, dazu mitgelieferte Vorlagen (Bildungsstandards Mathe Sek I, später Chemie) zum Übernehmen und Ändern. Stabile Kennungen (z. B. `M-K2`).
3. **Übergabe aus Moodle:** Begleitdatei vom Bauskript; in OrdoNota lässt sich die Zuordnung immer von Hand setzen und korrigieren. Keine Kennung im Fragetext.
4. **Zuerst Mathematik Sek I**, Datenmodell fachneutral; MSS und Chemie später ohne Umbau.
5. **Zuordnung beim Import über den Fragetext:** Die Moodle-CSVs enthalten nur die Nummer im Test und den Fragetext als Kurzfassung (gefolgt von „: “ und den gemischten Antworten), keinen Fragenamen (geprüft an `demo/Antworten.csv`). OrdoNota vergleicht den Text bis zum „: “ mit `textanfang` der Begleitdatei und zeigt die Zuordnung F1 → Fragename → Kompetenzen in einem Dialog zum Prüfen; nicht eindeutige von Hand. Die Kennungen stehen zusätzlich als Moodle-Tags in der XML. Den Textabgleich vor dem Festschreiben an einem echten Export mit LaTeX, Cloze und Bildern prüfen.
6. **Mehrere Kompetenzen je Aufgabe**, die Punkte zählen voll bei jeder, keine Gewichte.
7. **Katalog mit zwei Ebenen** (Bereich → Kompetenz), optional Teilkompetenzen. Ausgewertet wird bis zur Kompetenz. Kennungen bleiben fest, auch wenn die Bezeichnung sich ändert.
8. **Auswertung:** Prozent und Stufe („noch nicht“ unter 50 %, „teilweise“ 50–79 %, „sicher“ ab 80 %, Grenzen je Katalog einstellbar). Hinweis „wenig Daten“ bei weniger als 3 möglichen Punkten.
9. **Ansichten:** Reiter „Tests“ mit Umschalter „Benotet | Kompetenztests | Alle“. Notenübersicht: Tests ohne Note sind keine Spalte; Schalter „Kompetenztests zeigen“ blendet sie grau und ohne Einfluss auf die Note ein. Neuer Reiter „Kompetenzen“ je Kurs (Person × Kompetenz aus allen Tests mit Kompetenzen), ein-/ausschaltbar wie die anderen Reiter.
10. **Stand = Summe der Punkte je Zeitraum** (erreicht ÷ möglich), Umschalter „1. HJ | 2. HJ | Schuljahr“ wie in der Notenübersicht.
11. **Verlauf:** im Reiter „Kompetenzen“ per Klick auf eine Person (je Kompetenz die Tests nach Datum, Prozent und Stufe auf einer kleinen Linie) und eine Kurszeile „Anteil sicher / teilweise / noch nicht“ je Kompetenz; im Personenregister derselbe Verlauf über alle Kurse und Schuljahre, getrennt je Fach (über `personId`). **Nichts wird gespeichert**, alles aus den Tests berechnet.
12. **Handkorrigierte Tests:** Feld „Kompetenzen“ je Aufgabe in der Karte „Aufgaben“ (Auswahl aus dem Katalog des Kursfachs, mehrere), auch in Arbeiten in Teilen. Der Moodle-Import füllt es vor. Nachschreibtermine übernehmen die Zuordnung. Bonusaufgaben zählen bei den Kompetenzen mit (erreicht und möglich), bei allen Personen, auch wenn jemand sie nicht bearbeitet hat (bestätigt am 24.11.2026). Präsentationen vorerst ohne Kompetenzen.
13. **Für Schüler:** druckbarer Kompetenzbogen je Person (Stufe mit Zeichen ✓ ◐ ✗, „Das kannst du schon“ / „Daran arbeitest du weiter“, ohne Prozent) in der Druckauswahl; Moodle-Rückmeldung je Person mit Haken „Kompetenzen in diesem Test“. Beamer und Vollbild nie mit Einzelwerten, höchstens die Kurszeile ohne Namen.
14. **Datenschutz:** Leistungsdaten wie Noten (kein Art. 9), verschlüsselt wie alles andere; nicht in der unverschlüsselten Excel-Schülerliste, in Exporten nur auf Ankreuzen; `tools/entschluesseln.py` mitziehen. Im Förderplan (AG) erscheinen Kompetenzen mit „noch nicht“ als Hinweis zum Übernehmen, nicht automatisch.
15. **Katalog als gemeinsame Grundlage:** Vorlagen als JSON im Repo (`vorlagen/kompetenzen/mathe-sek1.json`, keine Personendaten). Eigener Katalog in der Datenbank, „Katalog exportieren“ schreibt dieselbe Struktur. `moodle.py` liest eine Katalogdatei, bricht bei unbekannter Kennung ab und schreibt Katalogkennung und -version in die Begleitdatei. Beim Import meldet OrdoNota unbekannte Kennungen (zuordnen oder in den Katalog aufnehmen).
16. **Katalogformat** (siehe unten). Kennungen werden nie umbenannt oder neu vergeben; gelöschte bleiben als „ausgeblendet“, damit alte Tests auswertbar bleiben; `version` zählt bei jeder Änderung hoch.
17. **Format der Begleitdatei** (siehe unten). Fragen vom Typ „Beschreibung“ kommen nicht hinein.
18. **Reihenfolge AI-1 bis AI-5**, je Schritt eine Minor-Version. *Ergänzung:* **Release erst ab 2.13.0** (nach AI-5), vorher nur lokal committen bzw. pushen auf Ansage.

**Katalogdatei** (Vorlage, Export, Eingabe für `moodle.py`):
```json
{
  "format": "ordonota-kompetenzkatalog",
  "formatVersion": 1,
  "id": "mathe-sek1",
  "fach": "Mathematik",
  "version": 3,
  "stufen": { "teilweise": 50, "sicher": 80 },
  "bereiche": [
    { "id": "K", "name": "Prozessbezogen",
      "kompetenzen": [
        { "id": "M-K2", "name": "Probleme mathematisch lösen",
          "teil": [ { "id": "M-K2.1", "name": "Lösungsstrategien anwenden" } ] } ] },
    { "id": "L", "name": "Inhaltlich",
      "kompetenzen": [ { "id": "M-L4", "name": "Funktionaler Zusammenhang" } ] }
  ]
}
```

**Begleitdatei** `Moodle-Test – <Thema> (Kompetenzen).json` (schreibt `t.speichern(...)` neben die XML):
```json
{
  "format": "ordonota-moodle-kompetenzen",
  "formatVersion": 1,
  "katalog": { "id": "mathe-sek1", "version": 3 },
  "test": "Quadratische Funktionen/Teil 1",
  "fragen": [
    { "name": "QF-03 Gestaucht",
      "textanfang": "Der Graph von f(x) = 0,5x² ist …",
      "kompetenzen": ["M-L4", "M-K4"] }
  ]
}
```
`textanfang` erzeugt `moodle.py` so, wie Moodle den Fragetext in die CSV schreibt (HTML entfernt, Bilder weg, Leerraum zusammengefasst, LaTeX roh, höchstens 80 Zeichen). Gleichen sich die ersten 60 Zeichen zweier Fragen eines Tests, bricht `moodle.py` ab. OrdoNota vergleicht als Präfix. Formatänderungen nur in Absprache, beide Seiten gleichzeitig. **Übergabe an die Skill-Sitzung:** erledigt (AI-1 bis AI-5 umgesetzt), Übergabedatei und Testexport am 27.11.2026 entfernt.

**Kein neues Schema (Q20, 24.11.2026):** Der Haken „nicht gewertet“ (`a.ungraded`, `grades.js` `ungradedFor`) gibt es schon und ältere Versionen verstehen ihn. Ein **Kompetenztest** ist ein Test mit `ungraded` und mindestens einer Kompetenz; Umschalter und Schalter in der Notenübersicht beziehen sich genau darauf, nicht gewertete Tests ohne Kompetenzen bleiben wie bisher ausgegraut sichtbar. Katalog und `task.competencies` sind zusätzliche Felder, `SCHEMA` bleibt 5 (CLAUDE.md Regel 1).

**Weitere Entscheidungen (24.11.2026):**
19. **Vorlage Mathe Sek I = Bildungsstandards 2022** (KMK): `M-K1`–`M-K7` (abgeglichen: der Beschluss nennt sieben prozessbezogene Kompetenzen, ohne Nummern), `M-L1` Zahl und Operation, `M-L2` Größen und Messen, `M-L3` Strukturen und funktionaler Zusammenhang, `M-L4` Raum und Form, `M-L5` Daten und Zufall. Ohne Teilkompetenzen. Bezeichnungen mit dem KMK-Beschluss vom 23.06.2022 abgeglichen.
20. Haken „nicht gewertet“ weiterverwenden, kein Schema 6 (siehe oben).
21. **Katalog am Kurs:** Auswahl „Kompetenzkatalog“ in den Kurseinstellungen, vorbelegt nach `course.fach`. Ohne Katalog kein Feld „Kompetenzen“ an den Aufgaben.

**To-do:**
- [x] **AI-1 (2.9.0)** – erledigt 24.11.2026 (lokal committet, kein Release bis 2.13.0). Oberfläche nach `/impeccable shape`: Raster-Karte „Kompetenzen“ im Test, Dialog „Katalog bearbeiten“, Kennung änderbar nur solange unbenutzt. Vorlage = Bildungsstandards 2022 mit **sieben** prozessbezogenen Kompetenzen (M-K1 argumentieren … M-K7 mit Medien arbeiten, Reihenfolge des KMK-Beschlusses, der selbst nicht nummeriert) und M-L1–M-L5. Plan war: Datenmodell (Schema bleibt 5, Kataloge in `db.settings`, `course.catalogId`, `task.competencies`, `migrate()`/`check()`), reines Modul `js/competencies.js` mit `tests/competencies.test.html`, Vorlage `vorlagen/kompetenzen/mathe-sek1.json` (Bildungsstandards 2022, Q19), Katalogseite in den Einstellungen mit Import/Export, Katalogauswahl am Kurs, Feld „Kompetenzen“ je Aufgabe
- [x] **AI-2 (2.10.0)** – erledigt 24.11.2026 (lokal committet). Nach `/impeccable shape`: Begleitdatei in der Dropzone und Knopf „Kompetenzen zuordnen“ in der Karte „Moodle“ (nutzt die gespeicherte Antworten-CSV); unbekannte Kennungen je Kennung weglassen/aufnehmen/ersetzen; zugeordnete Fragen ersetzen die Kompetenzen, „— keine —“ behält sie; Kurs ohne Katalog übernimmt den Katalog oder die Vorlage der Begleitdatei; Hinweis „Bewertung notwendig“. Plan war: Moodle-Import mit Begleitdatei (dritte Datei), Textabgleich als Präfix (CSV-Text beginnt mit `textanfang`, normalisiert; **nicht** am ersten „: “ schneiden, ein Fragetext kann selbst „: “ enthalten – Hinweis der Skill-Sitzung vom 24.11.2026), Zuordnungsdialog, unbekannte Kennungen. Parallel `moodle.py` in der Materialsammlung: Katalog lesen, Kennungen prüfen, Tags in die XML, Begleitdatei schreiben (wer das baut, entscheidet der Nutzer)
- [x] **AI-3 (2.11.0)** – erledigt 24.11.2026 (lokal committet). Nach `/impeccable shape`: Zelle = Stufenzeichen + Prozent (Farbe nie allein), „wenig Daten“ blass mit Punkt, „–“ ohne Punkte; nur Spalten mit Aufgaben im Zeitraum, darunter „Noch in keinem Test: …“; „fehlt“/„nachschreiben“/Täuschung zählen nicht, Nachschreibtermin mit eigenen Punkten, „nicht gewertet“ je Person zählt, leere Aufgabe bei sonst vorhandenen Punkten = 0; Reiter nur mit Katalog am Kurs; Umschalter in „Tests“ nur, wenn das Halbjahr einen Kompetenztest hat; Notenübersicht-Schalter pro Gerät, Ausdrucke nie mit Kompetenztests. Plan war: Reiter „Kompetenzen“ (Person × Kompetenz, Stufen, „wenig Daten“, Zeitraum), Umschalter im Reiter „Tests“, Ausblenden in der Notenübersicht
- [x] **AI-4 (2.12.0)** – erledigt 24.11.2026 (lokal committet). Nach `/impeccable shape`: Klick auf den Namen öffnet den Dialog „Verlauf: Name“ mit ‹ › und Pfeiltasten (Reihenfolge der Tabelle); je Kompetenz eine Linie mit Prozent **je Test** (kein laufender Schnitt), Stufengrenzen gestrichelt, Stufenzeichen am Punkt, gemeinsame Zeitachse für alle Zeilen, Stand rechts; Zeitraum wie im Reiter. Kurszeile „Kurs“ im `tfoot`: Balken sicher → teilweise → noch nicht und Anzahlen, nur Personen mit Punkten. Personenregister: Abschnitt „Kompetenzen“ je Katalog mit Linie über alle Kurse und Schuljahre (gestrichelte Trennlinie) und Stand je Schuljahr. Plan war: Verlauf im Kurs und im Personenregister
- [x] **AI-5 (2.13.0)** Kompetenzbogen, Block in der Moodle-Rückmeldung, Hinweis im Förderplan – erledigt am 24.11.2026 (Druckauswahl im Reiter „Kompetenzen“, A4 je Person mit zwei Blöcken; Moodle-Block mit Zeichen, Name, Punkten; Förderplan-Hinweis eingeklappt im Dialog mit „In Ziele übernehmen“) → **Release v2.13.0** veröffentlicht am 24.11.2026 (Notizen „Neu seit 2.8.0“; dazu Notfallwerkzeug mit `Kompetenzkataloge.csv` und `Kompetenzen.csv`)

**Ablauf je Schritt:** mit Oberfläche zuerst `/impeccable shape` und bestätigen lassen → umsetzen → Detektor, `polish` (bei Import/Formularen `harden`) → Tests (`code-testlauf`) → Doku (DOKUMENTATION.md mit 24, 25.1, 26.4; README) → hier abhaken → lokaler Commit. Pushen nur auf Ansage nach `code-pruefen`.

## AJ) Personen nach Kurs filtern – erledigt in 2.14.0 (geklärt am 24.11.2026, veröffentlicht als v2.14.0)

- [x] Auf der Seite „Personen“ ersetzt eine Auswahl den Umschalter „Alle | Ohne Kurs“: „Alle“, „Ohne Kurs“, darunter die Kurse aller Schuljahre (je Schuljahr gruppiert, das aktuelle zuerst), jeweils mit Anzahl.
- [x] Nur für die Sitzung, Voreinstellung „Alle“. Die Namenssuche wirkt zusätzlich, Reihenfolge alphabetisch wie sonst. Nichts gespeichert, Schema bleibt 5.
- [x] E2E-Test in `run_people_page_check`, Doku 6.x.

## AK) Export „Für OrdoSortis“ – erledigt in 2.15.0 am 25.11.2026 (lokal committet, noch nicht veröffentlicht)

OrdoSortis (`../OrdoSortis`, Berufsorientierung) übernimmt Personen und Klassen aus OrdoNota. Schlüssel ist `people[].id`. Das Format legt `../OrdoSortis/docs/KONZEPT.md` Abschnitt 7.1 fest; Änderungen nur nach Absprache und in beiden Apps.

- **Ort:** Seite „Personen“. Steht die Auswahl auf einem Kurs, erscheint unter der Liste der Knopf **„Für OrdoSortis exportieren“** (bei „Alle“ und „Ohne Kurs“ nicht).
- **Inhalt:** die aktiven Kurseinträge des Kurses (`active !== false`), sortiert nach Nachname, Vorname. Namen aus dem Personenregister (`people[]`), nicht aus dem Kurseintrag.
- **Datei:** `ordosortis_personen_<Klasse>_<JJJJ-MM-TT>.csv` (über `safeFilename`), Semikolon, UTF-8 **ohne BOM**, Zeilenende `\n`, Kopfzeile `person_id;nachname;vorname;klasse;schuljahr;email`. `klasse` = `course.klasse`, `schuljahr` = Name des Schuljahrs, `email` = Moodle-Adresse des Kurseintrags oder leer. Felder mit `;`, `"` oder Zeilenumbruch in Anführungszeichen.
- **Nie dabei:** Noten, Bemerkungen, Notizen, Nachteilsausgleiche, Förderplan, Fotos, I-Status.
- Nach dem Herunterladen ein Hinweis: Die Datei ist nicht verschlüsselt.
- **Logik** rein in `js/sortis.js` (`NM.sortis.exportCsv(db, course)` → `{ name, text }`), Datum über einen Parameter testbar.
- **Tests:** `tests/sortis.test.html` (Kopfzeile, Sortierung, inaktive fehlen, Namen aus dem Register, leere Mail, Maskierung, kein BOM, Dateiname); End-to-End in `run_tests.py` (Knopf nur bei Kursauswahl, Inhalt der Datei).
- Kein neues `SCHEMA`, keine neuen Felder.

## Wunschliste vom 27.11.2026 (Reihenfolge der Umsetzung: AL, AM, AN, AO, AP; AQ später)

Mit dem Nutzer am 27.11.2026 geklärt (grill-me Q1–Q10, alle Empfehlungen angenommen, Q6 zurückgestellt). Jeder Buchstabe ist eine eigene Minor-Version mit Tests. Ablauf je Buchstabe wie bei der Wunschliste vom 18.11.2026 (mit Oberfläche zuerst `/impeccable shape`).

**To-do:**
- [x] **AL** Sperre bei Standby – erledigt in 2.16.0 (27.11.2026, lokal committet). Abweichung: Lücke 2 Min. statt 60 s, weil Browser Hintergrund-Tabs auf einen Zeitgeber pro Minute drosseln
- [x] **AM** Ältere Ziehungen löschen – erledigt in 2.17.0 (27.11.2026, lokal committet)
- [x] **AN** Einzelne Noten in der Notenübersicht nicht werten – erledigt in 2.18.0 (27.11.2026, lokal committet), Q11/Q12 siehe Abschnitt AN
- [x] **AO** EPO: Anzahl der angezeigten Stunden begrenzen – erledigt in 2.19.0 (27.11.2026, lokal committet); Auswahl erst ab 4 Stunden im Block
- [x] **AP** Tool „Begriffe in Gruppen“ – erledigt in 2.20.0 (27.11.2026, lokal committet); „je Gruppe“ rundet die Gruppenzahl wie der Reiter „Gruppen“; Notfallwerkzeug unverändert (wie `randomCards` nur im Klartext-JSON)
- [x] **AQ** Planung – geklärt am 27.11.2026 (grill-me Q1–Q11), AQ-1 bis AQ-3 erledigt in 2.21.0–2.23.0 (lokal committet); offen: Bauskript in der Materialsammlung (eigene Sitzung, Übergabedatei), AQ-4 später
- [x] **AR** Erklärtexte für den Kompetenzbogen – geklärt am 27.11.2026 (grill-me Q1–Q10), AR-1 und AR-2 erledigt in 2.24.0–2.25.0 (lokal committet)

### AL) Sperre bei Standby

Ausgangslage: Die Sperre nach Inaktivität (`autoLockMin`, Standard 15 Min.) prüft alle 20 s die Uhrzeit (`js/app.js` ab 468). Ein Standby länger als `autoLockMin` sperrt also schon, aber erst beim nächsten Prüfschritt; ein kurzer Standby sperrt gar nicht.

- **Zeitsprung = Ruhezustand:** Liegt zwischen zwei Prüfschritten eine Lücke von mehr als 2 Minuten (geplant 60 s; Browser drosseln Zeitgeber in Hintergrund-Tabs auf einmal pro Minute, das darf nicht sperren), sperrt die App sofort (`lockApp`), unabhängig von `autoLockMin` – auch bei `autoLockMin = 0` („nie“).
- Beim Aufwachen sofort prüfen (`visibilitychange` → sichtbar, `focus`), damit die Noten nicht bis zu 20 s sichtbar sind. Ein Tabwechsel allein sperrt nicht.
- Keine eigene Einstellung. Ungespeicherte Änderungen sichert das Autosave wie bisher; `lockApp` speichert vorher, falls noch etwas offen ist.
- Tests: Zeitsprung simulieren (Uhr im Test vorstellen), Tabwechsel ohne Sperre.

### AM) Ältere Ziehungen löschen

Ausgangslage: Rückgängig gibt es nur für die letzte Ziehung je Pool bzw. klassisch (`undoDraw`, `undoPool`); der Verlauf (`historyCard`) hat keinen Knopf.

- Jede Ziehung im Verlauf bekommt **„Löschen“** mit Rückfrage. Die Rückfrage nennt, wie viele Noten in ihrer Spalte stehen; die Spalte samt Noten wird entfernt.
- Die Gezogenen kommen wieder in den Topf, **sofern sie seitdem nicht erneut gezogen wurden**. Spätere Ziehungen bleiben unverändert.
- Bei der letzten Ziehung bleibt „Rückgängig“ wie bisher.
- Logik rein in `js/draw.js`, Tests dazu.

### AN) Einzelne Noten in der Notenübersicht nicht werten

Ausgangslage: „nicht gewertet“ gibt es für ganze Tests/Präsentationen (`a.ungraded`) und je Person als Status „ungewertet“ (Tests, Präsentationen). Für EPO- und Ziehungsnoten und in der Notenübersicht fehlt es.

- **Nachgeklärt am 27.11.2026 (Q11, Q12):** Eigene Spalten sind Eingabefelder, ein Klick kann dort kein Menü öffnen. Deshalb Knopf **„Noten abschalten“** als Modus (Klick auf Zelle bzw. Spaltenkopf schaltet um, Eintippen solange gesperrt). Tests aus dem Reiter „Tests“ und Präsentationen: Status „nicht gewertet“; von Hand eingetragene Noten (auch Arbeiten mit „Note direkt“), Ziehungsspalten und EPO: neues Feld `a.off` statt `course.excluded`. Ganze Spalte = vorhandenes `a.ungraded` für alle Arten.
- *(ursprünglich geplant)* **Zelle:** Klick auf eine Zelle der Notenübersicht öffnet ein kleines Menü „Nicht werten“ / „Wieder werten“. Gilt für diese Person in dieser Spalte, für jede Art von Leistung. Die Zelle ist grau und durchgestrichen und zählt nicht im Schnitt. Rohdaten bleiben unverändert.
- **Spalte:** dasselbe Menü am Spaltenkopf. Für Tests und Präsentationen setzt es den vorhandenen Haken `a.ungraded` (kein zweiter Weg); für EPO-Blöcke und Ziehungsspalten das neue Feld.
- **Datenmodell:** neues Feld je Kurs `course.excluded` (Liste aus Spalte und Person bzw. ganzer Spalte), Standard `[]` in `migrate()`, `tools/entschluesseln.py` mitziehen, kein neues `SCHEMA`. Auswertung in `js/grades.js` (`halfResult`/`ungradedFor`), nicht gespeichert.
- Ausdrucke zeigen es wie „nicht gewertet“.

### AO) EPO: Anzahl der angezeigten Stunden begrenzen

- Auswahl **„Stunden: alle | letzte 3 | letzte 5 | letzte 10“** im Reiter „Mitarbeit/EPO“. Nur die Anzeige wird begrenzt; Σ, Max, %, Note rechnen weiter über alle Stunden des Blocks.
- Über der Tabelle ein Hinweis „4 ältere Stunden ausgeblendet“.
- Auswahl je Kurs, gespeichert auf dem Gerät (nicht in der Datenbank).

### AP) Tool „Begriffe in Gruppen“

- Neues Werkzeug im Reiter „Tools“ (`TOOL_IDS`, ein-/ausschaltbar und sortierbar wie die anderen, `course.tools`).
- **Eingabe:** freie Liste, eine Zeile je Begriff (Einfügen aus der Zwischenablage), dazu Knopf „Namen des Kurses einsetzen“. Die Liste bleibt je Kurs gespeichert.
- **Vorgabe:** Umschalter „Anzahl Gruppen | Begriffe je Gruppe“, Standard Anzahl. Nicht glatt teilbar → Gruppen höchstens um 1 verschieden groß.
- **Ergebnis:** Anzeige mit Vollbild/Beamer und „Neu mischen“, „Als Text kopieren“. Nur das letzte Ergebnis bleibt bis zum nächsten Mischen gespeichert, kein Verlauf, kein eigener Ausdruck.
- Datenmodell: zusätzliche Felder am Kurs (Liste, Vorgabe, letztes Ergebnis) mit Standard in `migrate()`, `tools/entschluesseln.py` mitziehen. Mischen rein in einem Logikmodul mit Tests.

### AQ) Planung: Einstieg Kompetenzen, neue Kataloge, Import der Aufgaben einer Klassenarbeit (geklärt am 27.11.2026, grill-me Q1–Q11)

Wunsch: Integration von Kompetenztests, Schnittstelle zu Lehrplan und Arbeitsmaterial, Import von Kompetenzen für eine Klassenarbeit.

**Befunde (27.11.2026):**
- Der Reiter „Kompetenzen“ fehlte beim Nutzer, weil der Katalog nur beim **Eintragen** des Fachs vorbelegt wird (`js/view-course.js`, `setFach`). Kurse, die vor 2.9.0 schon ein Fach hatten, haben keinen Katalog, also keinen Reiter und kein Feld „Kompetenzen“ an den Aufgaben.
- Die Unterrichtsplanung liegt ausführlich in einer eigenen Materialsammlung der Lehrkraft (je Reihe ein Reihenplan als Markdown mit Frontmatter `fach, klasse, nr, titel, wochen, status, schulbuch`, Lernzielen, Wochenübersicht, Stunden, Leistungsüberprüfungen; noch ohne Kompetenzkennungen).
- OrdoNota läuft offline im Browser und kann die Materialsammlung nicht selbst lesen. Eine Schnittstelle geht nur über eine Datei, die die Materialsammlung erzeugt und die in OrdoNota über die Dateiauswahl kommt (Muster: Moodle-Begleitdatei, AI-2).

**Entscheidungen:**
1. **Die Materialsammlung bleibt die Quelle der Planung** (Q1). OrdoNota bekommt keine eigene Reihen- oder Stundenplanung und keinen Abgleich in beide Richtungen. Später übernimmt es per Datei nur eine schlanke Reihenliste (AQ-4).
2. **Zuerst der Import der Aufgaben einer Klassenarbeit** (Q2): Beim Bau einer KA in der Materialsammlung entsteht eine Begleitdatei mit Aufgaben, Punkten und Kompetenzen; OrdoNota legt daraus den Test an. Zeitleiste der Reihen und Sprung zum Material kommen später auf derselben Schnittstelle.
3. **„Integration von Kompetenztests“ = besserer Einstieg** (Q3, zugleich der Punkt Q6 vom 27.11.): Katalog für bestehende Kurse anbieten, Hinweise solange kein Katalog gewählt ist, kurze Erklärung, wie alles zusammenhängt. Eigener Schritt vor allem anderen.
4. **Neue Vorlagen** Mathe MSS und Chemie Sek I (Q4, Q11). KuM und Informatik erst, wenn der Informatik-Lehrplan fest ist; eigene Kataloge gehen schon jetzt in den Einstellungen.
5. **Die Seite der Materialsammlung baut eine eigene Sitzung** (Q5) nach einer Übergabedatei, wie bei `moodle-fragen`.
6. **Angebot im Reiter „Tests“** (Q6): Hinweis oben „Für <Fach> gibt es den Kompetenzkatalog „…“. Wählen | Nicht jetzt“, nur wenn `guessForFach` einen Katalog oder eine Vorlage findet. „Nicht jetzt“ wird am Kurs gespeichert (gilt auf allen Geräten).
7. **Teilaufgaben** (Q7): Jede Teilaufgabe mit eigenen Punkten wird eine Aufgabe („1a“, „1b“); Teilaufgaben ohne eigene Punkte gehören zur Aufgabe darüber (Kompetenzen zusammengeführt). Bonus bleibt Bonus, Teile der Arbeit (z. B. „Ohne Hilfsmittel“) werden Teile in OrdoNota.
8. **Neu oder vorhanden** (Q8): „+ Neuer Test → Aus KA-Datei“ legt Name, Bereich, Teile, Aufgaben, Höchstpunkte und Kompetenzen an; Datum, Gewicht und Schlüssel wie bei einem neuen Test. In einen vorhandenen Test: ohne eingetragene Punkte ersetzt die Datei die Aufgaben (Rückfrage); mit Punkten übernimmt OrdoNota nur die Kompetenzen, zugeordnet über den Aufgabennamen, mit Prüfdialog wie bei Moodle.
9. **Kompetenzen je Aufgabe in der Materialsammlung** im Bauskript der KA (`kompetenzen=[...]`), geprüft gegen die Katalogdatei (Q9). Kompetenzen je Reihe im Frontmatter erst mit AQ-4.
10. **Reihenliste später** (Q10) als eigener Schritt mit kurzer Klärungsrunde, wenn der KA-Import läuft.

**Schritte:**
- [x] **AQ-1 (2.21.0) Einstieg Kompetenzen** – erledigt 27.11.2026 (lokal committet; ohne eigenes `/impeccable shape`, Muster `.notice` wie vorhandene Hinweise). Der Hinweis in der Reiterliste („braucht einen Kompetenzkatalog“) gab es schon seit 2.11. `tools/entschluesseln.py` unverändert: `catalogHintOff` ist nur ein Anzeigeschalter. Plan war:
  - Hinweis im Reiter „Tests“ (Entscheidung 6) mit „Wählen“ (setzt `course.catalogId`, legt die Vorlage bei Bedarf an) und „Nicht jetzt“ (`course.catalogHintOff = true`, Standard in `migrate()`, `tools/entschluesseln.py` mitziehen).
  - Ohne Katalog in der Testkarte „Aufgaben“ ein leiser Hinweis „Kompetenzen je Aufgabe gibt es mit einem Kompetenzkatalog am Kurs“ mit Sprung zu den Kurseinstellungen.
  - In der Reiterliste der Kurseinstellungen beim Reiter „Kompetenzen“: „erscheint, sobald ein Kompetenzkatalog gewählt ist“.
  - Kurze Erklärung „So hängt es zusammen“ (Katalog am Kurs → Kompetenzen je Aufgabe → Auswertung im Reiter „Kompetenzen“ → Verlauf, Kompetenzbogen) auf der Katalogseite der Einstellungen und in `DOKUMENTATION.md`.
  - Tests: Hinweis erscheint/verschwindet, „Nicht jetzt“ bleibt nach Neuladen, „Wählen“ schaltet den Reiter ein.
- [x] **AQ-2 (2.22.0) Vorlagen Mathe MSS und Chemie Sek I** – erledigt 27.11.2026 (lokal committet). **Abweichung Chemie:** Der KMK-Beschluss vom 13.06.2024 (ersetzt die Fassung von 2004) gliedert die vier Kompetenzbereiche in je drei Teilkompetenzbereiche (S 1–S 3, E 1–E 3, K 1–K 3, B 1–B 3; S 0 übergeordnet) und hat nur **drei** Basiskonzepte (Aufbau und Eigenschaften der Stoffe und ihrer Teilchen, chemische Reaktion, Energie). Vorlage deshalb mit fünf Bereichen: `C-S1`–`C-S3`, `C-E1`–`C-E3`, `C-K1`–`C-K3`, `C-B1`–`C-B3`, `C-BK1`–`C-BK3`. Mathe MSS wie geplant (Beschluss 18.10.2012 gilt weiter). Stufe als Feld `stufe` am Katalog, auch im Dialog wählbar. Plan war (Q11; Bezeichnungen beim Bau am Beschlusstext prüfen, wie Q19 bei AI):
  - `vorlagen/kompetenzen/mathe-mss.json` nach den Bildungsstandards AHR 2012: `MO-K1` argumentieren, `MO-K2` Probleme lösen, `MO-K3` modellieren, `MO-K4` darstellen, `MO-K5` mit symbolischen, formalen und technischen Elementen umgehen, `MO-K6` kommunizieren; `MO-L1` Algorithmus und Zahl, `MO-L2` Messen, `MO-L3` Raum und Form, `MO-L4` Funktionaler Zusammenhang, `MO-L5` Daten und Zufall.
  - `vorlagen/kompetenzen/chemie-sek1.json` nach den KMK-Bildungsstandards (geltende Fassung prüfen, ggf. 2024): Bereich „Kompetenzbereiche“ `C-K1` Sachkompetenz, `C-K2` Erkenntnisgewinnung, `C-K3` Kommunikation, `C-K4` Bewertung; Bereich „Basiskonzepte“ `C-B1` Stoff-Teilchen, `C-B2` Struktur-Eigenschaft, `C-B3` Chemische Reaktion, `C-B4` Energie.
  - `guessForFach` berücksichtigt die Stufe des Kurses (Sek I/MSS), damit ein MSS-Kurs Mathe den MSS-Katalog bekommt.
  - Tests: Vorlagen bestehen `clean()`/`check()`, Zuordnung nach Fach und Stufe.
- [x] **AQ-3 (2.23.0) Aufgaben einer Klassenarbeit importieren** – erledigt 27.11.2026 (lokal committet; ohne eigenes `/impeccable shape`, Dialog nach dem Muster des Moodle-Imports). Modul `js/kaimport.js`, Knöpfe „Test aus KA-Datei“ (Kopf des Reiters) und „KA-Datei“ (Karte „Aufgaben“, nicht bei Moodle-Tests). Halbe Punkte stellen die Genauigkeit auf halbe Punkte. Übergabedatei an die Skill-Sitzung geschrieben (liegt außerhalb des Repos); die Seite der Materialsammlung (Bauskript) ist noch offen. Plan war:
  - reine Logik in `js/competencies.js` oder neuem Modul (Datei prüfen, in Aufgaben/Teile umsetzen, Abgleich über Aufgabennamen) mit Testseite.
  - „+ Neuer Test → Aus KA-Datei“ und in der Testkarte „Aufgaben“ „Aus KA-Datei übernehmen“ (Entscheidung 8).
  - Unbekannte Kennungen und Kurs ohne Katalog wie bei AI-2 (weglassen/aufnehmen/ersetzen; Katalog oder Vorlage der Datei übernehmen, wenn `katalog.id` passt).
  - Übergabedatei an die Skill-Sitzung (außerhalb des Repos): Format, Prüfregeln, Ablage neben der KA-Datei. OrdoNota liest nur `formatVersion` 1.
- [ ] **AQ-4 (später)** Reihenliste aus der Materialsammlung (Titel, Zeitraum, Lernziele, Kompetenzen, geplante Leistungsüberprüfungen) – eigene Klärungsrunde.

**Begleitdatei der Klassenarbeit** `<Name der KA-Datei> (Aufgaben).json`, neben der .docx im Reihenordner:

```json
{
  "format": "ordonota-ka-aufgaben",
  "formatVersion": 1,
  "katalog": { "id": "mathe-sek1", "version": 1 },
  "arbeit": { "name": "KA 2 – Quadratische Funktionen", "bereich": "ka" },
  "teile": [ { "name": "Ohne Hilfsmittel" }, { "name": "Mit Hilfsmitteln" } ],
  "aufgaben": [
    { "name": "1a", "punkte": 3, "teil": 0, "kompetenzen": ["M-L3", "M-K5"] },
    { "name": "1b", "punkte": 4, "teil": 0, "kompetenzen": ["M-L3"] },
    { "name": "Bonus", "punkte": 2, "bonus": true, "teil": 1, "kompetenzen": ["M-K3"] }
  ]
}
```

- `teile` ist optional; ohne `teile` entfällt `teil`. `teil` ist der Index in `teile`.
- `punkte` > 0, Vielfache von 0,5; `name` je Arbeit eindeutig. `bereich`: `ka` (Klassen-/Kursarbeit) oder `sonstige` (z. B. HÜ); `katalog` fehlt, wenn ohne Katalog gebaut.
- Keine Personendaten, keine Lösungen. Unbekannte Felder werden übergangen. Formatänderungen nur in Absprache, beide Seiten gleichzeitig.

## AR) Erklärtexte für den Kompetenzbogen (geklärt am 27.11.2026, grill-me Q1–Q10)

Rückmeldung des Nutzers nach dem ersten KA-Import: Der Kompetenzbogen bringt den Schülern so wenig, weil er die Kompetenzen nicht erklärt. Je Stufe soll es eigene Erklärtexte geben, die klarer machen, was man verbessern kann.

**Befunde (27.11.2026):**
- Jeder Katalog hat zwei Grenzen (`stufen.teilweise` 50 %, `stufen.sicher` 80 %), also drei Stufen: ✗ noch nicht, ◐ teilweise, ✓ sicher.
- Der Kompetenzbogen (`js/print.js` `competencySheet`, Daten aus `NM.competencies.sheet`) zeigt je Kompetenz nur Zeichen, Name und Bereich. Er wertet nur die Ebene der Kompetenzen aus, Teilkompetenzen fließen ein.
- Vorlagen kommen beim Wählen als Kopie in `db.settings.competencyCatalogs`. Neue Texte in den Vorlagen erreichen vorhandene Kopien also nicht von selbst.

**Entscheidungen** (alle Empfehlungen angenommen, Anrede „du“ klein):
1. **Texte im Katalog** (Q1), an jeder Kompetenz das Feld `texte: { worum, noch, teilweise, sicher }`. Die Formatversion bleibt 1. Ältere OrdoNota-Versionen und `moodle.py` übergehen das Feld.
2. **Vier Texte je Kompetenz** (Q2), je höchstens 300 Zeichen:
   - `worum` „Darum geht es“: erklärt den Fachbegriff in Schülersprache, für alle Stufen gleich.
   - `noch` (✗): was noch fehlt und womit du anfängst.
   - `teilweise` (◐): was schon klappt und was du als Nächstes übst.
   - `sicher` (✓): „Ich kann …“-Satz und eine Herausforderung als nächster Schritt.
3. **Teilkompetenzen** bekommen vorerst keine Texte (Q3).
4. **Texte für die Vorlagen** (Q4) für Mathe Sek I, Mathe MSS und Chemie Sek I entwirft Claude aus den Beschreibungen der KMK-Bildungsstandards. Sie sind einfach, in der Du-Form mit kleinem „du“ geschrieben und für die MSS etwas fachlicher. Der Nutzer sieht sie vor dem Commit durch.
5. **Vorhandene Kopien** (Q5): `migrate()` trägt die Texte der Vorlage nach. Das gilt nur für Kataloge, deren Kennung zu einer Vorlage passt (Kennung gleich der Vorlage oder Vorlage plus „-N“, wie `fillTemplateStufe`), nur für leere Felder und nur für Kompetenzen mit gleicher Kennung. Eigene Texte werden nie überschrieben.
6. **Anzeige** (Q6):
   - Die Texte erscheinen auf dem Kompetenzbogen und in der Moodle-Rückmeldung je Person (Block „Kompetenzen in diesem Test“).
   - Beim Übernehmen des Förderplan-Hinweises in die Ziele kommt der Text für „noch nicht“ mit.
   - Beamer und Vollbild zeigen keine Texte.
7. **Bezug zum Test** (Q7): Bei ◐ und ✗ steht eine kleine Zeile „Im Test <Name>: Aufgaben 1a, 2“. Sie nennt nur den letzten Test im Zeitraum, in dem die Kompetenz vorkam.
8. **Seitenlänge** (Q8): „Das kannst du schon“ zeigt nur den `sicher`-Text in einer Zeile. „Daran arbeitest du weiter“ zeigt `worum` und den Stufentext. Reicht der Platz nicht, läuft der Bogen auf eine zweite Seite weiter. In der Druckauswahl kommt der Haken „Erklärtexte“ dazu, standardmäßig an.
9. **Bearbeiten** (Q9) im Katalogdialog: Je Kompetenz klappt der Bereich „Texte für den Kompetenzbogen“ mit vier Feldern auf. Die Texte kommen in Export und Import mit. `tools/entschluesseln.py` bekommt Spalten dafür. Vor dem Bau läuft `/impeccable shape`.
10. **Schritte** (Q10): AR-1 und AR-2, je eine Minor-Version. Die Texte der Vorlagen legt Claude zwischen AR-1 und AR-2 zum Durchsehen vor. Liegen Kopien der Katalogdateien in der Materialsammlung, bekommt die Skill-Sitzung einen Hinweis.

**Schritte:**
- [x] **AR-1 (2.24.0) Erklärtexte im Katalog und auf dem Bogen** – erledigt 27.11.2026 (lokal committet; nach `/impeccable shape`). Der Bogen nutzt die Blöcke nur, wenn mindestens eine Kompetenz unter „weiter“ einen Text hat; sonst bleibt die Tabelle wie bisher. Plan war:
  - `clean()` übernimmt `texte`, mit Längengrenze und ohne leere Felder.
  - Bearbeiten im Katalogdialog, Export und Import.
  - Ausgabe auf dem Kompetenzbogen (mit Haken „Erklärtexte“ und Aufgabenzeile) und in der Moodle-Rückmeldung.
  - Förderplan-Übernahme.
  - `entschluesseln.py`, Tests und Doku.
- [x] **AR-2 (2.25.0) Texte für die drei Vorlagen** – erledigt 27.11.2026 (lokal committet). 38 Kompetenzen mit je vier Texten, Entwurf vom Nutzer ohne Änderung freigegeben; Katalogversion der Vorlagen bleibt 1 (Kennungen unverändert). Plan war:
  - Entwurf zum Durchsehen.
  - Danach die Vorlagen in `js/competencies.js` und `vorlagen/kompetenzen/*.json` ergänzen.
  - Nachtragen über `migrate()`, dazu Tests.

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
