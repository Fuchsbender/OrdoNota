/* OrdoNota – Moodle-Import: Test-Exporte (Antworten-/Bewertungen-CSV) einlesen, Personen zuordnen, als Test übernehmen. */
(function (NM) {
  'use strict';
  const { uid } = NM.util;
  const M = NM.model;
  const G = NM.grades;

  // ---------- CSV ----------

  /** CSV-Text in Zeilen (Arrays) zerlegen; Trennzeichen „,“ oder „;“ wird an der Kopfzeile erkannt. */
  function parseCsv(text) {
    text = String(text).replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
    const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((v) => v.trim() !== ''));
  }

  // ---------- Spalten erkennen ----------

  function norm(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ');
  }

  function num(s) {
    const t = String(s === undefined || s === null ? '' : s).trim();
    if (t === '' || t === '-') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  const MONTHS = { januar: 1, februar: 2, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };

  /** „1. September 2026  10:05“ → „2026-09-01“ (sonst null) */
  function parseDate(s) {
    const m = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/.exec(String(s || ''));
    const mon = m && MONTHS[norm(m[2])];
    return mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : null;
  }

  /** Spaltenindizes einer Moodle-CSV: Personendaten, Gesamtbewertung, Fragen. */
  function columns(head) {
    const col = { frage: {}, antwort: {}, richtig: {}, punkte: {} };
    head.forEach((raw, i) => {
      const h = norm(raw);
      let m;
      if (h === 'nachname') col.last = i;
      else if (h === 'vorname') col.first = i;
      else if (/^e-?mail(-?adresse)?$/.test(h)) col.email = i;
      else if (h === 'status') col.status = i;
      else if (h === 'begonnen') col.started = i;
      else if ((m = /^bewertung\s*\/\s*([\d.,]+)$/.exec(h))) {
        col.total = i;
        col.totalMax = num(m[1]);
      } else if ((m = /^frage\s*(\d+)$/.exec(h))) col.frage[m[1]] = i;
      else if ((m = /^(?:richtige|korrekte)\s*antwort\s*(\d+)$/.exec(h))) col.richtig[m[1]] = i;
      else if ((m = /^antwort\s*(\d+)$/.exec(h))) col.antwort[m[1]] = i;
      else if ((m = /^f\s*(\d+)\s*\/\s*([\d.,]+)$/.exec(h))) col.punkte[m[1]] = { i, max: num(m[2]) };
    });
    return col;
  }

  /** Angehängte Auswahlmöglichkeiten („Frage?: A; B; C“) vom Fragetext abtrennen. */
  function questionText(s) {
    const t = String(s || '').trim();
    const m = /^([\s\S]*?)\s*:\s*.+;.+$/.exec(t);
    return m ? m[1].trim() : t;
  }

  const answerNorm = (s) => norm(s).replace(/\.$/, '');

  // ---------- Export einlesen ----------

  /**
   * Moodle-Exporte einlesen. files = [{ name, text }], erkannt wird je Datei:
   *   Antworten-CSV   (Frage n, Antwort n, Richtige Antwort n) → Texte für den Ausdruck
   *   Bewertungen-CSV (F n /max)                              → Punkte je Frage, inkl. Korrekturen in Moodle
   * Ohne Bewertungen-CSV zählt jede Frage 1 Punkt, wenn Antwort und richtige Antwort übereinstimmen.
   */
  function parseExport(files) {
    const out = { files: [], questions: [], attempts: [], persons: [], totalMax: null, title: '', warnings: [], texts: {}, pending: {}, companion: null };
    let answers = null;
    let grades = null;
    for (const f of files) {
      if (/\.json$/i.test(f.name) || /^\s*\{/.test(String(f.text).replace(/^\uFEFF/, ''))) {
        if (out.companion) {
          out.warnings.push(`„${f.name}“ wird ignoriert: Es wurde schon eine Begleitdatei gewählt.`);
          continue;
        }
        try {
          out.companion = parseCompanion(f.text);
          out.files.push({ name: f.name, kind: 'komp', text: f.text });
        } catch (e) {
          out.warnings.push(`„${f.name}“: ${e.message}`);
        }
        continue;
      }
      const rows = parseCsv(f.text);
      if (!rows.length) continue;
      const col = columns(rows[0]);
      const kind = Object.keys(col.punkte).length ? 'grades' : Object.keys(col.antwort).length || Object.keys(col.frage).length ? 'answers' : null;
      if (!kind) {
        out.warnings.push(`„${f.name}“ ist kein Moodle-Testexport (keine Fragen- oder Punktespalten).`);
        continue;
      }
      if ((kind === 'grades' && grades) || (kind === 'answers' && answers)) {
        out.warnings.push(`„${f.name}“ wird ignoriert: Es wurde schon eine ${kind === 'grades' ? 'Bewertungen' : 'Antworten'}-CSV gewählt.`);
        continue;
      }
      const entry = { name: f.name, kind, text: f.text, rows, col };
      if (kind === 'grades') grades = entry;
      else answers = entry;
      out.files.push({ name: f.name, kind, text: f.text });
    }
    if (!answers && !grades) return out;

    const base = (answers || grades).name.replace(/\.csv$/i, '').replace(/-(Antworten|Bewertungen)$/i, '');
    out.title = base.includes('-') ? base.slice(base.indexOf('-') + 1).trim() : base.trim();

    const nrs = new Set();
    if (grades) Object.keys(grades.col.punkte).forEach((n) => nrs.add(Number(n)));
    else Object.keys(Object.assign({}, answers.col.antwort, answers.col.frage)).forEach((n) => nrs.add(Number(n)));
    out.questions = [...nrs].sort((x, y) => x - y).map((nr) => ({ nr, max: grades ? grades.col.punkte[nr].max || 0 : 1 }));
    out.totalMax = (grades || answers).col.totalMax;

    const cell = (f, r, i) => (i === undefined ? '' : String(r[i] === undefined ? '' : r[i]).trim());
    const person = (f, r) => ({
      last: cell(f, r, f.col.last),
      first: cell(f, r, f.col.first),
      email: cell(f, r, f.col.email).toLowerCase(),
      status: cell(f, r, f.col.status),
      startedRaw: cell(f, r, f.col.started),
    });
    const keyOf = (p) => (p.email || norm(p.last + '|' + p.first)) + '#' + p.startedRaw;

    // Bewertungen nach Person + Beginn (bei mehreren Versuchen)
    const gradeRows = new Map();
    if (grades) {
      for (const r of grades.rows.slice(1)) {
        const p = person(grades, r);
        if (!p.email && !p.status) continue; // z. B. Durchschnittszeile am Dateiende
        gradeRows.set(keyOf(p), r);
      }
    }
    const used = new Set();
    const attempt = (p, aRow, gRow) => {
      const finished = norm(p.status).includes('beendet') || norm(p.status).includes('abgeschlossen');
      const a = { last: p.last, first: p.first, email: p.email, finished, status: p.status, date: parseDate(p.startedRaw), scores: {}, answers: {}, total: null, pending: [] };
      for (const { nr, max } of out.questions) {
        if (aRow) {
          const c = answers.col;
          const given = cell(answers, aRow, c.antwort[nr]);
          a.answers[nr] = { q: questionText(cell(answers, aRow, c.frage[nr])), a: given === '-' ? '' : given, c: cell(answers, aRow, c.richtig[nr]) };
        }
        if (gRow) {
          const raw = cell(grades, gRow, grades.col.punkte[nr].i);
          a.scores[nr] = num(raw);
          // z. B. Freitext: „Bewertung notwendig“ – in Moodle noch nicht bewertet
          if (a.scores[nr] === null && raw !== '' && raw !== '-') a.pending.push(nr);
        }
        else if (aRow) {
          const x = a.answers[nr];
          a.scores[nr] = x.a === '' ? null : x.c !== '' && answerNorm(x.a) === answerNorm(x.c) ? max : 0;
        }
      }
      const tf = gRow ? grades : answers;
      const tr = gRow || aRow;
      a.total = tf.col.total === undefined ? null : num(cell(tf, tr, tf.col.total));
      if (a.total === null && finished) a.total = Object.values(a.scores).reduce((s, v) => s + (v || 0), 0);
      return a;
    };
    if (answers) {
      for (const r of answers.rows.slice(1)) {
        const p = person(answers, r);
        if (!p.email && !p.status) continue;
        for (const { nr } of out.questions) {
          const q = normText(cell(answers, r, answers.col.frage[nr]));
          if (q && q !== '-') (out.texts[nr] = out.texts[nr] || []).includes(q) || out.texts[nr].push(q);
        }
        const k = keyOf(p);
        used.add(k);
        out.attempts.push(attempt(p, r, gradeRows.get(k)));
      }
    }
    for (const [k, r] of gradeRows) if (!used.has(k)) out.attempts.push(attempt(person(grades, r), null, r));

    // Je Person der beste beendete Versuch (sonst der letzte)
    const byPerson = new Map();
    for (const a of out.attempts) {
      const k = a.email || norm(a.last + '|' + a.first);
      const cur = byPerson.get(k);
      const better = !cur || (a.finished && !cur.finished) || (a.finished === cur.finished && (a.total || 0) >= (cur.total || 0));
      if (better) byPerson.set(k, a);
    }
    out.persons = [...byPerson.values()].sort((x, y) => x.last.localeCompare(y.last, 'de') || x.first.localeCompare(y.first, 'de'));
    for (const p of out.persons) if (p.finished) for (const nr of p.pending) out.pending[nr] = (out.pending[nr] || 0) + 1;
    return out;
  }

  // ---------- Begleitdatei (Kompetenzen aus moodle.py) ----------

  const COMPANION_FORMAT = 'ordonota-moodle-kompetenzen';

  /** Leerraum (auch geschützte Leerzeichen) zusammenfassen, wie Moodle es in der CSV tut. */
  const normText = (s) => String(s === undefined || s === null ? '' : s).replace(/[\s  ]+/g, ' ').trim();

  /** Begleitdatei lesen: { katalog: { id, version }, test, fragen: [{ name, textanfang, kompetenzen }] }; unbekannte Felder werden übergangen. */
  function parseCompanion(text) {
    let d;
    try {
      d = JSON.parse(String(text).replace(/^﻿/, ''));
    } catch (e) {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    if (!d || d.format !== COMPANION_FORMAT) throw new Error('Das ist keine Begleitdatei mit Kompetenzen (ordonota-moodle-kompetenzen).');
    if (d.formatVersion !== 1) throw new Error(`Die Begleitdatei hat Formatversion ${d.formatVersion}, OrdoNota kennt nur 1. Bitte OrdoNota aktualisieren.`);
    if (!Array.isArray(d.fragen)) throw new Error('In der Begleitdatei fehlt die Liste „fragen“.');
    const k = d.katalog && typeof d.katalog === 'object' ? d.katalog : {};
    const str = (v) => (typeof v === 'string' ? v : '');
    return {
      katalog: { id: str(k.id).trim(), version: Number.isFinite(Number(k.version)) ? Number(k.version) : null },
      test: str(d.test).trim(),
      fragen: d.fragen
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({
          name: str(f.name).trim(),
          textanfang: normText(f.textanfang),
          kompetenzen: [...new Set((Array.isArray(f.kompetenzen) ? f.kompetenzen : []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))],
        })),
    };
  }

  /**
   * Moodle-Fragen den Fragen der Begleitdatei zuordnen: Der CSV-Text muss mit `textanfang` beginnen (nach dem Zusammenfassen
   * des Leerraums; ohne Treffer ohne Groß-/Kleinschreibung). Bei mehreren Treffern gilt der längste, gleich lange → nicht eindeutig.
   * Ergebnis je Frage: { nr, text, frage (Index oder null), status: 'ok' | 'ambig' | 'none' | 'random' | 'notext' }.
   *   random = in derselben Nummer stehen verschiedene Texte (Zufallsfragen), notext = keine Antworten-CSV.
   */
  function matchCompanion(parsed, companion) {
    const fragen = companion ? companion.fragen : [];
    const find = (t, fold) => {
      const f = fold ? (x) => x.toLocaleLowerCase('de') : (x) => x;
      const tt = f(t);
      let best = [];
      let len = 0;
      fragen.forEach((q, i) => {
        if (!q.textanfang || !tt.startsWith(f(q.textanfang))) return;
        if (q.textanfang.length > len) (best = [i]), (len = q.textanfang.length);
        else if (q.textanfang.length === len) best.push(i);
      });
      return best;
    };
    return parsed.questions.map(({ nr }) => {
      const texts = parsed.texts[nr] || [];
      if (!texts.length) return { nr, text: '', frage: null, status: 'notext' };
      if (texts.length > 1) return { nr, text: texts[0], frage: null, status: 'random' };
      let hit = find(texts[0], false);
      if (!hit.length) hit = find(texts[0], true);
      return { nr, text: texts[0], frage: hit.length === 1 ? hit[0] : null, status: hit.length === 1 ? 'ok' : hit.length ? 'ambig' : 'none' };
    });
  }

  /**
   * Kompetenzen je Moodle-Nummer aus der Zuordnung. choice: { kennung: '' (weglassen) | andere Kennung }; fehlt eine
   * Kennung in choice, bleibt sie, wie sie ist. Zeilen ohne Frage (frage = null) fehlen im Ergebnis.
   */
  function companionCompetencies(companion, rows, choice = {}) {
    const out = {};
    for (const r of rows) {
      if (r.frage === null || r.frage === undefined || !companion.fragen[r.frage]) continue;
      const ids = companion.fragen[r.frage].kompetenzen.map((id) => (Object.prototype.hasOwnProperty.call(choice, id) ? choice[id] : id)).filter(Boolean);
      out[r.nr] = [...new Set(ids)];
    }
    return out;
  }

  /** Aufgaben eines Tests (bzw. eines Teils) zu den Moodle-Nummern: { nr: task }. */
  function tasksByNr(test, part) {
    const inPart = (x) => !part || x.partId === part.id || (part === test.parts[0] && !test.parts.some((y) => y.id === x.partId));
    const out = {};
    for (const x of test.tasks) if (x.moodleNr !== undefined && inPart(x) && !out[x.moodleNr]) out[x.moodleNr] = x;
    return out;
  }

  /** Kompetenzen an die Aufgaben schreiben (byNr aus companionCompetencies); leere Liste entfernt das Feld. Gibt die Anzahl geänderter Aufgaben zurück. */
  function setCompetencies(test, part, byNr) {
    const tasks = tasksByNr(test, part);
    let n = 0;
    for (const [nr, ids] of Object.entries(byNr || {})) {
      const t = tasks[nr];
      if (!t) continue;
      const before = (t.competencies || []).join('|');
      if (ids.length) t.competencies = ids.slice();
      else delete t.competencies;
      if ((t.competencies || []).join('|') !== before) n++;
    }
    return n;
  }

  // ---------- Zuordnung ----------

  /** Moodle-Personen den Kursmitgliedern zuordnen: zuerst über die gemerkte E-Mail, dann über Nach- und Vorname. */
  function matchStudents(persons, students) {
    const map = new Map();
    const taken = new Set();
    const nameKey = (last, first) => norm(last) + '|' + norm(first);
    for (const p of persons) {
      const s = p.email && students.find((x) => x.email && x.email.toLowerCase() === p.email && !taken.has(x.id));
      if (s) {
        map.set(p, s.id);
        taken.add(s.id);
      }
    }
    for (const p of persons) {
      if (map.has(p)) continue;
      const s = students.find((x) => !taken.has(x.id) && nameKey(x.last, x.first) === nameKey(p.last, p.first));
      if (s) {
        map.set(p, s.id);
        taken.add(s.id);
      }
    }
    return map;
  }

  // ---------- Übernehmen ----------

  /** Feinste Punkte-Genauigkeit, die alle Werte braucht (1, 0,5 oder 0,1). */
  function precisionFor(values) {
    const fits = (step) => values.every((v) => Math.abs(v / step - Math.round(v / step)) < 1e-6);
    return fits(1) ? 1 : fits(0.5) ? 0.5 : 0.1;
  }

  /**
   * Import in einen Test übernehmen (a = null → neuen Test anlegen).
   * map: Moodle-Person → studentId (fehlend = nicht übernehmen).
   * Kursmitglieder ohne beendeten Versuch bekommen „fehlt“, sofern noch keine Punkte eingetragen sind.
   * replace: bisherige Aufgaben (des Tests bzw. des Teils), die nicht zu einer Moodle-Frage gehören, samt Punkten entfernen.
   * adopt (bestehender Test): Bezeichnung (name) und Datum des Moodle-Versuchs übernehmen, z. B. bei einem frisch angelegten Test.
   * competencies: { nr: [kennung, …] } aus companionCompetencies – ersetzt die Kompetenzen dieser Aufgaben, die übrigen bleiben.
   */
  function applyImport(course, a, parsed, map, { half, settings, name, date, cat, partId = null, replace = false, adopt = false, competencies = null } = {}) {
    const isNew = !a;
    if (isNew) {
      a = M.newTest(course, half, settings);
      a.test.tasks = [];
      a.cat = cat || 'other';
    }
    if (isNew || adopt) {
      a.name = name || parsed.title || 'Moodle-Test';
      const dates = parsed.persons.map((p) => p.date).filter(Boolean);
      if (date) a.date = date;
      else if (dates.length) a.date = dates.sort()[Math.floor(dates.length / 2)];
    }
    const t = a.test;
    // Import in einen Teil der Arbeit (Aufgaben, Dateien und Genauigkeit gehören dann zum Teil)
    const part = partId && G.hasParts(t) ? t.parts.find((x) => x.id === partId) || null : null;
    const inPart = (x) => !part || x.partId === part.id || (part === t.parts[0] && !t.parts.some((y) => y.id === x.partId));
    if (replace) {
      const nrs = new Set(parsed.questions.map((q) => q.nr));
      const gone = new Set(t.tasks.filter((x) => inPart(x) && !(x.moodleNr !== undefined && nrs.has(x.moodleNr))).map((x) => x.id));
      t.tasks = t.tasks.filter((x) => !gone.has(x.id));
      for (const r of Object.values(t.results || {})) for (const id of gone) if (r.scores) delete r.scores[id];
      const mo = (part || t).moodle;
      if (mo) for (const x of Object.values(mo.answers || {})) for (const id of gone) delete x[id];
    }
    const taskOf = {};
    for (const { nr, max } of parsed.questions) {
      let task = t.tasks.find((x) => x.moodleNr === nr && inPart(x));
      if (!task) {
        task = { id: uid(), name: 'F' + nr, max, moodleNr: nr };
        if (part) task.partId = part.id;
        t.tasks.push(task);
      }
      task.max = max;
      taskOf[nr] = task;
    }
    const owner = part || t;
    const moodle = (owner.moodle = owner.moodle || { answers: {} });
    // Eine früher importierte Begleitdatei bleibt, wenn diesmal keine dabei ist
    const keepKomp = parsed.files.some((f) => f.kind === 'komp') ? [] : (moodle.files || []).filter((f) => f.kind === 'komp');
    moodle.files = parsed.files.map((f) => ({ name: f.name, kind: f.kind, text: f.text })).concat(keepKomp);
    moodle.importedAt = new Date().toISOString();
    moodle.totalMax = parsed.totalMax;

    const summary = { imported: 0, missing: [], mismatch: [] };
    const done = new Set();
    const values = parsed.questions.map((q) => q.max);
    for (const [p, sid] of map) {
      const s = course.students.find((x) => x.id === sid);
      if (!s) continue;
      if (p.email) {
        for (const o of course.students) if (o !== s && o.email === p.email) delete o.email;
        s.email = p.email;
      }
      if (!p.finished) continue;
      const r = (t.results[sid] = t.results[sid] || { scores: {} });
      r.scores = r.scores || {};
      for (const { nr } of parsed.questions) {
        const v = p.scores[nr] === null || p.scores[nr] === undefined ? 0 : p.scores[nr];
        r.scores[taskOf[nr].id] = v;
        values.push(v);
      }
      if (r.status === 'fehlt' || r.status === 'nachschreiben') delete r.status;
      if (part && r.partStatus) delete r.partStatus[part.id];
      if (Object.keys(p.answers).length) {
        moodle.answers[sid] = {};
        for (const { nr } of parsed.questions) moodle.answers[sid][taskOf[nr].id] = p.answers[nr];
      }
      const sum = parsed.questions.reduce((x, q) => x + (p.scores[q.nr] || 0), 0);
      if (p.total !== null && Math.abs(sum - p.total) > 0.05) summary.mismatch.push(M.studentName(s));
      summary.imported++;
      done.add(sid);
    }
    const filled = (v) => v !== null && v !== undefined && v !== '';
    const partTaskIds = part ? new Set(G.partTasks(t, part).map((x) => x.id)) : null;
    for (const s of M.activeStudents(course)) {
      if (done.has(s.id)) continue;
      const r = t.results[s.id];
      const scores = (r && r.scores) || {};
      const hasScores = Object.values(scores).some(filled);
      if (r && r.status) continue;
      if (hasScores) {
        // Nur dieser Teil fehlt: bei getrennt benoteten Teilen als Status des Teils vermerken
        if (part && G.separateParts(t) && !Object.keys(scores).some((id) => partTaskIds.has(id) && filled(scores[id])) && !(r.partStatus || {})[part.id]) {
          r.partStatus = Object.assign(r.partStatus || {}, { [part.id]: 'fehlt' });
          summary.missing.push(M.studentName(s));
        }
        continue;
      }
      t.results[s.id] = { scores: {}, status: 'fehlt' };
      summary.missing.push(M.studentName(s));
    }
    const prec = precisionFor(values);
    const precOwner = part && G.separateParts(t) ? part : t;
    const curPrec = precOwner.precision !== undefined ? precOwner.precision : t.precision;
    // Genauigkeit aus Moodle übernehmen (neuer Test bzw. alle eigenen Aufgaben ersetzt), sonst nur feiner stellen
    if (isNew || (replace && (!part || G.separateParts(t))) || prec < Number(curPrec)) precOwner.precision = prec;
    if (competencies) summary.competencies = setCompetencies(t, part, competencies);
    if (isNew) course.assessments.push(a);
    summary.assessment = a;
    return summary;
  }

  /** Moodle-Daten eines Tests: beim Test selbst und bei seinen Teilen. */
  function sources(test) {
    return [test.moodle, ...(test.parts || []).map((p) => p.moodle)].filter(Boolean);
  }

  function hasData(test) {
    return sources(test).length > 0;
  }

  /** Fragen und Antworten je Person aus allen Moodle-Importen des Tests: { sid: { taskId: { q, a, c } } }. */
  function answersOf(test) {
    const out = {};
    for (const mo of sources(test)) for (const [sid, x] of Object.entries(mo.answers || {})) out[sid] = Object.assign(out[sid] || {}, x);
    return out;
  }

  /** Mehrere Moodle-Importe zu einem zusammenfassen (wenn Teile aufgehoben werden). */
  function mergeData(list) {
    const answers = {};
    for (const mo of list) for (const [sid, x] of Object.entries(mo.answers || {})) answers[sid] = Object.assign(answers[sid] || {}, x);
    return {
      importedAt: list.map((m) => m.importedAt || '').sort().pop(),
      totalMax: list.reduce((s, m) => s + (Number(m.totalMax) || 0), 0),
      files: list.flatMap((m) => m.files || []),
      answers,
    };
  }

  NM.moodle = { parseCsv, parseExport, parseDate, questionText, normText, parseCompanion, matchCompanion, companionCompetencies, tasksByNr, setCompetencies, matchStudents, applyImport, precisionFor, hasData, answersOf, mergeData };
})((globalThis.NM = globalThis.NM || {}));
