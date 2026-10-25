# OrdoNota – Dokumentation

Version 1.14.0 · Stand Oktober 2026

OrdoNota (bis Version 1.11 „Notenmanager“) verwaltet Noten für die Sekundarstufe I (Noten 1–6 mit Tendenz) und die Mainzer Studienstufe (MSS, Punkte 00–15) an Schulen in Rheinland-Pfalz. Die App läuft vollständig lokal im Browser, verschlüsselt alle Daten mit einem Passwort und legt sie in einem Ordner ab, den der Synology Drive Client auf die DiskStation spiegelt.

---

## Inhalt

**Teil A – Benutzerhandbuch**

1. [Überblick](#1-überblick)
2. [Voraussetzungen](#2-voraussetzungen)
3. [Einrichtung und erster Start](#3-einrichtung-und-erster-start)
4. [Arbeiten mit mehreren Geräten](#4-arbeiten-mit-mehreren-geräten)
5. [Die Oberfläche](#5-die-oberfläche)
6. [Reiter „Kurs & Schüler“](#6-reiter-kurs--schüler)
7. [Reiter „Tests“](#7-reiter-tests)
8. [Reiter „Mitarbeit/EPO“](#8-reiter-mitarbeitepo)
9. [Reiter „Notenübersicht“](#9-reiter-notenübersicht)
10. [Reiter „Sitzplan“](#10-reiter-sitzplan)
    - [10a. Reiter „Ziehen“](#10a-reiter-ziehen)
11. [Drucken und Exportieren](#11-drucken-und-exportieren)
12. [Reiter „Einstellungen“](#12-reiter-einstellungen)
13. [Tastaturbedienung](#13-tastaturbedienung)

**Teil B – Rechenregeln**

14. [Notenskalen](#14-notenskalen)
15. [Notenschlüssel für Tests](#15-notenschlüssel-für-tests)
16. [Mitarbeit/EPO-Berechnung](#16-mitarbeitepo-berechnung)
17. [Halbjahres- und Jahresnote](#17-halbjahres--und-jahresnote)
18. [Rundung](#18-rundung)

**Teil C – Sicherheit, Sicherungen, Fehlerbehebung**

19. [Verschlüsselung und Datenschutz](#19-verschlüsselung-und-datenschutz)
20. [Sicherungen und Wiederherstellung](#20-sicherungen-und-wiederherstellung)
21. [Fehlerbehebung und häufige Fragen](#21-fehlerbehebung-und-häufige-fragen)

**Teil D – Technische Dokumentation**

22. [Aufbau der Anwendung](#22-aufbau-der-anwendung)
23. [Dateiformat der Datenbank](#23-dateiformat-der-datenbank)
24. [Datenmodell](#24-datenmodell)
25. [Tests](#25-tests)
26. [Erweitern und Anpassen](#26-erweitern-und-anpassen)

---

# Teil A – Benutzerhandbuch

## 1. Überblick

OrdoNota deckt vier Anwendungsfälle ab:

| Anwendungsfall | Reiter | Ergebnis |
|---|---|---|
| Tests mit Rohpunkten auswerten | **Tests** | Note je Person, Notenschlüssel, Notenspiegel, Drittelparagraph |
| Mitarbeit über eine feste Zahl von Stunden bewerten | **Mitarbeit/EPO** | Note je Person aus den Stundenbewertungen |
| Alle Noten gewichtet zur Zeugnisnote zusammenführen | **Notenübersicht** | Halbjahresnote, Jahresnote, gesetzte Noten |
| Sitzordnung für einen oder mehrere Räume planen | **Sitzplan** | Sitzplan mit Vornamen (und Fotos) zum Ziehen und Drucken |

Ergebnisse aus Tests und EPO-Blöcken erscheinen **automatisch** in der Notenübersicht. Dort lassen sich zusätzlich Einzelnoten direkt eintragen (z. B. Heft, Referat, Hausaufgabenüberprüfung).

**Grundprinzipien**

- Alle Daten liegen in **einer verschlüsselten Datei**. Es gibt keinen Server und keine Cloud außer Ihrer eigenen DiskStation.
- Die App speichert **automatisch** etwa eine Sekunde nach jeder Änderung.
- Die App wird **immer nur auf einem Gerät gleichzeitig** benutzt.

## 2. Voraussetzungen

| Bereich | Anforderung |
|---|---|
| Browser | Google Chrome, Microsoft Edge, Brave, Thorium oder ein anderer Chromium-Browser (aktuelle Version) |
| Nicht unterstützt | Firefox und Safari: Sie können nicht direkt in einen Ordner schreiben. Die App zeigt dann einen Hinweis. |
| Betriebssystem | Windows, Linux oder macOS (Desktop/Laptop) |
| Synchronisation | Synology Drive Client, der einen lokalen Ordner mit der DiskStation synchronisiert |
| Internet | Nicht nötig. Die App läuft komplett offline. |

## 3. Einrichtung und erster Start

### 3.1 Dateien ablegen

Der Programmordner enthält:

```
index.html        ← die App (per Doppelklick öffnen)
css/              ← Gestaltung
js/               ← Programmlogik
tests/            ← automatische Tests (nur für Entwicklung)
tools/            ← Notfall-Entschlüsselung ohne App (siehe 20.1)
README.md         ← Kurzfassung
DOKUMENTATION.md  ← dieses Dokument
```

Den Programmordner können Sie überall ablegen, auch im Synology-Drive-Ordner. Dann ist die App auf allen Geräten automatisch in derselben Version vorhanden.

### 3.2 Datenordner anlegen

Legen Sie im Synology-Drive-Ordner einen eigenen Unterordner für die Daten an, z. B.:

```
SynologyDrive/
└── OrdoNota-Daten/         ← diesen Ordner wählen Sie in der App
```

> **Tipp:** Verwenden Sie für die Daten einen eigenen Ordner, getrennt vom Programmordner. Dann bleiben Programm-Updates und Daten sauber getrennt.

### 3.3 Erster Start

1. `index.html` per Doppelklick öffnen. Falls ein anderer Browser startet: Rechtsklick → *Öffnen mit* → Chrome/Edge.
2. **„Datenordner wählen …“** klicken und den Ordner aus 3.2 auswählen. Der Browser fragt, ob die Seite den Ordner bearbeiten darf. Bitte erlauben.
3. Da noch keine Datenbank existiert, erscheint **„Neue Datenbank anlegen“**:
   - **Passwort** (mindestens 8 Zeichen) zweimal eingeben,
   - **Name dieses Geräts** eingeben (z. B. „PC Arbeitszimmer“). Er erscheint in Warnhinweisen auf anderen Geräten.
4. Der **Wiederherstellungsschlüssel** wird angezeigt (Format `XXXX-XXXX-…`, 8 Gruppen).
   - Mit **„Drucken …“** ausdrucken oder sicher notieren.
   - Getrennt vom Rechner aufbewahren (z. B. im Ordner mit wichtigen Unterlagen).
   - Erst nach dem Haken **„Ich habe den Schlüssel sicher notiert“** geht es weiter.
5. Die App ist bereit. Legen Sie links mit **„+ Kurs anlegen“** Ihren ersten Kurs an.

> ⚠️ **Ohne Passwort und ohne Wiederherstellungsschlüssel sind die Daten unwiederbringlich verloren.** Auch Synology oder die Entwickler können sie dann nicht entschlüsseln.

### 3.4 Späterer Start

Der Browser merkt sich den Datenordner. Beim nächsten Start erscheint direkt **„Datenbank entsperren“**. Passwort eingeben und **Entsperren** klicken. Fragt der Browser erneut nach dem Ordnerzugriff, bitte erlauben. Das ist pro Browsersitzung einmal nötig.

### 3.5 Demo-Modus

`index.html?demo` öffnet die App mit Beispieldaten (Kurs 8b Mathe, Sek I, und MSS 12 M LK). Statt echter Fotos hat jede Person ein Personensymbol, damit sich Sitzplan und Fotoanzeige im EPO ausprobieren lassen. **Nichts wird gespeichert.** Der Demo-Modus eignet sich zum Ausprobieren und Kennenlernen. Zum Ausprobieren des Moodle-Imports (Abschnitt 7.7) liegen im Ordner `demo/` eine Antworten- und eine Bewertungen-CSV, deren Namen zum Kurs 8b Mathe passen.

## 4. Arbeiten mit mehreren Geräten

Die Datenbank ist **eine** verschlüsselte Datei. Synology Drive kann Änderungen von zwei Geräten **nicht zusammenführen**. Deshalb gilt:

> **Immer nur auf einem Gerät gleichzeitig arbeiten. Vor dem Gerätewechsel sperren und warten, bis Synology Drive synchronisiert hat.**

### 4.1 Zweites Gerät einrichten

1. Synology Drive Client auf dem zweiten Gerät einrichten und warten, bis der Datenordner synchronisiert ist.
2. `index.html` öffnen → **„Datenordner wählen …“** → denselben (synchronisierten) Ordner wählen.
3. Die vorhandene Datenbank wird erkannt. Mit demselben Passwort entsperren.

### 4.2 Schutzmechanismen

| Situation | Was die App tut |
|---|---|
| Die App ist auf einem anderen Gerät geöffnet | Beim Entsperren erscheint „Datenbank ist woanders geöffnet“ mit Gerätename und Uhrzeit. Sie können abbrechen oder trotzdem öffnen. Hinweise, die älter als 15 Minuten sind, werden ignoriert, z. B. wenn ein Gerät abgestürzt ist. |
| Die Datei wurde während der Arbeit von außen geändert | Beim nächsten Speichern erscheint „Datenbank wurde extern geändert“ mit drei Möglichkeiten (siehe 21.3). |
| Synology hat eine Konfliktkopie angelegt | Beim Entsperren erscheint ein Hinweis mit dem Dateinamen der Konfliktkopie (siehe 21.4). |

Technisch schreibt die App dazu die Datei `notenmanager.lock.json` in den Datenordner. Sie wird alle 3 Minuten aktualisiert und beim Sperren gelöscht.

## 5. Die Oberfläche

```
┌──────────────────────────────────────────────────────────────────────┐
│ OrdoNota      [Schuljahr 2026/27 ▾]      Gespeichert 10:14  ☾  🔒   │  ← Kopfzeile
├─────────────┬────────────────────────────────────────────────────────┤
│ KURSE       │ Kurs & Schüler | Tests | Mitarbeit/EPO | Notenübersicht │  ← Reiter
│ ▸ 8b Mathe  │                                                        │
│   MSS 12 LK │   … Inhalt des Reiters …                               │
│ + Kurs      │                                                        │
└─────────────┴────────────────────────────────────────────────────────┘
```

| Element | Funktion |
|---|---|
| **Schuljahr-Auswahl** | Wechselt das Schuljahr. „+ Neues Schuljahr …“ legt ein neues an. |
| **Speicherstatus** | „Speichert …“, „Gespeichert 10:14“, „Ungespeicherte Änderungen“ oder rot „Nicht gespeichert!“ |
| **☾** | Hell/Dunkel umschalten |
| **🔒 Sperren** | Speichert, entfernt den Geräte-Hinweis und sperrt die Datenbank |
| **Reiter** | Kurs & Schüler, Tests, Mitarbeit/EPO, Ziehen, Notenübersicht, Sitzplan, Einstellungen (in der Skizze aus Platzgründen gekürzt) |
| **Kursliste** | Kurse des gewählten Schuljahres, sortiert nach Jahrgang. Zeigt Stufe (Sek I/MSS) und Zahl der aktiven Schüler/innen. |
| **Halbjahres-Umschalter** | In Tests, EPO und Notenübersicht: HJ1/HJ2 bzw. 11/1, 11/2, 12/1, 12/2, 13; in der Notenübersicht zusätzlich „Jahresnote“ |

**Sortieren:** Alle Schülertabellen (Kurs & Schüler, Tests, Mitarbeit/EPO, Notenübersicht, Jahresnote) lassen sich nach jeder Spalte sortieren. Ein Klick auf den Spaltenkopf sortiert, ein zweiter dreht die Richtung um; ▲/▼ zeigt die aktive Spalte. Name und Vorname stehen in eigenen Spalten, die beim seitlichen Scrollen stehen bleiben (zu lange Namen werden mit „…“ gekürzt, der volle Name erscheint beim Darüberfahren). Ein Klick auf „Name“ stellt die alphabetische Reihenfolge wieder her. Wo der Spaltenkopf schon eine Funktion hat (Stunden im EPO, Leistungen in der Notenübersicht), sortiert das kleine **⇅** darunter.
- Beim ersten Klick stehen die besten Werte oben (meiste Punkte, beste Note); Namen und Status von A bis Z.
- Leere Zellen (nichts eingetragen, fehlt, abwesend) stehen immer unten.
- Die Sortierung gilt live: Ändert sich ein Wert, rutscht die Zeile an ihren neuen Platz. Enter/↓ springt dabei zur nächsten Zeile in der angezeigten Reihenfolge. Zum reinen Eintragen ist die Sortierung nach Name meist angenehmer.
- Die gewählte Sortierung merkt sich jedes Gerät (wie Reiter und Halbjahr); sie wird nicht in der Datenbank gespeichert. Ausdrucke und CSV-Export bleiben alphabetisch.
- In „Kurs & Schüler“ stehen nicht mehr aktive Personen unten, außer Sie sortieren nach „Aktiv“.

**Farben:** Noten sind von grün (sehr gut) bis rot (ungenügend) hinterlegt. Das lässt sich unter Einstellungen → Darstellung abschalten.

## 6. Reiter „Kurs & Schüler“

### 6.1 Kursdaten

| Feld | Bedeutung |
|---|---|
| Klasse / Stufe | z. B. „8b“ oder „MSS 12“ |
| Fach | z. B. „Mathe“, „M LK“ |
| Jahrgangsstufe | 5–13. **Ab 11 wird in MSS-Punkten gerechnet.** Bestimmt auch die Halbjahre. |
| Kursart | Setzt die Standardgewichtung (siehe Tabelle). Kursart und Jahrgang werden passend gehalten: Wählen Sie „MSS-Leistungskurs“ oder „MSS-Grundkurs“ bei Jahrgang 5–10, springt der Jahrgang auf 11 (bzw. 12/13, wenn das unter „Klasse / Stufe“ steht, z. B. „MSS 12“); „Sek I“ bei Jahrgang 11–13 setzt ihn auf 10. Ein Hinweis zeigt die Änderung an. |
| Gewicht Klassen-/Kursarbeiten (%) | Anteil der schriftlichen Arbeiten. Das andere Feld passt sich automatisch an (Summe 100 %). |
| Jahresnote: Gewicht 1. HJ : 2. HJ | Nur für Jahrgang 5–11; Standard 1 : 2 (⅓ : ⅔) |
| Notizen | Freitext zum Kurs |

**Kursarten**

| Kursart | Klassenarbeiten : Sonstige |
|---|---|
| Sek I | 50 : 50 |
| MSS-Leistungskurs | 50 : 50 |
| MSS-Grundkurs | 33 : 67 |
| Ohne Klassenarbeiten | 0 : 100 |

**Halbjahre je Jahrgang**

| Jahrgang | Halbjahre | Jahresnote |
|---|---|---|
| 5–10 | HJ1, HJ2 | ja |
| 11 | 11/1, 11/2 | ja (zusätzlich zu den Halbjahrespunkten) |
| 12 | 12/1, 12/2 | nein |
| 13 | 13 | nein |

> Ändern Sie die Jahrgangsstufe eines Kurses mit vorhandenen Noten, ordnet die App die Leistungen den neuen Halbjahren zu (erstes zu erstem, zweites zu zweitem) und fragt vorher nach. Wechselt dabei die Skala (Sek I ↔ MSS), bekommen Tests und EPO-Blöcke, die noch das Standard-LIMIT bzw. die Standard-Umrechnung der alten Stufe haben, die Standardwerte der neuen Stufe (z. B. LIMIT 50 % → 45 %); von Hand geänderte Werte bleiben.
>
> **Korrektur in Version 1.12.1:** Bis dahin ließ sich „MSS-Grundkurs“/„MSS-Leistungskurs“ wählen, ohne dass sich der Jahrgang änderte – solche Kurse rechneten mit der Sek-I-Notenskala. Beim ersten Öffnen mit Version 1.12.1 werden sie automatisch auf MSS umgestellt (Jahrgang 11 oder der Jahrgang aus „Klasse / Stufe“), samt Halbjahren, gesetzten Noten und den Standardwerten von Tests/EPO. Bitte den Jahrgang danach kurz prüfen.

### 6.2 Schülerinnen und Schüler

**Namen einfügen:** In das Textfeld eine Liste einfügen, eine Person pro Zeile, und **„Namen übernehmen“** klicken. Erkannt werden:

| Format | Beispiel |
|---|---|
| Nachname, Vorname | `Müller, Anna` |
| Aus Excel kopiert (Tabulator) | `Schmidt⇥Jonas` – auch mit laufender Nummer davor |
| Vorname Nachname | `Lena Weber` (das letzte Wort gilt als Nachname) |

Doppelte Namen werden übersprungen. Die Liste wird alphabetisch sortiert.

**Bearbeiten:** Nach- und Vornamen direkt in der Tabelle ändern.

**I-Status:** Ein Haken in der Spalte **„I-Status“** markiert die Person in allen Tabellen mit einem **I** hinter dem Namen, in Lehrerlisten (Test-Ergebnisliste, Kursliste, EPO-Liste) mit „(I)“. Auf Schülerzetteln und Schülerbögen erscheint die Markierung nicht. Noten von Personen mit I-Status zählen **nicht in die Statistik**: Notenspiegel, Ø Note, Anzahl je Note, Drittelparagraph, „Ø gelöst“ je Aufgabe und Beamer-Ansicht berücksichtigen sie nicht. Unter dem Notenspiegel steht dann „Ohne n Personen mit I-Status“ (nicht in der Beamer-Ansicht). Ihre eigenen Noten werden ganz normal berechnet.

**Zu- und Abgänge:** Bei einem Abgang den Haken **„Aktiv“** entfernen. Die Person bleibt mit allen Noten gespeichert, erscheint aber nicht mehr in Eingabetabellen, Ausdrucken und Exporten. **✕** löscht die Person samt aller Noten endgültig.

### 6.3 Kurs verwalten

- **Kurs kopieren:** Übernimmt Kursdaten, Gewichtung und optional die aktiven Schüler/innen in ein (neues) Schuljahr, mit Jahrgang + 1 als Vorschlag. Noten werden nicht kopiert. Typischer Ablauf zum Schuljahreswechsel: oben „+ Neues Schuljahr …“ anlegen, dann jeden Kurs dorthin kopieren.
- **Kurs löschen:** Löscht den Kurs mit allen Schüler/innen, Noten und Sitzplänen. Zur Sicherheit muss im Dialog das Wort **LÖSCHEN** (in Großbuchstaben) eingetippt werden; vorher bleibt „Endgültig löschen“ gesperrt. Rückgängig machen geht nur über eine Sicherung.
- **Schülerliste als Excel:** Der Knopf **⬇ Excel** neben der Überschrift „Schülerinnen und Schüler“ speichert eine `.xlsx`-Datei mit den Spalten Nr., Nachname, Vorname, I-Status, Aktiv – zuerst die aktiven Personen alphabetisch und nummeriert, darunter die nicht mehr aktiven. Die Datei ist **nicht verschlüsselt** (siehe 11).

## 7. Reiter „Tests“

### 7.1 Test anlegen

1. Halbjahr wählen.
2. **„+ Neuer Test“** klicken.
3. Eckdaten ausfüllen:

| Feld | Bedeutung |
|---|---|
| Bezeichnung | z. B. „KA 1 – Terme“ |
| Datum | Testdatum |
| Bereich | **Klassen-/Kursarbeit** oder **Sonstige** (z. B. HÜ) |
| Wertung | Haken **„nicht gewertet“**: Der Test bleibt mit allen Ergebnissen, Schlüssel und Notenspiegel erhalten, erscheint in der Notenübersicht und in der Kursliste aber nur ausgegraut und zählt **nicht** zur Halbjahresnote. |
| Gewicht | Standard 1; z. B. 0,5 für eine kurze Überprüfung |
| Punkte-Genauigkeit | Ganze, halbe oder Zehntel-Punkte. Gilt für Notenschlüssel und Summen. |
| Notenstufen | nur Sek I: **mit Tendenzen** (1, 1-, 2+ … 6, Standard) oder **nur ganze Noten (1–6)**, z. B. für kurze Tests mit wenigen Punkten. Eine ganze Note beginnt dort, wo sonst ihre Minus-Note beginnt; die 4 also ab LIMIT (siehe 15.2). Beim Umstellen werden von Hand geänderte Schwellen zurückgesetzt (mit Rückfrage). |
| LIMIT | Sek I: Prozentsatz für die **4-**; MSS: Prozentsatz für **04 Punkte**. Neue Tests übernehmen den Standard aus den Einstellungen. |

### 7.2 Aufgaben

Jede Aufgabe hat eine **Bezeichnung** (z. B. „A1“; neue Aufgaben werden automatisch A1, A2, A3 … benannt) und eine **Höchstpunktzahl**. Mit **„+ Aufgabe“** bzw. **„+ Bonusaufgabe“** fügen Sie weitere hinzu, **✕** entfernt eine Aufgabe.

**Bonus:** Ist der Haken „Bonus“ gesetzt, zählen die Punkte zur erreichten Summe, aber **nicht zur Höchstpunktzahl**. Mehr als die Bestnote ist nicht möglich: Das Ergebnis wird bei 1 bzw. 15 Punkten gekappt. Bonusaufgaben sind gelb markiert.

### 7.3 Ergebnisse eintragen

In der Tabelle **Ergebnisse** die erreichten Punkte je Aufgabe eintragen (Komma oder Punkt als Dezimaltrenner). Daneben stehen sofort **Σ**, **%** und die **Note**.

**Status** je Person:

| Status | Wirkung |
|---|---|
| — | normale Wertung |
| fehlt (entschuldigt) | keine Note, zählt nicht im Schnitt |
| Nachschreiben | keine Note (Erinnerung zum Nachschreiben) |
| Täuschung/Verweigerung | Note 6 bzw. 00 Punkte; wird beim Drittelparagraphen **nicht** mitgezählt |
| nicht gewertet | Punkte und Note werden wie gewohnt berechnet und angezeigt, die Zeile ist ausgegraut. Die Arbeit zählt **nicht** zur Halbjahresnote dieser Person und nicht in Notenspiegel, Ø, Standardabweichung, „Ø gelöst“ und Drittelparagraph. In der Notenübersicht erscheint die Note ausgegraut. |

**Unterschrift gesehen** (nur bei Klassen-/Kursarbeiten): In der letzten Spalte „Unterschrift“ abhaken, wenn die unterschriebene Arbeit zurück ist; das Datum wird gemerkt (Tooltip). Neben „Ergebnisse“ steht der Stand, z. B. „Unterschriften 9 / 11“ (gezählt werden Personen mit Note), grün hinterlegt, wenn alle da sind. Der Vermerk hat keinen Einfluss auf die Note und erscheint im Ausdruck „Liste“ als eigene Spalte.

Die Zeile **„Ø gelöst“** zeigt je Aufgabe, wie viel Prozent der möglichen Punkte im Schnitt erreicht wurden. Daran sieht man schnell, welche Aufgabe schwer war.

### 7.4 Notenschlüssel

Rechts steht der Notenschlüssel mit Mindestpunktzahl („ab Pkt.“), Prozent und Anzahl je Notenstufe.

- **Schwelle von Hand ändern:** Wert in „ab Pkt.“ überschreiben. Geänderte Schwellen sind gelb markiert.
- **Zurücksetzen** stellt den berechneten Schlüssel wieder her.
- Die Formeln stehen in [Abschnitt 15](#15-notenschlüssel-für-tests).

### 7.5 Notenspiegel und Drittelparagraph

Unter dem Schlüssel stehen das Balkendiagramm (Anzahl je ganzer Note 1–6), Teilnehmende, Ø Note (bei MSS zusätzlich Ø Punkte), die **Standardabweichung** (Sek I: der Noten, z. B. 2- = 2,33; MSS: der Punkte; berechnet über alle gewerteten Arbeiten mit Teiler n), die Zahl der Noten 5 und 6 und der Anteil **unter 4** (Note 5 oder 6) in Prozent. Standardabweichung und Anteil unter 4 erscheinen auch in der Beamer-Ansicht und im Ausdruck „Schlüssel“ bzw. „Liste“.

**Drittelparagraph:** Sind mehr als ein Drittel der gewerteten Arbeiten mangelhaft oder ungenügend, erscheint die rote Meldung **„Drittelparagraph greift!“**. Arbeiten mit Status „Täuschung/Verweigerung“ zählen dabei nicht als 5/6, wohl aber zur Gesamtzahl. Personen mit I-Status zählen in der gesamten Statistik nicht mit (siehe Abschnitt „Kurs & Schüler“).

**Beamer-Ansicht:** Der Knopf **„⛶ Beamer“** öffnet im Vollbild nur den Notenspiegel (Balken, Teilnehmende, Ø Note, Höchstpunktzahl) und die Punkteverteilung (Rohpunkte von–bis und Anzahl je Notenstufe), darunter **Ø erreicht je Aufgabe** als Balken (Punkte und Prozent; nur eingetragene Werte zählen, wie in der Zeile „Ø gelöst“). Namen und Einzelergebnisse erscheinen nicht. Schließen mit **Esc** oder „✕ Schließen“. Die Ansicht ist eine Momentaufnahme; nach Änderungen neu öffnen.

### 7.6 Ausdrucke

| Knopf | Inhalt |
|---|---|
| 🖨 Schlüssel | Notenschlüssel und Notenspiegel (z. B. für das Klassenbuch oder die Fachleitung) |
| 🖨 Liste | Alle Personen mit Punkten je Aufgabe, Σ, %, Note (bei Klassen-/Kursarbeiten mit Spalte „Unterschrift“); darunter Notenspiegel und Schlüssel |
| 🖨 Schülerzettel | Ein Abschnitt pro Person zum Ausschneiden: erreichte und mögliche Punkte je Aufgabe, Prozent, Note |
| 🖨 Moodle-Ergebnisse | nur bei Tests aus Moodle (siehe 7.7): je Person eine Seite mit Ergebnis (Punkte, Prozent) oben, darunter Frage, gegebene Antwort, Lösung und Punkte; unten die **Note (Zahl und ausgeschrieben) wahlweise** sowie Linien für Datum und Unterschrift |

### 7.7 Moodle-Import

Tests aus Moodle lassen sich direkt übernehmen. Die Note berechnet OrdoNota mit dem eigenen Notenschlüssel (LIMIT, Abschnitt 15), nicht mit der Bewertung aus Moodle.

1. In Moodle beim Test unter **Ergebnisse** zwei Dateien als CSV herunterladen:
   - **Antworten** („Antworten“-Bericht): Fragetext, gegebene und richtige Antwort je Frage.
   - **Bewertungen** („Bewertungen“-Bericht, Spalten `F 1 /1,00`, `F 2 /1,00` …): Punkte je Frage. Nur diese Datei enthält Korrekturen, die Sie in Moodle von Hand vorgenommen haben (z. B. Tippfehler als richtig gewertet).
2. Im Reiter „Tests“ das Halbjahr wählen und **„⬆ Moodle-Import“** klicken.
3. Beide Dateien auswählen (mehrere auf einmal markieren). OrdoNota erkennt selbst, welche welche ist. Eine allein geht auch:
   - nur Antworten: Punkte per Textvergleich (Antwort = richtige Antwort, je Frage 1 Punkt); Korrekturen aus Moodle fehlen,
   - nur Bewertungen: Punkte vollständig, der Ausdruck enthält aber keine Fragen und Antworten.
4. **Zuordnung prüfen:** Jede Person aus Moodle wird einem Kursmitglied zugeordnet: zuerst über die beim letzten Import gemerkte Moodle-E-Mail-Adresse, sonst über Nach- und Vorname. Nicht erkannte Personen per Auswahlliste zuordnen oder „— nicht übernehmen —“ lassen.
5. **Importieren.** Es entsteht ein Test (Bereich „Sonstige“, Datum des Moodle-Versuchs, Bezeichnung aus dem Dateinamen; alles änderbar) mit einer Aufgabe **F1, F2, …** je Moodle-Frage.

Regeln beim Import:

- Hat jemand mehrere Versuche, zählt der beste **beendete** Versuch.
- Personen mit nicht beendetem Versuch („In Bearbeitung“) und Kursmitglieder ohne Moodle-Versuch bekommen den Status **„fehlt“**, sofern noch keine Punkte eingetragen sind. Punkte können von Hand nachgetragen werden.
- Unbeantwortete Fragen zählen 0 Punkte.
- Die Punkte-Genauigkeit wird passend gesetzt (ganze, halbe oder Zehntel-Punkte). Rechnet Moodle mit skalierten Punkten (z. B. `F 1 /0,71`), kann die Summe der gerundeten Fragenpunkte minimal von der Moodle-Bewertung abweichen; OrdoNota weist dann darauf hin.
- **Beide CSV-Dateien werden verschlüsselt im Test gespeichert**, ebenso Fragen und Antworten je Person. Die Karte **„Moodle“** im Test zeigt das Importdatum und bietet die Originaldateien zum Herunterladen an (⬇; die heruntergeladene Datei ist unverschlüsselt).

**Erneut importieren** (Knopf in der Karte „Moodle“), z. B. nach Korrekturen in Moodle: Die Punkte der Moodle-Fragen werden ersetzt, eigene zusätzliche Aufgaben, Notenschlüssel, Gewicht und Status „nicht gewertet“/„Täuschung“ bleiben erhalten. Lädt man dabei nur die Bewertungen-CSV, bleiben die gespeicherten Antworttexte erhalten.

**Ausdruck „🖨 Moodle-Ergebnisse“:** Im Dialog wählen Sie **alle** (je eine Seite) oder **eine Person** und ob die **Note** mitgedruckt wird. Oben steht das Ergebnis (Punkte, Prozent mit Balken), darunter je Frage Frage, „Deine Antwort“, Lösung und Punkte. Jede Zeile trägt ein Zeichen und einen farbigen Rand: ✓ richtig (grün), ◐ teilweise (orange hinterlegt), ✗ falsch (rot hinterlegt, Lösung fett), – keine Antwort. Durch die Zeichen bleibt der Ausdruck auch in Schwarzweiß lesbar; Zeilen werden nicht über Seiten getrennt. Unten steht – wenn gewählt – die **Note als Zahl und ausgeschrieben** (z. B. „2+ voll gut“, „2- noch gut“; MSS: „11 Punkte gut (2)“), darunter Linien für **Datum** und **Unterschrift der Lehrkraft** (auch ohne Note).

## 8. Reiter „Mitarbeit/EPO“

Ein **EPO-Block** fasst die Mitarbeitsbewertung über eine Reihe von Unterrichtsstunden zusammen (z. B. „EPO April–Mai“).

### 8.1 Block anlegen

1. Halbjahr wählen → **„+ Neuer EPO-Block“**.
2. Bezeichnung, Bereich (normalerweise *Sonstige Leistungen*) und Gewicht festlegen.
3. Mit **„+ Stunde“** eine Spalte für die Unterrichtsstunde anlegen (Datum wird abgefragt, Standard: heute).

### 8.2 Bewerten

In jede Zelle wird ein Kürzel getippt:

| Kürzel | Bedeutung | Punkte (Standard) |
|---|---|---|
| `++` | sehr gute Mitarbeit | 4 |
| `+` | gute Mitarbeit | 3 |
| `0` | durchschnittlich | 2 |
| `-` | schwach | 1 |
| `--` | keine Mitarbeit | 0 |
| `k` | abwesend (zählt nicht) | – |
| `u` (Zusatz) | Hausaufgaben unvollständig | −1 |
| `h` (Zusatz) | Hausaufgaben vergessen | −2 |

Kombinationen sind möglich, z. B. `+h` (gute Mitarbeit, Hausaufgaben vergessen) oder `0u`. Ein einzelnes `h` ist ebenfalls erlaubt. Groß- und Kleinschreibung spielt keine Rolle. Eine leere Zelle bedeutet „nicht bewertet“.

**Hilfen**

- **Schnellwahl** (Knopf „▸ Schnellwahl einblenden“ neben der Überschrift; standardmäßig ausgeblendet, der Zustand wird auf diesem Gerät gemerkt): Eine zusätzliche Spalte rechts neben den Stunden. Für die neueste Stunde lässt sich je Person per Klick `++`, `+`, `0`, `-`, `--` oder `k` sowie `u`/`h` setzen. Ein erneuter Klick auf die markierte Schaltfläche hebt die Auswahl wieder auf. Tippen in die Zellen funktioniert weiterhin.
- **Fotos** (Knopf „▸ Fotos einblenden“ neben „Schnellwahl“; Zustand wird auf diesem Gerät gemerkt): zeigt vor jedem Nachnamen das Schülerfoto, damit Sie Gesichter und Namen schneller zuordnen. Wer noch kein Foto hat, bekommt ein blasses Personensymbol als Platzhalter. Fotos werden im Reiter „Sitzplan“ hinzugefügt (siehe 10.4).
- **füllen** (unter dem Datum): setzt alle noch leeren Zellen dieser Stunde auf einen Wert, z. B. `0`. Danach tragen Sie nur noch die Abweichungen ein.
- **Datum anklicken:** Datum ändern oder Stunde löschen.
- Rechts stehen je Person: Σ Punkte, Max, %, Fehlstunden (k), Hausaufgaben-Vermerke (u/h) und die **Note**.

### 8.3 Einstellungen des Blocks

Unter **„Einstellungen dieses EPO-Blocks“** (aufklappen):

- **Punkte je Symbol** ändern (z. B. `h` = −1).
- **Umrechnung Prozent → Note/Punkte** je Stufe anpassen.
- **„Schwelle muss überschritten werden“**: „mehr als 25 %“ statt „ab 25 %“.
- Sek I: **LIMIT 4-** setzen. Die Tabelle wird dann aus dem Sek-I-Schlüssel neu berechnet.
- **Standard wiederherstellen** setzt Punkte und Tabelle zurück.

## 9. Reiter „Notenübersicht“

### 9.1 Halbjahresansicht

Die Tabelle zeigt pro Person alle Leistungen des gewählten Halbjahres:

```
Name │ Klassen-/Kursarbeiten │ Ø │ Sonstige Leistungen          │ Ø │ Gerechnet │ Gesetzt │ ✎ 💬
     │ KA 1 (Test)  KA 2     │   │ HÜ 1  Heft ×2  EPO Sep–Okt   │   │ 2,25  2-  │         │
```

| Spalte | Bedeutung |
|---|---|
| Spalten mit ✎ bzw. ◷ | Ergebnisse aus Tests bzw. EPO-Blöcken; nur anzeigen, bearbeitet wird im jeweiligen Reiter („Test ›“ / „EPO ›“ springt dorthin) |
| Spalten ohne Symbol | direkt eingetragene Einzelnoten (bearbeitbar) |
| ausgegraute Spalte | Test mit Haken „nicht gewertet“ (siehe 7.1); wird angezeigt, zählt aber nicht |
| blasses, gestricheltes Feld | Spalte aus dem Reiter „Ziehen“: diese Person wurde nicht gezogen (siehe 10a); eintragen ist trotzdem möglich |
| ausgegraute einzelne Note | Testarbeit dieser Person mit Status „nicht gewertet“ (siehe 7.3); wird angezeigt, zählt aber nicht |
| Ø | gewichteter Schnitt des Bereichs (Sek I: Dezimalnote, MSS: Punkte) |
| Gerechnet | ungerundeter Gesamtschnitt + gerundete Note |
| Gesetzt | Ihre Zeugnisnote, falls sie von der gerechneten abweicht (leer = gerechnete Note gilt) |
| ✎ | Begründung für eine gesetzte Note (erscheint erst, wenn eine Note gesetzt ist) |
| 💬 | Bemerkung zur Person (erscheint auf dem Schülerbogen) |

**Einzelnote hinzufügen:** **„+ Klassen-/Kursarbeit (Note direkt)“** oder **„+ Sonstige Note (HÜ, Heft, Referat …)“**. Es öffnet sich ein Dialog für Name, Datum, Gewicht, Bereich und Halbjahr. Diesen Dialog erreichen Sie später durch Klick auf den Spaltenkopf. Dort lässt sich die Spalte auch löschen.

**Eingaben in Notenzellen**

| Eingabe | Sek I | MSS |
|---|---|---|
| Note | `1`, `1-`, `2+`, `2`, … `5-`, `6` (kein `1+`) | `0`–`15` oder `00`–`15` |
| Dezimal (wird zur nächsten Stufe) | `2,3` → 2-, `1,7` → 2+ | – |
| fehlt | `f` | `f` |
| Nachschreiben | `ns` | `ns` |
| Täuschung/Verweigerung | `t` (zählt als 6) | `t` (zählt als 00) |
| löschen | Feld leeren | Feld leeren |

Ungültige Eingaben werden rot markiert und nicht übernommen.

**Gesetzte Noten:** Eine Eingabe in „Gesetzt“ überschreibt die gerechnete Note. Die Zeile wird farbig hinterlegt. Über **✎** können Sie eine Begründung hinterlegen. Sie erscheint auf dem Schülerbogen.

### 9.2 Jahresnote

Der Umschalter **„Jahresnote“** (nur Jahrgang 5–11) zeigt je Person beide Halbjahresnoten, die gerechnete Jahresnote und das Feld „Gesetzt“. Für die Rechnung wird je Halbjahr die **gesetzte** Halbjahresnote verwendet, wenn eine existiert, sonst der **ungerundete** Schnitt (Details in [Abschnitt 17](#17-halbjahres--und-jahresnote)).

## 10. Reiter „Sitzplan“

Für jeden Kurs lassen sich Sitzpläne für einen oder mehrere Räume anlegen. Jede aktive Person erscheint als Karte mit ihrem **Vornamen** (bei gleichen Vornamen im Kurs mit Initiale des Nachnamens, z. B. „Anna M.“), auf Wunsch mit Foto.

### 10.1 Räume

- Oben stehen die Räume als Karten mit Rastergröße und Zahl der belegten Plätze. Ein Klick wechselt den Raum.
- **„+ Neuer Raum“** legt einen weiteren Raum an (die Bezeichnung wird abgefragt; Rastergröße wie im aktuellen Raum, aber leer).
- **Raum / Bezeichnung** benennt den Raum um, **🗑** löscht ihn (nur wenn es mehr als einen gibt).
- Jeder Raum hat eigene Sitzordnung, Rastergröße und Pultposition. Welcher Raum zuletzt gewählt war, merkt sich jedes Gerät.
- Ein Sitzplan aus Version 1.2/1.3 wird beim Öffnen der Datenbank automatisch zu „Raum 1“.

### 10.2 Sitzordnung

- **✎ Raster bearbeiten** (der Knopf zeigt die aktuelle Größe, z. B. „8 × 5“) blendet an allen vier Seiten des Rasters **+** und **−** ein: oben/unten fügen eine Reihe hinzu bzw. entfernen sie, links/rechts eine Spalte (höchstens 16 Spalten × 12 Reihen). Wird oben oder links etwas eingefügt oder entfernt, rücken alle Plätze mit – die Sitzordnung bleibt erhalten. Sitzen in einer entfernten Reihe/Spalte Personen, fragt die App nach und legt sie zurück in „Noch ohne Platz“. **✓ Raster fertig** blendet die Knöpfe wieder aus. **Lehrerpult** oben oder unten.
- Karten aus **„Noch ohne Platz“** (rechts) mit Maus oder Finger auf einen Platz ziehen. Auf einen besetzten Platz gezogen, **tauschen** die beiden die Plätze. Zurück in die Ablage gezogen, ist die Person wieder vom Plan genommen. Beim Ziehen an den oberen/unteren Rand scrollt die Seite mit.
- **🎲 Freie Plätze füllen** verteilt alle noch nicht platzierten Personen in zufälliger Reihenfolge auf die freien Plätze. **Alle abräumen** setzt die Sitzordnung des Raums zurück (mit Rückfrage).
- **🖨 Drucken** gibt den Plan des gewählten Raums auf einer A4-Seite aus (Raumname in der Überschrift, mit Fotos, soweit vorhanden).
- Neue Personen im Kurs erscheinen automatisch in der Ablage, inaktive verschwinden vom Plan.

### 10.3 Gespeicherte Stände

- **„💾 Stand speichern …“** legt eine Kopie der aktuellen Sitzordnung des gewählten Raums unter einem Namen ab (z. B. „ab Herbstferien“).
- **Laden** ersetzt die Sitzordnung des gerade gewählten Raums nach Rückfrage durch den Stand, **✕** löscht ihn.
- Die Stände gelten für den ganzen Kurs; der Raum, aus dem sie stammen, steht dabei. Personen, die es im Stand noch nicht gab, landen beim Laden in der Ablage.

### 10.4 Fotos

- **Einfügen:** Foto kopieren (z. B. in WebUntis: Rechtsklick auf das Foto → „Bild kopieren“), im Sitzplan die Karte **anklicken** (blauer Rahmen) und **Strg+V** drücken.
- **Ziehen:** Eine Bilddatei aus dem Dateimanager oder ein Bild aus einem anderen Browser-Tab auf die Karte ziehen. Ob das Ziehen direkt aus WebUntis klappt, hängt davon ab, wie WebUntis das Bild ausliefert; sonst erscheint ein Hinweis, und der Weg über „Bild kopieren“ + Strg+V funktioniert.
- Das Foto wird quadratisch zugeschnitten (bei Hochformat eher oben, wo das Gesicht ist), auf 160 × 160 Pixel verkleinert und **verschlüsselt in der Datenbank** gespeichert (etwa 5–20 KB pro Foto).
- Gleichnamige Personen in anderen Kursen desselben Schuljahres, die noch kein Foto haben, bekommen es automatisch mit.
- Karten ohne Foto zeigen ein blasses Personensymbol als Platzhalter – am Bildschirm und im Ausdruck, damit der Plan einheitlich aussieht.
- **Entfernen:** Mit der Maus über die Karte fahren und auf **×** klicken.
- **Ausblenden:** Der Knopf **„▾ Fotos ausblenden“** in der Werkzeugleiste blendet alle Fotos auf den Karten aus, z. B. wenn der Sitzplan am Beamer gezeigt wird. Die Fotos bleiben gespeichert; „▸ Fotos einblenden“ zeigt sie wieder. Die Einstellung gilt auch für den Ausdruck und wird auf diesem Gerät gemerkt.
- **Datenschutz:** Schülerfotos sind personenbezogene Daten. Ob sie in einer eigenen Anwendung gespeichert werden dürfen, regelt die Schule (Schulleitung bzw. Datenschutzbeauftragte/r).

## 10a. Reiter „Ziehen“

Zieht zufällig eine gewählte Anzahl von Personen, z. B. um Hausaufgaben einzusammeln und zu bewerten. Wer gezogen wurde, fällt aus dem **Pool**, bis dieser wieder aufgefüllt wird. So kommen alle der Reihe nach dran.

- **Anzahl** eintragen (wird auf diesem Gerät gemerkt), **🎲 Ziehen** klicken. Die Gezogenen erscheinen groß mit Foto (bzw. Personensymbol) – geeignet auch für den Beamer.
- **Bewerten:** Jede Ziehung legt im gewählten Halbjahr bei den **sonstigen Leistungen** eine Spalte „HA-Kontrolle TT.MM.“ an (Gewicht 1). Die Note tragen Sie direkt unter dem Namen ein; nur die Gezogenen bekommen eine Note, für alle anderen bleibt die Spalte leer und zählt nicht. In der Notenübersicht sind die Felder der Nicht-Gezogenen blass und gestrichelt dargestellt; sie lassen sich bei Bedarf trotzdem ausfüllen (dann erscheinen sie normal). Name, Gewicht und Bereich lassen sich wie bei jeder Spalte in der Notenübersicht ändern; Kürzel wie `f` (fehlt) ebenfalls dort.
- **Auffüllen:** Sind weniger Personen im Pool als gezogen werden sollen, werden zuerst alle Übrigen gezogen, dann wird der Pool automatisch aufgefüllt und der Rest daraus gezogen (mit Hinweis). **↺ Pool auffüllen** setzt den Pool jederzeit von Hand zurück; vergebene Noten bleiben erhalten.
- **Übersicht „Pool“:** zeigt je Person den Status *im Pool*, *gezogen TT.MM.* oder *herausgenommen* (sortierbar).
  - Haken **„Im Pool“** entfernen nimmt eine Person aus dem Pool heraus (bis zum nächsten Auffüllen); Haken setzen nimmt sie wieder auf – auch nach einer Ziehung.
  - Haken **„Heute abwesend“**: Die Person wird bei der Ziehung übersprungen, bleibt aber im Pool. Dieser Haken wird nicht gespeichert und ist nach dem Schließen der App wieder weg.
- Nicht mehr aktive Personen (siehe 6.2) werden nie gezogen.
- **↶ Rückgängig** (bei der letzten Ziehung) stellt den Pool wie vor der Ziehung wieder her und löscht die angelegte Notenspalte – mit Rückfrage, besonders wenn schon Noten eingetragen sind.
- **Frühere Ziehungen** (aufklappbar) listen Datum, Spalte und die Gezogenen. Die Noten lassen sich dort **nachtragen oder ändern** (Enter springt zur nächsten Person); sie landen in der Notenspalte der jeweiligen Ziehung.

## 11. Drucken und Exportieren

Alle Ausdrucke öffnen den Druckdialog des Browsers. Dort können Sie auch **„Als PDF speichern“** wählen. Breite Tabellen werden automatisch im Querformat gedruckt. Die Kopf- und Fußzeilen des Browsers (Datum, Dateipfad, Seitenzahl) werden unterdrückt; der Rand von 12 mm bleibt auf jeder Seite erhalten.

| Wo | Knopf | Inhalt |
|---|---|---|
| Notenübersicht | 🖨 Kursliste | Notenliste des gewählten Halbjahres bzw. der Jahresnoten; gesetzte Noten mit * |
| Notenübersicht | 🖨 Schülerbögen | Eine Seite je Person (Auswahl siehe unten) |
| Notenübersicht | ⬇ CSV/Excel | Alle Noten und Ergebnisse des Kurses als CSV (Semikolon, öffnet direkt in Excel) |
| Kurs & Schüler | ⬇ Excel | Schülerliste als Excel-Datei (.xlsx): Nr., Nachname, Vorname, I-Status, Aktiv (siehe 6.3) |
| Tests | 🖨 Schlüssel / Liste / Schülerzettel / Moodle-Ergebnisse | siehe 7.6 und 7.7 |
| Tests | ⛶ Beamer | Vollbild ohne Namen: Notenspiegel, Punkteverteilung, Ø je Aufgabe (siehe 7.5) |
| Sitzplan | 🖨 Drucken | Sitzplan des gewählten Raums mit Vornamen, Fotos und Lehrerpult, A4 (quer, wenn mehr Spalten als Reihen) |
| Mitarbeit/EPO | 🖨 Liste | Bewertungsraster mit Ergebnis je Person |
| Mitarbeit/EPO | 🖨 Schülerzettel | Ein Zettel pro Person zum Ausschneiden (mehrere pro Blatt, gestrichelte Schnittlinie): Name, Kurs, Blockname und Zeitraum, Punktelegende, Bewertungen mit Datum im Tabellenkopf, Ergebnis mit Note sowie Linien für Datum und Unterschrift |

**Schülerbögen:** Im Dialog wählen Sie **für wen** (alle oder eine Person), den **Zeitraum** (alle Halbjahre oder eines) und den **Inhalt**:

- Einzelnoten mit Datum und Gewicht
- Schnitte (Klassenarbeiten / Sonstige)
- Halbjahres- und Jahresnote (gerechnet und gesetzt, mit Begründung)
- Test-Details je Aufgabe
- EPO-Zusammenfassung (Anzahl ++/+/0/-/--, Fehlstunden, Hausaufgaben-Vermerke)
- Bemerkung

So eignet sich derselbe Bogen für Elterngespräche (z. B. ohne Bemerkung) und für die eigenen Unterlagen.

**Excel-Schülerliste:** echte `.xlsx`-Datei (ohne Makros), Kopfzeile fett und beim Scrollen fixiert, Tabellenblatt nach dem Kurs benannt. Öffnet in Excel, LibreOffice und Numbers. Die Datei ist **nicht verschlüsselt**.

**CSV-Export:** Spalten Nr, Nachname, Vorname, danach je Halbjahr alle Einzelleistungen, Ø KA, Ø Sonstige, gerechnet, Note, zuletzt (falls vorhanden) Jahr gerechnet und Jahresnote. Die Datei ist **nicht verschlüsselt**. Behandeln Sie sie entsprechend und löschen Sie sie nach Gebrauch.

## 12. Reiter „Einstellungen“

| Bereich | Einstellung | Standard |
|---|---|---|
| Sicherheit | Passwort ändern | – |
| | Neuen Wiederherstellungsschlüssel erzeugen (der alte wird ungültig) | – |
| | Automatisch sperren nach … Minuten (0 = nie) | 15 |
| Standardwerte für neue Tests | LIMIT Sek I (4- ab … %) | 50 |
| | LIMIT MSS (04 Punkte ab … %) | 45 |
| | Punkte-Genauigkeit | ganze Punkte |
| Speicherort & Sicherungen | Name dieses Geräts | – |
| | Anzahl aufbewahrter Sicherungen | 10 |
| | Sicherung höchstens alle … Minuten | 10 |
| | Jetzt sichern / Verschlüsselte Kopie herunterladen / Sicherung wiederherstellen | – |
| Schuljahre | Umbenennen, leere Schuljahre löschen | – |
| Darstellung | Noten farbig hinterlegen | an |
| | Farbschema: wie System / hell / dunkel | wie System |

Gerätename und Farbschema gelten **pro Gerät/Browser**. Alles andere ist in der Datenbank gespeichert und gilt auf allen Geräten.

## 13. Tastaturbedienung

| Taste | Wirkung in Eingabetabellen |
|---|---|
| **Enter** / **↓** | übernehmen und zur nächsten Person (gleiche Spalte) |
| **Shift + Enter** / **↑** | übernehmen und zur vorherigen Person |
| **Tab** / **Shift + Tab** | nächste / vorherige Spalte |
| **→** / **←** am Ende/Anfang des Feldes | nächste / vorherige Spalte |
| **Esc** | Dialog schließen |

Beim Betreten einer Zelle ist der Inhalt markiert. Einfach lostippen überschreibt ihn.

---

# Teil B – Rechenregeln

## 14. Notenskalen

Intern speichert die App **jede Note als Punktzahl 0–15**. Angezeigt wird je nach Jahrgang:

| Punkte | MSS-Anzeige | Ganze Note | Sek-I-Anzeige | Dezimalwert (Sek I) |
|---|---|---|---|---|
| 15 | 15 | 1+ | – (gibt es nicht) | – |
| 14 | 14 | 1 | **1** | 1,00 |
| 13 | 13 | 1- | **1-** | 1,33 |
| 12 | 12 | 2+ | **2+** | 1,67 |
| 11 | 11 | 2 | **2** | 2,00 |
| 10 | 10 | 2- | **2-** | 2,33 |
| 9 | 09 | 3+ | **3+** | 2,67 |
| 8 | 08 | 3 | **3** | 3,00 |
| 7 | 07 | 3- | **3-** | 3,33 |
| 6 | 06 | 4+ | **4+** | 3,67 |
| 5 | 05 | 4 | **4** | 4,00 |
| 4 | 04 | 4- | **4-** | 4,33 |
| 3 | 03 | 5+ | **5+** | 4,67 |
| 2 | 02 | 5 | **5** | 5,00 |
| 1 | 01 | 5- | **5-** | 5,33 |
| 0 | 00 | 6 | **6** | 6,00 |

**Sek I kennt kein 1+.** Die höchste Sek-I-Stufe ist „1“ (= 14 Punkte). Die Sek I hat damit 15 Stufen, die MSS 16.

## 15. Notenschlüssel für Tests

Bezeichnungen: **L** = LIMIT in %, **H** = Höchstpunktzahl des Tests (ohne Bonus).

### 15.1 MSS (identisch mit der bisherigen Excel-Vorlage)

| Punkte | Schwelle in % |
|---|---|
| 00 | 0 |
| 01 | ½ · L |
| 02 | ½·L + 1·(L − ½·L)/3 |
| 03 | ½·L + 2·(L − ½·L)/3 |
| 04 | L |
| 05 … 15 | L + (P − 4) · (101 − L) / 12 |

Prozentwerte auf 2 Nachkommastellen gerundet.

**Beispiel L = 45 %:**

| Punkte | 15 | 14 | 13 | 12 | 11 | 10 | 09 | 08 | 07 | 06 | 05 | 04 | 03 | 02 | 01 | 00 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab % | 96,33 | 91,67 | 87 | 82,33 | 77,67 | 73 | 68,33 | 63,67 | 59 | 54,33 | 49,67 | 45 | 37,5 | 30 | 22,5 | 0 |

### 15.2 Sek I

| Note | Schwelle in % |
|---|---|
| 6 | 0 |
| 5- | ½ · L |
| 5 | ½·L + 1·(L − ½·L)/3 |
| 5+ | ½·L + 2·(L − ½·L)/3 |
| 4- | L |
| 4 … 1 | L + k · (100 − L) / 11, k = 1 … 10 (gleiche Abstände) |

Prozentwerte auf ganze Prozent gerundet.

**Nur ganze Noten** (Einstellung „Notenstufen“ im Test): Es gibt nur die Stufen 1–6. Jede ganze Note beginnt an der Schwelle ihrer Minus-Note aus der Tabelle oben (bei L = 50 %: 1 ab 91 %, 2 ab 77 %, 3 ab 64 %, 4 ab 50 %, 5 ab 25 %). Intern zählen sie wie die Noten ohne Tendenz (1 = 14 Punkte, 2 = 11, 3 = 8, 4 = 5, 5 = 2, 6 = 0), Schnitte rechnen also mit 1,0; 2,0 usw.

**Beispiel L = 50 %:**

| Note | 1 | 1- | 2+ | 2 | 2- | 3+ | 3 | 3- | 4+ | 4 | 4- | 5+ | 5 | 5- | 6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab % | 95 | 91 | 86 | 82 | 77 | 73 | 68 | 64 | 59 | 55 | 50 | 42 | 33 | 25 | 0 |

**Beispiel L = 40 %:**

| Note | 1 | 1- | 2+ | 2 | 2- | 3+ | 3 | 3- | 4+ | 4 | 4- | 5+ | 5 | 5- | 6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ab % | 95 | 89 | 84 | 78 | 73 | 67 | 62 | 56 | 51 | 45 | 40 | 33 | 27 | 20 | 0 |

### 15.3 Von Prozent zu Punkten

1. **Mindestpunktzahl** je Stufe = Schwelle% · H, auf die Punkte-Genauigkeit des Tests gerundet (ganze/halbe/Zehntel).
2. **Erreichte Summe** = Summe aller Aufgaben inkl. Bonus, ebenfalls auf die Genauigkeit gerundet.
3. **Note** = höchste Stufe, deren Mindestpunktzahl erreicht ist. Bonuspunkte über H hinaus führen höchstens zur Bestnote.
4. Von Hand gesetzte Schwellen (gelb) ersetzen die berechnete Mindestpunktzahl der jeweiligen Stufe.

### 15.4 Drittelparagraph

Greift, wenn gilt: (Anzahl Noten 5 und 6 − Anzahl „Täuschung/Verweigerung“) **>** (Anzahl gewerteter Arbeiten) / 3.
Als 5 und 6 zählen alle Stufen von 5+ bis 6 (Punkte 0–3). „fehlt“ und „Nachschreiben“ zählen nicht mit, ebenso wenig Personen mit I-Status (siehe 6.2) und einzeln „nicht gewertete“ Arbeiten (siehe 7.3).

## 16. Mitarbeit/EPO-Berechnung

Für jede Person und jeden EPO-Block:

```
Summe   = Σ Punkte der Bewertungen (++ … --)  +  Σ Hausaufgaben-Abzüge (u, h)
Max     = Anzahl anwesender Stunden (mit Bewertung ++ … --) × Punkte für ++
Prozent = Summe / Max × 100
```

Stunden mit `k` oder ohne Eintrag zählen nicht zu Max. Hausaufgaben-Vermerke werden immer abgezogen.

**Umrechnung in Punkte/Note (Standard)**

- **MSS** – „mehr als“-Schwellen in 5-%-Schritten (wie bisherige EPO-Liste):

| Punkte | 15 | 14 | 13 | 12 | 11 | 10 | 09 | 08 | 07 | 06 | 05 | 04 | 03 | 02 | 01 | 00 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mehr als % | 95 | 90 | 85 | 80 | 75 | 70 | 65 | 60 | 55 | 50 | 45 | 40 | 35 | 30 | 25 | – |

- **Sek I** – „ab“-Schwellen nach dem Sek-I-Testschlüssel (14.2) mit dem LIMIT des Blocks.

**Beispiel (MSS):** 7 Stunden, Bewertungen `+ 0 + + 0 0 +` → Summe 4·3 + 3·2 = 18, Max 7·4 = 28, Prozent 64,3 % → **08 Punkte**.

## 17. Halbjahres- und Jahresnote

**Schritt 1 – Bereichsschnitte** (je Halbjahr)

```
Ø KA       = Σ (Wert × Gewicht) / Σ Gewicht   über alle Klassen-/Kursarbeiten
Ø Sonstige = Σ (Wert × Gewicht) / Σ Gewicht   über alle sonstigen Leistungen
```

„Wert“ ist in der Sek I die Dezimalnote (13 → 1,33), in der MSS die Punktzahl. Leistungen ohne Note („fehlt“, „Nachschreiben“, leer) werden übersprungen, ebenso Tests mit Haken „nicht gewertet“ und einzelne Testarbeiten mit Status „nicht gewertet“.

**Schritt 2 – Halbjahresnote**

```
Gerechnet = (Ø KA × Gewicht KA + Ø Sonstige × Gewicht Sonstige) / (Gewicht KA + Gewicht Sonstige)
```

Fehlt ein Bereich ganz, zählt nur der andere. Die Halbjahresnote ist die gerundete gerechnete Note, außer eine Note wurde **gesetzt**.

**Schritt 3 – Jahresnote** (Jahrgang 5–11)

```
Jahr = (HJ1 × 1 + HJ2 × 2) / 3          (Gewichte im Kurs änderbar)
```

Für HJ1/HJ2 wird die **gesetzte** Halbjahresnote verwendet, falls vorhanden, sonst der **ungerundete** Halbjahresschnitt.

**Rechenbeispiel (Sek I, 50 : 50):**

| | Noten | Schnitt |
|---|---|---|
| Klassenarbeiten | 2 (2,00), 3 (3,00) | Ø 2,50 |
| Sonstige | 1 mit Gewicht 2 (1,00), 4 (4,00) | Ø (1·2 + 4)/3 = 2,00 |
| HJ1 gerechnet | (2,50 + 2,00)/2 = 2,25 | → **2-** |
| HJ2 gerechnet | 2,00 | → **2** |
| Jahr | (2,25 + 2·2,00)/3 = 2,08 | → **2** |

## 18. Rundung

Gerundet wird **erst am Ende**. Zwischenwerte bleiben ungerundet.

**Sek I:** Der Schnitt wird auf 2 Nachkommastellen gebracht und dann der **nächstgelegenen Stufe** zugeordnet (Stufenwerte 1,00 · 1,33 · 1,67 · 2,00 …). Bei exaktem Gleichstand gilt die **bessere** Note.

| Schnitt | Note |
|---|---|
| 1,00 – 1,16 | 1 |
| 1,17 – 1,50 | 1- |
| 1,51 – 1,83 | 2+ |
| 1,84 – 2,16 | 2 |
| 2,17 – 2,50 | 2- |
| 2,51 – 2,83 | 3+ |
| … | (Muster wiederholt sich) |
| 4,51 – 4,83 | 5+ |
| 4,84 – 5,16 | 5 |
| 5,17 – 5,66 | 5- |
| ab 5,67 | 6 |

Schnitte besser als 1,00 (bei Sek I nicht möglich) ergeben 1.

**MSS:** Punkteschnitt auf 2 Nachkommastellen, dann ab **,5 aufrunden** (10,50 → 11; 10,49 → 10).

---

# Teil C – Sicherheit, Sicherungen, Fehlerbehebung

## 19. Verschlüsselung und Datenschutz

| Aspekt | Umsetzung |
|---|---|
| Verfahren | AES-256-GCM (authentifizierte Verschlüsselung: Manipulationen werden erkannt) |
| Schlüsselableitung | PBKDF2-SHA256 mit 600 000 Runden aus dem Passwort |
| Schlüsselaufbau | Ein zufälliger Datenschlüssel verschlüsselt die Daten. Er ist doppelt „eingepackt“: einmal mit dem Passwort, einmal mit dem Wiederherstellungsschlüssel. |
| Wiederherstellungsschlüssel | 160 Bit Zufall, 32 Zeichen ohne verwechselbare Zeichen (kein I, O, 0, 1) |
| Im Klartext lesbar | Nur Format, Version, Speicherzeit und Gerätename. **Keine** Namen oder Noten. |
| Im Arbeitsspeicher | Nur solange entsperrt. Beim Sperren werden Schlüssel und Daten verworfen. |
| Automatische Sperre | nach 15 Min. ohne Maus/Tastatur (einstellbar) |

**Passwort vergessen:** Auf dem Sperrbildschirm **„Passwort vergessen?“** → Wiederherstellungsschlüssel eingeben (Groß-/Kleinschreibung, Leerzeichen und Bindestriche egal) → neues Passwort setzen.

**Datenschutz-Hinweise**

- In Rheinland-Pfalz ist für die Verarbeitung von Schülerdaten auf **privaten Geräten** in der Regel eine **Genehmigung der Schulleitung** erforderlich. Bitte vor dem Einsatz klären.
- Ausdrucke und CSV-Exporte sind **unverschlüsselt**. Sicher aufbewahren und vernichten bzw. löschen.
- Die verschlüsselte Datei auf der DiskStation ist ohne Passwort nicht lesbar. Der Zugang zur DiskStation sollte trotzdem selbst gut geschützt sein.

## 20. Sicherungen und Wiederherstellung

**Automatische Sicherungen:** Bevor die App die Datenbank überschreibt, legt sie die bisherige Version im Unterordner `Sicherungen/` ab, höchstens alle 10 Minuten. Die ältesten Sicherungen über der eingestellten Anzahl (Standard 10) werden gelöscht. Sicherungen sind genauso verschlüsselt wie die Datenbank.

```
OrdoNota-Daten/
├── notenmanager.nmdb
├── notenmanager.lock.json            (nur während die App offen ist)
└── Sicherungen/
    ├── notenmanager_2026-10-14_101532.nmdb
    ├── notenmanager_2026-10-14_113004.nmdb
    └── …
```

**Manuell sichern:** Einstellungen → **Jetzt sichern**. **Verschlüsselte Kopie herunterladen** legt eine Kopie im Download-Ordner ab, z. B. für einen USB-Stick.

**Wiederherstellen:** Einstellungen → Liste der Sicherungen → **Wiederherstellen**. Der aktuelle Stand wird vorher selbst gesichert. Stammt die Sicherung aus einer Zeit mit anderem Passwort, fragt die App nach diesem.

**Eine heruntergeladene Kopie zurückspielen:** Datei in den Ordner `Sicherungen/` kopieren und dann über die Liste wiederherstellen.

> Zusätzlich empfiehlt sich die Versionierung von Synology Drive (auf der DiskStation einstellbar) als zweite Sicherungsebene.

### 20.1 Notfall-Entschlüsselung ohne App

Die Datenbank verwendet nur Standardverfahren. Mit dem Werkzeug `tools/entschluesseln.py` lässt sie sich **ohne die App** entschlüsseln, mit Passwort oder Wiederherstellungsschlüssel. Ihre Daten sind also nie an diese App gebunden. Das Werkzeug funktioniert auch mit Sicherungen aus `Sicherungen/`.

**Voraussetzung:** Python 3.8 oder neuer und das Paket `cryptography`.

```bash
pip install cryptography                       # einmalig
python3 tools/entschluesseln.py /pfad/zu/notenmanager.nmdb
```

Oder ohne Installation, falls `uv` vorhanden ist:

```bash
uv run --with cryptography tools/entschluesseln.py /pfad/zu/notenmanager.nmdb
```

| Option | Wirkung |
|---|---|
| (keine) | fragt nach dem Passwort und schreibt `<datei>_klartext.json` |
| `-w`, `--wiederherstellung` | fragt nach dem Wiederherstellungsschlüssel statt dem Passwort |
| `-o DATEI` | Name der Ausgabedatei |
| `--csv ORDNER` | zusätzlich eine CSV-Datei je Kurs (Excel-kompatibel) mit Einzelnoten, Test-Rohpunkten, EPO-Kürzeln, gesetzten Noten und Bemerkungen |
| `-f` | vorhandene Ausgabedatei überschreiben |

Das Passwort wird verdeckt abgefragt und nirgends gespeichert. Die CSV-Dateien enthalten **Rohdaten**. Berechnete Schnitte und Testnoten erzeugt nur die App.

> ⚠️ Die Ausgabe ist **unverschlüsselt**. Nur auf einem vertrauenswürdigen Rechner verwenden und nach Gebrauch löschen.

## 21. Fehlerbehebung und häufige Fragen

### 21.1 „Browser wird nicht unterstützt“
Die App wurde in Firefox oder Safari geöffnet. `index.html` mit Chrome, Edge, Brave oder Thorium öffnen.

### 21.2 „Kein Zugriff auf den Ordner“
Der Browser hat den Ordnerzugriff nicht erlaubt. Erneut auf **Entsperren** klicken und die Rückfrage mit *Erlauben* bestätigen. Hilft das nicht: **„Anderen Ordner wählen“** und den Datenordner neu auswählen.

### 21.3 „Datenbank wurde extern geändert“
Die Datei wurde geändert, seit Sie sie geöffnet haben, meist weil Synology eine Version eines anderen Geräts heruntergeladen hat.

| Auswahl | Wirkung |
|---|---|
| **Neu laden** | Übernimmt die Version vom anderen Gerät. Ihre ungespeicherten Änderungen hier gehen verloren. |
| **Überschreiben** | Speichert Ihre Version. Die Version des anderen Geräts wird vorher als Sicherung abgelegt. |
| **Später** | Nichts passiert. Beim nächsten Speichern erscheint die Frage erneut. |

### 21.4 „Konfliktkopie gefunden“
Synology Drive hat eine Datei wie `notenmanager_DiskStation_…_Conflict.nmdb` angelegt, weil auf zwei Geräten gleichzeitig gespeichert wurde.
1. Prüfen, ob in der Hauptdatei Änderungen fehlen.
2. Falls ja: Konfliktkopie in den Ordner `Sicherungen/` verschieben, über Einstellungen öffnen bzw. wiederherstellen und die fehlenden Noten übertragen.
3. Die Konfliktkopie danach löschen. Dann verschwindet der Hinweis.

### 21.5 „Datenbank ist woanders geöffnet“
Auf dem genannten Gerät ist die App noch offen (oder wurde nicht gesperrt). Am besten dort sperren, kurz warten, bis Synology synchronisiert hat, und erneut öffnen. Ist das Gerät nicht erreichbar und sicher nicht in Benutzung: **„Trotzdem öffnen“**.

### 21.6 „Nicht gespeichert!“ (rot in der Kopfzeile)
Das Schreiben ist fehlgeschlagen, z. B. weil der Ordner nicht erreichbar oder der Datenträger voll ist. Die Daten sind noch im Browser. Ursache beheben. Bei der nächsten Änderung wird erneut gespeichert. Den Browser in diesem Zustand **nicht schließen** (die App warnt beim Schließen).

### 21.7 Warum kann ich in der Sek I kein „1+“ eingeben?
Die Sek I kennt kein 1+. Die beste Note ist 1. Ein Test mit vollen Punkten ergibt in der Sek I eine 1.

### 21.8 Warum ist die gerechnete Note anders als in meiner alten Excel-Liste?
Mögliche Gründe:
- Excel rundete teils mit 0,33-Näherungen und ließ in der Sek I 1+ (= 0,67) zu. Das ist korrigiert.
- Jede Einzelnote hat jetzt standardmäßig Gewicht 1 innerhalb ihres Bereichs. Früher wurden Untergruppen (z. B. „HÜ-Note“) teils erst gemittelt.
- Gesetzte Halbjahresnoten fließen jetzt in die Jahresnote ein.

### 21.9 Kann ich die App auf dem iPad/Handy nutzen?
Nein. Mobile Browser können nicht direkt in Ordner schreiben. Die App ist für Desktop und Laptop gedacht.

### 21.10 „Diese Datenbank wurde mit einer neueren Version gespeichert“
Auf einem anderen Gerät läuft eine neuere Version von OrdoNota, die das Datenformat erweitert hat. Die ältere Version öffnet die Datenbank absichtlich nicht, damit sie keine Daten falsch versteht oder beim Speichern verliert. Lösung: Die Programmdateien (`index.html`, `css/`, `js/`) auf diesem Gerät durch die neue Version ersetzen. Liegt der Programmordner im Synology-Drive-Ordner, passiert das automatisch.

Die Version der App steht unter Einstellungen → Hinweise.

---

# Teil D – Technische Dokumentation

## 22. Aufbau der Anwendung

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne externe Bibliotheken. Die Skripte sind **klassische Skripte** (keine ES-Module), damit die App per `file://` (Doppelklick) läuft. Alle Module hängen sich an den globalen Namensraum `NM`.

| Datei | Namensraum | Aufgabe |
|---|---|---|
| `js/logo.js` | `NM.logo` | Logo als SVG: `full(h)` (Monogramm + Schriftzug), `mark(px)` (nur Monogramm), `favicon()`; Farbe folgt der Textfarbe. Quelle: `logo/ordonota-logo*.svg` |
| `js/util.js` | `NM.util` | DOM-Helfer `h()`, Formatierung (deutsch), Dialoge, Toasts, Download, CSV |
| `js/xlsx.js` | `NM.xlsx` | Excel-Dateien ohne Bibliothek: `workbook({ sheet, rows, widths })` → Blob (ZIP ohne Kompression, ein Blatt, Kopfzeile fett) |
| `js/grades.js` | `NM.grades` | **Gesamte Notenlogik** (rein, ohne DOM): Skalen, Eingabe-Parser, Rundung, Notenschlüssel, Test-/EPO-Auswertung, Halbjahres-/Jahresnote |
| `js/crypto.js` | `NM.crypto` | `Vault`: Erzeugen, Entsperren (Passwort/Wiederherstellung), Ver-/Entschlüsseln, Passwortwechsel |
| `js/storage.js` | `NM.storage` | `FolderStore` (File System Access API): Lesen/Schreiben, Sicherungen, Lock, Konflikterkennung; `MemoryStore` für den Demo-Modus |
| `js/model.js` | `NM.model` | Datenmodell: neue Datenbank/Kurse/Leistungen, Migration, Namensliste parsen, Demo-Daten |
| `js/moodle.js` | `NM.moodle` | Moodle-Import (rein, ohne DOM): CSV zerlegen, Antworten-/Bewertungen-CSV erkennen und zusammenführen, Personen zuordnen, als Test übernehmen |
| `js/ui.js` | `NM.ui` | Wiederverwendbare Bausteine: Halbjahres-Umschalter, Noten-Eingabezellen, Badges, Leistungs-Dialog |
| `js/app.js` | `NM.app` | Anwendungskern: Anmeldung, Sitzung, Autosave, Sperre, Layout, Navigation, Neuzeichnen mit Fokus-Erhalt, Tabellen-Tastatur |
| `js/view-*.js` | `NM.views.*` | Je ein Reiter: `course`, `tests`, `epo`, `draw`, `overview`, `seating`, `settings` |
| `js/print.js` | `NM.print` | Druckansichten |
| `css/app.css` | – | Gestaltung inkl. Hell/Dunkel (Farb-Tokens auf `:root`) und Druck-CSS |

**Ablauf einer Änderung**

```
Eingabe (change) → Daten im Objekt ändern → NM.app.commit()
   ├─ state.dirty = true, Speicherstatus aktualisieren
   ├─ Autosave nach 1,2 s: vault.seal(db) → store.write() (vorher ggf. Sicherung)
   └─ rerender(): Reiter neu zeichnen, Fokus/Auswahl/Scrollposition wiederherstellen
```

Berechnete Werte (Schnitte, Testnoten, EPO-Noten) werden **nie gespeichert**, sondern bei jedem Zeichnen aus den Rohdaten berechnet.

**Pro Gerät im Browser gespeichert** (`localStorage`/IndexedDB, nicht in der Datenbank): Ordner-Handle, Geräte-ID und -name, gewählter Kurs/Reiter/Halbjahr, Farbschema.

## 23. Dateiformat der Datenbank

> **Name:** Seit Version 1.12 heißt die App **OrdoNota**. Die Dateien im Datenordner (`notenmanager.nmdb`, `notenmanager.lock.json`, Sicherungen `notenmanager_….nmdb`), die Formatkennung `notenmanager-db` und die Kennungen im Browser-Speicher behalten absichtlich ihren alten Namen, damit bestehende Datenbanken und Sicherungen ohne Umstellung weiter funktionieren. Ein vorhandener Datenordner (z. B. `Notenmanager-Daten`) kann ebenfalls seinen Namen behalten.

`notenmanager.nmdb` ist JSON:

```json
{
  "format": "notenmanager-db",
  "version": 1,
  "cipher": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256",
  "savedAt": "2026-10-14T21:57:03.123Z",
  "device": "Laptop Schule",
  "app": "1.14.0",
  "pw":   { "salt": "<b64>", "iter": 600000, "iv": "<b64>", "ct": "<b64: eingepackter Datenschlüssel>" },
  "rec":  { "salt": "<b64>", "iter": 100000, "iv": "<b64>", "ct": "<b64: eingepackter Datenschlüssel>" },
  "data": { "iv": "<b64>", "ct": "<b64: verschlüsseltes JSON des Datenmodells>" }
}
```

- Der Datenschlüssel (32 Byte) bleibt für die Lebensdauer der Datenbank gleich. Passwortwechsel packen nur `pw` neu ein. Deshalb sind alte Sicherungen weiterhin mit dem aktuellen Schlüssel lesbar.
- Jede Speicherung nutzt einen neuen zufälligen IV.

`notenmanager.lock.json`:

```json
{ "deviceId": "…", "device": "Laptop Schule", "since": "<ISO>", "heartbeat": "<ISO>" }
```

## 24. Datenmodell

Entschlüsselter Inhalt (`schema: 1`):

```js
{
  schema: 1,                             // Datenformat (siehe 26.2)
  savedWith: "1.14.0",                    // App-Version beim letzten Speichern
  created: "<ISO>", savedAt: "<ISO>",
  settings: { autoLockMin, limitSek1, limitMss, precision, keepBackups, backupEveryMin, gradeColors },
  years:   [ { id, name: "2026/27" } ],
  courses: [ Course ]
}

Course = {
  id, yearId, klasse, fach, note,
  jahrgang: 5..13,                       // ≥ 11 → MSS (Punkte)
  type: "sek1" | "lk" | "gk" | "noka",
  wKa, wOther,                           // Gewichte in %
  wHalf1, wHalf2,                        // Jahresnote (Standard 1 : 2)
  students: [ { id, last, first, active, iStatus?, photo?, email? } ],   // photo: JPEG als Data-URL, 160×160; email: Moodle-Adresse (Zuordnung beim Import)
  assessments: [ Assessment ],
  overrides: { "<Halbjahr>"|"Jahr": { "<studentId>": { p, reason } } },
  comments:  { "<studentId>": "Text" },
  seatingPlans?: [ { id, name, cols, rows, desk: "top" | "bottom", pos: { "<studentId>": { x, y } } } ],   // Räume
  seatingSaved?: [ { id, name, room, savedAt, cols, rows, desk, pos } ],                         // gespeicherte Stände
  draw: { out: { "<studentId>": { how: "drawn" | "manual", date } },   // nicht im Pool (gezogen / herausgenommen)
          history: [ { id, date, half, aid, sids: [ studentId ], prevOut } ] }   // Ziehungen; aid = angelegte Einzelnote
}

Assessment = {
  id, kind: "manual" | "test" | "epo",
  half: "HJ1" | "HJ2" | "11/1" | … | "13",
  cat: "ka" | "other",
  name, date: "YYYY-MM-DD", weight, ungraded?,   // ungraded: zählt nicht zur Note
  manual?: { grades: { "<sid>": { p } | { status } } },
  test?:   { limit, precision, wholeGrades?,                            // wholeGrades: nur ganze Noten (Sek I)
             tasks: [ { id, name, max, bonus?, moodleNr? } ],   // moodleNr: Fragennummer in Moodle
             custom: { "<p>": Mindestpunktzahl },
             results: { "<sid>": { scores: { "<taskId>": Zahl }, status?, signed? } },   // signed: Datum „Unterschrift gesehen“
             moodle?: { importedAt, totalMax,                                     // nur bei Moodle-Import
                        files: [ { name, kind: "answers" | "grades", text } ],    // Original-CSV-Dateien
                        answers: { "<sid>": { "<taskId>": { q, a, c } } } } },   // Frage, gegebene, richtige Antwort
  epo?:    { limit, points: { "++","+","0","-","--","u","h" },
             table: { strict: bool, mins: [ % je Punktstufe ] },
             lessons: [ { id, date } ],
             entries: { "<sid>": { "<lessonId>": { r: "++"|"+"|"0"|"-"|"--"|"k"|"", hw: "u"|"h"|"" } } } }
}
```

`p` ist immer eine Punktzahl 0–15. `status` ∈ `fehlt`, `nachschreiben`, `taeuschung`; bei Testergebnissen zusätzlich `ungewertet` (Note wird berechnet, zählt aber nicht; Abfrage über `NM.grades.ungradedFor(a, sid)`).

`NM.model.migrate()` ergänzt beim Öffnen fehlende Felder. Neue Felder bitte dort mit Standardwert nachtragen.

## 25. Tests

### 25.1 Alle Tests auf einmal (empfohlen)

```bash
uv run --with websocket-client --with cryptography python tests/run_tests.py
# oder nach  pip install websocket-client cryptography :
python3 tests/run_tests.py
```

Das Skript startet einen unsichtbaren Chromium-Browser (Chrome, Edge, Chromium, Brave oder Thorium wird automatisch gefunden) und prüft:

1. alle Testseiten (siehe 25.2),
2. den Start der App im Demo-Modus und alle Reiter für einen Sek-I- und einen MSS-Kurs ohne JavaScript-Fehler,
3. das Sortieren per Klick auf Spaltenköpfe (Tests, EPO, Notenübersicht; Richtung und leere Werte unten),
4. den Reiter „Tests“ in voller Breite und den Haken „Unterschrift gesehen“ bei Klassenarbeiten (Zähler, Ausdruck), den Moodle-Import (Dateiauswahl im Dialog, Zuordnung, Status „fehlt“, Ausdruck mit und ohne Note, erneuter Import),
5. den Excel-Export der Schülerliste (gültiges ZIP/XML, Umlaute und Sonderzeichen), das Kurs-Löschen nur mit „LÖSCHEN“, das Ein-/Ausblenden der Fotos im EPO-Reiter und im Sitzplan (auch im Druck) das Erweitern/Verkleinern des Sitzplan-Rasters an allen vier Seiten sowie das Ziehen (keine Wiederholung bis zum Auffüllen, automatisches Auffüllen, Note, Rückgängig, Abwesende/Herausgenommene),
6. das Notfallwerkzeug: Eine von der App echt verschlüsselte Datenbank wird mit `tools/entschluesseln.py` per Passwort und per Wiederherstellungsschlüssel entschlüsselt und mit dem Original verglichen. Dazu kommen falsches Passwort, manipulierte Datei und CSV-Ausgabe.

Am Ende steht `ERGEBNIS: x von y bestanden`. Der Exit-Code ist 0, wenn alles bestanden ist.

> **Regel:** Vor jedem Einspielen einer geänderten Version müssen alle Tests bestehen.

### 25.2 Einzelne Testseiten

| Datei | Prüft | Ausführen |
|---|---|---|
| `tests/grades.test.html` | Skalen, Eingabe-Parser, Rundung, Notenschlüssel (Vergleich mit Excel-Formeln), Bonus/Kappung, Status, Drittelparagraph, EPO (Werte aus der bisherigen EPO-Liste), Halbjahres-/Jahresnote, GK-Gewichtung | im Browser öffnen |
| `tests/model.test.html` | Migration älterer Datenbanken, Ablehnung neuerer Datenformate, Erhalt unbekannter Felder, Namensliste | im Browser öffnen |
| `tests/moodle.test.html` | CSV-Zerlegung, Erkennen und Zusammenführen von Antworten-/Bewertungen-CSV, bester Versuch, Textvergleich ohne Bewertungen, Zuordnung (Name, gemerkte E-Mail), Übernahme als Test, „fehlt“, erneuter Import, skalierte Punkte | im Browser öffnen |
| `tests/crypto.test.html` | Anlegen, Entsperren, falsches Passwort, Wiederherstellungsschlüssel, Passwortwechsel, alte Sicherungen, Manipulationserkennung | im Browser öffnen (dauert einige Sekunden) |
| `tests/storage.test.html` | Schreiben/Lesen, rollierende Sicherungen, externe Änderung, erzwungenes Überschreiben, Lock-Datei, Konfliktkopie | **über `http://localhost`**, z. B. `python3 -m http.server` im Programmordner, dann `http://localhost:8000/tests/storage.test.html` |

Die erste Zeile zeigt **„ALLE TESTS BESTANDEN“** oder die Zahl der Fehlschläge. Fehlgeschlagene Prüfungen sind mit `FAIL` markiert.

## 26. Erweitern und Anpassen

### 26.1 Versionsverwaltung mit Git

Der Programmordner ist ein Git-Repository. Jede Änderung wird als Commit festgehalten und lässt sich nachvollziehen oder rückgängig machen:

```bash
git log --oneline            # Verlauf ansehen
git diff                     # noch nicht festgehaltene Änderungen
git checkout -- js/grades.js # eine Datei auf den letzten Stand zurücksetzen
git revert <commit>          # einen Commit rückgängig machen
```

**Niemals im Repository:** Echte Schülerdaten. Die `.gitignore` schließt Datenbanken (`*.nmdb`), Lock-Dateien, `Sicherungen/`, entschlüsselte Klartext-Dateien, CSV-Exporte und die Excel-Vorlagen (`*.xlsx`) aus, denn diese enthalten echte Namen. Vor einem `git add` bei neuen Dateitypen mit `git status` prüfen, was aufgenommen wird. Das Repository bitte nicht auf öffentliche Dienste hochladen, ohne vorher sicherzustellen, dass keine personenbezogenen Daten enthalten sind.

### 26.2 Versionsnummern und Datenformat

In `js/model.js` stehen zwei Nummern:

| Konstante | Bedeutung | Wann erhöhen |
|---|---|---|
| `APP_VERSION` (z. B. `1.14.0`) | Programmversion. Wird beim Speichern in der Datenbank vermerkt und unter Einstellungen angezeigt. Dieselbe Nummer steht als `?v=1.14.0` hinter jeder CSS-/JS-Datei in `index.html`, damit der Browser keine veraltete Fassung aus dem Zwischenspeicher lädt. | bei jeder veröffentlichten Änderung (beide Stellen) |
| `SCHEMA` (z. B. `1`) | Version des Datenformats | nur, wenn eine **ältere** App-Version die neuen Daten falsch verstehen würde (z. B. ein Feld ändert seine Bedeutung) |

Öffnet eine App eine Datenbank mit höherem `SCHEMA`, verweigert sie das mit einer Meldung (siehe 21.10). Neue, nur *zusätzliche* Felder brauchen kein neues `SCHEMA`: Ältere Versionen lassen unbekannte Felder unverändert und speichern sie mit.

### 26.3 Sicher erweitern – Checkliste

1. Vorher **Sicherung** anlegen (Einstellungen → Jetzt sichern).
2. Änderung in einem eigenen Git-Zweig vornehmen (`git switch -c funktion-xyz`).
3. Gerechnete Werte nie speichern, sondern aus Rohdaten berechnen (wie bisher).
4. Neue Felder mit Standardwert in `NM.model.migrate()` eintragen. Bei inkompatiblen Änderungen `SCHEMA` erhöhen.
5. Tests ergänzen und **`tests/run_tests.py` ausführen – alles muss bestehen.**
6. Erst im Demo-Modus (`index.html?demo`) ausprobieren, dann mit der echten Datenbank.
7. `APP_VERSION` erhöhen, committen, auf allen Geräten einspielen.

### 26.4 Wo was geändert wird

- **Rechenregeln ändern:** ausschließlich in `js/grades.js`. Danach `tests/grades.test.html` anpassen und ausführen.
- **Neuer Reiter:** Datei `js/view-name.js` mit `NM.views.name = { render(view, { course, db }) }` anlegen, in `index.html` einbinden und in `TABS` in `js/app.js` eintragen.
- **Sortierbare Spalte:** `NM.ui.sorter(tabelle, { schlüssel: { get: (s) => Wert, first: 'asc' | 'desc' } })` liefert `rows()` zum Ordnen der Schülerliste sowie `head()`, `toggle()` und `nameHeads()` für die Spaltenköpfe; die passenden Namenszellen erzeugt `NM.ui.nameCells(s, nr)`.
- **Moodle-Import:** Einlesen und Übernehmen in `js/moodle.js` (Tests: `tests/moodle.test.html`), Dialog und Karte in `js/view-tests.js`, Ausdruck `NM.print.moodle` in `js/print.js`.
- **Neue Kursart:** Eintrag in `COURSE_TYPES` in `js/grades.js`.
- **Farben:** Tokens oben in `css/app.css` (`:root` hell, darunter dunkel).
- **Änderungen am Datenmodell:** Standardwerte in `NM.model.migrate()` ergänzen, damit bestehende Datenbanken weiter funktionieren. Bei inkompatiblen Änderungen `SCHEMA` erhöhen.
- **Neue Version einspielen:** Programmordner (`index.html`, `css/`, `js/`) ersetzen. Der Datenordner bleibt unberührt. Vorher eine Sicherung anlegen.
