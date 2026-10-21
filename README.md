# Notenmanager

Notenverwaltung für Sek I und MSS (Rheinland-Pfalz) mit Sitzplänen. Läuft lokal im Browser, speichert verschlüsselt in einen Ordner, den der Synology Drive Client auf die DiskStation spiegelt.

**Ausführliche Anleitung, alle Rechenregeln und technische Details: [DOKUMENTATION.md](DOKUMENTATION.md)**

## Starten

1. `index.html` per Doppelklick in **Chrome, Edge, Brave oder Thorium** öffnen (Firefox/Safari können nicht direkt in Ordner schreiben).
2. Beim ersten Start **Datenordner wählen** – einen Ordner innerhalb des Synology-Drive-Ordners, z. B. `SynologyDrive/Notenmanager-Daten`.
3. Passwort festlegen und den **Wiederherstellungsschlüssel ausdrucken** (getrennt vom Rechner aufbewahren).
4. Auf dem zweiten Gerät denselben (synchronisierten) Ordner wählen und mit demselben Passwort entsperren.

Ausprobieren ohne echte Daten: `index.html?demo` (nichts wird gespeichert).

## Was liegt wo

| Datei/Ordner | Inhalt |
|---|---|
| `notenmanager.nmdb` (im Datenordner) | die verschlüsselte Datenbank |
| `notenmanager.lock.json` | zeigt, auf welchem Gerät die App gerade offen ist |
| `Sicherungen/` | rollierende Sicherungskopien (Standard: 10, höchstens alle 10 Min.) |
| `index.html`, `css/`, `js/` | die App selbst – kann überall liegen, auch im Synology-Ordner |

## Regeln, die die App umsetzt

**Skalen** – intern wird jede Note als Punkte 0–15 gespeichert.
- MSS: 15 = 1+ … 00 = 6.
- Sek I: 1, 1-, 2+, 2, … 5-, 6 (kein 1+). Dezimal: 1- = 1,33 · 2+ = 1,67 usw.

**Rundung** – erst am Ende. Sek I: auf die nächste Notenstufe (Schnitt auf 2 Stellen; bei Gleichstand die bessere Note, z. B. 2,50 → 2-). MSS: Punkteschnitt, ab ,5 aufwärts.

**Notenschlüssel für Tests** (LIMIT je Test einstellbar)
- MSS (wie die bisherige Excel-Vorlage): 01 P. bei ½·LIMIT, linear bis 04 P. = LIMIT, darüber 12 gleiche Schritte bis 101 %.
- Sek I: 4- ab LIMIT (z. B. 40–50 %), darüber 11 gleiche Schritte bis 100 %; 5- bei ½·LIMIT, 5+/5/5- gleichmäßig dazwischen; Schwellen auf ganze Prozent.
- Schwellen lassen sich je Test von Hand überschreiben. Bonusaufgaben zählen zur erreichten, nicht zur Höchstpunktzahl (Ergebnis wird bei der Bestnote gekappt).
- Drittelparagraph: Warnung, wenn mehr als ⅓ der Arbeiten 5 oder 6 sind (Täuschung/Verweigerung nicht mitgezählt).
- Statistik je Test: Notenspiegel, Ø, Standardabweichung (Teiler n), Anteil unter 4. Personen mit I-Status zählen in der Statistik nicht mit.
- Tests lassen sich als „nicht gewertet“ markieren: Sie bleiben sichtbar (ausgegraut), zählen aber nicht zur Note. Das geht auch für einzelne Personen über den Status „nicht gewertet“; die Arbeit zählt dann auch nicht in Notenspiegel, Ø und Drittelparagraph.

**Mitarbeit/EPO** – je Stunde `++ + 0 - --` (4…0 Punkte), `k` = abwesend (zählt nicht), Zusatz `u` (HA unvollständig, −1) bzw. `h` (HA vergessen, −2), z. B. `+h`. Prozent = Punkte / (anwesende Stunden × 4). MSS: 5-%-Stufen wie bisher; Sek I: Sek-I-Schlüssel. Alles je Block einstellbar.

**Zeugnisnote**
- Jede Einzelnote hat Gewicht 1 (änderbar).
- Klassen-/Kursarbeiten : Sonstige = 50 : 50 (Sek I, MSS-LK) bzw. 33 : 67 (MSS-GK); Kurse ohne Klassenarbeiten 0 : 100.
- Jahresnote (Klasse 5–11) = ⅓ 1. HJ + ⅔ 2. HJ. MSS 12/13: jedes Halbjahr einzeln.
- Jede gerechnete Note kann „gesetzt“ werden (farbig markiert, mit Begründung).

## Bedienung – Kurzfassung

- **Kurs & Schüler**: Kursdaten, Gewichtung, Namen aus Excel einfügen (eine Zeile pro Person). Abgänge nur „Aktiv“ abwählen – Noten bleiben erhalten. Haken „I-Status“ markiert Personen mit einem **I**. **⬇ Excel** speichert die Schülerliste als `.xlsx`. Kurs löschen erst nach Eintippen von **LÖSCHEN**.
- **Tests**: Aufgaben mit Höchstpunkten, Rohpunkte eintragen; Schlüssel, Notenspiegel, Statistik, Ausdrucke (Schlüssel, Liste, Schülerzettel) und **⛶ Beamer**-Ansicht ohne Namen (Notenspiegel, Punkteverteilung, Ø je Aufgabe).
- **Mitarbeit/EPO**: „+ Stunde“, dann pro Person das Kürzel tippen oder per **Schnellwahl** klicken; **Fotos** lassen sich per Umschalter vor den Namen einblenden; „füllen“ setzt alle leeren Zellen einer Stunde. Ausdrucke: Liste und Schülerzettel zum Ausschneiden (mit Datum/Unterschrift).
- **Ziehen**: gewählte Anzahl zufällig ziehen (z. B. Hausaufgaben einsammeln); Gezogene fallen aus dem Pool, bis er aufgefüllt wird (automatisch, wenn er zu klein ist, oder per Knopf). Jede Ziehung legt eine Spalte „HA-Kontrolle“ bei den sonstigen Leistungen an, Noten direkt eintragen. Übersicht über den Pool, Haken zum Herausnehmen und für „heute abwesend“.
- **Notenübersicht**: alle Noten des Halbjahres; direkte Noten eintragen (`2-`, `11`, oder `f` = fehlt, `ns` = Nachschreiben, `t` = Täuschung/Verweigerung). Kursliste, Schülerbögen, CSV-Export für Excel.
- **Sitzplan**: mehrere Räume pro Kurs; Raster per „Raster bearbeiten“ an allen vier Seiten mit +/− erweitern oder verkleinern; Vornamen-Karten per Ziehen auf ein Raster setzen, tauschen, zufällig füllen, Stände speichern/laden, Fotos (Strg+V oder Bild auf die Karte ziehen, per Knopf ausblendbar), Druck.
- **Sortieren**: Klick auf einen Spaltenkopf (Name, Vorname, Aufgabe, Stunde, Note, …) sortiert, zweiter Klick dreht um; bei Köpfen mit eigener Funktion über das kleine ⇅. Leere Werte stehen unten, Ausdrucke bleiben alphabetisch.
- Tastatur: Enter/↓ = nächste Person, Tab = nächste Spalte.

## Sicherheit

- AES-256-GCM; der Schlüssel wird mit PBKDF2-SHA256 (600 000 Runden) aus dem Passwort abgeleitet. Ohne Passwort oder Wiederherstellungsschlüssel ist die Datei nicht lesbar – auch nicht auf der DiskStation.
- Automatische Sperre nach 15 Minuten ohne Aktivität (einstellbar).
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
