/* OrdoNota – Schnittstelle zu OrdoScripto (rein, ohne DOM): pseudonyme Test- und Schüler-IDs, QR-Inhalt, Import-CSV.
 * Formate laut OrdoScripto docs/DESIGN.md („Schnittstellen zu OrdoNota“). Die Zuordnung Pseudonym ↔ Person
 * steht nur in der verschlüsselten Datenbank (test.scripto.ids), nie in einer Datei für OrdoScripto. */
(function (NM) {
  'use strict';
  const G = NM.grades;
  const M = NM.model;

  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // wie der Wiederherstellungsschlüssel (js/crypto.js): ohne I, O, 0, 1
  const TEST_ID = /^T-\d{4}-\d{4}$/;
  const STUDENT_ID = /^S-[A-Z0-9]{6}$/; // so prüft OrdoScripto; das Alphabet ist eine Teilmenge
  const MAX_SEQ = 9000; // OrdoScripto vergibt ohne OrdoNota T-<Jahr>-9001 bis -9999
  const LEVELS = ['G', 'E'];

  /** 6 Zufallszeichen (32 Zeichen → 256 / 32 ohne Verzerrung). */
  function randomCode(n = 6) {
    const r = crypto.getRandomValues(new Uint8Array(n));
    let s = '';
    for (const b of r) s += ALPHABET[b & 31];
    return s;
  }

  function newStudentId(taken) {
    for (;;) {
      const id = 'S-' + randomCode(6);
      if (!taken.has(id)) return id;
    }
  }

  const testIdFor = (year, seq) => `T-${year}-${String(seq).padStart(4, '0')}`;
  const seqOf = (testId) => (TEST_ID.test(testId || '') ? Number(testId.slice(7)) : 0);

  /** Test, der die IDs trägt: bei einem Nachschreibtermin die Original-Arbeit (gleicher Test in OrdoScripto). */
  function owner(course, a) {
    return G.makeupTarget(course, a) || a;
  }

  /** test.scripto des Tests (bei Nachschreibterminen der Arbeit) oder null. */
  function dataOf(course, a) {
    const o = owner(course, a);
    return (o.test && o.test.scripto) || null;
  }

  /** Nächste laufende Nummer: settings.scriptoSeq, mindestens größer als jede vergebene Test-ID in der Datenbank. */
  function nextSeq(db) {
    let max = Number(db.settings.scriptoSeq) || 0;
    for (const c of db.courses || []) for (const a of c.assessments || []) if (a.test && a.test.scripto) max = Math.max(max, seqOf(a.test.scripto.testId));
    return max + 1;
  }

  /** Aktive Personen ohne Schüler-ID in diesem Test. */
  function missing(course, a) {
    const d = dataOf(course, a);
    return M.activeStudents(course).filter((s) => !(d && d.ids[s.id]));
  }

  /**
   * „Für OrdoScripto vorbereiten“: Test-ID beim ersten Mal vergeben, jeder aktiven Person ohne ID eine neue geben.
   * Vergebene IDs ändern sich nie. Liefert { data, created, added: [sid] }.
   */
  function prepare(db, course, a, now = new Date()) {
    const o = owner(course, a);
    let created = false;
    if (!o.test.scripto) {
      const seq = nextSeq(db);
      if (seq >= MAX_SEQ) throw new Error('Alle Test-IDs bis T-…-8999 sind vergeben (ab 9001 zählt OrdoScripto selbst).');
      const year = /^\d{4}/.test(o.date || '') ? o.date.slice(0, 4) : String(now.getFullYear());
      o.test.scripto = { testId: testIdFor(year, seq), ids: {}, created: now.toISOString() };
      db.settings.scriptoSeq = seq;
      created = true;
    }
    const d = o.test.scripto;
    const taken = new Set(Object.values(d.ids));
    const added = [];
    for (const s of M.activeStudents(course)) {
      if (d.ids[s.id]) continue;
      const id = newStudentId(taken);
      taken.add(id);
      d.ids[s.id] = id;
      added.push(s.id);
    }
    return { data: d, created, added };
  }

  /** Fehlt die Person in der Arbeit (fehlt/Nachschreiben, auch nur in einem Teil)? */
  function missed(test, sid) {
    const r = (test.results || {})[sid] || {};
    return r.status === 'fehlt' || r.status === 'nachschreiben' || Object.values(r.partStatus || {}).some((v) => v === 'fehlt' || v === 'nachschreiben');
  }

  /** Nachschreibende: in der Arbeit als fehlend markiert oder schon mit Eintrag in einem Nachschreibtermin. */
  function makeupStudents(course, a) {
    const o = owner(course, a);
    const terms = G.makeupsOf(course, o);
    return M.activeStudents(course).filter((s) => missed(o.test, s.id) || terms.some((m) => G.hasTestEntry(m.test, s.id)));
  }

  /** Personen für die Trennblätter in der Reihenfolge der Schülerliste (nur mit ID). */
  function sheetStudents(course, a, { onlyMakeup = false } = {}) {
    const d = dataOf(course, a);
    if (!d) return [];
    const list = onlyMakeup ? makeupStudents(course, a) : M.activeStudents(course);
    return list.filter((s) => d.ids[s.id]);
  }

  const qrText = (testId, studentId) => `ORDO|${testId}|${studentId}`;

  /** Import-CSV für OrdoScripto: UTF-8 ohne BOM, Semikolon, genau test_id;schueler_id;kurs – keine Namen. */
  function importCsv(course, a) {
    const d = dataOf(course, a);
    if (!d) throw new Error('Der Test ist noch nicht für OrdoScripto vorbereitet.');
    if (!LEVELS.includes(course.einstufung)) throw new Error('Für den Kurs ist keine Einstufung (G- oder E-Kurs) festgelegt.');
    const rows = ['test_id;schueler_id;kurs'];
    for (const s of M.activeStudents(course)) if (d.ids[s.id]) rows.push([d.testId, d.ids[s.id], course.einstufung].join(';'));
    return { name: d.testId + '_import.csv', text: rows.join('\n') + '\n' };
  }

  NM.scripto = { ALPHABET, TEST_ID, STUDENT_ID, LEVELS, testIdFor, owner, dataOf, nextSeq, missing, prepare, missed, makeupStudents, sheetStudents, qrText, importCsv, newStudentId };
})((globalThis.NM = globalThis.NM || {}));
