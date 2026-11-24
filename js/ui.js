/* OrdoNota – wiederverwendbare Bausteine für die Ansichten. */
(function (NM) {
  'use strict';
  const { h, icon, toast, modal, gradeStyle, parseNum, fmtDate } = NM.util;
  const G = NM.grades;

  /** Halbjahres-Umschalter. allowYear: zusätzlich "Jahr". */
  function halfSwitch(course, allowYear) {
    const halves = G.halvesFor(course).slice();
    if (allowYear && G.hasYearGrade(course)) halves.push('Jahr');
    const cur = NM.app.currentHalf(course, allowYear);
    return h(
      'div',
      { class: 'segmented', role: 'group', 'aria-label': 'Halbjahr' },
      halves.map((x) =>
        h(
          'button',
          {
            class: 'seg' + (x === cur ? ' active' : ''),
            'aria-pressed': x === cur ? 'true' : 'false',
            onclick: () => NM.app.setHalf(course, x),
          },
          x === 'Jahr' ? 'Jahresnote' : x
        )
      )
    );
  }

  /** Allgemeiner Umschalter (wie halfSwitch): options = [{ id, label, title? }], onPick(id). */
  function segSwitch(ariaLabel, options, cur, onPick, attrs = {}) {
    return h(
      'div',
      Object.assign({ class: 'segmented', role: 'group', 'aria-label': ariaLabel }, attrs),
      options.map((o) =>
        h('button', { class: 'seg' + (o.id === cur ? ' active' : ''), 'aria-pressed': o.id === cur ? 'true' : 'false', title: o.title || null, 'data-seg': o.id, onclick: () => onPick(o.id) }, o.label)
      )
    );
  }

  // Zeichen der Kompetenzstufen (seit 2.11): eigene SVGs im Strich der Tabler-Symbole, Farbe über currentColor
  const STUFE_PATHS = {
    sicher: '<path d="M5 12l5 5l10 -10"/>',
    teilweise: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    noch: '<path d="M17 7l-10 10"/><path d="M7 7l10 10"/>',
  };
  const STUFE_LABEL = { sicher: 'sicher', teilweise: 'teilweise', noch: 'noch nicht' };
  function stufeMark(stufe) {
    return h('span', { class: 'stufe-mark stufe-' + stufe, 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${STUFE_PATHS[stufe]}</svg>` });
  }

  // ---------- Verlaufslinie der Kompetenzen (seit 2.12) ----------
  // Gemeinsame Zeitachse: alle Zeilen einer Tabelle nutzen dieselben Plätze (ein Platz je Test), damit
  // derselbe Test in jeder Zeile an derselben Stelle steht. Die Daten stehen einmal im Kopf (compAxis).

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, ...kids) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) e.setAttribute(k, v);
    for (const k of kids) if (k) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    return e;
  }
  const slotKey = (p) => (p.course ? p.course.id + ':' : '') + p.testId;

  /** Plätze der Achse aus allen Punkten der Zeilen: [{ key, date, name, yearId }], nach Schuljahr, Datum, Name. */
  function compSlots(rows, yearOrder = null) {
    const seen = new Map();
    const order = [];
    for (const r of rows) for (const p of r.points) if (!seen.has(slotKey(p))) (seen.set(slotKey(p), p), order.push(p));
    // zuerst Schuljahr (yearOrder, alt → neu), dann Datum, dann Name
    const years = yearOrder || [...new Set(order.map((p) => p.yearId))];
    return order
      .slice()
      .sort((x, y) => years.indexOf(x.yearId) - years.indexOf(y.yearId) || String(x.date || '9999').localeCompare(String(y.date || '9999')) || String(x.name).localeCompare(String(y.name), 'de'))
      .map((p) => ({ key: slotKey(p), date: p.date, name: p.name, yearId: p.yearId || null }));
  }

  function lineGeom(n) {
    const pad = 14;
    const step = n > 1 ? Math.max(16, Math.min(60, 360 / (n - 1))) : 0;
    const W = Math.max(88, pad * 2 + step * (n - 1));
    return { W, x: (i) => (n > 1 ? pad + i * step : W / 2), step };
  }

  function yearBreaks(svg, slots, g, y1, y2) {
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].yearId && slots[i - 1].yearId && slots[i].yearId !== slots[i - 1].yearId) {
        const bx = (g.x(i - 1) + g.x(i)) / 2;
        svg.appendChild(svgEl('line', { class: 'comp-line-year', x1: bx, x2: bx, y1, y2 }));
      }
    }
  }

  /** Datumszeile über den Linien (gleiche Breite wie compLine); bei engen Plätzen nur jedes k-te Datum. */
  function compAxis(slots) {
    const g = lineGeom(slots.length);
    const H = 14;
    const svg = svgEl('svg', { class: 'comp-axis', viewBox: `0 0 ${g.W} ${H}`, width: g.W, height: H, 'aria-hidden': 'true' });
    const every = Math.max(1, Math.ceil(34 / Math.max(g.step, 1)));
    yearBreaks(svg, slots, g, 0, H);
    slots.forEach((sl, i) => {
      if (i % every) return;
      svg.appendChild(svgEl('text', { class: 'comp-axis-date', x: g.x(i), y: 10, 'text-anchor': 'middle' }, sl.date ? fmtDate(sl.date).slice(0, 6) : '–'));
    });
    return svg;
  }

  /**
   * Kleine Verlaufslinie: ein Punkt je Test auf seinem Platz der Achse, Höhe = Prozent in diesem Test,
   * gestrichelt die Stufengrenzen, jeder Punkt mit Stufenzeichen (Farbe nie allein) und Tooltip.
   * points: [{ testId, name, date, got, max, pct, stufe, makeup?, course?, yearId? }]
   */
  function compLine(cat, points, { slots = null, courseLabel = null } = {}) {
    slots = slots || compSlots([{ points }]);
    const pos = new Map(slots.map((s, i) => [s.key, i]));
    const st = Object.assign({}, NM.competencies.STUFEN, (cat && cat.stufen) || {});
    const g = lineGeom(slots.length);
    const top = 15;
    const H = 50;
    const plot = H - top - 7;
    const y = (pct) => top + ((100 - Math.max(0, Math.min(100, pct))) / 100) * plot;
    const tip = (p) =>
      [p.name || 'Test', p.date ? fmtDate(p.date) : null, courseLabel && p.course ? courseLabel(p.course) : null, p.makeup ? 'Nachschreibtermin' : null].filter(Boolean).join(' · ') +
      `\n${NM.util.fmtScore(p.got)} von ${NM.util.fmtScore(p.max)} Punkten · ${p.pct} % · ${STUFE_LABEL[p.stufe]}`;
    const label = 'Verlauf: ' + points.map((p) => `${p.date ? fmtDate(p.date) + ' ' : ''}${p.pct} % (${STUFE_LABEL[p.stufe]})`).join(', ');
    const svg = svgEl('svg', { class: 'comp-line', viewBox: `0 0 ${g.W} ${H}`, width: g.W, height: H, role: 'img', 'aria-label': label });
    for (const v of [st.teilweise, st.sicher]) svg.appendChild(svgEl('line', { class: 'comp-line-grid', x1: 2, x2: g.W - 2, y1: y(v), y2: y(v) }));
    yearBreaks(svg, slots, g, 2, H - 2);
    const xy = points.map((p) => [g.x(pos.get(slotKey(p)) ?? 0), y(p.pct)]);
    if (points.length > 1) svg.appendChild(svgEl('polyline', { class: 'comp-line-path', points: xy.map((c) => c.join(',')).join(' ') }));
    const showPct = g.step >= 24 || slots.length === 1;
    points.forEach((p, i) => {
      const [cx, cy] = xy[i];
      const grp = svgEl('g', { class: 'comp-line-pt st-' + p.stufe, 'data-comp-pt': p.stufe }, svgEl('title', null, tip(p)));
      grp.appendChild(svgEl('circle', { class: 'comp-line-dot', cx, cy, r: 6.5 }));
      const mark = svgEl('g', { transform: `translate(${cx - 5} ${cy - 5}) scale(${10 / 24})`, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      mark.innerHTML = STUFE_PATHS[p.stufe];
      grp.appendChild(mark);
      if (showPct) grp.appendChild(svgEl('text', { class: 'comp-line-pct', x: cx, y: Math.max(9, cy - 9), 'text-anchor': 'middle' }, String(p.pct)));
      svg.appendChild(grp);
    });
    return svg;
  }

  /** Anzeige-Badge einer Note. */
  function gradeBadge(p, level, extra) {
    if (p === null || p === undefined) return h('span', { class: 'grade-badge empty' }, '–');
    return h('span', { class: 'grade-badge' + (extra ? ' ' + extra : ''), style: gradeStyle(p) }, G.label(p, level));
  }

  /** Dezimalwert eines Rechenwerts anzeigen (Sek I: Dezimalnote, MSS: Punkte). */
  function valueText(v, level) {
    if (v === null || v === undefined) return '–';
    return NM.util.fmtNum(v, 2);
  }

  /**
   * Eingabezelle für eine Note.
   * onSet(p|null) wird bei gültiger Eingabe aufgerufen.
   */
  function gradeInput({ p, level, grid, row, col, key, onSet, placeholder, title, label }) {
    const el = h('input', {
      class: 'cell-input grade-input',
      value: p === null || p === undefined ? '' : G.label(p, level),
      style: gradeStyle(p),
      'data-grid': grid,
      'data-row': row,
      'data-col': col,
      'data-focus-key': key,
      'data-select-all': '',
      placeholder: placeholder || '',
      'aria-label': label || null,
      title: title || (level === 'mss' ? 'Punkte 00–15' : 'Note 1 bis 6 mit + oder -, z. B. 2-'),
      inputmode: level === 'mss' ? 'numeric' : 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      onfocus: (e) => e.target.select(),
      onchange: (e) => {
        const v = G.parse(e.target.value, level);
        if (v === undefined) {
          e.target.classList.add('invalid');
          toast(level === 'mss' ? 'Ungültig – bitte Punkte von 0 bis 15 eingeben.' : 'Ungültig – bitte z. B. 1, 1-, 2+, 2, … 5-, 6 eingeben (kein 1+ in der Sek I).', 'error');
          return;
        }
        if (v === p) return;
        onSet(v);
      },
    });
    return el;
  }

  /** Zahleneingabe (Punkte in Tests). */
  function numberInput({ value, grid, row, col, key, onSet, max, cls, label }) {
    return h('input', {
      class: 'cell-input num-input' + (cls ? ' ' + cls : ''),
      value: value === null || value === undefined ? '' : NM.util.fmtScore(value),
      'data-grid': grid,
      'data-row': row,
      'data-col': col,
      'data-focus-key': key,
      'data-select-all': '',
      'aria-label': label || null,
      inputmode: 'decimal',
      autocomplete: 'off',
      onfocus: (e) => e.target.select(),
      onchange: (e) => {
        const v = parseNum(e.target.value);
        if (v === undefined || (v !== null && v < 0)) {
          e.target.classList.add('invalid');
          toast('Bitte eine Zahl eingeben.', 'error');
          return;
        }
        if (v !== null && max !== undefined && v > max) toast(`Hinweis: mehr als die Höchstpunktzahl (${NM.util.fmtScore(max)}).`, 'warn');
        onSet(v);
      },
    });
  }

  const STATUS = [
    { v: '', label: '' },
    { v: 'fehlt', label: 'fehlt (entschuldigt)' },
    { v: 'nachschreiben', label: 'Nachschreiben' },
    { v: 'taeuschung', label: 'Täuschung/Verweigerung' },
    { v: 'ungewertet', label: 'nicht gewertet' },
  ];
  const STATUS_SHORT = { fehlt: 'fehlt', nachschreiben: 'NS', taeuschung: 'T/V', ungewertet: 'n. gew.' };

  function statusSelect(value, onSet, key) {
    return h(
      'select',
      { class: 'cell-select', 'data-focus-key': key, title: 'Status', onchange: (e) => onSet(e.target.value) },
      STATUS.map((s) => h('option', { value: s.v, selected: (value || '') === s.v }, s.label || '—'))
    );
  }

  /** Dialog zum Bearbeiten der Eckdaten einer Leistung (Name, Datum, Bereich, Gewicht, Halbjahr). */
  async function editAssessmentMeta(course, a, { allowDelete = true } = {}) {
    const name = h('input', { class: 'input', value: a.name || '' });
    const date = h('input', { class: 'input', type: 'date', value: a.date || '' });
    const weight = h('input', { class: 'input', type: 'number', step: '0.5', min: '0', value: a.weight });
    const cat = h(
      'select',
      { class: 'input' },
      h('option', { value: 'ka', selected: a.cat === 'ka' }, 'Klassenarbeit / Kursarbeit'),
      h('option', { value: 'other', selected: a.cat === 'other' }, 'Sonstige Leistungen')
    );
    const half = h(
      'select',
      { class: 'input' },
      G.halvesFor(course).map((x) => h('option', { value: x, selected: a.half === x }, x))
    );
    const buttons = [{ label: 'Abbrechen', value: null }];
    if (allowDelete) buttons.push({ label: 'Löschen', value: 'delete', kind: 'danger' });
    buttons.push({ label: 'Übernehmen', value: 'ok', kind: 'primary' });
    const v = await modal({
      title: NM.model.kindLabel(a) + ' bearbeiten',
      body: h(
        'div',
        { class: 'form-grid' },
        h('label', { class: 'field span2' }, h('span', null, 'Bezeichnung'), name),
        h('label', { class: 'field' }, h('span', null, 'Datum'), date),
        h('label', { class: 'field' }, h('span', null, 'Gewicht'), weight),
        h('label', { class: 'field' }, h('span', null, 'Bereich'), cat),
        h('label', { class: 'field' }, h('span', null, 'Halbjahr'), half)
      ),
      buttons,
    });
    if (v === 'delete') {
      const ok = await NM.util.confirmDialog('Leistung löschen?', `„${a.name}“ und alle zugehörigen Noten werden gelöscht.`, { okLabel: 'Löschen', danger: true });
      if (!ok) return false;
      course.assessments = course.assessments.filter((x) => x.id !== a.id);
      NM.app.commit();
      return 'deleted';
    }
    if (v !== 'ok') return false;
    const w = parseNum(weight.value);
    a.name = name.value.trim() || a.name;
    a.date = date.value;
    a.weight = w === undefined || w === null ? 1 : Math.max(0, w);
    a.cat = cat.value;
    a.half = half.value;
    NM.app.commit();
    return true;
  }

  /** Spaltenkopf einer Leistung; sub ersetzt die Unterzeile (z. B. Zeitraum eines Ziehen-Pools). */
  function assessmentHeader(a, sub = null) {
    return h(
      'span',
      { class: 'col-head' },
      h('span', { class: 'col-name' }, a.name),
      h('span', { class: 'col-sub' }, sub || [a.date ? NM.util.fmtDateShort(a.date) : null, Number(a.weight) !== 1 ? '×' + NM.util.fmtScore(a.weight) : null, a.ungraded ? 'nicht gewertet' : null].filter(Boolean).join(' · '))
    );
  }

  /**
   * Zwei feste Namensspalten (Nachname, Vorname mit Markierung „I“); nr = laufende Nummer vor dem Nachnamen.
   * photo: Foto (oder Personensymbol als Platzhalter) vor dem Nachnamen – die Tabelle braucht dann die Klasse „with-photos“.
   * course: nur dann erscheinen Kürzel für Nachteilsausgleiche (Gesundheitsdaten) – also nie in Ansichten,
   * die gezeigt werden (Ziehen, Vollbild) und nie im Ausdruck.
   */
  function nameCells(s, nr, { photo = false, course = null } = {}) {
    const title = NM.model.studentName(s);
    const pic = !photo
      ? null
      : s.photo
        ? h('img', { class: 'name-photo', src: s.photo, alt: '' })
        : h('img', { class: 'name-photo name-photo-empty', src: NM.model.PERSON_ICON, alt: '', title: 'Kein Foto – Fotos fügen Sie im Reiter „Sitzplan“ hinzu' });
    return [
      h(
        'td',
        { class: 'sticky-col name-cell name-last', title },
        h('span', { class: 'name-clip' }, pic, h('span', { class: 'name-text' }, nr ? h('span', { class: 'row-nr' }, nr) : null, s.last || ''))
      ),
      h('td', { class: 'sticky-col name-cell name-first', title }, h('span', { class: 'name-clip' }, h('span', { class: 'name-text' }, s.first || ''), s.iStatus ? h('span', { class: 'i-mark', title: 'I-Status' }, 'I') : null, course ? ausgleichMarks(s, course) : null)),
    ];
  }

  /** Kürzel der gültigen Nachteilsausgleiche (LRS, DK …) eines Kurseintrags, Maßnahme im Hinweis. */
  function ausgleichMarks(s, course) {
    const P = NM.people;
    return P.ausgleicheFuer(NM.app.db(), s, course).map((a) =>
      h('span', { class: 'na-mark', title: 'Nachteilsausgleich: ' + P.ausgleichName(a) + (a.massnahmen ? ' – ' + a.massnahmen : '') }, P.ausgleichKurz(a))
    );
  }

  // ---------- Sortierbare Tabellen ----------
  // Zustand je Tabellenart in ui.sort[table] = { key, dir } (nur auf diesem Gerät gespeichert).
  // Spalten: { key: { get(s) → Zahl | Text | null, first: 'asc' | 'desc' } }; first = Richtung beim ersten Klick.
  // Leere Werte stehen immer unten, bei Gleichstand bleibt die alphabetische Reihenfolge.

  const NAME_COLS = {
    last: { get: (s) => s.last || '', first: 'asc' },
    first: { get: (s) => s.first || '', first: 'asc' },
  };
  const SORT_DEFAULT = { key: 'last', dir: 'asc' };

  function sorter(table, cols) {
    cols = Object.assign({}, NAME_COLS, cols);
    const ui = NM.app.state.ui;
    ui.sort = ui.sort || {};
    const saved = ui.sort[table];
    // Unbekannte Spalte (z. B. Aufgabe eines anderen Tests) → Standard
    const st = saved && cols[saved.key] ? saved : SORT_DEFAULT;
    const set = (key) => {
      ui.sort[table] = st.key === key ? { key, dir: st.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: cols[key].first };
      NM.app.saveUi();
      NM.app.rerender();
    };
    const ind = (key) => (st.key === key ? (st.dir === 'asc' ? icon('arrow-up') : icon('arrow-down')) : '');
    const empty = (v) => v === null || v === undefined || v === '';

    /** Schülerliste (bereits alphabetisch) nach der gewählten Spalte ordnen. */
    function rows(students) {
      if (st.key === SORT_DEFAULT.key && st.dir === SORT_DEFAULT.dir) return students;
      const vals = new Map(students.map((s) => [s.id, cols[st.key].get(s)]));
      const sign = st.dir === 'desc' ? -1 : 1;
      return students.slice().sort((a, b) => {
        const x = vals.get(a.id);
        const y = vals.get(b.id);
        if (empty(x) || empty(y)) return empty(x) - empty(y);
        return sign * (typeof x === 'string' ? x.localeCompare(y, 'de') : x - y);
      });
    }

    /** Ganzer Spaltenkopf als Sortier-Schaltfläche. */
    function head(key, content, title) {
      return h('button', { class: 'sort-btn' + (st.key === key ? ' active' : ''), title: title || 'Sortieren', 'data-sort-dir': st.key === key ? st.dir : null, onclick: () => set(key) }, content, h('span', { class: 'sort-ind' }, ind(key)));
    }

    /** Kleine Sortier-Schaltfläche für Köpfe, die schon eigene Schaltflächen haben. */
    function toggle(key) {
      return h('button', { class: 'sort-btn sort-toggle' + (st.key === key ? ' active' : ''), title: 'Nach dieser Spalte sortieren', 'aria-label': 'Sortieren', 'data-sort-dir': st.key === key ? st.dir : null, onclick: () => set(key) }, ind(key) || icon('arrows-sort'));
    }

    /** Köpfe der beiden Namensspalten (passend zu nameCells); attrs z. B. { rowspan: 2 }. */
    function nameHeads(attrs) {
      return [
        h('th', Object.assign({ class: 'sticky-col name-last' }, attrs), head('last', 'Name', 'Nach Nachname sortieren')),
        h('th', Object.assign({ class: 'sticky-col name-first' }, attrs), head('first', 'Vorname', 'Nach Vorname sortieren')),
      ];
    }

    return { rows, head, toggle, nameHeads, key: st.key };
  }

  /** Liste von Leistungen eines Typs als auswählbare Karten. */
  function pickerList({ items, currentId, onPick, onAdd, addLabel, sub, extra }) {
    return h(
      'div',
      { class: 'picker' },
      items.map((a) =>
        h(
          'button',
          { class: 'picker-item' + (a.id === currentId ? ' active' : ''), onclick: () => onPick(a.id) },
          h('span', { class: 'picker-name' }, a.name),
          h('span', { class: 'picker-sub' }, sub(a))
        )
      ),
      h('button', { class: 'picker-item picker-add', onclick: onAdd }, addLabel),
      extra || null
    );
  }

  /** Leerer Zustand (Baustein sd-empty): Ring mit Symbol, Überschrift, Text, optional ein Knopf. */
  function emptyState(title, text, button, iconName) {
    return h(
      'div',
      { class: 'empty sd-empty' },
      h('span', { class: 'sd-ring' }, icon(iconName || 'inbox')),
      h('h2', null, title),
      text ? h('p', null, text) : null,
      button || null
    );
  }

  /**
   * Fläche zum Hochladen (Baustein sd-dropzone) um ein vorhandenes Dateifeld. Das Feld bleibt unverändert
   * (Auswahl und Ablegen gehen direkt an den Browser), die App liest die Datei weiter wie bisher.
   */
  function dropzone(input, title, hint) {
    const id = 'dz-' + Math.random().toString(36).slice(2, 8);
    input.setAttribute('aria-labelledby', id);
    const wrap = h(
      'div',
      { class: 'dropzone-wrap' },
      h(
        'div',
        { class: 'sd-dropzone', 'data-sd-dropzone': '' },
        h('span', { class: 'sd-ring' }, icon('upload')),
        h('span', { class: 'sd-dropzone-title', id }, title, ' oder ', h('u', null, 'auswählen')),
        hint ? h('span', { class: 'sd-dropzone-hint' }, hint) : null,
        h('span', { class: 'sd-dropzone-file', 'data-sd-dropzone-file': '', 'aria-live': 'polite' }),
        input
      )
    );
    if (window.SolagioDesign) window.SolagioDesign.einrichten(wrap);
    return wrap;
  }

  const PRINT_GROUPS = [
    ['teacher', 'Für die Lehrkraft'],
    ['students', 'Zum Austeilen'],
  ];

  /**
   * Ein Knopf „Drucken …“ statt vieler Druckknöpfe: öffnet eine Auswahl aller Druckarten.
   * options: [{ id, icon, label, tip, group: 'teacher' | 'students', run }]; null-Einträge werden übersprungen.
   */
  function printButton(title, options) {
    return h('button', { class: 'btn', title: 'Druckart wählen', 'aria-haspopup': 'dialog', 'data-print-menu': '', onclick: () => printMenu(title, options) }, icon('printer'), ' Drucken …');
  }

  async function printMenu(title, options) {
    const list = options.filter(Boolean);
    let close = null;
    const body = h(
      'div',
      { class: 'print-menu' },
      PRINT_GROUPS.map(([group, label]) => {
        const items = list.filter((o) => o.group === group);
        return items.length
          ? h(
              'section',
              null,
              h('h3', null, label),
              items.map((o) =>
                h(
                  'button',
                  { type: 'button', class: 'print-option', title: o.tip, 'data-print': o.id, onclick: () => close(o) },
                  h('span', { class: 'print-option-icon', 'aria-hidden': 'true' }, icon(o.icon)),
                  h('span', null, o.label)
                )
              )
            )
          : null;
      })
    );
    const choice = await modal({
      title,
      body,
      buttons: [{ label: 'Abbrechen', value: null }],
      onOpen: (dlg, done) => {
        close = done;
        const first = dlg.querySelector('.print-option');
        if (first) first.focus();
      },
    });
    if (choice) choice.run();
  }

  function catLabel(cat) {
    return cat === 'ka' ? 'Klassen-/Kursarbeit' : 'Sonstige';
  }

  /** Haken je abschaltbarem Reiter (Einstellungen und „Kurs & Schüler“). isOn(id) → bool, onSet(id, an). */
  function tabChecks(isOn, onSet, mark = () => null) {
    return h(
      'div',
      { class: 'tab-checks' },
      NM.app.orderedTabs().filter((t) => NM.app.OPTIONAL_TABS.includes(t.id)).map((t) =>
        h(
          'label',
          { class: 'check' },
          h('input', { type: 'checkbox', checked: isOn(t.id), 'data-tab-check': t.id, onchange: (e) => onSet(t.id, e.target.checked) }),
          ' ' + t.label,
          mark(t.id)
        )
      )
    );
  }

  NM.ui = {
    tabChecks,
    halfSwitch,
    segSwitch,
    stufeMark,
    STUFE_LABEL,
    compLine,
    compSlots,
    compAxis,
    gradeBadge,
    valueText,
    gradeInput,
    nameCells,
    ausgleichMarks,
    numberInput,
    statusSelect,
    STATUS,
    STATUS_SHORT,
    editAssessmentMeta,
    assessmentHeader,
    sorter,
    pickerList,
    emptyState,
    dropzone,
    catLabel,
    fmtDate,
    printButton,
  };
})((globalThis.NM = globalThis.NM || {}));
