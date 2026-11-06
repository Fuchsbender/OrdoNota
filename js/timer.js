/* OrdoNota – Countdown-Timer (reine Logik, ohne DOM). Reiter „Tools“ (js/view-random.js).
   Die Restzeit wird immer aus Startzeit und bisher verstrichener Zeit berechnet, so läuft der
   Timer beim Reiterwechsel, im Pop-up und bei ruckelnder Anzeige gleich weiter. */
(function (NM) {
  'use strict';

  const MAX_MS = 24 * 3600 * 1000 - 1000;
  const clampMs = (ms) => Math.max(0, Math.min(MAX_MS, Math.round(Number(ms) || 0)));

  /** Neuer, angehaltener Timer über totalMs Millisekunden. */
  function create(totalMs) {
    return { total: clampMs(totalMs), elapsed: 0, startedAt: null };
  }

  /** Verstrichene Zeit (ms) zum Zeitpunkt now. */
  function elapsed(t, now) {
    return t.elapsed + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt));
  }

  /** Restzeit (ms, nie negativ). */
  function remaining(t, now) {
    return Math.max(0, t.total - elapsed(t, now));
  }

  /** Zeit über das Ende hinaus (ms), z. B. für „+0:12“. */
  function overtime(t, now) {
    return Math.max(0, elapsed(t, now) - t.total);
  }

  const running = (t) => t.startedAt !== null;
  const finished = (t, now) => t.total > 0 && remaining(t, now) === 0;

  function start(t, now) {
    if (t.total <= 0) return t;
    if (finished(t, now)) {
      // nach dem Ende neu beginnen (der abgelaufene Timer zählt sonst die Überzeit weiter)
      t.elapsed = 0;
      t.startedAt = now;
      return t;
    }
    if (!running(t)) t.startedAt = now;
    return t;
  }

  function pause(t, now) {
    if (!running(t)) return t;
    t.elapsed = elapsed(t, now);
    t.startedAt = null;
    return t;
  }

  function reset(t) {
    t.elapsed = 0;
    t.startedAt = null;
    return t;
  }

  /** Dauer ändern (z. B. ± 1 Minute während des Laufens). Die verstrichene Zeit bleibt. */
  function add(t, deltaMs, now) {
    const left = remaining(t, now);
    const next = Math.max(0, left + deltaMs);
    t.total = clampMs(elapsed(t, now) + next);
    if (t.total < elapsed(t, now)) t.elapsed = t.total; // nicht über das Ende hinaus
    return t;
  }

  /** Anteil der verbleibenden Zeit (1 = voll, 0 = abgelaufen). */
  function fraction(t, now) {
    return t.total > 0 ? remaining(t, now) / t.total : 0;
  }

  /**
   * Zustand für die Farbe: 'idle' (nicht gestartet), 'run', 'warn' (letztes Fünftel, höchstens
   * aber die letzte Minute), 'end' (letzte 10 Sekunden), 'done' (abgelaufen), 'paused'.
   */
  function stage(t, now) {
    if (t.total <= 0) return 'idle';
    const left = remaining(t, now);
    if (left === 0) return 'done';
    if (!running(t)) return elapsed(t, now) > 0 ? 'paused' : 'idle';
    if (left <= 10000) return 'end';
    if (left <= Math.min(60000, t.total / 5) || (t.total > 300000 && left <= 60000)) return 'warn';
    return 'run';
  }

  /** „mm:ss“ bzw. „h:mm:ss“; angezeigt wird aufgerundet (bei 0,4 s Rest steht 0:01). */
  function format(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${String(mm).padStart(2, '0')}:${ss}`;
  }

  /** Eingabe „5“, „5:30“, „1:05:00“ oder „90s“ in Millisekunden (null bei Unsinn). */
  function parse(text) {
    const s = String(text || '').trim().replace(',', '.');
    if (!s) return null;
    let m = /^(\d+(?:\.\d+)?)\s*(s|sek|min|m)?$/i.exec(s);
    if (m) {
      const v = Number(m[1]);
      const sec = m[2] && /^s/i.test(m[2]) ? v : v * 60;
      return sec > 0 ? clampMs(sec * 1000) : null;
    }
    m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (!m) return null;
    const parts = m.slice(1).filter((x) => x !== undefined).map(Number);
    if (parts.slice(1).some((x) => x > 59)) return null;
    const sec = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return sec > 0 ? clampMs(sec * 1000) : null;
  }

  NM.timer = { create, elapsed, remaining, overtime, running, finished, start, pause, reset, add, fraction, stage, format, parse, MAX_MS };
})((globalThis.NM = globalThis.NM || {}));
