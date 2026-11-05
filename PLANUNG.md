# OrdoNota – Geplante Funktionen

Erledigt: A Arbeit in Teilen (1.18.0), Druckauswahl (1.19.0), B Präsentationen (1.20.0–1.22.0), D Gruppenpräsentationen (1.23.0), E Reiter „Gruppen“ (1.24.0), Reiter ein-/ausschalten (1.25.0), Moodle-Import im Test (1.26.0).

## C) Gamification des Pomodoro-Timers – 1.27.0 (als Nächstes)

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
