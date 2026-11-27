/* OrdoNota – Aufgaben einer Klassenarbeit aus der Begleitdatei übernehmen (seit 2.23, PLANUNG.md AQ-3).
 * Rein, ohne DOM. Die Begleitdatei „<KA-Datei> (Aufgaben).json“ schreibt das Bauskript der Klassenarbeit in der Materialsammlung:
 *   { format: "ordonota-ka-aufgaben", formatVersion: 1, katalog?: { id, version },
 *     arbeit: { name, bereich: "ka" | "sonstige" }, teile?: [ { name } ],
 *     aufgaben: [ { name, punkte, bonus?, teil?, kompetenzen?: [Kennung] } ] }
 * Jede Teilaufgabe mit eigenen Punkten ist eine Aufgabe („1a“, „1b“). Unbekannte Felder werden übergangen. */
(function (NM) {
  'use strict';

  const FORMAT = 'ordonota-ka-aufgaben';
  const FORMAT_VERSION = 1;

  const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  /** Aufgabennamen vergleichen: ohne Leerraum, ohne Groß-/Kleinschreibung, „Aufgabe 1a“ = „1a“ = „1 a)“. */
  const nameKey = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/^aufgabe\s*/, '')
      .replace(/[\s)]+/g, '');

  /**
   * Datei lesen und prüfen.
   * @returns { ok: true, data: { katalog, arbeit, teile, aufgaben }, warnings: [Text] } | { ok: false, error: Text }
   */
  function parse(text) {
    let raw;
    try {
      raw = JSON.parse(String(text || '').replace(/^﻿/, ''));
    } catch (e) {
      return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
    }
    if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) return { ok: false, error: 'Das ist keine Begleitdatei einer Klassenarbeit („… (Aufgaben).json“).' };
    if (raw.formatVersion !== FORMAT_VERSION) return { ok: false, error: `Formatversion ${raw.formatVersion} kennt diese OrdoNota-Version nicht (nur ${FORMAT_VERSION}). Bitte OrdoNota aktualisieren.` };
    const warnings = [];
    const arbeit = raw.arbeit && typeof raw.arbeit === 'object' ? raw.arbeit : {};
    const teile = (Array.isArray(raw.teile) ? raw.teile : []).map((t, i) => ({ name: str(t && t.name) || `Teil ${i + 1}` }));
    const aufgaben = [];
    const seen = new Set();
    for (const [i, a] of (Array.isArray(raw.aufgaben) ? raw.aufgaben : []).entries()) {
      const name = str(a && a.name, 40);
      const punkte = Number(a && a.punkte);
      if (!name) return { ok: false, error: `Aufgabe ${i + 1} hat keinen Namen.` };
      if (seen.has(nameKey(name))) return { ok: false, error: `Die Aufgabe „${name}“ kommt doppelt vor.` };
      seen.add(nameKey(name));
      if (!(punkte > 0) || punkte > 1000) return { ok: false, error: `Aufgabe „${name}“: Punkte fehlen oder sind ungültig.` };
      let teil = null;
      if (teile.length) {
        teil = Number.isInteger(a.teil) && a.teil >= 0 && a.teil < teile.length ? a.teil : 0;
        if (teil !== a.teil) warnings.push(`Aufgabe „${name}“ gehört zu keinem gültigen Teil und kommt in „${teile[0].name}“.`);
      }
      const kompetenzen = NM.competencies.cleanTaskIds(a.kompetenzen);
      aufgaben.push({ name, punkte, bonus: a.bonus === true, teil, kompetenzen });
    }
    if (!aufgaben.length) return { ok: false, error: 'Die Datei enthält keine Aufgaben.' };
    const kat = raw.katalog && typeof raw.katalog === 'object' ? raw.katalog : null;
    const version = kat ? Math.floor(Number(kat.version)) : NaN;
    return {
      ok: true,
      warnings,
      data: {
        katalog: kat && str(kat.id, 64) ? { id: str(kat.id, 64), version: version >= 1 ? version : null } : null,
        arbeit: { name: str(arbeit.name) || 'Klassenarbeit', bereich: arbeit.bereich === 'sonstige' ? 'other' : 'ka' },
        teile,
        aufgaben,
      },
    };
  }

  /** Alle Kennungen der Datei in Reihenfolge des ersten Auftretens. */
  function allIds(data) {
    const out = [];
    for (const a of data.aufgaben) for (const id of a.kompetenzen) if (!out.includes(id)) out.push(id);
    return out;
  }

  /** Summen für die Anzeige: { n, max, bonus } */
  function sums(data) {
    const add = (bonus) => data.aufgaben.filter((a) => a.bonus === bonus).reduce((s, a) => s + a.punkte, 0);
    return { n: data.aufgaben.length, max: add(false), bonus: add(true) };
  }

  /** Kleinste nötige Punkte-Genauigkeit (1, 0,5 oder 0,1) für die Höchstpunkte der Datei. */
  function neededPrecision(data) {
    const fits = (step) => data.aufgaben.every((a) => Math.abs(Math.round(a.punkte / step) * step - a.punkte) < 1e-9);
    return fits(1) ? 1 : fits(0.5) ? 0.5 : 0.1;
  }

  /** Kennungen einer Aufgabe nach der Zuordnung map (Kennung → Kennung | '' = weglassen), ohne Doppelte. */
  function mapIds(ids, map) {
    const out = [];
    for (const id of ids) {
      const v = map && Object.prototype.hasOwnProperty.call(map, id) ? map[id] : id;
      if (v && !out.includes(v)) out.push(v);
    }
    return out;
  }

  /**
   * Aufgaben (und Teile) des Tests durch die der Datei ersetzen. map = null → ohne Kompetenzen (kein Katalog).
   * Genauigkeit wird nur feiner, nie gröber. Ergebnisse bleiben (es gibt noch keine Punkte, siehe Aufrufer).
   */
  function replaceTasks(test, data, map, uid) {
    const parts = data.teile.map((t) => ({ id: uid(), name: t.name, weight: 1 }));
    test.tasks = data.aufgaben.map((a) => {
      const task = { id: uid(), name: a.name, max: a.punkte };
      if (a.bonus) task.bonus = true;
      if (parts.length) task.partId = parts[a.teil].id;
      const ids = map ? mapIds(a.kompetenzen, map) : [];
      if (ids.length) task.competencies = ids;
      return task;
    });
    if (parts.length) {
      test.parts = parts;
      test.partMode = 'sum';
    } else {
      delete test.parts;
      delete test.partMode;
    }
    const need = neededPrecision(data);
    if (!(Number(test.precision) <= need)) test.precision = need;
    return test.tasks.length;
  }

  /**
   * Vorhandene Aufgaben den Aufgaben der Datei zuordnen (gleicher Name nach nameKey).
   * @returns [{ task, idx: Index in data.aufgaben | null }]
   */
  function matchTasks(tasks, data) {
    const byKey = new Map(data.aufgaben.map((a, i) => [nameKey(a.name), i]));
    return tasks.map((task) => {
      const i = byKey.get(nameKey(task.name));
      return { task, idx: i === undefined ? null : i };
    });
  }

  /** Nur Kompetenzen übernehmen: zugeordnete Aufgaben bekommen die Kennungen der Datei (auch keine), andere bleiben. */
  function setCompetencies(rows, data, map) {
    let n = 0;
    for (const r of rows) {
      if (r.idx === null) continue;
      const ids = mapIds(data.aufgaben[r.idx].kompetenzen, map);
      const old = (r.task.competencies || []).join('|');
      if (ids.length) r.task.competencies = ids;
      else delete r.task.competencies;
      if (old !== ids.join('|')) n++;
    }
    return n;
  }

  NM.kaimport = { FORMAT, FORMAT_VERSION, parse, nameKey, allIds, sums, neededPrecision, mapIds, replaceTasks, matchTasks, setCompetencies };
})(window.NM = window.NM || {});
