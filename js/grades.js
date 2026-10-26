/* OrdoNota – Notenlogik (rein rechnerisch, ohne DOM).
 *
 * Alle Noten werden intern als Punkte 0–15 gespeichert.
 *   MSS:   15 = 1+, 14 = 1, 13 = 1-, … , 1 = 5-, 0 = 6
 *   Sek I: wie MSS, aber ohne 1+ → höchste Stufe ist 14 (= 1)
 * Dezimalnoten (Sek I) nutzen die übliche Zwei-Nachkommastellen-Konvention:
 *   1 = 1,00 · 1- = 1,33 · 2+ = 1,67 · 2 = 2,00 · … · 5- = 5,33 · 6 = 6,00
 */
(function (NM) {
  'use strict';

  const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

  // ---------- Skalen ----------

  function maxPoints(level) {
    return level === 'mss' ? 15 : 14;
  }

  /** Ganze Note (1–6) zu Punkten, wie in der Excel-Vorlage. */
  function wholeGrade(p) {
    if (p <= 0) return 6;
    return 6 - (Math.floor((p - 1) / 3) + 1);
  }

  /** Tendenz '+', '-' oder '' zu Punkten. */
  function tendency(p) {
    if (p <= 0) return '';
    if (p % 3 === 0) return '+';
    if (p % 3 === 1) return '-';
    return '';
  }

  const GRADE_WORDS = { 1: 'sehr gut', 2: 'gut', 3: 'befriedigend', 4: 'ausreichend', 5: 'mangelhaft', 6: 'ungenügend' };

  /** Note ausgeschrieben, z. B. 2+ → „voll gut“, 2- → „noch gut“ (ohne „voll sehr gut“; 6 ohne Tendenz). */
  function gradeWord(p) {
    if (p === null || p === undefined || Number.isNaN(p)) return '';
    const g = wholeGrade(p);
    const t = g === 1 && tendency(p) === '+' ? '' : tendency(p);
    return (t === '+' ? 'voll ' : t === '-' ? 'noch ' : '') + GRADE_WORDS[g];
  }

  /** Dezimalnote zu Punkten (z. B. 13 → 1,33). */
  function pointsToDecimal(p) {
    const w = wholeGrade(p);
    const t = tendency(p);
    return round2(w + (t === '+' ? -0.33 : t === '-' ? 0.33 : 0));
  }

  /** Anzeige-Label einer Note, je nach Skala. */
  function label(p, level) {
    if (p === null || p === undefined || Number.isNaN(p)) return '';
    if (level === 'mss') return String(p).padStart(2, '0');
    return String(wholeGrade(p)) + tendency(p);
  }

  /** Alle gültigen Stufen einer Skala, beste zuerst. */
  function levels(level) {
    const out = [];
    for (let p = maxPoints(level); p >= 0; p--) {
      out.push({ p, label: label(p, level), dec: pointsToDecimal(p) });
    }
    return out;
  }

  /**
   * Eingabe parsen. Sek I: "2-", "2+", "2", "1-" (auch "2,33"/"2.3" → nächste Stufe).
   * MSS: "0".."15", "00".."15". Gibt Punkte oder null (leer) zurück; undefined = ungültig.
   */
  function parse(input, level) {
    if (input === null || input === undefined) return null;
    const s = String(input).trim().replace(/\s+/g, '');
    if (s === '') return null;
    if (level === 'mss') {
      if (!/^\d{1,2}$/.test(s)) return undefined;
      const p = parseInt(s, 10);
      return p >= 0 && p <= 15 ? p : undefined;
    }
    const m = /^([1-6])([+-]?)$/.exec(s);
    if (m) {
      const w = parseInt(m[1], 10);
      const t = m[2];
      if (w === 6) return t ? undefined : 0;
      if (w === 1 && t === '+') return undefined; // 1+ gibt es in der Sek I nicht
      const base = 17 - 3 * w; // Punkte der glatten Note: 1→14, 2→11, …, 5→2
      return base + (t === '+' ? 1 : t === '-' ? -1 : 0);
    }
    const d = /^([1-6])(?:[.,](\d{1,2}))?$/.exec(s);
    if (d) {
      const val = parseFloat(d[1] + '.' + (d[2] || '0'));
      if (val < 1 || val > 6) return undefined;
      return roundDecimal(val, 'sek1');
    }
    return undefined;
  }

  // ---------- Rundung ----------

  /**
   * Dezimal-Durchschnitt (Sek I) auf die nächste Notenstufe runden.
   * Erst auf 2 Nachkommastellen (wie angezeigt), dann nächste Stufe; bei Gleichstand die bessere.
   */
  function roundDecimal(avg, level) {
    const a = round2(avg);
    let best = null;
    let bestDist = Infinity;
    for (const l of levels(level)) {
      const dist = Math.abs(a - l.dec);
      if (dist < bestDist - 1e-9) {
        best = l;
        bestDist = dist;
      }
    }
    return best ? best.p : null;
  }

  /** Punkte-Durchschnitt (MSS) runden: ,5 zugunsten der Schülerin/des Schülers. */
  function roundPoints(avg, level) {
    const a = round2(avg);
    return Math.min(maxPoints(level), Math.max(0, Math.floor(a + 0.5)));
  }

  /**
   * Rechenwert einer Note für Durchschnitte:
   * Sek I → Dezimalnote, MSS → Punkte.
   */
  function calcValue(p, level) {
    return level === 'mss' ? p : pointsToDecimal(p);
  }

  /** Rechenwert (Durchschnitt) zur Notenstufe runden. */
  function roundValue(v, level) {
    if (v === null || v === undefined) return null;
    return level === 'mss' ? roundPoints(v, level) : roundDecimal(v, level);
  }

  /** Gewichteter Mittelwert aus [{v, w}]; null wenn leer. */
  function weightedAvg(items) {
    let sum = 0;
    let wsum = 0;
    for (const it of items) {
      if (it.v === null || it.v === undefined || !(it.w > 0)) continue;
      sum += it.v * it.w;
      wsum += it.w;
    }
    return wsum > 0 ? sum / wsum : null;
  }

  // ---------- Notenschlüssel für Tests ----------

  /** Rundet einen Punktwert auf die Genauigkeit (1, 0.5, 0.1). */
  function roundToPrecision(x, precision) {
    if (precision === 0.5) return Math.round(x * 2) / 2;
    if (precision === 0.1) return Math.round((x + Number.EPSILON) * 10) / 10;
    if (precision === 0.01) return round2(x);
    return Math.round(x);
  }

  /**
   * Prozent-Schwellen je Punktstufe.
   * MSS (wie Excel-Vorlage): 1 P. bei ½·LIMIT, linear bis 4 P. = LIMIT,
   *   darüber (101 − LIMIT)/12 je Stufe; auf 2 Nachkommastellen.
   * Sek I: 5- bei ½·LIMIT, linear bis 4- = LIMIT,
   *   darüber 11 gleiche Schritte (100 − LIMIT)/11 bis zur 1; auf ganze Prozent.
   */
  function keyPercents(level, limit) {
    const L = limit;
    const half = 0.5 * L;
    const pct = [0, half, half + (L - half) / 3, half + 2 * (L - half) / 3, L];
    if (level === 'mss') {
      for (let p = 5; p <= 15; p++) pct.push(L + (p - 4) * (101 - L) / 12);
      return pct.map(round2);
    }
    for (let p = 5; p <= 14; p++) pct.push(L + (p - 4) * (100 - L) / 11);
    return pct.map((x) => Math.round(x));
  }

  /**
   * Punktschwellen eines Tests.
   * whole (nur Sek I): nur ganze Noten 1–6 (Punkte 14, 11, 8, 5, 2, 0); eine ganze Note beginnt an der Schwelle
   * ihrer schwächsten Tendenz (z. B. 4 ab LIMIT wie sonst die 4-). Eigene Schwellen dann je ganzer Note.
   * @returns Array → {p, pct, min} (min = Mindestpunktzahl), aufsteigend nach p
   */
  function testKey(level, limit, maxScore, precision, custom, whole = false) {
    const pcts = keyPercents(level, limit);
    const steps = whole && level !== 'mss' ? [0, 2, 5, 8, 11, 14].map((p) => ({ p, at: p ? p - 1 : 0 })) : pcts.map((_, p) => ({ p, at: p }));
    return steps.map(({ p, at }) => {
      const pct = pcts[at];
      let min = p === 0 ? 0 : roundToPrecision((pct / 100) * maxScore, precision);
      const isCustom = custom && custom[p] !== undefined && custom[p] !== null && custom[p] !== '';
      if (isCustom) min = Number(custom[p]);
      const shownPct = maxScore > 0 ? round2((min / maxScore) * 100) : 0;
      return { p, pct: shownPct, min, custom: !!isCustom };
    });
  }

  /** Vergibt der Test nur ganze Noten ohne Tendenzen? (nur Sek I) */
  function wholeOnly(test, level) {
    return level !== 'mss' && !!test.wholeGrades;
  }

  /** Notenschlüssel eines Tests mit allen Einstellungen. */
  function keyForTest(test, level) {
    return testKey(level, test.limit, testMaxScore(test), test.precision, test.custom, wholeOnly(test, level));
  }

  /** Punktstufe für eine erreichte Punktzahl (höchste Stufe, deren Schwelle erreicht ist). */
  function scoreToPoints(score, key) {
    if (score === null || score === undefined) return null;
    let res = 0;
    for (const k of key) if (score >= k.min - 1e-9) res = Math.max(res, k.p);
    return res;
  }

  // ---------- Tests ----------

  function testMaxScore(test) {
    return (test.tasks || []).reduce((s, t) => s + (t.bonus ? 0 : Number(t.max) || 0), 0);
  }

  // ---------- Arbeiten in Teilen (z. B. Theorie/Praxis) ----------
  // test.parts = [{ id, name, weight, limit?, precision?, custom?, wholeGrades?, moodle? }], test.partMode = 'sum' | 'separate',
  // task.partId ordnet die Aufgabe einem Teil zu (ohne gültige Zuordnung: erster Teil).
  // 'sum': ein Schlüssel über die Gesamtpunktzahl, Teile nur zur Gliederung.
  // 'separate': jeder Teil hat einen eigenen Schlüssel; Gesamtnote = gewichteter Schnitt der Teilnoten, auf eine Stufe gerundet.

  function hasParts(test) {
    return Array.isArray(test.parts) && test.parts.length > 0;
  }

  function separateParts(test) {
    return hasParts(test) && test.partMode === 'separate';
  }

  /** Aufgaben eines Teils (Aufgaben ohne gültige Zuordnung gehören zum ersten Teil). */
  function partTasks(test, part) {
    const ids = new Set(test.parts.map((x) => x.id));
    const first = test.parts[0].id;
    return (test.tasks || []).filter((t) => (ids.has(t.partId) ? t.partId : first) === part.id);
  }

  /** Aufgaben gruppiert nach Teil: [{ part, tasks }]; ohne Teile eine Gruppe mit part = null. */
  function taskGroups(test) {
    return hasParts(test) ? test.parts.map((part) => ({ part, tasks: partTasks(test, part) })) : [{ part: null, tasks: test.tasks || [] }];
  }

  /** Aufgaben in Anzeigereihenfolge: nach Teil gruppiert, innerhalb des Teils wie eingegeben. */
  function orderedTasks(test) {
    return hasParts(test) ? test.parts.flatMap((part) => partTasks(test, part)) : test.tasks || [];
  }

  /**
   * Ein Teil als eigenständiger Test (nur Aufgaben des Teils). Bei 'separate' mit dem Schlüssel des Teils,
   * sonst mit den Einstellungen des Tests; Status je Teil (partStatus) ersetzt dort den Status.
   */
  function partAsTest(test, part) {
    const own = separateParts(test);
    const results = {};
    for (const [sid, r] of Object.entries(test.results || {})) {
      const ps = own ? (r.partStatus || {})[part.id] : null;
      results[sid] = { scores: r.scores || {}, status: r.status === 'fehlt' || r.status === 'nachschreiben' || r.status === 'taeuschung' || !ps ? r.status : ps };
    }
    return {
      limit: own && part.limit !== undefined ? part.limit : test.limit,
      precision: own && part.precision !== undefined ? part.precision : test.precision,
      custom: (own ? part.custom : test.custom) || {},
      wholeGrades: own ? !!part.wholeGrades : !!test.wholeGrades,
      tasks: partTasks(test, part),
      results,
    };
  }

  /** Notenschlüssel eines Teils (bei 'separate'). */
  function keyForPart(test, part, level) {
    return keyForTest(partAsTest(test, part), level);
  }

  /** Notenspiegel eines Teils (bei 'separate'; Drittelparagraph gilt nur für die Gesamtnote). */
  function partStats(test, part, studentIds, level) {
    return testStats(partAsTest(test, part), studentIds, level);
  }

  /** Ergebnis einer Schülerin/eines Schülers in einem Test. Bei Teilen zusätzlich parts: [{ partId, score, max, p, status }]. */
  function testResult(test, sid, level) {
    const res = separateParts(test) ? separateResult(test, sid, level) : plainResult(test, sid, level);
    if (hasParts(test)) {
      res.parts =
        res.parts ||
        test.parts.map((part) => {
          const pt = partAsTest(test, part);
          const r = plainResult(pt, sid, level);
          return { partId: part.id, score: r.score, max: testMaxScore(pt), p: null, status: r.status };
        });
    }
    return res;
  }

  function plainResult(test, sid, level) {
    const r = (test.results || {})[sid] || {};
    const status = r.status || '';
    if (status === 'fehlt' || status === 'nachschreiben') return { status, score: null, p: null };
    const key = keyForTest(test, level);
    if (status === 'taeuschung') return { status, score: null, p: 0 };
    const scores = r.scores || {};
    let any = false;
    let sum = 0;
    let bonus = 0;
    for (const t of test.tasks || []) {
      const v = scores[t.id];
      if (v === null || v === undefined || v === '') continue;
      any = true;
      sum += Number(v);
      if (t.bonus) bonus += Number(v);
    }
    if (!any) return { status, score: null, p: null };
    const score = roundToPrecision(sum, test.precision);
    return { status, score, bonus, p: scoreToPoints(score, key) };
  }

  /** 'separate': Teilnoten je Teil, Gesamtnote erst, wenn alle Teile eine Note haben. */
  function separateResult(test, sid, level) {
    const r = (test.results || {})[sid] || {};
    const status = r.status || '';
    const parts = test.parts.map((part) => {
      const pt = partAsTest(test, part);
      const pr = plainResult(pt, sid, level);
      return { partId: part.id, score: pr.score, max: testMaxScore(pt), p: pr.p, status: pr.status, bonus: pr.bonus || 0 };
    });
    if (status === 'fehlt' || status === 'nachschreiben') return { status, score: null, p: null, parts };
    if (status === 'taeuschung') return { status, score: null, p: 0, parts };
    const scored = parts.filter((x) => x.score !== null);
    const score = scored.length ? roundToPrecision(scored.reduce((s, x) => s + x.score, 0), 0.01) : null;
    const bonus = parts.reduce((s, x) => s + x.bonus, 0);
    if (parts.some((x) => x.p === null)) return { status, score, bonus, p: null, parts };
    const v = weightedAvg(parts.map((x, i) => ({ v: calcValue(x.p, level), w: partWeight(test.parts[i]) })));
    return { status, score, bonus, p: roundValue(v, level), parts };
  }

  function partWeight(part) {
    const w = Number(part.weight);
    return w > 0 ? w : 1;
  }

  // ---------- Präsentationen ----------
  // pres.criteria = [{ id, name, group, desc, weight }], je Kriterium 0–3 Punkte (× Gewicht);
  // Umrechnung in Noten mit dem Testschlüssel (LIMIT, eigene Schwellen, ganze Noten), Genauigkeit ganze Punkte.

  const PRES_MAX = 3;

  function critWeight(c) {
    const w = Number(c.weight);
    return w > 0 ? w : 1;
  }

  // Gruppenpräsentationen (1.23): pres.groupMode = 'mixed' (je Kriterium Gruppe/Person über c.scope) | 'group' (alles als
  // Gruppe); pres.groups = [{ id, name, members: [sid], topic?, date?, note?, scores: { critId: 0–3 } }].
  // Eine Einzelbewertung results[sid].scores[critId] ersetzt bei Gruppenkriterien den Gruppenwert (Abweichung).

  const filled = (v) => v !== null && v !== undefined && v !== '';

  function presGroupOf(pres, sid) {
    if (!pres.groupMode) return null;
    return (pres.groups || []).find((g) => (g.members || []).includes(sid)) || null;
  }

  /** Wird dieses Kriterium für die Gruppe bewertet? */
  function presCritIsGroup(pres, c) {
    return pres.groupMode === 'group' || (pres.groupMode === 'mixed' && c.scope !== 'person');
  }

  /** Rohpunkte (0–3) einer Person je Kriterium: Gruppenwert, ersetzt durch eine eigene Bewertung. */
  function presScores(pres, sid) {
    const own = ((pres.results || {})[sid] || {}).scores || {};
    const g = presGroupOf(pres, sid);
    const out = {};
    for (const c of pres.criteria || []) {
      if (filled(own[c.id])) out[c.id] = Number(own[c.id]);
      else if (g && presCritIsGroup(pres, c) && filled((g.scores || {})[c.id])) out[c.id] = Number(g.scores[c.id]);
    }
    return out;
  }

  /** Weicht die Person bei diesem Kriterium vom Gruppenwert ab (eigene Bewertung bei einem Gruppenkriterium)? */
  function presDeviation(pres, sid, c) {
    const g = presGroupOf(pres, sid);
    return !!g && presCritIsGroup(pres, c) && filled((((pres.results || {})[sid] || {}).scores || {})[c.id]);
  }

  /** Thema einer Person: eigenes oder das der Gruppe. */
  function presTopic(pres, sid) {
    const g = presGroupOf(pres, sid);
    return ((pres.results || {})[sid] || {}).topic || (g && g.topic) || '';
  }

  /** Präsentation als Test: Kriterium = Aufgabe mit 3 × Gewicht Punkten, Punkte × Gewicht. */
  function presAsTest(pres) {
    const crit = pres.criteria || [];
    const results = {};
    const ids = new Set(Object.keys(pres.results || {}));
    if (pres.groupMode) for (const g of pres.groups || []) for (const sid of g.members || []) ids.add(sid);
    for (const sid of ids) {
      const r = (pres.results || {})[sid] || {};
      const raw = presScores(pres, sid);
      const scores = {};
      for (const c of crit) if (filled(raw[c.id])) scores[c.id] = raw[c.id] * critWeight(c);
      results[sid] = { scores, status: r.status };
    }
    return {
      limit: pres.limit,
      precision: 1,
      custom: pres.custom || {},
      wholeGrades: !!pres.wholeGrades,
      tasks: crit.map((c) => ({ id: c.id, name: c.name, max: PRES_MAX * critWeight(c) })),
      results,
    };
  }

  function presResult(pres, sid, level) {
    const pt = presAsTest(pres);
    return Object.assign(testResult(pt, sid, level), { max: testMaxScore(pt) });
  }

  function presStats(pres, studentIds, level) {
    return testStats(presAsTest(pres), studentIds, level);
  }

  function keyForPres(pres, level) {
    return keyForTest(presAsTest(pres), level);
  }

  /** Zählt diese Leistung für diese Person nicht? (ganze Leistung oder einzelne Testarbeit „nicht gewertet“) */
  function ungradedFor(a, sid) {
    const results = a.kind === 'test' ? a.test.results : a.kind === 'pres' ? a.pres.results : null;
    return !!a.ungraded || (!!results && ((results || {})[sid] || {}).status === 'ungewertet');
  }

  /** Notenspiegel und Drittelparagraph (einzeln nicht gewertete Arbeiten zählen nicht mit). */
  function testStats(test, studentIds, level) {
    const counts = {};
    const whole = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let n = 0;
    let sumDec = 0;
    let sumP = 0;
    let sqDec = 0;
    let sqP = 0;
    let excluded = 0;
    for (const sid of studentIds) {
      const r = testResult(test, sid, level);
      if (r.p === null || r.status === 'ungewertet') continue;
      n++;
      counts[r.p] = (counts[r.p] || 0) + 1;
      whole[wholeGrade(r.p)]++;
      sumDec += pointsToDecimal(r.p);
      sumP += r.p;
      sqDec += pointsToDecimal(r.p) ** 2;
      sqP += r.p ** 2;
      if (r.status === 'taeuschung') excluded++;
    }
    const weak = whole[5] + whole[6];
    // Standardabweichung der Grundgesamtheit (alle gewerteten Arbeiten, Teiler n)
    const sd = (sq, sum) => (n ? Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) : null);
    return {
      n,
      counts,
      whole,
      avgDec: n ? sumDec / n : null,
      avgPoints: n ? sumP / n : null,
      sdDec: sd(sqDec, sumDec),
      sdPoints: sd(sqP, sumP),
      weak,
      weakPct: n ? (weak / n) * 100 : null,
      drittel: n > 0 && weak - excluded > n / 3,
    };
  }

  // ---------- EPO / Mitarbeit ----------

  const EPO_RATINGS = ['++', '+', '0', '-', '--'];
  const EPO_DEFAULT_POINTS = { '--': 0, '-': 1, '0': 2, '+': 3, '++': 4, u: -1, h: -2 };

  /** Standardtabelle %→Punkte. MSS: 5-%-Schritte („mehr als“). Sek I: wie Test-Schlüssel („ab“). */
  function epoDefaultTable(level, limit) {
    if (level === 'mss') {
      const mins = [0];
      for (let p = 1; p <= 15; p++) mins.push(25 + (p - 1) * 5);
      return { strict: true, mins };
    }
    return { strict: false, mins: keyPercents('sek1', limit) };
  }

  /** Zelleingabe "++u", "0h", "k", "+" → {r, hw}; undefined = ungültig. */
  function parseEpoCell(input) {
    const s = String(input || '').trim().toLowerCase().replace(/\s+/g, '');
    if (s === '') return { r: '', hw: '' };
    const m = /^(\+\+|\+|0|--|-|k)?([uh])?$/.exec(s);
    if (!m || (!m[1] && !m[2])) return undefined;
    return { r: m[1] || '', hw: m[2] || '' };
  }

  function epoCellText(c) {
    if (!c) return '';
    return (c.r || '') + (c.hw || '');
  }

  function epoResult(epo, sid, level) {
    const pts = Object.assign({}, EPO_DEFAULT_POINTS, epo.points || {});
    const table = epo.table || epoDefaultTable(level, epo.limit);
    const row = (epo.entries || {})[sid] || {};
    let sum = 0;
    let attended = 0;
    let absent = 0;
    let u = 0;
    let hcount = 0;
    const counts = { '++': 0, '+': 0, '0': 0, '-': 0, '--': 0 };
    for (const lesson of epo.lessons || []) {
      const c = row[lesson.id];
      if (!c) continue;
      if (c.r === 'k') absent++;
      else if (EPO_RATINGS.includes(c.r)) {
        attended++;
        counts[c.r]++;
        sum += pts[c.r];
      }
      if (c.hw === 'u') { u++; sum += pts.u; }
      if (c.hw === 'h') { hcount++; sum += pts.h; }
    }
    const max = attended * pts['++'];
    if (attended === 0 || max <= 0) return { sum, max, attended, absent, u, h: hcount, counts, pct: null, p: null };
    const pct = (sum / max) * 100;
    let p = 0;
    const top = maxPoints(level);
    for (let i = 1; i < table.mins.length && i <= top; i++) {
      const ok = table.strict ? pct > table.mins[i] + 1e-9 : pct >= table.mins[i] - 1e-9;
      if (ok) p = i;
    }
    return { sum, max, attended, absent, u, h: hcount, counts, pct, p };
  }

  // ---------- Kurse ----------

  const COURSE_TYPES = {
    sek1: { label: 'Sek I (50 : 50)', ka: 50, other: 50 },
    lk: { label: 'MSS-Leistungskurs (50 : 50)', ka: 50, other: 50 },
    gk: { label: 'MSS-Grundkurs (33 : 67)', ka: 33.33, other: 66.67 },
    noka: { label: 'Ohne Klassenarbeiten (0 : 100)', ka: 0, other: 100 },
  };

  function courseLevel(course) {
    return Number(course.jahrgang) >= 11 ? 'mss' : 'sek1';
  }

  function halvesFor(course) {
    const j = Number(course.jahrgang);
    if (j === 11) return ['11/1', '11/2'];
    if (j === 12) return ['12/1', '12/2'];
    if (j >= 13) return ['13'];
    return ['HJ1', 'HJ2'];
  }

  function hasYearGrade(course) {
    return Number(course.jahrgang) <= 11 && halvesFor(course).length === 2;
  }

  /** Punkte einer Leistung für eine Schülerin/einen Schüler (null = keine Note). */
  function assessmentPoints(a, sid, level) {
    if (a.kind === 'test') return testResult(a.test, sid, level).p;
    if (a.kind === 'epo') return epoResult(a.epo, sid, level).p;
    if (a.kind === 'pres') return presResult(a.pres, sid, level).p;
    const g = ((a.manual && a.manual.grades) || {})[sid];
    if (!g) return null;
    if (g.status === 'taeuschung') return 0;
    if (g.status === 'fehlt' || g.status === 'nachschreiben') return null;
    return g.p === undefined ? null : g.p;
  }

  /** Status einer Person bei einer Leistung (fehlt, nachschreiben, taeuschung, ungewertet) oder ''. */
  function assessmentStatus(a, sid) {
    const src = a.kind === 'test' ? a.test.results : a.kind === 'pres' ? a.pres.results : a.kind === 'manual' ? a.manual.grades : null;
    return ((src || {})[sid] || {}).status || '';
  }

  /**
   * Halbjahresrechnung für eine Schülerin/einen Schüler.
   * @returns {ka, other, raw, rounded, override, final} – ka/other/raw als Rechenwerte (unrundet)
   */
  function halfResult(course, half, sid) {
    const level = courseLevel(course);
    const list = (course.assessments || []).filter((a) => a.half === half);
    const collect = (cat) =>
      list
        .filter((a) => a.cat === cat && !ungradedFor(a, sid))
        .map((a) => {
          const p = assessmentPoints(a, sid, level);
          return { v: p === null ? null : calcValue(p, level), w: Number(a.weight) || 0 };
        });
    const ka = weightedAvg(collect('ka'));
    const other = weightedAvg(collect('other'));
    const wKa = Number(course.wKa) || 0;
    const wOther = Number(course.wOther) || 0;
    const raw = weightedAvg([
      { v: ka, w: wKa },
      { v: other, w: wOther },
    ]);
    const rounded = roundValue(raw, level);
    const ov = (((course.overrides || {})[half]) || {})[sid];
    const override = ov && ov.p !== null && ov.p !== undefined ? ov.p : null;
    return { ka, other, raw, rounded, override, final: override !== null ? override : rounded, reason: ov ? ov.reason || '' : '' };
  }

  /** Jahresnote: ⅓ erstes HJ + ⅔ zweites HJ (gesetzte HJ-Noten haben Vorrang). */
  function yearResult(course, sid) {
    const level = courseLevel(course);
    const [h1, h2] = halvesFor(course);
    const r1 = halfResult(course, h1, sid);
    const r2 = halfResult(course, h2, sid);
    const v1 = r1.override !== null ? calcValue(r1.override, level) : r1.raw;
    const v2 = r2.override !== null ? calcValue(r2.override, level) : r2.raw;
    const w1 = Number(course.wHalf1) || 1;
    const w2 = Number(course.wHalf2) || 2;
    const raw = weightedAvg([
      { v: v1, w: w1 },
      { v: v2, w: w2 },
    ]);
    const rounded = roundValue(raw, level);
    const ov = ((course.overrides || {}).Jahr || {})[sid];
    const override = ov && ov.p !== null && ov.p !== undefined ? ov.p : null;
    return { h1: v1, h2: v2, raw, rounded, override, final: override !== null ? override : rounded, reason: ov ? ov.reason || '' : '' };
  }

  NM.grades = {
    round2,
    maxPoints,
    wholeGrade,
    tendency,
    pointsToDecimal,
    label,
    gradeWord,
    levels,
    parse,
    roundDecimal,
    roundPoints,
    calcValue,
    roundValue,
    weightedAvg,
    roundToPrecision,
    keyPercents,
    testKey,
    keyForTest,
    wholeOnly,
    scoreToPoints,
    testMaxScore,
    testResult,
    testStats,
    hasParts,
    separateParts,
    partTasks,
    orderedTasks,
    taskGroups,
    partAsTest,
    keyForPart,
    partStats,
    partWeight,
    PRES_MAX,
    critWeight,
    presGroupOf,
    presCritIsGroup,
    presScores,
    presDeviation,
    presTopic,
    presAsTest,
    presResult,
    presStats,
    keyForPres,
    EPO_RATINGS,
    EPO_DEFAULT_POINTS,
    epoDefaultTable,
    parseEpoCell,
    epoCellText,
    epoResult,
    COURSE_TYPES,
    courseLevel,
    halvesFor,
    hasYearGrade,
    assessmentPoints,
    assessmentStatus,
    ungradedFor,
    halfResult,
    yearResult,
  };
})((globalThis.NM = globalThis.NM || {}));
