/* Notenmanager – wiederverwendbare Bausteine für die Ansichten. */
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
  ];
  const STATUS_SHORT = { fehlt: 'fehlt', nachschreiben: 'NS', taeuschung: 'T/V' };

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

  function assessmentHeader(a) {
    return h(
      'span',
      { class: 'col-head' },
      h('span', { class: 'col-name' }, a.name),
      h('span', { class: 'col-sub' }, [a.date ? NM.util.fmtDateShort(a.date) : null, Number(a.weight) !== 1 ? '×' + NM.util.fmtScore(a.weight) : null].filter(Boolean).join(' · '))
    );
  }

  /** Liste von Leistungen eines Typs als auswählbare Karten. */
  function pickerList({ items, currentId, onPick, onAdd, addLabel, sub }) {
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
      h('button', { class: 'picker-item picker-add', onclick: onAdd }, addLabel)
    );
  }

  function emptyState(title, text, button) {
    return h('div', { class: 'empty' }, h('h2', null, title), text ? h('p', null, text) : null, button || null);
  }

  function catLabel(cat) {
    return cat === 'ka' ? 'Klassen-/Kursarbeit' : 'Sonstige';
  }

  NM.ui = {
    halfSwitch,
    gradeBadge,
    valueText,
    gradeInput,
    numberInput,
    statusSelect,
    STATUS,
    STATUS_SHORT,
    editAssessmentMeta,
    assessmentHeader,
    pickerList,
    emptyState,
    catLabel,
    fmtDate,
  };
})((globalThis.NM = globalThis.NM || {}));
