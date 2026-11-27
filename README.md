# OrdoNota

Notenverwaltung für Sek I und MSS (Rheinland-Pfalz) mit Sitzplänen. Läuft lokal im Browser, speichert verschlüsselt in einen Ordner, den der Synology Drive Client auf die DiskStation spiegelt.

**Ausführliche Anleitung, alle Rechenregeln und technische Details: [DOKUMENTATION.md](DOKUMENTATION.md)**

## Über das Projekt

Ich bin Lehrer für Mathematik, Chemie und Informatik. Mit Hilfe von KI schreibe ich Apps, die mir die Arbeit im Unterricht erleichtern. OrdoNota ist eine davon. Ich stelle diese Apps anderen Lehrkräften zur eigenen Nutzung zur Verfügung.

## Neu in 2.0

OrdoNota hat das gemeinsame Aussehen der Ordo-Apps bekommen: warme Grundfarbe im Standard-Design, Reiterleiste, kleine Symbole statt Emoji, größere Bedienelemente (40 px, bei Touch 44 px). In der Kopfzeile wechselt ein Schalter zwischen **Hell**, **Dunkel** und **Wie das System** (die sechs Designs wählen Sie weiter in den Einstellungen). Der Schalter **Große Schrift** (125 %) hilft bei Beamer und Tafel; er wird auf dem Gerät gemerkt und ist auf schmalen Bildschirmen ausgeblendet. Beim Moodle-Import gibt es eine Fläche zum Ablegen der Dateien. Daten und Rechenregeln bleiben unverändert, alte Datenbanken öffnen sich weiter.

**Mindeststand der Browser:** Chrome/Edge 120, Firefox 117, Safari/iOS 17.2 (das Design braucht CSS-Ebenen, verschachteltes CSS und `light-dark()`).

## Starten

1. `index.html` per Doppelklick in **Chrome, Edge, Brave oder Thorium** öffnen (Firefox/Safari können nicht direkt in Ordner schreiben).
2. Beim ersten Start **Datenordner wählen** – einen Ordner innerhalb des Synology-Drive-Ordners, z. B. `SynologyDrive/OrdoNota-Daten`.
3. Passwort festlegen und den **Wiederherstellungsschlüssel ausdrucken** (getrennt vom Rechner aufbewahren).
4. Auf dem zweiten Gerät denselben (synchronisierten) Ordner wählen und mit demselben Passwort entsperren.

**Ohne Rückfrage „Zugriff erlauben“:** über das Startprogramm starten (`OrdoNota` unter Linux, `OrdoNota.exe` unter Windows, `OrdoNota.app` unter macOS). Es öffnet die App als eigenes Fenster und schreibt die Dateien selbst; Installation ist nicht nötig, und es geht dann auch mit Firefox/Safari. Bauen und Weitergabe als ZIP an Kolleginnen und Kollegen: `launcher/build.sh` (braucht Go). Details: DOKUMENTATION.md 3.6.

**Programm und Daten trennen:** Programmordner nur lokal (z. B. per `git clone`, Update mit `git pull && launcher/build.sh`), Datenordner im Synology-Drive-Ordner. Die Datenbank ist eine einzige Datei: Einstellungen → **Datenordner wechseln …** kopiert sie (auf Wunsch mit Sicherungen) in einen neuen Ordner, **Aus Datei wiederherstellen …** spielt eine Kopie ein (das eigene Passwort bleibt), und ein leerer Ordner bietet **„Vorhandene Datenbank aus Datei übernehmen …“** an. Details: DOKUMENTATION.md 3.7 und 20.

**Updates:** Datenbanken aller früheren Versionen öffnen sich weiter und ergeben dieselben Noten (das prüfen die Tests mit Prüfstücken ab 1.1). Nach dem Entsperren prüft die App den Aufbau der Datenbank; Einstellungen → **Datenbank prüfen …** zeigt das Ergebnis (DOKUMENTATION.md 21.14).

Ausprobieren ohne echte Daten: **„Demo ansehen“** auf dem Startbildschirm oder unter Einstellungen (auch im Startprogramm), sonst `index.html?demo` (nichts wird gespeichert). Beispiel-CSVs für den Moodle-Import (Kurs 8b Mathe) liegen in `demo/`.

## Was liegt wo

| Datei/Ordner | Inhalt |
|---|---|
| `notenmanager.nmdb` (im Datenordner) | die verschlüsselte Datenbank |
| `notenmanager.lock.json` | zeigt, auf welchem Gerät die App gerade offen ist |
| `Sicherungen/` | rollierende Sicherungskopien (Standard: 10, höchstens alle 10 Min.) |
| `index.html`, `css/`, `js/`, `logo/`, `cards/`, `schrift/` | die App selbst – kann überall liegen, auch im Synology-Ordner (`cards/`: gemeinfreie Kartenbilder, CC0; `schrift/`: Josefin Sans für Überschriften) |
| `launcher/` | Startprogramm (Go); Einstellungen in `~/.config/OrdoNota/` bzw. `%AppData%\OrdoNota\` |

## Regeln, die die App umsetzt

**Skalen** – intern wird jede Note als Punkte 0–15 gespeichert.
- MSS: 15 = 1+ … 00 = 6.
- Sek I: 1, 1-, 2+, 2, … 5-, 6 (kein 1+). Dezimal: 1- = 1,33 · 2+ = 1,67 usw.

**Rundung** – erst am Ende. Sek I: auf die nächste Notenstufe (Schnitt auf 2 Stellen; bei Gleichstand die bessere Note, z. B. 2,50 → 2-). MSS: Punkteschnitt, ab ,5 aufwärts.

**Notenschlüssel für Tests** (LIMIT je Test einstellbar)
- MSS (wie die bisherige Excel-Vorlage): 01 P. bei ½·LIMIT, linear bis 04 P. = LIMIT, darüber 12 gleiche Schritte bis 101 %.
- Sek I: 4- ab LIMIT (z. B. 40–50 %), darüber 11 gleiche Schritte bis 100 %; 5- bei ½·LIMIT, 5+/5/5- gleichmäßig dazwischen; Schwellen auf ganze Prozent.
- Sek I wahlweise **nur ganze Noten** (1–6) je Test, z. B. bei wenigen Punkten: jede ganze Note beginnt an der Schwelle ihrer Minus-Note (4 ab LIMIT).
- **Arbeit in Teilen** (z. B. Theorie/Praxis): gemeinsam bepunktet (ein Schlüssel über alle Punkte) oder getrennt benotet (Schlüssel und Note je Teil; Gesamtnote = gewichteter Schnitt der Teilnoten, auf eine Stufe gerundet, erst wenn alle Teile bewertet sind; Drittelparagraph auf die Gesamtnote).
- Bei zu wenig Punkten (gleiche Schwelle für zwei Stufen, z. B. 2+ und 2) warnt der Schlüssel und bietet halbe Punkte bzw. nur ganze Noten an.
- Schwellen lassen sich je Test von Hand überschreiben. Bonusaufgaben zählen zur erreichten, nicht zur Höchstpunktzahl (Ergebnis wird bei der Bestnote gekappt).
- Drittelparagraph: Warnung, wenn mehr als ⅓ der Arbeiten 5 oder 6 sind (Täuschung/Verweigerung nicht mitgezählt).
- Statistik je Test: Notenspiegel, Ø, Standardabweichung (Teiler n), Anteil unter 4. Personen mit I-Status zählen in der Statistik nicht mit.
- Tests lassen sich als „nicht gewertet“ markieren: Sie bleiben sichtbar (ausgegraut), zählen aber nicht zur Note. Das geht auch für einzelne Personen über den Status „nicht gewertet“; die Arbeit zählt dann auch nicht in Notenspiegel, Ø und Drittelparagraph.

**Präsentationen** – je Kriterium 0–3 Punkte × Gewicht; Summe über den Testschlüssel (LIMIT, eigene Schwellen) in eine Note. Bei Gruppen gilt je Kriterium die eigene Bewertung, sonst der Gruppenwert.

**Mitarbeit/EPO** – je Stunde `++ + 0 - --` (4…0 Punkte), `k` = abwesend (zählt nicht), Zusatz `u` (HA unvollständig, −1) bzw. `h` (HA vergessen, −2), dazu `m` (Material vergessen, nur gezählt), z. B. `+h` oder `0hm`. Prozent = Punkte / (anwesende Stunden × 4). Umrechnung über **Vorlagen** (seit 2.8): Standard „0 = befriedigend“ (immer 0 → 3 bzw. 08, immer + → 2, immer ++ → 1), dazu „Mild“, „Streng“, „Wie Testschlüssel“ (bisherige Rechnung) und eigene Vorlagen; die Vorlage für neue Blöcke steht unter Einstellungen. Ältere Blöcke behalten ihre Rechnung und zeigen einen Hinweis zum Umstellen. Alles je Block einstellbar.

**Zeugnisnote**
- Jede Einzelnote hat Gewicht 1 (änderbar).
- Klassen-/Kursarbeiten : Sonstige = 50 : 50 (Sek I, MSS-LK) bzw. 33 : 67 (MSS-GK); Kurse ohne Klassenarbeiten 0 : 100.
- Jahresnote (Klasse 5–11) = ⅓ 1. HJ + ⅔ 2. HJ. MSS 12/13: jedes Halbjahr einzeln.
- Jede gerechnete Note kann „gesetzt“ werden (farbig markiert, mit Begründung).

## Bedienung – Kurzfassung

- **Ausdrucke**: alle mit demselben Kopf, links Schullogo und Schulname, rechts Kurs, Schuljahr, Lehrkraft und Datum. Eintragen unter Einstellungen → **Ausdrucke** (Logo als PNG/JPEG/SVG, wird verkleinert; gespeichert in der verschlüsselten Datenbank). Zettel zum Ausschneiden bekommen eine einzeilige Fassung.
- **Reiter ausschalten**: Einstellungen → Reiter (Standard für alle Kurse), je Kurs abweichend in „Kurs & Schüler“ („Wie Standard“ setzt zurück). Daten bleiben gespeichert und zählen weiter. **Reihenfolge** ändern: Reiter in der Reiterleiste ziehen oder Einstellungen → Reiter → Pfeile nach oben und unten (gilt für alle Kurse).
- **Kurs & Schüler**: Kursdaten, Gewichtung, Namen aus Excel einfügen (eine Zeile pro Person). Abgänge nur „Aktiv“ abwählen – Noten bleiben erhalten. Haken „I-Status“ markiert Personen mit einem **I**. **Excel** speichert die Schülerliste als `.xlsx`. Kurs löschen erst nach Eintippen von **LÖSCHEN**.
- **Personen** (unter der Kursliste): Personenregister über alle Kurse und Schuljahre. Suche, Filter „Ohne Kurs“, Name im Register, Kurse der Person mit Sprung zum Kurs. Personen **zusammenführen** (Vorschläge bei gleichem Namen oder gleicher Mail-Adresse, nichts vorausgewählt) und wieder **trennen**. Beim Einfügen von Namen fragt **„Diese Namen gibt es schon“**, ob es dieselbe Person ist (ein Treffer vorausgewählt). Nie auf dem Beamer, nie im Ausdruck. Filter nach Kurs und **„Für OrdoSortis exportieren“** (CSV mit Kennung, Name, Klasse, Schuljahr und Mail-Adresse der aktiven Personen eines Kurses, nicht verschlüsselt).
- **Nachteilsausgleich** (auf der Seite „Personen“): LRS, Dyskalkulie oder Sonstiges je Person mit Fächern, Maßnahmen und „gültig bis“. Ein dezentes Kürzel (LRS, DK …) steht in Punkteeingabe, Notenübersicht und Kursliste, nur im passenden Fach; bei Tests ein Haken „Ausgleich gewährt“. Die App rechnet nichts um. Nie in „Ziehen“, auf dem Beamer, im Ausdruck oder im Excel-Export.
- **Notizen** (auf der Seite „Personen“): Verlauf mit Datum und Kurs je Person, filterbar, an Ort und Stelle änderbar. Schnell aus dem Sitzplan (Knopf an der Karte oder Taste N) und aus der Notenübersicht (Symbol nur bei vorhandenen Notizen). Nie gedruckt, nie auf dem Beamer.
- **Förderplan** (auf der Seite „Personen“): Fassungen mit Datum, Förderschwerpunkten, Zeitraum, Zielen und Maßnahmen; **Fortschreiben** übernimmt die geltende Fassung als Vorlage, **Vergleichen** zeigt zwei Fassungen nebeneinander. Hinweis in der Kursliste, wenn ein Förderplan da ist, der I-Status aber fehlt. Nie gedruckt, nie auf dem Beamer.
- **Tests**: neue Tests zählen standardmäßig zu den sonstigen Leistungen (einstellbar); Aufgaben mit Höchstpunkten, Rohpunkte eintragen; Schlüssel, Notenspiegel, Statistik, Ausdrucke über **Drucken …** (Ergebnisliste, Notenschlüssel und Notenspiegel, Ergebniszettel); bei Klassenarbeiten Haken **„Unterschrift gesehen“** mit Zähler; **„+ Nachschreibtermin“** legt einen Nachtermin mit denselben Aufgaben an, der nur die Fehlenden zeigt und in der Notenübersicht mit der Arbeit eine Spalte und eine Leistung bildet; **Beamer**-Ansicht ohne Namen (Notenspiegel, Punkteverteilung, Ø je Aufgabe); bei zu wenig Punkten für alle Notenstufen hilft **„Punkte verteilen“** (jede Stufe ein eigener Punktwert, die Grenze zum Bestehen bleibt); für Personen mit I-Status eine **Verbalbeurteilung**, die auf dem Ergebniszettel statt der Note steht (unter 4− bzw. 4 Punkten als „fehlt noch“ markiert).
- **Einstufung** (Reiter „Kurs & Schüler“): Kurs undifferenziert, G, E, E1 oder E2, in der Oberstufe GK oder LK (folgt der Kursart); gilt für alle, einzelne Personen in der Spalte „Einst.“ abweichend.
- **OrdoScripto** (KI-Korrektur handschriftlicher Arbeiten, eigenes Programm): im Test **Für OrdoScripto vorbereiten** vergibt eine Test-ID und je Person eine pseudonyme Schüler-ID (je Test neu). In der Spalte `kurs` steht die Einstufung je Person (U, G, E, E1, E2, GK, LK), in OrdoScripto nur zur Anzeige. Die Karte „OrdoScripto“ speichert die **Import-CSV** (`test_id;schueler_id;kurs`, keine Namen); unter **Drucken …** gibt es **Trennblätter** mit Name, Klasse und QR-Code (auch nur für Nachschreibende). Nachschreibtermine nutzen die IDs der Arbeit. Die Zuordnung ID ↔ Name bleibt in der verschlüsselten Datenbank.
- **Arbeit in Teilen** (Haken in den Eckdaten): Teile umbenennen, „+ Teil“, Gewicht und Schlüssel je Teil, Status „fehlt“/„NS“ je Teil, Teil in der Ergebnistabelle per Knopf mit dem **Teilnamen** (Pfeil) ausblenden, Moodle-Import in einen Teil, Ausdruck **Ergebnisse nach Teilen**.
- **Kompetenzen je Aufgabe** (seit 2.9): Kompetenzkataloge unter Einstellungen (Vorlage „Mathematik Sek I, Bildungsstandards 2022“, eigene Kataloge, Import/Export als JSON), Katalog je Kurs in den Kursdaten. Im Test ordnet die Karte **„Kompetenzen“** (Raster Aufgaben × Kompetenzen) jeder Aufgabe eine oder mehrere Kompetenzen zu; die Fußzeile zählt die möglichen Punkte je Kompetenz. Vergebene Kennungen bleiben fest und lassen sich nur ausblenden.
- **Reiter „Kompetenzen“** (seit 2.11, nur mit Katalog am Kurs): je Person und Kompetenz Prozent und Stufe (✓ sicher, ◐ teilweise, ✗ noch nicht; Grenzen je Katalog) aus allen Tests mit Kompetenzen, Zeitraum 1. HJ, 2. HJ oder Schuljahr, Hinweis „wenig Daten“ unter 3 möglichen Punkten. Ein nicht gewerteter Test mit Kompetenzen ist ein **Kompetenztest**: Umschalter „Benotet | Kompetenztests | Alle“ im Reiter „Tests“, in der Notenübersicht nur mit „Kompetenztests zeigen“ (grau, ohne Einfluss auf die Note). Seit 2.12: Zeile **„Kurs“** mit der Verteilung sicher / teilweise / noch nicht je Kompetenz; Klick auf einen Namen zeigt den **Verlauf** (je Kompetenz die Tests nach Datum auf einer kleinen Linie, mit ‹ › zur nächsten Person). Im **Personenregister** derselbe Verlauf über alle Kurse und Schuljahre, je Fach, mit dem Stand je Schuljahr. Seit 2.13: **Kompetenzbogen** je Person zum Ausdrucken („Das kannst du schon“ / „Daran arbeitest du weiter“, nur Zeichen, ohne Prozent), in der **Moodle-Rückmeldung** wahlweise „Kompetenzen in diesem Test“, im **Förderplan** ein Hinweis auf Kompetenzen mit „noch nicht“ zum Übernehmen.
- **Moodle-Import** (im Test, Knopf **Moodle-CSV** in der Karte „Aufgaben“, bei Teilen je Teil): Antworten- und Bewertungen-CSV aus Moodle wählen; Haken **„Bisherige Aufgaben ersetzen“** (vorausgewählt, solange dort keine Punkte stehen), sonst kommen die Fragen dazu; Personen zuordnen (Name bzw. gemerkte E-Mail); jede Frage wird eine Aufgabe, die Note rechnet OrdoNota. Die CSV-Dateien werden verschlüsselt im Test gespeichert. Nicht beendete/fehlende Versuche → „fehlt“. Mit der **Begleitdatei** (JSON) des Bauskripts `moodle.py` übernimmt der Import die **Kompetenzen je Frage** (Abgleich über den Fragetext, unbekannte Kennungen weglassen, aufnehmen oder ersetzen; nachträglich über „Kompetenzen zuordnen“). Hinweis bei Fragen, die in Moodle noch nicht bewertet sind. Ausdruck **Moodle-Rückmeldung je Person** (unter Drucken …): je Person Frage, Antwort, Lösung, Punkte; unten Note als Zahl und ausgeschrieben (wahlweise) sowie Datum/Unterschrift der Lehrkraft.
- **Mitarbeit/EPO**: „+ Stunde“, dann pro Person das Kürzel tippen oder per **Schnellwahl** klicken; am Tablet **Kacheln** (je Person eine Kachel nach Sitzplan, antippen und bewerten); **Fotos** lassen sich per Umschalter vor den Namen einblenden; „füllen“ setzt alle leeren Zellen einer Stunde. Ausdrucke über **Drucken …**: Bewertungsliste und Mitarbeitszettel zum Ausschneiden (mit Datum/Unterschrift).
- **Präsentationen**: Kriterien aus einem Kriterienpool (für alle Kurse, 31 fein gegliederte Startkriterien wie Übersichtlichkeit, Lesbarkeit, Blickkontakt, mit Beschreibung je Stufe; „Startbestand ergänzen“ holt fehlende zurück) zusammenstellen und gewichten (×1–×3), je Person 0–3 Punkte pro Kriterium per Knopf oder in der Tabelle, Thema und Bemerkung; Note wie bei Tests über den Notenschlüssel. **Vorlagen** (benannte Kriteriensätze für alle Kurse) speichern und beim Anlegen wählen; mitgeliefert: „Kurzvortrag (ohne Handout)“, „Vortrag“, „Hausaufgaben vorstellen“. **Gruppenpräsentationen** (Form in den Eckdaten): Gruppen bilden oder übernehmen, Gruppe einmal bewerten – die Punkte gelten für alle Mitglieder; je Kriterium „Gruppe“ oder „je Person“, Abweichungen einzelner Personen (◆) ersetzen den Gruppenwert, jede Person bekommt ihre eigene Note. Ausdrucke: Bewertungsliste, leere Bewertungsbögen zum Ankreuzen, **Bewertungskriterien als Handreichung für die Klasse** (auch je Vorlage), Bewertungsbogen je Person.
- **Fehlzeiten** (Reiter „Kurs & Schüler“): Unterrichtstage mit Stundenzahl, je Person A (Entschuldigung offen) → E (entschuldigt) → U (unentschuldigt) per Klick; Summen je Halbjahr, Spalte „Fehlst.“ in der Notenübersicht, Ausdruck und Leistungsbogen. „Heute abwesend“ und k in EPO-Stunden tragen automatisch ein.
- **Ziehen**: gewählte Anzahl zufällig ziehen (z. B. Hausaufgaben einsammeln); Gezogene fallen aus dem Pool, bis er aufgefüllt wird (automatisch, wenn er zu klein ist, oder per Knopf). Jede Ziehung legt eine Spalte „HA-Kontrolle“ bei den sonstigen Leistungen an, Noten direkt eintragen. Übersicht über den Pool, Haken zum Herausnehmen und für „heute abwesend“ (wird als Fehlzeit gespeichert). **Benannte Pools** (z. B. „HA Runde 1“): alle Ziehungen in einer Spalte mit Zeitraum, eine Runde bis jede Person dran war, Prüfung auf Ziehfehler, alte Einzelspalten nachträglich zusammenfassen. Frühere Ziehungen lassen sich löschen (mit Rückfrage).
- **Tools** (früher „Zufall“): großer **Timer** (Ring, Ziffern, Balken oder Sanduhr, Schnellwahl, ± 1 Min., Signal, als Pop-up-Fenster für den Beamer), Zufallszahl, Personen auswählen (auf Wunsch ohne Wiederholung), 3D-Würfel W4–W20 (1–6 Stück mit Summe), Karten ziehen, auch mehrere auf einmal (52, 32 oder eigene Karten mit Text; Stapel immer sichtbar). Nur Werkzeug, keine Noten; jedes Werkzeug im Vollbild für den Beamer. Über **Werkzeuge …** je Kurs ein-/ausschalten und sortieren.
- **Gruppen**: Gruppen bilden für Gruppen-/Lernaufträge, Gruppenpuzzle und Vorträge – je n Personen oder n Gruppen (Rest wird verteilt), zufällig, leistungsgemischt oder leistungsgleich, mit Abwechslung; Abwesende auslassen; Regeln „nicht zusammen“/„zusammen“ (vertraulich, nie gedruckt). Neu würfeln, Gruppen fixieren (Schloss-Symbol), Personen ziehen oder anklicken zum Verschieben/Tauschen, Auftrag je Gruppe, Fotos und Nachnamen umschaltbar. **Expertengruppen** direkt unter den Stammgruppen, **Beamer** (große Schrift passend zum Bildschirm, Fotos und Nachnamen per Umschalter), Ausdruck als Übersicht oder Gruppenkarten, Übernahme in eine Präsentation.
- **Notenübersicht**: alle Noten des Halbjahres; direkte Noten eintragen (`2-`, `11`, oder `f` = fehlt, `ns` = Nachschreiben, `t` = Täuschung/Verweigerung). Ausdrucke über **Drucken …** (Notenliste, Leistungsbögen je Person), CSV-Export für Excel. Spaltengruppen (Klassenarbeiten, Sonstige) lassen sich einklappen, Spalten aus „Ziehen“ zu einer Spalte bündeln (nur Ansicht). **Noten abschalten**: einzelne Noten oder ganze Spalten aus der Rechnung nehmen, die Noten bleiben gespeichert.
- **Sitzplan**: mehrere Räume pro Kurs; Raster per „Raster bearbeiten“ an allen vier Seiten mit +/− erweitern oder verkleinern; Vornamen-Karten per Ziehen oder mit der Tastatur auf ein Raster setzen, tauschen, zufällig füllen, Stände speichern/laden, Fotos (Strg+V oder Bild auf die Karte ziehen, per Knopf ausblendbar), Druck; **Beamer** zeigt den Plan groß im Vollbild wie im Editor (Fotos zunächst aus), ohne Bearbeitung.
- **🍅 Pomodoro-Timer** (Einstellungen → aktivieren): in der Kopfzeile mit Start/Pause/Zurücksetzen/Einstellungen (Zahnrad); rot = Arbeitsphase, grün = Pause, gelb = pausiert. Anzahl, Längen, Ticken und Wecker-Signal einstellbar.
- **Designs**: je drei helle (Standard, Salbei, Lavendel) und dunkle (Standard, Nord, Aubergine) unter Einstellungen → Darstellung, mit Vorschau; der Schalter **Hell / Dunkel / Wie das System** in der Kopfzeile wechselt den Modus. Gilt je Gerät. Der Schalter **Große Schrift** (125 %) hilft bei Beamer und Tafel.
- **Sortieren**: Klick auf einen Spaltenkopf (Name, Vorname, Aufgabe, Stunde, Note, …) sortiert, zweiter Klick dreht um; bei Köpfen mit eigener Funktion über das kleine Sortier-Symbol. Leere Werte stehen unten, Ausdrucke bleiben alphabetisch.
- Tastatur: Enter/↓ = nächste Person, Tab = nächste Spalte.

## Sicherheit

- AES-256-GCM; der Schlüssel wird mit PBKDF2-SHA256 (600 000 Runden) aus dem Passwort abgeleitet. Ohne Passwort oder Wiederherstellungsschlüssel ist die Datei nicht lesbar – auch nicht auf der DiskStation.
- Automatische Sperre nach 15 Minuten ohne Aktivität (einstellbar) und immer nach dem Ruhezustand (Notebook zugeklappt).
- **Nur ein Gerät gleichzeitig.** Die App warnt, wenn sie auf einem anderen Gerät offen ist, wenn die Datei zwischendurch von außen geändert wurde und wenn Synology eine Konfliktkopie angelegt hat.
- Datenschutz: Für Schülerdaten auf privaten Geräten ist in RLP in der Regel eine Genehmigung der Schulleitung nötig. Das gilt besonders für Schülerfotos im Sitzplan.

## Notfall-Entschlüsselung ohne App

`tools/entschluesseln.py` entschlüsselt die Datenbank (oder eine Sicherung) mit Passwort oder Wiederherstellungsschlüssel zu lesbarem JSON, optional mit einer CSV je Kurs:

```bash
pip install cryptography
python3 tools/entschluesseln.py notenmanager.nmdb [--wiederherstellung] [--csv ordner/]
```

## Tests (für Entwicklung)

Alle Tests auf einmal (unsichtbarer Chromium-Browser):

```bash
uv run --with websocket-client --with cryptography python tests/run_tests.py
```

Einzeln: `tests/*.test.html` im Browser öffnen (`storage.test.html` nur über `http://localhost`). Details: DOKUMENTATION.md, Abschnitt 25–26.

## Lizenz

Copyright © 2026 Thomas Faßbender

OrdoNota ist freie Software unter der **GNU Affero General Public License, Version 3** (AGPL-3.0, Datei `LICENSE`). Sie dürfen das Programm nutzen, ändern und weitergeben. Jede weitergegebene oder im Netz betriebene Fassung muss wieder unter der AGPL-3.0 stehen und ihren vollständigen Quelltext mitliefern. Das Programm wird ohne Gewährleistung bereitgestellt.

Ausgenommen sind die Kartenbilder in `cards/`. Sie sind gemeinfrei (CC0), siehe `cards/LIZENZ.txt`.

Das gemeinsame Design der Ordo-Apps bringt fremde Bestandteile mit eigenen Lizenzen mit, die Texte liegen in `lizenzen/`: Blades (`css/blades.min.css`, MIT), Tabler Icons (Symbole in `js/solagio-design.js`, MIT) und die Schrift „Ordo Josefin“, eine gekürzte Fassung von Josefin Sans (`schrift/`, SIL Open Font License 1.1).
