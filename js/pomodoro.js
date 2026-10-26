/* OrdoNota – Pomodoro-Timer in der Kopfzeile: Ablauf, Anzeige, Töne (Web Audio, ohne Dateien), Einstellungen. */
(function (NM) {
  'use strict';
  const { h, modal, toast, parseNum } = NM.util;

  const TICKS = [
    ['off', 'aus'],
    ['work', 'nur Pomodoros'],
    ['always', 'immer'],
  ];
  const ALARMS = [
    ['off', 'aus'],
    ['bell', 'Wecker klingeln'],
    ['gong', 'Gong'],
    ['beep', 'Piepen'],
  ];
  const PHASE_LABEL = { work: 'Pomodoro', short: 'Pause', long: 'Lange Pause', done: 'Fertig' };

  // ---------- Ablauf (rein) ----------

  /** Einstellungen mit Standardwerten. */
  function config(settings) {
    return Object.assign({}, NM.model.POMODORO_DEFAULTS, (settings && settings.pomodoro) || {});
  }

  /** Länge einer Phase in Minuten. */
  function phaseMinutes(cfg, phase) {
    return phase === 'work' ? cfg.work : phase === 'short' ? cfg.short : phase === 'long' ? cfg.long : 0;
  }

  /**
   * Nächste Phase: Pomodoro → kurze Pause → Pomodoro … ; nach dem letzten Pomodoro die lange Pause, dann fertig.
   * Pausen mit Länge 0 werden übersprungen.
   */
  function next(cfg, phase, index) {
    if (phase === 'work') {
      if (index < cfg.count) return cfg.short > 0 ? { phase: 'short', index } : { phase: 'work', index: index + 1 };
      return cfg.long > 0 ? { phase: 'long', index } : { phase: 'done', index };
    }
    if (phase === 'short') return { phase: 'work', index: index + 1 };
    return { phase: 'done', index };
  }

  // ---------- Zustand (pro Gerät, übersteht Neuladen und Sperren) ----------

  const KEY = 'nm.pomodoro';
  const fresh = () => ({ phase: 'work', index: 1, remaining: null, running: false, endsAt: null }); // remaining null = volle Länge
  const st = load();
  let cfgCache = config(null);
  let loopTimer = null;
  let lastSec = null;
  let audio = null;
  let ui = null; // Verweise auf die Elemente in der Kopfzeile

  function load() {
    try {
      return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {
      return fresh();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* egal */ }
  }

  /** Aktuelle Einstellungen; bei gesperrter App die zuletzt bekannten. */
  function cur() {
    const db = NM.app && NM.app.state && NM.app.state.db;
    if (db) cfgCache = config(db.settings);
    return cfgCache;
  }

  function remainingMs(cfg) {
    if (st.phase === 'done') return 0;
    if (st.running) return Math.max(0, st.endsAt - Date.now());
    return st.remaining === null ? phaseMinutes(cfg, st.phase) * 60000 : st.remaining;
  }

  function start() {
    const cfg = cur();
    if (st.phase === 'done') Object.assign(st, fresh());
    st.endsAt = Date.now() + remainingMs(cfg);
    st.running = true;
    st.remaining = null;
    save();
    ensureAudio(); // Töne brauchen einen Klick als Auslöser
    runLoop();
    update();
  }

  function pause() {
    if (!st.running) return;
    st.remaining = Math.max(0, st.endsAt - Date.now());
    st.running = false;
    st.endsAt = null;
    save();
    runLoop();
    update();
  }

  function reset() {
    Object.assign(st, fresh());
    save();
    runLoop();
    update();
  }

  function runLoop() {
    if (st.running && !loopTimer) loopTimer = setInterval(tick, 250);
    if (!st.running && loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
  }

  function tick() {
    if (!st.running) return;
    const cfg = cur();
    const rem = st.endsAt - Date.now();
    if (rem <= 0) advance(cfg, -rem);
    else {
      const sec = Math.ceil(rem / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        if (cfg.tick === 'always' || (cfg.tick === 'work' && st.phase === 'work')) sound('tick', cfg, sec % 2);
      }
    }
    update();
  }

  /** Phase beendet: weiter zur nächsten (war die App länger zu, werden verstrichene Phasen übersprungen). */
  function advance(cfg, overshoot) {
    let over = overshoot;
    for (;;) {
      Object.assign(st, next(cfg, st.phase, st.index));
      if (st.phase === 'done') {
        Object.assign(st, { running: false, endsAt: null, remaining: 0 });
        break;
      }
      const len = phaseMinutes(cfg, st.phase) * 60000;
      if (over < len) {
        st.endsAt = Date.now() - over + len;
        break;
      }
      over -= len;
    }
    save();
    runLoop();
    sound('alarm', cfg);
    const msg = st.phase === 'work' ? `Pomodoro ${st.index} von ${cfg.count} – los geht's!` : st.phase === 'done' ? 'Alle Pomodoros geschafft!' : `${PHASE_LABEL[st.phase]}: ${phaseMinutes(cfg, st.phase)} Minuten.`;
    toast('🍅 ' + msg, st.phase === 'work' ? 'info' : 'success', 6000);
  }

  // ---------- Töne (Web Audio) ----------

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    return audio;
  }

  /** kind: 'tick' (tock = zweiter Schlag, etwas tiefer) oder 'alarm' (Art aus den Einstellungen). */
  function sound(kind, cfg, tock = 0, alarm = cfg.alarm) {
    if (kind === 'tick' ? cfg.tick === 'off' && tock !== 'test' : alarm === 'off') return;
    const ac = ensureAudio();
    if (!ac) return;
    const out = ac.createGain();
    out.gain.value = Math.max(0, Math.min(1, cfg.volume / 100));
    out.connect(ac.destination);
    const t0 = ac.currentTime + 0.01;
    if (kind === 'tick') return tickSound(ac, out, t0, tock === 1);
    if (alarm === 'bell') return bellSound(ac, out, t0);
    if (alarm === 'gong') return gongSound(ac, out, t0);
    return beepSound(ac, out, t0);
  }

  // Kurzes, gefiltertes Rauschen wie das Ticken eines Weckers
  function tickSound(ac, out, t, tock) {
    const len = Math.floor(ac.sampleRate * 0.03);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = tock ? 2200 : 3200;
    bp.Q.value = 4;
    const g = ac.createGain();
    g.gain.value = 0.6;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
  }

  // Einzelner, schnell abklingender Ton (für Glocke, Gong, Piepen)
  function tone(ac, out, t, freq, dur, { type = 'sine', peak = 0.3, attack = 0.002 } = {}) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Mechanischer Wecker: schnelle Hammerschläge auf zwei Glocken, drei Stöße
  function bellSound(ac, out, t) {
    for (let burst = 0; burst < 3; burst++) {
      for (let i = 0; i < 14; i++) {
        const s = t + burst * 1.0 + i * 0.055;
        tone(ac, out, s, i % 2 ? 2350 : 2650, 0.09, { peak: 0.22 });
        tone(ac, out, s, i % 2 ? 3700 : 4100, 0.05, { peak: 0.08 });
      }
    }
  }

  function gongSound(ac, out, t) {
    [
      [196, 0.5, 3.5],
      [294, 0.25, 2.5],
      [392, 0.18, 2],
      [523, 0.08, 1.2],
    ].forEach(([f, p, d]) => tone(ac, out, t, f, d, { peak: p, attack: 0.01 }));
  }

  function beepSound(ac, out, t) {
    for (let i = 0; i < 3; i++) tone(ac, out, t + i * 0.3, 880, 0.18, { type: 'square', peak: 0.12, attack: 0.005 });
  }

  // ---------- Anzeige in der Kopfzeile ----------

  const fmt = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  /** Element für die Kopfzeile (null, wenn der Timer in den Einstellungen nicht aktiviert ist). */
  function widget() {
    const cfg = cur();
    if (!cfg.enabled) {
      ui = null;
      return null;
    }
    const btn = (label, title, onclick) => h('button', { class: 'icon-btn', title, 'aria-label': title, onclick }, label);
    ui = {
      wrap: h('div', { class: 'pomo', role: 'timer' }),
      label: h('span', { class: 'pomo-label' }),
      time: h('span', { class: 'pomo-time', 'aria-live': 'off' }),
      start: btn('▶', 'Start', start),
      pause: btn('⏸', 'Pause', pause),
      reset: btn('↺', 'Zurücksetzen', reset),
      settings: btn('⚙', 'Pomodoro-Einstellungen', openSettings),
    };
    ui.wrap.append(ui.label, ui.time, ui.start, ui.pause, ui.reset, ui.settings);
    runLoop();
    update(true);
    return ui.wrap;
  }

  /** Zustand: work (rot), break (grün), paused (gelb), idle/done (neutral). */
  function mode() {
    if (st.phase === 'done') return 'done';
    if (st.running) return st.phase === 'work' ? 'work' : 'break';
    const started = st.remaining !== null || st.index > 1 || st.phase !== 'work';
    return started ? 'paused' : 'idle';
  }

  function update(initial = false) {
    if (!ui || (!initial && !ui.wrap.isConnected)) return;
    const cfg = cur();
    const m = mode();
    ui.wrap.className = 'pomo pomo-' + m;
    ui.time.textContent = st.phase === 'done' ? 'fertig' : fmt(remainingMs(cfg));
    ui.label.textContent = st.phase === 'work' ? `🍅 ${st.index}/${cfg.count}` : st.phase === 'done' ? '🍅' : '☕ ' + PHASE_LABEL[st.phase];
    ui.wrap.title = `${PHASE_LABEL[st.phase]}${st.phase === 'work' ? ` ${st.index} von ${cfg.count}` : ''} – ${{ work: 'läuft', break: 'läuft', paused: 'pausiert', idle: 'bereit', done: 'abgeschlossen' }[m]}`;
    ui.start.disabled = st.running;
    ui.pause.disabled = !st.running;
  }

  // ---------- Einstellungen ----------

  /** Formular für die Pomodoro-Einstellungen (im Reiter Einstellungen und im Dialog hinter ⚙). */
  function settingsForm(settings) {
    if (!settings.pomodoro) settings.pomodoro = config(settings);
    const p = settings.pomodoro;
    const changed = () => {
      NM.app.commit({ render: false });
      update();
    };
    const num = (label, key, min, max, hint) =>
      h(
        'label',
        { class: 'field' },
        h('span', null, label),
        h('input', {
          class: 'input',
          type: 'number',
          min,
          max,
          step: 1,
          value: p[key],
          onchange: (e) => {
            const v = parseNum(e.target.value);
            if (v === null || v === undefined || v < min || v > max || v !== Math.round(v)) {
              e.target.value = p[key];
              return toast(`Bitte eine ganze Zahl zwischen ${min} und ${max} eingeben.`, 'error');
            }
            p[key] = v;
            changed();
          },
        }),
        hint ? h('small', { class: 'muted' }, hint) : null
      );
    const sel = (label, key, options, testLabel, test) =>
      h(
        'label',
        { class: 'field span2' },
        h('span', null, label),
        h(
          'div',
          { class: 'inline' },
          h(
            'select',
            {
              class: 'input grow',
              onchange: (e) => {
                p[key] = e.target.value;
                changed();
              },
            },
            options.map(([v, l]) => h('option', { value: v, selected: p[key] === v }, l))
          ),
          h('button', { type: 'button', class: 'btn btn-sm', title: testLabel, onclick: test }, '▶ Probe')
        )
      );
    return h(
      'div',
      { class: 'form-grid' },
      num('Anzahl Pomodoros', 'count', 1, 12, 'Danach folgt die lange Pause, dann ist der Durchlauf fertig.'),
      num('Länge eines Pomodoros (Minuten)', 'work', 1, 120),
      num('Kurze Pause (Minuten)', 'short', 0, 60, '0 = keine kurze Pause'),
      num('Lange Pause am Ende (Minuten)', 'long', 0, 120, '0 = keine lange Pause'),
      sel('Ticken', 'tick', TICKS, 'Ticken anhören', () => {
        sound('tick', config(settings), 'test');
        setTimeout(() => sound('tick', config(settings), 'test'), 1000);
      }),
      sel('Signal bei Phasenwechsel', 'alarm', ALARMS, 'Signal anhören', () => sound('alarm', config(settings))),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Lautstärke'),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 5,
          value: p.volume,
          onchange: (e) => {
            p.volume = Number(e.target.value);
            changed();
          },
        })
      )
    );
  }

  async function openSettings() {
    const db = NM.app.state.db;
    if (!db) return;
    await modal({ title: '🍅 Pomodoro-Einstellungen', wide: true, body: settingsForm(db.settings), buttons: [{ label: 'Schließen', value: true, kind: 'primary' }] });
    update();
  }

  NM.pomodoro = { config, next, phaseMinutes, widget, settingsForm, openSettings, start, pause, reset, tick, mode, state: () => st };
})((globalThis.NM = globalThis.NM || {}));
