/* OrdoNota – Kompetenzkataloge und Kompetenzen je Aufgabe (seit 2.9, PLANUNG.md Abschnitt AI).
 * Rein, ohne DOM. Ein Katalog liegt in db.settings.competencyCatalogs im selben Aufbau wie die
 * Austauschdatei (Format „ordonota-kompetenzkatalog“), nur ohne die Felder format/formatVersion:
 *   { id, name, fach, version, stufen: { teilweise, sicher },
 *     bereiche: [ { id, name, kompetenzen: [ { id, name, ausgeblendet?, texte?, teil?: [ { id, name, ausgeblendet? } ] } ] } ] }
 * texte (seit 2.24, PLANUNG.md AR): Erklärtexte für den Kompetenzbogen { worum?, noch?, teilweise?, sicher? }, je höchstens 300 Zeichen.
 * Ein Kurs zeigt mit course.catalogId auf einen Katalog, eine Aufgabe trägt task.competencies = [Kennungen].
 * Kennungen werden nie neu vergeben; benutzte lassen sich nur ausblenden. */
(function (NM) {
  'use strict';

  const FORMAT = 'ordonota-kompetenzkatalog';
  const FORMAT_VERSION = 1;
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
  const STUFEN = { teilweise: 50, sicher: 80 };
  /** Erklärtexte je Kompetenz (seit 2.24): „Darum geht es“ und je Stufe ein Text. */
  const TEXT_KEYS = ['worum', 'noch', 'teilweise', 'sicher'];
  const TEXT_MAX = 300;
  const STUFE_IDS = ['sek1', 'mss']; // Kursstufe eines Katalogs (seit 2.22, fehlt = beide)
  const FEW_POINTS = 3; // weniger mögliche Punkte → Hinweis „wenig Daten“

  // Bildungsstandards Mathematik ESA/MSA (KMK, 23.06.2022). Das Dokument nummeriert nicht;
  // die Kennungen folgen der Reihenfolge dort. Jede Vorlage muss mit vorlagen/kompetenzen/<key>.json übereinstimmen (Test).
  // stufe (seit 2.22): 'sek1' | 'mss' | fehlt = beide; damit wählt die App je Kursstufe den passenden Katalog.
  const TEMPLATES = [
    {
      key: 'mathe-sek1',
      label: 'Mathematik Sek I (Bildungsstandards 2022)',
      catalog: {
        id: 'mathe-sek1',
        name: 'Mathematik Sek I',
        fach: 'Mathematik',
        stufe: 'sek1',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'K',
            name: 'Prozessbezogen',
            kompetenzen: [
              { id: 'M-K1', name: 'Mathematisch argumentieren' },
              { id: 'M-K2', name: 'Mathematisch kommunizieren' },
              { id: 'M-K3', name: 'Probleme mathematisch lösen' },
              { id: 'M-K4', name: 'Mathematisch modellieren' },
              { id: 'M-K5', name: 'Mathematisch darstellen' },
              { id: 'M-K6', name: 'Mit mathematischen Objekten umgehen' },
              { id: 'M-K7', name: 'Mit Medien mathematisch arbeiten' },
            ],
          },
          {
            id: 'L',
            name: 'Inhaltlich (Leitideen)',
            kompetenzen: [
              { id: 'M-L1', name: 'Zahl und Operation' },
              { id: 'M-L2', name: 'Größen und Messen' },
              { id: 'M-L3', name: 'Strukturen und funktionaler Zusammenhang' },
              { id: 'M-L4', name: 'Raum und Form' },
              { id: 'M-L5', name: 'Daten und Zufall' },
            ],
          },
        ],
      },
    },
    // Bildungsstandards Mathematik Allgemeine Hochschulreife (KMK, 18.10.2012), K1–K6 und L1–L5 wie im Beschluss (2.22).
    {
      key: 'mathe-mss',
      label: 'Mathematik MSS (Bildungsstandards Abitur 2012)',
      catalog: {
        id: 'mathe-mss',
        name: 'Mathematik MSS',
        fach: 'Mathematik',
        stufe: 'mss',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'K',
            name: 'Prozessbezogen',
            kompetenzen: [
              { id: 'MO-K1', name: 'Mathematisch argumentieren' },
              { id: 'MO-K2', name: 'Probleme mathematisch lösen' },
              { id: 'MO-K3', name: 'Mathematisch modellieren' },
              { id: 'MO-K4', name: 'Mathematische Darstellungen verwenden' },
              { id: 'MO-K5', name: 'Mit symbolischen, formalen und technischen Elementen umgehen' },
              { id: 'MO-K6', name: 'Mathematisch kommunizieren' },
            ],
          },
          {
            id: 'L',
            name: 'Inhaltlich (Leitideen)',
            kompetenzen: [
              { id: 'MO-L1', name: 'Algorithmus und Zahl' },
              { id: 'MO-L2', name: 'Messen' },
              { id: 'MO-L3', name: 'Raum und Form' },
              { id: 'MO-L4', name: 'Funktionaler Zusammenhang' },
              { id: 'MO-L5', name: 'Daten und Zufall' },
            ],
          },
        ],
      },
    },
    // Weiterentwickelte Bildungsstandards Chemie MSA (KMK, 13.06.2024): vier Kompetenzbereiche mit ihren
    // Teilkompetenzbereichen (S 1–S 3, E 1–E 3, K 1–K 3, B 1–B 3; S 0 ist übergeordnet) und drei Basiskonzepte (2.22).
    {
      key: 'chemie-sek1',
      label: 'Chemie Sek I (Bildungsstandards 2024)',
      catalog: {
        id: 'chemie-sek1',
        name: 'Chemie Sek I',
        fach: 'Chemie',
        stufe: 'sek1',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'S',
            name: 'Sachkompetenz',
            kompetenzen: [
              { id: 'C-S1', name: 'Die makroskopische Ebene' },
              { id: 'C-S2', name: 'Die submikroskopische Ebene' },
              { id: 'C-S3', name: 'Die Ebene der Repräsentationen' },
            ],
          },
          {
            id: 'E',
            name: 'Erkenntnisgewinnungskompetenz',
            kompetenzen: [
              { id: 'C-E1', name: 'Erkenntnisse mithilfe von Experimenten gewinnen' },
              { id: 'C-E2', name: 'Modelle im Rahmen der Erkenntnisgewinnung nutzen' },
              { id: 'C-E3', name: 'Erkenntnisprozesse reflektieren' },
            ],
          },
          {
            id: 'K',
            name: 'Kommunikationskompetenz',
            kompetenzen: [
              { id: 'C-K1', name: 'Informationen erschließen' },
              { id: 'C-K2', name: 'Informationen aufbereiten' },
              { id: 'C-K3', name: 'Informationen austauschen und diskutieren' },
            ],
          },
          {
            id: 'B',
            name: 'Bewertungskompetenz',
            kompetenzen: [
              { id: 'C-B1', name: 'Sachverhalte und Informationen kriteriengeleitet bewerten' },
              { id: 'C-B2', name: 'Meinungen bilden und Entscheidungen treffen' },
              { id: 'C-B3', name: 'Entscheidungen und deren Folgen reflektieren' },
            ],
          },
          {
            id: 'BK',
            name: 'Basiskonzepte',
            kompetenzen: [
              { id: 'C-BK1', name: 'Aufbau und Eigenschaften der Stoffe und ihrer Teilchen' },
              { id: 'C-BK2', name: 'Chemische Reaktion' },
              { id: 'C-BK3', name: 'Energie' },
            ],
          },
        ],
      },
    },
  ];

  // Erklärtexte der Vorlagen (seit 2.25, PLANUNG.md AR-2): je Kompetenz „Darum geht es“ und ein Text je Stufe,
  // in der du-Form. Sie stehen in den Vorlagen und in vorlagen/kompetenzen/<key>.json (Test vergleicht beides).
  const TEMPLATE_TEXTE = {
    'mathe-sek1': {
      'M-K1': {
        worum: "Du zeigst, warum etwas in der Mathematik stimmt. Du begründest deine Schritte und prüfst, ob eine Aussage immer gilt.",
        noch: "Fang klein an: Schreibe hinter jeden Rechenschritt einen kurzen Satz mit „weil …“. Prüfe eine Aussage zuerst an zwei Zahlenbeispielen.",
        teilweise: "Deine Begründungen sind oft schon richtig. Achte darauf, keinen Schritt auszulassen, und suche ein Gegenbeispiel, wenn eine Aussage nicht immer gilt.",
        sicher: "Ich kann meine Lösungswege vollständig begründen. Nächster Schritt: Finde Fehler in fremden Lösungen und erkläre, warum sie falsch sind.",
      },
      'M-K2': {
        worum: "Du schreibst und sprichst über Mathematik so, dass andere dich verstehen. Dazu gehören die richtigen Fachwörter und ein klarer Lösungsweg.",
        noch: "Schreibe deinen Lösungsweg Schritt für Schritt auf, nicht nur das Ergebnis. Lege dir eine Liste mit wichtigen Fachwörtern an und übe sie.",
        teilweise: "Man kann deinem Weg schon gut folgen. Übe, Fachwörter genau zu benutzen, und lies deine Lösung einmal so, als wärst du jemand anderes.",
        sicher: "Ich kann Lösungen klar aufschreiben und erklären. Nächster Schritt: Erkläre jemandem aus deiner Klasse eine schwierige Aufgabe.",
      },
      'M-K3': {
        worum: "Du löst Aufgaben, bei denen der Weg nicht sofort klar ist. Du probierst, zeichnest, suchst Muster und wählst eine passende Strategie.",
        noch: "Lies die Aufgabe zweimal und schreibe auf, was gegeben und was gesucht ist. Mach eine Skizze oder probiere mit einfachen Zahlen aus.",
        teilweise: "Du findest oft einen Anfang. Übe, verschiedene Strategien auszuprobieren (rückwärts rechnen, Tabelle, Skizze) und dein Ergebnis am Ende zu prüfen.",
        sicher: "Ich kann auch unbekannte Probleme lösen. Nächster Schritt: Suche einen zweiten Lösungsweg und vergleiche, welcher schneller ist.",
      },
      'M-K4': {
        worum: "Du übersetzt eine Situation aus dem Alltag in Mathematik, rechnest und prüfst, ob dein Ergebnis zur Situation passt.",
        noch: "Unterstreiche im Text die Zahlen und was gesucht ist. Überlege dann, welche Rechnung dazu passt, und schreibe am Ende einen Antwortsatz.",
        teilweise: "Den Ansatz findest du oft schon. Übe, dein Ergebnis mit der Situation zu vergleichen: Ist die Zahl realistisch? Passt die Einheit?",
        sicher: "Ich kann Alltagsprobleme mit Mathematik lösen und mein Ergebnis bewerten. Nächster Schritt: Überlege, was dein Modell vereinfacht.",
      },
      'M-K5': {
        worum: "Du stellst Mathematik passend dar: als Tabelle, Graph, Skizze, Term oder Text. Du kannst zwischen diesen Darstellungen wechseln.",
        noch: "Übe eine Darstellung nach der anderen: Lege zu einer Aufgabe eine Tabelle an und zeichne daraus einen Graphen. Achte auf Achsen und Beschriftung.",
        teilweise: "Einzelne Darstellungen gelingen dir schon. Übe den Wechsel: Lies aus einem Graphen Werte ab oder schreibe zu einer Tabelle den passenden Term.",
        sicher: "Ich kann Darstellungen erstellen und zwischen ihnen wechseln. Nächster Schritt: Begründe, welche Darstellung für eine Aufgabe am besten passt.",
      },
      'M-K6': {
        worum: "Du rechnest sicher mit Zahlen, Termen, Gleichungen und Formeln und kennst die Regeln, nach denen das geht.",
        noch: "Übe die Grundlagen in kleinen Schritten: Schreibe jeden Umformungsschritt in eine eigene Zeile und prüfe Ergebnisse durch Einsetzen.",
        teilweise: "Viele Rechnungen gelingen dir schon. Suche deine typischen Fehler (z. B. Vorzeichen, Klammern) und übe genau diese Stellen.",
        sicher: "Ich kann sicher mit Termen und Gleichungen umgehen. Nächster Schritt: Löse Aufgaben, bei denen du mehrere Regeln kombinieren musst.",
      },
      'M-K7': {
        worum: "Du nutzt Hilfsmittel wie Taschenrechner, Geometrie-Software, Tabellenkalkulation oder Lernvideos sinnvoll für Mathematik.",
        noch: "Lerne zuerst die wichtigsten Tasten und Befehle kennen. Schreibe dir auf, welche Eingabe du gemacht hast, und überschlage das Ergebnis im Kopf.",
        teilweise: "Du kannst Hilfsmittel schon nutzen. Übe, Ergebnisse des Rechners zu prüfen, und überlege, wann ein Hilfsmittel wirklich hilft.",
        sicher: "Ich kann digitale Hilfsmittel gezielt einsetzen. Nächster Schritt: Erstelle selbst eine Tabelle oder Zeichnung am Computer, die eine Aufgabe löst.",
      },
      'M-L1': {
        worum: "Es geht um Zahlen und das Rechnen mit ihnen: Brüche, Dezimalzahlen, negative Zahlen, Prozent, Potenzen und Wurzeln.",
        noch: "Wiederhole die Rechenregeln für die Zahlenart, die gerade dran ist, mit einfachen Beispielen. Überschlage vor dem Rechnen, was ungefähr herauskommt.",
        teilweise: "Du rechnest schon vieles richtig. Übe gemischte Aufgaben, bei denen du erst entscheiden musst, welche Regel gilt, und kontrolliere mit einem Überschlag.",
        sicher: "Ich kann sicher mit verschiedenen Zahlen rechnen. Nächster Schritt: Erkläre, warum eine Rechenregel gilt, zum Beispiel an einem Bild.",
      },
      'M-L2': {
        worum: "Es geht um Größen wie Länge, Fläche, Volumen, Zeit, Masse und Geld: messen, schätzen, umrechnen und damit rechnen.",
        noch: "Lerne die Umrechnungszahlen für die Einheiten auswendig und schreibe bei jedem Ergebnis die Einheit dazu. Schätze vorher, was ungefähr herauskommt.",
        teilweise: "Du kannst schon mit Größen rechnen. Übe das Umrechnen bei Flächen und Volumen und prüfe, ob dein Ergebnis realistisch ist.",
        sicher: "Ich kann Größen sicher schätzen, messen und umrechnen. Nächster Schritt: Löse Sachaufgaben, in denen du mehrere Größen verbinden musst.",
      },
      'M-L3': {
        worum: "Es geht um Zusammenhänge zwischen Größen: Zuordnungen, Funktionen, Terme und Gleichungen und wie man sie beschreibt.",
        noch: "Lege zu einem Zusammenhang eine Wertetabelle an und zeichne den Graphen. Beschreibe in einem Satz, was passiert, wenn x größer wird.",
        teilweise: "Du erkennst viele Zusammenhänge schon. Übe, zwischen Tabelle, Graph und Funktionsgleichung zu wechseln und die Bedeutung von Steigung und Achsenabschnitten zu erklären.",
        sicher: "Ich kann funktionale Zusammenhänge beschreiben und nutzen. Nächster Schritt: Stelle zu einer Situation aus dem Alltag selbst eine Funktion auf.",
      },
      'M-L4': {
        worum: "Es geht um Figuren und Körper: erkennen, zeichnen, konstruieren, ihre Eigenschaften nutzen und Flächen und Volumen berechnen.",
        noch: "Zeichne zu jeder Aufgabe eine saubere Skizze und beschrifte sie. Lerne die wichtigsten Formeln mit einem Bild dazu.",
        teilweise: "Du kennst viele Figuren und Formeln. Übe, die passende Formel auszuwählen, und begründe Eigenschaften (z. B. Winkel) an der Zeichnung.",
        sicher: "Ich kann mit Figuren und Körpern sicher umgehen. Nächster Schritt: Zerlege zusammengesetzte Figuren und berechne sie geschickt.",
      },
      'M-L5': {
        worum: "Es geht um Daten und Zufall: Daten sammeln, darstellen und auswerten und Wahrscheinlichkeiten bestimmen.",
        noch: "Übe, Daten in einer Strichliste und einem Diagramm darzustellen. Berechne den Mittelwert Schritt für Schritt.",
        teilweise: "Du kannst Daten schon auswerten. Übe, Diagramme kritisch zu lesen, und bestimme Wahrscheinlichkeiten mit einem Baumdiagramm.",
        sicher: "Ich kann Daten auswerten und Wahrscheinlichkeiten bestimmen. Nächster Schritt: Finde in Zeitungsgrafiken Stellen, die in die Irre führen.",
      },
    },
    'mathe-mss': {
      'MO-K1': {
        worum: "Du begründest mathematische Aussagen schlüssig, prüfst Vermutungen und führst Begründungen über mehrere Schritte.",
        noch: "Formuliere zuerst, was gezeigt werden soll. Schreibe dann jeden Schritt mit Begründung auf (Definition, Satz, Rechenregel) und prüfe an einem Beispiel.",
        teilweise: "Deine Begründungen tragen oft schon. Achte auf Lücken in längeren Argumentationsketten und widerlege falsche Aussagen gezielt mit einem Gegenbeispiel.",
        sicher: "Ich kann mehrschrittige Begründungen sauber führen. Nächster Schritt: Beurteile fremde Argumentationen und verbessere sie.",
      },
      'MO-K2': {
        worum: "Du löst Probleme, für die kein Verfahren vorgegeben ist. Du wählst Strategien, kombinierst Wissen und prüfst den Lösungsweg.",
        noch: "Zerlege das Problem in Teilfragen und notiere, was gegeben und gesucht ist. Erstelle eine Skizze und probiere einen Spezialfall aus.",
        teilweise: "Du findest oft einen Ansatz. Übe, Strategien bewusst zu wechseln (Vorwärts-/Rückwärtsarbeiten, Hilfsgrößen) und den Weg am Ende zu reflektieren.",
        sicher: "Ich kann auch offene Probleme strukturiert lösen. Nächster Schritt: Verallgemeinere deine Lösung oder vergleiche verschiedene Lösungswege.",
      },
      'MO-K3': {
        worum: "Du übersetzt Sachsituationen in mathematische Modelle, arbeitest im Modell und deutest und prüfst die Ergebnisse in der Realität.",
        noch: "Markiere die relevanten Informationen und triff die nötigen Annahmen ausdrücklich. Ordne dann eine passende Funktion oder Gleichung zu.",
        teilweise: "Du stellst Modelle oft schon passend auf. Übe, die Ergebnisse im Sachzusammenhang zu deuten und Grenzen des Modells zu benennen.",
        sicher: "Ich kann Modelle aufstellen, nutzen und kritisch bewerten. Nächster Schritt: Vergleiche zwei Modelle für dieselbe Situation.",
      },
      'MO-K4': {
        worum: "Du nutzt Darstellungen wie Graphen, Tabellen, Diagramme und Skizzen, wählst passende aus und wechselst zwischen ihnen.",
        noch: "Achte bei Graphen und Skizzen auf Achsen, Einheiten und Beschriftung. Übe, Werte und Eigenschaften genau aus einem Graphen abzulesen.",
        teilweise: "Du kannst Darstellungen schon gut lesen. Übe den Wechsel zwischen Funktionsterm, Graph und Tabelle und begründe deine Wahl der Darstellung.",
        sicher: "Ich kann Darstellungen sicher nutzen und wechseln. Nächster Schritt: Beurteile, welche Darstellung einen Sachverhalt am klarsten zeigt.",
      },
      'MO-K5': {
        worum: "Du arbeitest sicher mit Termen, Gleichungen, Formeln und Verfahren und setzt den Taschenrechner (GTR/CAS) sinnvoll ein.",
        noch: "Übe die Grundverfahren (Umformen, Ableiten, Gleichungen lösen) mit kurzen Aufgaben und notiere jeden Schritt. Prüfe Rechnerergebnisse mit einer Probe.",
        teilweise: "Die Verfahren sitzen schon weitgehend. Arbeite gezielt an deinen typischen Fehlern und entscheide bewusst, wann du von Hand oder mit dem Rechner arbeitest.",
        sicher: "Ich kann Verfahren sicher und effizient anwenden. Nächster Schritt: Löse komplexe Aufgaben, die mehrere Verfahren verbinden.",
      },
      'MO-K6': {
        worum: "Du stellst mathematische Überlegungen verständlich und fachsprachlich korrekt dar und verstehst Texte mit mathematischem Inhalt.",
        noch: "Schreibe Lösungen vollständig auf: Ansatz, Rechnung, Ergebnis und Antwortsatz. Lege dir eine Liste der Fachbegriffe mit Bedeutung an.",
        teilweise: "Deine Lösungen sind meist nachvollziehbar. Übe, Fachbegriffe präzise zu verwenden und Ergebnisse knapp im Sachzusammenhang zu formulieren.",
        sicher: "Ich kann mathematische Inhalte klar und präzise darstellen. Nächster Schritt: Präsentiere eine Lösung oder prüfe fremde Darstellungen auf Verständlichkeit.",
      },
      'MO-L1': {
        worum: "Es geht um Zahlen, Näherungsverfahren und Algorithmen, z. B. Grenzwerte, Folgen und schrittweise Lösungsverfahren.",
        noch: "Wiederhole die Grundbegriffe an konkreten Zahlenbeispielen. Führe ein Verfahren zuerst langsam Schritt für Schritt in einer Tabelle durch.",
        teilweise: "Du kannst Verfahren schon anwenden. Übe, zu begründen, warum ein Verfahren funktioniert und wann es an Grenzen stößt.",
        sicher: "Ich kann Algorithmen und Näherungsverfahren sicher nutzen. Nächster Schritt: Beschreibe selbst einen Algorithmus für ein neues Problem.",
      },
      'MO-L2': {
        worum: "Es geht um das Messen im weiteren Sinn: Flächen und Volumen mit Integralen, Längen, Winkel und Abstände, auch im Raum.",
        noch: "Mache dir an einer Skizze klar, welche Fläche oder welcher Abstand gesucht ist. Übe die Formeln und Grundintegrale mit einfachen Beispielen.",
        teilweise: "Du berechnest vieles schon richtig. Übe, Flächen zwischen Graphen und Abstände im Raum sicher aufzustellen und das Ergebnis zu deuten.",
        sicher: "Ich kann Größen mit Integralen und Vektoren sicher bestimmen. Nächster Schritt: Nutze diese Verfahren in Anwendungsaufgaben.",
      },
      'MO-L3': {
        worum: "Es geht um Geometrie im Raum: Punkte, Geraden, Ebenen und Körper mit Vektoren beschreiben und ihre Lage untersuchen.",
        noch: "Zeichne zu jeder Aufgabe eine Skizze im Koordinatensystem. Übe das Aufstellen von Geraden- und Ebenengleichungen aus Punkten.",
        teilweise: "Du kannst Objekte im Raum schon beschreiben. Übe die Untersuchung von Lagebeziehungen und deute dein Rechenergebnis geometrisch.",
        sicher: "Ich kann räumliche Probleme mit Vektoren lösen. Nächster Schritt: Löse Aufgaben, bei denen du den Lösungsweg selbst planen musst.",
      },
      'MO-L4': {
        worum: "Es geht um Funktionen und Änderungen: Graphen untersuchen, Ableitungen und Integrale nutzen und Zusammenhänge beschreiben.",
        noch: "Übe die Ableitungsregeln mit kurzen Aufgaben und skizziere zu jeder Funktion den Graphen. Lerne, was f′ und f″ über den Graphen sagen.",
        teilweise: "Du kannst Funktionen schon untersuchen. Übe, Ergebnisse im Sachzusammenhang zu deuten (Änderungsrate, Bestand) und Funktionen aus Bedingungen aufzustellen.",
        sicher: "Ich kann Funktionen sicher untersuchen und anwenden. Nächster Schritt: Arbeite an Funktionenscharen oder offenen Anwendungsaufgaben.",
      },
      'MO-L5': {
        worum: "Es geht um Daten und Zufall: Wahrscheinlichkeiten berechnen, Verteilungen nutzen und Aussagen über Stichproben prüfen.",
        noch: "Zeichne zu jedem Zufallsexperiment ein Baumdiagramm oder eine Vierfeldertafel. Lerne, wann die Binomialverteilung passt.",
        teilweise: "Du kannst Wahrscheinlichkeiten schon berechnen. Übe, die passende Verteilung zu wählen und Ergebnisse im Sachzusammenhang zu deuten.",
        sicher: "Ich kann stochastische Fragen sicher lösen. Nächster Schritt: Beurteile Aussagen aus Studien oder Medien mithilfe der Stochastik.",
      },
    },
    'chemie-sek1': {
      'C-S1': {
        worum: "Du beschreibst, was man bei Stoffen und Reaktionen sehen, riechen und messen kann, also die Welt, wie sie vor dir liegt.",
        noch: "Beobachte genau und schreibe auf, was du wirklich siehst (Farbe, Geruch, Gas, Wärme), noch ohne Erklärung. Lerne wichtige Stoffeigenschaften.",
        teilweise: "Deine Beobachtungen sind oft genau. Übe, Beobachtung und Erklärung sauber zu trennen und Stoffe anhand ihrer Eigenschaften zu unterscheiden.",
        sicher: "Ich kann Stoffe und Vorgänge genau beschreiben. Nächster Schritt: Ordne deine Beobachtungen einer passenden Erklärung zu.",
      },
      'C-S2': {
        worum: "Du erklärst Stoffe und Reaktionen mit Teilchen: Atome, Ionen und Moleküle und was mit ihnen bei einer Reaktion passiert.",
        noch: "Zeichne zu einem Stoff ein einfaches Teilchenbild. Lerne die Begriffe Atom, Molekül und Ion mit je einem Beispiel.",
        teilweise: "Du kennst die Teilchen schon. Übe, eine Beobachtung mit dem Teilchenmodell zu erklären, z. B. warum sich ein Stoff löst oder schmilzt.",
        sicher: "Ich kann Beobachtungen mit Teilchen erklären. Nächster Schritt: Erkläre damit auch Vorgänge aus deinem Alltag.",
      },
      'C-S3': {
        worum: "Du nutzt die Sprache der Chemie: Formeln, Reaktionsgleichungen, Modelle und Skizzen, um Stoffe und Reaktionen darzustellen.",
        noch: "Lerne die Symbole der wichtigsten Elemente und übe, einfache Formeln zu lesen. Schreibe Reaktionen zuerst als Wortgleichung.",
        teilweise: "Du kannst Formeln schon nutzen. Übe, Reaktionsgleichungen auszugleichen und zwischen Wortgleichung, Formel und Teilchenbild zu wechseln.",
        sicher: "Ich kann Formeln und Reaktionsgleichungen sicher nutzen. Nächster Schritt: Erkläre, was eine Formel über die Teilchen verrät.",
      },
      'C-E1': {
        worum: "Du gewinnst Erkenntnisse mit Experimenten: Frage stellen, Vermutung aufschreiben, Versuch planen, durchführen und auswerten.",
        noch: "Halte dich an den Ablauf: Frage, Vermutung, Durchführung, Beobachtung, Auswertung. Schreibe zu jedem Schritt mindestens einen Satz ins Protokoll.",
        teilweise: "Deine Protokolle sind schon geordnet. Übe, selbst einen Versuch zu planen, der deine Vermutung prüft, und nur eine Größe zu verändern.",
        sicher: "Ich kann Experimente planen, durchführen und auswerten. Nächster Schritt: Finde Fehlerquellen in deinem Versuch und verbessere ihn.",
      },
      'C-E2': {
        worum: "Du nutzt Modelle, um Vorgänge zu erklären und vorherzusagen, und weißt, was ein Modell zeigt und was nicht.",
        noch: "Lerne die Modelle aus dem Unterricht mit einem Bild (z. B. Teilchenmodell, Atommodell). Erkläre in einem Satz, wofür man das Modell nutzt.",
        teilweise: "Du kannst Modelle schon anwenden. Übe, mit einem Modell eine Vorhersage zu machen und zu sagen, wo das Modell an seine Grenzen kommt.",
        sicher: "Ich kann Modelle sicher nutzen und ihre Grenzen nennen. Nächster Schritt: Vergleiche zwei Modelle für denselben Vorgang.",
      },
      'C-E3': {
        worum: "Du denkst über den Weg zur Erkenntnis nach: Wie sicher ist ein Ergebnis? Was spricht dafür? Was könnte es verfälschen?",
        noch: "Überlege nach jedem Versuch: Hat das Ergebnis meine Vermutung bestätigt? Schreibe einen Grund auf, warum das Ergebnis ungenau sein könnte.",
        teilweise: "Du kannst Ergebnisse schon kritisch betrachten. Übe, Messfehler und Störungen genau zu benennen und Verbesserungen vorzuschlagen.",
        sicher: "Ich kann Ergebnisse und Vorgehen kritisch beurteilen. Nächster Schritt: Erkläre, wie man in der Chemie zu neuem Wissen kommt.",
      },
      'C-K1': {
        worum: "Du findest Informationen zu chemischen Fragen in Texten, Tabellen, Diagrammen oder Videos und entnimmst das Wichtige.",
        noch: "Lies einen Text abschnittsweise und markiere die Schlüsselwörter. Schreibe danach die wichtigste Aussage in einem eigenen Satz auf.",
        teilweise: "Du findest wichtige Informationen schon. Übe, Werte aus Tabellen und Diagrammen abzulesen und Quellen auf Verlässlichkeit zu prüfen.",
        sicher: "Ich kann Informationen gezielt finden und auswerten. Nächster Schritt: Vergleiche Informationen aus mehreren Quellen.",
      },
      'C-K2': {
        worum: "Du bereitest Informationen so auf, dass andere sie verstehen: als Tabelle, Diagramm, Skizze, Steckbrief oder Text.",
        noch: "Übe, Messwerte in eine Tabelle mit Überschrift und Einheiten einzutragen. Zeichne daraus ein Diagramm mit beschrifteten Achsen.",
        teilweise: "Deine Darstellungen sind oft schon übersichtlich. Übe, die passende Darstellungsform zu wählen und Fachbegriffe korrekt zu verwenden.",
        sicher: "Ich kann Informationen klar und fachlich richtig darstellen. Nächster Schritt: Gestalte ein Plakat oder eine kurze Präsentation.",
      },
      'C-K3': {
        worum: "Du tauschst dich über Chemie aus: erklären, nachfragen, Argumente austauschen und auf andere eingehen.",
        noch: "Übe, ein Ergebnis in zwei, drei Sätzen mit Fachbegriffen zu erklären. Stelle eine Rückfrage, wenn du etwas nicht verstehst.",
        teilweise: "Du kannst Ergebnisse schon erklären. Übe, deine Meinung mit fachlichen Argumenten zu begründen und auf Einwände einzugehen.",
        sicher: "Ich kann fachlich diskutieren und andere überzeugen. Nächster Schritt: Leite eine Diskussion in der Gruppe.",
      },
      'C-B1': {
        worum: "Du bewertest Sachverhalte und Informationen nach Kriterien, z. B. Gesundheit, Umwelt, Kosten oder Sicherheit.",
        noch: "Lege zu einer Frage eine Tabelle mit Vor- und Nachteilen an. Schreibe dazu, nach welchem Kriterium du jeweils urteilst.",
        teilweise: "Du kannst schon Kriterien nennen. Übe, sie zu gewichten und fachliche Fakten von Meinungen und Werbung zu unterscheiden.",
        sicher: "Ich kann Sachverhalte begründet nach Kriterien bewerten. Nächster Schritt: Bewerte eine aktuelle Nachricht zu einem Chemie-Thema.",
      },
      'C-B2': {
        worum: "Du bildest dir eine eigene Meinung zu Fragen mit Chemie-Bezug und triffst begründete Entscheidungen.",
        noch: "Schreibe deine Meinung als Satz auf und ergänze: „…, weil …“. Nenne mindestens ein fachliches Argument.",
        teilweise: "Deine Meinung ist schon begründet. Übe, verschiedene Möglichkeiten abzuwägen und Gegenargumente in deine Entscheidung einzubeziehen.",
        sicher: "Ich kann Entscheidungen fachlich begründen und abwägen. Nächster Schritt: Vertritt eine Position, die nicht deine eigene ist.",
      },
      'C-B3': {
        worum: "Du denkst über Entscheidungen und ihre Folgen nach: für dich, für andere und für die Umwelt, heute und später.",
        noch: "Überlege bei einer Entscheidung: Wer ist betroffen? Was passiert kurzfristig, was langfristig? Schreibe je eine Folge auf.",
        teilweise: "Du kannst Folgen schon benennen. Übe, sie zu vergleichen und zu überlegen, ob eine Entscheidung überdacht werden sollte.",
        sicher: "Ich kann Folgen von Entscheidungen umfassend reflektieren. Nächster Schritt: Entwickle Vorschläge, wie man es besser machen könnte.",
      },
      'C-BK1': {
        worum: "Es geht darum, woraus Stoffe bestehen und warum sie bestimmte Eigenschaften haben, z. B. Schmelztemperatur oder Löslichkeit.",
        noch: "Lerne zu wichtigen Stoffen einen Steckbrief mit Eigenschaften. Ordne jedem Stoff zu, aus welchen Teilchen er besteht.",
        teilweise: "Du kennst Stoffe und Teilchen schon. Übe, eine Eigenschaft mit dem Aufbau der Teilchen und ihren Bindungen zu erklären.",
        sicher: "Ich kann Eigenschaften von Stoffen mit ihrem Aufbau erklären. Nächster Schritt: Sage die Eigenschaften eines unbekannten Stoffes voraus.",
      },
      'C-BK2': {
        worum: "Es geht um chemische Reaktionen: Aus Ausgangsstoffen entstehen neue Stoffe, die Teilchen ordnen sich neu, und es wird Energie umgesetzt.",
        noch: "Lerne die Merkmale einer chemischen Reaktion (neue Stoffe, Energie). Schreibe zu jedem Versuch die Ausgangsstoffe und die Produkte auf.",
        teilweise: "Du erkennst Reaktionen schon. Übe, sie mit Reaktionsgleichungen und Teilchen zu beschreiben und Reaktionsarten zu unterscheiden.",
        sicher: "Ich kann chemische Reaktionen sicher beschreiben und erklären. Nächster Schritt: Plane, wie man ein bestimmtes Produkt herstellen kann.",
      },
      'C-BK3': {
        worum: "Es geht um Energie bei chemischen Reaktionen: Sie wird frei oder muss zugeführt werden, zum Beispiel als Wärme oder Licht.",
        noch: "Beobachte bei jedem Versuch, ob es wärmer oder kälter wird. Lerne die Begriffe exotherm und endotherm mit je einem Beispiel.",
        teilweise: "Du kannst Energie bei Reaktionen schon beschreiben. Übe, Energiediagramme zu lesen und die Aktivierungsenergie zu erklären.",
        sicher: "Ich kann Energieumsätze bei Reaktionen erklären. Nächster Schritt: Erkläre, wie Energie aus Reaktionen im Alltag genutzt wird.",
      },
    },
  };
  for (const tpl of TEMPLATES) for (const b of tpl.catalog.bereiche) for (const k of b.kompetenzen) {
    const tx = (TEMPLATE_TEXTE[tpl.key] || {})[k.id];
    if (tx) k.texte = Object.assign({}, tx);
  }


  const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const copy = (x) => JSON.parse(JSON.stringify(x));

  // ---------- Bereinigen ----------

  function cleanStufen(s) {
    const o = s && typeof s === 'object' ? s : {};
    let t = Number(o.teilweise);
    let k = Number(o.sicher);
    if (!(t > 0 && t < 100)) t = STUFEN.teilweise;
    if (!(k > 0 && k <= 100)) k = STUFEN.sicher;
    if (!(t < k)) return Object.assign({}, STUFEN);
    return { teilweise: t, sicher: k };
  }

  /** Erklärtexte bereinigen: nur bekannte Felder, getrimmt, gekürzt, ohne leere. null = keine Texte. */
  function cleanTexte(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const out = {};
    for (const k of TEXT_KEYS) {
      const v = typeof o[k] === 'string' ? o[k].replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) : '';
      if (v) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  }

  function cleanEntry(x, seen) {
    if (!x || typeof x !== 'object') return null;
    const id = str(x.id, 32);
    if (!ID_RE.test(id) || seen.has(id)) return null;
    seen.add(id);
    const e = { id, name: str(x.name) || id };
    if (x.ausgeblendet) e.ausgeblendet = true;
    return e;
  }

  /** Katalog bereinigen (beim Öffnen und beim Import). Kaputte oder doppelte Einträge fallen weg. null = kein Katalog. */
  function clean(cat) {
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return null;
    const id = str(cat.id, 64);
    if (!ID_RE.test(id)) return null;
    const seen = new Set(); // Kennungen von Kompetenzen und Teilkompetenzen
    const bseen = new Set();
    const bereiche = [];
    for (const b of Array.isArray(cat.bereiche) ? cat.bereiche : []) {
      if (!b || typeof b !== 'object') continue;
      let bid = str(b.id, 32);
      if (!ID_RE.test(bid) || bseen.has(bid)) bid = newBereichId(bseen);
      bseen.add(bid);
      const kompetenzen = [];
      for (const k of Array.isArray(b.kompetenzen) ? b.kompetenzen : []) {
        const e = cleanEntry(k, seen);
        if (!e) continue;
        const teil = [];
        for (const t of Array.isArray(k.teil) ? k.teil : []) {
          const te = cleanEntry(t, seen);
          if (te) teil.push(te);
        }
        if (teil.length) e.teil = teil;
        const tx = cleanTexte(k.texte);
        if (tx) e.texte = tx;
        kompetenzen.push(e);
      }
      bereiche.push({ id: bid, name: str(b.name) || bid, kompetenzen });
    }
    const v = Math.floor(Number(cat.version));
    const out = { id, name: str(cat.name) || str(cat.fach) || id, fach: str(cat.fach) };
    if (STUFE_IDS.includes(cat.stufe)) out.stufe = cat.stufe; // seit 2.22
    return Object.assign(out, { version: v >= 1 ? v : 1, stufen: cleanStufen(cat.stufen), bereiche });
  }

  function cleanList(list) {
    const out = [];
    const ids = new Set();
    for (const x of Array.isArray(list) ? list : []) {
      const c = clean(x);
      if (c && !ids.has(c.id)) {
        ids.add(c.id);
        out.push(c);
      }
    }
    return out;
  }

  /** Kennungsliste einer Aufgabe bereinigen: nur Texte, ohne Doppelte. */
  function cleanTaskIds(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const x of list) if (typeof x === 'string' && x && !out.includes(x)) out.push(x);
    return out;
  }

  function newBereichId(taken) {
    for (let i = 1; ; i++) if (!taken.has('B' + i)) return 'B' + i;
  }

  // ---------- Lesen ----------

  const catalogs = (db) => (db && db.settings && Array.isArray(db.settings.competencyCatalogs) ? db.settings.competencyCatalogs : []);
  const byId = (db, id) => catalogs(db).find((c) => c.id === id) || null;
  /** Katalog des Kurses oder null. */
  const forCourse = (db, course) => (course && course.catalogId ? byId(db, course.catalogId) : null);

  /**
   * Alle Einträge flach, in Katalogreihenfolge:
   * [{ id, name, level: 'komp'|'teil', parent (Kennung der Kompetenz bei Teilen), bereich, hidden }]
   * hidden: selbst ausgeblendet oder Teil einer ausgeblendeten Kompetenz.
   */
  function entries(cat) {
    const out = [];
    if (!cat) return out;
    for (const b of cat.bereiche || []) {
      for (const k of b.kompetenzen || []) {
        out.push({ id: k.id, name: k.name, level: 'komp', parent: null, bereich: b.id, hidden: !!k.ausgeblendet });
        for (const t of k.teil || []) out.push({ id: t.id, name: t.name, level: 'teil', parent: k.id, bereich: b.id, hidden: !!k.ausgeblendet || !!t.ausgeblendet });
      }
    }
    return out;
  }

  const find = (cat, id) => entries(cat).find((e) => e.id === id) || null;

  /** Rohes Objekt (Kompetenz oder Teil) und seine Liste im Katalog, zum Bearbeiten. */
  function locate(cat, id) {
    for (const b of (cat && cat.bereiche) || []) {
      for (const k of b.kompetenzen) {
        if (k.id === id) return { obj: k, list: b.kompetenzen, bereich: b, parent: null };
        for (const t of k.teil || []) if (t.id === id) return { obj: t, list: k.teil, bereich: b, parent: k };
      }
    }
    return null;
  }

  /** Erklärtexte einer Kompetenz ({} ohne Texte oder für Teilkompetenzen). */
  function texteOf(cat, id) {
    const loc = locate(cat, id);
    return (loc && !loc.parent && loc.obj.texte) || {};
  }

  /** Einen Erklärtext setzen (leer = entfernen). Gibt den gespeicherten Text zurück. */
  function setText(cat, id, key, value) {
    const loc = locate(cat, id);
    if (!loc || loc.parent || !TEXT_KEYS.includes(key)) return '';
    const tx = cleanTexte(Object.assign({}, loc.obj.texte, { [key]: String(value || '') }));
    if (tx) loc.obj.texte = tx;
    else delete loc.obj.texte;
    return (tx && tx[key]) || '';
  }

  /** Wie viele der vier Erklärtexte gesetzt sind. */
  const textCount = (cat, id) => Object.keys(texteOf(cat, id)).length;

  /** Kurze Anzeige einer Kennung: ohne Fachvorsatz („M-K2“ → „K2“). */
  const short = (id) => (/^[^-]+-./.test(id) ? id.slice(id.indexOf('-') + 1) : id);

  /** Kurse, die den Katalog verwenden. */
  const coursesUsing = (db, catId) => ((db && db.courses) || []).filter((c) => c.catalogId === catId);

  /** Alle Aufgaben aller Tests der Kurse, die den Katalog verwenden. */
  function tasksUsing(db, catId) {
    const out = [];
    for (const c of coursesUsing(db, catId)) for (const a of c.assessments || []) if (a.kind === 'test' && a.test) for (const t of a.test.tasks || []) out.push(t);
    return out;
  }

  /** Kennungen, die in Aufgaben vorkommen (in Kursen mit diesem Katalog). */
  function usedIds(db, catId) {
    const s = new Set();
    for (const t of tasksUsing(db, catId)) for (const id of t.competencies || []) s.add(id);
    return s;
  }

  /** Wie oft ist die Kennung an Aufgaben vergeben? */
  const useCount = (db, catId, id) => tasksUsing(db, catId).filter((t) => (t.competencies || []).includes(id)).length;

  // ---------- Fach → Katalog ----------

  function normFach(f) {
    return String(f || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Passt der Fachtext eines Kurses zum Fach eines Katalogs? „Mathe“ ~ „Mathematik“ (Anfang ab 4 Zeichen). */
  function fachMatches(a, b) {
    const x = normFach(a);
    const y = normFach(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const [s, l] = x.length <= y.length ? [x, y] : [y, x];
    return s.length >= 4 && l.startsWith(s);
  }

  /**
   * Bester Treffer zum Fach und zur Stufe: zuerst genau die Stufe, dann ohne Stufe (gilt für beide);
   * Einträge einer anderen Stufe nie. Nur eindeutig, sonst null. get(x) liefert den Katalog eines Eintrags.
   */
  function pickFor(list, get, fach, level) {
    const hits = list.filter((x) => fachMatches(fach, get(x).fach) || fachMatches(fach, get(x).name));
    const tiers = level ? [hits.filter((x) => get(x).stufe === level), hits.filter((x) => !get(x).stufe)] : [hits.filter((x) => !get(x).stufe), hits];
    for (const t of tiers) if (t.length) return t.length === 1 ? t[0] : null;
    return null;
  }

  /** Katalog-id zum Fach (und zur Kursstufe 'sek1' | 'mss', seit 2.22) oder null (nur bei genau einem passenden Katalog). */
  function guessForFach(db, fach, level) {
    const hit = pickFor(catalogs(db), (c) => c, fach, level);
    return hit ? hit.id : null;
  }

  /**
   * Katalogangebot für einen Kurs ohne Katalog (2.21, PLANUNG.md AQ-1): ein vorhandener Katalog zum Fach und zur Stufe,
   * sonst eine passende Vorlage; ein vorhandener Katalog ohne Stufe erst, wenn es keine Vorlage genau für die Stufe gibt.
   * null, wenn der Kurs schon einen Katalog hat, „Nicht jetzt“ gewählt wurde (course.catalogHintOff) oder nichts eindeutig passt.
   * @returns { catalogId, name } | { templateKey, name } | null
   */
  function offerFor(db, course) {
    if (!course || course.catalogId || course.catalogHintOff === true || !str(course.fach)) return null;
    const level = courseLevel(course);
    const cats = catalogs(db);
    const tpls = TEMPLATES.map((t) => Object.assign({ key: t.key }, t.catalog));
    const steps = [
      [cats, (c) => c.stufe === level],
      [tpls, (c) => c.stufe === level],
      [cats, (c) => !c.stufe],
      [tpls, (c) => !c.stufe],
    ];
    for (const [list, ok] of steps) {
      const hit = pickFor(list.filter(ok), (c) => c, course.fach, level);
      if (hit) return list === cats ? { catalogId: hit.id, name: hit.name } : { templateKey: hit.key, name: hit.name };
    }
    return null;
  }

  /** Stufe eines Kurses ('sek1' | 'mss'); ohne NM.grades (Testseite) 'sek1'. */
  const courseLevel = (course) => (NM.grades && NM.grades.courseLevel ? NM.grades.courseLevel(course) : Number(course.jahrgang) >= 11 ? 'mss' : 'sek1');

  /**
   * Kataloge ohne Stufe, die aus einer Vorlage stammen (Kennung = Vorlage oder „Vorlage-2“ …), bekommen deren Stufe.
   * Sonst böte die App für einen Sek-I-Kurs die Vorlage noch einmal an, obwohl die Kopie schon da ist (2.22, migrate).
   */
  /** Vorlage, von der ein Katalog stammt (Kennung = Vorlage oder Vorlage plus „-N“), sonst null. */
  const templateOf = (c) => TEMPLATES.find((x) => c.id === x.key || (c.id.startsWith(x.key + '-') && /^\d+$/.test(c.id.slice(x.key.length + 1)))) || null;

  function fillTemplateStufe(db) {
    for (const c of catalogs(db)) {
      if (c.stufe) continue;
      const t = templateOf(c);
      if (t && t.catalog.stufe) c.stufe = t.catalog.stufe;
    }
  }

  /**
   * Erklärtexte der Vorlage in Kopien nachtragen (seit 2.25, PLANUNG AR 5): nur Kompetenzen mit gleicher Kennung,
   * nur leere Felder. Eigene Texte werden nie überschrieben. Gibt die Zahl der ergänzten Texte zurück.
   */
  function fillTemplateTexte(db) {
    let n = 0;
    for (const c of catalogs(db)) {
      const t = templateOf(c);
      if (!t) continue;
      for (const b of c.bereiche || []) {
        for (const k of b.kompetenzen || []) {
          const tx = (TEMPLATE_TEXTE[t.key] || {})[k.id];
          if (!tx) continue;
          const own = Object.assign({}, k.texte);
          for (const key of TEXT_KEYS) if (!own[key] && tx[key]) (own[key] = tx[key]), n++;
          k.texte = cleanTexte(own) || undefined;
          if (!k.texte) delete k.texte;
        }
      }
    }
    return n;
  }

  /** Angebot annehmen: Katalog am Kurs setzen, aus der Vorlage bei Bedarf erst anlegen. Gibt den Katalog zurück. */
  function takeOffer(db, course, offer) {
    const cat = offer.catalogId ? byId(db, offer.catalogId) : addFromTemplate(db, offer.templateKey);
    course.catalogId = cat.id;
    delete course.catalogHintOff;
    return cat;
  }

  // ---------- Ändern ----------

  /** Freie Katalog-id aus einem Wunsch („mathe-sek1“, sonst „mathe-sek1-2“, …). */
  function freeCatalogId(db, wish) {
    const base = ID_RE.test(wish || '') ? wish : 'katalog';
    const taken = new Set(catalogs(db).map((c) => c.id));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }

  /** Neuen Katalog aus einer Vorlage anlegen und anhängen. */
  function addFromTemplate(db, key) {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) throw new Error('Diese Vorlage gibt es nicht.');
    const cat = copy(tpl.catalog);
    cat.id = freeCatalogId(db, cat.id);
    db.settings.competencyCatalogs.push(cat);
    return cat;
  }

  /** Leeren Katalog anlegen und anhängen. */
  function addEmpty(db, name, fach) {
    const cat = clean({ id: freeCatalogId(db, 'katalog'), name: name || 'Neuer Katalog', fach: fach || '', version: 1, bereiche: [{ id: 'B1', name: 'Bereich 1', kompetenzen: [] }] });
    db.settings.competencyCatalogs.push(cat);
    return cat;
  }

  /** Nach jeder Änderung am Katalog aufrufen. */
  const bump = (cat) => {
    cat.version = (Number(cat.version) || 0) + 1;
  };

  /** Alle Kennungen im Katalog (Kompetenzen und Teile). */
  const allIds = (cat) => new Set(entries(cat).map((e) => e.id));

  /** Vorschlag für eine neue Kennung: Vorsatz der Nachbarn plus nächste Nummer („M-K8“, „M-K2.3“). */
  function suggestId(cat, bereich, parent) {
    const taken = allIds(cat);
    const siblings = parent ? (parent.teil || []).map((t) => t.id) : bereich.kompetenzen.map((k) => k.id);
    let stem;
    if (parent) stem = parent.id + '.';
    else {
      const m = siblings.length && /^(.*?)(\d+)$/.exec(siblings[siblings.length - 1]);
      stem = m ? m[1] : (bereich.id || 'K') + '';
    }
    for (let i = 1; ; i++) if (!taken.has(stem + i)) return stem + i;
  }

  function addKompetenz(cat, bereichId) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b) return null;
    const k = { id: suggestId(cat, b, null), name: 'Neue Kompetenz' };
    b.kompetenzen.push(k);
    bump(cat);
    return k;
  }

  /** Kompetenz mit vorgegebener Kennung aufnehmen (z. B. aus einer Begleitdatei); Bezeichnung = Kennung. null, wenn ungültig oder vergeben. */
  function addWithId(cat, bereichId, id) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b || !ID_RE.test(String(id || '')) || allIds(cat).has(id)) return null;
    const k = { id, name: id };
    b.kompetenzen.push(k);
    bump(cat);
    return k;
  }

  function addTeil(cat, kompId) {
    const loc = locate(cat, kompId);
    if (!loc || loc.parent) return null;
    const k = loc.obj;
    k.teil = k.teil || [];
    const t = { id: suggestId(cat, loc.bereich, k), name: 'Neue Teilkompetenz' };
    k.teil.push(t);
    bump(cat);
    return t;
  }

  function addBereich(cat) {
    const b = { id: newBereichId(new Set(cat.bereiche.map((x) => x.id))), name: 'Neuer Bereich', kompetenzen: [] };
    cat.bereiche.push(b);
    bump(cat);
    return b;
  }

  /**
   * Kennung ändern. Nur erlaubt, solange keine Aufgabe sie trägt. Teile behalten ihre eigene Kennung.
   * @returns Fehlertext oder '' bei Erfolg
   */
  function renameId(db, cat, oldId, newId) {
    const id = String(newId || '').trim();
    if (id === oldId) return '';
    if (!ID_RE.test(id)) return 'Kennung: nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich, höchstens 32 Zeichen, am Anfang ein Buchstabe oder eine Ziffer.';
    if (allIds(cat).has(id)) return `Die Kennung „${id}“ gibt es in diesem Katalog schon.`;
    if (useCount(db, cat.id, oldId)) return `„${oldId}“ ist schon an Aufgaben vergeben und bleibt deshalb fest.`;
    const loc = locate(cat, oldId);
    if (!loc) return 'Diesen Eintrag gibt es nicht.';
    loc.obj.id = id;
    bump(cat);
    return '';
  }

  /** Ist der Eintrag (oder einer seiner Teile) an Aufgaben vergeben? */
  function inUse(db, cat, id) {
    const loc = locate(cat, id);
    if (!loc) return false;
    const ids = [id].concat(loc.parent ? [] : (loc.obj.teil || []).map((t) => t.id));
    const used = usedIds(db, cat.id);
    return ids.some((x) => used.has(x));
  }

  /** Unbenutzten Eintrag löschen (mit seinen Teilen). @returns true, wenn gelöscht */
  function removeEntry(db, cat, id) {
    if (inUse(db, cat, id)) return false;
    const loc = locate(cat, id);
    if (!loc) return false;
    loc.list.splice(loc.list.indexOf(loc.obj), 1);
    if (loc.parent && !loc.parent.teil.length) delete loc.parent.teil;
    bump(cat);
    return true;
  }

  /** Eintrag aus- oder einblenden. */
  function setHidden(cat, id, hidden) {
    const loc = locate(cat, id);
    if (!loc) return;
    if (hidden) loc.obj.ausgeblendet = true;
    else delete loc.obj.ausgeblendet;
    bump(cat);
  }

  /** Bereich löschen, wenn keine seiner Kennungen benutzt ist. */
  function removeBereich(db, cat, bereichId) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b) return false;
    const used = usedIds(db, cat.id);
    if (b.kompetenzen.some((k) => used.has(k.id) || (k.teil || []).some((t) => used.has(t.id)))) return false;
    cat.bereiche.splice(cat.bereiche.indexOf(b), 1);
    bump(cat);
    return true;
  }

  /** Katalog löschen, wenn kein Kurs ihn verwendet. */
  function removeCatalog(db, catId) {
    if (coursesUsing(db, catId).length) return false;
    db.settings.competencyCatalogs = catalogs(db).filter((c) => c.id !== catId);
    return true;
  }

  /** Kennung an einer Aufgabe setzen oder entfernen. */
  function toggleTask(task, id, on) {
    const list = cleanTaskIds(task.competencies);
    const has = list.includes(id);
    if (on && !has) list.push(id);
    if (!on && has) list.splice(list.indexOf(id), 1);
    if (list.length) task.competencies = list;
    else delete task.competencies;
  }

  // ---------- Austauschdatei ----------

  /** Katalog als JSON-Text der Austauschdatei. */
  function exportJson(cat) {
    return JSON.stringify(Object.assign({ format: FORMAT, formatVersion: FORMAT_VERSION }, copy(cat)), null, 2) + '\n';
  }

  /** Dateiname für den Export. */
  const exportName = (cat) => `Kompetenzkatalog – ${String(cat.name || cat.id).replace(/[\\/:*?"<>|]/g, '_')}.json`;

  /**
   * Austauschdatei lesen. Wirft Error mit deutschem Text, wenn das Format nicht passt.
   * @returns bereinigter Katalog (noch nicht in der Datenbank)
   */
  function parseImport(text) {
    let x;
    try {
      x = JSON.parse(String(text || '').replace(/^﻿/, ''));
    } catch (e) {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    if (!x || x.format !== FORMAT) throw new Error('Die Datei ist kein Kompetenzkatalog (Formatkennung fehlt).');
    if (Number(x.formatVersion) !== FORMAT_VERSION) throw new Error(`Diese Katalogdatei hat Formatversion ${x.formatVersion}; diese App kennt Version ${FORMAT_VERSION}. Bitte OrdoNota aktualisieren.`);
    const cat = clean(x);
    if (!cat) throw new Error('Der Katalog hat keine gültige Kennung (id).');
    if (!entries(cat).length) throw new Error('Der Katalog enthält keine Kompetenzen.');
    return cat;
  }

  /**
   * Importierten Katalog übernehmen. mode: 'new' (als neuer Katalog, id wird frei gemacht) oder 'replace'
   * (ersetzt den Katalog mit derselben id; nur wenn keine benutzte Kennung verloren geht).
   * @returns { cat, missing: [Kennungen, die fehlen würden] } – bei missing.length wurde nichts ersetzt
   */
  function applyImport(db, cat, mode) {
    const list = db.settings.competencyCatalogs;
    const old = byId(db, cat.id);
    if (mode === 'replace' && old) {
      const have = allIds(cat);
      const missing = [...usedIds(db, old.id)].filter((id) => !have.has(id));
      if (missing.length) return { cat: old, missing };
      cat.version = Math.max(Number(cat.version) || 1, (Number(old.version) || 0) + 1);
      list[list.indexOf(old)] = cat;
      return { cat, missing: [] };
    }
    cat.id = freeCatalogId(db, cat.id);
    list.push(cat);
    return { cat, missing: [] };
  }

  // ---------- Punkte je Kompetenz ----------

  /**
   * Mögliche Punkte je Kennung über eine Liste von Aufgaben. Bonusaufgaben zählen mit (PLANUNG AI, 12).
   * Eine Kompetenz zählt auch die Aufgaben ihrer Teile (jede Aufgabe einmal).
   * @returns Map Kennung → Punkte
   */
  function pointsPer(cat, tasks) {
    const out = new Map();
    const parentOf = new Map(entries(cat).filter((e) => e.level === 'teil').map((e) => [e.id, e.parent]));
    for (const t of tasks || []) {
      const max = Number(t.max) || 0;
      const ids = new Set();
      for (const id of t.competencies || []) {
        ids.add(id);
        if (parentOf.has(id)) ids.add(parentOf.get(id));
      }
      for (const id of ids) out.set(id, (out.get(id) || 0) + max);
    }
    return out;
  }

  // ---------- Auswertung je Person (seit 2.11, PLANUNG AI 8–10) ----------
  // Nichts wird gespeichert: alles aus den Tests des Kurses berechnet.

  // Status, bei denen eine Person in einem Test (oder Teil) bei den Kompetenzen nicht zählt
  const SKIP_STATUS = new Set(['fehlt', 'nachschreiben', 'taeuschung']);

  /** Stufe zu einem Prozentwert: 'sicher' | 'teilweise' | 'noch' (Grenzen aus dem Katalog). */
  function stufeOf(cat, pct) {
    const s = Object.assign({}, STUFEN, (cat && cat.stufen) || {});
    if (pct >= s.sicher) return 'sicher';
    if (pct >= s.teilweise) return 'teilweise';
    return 'noch';
  }

  /** Ist der Test ein Kompetenztest? Nicht gewertet und mindestens eine Aufgabe mit Kompetenz. */
  function isCompetencyTest(a) {
    return !!a && a.kind === 'test' && !!a.ungraded && !!a.test && (a.test.tasks || []).some((t) => (t.competencies || []).length > 0);
  }

  /** Trägt der Test mindestens eine Kompetenz? */
  const testHasCompetencies = (a) => !!a && a.kind === 'test' && !!a.test && (a.test.tasks || []).some((t) => (t.competencies || []).length > 0);

  /** Kennungen einer Aufgabe auf Kompetenzebene (Teil → Kompetenz darüber), nur bekannte, jede einmal. */
  function taskKomps(task, toKomp) {
    const out = new Set();
    for (const id of task.competencies || []) if (toKomp.has(id)) out.add(toKomp.get(id));
    return out;
  }

  /**
   * Kompetenzstand aller Personen eines Kurses in einem Zeitraum.
   * @param halves Liste der Halbjahre (z. B. ['HJ1'] oder ['HJ1','HJ2'] für das Schuljahr)
   * @param sids  Personen-ids
   * @returns {
   *   cols: Einträge (Ebene Kompetenz) mit Aufgaben im Zeitraum, in Katalogreihenfolge,
   *   missing: sichtbare Kompetenzen ohne Aufgabe im Zeitraum,
   *   tests: Anzahl Tests mit Kompetenzen,
   *   cell(sid, id) → { got, max, pct, stufe, few, tests } | null }
   * Regeln: Punkte je Kompetenz summiert (erreicht ÷ möglich), eine Aufgabe zählt bei jeder ihrer
   * Kompetenzen voll, Bonusaufgaben zählen mit. Ein Nachschreibtermin zählt mit seinen eigenen Punkten
   * (G.countingFor). „fehlt“, „nachschreiben“ und „Täuschung“ zählen nicht (bei getrennt bewerteten Teilen
   * je Teil); „nicht gewertet“ zählt. Hat die Person im Test (Teil) gar keine Punkte, zählt er nicht;
   * sonst zählt eine leere Aufgabe mit 0 Punkten.
   */
  function evaluate(cat, course, halves, sids) {
    const { all, toKomp, tests } = prepare(cat, course, halves);
    const G = NM.grades;
    // Spalten: Kompetenzen, die im Zeitraum an einer Aufgabe hängen (Original oder Nachschreibtermin)
    const withTasks = new Set();
    for (const a of tests) {
      for (const x of [a, ...G.makeupsOf(course, a)]) for (const t of x.test.tasks || []) for (const id of taskKomps(t, toKomp)) withTasks.add(id);
    }
    const komps = all.filter((e) => e.level === 'komp');
    const cols = komps.filter((e) => withTasks.has(e.id));
    const missing = komps.filter((e) => !e.hidden && !withTasks.has(e.id));
    const data = new Map();
    for (const sid of sids) {
      const per = new Map();
      for (const it of items(course, tests, toKomp, sid)) {
        const c = per.get(it.komp) || { got: 0, max: 0, tests: new Set() };
        c.got += it.got;
        c.max += it.max;
        c.tests.add(it.testId);
        per.set(it.komp, c);
      }
      data.set(sid, per);
    }
    const cell = (sid, id) => sumCell(cat, (data.get(sid) || new Map()).get(id));
    /** Kurszeile: wie viele Personen mit Punkten in der Kompetenz sicher / teilweise / noch nicht sind. */
    function dist(id) {
      const out = { sicher: 0, teilweise: 0, noch: 0, n: 0 };
      for (const sid of sids) {
        const c = cell(sid, id);
        if (!c) continue;
        out[c.stufe]++;
        out.n++;
      }
      return out;
    }
    return { cols, missing, tests: tests.length, cell, dist };
  }

  /** Katalog flach, Teil → Kompetenz und die Tests (ohne Nachschreibtermine) mit Kompetenzen im Zeitraum. */
  function prepare(cat, course, halves) {
    const G = NM.grades;
    const all = entries(cat);
    const toKomp = new Map(all.map((e) => [e.id, e.level === 'teil' ? e.parent : e.id]));
    const tests = ((course && course.assessments) || []).filter((a) => a.kind === 'test' && a.test && halves.includes(a.half) && !G.isMakeup(course, a) && testHasCompetencies(a));
    return { all, toKomp, tests };
  }

  const entered = (v) => v !== null && v !== undefined && v !== '';

  /**
   * Punkte einer Person je Test und Kompetenz: [{ testId, src (gezählter Termin), komp, got, max }],
   * ein Eintrag je Test und Kompetenz. Regeln siehe evaluate.
   * @param own true: genau diese Tests (ohne Nachschreibtermin an ihrer Stelle), z. B. für die Moodle-Rückmeldung
   */
  function items(course, tests, toKomp, sid, own = false) {
    const G = NM.grades;
    const out = [];
    for (const a of tests) {
      const src = own ? a : G.countingFor(course, a, sid);
      const test = src.test;
      const r = (test.results || {})[sid];
      if (!r || SKIP_STATUS.has(r.status)) continue;
      const scores = r.scores || {};
      const sep = G.separateParts(test);
      const per = new Map();
      // Gruppen: getrennt bewertete Teile einzeln, sonst der ganze Test
      const groups = sep ? G.taskGroups(test) : [{ part: null, tasks: test.tasks || [] }];
      for (const { part, tasks } of groups) {
        if (part && SKIP_STATUS.has((r.partStatus || {})[part.id])) continue;
        if (!tasks.some((t) => entered(scores[t.id]))) continue;
        for (const t of tasks) {
          const ids = taskKomps(t, toKomp);
          if (!ids.size) continue;
          const got = entered(scores[t.id]) ? Number(scores[t.id]) || 0 : 0;
          const max = Number(t.max) || 0;
          for (const id of ids) {
            const c = per.get(id) || { testId: a.id, src, komp: id, got: 0, max: 0 };
            c.got += got;
            c.max += max;
            per.set(id, c);
          }
        }
      }
      out.push(...per.values());
    }
    return out;
  }

  /** Summe { got, max, tests? } → Zelle { got, max, pct, stufe, few, tests } oder null ohne mögliche Punkte. */
  function sumCell(cat, c) {
    if (!c || c.max <= 0) return null;
    const pct = Math.round((c.got / c.max) * 100);
    const tests = c.tests instanceof Set ? c.tests.size : c.tests || 0;
    return { got: Math.round(c.got * 100) / 100, max: Math.round(c.max * 100) / 100, pct, stufe: stufeOf(cat, pct), few: c.max < FEW_POINTS, tests };
  }

  const byDate = (x, y) => String(x.date || '9999').localeCompare(String(y.date || '9999')) || String(x.name).localeCompare(String(y.name), 'de');

  /** Ein Punkt der Verlaufslinie (ein Test, eine Kompetenz). */
  function point(cat, course, it) {
    const pct = it.max > 0 ? Math.round((it.got / it.max) * 100) : 0;
    const makeup = NM.grades.isMakeup(course, it.src);
    return { testId: it.testId, name: it.src.name || '', date: it.src.date || '', makeup, got: Math.round(it.got * 100) / 100, max: Math.round(it.max * 100) / 100, pct, stufe: stufeOf(cat, pct) };
  }

  /**
   * Verlauf einer Person im Kurs (seit 2.12, PLANUNG AI 11): je Kompetenz mit Punkten im Zeitraum
   * die Tests nach Datum (Prozent in diesem Test) und der Stand wie in evaluate.
   * @returns [{ entry, points: [{ testId, name, date, makeup, got, max, pct, stufe }], total }] in Katalogreihenfolge
   */
  function history(cat, course, halves, sid) {
    const { all, toKomp, tests } = prepare(cat, course, halves);
    const list = items(course, tests, toKomp, sid).filter((it) => it.max > 0);
    return all
      .filter((e) => e.level === 'komp')
      .map((entry) => {
        const mine = list.filter((it) => it.komp === entry.id);
        if (!mine.length) return null;
        const points = mine.map((it) => point(cat, course, it)).sort(byDate);
        const total = sumCell(cat, mine.reduce((s, it) => ({ got: s.got + it.got, max: s.max + it.max, tests: s.tests + 1 }), { got: 0, max: 0, tests: 0 }));
        return { entry, points, total };
      })
      .filter(Boolean);
  }

  /**
   * Verlauf einer Person über alle Kurse und Schuljahre (Personenregister), getrennt je Katalog.
   * @param list Kurseinträge der Person [{ course, student }] (NM.people.entries)
   * @returns [{ cat, years: [{ id, name }] (alt → neu, nur mit Punkten),
   *            rows: [{ entry, points: [… , course, yearId], perYear: { yearId: Zelle } }] }]
   * Kurse ohne Katalog fallen weg. Mehrere Kurse eines Schuljahrs im selben Katalog zählen zusammen.
   */
  function personHistory(db, list) {
    const G = NM.grades;
    const order = (db.years || []).map((y) => y.id);
    const out = new Map();
    for (const { course, student } of list || []) {
      const cat = forCourse(db, course);
      if (!cat) continue;
      const { all, toKomp, tests } = prepare(cat, course, G.halvesFor(course));
      const its = items(course, tests, toKomp, student.id).filter((it) => it.max > 0);
      if (!its.length) continue;
      const g = out.get(cat.id) || { cat, all, years: new Set(), per: new Map() };
      g.years.add(course.yearId);
      for (const it of its) {
        const p = Object.assign(point(cat, course, it), { course, yearId: course.yearId });
        const r = g.per.get(it.komp) || { points: [], sums: new Map() };
        r.points.push(p);
        const s = r.sums.get(course.yearId) || { got: 0, max: 0, tests: 0 };
        s.got += it.got;
        s.max += it.max;
        s.tests++;
        r.sums.set(course.yearId, s);
        g.per.set(it.komp, r);
      }
      out.set(cat.id, g);
    }
    const yearSort = (a, b) => order.indexOf(a) - order.indexOf(b);
    return [...out.values()].map((g) => {
      const years = [...g.years].sort(yearSort).map((id) => ({ id, name: ((db.years || []).find((y) => y.id === id) || {}).name || '' }));
      const rows = g.all
        .filter((e) => e.level === 'komp' && g.per.has(e.id))
        .map((entry) => {
          const r = g.per.get(entry.id);
          const perYear = {};
          for (const [y, s] of r.sums) perYear[y] = sumCell(g.cat, s);
          // nach Schuljahr, darin nach Datum
          const points = r.points.sort((x, y) => yearSort(x.yearId, y.yearId) || byDate(x, y));
          return { entry, points, perYear };
        });
      return { cat: g.cat, years, rows };
    });
  }

  // ---------- Für Schüler und Förderplan (seit 2.13, PLANUNG AI 13–14) ----------

  /**
   * Kompetenzbogen einer Person im Kurs: Stand je Kompetenz im Zeitraum, getrennt in
   * „Das kannst du schon“ (sicher) und „Daran arbeitest du weiter“ (teilweise, noch nicht).
   * @returns { kann: [{ entry, bereich, stufe, texte, last }], weiter: [...] } in Katalogreihenfolge
   *   texte: Erklärtexte der Kompetenz (seit 2.24), last: { name, tasks: [Aufgabennamen] } aus dem letzten Test im Zeitraum
   */
  function sheet(cat, course, halves, sid) {
    const names = new Map(((cat && cat.bereiche) || []).map((b) => [b.id, b.name || '']));
    const out = { kann: [], weiter: [] };
    const last = lastTasks(cat, course, halves, sid);
    for (const r of history(cat, course, halves, sid)) {
      const x = { entry: r.entry, bereich: names.get(r.entry.bereich) || '', stufe: r.total.stufe, texte: texteOf(cat, r.entry.id), last: last.get(r.entry.id) || null };
      (x.stufe === 'sicher' ? out.kann : out.weiter).push(x);
    }
    return out;
  }

  /**
   * Letzter Test im Zeitraum je Kompetenz (seit 2.24, PLANUNG AR 7): Name des gezählten Termins und die
   * Aufgaben dieses Termins, die die Kompetenz (oder einen ihrer Teile) tragen.
   * @returns Map Kennung → { name, tasks: [Namen] }
   */
  function lastTasks(cat, course, halves, sid) {
    const { toKomp, tests } = prepare(cat, course, halves);
    const best = new Map();
    for (const it of items(course, tests, toKomp, sid)) {
      if (!(it.max > 0)) continue;
      const prev = best.get(it.komp);
      if (prev && byDate(prev.src, it.src) > 0) continue;
      best.set(it.komp, it);
    }
    const out = new Map();
    for (const [komp, it] of best) {
      const tasks = (it.src.test.tasks || []).filter((t) => taskKomps(t, toKomp).has(komp)).map((t) => t.name || '').filter(Boolean);
      out.set(komp, { name: it.src.name || '', tasks });
    }
    return out;
  }

  /**
   * Kompetenzen eines einzelnen Tests (oder Nachschreibtermins) für eine Person, nur mit den Punkten
   * dieses Tests. Regeln wie evaluate (Status, leere Aufgaben).
   * @returns [{ entry, got, max, pct, stufe }] in Katalogreihenfolge, leer ohne Katalog oder Punkte
   */
  function testCompetencies(cat, course, a, sid) {
    if (!cat || !testHasCompetencies(a)) return [];
    const all = entries(cat);
    const toKomp = new Map(all.map((e) => [e.id, e.level === 'teil' ? e.parent : e.id]));
    const per = new Map(items(course, [a], toKomp, sid, true).filter((it) => it.max > 0).map((it) => [it.komp, it]));
    return all
      .filter((e) => e.level === 'komp' && per.has(e.id))
      .map((entry) => {
        const it = per.get(entry.id);
        const c = sumCell(cat, it);
        return { entry, got: c.got, max: c.max, pct: c.pct, stufe: c.stufe };
      });
  }

  /**
   * Hinweis im Förderplan: Kompetenzen mit Stand „noch nicht“ im Schuljahr, über alle Kurse der Person.
   * @param list Kurseinträge der Person [{ course, student }]
   * @returns [{ entry, cat, fach }] je Katalog in Katalogreihenfolge
   */
  function openGaps(db, list, yearId) {
    const out = [];
    for (const g of personHistory(db, (list || []).filter((x) => x.course.yearId === yearId))) {
      for (const r of g.rows) {
        const c = r.perYear[yearId];
        if (c && c.stufe === 'noch') out.push({ entry: r.entry, cat: g.cat, fach: g.cat.fach || g.cat.name || '' });
      }
    }
    return out;
  }

  /** Templates für die Prüfung gegen vorlagen/*.json (Test). */
  const templateFile = (key) => {
    const tpl = TEMPLATES.find((t) => t.key === key);
    return tpl ? exportJson(tpl.catalog) : null;
  };

  NM.competencies = {
    FORMAT,
    FORMAT_VERSION,
    STUFEN,
    TEXT_KEYS,
    TEXT_MAX,
    STUFE_IDS,
    FEW_POINTS,
    TEMPLATES,
    ID_RE,
    clean,
    cleanList,
    cleanTaskIds,
    catalogs,
    byId,
    forCourse,
    entries,
    find,
    locate,
    texteOf,
    setText,
    textCount,
    short,
    coursesUsing,
    usedIds,
    useCount,
    inUse,
    fachMatches,
    guessForFach,
    offerFor,
    fillTemplateStufe,
    fillTemplateTexte,
    takeOffer,
    addFromTemplate,
    addEmpty,
    addKompetenz,
    addWithId,
    addTeil,
    addBereich,
    bump,
    renameId,
    removeEntry,
    removeBereich,
    removeCatalog,
    setHidden,
    toggleTask,
    exportJson,
    exportName,
    parseImport,
    applyImport,
    pointsPer,
    stufeOf,
    isCompetencyTest,
    testHasCompetencies,
    evaluate,
    sheet,
    lastTasks,
    testCompetencies,
    openGaps,
    history,
    personHistory,
    templateFile,
  };
})(window.NM = window.NM || {});
