/* OrdoNota – Logik des Reiters „Ziehen“ (rein, ohne DOM): klassischer Pool und benannte Pools.
   Klassischer Pool (course.draw.out/history, seit 1.11): jede Ziehung legt eine eigene Notenspalte an,
   ist der Pool leer, wird er aufgefüllt. Benannte Pools (course.draw.pools, seit 1.37): alle Ziehungen
   landen in einer Sammelspalte; der Pool ist nach einer Runde fertig. */
(function (NM) {
  'use strict';
  const M = NM.model;
  const { uid, todayISO } = NM.util;

  /** Ziehungsdaten des Kurses mit allen Feldern. */
  function data(course) {
    course.draw = course.draw || {};
    const d = course.draw;
    d.out = d.out || {};
    d.history = d.history || [];
    d.pools = Array.isArray(d.pools) ? d.pools : [];
    for (const p of d.pools) {
      p.out = p.out || {};
      p.history = p.history || [];
    }
    return d;
  }

  function shuffle(list, rand = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * n Personen aus ids ziehen, die nicht in out stehen und nicht abwesend sind; sie kommen in out.
   * refill: reicht es nicht, werden die Übrigen gezogen, out geleert und der Rest daraus gezogen
   * (klassischer Pool). Ohne refill werden nur die Übrigen gezogen (benannter Pool).
   * @returns {{ sids, refilled, prevOut }}
   */
  function drawFrom(src, ids, n, { away = new Set(), rand = Math.random, refill = false, date = todayISO() } = {}) {
    const prevOut = JSON.parse(JSON.stringify(src.out || {}));
    src.out = src.out || {};
    const available = (skip) => ids.filter((id) => !src.out[id] && !away.has(id) && !skip.includes(id));
    let sids = shuffle(available([]), rand).slice(0, n);
    let refilled = false;
    if (sids.length < n && refill) {
      src.out = {};
      refilled = true;
      sids = sids.concat(shuffle(available(sids), rand).slice(0, n - sids.length));
    }
    for (const sid of sids) src.out[sid] = { how: 'drawn', date };
    return { sids, refilled, prevOut };
  }

  /** Aktive Personen, die im Pool noch nicht dran waren (herausgenommene zählen nicht). */
  function left(course, pool) {
    return M.activeStudents(course).filter((s) => !pool.out[s.id]);
  }

  /** Ein benannter Pool ist fertig, wenn niemand mehr übrig ist (und schon gezogen wurde). */
  function finished(course, pool) {
    return pool.history.length > 0 && left(course, pool).length === 0;
  }

  /** Neuer Pool mit Sammelspalte (sonstige Leistungen, Gewicht 1) im Halbjahr half. */
  function newPool(course, half, name) {
    const d = data(course);
    const a = M.newManual(half, 'other', name);
    course.assessments.push(a);
    const pool = { id: uid(), name, half, aid: a.id, created: todayISO(), out: {}, history: [] };
    d.pools.push(pool);
    return pool;
  }

  /** Aus einem benannten Pool ziehen (ohne Auffüllen). */
  function drawPool(course, pool, n, opts = {}) {
    const ids = M.activeStudents(course).map((s) => s.id);
    const r = drawFrom(pool, ids, n, Object.assign({}, opts, { refill: false }));
    if (r.sids.length) pool.history.push({ id: uid(), date: opts.date || todayISO(), sids: r.sids, prevOut: r.prevOut });
    return Object.assign(r, { finished: finished(course, pool) });
  }

  /** Letzte Ziehung eines Pools zurücknehmen: Pool wie vorher, Noten der Gezogenen aus der Sammelspalte löschen. */
  function undoPool(course, pool) {
    const e = pool.history.pop();
    if (!e) return null;
    pool.out = e.prevOut || {};
    const a = course.assessments.find((x) => x.id === pool.aid);
    if (a) for (const sid of e.sids) if (!pool.history.some((h) => h.sids.includes(sid))) delete a.manual.grades[sid];
    return e;
  }

  /** Zeitraum der Ziehungen eines Pools (bzw. Datum der Spalte), z. B. ['2026-09-12', '2026-10-03']. */
  function poolRange(pool) {
    const d = pool.history.map((e) => e.date).filter(Boolean).sort();
    return d.length ? [d[0], d[d.length - 1]] : null;
  }

  /** Spalte → wer wurde dafür gezogen (klassisch und Pools); für die Notenübersicht. */
  function drawnSets(course) {
    const d = course.draw || {};
    const m = new Map();
    for (const e of d.history || []) m.set(e.aid, new Set(e.sids));
    for (const p of d.pools || []) m.set(p.aid, new Set((p.history || []).flatMap((e) => e.sids)));
    return m;
  }

  /** Pool zur Spalte aid (oder null). */
  function poolOfColumn(course, aid) {
    return ((course.draw && course.draw.pools) || []).find((p) => p.aid === aid) || null;
  }

  const gradeOf = (a, sid) => (a && a.manual && a.manual.grades[sid]) || null;
  const hasGrade = (g) => !!g && (g.status || (g.p !== undefined && g.p !== null));

  /**
   * Prüfung auf Ziehfehler. Liefert [{ kind, sid, aid, date, text }]:
   *  ungezogen – Note in einer Ziehungsspalte, aber die Person wurde dafür nicht gezogen
   *  ohneNote  – gezogen, aber noch keine Note
   *  doppelt   – in einem Pool mehrmals gezogen
   *  spalte    – die Notenspalte des Pools oder der Ziehung fehlt
   * Jeder Eintrag trägt das Halbjahr (half). Nur aktive Personen; ändert nichts.
   * pool: nur diesen Pool prüfen; sonst alle Pools (pools) und den klassischen Pool (classic).
   */
  function check(course, pool = null, { pools: withPools = true, classic = true } = {}) {
    const d = data(course);
    const out = [];
    const active = new Map(M.activeStudents(course).map((s) => [s.id, s]));
    const name = (sid) => (active.get(sid) ? M.studentName(active.get(sid)) : sid);
    const scan = (a, drawn, dates, label, half) => {
      const push = (x) => out.push(Object.assign(x, { half }));
      if (!a) return push({ kind: 'spalte', text: `${label}: Notenspalte wurde gelöscht` });
      for (const [sid, g] of Object.entries(a.manual.grades))
        if (active.has(sid) && hasGrade(g) && !drawn.has(sid)) push({ kind: 'ungezogen', sid, aid: a.id, text: `${name(sid)}: Note in „${a.name}“, aber nicht gezogen` });
      for (const sid of drawn)
        if (active.has(sid) && !hasGrade(gradeOf(a, sid))) push({ kind: 'ohneNote', sid, aid: a.id, date: dates.get(sid), text: `${name(sid)}: gezogen am ${NM.util.fmtDateShort(dates.get(sid))}, noch ohne Note in „${a.name}“` });
    };
    const pools = pool ? [pool] : withPools ? d.pools : [];
    for (const p of pools) {
      const a = course.assessments.find((x) => x.id === p.aid);
      const dates = new Map();
      const seen = new Map();
      for (const e of p.history)
        for (const sid of e.sids) {
          if (seen.has(sid) && active.has(sid)) out.push({ kind: 'doppelt', sid, aid: p.aid, half: p.half, text: `${name(sid)}: im Pool „${p.name}“ zweimal gezogen (${NM.util.fmtDateShort(seen.get(sid))} und ${NM.util.fmtDateShort(e.date)})` });
          seen.set(sid, e.date);
          dates.set(sid, e.date);
        }
      scan(a, new Set(dates.keys()), dates, `Pool „${p.name}“`, p.half);
    }
    if (!pool && classic)
      for (const e of d.history) {
        const a = course.assessments.find((x) => x.id === e.aid);
        scan(a, new Set(e.sids), new Map(e.sids.map((sid) => [sid, e.date])), `Ziehung vom ${NM.util.fmtDateShort(e.date)}`, a ? a.half : e.half);
      }
    return out;
  }

  /** Klassische Ziehungen mit noch vorhandener Spalte im Halbjahr half (Kandidaten zum Zusammenfassen). */
  function classicColumns(course, half) {
    const d = data(course);
    return d.history
      .map((e) => ({ e, a: course.assessments.find((x) => x.id === e.aid) }))
      .filter((x) => x.a && x.a.half === half);
  }

  /** Personen mit Noten in mehr als einer der Spalten aids: [{ sid, grades: [{ aid, date, g }] }]. */
  function mergeConflicts(course, aids) {
    const by = new Map();
    for (const aid of aids) {
      const a = course.assessments.find((x) => x.id === aid);
      if (!a) continue;
      for (const [sid, g] of Object.entries(a.manual.grades))
        if (hasGrade(g)) (by.get(sid) || by.set(sid, []).get(sid)).push({ aid, date: a.date, g });
    }
    return [...by.entries()].filter(([, list]) => list.length > 1).map(([sid, grades]) => ({ sid, grades }));
  }

  /**
   * Klassische Ziehungsspalten aids zu einem neuen Pool zusammenfassen. Die Noten kommen in die
   * Sammelspalte; bei mehreren Noten einer Person entscheidet prefer: 'newer' (spätere Ziehung) oder
   * 'better' (bessere Note; Status wie „fehlt“ zählt schlechter als jede Note). Die Einzelspalten und
   * ihre Ziehungen werden entfernt, die Gezogenen stehen im neuen Pool als „gezogen“.
   */
  function merge(course, half, aids, name, prefer = 'newer') {
    const d = data(course);
    const items = classicColumns(course, half).filter((x) => aids.includes(x.a.id)).sort((x, y) => (x.e.date < y.e.date ? -1 : x.e.date > y.e.date ? 1 : 0));
    if (items.length < 1) return null;
    const pool = newPool(course, half, name);
    const target = course.assessments.find((x) => x.id === pool.aid);
    target.date = items[0].a.date || items[0].e.date;
    const rank = (g) => (g.status ? -1 : g.p);
    for (const { e, a } of items) {
      for (const [sid, g] of Object.entries(a.manual.grades)) {
        if (!hasGrade(g)) continue;
        const cur = target.manual.grades[sid];
        if (!cur || prefer === 'newer' || rank(g) > rank(cur)) target.manual.grades[sid] = JSON.parse(JSON.stringify(g));
      }
      const sids = e.sids.filter((sid) => !pool.out[sid]);
      for (const sid of e.sids) pool.out[sid] = { how: 'drawn', date: e.date };
      if (sids.length) pool.history.push({ id: uid(), date: e.date, sids, prevOut: {} });
    }
    const gone = new Set(items.map((x) => x.a.id));
    course.assessments = course.assessments.filter((x) => !gone.has(x.id));
    d.history = d.history.filter((e) => !gone.has(e.aid));
    // Ziehungen wurden mit dem Pool-Stand davor rückgängig gemacht; nach dem Zusammenfassen gibt es kein „Rückgängig“ mehr dafür
    pool.history.forEach((e, i) => (e.prevOut = i ? Object.fromEntries(pool.history.slice(0, i).flatMap((x) => x.sids.map((sid) => [sid, { how: 'drawn', date: x.date }]))) : {}));
    return pool;
  }

  /** Pool löschen; die Sammelspalte bleibt (mit ihren Noten) als normale Einzelnote erhalten. */
  function removePool(course, pool) {
    const d = data(course);
    d.pools = d.pools.filter((p) => p !== pool);
  }

  NM.draw = { data, shuffle, drawFrom, left, finished, newPool, drawPool, undoPool, poolRange, drawnSets, poolOfColumn, check, classicColumns, mergeConflicts, merge, removePool };
})((globalThis.NM = globalThis.NM || {}));
