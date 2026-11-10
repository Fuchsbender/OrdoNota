/* OrdoNota – QR-Code-Erzeuger (rein, ohne DOM, ohne Bibliothek).
 * Byte-Modus, Fehlerkorrektur Q (stellt bis zu 25 % beschädigte Codewörter wieder her), Versionen 1–10,
 * Reed-Solomon über GF(256), alle 8 Masken mit Strafpunkten, Format- und Versionsinformation (ISO/IEC 18004).
 * Gebraucht für die Trennblätter für OrdoScripto (Inhalt „ORDO|<testId>|<schuelerId>“, Version 3). */
(function (NM) {
  'use strict';

  const MAX_VERSION = 10;
  // Fehlerkorrektur Q je Version: [EC-Codewörter je Block, Blöcke Gruppe 1, Datenwörter je Block G1, Blöcke G2, Datenwörter je Block G2]
  const Q_BLOCKS = [
    null,
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
  ];
  const ECL_Q = 3; // Kennung der Fehlerkorrektur Q in der Format-Information (L = 1, M = 0, Q = 3, H = 2)

  // ---------- GF(256) mit dem Polynom x^8 + x^4 + x^3 + x^2 + 1 (0x11D) ----------

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  /** Generatorpolynom (x − α^0)(x − α^1)…(x − α^(n−1)), Koeffizienten von der höchsten Potenz an (führend 1). */
  function rsGenerator(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const next = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        next[j] ^= g[j];
        next[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = next;
    }
    return g;
  }

  /** Fehlerkorrektur-Codewörter: Rest von data(x) · x^n geteilt durch das Generatorpolynom. */
  function rsRemainder(data, n) {
    const g = rsGenerator(n);
    const rem = new Array(n).fill(0);
    for (const b of data) {
      const f = b ^ rem.shift();
      rem.push(0);
      for (let i = 0; i < n; i++) rem[i] ^= mul(g[i + 1], f);
    }
    return rem;
  }

  // ---------- Größen je Version ----------

  const sizeOf = (v) => 17 + 4 * v;

  /** Anzahl der Module für Daten und Fehlerkorrektur (alles außer Funktionsmustern und Format/Version). */
  function rawModules(v) {
    let n = (16 * v + 128) * v + 64;
    if (v >= 2) {
      const a = Math.floor(v / 7) + 2;
      n -= (25 * a - 10) * a - 55;
      if (v >= 7) n -= 36;
    }
    return n;
  }

  function dataCodewords(v) {
    const [, b1, d1, b2, d2] = Q_BLOCKS[v];
    return b1 * d1 + b2 * d2;
  }

  /** Höchstzahl an Bytes im Byte-Modus (Moduskennung 4 Bit, Längenfeld 8 bzw. 16 Bit ab Version 10). */
  function byteCapacity(v) {
    return Math.floor((dataCodewords(v) * 8 - 4 - countBits(v)) / 8);
  }

  const countBits = (v) => (v < 10 ? 8 : 16);

  /** Mittelpunkte der Ausrichtungsmuster (Zeilen und Spalten). */
  function alignmentPositions(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const out = [6];
    for (let pos = sizeOf(v) - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  // ---------- Format- und Versionsinformation ----------

  /** 15 Bit: Fehlerkorrektur und Maske mit BCH(15,5), maskiert mit 0x5412. */
  function formatBits(mask) {
    const data = (ECL_Q << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
  }

  /** 18 Bit: Versionsnummer mit BCH(18,6), nur ab Version 7. */
  function versionBits(v) {
    let rem = v;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (v << 12) | (rem & 0xfff);
  }

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  // ---------- Daten zu Codewörtern ----------

  function utf8(text) {
    return Array.from(new TextEncoder().encode(String(text)));
  }

  /** Datencodewörter: Moduskennung 0100, Länge, Bytes, Endekennung, Auffüllen mit 0xEC/0x11. */
  function dataBytes(bytes, v) {
    const bits = [];
    const put = (val, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, countBits(v));
    for (const b of bytes) put(b, 8);
    const cap = dataCodewords(v) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((s, x) => (s << 1) | x, 0));
    for (let pad = 0xec; out.length < dataCodewords(v); pad ^= 0xec ^ 0x11) out.push(pad);
    return out;
  }

  /** Daten in Blöcke teilen, je Block Fehlerkorrektur anhängen und spaltenweise verschränken. */
  function interleave(data, v) {
    const [ec, b1, d1, b2, d2] = Q_BLOCKS[v];
    const blocks = [];
    let k = 0;
    for (let i = 0; i < b1 + b2; i++) {
      const len = i < b1 ? d1 : d2;
      const d = data.slice(k, k + len);
      k += len;
      blocks.push({ d, e: rsRemainder(d, ec) });
    }
    const out = [];
    const maxD = Math.max(d1, d2);
    for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
    for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
    return out;
  }

  // ---------- Matrix ----------

  function newMatrix(v) {
    const n = sizeOf(v);
    const grid = () => Array.from({ length: n }, () => new Array(n).fill(false));
    const m = { v, n, mod: grid(), fn: grid() };
    const set = (x, y, dark) => {
      m.mod[y][x] = dark;
      m.fn[y][x] = true;
    };
    m.set = set;
    // Taktmuster
    for (let i = 0; i < n; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    // Suchmuster mit Trennstreifen
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= n || y >= n) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          set(x, y, d !== 2 && d !== 4);
        }
    }
    // Ausrichtungsmuster (nicht in den drei Ecken mit Suchmustern)
    const pos = alignmentPositions(v);
    const last = pos.length - 1;
    pos.forEach((cy, i) =>
      pos.forEach((cx, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      })
    );
    drawFormat(m, 0); // reserviert die Format-Felder, die richtige Maske kommt später
    if (v >= 7) {
      const b = versionBits(v);
      for (let i = 0; i < 18; i++) {
        const a = n - 11 + (i % 3);
        const c = Math.floor(i / 3);
        set(a, c, bit(b, i));
        set(c, a, bit(b, i));
      }
    }
    return m;
  }

  function drawFormat(m, mask) {
    const b = formatBits(mask);
    const n = m.n;
    const set = m.set;
    // erste Kopie um das Suchmuster oben links
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6));
    set(8, 8, bit(b, 7));
    set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    // zweite Kopie unten links und oben rechts
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(b, i));
    set(8, n - 8, true); // dunkles Modul
  }

  /** Codewörter im Zickzack von unten rechts eintragen (Spaltenpaare, Spalte 6 ausgelassen). */
  function placeData(m, words) {
    const n = m.n;
    let i = 0;
    const total = words.length * 8;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const up = ((right + 1) & 2) === 0;
      for (let k = 0; k < n; k++) {
        const y = up ? n - 1 - k : k;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (m.fn[y][x]) continue;
          if (i < total) m.mod[y][x] = bit(words[i >>> 3], 7 - (i & 7));
          i++; // Restbits (nach dem letzten Codewort) bleiben hell
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  /** Maske auf alle Datenmodule anwenden (zweimal anwenden hebt sie wieder auf). */
  function applyMask(m, mask) {
    const f = MASKS[mask];
    for (let y = 0; y < m.n; y++) for (let x = 0; x < m.n; x++) if (!m.fn[y][x] && f(x, y)) m.mod[y][x] = !m.mod[y][x];
  }

  /** Strafpunkte nach ISO/IEC 18004, 7.8.3: lange Läufe, 2×2-Blöcke, suchmusterähnliche Folgen, Dunkelanteil. */
  function penalty(mod) {
    const n = mod.length;
    let score = 0;
    const line = (get) => {
      let s = 0;
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) s += 3 + (run - 5);
          run = 1;
        }
      }
      // 1:1:3:1:1 mit vier hellen Modulen davor oder danach
      const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (let i = 0; i + 11 <= n; i++) {
        let a = true;
        let b = true;
        for (let k = 0; k < 11; k++) {
          const v = get(i + k) ? 1 : 0;
          if (v !== A[k]) a = false;
          if (v !== B[k]) b = false;
        }
        if (a) s += 40;
        if (b) s += 40;
      }
      return s;
    };
    for (let y = 0; y < n; y++) score += line((x) => mod[y][x]);
    for (let x = 0; x < n; x++) score += line((y) => mod[y][x]);
    for (let y = 0; y + 1 < n; y++)
      for (let x = 0; x + 1 < n; x++) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) score += 3;
      }
    let dark = 0;
    for (const row of mod) for (const c of row) if (c) dark++;
    score += 10 * Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5);
    return score;
  }

  /**
   * QR-Code erzeugen. opts.mask: 0–7 erzwingen (sonst die mit den wenigsten Strafpunkten),
   * opts.minVersion: mindestens diese Version (für Tests). Liefert { version, size, mask, modules[y][x] }.
   */
  function encode(text, opts = {}) {
    const bytes = utf8(text);
    let v = Math.max(1, opts.minVersion || 1);
    while (v <= MAX_VERSION && bytes.length > byteCapacity(v)) v++;
    if (v > MAX_VERSION) throw new Error(`Zu langer Inhalt für einen QR-Code bis Version ${MAX_VERSION} (höchstens ${byteCapacity(MAX_VERSION)} Bytes).`);
    const m = newMatrix(v);
    placeData(m, interleave(dataBytes(bytes, v), v));
    let mask = opts.mask;
    if (mask === undefined || mask === null) {
      let best = Infinity;
      for (let k = 0; k < 8; k++) {
        applyMask(m, k);
        drawFormat(m, k);
        const p = penalty(m.mod);
        if (p < best) {
          best = p;
          mask = k;
        }
        applyMask(m, k);
      }
    }
    if (!(mask >= 0 && mask <= 7)) throw new Error('Maske muss 0–7 sein.');
    applyMask(m, mask);
    drawFormat(m, mask);
    return { version: v, size: m.n, mask, modules: m.mod.map((row) => row.slice()) };
  }

  /** SVG mit Ruhezone (Standard 4 Module); width/height z. B. „60mm“. Schwarz auf Weiß, auch im Dunkelmodus. */
  function svg(qr, { quiet = 4, width = null, height = null, title = null } = {}) {
    const n = qr.size + 2 * quiet;
    let d = '';
    qr.modules.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
      })
    );
    const size = (width ? ` width="${width}"` : '') + (height || width ? ` height="${height || width}"` : '');
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}"${size} shape-rendering="crispEdges" role="img">` +
      (title ? `<title>${esc(title)}</title>` : '') +
      `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
    );
  }

  NM.qr = {
    MAX_VERSION,
    encode,
    svg,
    byteCapacity,
    // für Tests
    _: { EXP, LOG, rsGenerator, rsRemainder, formatBits, versionBits, rawModules, dataCodewords, alignmentPositions, dataBytes, interleave, penalty, Q_BLOCKS },
  };
})((globalThis.NM = globalThis.NM || {}));
