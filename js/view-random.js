/* OrdoNota – Reiter „Zufall“: Zufallszahl, Personen auswählen, Würfel (3D) und Karten ziehen.
   Nur Werkzeug für den Unterricht: Es wird nichts in die Notenliste eingetragen. Ergebnisse gelten nur für die Sitzung. */
(function (NM) {
  'use strict';
  const { h, clear, toast, parseNum } = NM.util;
  const M = NM.model;
  const R = NM.random;
  const UI = NM.ui;

  // Ergebnisse und Stapel der Sitzung (nicht gespeichert): Kurs-ID → Zustand
  const sessions = {};
  function session(course) {
    return (sessions[course.id] = sessions[course.id] || { used: new Set(), people: [], numbers: [], dice: null, decks: {} });
  }

  function opts() {
    const ui = NM.app.state.ui;
    return (ui.random = Object.assign({ min: 1, max: 100, count: 1, noRepeat: false, die: 6, dice: 1, deck: '52', cards: 1 }, ui.random || {}));
  }

  const motion = () => !(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function render(view, { course }) {
    view.append(h('div', { class: 'view-head' }, h('h1', null, 'Zufall'), h('span', { class: 'muted small' }, 'Werkzeuge für den Unterricht – es wird nichts in die Notenliste eingetragen.')));
    view.appendChild(h('div', { class: 'rnd-grid' }, numberTool(course), peopleTool(course), diceTool(course), cardTool(course)));
  }

  /** Rahmen eines Werkzeugs mit Vollbild-Knopf (für den Beamer). */
  function tool(key, title, controls, stage, onResize) {
    const card = h('div', { class: 'card rnd-tool', 'data-rnd': key });
    const full = h(
      'button',
      {
        class: 'btn btn-sm rnd-full',
        title: 'Im Vollbild zeigen (Beamer); Esc beendet',
        onclick: () => {
          if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
          if (card.requestFullscreen) card.requestFullscreen().catch(() => toast('Vollbild ist hier nicht möglich.', 'warn'));
        },
      },
      '⛶ Vollbild'
    );
    card.addEventListener('fullscreenchange', () => {
      full.textContent = document.fullscreenElement === card ? '✕ Vollbild beenden' : '⛶ Vollbild';
      if (onResize) setTimeout(onResize, 50);
    });
    card.append(h('div', { class: 'card-head' }, h('h2', null, title), full), h('div', { class: 'rnd-controls' }, controls), stage);
    return card;
  }

  const numInput = (value, onchange, props = {}) =>
    h('input', Object.assign({ class: 'input', type: 'number', value, onchange: (e) => onchange(Math.round(parseNum(e.target.value))) }, props));

  // ---------- Zufallszahl ----------

  function numberTool(course) {
    const o = opts(), ses = session(course);
    const out = h('div', { class: 'rnd-number', 'aria-live': 'polite' }, ses.numbers.length ? String(ses.numbers[0]) : '?');
    const hist = h('div', { class: 'muted small rnd-hist' });
    const showHist = () => (hist.textContent = ses.numbers.length > 1 ? 'Zuvor: ' + ses.numbers.slice(1, 9).join(', ') : '');
    showHist();
    const set = (k) => (v) => {
      if (!Number.isFinite(v)) return toast('Bitte eine ganze Zahl eingeben.', 'error');
      o[k] = v;
      NM.app.saveUi();
    };
    const btn = h(
      'button',
      {
        class: 'btn btn-primary',
        'data-rnd-go': 'number',
        onclick: async () => {
          const v = R.randInt(o.min, o.max);
          ses.numbers.unshift(v);
          ses.numbers.length = Math.min(ses.numbers.length, 20);
          btn.disabled = true;
          out.classList.remove('rnd-pop');
          if (motion()) {
            for (let i = 0; i < 14; i++) {
              out.textContent = String(R.randInt(o.min, o.max));
              await sleep(30 + i * 6);
            }
          }
          out.textContent = String(v);
          void out.offsetWidth;
          out.classList.add('rnd-pop');
          showHist();
          btn.disabled = false;
        },
      },
      '🎲 Zahl erzeugen'
    );
    return tool(
      'number',
      'Zufallszahl',
      [h('label', { class: 'field narrow' }, h('span', null, 'von'), numInput(o.min, set('min'), { 'data-rnd-min': '' })), h('label', { class: 'field narrow' }, h('span', null, 'bis'), numInput(o.max, set('max'), { 'data-rnd-max': '' })), btn],
      h('div', { class: 'rnd-stage' }, out, hist)
    );
  }

  // ---------- Personen auswählen ----------

  function peopleTool(course) {
    const o = opts(), ses = session(course);
    const students = M.activeStudents(course);
    const away = NM.views.draw.absent(course);
    for (const sid of [...ses.used]) if (!students.some((s) => s.id === sid)) ses.used.delete(sid);
    const ready = () => students.filter((s) => !away.has(s.id));
    const stage = h('div', { class: 'rnd-stage' });
    const cards = h('div', { class: 'draw-cards rnd-people', 'aria-live': 'polite' });
    const info = h('div', { class: 'muted small' });
    stage.append(cards, info);

    const showInfo = () => {
      const parts = [];
      if (o.noRepeat) parts.push(`${ready().filter((s) => !ses.used.has(s.id)).length} von ${ready().length} noch nicht dran`);
      if (away.size) parts.push(`${away.size} heute abwesend (Reiter „Ziehen“)`);
      clear(info);
      info.append(parts.join(' · '));
      if (o.noRepeat && ses.used.size)
        info.append(
          ' ',
          h('button', { class: 'link', onclick: () => (ses.used.clear(), showInfo()) }, '↺ alle wieder aufnehmen')
        );
    };
    const personCard = (s, names, cls = '') =>
      h('div', { class: 'draw-card ' + cls }, h('img', { class: 'draw-photo' + (s.photo ? '' : ' seat-photo-empty'), src: s.photo || M.PERSON_ICON, alt: '' }), h('div', { class: 'draw-name' }, names[s.id]), h('div', { class: 'muted small' }, M.studentName(s)));
    const show = (ids, cls) => {
      const people = ids.map((id) => students.find((s) => s.id === id)).filter(Boolean);
      const names = NM.views.seating.cardNames(students);
      clear(cards);
      cards.append(...people.map((s) => personCard(s, names, cls)));
    };
    show(ses.people);
    showInfo();

    if (!students.length) {
      clear(stage);
      stage.append(h('p', { class: 'muted' }, 'Noch keine Schülerinnen und Schüler – bitte im Reiter „Kurs & Schüler“ eintragen.'));
    }
    const count = numInput(Math.min(o.count, Math.max(1, students.length)), (v) => {
      if (!(v >= 1)) return toast('Bitte mindestens 1.', 'error');
      o.count = v;
      NM.app.saveUi();
    }, { min: 1, max: Math.max(1, students.length), 'data-rnd-count': '' });
    const noRep = h('input', {
      type: 'checkbox',
      checked: o.noRepeat,
      'data-rnd-norepeat': '',
      onchange: (e) => {
        o.noRepeat = e.target.checked;
        NM.app.saveUi();
        showInfo();
      },
    });
    const btn = h(
      'button',
      {
        class: 'btn btn-primary',
        'data-rnd-go': 'people',
        disabled: !students.length,
        onclick: async () => {
          const pool = ready().map((s) => s.id);
          if (!pool.length) return toast('Niemand verfügbar – alle sind heute abwesend.', 'error');
          const n = Math.max(1, Math.round(parseNum(count.value)) || 1);
          const res = R.pickPeople(pool, n, { noRepeat: o.noRepeat, used: ses.used });
          ses.people = res.ids;
          btn.disabled = true;
          if (motion()) {
            for (let i = 0; i < 12; i++) {
              show(R.shuffle(pool).slice(0, res.ids.length), 'rnd-flash');
              await sleep(45 + i * 8);
            }
          }
          show(res.ids, 'rnd-pop');
          showInfo();
          btn.disabled = false;
          if (res.reset) toast('Alle waren dran – es geht wieder von vorn los.', 'info', 4000);
          if (res.ids.length < n) toast(`Nur ${res.ids.length} Personen verfügbar.`, 'warn');
        },
      },
      '🎲 Auswählen'
    );
    return tool(
      'people',
      'Personen auswählen',
      [h('label', { class: 'field narrow' }, h('span', null, 'Anzahl'), count), btn, h('label', { class: 'check' }, noRep, ' Keine Wiederholung (bis alle dran waren)')],
      stage
    );
  }

  // ---------- Würfel ----------

  function diceTool(course) {
    const o = opts(), ses = session(course);
    const row = h('div', { class: 'rnd-dice', 'aria-live': 'polite' });
    const sum = h('div', { class: 'rnd-sum' });
    const stage = h('div', { class: 'rnd-stage' }, row, sum);
    let card = null;

    const size = () => {
      const full = card && document.fullscreenElement === card;
      const n = (ses.dice && ses.dice.values.length) || o.dice;
      if (!full) return n > 3 ? 120 : 160;
      return Math.floor(Math.min(innerHeight * 0.5, (innerWidth * 0.9) / Math.min(n, 3) - 20));
    };
    const showSum = () => {
      const d = ses.dice;
      sum.textContent = d ? (d.values.length > 1 ? `${d.values.join(' + ')} = ${d.sum}` : `W${d.sides}: ${d.sum}`) : 'Würfelart und Anzahl wählen, dann würfeln.';
      sum.classList.toggle('muted', !d);
    };
    const drawStatic = () => {
      clear(row);
      const d = ses.dice;
      if (!d) {
        const c = canvasFor(size());
        row.appendChild(c);
        paintDie(c, o.die, R.qMatrix(R.restQuat(o.die, o.die, 0.15)), { ghost: true, rest: true });
        return;
      }
      d.values.forEach((v, i) => {
        const c = canvasFor(size());
        c.setAttribute('aria-label', `W${d.sides}: ${v}`);
        c.dataset.value = v;
        row.appendChild(c);
        paintDie(c, d.sides, R.qMatrix(d.rest[i]), { rest: true });
      });
    };

    const dieSel = h(
      'select',
      { class: 'input', 'data-rnd-die': '', onchange: (e) => ((o.die = Number(e.target.value)), NM.app.saveUi(), ses.dice || drawStatic()) },
      R.DICE.map((n) => h('option', { value: n, selected: o.die === n }, 'W' + n))
    );
    const countSel = h(
      'select',
      { class: 'input', 'data-rnd-dice': '', onchange: (e) => ((o.dice = Number(e.target.value)), NM.app.saveUi()) },
      [1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: o.dice === n }, n === 1 ? '1 Würfel' : n + ' Würfel'))
    );
    const btn = h(
      'button',
      {
        class: 'btn btn-primary',
        'data-rnd-go': 'dice',
        onclick: async () => {
          const sides = o.die;
          const { values, sum: total } = R.rollDice(sides, o.dice);
          const rest = values.map((v) => R.restQuat(sides, v, (R.cryptoRand() - 0.5) * 0.3));
          ses.dice = { sides, values, sum: total, rest };
          btn.disabled = true;
          sum.textContent = '…';
          if (motion()) await rollAnimation(row, sides, values, size());
          drawStatic();
          showSum();
          row.classList.remove('rnd-pop');
          void row.offsetWidth;
          row.classList.add('rnd-pop');
          btn.disabled = false;
        },
      },
      '🎲 Würfeln'
    );
    card = tool(
      'dice',
      'Würfel',
      [h('label', { class: 'field narrow' }, h('span', null, 'Würfel'), dieSel), h('label', { class: 'field narrow' }, h('span', null, 'Anzahl'), countSel), btn],
      stage,
      drawStatic
    );
    // Canvas erst zeichnen, wenn die Ansicht eingehängt ist (Farben aus den CSS-Tokens)
    requestAnimationFrame(() => {
      drawStatic();
      showSum();
    });
    return card;
  }

  /** Canvas in Gerätepixeln; Höhe etwas größer für das Hüpfen. */
  function canvasFor(size) {
    const dpr = globalThis.devicePixelRatio || 1;
    const c = h('canvas', { class: 'rnd-die', role: 'img' });
    c.width = Math.round(size * dpr);
    c.height = Math.round(size * dpr);
    c.style.width = size + 'px';
    c.style.height = size + 'px';
    return c;
  }

  async function rollAnimation(row, sides, values, size) {
    clear(row);
    const items = values.map((v, i) => {
      const c = canvasFor(size);
      row.appendChild(c);
      return { c, plan: R.rollPlan(sides, v), delay: i * 90, dir: i % 2 ? 1 : -1 };
    });
    const dur = 1300;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        let done = true;
        for (const it of items) {
          const t = Math.min(1, Math.max(0, (now - t0 - it.delay) / dur));
          if (t < 1) done = false;
          const e = 1 - Math.pow(1 - t, 2);
          const hop = Math.abs(Math.sin(e * Math.PI * 3)) * (1 - e) * 0.25; // drei Sprünge, immer flacher
          paintDie(it.c, sides, it.plan.pose(t), { dx: it.dir * (1 - e) * 0.1, hop });
        }
        if (done || !row.isConnected) resolve();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  // ----- 3D-Zeichner (eigene, kleine Umsetzung ohne Bibliothek) -----

  const LIGHT = (() => {
    const l = [-0.45, 0.6, 1];
    const n = Math.hypot(...l);
    return l.map((x) => x / n);
  })();

  function cssColor(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  /** Farbe als [r, g, b] (beliebige CSS-Farbe, über ein Canvas normalisiert). */
  function rgb(ctx, color) {
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    const s = ctx.fillStyle;
    if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return m.slice(0, 3).map(Number);
  }

  /** Halbe Breite der Fläche um ihren Mittelpunkt (Abstand zur nächsten Kante) – Maß für Zahl und Augen. */
  const apothems = {};
  function apothem(s, f) {
    const key = s.sides + ':' + f.label;
    if (apothems[key]) return apothems[key];
    let best = Infinity;
    f.idx.forEach((a, i) => {
      const p = s.verts[a], q = s.verts[f.idx[(i + 1) % f.idx.length]];
      const d = q.map((x, j) => x - p[j]);
      const t = Math.max(0, Math.min(1, R.dot(f.center.map((x, j) => x - p[j]), d) / R.dot(d, d)));
      best = Math.min(best, Math.hypot(...f.center.map((x, j) => x - (p[j] + d[j] * t))));
    });
    return (apothems[key] = best);
  }

  /**
   * Würfel zeichnen, Blick von oben auf den Tisch. m = Drehmatrix; dx = seitlicher Versatz, hop = Höhe über dem
   * Tisch (in Würfelgrößen: größer und Schatten weiter weg); rest = liegt, nur die obere Zahl kräftig; ghost = blass.
   * Orthogonale Projektion: Flächen und Zahlen werden exakt affin abgebildet.
   */
  function paintDie(canvas, sides, m, { dx = 0, hop = 0, ghost = false, rest = false } = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = R.solid(sides);
    const k = W * (sides === 4 ? 0.4 : 0.34) * (1 + hop * 0.5);
    const cx = W / 2 + dx * W, cy = H / 2;
    const P = (v) => [cx + v[0] * k, cy - v[1] * k];
    const base = rgb(ctx, cssColor('--accent', '#2f6f8f'));
    const ink = cssColor('--on-accent', '#ffffff');
    const rv = s.verts.map((v) => R.apply(m, v));

    const faces = s.faces
      .map((f) => ({ f, n: R.apply(m, f.normal), c: R.apply(m, f.center) }))
      .filter((x) => x.n[2] > 1e-3)
      .sort((a, b) => a.c[2] - b.c[2]);
    const top = faces.reduce((b, x) => (x.n[2] > b.n[2] ? x : b), faces[0]);
    const outline = (f) => {
      ctx.beginPath();
      f.idx.forEach((i, j) => {
        const [x, y] = P(rv[i]);
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
    };

    // Schatten auf dem Tisch (von oben gesehen): je höher der Würfel, desto weiter versetzt und weicher
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${ghost ? 0.12 : 0.3 * (1 - hop)})`;
    ctx.shadowBlur = W * (0.03 + hop * 0.25);
    ctx.shadowOffsetX = W * (0.015 + hop * 0.2);
    ctx.shadowOffsetY = W * (0.025 + hop * 0.3);
    ctx.fillStyle = '#000';
    for (const { f } of faces) {
      outline(f);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = ghost ? 0.45 : 1;
    ctx.lineJoin = 'round';
    for (const { f, n } of faces) {
      const light = 0.5 + 0.5 * Math.max(0, R.dot(n, LIGHT));
      ctx.fillStyle = `rgb(${base.map((x) => Math.round(Math.min(255, x * light + 40 * Math.pow(Math.max(0, R.dot(n, LIGHT)), 8)))).join(',')})`;
      ctx.strokeStyle = `rgba(0,0,0,0.35)`;
      ctx.lineWidth = Math.max(1, W / 140);
      outline(f);
      ctx.fill();
      ctx.stroke();
    }
    // Beschriftung bzw. Augen: Flächenebene affin auf den Bildschirm abbilden
    for (const x of faces) {
      const { f, n, c } = x;
      if (n[2] < 0.12) continue;
      const u = R.apply(m, f.up), w = R.apply(m, R.cross(f.up, f.normal));
      const a = apothem(s, f) * k;
      const [ex, ey] = P(c);
      ctx.save();
      // Liegt der Würfel, ist nur die obere Zahl kräftig, damit das Ergebnis eindeutig ist
      ctx.globalAlpha = (ghost ? 0.45 : 1) * Math.min(1, (n[2] - 0.12) * 4) * (rest && x !== top ? 0.3 : 1);
      ctx.setTransform(w[0] * a, -w[1] * a, -u[0] * a, u[1] * a, ex, ey); // Einheit = Apothem der Fläche
      ctx.fillStyle = ink;
      if (sides === 6) pips(ctx, f.label);
      else {
        const label = String(f.label) + (sides >= 10 && (f.label === 6 || f.label === 9) ? '.' : '');
        const fs = (sides === 10 ? 0.62 : 0.9) * (label.length > 1 ? 0.82 : 1);
        ctx.scale(0.01, 0.01); // Schrift in Hundertsteln, sehr kleine Schriftgrößen rundet der Browser sonst
        ctx.font = `700 ${Math.round(fs * 100)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // beim W10 sitzt die Zahl etwas zur breiten Seite hin (Drachenviereck)
        ctx.fillText(label, 0, (sides === 10 ? 0.25 : 0.05) * 100);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Augen des W6 in Flächenkoordinaten (Einheit = halbe Kantenlänge). */
  function pips(ctx, v) {
    const d = 0.5;
    const pos = {
      1: [[0, 0]],
      2: [[-d, -d], [d, d]],
      3: [[-d, -d], [0, 0], [d, d]],
      4: [[-d, -d], [d, -d], [-d, d], [d, d]],
      5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]],
      6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]],
    }[v];
    for (const [x, y] of pos) {
      ctx.beginPath();
      ctx.arc(x, y, 0.17, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // ---------- Karten ----------
  // Bilder: cards/<Farbe><Wert>.svg (gemeinfrei/CC0, Quelle in cards/LIZENZ.txt), Rückseite cards/back.svg

  const DECKS = [
    ['52', '52 Karten'],
    ['32', '32 Karten (Skat)'],
    ['custom', 'Eigene Karten'],
  ];
  const BACK = 'cards/back.svg';

  /** Stapel der Sitzung: left = noch im Stapel (oben = Ende), drawn = alle gezogenen (neueste zuerst), last = letzte Ziehung. */
  function deckState(course, kind) {
    const ses = session(course);
    if (!ses.decks[kind]) {
      const all = R.deck(kind, course.randomCards || []);
      ses.decks[kind] = { total: all.length, left: R.shuffle(all), drawn: [], last: [] };
    }
    return ses.decks[kind];
  }

  function cardTool(course) {
    const o = opts();
    if (!DECKS.some(([k]) => k === o.deck)) o.deck = '52';
    if (!(o.cards >= 1)) o.cards = 1;
    const pile = h('button', { class: 'rnd-pile', type: 'button', 'data-rnd-pile': '', title: 'Karten vom Stapel ziehen' });
    const hand = h('div', { class: 'rnd-hand', 'aria-live': 'polite' });
    const info = h('div', { class: 'muted small rnd-card-info' });
    const drawn = h('div', { class: 'rnd-drawn' });
    const stage = h('div', { class: 'rnd-stage rnd-card-stage' }, h('div', { class: 'rnd-table' }, pile, hand), info, drawn);
    const st = () => deckState(course, o.deck);
    let card = null;

    /** Kartenbreite: Stapel und alle gezogenen Karten nebeneinander in der verfügbaren Breite (ab 9 Karten zweizeilig). */
    const width = (n) => {
      n = Math.max(1, n);
      const full = card && document.fullscreenElement === card;
      const avail = (stage.clientWidth || (full ? innerWidth * 0.9 : 500)) - 8;
      const perRow = n > 8 ? Math.ceil(n / 2) : n;
      const w = avail / (perRow * 1.08 + 1.25); // Karten mit Abstand + Stapel mit Abstand
      return Math.floor(Math.max(48, Math.min(w, full ? innerHeight * 0.42 : 130, 340)));
    };

    const update = (anim) => {
      const d = st();
      const w = width(d.last.length);
      stage.style.setProperty('--w', w + 'px');
      // Stapel: immer sichtbar, Höhe nach Restmenge; leer = gestrichelter Platz
      clear(pile);
      const layers = d.left.length ? Math.min(6, Math.ceil(d.left.length / 8)) : 0;
      for (let i = 0; i < layers; i++) pile.appendChild(h('img', { class: 'rnd-pile-card', src: BACK, alt: '', style: { transform: `translate(${-i * 2}px, ${-i * 2}px)` } }));
      pile.appendChild(h('span', { class: 'rnd-pile-count' }, d.left.length ? String(d.left.length) : 'leer'));
      pile.classList.toggle('empty', !d.left.length);
      pile.disabled = !d.left.length;
      clear(hand);
      const els = d.last.map((c) => cardEl(c));
      hand.append(...els);
      if (!d.last.length) hand.appendChild(h('div', { class: 'rnd-hand-empty muted small' }, d.total ? 'Hier erscheinen die gezogenen Karten.' : ''));
      clear(info);
      if (!d.total) info.append(o.deck === 'custom' ? 'Noch keine eigenen Karten – unten eintragen (je Zeile eine Karte).' : '');
      else info.append(`Noch ${d.left.length} von ${d.total} im Stapel` + (d.drawn.length > d.last.length ? ' · vorher gezogen:' : ''));
      clear(drawn);
      drawn.append(...d.drawn.slice(d.last.length, d.last.length + 40).map((c) => h('span', { class: 'rnd-mini' + (c.red ? ' red' : ''), title: c.name || c.text }, c.text ? c.text : c.rank + c.sym)));
      go.disabled = !d.left.length;
      go.title = d.left.length ? '' : 'Stapel leer – bitte neu mischen';
      edit.hidden = o.deck !== 'custom';
      if (anim) flyIn(pile, els);
    };

    const doDraw = () => {
      const d = st();
      if (!d.left.length) return;
      const n = Math.max(1, Math.round(parseNum(count.value)) || 1);
      const take = Math.min(n, d.left.length);
      d.last = d.left.splice(d.left.length - take, take).reverse();
      d.drawn.unshift(...d.last);
      update(motion());
      if (take < n) toast(`Nur noch ${take} ${take === 1 ? 'Karte' : 'Karten'} im Stapel.`, 'warn');
    };
    pile.addEventListener('click', doDraw);

    const deckSel = h(
      'select',
      { class: 'input', 'data-rnd-deck': '', onchange: (e) => ((o.deck = e.target.value), NM.app.saveUi(), update(false)) },
      DECKS.map(([v, l]) => h('option', { value: v, selected: o.deck === v }, l))
    );
    const count = numInput(o.cards, (v) => {
      if (!(v >= 1)) return toast('Bitte mindestens 1.', 'error');
      o.cards = v;
      NM.app.saveUi();
    }, { min: 1, max: 52, 'data-rnd-ncards': '' });
    const go = h('button', { class: 'btn btn-primary', 'data-rnd-go': 'card', onclick: doDraw }, '🂠 Ziehen');
    const reshuffle = h(
      'button',
      {
        class: 'btn',
        'data-rnd-shuffle': '',
        onclick: () => {
          delete session(course).decks[o.deck];
          update(false);
          toast('Neu gemischt – alle Karten sind wieder im Stapel.', 'info', 2500);
        },
      },
      '↺ Neu mischen'
    );
    const area = h('textarea', { class: 'input', rows: 6, 'data-rnd-cards': '', placeholder: 'z. B.\nThema 1: Bruchrechnung\nThema 2: Prozent\nRolle: Zeitwächter', value: (course.randomCards || []).join('\n') });
    const edit = h(
      'details',
      { class: 'rnd-edit' },
      h('summary', null, 'Eigene Karten bearbeiten'),
      h('p', { class: 'muted small' }, 'Je Zeile eine Karte, z. B. Themen, Aufgaben oder Rollen. Wird im Kurs gespeichert.'),
      area,
      h(
        'button',
        {
          class: 'btn btn-sm',
          'data-rnd-cards-save': '',
          onclick: () => {
            course.randomCards = R.parseCards(area.value);
            delete session(course).decks.custom;
            NM.app.commit();
            toast(`${course.randomCards.length} eigene Karten gespeichert und neu gemischt.`, 'ok', 2500);
          },
        },
        'Übernehmen und neu mischen'
      )
    );
    card = tool(
      'cards',
      'Karten ziehen',
      [h('label', { class: 'field' }, h('span', null, 'Stapel'), deckSel), h('label', { class: 'field narrow' }, h('span', null, 'Anzahl'), count), go, reshuffle],
      stage,
      () => update(false)
    );
    card.appendChild(edit);
    update(false);
    requestAnimationFrame(() => update(false)); // Breite erst nach dem Einhängen bekannt
    return card;
  }

  /** Gezogene Karten fliegen nacheinander vom Stapel an ihren Platz und drehen sich dabei um. */
  function flyIn(pile, els) {
    const from = pile.getBoundingClientRect();
    els.forEach((el, i) => {
      const to = el.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const timing = { duration: 600, delay: i * 140, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'backwards' };
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], timing);
      el.firstChild.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.35 }, { transform: 'none' }], timing);
    });
  }

  /** Karte mit Vorder- und Rückseite: Spielkarte als Bild, eigene Karte als Text. */
  function cardEl(c) {
    let front;
    if (c.text) {
      const len = c.text.length;
      front = h('div', { class: 'rnd-card-front rnd-card-text', style: { fontSize: len > 60 ? '0.7em' : len > 25 ? '0.9em' : '1.25em' } }, c.text);
    } else {
      front = h('img', { class: 'rnd-card-front', src: `cards/${c.suit}${c.rank}.svg`, alt: c.name, draggable: 'false' });
    }
    return h(
      'div',
      { class: 'rnd-card', 'data-card': c.id, title: c.name || c.text },
      h('div', { class: 'rnd-card-inner' }, front, h('img', { class: 'rnd-card-back', src: BACK, alt: '', draggable: 'false' }))
    );
  }

  NM.views.random = { render, session, paintDie };
})((globalThis.NM = globalThis.NM || {}));
