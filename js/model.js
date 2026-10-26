/* OrdoNota – Datenmodell: Erzeugen und Abfragen von Schuljahren, Kursen, Leistungen. */
(function (NM) {
  'use strict';
  const { uid, todayISO } = NM.util;
  const G = NM.grades;

  // SCHEMA erhöhen, sobald sich das Datenmodell so ändert, dass ältere App-Versionen
  // die Daten falsch verstehen würden. Ältere Versionen öffnen solche Datenbanken dann nicht.
  // 2 (1.18): Arbeiten in Teilen – getrennt benotete Teile würden ältere Versionen falsch rechnen.
  // 3 (1.20): Präsentationen (kind "pres") – ältere Versionen kennen diese Leistungsart nicht.
  // 4 (1.23): Gruppenpräsentationen – ältere Versionen würden Gruppenwerte ignorieren und falsche Noten zeigen.
  const SCHEMA = 4;
  const APP_VERSION = '1.24.2';

  class NewerSchemaError extends Error {}

  // Pomodoro-Timer (Einstellungen, siehe js/pomodoro.js); Längen in Minuten, Lautstärke 0–100
  const POMODORO_DEFAULTS = { enabled: false, count: 4, work: 25, short: 5, long: 15, tick: 'off', alarm: 'bell', volume: 60 };

  function currentSchoolYearName() {
    const d = new Date();
    const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // ab August neues Schuljahr
    return `${y}/${String(y + 1).slice(2)}`;
  }

  // Startbestand des Kriterienpools für Präsentationen (je Kriterium 0–3 Punkte mit Beschreibung je Stufe)
  const PRES_POOL = [
    ['Inhalt', 'Fachliche Richtigkeit', ['viele fachliche Fehler', 'einige Fehler', 'wenige kleine Fehler', 'fehlerfrei und präzise']],
    ['Inhalt', 'Vollständigkeit', ['wesentliche Aspekte fehlen', 'einige Aspekte fehlen', 'weitgehend vollständig', 'alle wesentlichen Aspekte']],
    ['Inhalt', 'Tiefe der Auseinandersetzung', ['bloße Aufzählung', 'oberflächlich', 'Zusammenhänge erklärt', 'eigenständig vertieft']],
    ['Inhalt', 'Beispiele und Veranschaulichung', ['keine Beispiele', 'wenige oder unpassende', 'passende Beispiele', 'treffend und anschaulich']],
    ['Inhalt', 'Lösungsweg erklären', ['kein Lösungsweg', 'lückenhaft oder nur vorgelesen', 'nachvollziehbar erklärt', 'schrittweise und begründet']],
    ['Inhalt', 'Quellenangaben', ['keine Quellen', 'unvollständig', 'vollständig', 'vollständig, seriöse Quellen']],
    ['Aufbau', 'Einleitung', ['fehlt', 'knapp, ohne Überblick', 'führt ins Thema ein', 'weckt Interesse und gibt Überblick']],
    ['Aufbau', 'Gliederung', ['nicht erkennbar', 'sprunghaft', 'erkennbar', 'klar und nachvollziehbar']],
    ['Aufbau', 'Übergänge und roter Faden', ['keine Übergänge', 'abrupte Wechsel', 'meist verbunden', 'flüssig, durchgehender roter Faden']],
    ['Aufbau', 'Schluss und Fazit', ['fehlt', 'endet abrupt', 'fasst zusammen', 'Fazit mit Ausblick oder eigener Bewertung']],
    ['Vortrag', 'Freies Sprechen', ['abgelesen', 'überwiegend abgelesen', 'weitgehend frei', 'frei mit Stichwortzettel']],
    ['Vortrag', 'Lautstärke', ['kaum zu hören', 'teils zu leise', 'gut hörbar', 'gut hörbar und bewusst eingesetzt']],
    ['Vortrag', 'Sprechtempo und Pausen', ['viel zu schnell oder zu langsam', 'ungleichmäßig', 'angemessen', 'angemessen mit gezielten Pausen']],
    ['Vortrag', 'Betonung', ['monoton', 'wenig Betonung', 'betont', 'lebendig, hebt Wichtiges hervor']],
    ['Vortrag', 'Blickkontakt', ['kein Blickkontakt', 'selten', 'meist vorhanden', 'mit dem ganzen Publikum']],
    ['Vortrag', 'Körpersprache', ['unruhig oder abgewandt', 'verkrampft', 'offen und ruhig', 'sicher, unterstützt die Aussagen']],
    ['Vortrag', 'Zeitrahmen', ['deutlich über- oder unterschritten', 'merklich abweichend', 'knapp eingehalten', 'genau eingehalten']],
    ['Medien', 'Übersichtlichkeit', ['überladen und unstrukturiert', 'teils überladen', 'übersichtlich', 'klar strukturiert, wenig Text je Folie']],
    ['Medien', 'Lesbarkeit', ['kaum lesbar', 'teils zu klein oder kontrastarm', 'gut lesbar', 'gut lesbar, einheitliche Schrift']],
    ['Medien', 'Ansprechende Gestaltung', ['lieblos', 'uneinheitlich', 'ansprechend', 'ansprechend und durchdacht']],
    ['Medien', 'Bilder und Grafiken', ['keine oder unpassend', 'rein dekorativ', 'passend', 'erklären die Inhalte']],
    ['Medien', 'Rechtschreibung', ['viele Fehler', 'einige Fehler', 'vereinzelte Fehler', 'fehlerfrei']],
    ['Medien', 'Zusammenspiel von Medium und Vortrag', ['Folien werden vorgelesen', 'teilweise abgestimmt', 'passt zum Vortrag', 'ergänzt den Vortrag gezielt']],
    ['Medien', 'Darstellung der Lösung', ['unleserlich und ungeordnet', 'teils unübersichtlich', 'sauber und geordnet', 'übersichtlich, Wichtiges hervorgehoben']],
    ['Medien', 'Handout', ['fehlt', 'lückenhaft', 'vollständig', 'vollständig, übersichtlich und hilfreich']],
    ['Sprache', 'Fachsprache', ['keine Fachbegriffe', 'Fachbegriffe teils falsch', 'Fachbegriffe richtig', 'sicher und erklärt']],
    ['Sprache', 'Verständlichkeit', ['schwer verständlich', 'teilweise verständlich', 'verständlich', 'anschaulich erklärt']],
    ['Sprache', 'Ausdruck und Satzbau', ['umgangssprachlich, unvollständig', 'holprig', 'angemessen', 'treffend und abwechslungsreich']],
    ['Austausch', 'Fragen beantworten', ['keine Antworten', 'unsicher', 'meist sicher', 'sicher und fundiert']],
    ['Austausch', 'Umgang mit Fehlern', ['Fehler übergangen', 'nach Hinweis korrigiert', 'selbst erkannt und korrigiert', 'erkannt, erklärt und verbessert']],
    ['Austausch', 'Einbindung des Publikums', ['kein Bezug zum Publikum', 'wenig Bezug', 'Publikum angesprochen', 'Publikum aktiv eingebunden']],
  ];

  function defaultCriteriaPool() {
    return PRES_POOL.map(([group, name, d]) => ({ id: uid(), group, name, desc: { 0: d[0], 1: d[1], 2: d[2], 3: d[3] } }));
  }

  /** Kriterien des Startbestands, die im Pool fehlen (Vergleich über die Bezeichnung). */
  function missingDefaultCriteria(pool) {
    const have = new Set((pool || []).map((c) => (c.name || '').trim().toLowerCase()));
    return defaultCriteriaPool().filter((c) => !have.has(c.name.toLowerCase()));
  }

  // Standardvorlagen: [Name, [[Kriterium, Gewicht], …]] – Kriterien aus dem Startbestand
  const PRES_TEMPLATES = [
    ['Kurzvortrag (ohne Handout)', [['Fachliche Richtigkeit', 2], ['Vollständigkeit', 1], ['Gliederung', 1], ['Freies Sprechen', 1], ['Blickkontakt', 1], ['Verständlichkeit', 1], ['Zeitrahmen', 1]]],
    ['Vortrag', [['Fachliche Richtigkeit', 2], ['Tiefe der Auseinandersetzung', 1], ['Quellenangaben', 1], ['Einleitung', 1], ['Gliederung', 1], ['Schluss und Fazit', 1], ['Freies Sprechen', 1], ['Blickkontakt', 1], ['Sprechtempo und Pausen', 1], ['Übersichtlichkeit', 1], ['Zusammenspiel von Medium und Vortrag', 1], ['Handout', 1], ['Fachsprache', 1], ['Fragen beantworten', 1]]],
    ['Hausaufgaben vorstellen', [['Fachliche Richtigkeit', 2], ['Vollständigkeit', 1], ['Lösungsweg erklären', 2], ['Darstellung der Lösung', 1], ['Fachsprache', 1], ['Fragen beantworten', 1], ['Umgang mit Fehlern', 1]]],
  ];

  /** Standardvorlagen; Kriterien kommen aus dem Pool (gleiche Bezeichnung), sonst aus dem Startbestand. */
  function defaultPresTemplates(pool) {
    const byName = (list, n) => (list || []).find((c) => (c.name || '').trim().toLowerCase() === n.toLowerCase());
    const defaults = defaultCriteriaPool();
    return PRES_TEMPLATES.map(([name, crit]) =>
      newPresTemplate(name, crit.map(([n, weight]) => Object.assign({}, byName(pool, n) || byName(defaults, n), { weight })))
    );
  }

  /** Standardvorlagen, deren Name unter den Vorlagen fehlt. */
  function missingDefaultTemplates(templates, pool) {
    const have = new Set((templates || []).map((t) => (t.name || '').trim().toLowerCase()));
    return defaultPresTemplates(pool).filter((t) => !have.has(t.name.toLowerCase()));
  }

  function newDb() {
    const pool = defaultCriteriaPool();
    const year = { id: uid(), name: currentSchoolYearName() };
    return {
      schema: SCHEMA,
      created: new Date().toISOString(),
      settings: {
        autoLockMin: 15,
        limitSek1: 50,
        limitMss: 45,
        precision: 1,
        keepBackups: 10,
        backupEveryMin: 10,
        gradeColors: true,
        pomodoro: Object.assign({}, POMODORO_DEFAULTS),
      },
      criteriaPool: pool,
      presTemplates: defaultPresTemplates(pool),
      years: [year],
      courses: [],
    };
  }

  /** Ältere Datenbanken auf den aktuellen Stand bringen. */
  function migrate(db) {
    if (!db || typeof db !== 'object') throw new Error('Die Datenbank ist beschädigt (kein gültiger Inhalt).');
    if (Number(db.schema) > SCHEMA) {
      throw new NewerSchemaError(
        `Diese Datenbank wurde mit einer neueren Version von OrdoNota gespeichert` +
          (db.savedWith ? ` (${db.savedWith})` : '') +
          `. Diese App ist Version ${APP_VERSION}. Bitte aktualisieren Sie die Programmdateien auf diesem Gerät, bevor Sie die Datenbank öffnen – sonst könnten Daten verloren gehen.`
      );
    }
    db.settings = Object.assign(newDb().settings, db.settings || {});
    // 1.17: Pomodoro-Timer
    db.settings.pomodoro = Object.assign({}, POMODORO_DEFAULTS, db.settings.pomodoro || {});
    // 1.20: Kriterienpool für Präsentationen (Startbestand nur, wenn es noch keinen gibt)
    if (!Array.isArray(db.criteriaPool)) db.criteriaPool = defaultCriteriaPool();
    // 1.21: Vorlagen für Präsentationen (benannte Kriteriensätze); 1.22: mit Standardvorlagen
    if (!Array.isArray(db.presTemplates)) db.presTemplates = defaultPresTemplates(db.criteriaPool);
    db.years = db.years || [];
    db.courses = db.courses || [];
    for (const c of db.courses) {
      c.students = c.students || [];
      c.assessments = c.assessments || [];
      // 1.24: Gruppeneinteilungen und Regeln (Reiter „Gruppen“)
      c.groupSets = Array.isArray(c.groupSets) ? c.groupSets : [];
      c.groupRules = Object.assign({ apart: [], together: [] }, c.groupRules || {});
      c.overrides = c.overrides || {};
      c.comments = c.comments || {};
      if (c.wHalf1 === undefined) c.wHalf1 = 1;
      if (c.wHalf2 === undefined) c.wHalf2 = 2;
      // 1.11: Ziehen (Pool und bisherige Ziehungen)
      c.draw = c.draw || { out: {}, history: [] };
      // 1.12.1: MSS-Kursart bei Jahrgang ≤ 10 (nur die Kursart gewählt) rechnete mit der Sek-I-Notenskala
      if ((c.type === 'lk' || c.type === 'gk') && Number(c.jahrgang) <= 10) setJahrgang(c, mssJahrgang(c), db.settings);
      // 1.3: ein Sitzplan pro Kurs → mehrere Räume
      if (c.seating && !c.seatingPlans) {
        c.seatingPlans = [Object.assign({ id: uid(), name: 'Raum 1', cols: 8, rows: 5, desk: 'top' }, c.seating, { pos: c.seating.pos || {} })];
        delete c.seating;
      }
    }
    db.schema = SCHEMA;
    db.savedWith = APP_VERSION;
    return db;
  }

  /** Jahrgang für einen MSS-Kurs: 11, 12 oder 13 aus „Klasse / Stufe“ (z. B. „MSS 12“), sonst 11. */
  function mssJahrgang(course) {
    const m = /(?:^|\D)(1[123])(?:\D|$)/.exec(course.klasse || '');
    return m ? Number(m[1]) : 11;
  }

  /**
   * Jahrgang setzen und Leistungen, gesetzte Noten und Ziehungen auf die neuen Halbjahre umhängen
   * (z. B. HJ1/HJ2 → 11/1, 11/2). Noten sind intern Punkte und bleiben unverändert.
   * Wechselt die Stufe (Sek I ↔ MSS), bekommen Tests/EPO-Blöcke mit Standardwerten die Standardwerte der neuen Stufe.
   */
  function setJahrgang(course, j, settings) {
    const from = G.courseLevel(course);
    const to = G.courseLevel({ jahrgang: j });
    if (from !== to && settings) adoptLevelDefaults(course, from, to, settings);
    const oldHalves = G.halvesFor(course);
    const newHalves = G.halvesFor({ jahrgang: j });
    const map = (half) => newHalves[Math.min(Math.max(0, oldHalves.indexOf(half)), newHalves.length - 1)];
    for (const a of course.assessments || []) a.half = map(a.half);
    for (const e of (course.draw && course.draw.history) || []) e.half = map(e.half);
    const old = course.overrides || {};
    const ov = {};
    oldHalves.forEach((x, i) => {
      if (old[x] && newHalves[i]) ov[newHalves[i]] = old[x];
    });
    if (old.Jahr && j <= 11) ov.Jahr = old.Jahr;
    course.overrides = ov;
    course.jahrgang = j;
  }

  /** LIMIT von Tests und EPO-Blöcken sowie die EPO-Umrechnung umstellen – nur wo noch der Standard der alten Stufe gilt. */
  function adoptLevelDefaults(course, from, to, settings) {
    const limit = (level) => Number(level === 'mss' ? settings.limitMss : settings.limitSek1);
    for (const a of course.assessments || []) {
      if (a.test && Number(a.test.limit) === limit(from)) a.test.limit = limit(to);
      if (a.epo) {
        const isDefault = !a.epo.table || JSON.stringify(a.epo.table) === JSON.stringify(G.epoDefaultTable(from, a.epo.limit));
        if (Number(a.epo.limit) === limit(from)) a.epo.limit = limit(to);
        if (isDefault) a.epo.table = G.epoDefaultTable(to, a.epo.limit);
      }
    }
  }

  function newCourse(yearId, { klasse = '', fach = '', jahrgang = 5, type = 'sek1' } = {}) {
    const t = G.COURSE_TYPES[type];
    return {
      id: uid(),
      yearId,
      klasse,
      fach,
      jahrgang,
      type,
      wKa: t.ka,
      wOther: t.other,
      wHalf1: 1,
      wHalf2: 2,
      students: [],
      assessments: [],
      overrides: {},
      comments: {},
      note: '',
    };
  }

  function courseTitle(c) {
    return [c.klasse, c.fach].filter(Boolean).join(' ') || 'Neuer Kurs';
  }

  function sortStudents(list) {
    return list.slice().sort((a, b) => (a.last || '').localeCompare(b.last || '', 'de') || (a.first || '').localeCompare(b.first || '', 'de'));
  }

  function activeStudents(c) {
    return sortStudents(c.students.filter((s) => s.active !== false));
  }

  /** Personen, die in Statistiken zählen (Notenspiegel, Schnitte, Drittelparagraph): aktiv und ohne I-Status. */
  function statStudents(c) {
    return activeStudents(c).filter((s) => !s.iStatus);
  }

  function studentName(s) {
    return [s.last, s.first].filter(Boolean).join(', ');
  }

  /**
   * Namensliste einfügen: je Zeile "Nachname, Vorname", "Nachname<TAB>Vorname"
   * oder "Vorname Nachname".
   */
  function parseNames(text) {
    const out = [];
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      let last = '';
      let first = '';
      if (line.includes('\t')) {
        const parts = line.split('\t').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2 && /^\d+$/.test(parts[0])) parts.shift(); // laufende Nummer
        [last, first] = [parts[0] || '', parts.slice(1).join(' ')];
      } else if (line.includes(',')) {
        const i = line.indexOf(',');
        last = line.slice(0, i).trim();
        first = line.slice(i + 1).trim();
      } else {
        const parts = line.split(/\s+/);
        if (parts.length === 1) last = parts[0];
        else {
          last = parts.pop();
          first = parts.join(' ');
        }
      }
      if (last || first) out.push({ id: uid(), last, first, active: true });
    }
    return out;
  }

  function newManual(half, cat, name) {
    return { id: uid(), kind: 'manual', half, cat, name, date: todayISO(), weight: 1, manual: { grades: {} } };
  }

  function newTest(course, half, settings) {
    const level = G.courseLevel(course);
    return {
      id: uid(),
      kind: 'test',
      half,
      cat: course.type === 'noka' ? 'other' : 'ka',
      name: 'Neuer Test',
      date: todayISO(),
      weight: 1,
      test: {
        limit: level === 'mss' ? settings.limitMss : settings.limitSek1,
        precision: settings.precision,
        tasks: [
          { id: uid(), name: 'A1', max: 5 },
          { id: uid(), name: 'A2', max: 5 },
        ],
        custom: {},
        results: {},
        note: '',
      },
    };
  }

  function newEpo(course, half, settings) {
    const level = G.courseLevel(course);
    const limit = level === 'mss' ? settings.limitMss : settings.limitSek1;
    return {
      id: uid(),
      kind: 'epo',
      half,
      cat: 'other',
      name: 'EPO',
      date: todayISO(),
      weight: 1,
      epo: {
        limit,
        points: Object.assign({}, G.EPO_DEFAULT_POINTS),
        table: G.epoDefaultTable(level, limit),
        lessons: [],
        entries: {},
      },
    };
  }

  /** Neue Präsentationsbewertung; criteria: Kriterien (Kopie aus dem Pool, mit eigener id). */
  function newPres(course, half, settings, criteria = []) {
    const level = G.courseLevel(course);
    return {
      id: uid(),
      kind: 'pres',
      half,
      cat: 'other',
      name: 'Präsentation',
      date: todayISO(),
      weight: 1,
      pres: {
        limit: level === 'mss' ? settings.limitMss : settings.limitSek1,
        custom: {},
        criteria: criteria.map((c) => presCriterion(c)),
        results: {},
      },
    };
  }

  /** Kriterium für eine Bewertung aus einem Pool-Eintrag (oder einem Kriterium einer früheren Bewertung). */
  function presCriterion(c) {
    const out = { id: uid(), poolId: c.poolId || c.id, group: c.group || '', name: c.name, desc: Object.assign({}, c.desc || {}), weight: Number(c.weight) > 0 ? Number(c.weight) : 1 };
    if (c.scope === 'person') out.scope = 'person'; // bei Gruppenpräsentationen je Person bewertet
    return out;
  }

  /** Vorlage aus Kriterien (einer Bewertung oder aus dem Pool): Reihenfolge, Gewichte und Stufen werden kopiert. */
  function newPresTemplate(name, criteria) {
    return { id: uid(), name, criteria: criteria.map((c) => Object.assign({ poolId: c.poolId || c.id, group: c.group || '', name: c.name, desc: Object.assign({}, c.desc || {}), weight: Number(c.weight) > 0 ? Number(c.weight) : 1 }, c.scope === 'person' ? { scope: 'person' } : {})) };
  }

  function kindLabel(a) {
    return a.kind === 'test' ? 'Test' : a.kind === 'epo' ? 'EPO' : a.kind === 'pres' ? 'Präsentation' : 'Note';
  }

  // ---------- Demo-Daten (nur index.html?demo) ----------

  // Personensymbol (Kopf und Schultern): Platzhalter für Personen ohne Foto, in der Demo als Foto
  const PERSON_ICON =
    'data:image/svg+xml,' +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 160'><rect width='160' height='160' fill='#e6e9ee'/>" +
        "<circle cx='80' cy='60' r='30' fill='#2b2f36'/><path d='M20 160c0-38 27-62 60-62s60 24 60 62z' fill='#2b2f36'/></svg>"
    );

  function demoDb() {
    const db = newDb();
    const year = db.years[0];
    const names = ['Becker, Lea', 'Demir, Can', 'Fischer, Mia', 'Hoffmann, Paul', 'Jung, Emma', 'Klein, Noah', 'Lang, Sophie', 'Meyer, Ben', 'Neumann, Lina', 'Schmitt, Finn', 'Wagner, Ella', 'Weber, Luis'];
    const c8 = newCourse(year.id, { klasse: '8b', fach: 'Mathe', jahrgang: 8, type: 'sek1' });
    c8.students = parseNames(names.join('\n'));
    const t = newTest(c8, 'HJ1', db.settings);
    t.name = 'KA 1 – Terme';
    t.test.precision = 0.5; // Demo-Daten enthalten halbe Punkte
    t.test.tasks = [
      { id: 'a1', name: 'A1a', max: 4 },
      { id: 'a2', name: 'A1b', max: 6 },
      { id: 'a3', name: 'A2', max: 10 },
      { id: 'a4', name: 'A3', max: 8 },
      { id: 'a5', name: 'Bonus', max: 3, bonus: true },
    ];
    c8.students.forEach((s, i) => {
      const f = 1 - i / 14;
      t.test.results[s.id] = { scores: { a1: Math.round(4 * f), a2: Math.round(6 * f * 2) / 2, a3: Math.round(10 * f), a4: Math.round(8 * (f - 0.1) * 2) / 2, a5: i % 4 === 0 ? 2 : '' } };
    });
    t.test.results[c8.students[11].id] = { status: 'fehlt' };
    c8.assessments.push(t);
    const hue = newManual('HJ1', 'other', 'HÜ 1');
    c8.students.forEach((s, i) => (hue.manual.grades[s.id] = { p: Math.max(0, 14 - i) }));
    c8.assessments.push(hue);
    const heft = newManual('HJ1', 'other', 'Heft');
    heft.weight = 2;
    c8.students.forEach((s, i) => (heft.manual.grades[s.id] = { p: [14, 11, 12, 8, 10, 9, 13, 5, 7, 11, 6, 9][i] }));
    c8.assessments.push(heft);
    const e = newEpo(c8, 'HJ1', db.settings);
    e.name = 'EPO Sep–Okt';
    const syms = ['++', '+', '+', '0', '+', '-', '0', '++'];
    for (let l = 0; l < 6; l++) e.epo.lessons.push({ id: 'l' + l, date: `2026-09-${String(8 + l * 3).padStart(2, '0')}` });
    c8.students.forEach((s, i) => {
      e.epo.entries[s.id] = {};
      e.epo.lessons.forEach((l, j) => (e.epo.entries[s.id][l.id] = { r: syms[(i + j) % syms.length], hw: (i + j) % 9 === 0 ? 'h' : '' }));
    });
    c8.assessments.push(e);
    // Präsentationen im 2. Halbjahr (Kriterien aus dem Startbestand)
    const pr = newPres(c8, 'HJ2', db.settings, db.criteriaPool.filter((x) => ['Fachliche Richtigkeit', 'Gliederung', 'Freies Sprechen', 'Übersichtlichkeit', 'Fragen beantworten'].includes(x.name)));
    pr.name = 'Referat Statistik';
    pr.pres.criteria[0].weight = 2;
    const topics = ['Mittelwert', 'Median', 'Boxplot', 'Streuung', 'Diagramme', 'Umfragen'];
    c8.students.slice(0, 6).forEach((s, i) => {
      pr.pres.results[s.id] = { topic: topics[i], date: `2026-11-${String(10 + i).padStart(2, '0')}`, scores: Object.fromEntries(pr.pres.criteria.map((c, j) => [c.id, Math.max(0, 3 - ((i + j) % 4))])) };
    });
    c8.assessments.push(pr);
    // Präsentation aus einer Standardvorlage
    const hw = newPres(c8, 'HJ2', db.settings, db.presTemplates.find((x) => x.name === 'Hausaufgaben vorstellen').criteria);
    hw.name = 'HA vorstellen';
    c8.students.slice(4, 10).forEach((s, i) => {
      hw.pres.results[s.id] = { date: `2026-11-${String(17 + i).padStart(2, '0')}`, scores: Object.fromEntries(hw.pres.criteria.map((c, j) => [c.id, [3, 2, 3, 1, 2, 3][(i + j) % 6]])) };
    });
    c8.assessments.push(hw);
    // Gruppenpräsentation: Inhalt und Medien für die Gruppe, Vortrag je Person; eine Abweichung
    const gp = newPres(c8, 'HJ2', db.settings, db.criteriaPool.filter((x) => ['Fachliche Richtigkeit', 'Gliederung', 'Übersichtlichkeit', 'Freies Sprechen', 'Blickkontakt', 'Fragen beantworten'].includes(x.name)));
    gp.name = 'Gruppenpräsentation Zufall';
    gp.pres.groupMode = 'mixed';
    gp.pres.criteria[0].weight = 2;
    for (const c of gp.pres.criteria) if (['Freies Sprechen', 'Blickkontakt', 'Fragen beantworten'].includes(c.name)) c.scope = 'person';
    const gs = c8.students;
    gp.pres.groups = [
      { id: 'gr1', name: 'Gruppe 1', topic: 'Laplace-Experimente', members: [gs[0].id, gs[3].id, gs[6].id], scores: {} },
      { id: 'gr2', name: 'Gruppe 2', topic: 'Baumdiagramme', members: [gs[1].id, gs[4].id, gs[7].id, gs[10].id], scores: {} },
      { id: 'gr3', name: 'Gruppe 3', topic: 'Simulation', members: [gs[2].id, gs[5].id, gs[8].id], scores: {} },
    ];
    gp.pres.groups.forEach((g, gi) => {
      gp.pres.criteria.forEach((c, j) => {
        if (c.scope !== 'person') g.scores[c.id] = [3, 2, 2, 3, 1][(gi + j) % 5];
      });
      g.members.forEach((sid, mi) => {
        gp.pres.results[sid] = { scores: Object.fromEntries(gp.pres.criteria.filter((c) => c.scope === 'person').map((c, j) => [c.id, Math.max(0, 3 - ((gi + mi + j) % 4))])) };
      });
    });
    gp.pres.results[gs[4].id].scores[gp.pres.criteria[0].id] = 1; // Abweichung: fachlich schwächer als die Gruppe
    gp.pres.results[gs[4].id].note = 'Fachteil unsicher, bei Nachfragen Lücken.';
    gp.pres.results[gs[8].id] = { status: 'fehlt' };
    c8.assessments.push(gp);
    // Klassenarbeit in zwei Teilen, gemeinsam bepunktet (ein Schlüssel über alle Punkte)
    const t2 = newTest(c8, 'HJ2', db.settings);
    t2.name = 'KA 2 – Geometrie';
    t2.test.precision = 0.5;
    t2.test.partMode = 'sum';
    t2.test.parts = [
      { id: 'pt1', name: 'Ohne Hilfsmittel', weight: 1 },
      { id: 'pt2', name: 'Mit Hilfsmitteln', weight: 1 },
    ];
    t2.test.tasks = [
      { id: 'g1', name: 'A1', max: 4, partId: 'pt1' },
      { id: 'g2', name: 'A2', max: 6, partId: 'pt1' },
      { id: 'g3', name: 'A3', max: 8, partId: 'pt2' },
      { id: 'g4', name: 'A4', max: 10, partId: 'pt2' },
      { id: 'g5', name: 'Bonus', max: 2, bonus: true, partId: 'pt2' },
    ];
    c8.students.forEach((s, i) => {
      const f = 1 - ((i * 5) % 12) / 15;
      t2.test.results[s.id] = { scores: { g1: Math.round(4 * f), g2: Math.round(6 * f * 2) / 2, g3: Math.round(8 * (f - 0.05) * 2) / 2, g4: Math.round(10 * f), g5: i % 3 === 0 ? 1 : '' } };
    });
    c8.assessments.push(t2);

    // Gruppeneinteilung mit Aufträgen und einer Regel
    const st = c8.students;
    c8.groupRules = { apart: [[st[1].id, st[7].id]], together: [] };
    c8.groupSets = [
      {
        id: 'gs1',
        name: 'Stationenlernen Prozent',
        date: '2026-10-12',
        opts: { by: 'size', n: 3, mode: 'mixed', vary: true },
        groups: [
          { id: 'gg1', name: 'Gruppe 1', task: 'Station 1: Grundwert', members: [st[0].id, st[5].id, st[10].id] },
          { id: 'gg2', name: 'Gruppe 2', task: 'Station 2: Prozentwert', members: [st[1].id, st[6].id, st[9].id] },
          { id: 'gg3', name: 'Gruppe 3', task: 'Station 3: Prozentsatz', members: [st[2].id, st[7].id, st[8].id] },
          { id: 'gg4', name: 'Gruppe 4', task: 'Station 4: Zinsen', members: [st[3].id, st[4].id, st[11].id] },
        ],
      },
    ];

    const c12 = newCourse(year.id, { klasse: 'MSS 12', fach: 'M LK', jahrgang: 12, type: 'lk' });
    c12.students = parseNames(names.slice(0, 9).join('\n'));
    const k = newTest(c12, '12/1', db.settings);
    k.name = 'Kursarbeit 1';
    k.test.tasks = [
      { id: 'b1', name: 'A1', max: 12 },
      { id: 'b2', name: 'A2', max: 18 },
      { id: 'b3', name: 'A3', max: 15 },
    ];
    c12.students.forEach((s, i) => (k.test.results[s.id] = { scores: { b1: 12 - i, b2: 18 - i * 1.5, b3: 15 - i * 2 } }));
    c12.assessments.push(k);
    // Kursarbeit in drei Teilen, getrennt benotet (Gesamtnote = gewichteter Schnitt der Teilnoten)
    const k2 = newTest(c12, '12/1', db.settings);
    k2.name = 'Kursarbeit 2 – Analysis';
    k2.test.partMode = 'separate';
    k2.test.parts = [
      { id: 'q1', name: 'Hilfsmittelfrei', weight: 1 },
      { id: 'q2', name: 'Mit GTR', weight: 2 },
      { id: 'q3', name: 'Modellierung', weight: 1 },
    ].map((x) => Object.assign(x, { limit: k2.test.limit, precision: 1, custom: {} }));
    k2.test.tasks = [
      { id: 'c1', name: 'A1', max: 8, partId: 'q1' },
      { id: 'c2', name: 'A2', max: 7, partId: 'q1' },
      { id: 'c3', name: 'A3', max: 15, partId: 'q2' },
      { id: 'c4', name: 'A4', max: 15, partId: 'q2' },
      { id: 'c5', name: 'A5', max: 12, partId: 'q3' },
    ];
    c12.students.forEach((s, i) => {
      const f = 1 - ((i * 4) % 9) / 13;
      k2.test.results[s.id] = { scores: { c1: Math.round(8 * f), c2: Math.round(7 * (f - 0.1)), c3: Math.round(15 * f), c4: Math.round(15 * (f - 0.08)), c5: Math.round(12 * (1.05 - f / 2)) } };
    });
    // Eine Person hat den Modellierungsteil versäumt: Gesamtnote bleibt offen
    const miss = k2.test.results[c12.students[3].id];
    delete miss.scores.c5;
    miss.partStatus = { q3: 'fehlt' };
    c12.assessments.push(k2);
    // Präsentation aus der Standardvorlage „Kurzvortrag (ohne Handout)“
    const kv = newPres(c12, '12/1', db.settings, db.presTemplates.find((x) => x.name === 'Kurzvortrag (ohne Handout)').criteria);
    kv.name = 'Kurzvortrag Extremwerte';
    const kvTopics = ['Hochpunkt', 'Wendepunkt', 'Optimierung', 'Sattelpunkt', 'Randextrema'];
    c12.students.slice(0, 5).forEach((s, i) => {
      kv.pres.results[s.id] = { topic: kvTopics[i], scores: Object.fromEntries(kv.pres.criteria.map((c, j) => [c.id, Math.max(0, 3 - ((i * 2 + j) % 4))])) };
    });
    c12.assessments.push(kv);
    for (const s of [...c8.students, ...c12.students]) s.photo = PERSON_ICON;
    db.courses.push(c8, c12);
    return db;
  }

  NM.model = {
    SCHEMA,
    APP_VERSION,
    POMODORO_DEFAULTS,
    PERSON_ICON,
    NewerSchemaError,
    newDb,
    migrate,
    newCourse,
    setJahrgang,
    mssJahrgang,
    courseTitle,
    sortStudents,
    activeStudents,
    statStudents,
    studentName,
    parseNames,
    newManual,
    newTest,
    newEpo,
    newPres,
    presCriterion,
    defaultCriteriaPool,
    missingDefaultCriteria,
    defaultPresTemplates,
    missingDefaultTemplates,
    newPresTemplate,
    kindLabel,
    demoDb,
  };
})((globalThis.NM = globalThis.NM || {}));
