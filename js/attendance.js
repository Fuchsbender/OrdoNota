/* OrdoNota – Fehlzeiten je Kurs (seit 1.45): reine Logik ohne DOM.
   course.attendance = { "<YYYY-MM-DD>": { half, hours, abs: { "<sid>": "a" | "e" | "u" } } }
   a = abwesend (Entschuldigung offen), e = entschuldigt, u = unentschuldigt; hours = Unterrichtsstunden an dem Tag.
   Ein k in einer EPO-Stunde bedeutet immer „abwesend“ an diesem Datum (syncFromEpo, syncToEpo, fromEpo). */
(function (NM) {
  'use strict';

  const STATES = ['a', 'e', 'u'];
  const LABELS = { a: 'abwesend, Entschuldigung offen', e: 'entschuldigt', u: 'unentschuldigt' };
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  /** Fehlzeiten des Kurses (legt das Objekt bei Bedarf an). */
  function data(course) {
    if (!course.attendance || typeof course.attendance !== 'object' || Array.isArray(course.attendance)) course.attendance = {};
    return course.attendance;
  }

  /** Halbjahr zu einem Datum: Februar–Juli → zweites, sonst erstes (wie die Vorauswahl der App). */
  function halfOfDate(halves, date) {
    if (halves.length < 2) return halves[0];
    const m = Number(String(date || '').slice(5, 7));
    return m >= 2 && m <= 7 ? halves[1] : halves[0];
  }

  /** Tag anlegen (falls nötig) und zurückgeben. */
  function day(course, date, half) {
    const all = data(course);
    if (!all[date]) all[date] = { half: half || halfOfDate(NM.grades.halvesFor(course), date), hours: 1, abs: {} };
    return all[date];
  }

  /** Zustand einer Person an einem Tag: '' (anwesend/kein Eintrag), 'a', 'e' oder 'u'. */
  function get(course, date, sid) {
    const d = (course.attendance || {})[date];
    return (d && d.abs && STATES.includes(d.abs[sid]) && d.abs[sid]) || '';
  }

  /** Zustand setzen; '' entfernt den Eintrag (der Tag bleibt als Unterrichtstag stehen). */
  function set(course, date, sid, v, half) {
    if (!STATES.includes(v)) {
      const d = (course.attendance || {})[date];
      if (d && d.abs) delete d.abs[sid];
      return;
    }
    day(course, date, half).abs[sid] = v;
  }

  /** Nächster Zustand beim Klicken: – → a → e → u → –. */
  function cycle(v) {
    return { '': 'a', a: 'e', e: 'u', u: '' }[v || ''];
  }

  /** Daten eines Halbjahres, aufsteigend. */
  function dates(course, half) {
    const all = course.attendance || {};
    return Object.keys(all)
      .filter((d) => all[d] && all[d].half === half)
      .sort();
  }

  /** Wer an diesem Datum fehlt (neues Set, Änderungen wirken nicht zurück). */
  function awaySet(course, date) {
    const d = (course.attendance || {})[date];
    return new Set(d && d.abs ? Object.keys(d.abs).filter((sid) => STATES.includes(d.abs[sid])) : []);
  }

  /** Summen einer Person in einem Halbjahr, in Unterrichtsstunden: { days, hours, a, e, u }. Immer berechnet. */
  function totals(course, half, sid) {
    const out = { days: 0, hours: 0, a: 0, e: 0, u: 0 };
    for (const date of dates(course, half)) {
      const v = get(course, date, sid);
      if (!v) continue;
      const n = hoursOf(course.attendance[date]);
      out.days++;
      out.hours += n;
      out[v] += n;
    }
    return out;
  }

  function hoursOf(d) {
    const n = Number(d && d.hours);
    return n >= 1 ? Math.round(n) : 1;
  }

  /** Halbjahre, in denen es Einträge gibt (für Ausdrucke und Notfallwerkzeug). */
  function hasData(course, half) {
    return dates(course, half).some((date) => awaySet(course, date).size > 0);
  }

  // ---------- Abgleich mit EPO (k = abwesend) ----------

  function epoLessonsOn(course, date) {
    const out = [];
    for (const a of course.assessments || []) {
      if (a.kind !== 'epo' || !a.epo) continue;
      for (const l of a.epo.lessons || []) if (l.date === date) out.push({ a, l });
    }
    return out;
  }

  /**
   * Nach einer Änderung in der EPO-Zelle: neu k → „abwesend“ eintragen (wenn noch nichts steht).
   * k durch eine Bewertung ersetzt → die Person war da, die Fehlzeit entfällt. k nur gelöscht →
   * ein offenes „a“ verschwindet, „e“/„u“ bleiben (bewusst eingetragen).
   */
  function syncFromEpo(course, a, lesson, sid, before, after) {
    if (!lesson || !lesson.date) return;
    const wasK = !!before && before.r === 'k';
    const isK = !!after && after.r === 'k';
    const rated = !!after && NM.grades.EPO_RATINGS.includes(after.r);
    if (isK && !get(course, lesson.date, sid)) set(course, lesson.date, sid, 'a', a.half);
    else if (wasK && !isK && (rated || get(course, lesson.date, sid) === 'a')) {
      set(course, lesson.date, sid, '');
      syncToEpo(course, lesson.date, sid); // andere EPO-Stunden am selben Tag
    }
  }

  /**
   * Nach einer Änderung der Fehlzeit: EPO-Stunden desselben Datums bekommen k (leere Zelle)
   * bzw. verlieren ein k (Zusätze wie u/h/m bleiben).
   */
  function syncToEpo(course, date, sid) {
    const absent = !!get(course, date, sid);
    for (const { a, l } of epoLessonsOn(course, date)) {
      const e = a.epo;
      e.entries = e.entries || {};
      const row = (e.entries[sid] = e.entries[sid] || {});
      const c = row[l.id];
      if (absent && NM.grades.epoCellEmpty(c)) row[l.id] = { r: 'k', hw: '' };
      else if (absent && c && !c.r) c.r = 'k';
      else if (!absent && c && c.r === 'k') {
        c.r = '';
        if (NM.grades.epoCellEmpty(c)) delete row[l.id];
      }
    }
  }

  /** Abwesend setzen oder aufheben (z. B. „Heute abwesend“), mit Abgleich in EPO. */
  function setAbsent(course, date, sid, on, half) {
    if (on && !get(course, date, sid)) set(course, date, sid, 'a', half);
    if (!on) set(course, date, sid, '');
    syncToEpo(course, date, sid);
  }

  /** Alle k aus EPO-Blöcken als „abwesend“ übernehmen, wo noch nichts steht (Migration, idempotent). */
  function fromEpo(course) {
    for (const a of course.assessments || []) {
      if (a.kind !== 'epo' || !a.epo) continue;
      for (const l of a.epo.lessons || []) {
        if (!l.date || !DATE.test(l.date)) continue;
        for (const [sid, row] of Object.entries(a.epo.entries || {})) {
          const c = row && row[l.id];
          if (c && c.r === 'k' && !get(course, l.date, sid)) set(course, l.date, sid, 'a', a.half);
        }
      }
    }
  }

  /** Tag mit Stundenzahl anlegen bzw. ändern. */
  function setHours(course, date, hours, half) {
    day(course, date, half).hours = Math.max(1, Math.round(Number(hours) || 1));
  }

  /** Tag löschen; k in EPO-Stunden dieses Datums werden mit entfernt (sonst käme der Tag beim Laden zurück). */
  function removeDay(course, date) {
    const away = awaySet(course, date);
    delete data(course)[date];
    for (const sid of away) syncToEpo(course, date, sid);
  }

  /** Bereinigen beim Laden: ungültige Tage/Werte entfernen, Stunden ≥ 1. */
  function clean(course, halves) {
    const all = data(course);
    for (const date of Object.keys(all)) {
      const d = all[date];
      if (!DATE.test(date) || !d || typeof d !== 'object') {
        delete all[date];
        continue;
      }
      if (!d.abs || typeof d.abs !== 'object' || Array.isArray(d.abs)) d.abs = {};
      for (const sid of Object.keys(d.abs)) if (!STATES.includes(d.abs[sid])) delete d.abs[sid];
      d.hours = hoursOf(d);
      if (!halves.includes(d.half)) d.half = halfOfDate(halves, date);
    }
  }

  NM.attendance = { STATES, LABELS, data, halfOfDate, day, get, set, cycle, dates, awaySet, totals, hoursOf, hasData, syncFromEpo, syncToEpo, setAbsent, fromEpo, setHours, removeDay, clean };
})(window.NM = window.NM || {});
