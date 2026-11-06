/* OrdoNota – Zufallswerkzeuge (Reiter „Tools“, früher „Zufall“): reine Logik ohne DOM.
   Zufallszahlen, Personenauswahl, Kartenstapel und die Geometrie der Würfel (W4–W20) für den 3D-Zeichner. */
(function (NM) {
  'use strict';

  /** Gleichverteilter Zufall in [0, 1) aus crypto.getRandomValues (fairer als Math.random). */
  function cryptoRand() {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0] / 4294967296;
  }

  /** Ganze Zahl von min bis max (beide eingeschlossen; vertauschte Grenzen werden gedreht). */
  function randInt(min, max, rand = cryptoRand) {
    let lo = Math.ceil(Math.min(min, max));
    let hi = Math.floor(Math.max(min, max));
    if (hi < lo) hi = lo;
    return lo + Math.floor(rand() * (hi - lo + 1));
  }

  function shuffle(list, rand = cryptoRand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * n Personen auswählen. ids = alle Verfügbaren (ohne Abwesende).
   * noRepeat: used (Set) enthält, wer schon dran war; diese kommen erst wieder, wenn alle dran waren.
   * Reicht der Rest nicht, kommen zuerst alle Übrigen, dann wird used geleert und der Rest daraus gezogen.
   * @returns {{ ids: string[], reset: boolean }} – used wird verändert
   */
  function pickPeople(ids, n, { noRepeat = false, used = new Set(), rand = cryptoRand } = {}) {
    n = Math.max(0, Math.min(Math.floor(n) || 0, ids.length));
    if (!noRepeat) return { ids: shuffle(ids, rand).slice(0, n), reset: false };
    let picked = shuffle(ids.filter((id) => !used.has(id)), rand).slice(0, n);
    let reset = false;
    if (picked.length < n) {
      used.clear();
      reset = true;
      picked = picked.concat(shuffle(ids.filter((id) => !picked.includes(id)), rand).slice(0, n - picked.length));
    }
    for (const id of picked) used.add(id);
    return { ids: picked, reset };
  }

  // ---------- Karten ----------

  const SUITS = [
    { id: 'S', sym: '♠', name: 'Pik', red: false },
    { id: 'H', sym: '♥', name: 'Herz', red: true },
    { id: 'D', sym: '♦', name: 'Karo', red: true },
    { id: 'C', sym: '♣', name: 'Kreuz', red: false },
  ];
  const RANKS = { 52: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K', 'A'], 32: ['7', '8', '9', '10', 'B', 'D', 'K', 'A'] };
  const RANK_NAMES = { B: 'Bube', D: 'Dame', K: 'König', A: 'Ass' };

  /** Kartenstapel: '52', '32' oder 'custom' (lines = eigene Texte, je Zeile eine Karte). */
  function deck(kind, lines = []) {
    if (kind === 'custom') {
      return lines
        .map((t) => String(t).trim())
        .filter(Boolean)
        .map((text, i) => ({ id: 'c' + i, text }));
    }
    const ranks = RANKS[kind] || RANKS[52];
    const out = [];
    for (const s of SUITS) for (const r of ranks) out.push({ id: s.id + r, suit: s.id, sym: s.sym, red: s.red, rank: r, name: `${s.name} ${RANK_NAMES[r] || r}` });
    return out;
  }

  /** Eigene Karten aus einem Textfeld: eine Karte je nicht leerer Zeile. */
  function parseCards(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // ---------- Würfel: Geometrie ----------

  const PHI = (1 + Math.sqrt(5)) / 2;
  const DICE = [4, 6, 8, 10, 12, 20];

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  /** Flächen eines konvexen Körpers: je Normale die Ecken mit dem größten Abstand in diese Richtung, im Kreis sortiert. */
  function facesFromNormals(verts, normals) {
    return normals.map((n0) => {
      const n = norm(n0);
      const d = verts.map((v) => dot(v, n));
      const max = Math.max(...d);
      const idx = d.map((x, i) => [x, i]).filter(([x]) => max - x < 1e-6).map(([, i]) => i);
      const c = scale(idx.reduce((s, i) => [s[0] + verts[i][0], s[1] + verts[i][1], s[2] + verts[i][2]], [0, 0, 0]), 1 / idx.length);
      const u = norm(sub(verts[idx[0]], c));
      const w = cross(n, u);
      return idx.sort((a, b) => {
        const pa = sub(verts[a], c), pb = sub(verts[b], c);
        return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
      });
    });
  }

  function rawSolid(sides) {
    const s = [-1, 1];
    if (sides === 4) {
      const v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
      return { verts: v, faces: facesFromNormals(v, v.map((x) => scale(x, -1))) };
    }
    if (sides === 6) {
      const v = [];
      for (const x of s) for (const y of s) for (const z of s) v.push([x, y, z]);
      return { verts: v, faces: facesFromNormals(v, [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) };
    }
    const cube = [];
    for (const x of s) for (const y of s) for (const z of s) cube.push([x, y, z]);
    const ico = [];
    for (const a of s) for (const b of s) ico.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
    if (sides === 8) {
      const v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      return { verts: v, faces: facesFromNormals(v, cube) };
    }
    if (sides === 12) {
      const v = cube.slice();
      for (const a of s) for (const b of s) v.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]);
      const normals = [];
      for (const a of s) for (const b of s) normals.push([0, a * PHI, b], [a * PHI, b, 0], [b, 0, a * PHI]);
      return { verts: v, faces: facesFromNormals(v, normals) };
    }
    if (sides === 20) {
      const normals = cube.slice();
      for (const a of s) for (const b of s) normals.push([0, a * PHI, b / PHI], [a * PHI, b / PHI, 0], [b / PHI, 0, a * PHI]);
      return { verts: ico, faces: facesFromNormals(ico, normals) };
    }
    if (sides === 10) {
      // Fünfeckiges Trapezoeder: Ring aus 10 Ecken im Zickzack, Spitzen oben und unten (Höhe so, dass die Drachenvierecke eben sind)
      const z0 = 0.11;
      const c36 = Math.cos(Math.PI / 5);
      const H = (z0 * (1 + c36)) / (1 - c36);
      const v = [[0, 0, H], [0, 0, -H]];
      for (let k = 0; k < 10; k++) v.push([Math.cos((k * Math.PI) / 5), Math.sin((k * Math.PI) / 5), k % 2 ? -z0 : z0]);
      const r = (k) => 2 + (((k % 10) + 10) % 10);
      const faces = [];
      for (let j = 0; j < 5; j++) faces.push([0, r(2 * j), r(2 * j + 1), r(2 * j + 2)]);
      for (let j = 0; j < 5; j++) faces.push([1, r(2 * j + 3), r(2 * j + 2), r(2 * j + 1)]);
      return { verts: v, faces };
    }
    throw new Error('Unbekannter Würfel: W' + sides);
  }

  const solidCache = {};

  /**
   * Würfel als 3D-Körper (Ecken auf Radius 1 normiert).
   * faces[i] = { idx: Eckindizes, normal, center, up (Richtung „oben“ für die Beschriftung), label }.
   * Beschriftung 1…n, gegenüberliegende Seiten ergeben n + 1 (außer beim W4, der keine Gegenseiten hat).
   */
  function solid(sides) {
    if (solidCache[sides]) return solidCache[sides];
    const raw = rawSolid(sides);
    const r = Math.max(...raw.verts.map((v) => Math.hypot(...v)));
    const verts = raw.verts.map((v) => scale(v, 1 / r));
    const faces = raw.faces.map((idx) => {
      const center = scale(idx.reduce((s, i) => [s[0] + verts[i][0], s[1] + verts[i][1], s[2] + verts[i][2]], [0, 0, 0]), 1 / idx.length);
      let normal = norm(cross(sub(verts[idx[1]], verts[idx[0]]), sub(verts[idx[2]], verts[idx[0]])));
      if (dot(normal, center) < 0) normal = scale(normal, -1);
      // „Oben“ auf der Fläche: beim W6 zur Kantenmitte (Augen gerade), sonst zur ersten Ecke (beim W10 die Spitze)
      const tip = sides === 6 ? scale([0, 1, 2].map((j) => verts[idx[0]][j] + verts[idx[1]][j]), 0.5) : verts[idx[0]];
      const t = sub(tip, center);
      const up = norm(sub(t, scale(normal, dot(t, normal))));
      return { idx, normal, center, up, label: 0 };
    });
    // Beschriftung: Paare gegenüberliegender Flächen bekommen k und n + 1 − k
    let k = 1;
    for (const f of faces) {
      if (f.label) continue;
      f.label = k;
      const opp = faces.find((g) => !g.label && dot(g.normal, f.normal) < -0.999);
      if (opp) opp.label = sides + 1 - k;
      k++;
    }
    if (sides === 4) faces.forEach((f, i) => (f.label = i + 1));
    return (solidCache[sides] = { sides, verts, faces });
  }

  // ---------- Drehungen (Quaternionen [w, x, y, z]) ----------

  function quatFromMatrix(m) {
    // m: Zeilen [[a,b,c],[d,e,f],[g,h,i]] (Drehmatrix)
    const t = m[0][0] + m[1][1] + m[2][2];
    let q;
    if (t > 0) {
      const s = Math.sqrt(t + 1) * 2;
      q = [s / 4, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s];
    } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
      const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
      q = [(m[2][1] - m[1][2]) / s, s / 4, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s];
    } else if (m[1][1] > m[2][2]) {
      const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
      q = [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, s / 4, (m[1][2] + m[2][1]) / s];
    } else {
      const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
      q = [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, s / 4];
    }
    return qNorm(q);
  }

  function qNorm(q) {
    const l = Math.hypot(...q) || 1;
    return q.map((x) => x / l);
  }

  function qMul(a, b) {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  }

  function qAxis(axis, angle) {
    const [x, y, z] = norm(axis);
    const s = Math.sin(angle / 2);
    return [Math.cos(angle / 2), x * s, y * s, z * s];
  }

  function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) {
      b = b.map((x) => -x);
      d = -d;
    }
    if (d > 0.9995) return qNorm(a.map((x, i) => x + (b[i] - x) * t));
    const th = Math.acos(d);
    const sa = Math.sin((1 - t) * th) / Math.sin(th);
    const sb = Math.sin(t * th) / Math.sin(th);
    return a.map((x, i) => x * sa + b[i] * sb);
  }

  /** Quaternion → Drehmatrix (Zeilen). */
  function qMatrix(q) {
    const [w, x, y, z] = q;
    return [
      [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
      [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
      [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ];
  }

  const apply = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

  /**
   * Ruhelage: Der Würfel liegt auf dem Tisch und wird genau von oben gesehen, die gewürfelte Fläche zeigt
   * zum Betrachter (+z) und ihr „oben“ nach oben (+y); spin (Bogenmaß) dreht leicht um die Blickachse.
   */
  function restQuat(sides, label, spin = 0) {
    const f = solid(sides).faces.find((x) => x.label === label);
    const n = f.normal, u = f.up, w = cross(u, n);
    let q = quatFromMatrix([w, u, n]);
    return spin ? qMul(qAxis([0, 0, 1], spin), q) : q;
  }

  /** Zufällige Lage (gleichverteilt auf der Kugel der Drehungen). */
  function randomQuat(rand = cryptoRand) {
    const u1 = rand(), u2 = rand() * 2 * Math.PI, u3 = rand() * 2 * Math.PI;
    const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  }

  /**
   * Plan für einen Wurf: Start- und Endlage, Zusatzdrehung. pose(t) liefert die Drehmatrix bei t ∈ [0, 1];
   * bei t = 1 liegt genau die gewürfelte Seite vorn.
   */
  function rollPlan(sides, label, rand = cryptoRand) {
    const start = randomQuat(rand);
    const end = restQuat(sides, label, (rand() - 0.5) * 0.5);
    const axis = norm([rand() - 0.5, rand() - 0.5, rand() - 0.5]);
    const spins = 2 + Math.floor(rand() * 2);
    return {
      pose(t) {
        const e = 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); // abbremsen
        const extra = qAxis(axis, (1 - e) * spins * 2 * Math.PI);
        return qMatrix(qMul(extra, slerp(start, end, e)));
      },
    };
  }

  /** Welche Seite zeigt bei Drehmatrix m nach vorn (+z)? */
  function frontLabel(sides, m) {
    let best = null, bz = -2;
    for (const f of solid(sides).faces) {
      const z = apply(m, f.normal)[2];
      if (z > bz) [bz, best] = [z, f.label];
    }
    return best;
  }

  /** Mehrere Würfel werfen: Werte und Summe. */
  function rollDice(sides, count, rand = cryptoRand) {
    const values = Array.from({ length: Math.max(1, Math.min(6, count | 0 || 1)) }, () => randInt(1, sides, rand));
    return { values, sum: values.reduce((a, b) => a + b, 0) };
  }

  NM.random = {
    cryptoRand,
    randInt,
    shuffle,
    pickPeople,
    deck,
    parseCards,
    SUITS,
    DICE,
    solid,
    restQuat,
    rollPlan,
    frontLabel,
    rollDice,
    qMatrix,
    apply,
    dot,
    cross,
  };
})((globalThis.NM = globalThis.NM || {}));
