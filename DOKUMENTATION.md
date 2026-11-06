# OrdoNota – Dokumentation

Version 1.38.0 · Stand November 2026

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
    - [8a. Reiter „Präsentationen“](#8a-reiter-präsentationen)
9. [Reiter „Notenübersicht“](#9-reiter-notenübersicht)
10. [Reiter „Sitzplan“](#10-reiter-sitzplan)
    - [10a. Reiter „Ziehen“](#10a-reiter-ziehen)
    - [10b. Reiter „Gruppen“](#10b-reiter-gruppen)
    - [10c. Reiter „Tools“](#10c-reiter-tools)
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
| Präsentationen nach Kriterien bewerten | **Präsentationen** | Note je Person aus 0–3 Punkten je Kriterium, Bewertungsbögen |
| Gruppen für Aufträge, Gruppenpuzzle oder Vorträge bilden | **Gruppen** | Einteilung nach Regeln und Leistung, Beamer, Gruppenkarten |
| Timer, Zufallszahl, Personen auswählen, würfeln, Karte ziehen (ohne Noten) | **Tools** | Ergebnis groß, auch im Vollbild für den Beamer |
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
| Firefox und Safari | Nur mit dem Startprogramm (3.6). Per Doppelklick auf `index.html` können sie nicht direkt in einen Ordner schreiben; die App zeigt dann einen Hinweis. |
| Betriebssystem | Windows, Linux oder macOS (Desktop/Laptop) |
| Synchronisation | Synology Drive Client, der einen lokalen Ordner mit der DiskStation synchronisiert |
| Internet | Nicht nötig. Die App läuft komplett offline. |

## 3. Einrichtung und erster Start

### 3.1 Dateien ablegen

Der Programmordner enthält:

```
index.html        ← die App (per Doppelklick öffnen)
OrdoNota          ← Startprogramm für Linux (nach dem Bauen, siehe 3.6)
css/              ← Gestaltung
js/               ← Programmlogik
launcher/         ← Quelltext des Startprogramms (Go)
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

Der Browser merkt sich den Datenordner. Beim nächsten Start erscheint direkt **„Datenbank entsperren“**. Unten rechts in der Karte steht die Version der App (z. B. „Version 1.38.0“), so sieht man schon vor dem Entsperren, welche Fassung läuft. Passwort eingeben und **Entsperren** klicken. Fragt der Browser erneut nach dem Ordnerzugriff, bitte erlauben. Das ist pro Browsersitzung einmal nötig. Mit dem Startprogramm (3.6) entfällt diese Rückfrage.

### 3.5 Demo-Modus

**„Demo ansehen“** (auf dem Startbildschirm und unter Einstellungen → Hinweise) oder die Adresse `index.html?demo` öffnet die App mit Beispieldaten (Kurs 8b Mathe, Sek I, und MSS 12 M LK). Enthalten sind u. a. Arbeiten in Teilen (8b, 2. HJ: „KA 2 – Geometrie“, zwei Teile gemeinsam bepunktet; MSS 12: „Kursarbeit 2 – Analysis“, drei Teile getrennt benotet mit Gewicht 1 : 2 : 1, eine Person mit fehlendem Teil) und Präsentationen (8b, 2. HJ: „Referat Statistik“ und „HA vorstellen“ nach der Standardvorlage, „Gruppenpräsentation Zufall“ mit drei Gruppen, Personenkriterien und einer Abweichung; Reiter „Gruppen“: „Stationenlernen Prozent“ mit Aufträgen und einer Regel; MSS 12: „Kurzvortrag Extremwerte“). Der Knopf öffnet die Demo in einem neuen Fenster, auch im Startprogramm, wo sich die Adresse nicht ändern lässt; die eigene Datenbank bleibt dabei offen und unverändert. Die Demo merkt sich ihren gewählten Reiter und Kurs getrennt (`nm.ui.demo`). Statt echter Fotos hat jede Person ein Personensymbol, damit sich Sitzplan und Fotoanzeige im EPO ausprobieren lassen. **Nichts wird gespeichert.** Der Demo-Modus eignet sich zum Ausprobieren und Kennenlernen. Zum Ausprobieren des Moodle-Imports (Abschnitt 7.7) liegen im Ordner `demo/` eine Antworten- und eine Bewertungen-CSV, deren Namen zum Kurs 8b Mathe passen.

### 3.6 Start mit dem Startprogramm (ohne Rückfrage)

Statt `index.html` per Doppelklick zu öffnen, können Sie OrdoNota über das **Startprogramm** starten. Es öffnet die App als eigenes Fenster, und der Browser fragt nie nach dem Ordnerzugriff, weil das Startprogramm die Dateien selbst schreibt. Es braucht keine Installation (kein Python o. Ä.) und funktioniert unter Linux, Windows und macOS.

| System | Datei | Start |
|---|---|---|
| Linux | `OrdoNota` (im Programmordner) bzw. `OrdoNota-Linux` | Doppelklick oder `./OrdoNota`. Beim ersten Start legt das Programm den Eintrag „OrdoNota“ im Startmenü an (`~/.local/share/applications/OrdoNota.desktop`, passend zur Fensterklasse `OrdoNota`; ein alter `ordonota.desktop` bis 1.37.0 wird ersetzt) und erneuert den Menü-Cache (`kbuildsycoca6`, sonst `update-desktop-database`). Wurde das Programm verschoben, genügt ein Start vom neuen Ort aus. Startmenü und Taskleiste zeigen das Zeichen ohne Schriftzug (`logo/ordonota-icon.svg`). |
| Windows | `OrdoNota.exe` | Doppelklick; Verknüpfung über Rechtsklick → *Senden an* → *Desktop*. Beim ersten Mal: „Weitere Informationen“ → „Trotzdem ausführen“. |
| macOS | `OrdoNota.app` | in „Programme“ ziehen; beim ersten Mal Rechtsklick → *Öffnen* → *Öffnen*. |

**Ablauf:** Das Programm startet einen kleinen Server, der nur auf diesem Rechner erreichbar ist (`127.0.0.1`, Port 47110), und öffnet Chrome, Edge, Chromium, Thorium oder Brave als App-Fenster mit eigenem Profil. Fehlt ein solcher Browser, öffnet es den Standardbrowser (auch Firefox/Safari). Beim ersten Start wählen Sie den Datenordner im Ordner-Dialog des Systems; gibt es keinen (z. B. Linux ohne `zenity`/`kdialog`), geben Sie den Pfad ein. Das Programm merkt sich den Ordner. Wird das Fenster geschlossen, beendet sich das Programm nach etwa 15 Sekunden und gibt den Hinweis „geöffnet auf …“ frei. Ein zweiter Start öffnet nur ein weiteres Fenster.

**Einstellungen des Startprogramms** (nicht in der Datenbank) liegen in `~/.config/OrdoNota/` (Linux), `%AppData%\OrdoNota\` (Windows) bzw. `~/Library/Application Support/OrdoNota/` (macOS):

```
config.json     { "dataDir": "/home/…/SynologyDrive/OrdoNota-Daten", "port": 47110, "browser": "" }
token           Zugriffskennwort für den Server (nur für Ihr Benutzerkonto lesbar)
browser/        Browser-Profil des App-Fensters (Gerätename, Ansicht, gewählter Kurs)
launcher.log    Protokoll des letzten Starts
```

`port` lässt sich ändern, falls 47110 belegt ist. Dann gehen die Einstellungen des Browser-Profils (Gerätename, gewählter Kurs) einmal verloren, weil sie an die Adresse gebunden sind. Mit `browser` kann ein bestimmter Browser (vollständiger Pfad) vorgegeben werden.

**Weitergabe an Kolleginnen und Kollegen:** `launcher/build.sh` (braucht Go) baut alle Fassungen nach `dist/OrdoNota-<Version>/` und packt sie als ZIP mit Anleitung (`LIESMICH.txt`) und Notfallwerkzeug. Die App-Dateien sind dort ins Programm eingebaut; es genügt also die eine Datei für das jeweilige System. Liegt neben dem Programm eine `index.html` (wie im Programmordner), nimmt es stattdessen diese Dateien.

Der Start per Doppelklick auf `index.html` funktioniert weiterhin. Beide Wege nutzen dieselbe Datenbank, aber getrennte Browser-Einstellungen (Gerätename, Ansicht).

### 3.7 Programm- und Datenordner trennen

Empfehlung: Den **Datenordner** im Synology-Drive-Ordner lassen, den **Programmordner** dagegen nur lokal auf jedem Gerät, z. B. `~/Programme/OrdoNota`. Dann kann jedes Gerät seine Version gezielt aktualisieren, und Synology muss keine Programmdateien abgleichen.

- **Mit Git** (eigene Geräte): einmal `git clone <Repository> ~/Programme/OrdoNota`, dann `cd ~/Programme/OrdoNota && launcher/build.sh` (baut `./OrdoNota` und legt den Startmenü-Eintrag an). Update: `git pull && launcher/build.sh`. Eine bestimmte Version: `git checkout <Commit>`.
- **Ohne Git** (z. B. Kolleginnen und Kollegen): die Datei aus dem ZIP (3.6) an einen beliebigen Ort legen; Update = Datei ersetzen.
- **Umzug eines bestehenden Datenordners:** Einstellungen → **Datenordner wechseln …** (siehe 20).

Unterschiedliche Versionen auf den Geräten sind ungefährlich: Eine zu alte Version öffnet eine Datenbank in neuerem Format nicht (21.10).

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
| **Reiter** | Kurs & Schüler, Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht, Sitzplan, Einstellungen (in der Skizze aus Platzgründen gekürzt). Beim Wechsel von Reiter, Kurs oder Halbjahr blendet der Inhalt weich ein und der Unterstrich gleitet zum neuen Reiter; beim Eintragen von Werten gibt es keine Animation. Bei „Bewegung reduzieren“ im Betriebssystem entfällt beides. Nicht benötigte Reiter lassen sich ausschalten (Einstellungen → Reiter, je Kurs in „Kurs & Schüler“, siehe 6.4). **Reihenfolge ändern:** einen Reiter mit der Maus an eine andere Stelle der Reiterleiste ziehen (eine farbige Linie zeigt, wo er landet) oder unter Einstellungen → Reiter → Reihenfolge mit ▲▼. Die Reihenfolge gilt für alle Kurse und alle Geräte; „Standardreihenfolge“ stellt sie zurück. |
| **Kursliste** | Kurse des gewählten Schuljahres, sortiert nach Jahrgang. Zeigt Stufe (Sek I/MSS) und Zahl der aktiven Schüler/innen. **«** neben „Kurse“ klappt die Liste gleitend nach links ein (ohne Animation, wenn im Betriebssystem „Bewegung reduzieren“ eingestellt ist): Es bleibt eine schmale Leiste mit Kürzeln (Klasse und Fach, voller Name beim Darüberfahren), über die sich weiter Kurse wechseln lassen; **»** klappt sie wieder aus. Der Zustand wird auf diesem Gerät gemerkt. |
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

**I-Status:** Ein Haken in der Spalte **„I-Status“** markiert die Person in allen Tabellen mit einem **I** hinter dem Namen, in Lehrerlisten (Ergebnisliste, Notenliste, Bewertungsliste) mit „(I)“. Auf Ergebnis- und Mitarbeitszetteln und Leistungsbögen erscheint die Markierung nicht. Noten von Personen mit I-Status zählen **nicht in die Statistik**: Notenspiegel, Ø Note, Anzahl je Note, Drittelparagraph, „Ø gelöst“ je Aufgabe und Beamer-Ansicht berücksichtigen sie nicht. Unter dem Notenspiegel steht dann „Ohne n Personen mit I-Status“ (nicht in der Beamer-Ansicht). Ihre eigenen Noten werden ganz normal berechnet.

**Zu- und Abgänge:** Bei einem Abgang den Haken **„Aktiv“** entfernen. Die Person bleibt mit allen Noten gespeichert, erscheint aber nicht mehr in Eingabetabellen, Ausdrucken und Exporten. **✕** löscht die Person samt aller Noten endgültig.

### 6.3 Kurs verwalten

- **Kurs kopieren:** Übernimmt Kursdaten, Gewichtung und optional die aktiven Schüler/innen in ein (neues) Schuljahr, mit Jahrgang + 1 als Vorschlag. Noten werden nicht kopiert. Typischer Ablauf zum Schuljahreswechsel: oben „+ Neues Schuljahr …“ anlegen, dann jeden Kurs dorthin kopieren.
- **Kurs löschen:** Löscht den Kurs mit allen Schüler/innen, Noten und Sitzplänen. Zur Sicherheit muss im Dialog das Wort **LÖSCHEN** (in Großbuchstaben) eingetippt werden; vorher bleibt „Endgültig löschen“ gesperrt. Rückgängig machen geht nur über eine Sicherung.
- **Schülerliste als Excel:** Der Knopf **⬇ Excel** neben der Überschrift „Schülerinnen und Schüler“ speichert eine `.xlsx`-Datei mit den Spalten Nr., Nachname, Vorname, I-Status, Aktiv – zuerst die aktiven Personen alphabetisch und nummeriert, darunter die nicht mehr aktiven. Die Datei ist **nicht verschlüsselt** (siehe 11).

### 6.4 Reiter in diesem Kurs

Die Karte **„Reiter in diesem Kurs“** schaltet Reiter für diesen Kurs ein oder aus: Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht und Sitzplan. „Kurs & Schüler“ und „Einstellungen“ sind immer da.

- Ohne eigene Auswahl gilt der **Standard** aus Einstellungen → Reiter (siehe 12). Ein Haken, der vom Standard abweicht, ist mit ◆ markiert; **„Wie Standard“** verwirft die eigene Auswahl des Kurses.
- Ein ausgeschalteter Reiter verschwindet nur aus der Reiterleiste. **Vorhandene Daten bleiben gespeichert und zählen weiter**, z. B. Noten aus Präsentationen in der Notenübersicht. In der Notenübersicht entfällt dann der Sprunglink („Präs. ›“ usw.), im Reiter „Gruppen“ die Übernahme in eine Präsentation. Wieder einschalten zeigt alles wie vorher.
- Ist der zuletzt gewählte Reiter im Kurs ausgeschaltet, öffnet sich die Notenübersicht (bzw. „Kurs & Schüler“, wenn auch sie aus ist).
- Beim Kopieren eines Kurses wird seine Reiterauswahl mitkopiert. Die Auswahl gilt auf allen Geräten.

## 7. Reiter „Tests“

### 7.1 Test anlegen

1. Halbjahr wählen.
2. **„+ Neuer Test“** klicken.
3. Eckdaten ausfüllen:

| Feld | Bedeutung |
|---|---|
| Bezeichnung | z. B. „KA 1 – Terme“ |
| Datum | Testdatum |
| Bereich | **Klassen-/Kursarbeit** oder **Sonstige** (z. B. HÜ). Neue Tests sind „Sonstige“; der Standard lässt sich unter Einstellungen → Standardwerte für neue Tests ändern. In Kursen ohne Kursarbeiten immer „Sonstige“. |
| Wertung | Haken **„nicht gewertet“**: Der Test bleibt mit allen Ergebnissen, Schlüssel und Notenspiegel erhalten, erscheint in der Notenübersicht und in der Notenliste aber nur ausgegraut und zählt **nicht** zur Halbjahresnote. |
| Gewicht | Standard 1; z. B. 0,5 für eine kurze Überprüfung |
| Punkte-Genauigkeit | Ganze, halbe oder Zehntel-Punkte. Gilt für Notenschlüssel und Summen. |
| Teile | Haken **„Arbeit in Teilen“**: Die Arbeit besteht aus mehreren Teilen, z. B. Theorie und Praxis (siehe 7.8). |
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

**Unterschrift gesehen** (nur bei Klassen-/Kursarbeiten): In der letzten Spalte „Unterschrift“ abhaken, wenn die unterschriebene Arbeit zurück ist; das Datum wird gemerkt (Tooltip). Neben „Ergebnisse“ steht der Stand, z. B. „Unterschriften 9 / 11“ (gezählt werden Personen mit Note), grün hinterlegt, wenn alle da sind. Der Vermerk hat keinen Einfluss auf die Note und erscheint im Ausdruck „Ergebnisliste“ als eigene Spalte.

Die Zeile **„Ø gelöst“** zeigt je Aufgabe, wie viel Prozent der möglichen Punkte im Schnitt erreicht wurden. Daran sieht man schnell, welche Aufgabe schwer war.

### 7.4 Notenschlüssel

Rechts steht der Notenschlüssel mit Mindestpunktzahl („ab Pkt.“), Prozent und Anzahl je Notenstufe.

- **Schwelle von Hand ändern:** Wert in „ab Pkt.“ überschreiben. Geänderte Schwellen sind gelb markiert.
- **Zurücksetzen** stellt den berechneten Schlüssel wieder her.
- **Zu wenig Punkte:** Bei wenigen Punkten (z. B. 18 Punkte in der Sek I mit ganzen Punkten) fallen zwei Notenstufen auf dieselbe Mindestpunktzahl, etwa 2+ und 2 beide ab 15 Punkten. Die schwächere Stufe kann dann nie vergeben werden. Über dem Schlüssel erscheint ein Hinweis ⚠ („2 und 3- sind nicht erreichbar“), die betroffenen Zeilen sind blass und mit ⚠ markiert. Knöpfe bieten an, was das Problem löst: **½ Halbe Punkte** bzw. **Zehntel-Punkte** (Punkte-Genauigkeit) oder **Nur ganze Noten** (Sek I). Liegt es an einer von Hand gesetzten Schwelle, heißt der Hinweis „Schwellen prüfen“. Der Hinweis gilt auch für Teile mit eigenem Schlüssel und für Präsentationen (dort zusätzlich: weitere Kriterien aufnehmen oder höher gewichten).
- Die Formeln stehen in [Abschnitt 15](#15-notenschlüssel-für-tests).

### 7.5 Notenspiegel und Drittelparagraph

Unter dem Schlüssel stehen das Balkendiagramm (Anzahl je ganzer Note 1–6), Teilnehmende, Ø Note (bei MSS zusätzlich Ø Punkte), die **Standardabweichung** (Sek I: der Noten, z. B. 2- = 2,33; MSS: der Punkte; berechnet über alle gewerteten Arbeiten mit Teiler n), die Zahl der Noten 5 und 6 und der Anteil **unter 4** (Note 5 oder 6) in Prozent. Standardabweichung und Anteil unter 4 erscheinen auch in der Beamer-Ansicht und im Ausdruck „Schlüssel“ bzw. „Liste“.

**Drittelparagraph:** Sind mehr als ein Drittel der gewerteten Arbeiten mangelhaft oder ungenügend, erscheint die rote Meldung **„Drittelparagraph greift!“**. Arbeiten mit Status „Täuschung/Verweigerung“ zählen dabei nicht als 5/6, wohl aber zur Gesamtzahl. Personen mit I-Status zählen in der gesamten Statistik nicht mit (siehe Abschnitt „Kurs & Schüler“).

**Beamer-Ansicht:** Der Knopf **„⛶ Beamer“** öffnet im Vollbild nur den Notenspiegel (Balken, Teilnehmende, Ø Note, Höchstpunktzahl) und die Punkteverteilung (Rohpunkte von–bis und Anzahl je Notenstufe), darunter **Ø erreicht je Aufgabe** als Balken (Punkte und Prozent; nur eingetragene Werte zählen, wie in der Zeile „Ø gelöst“). Namen und Einzelergebnisse erscheinen nicht. Schließen mit **Esc** oder „✕ Schließen“. Die Ansicht ist eine Momentaufnahme; nach Änderungen neu öffnen.

### 7.6 Ausdrucke

Der Knopf **„🖨 Drucken …“** öffnet eine Auswahl aller Druckarten des Tests, getrennt nach „Für die Lehrkraft“ und „Zum Austeilen“. Beim Darüberfahren zeigt ein Tooltip, was der Ausdruck enthält.

| Druckart | Inhalt |
|---|---|
| **Für die Lehrkraft** | |
| 📄 Ergebnisliste | Alle Personen mit Punkten je Aufgabe, Σ, %, Note (bei Klassen-/Kursarbeiten mit Spalte „Unterschrift“); darunter Notenspiegel und Schlüssel |
| 🧩 Ergebnisse nach Teilen | nur bei Arbeiten in Teilen (siehe 7.8): alle Personen mit Punkten, Prozent und (bei getrennter Benotung) Note je Teil, dazu die Gesamtwerte; darunter Notenspiegel und Schlüssel |
| 📊 Notenschlüssel und Notenspiegel | Punktschwellen je Note und Notenspiegel mit Statistik, ohne Namen (z. B. für das Klassenbuch oder die Fachleitung) |
| **Zum Austeilen** | |
| ✂️ Ergebniszettel zum Ausschneiden | Ein Abschnitt pro Person: erreichte und mögliche Punkte je Aufgabe, Prozent, Note |
| 💬 Moodle-Rückmeldung je Person | nur bei Tests aus Moodle (siehe 7.7): je Person eine Seite mit Ergebnis (Punkte, Prozent) oben, darunter Frage, gegebene Antwort, Lösung und Punkte; unten die **Note (Zahl und ausgeschrieben) wahlweise** sowie Linien für Datum und Unterschrift |

### 7.7 Moodle-Import

Tests aus Moodle lassen sich direkt übernehmen. Die Note berechnet OrdoNota mit dem eigenen Notenschlüssel (LIMIT, Abschnitt 15), nicht mit der Bewertung aus Moodle.

1. In Moodle beim Test unter **Ergebnisse** zwei Dateien als CSV herunterladen:
   - **Antworten** („Antworten“-Bericht): Fragetext, gegebene und richtige Antwort je Frage.
   - **Bewertungen** („Bewertungen“-Bericht, Spalten `F 1 /1,00`, `F 2 /1,00` …): Punkte je Frage. Nur diese Datei enthält Korrekturen, die Sie in Moodle von Hand vorgenommen haben (z. B. Tippfehler als richtig gewertet).
2. Im Reiter „Tests“ einen Test öffnen oder mit **„+ Neuer Test“** anlegen und in der Karte „Aufgaben“ auf **„⬆ Moodle-CSV“** klicken. Bei einer Arbeit in Teilen steht der Knopf **„⬆ Moodle“** je Teil in der Karte „Teile“ (siehe 7.8).
3. Beide Dateien auswählen (mehrere auf einmal markieren). OrdoNota erkennt selbst, welche welche ist. Eine allein geht auch:
   - nur Antworten: Punkte per Textvergleich (Antwort = richtige Antwort, je Frage 1 Punkt); Korrekturen aus Moodle fehlen,
   - nur Bewertungen: Punkte vollständig, der Ausdruck enthält aber keine Fragen und Antworten.
4. **Zuordnung prüfen:** Jede Person aus Moodle wird einem Kursmitglied zugeordnet: zuerst über die beim letzten Import gemerkte Moodle-E-Mail-Adresse, sonst über Nach- und Vorname. Nicht erkannte Personen per Auswahlliste zuordnen oder „— nicht übernehmen —“ lassen.
5. **Bisherige Aufgaben ersetzen?** Hat der Test schon Aufgaben (bei einem neuen Test A1 und A2), entfernt der Haken **„Bisherige Aufgaben ersetzen“** sie samt ihren Punkten; ohne Haken kommen die Moodle-Fragen zusätzlich dazu. Der Haken ist vorausgewählt, solange in diesen Aufgaben noch keine Punkte stehen. Sind schon Punkte eingetragen, ist er aus, und beim Setzen erscheint eine Warnung, welche Punkte gelöscht werden.
6. **Importieren.** Jede Moodle-Frage wird eine Aufgabe **F1, F2, …** des Tests. Bei einem frisch angelegten Test (Bezeichnung „Neuer Test“, noch keine Punkte) kommen Bezeichnung (aus dem Dateinamen, im Dialog änderbar), Datum des Moodle-Versuchs und Punkte-Genauigkeit aus Moodle; Bereich, Gewicht und LIMIT bleiben wie beim Anlegen.

Regeln beim Import:

- Hat jemand mehrere Versuche, zählt der beste **beendete** Versuch.
- Personen mit nicht beendetem Versuch („In Bearbeitung“) und Kursmitglieder ohne Moodle-Versuch bekommen den Status **„fehlt“**, sofern noch keine Punkte eingetragen sind. Punkte können von Hand nachgetragen werden.
- Unbeantwortete Fragen zählen 0 Punkte.
- Die Punkte-Genauigkeit wird passend gesetzt (ganze, halbe oder Zehntel-Punkte). Rechnet Moodle mit skalierten Punkten (z. B. `F 1 /0,71`), kann die Summe der gerundeten Fragenpunkte minimal von der Moodle-Bewertung abweichen; OrdoNota weist dann darauf hin.
- **Beide CSV-Dateien werden verschlüsselt im Test gespeichert**, ebenso Fragen und Antworten je Person. Die Karte **„Moodle“** im Test zeigt das Importdatum und bietet die Originaldateien zum Herunterladen an (⬇; die heruntergeladene Datei ist unverschlüsselt).

**Erneut importieren** (Knopf in der Karte „Moodle“; nach dem ersten Import verschwindet „⬆ Moodle-CSV“ aus der Karte „Aufgaben“), z. B. nach Korrekturen in Moodle: Die Punkte der Moodle-Fragen werden ersetzt, eigene zusätzliche Aufgaben (der Haken „ersetzen“ ist hier nicht vorausgewählt), Notenschlüssel, Gewicht und Status „nicht gewertet“/„Täuschung“ bleiben erhalten. Lädt man dabei nur die Bewertungen-CSV, bleiben die gespeicherten Antworttexte erhalten.

**Ausdruck „💬 Moodle-Rückmeldung je Person“** (unter „🖨 Drucken …“): Im Dialog wählen Sie **alle** (je eine Seite) oder **eine Person** und ob die **Note** mitgedruckt wird. Oben steht das Ergebnis (Punkte, Prozent mit Balken), darunter je Frage Frage, „Deine Antwort“, Lösung und Punkte. Jede Zeile trägt ein Zeichen und einen farbigen Rand: ✓ richtig (grün), ◐ teilweise (orange hinterlegt), ✗ falsch (rot hinterlegt, Lösung fett), – keine Antwort. Durch die Zeichen bleibt der Ausdruck auch in Schwarzweiß lesbar; Zeilen werden nicht über Seiten getrennt. Unten steht – wenn gewählt – die **Note als Zahl und ausgeschrieben** (z. B. „2+ voll gut“, „2- noch gut“; MSS: „11 Punkte gut (2)“), darunter Linien für **Datum** und **Unterschrift der Lehrkraft** (auch ohne Note).

### 7.8 Arbeit in Teilen (z. B. Theorie und Praxis)

Eine Klassenarbeit kann aus mehreren Teilen bestehen, z. B. einem Theorie- und einem Praxisteil oder Hörverstehen, Lesen und Schreiben. Haken **„Arbeit in Teilen“** in den Eckdaten setzen: Es entstehen die Teile „Theorie“ und „Praxis“, alle vorhandenen Aufgaben gehören zunächst zum ersten Teil. In der Karte **„Teile“** lassen sich die Teile umbenennen, mit **„+ Teil“** weitere anlegen und mit **✕** entfernen (mit ihren Aufgaben und Punkten). In der Karte „Aufgaben“ hat jeder Teil eigene Knöpfe „+ Aufgabe“ und „+ Bonusaufgabe“.

**Wertung** (Auswahl in der Karte „Teile“):

| Wertung | Note |
|---|---|
| **gemeinsam bepunktet** | Alle Punkte zählen zusammen, ein Notenschlüssel über die Gesamtpunktzahl (wie ohne Teile). Die Teile gliedern Aufgaben, Ergebnistabelle und Ausdrucke; je Teil stehen Σ und % da. |
| **getrennt benotet** | Jeder Teil hat einen eigenen Notenschlüssel (LIMIT, Punkte-Genauigkeit, Notenstufen, eigene Schwellen) und eine eigene Note. Die Gesamtnote ist der gewichtete Schnitt der Teilnoten, auf eine Notenstufe gerundet (Gewichte je Teil, z. B. 1 : 2; Formel in 15.5). |

Bei getrennter Benotung gilt außerdem:

- Die **Gesamtnote entsteht erst, wenn alle Teile eine Note haben.** Fehlt jemand in einem Teil, setzen Sie in der Spalte „Note“ dieses Teils **fehlt** oder **NS** (Nachschreiben). Der Status in der Spalte „Status“ gilt weiterhin für die ganze Arbeit (z. B. Täuschung → 6).
- Der **Notenschlüssel** zeigt den Schlüssel des gewählten Teils (Umschalter über der Tabelle); Notenspiegel, Statistik und **Drittelparagraph** beziehen sich auf die Gesamtnote.
- Die Beamer-Ansicht zeigt die Punkteverteilung je Teil.

**Teil ausblenden:** Neben der Überschrift „Ergebnisse“ steht je Teil ein Knopf (z. B. **▾ Theorie**). Ein Klick blendet die Aufgabenspalten dieses Teils aus (**▸ Theorie**); Σ und (bei getrennter Benotung) die Teilnote bleiben sichtbar. So passt z. B. beim Eintragen des Praxisteils alles auf den Bildschirm. Der Zustand wird je Test auf diesem Gerät gemerkt; Ausdrucke zeigen immer alle Teile.

**Moodle-Import in einen Teil:** Knopf **„⬆ Moodle“** in der Zeile des Teils. Die Fragen werden Aufgaben F1, F2, … dieses Teils, die anderen Teile bleiben unverändert; „Bisherige Aufgaben ersetzen“ (siehe 7.7) betrifft nur die Aufgaben dieses Teils. Die CSV-Dateien werden beim Teil gespeichert (eigene Karte „Moodle – Teilname“ mit „Erneut importieren“). Personen ohne beendeten Moodle-Versuch bekommen „fehlt“ für die ganze Arbeit, wenn sie noch gar keine Punkte haben; haben sie in einem anderen Teil schon Punkte, wird bei getrennter Benotung nur dieser Teil auf „fehlt“ gesetzt.

**Teile aufheben:** Haken „Arbeit in Teilen“ entfernen. Alle Aufgaben und Punkte bleiben erhalten und werden wieder mit einem Schlüssel bewertet; Schlüssel, Gewichte und Status der einzelnen Teile gehen verloren (mit Rückfrage).

**Ausdrucke:** „Ergebnisliste“ und „Ergebniszettel“ zeigen die Aufgaben nach Teilen mit Zwischensumme (bei getrennter Benotung zusätzlich die Teilnoten), „Notenschlüssel und Notenspiegel“ den Schlüssel je Teil, **„🧩 Ergebnisse nach Teilen“** eine kompakte Tabelle aller Personen mit Punkten, Prozent und Note je Teil und gesamt.

> Arbeiten in Teilen brauchen OrdoNota ab Version 1.18 auf allen Geräten (Datenformat 2, siehe 21.10).

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

## 8a. Reiter „Präsentationen“

Präsentationen (Referate, Vorträge) werden nach **Kriterien** bewertet: je Kriterium **0, 1, 2 oder 3 Punkte**. Die Summe wird wie bei Tests über den Notenschlüssel in eine Note umgerechnet (LIMIT, eigene Schwellen, nur ganze Noten; siehe 15.6).

### 8a.1 Kriterienpool

Der **Kriterienpool** (aufklappbare Karte unten im Reiter) gilt für **alle Kurse und Schuljahre**. Jedes Kriterium hat eine Gruppe (z. B. Inhalt, Vortrag, Medien, Sprache, Austausch), eine Bezeichnung und für jede Stufe 0–3 eine kurze Beschreibung, z. B. „Freies Sprechen“: 0 = abgelesen, 1 = überwiegend abgelesen, 2 = weitgehend frei, 3 = frei mit Stichwörtern. Ein Startbestand mit 31 fein gegliederten Kriterien ist vorhanden – lieber mehrere eindeutige Kriterien als ein Sammelkriterium, z. B. bei den Medien getrennt *Übersichtlichkeit*, *Lesbarkeit*, *Ansprechende Gestaltung*, *Bilder und Grafiken*, *Rechtschreibung*; beim Vortrag *Lautstärke*, *Sprechtempo und Pausen*, *Betonung*, *Blickkontakt*, *Körpersprache*. Mit **✎** bearbeiten, mit **✕** löschen, mit **„+ Kriterium“** ergänzen. **„Startbestand ergänzen (n)“** erscheint, wenn Kriterien des Startbestands im Pool fehlen (z. B. gelöschte oder nach einem Update neu hinzugekommene), und fügt sie wieder hinzu; vorhandene Kriterien werden dabei nicht verändert. Änderungen am Pool wirken nur auf neue Bewertungen; bestehende Bewertungen behalten ihre Kriterien.

### 8a.2 Bewertung anlegen

1. Halbjahr wählen → **„+ Neue Bewertung“**.
2. Bezeichnung eingeben und Kriterien aus dem Pool per Haken wählen (die Stufenbeschreibungen erscheinen beim Darüberfahren) – oder unter **„Kriterien übernehmen von“** eine frühere Bewertung (auch aus einem anderen Kurs) als Vorlage nehmen.
3. In der Karte **„Kriterien“** lassen sich die Kriterien **gewichten** (×1, ×2, ×3: ein Kriterium ×2 zählt 0–6 Punkte), mit ↑/↓ sortieren, mit ✎ für diese Bewertung anpassen (wahlweise auch im Pool) und mit ✕ entfernen. **„+ aus dem Pool“** fügt weitere hinzu, **„+ eigenes Kriterium“** legt ein neues an (wahlweise auch im Pool).

Eckdaten wie bei Tests: Bezeichnung, Datum, **Bereich** (Sonstige oder Klassen-/Kursarbeit als Ersatzleistung), „nicht gewertet“, Gewicht, Notenstufen (Sek I) und LIMIT.

### 8a.3 Bewerten

- **Karte „Bewerten“** (für die Bewertung während oder direkt nach der Präsentation): Person wählen (Auswahlliste oder ‹ ›; ✓ = schon bewertet), **Thema** und Datum eintragen, je Kriterium auf **0, 1, 2 oder 3** klicken. Unter dem Kriterium steht die Beschreibung der gewählten Stufe; ein zweiter Klick hebt die Auswahl auf. Darunter eine **Bemerkung** (erscheint auf dem Bewertungsbogen) sowie Summe, Prozent und Note.
- **Karte „Übersicht“:** alle Personen mit Thema, Punkten je Kriterium (direkt eintragbar, nur 0–3), Σ, %, Note und Status (fehlt, Nachschreiben, Täuschung, nicht gewertet – wie bei Tests). **✎** am Zeilenende öffnet die Person oben in „Bewerten“. Spalten sind sortierbar.
- Rechts stehen Notenschlüssel (Schwellen änderbar), Notenspiegel und Drittelparagraph wie bei Tests.

Die Note erscheint in der Notenübersicht als eigene Spalte (◉, Sprung über „Präs. ›“) und zählt mit ihrem Gewicht im gewählten Bereich.

### 8a.4 Ausdrucke

**„🖨 Drucken …“** bietet:

| Druckart | Inhalt |
|---|---|
| **Für die Lehrkraft** | |
| 📄 Bewertungsliste | alle Personen mit Thema, Punkten je Kriterium, Σ, %, Note; darunter Notenspiegel und Schlüssel |
| 📊 Notenschlüssel und Notenspiegel | Schwellen je Note und Notenspiegel, ohne Namen |
| 📝 Leere Bewertungsbögen | je aktive Person ein Bogen mit Name, Feld für Thema und Datum, je Kriterium Kästchen 0–3 mit Stufenbeschreibung, Summe, Note, Bemerkungszeilen – zum Ankreuzen während der Präsentation |
| **Zum Austeilen** | |
| 📋 Bewertungskriterien (Handreichung) | eine Seite für die Klasse vorab: alle Kriterien mit Gruppe, Gewicht und der Beschreibung jeder Stufe 0–3 (mit Punkten je Stufe), ohne Namen und Noten; Notenschlüssel wahlweise |
| 🗒️ Bewertungsbogen je Person | je Person eine Seite: Thema, je Kriterium alle Stufen mit angekreuzter Stufe und Punkten, Summe, Prozent, Bemerkung; Note wahlweise, Linien für Datum und Unterschrift (alle oder eine Person) |

### 8a.5 Vorlagen

Eine **Vorlage** ist ein benannter Satz von Kriterien mit Reihenfolge, Gewichten und Stufenbeschreibungen, z. B. „Referat“ oder „Plakatpräsentation“. Vorlagen gelten für **alle Kurse und Schuljahre**.

- **Standardvorlagen:** OrdoNota bringt drei Vorlagen mit (Kriterien aus dem Startbestand des Pools; hat man ein Kriterium im Pool umformuliert, gilt die eigene Fassung):
  - **Kurzvortrag (ohne Handout)** – Fachliche Richtigkeit ×2, Vollständigkeit, Gliederung, Freies Sprechen, Blickkontakt, Verständlichkeit, Zeitrahmen (höchstens 24 Punkte),
  - **Vortrag** – Fachliche Richtigkeit ×2, Tiefe der Auseinandersetzung, Quellenangaben, Einleitung, Gliederung, Schluss und Fazit, Freies Sprechen, Blickkontakt, Sprechtempo und Pausen, Übersichtlichkeit, Zusammenspiel von Medium und Vortrag, Handout, Fachsprache, Fragen beantworten (45 Punkte),
  - **Hausaufgaben vorstellen** – Fachliche Richtigkeit ×2, Vollständigkeit, Lösungsweg erklären ×2, Darstellung der Lösung, Fachsprache, Fragen beantworten, Umgang mit Fehlern (27 Punkte).

  Sie lassen sich wie eigene Vorlagen umbenennen, löschen und überschreiben. Fehlt eine (gelöscht oder Datenbank aus 1.21), holt **„Standardvorlagen ergänzen (n)“** in der Karte „Vorlagen“ sie zurück (Vergleich über den Namen). Für die Hausaufgaben-Vorlage gibt es drei neue Kriterien im Startbestand: *Lösungsweg erklären* (Inhalt), *Darstellung der Lösung* (Medien), *Umgang mit Fehlern* (Austausch) – in bestehenden Pools über „Startbestand ergänzen“ nachzutragen.
- **Speichern:** In der Karte „Kriterien“ einer Bewertung **„💾 Als Vorlage speichern“** und einen Namen eingeben. Gibt es den Namen schon, ersetzt die App nach Rückfrage die Kriterien dieser Vorlage.
- **Neu aus dem Pool:** In der aufklappbaren Karte **„Vorlagen“** mit **„+ Vorlage aus dem Pool“** Name eingeben und Kriterien ankreuzen.
- **Verwenden:** Beim Anlegen einer Bewertung unter **„Kriterien übernehmen von“** die Vorlage wählen (Gruppe „Vorlagen“; darunter stehen frühere Bewertungen).
- **Verwalten:** In der Karte „Vorlagen“ umbenennen (✎), löschen (✕) und mit **„🖨 Handreichung“** die Bewertungskriterien der Vorlage für die Klasse drucken – auch ohne dass schon eine Bewertung existiert.

Bewertungen sind unabhängig von ihrer Vorlage: Spätere Änderungen an der Vorlage oder ihr Löschen ändern bestehende Bewertungen nicht.

### 8a.6 Gruppenpräsentationen

Bei einer Gruppenpräsentation wird die Gruppe **einmal** bewertet, und die Punkte gelten für alle Mitglieder. Einzelne Kriterien lassen sich für eine Person abweichend bewerten. Jede Person bekommt weiter ihre eigene Note.

1. **Form wählen** (Eckdaten, vor dem Bewerten):
   - **Einzelpräsentation** – wie bisher.
   - **Gruppen – Kriterien je Gruppe oder Person:** In der Karte „Kriterien“ legt die Spalte **„Bewertet“** für jedes Kriterium fest, ob es einmal für die Gruppe (Standard, z. B. Inhalt, Gliederung, Medien) oder für jede Person einzeln bewertet wird (z. B. Freies Sprechen, Blickkontakt, Fragen beantworten). Die Einstellung wird in Vorlagen mitgespeichert.
   - **Gruppen – alles als Gruppe:** Alle Kriterien werden für die Gruppe bewertet; Unterschiede nur über Abweichungen.
2. **Gruppen bilden** in der Karte **„Gruppen“**: „+ Gruppe“, Namen ändern, Personen über „+ Person“ hinzufügen und mit × herausnehmen, Gruppe mit ✕ löschen. **„Gruppen übernehmen von …“** kopiert die Gruppen (ohne Punkte) einer Gruppeneinteilung aus dem Reiter „Gruppen“ (Auftrag wird Thema, siehe 10b) oder einer anderen Präsentation des Kurses. Personen ohne Gruppe werden einzeln bewertet; eine Präsentation darf also gemischt sein.
3. **Bewerten** mit dem Umschalter **Gruppe / Person**:
   - **Gruppe:** Gruppe wählen (‹ ›), Thema und Datum der Gruppe, Knöpfe 0–3 für die Gruppenkriterien; darunter je Mitglied die Personenkriterien, Summe, Note und Status. „einzeln ›“ springt zur Personenansicht.
   - **Person:** alle Kriterien einer Person. Bei Gruppenkriterien ist der Gruppenwert vorgewählt. Ein anderer Wert gilt als **Abweichung (◆)** und ersetzt den Gruppenwert nur für diese Person; **„↺ Gruppenwert“** nimmt sie zurück.
   - **Übersicht:** Spalte „Gruppe“; Gruppenwerte grau und kursiv, Abweichungen farbig markiert. Eine andere Zahl in einer Gruppenzelle ist eine Abweichung; Leeren oder der Gruppenwert stellt den Gruppenwert wieder her.
4. **Status** (fehlt, Nachschreiben …) und Bemerkung gelten je Person. Die Bemerkung zur Gruppe erscheint auf den Bewertungsbögen aller Mitglieder.
5. **Ausdrucke:** Die Bewertungsliste ist nach Gruppen geordnet (mit Gruppenspalte, ◆ für Abweichungen, je Kriterium „Gruppe“/„Person“). Bewertungsbögen zeigen Gruppe, Gruppenthema und bei jedem Kriterium „für die Gruppe“ bzw. „je Person“; die Handreichung erklärt das Verfahren.
6. **Zurück zur Einzelpräsentation:** Die Gruppen werden aufgelöst, Gruppenwerte und -themen werden als Einzelbewertung der Mitglieder übernommen – die Noten bleiben gleich.

> Präsentationen brauchen OrdoNota ab Version 1.20 auf allen Geräten (Datenformat 3), Gruppenpräsentationen ab Version 1.23 (Datenformat 4, siehe 21.10).

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
| Spalten mit ◉ | Ergebnisse aus dem Reiter „Präsentationen“ (Sprung über „Präs. ›“) |
| blasses, gestricheltes Feld | Spalte aus dem Reiter „Ziehen“: diese Person wurde nicht gezogen (siehe 10a); eintragen ist trotzdem möglich |
| ausgegraute einzelne Note | Testarbeit dieser Person mit Status „nicht gewertet“ (siehe 7.3); wird angezeigt, zählt aber nicht |
| Ø | gewichteter Schnitt des Bereichs (Sek I: Dezimalnote, MSS: Punkte) |
| Gerechnet | ungerundeter Gesamtschnitt + gerundete Note |
| Gesetzt | Ihre Zeugnisnote, falls sie von der gerechneten abweicht (leer = gerechnete Note gilt) |
| ✎ | Begründung für eine gesetzte Note (erscheint erst, wenn eine Note gesetzt ist) |
| 💬 | Bemerkung zur Person (erscheint auf dem Leistungsbogen) |

**Spalten einklappen:** Ein Klick auf **▾ Klassen-/Kursarbeiten** bzw. **▾ Sonstige Leistungen** im Tabellenkopf klappt die Gruppe ein; dann steht nur noch ihr Ø da (▸ mit der Zahl der ausgeblendeten Spalten klappt sie wieder auf). Gibt es mindestens zwei Spalten aus dem Reiter „Ziehen“, schiebt **„Ziehungen bündeln (n)“** sie zu einer Spalte **„Ziehen (n)“** mit dem Zeitraum zusammen. Sie zeigt die Noten jeder Person nebeneinander (Bearbeiten nach „Ziehungen einzeln“). Einklappen und Bündeln ändern nur die Ansicht. Die Noten zählen weiter, Ausdrucke und CSV zeigen alle Spalten, und der Zustand wird pro Gerät gemerkt.

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

**Gesetzte Noten:** Eine Eingabe in „Gesetzt“ überschreibt die gerechnete Note. Die Zeile wird farbig hinterlegt. Über **✎** können Sie eine Begründung hinterlegen. Sie erscheint auf dem Leistungsbogen.

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

Oben wählen Sie den **Pool**: **Klassisch** (wie bisher, je Ziehung eine eigene Spalte) oder einen **benannten Pool** mit einer gemeinsamen Spalte (siehe unten, seit 1.37).

**Klassischer Pool**

- **Anzahl** eintragen (wird auf diesem Gerät gemerkt), **🎲 Ziehen** klicken. Die Gezogenen erscheinen groß mit Foto (bzw. Personensymbol) – geeignet auch für den Beamer.
- **Bewerten:** Jede Ziehung legt im gewählten Halbjahr bei den **sonstigen Leistungen** eine Spalte „HA-Kontrolle TT.MM.“ an (Gewicht 1). Die Note tragen Sie direkt unter dem Namen ein; nur die Gezogenen bekommen eine Note, für alle anderen bleibt die Spalte leer und zählt nicht. In der Notenübersicht sind die Felder der Nicht-Gezogenen blass und gestrichelt dargestellt; sie lassen sich bei Bedarf trotzdem ausfüllen (dann erscheinen sie normal). Name, Gewicht und Bereich lassen sich wie bei jeder Spalte in der Notenübersicht ändern; Kürzel wie `f` (fehlt) ebenfalls dort.
- **Auffüllen:** Sind weniger Personen im Pool als gezogen werden sollen, werden zuerst alle Übrigen gezogen, dann wird der Pool automatisch aufgefüllt und der Rest daraus gezogen (mit Hinweis). **↺ Pool auffüllen** setzt den Pool jederzeit von Hand zurück; vergebene Noten bleiben erhalten.
- **Übersicht „Pool“:** zeigt je Person den Status *im Pool*, *gezogen TT.MM.* oder *herausgenommen* (sortierbar).
  - Haken **„Im Pool“** entfernen nimmt eine Person aus dem Pool heraus (bis zum nächsten Auffüllen); Haken setzen nimmt sie wieder auf – auch nach einer Ziehung.
  - Haken **„Heute abwesend“**: Die Person wird bei der Ziehung übersprungen, bleibt aber im Pool. Dieser Haken wird nicht gespeichert und ist nach dem Schließen der App wieder weg. Er gilt auch im Reiter „Gruppen“ (Abwesende werden beim Gruppenbilden ausgelassen, siehe 10b).
- Nicht mehr aktive Personen (siehe 6.2) werden nie gezogen.
- **↶ Rückgängig** (bei der letzten Ziehung) stellt den Pool wie vor der Ziehung wieder her und löscht die angelegte Notenspalte – mit Rückfrage, besonders wenn schon Noten eingetragen sind.
- **Frühere Ziehungen** (aufklappbar) listen Datum, Spalte und die Gezogenen. Die Noten lassen sich dort **nachtragen oder ändern** (Enter springt zur nächsten Person); sie landen in der Notenspalte der jeweiligen Ziehung.

**Benannte Pools (eine Spalte für alle Ziehungen)**

Für eine Runde, in der jede Person genau einmal drankommt, z. B. „HA Runde 1“ oder „Abfragen Binomische Formeln“:

- **+ Neuer Pool** fragt nach dem Namen und legt im gewählten Halbjahr eine Spalte mit diesem Namen bei den **sonstigen Leistungen** an (Gewicht 1, änderbar wie jede Spalte in der Notenübersicht). Mehrere Pools pro Kurs und Halbjahr sind möglich; die Auswahl oben wechselt zwischen ihnen (auf diesem Gerät gemerkt).
- **🎲 Ziehen** zieht aus dem Pool. Alle Noten landen in der **einen Spalte** des Pools. In der Notenübersicht zeigt ihr Kopf den **Zeitraum** der Ziehungen (z. B. „12.10.–19.10.“), Felder noch nicht Gezogener sind blass und gestrichelt. Auch der Ausdruck der Notenliste zeigt den Zeitraum.
- **Eine Runde:** Sind weniger Personen übrig als gewünscht, werden nur die Übrigen gezogen. Danach ist der Pool **fertig** (✓ in der Auswahl), es wird nicht automatisch aufgefüllt. Für weitere Ziehungen einen neuen Pool anlegen.
- „Im Pool“, „Heute abwesend“, **↶ Rückgängig** (löscht nur die Noten der zurückgenommenen Ziehung aus der Spalte) und „Frühere Ziehungen“ funktionieren wie beim klassischen Pool. Herausgenommene Personen zählen nicht zur Runde.
- **✎ Umbenennen** ändert den Namen von Pool und Spalte. **🗑 Löschen** entfernt nur den Pool; die Spalte mit allen Noten bleibt.

**Prüfung auf Ziehfehler:** Die Karte **„Prüfung“** erscheint, sobald es etwas zu melden gibt: eine Note bei einer Person, die für diese Spalte nicht gezogen wurde, eine doppelt gezogene Person (z. B. nach dem Wiederaufnehmen in den Pool) oder eine gelöschte Spalte. Gezogene ohne Note werden nur gezählt („5 Gezogene noch ohne Note“). Die Prüfung ändert nichts.

**Nachträglich zusammenfassen:** Gibt es im Halbjahr mindestens zwei Spalten aus dem klassischen Pool, fasst **⇉ Ziehungsspalten zusammenfassen …** die gewählten zu einem neuen Pool mit einer Spalte zusammen (Name vorgeschlagen mit Zeitraum). Hat eine Person in mehreren gewählten Spalten eine Note, wählen Sie, ob **die neuere** oder **die bessere** übernommen wird. Die Einzelspalten verschwinden danach, die Gezogenen stehen im neuen Pool als „dran“. Ohne Zusammenfassen bleiben alte Spalten unverändert.

## 10b. Reiter „Gruppen“

Gruppen bilden für Gruppenaufträge, Lernaufträge, Stationenlernen, Gruppenpuzzle (Stamm- und Expertengruppen) oder Gruppenvorträge. Die Einteilungen bleiben im Kurs gespeichert.

**Neue Einteilung** („+ Neue Einteilung“):
- **Bezeichnung**, dann **Personen je Gruppe** oder **Anzahl Gruppen**. Die Vorschau zeigt die Größen. Der Rest wird auf die Gruppen verteilt, es gibt keine Mini-Gruppe (15 Personen à 4 → 4 · 4 · 4 · 3; 13 à 4 → 5 · 4 · 4).
- **Verfahren:**
  - *zufällig*;
  - *leistungsgemischt*: jede Gruppe hat einen ähnlichen Notenschnitt;
  - *leistungsgleich*: Personen mit ähnlicher Note zusammen.
  Grundlage ist die gerundete Halbjahresnote des aktuellen Halbjahres; Personen ohne Note zählen wie der Durchschnitt. Der Gruppenschnitt (Ø) erscheint nur in der App, nie auf dem Beamer oder im Ausdruck.
- **Abwechslung:** möglichst nicht mit denselben Personen wie in der zuletzt angelegten Einteilung.
- **Heute abwesend** (aufklappbare Karte, gemeinsam mit dem Reiter „Ziehen“, nur bis zum Neuladen): Diese Personen werden ausgelassen und stehen unter „Nicht eingeteilt“.

**Nacharbeiten:**
- **🎲 Neu würfeln** mischt alle nicht fixierten Gruppen neu. **🔒** fixiert eine Gruppe, sie bleibt beim Neuwürfeln unverändert.
- **⚙ Verfahren** ändert Größe, Verfahren und Abwechslung (wahlweise sofort neu würfeln).
- Personen mit Maus, Stift oder Finger **ziehen** (wie im Sitzplan): auf einer Gruppe (oder bei „Nicht eingeteilt“) ablegen = verschieben, auf einer anderen Person ablegen = tauschen. Das Ziel wird beim Ziehen hervorgehoben, am oberen/unteren Rand scrollt die Seite mit; wer zwischen den Gruppen loslässt, bleibt, wo er war – oder **anklicken** und dann eine Gruppe anklicken (verschieben) bzw. eine andere Person anklicken (tauschen).
- Gruppennamen ändern, je Gruppe einen **Auftrag/ein Thema** eintragen, „+ Gruppe“, Gruppe mit ✕ löschen (Mitglieder werden „nicht eingeteilt“).
- Umschalter **📷 Fotos** und **Nachnamen** neben der Einteilung: Fotos (bzw. Personensymbol) bei den Namen zeigen, Nachnamen ausblenden (bei gleichen Vornamen mit Initiale). Pro Gerät gemerkt; beim Darüberfahren steht immer der volle Name.
- Werden Regeln verletzt (z. B. nach einem Verschieben von Hand) oder sind Abwesende eingeteilt, erscheint ein Hinweis ⚠.

**Regeln** (aufklappbare Karte, gelten für alle Einteilungen des Kurses):
- **Nicht zusammen:** Diese Paare kommen nie in dieselbe Gruppe.
- **Zusammen:** Diese Paare bleiben zusammen (z. B. Unterstützung).
- Regeln gehen beim Würfeln vor Leistung und Abwechslung. Sie sind vertraulich: verschlüsselt gespeichert wie alle Daten und nur in dieser Karte zu sehen – nie auf dem Beamer oder im Ausdruck.

**Gruppenpuzzle:** In einer Einteilung (den Stammgruppen) **„🧩 Expertengruppen bilden“** klicken. Jede Person der Stammgruppe bekommt einen Buchstaben (A, B, C … = Teilthema); alle mit A bilden die Expertengruppe A usw. So sitzt aus jeder Stammgruppe genau eine Person in jeder Expertengruppe. Die **Expertengruppen erscheinen direkt unter den Stammgruppen** (gleiche Einteilung, kein eigener Eintrag in der Liste) mit eigenem Teilthema je Gruppe, Beamer, Druck und 🗑. Die **Anzahl der Teilthemen** (= Expertengruppen) ist oben in der Karte einstellbar (Standard: Größe der größten Stammgruppe); die Themen werden dann reihum verteilt, sodass die Expertengruppen möglichst gleich groß sind und sich innerhalb einer Stammgruppe kein Thema wiederholt, solange sie nicht mehr Personen als Themen hat. „+ Gruppe“ und ✕ ändern die Anzahl ebenfalls. Werden die Stammgruppen danach geändert (neu gewürfelt, Personen verschoben, hinzugefügt oder entfernt), erscheint ein Hinweis; **„↻ Neu verteilen“** verteilt alle neu und behält Anzahl, Gruppennamen und Teilthemen. Die Buchstaben stehen auch auf Beamer und Ausdruck der Stammgruppen. Beim Löschen der Stammgruppen werden die Expertengruppen mitgelöscht.

**Zeigen, drucken, übernehmen:**
- **📽 Beamer:** alle Gruppen mit Auftrag und Namen im Vollbild (Esc schließt). Beim Gruppenpuzzle schaltet ein Umschalter oben zwischen **Stammgruppen** und **Expertengruppen** um (der Beamer-Knopf der Expertengruppen öffnet direkt diese). Die Schrift wird automatisch so groß gewählt, dass alle Gruppen ohne Scrollen auf den Bildschirm passen. Umschalter oben rechts: **📷 Fotos** (Foto bzw. Personensymbol vor dem Namen) und **Nachnamen** (aus: nur Vornamen, bei gleichen Vornamen mit Initiale, z. B. „Lea B.“). Beide werden pro Gerät gemerkt.
- **🖨 Drucken …:** *Gruppeneinteilung* (alle Gruppen auf einer Seite zum Aushängen) oder *Gruppenkarten* (je Gruppe eine Karte zum Ausschneiden).
- **→ In Präsentation übernehmen:** kopiert die Gruppen in eine Präsentation des Kurses; der Auftrag wird zum Thema der Gruppe. Eine Einzelpräsentation wird dabei zur Gruppenpräsentation (Kriterien je Gruppe oder Person, siehe 8a.6). Umgekehrt geht es in der Präsentation über „Gruppen übernehmen von …“.

## 10c. Reiter „Tools“

Werkzeuge für den Unterricht (bis Version 1.35 hieß der Reiter „Zufall“). **Es wird nichts in die Notenliste eingetragen**, und die Ergebnisse gelten nur, bis die App geschlossen oder neu geladen wird. Alle Werkzeuge stehen in gleich großen Kacheln. Jedes Werkzeug hat oben rechts **⛶ Vollbild** für den Beamer (Esc beendet). Bei „Bewegung reduzieren“ im Betriebssystem erscheint das Ergebnis ohne Animation.

- **⏱ Timer:** großer Countdown, z. B. für Arbeitsphasen. Zeit eintragen (`5` = 5 Minuten, `2,5`, `4:30` oder `90s`) oder eine **Schnellwahl** (1 bis 30 Min.) anklicken, dann **▶ Start**. **⏸ Pause** hält an, **▶ Weiter** läuft weiter, **− 1 Min.**/**+ 1 Min.** ändern die Zeit auch während des Laufens, **↺** setzt auf die eingestellte Zeit zurück.
  - **Design:** Ring (Standard, läuft im Uhrzeigersinn ab: der Rest endet bei 12 Uhr), große Ziffern, Balken oder Sanduhr. Die Farbe zeigt, wie viel Zeit bleibt: blau, in der letzten Minute (bei kurzen Timern im letzten Fünftel) gelb, in den letzten 10 Sekunden und am Ende rot. Am Ende blinkt 00:00, „Zeit ist um!“ erscheint und daneben die Überzeit.
  - **Signal** am Ende: Gong, Wecker, Piepen oder aus. Die Lautstärke ist die des Pomodoro-Timers (Einstellungen).
  - **⧉ Pop-up** öffnet den Timer in einem eigenen, frei verschiebbaren Fenster, z. B. auf dem Beamer, während die App auf dem Laptop bleibt. Im Fenster gibt es Start/Pause, ± 1 Min. und ↺; die Leertaste startet bzw. hält an. Fenster und Reiter zeigen denselben Timer. Blockiert der Browser das Fenster, hilft „Pop-ups erlauben“ oder **⛶ Vollbild**.
  - Der Timer gilt für die ganze App, nicht je Kurs. Er läuft beim Wechsel von Reiter oder Kurs weiter, endet aber beim Schließen oder Neuladen der App. Zeit, Design und Signal merkt sich das Gerät.
- **Zufallszahl:** „von“ und „bis“ eintragen (ganze Zahlen, auch negativ; beide Grenzen sind möglich), **🎲 Zahl erzeugen**. Darunter stehen die letzten Ergebnisse.
- **Personen auswählen:** Anzahl eintragen, **🎲 Auswählen**. Die Ausgewählten erscheinen mit Foto (bzw. Personensymbol). Ohne Haken ist jede Auswahl unabhängig, dieselbe Person kann also gleich wieder kommen. Mit **„Keine Wiederholung“** kommt, wer dran war, erst wieder, wenn alle dran waren (Anzeige „x von y noch nicht dran“, „↺ alle wieder aufnehmen“). Das ist unabhängig vom Pool im Reiter „Ziehen“. Wer dort „heute abwesend“ ist, wird auch hier ausgelassen.
- **Würfel:** W4, W6, W8, W10, W12 oder W20 und 1–6 Würfel wählen, **🎲 Würfeln**. Die Würfel rollen als 3D-Körper über den Tisch und bleiben liegen. Sie werden dann genau von oben gezeigt: Die gewürfelte Seite zeigt nach vorn, ihre Zahl ist kräftig, die Zahlen der schrägen Nachbarflächen sind blass. Bei mehreren Würfeln stehen die Einzelwerte und die Summe darunter (z. B. „4 + 2 + 5 = 11“). Wie bei echten Würfeln ergeben gegenüberliegende Seiten zusammen n + 1. 6 und 9 sind ab dem W10 mit Punkt markiert („6.“, „9.“).
- **Karten ziehen:** Stapel wählen: **52 Karten** (Poker/Rommé, 2 bis Ass), **32 Karten** (Skat, 7 bis Ass) oder **eigene Karten**, dazu die **Anzahl**. **🂠 Ziehen** oder ein Klick auf den Stapel zieht so viele Karten auf einmal: Sie fliegen nacheinander vom Stapel und drehen sich um. Der Stapel bleibt immer sichtbar, er wird mit jeder Ziehung niedriger, die Restzahl steht darunter, und leer erscheint er als gestrichelter Platz. Gezogen wird ohne Zurücklegen. Sind weniger Karten übrig als gewünscht, kommen die restlichen (mit Hinweis). Frühere Ziehungen stehen klein darunter. **↺ Neu mischen** legt alle zurück. Die Karten zeigen die englischen Buchstaben J, Q, K für Bube, Dame, König, die Liste darunter B, D, K. Die Kartenbilder sind gemeinfrei (CC0, Quelle in `cards/LIZENZ.txt`).
  - **Eigene Karten** (z. B. Themen, Aufgaben, Rollen): „Eigene Karten bearbeiten“ aufklappen, je Zeile eine Karte eintragen, **Übernehmen und neu mischen**. Die Liste wird im Kurs gespeichert.

## 11. Drucken und Exportieren

Alle Ausdrucke öffnen den Druckdialog des Browsers. Dort können Sie auch **„Als PDF speichern“** wählen. Breite Tabellen werden automatisch im Querformat gedruckt. Die Kopf- und Fußzeilen des Browsers (Datum, Dateipfad, Seitenzahl) werden unterdrückt; der Rand von 12 mm bleibt auf jeder Seite erhalten.

In Tests, Mitarbeit/EPO und Notenübersicht fasst je ein Knopf **„🖨 Drucken …“** alle Druckarten zusammen. Er öffnet eine Auswahl, gegliedert nach **„Für die Lehrkraft“** und **„Zum Austeilen“**; ein Tooltip beschreibt jede Druckart.

| Wo | Druckart / Knopf | Inhalt |
|---|---|---|
| Notenübersicht | 📄 Notenliste | alle Leistungen, Schnitte und Noten des gewählten Halbjahres bzw. die Jahresnoten; gesetzte Noten mit * |
| Notenübersicht | 👤 Leistungsbögen je Person | eine Seite je Person (Auswahl siehe unten) |
| Notenübersicht | ⬇ CSV/Excel (eigener Knopf) | alle Noten und Ergebnisse des Kurses als CSV (Semikolon, öffnet direkt in Excel) |
| Kurs & Schüler | ⬇ Excel | Schülerliste als Excel-Datei (.xlsx): Nr., Nachname, Vorname, I-Status, Aktiv (siehe 6.3) |
| Tests | 📄 Ergebnisliste · 🧩 Ergebnisse nach Teilen · 📊 Notenschlüssel und Notenspiegel · ✂️ Ergebniszettel · 💬 Moodle-Rückmeldung | siehe 7.6, 7.7 und 7.8 |
| Tests | ⛶ Beamer (eigener Knopf) | Vollbild ohne Namen: Notenspiegel, Punkteverteilung, Ø je Aufgabe (siehe 7.5) |
| Sitzplan | 🖨 Drucken | Sitzplan des gewählten Raums mit Vornamen, Fotos und Lehrerpult, A4 (quer, wenn mehr Spalten als Reihen) |
| Gruppen | 📄 Gruppeneinteilung · 🗂️ Gruppenkarten | siehe 10b; ohne Noten und Regeln |
| Präsentationen | 📄 Bewertungsliste · 📊 Notenschlüssel · 📝 Leere Bewertungsbögen · 📋 Bewertungskriterien (Handreichung) · 🗒️ Bewertungsbogen je Person | siehe 8a.4; Handreichung auch je Vorlage (8a.5) |
| Mitarbeit/EPO | 📄 Bewertungsliste | Bewertungsraster aller Stunden mit Ergebnis und Note je Person |
| Mitarbeit/EPO | ✂️ Mitarbeitszettel zum Ausschneiden | ein Zettel pro Person (mehrere pro Blatt, gestrichelte Schnittlinie): Name, Kurs, Blockname und Zeitraum, Punktelegende, Bewertungen mit Datum im Tabellenkopf, Ergebnis mit Note sowie Linien für Datum und Unterschrift |

**Leistungsbögen:** Im Dialog wählen Sie **für wen** (alle oder eine Person), den **Zeitraum** (alle Halbjahre oder eines) und den **Inhalt**:

- Einzelnoten mit Datum und Gewicht
- Schnitte (Klassenarbeiten / Sonstige)
- Halbjahres- und Jahresnote (gerechnet und gesetzt, mit Begründung)
- Test-Details je Aufgabe
- Präsentationen je Kriterium (mit Thema und Bemerkung)
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
| | Bereich (Klassen-/Kursarbeit oder Sonstige) | Sonstige |
| Speicherort & Sicherungen | Name dieses Geräts | – |
| | Anzahl aufbewahrter Sicherungen | 10 |
| | Sicherung höchstens alle … Minuten | 10 |
| | Jetzt sichern / Verschlüsselte Kopie herunterladen / Aus Datei wiederherstellen / Datenordner wechseln / Sicherung wiederherstellen (siehe 20) / Datenbank prüfen (siehe 21.14) | – |
| Schuljahre | Umbenennen, leere Schuljahre löschen | – |
| Reiter | Reiter ein-/ausschalten als Standard für alle Kurse (Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht, Sitzplan); einzelne Kurse können abweichen (6.4) | alle an |
| | Reihenfolge der Reiter (▲▼, auch durch Ziehen in der Reiterleiste; gilt für alle Kurse) | Standardreihenfolge |
| Darstellung | Noten farbig hinterlegen | an |
| | Farbschema: wie System / hell / dunkel | wie System |
| 🍅 Pomodoro-Timer | Timer in der Kopfzeile anzeigen | aus |
| | Anzahl Pomodoros / Länge eines Pomodoros | 4 / 25 Min. |
| | Kurze Pause / lange Pause am Ende (0 = keine) | 5 / 15 Min. |
| | Ticken: aus / nur Pomodoros / immer | aus |
| | Signal bei Phasenwechsel: aus / Wecker klingeln / Gong / Piepen (je mit „▶ Probe“) | Wecker klingeln |
| | Lautstärke | 60 % |

**Pomodoro-Timer:** Ist er aktiviert, steht er in der Kopfzeile neben dem Schuljahr: Phase (🍅 2/4 bzw. ☕ Pause), verbleibende Zeit und die Knöpfe **▶ Start**, **⏸ Pause**, **↺ Zurücksetzen** und **⚙ Einstellungen** (dieselben Einstellungen wie im Reiter, als Dialog). Farben: **rot** = Pomodoro läuft, **grün** = Pause läuft, **gelb** = pausiert, grau = bereit bzw. fertig. Nach jedem Pomodoro beginnt automatisch die kurze Pause, nach dem letzten die lange Pause; danach ist der Durchlauf fertig. Bei jedem Phasenwechsel erklingt das gewählte Signal und eine Meldung erscheint. Die Töne erzeugt die App selbst (keine Tondateien). Der Timer läuft weiter, wenn die App gesperrt oder neu geladen wird; sein Stand gilt pro Gerät.

**Reiter:** Ausgeschaltete Reiter verschwinden aus der Reiterleiste aller Kurse, die keine eigene Auswahl haben (siehe 6.4). Daten daraus bleiben gespeichert und zählen weiter. Unter den Haken steht, wie viele Kurse abweichen.

Gerätename, Farbschema und der Stand des Pomodoro-Timers gelten **pro Gerät/Browser**. Alles andere ist in der Datenbank gespeichert und gilt auf allen Geräten.

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
5. **Nicht erreichbare Stufen:** Hat eine bessere Stufe dieselbe (oder eine niedrigere) Mindestpunktzahl, wird die schwächere Stufe nie vergeben (Regel 3). Die App rechnet trotzdem nach der Formel weiter und warnt nur (`NM.grades.unreachableSteps`); Abhilfe ist eine feinere Punkte-Genauigkeit oder „nur ganze Noten“. Faustregel mit ganzen Punkten: Alle Stufen sind verschieden ab 25 Punkten in der Sek I (LIMIT 50 %; bei 22 und 23 Punkten auch) bzw. ab 21 Punkten in der MSS (LIMIT 45 %).

### 15.4 Drittelparagraph

Greift, wenn gilt: (Anzahl Noten 5 und 6 − Anzahl „Täuschung/Verweigerung“) **>** (Anzahl gewerteter Arbeiten) / 3.
Als 5 und 6 zählen alle Stufen von 5+ bis 6 (Punkte 0–3). „fehlt“ und „Nachschreiben“ zählen nicht mit, ebenso wenig Personen mit I-Status (siehe 6.2) und einzeln „nicht gewertete“ Arbeiten (siehe 7.3).

### 15.5 Arbeiten in Teilen

**Gemeinsam bepunktet:** wie ein Test ohne Teile (15.1–15.3) über die Summe aller Aufgaben.

**Getrennt benotet:** Jeder Teil wird wie ein eigener Test bewertet (Schlüssel aus seinem LIMIT, seiner Höchstpunktzahl und Genauigkeit; Bonus wird an der Bestnote des Teils gekappt). Dann:

```
Gesamt = Σ (Rechenwert der Teilnote × Gewicht des Teils) / Σ Gewichte      (Sek I: Dezimalnote, MSS: Punkte)
Note   = Gesamt auf eine Notenstufe gerundet (18)
```

**Beispiel (Sek I, Theorie : Praxis = 1 : 2):** Theorie 2- (2,33), Praxis 4- (4,33) → (2,33 + 2·4,33)/3 = 3,66 → **4+**. MSS: 15 und 06 Punkte bei 1 : 1 → 10,5 → **11**.

Fehlt eine Teilnote, gibt es keine Gesamtnote. Der Drittelparagraph (15.4) wird auf die Gesamtnoten angewendet.

### 15.6 Präsentationen

Je Kriterium 0–3 Punkte, multipliziert mit dem Gewicht des Kriteriums (×1, ×2, ×3). Höchstpunktzahl = Σ 3 × Gewicht. Die Summe wird wie eine Testpunktzahl mit ganzer Punkte-Genauigkeit über den Schlüssel aus 15.1 bzw. 15.2 in eine Note umgerechnet (LIMIT und eigene Schwellen je Bewertung; Sek I wahlweise nur ganze Noten). Nicht bewertete Kriterien zählen nicht als 0, sondern fehlen in der Summe.

**Beispiel (Sek I, LIMIT 50 %):** fünf Kriterien, eines ×2 → Höchstpunktzahl 18. Bewertung 2 (×2), 1, 0, 3, 2 → 4 + 1 + 0 + 3 + 2 = 10 Punkte = 55,6 % → **4**.

**Gruppenpräsentationen:** Je Person und Kriterium zählt die eigene Bewertung, wenn es eine gibt, sonst – bei einem Gruppenkriterium – der Gruppenwert. Personenkriterien übernehmen nie einen Gruppenwert (im Modus „alles als Gruppe“ sind alle Kriterien Gruppenkriterien). Daraus wird für jede Person wie oben die Note berechnet; Notenspiegel, Ø und Drittelparagraph zählen jede Person einzeln. Die zusammengeführten Punkte werden nie gespeichert (`NM.grades.presScores`).

*Beispiel:* Inhalt (×2) und Medien für die Gruppe mit 3 und 2, Vortrag je Person. Anna bekommt beim Vortrag 3 → 6 + 2 + 3 = 11 von 12. Ben weicht beim Inhalt ab (1) und hat beim Vortrag 1 → 2 + 2 + 1 = 5 von 12.

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

**Aus Datei wiederherstellen:** Einstellungen → **Aus Datei wiederherstellen …** spielt eine `.nmdb`-Datei ein, z. B. eine heruntergeladene Kopie oder eine Sicherung von einem anderen Ort. Der aktuelle Stand wird vorher gesichert. Hat die Datei ein anderes Passwort, fragt die App danach. **Ihr Passwort bleibt gleich**: Die Daten werden mit Ihrem aktuellen Schlüssel neu verschlüsselt.

**In einem leeren Datenordner** (beim ersten Start oder auf einem neuen Gerät) bietet „Neue Datenbank anlegen“ zusätzlich **„Vorhandene Datenbank aus Datei übernehmen …“** an. Die App kopiert die Datei in den Ordner und entsperrt sie mit ihrem Passwort. Passwort und Wiederherstellungsschlüssel sind dann die dieser Datei.

**Datenordner wechseln:** Einstellungen → **Datenordner wechseln …** und den neuen Ordner wählen. Die App kopiert die Datenbank dorthin, auf Wunsch auch die Sicherungen (sie fragt, wenn es welche gibt), und speichert ab dann dort. Der bisherige Ordner bleibt unverändert und kann danach gelöscht werden; nur der Hinweis „geöffnet auf …“ wird dort entfernt. Liegt im neuen Ordner schon eine Datenbank, wird sie nie überschrieben. Die App bietet dann an, stattdessen diese zu öffnen (mit deren Passwort). Auf anderen Geräten wählen Sie danach ebenfalls den neuen Ordner („Anderen Ordner wählen“).

Die Datenbank ist **eine einzige Datei** (`notenmanager.nmdb`). Für einen Umzug von Hand genügt es, nur diese Datei in den neuen Ordner zu kopieren und ihn in der App zu wählen. Lock-Datei und Sicherungen sind nicht nötig.

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
| `--csv ORDNER` | zusätzlich eine CSV-Datei je Kurs (Excel-kompatibel) mit Einzelnoten, Test-Rohpunkten (bei Arbeiten in Teilen je Teil), Präsentationspunkten, EPO-Kürzeln, gesetzten Noten und Bemerkungen |
| `-f` | vorhandene Ausgabedatei überschreiben |

Das Passwort wird verdeckt abgefragt und nirgends gespeichert. Die CSV-Dateien enthalten **Rohdaten**. Berechnete Schnitte und Testnoten erzeugt nur die App.

> ⚠️ Die Ausgabe ist **unverschlüsselt**. Nur auf einem vertrauenswürdigen Rechner verwenden und nach Gebrauch löschen.

## 21. Fehlerbehebung und häufige Fragen

### 21.1 „Browser wird nicht unterstützt“
Die App wurde in Firefox oder Safari geöffnet. `index.html` mit Chrome, Edge, Brave oder Thorium öffnen oder das Startprogramm verwenden (3.6), das auch mit Firefox und Safari funktioniert.

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
Auf einem anderen Gerät läuft eine neuere Version von OrdoNota, die das Datenformat erweitert hat. Die ältere Version öffnet die Datenbank absichtlich nicht, damit sie keine Daten falsch versteht oder beim Speichern verliert. Lösung: Die Programmdateien (`index.html`, `css/`, `js/`) auf diesem Gerät durch die neue Version ersetzen. Liegt der Programmordner im Synology-Drive-Ordner, passiert das automatisch. Wer das Startprogramm mit eingebauten App-Dateien nutzt (3.6), ersetzt das Programm durch die neue Fassung.

Die Version der App steht unter Einstellungen → Hinweise.

### 21.11 Eine Note kommt im Notenschlüssel nie vor (⚠ „nicht erreichbar“)
Der Test hat zu wenige Punkte für alle Notenstufen: Zwei Stufen fallen auf dieselbe Mindestpunktzahl, und die schwächere kann nie vergeben werden (z. B. 2 bei 18 Punkten mit ganzen Punkten). Abhilfe über die Knöpfe im Hinweis: **halbe Punkte** (bzw. Zehntel) oder **nur ganze Noten**; bei Präsentationen weitere Kriterien aufnehmen oder höher gewichten. Details in 7.4 und 15.3.

### 21.12 Ein Reiter ist verschwunden
Er ist ausgeschaltet – für diesen Kurs (Kurs & Schüler → „Reiter in diesem Kurs“) oder als Standard (Einstellungen → Reiter). Dort wieder anhaken; alle Daten sind noch da (siehe 6.4).

---

### 21.13 Das Startprogramm startet nicht oder meldet „Port belegt“
Die Meldung nennt die Ursache, Einzelheiten stehen in `launcher.log` (Ordner siehe 3.6). „Port 47110 ist belegt“: Ein anderes Programm nutzt den Port. In `config.json` einen anderen `port` eintragen (z. B. 47111). „App-Dateien nicht gefunden“: Ein selbst gebautes Programm ohne eingebaute App-Dateien muss im Programmordner neben `index.html` liegen. Öffnet sich kein eigenes Fenster, sondern ein Browser-Tab, wurde kein Chromium-Browser gefunden; dann Chrome oder Edge installieren oder in `config.json` unter `browser` den Pfad eintragen.

### 21.14 Bleibt meine Datenbank nach einem Update verwendbar?
Ja. Eine neue Version ergänzt beim Öffnen fehlende Felder mit Standardwerten und lässt alles andere unverändert, auch Felder, die sie nicht kennt. Gerechnete Noten werden nie gespeichert, sondern immer neu aus den eingetragenen Punkten und Noten berechnet. Vor jeder Veröffentlichung prüfen die Tests, dass Datenbanken **aller früheren Versionen** (1.1 bis heute) sich öffnen lassen, in allen Reitern ohne Fehler angezeigt werden und **dieselben Halbjahres- und Jahresnoten** ergeben wie in der Version, mit der sie angelegt wurden (siehe 25.1).

Nach dem Entsperren prüft die App den Aufbau der Datenbank (Schuljahre, Personen, Leistungen, Halbjahre). Findet sie ein Problem, erscheint eine rote Meldung. **Einstellungen → Speicherort & Sicherungen → „Datenbank prüfen …“** zeigt das Ergebnis jederzeit an: Probleme, die Rechnung oder Anzeige stören können, und Hinweise auf übrig gebliebene Einträge (z. B. Punkte einer gelöschten Person), die nicht stören. Die Prüfung ändert nichts. Bei einem Problem nach einem Update hilft eine Sicherung von vorher (siehe 20).

# Teil D – Technische Dokumentation

## 22. Aufbau der Anwendung

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne externe Bibliotheken. Die Skripte sind **klassische Skripte** (keine ES-Module), damit die App per `file://` (Doppelklick) läuft. Alle Module hängen sich an den globalen Namensraum `NM`.

| Datei | Namensraum | Aufgabe |
|---|---|---|
| `js/logo.js` | `NM.logo` | Logo als SVG: `full(h)` (Monogramm + Schriftzug), `mark(px)` (nur Monogramm), `favicon()`; Farbe folgt der Textfarbe. Quelle: `logo/ordonota-logo*.svg` |
| `js/util.js` | `NM.util` | DOM-Helfer `h()`, Formatierung (deutsch), Dialoge, Toasts, Download, CSV |
| `js/xlsx.js` | `NM.xlsx` | Excel-Dateien ohne Bibliothek: `workbook({ sheet, rows, widths })` → Blob (ZIP ohne Kompression, ein Blatt, Kopfzeile fett) |
| `js/grades.js` | `NM.grades` | **Gesamte Notenlogik** (rein, ohne DOM): Skalen, Eingabe-Parser, Rundung, Notenschlüssel (mit Prüfung auf nicht erreichbare Stufen, `unreachableSteps`), Test-/EPO-Auswertung, Arbeiten in Teilen, Präsentationen (auch in Gruppen), Halbjahres-/Jahresnote |
| `js/crypto.js` | `NM.crypto` | `Vault`: Erzeugen, Entsperren (Passwort/Wiederherstellung), Ver-/Entschlüsseln, Passwortwechsel |
| `js/storage.js` | `NM.storage` | `FolderStore` (File System Access API): Lesen/Schreiben, Sicherungen, Lock, Konflikterkennung; `ServerStore` (gleiche Schnittstelle über das Startprogramm, `detectServer()`); `MemoryStore` für den Demo-Modus |
| `js/pomodoro.js` | `NM.pomodoro` | Pomodoro-Timer: Ablauf (`next`), Anzeige in der Kopfzeile, Töne per Web Audio, Einstellungsformular |
| `js/model.js` | `NM.model` | Datenmodell: neue Datenbank/Kurse/Leistungen, Migration, Namensliste parsen, Demo-Daten |
| `js/groups.js` | `NM.groups` | Gruppenbildung (rein, ohne DOM): Gruppengrößen, Verteilung nach Regeln/Leistung/Abwechslung (Kostenfunktion + Tauschsuche), Regelprüfung, Expertengruppen |
| `js/random.js` | `NM.random` | Zufallswerkzeuge (rein, ohne DOM): `randInt`, `shuffle`, `pickPeople` (ohne Wiederholung), Kartenstapel `deck`, Würfelkörper `solid` (W4–W20, Beschriftung), Drehungen für den Wurf (`rollPlan`, `restQuat`, `frontLabel`); Zufall über `crypto.getRandomValues` |
| `js/timer.js` | `NM.timer` | Countdown (rein, ohne DOM): Restzeit aus Startzeit und verstrichener Zeit (`create`, `start`, `pause`, `reset`, `add`, `remaining`, `overtime`, `stage` für die Farbe, `format`, `parse` für Eingaben wie `4:30`) |
| `js/draw.js` | `NM.draw` | Ziehen (rein, ohne DOM): `drawFrom` (klassisch mit Auffüllen, Pool ohne), `newPool`, `drawPool`, `undoPool`, `finished`, `poolRange`, `drawnSets` (für die Notenübersicht), `check` (Ziehfehler), `classicColumns`, `mergeConflicts`, `merge`, `removePool` |
| `js/moodle.js` | `NM.moodle` | Moodle-Import (rein, ohne DOM): CSV zerlegen, Antworten-/Bewertungen-CSV erkennen und zusammenführen, Personen zuordnen, in einen Test oder Teil übernehmen (`applyImport` mit `replace`: bisherige Aufgaben ersetzen, `adopt`: Bezeichnung/Datum übernehmen) |
| `js/ui.js` | `NM.ui` | Wiederverwendbare Bausteine: Halbjahres-Umschalter, Noten-Eingabezellen, Badges, Leistungs-Dialog, Sortieren (`sorter`, `nameCells`), Druckauswahl (`printButton`), Reiter-Haken (`tabChecks`) |
| `js/app.js` | `NM.app` | Anwendungskern: Anmeldung, Sitzung, Autosave, Sperre, Layout, Navigation (`TABS`; ausschaltbare Reiter `OPTIONAL_TABS`, `tabOn`, `shownTab`), Neuzeichnen mit Fokus-Erhalt, Tabellen-Tastatur |
| `js/view-*.js` | `NM.views.*` | Je ein Reiter: `course`, `tests`, `epo`, `pres` (Präsentationen), `draw`, `random` (Tools), `groups` (Gruppen), `overview`, `seating`, `settings` |
| `js/print.js` | `NM.print` | Druckansichten |
| `css/app.css` | – | Gestaltung inkl. Hell/Dunkel (Farb-Tokens auf `:root`) und Druck-CSS |
| `launcher/*.go` | – | Startprogramm (Go, nur Standardbibliothek, siehe 22.1): Server, Dateizugriff, Browserstart, Ordner-Dialog; `build.sh` baut alle Fassungen |

**Ablauf einer Änderung**

```
Eingabe (change) → Daten im Objekt ändern → NM.app.commit()
   ├─ state.dirty = true, Speicherstatus aktualisieren
   ├─ Autosave nach 1,2 s: vault.seal(db) → store.write() (vorher ggf. Sicherung)
   └─ rerender(): Reiter neu zeichnen, Fokus/Auswahl/Scrollposition wiederherstellen
```

Berechnete Werte (Schnitte, Testnoten, EPO-Noten) werden **nie gespeichert**, sondern bei jedem Zeichnen aus den Rohdaten berechnet.

Ist beim Neuzeichnen gerade ein Knopf gedrückt (z. B. „+ Aufgabe“, während ein Eingabefeld beim Verlassen speichert), wartet `rerender()` bis nach dem Klick (`pressing` in `js/app.js`). Sonst würde der Knopf zwischen Maus-runter und Maus-hoch ersetzt und der Klick ginge verloren.

**Pro Gerät im Browser gespeichert** (`localStorage`/IndexedDB, nicht in der Datenbank): Ordner-Handle, Geräte-ID und -name, gewählter Kurs/Reiter/Halbjahr, Farbschema, ein-/ausgeklappte Kursliste, ausgeblendete Teile in der Ergebnistabelle, Umschalter Fotos/Nachnamen im Reiter „Gruppen“ und in dessen Beameransicht, Stand des Pomodoro-Timers.

### 22.1 Startprogramm (`launcher/`)

Das Startprogramm ist das einzige Teil mit Build-Schritt; die App selbst bleibt ohne. Es liefert die App aus und erledigt den Dateizugriff, sodass der Browser nicht nach dem Ordner fragen muss.

| Datei | Aufgabe |
|---|---|
| `main.go` | Ablauf: Einstellungen laden, App-Dateien finden (`--app-dir`, sonst `index.html` neben dem Programm oder bis zu 4 Ordner darüber, sonst eingebaut), Server starten, Fenster öffnen, beenden, wenn das Fenster zu ist (Browserprozess beendet und 15 s ohne Lebenszeichen; beim Standardbrowser 5 min ohne Lebenszeichen); legt unter Linux das Programmsymbol `logo/ordonota-icon.svg` (nur das Zeichen) als `ordonota-icon.svg` in den Einstellungsordner (`writeIcon`) |
| `server.go` | HTTP: `/start?t=…` setzt das Zugriffs-Cookie, statische Dateien nur aus `index.html`, `css/`, `js/`, `logo/`, `demo/`, `cards/` (nie `ref/` o. Ä.), Schnittstelle `/api/…` |
| `store.go` | Datenordner: nur `notenmanager.nmdb`, `notenmanager.lock.json`, `Sicherungen/notenmanager_*.nmdb`; Schreiben über Hilfsdatei und Umbenennen; Konfliktprüfung über die Änderungszeit |
| `desktop_linux.go` | Startmenü-Eintrag `OrdoNota.desktop` (Name = Fensterklasse, sonst ordnet KWin das Fenster nicht zu), alten `ordonota.desktop` entfernen, Menü-Cache erneuern |
| `config.go`, `browser.go`, `dialog.go` | Einstellungen und Kennwort, Browsersuche (`--app`, eigenes Profil), Ordner-Dialog und Fehlermeldungen mit Bordmitteln (zenity/kdialog, osascript, PowerShell) |
| `embed_on.go`, `build.sh` | eingebaute App-Dateien (`-tags embedapp`, `build.sh` kopiert sie nach `launcher/webapp/`) |

**Schnittstelle** (alle Antworten JSON, außer Datenbank/Sicherung: Dateiinhalt):

| Anfrage | Bedeutung |
|---|---|
| `GET /api/alive` | Lebenszeichen (alle 5 s von `ServerStore`) |
| `GET /api/info`, `POST /api/folder {path}`, `POST /api/pick` | Datenordner abfragen, setzen, mit dem Dialog des Systems wählen (ohne Fenster, `--no-browser`, kein Dialog) |
| `POST /api/probe {path}` | Ordner prüfen: `{ name, hasDb, same }` |
| `POST /api/move {path, backups}` | Datenordner wechseln: Datenbank (und Sicherungen) kopieren, nie überschreiben (`409`), neuen Ordner merken |
| `GET /api/db` (Kopf `X-Modified`), `GET /api/db/stat` | Datenbank lesen, Änderungszeit |
| `PUT /api/db` (Köpfe `X-Expect`, `X-Force`, `X-Backup-Keep`) | speichern; `409 conflict`, wenn sich die Datei seit `X-Expect` geändert hat; vorher sichern, wenn `X-Backup-Keep` > 0 |
| `GET/POST /api/backups`, `GET /api/backups/<Name>` | Sicherungen auflisten, anlegen, lesen |
| `GET /api/conflicts` | Synology-Konfliktkopien |
| `GET/PUT/DELETE /api/lock` | Lock-Datei |

**Schutz:** Der Server lauscht nur auf `127.0.0.1`. Jede Anfrage braucht den passenden `Host` (`127.0.0.1`/`localhost` mit dem Port, gegen DNS-Rebinding), `/api` zusätzlich das Cookie mit dem Kennwort aus der Datei `token` (`HttpOnly`, `SameSite=Strict`); schreibende Anfragen außerdem den Kopf `X-OrdoNota: 1`, den fremde Webseiten ohne CORS-Freigabe nicht setzen können. Der Server sieht nur die verschlüsselte Datenbank. Beim Beenden entfernt er den Lock, wenn er noch von seiner Sitzung stammt.

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
  "app": "1.38.0",
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

Entschlüsselter Inhalt (`schema: 4`):

```js
{
  schema: 4,                             // Datenformat (siehe 26.2)
  savedWith: "1.38.0",                    // App-Version beim letzten Speichern
  created: "<ISO>", savedAt: "<ISO>",
  settings: { autoLockMin, limitSek1, limitMss, precision, testCat: "ka" | "other" /* seit 1.30 */, keepBackups, backupEveryMin, gradeColors,
              tabs: { "<Reiter>": false },   // seit 1.25: ausgeschaltete Reiter (Standard für alle Kurse)
              tabOrder: [ "<Reiter>" ],       // seit 1.34: Reihenfolge der Reiter (leer = Standard; fehlende Reiter hinter ihren Vorgänger)
              pomodoro: { enabled, count, work, short, long, tick: "off" | "work" | "always", alarm: "off" | "bell" | "gong" | "beep", volume } },
  criteriaPool: [ { id, group, name, desc: { 0, 1, 2, 3 } } ],   // Kriterien für Präsentationen (alle Kurse, seit 1.20)
  presTemplates: [ { id, name, criteria: [ { poolId, group, name, desc, weight } ] } ],   // Vorlagen (seit 1.21; Standardvorlagen seit 1.22)
  years:   [ { id, name: "2026/27" } ],
  courses: [ Course ]
}

Course = {
  id, yearId, klasse, fach, note,
  jahrgang: 5..13,                       // ≥ 11 → MSS (Punkte)
  type: "sek1" | "lk" | "gk" | "noka",
  wKa, wOther,                           // Gewichte in %
  wHalf1, wHalf2,                        // Jahresnote (Standard 1 : 2)
  tabs?: { "<Reiter>": true | false },   // seit 1.25: Abweichung vom Standard settings.tabs (fehlt = wie Standard)
  students: [ { id, last, first, active, iStatus?, photo?, email? } ],   // photo: JPEG als Data-URL, 160×160; email: Moodle-Adresse (Zuordnung beim Import)
  assessments: [ Assessment ],
  overrides: { "<Halbjahr>"|"Jahr": { "<studentId>": { p, reason } } },
  comments:  { "<studentId>": "Text" },
  seatingPlans?: [ { id, name, cols, rows, desk: "top" | "bottom", pos: { "<studentId>": { x, y } } } ],   // Räume
  seatingSaved?: [ { id, name, room, savedAt, cols, rows, desk, pos } ],                         // gespeicherte Stände
  draw: { out: { "<studentId>": { how: "drawn" | "manual", date } },   // klassischer Pool: nicht im Pool (gezogen / herausgenommen)
          history: [ { id, date, half, aid, sids: [ studentId ], prevOut } ],   // klassische Ziehungen; aid = angelegte Einzelnote
          pools: [ { id, name, half, aid, created, out, history: [ { id, date, sids, prevOut } ] } ] },   // seit 1.37: benannte Pools; aid = Sammelspalte
  groupSets: [ { id, name, date, opts?: { by: "size" | "count", n, mode: "random" | "mixed" | "similar", vary },
                 homeId?, homeSig?,   // Expertengruppen: id der Stammgruppen (erscheinen unter diesen) und deren Stand beim Bilden
                 groups: [ { id, name, members: [ studentId ], task?, locked? } ] } ],   // seit 1.24: Reiter „Gruppen“
  groupRules: { apart: [ [ studentId, studentId ] ], together: [ [ studentId, studentId ] ] },  // vertraulich, nie gedruckt
  randomCards: [ "Thema 1", … ]          // seit 1.29: eigene Karten im Reiter „Tools“ (je Eintrag eine Karte)
}

Assessment = {
  id, kind: "manual" | "test" | "epo" | "pres",
  half: "HJ1" | "HJ2" | "11/1" | … | "13",
  cat: "ka" | "other",
  name, date: "YYYY-MM-DD", weight, ungraded?,   // ungraded: zählt nicht zur Note
  manual?: { grades: { "<sid>": { p } | { status } } },
  test?:   { limit, precision, wholeGrades?,                            // wholeGrades: nur ganze Noten (Sek I)
             tasks: [ { id, name, max, bonus?, moodleNr?, partId? } ],   // moodleNr: Fragennummer in Moodle; partId: Teil
             custom: { "<p>": Mindestpunktzahl },
             parts?: [ { id, name, weight, limit?, precision?, custom?, wholeGrades?, moodle? } ],   // Arbeit in Teilen (seit 1.18)
             partMode?: "sum" | "separate",                       // gemeinsam bepunktet / getrennt benotet
             results: { "<sid>": { scores: { "<taskId>": Zahl }, status?, signed?, partStatus? } },   // signed: Datum „Unterschrift gesehen“; partStatus: { "<partId>": "fehlt" | "nachschreiben" }
             moodle?: { importedAt, totalMax,                                     // nur bei Moodle-Import
                        files: [ { name, kind: "answers" | "grades", text } ],    // Original-CSV-Dateien
                        answers: { "<sid>": { "<taskId>": { q, a, c } } } } },   // Frage, gegebene, richtige Antwort
  epo?:    { limit, points: { "++","+","0","-","--","u","h" },
             table: { strict: bool, mins: [ % je Punktstufe ] },
             lessons: [ { id, date } ],
             entries: { "<sid>": { "<lessonId>": { r: "++"|"+"|"0"|"-"|"--"|"k"|"", hw: "u"|"h"|"" } } } },
  pres?:   { limit, custom: { "<p>": Mindestpunktzahl }, wholeGrades?,
             criteria: [ { id, poolId, group, name, desc: { 0, 1, 2, 3 }, weight, scope?: "person" } ],   // Kopie aus dem Pool
             groupMode?: "mixed" | "group",   // seit 1.23: Gruppenpräsentation (fehlt = einzeln)
             groups?: [ { id, name, members: [sid], topic?, date?, note?, scores: { "<criterionId>": 0..3 } } ],
             results: { "<sid>": { scores: { "<criterionId>": 0..3 }, topic?, date?, note?, status? } } }
             // bei Gruppen: results[sid].scores eines Gruppenkriteriums = Abweichung vom Gruppenwert
}
```

`p` ist immer eine Punktzahl 0–15. `status` ∈ `fehlt`, `nachschreiben`, `taeuschung`; bei Test- und Präsentationsergebnissen zusätzlich `ungewertet` (Note wird berechnet, zählt aber nicht; Abfrage über `NM.grades.ungradedFor(a, sid)`).

Bei Arbeiten in Teilen gehören Aufgaben ohne gültige `partId` zum ersten Teil. Schlüsselfelder (`limit`, `precision`, `custom`, `wholeGrades`) und `weight` der Teile gelten nur bei `partMode: "separate"`; ein Moodle-Import in einen Teil speichert seine Daten in `parts[].moodle` (gleiche Struktur wie `test.moodle`).

`NM.model.migrate()` ergänzt beim Öffnen fehlende Felder. Neue Felder bitte dort mit Standardwert nachtragen.

## 25. Tests

### 25.1 Alle Tests auf einmal (empfohlen)

```bash
uv run --with websocket-client --with cryptography python tests/run_tests.py
# oder nach  pip install websocket-client cryptography :
python3 tests/run_tests.py
```

Das Skript startet einen unsichtbaren Chromium-Browser (Chrome, Edge, Chromium, Brave oder Thorium wird automatisch gefunden) und prüft:

1. alle Testseiten (siehe 25.2), danach die Datenbanken früherer Versionen (`tests/altdaten/`) in der App: alle Reiter beider Kurse und die Jahresnote ohne Fehler, „Datenbank prüfen“ ohne Probleme,
2. den Start der App im Demo-Modus und alle Reiter für einen Sek-I- und einen MSS-Kurs ohne JavaScript-Fehler, den Knopf „Demo ansehen“ (öffnet `?demo` im neuen Fenster, eigene Ansicht in `nm.ui` bleibt unberührt),
3. das Sortieren per Klick auf Spaltenköpfe (Tests, EPO, Notenübersicht; Richtung und leere Werte unten),
4. den Pomodoro-Timer (Aktivieren, Farben je Zustand, Phasenwechsel, Zurücksetzen, Einstellungsdialog), das Layout des Reiters „Einstellungen“ bei aktivem Timer (keine Lücken zwischen den Karten, Auswahllisten nicht abgeschnitten, bei 1570 und 2560 px) und die Kürzel in der eingeklappten Kursliste, die weichen Übergänge (nur bei Reiter-, Kurs- und Halbjahreswechsel), das Ein-/Ausklappen der Kursliste, das Ein-/Ausschalten von Reitern (Standard in den Einstellungen, Abweichung je Kurs, Ersatzreiter, Sprunglinks, „Wie Standard“), das Umsortieren der Reiter (▲▼, Ziehen in der Reiterleiste, Standardreihenfolge), das Einklappen der Spaltengruppen und Bündeln der Ziehungsspalten in der Notenübersicht (Noten unverändert, Zeitraum, Ausdruck vollständig), den Reiter „Tests“ in voller Breite, die Warnung bei zu wenig Punkten im Notenschlüssel (doppelte Schwellen markiert, Knöpfe „Halbe Punkte“/„Nur ganze Noten“ beheben sie), Arbeiten in Teilen (einschalten, Aufgaben und Punkte je Teil, Teil ausblenden, getrennt benoten, Status je Teil, Schlüssel je Teil, Ausdrucke inkl. „Ergebnisse nach Teilen“, Beamer, Teile aufheben), die Druckauswahl „🖨 Drucken …“ in Tests, EPO und Notenübersicht (Gruppen, Tooltips, Auswahl druckt, Abbrechen nicht) und den Haken „Unterschrift gesehen“ bei Klassenarbeiten (Zähler, Ausdruck), den Moodle-Import (Knopf im Test statt neben „+ Neuer Test“, bisherige Aufgaben ersetzen oder behalten, Dateiauswahl im Dialog, Zuordnung, Status „fehlt“, Ausdruck mit und ohne Note, erneuter Import),
5. den Excel-Export der Schülerliste (gültiges ZIP/XML, Umlaute und Sonderzeichen), das Kurs-Löschen nur mit „LÖSCHEN“, das Ein-/Ausblenden der Fotos im EPO-Reiter und im Sitzplan (auch im Druck) das Erweitern/Verkleinern des Sitzplan-Rasters an allen vier Seiten sowie das Ziehen (keine Wiederholung bis zum Auffüllen, automatisches Auffüllen, Note, Rückgängig, Abwesende/Herausgenommene) und die benannten Pools (Sammelspalte, eine Runde bis fertig, Rückgängig, Prüfung, Notenübersicht, Zusammenfassen, Löschen ohne Notenverlust), den Reiter „Tools“ (Timer: Start/Pause, läuft beim Reiterwechsel weiter, Ende mit Signal, ± 1 Min., Schnellwahl, vier Designs, Pop-up steuert denselben Timer; Einstellungen aller Werkzeuge werden gemerkt; Zahl im Bereich, Personen ohne Wiederholung und ohne Abwesende, 3D-Würfel mit Summe und gewürfelter Seite oben, Karten 52/32/eigene als Bild, Stapel immer sichtbar, mehrere auf einmal, nichts in der Notenliste) und den Reiter „Präsentationen“ (Bewerten per Knopf und in der Tabelle, Gewicht, Kriterien aus dem Pool und eigene, Vorlage, Ausdrucke, Spalte in der Notenübersicht, Pool bearbeiten, Startbestand ergänzen, Vorlagen speichern/anlegen/verwenden/drucken/löschen, Standardvorlagen vorhanden und ergänzen, Handreichung mit Notenschlüssel) und Gruppenpräsentationen (Gruppenwert für alle Mitglieder, Personenkriterien, Abweichung setzen/zurücksetzen, Tabelle, Gruppen bearbeiten/übernehmen, Druck, Auflösen ohne Notenänderung), den Reiter „Gruppen“ (neue Einteilung, Abwesende, Fixieren, Anklicken/Ziehen, Auftrag, Regel mit Warnung, Beamer ohne Noten mit Schrift passend zum Bildschirm und Umschaltern für Fotos/Nachnamen, Druck, Fotos/Nachnamen in der Einteilung, Gruppenpuzzle mit Expertengruppen unter den Stammgruppen, Anzahl der Teilthemen einstellbar und beim Neu verteilen erhalten, Hinweis nach Änderungen, Beamer-Umschalter Stamm-/Expertengruppen, Übernahme in eine Präsentation),
6. das Notfallwerkzeug: Eine von der App echt verschlüsselte Datenbank wird mit `tools/entschluesseln.py` per Passwort und per Wiederherstellungsschlüssel entschlüsselt und mit dem Original verglichen. Dazu kommen falsches Passwort, manipulierte Datei und CSV-Ausgabe (auch für die Datenbanken aller früheren Versionen aus `tests/altdaten/`),
7. das Startprogramm (nur wenn Go installiert ist, sonst übersprungen): `go test` in `launcher/` (Programmsymbol ohne Schriftzug, Zugriffsschutz, nur erlaubte Dateien, Speichern und Konflikt, Sicherungen, Konfliktkopien, Lock, Datenordner wählen, Kennwort, Programmordner finden), dann ein echter Start mit Testordner: Zugriff ohne Kennwort abgelehnt, zweiter Start erkennt das laufende Programm, die App erkennt das Startprogramm, legt eine Datenbank an (ohne Rückfrage), speichert Änderungen in den Ordner (mit dem Notfallwerkzeug geprüft), erkennt eine externe Änderung, überschreibt auf Wunsch, stellt aus einer Datei mit fremdem Passwort wieder her (eigenes Passwort bleibt), wechselt den Datenordner mit Sicherungen (alter Ordner bleibt, neuer gemerkt, danach wird dort gespeichert), übernimmt in einem leeren Ordner eine Datenbank aus einer Datei und gibt den Lock beim Beenden frei.

Am Ende steht `ERGEBNIS: x von y bestanden`. Der Exit-Code ist 0, wenn alles bestanden ist.

> **Regel:** Vor jedem Einspielen einer geänderten Version müssen alle Tests bestehen.

### 25.2 Einzelne Testseiten

| Datei | Prüft | Ausführen |
|---|---|---|
| `tests/grades.test.html` | Skalen, Eingabe-Parser, Rundung, Notenschlüssel (Vergleich mit Excel-Formeln), Bonus/Kappung, Status, Drittelparagraph, EPO (Werte aus der bisherigen EPO-Liste), Halbjahres-/Jahresnote, GK-Gewichtung, nicht erreichbare Stufen (zu wenig Punkte, eigene Schwellen, Präsentationen), Präsentationen (Gewicht, Status, Schlüssel, Halbjahresnote, Gruppen: Gruppenwert, Abweichung, Personenkriterium, Modus „alles als Gruppe“), Arbeiten in Teilen (gemeinsam/getrennt, Gewichte, fehlender Teil, Status je Teil, ganze Noten je Teil, MSS) | im Browser öffnen |
| `tests/model.test.html` | Migration älterer Datenbanken (SCHEMA 1 → 4, Bereich neuer Tests, Kriterienpool, Startbestand ergänzen, Vorlagen, Standardvorlagen), neue Präsentation, Ablehnung neuerer Datenformate, Erhalt unbekannter Felder, Reiterauswahl (`settings.tabs`, `course.tabs`), Reihenfolge der Reiter (`orderTabs`, `moveTab`), Namensliste | im Browser öffnen |
| `tests/update.test.html` | Datenbanken früherer Versionen (Prüfstücke 1.1–1.29 in `tests/altdaten/`, je Datenformat mindestens eins): öffnen, Strukturprüfung ohne Fehler, **gleiche Halbjahres- und Jahresnoten wie in der alten Version**, unbekannte Felder bleiben, zweites Öffnen ändert nichts; `NM.model.check` findet kaputte Halbjahre, Bereiche, fehlende Inhalte, doppelte Personen, fehlende Schuljahre und ändert nichts | im Browser öffnen |
| `tests/moodle.test.html` | CSV-Zerlegung, Erkennen und Zusammenführen von Antworten-/Bewertungen-CSV, bester Versuch, Textvergleich ohne Bewertungen, Zuordnung (Name, gemerkte E-Mail), Übernahme als Test, Import in einen bestehenden Test (Aufgaben ersetzen/behalten, Bezeichnung und Datum übernehmen), „fehlt“, erneuter Import, skalierte Punkte, Import in einen Teil (auch mit Ersetzen) | im Browser öffnen |
| `tests/groups.test.html` | Gruppengrößen (Rest verteilt), Verteilung (alle genau einmal), Regeln „nicht zusammen“/„zusammen“, leistungsgemischt/-gleich, fehlende Noten, Abwechslung (auch Minimum), Expertengruppen (Standard und einstellbare Anzahl, gleich große Gruppen, kein Thema doppelt), Migration | im Browser öffnen |
| `tests/random.test.html` | Zufallszahl (Bereich, vertauschte Grenzen), Personenauswahl (ohne Wiederholung, Neubeginn), Kartenstapel 52/32/eigene, Würfelkörper W4–W20 (Flächenzahl, eben, Beschriftung, Gegenseiten n + 1, gewürfelte Seite liegt am Ende genau oben), Migration | im Browser öffnen |
| `tests/timer.test.html` | Countdown: Start/Pause/Weiter, Restzeit aus der Startzeit, Farbstufen (letzte Minute, letztes Fünftel, letzte 10 s), Ende und Überzeit, Neustart nach dem Ende, ± Minuten (nicht unter 0), Anzeige mm:ss/h:mm:ss, Eingaben `5`, `2,5`, `4:30`, `1:05:00`, `90s` und ungültige | im Browser öffnen |
| `tests/draw.test.html` | Ziehen: klassisches Auffüllen, benannter Pool (eine Spalte, Abwesende, eine Runde bis fertig, Zeitraum), Ziehfehler (ohne Note, doppelt, Note ohne Ziehung, Spalte fehlt), Rückgängig nur der letzten Noten, Zusammenfassen (Konflikte, neuere/bessere Note, Einzelspalten entfernt), Pool löschen ohne Spalte zu löschen, Migration | im Browser öffnen |
| `tests/pomodoro.test.html` | Ablauf der Phasen (mit/ohne kurze bzw. lange Pause), Standardwerte, Migration der Einstellungen | im Browser öffnen |
| `tests/crypto.test.html` | Anlegen, Entsperren, falsches Passwort, Wiederherstellungsschlüssel, Passwortwechsel, alte Sicherungen, Manipulationserkennung | im Browser öffnen (dauert einige Sekunden) |
| `tests/storage.test.html` | Schreiben/Lesen, rollierende Sicherungen, externe Änderung, erzwungenes Überschreiben, Lock-Datei, Konfliktkopie, Datenordner wechseln (mit/ohne Sicherungen, Ziel nie überschreiben) | **über `http://localhost`**, z. B. `python3 -m http.server` im Programmordner, dann `http://localhost:8000/tests/storage.test.html` |

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
| `APP_VERSION` (z. B. `1.29.0`) | Programmversion. Wird beim Speichern in der Datenbank vermerkt und unter Einstellungen angezeigt. Dieselbe Nummer steht als `?v=1.29.0` hinter jeder CSS-/JS-Datei in `index.html`, damit der Browser keine veraltete Fassung aus dem Zwischenspeicher lädt. | bei jeder veröffentlichten Änderung (beide Stellen) |
| `SCHEMA` (z. B. `4`) | Version des Datenformats (2 seit 1.18: Arbeiten in Teilen; 3 seit 1.20: Präsentationen; 4 seit 1.23: Gruppenpräsentationen) | nur, wenn eine **ältere** App-Version die neuen Daten falsch verstehen würde (z. B. ein Feld ändert seine Bedeutung) |

Öffnet eine App eine Datenbank mit höherem `SCHEMA`, verweigert sie das mit einer Meldung (siehe 21.10). Neue, nur *zusätzliche* Felder brauchen kein neues `SCHEMA`: Ältere Versionen lassen unbekannte Felder unverändert und speichern sie mit.

### 26.3 Sicher erweitern – Checkliste

1. Vorher **Sicherung** anlegen (Einstellungen → Jetzt sichern).
2. Änderung in einem eigenen Git-Zweig vornehmen (`git switch -c funktion-xyz`).
3. Gerechnete Werte nie speichern, sondern aus Rohdaten berechnen (wie bisher).
4. Neue Felder mit Standardwert in `NM.model.migrate()` eintragen. Bei inkompatiblen Änderungen `SCHEMA` erhöhen.
5. Tests ergänzen und **`tests/run_tests.py` ausführen – alles muss bestehen.** Dabei werden auch die Prüfstücke früherer Versionen geöffnet (`tests/altdaten/`). Ändert sich eine Rechenregel absichtlich, schlägt der Notenvergleich fehl; dann die Änderung bewusst prüfen und die betroffenen Prüfstücke nur mit Begründung im Commit anpassen. Nach einer Version mit neuem Datenformat ein Prüfstück dazunehmen: Commit in `VERSIONEN` von `tests/altdaten/erzeugen.js` eintragen, `deno run --allow-run=git --allow-write=tests/altdaten tests/altdaten/erzeugen.js` ausführen und die neue Datei in `tests/update.test.html` einbinden.
6. Erst im Demo-Modus (`index.html?demo`) ausprobieren, dann mit der echten Datenbank.
7. `APP_VERSION` erhöhen, committen, auf allen Geräten einspielen.

### 26.4 Wo was geändert wird

- **Rechenregeln ändern:** ausschließlich in `js/grades.js`. Danach `tests/grades.test.html` anpassen und ausführen.
- **Neuer Reiter:** Datei `js/view-name.js` mit `NM.views.name = { render(view, { course, db }) }` anlegen, in `index.html` einbinden und in `TABS` in `js/app.js` eintragen. Soll er sich ausschalten lassen, zusätzlich in `OPTIONAL_TABS`; ob ein Reiter im Kurs an ist, fragt `NM.app.tabOn(course, id)` ab (z. B. vor Sprunglinks).
- **Sortierbare Spalte:** `NM.ui.sorter(tabelle, { schlüssel: { get: (s) => Wert, first: 'asc' | 'desc' } })` liefert `rows()` zum Ordnen der Schülerliste sowie `head()`, `toggle()` und `nameHeads()` für die Spaltenköpfe; die passenden Namenszellen erzeugt `NM.ui.nameCells(s, nr)`.
- **Moodle-Import:** Einlesen und Übernehmen in `js/moodle.js` (Tests: `tests/moodle.test.html`), Dialog und Karte in `js/view-tests.js`, Ausdruck `NM.print.moodle` in `js/print.js`.
- **Ausdrucke:** neue Ausdrucke in die Druckauswahl „🖨 Drucken …“ (`NM.ui.printButton`) eintragen, kein eigener Knopf.
- **Arbeit in Teilen (seit 1.18):** Logik in `js/grades.js` (`hasParts`, `separateParts`, `taskGroups`, `partAsTest`, `keyForPart`, `partStats`; `testResult()` liefert `parts`), Oberfläche in `js/view-tests.js` (`partsCard`, Teilspalten, Schlüssel je Teil), Druck `NM.print.test(…, 'parts')`.
- **Präsentationen (seit 1.20):** Logik in `js/grades.js` (`presAsTest`, `presResult`, `presStats`, `keyForPres`; Präsentation = Test mit Kriterien als Aufgaben, 3 × Gewicht), Modell `NM.model.newPres`/`presCriterion`/`defaultCriteriaPool`/`newPresTemplate`, Standardvorlagen `PRES_TEMPLATES` mit `defaultPresTemplates(pool)` und `missingDefaultTemplates`, Reiter `js/view-pres.js`, Druck `NM.print.pres(course, a, 'list' | 'key' | 'blank' | 'sheets')` und `NM.print.presGuide`. Die Schlüsselkarte teilt sich der Reiter mit den Tests (`NM.views.tests.keyCardFor`).
- **Gruppenpräsentationen (seit 1.23):** Logik in `js/grades.js` (`presGroupOf`, `presCritIsGroup`, `presScores`, `presDeviation`, `presTopic`), Oberfläche in `js/view-pres.js` (`setGroupMode`, `groupsCard`, `groupRateCard`, `personRateCard`).
- **Tools (seit 1.29 als „Zufall“, seit 1.36 „Tools“ mit Timer):** Timer-Logik in `js/timer.js` (`NM.timer`), Anzeige `timerTool`/`timerFace` (Designs ring, digits, bar, hourglass) und Pop-up `openTimerPopup` in `js/view-random.js`; ein Timer für die ganze App (`clock`), alle Anzeigen in `clock.faces`, Signal über `NM.pomodoro.alarm`. Zufalls-Logik in `js/random.js` (`NM.random`), Reiter `js/view-random.js` (`numberTool`, `peopleTool`, `diceTool` mit eigenem Canvas-3D-Zeichner `paintDie`, `cardTool` mit `flyIn`). Kartenbilder in `cards/` (`<Farbe C/D/H/S><Wert 2–10/B/D/K/A>.svg`, `back.svg`, CC0); ein neuer App-Ordner muss auch in `staticAllowed` (`launcher/server.go`) und in `launcher/build.sh`. Ergebnisse und Stapel nur in der Sitzung (`NM.views.random.session`), Einstellungen pro Gerät in `nm.ui` (`ui.random`), eigene Karten in `course.randomCards`. „Heute abwesend“ aus `NM.views.draw.absent`. Tests: `tests/random.test.html`, E2E `run_random_check`.
- **Demo öffnen (seit 1.31):** `NM.app.openDemo()` (`js/app.js`) öffnet die eigene Adresse mit `?demo` in einem neuen Fenster; Knöpfe über `demoLink()` auf den Startseiten (`renderStart`, `renderCreate`) und in `infoCard` (`js/view-settings.js`). Die Demo speichert ihre Ansicht unter `nm.ui.demo` (`UI_KEY`). E2E `run_demo_link_check`.
- **Update-Sicherheit (seit 1.33):** Strukturprüfung `NM.model.check(db)` (`js/model.js`, rein, liefert `{ level: 'fehler' | 'hinweis', where, text }`), Aufruf nach dem Entsperren in `unlock` (`js/app.js`, nur Meldung) und im Dialog `checkDialog` (`js/view-settings.js`). Prüfstücke früherer Versionen in `tests/altdaten/` (erzeugt mit `erzeugen.js` aus dem Git-Verlauf), geprüft in `tests/update.test.html`, E2E `run_old_db_check` und in `run_decrypt_tool`. Neue Felder in `check` aufnehmen, wenn ein fehlerhafter Wert die Rechnung stören würde.
- **Reihenfolge der Reiter (seit 1.34):** `settings.tabOrder`; reine Logik `NM.model.orderTabs`/`moveTab`, in der App `NM.app.orderedTabs()` (überall statt `TABS` verwenden, wo Reiter angezeigt werden) und `NM.app.setTabOrder()`. Ziehen in der Reiterleiste in `renderMain` (`js/app.js`), ▲▼ in `tabOrderList` (`js/view-settings.js`), Haken in `NM.ui.tabChecks`. E2E `run_tab_order_check`.
- **Notenübersicht einklappen/bündeln (seit 1.35):** `halfCard` in `js/view-overview.js` (`ui.ovFold = { ka, other, draw }` pro Gerät, `drawRange`, `bundleCell`). Ziehungsspalten = Einzelnoten, deren id in `course.draw.history[].aid` steht. Ausdrucke (`NM.print.course`) sind unabhängig davon. E2E `run_overview_fold_check`.
- **Ziehen-Pools (seit 1.37):** Logik `js/draw.js` (`NM.draw`), Reiter `js/view-draw.js` (`poolPicker`, `renderPool`, `checkCard`, `mergeDialog`; klassischer Pool weiter über `drawStudents`/`pool`). Gewählter Pool pro Gerät in `ui.drawPool`. Wer für eine Spalte gezogen wurde: `NM.draw.drawnSets` (Notenübersicht), Zeitraum im Kopf über `poolSub` (`js/view-overview.js`) und `drawDate` (`js/print.js`). Strukturprüfung der Pools in `NM.model.check`. E2E `run_draw_pools_check`.
- **Gruppenbildung (seit 1.24):** Logik in `js/groups.js` (`sizes`, `build` mit Kostenfunktion und Tauschsuche, `check`, `experts`), Reiter `js/view-groups.js` (`roll`, `expertCard`), Druck `NM.print.groups`, Übernahme in Präsentationen `NM.views.pres.applyGroups`. „Heute abwesend“ kommt aus `NM.views.draw.absent` (nur Sitzung). Leistung = gerundete Halbjahresnote (`G.halfResult(...).final`), nie gespeichert. Tests: `tests/groups.test.html`, E2E `run_groups_tab_check`.
- **Reiter ausschalten (seit 1.25):** `NM.app.OPTIONAL_TABS`, `tabOn(course, id)`, `shownTab(course)` (Ersatz: Notenübersicht, sonst „Kurs & Schüler“), Haken über `NM.ui.tabChecks`. Daten ausgeschalteter Reiter bleiben und zählen weiter. E2E `run_tabs_check`.
- **Notenschlüssel-Warnung:** `G.unreachableSteps(key)` meldet nicht erreichbare Stufen; Warnung mit Schnellknöpfen in `NM.views.tests.keyCardFor` (Tests, Teile, Präsentationen).
- **Neue Kursart:** Eintrag in `COURSE_TYPES` in `js/grades.js`.
- **Farben:** Tokens oben in `css/app.css` (`:root` hell, darunter dunkel).
- **Änderungen am Datenmodell:** Standardwerte in `NM.model.migrate()` ergänzen, damit bestehende Datenbanken weiter funktionieren. Bei inkompatiblen Änderungen `SCHEMA` erhöhen.
- **Startprogramm:** Quelltext in `launcher/` (Go, nur Standardbibliothek), Tests `launcher/server_test.go`, `icon_test.go`, `desktop_linux_test.go` (laufen in `run_tests.py` mit, E2E `run_launcher_check`). Neue Schnittstellen immer in `server.go` und `ServerStore` (`js/storage.js`) zugleich, mit derselben Bedeutung wie in `FolderStore`. Ordnerwechsel: `store.pickTarget()` → `{ name, hasDb, same }`, `store.moveTo(ziel, { backups })`, `Store.useTarget(ziel)` (ohne Kopieren); Oberfläche `changeFolder`, `restoreFromFile` in `js/view-settings.js`, `importFromFile`/`NM.app.switchStore` in `js/app.js`, Dateiauswahl `NM.util.pickFile`. Neue Ordner mit App-Dateien in `staticAllowed` (`server.go`) und in `build.sh` eintragen. Bauen: `launcher/build.sh`.
- **Neue Version einspielen:** Programmordner (`index.html`, `css/`, `js/`) ersetzen; für das Startprogramm mit eingebauten Dateien vorher `launcher/build.sh` laufen lassen. Der Datenordner bleibt unberührt. Vorher eine Sicherung anlegen.
