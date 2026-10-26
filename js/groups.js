/* OrdoNota – Gruppenbildung (rein, ohne DOM): Gruppengrößen, Verteilung nach Regeln, Gruppenpuzzle. */
(function (NM) {
  'use strict';

  /**
   * Gruppengrößen für n Personen: entweder „je size Personen“ oder „count Gruppen“.
   * Der Rest wird auf die Gruppen verteilt (15 à 4 → 4, 4, 4, 3; 13 à 4 → 5, 4, 4), es bleibt keine Mini-Gruppe übrig.
   */
  function sizes(n, { size = 0, count = 0 } = {}) {
    if (n <= 0) return [];
    const k = count > 0 ? Math.min(n, Math.round(count)) : Math.max(1, Math.round(n / Math.max(1, size)));
    const base = Math.floor(n / k);
    const extra = n % k;
    return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
  }

  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

  /** Paare, die in einem früheren Gruppensatz zusammen waren (für „Abwechslung“). */
  function pairsOf(groups) {
    const out = new Set();
    for (const g of groups || []) {
      const m = g.members || g;
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) out.add(pairKey(m[i], m[j]));
    }
    return out;
  }

  /**
   * Regelverstöße einer Einteilung (groups: Listen von Schüler-IDs oder { members }).
   * rules: { apart: [[a, b]], together: [[a, b]] }; Paare mit Personen, die nicht eingeteilt sind, zählen nicht.
   */
  function check(groups, rules = {}, previous = null) {
    const where = new Map();
    (groups || []).forEach((g, i) => (g.members || g).forEach((sid) => where.set(sid, i)));
    const both = ([a, b]) => where.has(a) && where.has(b);
    const prev = previous ? pairsOf(previous) : new Set();
    const now = pairsOf(groups);
    return {
      apart: (rules.apart || []).filter((p) => both(p) && where.get(p[0]) === where.get(p[1])),
      together: (rules.together || []).filter((p) => both(p) && where.get(p[0]) !== where.get(p[1])),
      repeats: [...now].filter((k) => prev.has(k)).length,
    };
  }

  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Personen auf Gruppen verteilen.
   * ids: einzuteilende Personen; opts.sizes: Größe je Gruppe (Summe = ids.length);
   * opts.mode: 'random' | 'mixed' (leistungsgemischt: ähnliche Gruppenschnitte) | 'similar' (leistungsgleich);
   * opts.scores: { sid: Punkte 0–15 } für die Leistungsmodi (fehlende → Durchschnitt);
   * opts.rules: { apart, together }; opts.previous: früherer Gruppensatz (Abwechslung); opts.rand: Zufallszahlen.
   * Sucht mit mehreren Neustarts und Tauschschritten die Einteilung mit den geringsten Kosten
   * (Regelverstöße zählen weit mehr als Leistung und Abwechslung).
   */
  function build(ids, { sizes: sz, mode = 'random', scores = {}, rules = {}, previous = null, rand = Math.random, restarts = 12, steps = 1500 } = {}) {
    const n = ids.length;
    if (!n) return [];
    const groupSizes = sz && sz.reduce((s, x) => s + x, 0) === n ? sz : [n];
    const known = ids.map((sid) => scores[sid]).filter((v) => typeof v === 'number');
    const avg = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0;
    const score = new Map(ids.map((sid) => [sid, typeof scores[sid] === 'number' ? scores[sid] : avg]));
    const inSet = new Set(ids);
    const apart = (rules.apart || []).filter(([a, b]) => inSet.has(a) && inSet.has(b));
    const together = (rules.together || []).filter(([a, b]) => inSet.has(a) && inSet.has(b));
    const prev = previous ? pairsOf(previous) : new Set();
    const useScore = mode === 'mixed' || mode === 'similar';

    const cost = (groups) => {
      const where = new Map();
      groups.forEach((g, i) => g.forEach((sid) => where.set(sid, i)));
      let c = 0;
      for (const [a, b] of apart) if (where.get(a) === where.get(b)) c += 1000;
      for (const [a, b] of together) if (where.get(a) !== where.get(b)) c += 1000;
      if (prev.size) for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (prev.has(pairKey(g[i], g[j]))) c += 10;
      if (useScore) {
        const means = groups.map((g) => g.reduce((s, sid) => s + score.get(sid), 0) / g.length);
        if (mode === 'mixed') c += means.reduce((s, m) => s + (m - avg) ** 2, 0) * 4;
        else groups.forEach((g, i) => (c += g.reduce((s, sid) => s + (score.get(sid) - means[i]) ** 2, 0) * 4));
      }
      return c;
    };

    let best = null;
    let bestCost = Infinity;
    for (let r = 0; r < restarts; r++) {
      const order = shuffle(ids, rand);
      const groups = [];
      let k = 0;
      for (const size of groupSizes) groups.push(order.slice(k, (k += size)));
      let c = cost(groups);
      if (groups.length > 1) {
        for (let s = 0; s < steps && c > 0; s++) {
          const gi = Math.floor(rand() * groups.length);
          let gj = Math.floor(rand() * (groups.length - 1));
          if (gj >= gi) gj++;
          const i = Math.floor(rand() * groups[gi].length);
          const j = Math.floor(rand() * groups[gj].length);
          [groups[gi][i], groups[gj][j]] = [groups[gj][j], groups[gi][i]];
          const c2 = cost(groups);
          if (c2 <= c) c = c2;
          else [groups[gi][i], groups[gj][j]] = [groups[gj][j], groups[gi][i]];
        }
      }
      if (c < bestCost) {
        bestCost = c;
        best = groups.map((g) => g.slice());
      }
      if (bestCost === 0) break;
    }
    return best;
  }

  /**
   * Gruppenpuzzle: aus Stammgruppen die Expertengruppen bilden. Die i-te Person jeder Stammgruppe
   * kommt in Expertengruppe i (Teilthema i); so sitzt aus jeder Stammgruppe genau eine Person in jeder Expertengruppe.
   */
  function experts(homeGroups) {
    const k = Math.max(0, ...homeGroups.map((g) => (g.members || g).length));
    return Array.from({ length: k }, (_, i) => homeGroups.map((g) => (g.members || g)[i]).filter(Boolean));
  }

  /** Buchstabe des Teilthemas (A, B, C …) für Position i in der Stammgruppe. */
  function letter(i) {
    return String.fromCharCode(65 + (i % 26));
  }

  NM.groups = { sizes, pairsOf, check, build, experts, letter };
})((globalThis.NM = globalThis.NM || {}));
