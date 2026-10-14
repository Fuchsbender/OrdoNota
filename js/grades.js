/* Notenmanager – Notenlogik (rein rechnerisch, ohne DOM).
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
   * @returns Array idx=Punktstufe → {p, pct, min} (min = Mindestpunktzahl)
   */
  function testKey(level, limit, maxScore, precision, custom) {
    const pcts = keyPercents(level, limit);
    return pcts.map((pct, p) => {
      let min = p === 0 ? 0 : roundToPrecision((pct / 100) * maxScore, precision);
      const isCustom = custom && custom[p] !== undefined && custom[p] !== null && custom[p] !== '';
      if (isCustom) min = Number(custom[p]);
      const shownPct = maxScore > 0 ? round2((min / maxScore) * 100) : 0;
      return { p, pct: shownPct, min, custom: !!isCustom };
    });
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

  /** Ergebnis einer Schülerin/eines Schülers in einem Test. */
  function testResult(test, sid, level) {
    const r = (test.results || {})[sid] || {};
    const status = r.status || '';
    if (status === 'fehlt' || status === 'nachschreiben') return { status, score: null, p: null };
    const key = testKey(level, test.limit, testMaxScore(test), test.precision, test.custom);
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

  /** Notenspiegel und Drittelparagraph. */
  function testStats(test, studentIds, level) {
    const counts = {};
    const whole = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let n = 0;
    let sumDec = 0;
    let sumP = 0;
    let excluded = 0;
    for (const sid of studentIds) {
      const r = testResult(test, sid, level);
      if (r.p === null) continue;
      n++;
      counts[r.p] = (counts[r.p] || 0) + 1;
      whole[wholeGrade(r.p)]++;
      sumDec += pointsToDecimal(r.p);
      sumP += r.p;
      if (r.status === 'taeuschung') excluded++;
    }
    const weak = whole[5] + whole[6];
    return {
      n,
      counts,
      whole,
      avgDec: n ? sumDec / n : null,
      avgPoints: n ? sumP / n : null,
      weak,
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
    const g = ((a.manual && a.manual.grades) || {})[sid];
    if (!g) return null;
    if (g.status === 'taeuschung') return 0;
    if (g.status === 'fehlt' || g.status === 'nachschreiben') return null;
    return g.p === undefined ? null : g.p;
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
        .filter((a) => a.cat === cat)
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
    scoreToPoints,
    testMaxScore,
    testResult,
    testStats,
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
    halfResult,
    yearResult,
  };
})((globalThis.NM = globalThis.NM || {}));
