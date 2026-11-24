/* OrdoNota – Kompetenzkataloge und Kompetenzen je Aufgabe (seit 2.9, PLANUNG.md Abschnitt AI).
 * Rein, ohne DOM. Ein Katalog liegt in db.settings.competencyCatalogs im selben Aufbau wie die
 * Austauschdatei (Format „ordonota-kompetenzkatalog“), nur ohne die Felder format/formatVersion:
 *   { id, name, fach, version, stufen: { teilweise, sicher },
 *     bereiche: [ { id, name, kompetenzen: [ { id, name, ausgeblendet?, teil?: [ { id, name, ausgeblendet? } ] } ] } ] }
 * Ein Kurs zeigt mit course.catalogId auf einen Katalog, eine Aufgabe trägt task.competencies = [Kennungen].
 * Kennungen werden nie neu vergeben; benutzte lassen sich nur ausblenden. */
(function (NM) {
  'use strict';

  const FORMAT = 'ordonota-kompetenzkatalog';
  const FORMAT_VERSION = 1;
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
  const STUFEN = { teilweise: 50, sicher: 80 };
  const FEW_POINTS = 3; // weniger mögliche Punkte → Hinweis „wenig Daten“

  // Bildungsstandards Mathematik ESA/MSA (KMK, 23.06.2022). Das Dokument nummeriert nicht;
  // die Kennungen folgen der Reihenfolge dort. Muss mit vorlagen/kompetenzen/mathe-sek1.json übereinstimmen (Test).
  const TEMPLATES = [
    {
      key: 'mathe-sek1',
      label: 'Mathematik Sek I (Bildungsstandards 2022)',
      catalog: {
        id: 'mathe-sek1',
        name: 'Mathematik Sek I',
        fach: 'Mathematik',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'K',
            name: 'Prozessbezogen',
            kompetenzen: [
              { id: 'M-K1', name: 'Mathematisch argumentieren' },
              { id: 'M-K2', name: 'Mathematisch kommunizieren' },
              { id: 'M-K3', name: 'Probleme mathematisch lösen' },
              { id: 'M-K4', name: 'Mathematisch modellieren' },
              { id: 'M-K5', name: 'Mathematisch darstellen' },
              { id: 'M-K6', name: 'Mit mathematischen Objekten umgehen' },
              { id: 'M-K7', name: 'Mit Medien mathematisch arbeiten' },
            ],
          },
          {
            id: 'L',
            name: 'Inhaltlich (Leitideen)',
            kompetenzen: [
              { id: 'M-L1', name: 'Zahl und Operation' },
              { id: 'M-L2', name: 'Größen und Messen' },
              { id: 'M-L3', name: 'Strukturen und funktionaler Zusammenhang' },
              { id: 'M-L4', name: 'Raum und Form' },
              { id: 'M-L5', name: 'Daten und Zufall' },
            ],
          },
        ],
      },
    },
  ];

  const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const copy = (x) => JSON.parse(JSON.stringify(x));

  // ---------- Bereinigen ----------

  function cleanStufen(s) {
    const o = s && typeof s === 'object' ? s : {};
    let t = Number(o.teilweise);
    let k = Number(o.sicher);
    if (!(t > 0 && t < 100)) t = STUFEN.teilweise;
    if (!(k > 0 && k <= 100)) k = STUFEN.sicher;
    if (!(t < k)) return Object.assign({}, STUFEN);
    return { teilweise: t, sicher: k };
  }

  function cleanEntry(x, seen) {
    if (!x || typeof x !== 'object') return null;
    const id = str(x.id, 32);
    if (!ID_RE.test(id) || seen.has(id)) return null;
    seen.add(id);
    const e = { id, name: str(x.name) || id };
    if (x.ausgeblendet) e.ausgeblendet = true;
    return e;
  }

  /** Katalog bereinigen (beim Öffnen und beim Import). Kaputte oder doppelte Einträge fallen weg. null = kein Katalog. */
  function clean(cat) {
    if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return null;
    const id = str(cat.id, 64);
    if (!ID_RE.test(id)) return null;
    const seen = new Set(); // Kennungen von Kompetenzen und Teilkompetenzen
    const bseen = new Set();
    const bereiche = [];
    for (const b of Array.isArray(cat.bereiche) ? cat.bereiche : []) {
      if (!b || typeof b !== 'object') continue;
      let bid = str(b.id, 32);
      if (!ID_RE.test(bid) || bseen.has(bid)) bid = newBereichId(bseen);
      bseen.add(bid);
      const kompetenzen = [];
      for (const k of Array.isArray(b.kompetenzen) ? b.kompetenzen : []) {
        const e = cleanEntry(k, seen);
        if (!e) continue;
        const teil = [];
        for (const t of Array.isArray(k.teil) ? k.teil : []) {
          const te = cleanEntry(t, seen);
          if (te) teil.push(te);
        }
        if (teil.length) e.teil = teil;
        kompetenzen.push(e);
      }
      bereiche.push({ id: bid, name: str(b.name) || bid, kompetenzen });
    }
    const v = Math.floor(Number(cat.version));
    return { id, name: str(cat.name) || str(cat.fach) || id, fach: str(cat.fach), version: v >= 1 ? v : 1, stufen: cleanStufen(cat.stufen), bereiche };
  }

  function cleanList(list) {
    const out = [];
    const ids = new Set();
    for (const x of Array.isArray(list) ? list : []) {
      const c = clean(x);
      if (c && !ids.has(c.id)) {
        ids.add(c.id);
        out.push(c);
      }
    }
    return out;
  }

  /** Kennungsliste einer Aufgabe bereinigen: nur Texte, ohne Doppelte. */
  function cleanTaskIds(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const x of list) if (typeof x === 'string' && x && !out.includes(x)) out.push(x);
    return out;
  }

  function newBereichId(taken) {
    for (let i = 1; ; i++) if (!taken.has('B' + i)) return 'B' + i;
  }

  // ---------- Lesen ----------

  const catalogs = (db) => (db && db.settings && Array.isArray(db.settings.competencyCatalogs) ? db.settings.competencyCatalogs : []);
  const byId = (db, id) => catalogs(db).find((c) => c.id === id) || null;
  /** Katalog des Kurses oder null. */
  const forCourse = (db, course) => (course && course.catalogId ? byId(db, course.catalogId) : null);

  /**
   * Alle Einträge flach, in Katalogreihenfolge:
   * [{ id, name, level: 'komp'|'teil', parent (Kennung der Kompetenz bei Teilen), bereich, hidden }]
   * hidden: selbst ausgeblendet oder Teil einer ausgeblendeten Kompetenz.
   */
  function entries(cat) {
    const out = [];
    if (!cat) return out;
    for (const b of cat.bereiche || []) {
      for (const k of b.kompetenzen || []) {
        out.push({ id: k.id, name: k.name, level: 'komp', parent: null, bereich: b.id, hidden: !!k.ausgeblendet });
        for (const t of k.teil || []) out.push({ id: t.id, name: t.name, level: 'teil', parent: k.id, bereich: b.id, hidden: !!k.ausgeblendet || !!t.ausgeblendet });
      }
    }
    return out;
  }

  const find = (cat, id) => entries(cat).find((e) => e.id === id) || null;

  /** Rohes Objekt (Kompetenz oder Teil) und seine Liste im Katalog, zum Bearbeiten. */
  function locate(cat, id) {
    for (const b of (cat && cat.bereiche) || []) {
      for (const k of b.kompetenzen) {
        if (k.id === id) return { obj: k, list: b.kompetenzen, bereich: b, parent: null };
        for (const t of k.teil || []) if (t.id === id) return { obj: t, list: k.teil, bereich: b, parent: k };
      }
    }
    return null;
  }

  /** Kurze Anzeige einer Kennung: ohne Fachvorsatz („M-K2“ → „K2“). */
  const short = (id) => (/^[^-]+-./.test(id) ? id.slice(id.indexOf('-') + 1) : id);

  /** Kurse, die den Katalog verwenden. */
  const coursesUsing = (db, catId) => ((db && db.courses) || []).filter((c) => c.catalogId === catId);

  /** Alle Aufgaben aller Tests der Kurse, die den Katalog verwenden. */
  function tasksUsing(db, catId) {
    const out = [];
    for (const c of coursesUsing(db, catId)) for (const a of c.assessments || []) if (a.kind === 'test' && a.test) for (const t of a.test.tasks || []) out.push(t);
    return out;
  }

  /** Kennungen, die in Aufgaben vorkommen (in Kursen mit diesem Katalog). */
  function usedIds(db, catId) {
    const s = new Set();
    for (const t of tasksUsing(db, catId)) for (const id of t.competencies || []) s.add(id);
    return s;
  }

  /** Wie oft ist die Kennung an Aufgaben vergeben? */
  const useCount = (db, catId, id) => tasksUsing(db, catId).filter((t) => (t.competencies || []).includes(id)).length;

  // ---------- Fach → Katalog ----------

  function normFach(f) {
    return String(f || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /** Passt der Fachtext eines Kurses zum Fach eines Katalogs? „Mathe“ ~ „Mathematik“ (Anfang ab 4 Zeichen). */
  function fachMatches(a, b) {
    const x = normFach(a);
    const y = normFach(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const [s, l] = x.length <= y.length ? [x, y] : [y, x];
    return s.length >= 4 && l.startsWith(s);
  }

  /** Katalog-id zum Fach oder null (nur bei genau einem passenden Katalog). */
  function guessForFach(db, fach) {
    const hits = catalogs(db).filter((c) => fachMatches(fach, c.fach) || fachMatches(fach, c.name));
    return hits.length === 1 ? hits[0].id : null;
  }

  // ---------- Ändern ----------

  /** Freie Katalog-id aus einem Wunsch („mathe-sek1“, sonst „mathe-sek1-2“, …). */
  function freeCatalogId(db, wish) {
    const base = ID_RE.test(wish || '') ? wish : 'katalog';
    const taken = new Set(catalogs(db).map((c) => c.id));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }

  /** Neuen Katalog aus einer Vorlage anlegen und anhängen. */
  function addFromTemplate(db, key) {
    const tpl = TEMPLATES.find((t) => t.key === key);
    if (!tpl) throw new Error('Diese Vorlage gibt es nicht.');
    const cat = copy(tpl.catalog);
    cat.id = freeCatalogId(db, cat.id);
    db.settings.competencyCatalogs.push(cat);
    return cat;
  }

  /** Leeren Katalog anlegen und anhängen. */
  function addEmpty(db, name, fach) {
    const cat = clean({ id: freeCatalogId(db, 'katalog'), name: name || 'Neuer Katalog', fach: fach || '', version: 1, bereiche: [{ id: 'B1', name: 'Bereich 1', kompetenzen: [] }] });
    db.settings.competencyCatalogs.push(cat);
    return cat;
  }

  /** Nach jeder Änderung am Katalog aufrufen. */
  const bump = (cat) => {
    cat.version = (Number(cat.version) || 0) + 1;
  };

  /** Alle Kennungen im Katalog (Kompetenzen und Teile). */
  const allIds = (cat) => new Set(entries(cat).map((e) => e.id));

  /** Vorschlag für eine neue Kennung: Vorsatz der Nachbarn plus nächste Nummer („M-K8“, „M-K2.3“). */
  function suggestId(cat, bereich, parent) {
    const taken = allIds(cat);
    const siblings = parent ? (parent.teil || []).map((t) => t.id) : bereich.kompetenzen.map((k) => k.id);
    let stem;
    if (parent) stem = parent.id + '.';
    else {
      const m = siblings.length && /^(.*?)(\d+)$/.exec(siblings[siblings.length - 1]);
      stem = m ? m[1] : (bereich.id || 'K') + '';
    }
    for (let i = 1; ; i++) if (!taken.has(stem + i)) return stem + i;
  }

  function addKompetenz(cat, bereichId) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b) return null;
    const k = { id: suggestId(cat, b, null), name: 'Neue Kompetenz' };
    b.kompetenzen.push(k);
    bump(cat);
    return k;
  }

  /** Kompetenz mit vorgegebener Kennung aufnehmen (z. B. aus einer Begleitdatei); Bezeichnung = Kennung. null, wenn ungültig oder vergeben. */
  function addWithId(cat, bereichId, id) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b || !ID_RE.test(String(id || '')) || allIds(cat).has(id)) return null;
    const k = { id, name: id };
    b.kompetenzen.push(k);
    bump(cat);
    return k;
  }

  function addTeil(cat, kompId) {
    const loc = locate(cat, kompId);
    if (!loc || loc.parent) return null;
    const k = loc.obj;
    k.teil = k.teil || [];
    const t = { id: suggestId(cat, loc.bereich, k), name: 'Neue Teilkompetenz' };
    k.teil.push(t);
    bump(cat);
    return t;
  }

  function addBereich(cat) {
    const b = { id: newBereichId(new Set(cat.bereiche.map((x) => x.id))), name: 'Neuer Bereich', kompetenzen: [] };
    cat.bereiche.push(b);
    bump(cat);
    return b;
  }

  /**
   * Kennung ändern. Nur erlaubt, solange keine Aufgabe sie trägt. Teile behalten ihre eigene Kennung.
   * @returns Fehlertext oder '' bei Erfolg
   */
  function renameId(db, cat, oldId, newId) {
    const id = String(newId || '').trim();
    if (id === oldId) return '';
    if (!ID_RE.test(id)) return 'Kennung: nur Buchstaben, Ziffern, Punkt, Bindestrich und Unterstrich, höchstens 32 Zeichen, am Anfang ein Buchstabe oder eine Ziffer.';
    if (allIds(cat).has(id)) return `Die Kennung „${id}“ gibt es in diesem Katalog schon.`;
    if (useCount(db, cat.id, oldId)) return `„${oldId}“ ist schon an Aufgaben vergeben und bleibt deshalb fest.`;
    const loc = locate(cat, oldId);
    if (!loc) return 'Diesen Eintrag gibt es nicht.';
    loc.obj.id = id;
    bump(cat);
    return '';
  }

  /** Ist der Eintrag (oder einer seiner Teile) an Aufgaben vergeben? */
  function inUse(db, cat, id) {
    const loc = locate(cat, id);
    if (!loc) return false;
    const ids = [id].concat(loc.parent ? [] : (loc.obj.teil || []).map((t) => t.id));
    const used = usedIds(db, cat.id);
    return ids.some((x) => used.has(x));
  }

  /** Unbenutzten Eintrag löschen (mit seinen Teilen). @returns true, wenn gelöscht */
  function removeEntry(db, cat, id) {
    if (inUse(db, cat, id)) return false;
    const loc = locate(cat, id);
    if (!loc) return false;
    loc.list.splice(loc.list.indexOf(loc.obj), 1);
    if (loc.parent && !loc.parent.teil.length) delete loc.parent.teil;
    bump(cat);
    return true;
  }

  /** Eintrag aus- oder einblenden. */
  function setHidden(cat, id, hidden) {
    const loc = locate(cat, id);
    if (!loc) return;
    if (hidden) loc.obj.ausgeblendet = true;
    else delete loc.obj.ausgeblendet;
    bump(cat);
  }

  /** Bereich löschen, wenn keine seiner Kennungen benutzt ist. */
  function removeBereich(db, cat, bereichId) {
    const b = cat.bereiche.find((x) => x.id === bereichId);
    if (!b) return false;
    const used = usedIds(db, cat.id);
    if (b.kompetenzen.some((k) => used.has(k.id) || (k.teil || []).some((t) => used.has(t.id)))) return false;
    cat.bereiche.splice(cat.bereiche.indexOf(b), 1);
    bump(cat);
    return true;
  }

  /** Katalog löschen, wenn kein Kurs ihn verwendet. */
  function removeCatalog(db, catId) {
    if (coursesUsing(db, catId).length) return false;
    db.settings.competencyCatalogs = catalogs(db).filter((c) => c.id !== catId);
    return true;
  }

  /** Kennung an einer Aufgabe setzen oder entfernen. */
  function toggleTask(task, id, on) {
    const list = cleanTaskIds(task.competencies);
    const has = list.includes(id);
    if (on && !has) list.push(id);
    if (!on && has) list.splice(list.indexOf(id), 1);
    if (list.length) task.competencies = list;
    else delete task.competencies;
  }

  // ---------- Austauschdatei ----------

  /** Katalog als JSON-Text der Austauschdatei. */
  function exportJson(cat) {
    return JSON.stringify(Object.assign({ format: FORMAT, formatVersion: FORMAT_VERSION }, copy(cat)), null, 2) + '\n';
  }

  /** Dateiname für den Export. */
  const exportName = (cat) => `Kompetenzkatalog – ${String(cat.name || cat.id).replace(/[\\/:*?"<>|]/g, '_')}.json`;

  /**
   * Austauschdatei lesen. Wirft Error mit deutschem Text, wenn das Format nicht passt.
   * @returns bereinigter Katalog (noch nicht in der Datenbank)
   */
  function parseImport(text) {
    let x;
    try {
      x = JSON.parse(String(text || '').replace(/^﻿/, ''));
    } catch (e) {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    if (!x || x.format !== FORMAT) throw new Error('Die Datei ist kein Kompetenzkatalog (Formatkennung fehlt).');
    if (Number(x.formatVersion) !== FORMAT_VERSION) throw new Error(`Diese Katalogdatei hat Formatversion ${x.formatVersion}; diese App kennt Version ${FORMAT_VERSION}. Bitte OrdoNota aktualisieren.`);
    const cat = clean(x);
    if (!cat) throw new Error('Der Katalog hat keine gültige Kennung (id).');
    if (!entries(cat).length) throw new Error('Der Katalog enthält keine Kompetenzen.');
    return cat;
  }

  /**
   * Importierten Katalog übernehmen. mode: 'new' (als neuer Katalog, id wird frei gemacht) oder 'replace'
   * (ersetzt den Katalog mit derselben id; nur wenn keine benutzte Kennung verloren geht).
   * @returns { cat, missing: [Kennungen, die fehlen würden] } – bei missing.length wurde nichts ersetzt
   */
  function applyImport(db, cat, mode) {
    const list = db.settings.competencyCatalogs;
    const old = byId(db, cat.id);
    if (mode === 'replace' && old) {
      const have = allIds(cat);
      const missing = [...usedIds(db, old.id)].filter((id) => !have.has(id));
      if (missing.length) return { cat: old, missing };
      cat.version = Math.max(Number(cat.version) || 1, (Number(old.version) || 0) + 1);
      list[list.indexOf(old)] = cat;
      return { cat, missing: [] };
    }
    cat.id = freeCatalogId(db, cat.id);
    list.push(cat);
    return { cat, missing: [] };
  }

  // ---------- Punkte je Kompetenz ----------

  /**
   * Mögliche Punkte je Kennung über eine Liste von Aufgaben. Bonusaufgaben zählen mit (PLANUNG AI, 12).
   * Eine Kompetenz zählt auch die Aufgaben ihrer Teile (jede Aufgabe einmal).
   * @returns Map Kennung → Punkte
   */
  function pointsPer(cat, tasks) {
    const out = new Map();
    const parentOf = new Map(entries(cat).filter((e) => e.level === 'teil').map((e) => [e.id, e.parent]));
    for (const t of tasks || []) {
      const max = Number(t.max) || 0;
      const ids = new Set();
      for (const id of t.competencies || []) {
        ids.add(id);
        if (parentOf.has(id)) ids.add(parentOf.get(id));
      }
      for (const id of ids) out.set(id, (out.get(id) || 0) + max);
    }
    return out;
  }

  /** Templates für die Prüfung gegen vorlagen/*.json (Test). */
  const templateFile = (key) => {
    const tpl = TEMPLATES.find((t) => t.key === key);
    return tpl ? exportJson(tpl.catalog) : null;
  };

  NM.competencies = {
    FORMAT,
    FORMAT_VERSION,
    STUFEN,
    FEW_POINTS,
    TEMPLATES,
    ID_RE,
    clean,
    cleanList,
    cleanTaskIds,
    catalogs,
    byId,
    forCourse,
    entries,
    find,
    locate,
    short,
    coursesUsing,
    usedIds,
    useCount,
    inUse,
    fachMatches,
    guessForFach,
    addFromTemplate,
    addEmpty,
    addKompetenz,
    addWithId,
    addTeil,
    addBereich,
    bump,
    renameId,
    removeEntry,
    removeBereich,
    removeCatalog,
    setHidden,
    toggleTask,
    exportJson,
    exportName,
    parseImport,
    applyImport,
    pointsPer,
    templateFile,
  };
})(window.NM = window.NM || {});
