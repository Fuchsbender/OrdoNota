/* OrdoNota – Personenregister (seit Schema 5): kursübergreifende Personen. Rein, ohne DOM.
 *
 * db.people: [ { id, last, first, created, orphanSince?, ausgleiche? } ], jeder Kurseintrag course.students[].personId.
 * ausgleiche (2.5, Nachteilsausgleich, Gesundheitsdaten): [ { id, art: 'lrs' | 'dyskalkulie' | 'sonst', text?, faecher: [..], massnahmen, bis? } ]
 * – faecher leer = alle Fächer, bis = letzter gültiger Tag (ISO-Datum). Nie auf Beamer, Ausdrucke oder in die Excel-Schülerliste.
 * notizen (2.6, Notizverlauf, intern): [ { id, datum, text, courseId? } ] – nie gedruckt, nie auf dem Beamer.
 * Name, Foto, Mail-Adresse, I-Status, Einstufung und „Aktiv“ bleiben am Kurseintrag; Noten bleiben am Kurs.
 * Später hängen an der Person weitere Listen (Notizen, Ausgleiche, Förderpläne), die beim Zusammenführen
 * zusammengelegt werden.
 */
(function (NM) {
  'use strict';

  const today = () => NM.util.todayISO();
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  /** Vergleichsschlüssel eines Namens (ohne Groß-/Kleinschreibung und überzählige Leerzeichen). */
  const nameKey = (last, first) => norm(last) + '|' + norm(first);
  const hasName = (x) => !!(norm(x.last) || norm(x.first));

  function list(db) {
    if (!Array.isArray(db.people)) db.people = [];
    return db.people;
  }

  function byId(db, id) {
    return list(db).find((p) => p.id === id) || null;
  }

  function newPerson(last, first, created) {
    return { id: NM.util.uid(), last: String(last || ''), first: String(first || ''), created: created || today() };
  }

  /** Alle Kurseinträge je Person: Map personId → [{ course, student }]. */
  function index(db) {
    const map = new Map();
    for (const c of db.courses || []) {
      for (const s of c.students || []) {
        if (!s.personId) continue;
        if (!map.has(s.personId)) map.set(s.personId, []);
        map.get(s.personId).push({ course: c, student: s });
      }
    }
    return map;
  }

  /** Kurseinträge einer Person. */
  function entries(db, pid) {
    return index(db).get(pid) || [];
  }

  /**
   * Register vollständig machen (bei jedem Öffnen und nach jeder Änderung):
   * - Kurseintrag ohne (gültige) personId → eigene neue Person (nie automatisch zusammenführen),
   *   ebenso ein zweiter Eintrag derselben Person im selben Kurs;
   * - Person mit genau einem Kurseintrag übernimmt dessen Namen;
   * - orphanSince: gesetzt, sobald eine Person in keinem Kurs mehr steht, entfernt, wenn sie wieder in einem steht.
   * `created`: Erstellungsdatum für neu angelegte Personen (Migration: Datum der Datenbank).
   */
  function ensure(db, { created } = {}) {
    const people = list(db).filter((p) => p && typeof p === 'object' && p.id);
    db.people = people;
    const known = new Map(people.map((p) => [p.id, p]));
    for (const c of db.courses || []) {
      const inCourse = new Set();
      for (const s of c.students || []) {
        let p = s.personId ? known.get(s.personId) : null;
        if (!p || inCourse.has(p.id)) {
          p = newPerson(s.last, s.first, created);
          people.push(p);
          known.set(p.id, p);
          s.personId = p.id;
        }
        inCourse.add(p.id);
      }
    }
    const idx = index(db);
    for (const p of people) {
      const es = idx.get(p.id) || [];
      if (es.length) delete p.orphanSince;
      else if (!p.orphanSince) p.orphanSince = today();
      if (es.length === 1) {
        p.last = String(es[0].student.last || '');
        p.first = String(es[0].student.first || '');
      }
      if (typeof p.last !== 'string') p.last = String(p.last || '');
      if (typeof p.first !== 'string') p.first = String(p.first || '');
      if (!p.created) p.created = created || today();
    }
    return db;
  }

  /** Personen mit gleichem Namen (Register oder ein Kurseintrag), wahlweise ohne die, die schon im Kurs `exceptCourse` stehen. */
  function matches(db, last, first, { exceptCourse = null } = {}) {
    const key = nameKey(last, first);
    if (key === '|') return [];
    const idx = index(db);
    const inCourse = new Set(((exceptCourse && exceptCourse.students) || []).map((s) => s.personId));
    return list(db).filter((p) => {
      if (inCourse.has(p.id)) return false;
      if (nameKey(p.last, p.first) === key) return true;
      return (idx.get(p.id) || []).some((e) => nameKey(e.student.last, e.student.first) === key);
    });
  }

  /** Stehen zwei Personen gemeinsam in einem Kurs? Dann dürfen sie nicht zusammengeführt werden. */
  function shareCourse(db, aId, bId) {
    return (db.courses || []).some((c) => {
      const ids = new Set((c.students || []).map((s) => s.personId));
      return ids.has(aId) && ids.has(bId);
    });
  }

  /**
   * Vorschläge zum Zusammenführen: gleicher Name im Register oder gleiche Mail-Adresse in einem Kurseintrag,
   * nicht schon dieselbe Person, nicht gemeinsam in einem Kurs. Ältere Person zuerst (sie bliebe erhalten).
   * @returns [{ keep, gone, reason: 'name' | 'mail' }]
   */
  function suggestPairs(db) {
    const people = list(db);
    const idx = index(db);
    const older = (a, b) => (String(a.created || '') < String(b.created || '') || (a.created === b.created && people.indexOf(a) < people.indexOf(b)) ? [a, b] : [b, a]);
    const out = [];
    const seen = new Set();
    const add = (a, b, reason) => {
      if (a.id === b.id) return;
      const k = [a.id, b.id].sort().join('|');
      if (seen.has(k) || shareCourse(db, a.id, b.id)) return;
      seen.add(k);
      const [keep, gone] = older(a, b);
      out.push({ keep, gone, reason });
    };
    const groups = (keyOf) => {
      const m = new Map();
      for (const p of people) {
        for (const k of keyOf(p)) {
          if (!k) continue;
          if (!m.has(k)) m.set(k, []);
          if (!m.get(k).includes(p)) m.get(k).push(p);
        }
      }
      return [...m.values()].filter((g) => g.length > 1);
    };
    for (const g of groups((p) => (hasName(p) ? [nameKey(p.last, p.first)] : []))) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) add(g[i], g[j], 'name');
    const mails = (p) => (idx.get(p.id) || []).map((e) => norm(e.student.email)).filter(Boolean);
    for (const g of groups(mails)) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) add(g[i], g[j], 'mail');
    return out;
  }

  /**
   * `gone` in `keep` aufgehen lassen: alle Kurseinträge zeigen auf `keep`, Listen an der Person werden
   * zusammengelegt, fehlende Felder übernommen, `keep` behält Namen und das ältere Erstellungsdatum.
   */
  function merge(db, keepId, goneId) {
    const keep = byId(db, keepId);
    const gone = byId(db, goneId);
    if (!keep || !gone || keep === gone) throw new Error('Personen nicht gefunden.');
    if (shareCourse(db, keepId, goneId)) throw new Error('Die beiden stehen im selben Kurs und können nicht dieselbe Person sein.');
    for (const e of entries(db, goneId)) e.student.personId = keepId;
    for (const [k, v] of Object.entries(gone)) {
      if (['id', 'last', 'first', 'created', 'orphanSince'].includes(k)) continue;
      if (Array.isArray(v) && Array.isArray(keep[k])) keep[k] = keep[k].concat(v);
      else if (keep[k] === undefined) keep[k] = v;
    }
    if (gone.created && (!keep.created || gone.created < keep.created)) keep.created = gone.created;
    db.people = list(db).filter((p) => p !== gone);
    ensure(db);
    return keep;
  }

  /**
   * Mehrere Paare nacheinander zusammenführen (Dialog „Personen zusammenführen“). Ist eine Person schon in
   * einer anderen aufgegangen, gilt deren Ziel; Paare, die inzwischen dieselbe Person sind oder gemeinsam in
   * einem Kurs stehen, werden übersprungen.
   * @param pairs [{ keepId, goneId }]
   * @returns { done, skipped }
   */
  function mergePairs(db, pairs) {
    const into = new Map();
    const target = (id) => {
      while (into.has(id)) id = into.get(id);
      return id;
    };
    let done = 0;
    let skipped = 0;
    for (const { keepId, goneId } of pairs) {
      const k = target(keepId);
      const g = target(goneId);
      if (k === g || !byId(db, k) || !byId(db, g) || shareCourse(db, k, g)) {
        skipped++;
        continue;
      }
      merge(db, k, g);
      into.set(g, k);
      done++;
    }
    return { done, skipped };
  }

  /**
   * Kurseinträge (ids der course.students) von der Person abtrennen; sie werden zu einer neuen Person mit dem
   * Namen des ersten gewählten Eintrags. Was an der Person hängt, bleibt bei der bisherigen – außer Notizen
   * zu einem der abgetrennten Kurse (seit 2.6), die gehen mit.
   */
  function split(db, pid, studentIds) {
    const all = entries(db, pid);
    const chosen = all.filter((e) => studentIds.includes(e.student.id));
    if (!chosen.length) throw new Error('Keine Kurseinträge gewählt.');
    if (chosen.length === all.length) throw new Error('Mindestens ein Kurseintrag muss bei der Person bleiben.');
    const p = newPerson(chosen[0].student.last, chosen[0].student.first);
    list(db).push(p);
    for (const e of chosen) e.student.personId = p.id;
    // 2.6: Notizen zu einem abgetrennten Kurs gehen mit, Notizen ohne Kurs bleiben
    const old = byId(db, pid);
    const moved = new Set(chosen.map((e) => e.course.id));
    if (old && Array.isArray(old.notizen) && old.notizen.some((n) => n.courseId && moved.has(n.courseId))) {
      p.notizen = old.notizen.filter((n) => n.courseId && moved.has(n.courseId));
      old.notizen = old.notizen.filter((n) => !(n.courseId && moved.has(n.courseId)));
    }
    ensure(db);
    return p;
  }

  /** Person aus dem Register löschen – nur, wenn sie in keinem Kurs mehr steht. */
  function remove(db, pid) {
    if (entries(db, pid).length) throw new Error('Die Person steht noch in einem Kurs.');
    db.people = list(db).filter((p) => p.id !== pid);
    return db;
  }

  /**
   * Welche Personen stünden in keinem Kurs mehr, wenn diese Kurseinträge wegfielen?
   * `drop(course, student)` → true für jeden Eintrag, der wegfällt.
   */
  function orphansIf(db, drop) {
    const left = new Map();
    for (const c of db.courses || []) for (const s of c.students || []) if (s.personId) left.set(s.personId, (left.get(s.personId) || 0) + (drop(c, s) ? 0 : 1));
    return list(db).filter((p) => left.has(p.id) && left.get(p.id) === 0);
  }

  // ---------- Nachteilsausgleich (2.5) ----------
  const AUSGLEICH_ARTEN = [
    ['lrs', 'LRS (Lese-Rechtschreib-Schwäche)'],
    ['dyskalkulie', 'Dyskalkulie'],
    ['sonst', 'Sonstiges'],
  ];
  const AUSGLEICH_KURZ_MAX = 6;

  /** Kürzel eines Ausgleichs für die Markierung neben dem Namen. */
  function ausgleichKurz(a) {
    if (a.art === 'lrs') return 'LRS';
    if (a.art === 'dyskalkulie') return 'DK';
    return String(a.text || '').trim().slice(0, AUSGLEICH_KURZ_MAX) || 'NA';
  }

  /** Lange Bezeichnung (Dialog, Liste, Hinweis beim Darüberfahren). */
  function ausgleichName(a) {
    if (a.art === 'lrs') return 'LRS';
    if (a.art === 'dyskalkulie') return 'Dyskalkulie';
    return String(a.text || '').trim() || 'Nachteilsausgleich';
  }

  /** Abgelaufen, wenn „gültig bis“ vor dem Tag `day` (ISO, Standard heute) liegt. */
  function ausgleichAbgelaufen(a, day = today()) {
    return !!a.bis && String(a.bis) < day;
  }

  /** Gilt der Ausgleich im Fach `fach`? Leere Fächerliste = alle Fächer; ein Kurs ohne Fach passt nur dazu. */
  function ausgleichPasst(a, fach) {
    const list = Array.isArray(a.faecher) ? a.faecher.map(norm).filter(Boolean) : [];
    if (!list.length) return true;
    const f = norm(fach);
    return !!f && list.includes(f);
  }

  function ausgleicheOf(p) {
    return p && Array.isArray(p.ausgleiche) ? p.ausgleiche : [];
  }

  /** Gültige, zum Fach des Kurses passende Ausgleiche eines Kurseintrags. */
  function ausgleicheFuer(db, student, course, day = today()) {
    if (!db || !student || !student.personId) return [];
    return ausgleicheOf(byId(db, student.personId)).filter((a) => !ausgleichAbgelaufen(a, day) && ausgleichPasst(a, course && course.fach));
  }

  /** Fächer aus den Kursen einer Person (ohne doppelte, in der Schreibweise des ersten Kurses), sortiert. */
  function faecherDerPerson(db, pid) {
    const seen = new Map();
    for (const e of entries(db, pid)) {
      const f = String(e.course.fach || '').trim();
      if (f && !seen.has(norm(f))) seen.set(norm(f), f);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'de'));
  }

  /** Ausgleich anlegen oder ersetzen (gleiche id). Bereinigt die Felder, gibt den gespeicherten Eintrag zurück. */
  function setAusgleich(db, pid, data) {
    const p = byId(db, pid);
    if (!p) throw new Error('Person nicht gefunden.');
    const art = AUSGLEICH_ARTEN.some(([k]) => k === data.art) ? data.art : 'sonst';
    const a = { id: data.id || NM.util.uid(), art };
    if (art === 'sonst') a.text = String(data.text || '').trim().slice(0, AUSGLEICH_KURZ_MAX);
    const fs = new Map();
    for (const f of Array.isArray(data.faecher) ? data.faecher : []) if (norm(f) && !fs.has(norm(f))) fs.set(norm(f), String(f).trim());
    a.faecher = [...fs.values()];
    a.massnahmen = String(data.massnahmen || '').trim();
    if (data.bis && /^\d{4}-\d{2}-\d{2}$/.test(data.bis)) a.bis = data.bis;
    if (!Array.isArray(p.ausgleiche)) p.ausgleiche = [];
    const i = p.ausgleiche.findIndex((x) => x.id === a.id);
    if (i >= 0) p.ausgleiche[i] = Object.assign({}, p.ausgleiche[i], a, a.bis ? {} : { bis: undefined }, art === 'sonst' ? {} : { text: undefined });
    else p.ausgleiche.push(a);
    const saved = p.ausgleiche[i >= 0 ? i : p.ausgleiche.length - 1];
    for (const k of Object.keys(saved)) if (saved[k] === undefined) delete saved[k];
    return saved;
  }

  function removeAusgleich(db, pid, aid) {
    const p = byId(db, pid);
    if (p && Array.isArray(p.ausgleiche)) p.ausgleiche = p.ausgleiche.filter((a) => a.id !== aid);
  }

  // ---------- Notizverlauf (2.6) ----------
  const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

  function notizenOf(p) {
    return p && Array.isArray(p.notizen) ? p.notizen : [];
  }

  /**
   * Notizen einer Person, neueste oben (Datum, bei gleichem Datum die später angelegte zuerst).
   * courseId: undefined/'all' = alle, 'none' = ohne Kurs, sonst nur dieser Kurs.
   */
  function notizen(p, courseId = 'all') {
    const all = notizenOf(p);
    return all
      .map((n, i) => [n, i])
      .filter(([n]) => courseId === 'all' || courseId === undefined || (courseId === 'none' ? !n.courseId : n.courseId === courseId))
      .sort((a, b) => (a[0].datum === b[0].datum ? b[1] - a[1] : String(b[0].datum) < String(a[0].datum) ? -1 : 1))
      .map(([n]) => n);
  }

  /** Notiz anlegen oder ändern (gleiche id). Leerer Text → Fehler. */
  function setNotiz(db, pid, data) {
    const p = byId(db, pid);
    if (!p) throw new Error('Person nicht gefunden.');
    const text = String(data.text || '').trim();
    if (!text) throw new Error('Die Notiz ist leer.');
    const n = { id: data.id || NM.util.uid(), datum: ISO_DAY.test(data.datum || '') ? data.datum : today(), text };
    if (data.courseId) n.courseId = data.courseId;
    if (!Array.isArray(p.notizen)) p.notizen = [];
    const i = p.notizen.findIndex((x) => x.id === n.id);
    if (i >= 0) p.notizen[i] = n;
    else p.notizen.push(n);
    return n;
  }

  function removeNotiz(db, pid, nid) {
    const p = byId(db, pid);
    if (p && Array.isArray(p.notizen)) p.notizen = p.notizen.filter((n) => n.id !== nid);
  }

  NM.people = { nameKey, list, byId, index, entries, ensure, matches, shareCourse, suggestPairs, merge, mergePairs, split, remove, orphansIf,
    AUSGLEICH_ARTEN, AUSGLEICH_KURZ_MAX, ausgleichKurz, ausgleichName, ausgleichAbgelaufen, ausgleichPasst, ausgleicheOf, ausgleicheFuer, faecherDerPerson, setAusgleich, removeAusgleich,
    notizenOf, notizen, setNotiz, removeNotiz };
})((globalThis.NM = globalThis.NM || {}));
