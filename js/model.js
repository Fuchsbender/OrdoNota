/* Notenmanager – Datenmodell: Erzeugen und Abfragen von Schuljahren, Kursen, Leistungen. */
(function (NM) {
  'use strict';
  const { uid, todayISO } = NM.util;
  const G = NM.grades;

  // SCHEMA erhöhen, sobald sich das Datenmodell so ändert, dass ältere App-Versionen
  // die Daten falsch verstehen würden. Ältere Versionen öffnen solche Datenbanken dann nicht.
  const SCHEMA = 1;
  const APP_VERSION = '1.1.10';

  class NewerSchemaError extends Error {}

  function currentSchoolYearName() {
    const d = new Date();
    const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // ab August neues Schuljahr
    return `${y}/${String(y + 1).slice(2)}`;
  }

  function newDb() {
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
      },
      years: [year],
      courses: [],
    };
  }

  /** Ältere Datenbanken auf den aktuellen Stand bringen. */
  function migrate(db) {
    if (!db || typeof db !== 'object') throw new Error('Die Datenbank ist beschädigt (kein gültiger Inhalt).');
    if (Number(db.schema) > SCHEMA) {
      throw new NewerSchemaError(
        `Diese Datenbank wurde mit einer neueren Version des Notenmanagers gespeichert` +
          (db.savedWith ? ` (${db.savedWith})` : '') +
          `. Diese App ist Version ${APP_VERSION}. Bitte aktualisieren Sie die Programmdateien auf diesem Gerät, bevor Sie die Datenbank öffnen – sonst könnten Daten verloren gehen.`
      );
    }
    db.settings = Object.assign(newDb().settings, db.settings || {});
    db.years = db.years || [];
    db.courses = db.courses || [];
    for (const c of db.courses) {
      c.students = c.students || [];
      c.assessments = c.assessments || [];
      c.overrides = c.overrides || {};
      c.comments = c.comments || {};
      if (c.wHalf1 === undefined) c.wHalf1 = 1;
      if (c.wHalf2 === undefined) c.wHalf2 = 2;
    }
    db.schema = SCHEMA;
    db.savedWith = APP_VERSION;
    return db;
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

  function kindLabel(a) {
    return a.kind === 'test' ? 'Test' : a.kind === 'epo' ? 'EPO' : 'Note';
  }

  // ---------- Demo-Daten (nur index.html?demo) ----------

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
    db.courses.push(c8, c12);
    return db;
  }

  NM.model = {
    SCHEMA,
    APP_VERSION,
    NewerSchemaError,
    newDb,
    migrate,
    newCourse,
    courseTitle,
    sortStudents,
    activeStudents,
    studentName,
    parseNames,
    newManual,
    newTest,
    newEpo,
    kindLabel,
    demoDb,
  };
})((globalThis.NM = globalThis.NM || {}));
