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

Anlass: OrdoScripto (eigenes Projekt, `../07 - OrdoScripto`) liest handschriftliche Mathe-Arbeiten per KI und schlägt Punkte vor. Es kennt **keine Namen**, nur Test-ID, Schüler-ID und Kurs. OrdoNota erzeugt diese Pseudonyme, druckt Trennblätter mit QR-Code und übernimmt am Ende die Punkte. Die Formate legt `docs/DESIGN.md` von OrdoScripto fest (Abschnitt „Schnittstellen zu OrdoNota“). Sie müssen **genau** eingehalten werden.

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
