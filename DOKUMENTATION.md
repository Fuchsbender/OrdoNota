# OrdoNota – Dokumentation

Version 2.7.0 · Stand November 2026

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
    - [9a. Reiter „Kompetenzen“](#9a-reiter-kompetenzen)
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
| Mindeststand der Browser (seit 2.0) | Chrome/Edge 120, Firefox 117, Safari/iOS 17.2. Das gemeinsame Design braucht CSS-Ebenen (`@layer`), verschachteltes CSS und `light-dark()`; ältere Browser zeigen die App falsch an. |
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
css/              ← Gestaltung (gemeinsames Design der Ordo-Apps, siehe 22.2)
js/               ← Programmlogik
schrift/          ← Schrift für Überschriften („Ordo Josefin“, gekürzte Fassung von Josefin Sans)
lizenzen/         ← Lizenztexte der Bestandteile des gemeinsamen Designs
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

**„Demo ansehen“** (auf dem Startbildschirm und unter Einstellungen → Hinweise) oder die Adresse `index.html?demo` öffnet die App mit Beispieldaten (Kurs 8b Mathe, Sek I, und MSS 12 M LK). Enthalten sind u. a. Arbeiten in Teilen (8b, 2. HJ: „KA 2 – Geometrie“, zwei Teile gemeinsam bepunktet; MSS 12: „Kursarbeit 2 – Analysis“, drei Teile getrennt benotet mit Gewicht 1 : 2 : 1, eine Person mit fehlendem Teil) und Präsentationen (8b, 2. HJ: „Referat Statistik“ und „HA vorstellen“ nach der Standardvorlage, „Gruppenpräsentation Zufall“ mit drei Gruppen, Personenkriterien und einer Abweichung; Reiter „Gruppen“: „Stationenlernen Prozent“ mit Aufträgen und einer Regel; MSS 12: „Kurzvortrag Extremwerte“). Kurs 8b hat den Kompetenzkatalog „Mathematik Sek I“; in „KA 1 – Terme“ sind den Aufgaben Kompetenzen zugeordnet (Abschnitt 7.11). Der Knopf öffnet die Demo in einem neuen Fenster, auch im Startprogramm, wo sich die Adresse nicht ändern lässt; die eigene Datenbank bleibt dabei offen und unverändert. Die Demo merkt sich ihren gewählten Reiter und Kurs getrennt (`nm.ui.demo`). Statt echter Fotos hat jede Person ein Personensymbol, damit sich Sitzplan und Fotoanzeige im EPO ausprobieren lassen. **Nichts wird gespeichert.** Der Demo-Modus eignet sich zum Ausprobieren und Kennenlernen. Zum Ausprobieren des Moodle-Imports (Abschnitt 7.7) liegen im Ordner `demo/` eine Antworten- und eine Bewertungen-CSV, deren Namen zum Kurs 8b Mathe passen.

### 3.6 Start mit dem Startprogramm (ohne Rückfrage)

Statt `index.html` per Doppelklick zu öffnen, können Sie OrdoNota über das **Startprogramm** starten. Es öffnet die App als eigenes Fenster, und der Browser fragt nie nach dem Ordnerzugriff, weil das Startprogramm die Dateien selbst schreibt. Es braucht keine Installation (kein Python o. Ä.) und funktioniert unter Linux, Windows und macOS.

| System | Datei | Start |
|---|---|---|
| Linux | `OrdoNota` (im Programmordner) bzw. `OrdoNota-Linux` | Doppelklick oder `./OrdoNota`. Beim ersten Start legt das Programm den Eintrag „OrdoNota“ im Startmenü an (`~/.local/share/applications/OrdoNota.desktop`, passend zur Fensterklasse `OrdoNota`; ein alter `ordonota.desktop` bis 1.37.0 wird ersetzt) und erneuert den Menü-Cache (`kbuildsycoca6`, sonst `update-desktop-database`). Wurde das Programm verschoben, genügt ein Start vom neuen Ort aus. Startmenü und Taskleiste zeigen das Zeichen ohne Schriftzug (`logo/ordonota-icon.svg`). Unter Wayland übergeht Chromium die Fensterklasse und meldet `<Browser>-127.0.0.1__start-Default` (z. B. `chromium-…`, `chrome-…`, `thorium-…`); dafür legt das Programm seit 1.43.1 je Browser einen versteckten Eintrag mit dem Symbol an, sonst zeigt KDE das Browser-Symbol bzw. das Wayland-„W“. |
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
│ OrdoNota      [Schuljahr 2026/27 ▾]      Gespeichert 10:14 [Hell Dunkel Auto] Sperren │ ← Kopfzeile
├─────────────┬────────────────────────────────────────────────────────┤
│ KURSE       │ Kurs & Schüler | Tests | Mitarbeit/EPO | Notenübersicht │  ← Reiter
│   8b Mathe  │                                                        │
│   MSS 12 LK │   … Inhalt des Reiters …                               │
│ + Kurs      │                                                        │
│ Personen    │                                                        │
└─────────────┴────────────────────────────────────────────────────────┘
```

| Element | Funktion |
|---|---|
| **Schuljahr-Auswahl** | Wechselt das Schuljahr. „+ Neues Schuljahr …“ legt ein neues an. |
| **Speicherstatus** | „Speichert …“, „Gespeichert 10:14“, „Ungespeicherte Änderungen“ oder rot „Nicht gespeichert!“ |
| **Schalter Hell / Dunkel / Wie das System** | Drei Knöpfe mit Sonne, Mond und Bildschirm (ersetzt das frühere Mond-Symbol). Sie wechseln den Modus, jeweils im gewählten Design; „Wie das System“ folgt der Einstellung des Betriebssystems. Die sechs Designs wählen Sie weiter in den Einstellungen (Einstellungen → Darstellung). |
| **Schalter „Große Schrift“** | Ein Knopf mit zwei Buchstaben (Symbol „Textgröße“) vergrößert die ganze Oberfläche auf 125 %, für Beamer und Tafel. Die Wahl wird auf dem Gerät gemerkt. Auf schmalen Bildschirmen (Handy) ist der Schalter ausgeblendet. |
| **Sperren** | Speichert, entfernt den Geräte-Hinweis und sperrt die Datenbank |
| **Reiter** | Kurs & Schüler, Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht, Sitzplan, Einstellungen (in der Skizze aus Platzgründen gekürzt). Beim Wechsel von Reiter, Kurs oder Halbjahr blendet der Inhalt weich ein und der Unterstrich gleitet zum neuen Reiter; beim Eintragen von Werten gibt es keine Animation. Bei „Bewegung reduzieren“ im Betriebssystem entfällt beides. Nicht benötigte Reiter lassen sich ausschalten (Einstellungen → Reiter, je Kurs in „Kurs & Schüler“, siehe 6.4). **Reihenfolge ändern:** einen Reiter mit der Maus an eine andere Stelle der Reiterleiste ziehen (eine farbige Linie zeigt, wo er landet) oder unter Einstellungen → Reiter → Reihenfolge mit den Pfeilen nach oben und unten. Die Reihenfolge gilt für alle Kurse und alle Geräte; „Standardreihenfolge“ stellt sie zurück. |
| **Kursliste** | Kurse des gewählten Schuljahres, sortiert nach Jahrgang. Zeigt Stufe (Sek I/MSS) und Zahl der aktiven Schüler/innen. der **Pfeil nach links** neben „Kurse“ klappt die Liste gleitend nach links ein (ohne Animation, wenn im Betriebssystem „Bewegung reduzieren“ eingestellt ist): Es bleibt eine schmale Leiste mit Kürzeln (Klasse und Fach, voller Name beim Darüberfahren), über die sich weiter Kurse wechseln lassen; der **Pfeil nach rechts** klappt sie wieder aus. Der Zustand wird auf diesem Gerät gemerkt. |
| **Personen** | Unter „+ Kurs anlegen“ (eingeklappt als Symbol mit zwei Köpfen) öffnet die Seite „Personen“ mit dem Personenregister, siehe 6.6. Sie hat keine Kursreiter und geht auch ohne Kurs. Ein Klick auf einen Kurs führt zurück zur Notenübersicht. |
| **Halbjahres-Umschalter** | In Tests, EPO und Notenübersicht: HJ1/HJ2 bzw. 11/1, 11/2, 12/1, 12/2, 13; in der Notenübersicht zusätzlich „Jahresnote“ |

**Aussehen seit 2.0:** Die Oberfläche folgt dem gemeinsamen Design der Ordo-Apps. Der Standard hat eine warme, helle Grundfarbe (im dunklen Modus bleibt er dunkel). Knöpfe und Eingabefelder sind 40 px hoch, auf Touch-Bildschirmen (Tablet) 44 px, damit man sie gut trifft. Die Reiter stehen in einer eigenen Leiste, der aktive Reiter ist unterstrichen. Knöpfe tragen kleine Symbole statt Emoji; wo ein Knopf nur ein Symbol hat, steht der Name im Tooltip (Maus darüberhalten). Leere Ansichten zeigen einen kurzen Hinweis mit einem Knopf für den nächsten Schritt.

**Sortieren:** Alle Schülertabellen (Kurs & Schüler, Tests, Mitarbeit/EPO, Notenübersicht, Jahresnote) lassen sich nach jeder Spalte sortieren. Ein Klick auf den Spaltenkopf sortiert, ein zweiter dreht die Richtung um; ein kleiner Pfeil nach oben oder unten zeigt die aktive Spalte. Name und Vorname stehen in eigenen Spalten, die beim seitlichen Scrollen stehen bleiben (zu lange Namen werden mit „…“ gekürzt, der volle Name erscheint beim Darüberfahren). Ein Klick auf „Name“ stellt die alphabetische Reihenfolge wieder her. Wo der Spaltenkopf schon eine Funktion hat (Stunden im EPO, Leistungen in der Notenübersicht), sortiert das kleine Sortier-Symbol (zwei Pfeile) darunter.
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
| Kompetenzkatalog (seit 2.9) | Katalog, aus dem Sie in den Tests die Kompetenzen je Aufgabe wählen (siehe 7.11), oder „— keiner —“. Tragen Sie das Fach ein, solange kein Katalog gewählt ist, wählt die App den Katalog mit passendem Fach („Mathe“ passt zu „Mathematik“) und meldet das. Beim Kopieren des Kurses wird der Katalog übernommen. |
| Jahrgangsstufe | 5–13. **Ab 11 wird in MSS-Punkten gerechnet.** Bestimmt auch die Halbjahre. |
| Kursart | Setzt die Standardgewichtung (siehe Tabelle). Kursart und Jahrgang werden passend gehalten: Wählen Sie „MSS-Leistungskurs“ oder „MSS-Grundkurs“ bei Jahrgang 5–10, springt der Jahrgang auf 11 (bzw. 12/13, wenn das unter „Klasse / Stufe“ steht, z. B. „MSS 12“); „Sek I“ bei Jahrgang 11–13 setzt ihn auf 10. Ein Hinweis zeigt die Änderung an. |
| Gewicht Klassen-/Kursarbeiten (%) | Anteil der schriftlichen Arbeiten. Das andere Feld passt sich automatisch an (Summe 100 %). |
| Jahresnote: Gewicht 1. HJ : 2. HJ | Nur für Jahrgang 5–11; Standard 1 : 2 (⅓ : ⅔) |
| Einstufung | Sek I: **undifferenziert** (Standard), **G-Kurs**, **E-Kurs**, **E1-Kurs** oder **E2-Kurs**. Oberstufe (ab Jahrgang 11): **undifferenziert**, **Grundkurs** oder **Leistungskurs**; wird die Kursart auf MSS-Grund- oder -Leistungskurs gestellt, übernimmt die Einstufung sie (solange sie undifferenziert, GK oder LK ist). Gilt für alle im Kurs; einzelne Personen lassen sich in der Schülerliste anders einstufen (siehe 6.2). Sind schon Personen abweichend eingestuft, fragt die App beim Ändern, ob die neue Einstufung auch für sie gelten soll (**„Für alle setzen“**) oder ob ihre Abweichung bleibt (**„Abweichungen behalten“**). Gebraucht u. a. für die Import-Datei von OrdoScripto (siehe 7.9) |
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

> Ändern Sie die Jahrgangsstufe eines Kurses mit vorhandenen Noten, ordnet die App die Leistungen den neuen Halbjahren zu (erstes zu erstem, zweites zu zweitem) und fragt vorher nach. Wechselt dabei die Skala (Sek I ↔ MSS), bekommen Tests und EPO-Blöcke, die noch das Standard-LIMIT der alten Stufe haben, die Standardwerte der neuen Stufe (z. B. LIMIT 50 % → 45 %). Ein EPO-Block mit einer eingebauten Vorlage (8.3) bekommt dieselbe Vorlage für die neue Stufe; von Hand geänderte Werte und eigene Vorlagen bleiben.
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

**Diese Namen gibt es schon:** Stehen im Personenregister schon Personen mit genau demselben Vor- und Nachnamen (Groß- und Kleinschreibung und Leerzeichen am Rand zählen nicht), die nicht schon in diesem Kurs sind, fragt die App vor dem Übernehmen nach, etwa beim neuen Schuljahr. Je Name steht eine Zeile mit den bisherigen Kursen. Gibt es genau eine solche Person, ist der Haken „dieselbe Person“ schon gesetzt; bei mehreren wählt man aus einer Liste (Standard: „neue Person“). **„Übernehmen“** verknüpft wie gewählt, **„Alle als neue Personen“** verknüpft nichts, **„Abbrechen“** übernimmt keine Namen. Ohne Treffer gibt es keine Frage.

**Bearbeiten:** Nach- und Vornamen direkt in der Tabelle ändern. Steht die Person nur in diesem Kurs, ändert sich ihr Name im Personenregister still mit. Steht sie in weiteren Kursen, fragt die App: **„Im Register ändern“** oder **„Nur in diesem Kurs“**; die anderen Kurse behalten ihren Namen in jedem Fall. Bei **„+ Einzeln hinzufügen“** entsteht zunächst eine Zeile ohne Namen. Sobald Vor- und Nachname eingetragen sind und es genau eine Person mit diesem Namen gibt, die nicht im Kurs steht, fragt die App, ob es dieselbe Person ist.

**I-Status:** Der I-Status (Inklusionsstatus) gilt für Personen mit Förderplan, die zieldifferent gefördert werden. Er wird je Kurs gesetzt, weil die Förderung je Fach verschieden sein kann. Ein Haken in der Spalte **„I-Status“** markiert die Person in allen Tabellen mit einem **I** hinter dem Namen, in Lehrerlisten (Ergebnisliste, Notenliste, Bewertungsliste) mit „(I)“. Auf Ergebnis- und Mitarbeitszetteln und Leistungsbögen erscheint die Markierung nicht. Noten von Personen mit I-Status zählen **nicht in die Statistik**: Notenspiegel, Ø Note, Anzahl je Note, Drittelparagraph, „Ø gelöst“ je Aufgabe und Beamer-Ansicht berücksichtigen sie nicht. Unter dem Notenspiegel steht dann „Ohne n Personen mit I-Status“ (nicht in der Beamer-Ansicht). Ihre eigenen Noten werden ganz normal berechnet. In Tests bekommen sie eine **Verbalbeurteilung**, die auf dem Ergebniszettel statt der Note steht (siehe 7.10).

**Einstufung je Person:** Die Spalte **„Einst.“** zeigt die Einstufung jeder Person (Sek I: undiff., G, E, E1, E2; Oberstufe: undiff., GK, LK). Standard ist die Einstufung des Kurses (6.1). Wer abweichend eingestuft ist, etwa ein E2-Kurs mit einzelnen E1-Personen oder ein gemeinsam unterrichteter LK mit GK-Personen, bekommt hier einen anderen Wert. Abweichungen sind farbig umrandet. Wählt man wieder den Wert des Kurses, gilt die Person als „wie der Kurs“ und folgt späteren Änderungen am Kurs.

**Zu- und Abgänge:** Bei einem Abgang den Haken **„Aktiv“** entfernen. Die Person bleibt mit allen Noten gespeichert, erscheint aber nicht mehr in Eingabetabellen, Ausdrucken und Exporten. Das **Kreuz** am Zeilenende löscht die Person samt aller Noten in diesem Kurs endgültig. Steht sie in keinem anderen Kurs, bietet die Rückfrage den Haken **„Auch aus dem Personenregister löschen“** an (standardmäßig aus). Ohne Haken bleibt sie im Register mit dem Vermerk „seit … in keinem Kurs“.

**Personenregister (seit Datenformat 5):** Jeder Eintrag in einem Kurs gehört zu einer Person im Personenregister. So lässt sich dieselbe Person über Kurse und Schuljahre hinweg wiederfinden; später hängen dort Notizen, Nachteilsausgleiche und Förderpläne. Noten, I-Status, Einstufung, Foto und Bemerkung bleiben am Kurs. Steht eine Person nur in einem Kurs, folgt ihr Name im Register dem Namen im Kurs. Beim Umstellen einer älteren Datenbank bekommt jeder Kurseintrag eine eigene Person; nichts wird automatisch zusammengeführt. Zusammenführen, Trennen und Löschen gehen auf der Seite „Personen“ (6.6).

### 6.3 Kurs verwalten

- **Kurs kopieren:** Übernimmt Kursdaten, Gewichtung und optional die aktiven Schüler/innen in ein (neues) Schuljahr, mit Jahrgang + 1 als Vorschlag. Noten werden nicht kopiert. Die kopierten Einträge gehören zu denselben Personen im Personenregister. Typischer Ablauf zum Schuljahreswechsel: oben „+ Neues Schuljahr …“ anlegen, dann jeden Kurs dorthin kopieren.
- **Kurs löschen:** Löscht den Kurs mit allen Schüler/innen, Noten und Sitzplänen. Zur Sicherheit muss im Dialog das Wort **LÖSCHEN** (in Großbuchstaben) eingetippt werden; vorher bleibt „Endgültig löschen“ gesperrt. Rückgängig machen geht nur über eine Sicherung. Stehen danach Personen in keinem Kurs mehr, nennt der Dialog ihre Zahl und bietet den Haken **„Auch … aus dem Personenregister löschen“** an (standardmäßig aus).
- **Schülerliste als Excel:** Der Knopf **Excel** neben der Überschrift „Schülerinnen und Schüler“ speichert eine `.xlsx`-Datei mit den Spalten Nr., Nachname, Vorname, I-Status, Aktiv – zuerst die aktiven Personen alphabetisch und nummeriert, darunter die nicht mehr aktiven. Die Datei ist **nicht verschlüsselt** (siehe 11).

### 6.4 Reiter in diesem Kurs

Die Karte **„Reiter in diesem Kurs“** schaltet Reiter für diesen Kurs ein oder aus: Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht und Sitzplan. „Kurs & Schüler“ und „Einstellungen“ sind immer da.

- Ohne eigene Auswahl gilt der **Standard** aus Einstellungen → Reiter (siehe 12). Ein Haken, der vom Standard abweicht, ist mit ◆ markiert; **„Wie Standard“** verwirft die eigene Auswahl des Kurses.
- Ein ausgeschalteter Reiter verschwindet nur aus der Reiterleiste. **Vorhandene Daten bleiben gespeichert und zählen weiter**, z. B. Noten aus Präsentationen in der Notenübersicht. In der Notenübersicht entfällt dann der Sprunglink („Präs. ›“ usw.), im Reiter „Gruppen“ die Übernahme in eine Präsentation. Wieder einschalten zeigt alles wie vorher.
- Ist der zuletzt gewählte Reiter im Kurs ausgeschaltet, öffnet sich die Notenübersicht (bzw. „Kurs & Schüler“, wenn auch sie aus ist).
- Beim Kopieren eines Kurses wird seine Reiterauswahl mitkopiert. Die Auswahl gilt auf allen Geräten.

### 6.5 Fehlzeiten

Die Karte **„Fehlzeiten“** (seit 1.45) führt die Abwesenheiten des Kurses je Halbjahr (Umschalter neben der Überschrift).

- **Spalten** sind die Unterrichtstage, unter dem Datum steht die Zahl der Unterrichtsstunden an dem Tag (Standard 1, z. B. 2 für eine Doppelstunde). **„+ Tag“** legt einen Tag mit Datum und Stundenzahl an; ein Klick auf das Datum ändert die Stundenzahl oder löscht den Tag.
- **Zellen:** Ein Klick schaltet reihum **A** (abwesend, Entschuldigung noch offen) → **E** (entschuldigt) → **U** (unentschuldigt) → anwesend.
- **Summen** je Person in Unterrichtsstunden: **Σ** gesamt, davon **E**, **U** und **offen**. Sie werden immer neu berechnet. Jede Spalte lässt sich sortieren.
- **Automatisch eingetragen:** Der Haken **„Heute abwesend“** (Reiter „Ziehen“ und „Gruppen“) trägt heute **A** ein; entfernt man ihn, verschwindet der Eintrag von heute. Ein **k** in einer EPO-Stunde trägt für deren Datum **A** ein. Umgekehrt bekommt eine Person, die hier als abwesend steht, in EPO-Stunden desselben Datums ein **k** (eine neue EPO-Stunde übernimmt die Abwesenden dieses Datums). Wird das k in EPO durch eine Bewertung ersetzt, war die Person da, und die Fehlzeit entfällt. Wird das k nur gelöscht, verschwindet ein offenes **A**; **E** und **U** bleiben, weil sie bewusst eingetragen wurden. Ein gelöschter Tag nimmt die k dieses Datums mit.
- **Ausdruck:** **Drucken … → Fehlzeiten** (hier oder in der Notenübersicht) druckt alle Tage mit A/E/U und den Summen. Im Leistungsbogen steht die Zeile „Fehlzeiten“ (abwählbar). Die Notenübersicht zeigt die Spalte **„Fehlst.“** (siehe 9.1).
- Beim Ändern der Jahrgangsstufe wandern die Fehlzeiten wie die Noten auf die neuen Halbjahre. Ein kopierter Kurs startet ohne Fehlzeiten.

### 6.6 Seite „Personen“ (Personenregister, seit 2.4.0)

Der Eintrag **„Personen“** unten in der Kursliste öffnet das Personenregister: alle Personen über alle Kurse und Schuljahre. Die Seite erscheint nie auf dem Beamer und wird nicht gedruckt.

- **Liste (links):** Suche nach Vor- oder Nachname und darunter eine Auswahl **„Alle“**, **„Ohne Kurs“** oder ein Kurs (seit 2.14.0), jeweils mit Anzahl. Die Kurse stehen je Schuljahr, das aktuelle zuerst, also auch Kurse früherer Jahre. Bei einem Kurs zeigt die Liste nur dessen Personen, alphabetisch wie sonst. Die Suche wirkt zusätzlich. Die Auswahl gilt nur für die Sitzung und steht beim Öffnen wieder auf „Alle“. Je Person stehen Name und darunter ihre Kurse kurz (Kurse aus einem anderen Schuljahr mit Jahr, z. B. „7b M 25/26“) oder „seit … in keinem Kurs“. Pfeiltasten bewegen den Fokus in der Liste, Enter wählt.
- **„Für OrdoSortis exportieren“** (seit 2.15.0): Steht die Auswahl auf einem Kurs, erscheint unter der Personenzahl dieser Knopf. Er lädt `ordosortis_personen_<Klasse>_<JJJJ-MM-TT>.csv` mit den aktiven Personen des Kurses (Semikolon, UTF-8 ohne BOM, Zeilenende `\n`, Spalten `person_id;nachname;vorname;klasse;schuljahr;email`, Namen aus dem Register, Mail-Adresse aus dem Kurseintrag oder leer). Keine Noten, Notizen, Ausgleiche, Förderpläne, Fotos oder I-Status. Die Datei ist **nicht verschlüsselt**; ein Hinweis erscheint nach dem Laden. Bei „Alle“ und „Ohne Kurs" gibt es den Knopf nicht. Das Format legt `../OrdoSortis/docs/KONZEPT.md` 7.1 fest (Änderung nur nach Absprache in beiden Apps).
- **Person (rechts):** Name im Register (bearbeitbar), darunter ihre Kurse mit Schuljahr, Kurs, Name im Kurs (falls abweichend), „nicht aktiv“ und **„Zum Kurs“**. Ändert man den Namen im Register, behalten die Kurse ihren Namen; steht die Person nur in einem Kurs, ändert sich der Name dort mit.
- **„Mit anderer Person zusammenführen …“:** Suche nach der anderen Person. Die gerade gezeigte Person bleibt, ihr Name gilt; die Kurse der anderen gehören danach dazu. Personen, die im selben Kurs stehen, sind gesperrt.
- **„Trennen …“** (nur bei mehr als einem Kurs): Haken an den Kurseinträgen, die zu einer neuen Person werden. Die neue Person bekommt den Namen des ersten gewählten Eintrags; mindestens ein Eintrag bleibt. Was an der Person hängt (Nachteilsausgleiche, Förderplan), bleibt bei der bisherigen. Notizen zu einem der abgetrennten Kurse gehen mit, Notizen ohne Kurs bleiben (seit 2.6.0).
- **„Aus dem Register löschen“** (nur für Personen ohne Kurs, mit Rückfrage).
- **Kompetenzen** (seit 2.12.0): Hat die Person in einem Kurs mit Kompetenzkatalog Punkte, steht nach den Kursen je Katalog (Fach) eine Tabelle: je Kompetenz der Verlauf über alle Tests aller Kurse nach Datum (wie im Reiter „Kompetenzen“, siehe 9a) und der Stand je Schuljahr (Zeichen und Prozent, „–“ ohne Punkte). Eine gestrichelte senkrechte Linie trennt die Schuljahre; der Tooltip eines Punkts nennt Test, Datum und Kurs. Ohne Punkte fehlt der Abschnitt.
- **Nachteilsausgleich** (seit 2.5.0): siehe 6.7.
- **Notizen** (seit 2.6.0): siehe 6.8.
- **Förderplan** (seit 2.7.0): siehe 6.9.
- **„Zusammenführen …“ (oben rechts)** mit der Zahl der Vorschläge: Personen mit gleichem Namen oder gleicher Mail-Adresse in einem Kurseintrag, die nicht im selben Kurs stehen. Nichts ist vorausgewählt; man hakt an, was zusammengehört. Die ältere Person bleibt, ihr Name gilt.
- Unter 900 px Breite stehen Liste und Person nicht nebeneinander: Erst kommt die Liste, nach der Wahl die Person mit **„‹ Alle Personen“** zurück.

### 6.7 Nachteilsausgleich (seit 2.5.0)

Nachteilsausgleiche (LRS, Dyskalkulie und andere) sind Gesundheitsdaten. Sie stehen an der Person im Personenregister und gelten damit in allen ihren Kursen.

- **Erfassen:** Seite „Personen“ → Person wählen → Abschnitt **„Nachteilsausgleich“** → **„Ausgleich hinzufügen …“**. Im Dialog: **Art** (LRS, Dyskalkulie oder Sonstiges mit eigenem Kürzel, höchstens 6 Zeichen, z. B. „ADHS“), **Fächer** („alle Fächer“ oder Haken an den Fächern aus den Kursen der Person), **Maßnahmen** (Freitext, z. B. „25 % mehr Zeit, Rechtschreibung wird nicht bewertet“) und **„Gültig bis“** (leer = ohne Ende). **„Ändern“** öffnet denselben Dialog, dort auch **„Löschen“** (mit Rückfrage).
- **Fächer** werden ohne Rücksicht auf Groß- und Kleinschreibung mit dem Fach des Kurses verglichen. Hat ein Kurs kein Fach eingetragen, gelten dort nur Ausgleiche für „alle Fächer“. Kommt ein Kurs mit einem neuen Fach dazu, hakt man es im Dialog nach.
- **Kürzel:** Gilt ein Ausgleich im Fach des Kurses, steht sein Kürzel (LRS, DK, eigenes) dezent hinter dem Vornamen, neben dem „I“: in der Punkteeingabe der Tests, in der Notenübersicht und in der Kursliste (Spalte „I-Status“). Beim Darüberfahren erscheinen Art und Maßnahme. Abgelaufene Ausgleiche werden nicht mehr markiert; im Register stehen sie blass mit „abgelaufen am …“.
- **„Ausgleich gewährt“:** In der Punkteeingabe eines Tests steht eine Spalte **„Ausgleich“**, sobald jemand im Kurs einen gültigen Ausgleich hat; der Haken steht nur in diesen Zeilen. Er hält fest, dass der Ausgleich bei dieser Arbeit gewährt wurde. Die App rechnet **nichts** um: Note, Notenspiegel und Statistik bleiben gleich.
- **Nie zu sehen:** in „Ziehen“, auf dem Beamer und im Vollbild, in allen Ausdrucken und im Excel-Export der Schülerliste. Das Notfallwerkzeug schreibt die Ausgleiche in die Spalte „Nachteilsausgleich“ von `Personenregister.csv`.

### 6.8 Notizverlauf (seit 2.6.0)

Notizen sind interne Vermerke mit Datum, zum Beispiel zu Verhalten, Absprachen oder Elterngesprächen. Sie stehen an der Person im Personenregister, gelten also über Kurse und Schuljahre hinweg. Sie werden **nie gedruckt** (auch nicht auf dem Leistungsbogen) und erscheinen nie auf dem Beamer und nie im Excel-Export. Die **„Bemerkung zur Person“** in der Notenübersicht bleibt davon getrennt: Sie gehört zum Kurs und steht auf dem Leistungsbogen.

- **Seite „Personen“:** Abschnitt **„Notizen“** in der Ansicht der Person. Oben steht immer ein Eingabefeld: Datum (heute, änderbar), Kurs (die Kurse der Person oder „ohne Kurs“; vorgewählt ist der zuletzt geöffnete Kurs, wenn die Person darin steht), Text und **„Notiz speichern“**. Darunter der Verlauf, neueste oben, mit Datum und Kurs. Die Auswahl rechts oben filtert nach Kurs („Alle Kurse“, ein Kurs, „ohne Kurs“). **„Ändern“** öffnet die Notiz an Ort und Stelle (Datum, Kurs, Text) mit **„Speichern“**, **„Abbrechen“** und **„Löschen“** (mit Rückfrage). Tastatur: **Strg+Enter** speichert (im Eingabefeld, beim Ändern und in den kleinen Fenstern), **Esc** bricht das Ändern ab.
- **Sitzplan:** Ist eine Karte ausgewählt oder hat sie den Tastaturfokus, erscheint oben links ein kleiner Notiz-Knopf. Mit der Tastatur genügt **N** auf der Karte. Es öffnet sich ein kleines Fenster mit Datum (heute) und Text; der Kurs ist der aktuelle. In der Beamer-Ansicht gibt es das nicht.
- **Notenübersicht:** Hat eine Person Notizen in diesem Kurs, steht neben der Sprechblase ein Notiz-Symbol. Beim Darüberfahren zeigt es nur Anzahl und Datum der letzten Notiz, nicht den Text. Ein Klick öffnet die Notizen dieses Kurses mit einem Feld für eine neue Notiz; **„Alle Notizen auf der Seite Personen ›“** springt zur Person.
- Ist ein Kurs gelöscht, bleibt die Notiz erhalten und zeigt „gelöschter Kurs“. Beim Zusammenführen werden die Notizen beider Personen zusammengelegt, beim Trennen siehe 6.6.
- Das Notfallwerkzeug schreibt die Notizen in eine eigene Datei `Notizen.csv` (Person, Name, Datum, Kurs, Text).

### 6.9 Förderplan (seit 2.7.0)

Der Förderplan ist die Arbeitsfassung zum offiziellen Plan in der Schulakte (Gesundheitsdaten). Er steht an der Person und besteht aus **Fassungen mit Datum**, meist halbjährlich fortgeschrieben. Es gilt die Fassung mit dem neuesten Datum. Nie gedruckt, nie auf dem Beamer, nie im Excel-Export; kein Dateianhang.

- **Seite „Personen“:** Abschnitt **„Förderplan“** nach „Notizen“. Er zeigt die geltende Fassung: „Gilt seit …“, Förderschwerpunkte, Zeitraum, darunter **Ziele** und **Maßnahmen**. Ohne Plan: **„Förderplan anlegen …“**.
- **Fenster:** Datum, **Förderschwerpunkte** als Haken (Lernen, Sprache, emotionale und soziale Entwicklung, ganzheitliche Entwicklung, körperliche und motorische Entwicklung, Hören, Sehen, Sonstiges mit eigener Bezeichnung; mindestens einer), Zeitraum von/bis (optional, „bis“ nicht vor „von“), Ziele, Maßnahmen. **Strg+Enter** speichert.
- **„Fortschreiben …“** öffnet das Fenster vorausgefüllt mit der geltenden Fassung, Datum heute, Zeitraum leer. **„Als neue Fassung speichern“** legt eine neue Fassung an; die bisherige bleibt unverändert.
- **„Ändern“** korrigiert eine Fassung (auch eine frühere), dort auch **„Fassung löschen“** (mit Rückfrage).
- **Hinweis aus den Kompetenztests** (seit 2.13): Beim Anlegen und Fortschreiben steht über „Ziele“ eingeklappt „Aus den Kompetenztests: n × noch nicht“. Darin sind die Kompetenzen, deren Stand im laufenden Schuljahr „noch nicht“ ist (über alle Kurse der Person mit Kompetenzkatalog, siehe 9a), mit dem Fach. **„In Ziele übernehmen“** hängt eine Zeile „Kompetenz (Fach)“ an die Ziele an; steht sie schon da, heißt der Knopf „Übernommen“. Nichts wird automatisch eingetragen. Ohne solche Kompetenzen fehlt der Hinweis.
- **Frühere Fassungen** stehen eingeklappt unter der geltenden („Frühere Fassungen (n)“), je Fassung eine Zeile mit Datum und Schwerpunkten; aufgeklappt mit vollem Text.
- **„Fassungen vergleichen …“** (ab zwei Fassungen): zwei Spalten nebeneinander, oben je eine Auswahl der Fassung; vorgewählt links die vorherige, rechts die geltende. Unter 700 px untereinander. Nur Ansicht.
- **Hinweis in der Kursliste:** Hat eine Person einen Förderplan, ist im Kurs aber kein I-Status gesetzt, steht in der Spalte „I-Status“ ein kleines Warnsymbol („Förderplan vorhanden, I-Status nicht gesetzt“). Ein Klick öffnet die Person. Die App setzt nichts automatisch.
- Beim Zusammenführen werden die Fassungen zusammengelegt, beim Trennen bleibt der Plan bei der bisherigen Person. Das Notfallwerkzeug schreibt `Foerderplaene.csv` (eine Zeile je Fassung, „gilt“ bei der neuesten).

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

Jede Aufgabe hat eine **Bezeichnung** (z. B. „A1“; neue Aufgaben werden automatisch A1, A2, A3 … benannt) und eine **Höchstpunktzahl**. Mit **„+ Aufgabe“** bzw. **„+ Bonusaufgabe“** fügen Sie weitere hinzu, das **Kreuz** am Zeilenende entfernt eine Aufgabe.

**Bonus:** Ist der Haken „Bonus“ gesetzt, zählen die Punkte zur erreichten Summe, aber **nicht zur Höchstpunktzahl**. Mehr als die Bestnote ist nicht möglich: Das Ergebnis wird bei 1 bzw. 15 Punkten gekappt. Bonusaufgaben sind gelb markiert.

### 7.3 Ergebnisse eintragen

In der Tabelle **Ergebnisse** die erreichten Punkte je Aufgabe eintragen (Komma oder Punkt als Dezimaltrenner). Daneben stehen sofort **Σ**, **%** und die **Note**.

**Status** je Person:

| Status | Wirkung |
|---|---|
| — | normale Wertung |
| fehlt (entschuldigt) | keine Note, zählt nicht im Schnitt |
| Nachschreiben | keine Note (Erinnerung zum Nachschreiben; Nachtermin über „+ Nachschreibtermin“, siehe unten) |
| Täuschung/Verweigerung | Note 6 bzw. 00 Punkte; wird beim Drittelparagraphen **nicht** mitgezählt |
| nicht gewertet | Punkte und Note werden wie gewohnt berechnet und angezeigt, die Zeile ist ausgegraut. Die Arbeit zählt **nicht** zur Halbjahresnote dieser Person und nicht in Notenspiegel, Ø, Standardabweichung, „Ø gelöst“ und Drittelparagraph. In der Notenübersicht erscheint die Note ausgegraut. |

**Unterschrift gesehen** (nur bei Klassen-/Kursarbeiten): In der letzten Spalte „Unterschrift“ abhaken, wenn die unterschriebene Arbeit zurück ist; das Datum wird gemerkt (Tooltip). Neben „Ergebnisse“ steht der Stand, z. B. „Unterschriften 9 / 11“ (gezählt werden Personen mit Note), grün hinterlegt, wenn alle da sind. Der Vermerk hat keinen Einfluss auf die Note und erscheint im Ausdruck „Ergebnisliste“ als eigene Spalte.

Die Zeile **„Ø gelöst“** zeigt je Aufgabe, wie viel Prozent der möglichen Punkte im Schnitt erreicht wurden. Daran sieht man schnell, welche Aufgabe schwer war.

**Nachschreibtermin:** Wer bei einer Arbeit fehlt, bekommt dort den Status **Nachschreiben** (oder „fehlt“). Mit **„+ Nachschreibtermin“** oben im Test legen Sie einen eigenen Test für den Nachtermin an. Aufgaben, Teile und Notenschlüssel werden als Vorlage übernommen und lassen sich ändern, zum Beispiel für andere Aufgaben. Ergebnisse und Moodle-Daten werden nicht übernommen.

- Der Nachschreibtermin zeigt zuerst nur die Personen, die in der Arbeit „Nachschreiben“ oder „fehlt“ haben (auch nur in einem Teil), dazu alle, die im Nachtermin schon einen Eintrag haben. Über **„Alle zeigen“** erscheinen alle Personen des Kurses (pro Gerät gemerkt).
- In der **Notenübersicht** gibt es für Arbeit und Nachschreibtermin **eine gemeinsame Spalte**. Wer im Nachschreibtermin Punkte oder einen Status hat, bekommt dort dessen Note. Die Note ist mit einem kleinen „N“ markiert, der Tooltip nennt den Termin. Im Ausdruck der Notenliste steht ein hochgestelltes „N“, auf dem Leistungsbogen „nachgeschrieben“.
- Für die Rechnung zählen Arbeit und Nachschreibtermin als **eine Leistung**. Bereich, Gewicht, Halbjahr und „nicht gewertet“ kommen immer von der Arbeit, deshalb fehlen diese Felder beim Nachschreibtermin. Gibt es mehrere Nachschreibtermine, zählt für jede Person der späteste mit Eintrag.
- Notenspiegel, Drittelparagraph und Ausdrucke bleiben je Test getrennt.
- Ein bestehender Test lässt sich über die Auswahl **„Nachschreibtermin zu“** nachträglich mit einer Arbeit desselben Halbjahrs verknüpfen. Mit „– (eigene Leistung)“ lösen Sie die Verknüpfung wieder. Wird die Arbeit gelöscht, bleiben die Nachschreibtermine als eigene Tests erhalten.
- Hat jemand in der Arbeit eine Note und im Nachschreibtermin einen Eintrag, zählt der Nachschreibtermin. „Datenbank prüfen“ weist darauf hin.

### 7.4 Notenschlüssel

Rechts steht der Notenschlüssel mit Mindestpunktzahl („ab Pkt.“), Prozent und Anzahl je Notenstufe.

- **Schwelle von Hand ändern:** Wert in „ab Pkt.“ überschreiben. Geänderte Schwellen sind gelb markiert.
- **Zurücksetzen** stellt den berechneten Schlüssel wieder her.
- **Zu wenig Punkte:** Bei wenigen Punkten (z. B. 18 Punkte in der Sek I mit ganzen Punkten) fallen zwei Notenstufen auf dieselbe Mindestpunktzahl, etwa 2+ und 2 beide ab 15 Punkten. Die schwächere Stufe kann dann nie vergeben werden. Über dem Schlüssel erscheint ein Hinweis ⚠ („2 und 3- sind nicht erreichbar“), die betroffenen Zeilen sind blass und mit ⚠ markiert. Knöpfe bieten an, was das Problem löst: **½ Halbe Punkte** bzw. **Zehntel-Punkte** (Punkte-Genauigkeit) oder **Nur ganze Noten** (Sek I). **Punkte verteilen** (seit 2.2) gibt jeder Stufe einen eigenen Punktwert, von der Höchstpunktzahl abwärts (Regel in 15.3, Punkt 6). Vorher zeigt ein Fenster den neuen Schlüssel mit allen verschobenen Stufen (bisher/neu); „Übernehmen“ trägt ihn als eigene Schwellen ein, die sich danach wie gewohnt ändern lassen („Zurücksetzen“ stellt den berechneten Schlüssel wieder her). Der Knopf erscheint nur, wenn danach weniger Stufen wegfallen. Liegt es an einer von Hand gesetzten Schwelle, heißt der Hinweis „Schwellen prüfen“. Der Hinweis gilt auch für Teile mit eigenem Schlüssel und für Präsentationen (dort zusätzlich: weitere Kriterien aufnehmen oder höher gewichten).
- Die Formeln stehen in [Abschnitt 15](#15-notenschlüssel-für-tests).

### 7.5 Notenspiegel und Drittelparagraph

Unter dem Schlüssel stehen das Balkendiagramm (Anzahl je ganzer Note 1–6), Teilnehmende, Ø Note (bei MSS zusätzlich Ø Punkte), die **Standardabweichung** (Sek I: der Noten, z. B. 2- = 2,33; MSS: der Punkte; berechnet über alle gewerteten Arbeiten mit Teiler n), die Zahl der Noten 5 und 6 und der Anteil **unter 4** (Note 5 oder 6) in Prozent. Standardabweichung und Anteil unter 4 erscheinen auch in der Beamer-Ansicht und im Ausdruck „Schlüssel“ bzw. „Liste“.

**Drittelparagraph:** Sind mehr als ein Drittel der gewerteten Arbeiten mangelhaft oder ungenügend, erscheint die rote Meldung **„Drittelparagraph greift!“**. Arbeiten mit Status „Täuschung/Verweigerung“ zählen dabei nicht als 5/6, wohl aber zur Gesamtzahl. Personen mit I-Status zählen in der gesamten Statistik nicht mit (siehe Abschnitt „Kurs & Schüler“).

**Beamer-Ansicht:** Der Knopf **„Beamer“** öffnet im Vollbild nur den Notenspiegel (Balken, Teilnehmende, Ø Note, Höchstpunktzahl) und die Punkteverteilung (Rohpunkte von–bis und Anzahl je Notenstufe), darunter **Ø erreicht je Aufgabe** als Balken (Punkte und Prozent; nur eingetragene Werte zählen, wie in der Zeile „Ø gelöst“). Namen und Einzelergebnisse erscheinen nicht. Schließen mit **Esc** oder „Schließen“. Die Ansicht ist eine Momentaufnahme; nach Änderungen neu öffnen.

### 7.6 Ausdrucke

Der Knopf **„Drucken …“** öffnet eine Auswahl aller Druckarten des Tests, getrennt nach „Für die Lehrkraft“ und „Zum Austeilen“. Beim Darüberfahren zeigt ein Tooltip, was der Ausdruck enthält.

| Druckart | Inhalt |
|---|---|
| **Für die Lehrkraft** | |
| Ergebnisliste | Alle Personen mit Punkten je Aufgabe, Σ, %, Note (bei Klassen-/Kursarbeiten mit Spalte „Unterschrift“); darunter Notenspiegel und Schlüssel |
| Ergebnisse nach Teilen | nur bei Arbeiten in Teilen (siehe 7.8): alle Personen mit Punkten, Prozent und (bei getrennter Benotung) Note je Teil, dazu die Gesamtwerte; darunter Notenspiegel und Schlüssel |
| Notenschlüssel und Notenspiegel | Punktschwellen je Note und Notenspiegel mit Statistik, ohne Namen (z. B. für das Klassenbuch oder die Fachleitung) |
| Trennblätter für OrdoScripto | nur nach „Für OrdoScripto vorbereiten“ (siehe 7.9): je Person eine A4-Seite mit Name, Klasse, Test, QR-Code und IDs; wahlweise nur für die Nachschreibenden |
| **Zum Austeilen** | |
| Ergebniszettel zum Ausschneiden | Ein Abschnitt pro Person: erreichte und mögliche Punkte je Aufgabe, Prozent, Note; bei I-Status mit Verbalbeurteilung steht der Text statt Prozent und Note (siehe 7.10) |
| Moodle-Rückmeldung je Person | nur bei Tests aus Moodle (siehe 7.7): je Person eine Seite mit Ergebnis (Punkte, Prozent) oben, darunter Frage, gegebene Antwort, Lösung und Punkte; wahlweise „Kompetenzen in diesem Test“; unten die **Note (Zahl und ausgeschrieben) wahlweise** sowie Linien für Datum und Unterschrift |

### 7.7 Moodle-Import

Tests aus Moodle lassen sich direkt übernehmen. Die Note berechnet OrdoNota mit dem eigenen Notenschlüssel (LIMIT, Abschnitt 15), nicht mit der Bewertung aus Moodle.

1. In Moodle beim Test unter **Ergebnisse** zwei Dateien als CSV herunterladen:
   - **Antworten** („Antworten“-Bericht): Fragetext, gegebene und richtige Antwort je Frage.
   - **Bewertungen** („Bewertungen“-Bericht, Spalten `F 1 /1,00`, `F 2 /1,00` …): Punkte je Frage. Nur diese Datei enthält Korrekturen, die Sie in Moodle von Hand vorgenommen haben (z. B. Tippfehler als richtig gewertet).
2. Im Reiter „Tests“ einen Test öffnen oder mit **„+ Neuer Test“** anlegen und in der Karte „Aufgaben“ auf **„Moodle-CSV“** klicken. Bei einer Arbeit in Teilen steht der Knopf **„Moodle“** je Teil in der Karte „Teile“ (siehe 7.8).
3. Beide Dateien auf die **Hochladen-Fläche** („CSV-Dateien hierher ziehen“) ziehen oder die Fläche anklicken und die Dateien auswählen (mehrere auf einmal markieren). OrdoNota erkennt selbst, welche welche ist. Eine allein geht auch:
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
- **Beide CSV-Dateien werden verschlüsselt im Test gespeichert**, ebenso Fragen und Antworten je Person. Die Karte **„Moodle“** im Test zeigt das Importdatum und bietet die Originaldateien zum Herunterladen an (Knöpfe mit Download-Symbol; die heruntergeladene Datei ist unverschlüsselt).

- **In Moodle noch nicht bewertet:** Steht in der Bewertungen-CSV statt Punkten „Bewertung notwendig“ (z. B. bei Freitextfragen), zeigt der Dialog einen gelben Hinweis („F2 bei 1 Person“). Diese Fragen zählen vorerst 0 Punkte; nach der Bewertung in Moodle erneut importieren.

**Kompetenzen aus der Begleitdatei (seit 2.10):** Baut das Skript `moodle.py` den Test, schreibt es neben die Moodle-XML eine **Begleitdatei** `Moodle-Test – … (Kompetenzen).json` mit den Kompetenzen je Frage. Wählen Sie sie im Import-Dialog zusammen mit den beiden CSV-Dateien. Darunter erscheint der Abschnitt **„Kompetenzen“**:

- **Zuordnung über den Fragetext:** Die CSV enthält keinen Fragenamen, nur die Nummer im Test und den Fragetext. OrdoNota sucht je Moodle-Frage die Frage der Begleitdatei, deren Textanfang zum Fragetext passt (Leerraum zusammengefasst, notfalls ohne Groß- und Kleinschreibung). Die Reihenfolge im Test darf abweichen. Nicht eindeutige Fragen, Fragen ohne Treffer und Zufallsfragen (verschiedene Texte unter derselben Nummer) stehen auf „— keine —“ und sind gelb markiert; jede Zeile lässt sich von Hand umstellen. Dafür braucht es die **Antworten-CSV**.
- **Unbekannte Kennungen** (nicht im Katalog des Kurses) stehen in einer Liste. Je Kennung: **weglassen** (vorbelegt), **aufnehmen** in einen Bereich des Katalogs (Bezeichnung zunächst die Kennung, umbenennen unter Einstellungen → Kompetenzkataloge) oder **statt dessen** eine vorhandene Kompetenz.
- **Kurs ohne Katalog:** Gibt es den Katalog der Begleitdatei schon in OrdoNota oder als Vorlage, bietet der Dialog an, ihn für den Kurs zu übernehmen (Haken, vorausgewählt). Sonst werden die Kompetenzen nicht übernommen. Passt die Katalogkennung nicht zum Kurs oder ist die Version der Begleitdatei neuer, erscheint ein Hinweis.
- **Übernehmen:** Zugeordnete Fragen bekommen die Kompetenzen der Begleitdatei, auch wenn sie vorher andere hatten (der Dialog zeigt dann „ersetzt: …“). Fragen auf „— keine —“ behalten ihre Kompetenzen. Ändern lässt sich alles danach in der Karte „Kompetenzen“ (siehe 7.11). Die Begleitdatei wird wie die CSVs verschlüsselt gespeichert und bleibt bei einem erneuten Import ohne Begleitdatei erhalten.
- **Nachträglich:** Knopf **„Kompetenzen zuordnen“** in der Karte „Moodle“. Er verlangt nur die Begleitdatei und nutzt die gespeicherte Antworten-CSV; die Punkte bleiben unverändert.

**Erneut importieren** (Knopf in der Karte „Moodle“; nach dem ersten Import verschwindet „Moodle-CSV“ aus der Karte „Aufgaben“), z. B. nach Korrekturen in Moodle: Die Punkte der Moodle-Fragen werden ersetzt, eigene zusätzliche Aufgaben (der Haken „ersetzen“ ist hier nicht vorausgewählt), Notenschlüssel, Gewicht und Status „nicht gewertet“/„Täuschung“ bleiben erhalten. Lädt man dabei nur die Bewertungen-CSV, bleiben die gespeicherten Antworttexte erhalten.

**Ausdruck „Moodle-Rückmeldung je Person“** (unter „Drucken …“): Im Dialog wählen Sie **alle** (je eine Seite) oder **eine Person** und ob die **Note** mitgedruckt wird. Oben steht das Ergebnis (Punkte, Prozent mit Balken), darunter je Frage Frage, „Deine Antwort“, Lösung und Punkte. Jede Zeile trägt ein Zeichen und einen farbigen Rand: ✓ richtig (grün), ◐ teilweise (orange hinterlegt), ✗ falsch (rot hinterlegt, Lösung fett), – keine Antwort. Durch die Zeichen bleibt der Ausdruck auch in Schwarzweiß lesbar; Zeilen werden nicht über Seiten getrennt. Hat der Kurs einen Kompetenzkatalog und der Test Kompetenzen, gibt es im Dialog den Haken **„Kompetenzen in diesem Test“** (vorab gesetzt, seit 2.13): unter den Fragen steht dann je Kompetenz des Tests das Zeichen (✓ sicher, ◐ teilweise, ✗ noch nicht), der Name und die Punkte aus diesem Test (bei einem Nachschreibtermin aus dem Termin). Unten steht – wenn gewählt – die **Note als Zahl und ausgeschrieben** (z. B. „2+ voll gut“, „2- noch gut“; MSS: „11 Punkte gut (2)“), darunter Linien für **Datum** und **Unterschrift der Lehrkraft** (auch ohne Note).

### 7.8 Arbeit in Teilen (z. B. Theorie und Praxis)

Eine Klassenarbeit kann aus mehreren Teilen bestehen, z. B. einem Theorie- und einem Praxisteil oder Hörverstehen, Lesen und Schreiben. Haken **„Arbeit in Teilen“** in den Eckdaten setzen: Es entstehen die Teile „Theorie“ und „Praxis“, alle vorhandenen Aufgaben gehören zunächst zum ersten Teil. In der Karte **„Teile“** lassen sich die Teile umbenennen, mit **„+ Teil“** weitere anlegen und mit dem **Kreuz** entfernen (mit ihren Aufgaben und Punkten). In der Karte „Aufgaben“ hat jeder Teil eigene Knöpfe „+ Aufgabe“ und „+ Bonusaufgabe“.

**Wertung** (Auswahl in der Karte „Teile“):

| Wertung | Note |
|---|---|
| **gemeinsam bepunktet** | Alle Punkte zählen zusammen, ein Notenschlüssel über die Gesamtpunktzahl (wie ohne Teile). Die Teile gliedern Aufgaben, Ergebnistabelle und Ausdrucke; je Teil stehen Σ und % da. |
| **getrennt benotet** | Jeder Teil hat einen eigenen Notenschlüssel (LIMIT, Punkte-Genauigkeit, Notenstufen, eigene Schwellen) und eine eigene Note. Die Gesamtnote ist der gewichtete Schnitt der Teilnoten, auf eine Notenstufe gerundet (Gewichte je Teil, z. B. 1 : 2; Formel in 15.5). |

Bei getrennter Benotung gilt außerdem:

- Die **Gesamtnote entsteht erst, wenn alle Teile eine Note haben.** Fehlt jemand in einem Teil, setzen Sie in der Spalte „Note“ dieses Teils **fehlt** oder **NS** (Nachschreiben). Der Status in der Spalte „Status“ gilt weiterhin für die ganze Arbeit (z. B. Täuschung → 6).
- Der **Notenschlüssel** zeigt den Schlüssel des gewählten Teils (Umschalter über der Tabelle); Notenspiegel, Statistik und **Drittelparagraph** beziehen sich auf die Gesamtnote.
- Die Beamer-Ansicht zeigt die Punkteverteilung je Teil.

**Teil ausblenden:** Neben der Überschrift „Ergebnisse“ steht je Teil ein Knopf (z. B. **Theorie** mit Pfeil nach unten). Ein Klick blendet die Aufgabenspalten dieses Teils aus (Pfeil nach rechts); Σ und (bei getrennter Benotung) die Teilnote bleiben sichtbar. So passt z. B. beim Eintragen des Praxisteils alles auf den Bildschirm. Der Zustand wird je Test auf diesem Gerät gemerkt; Ausdrucke zeigen immer alle Teile.

**Moodle-Import in einen Teil:** Knopf **„Moodle“** in der Zeile des Teils. Die Fragen werden Aufgaben F1, F2, … dieses Teils, die anderen Teile bleiben unverändert; „Bisherige Aufgaben ersetzen“ (siehe 7.7) betrifft nur die Aufgaben dieses Teils. Die CSV-Dateien werden beim Teil gespeichert (eigene Karte „Moodle – Teilname“ mit „Erneut importieren“). Personen ohne beendeten Moodle-Versuch bekommen „fehlt“ für die ganze Arbeit, wenn sie noch gar keine Punkte haben; haben sie in einem anderen Teil schon Punkte, wird bei getrennter Benotung nur dieser Teil auf „fehlt“ gesetzt.

**Teile aufheben:** Haken „Arbeit in Teilen“ entfernen. Alle Aufgaben und Punkte bleiben erhalten und werden wieder mit einem Schlüssel bewertet; Schlüssel, Gewichte und Status der einzelnen Teile gehen verloren (mit Rückfrage).

**Ausdrucke:** „Ergebnisliste“ und „Ergebniszettel“ zeigen die Aufgaben nach Teilen mit Zwischensumme (bei getrennter Benotung zusätzlich die Teilnoten), „Notenschlüssel und Notenspiegel“ den Schlüssel je Teil, **„Ergebnisse nach Teilen“** eine kompakte Tabelle aller Personen mit Punkten, Prozent und Note je Teil und gesamt.

> Arbeiten in Teilen brauchen OrdoNota ab Version 1.18 auf allen Geräten (Datenformat 2, siehe 21.10).

### 7.9 OrdoScripto: Trennblätter und Import-CSV

OrdoScripto ist ein eigenes Programm, das handschriftliche Mathe-Arbeiten per lokaler KI liest und Punkte vorschlägt. Es kennt **keine Namen**, nur pseudonyme IDs. OrdoNota vergibt diese IDs, druckt Trennblätter mit QR-Code und schreibt die Import-Datei für OrdoScripto.

1. Test öffnen, in der Karte „Aufgaben“ auf **„Für OrdoScripto vorbereiten“** klicken.
2. Die App vergibt eine **Test-ID** `T-<Jahr der Arbeit>-<laufende Nummer>` (z. B. `T-2026-0007`, laufend über die ganze Datenbank) und jeder aktiven Person eine **Schüler-ID** `S-` plus 6 Zeichen (ohne I, O, 0, 1, z. B. `S-7F3K9Q`). Die IDs sind **je Test neu**, damit OrdoScripto Arbeiten verschiedener Tests nicht derselben Person zuordnen kann. Vergebene IDs ändern sich nie.
3. Die Karte **„OrdoScripto“** zeigt die Test-ID. **„Import-CSV“** speichert `<Test-ID>_import.csv` mit genau den Spalten `test_id;schueler_id;kurs`, **ohne Namen**. In der Spalte `kurs` steht die Einstufung der Person (6.1, 6.2): `U` (undifferenziert), `G`, `E`, `E1`, `E2`, `GK` (Grundkurs) oder `LK` (Leistungskurs). OrdoScripto zeigt sie nur an; für die Bepunktung zählt der Erwartungshorizont, die Noten vergibt OrdoNota. Die Kopfzeile der Karte zählt die Werte (z. B. „20 × E2, 4 × E1“). Nach einer Änderung der Einstufung die Import-CSV neu speichern. Diese Datei wird in OrdoScripto beim Anlegen des Tests hochgeladen.
4. **„Drucken …“ → „Trennblätter für OrdoScripto“** druckt je Person eine A4-Seite: Name und Klasse groß zum Einsortieren, Titel und Datum des Tests, in der Mitte ein QR-Code (6 cm) mit dem Inhalt `ORDO|<Test-ID>|<Schüler-ID>`, darunter die beiden IDs als Text und der Hinweis „Trennblatt – vor die Arbeit des Schülers legen“. Die Reihenfolge folgt der Schülerliste. Als PDF speichern geht über den Druckdialog des Browsers („Als PDF speichern“).
5. Je Person das Trennblatt vor die Arbeit legen und den ganzen Stapel scannen. OrdoScripto liest die QR-Codes, ordnet die folgenden Seiten der Schüler-ID zu und verwirft die Trennblattseiten.

**Nachschreibtermin** (siehe 7.3): Er hat dieselbe Test-ID und dieselben Schüler-IDs wie die Arbeit, weil OrdoScripto die Nachschreibarbeiten in denselben Test aufnimmt. Im Nachschreibtermin ist beim Drucken **„Nur Nachschreibende“** vorausgewählt (wer in der Arbeit „fehlt“/„Nachschreiben“ hat oder schon im Nachschreibtermin eingetragen ist).

**Später hinzugekommene Personen** bekommen über **„+ IDs für … neue Personen“** in der Karte eine ID dazu. Danach die Import-CSV neu speichern.

Die Zuordnung ID ↔ Name steht **nur in der verschlüsselten Datenbank**. Das Notfallwerkzeug gibt sie in der CSV-Ausgabe mit aus (siehe 20.1). Die Punkte aus OrdoScripto zurück nach OrdoNota zu übernehmen ist geplant (`PLANUNG.md`, Abschnitt T, Teil 2).

### 7.10 Verbalbeurteilung bei I-Status

Ist in einem Kurs jemand mit I-Status (siehe 6), steht unter den Ergebnissen eines Tests die Karte **„Verbalbeurteilungen“**. Für jede dieser Personen zeigt sie die Note mit den Punkten (oder den Status), ein Textfeld und den Haken **„Note auf dem Zettel zeigen“**. Beim Nachschreibtermin erscheinen nur die Personen, die dort gezeigt werden.

- **Fehlt noch:** Liegt die Note unter 4− (Sek I) bzw. unter 4 Punkten (MSS) und ist das Textfeld leer, ist der Block markiert und mit „fehlt noch“ beschriftet. Der Kopf der Karte zählt diese Fälle. In der Ergebnistabelle steht unter der Note „verbal fehlt“ bzw. „verbal ✓“. Ein Klick darauf springt zum Textfeld. Ohne Note (z. B. „fehlt“) gibt es keine Warnung.
- **Speichern:** Der Text wird gespeichert, sobald Sie das Feld verlassen. Zeilenumbrüche bleiben erhalten.
- **Ergebniszettel:** Mit Text und ohne Haken stehen auf dem Zettel die Punkte je Aufgabe, aber nicht Prozent, Note und Teilnoten. An ihrer Stelle steht die Verbalbeurteilung. Mit dem Haken steht die Note wie bei allen anderen. Ohne Text lässt sich der Haken nicht setzen, dann steht die Note auf dem Zettel.
- **Moodle-Rückmeldung:** Mit Note gilt dasselbe (ohne Prozent und Note, dafür der Text). Ohne Note bleibt der Bogen wie bisher.
- **Arbeit in Teilen:** eine Verbalbeurteilung für die ganze Arbeit, auch bei getrennt benoteten Teilen.
- **Was gleich bleibt:** Die Note wird weiter berechnet und erscheint in der Notenübersicht, in Ergebnisliste und Notenliste (mit „(I)“) und im Leistungsbogen. In die Statistik zählt sie weiterhin nicht.
- **Was nie erscheint:** Die Verbalbeurteilung steht nicht in der Beamer-Ansicht, nicht in der Excel-Schülerliste und nicht in der Import-CSV für OrdoScripto. Das Notfallwerkzeug gibt sie in der CSV als eigene Spalte hinter der Arbeit aus.
- Wird der I-Status entfernt, bleibt der Text gespeichert, wirkt aber nicht mehr.

### 7.11 Kompetenzen je Aufgabe (seit 2.9)

Hat der Kurs einen **Kompetenzkatalog** (siehe 6.1 und 12), steht unter „Aufgaben“ die Karte **„Kompetenzen“**: ein Raster mit den Aufgaben als Zeilen und den Kompetenzen des Katalogs als Spalten (Kurzkennung wie „K2“, die volle Bezeichnung steht im Tooltip). Ein Haken bedeutet: Diese Aufgabe prüft diese Kompetenz. Eine Aufgabe kann mehrere Kompetenzen haben; ihre Punkte zählen dann bei jeder voll.

- **Punkte je Kompetenz:** Die Fußzeile zählt die möglichen Punkte je Spalte, Bonusaufgaben eingeschlossen. Eine Kompetenz zählt auch die Aufgaben ihrer Teilkompetenzen (jede Aufgabe einmal). Hat eine Kompetenz weniger als 3 mögliche Punkte, ist die Zahl gelb markiert („wenig Daten“).
- **Arbeit in Teilen:** Die Zeilen sind nach Teil gruppiert wie in der Karte „Aufgaben“.
- **Aufgabenkacheln:** Dort stehen die gewählten Kürzel klein zur Information (z. B. „K6 · L1“).
- **Ausgeblendete Kompetenzen** (siehe 12) erscheinen nur, solange eine Aufgabe dieses Tests sie trägt; dort lässt sich der Haken nur noch entfernen.
- **Nachschreibtermin:** übernimmt die Zuordnung mit den Aufgaben.
- **Reiner Kompetenztest:** Soll ein Test nicht in die Note eingehen, setzen Sie wie bisher „nicht gewertet“ (siehe 7.1). Ein nicht gewerteter Test mit mindestens einer Kompetenz heißt **Kompetenztest**. Gibt es im Halbjahr einen, erscheint neben dem Halbjahr der Umschalter **„Benotet | Kompetenztests | Alle“** für die Testliste (seit 2.11; „Benotet“ = alle außer Kompetenztests). Ändern Sie „nicht gewertet“ oder die Kompetenzen so, dass der Test die Gruppe wechselt, springt der Umschalter auf „Alle“, damit der Test nicht aus der Liste verschwindet.
- **Auswertung:** Reiter „Kompetenzen“ (seit 2.11, siehe 9a).
- **Aus Moodle:** Die Begleitdatei des Bauskripts füllt die Kompetenzen beim Moodle-Import vor (seit 2.10, siehe 7.7).

Auf dem Tablet lässt sich das Raster waagerecht verschieben; die Spalte mit den Aufgaben bleibt stehen.

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
| `k` | abwesend (zählt nicht; trägt eine Fehlzeit für das Datum ein, siehe 6.5) | – |
| `u` (Zusatz) | Hausaufgaben unvollständig | −1 |
| `h` (Zusatz) | Hausaufgaben vergessen | −2 |
| `m` (Zusatz, seit 1.44) | Material vergessen | 0 (nur gezählt) |

Kombinationen sind möglich, z. B. `+h` (gute Mitarbeit, Hausaufgaben vergessen), `0u` oder `+hm` (zusätzlich Material vergessen). Je Zelle höchstens ein Hausaufgaben-Zusatz (u oder h) und ein `m`, die Reihenfolge der Zusätze ist egal. Ein einzelnes `h` oder `m` ist ebenfalls erlaubt. Groß- und Kleinschreibung spielt keine Rolle. Eine leere Zelle bedeutet „nicht bewertet“.

**Hilfen**

- **Schnellwahl** (Knopf „Schnellwahl einblenden“ neben der Überschrift; standardmäßig ausgeblendet, der Zustand wird auf diesem Gerät gemerkt): Eine zusätzliche Spalte rechts neben den Stunden. Für die neueste Stunde lässt sich je Person per Klick `++`, `+`, `0`, `-`, `--` oder `k` sowie `u`/`h` und `m` setzen. Ein erneuter Klick auf die markierte Schaltfläche hebt die Auswahl wieder auf. Tippen in die Zellen funktioniert weiterhin.
- **Fotos** (Knopf „Fotos einblenden“ neben „Schnellwahl“; Zustand wird auf diesem Gerät gemerkt): zeigt vor jedem Nachnamen das Schülerfoto, damit Sie Gesichter und Namen schneller zuordnen. Wer noch kein Foto hat, bekommt ein blasses Personensymbol als Platzhalter. Fotos werden im Reiter „Sitzplan“ hinzugefügt (siehe 10.4).
- **Stunden: alle | letzte 3 | letzte 5 | letzte 10** (seit 2.19, erst ab 4 Stunden im Block): zeigt nur die neuesten Stunden als Spalten. Darüber steht, wie viele ältere Stunden ausgeblendet sind, mit **„Alle zeigen“**. Σ, Max, %, k, HA, M und Note rechnen weiter über **alle** Stunden des Blocks, ebenso Notenübersicht und Ausdrucke. Die Auswahl gilt je Kurs und wird auf diesem Gerät gemerkt.
- **Kacheln** (neben „Fotos“, seit 1.46): Vollbild für das Tablet mit einer großen Kachel je Person, farbig nach der Bewertung der gewählten Stunde (Standard: die neueste; oben umschaltbar). Die Kacheln stehen wie im Sitzplan des gewählten Raums, mit dem Lehrerpult; wer dort keinen Platz hat, steht unten unter „Ohne Platz“. Ohne Sitzplan stehen alle alphabetisch im Raster. Tippen auf eine Kachel öffnet große Knöpfe ++ + 0 - -- k und u/h/m: Eine Bewertung schließt die Knöpfe wieder, die Zusätze lassen sie offen; erneutes Tippen auf die markierte Auswahl hebt sie auf. Ein k trägt wie überall eine Fehlzeit ein (siehe 6.5), Abwesende von heute stehen schon mit k da. **Fotos** blendet die Fotos ein, **Esc** bzw. das **Kreuz** schließt erst die Knöpfe, dann die Ansicht. Die Ansicht zeigt Bewertungen und ist deshalb nicht für den Beamer gedacht.
- **füllen** (unter dem Datum): setzt alle noch leeren Zellen dieser Stunde auf einen Wert, z. B. `0`. Danach tragen Sie nur noch die Abweichungen ein.
- **Datum anklicken:** Datum ändern oder Stunde löschen.
- Rechts stehen je Person: Σ Punkte, Max, %, Fehlstunden (k), Hausaufgaben-Vermerke (u/h), Material vergessen (M) und die **Note**.

### 8.3 Einstellungen des Blocks

Unter **„Einstellungen dieses EPO-Blocks“** (aufklappen):

- **Punkte je Symbol** ändern (z. B. `h` = −1 oder `m` = −1, wenn vergessenes Material die Mitarbeit senken soll).
- **Vorlage** wählen und **„Anwenden“**: Die Vorlage setzt die Umrechnung Prozent → Note/Punkte und die Punkte je Symbol. Eingebaut sind (Rechnung in 16):
  - **„0 = befriedigend“** (Standard seit 2.8): Wer immer dasselbe Symbol hat, bekommt `++` → 1 (14 Punkte), `+` → 2 (11), `0` → 3 (08), `-` → 4 (05), `--` → 5 (02).
  - **„Mild“** und **„Streng“**: um eine Tendenz besser bzw. schlechter (immer `0` → 3+ bzw. 3-).
  - **„Wie Testschlüssel“**: die Rechnung bis Version 2.7 (Sek I mit LIMIT, MSS in 5-%-Stufen). Nur hier erscheint in der Sek I das Feld **LIMIT 4-**; eine Änderung berechnet die Tabelle neu.
  - dazu die **eigenen Vorlagen** der Stufe.
- Unter der Auswahl steht, welche Vorlage gilt, oder **„Angepasst“**, wenn die Werte zu keiner Vorlage passen. **„Als Vorlage speichern“** legt Tabelle und Punkte als eigene Vorlage für diese Stufe (Sek I oder MSS) an. Umbenennen und Löschen: Einstellungen → EPO-Umrechnung (12).
- **Umrechnung Prozent → Note/Punkte** von Hand anpassen: Grenzen von −100 bis 100 % (unter 0 % kommt man nur durch Hausaufgaben-Abzüge).
- **„Schwelle muss überschritten werden“**: „mehr als 25 %“ statt „ab 25 %“.

**Hinweis bei älteren Blöcken:** Ein Block, der noch genau wie „Wie Testschlüssel“ rechnet, zeigt über der Tabelle einen gelben Hinweis mit Beispiel („Wer immer 0 hat, bekommt eine 4-. Mit der Vorlage „0 = befriedigend“ ist es eine 3.“). **„Neue Vorlage anwenden“** übernimmt die Standardvorlage der Stufe, **„So lassen“** behält die Rechnung, und der Hinweis erscheint für diesen Block nicht mehr. Wer „Wie Testschlüssel“ selbst anwendet oder als Standard wählt, bekommt keinen Hinweis. Die Noten ändern sich erst, wenn man eine Vorlage anwendet.

## 8a. Reiter „Präsentationen“

Präsentationen (Referate, Vorträge) werden nach **Kriterien** bewertet: je Kriterium **0, 1, 2 oder 3 Punkte**. Die Summe wird wie bei Tests über den Notenschlüssel in eine Note umgerechnet (LIMIT, eigene Schwellen, nur ganze Noten; siehe 15.6).

### 8a.1 Kriterienpool

Der **Kriterienpool** (aufklappbare Karte unten im Reiter) gilt für **alle Kurse und Schuljahre**. Jedes Kriterium hat eine Gruppe (z. B. Inhalt, Vortrag, Medien, Sprache, Austausch), eine Bezeichnung und für jede Stufe 0–3 eine kurze Beschreibung, z. B. „Freies Sprechen“: 0 = abgelesen, 1 = überwiegend abgelesen, 2 = weitgehend frei, 3 = frei mit Stichwörtern. Ein Startbestand mit 31 fein gegliederten Kriterien ist vorhanden – lieber mehrere eindeutige Kriterien als ein Sammelkriterium, z. B. bei den Medien getrennt *Übersichtlichkeit*, *Lesbarkeit*, *Ansprechende Gestaltung*, *Bilder und Grafiken*, *Rechtschreibung*; beim Vortrag *Lautstärke*, *Sprechtempo und Pausen*, *Betonung*, *Blickkontakt*, *Körpersprache*. Mit dem **Stift-Symbol** bearbeiten, mit dem **Kreuz** löschen, mit **„+ Kriterium“** ergänzen. **„Startbestand ergänzen (n)“** erscheint, wenn Kriterien des Startbestands im Pool fehlen (z. B. gelöschte oder nach einem Update neu hinzugekommene), und fügt sie wieder hinzu; vorhandene Kriterien werden dabei nicht verändert. Änderungen am Pool wirken nur auf neue Bewertungen; bestehende Bewertungen behalten ihre Kriterien.

### 8a.2 Bewertung anlegen

1. Halbjahr wählen → **„+ Neue Bewertung“**.
2. Bezeichnung eingeben und Kriterien aus dem Pool per Haken wählen (die Stufenbeschreibungen erscheinen beim Darüberfahren) – oder unter **„Kriterien übernehmen von“** eine frühere Bewertung (auch aus einem anderen Kurs) als Vorlage nehmen.
3. In der Karte **„Kriterien“** lassen sich die Kriterien **gewichten** (×1, ×2, ×3: ein Kriterium ×2 zählt 0–6 Punkte), mit ↑/↓ sortieren, mit dem Stift-Symbol für diese Bewertung anpassen (wahlweise auch im Pool) und mit dem Kreuz entfernen. **„+ aus dem Pool“** fügt weitere hinzu, **„+ eigenes Kriterium“** legt ein neues an (wahlweise auch im Pool).

Eckdaten wie bei Tests: Bezeichnung, Datum, **Bereich** (Sonstige oder Klassen-/Kursarbeit als Ersatzleistung), „nicht gewertet“, Gewicht, Notenstufen (Sek I) und LIMIT.

### 8a.3 Bewerten

- **Karte „Bewerten“** (für die Bewertung während oder direkt nach der Präsentation): Person wählen (Auswahlliste oder ‹ ›; ✓ = schon bewertet), **Thema** und Datum eintragen, je Kriterium auf **0, 1, 2 oder 3** klicken. Unter dem Kriterium steht die Beschreibung der gewählten Stufe; ein zweiter Klick hebt die Auswahl auf. Darunter eine **Bemerkung** (erscheint auf dem Bewertungsbogen) sowie Summe, Prozent und Note.
- **Karte „Übersicht“:** alle Personen mit Thema, Punkten je Kriterium (direkt eintragbar, nur 0–3), Σ, %, Note und Status (fehlt, Nachschreiben, Täuschung, nicht gewertet – wie bei Tests). Das **Stift-Symbol** am Zeilenende öffnet die Person oben in „Bewerten“. Spalten sind sortierbar.
- Rechts stehen Notenschlüssel (Schwellen änderbar), Notenspiegel und Drittelparagraph wie bei Tests.

Die Note erscheint in der Notenübersicht als eigene Spalte (◉, Sprung über „Präs. ›“) und zählt mit ihrem Gewicht im gewählten Bereich.

### 8a.4 Ausdrucke

**„Drucken …“** bietet:

| Druckart | Inhalt |
|---|---|
| **Für die Lehrkraft** | |
| Bewertungsliste | alle Personen mit Thema, Punkten je Kriterium, Σ, %, Note; darunter Notenspiegel und Schlüssel |
| Notenschlüssel und Notenspiegel | Schwellen je Note und Notenspiegel, ohne Namen |
| Leere Bewertungsbögen | je aktive Person ein Bogen mit Name, Feld für Thema und Datum, je Kriterium Kästchen 0–3 mit Stufenbeschreibung, Summe, Note, Bemerkungszeilen – zum Ankreuzen während der Präsentation |
| **Zum Austeilen** | |
| Bewertungskriterien (Handreichung) | eine Seite für die Klasse vorab: alle Kriterien mit Gruppe, Gewicht und der Beschreibung jeder Stufe 0–3 (mit Punkten je Stufe), ohne Namen und Noten; Notenschlüssel wahlweise |
| Bewertungsbogen je Person | je Person eine Seite: Thema, je Kriterium alle Stufen mit angekreuzter Stufe und Punkten, Summe, Prozent, Bemerkung; Note wahlweise, Linien für Datum und Unterschrift (alle oder eine Person) |

### 8a.5 Vorlagen

Eine **Vorlage** ist ein benannter Satz von Kriterien mit Reihenfolge, Gewichten und Stufenbeschreibungen, z. B. „Referat“ oder „Plakatpräsentation“. Vorlagen gelten für **alle Kurse und Schuljahre**.

- **Standardvorlagen:** OrdoNota bringt drei Vorlagen mit (Kriterien aus dem Startbestand des Pools; hat man ein Kriterium im Pool umformuliert, gilt die eigene Fassung):
  - **Kurzvortrag (ohne Handout)** – Fachliche Richtigkeit ×2, Vollständigkeit, Gliederung, Freies Sprechen, Blickkontakt, Verständlichkeit, Zeitrahmen (höchstens 24 Punkte),
  - **Vortrag** – Fachliche Richtigkeit ×2, Tiefe der Auseinandersetzung, Quellenangaben, Einleitung, Gliederung, Schluss und Fazit, Freies Sprechen, Blickkontakt, Sprechtempo und Pausen, Übersichtlichkeit, Zusammenspiel von Medium und Vortrag, Handout, Fachsprache, Fragen beantworten (45 Punkte),
  - **Hausaufgaben vorstellen** – Fachliche Richtigkeit ×2, Vollständigkeit, Lösungsweg erklären ×2, Darstellung der Lösung, Fachsprache, Fragen beantworten, Umgang mit Fehlern (27 Punkte).

  Sie lassen sich wie eigene Vorlagen umbenennen, löschen und überschreiben. Fehlt eine (gelöscht oder Datenbank aus 1.21), holt **„Standardvorlagen ergänzen (n)“** in der Karte „Vorlagen“ sie zurück (Vergleich über den Namen). Für die Hausaufgaben-Vorlage gibt es drei neue Kriterien im Startbestand: *Lösungsweg erklären* (Inhalt), *Darstellung der Lösung* (Medien), *Umgang mit Fehlern* (Austausch) – in bestehenden Pools über „Startbestand ergänzen“ nachzutragen.
- **Speichern:** In der Karte „Kriterien“ einer Bewertung **„Als Vorlage speichern“** und einen Namen eingeben. Gibt es den Namen schon, ersetzt die App nach Rückfrage die Kriterien dieser Vorlage.
- **Neu aus dem Pool:** In der aufklappbaren Karte **„Vorlagen“** mit **„+ Vorlage aus dem Pool“** Name eingeben und Kriterien ankreuzen.
- **Verwenden:** Beim Anlegen einer Bewertung unter **„Kriterien übernehmen von“** die Vorlage wählen (Gruppe „Vorlagen“; darunter stehen frühere Bewertungen).
- **Verwalten:** In der Karte „Vorlagen“ umbenennen (Stift-Symbol), löschen (Kreuz) und mit **„Handreichung“** die Bewertungskriterien der Vorlage für die Klasse drucken – auch ohne dass schon eine Bewertung existiert.

Bewertungen sind unabhängig von ihrer Vorlage: Spätere Änderungen an der Vorlage oder ihr Löschen ändern bestehende Bewertungen nicht.

### 8a.6 Gruppenpräsentationen

Bei einer Gruppenpräsentation wird die Gruppe **einmal** bewertet, und die Punkte gelten für alle Mitglieder. Einzelne Kriterien lassen sich für eine Person abweichend bewerten. Jede Person bekommt weiter ihre eigene Note.

1. **Form wählen** (Eckdaten, vor dem Bewerten):
   - **Einzelpräsentation** – wie bisher.
   - **Gruppen – Kriterien je Gruppe oder Person:** In der Karte „Kriterien“ legt die Spalte **„Bewertet“** für jedes Kriterium fest, ob es einmal für die Gruppe (Standard, z. B. Inhalt, Gliederung, Medien) oder für jede Person einzeln bewertet wird (z. B. Freies Sprechen, Blickkontakt, Fragen beantworten). Die Einstellung wird in Vorlagen mitgespeichert.
   - **Gruppen – alles als Gruppe:** Alle Kriterien werden für die Gruppe bewertet; Unterschiede nur über Abweichungen.
2. **Gruppen bilden** in der Karte **„Gruppen“**: „+ Gruppe“, Namen ändern, Personen über „+ Person“ hinzufügen und mit × herausnehmen, Gruppe mit dem Kreuz löschen. **„Gruppen übernehmen von …“** kopiert die Gruppen (ohne Punkte) einer Gruppeneinteilung aus dem Reiter „Gruppen“ (Auftrag wird Thema, siehe 10b) oder einer anderen Präsentation des Kurses. Personen ohne Gruppe werden einzeln bewertet; eine Präsentation darf also gemischt sein.
3. **Bewerten** mit dem Umschalter **Gruppe / Person**:
   - **Gruppe:** Gruppe wählen (‹ ›), Thema und Datum der Gruppe, Knöpfe 0–3 für die Gruppenkriterien; darunter je Mitglied die Personenkriterien, Summe, Note und Status. „einzeln ›“ springt zur Personenansicht.
   - **Person:** alle Kriterien einer Person. Bei Gruppenkriterien ist der Gruppenwert vorgewählt. Ein anderer Wert gilt als **Abweichung (◆)** und ersetzt den Gruppenwert nur für diese Person; **„Gruppenwert“** nimmt sie zurück.
   - **Übersicht:** Spalte „Gruppe“; Gruppenwerte grau und kursiv, Abweichungen farbig markiert. Eine andere Zahl in einer Gruppenzelle ist eine Abweichung; Leeren oder der Gruppenwert stellt den Gruppenwert wieder her.
4. **Status** (fehlt, Nachschreiben …) und Bemerkung gelten je Person. Die Bemerkung zur Gruppe erscheint auf den Bewertungsbögen aller Mitglieder.
5. **Ausdrucke:** Die Bewertungsliste ist nach Gruppen geordnet (mit Gruppenspalte, ◆ für Abweichungen, je Kriterium „Gruppe“/„Person“). Bewertungsbögen zeigen Gruppe, Gruppenthema und bei jedem Kriterium „für die Gruppe“ bzw. „je Person“; die Handreichung erklärt das Verfahren.
6. **Zurück zur Einzelpräsentation:** Die Gruppen werden aufgelöst, Gruppenwerte und -themen werden als Einzelbewertung der Mitglieder übernommen – die Noten bleiben gleich.

> Präsentationen brauchen OrdoNota ab Version 1.20 auf allen Geräten (Datenformat 3), Gruppenpräsentationen ab Version 1.23 (Datenformat 4, siehe 21.10).

## 9. Reiter „Notenübersicht“

### 9.1 Halbjahresansicht

Die Tabelle zeigt pro Person alle Leistungen des gewählten Halbjahres:

```
Name │ Klassen-/Kursarbeiten │ Ø │ Sonstige Leistungen          │ Ø │ Gerechnet │ Gesetzt │ [Stift] [Sprechblase]
     │ KA 1 (Test)  KA 2     │   │ HÜ 1  Heft ×2  EPO Sep–Okt   │   │ 2,25  2-  │         │
```

| Spalte | Bedeutung |
|---|---|
| Spalten mit ✎ bzw. ◷ | Ergebnisse aus Tests bzw. EPO-Blöcken; nur anzeigen, bearbeitet wird im jeweiligen Reiter („Test ›“ / „EPO ›“ springt dorthin) |
| Spalten ohne Symbol | direkt eingetragene Einzelnoten (bearbeitbar) |
| ausgegraute Spalte | Test mit Haken „nicht gewertet“ (siehe 7.1); wird angezeigt, zählt aber nicht. **Kompetenztests** (nicht gewertet und mit Kompetenzen, seit 2.11) sind standardmäßig keine Spalte; der Schalter **„Kompetenztests zeigen“** rechts im Kartenkopf blendet sie grau ein (pro Gerät und Kurs). Ausdrucke (Notenliste, Leistungsbögen) zeigen sie nie, die CSV nur bei eingeschaltetem Schalter |
| Spalten mit ◉ | Ergebnisse aus dem Reiter „Präsentationen“ (Sprung über „Präs. ›“) |
| blasses, gestricheltes Feld | Spalte aus dem Reiter „Ziehen“: diese Person wurde nicht gezogen (siehe 10a); eintragen ist trotzdem möglich |
| ausgegraute einzelne Note | Testarbeit dieser Person mit Status „nicht gewertet“ (siehe 7.3); wird angezeigt, zählt aber nicht |
| ausgegraute, durchgestrichene Note | einzeln abgeschaltet (seit 2.18, siehe unten „Noten abschalten“); bleibt gespeichert, zählt aber nicht |
| Ø | gewichteter Schnitt des Bereichs (Sek I: Dezimalnote, MSS: Punkte) |
| Gerechnet | ungerundeter Gesamtschnitt + gerundete Note |
| Gesetzt | Ihre Zeugnisnote, falls sie von der gerechneten abweicht (leer = gerechnete Note gilt) |
| Stift-Symbol | Begründung für eine gesetzte Note (erscheint erst, wenn eine Note gesetzt ist) |
| Sprechblasen-Symbol | Bemerkung zur Person (erscheint auf dem Leistungsbogen) |
| Notiz-Symbol | nur, wenn es Notizen in diesem Kurs gibt (seit 2.6.0, siehe 6.8; nie gedruckt) |
| Fehlst. | Fehlstunden im Halbjahr, in Klammern die unentschuldigten (nur, wenn es Fehlzeiten gibt; Einzelheiten siehe 6.5) |

**Spalten einklappen:** Ein Klick auf **Klassen-/Kursarbeiten** bzw. **Sonstige Leistungen** (mit Pfeil nach unten) im Tabellenkopf klappt die Gruppe ein; dann steht nur noch ihr Ø da (Pfeil nach rechts mit der Zahl der ausgeblendeten Spalten klappt sie wieder auf). Gibt es mindestens zwei Spalten aus dem Reiter „Ziehen“, schiebt **„Ziehungen bündeln (n)“** sie zu einer Spalte **„Ziehen (n)“** mit dem Zeitraum zusammen. Sie zeigt die Noten jeder Person nebeneinander (Bearbeiten nach „Ziehungen einzeln“). Einklappen und Bündeln ändern nur die Ansicht. Die Noten zählen weiter, Ausdrucke und CSV zeigen alle Spalten, und der Zustand wird pro Gerät gemerkt.

**Noten abschalten (seit 2.18):** Der Knopf **„Noten abschalten“** im Kartenkopf schaltet einen Modus ein. Ein Hinweis ersetzt dann die Knöpfe zum Hinzufügen, und Eintippen ist gesperrt. Ein Klick auf eine Note nimmt sie aus der Rechnung, ein zweiter Klick wertet sie wieder. Ein Klick auf einen Spaltenkopf schaltet die ganze Spalte ab oder an (Haken „nicht gewertet“ der Leistung). **„Fertig“** beendet den Modus. Abgeschaltete Noten bleiben gespeichert, erscheinen ausgegraut und durchgestrichen und zählen weder im Ø noch in der Halbjahresnote; Ausdrucke zeigen sie wie „nicht gewertet“.

- **Tests aus dem Reiter „Tests“ und Präsentationen:** Der Klick setzt den Status **„nicht gewertet“** der Person (siehe 7.3), den man auch im Reiter sieht und ändert. Steht dort schon „fehlt“, „nachschreiben“ oder „Täuschung“, schaltet der Klick nichts um und weist darauf hin. Bei einem Nachschreibtermin gilt der Status für den zählenden Termin.
- **Von Hand eingetragene Noten (auch Klassenarbeiten mit „Note direkt“ und Spalten aus „Ziehen“) und EPO-Blöcke:** Die Abschaltung steht an der Leistung (`off`). Ältere Versionen als 2.18 kennen sie nicht und würden diese Note mitzählen.
- Gebündelte Ziehungsspalten („Ziehen (n)“) lassen sich nicht einzeln abschalten; dazu „Ziehungen einzeln“ wählen.

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

**Gesetzte Noten:** Eine Eingabe in „Gesetzt“ überschreibt die gerechnete Note. Die Zeile wird farbig hinterlegt. Über das **Stift-Symbol** können Sie eine Begründung hinterlegen. Sie erscheint auf dem Leistungsbogen.

### 9.2 Jahresnote

Der Umschalter **„Jahresnote“** (nur Jahrgang 5–11) zeigt je Person beide Halbjahresnoten, die gerechnete Jahresnote und das Feld „Gesetzt“. Für die Rechnung wird je Halbjahr die **gesetzte** Halbjahresnote verwendet, wenn eine existiert, sonst der **ungerundete** Schnitt (Details in [Abschnitt 17](#17-halbjahres--und-jahresnote)).

## 9a. Reiter „Kompetenzen“

Seit 2.11. Der Reiter erscheint nur, wenn der Kurs einen **Kompetenzkatalog** hat (Kurs & Schüler → „Kompetenzkatalog“). Er lässt sich wie die anderen Reiter ausschalten (siehe 6.4); ohne Katalog steht beim Haken „(braucht einen Kompetenzkatalog)“.

Die Tabelle zeigt **je Person und Kompetenz**, wie viel Prozent der möglichen Punkte erreicht wurden, aus **allen Tests mit Kompetenzen** im Zeitraum, benotet oder nicht. Gespeichert wird nichts; alles wird aus den Punkten der Tests berechnet.

```
Name      Vorname │ Prozessbezogen            │ Inhaltlich (Leitideen)
                  │ K1     K2     K3     …    │ L1     L3
Becker    Lea     │ ✓ 100  ✓ 100  ◐ 67        │ ✓ 100  ✓ 95
Klein     Noah    │ ◐ 60   –      ✗ 0         │ ◐ 70   ◐ 58
```

- **Zeitraum:** Umschalter „1. HJ | 2. HJ | Schuljahr“ (MSS: „11/1 | 11/2 | Schuljahr“ usw.). Er teilt sich die Wahl mit der Notenübersicht.
- **Rechnung:** Je Kompetenz die Summe der erreichten Punkte geteilt durch die Summe der möglichen Punkte aller Aufgaben mit dieser Kompetenz. Eine Aufgabe zählt bei jeder ihrer Kompetenzen voll; eine Aufgabe mit einer Teilkompetenz (z. B. M-K2.1) zählt für die Kompetenz darüber. **Bonusaufgaben** zählen mit (erreicht und möglich).
- **Stufen:** ✓ **sicher** ab 80 %, ◐ **teilweise** ab 50 %, ✗ **noch nicht** darunter. Die Grenzen stellen Sie je Katalog ein (Einstellungen → Kompetenzkataloge). Farbe und Zeichen gehören zusammen; die Prozent stehen daneben.
- **Wenig Daten:** Unter 3 möglichen Punkten ist die Zelle blass und hat einen kleinen Punkt.
- **„–“:** Die Person hat in diesem Zeitraum keine Punkte zu dieser Kompetenz (nicht mitgeschrieben, „fehlt“, kein Eintrag).
- **Sonderfälle:** „fehlt“, „nachschreiben“ und „Täuschung“ zählen nicht (bei getrennt bewerteten Teilen je Teil). Bei einem **Nachschreibtermin** zählen dessen Punkte statt der Arbeit. „nicht gewertet“ bei einer Person betrifft nur die Note; die Punkte zählen. Hat die Person im Test Punkte, zählt eine leere Aufgabe mit 0.
- **Spalten:** nur Kompetenzen mit Aufgaben im Zeitraum, nach Bereich gruppiert. Darunter steht, welche Kompetenzen des Katalogs noch in keinem Test vorkommen. Ausgeblendete Kompetenzen erscheinen, solange sie Daten haben.
- **Sortieren:** Klick auf eine Kompetenz sortiert aufsteigend (schwächste zuerst), noch ein Klick absteigend.
- **Tooltip:** z. B. „M-L1 Zahl und Operation: 12 von 16 Punkten aus 2 Tests · sicher“.
- **Zeile „Kurs“** (seit 2.12): letzte Zeile der Tabelle, bleibt beim Sortieren unten. Je Kompetenz ein Balken in fester Reihenfolge sicher → teilweise → noch nicht und darunter die Anzahlen. Gezählt werden nur Personen mit Punkten in der Kompetenz; der Tooltip nennt auch die Prozent.
- **Verlauf je Person** (seit 2.12): Klick auf den Namen öffnet den Dialog „Verlauf: Name“. Je Kompetenz mit Punkten im Zeitraum eine kleine Linie mit einem Punkt je Test nach Datum; die Höhe ist das Prozent **in diesem Test**, die gestrichelten Linien sind die Stufengrenzen, jeder Punkt trägt das Stufenzeichen. Alle Zeilen teilen eine Zeitachse (Daten oben), derselbe Test steht also untereinander. Rechts der Stand wie in der Tabelle. Tooltip am Punkt: Test, Datum, „Nachschreibtermin“, Punkte. Ein Test mit „fehlt“ oder Täuschung hat keinen Punkt. **‹ ›** oder die Pfeiltasten wechseln zur vorigen oder nächsten Person in der Reihenfolge der Tabelle.

```
Verlauf: Becker, Lea                     ‹  1 / 12  ›
Kompetenz            Prozent je Test        Stand HJ1
                     03.09.   24.11.
M-K1 argumentieren   ✓────────✓            ✓ 100 % · 2 Tests
M-K3 Probleme lösen           ◐            ◐ 67 % · 1 Test
```

- **Kompetenzbogen** (seit 2.13, „Drucken …“ oben rechts): im Dialog **alle** (je eine Seite, nur Personen mit Punkten im Zeitraum) oder **eine Person**; Zeitraum wie im Umschalter. Je Person eine A4-Seite für Schüler: Kopf mit Fach, Katalog, Name und Zeitraum, dann **„Das kannst du schon“** (✓ sicher) und **„Daran arbeitest du weiter“** (◐ teilweise, ✗ noch nicht), je Kompetenz Zeichen, Name und Bereich in der Reihenfolge des Katalogs. **Ohne Prozent und Punkte.** Unten Zeichenerklärung, Linien für Datum und Unterschrift.

Der Reiter erscheint nie auf dem Beamer. Denselben Verlauf über alle Kurse und Schuljahre zeigt das Personenregister (6.6).

## 10. Reiter „Sitzplan“

Für jeden Kurs lassen sich Sitzpläne für einen oder mehrere Räume anlegen. Jede aktive Person erscheint als Karte mit ihrem **Vornamen** (bei gleichen Vornamen im Kurs mit Initiale des Nachnamens, z. B. „Anna M.“), auf Wunsch mit Foto.

### 10.1 Räume

- Oben stehen die Räume als Karten mit Rastergröße und Zahl der belegten Plätze. Ein Klick wechselt den Raum.
- **„+ Neuer Raum“** legt einen weiteren Raum an (die Bezeichnung wird abgefragt; Rastergröße wie im aktuellen Raum, aber leer).
- **Raum / Bezeichnung** benennt den Raum um, das **Papierkorb-Symbol** löscht ihn (nur wenn es mehr als einen gibt).
- Jeder Raum hat eigene Sitzordnung, Rastergröße und Pultposition. Welcher Raum zuletzt gewählt war, merkt sich jedes Gerät.
- Ein Sitzplan aus Version 1.2/1.3 wird beim Öffnen der Datenbank automatisch zu „Raum 1“.

### 10.2 Sitzordnung

- **Raster bearbeiten** (der Knopf zeigt die aktuelle Größe, z. B. „8 × 5“) blendet an allen vier Seiten des Rasters **+** und **−** ein: oben/unten fügen eine Reihe hinzu bzw. entfernen sie, links/rechts eine Spalte (höchstens 16 Spalten × 12 Reihen). Wird oben oder links etwas eingefügt oder entfernt, rücken alle Plätze mit – die Sitzordnung bleibt erhalten. Sitzen in einer entfernten Reihe/Spalte Personen, fragt die App nach und legt sie zurück in „Noch ohne Platz“. **✓ Raster fertig** blendet die Knöpfe wieder aus. **Lehrerpult** oben oder unten.
- Karten aus **„Noch ohne Platz“** (rechts) mit Maus oder Finger auf einen Platz ziehen. Auf einen besetzten Platz gezogen, **tauschen** die beiden die Plätze. Zurück in die Ablage gezogen, ist die Person wieder vom Plan genommen. Beim Ziehen an den oberen/unteren Rand scrollt die Seite mit.
- **Mit der Tastatur** (seit 2.0): Die Karten sind per Tab erreichbar. Die Eingabe- oder Leertaste wählt eine Karte aus, die Pfeiltasten schieben die ausgewählte Karte auf den Nachbarplatz (sitzt dort jemand, tauschen beide), **Entf** nimmt sie vom Plan. Bei einer Karte ohne Platz setzt die Eingabetaste sie auf den ersten freien Platz. **N** legt eine Notiz zur Person an (seit 2.6.0, siehe 6.8).
- **🎲 Freie Plätze füllen** verteilt alle noch nicht platzierten Personen in zufälliger Reihenfolge auf die freien Plätze. **Alle abräumen** setzt die Sitzordnung des Raums zurück (mit Rückfrage).
- **Drucken** gibt den Plan des gewählten Raums auf einer A4-Seite aus (Raumname in der Überschrift, mit Fotos, soweit vorhanden).
- Neue Personen im Kurs erscheinen automatisch in der Ablage, inaktive verschwinden vom Plan.

### 10.2a Beamer (seit 2.1)

- **Beamer** in der Werkzeugleiste zeigt den Sitzplan des gewählten Raums im Vollbild: oben Kurs und Raum, darunter das Raster mit großen Vornamen und dem Lehrerpult. Die Plätze werden so groß, wie der Bildschirm es zulässt; leere Plätze sind blass angedeutet, damit die Reihen erkennbar bleiben.
- Die Anordnung ist dieselbe wie im Editor: Das Pult steht oben oder unten, so wie es für den Raum eingestellt ist.
- **Fotos** sind im Vollbild zunächst aus (große Namen sind von hinten besser lesbar, projizierte Fotos sind heikler). Der Schalter blendet Fotos bzw. das Personensymbol ein. Die Wahl merkt sich das Gerät, unabhängig von „Fotos ausblenden“ im Editor.
- Wer noch keinen Platz hat, steht unten in der Leiste **„Noch ohne Platz: …“** (nur, wenn es solche Personen gibt).
- Im Vollbild lässt sich nichts bearbeiten. Es zeigt nie Noten, I-Status oder andere vertrauliche Angaben. **Esc**, das Verlassen des Vollbilds oder **Schließen** beenden die Ansicht.

### 10.3 Gespeicherte Stände

- **„Stand speichern …“** legt eine Kopie der aktuellen Sitzordnung des gewählten Raums unter einem Namen ab (z. B. „ab Herbstferien“).
- **Laden** ersetzt die Sitzordnung des gerade gewählten Raums nach Rückfrage durch den Stand, das **Kreuz** löscht ihn.
- Die Stände gelten für den ganzen Kurs; der Raum, aus dem sie stammen, steht dabei. Personen, die es im Stand noch nicht gab, landen beim Laden in der Ablage.

### 10.4 Fotos

- **Einfügen:** Foto kopieren (z. B. in WebUntis: Rechtsklick auf das Foto → „Bild kopieren“), im Sitzplan die Karte **anklicken** (blauer Rahmen) und **Strg+V** drücken.
- **Ziehen:** Eine Bilddatei aus dem Dateimanager oder ein Bild aus einem anderen Browser-Tab auf die Karte ziehen. Ob das Ziehen direkt aus WebUntis klappt, hängt davon ab, wie WebUntis das Bild ausliefert; sonst erscheint ein Hinweis, und der Weg über „Bild kopieren“ + Strg+V funktioniert.
- Das Foto wird quadratisch zugeschnitten (bei Hochformat eher oben, wo das Gesicht ist), auf 160 × 160 Pixel verkleinert und **verschlüsselt in der Datenbank** gespeichert (etwa 5–20 KB pro Foto).
- Gleichnamige Personen in anderen Kursen desselben Schuljahres, die noch kein Foto haben, bekommen es automatisch mit.
- Karten ohne Foto zeigen ein blasses Personensymbol als Platzhalter – am Bildschirm und im Ausdruck, damit der Plan einheitlich aussieht.
- **Entfernen:** Mit der Maus über die Karte fahren und auf **×** klicken.
- **Ausblenden:** Der Knopf **„Fotos ausblenden“** in der Werkzeugleiste blendet alle Fotos auf den Karten aus, z. B. wenn der Sitzplan am Beamer gezeigt wird. Die Fotos bleiben gespeichert; „Fotos einblenden“ zeigt sie wieder. Die Einstellung gilt auch für den Ausdruck und wird auf diesem Gerät gemerkt.
- **Datenschutz:** Schülerfotos sind personenbezogene Daten. Ob sie in einer eigenen Anwendung gespeichert werden dürfen, regelt die Schule (Schulleitung bzw. Datenschutzbeauftragte/r).

## 10a. Reiter „Ziehen“

Zieht zufällig eine gewählte Anzahl von Personen, z. B. um Hausaufgaben einzusammeln und zu bewerten. Wer gezogen wurde, fällt aus dem **Pool**, bis dieser wieder aufgefüllt wird. So kommen alle der Reihe nach dran.

Oben wählen Sie den **Pool**: **Klassisch** (wie bisher, je Ziehung eine eigene Spalte) oder einen **benannten Pool** mit einer gemeinsamen Spalte (siehe unten, seit 1.37).

**Klassischer Pool**

- **Anzahl** eintragen (wird auf diesem Gerät gemerkt), **🎲 Ziehen** klicken. Die Gezogenen erscheinen groß mit Foto (bzw. Personensymbol) – geeignet auch für den Beamer.
- **Bewerten:** Jede Ziehung legt im gewählten Halbjahr bei den **sonstigen Leistungen** eine Spalte „HA-Kontrolle TT.MM.“ an (Gewicht 1). Die Note tragen Sie direkt unter dem Namen ein; nur die Gezogenen bekommen eine Note, für alle anderen bleibt die Spalte leer und zählt nicht. In der Notenübersicht sind die Felder der Nicht-Gezogenen blass und gestrichelt dargestellt; sie lassen sich bei Bedarf trotzdem ausfüllen (dann erscheinen sie normal). Name, Gewicht und Bereich lassen sich wie bei jeder Spalte in der Notenübersicht ändern; Kürzel wie `f` (fehlt) ebenfalls dort.
- **Auffüllen:** Sind weniger Personen im Pool als gezogen werden sollen, werden zuerst alle Übrigen gezogen, dann wird der Pool automatisch aufgefüllt und der Rest daraus gezogen (mit Hinweis). **Pool auffüllen** setzt den Pool jederzeit von Hand zurück; vergebene Noten bleiben erhalten.
- **Übersicht „Pool“:** zeigt je Person den Status *im Pool*, *gezogen TT.MM.* oder *herausgenommen* (sortierbar).
  - Haken **„Im Pool“** entfernen nimmt eine Person aus dem Pool heraus (bis zum nächsten Auffüllen); Haken setzen nimmt sie wieder auf – auch nach einer Ziehung.
  - Haken **„Heute abwesend“**: Die Person wird bei der Ziehung übersprungen, bleibt aber im Pool. Seit 1.45 wird der Haken als Fehlzeit von heute gespeichert (siehe 6.5) und ist am nächsten Tag wieder leer. Er gilt auch im Reiter „Gruppen“ (Abwesende werden beim Gruppenbilden ausgelassen, siehe 10b).
- Nicht mehr aktive Personen (siehe 6.2) werden nie gezogen.
- **Rückgängig** (bei der letzten Ziehung) stellt den Pool wie vor der Ziehung wieder her und löscht die angelegte Notenspalte – mit Rückfrage, besonders wenn schon Noten eingetragen sind.
- **Frühere Ziehungen** (aufklappbar) listen Datum, Spalte und die Gezogenen. Die Noten lassen sich dort **nachtragen oder ändern** (Enter springt zur nächsten Person); sie landen in der Notenspalte der jeweiligen Ziehung.
- **Frühere Ziehung löschen** (seit 2.17, Papierkorb am Ende der Zeile): löscht die Ziehung und ihre Notenspalte. Die Rückfrage nennt, wie viele Noten dabei verloren gehen. Wer seitdem nicht erneut gezogen wurde, kommt wieder in den Topf; spätere Ziehungen bleiben unverändert. Für die letzte Ziehung gibt es weiter **Rückgängig**.

**Benannte Pools (eine Spalte für alle Ziehungen)**

Für eine Runde, in der jede Person genau einmal drankommt, z. B. „HA Runde 1“ oder „Abfragen Binomische Formeln“:

- **+ Neuer Pool** fragt nach dem Namen und legt im gewählten Halbjahr eine Spalte mit diesem Namen bei den **sonstigen Leistungen** an (Gewicht 1, änderbar wie jede Spalte in der Notenübersicht). Mehrere Pools pro Kurs und Halbjahr sind möglich; die Auswahl oben wechselt zwischen ihnen (auf diesem Gerät gemerkt).
- **🎲 Ziehen** zieht aus dem Pool. Alle Noten landen in der **einen Spalte** des Pools. In der Notenübersicht zeigt ihr Kopf den **Zeitraum** der Ziehungen (z. B. „12.10.–19.10.“), Felder noch nicht Gezogener sind blass und gestrichelt. Auch der Ausdruck der Notenliste zeigt den Zeitraum.
- **Eine Runde:** Sind weniger Personen übrig als gewünscht, werden nur die Übrigen gezogen. Danach ist der Pool **fertig** (✓ in der Auswahl), es wird nicht automatisch aufgefüllt. Für weitere Ziehungen einen neuen Pool anlegen.
- „Im Pool“, „Heute abwesend“, **Rückgängig** (löscht nur die Noten der zurückgenommenen Ziehung aus der Spalte) und „Frühere Ziehungen“ funktionieren wie beim klassischen Pool. Beim Löschen einer früheren Ziehung bleibt die Sammelspalte; nur die Noten ihrer Gezogenen werden entfernt (außer bei Personen, die im Pool noch in einer anderen Ziehung stehen). Herausgenommene Personen zählen nicht zur Runde.
- **Umbenennen** ändert den Namen von Pool und Spalte. **Löschen** entfernt nur den Pool; die Spalte mit allen Noten bleibt.

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
- **Heute abwesend** (aufklappbare Karte, gemeinsam mit dem Reiter „Ziehen“, als Fehlzeit von heute gespeichert, siehe 6.5): Diese Personen werden ausgelassen und stehen unter „Nicht eingeteilt“.

**Nacharbeiten:**
- **Neu würfeln** mischt alle nicht fixierten Gruppen neu. das **Schloss-Symbol** fixiert eine Gruppe, sie bleibt beim Neuwürfeln unverändert.
- **Verfahren** ändert Größe, Verfahren und Abwechslung (wahlweise sofort neu würfeln).
- Personen mit Maus, Stift oder Finger **ziehen** (wie im Sitzplan): auf einer Gruppe (oder bei „Nicht eingeteilt“) ablegen = verschieben, auf einer anderen Person ablegen = tauschen. Das Ziel wird beim Ziehen hervorgehoben, am oberen/unteren Rand scrollt die Seite mit; wer zwischen den Gruppen loslässt, bleibt, wo er war – oder **anklicken** und dann eine Gruppe anklicken (verschieben) bzw. eine andere Person anklicken (tauschen).
- Gruppennamen ändern, je Gruppe einen **Auftrag/ein Thema** eintragen, „+ Gruppe“, Gruppe mit dem Kreuz löschen (Mitglieder werden „nicht eingeteilt“).
- Umschalter **Fotos** und **Nachnamen** neben der Einteilung: Fotos (bzw. Personensymbol) bei den Namen zeigen, Nachnamen ausblenden (bei gleichen Vornamen mit Initiale). Pro Gerät gemerkt; beim Darüberfahren steht immer der volle Name.
- Werden Regeln verletzt (z. B. nach einem Verschieben von Hand) oder sind Abwesende eingeteilt, erscheint ein Hinweis ⚠.

**Regeln** (aufklappbare Karte, gelten für alle Einteilungen des Kurses):
- **Nicht zusammen:** Diese Paare kommen nie in dieselbe Gruppe.
- **Zusammen:** Diese Paare bleiben zusammen (z. B. Unterstützung).
- Regeln gehen beim Würfeln vor Leistung und Abwechslung. Sie sind vertraulich: verschlüsselt gespeichert wie alle Daten und nur in dieser Karte zu sehen – nie auf dem Beamer oder im Ausdruck.

**Gruppenpuzzle:** In einer Einteilung (den Stammgruppen) **„Expertengruppen bilden“** klicken. Jede Person der Stammgruppe bekommt einen Buchstaben (A, B, C … = Teilthema); alle mit A bilden die Expertengruppe A usw. So sitzt aus jeder Stammgruppe genau eine Person in jeder Expertengruppe. Die **Expertengruppen erscheinen direkt unter den Stammgruppen** (gleiche Einteilung, kein eigener Eintrag in der Liste) mit eigenem Teilthema je Gruppe, Beamer, Druck und Papierkorb-Symbol. Die **Anzahl der Teilthemen** (= Expertengruppen) ist oben in der Karte einstellbar (Standard: Größe der größten Stammgruppe); die Themen werden dann reihum verteilt, sodass die Expertengruppen möglichst gleich groß sind und sich innerhalb einer Stammgruppe kein Thema wiederholt, solange sie nicht mehr Personen als Themen hat. „+ Gruppe“ und das Kreuz ändern die Anzahl ebenfalls. Werden die Stammgruppen danach geändert (neu gewürfelt, Personen verschoben, hinzugefügt oder entfernt), erscheint ein Hinweis; **„↻ Neu verteilen“** verteilt alle neu und behält Anzahl, Gruppennamen und Teilthemen. Die Buchstaben stehen auch auf Beamer und Ausdruck der Stammgruppen. Beim Löschen der Stammgruppen werden die Expertengruppen mitgelöscht.

**Zeigen, drucken, übernehmen:**
- **Beamer:** alle Gruppen mit Auftrag und Namen im Vollbild (Esc schließt). Beim Gruppenpuzzle schaltet ein Umschalter oben zwischen **Stammgruppen** und **Expertengruppen** um (der Beamer-Knopf der Expertengruppen öffnet direkt diese). Die Schrift wird automatisch so groß gewählt, dass alle Gruppen ohne Scrollen auf den Bildschirm passen. Umschalter oben rechts: **Fotos** (Foto bzw. Personensymbol vor dem Namen) und **Nachnamen** (aus: nur Vornamen, bei gleichen Vornamen mit Initiale, z. B. „Lea B.“). Beide werden pro Gerät gemerkt.
- **Drucken …:** *Gruppeneinteilung* (alle Gruppen auf einer Seite zum Aushängen) oder *Gruppenkarten* (je Gruppe eine Karte zum Ausschneiden).
- **→ In Präsentation übernehmen:** kopiert die Gruppen in eine Präsentation des Kurses; der Auftrag wird zum Thema der Gruppe. Eine Einzelpräsentation wird dabei zur Gruppenpräsentation (Kriterien je Gruppe oder Person, siehe 8a.6). Umgekehrt geht es in der Präsentation über „Gruppen übernehmen von …“.

## 10c. Reiter „Tools“

Werkzeuge für den Unterricht (bis Version 1.35 hieß der Reiter „Zufall“). **Es wird nichts in die Notenliste eingetragen**, und die Ergebnisse gelten nur, bis die App geschlossen oder neu geladen wird. Alle Werkzeuge stehen in gleich großen Kacheln. Oben rechts im Reiter öffnet **Werkzeuge …** die Auswahl für den Kurs: Haken schalten ein Werkzeug ein oder aus, die Pfeile nach oben und unten ändern die Reihenfolge, **Standard (alle an)** stellt alles zurück. Die Auswahl gilt sofort, nur für diesen Kurs und auf allen Geräten (sie steht in der Datenbank). Ein laufender Timer läuft weiter, auch wenn seine Kachel ausgeschaltet ist. Sind alle Werkzeuge aus, zeigt der Reiter einen Hinweis mit demselben Knopf. Jedes Werkzeug hat oben rechts **Vollbild** für den Beamer (Esc beendet). Bei „Bewegung reduzieren“ im Betriebssystem erscheint das Ergebnis ohne Animation.

- **Timer:** großer Countdown, z. B. für Arbeitsphasen. Zeit eintragen (`5` = 5 Minuten, `2,5`, `4:30` oder `90s`) oder eine **Schnellwahl** (1 bis 30 Min.) anklicken, dann **Start**. **Pause** hält an, **Weiter** läuft weiter, **− 1 Min.**/**+ 1 Min.** ändern die Zeit auch während des Laufens, das **Symbol mit dem kreisförmigen Pfeil** („Zurücksetzen“) setzt auf die eingestellte Zeit zurück.
  - **Design:** Ring (Standard, läuft im Uhrzeigersinn ab: der Rest endet bei 12 Uhr), große Ziffern, Balken oder Sanduhr. Die Farbe zeigt, wie viel Zeit bleibt: blau, in der letzten Minute (bei kurzen Timern im letzten Fünftel) gelb, in den letzten 10 Sekunden und am Ende rot. Am Ende blinkt 00:00, „Zeit ist um!“ erscheint und daneben die Überzeit.
  - **Signal** am Ende: Gong, Wecker, Piepen oder aus. Die Lautstärke ist die des Pomodoro-Timers (Einstellungen).
  - **Pop-up** öffnet den Timer in einem eigenen, frei verschiebbaren Fenster, z. B. auf dem Beamer, während die App auf dem Laptop bleibt. Im Fenster gibt es Start/Pause, ± 1 Min. und Zurücksetzen; die Leertaste startet bzw. hält an. Fenster und Reiter zeigen denselben Timer. Blockiert der Browser das Fenster, hilft „Pop-ups erlauben“ oder **Vollbild**.
  - Der Timer gilt für die ganze App, nicht je Kurs. Er läuft beim Wechsel von Reiter oder Kurs weiter, endet aber beim Schließen oder Neuladen der App. Zeit, Design und Signal merkt sich das Gerät.
- **Zufallszahl:** „von“ und „bis“ eintragen (ganze Zahlen, auch negativ; beide Grenzen sind möglich), **🎲 Zahl erzeugen**. Darunter stehen die letzten Ergebnisse.
- **Personen auswählen:** Anzahl eintragen, **🎲 Auswählen**. Die Ausgewählten erscheinen mit Foto (bzw. Personensymbol). Ohne Haken ist jede Auswahl unabhängig, dieselbe Person kann also gleich wieder kommen. Mit **„Keine Wiederholung“** kommt, wer dran war, erst wieder, wenn alle dran waren (Anzeige „x von y noch nicht dran“, „alle wieder aufnehmen“). Das ist unabhängig vom Pool im Reiter „Ziehen“. Wer dort „heute abwesend“ ist, wird auch hier ausgelassen.
- **Würfel:** W4, W6, W8, W10, W12 oder W20 und 1–6 Würfel wählen, **🎲 Würfeln**. Die Würfel rollen als 3D-Körper über den Tisch und bleiben liegen. Sie werden dann genau von oben gezeigt: Die gewürfelte Seite zeigt nach vorn, ihre Zahl ist kräftig, die Zahlen der schrägen Nachbarflächen sind blass. Bei mehreren Würfeln stehen die Einzelwerte und die Summe darunter (z. B. „4 + 2 + 5 = 11“). Wie bei echten Würfeln ergeben gegenüberliegende Seiten zusammen n + 1. 6 und 9 sind ab dem W10 mit Punkt markiert („6.“, „9.“).
- **Karten ziehen:** Stapel wählen: **52 Karten** (Poker/Rommé, 2 bis Ass), **32 Karten** (Skat, 7 bis Ass) oder **eigene Karten**, dazu die **Anzahl**. **🂠 Ziehen** oder ein Klick auf den Stapel zieht so viele Karten auf einmal: Sie fliegen nacheinander vom Stapel und drehen sich um. Der Stapel bleibt immer sichtbar, er wird mit jeder Ziehung niedriger, die Restzahl steht darunter, und leer erscheint er als gestrichelter Platz. Gezogen wird ohne Zurücklegen. Sind weniger Karten übrig als gewünscht, kommen die restlichen (mit Hinweis). Frühere Ziehungen stehen klein darunter. **Neu mischen** legt alle zurück. Die Karten zeigen die englischen Buchstaben J, Q, K für Bube, Dame, König, die Liste darunter B, D, K. Die Kartenbilder sind gemeinfrei (CC0, Quelle in `cards/LIZENZ.txt`).
- **Begriffe in Gruppen** (seit 2.20): verteilt eine Liste von Begriffen (Themen, Aufgaben, Rollen, Namen) zufällig auf Gruppen. Unter **„Begriffe bearbeiten“** je Zeile einen Begriff eintragen oder einfügen; **„Namen des Kurses einsetzen“** übernimmt die Vornamen aller Personen außer den heute Abwesenden (eine vorhandene Liste wird nach Rückfrage ersetzt). Vorgabe **„Anzahl Gruppen“** (Standard) oder **„Begriffe je Gruppe“** mit der **Anzahl**; bei „je Gruppe“ wird die Zahl der Gruppen gerundet wie im Reiter „Gruppen“ (5 Begriffe, je 2 → 3 Gruppen). Die Gruppen sind höchstens um einen Begriff verschieden groß. **🎲 Mischen** verteilt neu, **„Als Text kopieren“** legt „Gruppe 1: …“ je Zeile in die Zwischenablage. Liste, Vorgabe und das letzte Ergebnis werden im Kurs gespeichert und sind in der nächsten Stunde noch da; einen Verlauf und einen eigenen Ausdruck gibt es nicht. Mischen im **Vollbild** bleibt im Vollbild.
  - **Eigene Karten** (z. B. Themen, Aufgaben, Rollen): „Eigene Karten bearbeiten“ aufklappen, je Zeile eine Karte eintragen, **Übernehmen und neu mischen**. Die Liste wird im Kurs gespeichert.

## 11. Drucken und Exportieren

Alle Ausdrucke öffnen den Druckdialog des Browsers. Dort können Sie auch **„Als PDF speichern“** wählen. Breite Tabellen werden automatisch im Querformat gedruckt. Die Kopf- und Fußzeilen des Browsers (Datum, Dateipfad, Seitenzahl) werden unterdrückt; der Rand von 12 mm bleibt auf jeder Seite erhalten.

**Druckkopf (seit 1.47):** Alle Ausdrucke haben denselben Kopf. Links stehen Schullogo und Schulname, rechts Kurs, Schuljahr (mit Halbjahr), Lehrkraft und Datum. Das Datum ist das der Leistung (z. B. „Testdatum“), sonst „Stand“ mit dem Druckdatum. Darunter folgen Titel, bei Bögen je Person der Name, und eine Zeile mit Angaben zur Leistung. Logo, Schulname und Lehrkraft tragen Sie unter Einstellungen → **Ausdrucke** ein (siehe 12). Was leer ist, fällt weg; ohne Logo und Schulnamen steht der Titel links wie bisher. Zettel zum Ausschneiden (Ergebniszettel, Mitarbeitszettel) bekommen eine einzeilige Fassung: kleines Logo, Schulname, Name der Person, rechts Leistung, Kurs und Datum. Die Gruppenkarten zum Ausschneiden bleiben ohne Kopf.

In Tests, Mitarbeit/EPO und Notenübersicht fasst je ein Knopf **„Drucken …“** alle Druckarten zusammen. Er öffnet eine Auswahl, gegliedert nach **„Für die Lehrkraft“** und **„Zum Austeilen“**; ein Tooltip beschreibt jede Druckart.

| Wo | Druckart / Knopf | Inhalt |
|---|---|---|
| Notenübersicht | Notenliste | alle Leistungen, Schnitte und Noten des gewählten Halbjahres bzw. die Jahresnoten; gesetzte Noten mit * |
| Notenübersicht | 👤 Leistungsbögen je Person | eine Seite je Person (Auswahl siehe unten) |
| Notenübersicht, Kurs & Schüler | 🗓️ Fehlzeiten | alle Unterrichtstage des Halbjahres mit A/E/U je Person und den Summen in Unterrichtsstunden (siehe 6.5) |
| Notenübersicht | CSV/Excel (eigener Knopf) | alle Noten und Ergebnisse des Kurses als CSV (Semikolon, öffnet direkt in Excel) |
| Kurs & Schüler | Excel | Schülerliste als Excel-Datei (.xlsx): Nr., Nachname, Vorname, I-Status, Aktiv (siehe 6.3) |
| Tests | Ergebnisliste · Ergebnisse nach Teilen · Notenschlüssel und Notenspiegel · Trennblätter für OrdoScripto · Ergebniszettel · Moodle-Rückmeldung | siehe 7.6 bis 7.9 |
| Kompetenzen | Kompetenzbogen je Person | siehe 9a |
| Tests | Beamer (eigener Knopf) | Vollbild ohne Namen: Notenspiegel, Punkteverteilung, Ø je Aufgabe (siehe 7.5) |
| Sitzplan | Drucken | Sitzplan des gewählten Raums mit Vornamen, Fotos und Lehrerpult, A4 (quer, wenn mehr Spalten als Reihen) |
| Gruppen | Gruppeneinteilung · Gruppenkarten | siehe 10b; ohne Noten und Regeln |
| Präsentationen | Bewertungsliste · Notenschlüssel · Leere Bewertungsbögen · Bewertungskriterien (Handreichung) · Bewertungsbogen je Person | siehe 8a.4; Handreichung auch je Vorlage (8a.5) |
| Mitarbeit/EPO | Bewertungsliste | Bewertungsraster aller Stunden mit Ergebnis und Note je Person |
| Mitarbeit/EPO | Mitarbeitszettel zum Ausschneiden | ein Zettel pro Person (mehrere pro Blatt, gestrichelte Schnittlinie): Name, Kurs, Blockname und Zeitraum, Punktelegende, Bewertungen mit Datum im Tabellenkopf, Ergebnis mit Note sowie Linien für Datum und Unterschrift |

**Leistungsbögen:** Im Dialog wählen Sie **für wen** (alle oder eine Person), den **Zeitraum** (alle Halbjahre oder eines) und den **Inhalt**:

- Einzelnoten mit Datum und Gewicht
- Schnitte (Klassenarbeiten / Sonstige)
- Halbjahres- und Jahresnote (gerechnet und gesetzt, mit Begründung)
- Test-Details je Aufgabe
- Präsentationen je Kriterium (mit Thema und Bemerkung)
- EPO-Zusammenfassung (Anzahl ++/+/0/-/--, Fehlstunden, Hausaufgaben-Vermerke, Material vergessen)
- Fehlzeiten (Unterrichtsstunden, entschuldigt, unentschuldigt, offen; seit 1.45)
- Bemerkung

So eignet sich derselbe Bogen für Elterngespräche (z. B. ohne Bemerkung) und für die eigenen Unterlagen.

**Excel-Schülerliste:** echte `.xlsx`-Datei (ohne Makros), Kopfzeile fett und beim Scrollen fixiert, Tabellenblatt nach dem Kurs benannt. Öffnet in Excel, LibreOffice und Numbers. Die Datei ist **nicht verschlüsselt**.

**CSV-Export:** Spalten Nr, Nachname, Vorname, danach je Halbjahr alle Einzelleistungen, Ø KA, Ø Sonstige, gerechnet, Note, zuletzt (falls vorhanden) Jahr gerechnet und Jahresnote. Die Datei ist **nicht verschlüsselt**. Behandeln Sie sie entsprechend und löschen Sie sie nach Gebrauch.

## 12. Reiter „Einstellungen“

| Bereich | Einstellung | Standard |
|---|---|---|
| Sicherheit | Passwort ändern | – |
| | Neuen Wiederherstellungsschlüssel erzeugen (der alte wird ungültig) | – |
| | Automatisch sperren nach … Minuten ohne Aktivität (0 = nie). Nach dem Ruhezustand sperrt die App immer (seit 2.16) | 15 |
| Standardwerte für neue Tests | LIMIT Sek I (4- ab … %) | 50 |
| | LIMIT MSS (04 Punkte ab … %) | 45 |
| | Punkte-Genauigkeit | ganze Punkte |
| | Bereich (Klassen-/Kursarbeit oder Sonstige) | Sonstige |
| EPO-Umrechnung (seit 2.8) | Vorlage für neue EPO-Blöcke, getrennt für Sek I und MSS (eingebaut oder eigene, siehe 8.3) | 0 = befriedigend |
| | Eigene Vorlagen umbenennen und löschen (Blöcke behalten ihre Werte und zeigen dann „angepasst“; war sie Standard, gilt wieder „0 = befriedigend“) | – |
| Kompetenzkataloge (seit 2.9) | Kataloge anlegen (aus Vorlage, leer oder per Import), bearbeiten, als Datei exportieren, löschen (nur, wenn kein Kurs ihn verwendet) | keiner |
| Ausdrucke (seit 1.47) | Schulname, Lehrkraft | leer |
| | Schullogo wählen / ändern / entfernen (PNG, JPEG, GIF, WebP oder SVG; Rasterbilder auf höchstens 600 px verkleinert) | kein Logo |
| Speicherort & Sicherungen | Name dieses Geräts | – |
| | Anzahl aufbewahrter Sicherungen | 10 |
| | Sicherung höchstens alle … Minuten | 10 |
| | Jetzt sichern / Verschlüsselte Kopie herunterladen / Aus Datei wiederherstellen / Datenordner wechseln / Sicherung wiederherstellen (siehe 20) / Datenbank prüfen (siehe 21.14) | – |
| Schuljahre | Umbenennen, leere Schuljahre löschen | – |
| Reiter | Reiter ein-/ausschalten als Standard für alle Kurse (Tests, Mitarbeit/EPO, Präsentationen, Ziehen, Tools, Gruppen, Notenübersicht, Sitzplan); einzelne Kurse können abweichen (6.4) | alle an |
| | Reihenfolge der Reiter (Pfeile nach oben und unten, auch durch Ziehen in der Reiterleiste; gilt für alle Kurse) | Standardreihenfolge |
| Darstellung | Noten farbig hinterlegen | an |
| | Farbschema: wie System / hell / dunkel | wie System |
| | Helles Design: Standard / Salbei / Lavendel (Vorschaukacheln) | Standard |
| | Dunkles Design: Standard / Nord / Aubergine (Vorschaukacheln) | Standard |
| 🍅 Pomodoro-Timer | Timer in der Kopfzeile anzeigen | aus |
| | Anzahl Pomodoros / Länge eines Pomodoros | 4 / 25 Min. |
| | Kurze Pause / lange Pause am Ende (0 = keine) | 5 / 15 Min. |
| | Ticken: aus / nur Pomodoros / immer | aus |
| | Signal bei Phasenwechsel: aus / Wecker klingeln / Gong / Piepen (je mit „Probe“) | Wecker klingeln |
| | Lautstärke | 60 % |

**Pomodoro-Timer:** Ist er aktiviert, steht er in der Kopfzeile neben dem Schuljahr: Phase (🍅 2/4 bzw. ☕ Pause), verbleibende Zeit und die Knöpfe **Start**, **Pause**, **Zurücksetzen** und **Einstellungen** (Zahnrad-Symbol; dieselben Einstellungen wie im Reiter, als Dialog). Farben: **rot** = Pomodoro läuft, **grün** = Pause läuft, **gelb** = pausiert, grau = bereit bzw. fertig. Nach jedem Pomodoro beginnt automatisch die kurze Pause, nach dem letzten die lange Pause; danach ist der Durchlauf fertig. Bei jedem Phasenwechsel erklingt das gewählte Signal und eine Meldung erscheint. Die Töne erzeugt die App selbst (keine Tondateien). Der Timer läuft weiter, wenn die App gesperrt oder neu geladen wird; sein Stand gilt pro Gerät.

**Ausdrucke (seit 1.47):** Schulname, Lehrkraft und Logo erscheinen im Kopf aller Ausdrucke (siehe 11). Sie liegen in der verschlüsselten Datenbank und gelten damit auf allen Geräten. Das Logo wird als Bild in der Datenbank gespeichert; ein großes Foto verkleinert die App beim Hochladen auf 600 px an der längsten Seite, SVG-Dateien (bis 300 KB) bleiben unverändert. Das Notfallwerkzeug gibt das Logo nicht in der CSV aus.

**Designs (seit 1.43):** Für den hellen und den dunklen Modus gibt es je drei Designs: hell **Standard** (Petrol), **Salbei** (grünliches Grau) und **Lavendel** (Flieder); dunkel **Standard** (Schiefer), **Nord** (kühles Blaugrau) und **Aubergine** (dunkles Violett). Jede Kachel zeigt eine kleine Vorschau mit Schrift, Akzentfarbe und drei Notenfarben; ein Klick wählt das Design sofort. Ist das Farbschema fest auf hell oder dunkel gestellt, wechselt es beim Klick auf eine Kachel des anderen Modus mit; bei „Wie das System“ gilt das Design, sobald das System in diesen Modus wechselt. Der Schalter **Hell / Dunkel / Wie das System** in der Kopfzeile wechselt nur den Modus und behält die gewählten Designs. Die Notenfarben (grün → rot) bleiben in allen Designs gleich, Ausdrucke sind immer schwarz auf weiß, und das Timer-Pop-up übernimmt das Design.

**Kompetenzkataloge (seit 2.9):** Ein Katalog enthält Bereiche (z. B. „Prozessbezogen“, „Inhaltlich (Leitideen)“), darin Kompetenzen und bei Bedarf Teilkompetenzen, jede mit **Kennung** (z. B. „M-K2“) und Bezeichnung. Er gilt für alle Kurse, die ihn in den Kursdaten gewählt haben (siehe 6.1).

- **Aus Vorlage …:** legt eine Kopie an. Eingebaut ist „Mathematik Sek I (Bildungsstandards 2022)“ mit den sieben prozessbezogenen Kompetenzen M-K1 bis M-K7 (argumentieren, kommunizieren, Probleme lösen, modellieren, darstellen, mit mathematischen Objekten umgehen, mit Medien arbeiten) und den fünf Leitideen M-L1 bis M-L5 (Zahl und Operation, Größen und Messen, Strukturen und funktionaler Zusammenhang, Raum und Form, Daten und Zufall). Die KMK nummeriert nicht; die Kennungen folgen der Reihenfolge im Beschluss vom 23.06.2022.
- **Bearbeiten** (Stift): Name, Fach, Stufengrenzen („teilweise“ ab 50 %, „sicher“ ab 80 %; „teilweise“ muss kleiner sein) und die Einträge. „+ Kompetenz“, „+ Teil“ und „+ Bereich“ legen neue Einträge mit einer vorgeschlagenen Kennung an. Jede Änderung wird sofort gespeichert und zählt die Version des Katalogs hoch.
- **Kennungen bleiben fest, sobald sie vergeben sind:** Solange keine Aufgabe eine Kennung trägt, lässt sie sich ändern oder löschen. Danach steht sie grau ohne Eingabefeld, und statt Löschen gibt es **Ausblenden** (Auge): Ausgeblendete Einträge sind durchgestrichen, für neue Aufgaben nicht mehr wählbar, und alte Tests bleiben auswertbar. Eine Kennung kommt in einem Katalog nur einmal vor.
- **Exportieren** (Pfeil nach unten): speichert den Katalog als JSON-Datei („Kompetenzkatalog – Name.json“, Format `ordonota-kompetenzkatalog`). Diese Datei liest auch das Bauskript für Moodle-Fragen, damit beide dieselben Kennungen verwenden. Eine Vorlage liegt im Repository unter `vorlagen/kompetenzen/mathe-sek1.json`.
- **Importieren:** liest eine solche Datei. Gibt es den Katalog (gleiche Katalog-Kennung) schon, fragt die App: **Ersetzen** (die Kurse behalten ihn) oder **Als neuen Katalog**. Ersetzen geht nicht, wenn in der Datei Kennungen fehlen, die an Aufgaben vergeben sind.

**Reiter:** Ausgeschaltete Reiter verschwinden aus der Reiterleiste aller Kurse, die keine eigene Auswahl haben (siehe 6.4). Daten daraus bleiben gespeichert und zählen weiter. Unter den Haken steht, wie viele Kurse abweichen.

Gerätename, Farbschema mit den gewählten Designs und der Stand des Pomodoro-Timers gelten **pro Gerät/Browser**. Alles andere ist in der Datenbank gespeichert und gilt auf allen Geräten.

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
5. **Nicht erreichbare Stufen:** Hat eine bessere Stufe dieselbe (oder eine niedrigere) Mindestpunktzahl, wird die schwächere Stufe nie vergeben (Regel 3). Die App rechnet trotzdem nach der Formel weiter und warnt nur (`NM.grades.unreachableSteps`); Abhilfe ist eine feinere Punkte-Genauigkeit, „nur ganze Noten“ oder „Punkte verteilen“ (Punkt 6). Faustregel mit ganzen Punkten: Alle Stufen sind verschieden ab 25 Punkten in der Sek I (LIMIT 50 %; bei 22 und 23 Punkten auch) bzw. ab 21 Punkten in der MSS (LIMIT 45 %).
6. **Punkte verteilen** (`NM.grades.spreadKey`, seit 2.2): Die Grenze zum Bestehen bleibt fest (Sek I: 4− bzw. bei ganzen Noten die 4, MSS: 04 Punkte; auch eine eigene Schwelle dort), die App verschiebt sie nie. Über der Grenze bekommt jede Stufe einen eigenen Wert im Raster der Genauigkeit: Schwellen, die schon passen, bleiben; sonst rückt eine Stufe einen Schritt unter die nächstbessere (bzw. über die nächstschwächere). Reichen die Werte zwischen Grenze und Höchstpunktzahl nicht für alle Stufen, beginnt die beste Stufe bei der Höchstpunktzahl, die zweitbeste (1− bzw. 14 Punkte; wenn nötig auch die folgenden) entfällt, alle anderen folgen je ein Schritt. Beispiel 18 Punkte, Sek I, 50 %, ganze Punkte: 1 ab 18, 2+ ab 17, 2 ab 16 … 4 ab 10, 4− ab 9; 1− entfällt. Unter der Grenze (5+, 5, 5− bzw. 01–03) genauso, dort entfallen bei Mangel zuerst die schwächsten Stufen. Wer andere Schwellen will (z. B. 1− ab 17 und 4− ab 8, also 44 %), trägt sie von Hand ein.

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
Summe   = Σ Punkte der Bewertungen (++ … --)  +  Σ Hausaufgaben-Abzüge (u, h)  +  Σ Material (m, Standard 0)
Max     = Anzahl anwesender Stunden (mit Bewertung ++ … --) × Punkte für ++
Prozent = Summe / Max × 100
```

Stunden mit `k` oder ohne Eintrag zählen nicht zu Max. Hausaufgaben-Vermerke werden immer abgezogen, ebenso `m`, falls dafür Punkte eingestellt sind (Standard 0: nur gezählt).

**Umrechnung in Punkte/Note (seit 2.8 über Vorlagen, 8.3)**

Die Symbole sind eine Notenskala, deren Mitte `0` „befriedigend“ ist. Die Vorlage **„0 = befriedigend“** rechnet deshalb linear: Punkte = 2 + 0,12 · Prozent, gerundet (immer `++` = 100 % → 14, `+` = 75 % → 11, `0` = 50 % → 08, `-` = 25 % → 05, `--` = 0 % → 02). Die Schwellen gelten „ab“ und werden ungerundet gespeichert, damit eine genau getroffene Grenze wie bei der Rundung nach oben zählt (angezeigt mit 2 Nachkommastellen). „Mild“ und „Streng“ sind um eine Tendenz (8,33 %) verschoben. Unter 0 % (nur durch Abzüge `u`/`h`/`m`) gibt es 01 bis über −10 % (Schwelle −9,99 %) und 00 bei −10 % und weniger. Die Sek I nutzt dieselben Stufen und endet bei 14.

| Punkte | 15 | 14 | 13 | 12 | 11 | 10 | 09 | 08 | 07 | 06 | 05 | 04 | 03 | 02 | 01 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mild, ab % | 95,83 | 87,5 | 79,17 | 70,83 | 62,5 | 54,17 | 45,83 | 37,5 | 29,17 | 20,83 | 12,5 | 4,17 | 0 | 0 | −9,99 |
| 0 = befriedigend, ab % | 97,5 | 95,83 | 87,5 | 79,17 | 70,83 | 62,5 | 54,17 | 45,83 | 37,5 | 29,17 | 20,83 | 12,5 | 4,17 | 0 | −9,99 |
| Streng, ab % | 100 | 97,5 | 95,83 | 87,5 | 79,17 | 70,83 | 62,5 | 54,17 | 45,83 | 37,5 | 29,17 | 20,83 | 12,5 | 0 | −9,99 |

Die 15 gibt es bei „0 = befriedigend“ ab 97,5 %: Ab 10 Stunden darf ein `+` dabei sein (12 Stunden: 47 von 48 Punkten = 97,9 %). Bei „Streng“ nur mit 100 %.

**Beispiel (12 Stunden, max. 48 Punkte, „0 = befriedigend“):** immer `0` (24 P, 50 %) → 08 bzw. 3; immer `--` mit zwei `h` (−4 P, −8,3 %) → 01 bzw. 5-.

**Vorlage „Wie Testschlüssel“** (bis 2.7 der Standard; Blöcke ohne Tabelle rechnen ebenso):

- **MSS** – „mehr als“-Schwellen in 5-%-Schritten (wie bisherige EPO-Liste):

| Punkte | 15 | 14 | 13 | 12 | 11 | 10 | 09 | 08 | 07 | 06 | 05 | 04 | 03 | 02 | 01 | 00 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mehr als % | 95 | 90 | 85 | 80 | 75 | 70 | 65 | 60 | 55 | 50 | 45 | 40 | 35 | 30 | 25 | – |

- **Sek I** – „ab“-Schwellen nach dem Sek-I-Testschlüssel (14.2) mit dem LIMIT des Blocks.

**Beispiel (MSS, „Wie Testschlüssel“):** 7 Stunden, Bewertungen `+ 0 + + 0 0 +` → Summe 4·3 + 3·2 = 18, Max 7·4 = 28, Prozent 64,3 % → **08 Punkte** (mit „0 = befriedigend“: 2 + 0,12 · 64,3 = 9,7 → **10 Punkte**).

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
| Automatische Sperre | nach 15 Min. ohne Maus/Tastatur (einstellbar); seit 2.16 außerdem sofort nach dem Ruhezustand (Notebook zugeklappt, Standby), auch bei „0 = nie“. Die App erkennt ihn an einer Lücke von mehr als 2 Minuten zwischen zwei Prüfungen (alle 20 s) und prüft gleich, wenn das Fenster wieder sichtbar wird. Ein Wechsel in einen anderen Tab sperrt nicht. |

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
| `--csv ORDNER` | zusätzlich eine CSV-Datei je Kurs (Excel-kompatibel) mit Einzelnoten, Einstufung je Person, Spalte „Person“ (ID im Personenregister), Test-Rohpunkten (bei Arbeiten in Teilen je Teil; bei Tests für OrdoScripto mit Test-ID im Spaltenkopf und Schüler-ID in eckigen Klammern), Präsentationspunkten, EPO-Kürzeln, gesetzten Noten und Bemerkungen; dazu `Personenregister.csv` mit jeder Person, ihren Kursen und „seit … in keinem Kurs“; seit 2.13 mit Kompetenzkatalogen `Kompetenzkataloge.csv` (eine Zeile je Kompetenz und Teilkompetenz mit Bereich, Kennung, Name, „ausgeblendet“) und `Kompetenzen.csv` (je Aufgabe mit Kompetenzen: Kurs, Katalog, Halbjahr, Test, Aufgabe, Höchstpunkte, Bonus, Kennungen; Stand und Verlauf rechnet nur die App) |
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
Der Test hat zu wenige Punkte für alle Notenstufen: Zwei Stufen fallen auf dieselbe Mindestpunktzahl, und die schwächere kann nie vergeben werden (z. B. 2 bei 18 Punkten mit ganzen Punkten). Abhilfe über die Knöpfe im Hinweis: **halbe Punkte** (bzw. Zehntel), **nur ganze Noten** oder **Punkte verteilen** (jede Stufe ein eigener Punktwert, die Grenze bleibt); bei Präsentationen weitere Kriterien aufnehmen oder höher gewichten. Details in 7.4 und 15.3.

### 21.12 Ein Reiter ist verschwunden
Er ist ausgeschaltet – für diesen Kurs (Kurs & Schüler → „Reiter in diesem Kurs“) oder als Standard (Einstellungen → Reiter). Dort wieder anhaken; alle Daten sind noch da (siehe 6.4). Der Reiter „Kompetenzen“ erscheint außerdem nur mit Kompetenzkatalog am Kurs (siehe 9a).

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
| `js/util.js` | `NM.util` | DOM-Helfer `h()`, Symbole `icon(name)` (aus dem gemeinsamen Design), Formatierung (deutsch), Dialoge, Toasts, Download, CSV |
| `js/xlsx.js` | `NM.xlsx` | Excel-Dateien ohne Bibliothek: `workbook({ sheet, rows, widths })` → Blob (ZIP ohne Kompression, ein Blatt, Kopfzeile fett) |
| `js/grades.js` | `NM.grades` | **Gesamte Notenlogik** (rein, ohne DOM): Skalen, Eingabe-Parser, Rundung, Notenschlüssel (mit Prüfung auf nicht erreichbare Stufen, `unreachableSteps`, und Vorschlag „Punkte verteilen“, `spreadKey`), Test-/EPO-Auswertung, Arbeiten in Teilen, Präsentationen (auch in Gruppen), Halbjahres-/Jahresnote |
| `js/crypto.js` | `NM.crypto` | `Vault`: Erzeugen, Entsperren (Passwort/Wiederherstellung), Ver-/Entschlüsseln, Passwortwechsel |
| `js/storage.js` | `NM.storage` | `FolderStore` (File System Access API): Lesen/Schreiben, Sicherungen, Lock, Konflikterkennung; `ServerStore` (gleiche Schnittstelle über das Startprogramm, `detectServer()`); `MemoryStore` für den Demo-Modus |
| `js/pomodoro.js` | `NM.pomodoro` | Pomodoro-Timer: Ablauf (`next`), Anzeige in der Kopfzeile, Töne per Web Audio, Einstellungsformular |
| `js/competencies.js` | `NM.competencies` | Kompetenzkataloge (rein, ohne DOM, seit 2.9): Vorlagen (`TEMPLATES`), bereinigen (`clean`, `cleanList`), lesen (`entries`, `forCourse`, `usedIds`), Fach → Katalog (`guessForFach`), bearbeiten (`addKompetenz`, `addTeil`, `renameId`, `removeEntry`, `setHidden`), Austauschdatei (`exportJson`, `parseImport`, `applyImport`), Punkte je Kompetenz (`pointsPer`), Kennung an einer Aufgabe (`toggleTask`); seit 2.11 Auswertung je Person (`evaluate`, `stufeOf`) und Kompetenztest (`isCompetencyTest`) |
| `js/people.js` | `NM.people` | Personenregister (rein, ohne DOM): Register vervollständigen (`ensure`), gleiche Namen, Vorschläge, Zusammenführen, Trennen, Löschen |
| `js/view-people.js` | `NM.views.people` | Seite „Personen“: Liste mit Suche und Filter, Person mit Kursen, Dialoge Zusammenführen (Vorschläge und manuell), Trennen, Löschen |
| `js/model.js` | `NM.model` | Datenmodell: neue Datenbank/Kurse/Leistungen, Migration, Namensliste parsen, Demo-Daten |
| `js/groups.js` | `NM.groups` | Gruppenbildung (rein, ohne DOM): Gruppengrößen, Verteilung nach Regeln/Leistung/Abwechslung (Kostenfunktion + Tauschsuche), Regelprüfung, Expertengruppen |
| `js/random.js` | `NM.random` | Zufallswerkzeuge (rein, ohne DOM): `randInt`, `shuffle`, `pickPeople` (ohne Wiederholung), Kartenstapel `deck`, Würfelkörper `solid` (W4–W20, Beschriftung), Drehungen für den Wurf (`rollPlan`, `restQuat`, `frontLabel`); Zufall über `crypto.getRandomValues` |
| `js/timer.js` | `NM.timer` | Countdown (rein, ohne DOM): Restzeit aus Startzeit und verstrichener Zeit (`create`, `start`, `pause`, `reset`, `add`, `remaining`, `overtime`, `stage` für die Farbe, `format`, `parse` für Eingaben wie `4:30`) |
| `js/draw.js` | `NM.draw` | Ziehen (rein, ohne DOM): `drawFrom` (klassisch mit Auffüllen, Pool ohne), `newPool`, `drawPool`, `undoPool`, `removeDraw`/`removedGrades` (frühere Ziehung löschen, seit 2.17), `finished`, `poolRange`, `drawnSets` (für die Notenübersicht), `check` (Ziehfehler), `classicColumns`, `mergeConflicts`, `merge`, `removePool` |
| `js/attendance.js` | `NM.attendance` | Fehlzeiten (rein, ohne DOM, seit 1.45): Tage mit Stundenzahl, A/E/U je Person, Summen je Halbjahr, Abgleich mit EPO-k (`syncFromEpo`, `syncToEpo`, `fromEpo`), Bereinigen beim Laden (`clean`) |
| `js/qr.js` | `NM.qr` | QR-Code-Erzeuger (rein, ohne Bibliothek): Byte-Modus, Fehlerkorrektur Q, Versionen 1–10, Reed-Solomon über GF(256), alle 8 Masken mit Strafpunkten; `encode(text, { mask, minVersion })` → Modulmatrix, `svg(qr, { quiet: 4, width })` |
| `js/scripto.js` | `NM.scripto` | Schnittstelle zu OrdoScripto (rein, ohne DOM): Test- und Schüler-IDs vergeben (`prepare`), IDs lesen (`dataOf`, auch für Nachschreibtermine), Personen für die Trennblätter (`sheetStudents`, `makeupStudents`), QR-Inhalt (`qrText`), Import-CSV (`importCsv`) |
| `js/sortis.js` | `NM.sortis` | Export „Für OrdoSortis“ (rein, ohne DOM): `exportCsv(db, course, heute?)` → `{ name, text }`, Personen eines Kurses als CSV (Format laut OrdoSortis `docs/KONZEPT.md` 7.1) |
| `js/moodle.js` | `NM.moodle` | Moodle-Import (rein, ohne DOM): CSV zerlegen, Antworten-/Bewertungen-CSV erkennen und zusammenführen, Personen zuordnen, in einen Test oder Teil übernehmen (`applyImport` mit `replace`: bisherige Aufgaben ersetzen, `adopt`: Bezeichnung/Datum übernehmen, `competencies`: Kompetenzen je Frage); Begleitdatei (`parseCompanion`, `matchCompanion` als Präfix-Abgleich, `companionCompetencies`, `setCompetencies`) |
| `js/ui.js` | `NM.ui` | Wiederverwendbare Bausteine: Halbjahres-Umschalter, Noten-Eingabezellen, Badges, Leistungs-Dialog, Sortieren (`sorter`, `nameCells`), Druckauswahl (`printButton`), Reiter-Haken (`tabChecks`), leere Ansichten (`emptyState(title, text, button, iconName)`), Hochladen-Fläche (`dropzone(input, title, hint)`) |
| `js/app.js` | `NM.app` | Anwendungskern: Anmeldung, Sitzung, Autosave, Sperre, Layout, Navigation (`TABS`; ausschaltbare Reiter `OPTIONAL_TABS`, `tabOn`, `shownTab`), Neuzeichnen mit Fokus-Erhalt, Tabellen-Tastatur |
| `js/view-*.js` | `NM.views.*` | Je ein Reiter: `course`, `tests`, `epo`, `pres` (Präsentationen), `draw`, `random` (Tools), `groups` (Gruppen), `overview`, `competencies` (Kompetenzen, seit 2.11), `seating`, `settings` |
| `js/print.js` | `NM.print` | Druckansichten |
| `css/app.css` | – | Gestaltung von OrdoNota inkl. der sechs Designs (Farb-Tokens, `[data-theme][data-variant]`) und Druck-CSS; liegt über dem gemeinsamen Design (22.2) |
| `css/blades.min.css`, `css/solagio-design.css`, `js/solagio-design.js` | – | gemeinsames Design der Ordo-Apps (22.2); verteilt, nie von Hand ändern |
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

**Pro Gerät im Browser gespeichert** (`localStorage`/IndexedDB, nicht in der Datenbank): Ordner-Handle, Geräte-ID und -name, gewählter Kurs/Reiter/Halbjahr, Farbschema (`ui.theme`, `ui.lightTheme`, `ui.darkTheme`; der Modus-Schalter schreibt `ui.theme`), „Große Schrift“ (vom Design selbst gemerkt), ein-/ausgeklappte Kursliste, ausgeblendete Teile in der Ergebnistabelle, Umschalter Fotos/Nachnamen im Reiter „Gruppen“ und in dessen Beameransicht, Umschalter Fotos im Sitzplan-Beamer (`ui.seatBeamer`), Stand des Pomodoro-Timers.

### 22.1 Startprogramm (`launcher/`)

Das Startprogramm ist das einzige Teil mit Build-Schritt; die App selbst bleibt ohne. Es liefert die App aus und erledigt den Dateizugriff, sodass der Browser nicht nach dem Ordner fragen muss.

| Datei | Aufgabe |
|---|---|
| `main.go` | Ablauf: Einstellungen laden, App-Dateien finden (`--app-dir`, sonst `index.html` neben dem Programm oder bis zu 4 Ordner darüber, sonst eingebaut), Server starten, Fenster öffnen, beenden, wenn das Fenster zu ist (Browserprozess beendet und 15 s ohne Lebenszeichen; beim Standardbrowser 5 min ohne Lebenszeichen); legt unter Linux das Programmsymbol `logo/ordonota-icon.svg` (nur das Zeichen) als `ordonota-icon.svg` in den Einstellungsordner (`writeIcon`) |
| `server.go` | HTTP: `/start?t=…` setzt das Zugriffs-Cookie, statische Dateien nur aus `index.html`, `css/`, `js/`, `logo/`, `demo/`, `cards/`, `schrift/` (nie `ref/` o. Ä.), Schnittstelle `/api/…` |
| `store.go` | Datenordner: nur `notenmanager.nmdb`, `notenmanager.lock.json`, `Sicherungen/notenmanager_*.nmdb`; Schreiben über Hilfsdatei und Umbenennen; Konfliktprüfung über die Änderungszeit |
| `desktop_linux.go` | Startmenü-Eintrag `OrdoNota.desktop` (Name = Fensterklasse, sonst ordnet KWin das Fenster nicht zu), versteckte Einträge `<Präfix>-127.0.0.1__start-Default.desktop` für die Wayland-app_id (`waylandAppIDs`; hängt am Pfad `/start` der Start-Adresse), alten `ordonota.desktop` entfernen, Menü-Cache erneuern |
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

### 22.2 Gemeinsames Design (solagio-design)

Seit 2.0 teilt OrdoNota das Aussehen mit den anderen Ordo-Apps. Es sind weiterhin reine Dateien ohne Build-Schritt und ohne Netz.

| Datei | Inhalt |
|---|---|
| `css/blades.min.css` | Grundlage (Blades, MIT) |
| `css/solagio-design.css` | Tokens, Bausteine und Größen des gemeinsamen Designs |
| `js/solagio-design.js` | Symbole (Tabler Icons, MIT), Modus-Schalter, „Große Schrift“, Hochladen-Fläche |
| `schrift/JosefinSans-ordo.woff2` | Schrift für Überschriften: „Ordo Josefin“, eine gekürzte Fassung von Josefin Sans (OFL 1.1; der Name „Josefin Sans“ ist dem Original vorbehalten) |
| `lizenzen/` | Lizenztexte der drei Bestandteile |

**Quelle und Verteilen:** Die Quelle ist das Projekt `../../Design` (Design-Repo). Verteilt wird mit `python3 werkzeuge/verteile.py ../OrdoScola/OrdoNota --app ordonota --ebene solagio`; Kontrolle mit `--pruefen --ebene solagio`. Die verteilten Dateien werden **nie von Hand geändert**, Änderungen gehören ins Design-Repo.

**CSS-Ebenen:** `blades` → `solagio` → `ordonota-grund` → Regeln ohne Ebene (alles Übrige in `css/app.css`). Die spätere Ebene gewinnt, Regeln ohne Ebene gewinnen immer. Der Kommentar am Anfang von `css/app.css` beschreibt das ebenfalls.

**Tokens** (Namen der Farben und Maße, in `css/app.css` und im Design): `--bg`, `--bg-raised`, `--bg-card`, `--border`, `--border-soft`, `--border-strong`, `--text`, `--text-dim`, `--text-faint`, `--accent` (mit `-strong`, `-dim`, `-soft`), `--ok`, `--bad`, `--gold` (je mit `-soft`), `--shadow`, `--shadow-soft`, `--sans`, `--mono`, `--display`, `--radius-s`, `--radius`, `--radius-l`, `--control` (Höhe von Knöpfen und Feldern). Die alten Namen (`--surface`, `--muted`, `--danger`, `--warn`, `--font`) gibt es nicht mehr. Die Farben des Standard-Designs stehen in `css/app.css` noch einmal (Selektoren `[data-theme]` statt nur `:root`), damit die Vorschaukacheln in den Einstellungen ihr eigenes Design zeigen. Ändert sich das Design, müssen diese Werte nachgezogen werden. Maße stehen in `rem`, damit „Große Schrift“ (125 %) alles mitnimmt.

**Bausteine im Code:**
- `NM.util.icon(name)` liefert ein Symbol als `<span class="sd-icon">` (rein schmückend; der Knopf braucht daneben Text oder `aria-label`). Die Namen stehen in `js/solagio-design.js`.
- `NM.ui.emptyState(title, text, button, iconName)` zeigt eine leere Ansicht mit Hinweis und Knopf.
- `NM.ui.dropzone(input, title, hint)` legt eine Hochladen-Fläche um ein vorhandenes Dateifeld (Datei ablegen oder auswählen; das Feld bleibt unverändert, Moodle-Import).
- `applyTheme()` und `setThemeMode(mode)` in `js/app.js`: `setThemeMode` speichert `light`, `dark` oder `auto` in `ui.theme`, `applyTheme` setzt `data-theme` und `data-variant` (siehe „Farben und Designs“ in 26.4) und hält den Modus-Schalter der Kopfzeile aktuell.

**Weitere Stellen:** Das Timer-Pop-up (`openTimerPopup` in `js/view-random.js`) lädt die drei Dateien `css/blades.min.css`, `css/solagio-design.css` und `css/app.css` selbst. Im Startprogramm erlaubt `staticAllowed` (`launcher/server.go`) auch `schrift/`; `launcher/build.sh` baut `schrift/` in das Programm ein und legt `lizenzen/` in das Release-ZIP.

**Browser-Mindeststand:** Chrome/Edge 120, Firefox 117, Safari/iOS 17.2 (CSS-Ebenen `@layer`, verschachteltes CSS, `light-dark()`).

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
  "app": "2.20.0",
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

Entschlüsselter Inhalt (`schema: 5`):

```js
{
  schema: 5,                             // Datenformat (siehe 26.2)
  savedWith: "2.20.0",                    // App-Version beim letzten Speichern
  created: "<ISO>", savedAt: "<ISO>",
  settings: { autoLockMin, limitSek1, limitMss, precision, testCat: "ka" | "other" /* seit 1.30 */, keepBackups, backupEveryMin, gradeColors,
              tabs: { "<Reiter>": false },   // seit 1.25: ausgeschaltete Reiter (Standard für alle Kurse)
              tabOrder: [ "<Reiter>" ],       // seit 1.34: Reihenfolge der Reiter (leer = Standard; fehlende Reiter hinter ihren Vorgänger)
              pomodoro: { enabled, count, work, short, long, tick: "off" | "work" | "always", alarm: "off" | "bell" | "gong" | "beep", volume },
              scriptoSeq,                     // seit 1.41: zuletzt vergebene laufende Nummer der OrdoScripto-Test-IDs
              print: { schoolName, teacher, logo },  // seit 1.47: Druckkopf; logo = Data-URL (PNG/JPEG/GIF/WebP/SVG) oder ""; migrate() bereinigt, check() prüft
              epoPresets: [ { id, name, level: "sek1" | "mss", strict, mins: [ 16 Zahlen, % je Punktstufe 0–15 ], points: { "++", …, "m" } } ],  // seit 2.8: eigene EPO-Vorlagen
              epoDefault: { sek1, mss },     // seit 2.8: Vorlage für neue EPO-Blöcke je Stufe ("bef" | "mild" | "streng" | "test" | id einer eigenen)
              competencyCatalogs: [ Katalog ] },   // seit 2.9: Kompetenzkataloge (js/competencies.js); migrate() bereinigt (cleanList), check() meldet fehlende Kataloge/Kennungen als Hinweis
  // Katalog = { id, name, fach, version, stufen: { teilweise: 50, sicher: 80 },
  //             bereiche: [ { id, name, kompetenzen: [ { id, name, ausgeblendet?, teil?: [ { id, name, ausgeblendet? } ] } ] } ] }
  // Gleicher Aufbau wie die Austauschdatei (dort zusätzlich format: "ordonota-kompetenzkatalog", formatVersion: 1).
  // Kennungen ([A-Za-z0-9][A-Za-z0-9._-]{0,31}) sind im Katalog eindeutig und werden nie neu vergeben; benutzte nur ausblenden.
  criteriaPool: [ { id, group, name, desc: { 0, 1, 2, 3 } } ],   // Kriterien für Präsentationen (alle Kurse, seit 1.20)
  presTemplates: [ { id, name, criteria: [ { poolId, group, name, desc, weight } ] } ],   // Vorlagen (seit 1.21; Standardvorlagen seit 1.22)
  years:   [ { id, name: "2026/27" } ],
  courses: [ Course ],
  people:  [ { id, last, first, created: "YYYY-MM-DD", orphanSince?: "YYYY-MM-DD",       // seit Schema 5: Personenregister (js/people.js); orphanSince = seit wann in keinem Kurs
               ausgleiche: [ { id, art: "lrs" | "dyskalkulie" | "sonst", text?, faecher: [ "<Fach>" ], massnahmen, bis?: "YYYY-MM-DD" } ],
               notizen: [ { id, datum: "YYYY-MM-DD", text, courseId? } ],   // notizen seit 2.6.0 (intern, nie gedruckt); courseId fehlt = ohne Kurs
               foerderplaene: [ { id, datum: "YYYY-MM-DD", schwerpunkte: [ "lernen" | "sprache" | "emsoz" | "ganzheitlich" | "motorik" | "hoeren" | "sehen" | "sonst" ],
                                  sonst?, von?: "YYYY-MM-DD", bis?: "YYYY-MM-DD", ziele, massnahmen } ] } ]
               // foerderplaene seit 2.7.0 (Gesundheitsdaten): je Fortschreibung eine Fassung, die mit dem neuesten Datum gilt; sonst = Bezeichnung bei „sonst“
               // ausgleiche seit 2.5.0 (Nachteilsausgleich, Gesundheitsdaten): text = Kürzel bei „sonst“ (≤ 6 Zeichen); faecher leer = alle Fächer; bis = letzter gültiger Tag
}

Course = {
  id, yearId, klasse, fach, note,
  jahrgang: 5..13,                       // ≥ 11 → MSS (Punkte)
  type: "sek1" | "lk" | "gk" | "noka",
  wKa, wOther,                           // Gewichte in %
  wHalf1, wHalf2,                        // Jahresnote (Standard 1 : 2)
  einstufung: "U" | "G" | "E" | "E1" | "E2" | "GK" | "LK",   // seit 1.42 (1.41: G/E), GK/LK seit 1.43.1: U = undifferenziert (Standard); gilt für alle ohne eigene Einstufung
  tabs?: { "<Reiter>": true | false },   // seit 1.25: Abweichung vom Standard settings.tabs (fehlt = wie Standard)
  catalogId?: "<Katalog-id>",           // seit 2.9: Kompetenzkatalog des Kurses (fehlt = keiner)
  attendance: { "<YYYY-MM-DD>": { half, hours, abs: { "<studentId>": "a" | "e" | "u" } } },   // seit 1.45: Fehlzeiten; a = Entschuldigung offen, e = entschuldigt, u = unentschuldigt; hours = Unterrichtsstunden; Summen nie gespeichert
  students: [ { id, personId, last, first, active, iStatus?, photo?, email?, einstufung? } ],   // personId (seit Schema 5): Person in db.people; je Kurs höchstens ein Eintrag je Person
    // einstufung (seit 1.42): nur bei Abweichung vom Kurs   // photo: JPEG als Data-URL, 160×160; email: Moodle-Adresse (Zuordnung beim Import)
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
  termTool?: { terms: ["…"], mode: "count" | "size", n, last: [["…"], …] | null }   // seit 2.20: „Begriffe in Gruppen“ (fehlt = noch nicht benutzt)
  tools: { off: ["dice"], order: [] }     // seit 1.39: Werkzeuge im Reiter „Tools“ (off = ausgeschaltet; order leer = Standard timer, number, people, dice, cards)
}

Assessment = {
  id, kind: "manual" | "test" | "epo" | "pres",
  half: "HJ1" | "HJ2" | "11/1" | … | "13",
  cat: "ka" | "other",
  name, date: "YYYY-MM-DD", weight, ungraded?,   // ungraded: zählt nicht zur Note
  off?: { "<schuelerId>": true },   // seit 2.18, nur manual und epo: einzeln abgeschaltete Note (fehlt = keine)
  makeupOf?: "<id>",   // nur Tests (seit 1.40): Nachschreibtermin zu dieser Arbeit; half/cat/weight/ungraded werden angeglichen
  manual?: { grades: { "<sid>": { p } | { status } } },
  test?:   { limit, precision, wholeGrades?,                            // wholeGrades: nur ganze Noten (Sek I)
             tasks: [ { id, name, max, bonus?, moodleNr?, partId?, competencies? } ],   // moodleNr: Fragennummer in Moodle; partId: Teil; competencies (seit 2.9): [ Kennungen aus dem Kurskatalog ], fehlt = keine
             custom: { "<p>": Mindestpunktzahl },
             parts?: [ { id, name, weight, limit?, precision?, custom?, wholeGrades?, moodle? } ],   // Arbeit in Teilen (seit 1.18)
             partMode?: "sum" | "separate",                       // gemeinsam bepunktet / getrennt benotet
             results: { "<sid>": { scores: { "<taskId>": Zahl }, status?, signed?, partStatus?, verbal?, showGrade?, ausgleich? } },   // signed: Datum „Unterschrift gesehen“; partStatus: { "<partId>": "fehlt" | "nachschreiben" }; verbal: Verbalbeurteilung (Text, seit 2.3.0, nur bei I-Status wirksam); showGrade: true = Note trotz Verbalbeurteilung auf dem Zettel; ausgleich: true = Nachteilsausgleich gewährt (seit 2.5.0, nur Vermerk)
             moodle?: { importedAt, totalMax,                                     // nur bei Moodle-Import
                        files: [ { name, kind: "answers" | "grades" | "komp", text } ],    // Original-Dateien; komp (seit 2.10): Begleitdatei mit Kompetenzen (JSON)
                        answers: { "<sid>": { "<taskId>": { q, a, c } } } },   // Frage, gegebene, richtige Antwort
             scripto?: { testId: "T-2026-0007", ids: { "<sid>": "S-7F3K9Q" }, created: "<ISO>" } },   // seit 1.41: Pseudonyme für OrdoScripto (nie bei Nachschreibterminen, die lesen die der Arbeit)
  epo?:    { limit, points: { "++","+","0","-","--","u","h","m" },   // m fehlt bei älteren Blöcken → 0
             table: { strict: bool, mins: [ % je Punktstufe ] },   // seit 2.8 auch negativ (−100 bis 100); die geltende Vorlage wird verglichen, nicht gespeichert
             keepTable?: true,                // seit 2.8: „Wie Testschlüssel“ bewusst behalten (kein Hinweis)
             lessons: [ { id, date } ],
             entries: { "<sid>": { "<lessonId>": { r: "++"|"+"|"0"|"-"|"--"|"k"|"", hw: "u"|"h"|"", m?: 1 } } } },   // m: Material vergessen (seit 1.44)
  pres?:   { limit, custom: { "<p>": Mindestpunktzahl }, wholeGrades?,
             criteria: [ { id, poolId, group, name, desc: { 0, 1, 2, 3 }, weight, scope?: "person" } ],   // Kopie aus dem Pool
             groupMode?: "mixed" | "group",   // seit 1.23: Gruppenpräsentation (fehlt = einzeln)
             groups?: [ { id, name, members: [sid], topic?, date?, note?, scores: { "<criterionId>": 0..3 } } ],
             results: { "<sid>": { scores: { "<criterionId>": 0..3 }, topic?, date?, note?, status? } } }
             // bei Gruppen: results[sid].scores eines Gruppenkriteriums = Abweichung vom Gruppenwert
}
```

`p` ist immer eine Punktzahl 0–15. `status` ∈ `fehlt`, `nachschreiben`, `taeuschung`; bei Test- und Präsentationsergebnissen zusätzlich `ungewertet` (Note wird berechnet, zählt aber nicht; Abfrage über `NM.grades.ungradedFor(a, sid)`, das seit 2.18 auch `a.off` berücksichtigt).

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

1. alle Testseiten (siehe 25.2), danach die Datenbanken früherer Versionen (`tests/altdaten/`) in der App: alle Reiter beider Kurse und die Jahresnote ohne Fehler, „Datenbank prüfen“ ohne Probleme, je Kurseintrag eine eigene Person im Register,
2. den Start der App im Demo-Modus und alle Reiter für einen Sek-I- und einen MSS-Kurs ohne JavaScript-Fehler, den Knopf „Demo ansehen“ (öffnet `?demo` im neuen Fenster, eigene Ansicht in `nm.ui` bleibt unberührt), die Sperre nach dem Ruhezustand (Zeitsprung sperrt auch bei „0 = nie“, gedrosselter Hintergrund-Tab und Fokuswechsel nicht),
3. das Sortieren per Klick auf Spaltenköpfe (Tests, EPO, Notenübersicht; Richtung und leere Werte unten), den einheitlichen Druckkopf (Schulname und Lehrkraft in den Einstellungen, Logo-Upload mit Verkleinerung auf 600 px, Nicht-Bilder abgelehnt; Kopf mit Logo, Schule, Lehrkraft und Kurs in Notenliste, Jahresnoten, Ergebnisliste, Notenschlüssel, Bewertungsliste und leeren Bögen der Präsentationen, Handreichung, EPO-Liste, Sitzplan und Fehlzeiten; Zettel kompakt; Testdatum; leere Angaben fallen weg; Migration und Prüfung), im EPO-Reiter die Kachelansicht (Touch-Emulation: Anordnung nach Sitzplan mit Pult und „Ohne Platz“, Tippen bewertet und schließt, Zusätze m und k mit Fehlzeit, Esc, alphabetisch ohne Plätze, Kacheln und Knöpfe mindestens 44 px) und den Zusatz m (Material vergessen: Eingabe, ungültige Eingabe, Schnellwahl, Spalte M, eigene Punkte, Legende in Bewertungsliste und Mitarbeitszetteln), die Auswahl der angezeigten EPO-Stunden („letzte 5“ zeigt die neuesten, Hinweis mit Anzahl, Note unverändert, je Kurs gemerkt, „Alle zeigen“), die EPO-Vorlagen (neuer Block mit „0 = befriedigend“, Hinweis bei alter Tabelle mit „So lassen“ und „Neue Vorlage anwenden“, LIMIT nur bei „Wie Testschlüssel“, Vorlage wählen und anwenden, negative Grenze und „Angepasst“, als Vorlage speichern, Standard für neue Blöcke, umbenennen, löschen),
4. den Pomodoro-Timer (Aktivieren, Farben je Zustand, Phasenwechsel, Zurücksetzen, Einstellungsdialog), das Layout des Reiters „Einstellungen“ bei aktivem Timer (keine Lücken zwischen den Karten, Auswahllisten nicht abgeschnitten, bei 1570 und 2560 px), die sechs Designs (Kontrast von Schrift, Akzent-, Status- und Notenfarben nach WCAG, Vorschaukacheln, Wahl bleibt nach dem Neuladen, der Schalter in der Kopfzeile wechselt nur den Modus, „Wie das System“ folgt dem System, Timer-Pop-up übernimmt das Design) und die Kürzel in der eingeklappten Kursliste, die weichen Übergänge (nur bei Reiter-, Kurs- und Halbjahreswechsel), das Ein-/Ausklappen der Kursliste, das Ein-/Ausschalten von Reitern (Standard in den Einstellungen, Abweichung je Kurs, Ersatzreiter, Sprunglinks, „Wie Standard“), das Umsortieren der Reiter (Pfeile nach oben und unten, Ziehen in der Reiterleiste, Standardreihenfolge), das Einklappen der Spaltengruppen und Bündeln der Ziehungsspalten in der Notenübersicht (Noten unverändert, Zeitraum, Ausdruck vollständig), das Abschalten von Noten in der Notenübersicht (Modus mit Hinweis, einzelne Note in eigener Spalte und im Test, ganze Spalte, durchgestrichen, Note bleibt gespeichert), den Reiter „Tests“ in voller Breite, die Warnung bei zu wenig Punkten im Notenschlüssel (doppelte Schwellen markiert, Knöpfe „Halbe Punkte“/„Nur ganze Noten“ beheben sie, „Punkte verteilen“ zeigt den Vorschlag im Fenster, Abbrechen ändert nichts, Übernehmen schreibt eigene Schwellen), Arbeiten in Teilen (einschalten, Aufgaben und Punkte je Teil, Teil ausblenden, getrennt benoten, Status je Teil, Schlüssel je Teil, Ausdrucke inkl. „Ergebnisse nach Teilen“, Beamer, Teile aufheben), die Druckauswahl „Drucken …“ in Tests, EPO und Notenübersicht (Gruppen, Tooltips, Auswahl druckt, Abbrechen nicht) und den Haken „Unterschrift gesehen“ bei Klassenarbeiten (Zähler, Ausdruck), Nachschreibtermine („+ Nachschreibtermin“, nur Fehlende und „Alle zeigen“, eine gemeinsame Spalte in der Notenübersicht mit „N“, Rechnung als eine Leistung, Gewicht folgt der Arbeit, Verknüpfung lösen/setzen, Arbeit löschen), die Verbalbeurteilung bei I-Status (Karte nur mit I-Status, „fehlt noch“ unter 4−/4 Punkten, Speichern, Sprung aus der Tabelle, Ergebniszettel und Moodle-Bogen mit Text statt Note, Haken „Note auf dem Zettel zeigen“, ohne I-Status wieder die Note, nicht auf dem Beamer, Spalte in der CSV des Notfallwerkzeugs), den Nachteilsausgleich (Dialog mit Prüfung von Kürzel und Fächern, Kürzel in Punkteeingabe, Übersicht und Kursliste, nicht in „Ziehen“ und Ausdrucken, Spalte „Ausgleich“ nur in passenden Zeilen ohne Einfluss auf die Note, abgelaufen oder anderes Fach ohne Markierung, Löschen mit Rückfrage, Spalte im `Personenregister.csv` des Notfallwerkzeugs), den Notizverlauf (Eingabefeld mit vorgewähltem Kurs, Verlauf und Filter, Ändern an Ort und Stelle, Löschen mit Rückfrage, Notiz-Knopf und Taste N im Sitzplan, nicht im Sitzplan-Beamer, Symbol in der Notenübersicht nur mit Notizen und ohne Text im Hinweis, Dialog mit Verlauf und Sprung zur Person, nicht im Ausdruck, `Notizen.csv` des Notfallwerkzeugs), den Förderplan (Anlegen mit Prüfung, Fortschreiben vorausgefüllt als neue Fassung, frühere Fassungen eingeklappt, Vergleich in zwei Spalten, Ändern und Löschen, Hinweis in der Kursliste nur ohne I-Status mit Sprung zur Person, nicht im Ausdruck und in keinem Kursreiter, `Foerderplaene.csv` des Notfallwerkzeugs), den Moodle-Import (Knopf im Test statt neben „+ Neuer Test“, bisherige Aufgaben ersetzen oder behalten, Dateiauswahl im Dialog, Zuordnung, Status „fehlt“, Ausdruck mit und ohne Note, erneuter Import; mit Begleitdatei: Abgleich über den Fragetext, unbekannte Kennung aufnehmen, Hinweis „Bewertung notwendig“, nachträglich „Kompetenzen zuordnen“ mit „ersetzt: …“, Katalog für einen Kurs ohne Katalog übernehmen), den Reiter „Kompetenzen“ (Raster Person × Kompetenz, Zeitraum, Sortieren, ohne Katalog kein Reiter, Umschalter „Benotet | Kompetenztests | Alle“ im Reiter „Tests“, Kompetenztests in Notenübersicht und Ausdruck nur auf Wunsch; seit 2.12 Zeile „Kurs“ mit Anzahlen wie gerechnet und unten beim Sortieren, Verlauf im Dialog mit ‹ ›, Pfeiltasten und gemeinsamer Achse, „fehlt“ ohne Punkt, Abschnitt „Kompetenzen“ im Personenregister mit Stand je Schuljahr, ohne Katalog kein Abschnitt; seit 2.13 Kompetenzbogen aus der Druckauswahl für eine und alle Personen ohne Prozent und Punkte, Block „Kompetenzen in diesem Test“ in der Moodle-Rückmeldung nur mit Haken, Förderplan-Hinweis „noch nicht“ mit „In Ziele übernehmen“ ohne Speichern), die Schnittstelle zu OrdoScripto (QR-Codes aller Versionen 1–10 und Masken mit `zxing-cpp` zurückgelesen; Vorbereiten mit Einstufungs-Abfrage, Import-CSV ohne Namen, Trennblätter als echtes PDF gedruckt, mit 300 dpi gerastert und jeder Code exakt gelesen; Nachschreibtermin mit denselben IDs, neue Personen; Einstufung des Kurses und je Person mit Rückfrage, Spalte `kurs` mit der Einstufung je Person, Oberstufe mit GK/LK), die Fehlzeiten („Heute abwesend“ in Ziehen und Gruppen gespeichert, EPO-k ⇄ Fehlzeit, Karte reihum A/E/U und „+ Tag“ mit Stundenzahl, Spalte „Fehlst.“ in der Notenübersicht, Druckauswahl und Ausdruck; im Notfallwerkzeug die Fehlstunden je Halbjahr),
5. den Excel-Export der Schülerliste (gültiges ZIP/XML, Umlaute und Sonderzeichen), das Kurs-Löschen nur mit „LÖSCHEN“, das Personenregister (Kurs kopieren behält die Personen, Entfernen und Kurs löschen mit Haken nur für Personen ohne weiteren Kurs, „seit heute in keinem Kurs“, Sicherung nach der Umstellung auf Schema 5), die Seite „Personen“ (eigene Seite ohne Kursreiter, Suche, Filter „Ohne Kurs“ und nach Kurs, Pfeiltasten, Einfügen mit „Diese Namen gibt es schon“ bei einem und mehreren Treffern, „Alle als neue Personen“, Namen ändern mit Rückfrage, Abgleich nach „+ Einzeln hinzufügen“, Zusammenführen aus Vorschlägen und manuell, Trennen, Löschen, schmale Ansicht mit „Alle Personen“), das Ein-/Ausblenden der Fotos im EPO-Reiter und im Sitzplan (auch im Druck) das Erweitern/Verkleinern des Sitzplan-Rasters an allen vier Seiten, den Sitzplan-Beamer (Anordnung wie im Editor mit Pult oben/unten, Fotos zunächst aus, Leiste „Noch ohne Platz“, keine Bearbeitung, Größe passend zum Bildschirm, Esc) sowie das Ziehen (keine Wiederholung bis zum Auffüllen, automatisches Auffüllen, Note, Rückgängig, frühere Ziehung löschen mit Rückfrage, Abwesende/Herausgenommene) und die benannten Pools (Sammelspalte, eine Runde bis fertig, Rückgängig, Prüfung, Notenübersicht, Zusammenfassen, Löschen ohne Notenverlust), den Reiter „Tools“ (Timer: Start/Pause, läuft beim Reiterwechsel weiter, Ende mit Signal, ± 1 Min., Schnellwahl, vier Designs, Pop-up steuert denselben Timer; Einstellungen aller Werkzeuge werden gemerkt; Zahl im Bereich, Personen ohne Wiederholung und ohne Abwesende, 3D-Würfel mit Summe und gewürfelter Seite oben, Karten 52/32/eigene als Bild, Stapel immer sichtbar, mehrere auf einmal, nichts in der Notenliste; Begriffe in Gruppen: Liste im Kurs gespeichert, Anzahl bzw. je Gruppe, Mischen ohne Neuzeichnen, Kopieren, Namen einsetzen) und den Reiter „Präsentationen“ (Bewerten per Knopf und in der Tabelle, Gewicht, Kriterien aus dem Pool und eigene, Vorlage, Ausdrucke, Spalte in der Notenübersicht, Pool bearbeiten, Startbestand ergänzen, Vorlagen speichern/anlegen/verwenden/drucken/löschen, Standardvorlagen vorhanden und ergänzen, Handreichung mit Notenschlüssel) und Gruppenpräsentationen (Gruppenwert für alle Mitglieder, Personenkriterien, Abweichung setzen/zurücksetzen, Tabelle, Gruppen bearbeiten/übernehmen, Druck, Auflösen ohne Notenänderung), den Reiter „Gruppen“ (neue Einteilung, Abwesende, Fixieren, Anklicken/Ziehen, Auftrag, Regel mit Warnung, Beamer ohne Noten mit Schrift passend zum Bildschirm und Umschaltern für Fotos/Nachnamen, Druck, Fotos/Nachnamen in der Einteilung, Gruppenpuzzle mit Expertengruppen unter den Stammgruppen, Anzahl der Teilthemen einstellbar und beim Neu verteilen erhalten, Hinweis nach Änderungen, Beamer-Umschalter Stamm-/Expertengruppen, Übernahme in eine Präsentation), den Export „Für OrdoSortis“ (Knopf nur bei Kursauswahl, CSV-Inhalt, Hinweis „nicht verschlüsselt“),
6. das Notfallwerkzeug: Eine von der App echt verschlüsselte Datenbank wird mit `tools/entschluesseln.py` per Passwort und per Wiederherstellungsschlüssel entschlüsselt und mit dem Original verglichen. Dazu kommen falsches Passwort, manipulierte Datei und CSV-Ausgabe mit Personenregister, Kompetenzkatalogen und Kompetenzen je Aufgabe (auch für die Datenbanken aller früheren Versionen aus `tests/altdaten/`),
7. das Startprogramm (nur wenn Go installiert ist, sonst übersprungen): `go test` in `launcher/` (Programmsymbol ohne Schriftzug, Zugriffsschutz, nur erlaubte Dateien, Speichern und Konflikt, Sicherungen, Konfliktkopien, Lock, Datenordner wählen, Kennwort, Programmordner finden), dann ein echter Start mit Testordner: Zugriff ohne Kennwort abgelehnt, zweiter Start erkennt das laufende Programm, die App erkennt das Startprogramm, legt eine Datenbank an (ohne Rückfrage), speichert Änderungen in den Ordner (mit dem Notfallwerkzeug geprüft), erkennt eine externe Änderung, überschreibt auf Wunsch, stellt aus einer Datei mit fremdem Passwort wieder her (eigenes Passwort bleibt), wechselt den Datenordner mit Sicherungen (alter Ordner bleibt, neuer gemerkt, danach wird dort gespeichert), übernimmt in einem leeren Ordner eine Datenbank aus einer Datei und gibt den Lock beim Beenden frei.

Am Ende steht `ERGEBNIS: x von y bestanden`. Der Exit-Code ist 0, wenn alles bestanden ist. Davor nennt das Skript die Laufzeit und Blöcke, die länger als 60 s gebraucht haben.

Bricht ein Block mit einem Fehler ab, zählt er als fehlgeschlagen (`FEHL  run_… abgebrochen`), und die übrigen Blöcke laufen in einem frischen Browser weiter. Jeder einzelne DevTools-Aufruf hat eine feste Zeitgrenze (`CALL_TIMEOUT`, 240 s), damit der Lauf nicht unbemerkt stehen bleibt. Nach dem Neuladen der App warten die Blöcke auf `APP_READY` (App geladen, Ansicht gezeichnet) und nicht auf einen bestimmten Reiter, weil die App den zuletzt gewählten Reiter im `localStorage` behält.

Für das Zurücklesen der QR-Codes startet das Skript `tests/qr_lesen.py` in einer eigenen Umgebung (`uv run --with zxing-cpp --with pillow --with pypdfium2`). Ohne `uv` müssen diese drei Pakete im aktuellen Python installiert sein.

> **Regel:** Vor jedem Einspielen einer geänderten Version müssen alle Tests bestehen.

### 25.2 Einzelne Testseiten

| Datei | Prüft | Ausführen |
|---|---|---|
| `tests/grades.test.html` | Skalen, Eingabe-Parser, Rundung, Notenschlüssel (Vergleich mit Excel-Formeln), Bonus/Kappung, Status, Drittelparagraph, EPO (Werte aus der bisherigen EPO-Liste; Zusatz m: Parser, Zelltext, Zählung, eigene Punkte; Vorlagen „0 = befriedigend“, Mild, Streng und Wie Testschlüssel mit 12 Stunden in Sek I und MSS, 15 ab 97,5 %, unter 0 % → 01/00, eigene Vorlagen, Standardvorlage, Erkennen der geltenden Vorlage und „angepasst“, Hinweis bei alter Tabelle), Halbjahres-/Jahresnote, GK-Gewichtung, nicht erreichbare Stufen (zu wenig Punkte, eigene Schwellen, Präsentationen), „Punkte verteilen“ (Beispiel 18 Punkte, Grenze fest auch als eigene Schwelle, wenige Punkte, halbe Punkte, ganze Noten, MSS), Präsentationen (Gewicht, Status, Schlüssel, Halbjahresnote, Gruppen: Gruppenwert, Abweichung, Personenkriterium, Modus „alles als Gruppe“), Arbeiten in Teilen (gemeinsam/getrennt, Gewichte, fehlender Teil, Status je Teil, ganze Noten je Teil, MSS) | im Browser öffnen |
| `tests/competencies.test.html` | Kompetenzkataloge: Vorlage Mathe Sek I (12 Kompetenzen, freie id bei zweiter Kopie), Bereinigen (doppelte/ungültige Kennungen, Stufen, Bereich-ids), Fach → Katalog, Anlegen von Kompetenzen, Teilen und Bereichen mit vorgeschlagener Kennung, Kennung ändern nur unbenutzt, Löschen nur unbenutzt, Ausblenden, Katalog löschen nur ohne Kurs, `toggleTask`, Punkte je Kompetenz (Teile, Bonus), Export/Import (Formatprüfung, neu, Ersetzen nur ohne verlorene Kennungen), Migration und Prüfung, Nachschreibtermin; seit 2.11 Auswertung je Person (`evaluate`: Summen, Teil → Kompetenz, Bonus, Status fehlt/Täuschung/ungewertet, leere Aufgabe mit 0, Nachschreibtermin, Schuljahr, Teilstatus bei getrennten Teilen), Stufengrenzen, Kompetenztest; seit 2.12 Verlauf (`history`: Reihenfolge nach Datum, Prozent je Test, Stand = Zelle, „fehlt“ ohne Punkt, Nachschreibtermin mit eigenem Datum), Kurszeile (`dist`) und Register (`personHistory`: Kurs ohne Katalog fällt weg, Schuljahre alt → neu, Stand je Schuljahr); seit 2.13 Kompetenzbogen (`sheet`: sicher → „kann“, sonst „weiter“, Bereich), Kompetenzen eines Tests (`testCompetencies`: nur dieser Test, Nachschreibtermin mit eigenen Punkten, „fehlt“ leer) und Förderplan-Hinweis (`openGaps`: nur „noch nicht“ im Schuljahr). `run_tests.py` vergleicht außerdem `vorlagen/kompetenzen/mathe-sek1.json` mit der eingebauten Vorlage | im Browser öffnen |
| `tests/people.test.html` | Personenregister: Umstellung auf Schema 5 (je Kurseintrag eine eigene Person, nichts zusammengeführt, zweites Öffnen ändert nichts), `ensure` (neue Einträge, Name bei nur einem Kurs, doppelte oder unbekannte Person, „seit … in keinem Kurs“), gleiche Namen, Vorschläge zum Zusammenführen (Name, Mail-Adresse, nicht im selben Kurs), Zusammenführen (auch mehrere Paare nacheinander, `mergePairs`), Trennen, Löschen, `orphansIf`, Strukturprüfung; Nachteilsausgleich (Kürzel, Fächer ohne Groß-/Kleinschreibung, „alle Fächer“, abgelaufen, Anlegen/Ändern/Löschen, Zusammenführen, Migration); Notizverlauf (leer abgelehnt, Reihenfolge, Filter nach Kurs, Ändern, Löschen, Zusammenführen, Trennen nimmt Notizen des Kurses mit, Migration); Förderplan (Pflicht-Schwerpunkt, „Sonstiges“ mit Text, Zeitraum, geltende Fassung, Ändern, Löschen, Zusammenführen, Trennen, Migration) | im Browser öffnen |
| `tests/model.test.html` | Migration älterer Datenbanken (SCHEMA 1 → 5, Bereich neuer Tests, Kriterienpool, Startbestand ergänzen, Vorlagen, Standardvorlagen), neue Präsentation, Ablehnung neuerer Datenformate, Erhalt unbekannter Felder, Reiterauswahl (`settings.tabs`, `course.tabs`), Reihenfolge der Reiter (`orderTabs`, `moveTab`), Werkzeuge je Kurs (`toolList`, `setTools`, Migration von `course.tools`), Namensliste, einzelne Noten abschalten (`toggleOff`: `a.off` bei eigenen Spalten und EPO, Status bei Tests, „fehlt“ bleibt, Migration von `off`) | im Browser öffnen |
| `tests/update.test.html` | Datenbanken früherer Versionen (Prüfstücke 1.1–1.29 in `tests/altdaten/`, je Datenformat mindestens eins): öffnen, Strukturprüfung ohne Fehler, **gleiche Halbjahres- und Jahresnoten wie in der alten Version**, unbekannte Felder bleiben, zweites Öffnen ändert nichts; `NM.model.check` findet kaputte Halbjahre, Bereiche, fehlende Inhalte, doppelte Personen, fehlende Schuljahre und ändert nichts | im Browser öffnen |
| `tests/moodle.test.html` | CSV-Zerlegung, Erkennen und Zusammenführen von Antworten-/Bewertungen-CSV, bester Versuch, Textvergleich ohne Bewertungen, Zuordnung (Name, gemerkte E-Mail), Übernahme als Test, Import in einen bestehenden Test (Aufgaben ersetzen/behalten, Bezeichnung und Datum übernehmen), „fehlt“, erneuter Import, skalierte Punkte, Import in einen Teil (auch mit Ersetzen) | im Browser öffnen |
| `tests/qr.test.html` | QR-Code: Größe und Codewörter je Version 1–10, kleinste passende Version, Format- und Versions-Bits (Normtabellen), Reed-Solomon (Generatorpolynom, Beispiel „HELLO WORLD“, Nullstellen des Codeworts), Such-, Takt- und Ausrichtungsmuster, Format-Information in der Matrix, Masken, SVG; OrdoScripto: Test-ID laufend, Schüler-IDs (Format, eindeutig, bleiben gleich, neue Personen), je Test neue Pseudonyme, Nachschreibtermin übernimmt IDs, nur Nachschreibende, Import-CSV (Spalten, keine Namen, kein BOM), Einstufung (Standard undifferenziert, Abweichung je Person, Kurs für alle oder mit Abweichungen setzen, Spalte `kurs` = Einstufung je Person, Auswahl je Stufe, GK/LK aus der Kursart), Migration | im Browser öffnen |
| `tests/groups.test.html` | Gruppengrößen (Rest verteilt), Verteilung (alle genau einmal), Regeln „nicht zusammen“/„zusammen“, leistungsgemischt/-gleich, fehlende Noten, Abwechslung (auch Minimum), Expertengruppen (Standard und einstellbare Anzahl, gleich große Gruppen, kein Thema doppelt), Migration | im Browser öffnen |
| `tests/random.test.html` | Zufallszahl (Bereich, vertauschte Grenzen), Personenauswahl (ohne Wiederholung, Neubeginn), Kartenstapel 52/32/eigene, Würfelkörper W4–W20 (Flächenzahl, eben, Beschriftung, Gegenseiten n + 1, gewürfelte Seite liegt am Ende genau oben), Migration | im Browser öffnen |
| `tests/timer.test.html` | Countdown: Start/Pause/Weiter, Restzeit aus der Startzeit, Farbstufen (letzte Minute, letztes Fünftel, letzte 10 s), Ende und Überzeit, Neustart nach dem Ende, ± Minuten (nicht unter 0), Anzeige mm:ss/h:mm:ss, Eingaben `5`, `2,5`, `4:30`, `1:05:00`, `90s` und ungültige | im Browser öffnen |
| `tests/attendance.test.html` | Fehlzeiten: Halbjahr aus Datum, reihum A/E/U, Tage und Stunden, Summen in Unterrichtsstunden, Abgleich mit EPO (k → A, Fehlzeit → k in allen Stunden des Tages, k gelöscht/ersetzt, Zusätze bleiben), „Heute abwesend“, Tag löschen, Migration (k übernehmen, ungültige Werte, idempotent), Jahrgangswechsel | im Browser öffnen |
| `tests/draw.test.html` | Ziehen: klassisches Auffüllen, benannter Pool (eine Spalte, Abwesende, eine Runde bis fertig, Zeitraum), Ziehfehler (ohne Note, doppelt, Note ohne Ziehung, Spalte fehlt), Rückgängig nur der letzten Noten, frühere Ziehung löschen (Pool und klassisch, Gezogene zurück in den Topf, erneut Gezogene bleiben draußen, späteres Rückgängig bleibt richtig), Zusammenfassen (Konflikte, neuere/bessere Note, Einzelspalten entfernt), Pool löschen ohne Spalte zu löschen, Migration | im Browser öffnen |
| `tests/pomodoro.test.html` | Ablauf der Phasen (mit/ohne kurze bzw. lange Pause), Standardwerte, Migration der Einstellungen | im Browser öffnen |
| `tests/crypto.test.html` | Anlegen, Entsperren, falsches Passwort, Wiederherstellungsschlüssel, Passwortwechsel, alte Sicherungen, Manipulationserkennung | im Browser öffnen (dauert einige Sekunden) |
| `tests/storage.test.html` | Schreiben/Lesen, rollierende Sicherungen, externe Änderung, erzwungenes Überschreiben, Lock-Datei, Konfliktkopie, Datenordner wechseln (mit/ohne Sicherungen, Ziel nie überschreiben) | **über `http://localhost`**, z. B. `python3 -m http.server` im Programmordner, dann `http://localhost:8000/tests/storage.test.html` |
| `tests/sortis.test.html` | Export „Für OrdoSortis“: Kopfzeile, Sortierung, inaktive fehlen, Namen aus dem Register, leere Mail, Maskierung (`;`, `"`, Zeilenumbruch), kein BOM, Dateiname | im Browser öffnen |

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
| `SCHEMA` (z. B. `5`) | Version des Datenformats (2 seit 1.18: Arbeiten in Teilen; 3 seit 1.20: Präsentationen; 4 seit 1.23: Gruppenpräsentationen; 5 seit 2.4: Personenregister) | nur, wenn eine **ältere** App-Version die neuen Daten falsch verstehen würde (z. B. ein Feld ändert seine Bedeutung) |

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
- **Moodle-Import:** Einlesen und Übernehmen in `js/moodle.js` (Tests: `tests/moodle.test.html`), Dialog und Karte in `js/view-tests.js`, Ausdruck `NM.print.moodle` in `js/print.js`. Begleitdatei mit Kompetenzen: Abgleich in `js/moodle.js` (`matchCompanion`), Abschnitt im Dialog `companionPlan` und Dialog „Kompetenzen zuordnen“ `companionImport` in `js/view-tests.js`, Aufnehmen unbekannter Kennungen `NM.competencies.addWithId`; Format in PLANUNG.md Abschnitt AI.
- **Ausdrucke:** neue Ausdrucke in die Druckauswahl „Drucken …“ (`NM.ui.printButton`) eintragen, kein eigener Knopf. Jeder Ausdruck beginnt mit `header(course, title, sub, opts)` in `js/print.js` (seit 1.47; `opts`: `kicker`, `person`, `half`, `date`, `dateLabel`, `showDate`, `extra`, `compact` für Zettel), keine eigenen Köpfe. CSS `.p-head*`, `.p-school`, `.p-logo`, `.p-kicker`, `.p-meta`. Die Angaben kommen aus `settings.print` (`NM.model.cleanPrint`, Karte `printCard` mit `readLogo` in `js/view-settings.js`). Test: E2E `run_print_head_check`.
- **Kompetenzkataloge (seit 2.9, PLANUNG.md AI):** Logik rein in `js/competencies.js` (`NM.competencies`), Standardwerte in `migrate()`, Hinweise in `check()`. Die eingebaute Vorlage steht in `TEMPLATES` und muss mit `vorlagen/kompetenzen/mathe-sek1.json` übereinstimmen (die Datei liest das Bauskript `moodle.py` des Skills „moodle-fragen“; unter `file://` kann die App keine JSON-Datei laden, deshalb beides). Einstellungen: `competencyCard` und Dialog `catalogDialog` in `js/view-settings.js`. Kursdaten: Auswahl und Vorbelegung über das Fach in `courseCard` (`js/view-course.js`), „Kurs kopieren“ übernimmt `catalogId`. Test: Karte `competenciesCard` und Kürzel in `taskItem` (`js/view-tests.js`). Demo: 8b Mathe mit Katalog, „KA 1 – Terme“ mit Kompetenzen (`demoDb` in `js/model.js`). Kein neues `SCHEMA`: nur zusätzliche Felder; „Kompetenztest“ = Test mit `ungraded` und mindestens einer Kompetenz (`isCompetencyTest`, siehe PLANUNG AI, Q20). Tests: `tests/competencies.test.html`, E2E `run_competency_check`.
- **Reiter „Kompetenzen“ (seit 2.11):** Rechnung rein in `NM.competencies.evaluate` (Regeln im Kommentar dort, Tests in `tests/competencies.test.html`), Ansicht `js/view-competencies.js` (`NM.views.competencies`, Zeitraum über `ui.half` mit `'Jahr'` = Schuljahr), Stufenzeichen `NM.ui.stufeMark` und Umschalter `NM.ui.segSwitch` in `js/ui.js`, CSS `.comp-grid`, `.stufe-mark`, `.comp-legend`. Der Reiter steht in `TABS`/`OPTIONAL_TABS` (`js/app.js`); `tabOn(course, 'competencies')` ist ohne Katalog falsch, `tabOn(…, true)` fragt nur die Einstellung ab (Haken in `tabsCard`). Umschalter „Benotet | Kompetenztests | Alle“ in `render` von `js/view-tests.js` (`ui.testFilter`, `keepInList`). Notenübersicht: `halfCard` und `exportCsv` mit `showComp` (`ui.ovComp`), Ausdrucke `NM.print.course`/Leistungsbögen ohne Kompetenztests (`js/print.js`). Demo: „Kompetenztest Terme“ in 8b (HJ1). E2E `run_competency_tab_check`.
- **Verlauf der Kompetenzen (seit 2.12):** Rechnung rein in `NM.competencies` (`items` als gemeinsame Grundlage von `evaluate`, `history` und `personHistory`; Kurszeile `evaluate(…).dist`). Linie und Zeitachse als SVG in `js/ui.js` (`compLine`, `compAxis`, `compSlots`), Tabelle `historyTable`, Stand `standCell` und Dialog `historyDialog` in `js/view-competencies.js`, Kurszeile im `tfoot` von `gridCard`. Personenregister: `competencySection` in `js/view-people.js`. CSS `.comp-dist-*`, `.comp-hist*`, `.comp-line*`, `.comp-axis*`. E2E `run_competency_history_check`.
- **Kompetenzen für Schüler und Förderplan (seit 2.13):** Rechnung rein in `NM.competencies` (`sheet`, `testCompetencies` mit `items(…, own = true)`, `openGaps`). Kompetenzbogen `NM.print.competencySheet` und Block `moodleComp` in `NM.print.moodle` (Option `withComp`) in `js/print.js`, CSS `.p-comp*`; Druckauswahl und Dialog `sheetPrint` in `js/view-competencies.js`, Haken `data-moodle-comp` in `moodlePrint` (`js/view-tests.js`). Förderplan: `gapsHint` im `fpDialog` (`js/view-people.js`), CSS `.fp-gap*`. E2E `run_competency_print_check`.
- **Export „Für OrdoSortis“ (seit 2.15.0, Plan `PLANUNG.md` AK):** Logik rein in `js/sortis.js` (`NM.sortis.exportCsv`, eigene Maskierung ohne BOM und mit `\n`, nicht `NM.util.csv`), Knopf `sortisExport` in `js/view-people.js` (nur bei Kursauswahl, Hinweis „nicht verschlüsselt“). Das Format ändert sich nur nach Absprache mit `../OrdoSortis/docs/KONZEPT.md` 7.1. Tests: `tests/sortis.test.html`, E2E in `run_people_page_check`.
- **Personenregister (seit Schema 5):** Logik rein in `js/people.js` (`NM.people`, Tests `tests/people.test.html`). `ensure(db)` läuft in `migrate()` und in `NM.app.commit()`, legt für Kurseinträge ohne Person eine an, setzt/entfernt `orphanSince` und übernimmt bei nur einem Kurs den Namen. Neue Stellen, die Kurseinträge anlegen, brauchen deshalb nichts weiter; wer dieselbe Person meint (z. B. „Kurs kopieren“ in `js/view-course.js`), übernimmt die `personId`. Löschen mit Rückfrage über `NM.people.orphansIf` (`removeStudent`, `confirmCourseDelete`). Nach einer Umstellung des Schemas setzt `migrateOpened` (`js/app.js`) `store.lastBackup` zurück, damit die nächste Speicherung sichert. Seite „Personen“ (seit 2.4.0): `js/view-people.js` (`NM.views.people`), aufgerufen über `renderPeople` in `js/app.js` bei `ui.tab = 'people'` (nicht in `TABS`, gewählte Person in `ui.personId`), Eintrag in der Seitenleiste `peopleLink`. Abgleich beim Einfügen `addPasted` und Namensänderung `changeName` in `js/view-course.js`. Tests: `tests/people.test.html`, E2E `run_people_check`, `run_people_page_check`.
- **Nachteilsausgleich (seit 2.5.0):** Logik rein in `js/people.js` (`setAusgleich`, `removeAusgleich`, `ausgleicheFuer`, `ausgleichPasst`, `ausgleichAbgelaufen`, `ausgleichKurz`, `faecherDerPerson`), Standardwert in `migrate()`. Erfassen: `ausgleichSection`/`ausgleichDialog` in `js/view-people.js`. Kürzel: `NM.ui.ausgleichMarks`, in `UI.nameCells` nur mit Option `course` (bewusst nicht in Ziehen, EPO, Präsentationen, Beamer und Druck); Kursliste in `js/view-course.js`. Spalte „Ausgleich“ in `resultsCard` (`js/view-tests.js`, `ausgleichBox`). Druck-CSS blendet `.na-mark` und `.col-ausgleich` zusätzlich aus. Notfallwerkzeug: Spalte „Nachteilsausgleich“ in `Personenregister.csv`. Tests: `tests/people.test.html`, E2E `run_ausgleich_check`.
- **Notizverlauf (seit 2.6.0):** Logik rein in `js/people.js` (`notizen`, `notizenOf`, `setNotiz`, `removeNotiz`; `split` nimmt Notizen der abgetrennten Kurse mit), Standardwert in `migrate()`. Oberfläche in `js/view-people.js`: `notesSection` mit `noteItem`/`noteEditItem` (Zustand in `view`, Entwurf je Person in `view.draft`), dazu `quickNoteDialog` (Sitzplan, Knopf `.seat-note-btn` und Taste N in `js/view-seating.js`) und `courseNotesDialog` (Notenübersicht, `notesBtn` in `js/view-overview.js`), beide über `NM.views.people`. Notfallwerkzeug: `Notizen.csv`. Tests: `tests/people.test.html`, E2E `run_notes_check`.
- **Förderplan (seit 2.7.0):** Logik rein in `js/people.js` (`SCHWERPUNKTE`, `foerderplaene`, `geltenderFoerderplan`, `schwerpunktText`, `setFoerderplan` mit Prüfung, `removeFoerderplan`), Standardwert in `migrate()`. Oberfläche in `js/view-people.js`: `foerderSection`, `fpDialog` (Modi `new`, `continue`, `edit`), `fpCompare`; offene Fassungen in `view.fpOpen`. Hinweis in der Kursliste: `fpHint` in `js/view-course.js`, Sprung über `NM.views.people.open(pid)`. Notfallwerkzeug: `Foerderplaene.csv`. Tests: `tests/people.test.html`, E2E `run_foerder_check`.
- **Verbalbeurteilung bei I-Status (seit 2.3.0):** Regeln rein in `js/grades.js` (`VERBAL_BELOW`, `verbalText`, `verbalMissing`, `verbalOnSlip`), Karte `verbalCard` und Hinweis `verbalHint` in `js/view-tests.js`, Ausdruck `verbalBlock` in `js/print.js` (Ergebniszettel in `test(…, 'students')`, `moodle`), CSV-Spalte in `tools/entschluesseln.py`. Neue Zettel oder Bögen für Schüler mit Note prüfen `G.verbalOnSlip`.
- **Arbeit in Teilen (seit 1.18):** Logik in `js/grades.js` (`hasParts`, `separateParts`, `taskGroups`, `partAsTest`, `keyForPart`, `partStats`; `testResult()` liefert `parts`), Oberfläche in `js/view-tests.js` (`partsCard`, Teilspalten, Schlüssel je Teil), Druck `NM.print.test(…, 'parts')`.
- **Präsentationen (seit 1.20):** Logik in `js/grades.js` (`presAsTest`, `presResult`, `presStats`, `keyForPres`; Präsentation = Test mit Kriterien als Aufgaben, 3 × Gewicht), Modell `NM.model.newPres`/`presCriterion`/`defaultCriteriaPool`/`newPresTemplate`, Standardvorlagen `PRES_TEMPLATES` mit `defaultPresTemplates(pool)` und `missingDefaultTemplates`, Reiter `js/view-pres.js`, Druck `NM.print.pres(course, a, 'list' | 'key' | 'blank' | 'sheets')` und `NM.print.presGuide`. Die Schlüsselkarte teilt sich der Reiter mit den Tests (`NM.views.tests.keyCardFor`).
- **Gruppenpräsentationen (seit 1.23):** Logik in `js/grades.js` (`presGroupOf`, `presCritIsGroup`, `presScores`, `presDeviation`, `presTopic`), Oberfläche in `js/view-pres.js` (`setGroupMode`, `groupsCard`, `groupRateCard`, `personRateCard`).
- **Fehlzeiten (seit 1.45):** Logik rein in `js/attendance.js` (`NM.attendance`: `get`/`set`/`cycle`, `dates`, `totals`, `awaySet`, `setAbsent`, Abgleich `syncFromEpo`/`syncToEpo`/`fromEpo`, `clean`). Datenmodell `course.attendance`; `migrate` ruft `clean` und `fromEpo`, `setJahrgang` hängt die Halbjahre um. „Heute abwesend“: `NM.views.draw.absent` (Momentaufnahme) und `setAbsent` (`js/view-draw.js`), genutzt in Ziehen, Gruppen (`absentCard`) und Tools. EPO-Abgleich in `js/view-epo.js` (Zelle, `quickButtons`, `fillLesson`, `addLesson`, `editLesson`). Karte `attendanceCard`/`addDay`/`editDay` in `js/view-course.js`, Spalte `attCell` in `js/view-overview.js`, Druck `NM.print.attendance` und Leistungsbogen-Option `absence` (`js/print.js`), CSS `.att-*`. Notfallwerkzeug: Spalten „Fehlstunden <Halbjahr>“. Neue Testseiten, die `model.js` laden, brauchen auch `attendance.js`. Tests: `tests/attendance.test.html`, E2E `run_attendance_check`.
- **Mitarbeit/EPO, Zusätze:** Kürzel und Rechnung in `js/grades.js` (`EPO_DEFAULT_POINTS`, `parseEpoCell`, `epoCellText`, `epoCellEmpty`, `epoResult`), Reiter `js/view-epo.js` (`gridCard`, `setCell`, `quickButtons` – auch groß für die Kacheln –, `tilesView` für die Kachelansicht mit `NM.views.seating.layout`, `configCard`, `fillLesson`; CSS `.tile*`, `.tiles-*`, `.quick-big`), Ausdrucke `NM.print.epo`/`epoSlips`/`studentSheet`. Ein neuer Zusatz (wie `m` seit 1.44) braucht Parser, Zelltext, Leer-Prüfung, Punkte-Standard, Zählung in `epoResult`, Schnellwahl, Spalte, Legende, Einstellungen, Ausdrucke und `tools/entschluesseln.py`. Tests: `tests/grades.test.html`, E2E `run_epo_material_check`, `run_epo_tiles_check`. Angezeigte Stunden (seit 2.19): `SHOW_OPTIONS`, `shownCount`, `setShown` in `js/view-epo.js` (`ui.epoShow` je Kurs, nur Ansicht; `gridCard` rechnet mit `allLessons`), CSS `.epo-show`, `.epo-hidden-note`, E2E `run_epo_show_check`.
- **EPO-Vorlagen (seit 2.8):** Rechnung rein in `js/grades.js` (`EPO_PRESETS`, `epoPresetTable`, `epoPresetList`, `epoStandardPreset`, `epoApplyPreset`, `epoCurrentPreset`, `epoNeedsReview`; `epoDefaultTable` ist „Wie Testschlüssel“). Datenmodell: `settings.epoPresets`/`epoDefault` mit `cleanEpoPresets` in `migrate()`, Prüfung in `check()`, neue Blöcke über `newEpoBody`, Stufenwechsel in `adoptLevelDefaults` (eingebaute Vorlage bleibt dieselbe). Block: `reviewNotice`, `applyPreset`, `savePreset`, `configCard` in `js/view-epo.js`; Einstellungen: `epoCard` in `js/view-settings.js`; CSS `.epo-preset-*`. Das Notfallwerkzeug gibt nur die Kürzel aus und braucht keine Änderung. Tests: `tests/grades.test.html`, `tests/model.test.html`, E2E `run_epo_presets_check`.
- **Tools (seit 1.29 als „Zufall“, seit 1.36 „Tools“ mit Timer):** Timer-Logik in `js/timer.js` (`NM.timer`), Anzeige `timerTool`/`timerFace` (Designs ring, digits, bar, hourglass) und Pop-up `openTimerPopup` in `js/view-random.js`; ein Timer für die ganze App (`clock`), alle Anzeigen in `clock.faces`, Signal über `NM.pomodoro.alarm`. Zufalls-Logik in `js/random.js` (`NM.random`), Reiter `js/view-random.js` (`numberTool`, `peopleTool`, `diceTool` mit eigenem Canvas-3D-Zeichner `paintDie`, `cardTool` mit `flyIn`). Kartenbilder in `cards/` (`<Farbe C/D/H/S><Wert 2–10/B/D/K/A>.svg`, `back.svg`, CC0); ein neuer App-Ordner muss auch in `staticAllowed` (`launcher/server.go`) und in `launcher/build.sh`. Ergebnisse und Stapel nur in der Sitzung (`NM.views.random.session`), Einstellungen pro Gerät in `nm.ui` (`ui.random`), eigene Karten in `course.randomCards`. Begriffe in Gruppen (seit 2.20): Logik `NM.random.termGroups`/`termGroupsText`, Daten `course.termTool` mit `NM.model.cleanTermTool` (auch in `migrate()`), Kachel `termTool` in `js/view-random.js` (speichert mit `commit({ render: false })`, damit das Vollbild beim Mischen bleibt), CSS `.term-*`, E2E `run_terms_tool_check`. „Heute abwesend“ aus `NM.views.draw.absent`. Werkzeuge je Kurs (seit 1.39): `course.tools`, reine Logik `NM.model.TOOL_IDS`/`toolList`/`setTools`, Kacheln über die Tabelle `TOOLS` und Fenster `toolsMenu` in `js/view-random.js`; ein neues Werkzeug kommt in `TOOL_IDS` und `TOOLS`. Tests: `tests/random.test.html`, `tests/model.test.html`, E2E `run_random_check`, `run_tools_layout_check`, `run_tools_menu_check`.
- **Demo öffnen (seit 1.31):** `NM.app.openDemo()` (`js/app.js`) öffnet die eigene Adresse mit `?demo` in einem neuen Fenster; Knöpfe über `demoLink()` auf den Startseiten (`renderStart`, `renderCreate`) und in `infoCard` (`js/view-settings.js`). Die Demo speichert ihre Ansicht unter `nm.ui.demo` (`UI_KEY`). E2E `run_demo_link_check`.
- **Automatische Sperre (seit 2.16 auch nach dem Ruhezustand):** rein `lockReason` in `js/app.js` (Ruhezustand ab `SLEEP_GAP_MS` = 2 Min. Lücke, sonst `autoLockMin`), `checkLock` aus dem Zeitgeber (alle 20 s) und bei `visibilitychange`/`focus`/`pageshow`, Sperren über `lockApp` (nur einmal gleichzeitig). Die Lücke nicht unter 2 Minuten setzen: Browser drosseln Zeitgeber in Hintergrund-Tabs auf einmal pro Minute. E2E `run_sleep_lock_check`.
- **Noten abschalten (seit 2.18, PLANUNG AN):** Daten `a.off` (nur `manual`/`epo`, Bereinigung in `migrate()`), Umschalten rein in `NM.model.toggleOff` (Tests/Präsentationen über den Status `ungewertet` beim zählenden Termin), Rechnung über `NM.grades.offFor` in `ungradedFor` (damit wirkt es überall, wo `ungradedFor` gefragt wird: `halfResult`, Ausdrucke). Oberfläche: Modus `state.ovOffMode` (nur Sitzung), `offButton`, `toggleCell`, `toggleColumn` in `halfCard` (`js/view-overview.js`), CSS `.off-single`, `.off-cell-btn`, `.off-hint`. Notfallwerkzeug: „(nicht gewertet)“ in der Zelle, „– nicht gewertet“ im Spaltenkopf. Tests `tests/model.test.html`, E2E `run_overview_off_check`.
- **Update-Sicherheit (seit 1.33):** Strukturprüfung `NM.model.check(db)` (`js/model.js`, rein, liefert `{ level: 'fehler' | 'hinweis', where, text }`), Aufruf nach dem Entsperren in `unlock` (`js/app.js`, nur Meldung) und im Dialog `checkDialog` (`js/view-settings.js`). Prüfstücke früherer Versionen in `tests/altdaten/` (erzeugt mit `erzeugen.js` aus dem Git-Verlauf), geprüft in `tests/update.test.html`, E2E `run_old_db_check` und in `run_decrypt_tool`. Neue Felder in `check` aufnehmen, wenn ein fehlerhafter Wert die Rechnung stören würde.
- **Reihenfolge der Reiter (seit 1.34):** `settings.tabOrder`; reine Logik `NM.model.orderTabs`/`moveTab`, in der App `NM.app.orderedTabs()` (überall statt `TABS` verwenden, wo Reiter angezeigt werden) und `NM.app.setTabOrder()`. Ziehen in der Reiterleiste in `renderMain` (`js/app.js`), Pfeile in `tabOrderList` (`js/view-settings.js`), Haken in `NM.ui.tabChecks`. E2E `run_tab_order_check`.
- **Notenübersicht einklappen/bündeln (seit 1.35):** `halfCard` in `js/view-overview.js` (`ui.ovFold = { ka, other, draw }` pro Gerät, `drawRange`, `bundleCell`). Ziehungsspalten = Einzelnoten, deren id in `course.draw.history[].aid` steht. Ausdrucke (`NM.print.course`) sind unabhängig davon. E2E `run_overview_fold_check`.
- **Ziehen-Pools (seit 1.37):** Logik `js/draw.js` (`NM.draw`), Reiter `js/view-draw.js` (`poolPicker`, `renderPool`, `checkCard`, `mergeDialog`; klassischer Pool weiter über `drawStudents`/`pool`). Gewählter Pool pro Gerät in `ui.drawPool`. Wer für eine Spalte gezogen wurde: `NM.draw.drawnSets` (Notenübersicht), Zeitraum im Kopf über `poolSub` (`js/view-overview.js`) und `drawDate` (`js/print.js`). Strukturprüfung der Pools in `NM.model.check`. E2E `run_draw_pools_check`. Frühere Ziehung löschen (seit 2.17): Logik `NM.draw.removeDraw` (passt `prevOut` späterer Ziehungen an, damit deren „Rückgängig“ stimmt), Knopf `data-draw-delete` in `historyCard` und Rückfrage `removeDraw` in `js/view-draw.js`, E2E in `run_draw_check`.
- **Gruppenbildung (seit 1.24):** Logik in `js/groups.js` (`sizes`, `build` mit Kostenfunktion und Tauschsuche, `check`, `experts`), Reiter `js/view-groups.js` (`roll`, `expertCard`), Druck `NM.print.groups`, Übernahme in Präsentationen `NM.views.pres.applyGroups`. „Heute abwesend“ kommt aus `NM.views.draw.absent` (nur Sitzung). Leistung = gerundete Halbjahresnote (`G.halfResult(...).final`), nie gespeichert. Tests: `tests/groups.test.html`, E2E `run_groups_tab_check`.
- **Reiter ausschalten (seit 1.25):** `NM.app.OPTIONAL_TABS`, `tabOn(course, id)`, `shownTab(course)` (Ersatz: Notenübersicht, sonst „Kurs & Schüler“), Haken über `NM.ui.tabChecks`. Daten ausgeschalteter Reiter bleiben und zählen weiter. E2E `run_tabs_check`.
- **Nachschreibtermine (seit 1.40):** `a.makeupOf` an einem Test. Logik in `js/grades.js` (`makeupTarget`, `isMakeup`, `makeupsOf`, `hasTestEntry`, `countingFor`). `assessmentPoints`, `assessmentStatus` und `ungradedFor` nehmen den Kurs als letztes Argument und lesen dann über `countingFor` den zählenden Termin. `halfResult` lässt Nachschreibtermine als eigene Leistung weg. Modell: `NM.model.newMakeup` und `syncMakeups` (bei jedem `NM.app.commit()` und in `migrate`). Oberfläche in `js/view-tests.js` (`metaCard`, Filter `missedIn` in `resultsCard`, `ui.makeupAll`). Spalten in Notenübersicht, Notenliste, Leistungsbogen und CSV-Export ohne Nachschreibtermine (`G.isMakeup`). Wer Leistungen einer Person liest, übergibt den Kurs. Tests: `tests/grades.test.html`, `tests/model.test.html`, E2E `run_makeup_check`.
- **OrdoScripto (seit 1.41, Plan in `PLANUNG.md` Abschnitt T, Formate in `../OrdoScripto/docs/DESIGN.md`):** QR-Code in `js/qr.js` (`NM.qr`, nur Fehlerkorrektur Q), IDs und CSV in `js/scripto.js` (`NM.scripto`), Datenmodell `test.scripto`, `settings.scriptoSeq`. Spalte `kurs` = `NM.model.studentEinstufung` (über `NM.scripto.kursFor`). Nachschreibtermine haben kein eigenes `scripto` (`newMakeup` löscht es), `NM.scripto.dataOf`/`owner` lesen das der Arbeit. Oberfläche in `js/view-tests.js` (`scriptoPrepare`, `scriptoCardFor`, `scriptoPrint`, Knopf in `tasksCard`, Eintrag in `printButton`), Druck `NM.print.scripto` (`js/print.js`, CSS `.p-sc-*`). Notfallwerkzeug: Pseudonyme in `schreibe_csv`. Ein Format ändert sich nur nach Absprache in DESIGN.md. Tests: `tests/qr.test.html`, E2E `run_scripto_check` mit `tests/qr_lesen.py`.
- **Einstufung (seit 1.42, GK/LK seit 1.43.1):** `course.einstufung` (U, G, E, E1, E2, GK, LK) und `student.einstufung` nur bei Abweichung. Immer über `NM.model.courseEinstufung`, `studentEinstufung`, `setStudentEinstufung` und `setCourseEinstufung` (`{ keep }`) lesen und setzen, Liste `NM.model.EINSTUFUNGEN`, Auswahl je Stufe `einstufungenFor(course, aktuell)`, Kursart → Einstufung `einstufungFromType` (Kursart-Auswahl und `changeJahrgang`, neue Kurse in `newCourse`). Oberfläche: `courseCard`/`changeEinstufung` und Spalte „Einst.“ in `studentsCard` (`js/view-course.js`). Notfallwerkzeug: Spalte „Einstufung“. Tests: `tests/qr.test.html`, E2E `run_scripto_check`.
- **Notenschlüssel-Warnung:** `G.unreachableSteps(key)` meldet nicht erreichbare Stufen; Warnung mit Schnellknöpfen in `NM.views.tests.keyCardFor` (Tests, Teile, Präsentationen). „Punkte verteilen“ (seit 2.2): Regel in `G.spreadKey(key, max, precision)`, Knopf in `unreachableNotice`, Fenster `spreadDialog` (`js/view-tests.js`); die Aufrufer übergeben `max` und `precision` an `keyCardFor`. Tests: `tests/grades.test.html`, E2E `run_unreachable_check`.
- **Neue Kursart:** Eintrag in `COURSE_TYPES` in `js/grades.js`.
- **Sitzplan-Beamer (seit 2.1):** `beamer(course)` in `js/view-seating.js` (über `NM.views.seating.beamer`), Anordnung wie im Editor, Belegung aus `layout`, Namen aus `cardNames`. Schalter pro Gerät in `ui.seatBeamer = { photos }`. Platzgröße und Schrift setzt `fit` (`--cell`, `font-size`), CSS `.seat-beamer*`. Nichts Vertrauliches hinzufügen (Datenschutz, PLANUNG.md). E2E `run_seat_beamer_check`.
- **Gemeinsames Design (seit 2.0):** nur im Design-Repo ändern und neu verteilen, siehe 22.2. Neue Knöpfe mit `NM.util.icon(name)`, leere Ansichten mit `NM.ui.emptyState`, Dateifelder mit `NM.ui.dropzone`. Farben nur über die Tokens, Maße in `rem`.
- **Farben und Designs (seit 1.43):** Tokens oben in `css/app.css`: `:root, [data-theme='light']` hell, `[data-theme='dark']` dunkel (davor der `prefers-color-scheme`-Rückfall, bis das Skript läuft), darunter die weiteren Designs als `[data-theme][data-variant='…']`, die nur abweichende Tokens überschreiben. Die Liste steht in `NM.app.THEMES` (`js/app.js`); `applyTheme` löst „Wie das System“ selbst auf (der Modus-Schalter der Kopfzeile ruft `setThemeMode`) (`themeMode`, Listener auf `prefers-color-scheme`) und setzt immer `data-theme` und `data-variant`, `themeVariant` liefert das gewählte Design. Kacheln: `themeTiles` in `js/view-settings.js`; das Timer-Pop-up kopiert beide Attribute (`openTimerPopup`). Ein neues Design: Eintrag in `THEMES` und ein Token-Block in `css/app.css`; `run_theme_check` prüft den Kontrast automatisch.
- **Änderungen am Datenmodell:** Standardwerte in `NM.model.migrate()` ergänzen, damit bestehende Datenbanken weiter funktionieren. Bei inkompatiblen Änderungen `SCHEMA` erhöhen.
- **Startprogramm:** Quelltext in `launcher/` (Go, nur Standardbibliothek), Tests `launcher/server_test.go`, `icon_test.go`, `desktop_linux_test.go` (laufen in `run_tests.py` mit, E2E `run_launcher_check`). Neue Schnittstellen immer in `server.go` und `ServerStore` (`js/storage.js`) zugleich, mit derselben Bedeutung wie in `FolderStore`. Ordnerwechsel: `store.pickTarget()` → `{ name, hasDb, same }`, `store.moveTo(ziel, { backups })`, `Store.useTarget(ziel)` (ohne Kopieren); Oberfläche `changeFolder`, `restoreFromFile` in `js/view-settings.js`, `importFromFile`/`NM.app.switchStore` in `js/app.js`, Dateiauswahl `NM.util.pickFile`. Neue Ordner mit App-Dateien in `staticAllowed` (`server.go`) und in `build.sh` eintragen. Bauen: `launcher/build.sh`.
- **Neue Version einspielen:** Programmordner (`index.html`, `css/`, `js/`) ersetzen; für das Startprogramm mit eingebauten Dateien vorher `launcher/build.sh` laufen lassen. Der Datenordner bleibt unberührt. Vorher eine Sicherung anlegen.
