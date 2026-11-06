/* OrdoNota – wiederverwendbare Bausteine für die Ansichten. */
(function (NM) {
  'use strict';
  const { h, toast, modal, gradeStyle, parseNum, fmtDate } = NM.util;
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
  function gradeInput({ p, level, grid, row, col, key, onSet, placeholder, title }) {
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
  function numberInput({ value, grid, row, col, key, onSet, max, cls }) {
    return h('input', {
      class: 'cell-input num-input' + (cls ? ' ' + cls : ''),
      value: value === null || value === undefined ? '' : NM.util.fmtScore(value),
      'data-grid': grid,
      'data-row': row,
      'data-col': col,
      'data-focus-key': key,
      'data-select-all': '',
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
   */
  function nameCells(s, nr, { photo = false } = {}) {
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
      h('td', { class: 'sticky-col name-cell name-first', title }, h('span', { class: 'name-clip' }, s.first || '', s.iStatus ? h('span', { class: 'i-mark', title: 'I-Status' }, 'I') : null)),
    ];
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
    const ind = (key) => (st.key === key ? (st.dir === 'asc' ? '▲' : '▼') : '');
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
      return h('button', { class: 'sort-btn' + (st.key === key ? ' active' : ''), title: title || 'Sortieren', onclick: () => set(key) }, content, h('span', { class: 'sort-ind' }, ind(key)));
    }

    /** Kleine Sortier-Schaltfläche für Köpfe, die schon eigene Schaltflächen haben. */
    function toggle(key) {
      return h('button', { class: 'sort-btn sort-toggle' + (st.key === key ? ' active' : ''), title: 'Nach dieser Spalte sortieren', 'aria-label': 'Sortieren', onclick: () => set(key) }, ind(key) || '⇅');
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

  function emptyState(title, text, button) {
    return h('div', { class: 'empty' }, h('h2', null, title), text ? h('p', null, text) : null, button || null);
  }

  const PRINT_GROUPS = [
    ['teacher', 'Für die Lehrkraft'],
    ['students', 'Zum Austeilen'],
  ];

  /**
   * Ein Knopf „🖨 Drucken …“ statt vieler Druckknöpfe: öffnet eine Auswahl aller Druckarten.
   * options: [{ id, icon, label, tip, group: 'teacher' | 'students', run }]; null-Einträge werden übersprungen.
   */
  function printButton(title, options) {
    return h('button', { class: 'btn', title: 'Druckart wählen', 'aria-haspopup': 'dialog', 'data-print-menu': '', onclick: () => printMenu(title, options) }, '🖨 Drucken …');
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
                  h('span', { class: 'print-option-icon', 'aria-hidden': 'true' }, o.icon),
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
    gradeBadge,
    valueText,
    gradeInput,
    nameCells,
    numberInput,
    statusSelect,
    STATUS,
    STATUS_SHORT,
    editAssessmentMeta,
    assessmentHeader,
    sorter,
    pickerList,
    emptyState,
    catLabel,
    fmtDate,
    printButton,
  };
})((globalThis.NM = globalThis.NM || {}));
