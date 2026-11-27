/* OrdoNota – Kompetenzkataloge und Kompetenzen je Aufgabe (seit 2.9, PLANUNG.md Abschnitt AI).
 * Rein, ohne DOM. Ein Katalog liegt in db.settings.competencyCatalogs im selben Aufbau wie die
 * Austauschdatei (Format „ordonota-kompetenzkatalog“), nur ohne die Felder format/formatVersion:
 *   { id, name, fach, version, stufen: { teilweise, sicher },
 *     bereiche: [ { id, name, kompetenzen: [ { id, name, ausgeblendet?, texte?, teil?: [ { id, name, ausgeblendet? } ] } ] } ] }
 * texte (seit 2.24, PLANUNG.md AR): Erklärtexte für den Kompetenzbogen { worum?, noch?, teilweise?, sicher? }, je höchstens 300 Zeichen.
 * Ein Kurs zeigt mit course.catalogId auf einen Katalog, eine Aufgabe trägt task.competencies = [Kennungen].
 * Kennungen werden nie neu vergeben; benutzte lassen sich nur ausblenden. */
(function (NM) {
  'use strict';

  const FORMAT = 'ordonota-kompetenzkatalog';
  const FORMAT_VERSION = 1;
  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
  const STUFEN = { teilweise: 50, sicher: 80 };
  /** Erklärtexte je Kompetenz (seit 2.24): „Darum geht es“ und je Stufe ein Text. */
  const TEXT_KEYS = ['worum', 'noch', 'teilweise', 'sicher'];
  const TEXT_MAX = 300;
  const STUFE_IDS = ['sek1', 'mss']; // Kursstufe eines Katalogs (seit 2.22, fehlt = beide)
  const FEW_POINTS = 3; // weniger mögliche Punkte → Hinweis „wenig Daten“

  // Bildungsstandards Mathematik ESA/MSA (KMK, 23.06.2022). Das Dokument nummeriert nicht;
  // die Kennungen folgen der Reihenfolge dort. Jede Vorlage muss mit vorlagen/kompetenzen/<key>.json übereinstimmen (Test).
  // stufe (seit 2.22): 'sek1' | 'mss' | fehlt = beide; damit wählt die App je Kursstufe den passenden Katalog.
  const TEMPLATES = [
    {
      key: 'mathe-sek1',
      label: 'Mathematik Sek I (Bildungsstandards 2022)',
      catalog: {
        id: 'mathe-sek1',
        name: 'Mathematik Sek I',
        fach: 'Mathematik',
        stufe: 'sek1',
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
    // Bildungsstandards Mathematik Allgemeine Hochschulreife (KMK, 18.10.2012), K1–K6 und L1–L5 wie im Beschluss (2.22).
    {
      key: 'mathe-mss',
      label: 'Mathematik MSS (Bildungsstandards Abitur 2012)',
      catalog: {
        id: 'mathe-mss',
        name: 'Mathematik MSS',
        fach: 'Mathematik',
        stufe: 'mss',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'K',
            name: 'Prozessbezogen',
            kompetenzen: [
              { id: 'MO-K1', name: 'Mathematisch argumentieren' },
              { id: 'MO-K2', name: 'Probleme mathematisch lösen' },
              { id: 'MO-K3', name: 'Mathematisch modellieren' },
              { id: 'MO-K4', name: 'Mathematische Darstellungen verwenden' },
              { id: 'MO-K5', name: 'Mit symbolischen, formalen und technischen Elementen umgehen' },
              { id: 'MO-K6', name: 'Mathematisch kommunizieren' },
            ],
          },
          {
            id: 'L',
            name: 'Inhaltlich (Leitideen)',
            kompetenzen: [
              { id: 'MO-L1', name: 'Algorithmus und Zahl' },
              { id: 'MO-L2', name: 'Messen' },
              { id: 'MO-L3', name: 'Raum und Form' },
              { id: 'MO-L4', name: 'Funktionaler Zusammenhang' },
              { id: 'MO-L5', name: 'Daten und Zufall' },
            ],
          },
        ],
      },
    },
    // Weiterentwickelte Bildungsstandards Chemie MSA (KMK, 13.06.2024): vier Kompetenzbereiche mit ihren
    // Teilkompetenzbereichen (S 1–S 3, E 1–E 3, K 1–K 3, B 1–B 3; S 0 ist übergeordnet) und drei Basiskonzepte (2.22).
    {
      key: 'chemie-sek1',
      label: 'Chemie Sek I (Bildungsstandards 2024)',
      catalog: {
        id: 'chemie-sek1',
        name: 'Chemie Sek I',
        fach: 'Chemie',
        stufe: 'sek1',
        version: 1,
        stufen: { teilweise: 50, sicher: 80 },
        bereiche: [
          {
            id: 'S',
            name: 'Sachkompetenz',
            kompetenzen: [
              { id: 'C-S1', name: 'Die makroskopische Ebene' },
              { id: 'C-S2', name: 'Die submikroskopische Ebene' },
              { id: 'C-S3', name: 'Die Ebene der Repräsentationen' },
            ],
          },
          {
            id: 'E',
            name: 'Erkenntnisgewinnungskompetenz',
            kompetenzen: [
              { id: 'C-E1', name: 'Erkenntnisse mithilfe von Experimenten gewinnen' },
              { id: 'C-E2', name: 'Modelle im Rahmen der Erkenntnisgewinnung nutzen' },
              { id: 'C-E3', name: 'Erkenntnisprozesse reflektieren' },
            ],
          },
          {
            id: 'K',
            name: 'Kommunikationskompetenz',
            kompetenzen: [
              { id: 'C-K1', name: 'Informationen erschließen' },
              { id: 'C-K2', name: 'Informationen aufbereiten' },
              { id: 'C-K3', name: 'Informationen austauschen und diskutieren' },
            ],
          },
          {
            id: 'B',
            name: 'Bewertungskompetenz',
            kompetenzen: [
              { id: 'C-B1', name: 'Sachverhalte und Informationen kriteriengeleitet bewerten' },
              { id: 'C-B2', name: 'Meinungen bilden und Entscheidungen treffen' },
              { id: 'C-B3', name: 'Entscheidungen und deren Folgen reflektieren' },
            ],
          },
          {
            id: 'BK',
            name: 'Basiskonzepte',
            kompetenzen: [
              { id: 'C-BK1', name: 'Aufbau und Eigenschaften der Stoffe und ihrer Teilchen' },
              { id: 'C-BK2', name: 'Chemische Reaktion' },
              { id: 'C-BK3', name: 'Energie' },
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

  /** Erklärtexte bereinigen: nur bekannte Felder, getrimmt, gekürzt, ohne leere. null = keine Texte. */
  function cleanTexte(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const out = {};
    for (const k of TEXT_KEYS) {
      const v = typeof o[k] === 'string' ? o[k].replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX) : '';
      if (v) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
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
        const tx = cleanTexte(k.texte);
        if (tx) e.texte = tx;
        kompetenzen.push(e);
      }
      bereiche.push({ id: bid, name: str(b.name) || bid, kompetenzen });
    }
    const v = Math.floor(Number(cat.version));
    const out = { id, name: str(cat.name) || str(cat.fach) || id, fach: str(cat.fach) };
    if (STUFE_IDS.includes(cat.stufe)) out.stufe = cat.stufe; // seit 2.22
    return Object.assign(out, { version: v >= 1 ? v : 1, stufen: cleanStufen(cat.stufen), bereiche });
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

  /** Erklärtexte einer Kompetenz ({} ohne Texte oder für Teilkompetenzen). */
  function texteOf(cat, id) {
    const loc = locate(cat, id);
    return (loc && !loc.parent && loc.obj.texte) || {};
  }

  /** Einen Erklärtext setzen (leer = entfernen). Gibt den gespeicherten Text zurück. */
  function setText(cat, id, key, value) {
    const loc = locate(cat, id);
    if (!loc || loc.parent || !TEXT_KEYS.includes(key)) return '';
    const tx = cleanTexte(Object.assign({}, loc.obj.texte, { [key]: String(value || '') }));
    if (tx) loc.obj.texte = tx;
    else delete loc.obj.texte;
    return (tx && tx[key]) || '';
  }

  /** Wie viele der vier Erklärtexte gesetzt sind. */
  const textCount = (cat, id) => Object.keys(texteOf(cat, id)).length;

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

  /**
   * Bester Treffer zum Fach und zur Stufe: zuerst genau die Stufe, dann ohne Stufe (gilt für beide);
   * Einträge einer anderen Stufe nie. Nur eindeutig, sonst null. get(x) liefert den Katalog eines Eintrags.
   */
  function pickFor(list, get, fach, level) {
    const hits = list.filter((x) => fachMatches(fach, get(x).fach) || fachMatches(fach, get(x).name));
    const tiers = level ? [hits.filter((x) => get(x).stufe === level), hits.filter((x) => !get(x).stufe)] : [hits.filter((x) => !get(x).stufe), hits];
    for (const t of tiers) if (t.length) return t.length === 1 ? t[0] : null;
    return null;
  }

  /** Katalog-id zum Fach (und zur Kursstufe 'sek1' | 'mss', seit 2.22) oder null (nur bei genau einem passenden Katalog). */
  function guessForFach(db, fach, level) {
    const hit = pickFor(catalogs(db), (c) => c, fach, level);
    return hit ? hit.id : null;
  }

  /**
   * Katalogangebot für einen Kurs ohne Katalog (2.21, PLANUNG.md AQ-1): ein vorhandener Katalog zum Fach und zur Stufe,
   * sonst eine passende Vorlage; ein vorhandener Katalog ohne Stufe erst, wenn es keine Vorlage genau für die Stufe gibt.
   * null, wenn der Kurs schon einen Katalog hat, „Nicht jetzt“ gewählt wurde (course.catalogHintOff) oder nichts eindeutig passt.
   * @returns { catalogId, name } | { templateKey, name } | null
   */
  function offerFor(db, course) {
    if (!course || course.catalogId || course.catalogHintOff === true || !str(course.fach)) return null;
    const level = courseLevel(course);
    const cats = catalogs(db);
    const tpls = TEMPLATES.map((t) => Object.assign({ key: t.key }, t.catalog));
    const steps = [
      [cats, (c) => c.stufe === level],
      [tpls, (c) => c.stufe === level],
      [cats, (c) => !c.stufe],
      [tpls, (c) => !c.stufe],
    ];
    for (const [list, ok] of steps) {
      const hit = pickFor(list.filter(ok), (c) => c, course.fach, level);
      if (hit) return list === cats ? { catalogId: hit.id, name: hit.name } : { templateKey: hit.key, name: hit.name };
    }
    return null;
  }

  /** Stufe eines Kurses ('sek1' | 'mss'); ohne NM.grades (Testseite) 'sek1'. */
  const courseLevel = (course) => (NM.grades && NM.grades.courseLevel ? NM.grades.courseLevel(course) : Number(course.jahrgang) >= 11 ? 'mss' : 'sek1');

  /**
   * Kataloge ohne Stufe, die aus einer Vorlage stammen (Kennung = Vorlage oder „Vorlage-2“ …), bekommen deren Stufe.
   * Sonst böte die App für einen Sek-I-Kurs die Vorlage noch einmal an, obwohl die Kopie schon da ist (2.22, migrate).
   */
  function fillTemplateStufe(db) {
    for (const c of catalogs(db)) {
      if (c.stufe) continue;
      const t = TEMPLATES.find((x) => c.id === x.key || (c.id.startsWith(x.key + '-') && /^\d+$/.test(c.id.slice(x.key.length + 1))));
      if (t && t.catalog.stufe) c.stufe = t.catalog.stufe;
    }
  }

  /** Angebot annehmen: Katalog am Kurs setzen, aus der Vorlage bei Bedarf erst anlegen. Gibt den Katalog zurück. */
  function takeOffer(db, course, offer) {
    const cat = offer.catalogId ? byId(db, offer.catalogId) : addFromTemplate(db, offer.templateKey);
    course.catalogId = cat.id;
    delete course.catalogHintOff;
    return cat;
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

  // ---------- Auswertung je Person (seit 2.11, PLANUNG AI 8–10) ----------
  // Nichts wird gespeichert: alles aus den Tests des Kurses berechnet.

  // Status, bei denen eine Person in einem Test (oder Teil) bei den Kompetenzen nicht zählt
  const SKIP_STATUS = new Set(['fehlt', 'nachschreiben', 'taeuschung']);

  /** Stufe zu einem Prozentwert: 'sicher' | 'teilweise' | 'noch' (Grenzen aus dem Katalog). */
  function stufeOf(cat, pct) {
    const s = Object.assign({}, STUFEN, (cat && cat.stufen) || {});
    if (pct >= s.sicher) return 'sicher';
    if (pct >= s.teilweise) return 'teilweise';
    return 'noch';
  }

  /** Ist der Test ein Kompetenztest? Nicht gewertet und mindestens eine Aufgabe mit Kompetenz. */
  function isCompetencyTest(a) {
    return !!a && a.kind === 'test' && !!a.ungraded && !!a.test && (a.test.tasks || []).some((t) => (t.competencies || []).length > 0);
  }

  /** Trägt der Test mindestens eine Kompetenz? */
  const testHasCompetencies = (a) => !!a && a.kind === 'test' && !!a.test && (a.test.tasks || []).some((t) => (t.competencies || []).length > 0);

  /** Kennungen einer Aufgabe auf Kompetenzebene (Teil → Kompetenz darüber), nur bekannte, jede einmal. */
  function taskKomps(task, toKomp) {
    const out = new Set();
    for (const id of task.competencies || []) if (toKomp.has(id)) out.add(toKomp.get(id));
    return out;
  }

  /**
   * Kompetenzstand aller Personen eines Kurses in einem Zeitraum.
   * @param halves Liste der Halbjahre (z. B. ['HJ1'] oder ['HJ1','HJ2'] für das Schuljahr)
   * @param sids  Personen-ids
   * @returns {
   *   cols: Einträge (Ebene Kompetenz) mit Aufgaben im Zeitraum, in Katalogreihenfolge,
   *   missing: sichtbare Kompetenzen ohne Aufgabe im Zeitraum,
   *   tests: Anzahl Tests mit Kompetenzen,
   *   cell(sid, id) → { got, max, pct, stufe, few, tests } | null }
   * Regeln: Punkte je Kompetenz summiert (erreicht ÷ möglich), eine Aufgabe zählt bei jeder ihrer
   * Kompetenzen voll, Bonusaufgaben zählen mit. Ein Nachschreibtermin zählt mit seinen eigenen Punkten
   * (G.countingFor). „fehlt“, „nachschreiben“ und „Täuschung“ zählen nicht (bei getrennt bewerteten Teilen
   * je Teil); „nicht gewertet“ zählt. Hat die Person im Test (Teil) gar keine Punkte, zählt er nicht;
   * sonst zählt eine leere Aufgabe mit 0 Punkten.
   */
  function evaluate(cat, course, halves, sids) {
    const { all, toKomp, tests } = prepare(cat, course, halves);
    const G = NM.grades;
    // Spalten: Kompetenzen, die im Zeitraum an einer Aufgabe hängen (Original oder Nachschreibtermin)
    const withTasks = new Set();
    for (const a of tests) {
      for (const x of [a, ...G.makeupsOf(course, a)]) for (const t of x.test.tasks || []) for (const id of taskKomps(t, toKomp)) withTasks.add(id);
    }
    const komps = all.filter((e) => e.level === 'komp');
    const cols = komps.filter((e) => withTasks.has(e.id));
    const missing = komps.filter((e) => !e.hidden && !withTasks.has(e.id));
    const data = new Map();
    for (const sid of sids) {
      const per = new Map();
      for (const it of items(course, tests, toKomp, sid)) {
        const c = per.get(it.komp) || { got: 0, max: 0, tests: new Set() };
        c.got += it.got;
        c.max += it.max;
        c.tests.add(it.testId);
        per.set(it.komp, c);
      }
      data.set(sid, per);
    }
    const cell = (sid, id) => sumCell(cat, (data.get(sid) || new Map()).get(id));
    /** Kurszeile: wie viele Personen mit Punkten in der Kompetenz sicher / teilweise / noch nicht sind. */
    function dist(id) {
      const out = { sicher: 0, teilweise: 0, noch: 0, n: 0 };
      for (const sid of sids) {
        const c = cell(sid, id);
        if (!c) continue;
        out[c.stufe]++;
        out.n++;
      }
      return out;
    }
    return { cols, missing, tests: tests.length, cell, dist };
  }

  /** Katalog flach, Teil → Kompetenz und die Tests (ohne Nachschreibtermine) mit Kompetenzen im Zeitraum. */
  function prepare(cat, course, halves) {
    const G = NM.grades;
    const all = entries(cat);
    const toKomp = new Map(all.map((e) => [e.id, e.level === 'teil' ? e.parent : e.id]));
    const tests = ((course && course.assessments) || []).filter((a) => a.kind === 'test' && a.test && halves.includes(a.half) && !G.isMakeup(course, a) && testHasCompetencies(a));
    return { all, toKomp, tests };
  }

  const entered = (v) => v !== null && v !== undefined && v !== '';

  /**
   * Punkte einer Person je Test und Kompetenz: [{ testId, src (gezählter Termin), komp, got, max }],
   * ein Eintrag je Test und Kompetenz. Regeln siehe evaluate.
   * @param own true: genau diese Tests (ohne Nachschreibtermin an ihrer Stelle), z. B. für die Moodle-Rückmeldung
   */
  function items(course, tests, toKomp, sid, own = false) {
    const G = NM.grades;
    const out = [];
    for (const a of tests) {
      const src = own ? a : G.countingFor(course, a, sid);
      const test = src.test;
      const r = (test.results || {})[sid];
      if (!r || SKIP_STATUS.has(r.status)) continue;
      const scores = r.scores || {};
      const sep = G.separateParts(test);
      const per = new Map();
      // Gruppen: getrennt bewertete Teile einzeln, sonst der ganze Test
      const groups = sep ? G.taskGroups(test) : [{ part: null, tasks: test.tasks || [] }];
      for (const { part, tasks } of groups) {
        if (part && SKIP_STATUS.has((r.partStatus || {})[part.id])) continue;
        if (!tasks.some((t) => entered(scores[t.id]))) continue;
        for (const t of tasks) {
          const ids = taskKomps(t, toKomp);
          if (!ids.size) continue;
          const got = entered(scores[t.id]) ? Number(scores[t.id]) || 0 : 0;
          const max = Number(t.max) || 0;
          for (const id of ids) {
            const c = per.get(id) || { testId: a.id, src, komp: id, got: 0, max: 0 };
            c.got += got;
            c.max += max;
            per.set(id, c);
          }
        }
      }
      out.push(...per.values());
    }
    return out;
  }

  /** Summe { got, max, tests? } → Zelle { got, max, pct, stufe, few, tests } oder null ohne mögliche Punkte. */
  function sumCell(cat, c) {
    if (!c || c.max <= 0) return null;
    const pct = Math.round((c.got / c.max) * 100);
    const tests = c.tests instanceof Set ? c.tests.size : c.tests || 0;
    return { got: Math.round(c.got * 100) / 100, max: Math.round(c.max * 100) / 100, pct, stufe: stufeOf(cat, pct), few: c.max < FEW_POINTS, tests };
  }

  const byDate = (x, y) => String(x.date || '9999').localeCompare(String(y.date || '9999')) || String(x.name).localeCompare(String(y.name), 'de');

  /** Ein Punkt der Verlaufslinie (ein Test, eine Kompetenz). */
  function point(cat, course, it) {
    const pct = it.max > 0 ? Math.round((it.got / it.max) * 100) : 0;
    const makeup = NM.grades.isMakeup(course, it.src);
    return { testId: it.testId, name: it.src.name || '', date: it.src.date || '', makeup, got: Math.round(it.got * 100) / 100, max: Math.round(it.max * 100) / 100, pct, stufe: stufeOf(cat, pct) };
  }

  /**
   * Verlauf einer Person im Kurs (seit 2.12, PLANUNG AI 11): je Kompetenz mit Punkten im Zeitraum
   * die Tests nach Datum (Prozent in diesem Test) und der Stand wie in evaluate.
   * @returns [{ entry, points: [{ testId, name, date, makeup, got, max, pct, stufe }], total }] in Katalogreihenfolge
   */
  function history(cat, course, halves, sid) {
    const { all, toKomp, tests } = prepare(cat, course, halves);
    const list = items(course, tests, toKomp, sid).filter((it) => it.max > 0);
    return all
      .filter((e) => e.level === 'komp')
      .map((entry) => {
        const mine = list.filter((it) => it.komp === entry.id);
        if (!mine.length) return null;
        const points = mine.map((it) => point(cat, course, it)).sort(byDate);
        const total = sumCell(cat, mine.reduce((s, it) => ({ got: s.got + it.got, max: s.max + it.max, tests: s.tests + 1 }), { got: 0, max: 0, tests: 0 }));
        return { entry, points, total };
      })
      .filter(Boolean);
  }

  /**
   * Verlauf einer Person über alle Kurse und Schuljahre (Personenregister), getrennt je Katalog.
   * @param list Kurseinträge der Person [{ course, student }] (NM.people.entries)
   * @returns [{ cat, years: [{ id, name }] (alt → neu, nur mit Punkten),
   *            rows: [{ entry, points: [… , course, yearId], perYear: { yearId: Zelle } }] }]
   * Kurse ohne Katalog fallen weg. Mehrere Kurse eines Schuljahrs im selben Katalog zählen zusammen.
   */
  function personHistory(db, list) {
    const G = NM.grades;
    const order = (db.years || []).map((y) => y.id);
    const out = new Map();
    for (const { course, student } of list || []) {
      const cat = forCourse(db, course);
      if (!cat) continue;
      const { all, toKomp, tests } = prepare(cat, course, G.halvesFor(course));
      const its = items(course, tests, toKomp, student.id).filter((it) => it.max > 0);
      if (!its.length) continue;
      const g = out.get(cat.id) || { cat, all, years: new Set(), per: new Map() };
      g.years.add(course.yearId);
      for (const it of its) {
        const p = Object.assign(point(cat, course, it), { course, yearId: course.yearId });
        const r = g.per.get(it.komp) || { points: [], sums: new Map() };
        r.points.push(p);
        const s = r.sums.get(course.yearId) || { got: 0, max: 0, tests: 0 };
        s.got += it.got;
        s.max += it.max;
        s.tests++;
        r.sums.set(course.yearId, s);
        g.per.set(it.komp, r);
      }
      out.set(cat.id, g);
    }
    const yearSort = (a, b) => order.indexOf(a) - order.indexOf(b);
    return [...out.values()].map((g) => {
      const years = [...g.years].sort(yearSort).map((id) => ({ id, name: ((db.years || []).find((y) => y.id === id) || {}).name || '' }));
      const rows = g.all
        .filter((e) => e.level === 'komp' && g.per.has(e.id))
        .map((entry) => {
          const r = g.per.get(entry.id);
          const perYear = {};
          for (const [y, s] of r.sums) perYear[y] = sumCell(g.cat, s);
          // nach Schuljahr, darin nach Datum
          const points = r.points.sort((x, y) => yearSort(x.yearId, y.yearId) || byDate(x, y));
          return { entry, points, perYear };
        });
      return { cat: g.cat, years, rows };
    });
  }

  // ---------- Für Schüler und Förderplan (seit 2.13, PLANUNG AI 13–14) ----------

  /**
   * Kompetenzbogen einer Person im Kurs: Stand je Kompetenz im Zeitraum, getrennt in
   * „Das kannst du schon“ (sicher) und „Daran arbeitest du weiter“ (teilweise, noch nicht).
   * @returns { kann: [{ entry, bereich, stufe, texte, last }], weiter: [...] } in Katalogreihenfolge
   *   texte: Erklärtexte der Kompetenz (seit 2.24), last: { name, tasks: [Aufgabennamen] } aus dem letzten Test im Zeitraum
   */
  function sheet(cat, course, halves, sid) {
    const names = new Map(((cat && cat.bereiche) || []).map((b) => [b.id, b.name || '']));
    const out = { kann: [], weiter: [] };
    const last = lastTasks(cat, course, halves, sid);
    for (const r of history(cat, course, halves, sid)) {
      const x = { entry: r.entry, bereich: names.get(r.entry.bereich) || '', stufe: r.total.stufe, texte: texteOf(cat, r.entry.id), last: last.get(r.entry.id) || null };
      (x.stufe === 'sicher' ? out.kann : out.weiter).push(x);
    }
    return out;
  }

  /**
   * Letzter Test im Zeitraum je Kompetenz (seit 2.24, PLANUNG AR 7): Name des gezählten Termins und die
   * Aufgaben dieses Termins, die die Kompetenz (oder einen ihrer Teile) tragen.
   * @returns Map Kennung → { name, tasks: [Namen] }
   */
  function lastTasks(cat, course, halves, sid) {
    const { toKomp, tests } = prepare(cat, course, halves);
    const best = new Map();
    for (const it of items(course, tests, toKomp, sid)) {
      if (!(it.max > 0)) continue;
      const prev = best.get(it.komp);
      if (prev && byDate(prev.src, it.src) > 0) continue;
      best.set(it.komp, it);
    }
    const out = new Map();
    for (const [komp, it] of best) {
      const tasks = (it.src.test.tasks || []).filter((t) => taskKomps(t, toKomp).has(komp)).map((t) => t.name || '').filter(Boolean);
      out.set(komp, { name: it.src.name || '', tasks });
    }
    return out;
  }

  /**
   * Kompetenzen eines einzelnen Tests (oder Nachschreibtermins) für eine Person, nur mit den Punkten
   * dieses Tests. Regeln wie evaluate (Status, leere Aufgaben).
   * @returns [{ entry, got, max, pct, stufe }] in Katalogreihenfolge, leer ohne Katalog oder Punkte
   */
  function testCompetencies(cat, course, a, sid) {
    if (!cat || !testHasCompetencies(a)) return [];
    const all = entries(cat);
    const toKomp = new Map(all.map((e) => [e.id, e.level === 'teil' ? e.parent : e.id]));
    const per = new Map(items(course, [a], toKomp, sid, true).filter((it) => it.max > 0).map((it) => [it.komp, it]));
    return all
      .filter((e) => e.level === 'komp' && per.has(e.id))
      .map((entry) => {
        const it = per.get(entry.id);
        const c = sumCell(cat, it);
        return { entry, got: c.got, max: c.max, pct: c.pct, stufe: c.stufe };
      });
  }

  /**
   * Hinweis im Förderplan: Kompetenzen mit Stand „noch nicht“ im Schuljahr, über alle Kurse der Person.
   * @param list Kurseinträge der Person [{ course, student }]
   * @returns [{ entry, cat, fach }] je Katalog in Katalogreihenfolge
   */
  function openGaps(db, list, yearId) {
    const out = [];
    for (const g of personHistory(db, (list || []).filter((x) => x.course.yearId === yearId))) {
      for (const r of g.rows) {
        const c = r.perYear[yearId];
        if (c && c.stufe === 'noch') out.push({ entry: r.entry, cat: g.cat, fach: g.cat.fach || g.cat.name || '' });
      }
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
    TEXT_KEYS,
    TEXT_MAX,
    STUFE_IDS,
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
    texteOf,
    setText,
    textCount,
    short,
    coursesUsing,
    usedIds,
    useCount,
    inUse,
    fachMatches,
    guessForFach,
    offerFor,
    fillTemplateStufe,
    takeOffer,
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
    stufeOf,
    isCompetencyTest,
    testHasCompetencies,
    evaluate,
    sheet,
    lastTasks,
    testCompetencies,
    openGaps,
    history,
    personHistory,
    templateFile,
  };
})(window.NM = window.NM || {});
