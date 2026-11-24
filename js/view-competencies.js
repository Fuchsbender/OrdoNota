/* OrdoNota – Reiter „Kompetenzen“ (seit 2.11, PLANUNG.md AI 8–10): Person × Kompetenz aus allen Tests mit Kompetenzen.
 * Nur Anzeige; die Rechnung steht rein in NM.competencies.evaluate, gespeichert wird nichts. */
(function (NM) {
  'use strict';
  const { h, fmtScore } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;
  const C = NM.competencies;

  /** Gewählter Zeitraum: ein Halbjahr oder 'Jahr' (Schuljahr, nur bei zwei Halbjahren). */
  function currentPeriod(course) {
    const halves = G.halvesFor(course);
    if (halves.length === 2 && NM.app.state.ui.half[course.id] === 'Jahr') return 'Jahr';
    return NM.app.currentHalf(course);
  }

  const periodLabel = (p) => (p === 'Jahr' ? 'Schuljahr' : p);

  function periodSwitch(course, cur) {
    const halves = G.halvesFor(course);
    const opts = halves.map((x) => ({ id: x, label: x }));
    if (halves.length === 2) opts.push({ id: 'Jahr', label: 'Schuljahr', title: 'Beide Halbjahre zusammen' });
    return UI.segSwitch('Zeitraum', opts, cur, (id) => NM.app.setHalf(course, id), { 'data-comp-period': '' });
  }

  const testsWord = (n) => (n === 1 ? '1 Test' : n + ' Tests');

  function render(view, { course, db }) {
    const cat = C.forCourse(db, course);
    const period = currentPeriod(course);
    view.append(
      h(
        'div',
        { class: 'view-head' },
        h('h1', null, 'Kompetenzen'),
        periodSwitch(course, period),
        h('div', { class: 'spacer' }),
        cat ? h('span', { class: 'muted small' }, 'Katalog: ' + cat.name) : null
      )
    );
    if (!cat) {
      view.appendChild(UI.emptyState('Kein Kompetenzkatalog', 'Wählen Sie unter „Kurs & Schüler“ einen Kompetenzkatalog für den Kurs.', null, 'list-check'));
      return;
    }
    const halves = period === 'Jahr' ? G.halvesFor(course) : [period];
    const students = M.activeStudents(course);
    const ev = C.evaluate(cat, course, halves, students.map((s) => s.id));
    if (!ev.tests || !ev.cols.length) {
      view.appendChild(
        UI.emptyState(
          'Noch keine Kompetenzen im ' + periodLabel(period),
          'Kompetenzen kommen aus den Aufgaben der Tests: im Reiter „Tests“ in der Karte „Kompetenzen“ Haken setzen oder beim Moodle-Import die Begleitdatei mitgeben.',
          null,
          'list-check'
        )
      );
      return;
    }
    view.appendChild(gridCard(course, cat, ev, students, period));
  }

  function gridCard(course, cat, ev, students, period) {
    const cols = ev.cols;
    const bereiche = cat.bereiche.map((b) => ({ b, cols: cols.filter((e) => e.bereich === b.id) })).filter((x) => x.cols.length);
    const sort = UI.sorter('comp', Object.fromEntries(cols.map((e) => ['k:' + e.id, { get: (s) => (ev.cell(s.id, e.id) || {}).pct, first: 'asc' }])));
    const rows = sort.rows(students);
    const first = new Set(bereiche.map((x) => x.cols[0].id));
    const colClass = (e) => 'comp-col' + (first.has(e.id) ? ' comp-first' : '') + (e.hidden ? ' comp-hidden' : '');

    const head1 = h(
      'tr',
      { class: 'group-row' },
      sort.nameHeads({ rowspan: 2 }),
      bereiche.map((x) => h('th', { class: 'group comp-first', colspan: x.cols.length, scope: 'colgroup' }, x.b.name))
    );
    const head2 = h(
      'tr',
      null,
      cols.map((e) => h('th', { class: colClass(e), scope: 'col', title: `${e.id} ${e.name}${e.hidden ? ' (ausgeblendet)' : ''}`, 'data-comp-col': e.id }, sort.head('k:' + e.id, C.short(e.id), `${e.id} ${e.name} – sortieren`)))
    );

    const cell = (s, e) => {
      const c = ev.cell(s.id, e.id);
      if (!c) return h('td', { class: colClass(e) + ' comp-cell comp-empty', title: `${e.id}: keine Punkte im Zeitraum`, 'data-comp-cell': e.id }, h('span', { class: 'muted' }, '–'));
      const tip = `${e.id} ${e.name}: ${fmtScore(c.got)} von ${fmtScore(c.max)} Punkten aus ${testsWord(c.tests)} · ${UI.STUFE_LABEL[c.stufe]}` + (c.few ? ' · wenig Daten (unter 3 möglichen Punkten)' : '');
      return h(
        'td',
        { class: colClass(e) + ' comp-cell st-' + c.stufe + (c.few ? ' comp-few-data' : ''), title: tip, 'data-comp-cell': e.id, 'data-stufe': c.stufe },
        h('span', { class: 'comp-val' }, UI.stufeMark(c.stufe), h('span', { class: 'comp-pct' }, String(c.pct)), c.few ? h('span', { class: 'comp-few-dot', 'aria-hidden': 'true' }) : null),
        h('span', { class: 'sd-visually-hidden' }, ` %, ${UI.STUFE_LABEL[c.stufe]}${c.few ? ', wenig Daten' : ''}`)
      );
    };

    const body = rows.map((s, ri) => h('tr', { 'data-student': s.id }, UI.nameCells(s, ri + 1, { course }), cols.map((e) => cell(s, e))));
    const st = Object.assign({}, C.STUFEN, cat.stufen || {});
    const legendItem = (stufe, text) => h('span', { class: 'comp-legend-item st-' + stufe }, UI.stufeMark(stufe), ' ' + text);

    return h(
      'div',
      { class: 'card', 'data-comp-grid': '' },
      h('div', { class: 'card-head' }, h('h2', null, periodLabel(period)), h('span', { class: 'muted small' }, `Punkte aus ${testsWord(ev.tests)} mit Kompetenzen, Prozent = erreicht ÷ möglich`)),
      students.length === 0
        ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'comp-' + period }, h('table', { class: 'table grid-table comp-grid' }, h('thead', null, head1, head2), h('tbody', null, body))),
      h(
        'p',
        { class: 'comp-legend small' },
        legendItem('sicher', `sicher ab ${st.sicher} %`),
        legendItem('teilweise', `teilweise ab ${st.teilweise} %`),
        legendItem('noch', `noch nicht unter ${st.teilweise} %`),
        h('span', { class: 'comp-legend-item' }, h('span', { class: 'comp-few-dot', 'aria-hidden': 'true' }), ' wenig Daten (unter 3 möglichen Punkten)'),
        h('span', { class: 'comp-legend-item muted' }, '– keine Punkte im Zeitraum')
      ),
      ev.missing.length
        ? h('p', { class: 'muted small', 'data-comp-missing': '' }, 'Noch in keinem Test: ', ev.missing.map((e, i) => [i ? ', ' : '', h('abbr', { title: e.name }, e.id)]))
        : null,
      h('p', { class: 'muted small' }, 'Gezählt werden alle Tests mit Kompetenzen, auch nicht gewertete. Bei einem Nachschreibtermin zählen dessen Punkte; „fehlt“ und Täuschung zählen nicht. Stufengrenzen: Einstellungen → Kompetenzkataloge.')
    );
  }

  NM.views = NM.views || {};
  NM.views.competencies = { render, currentPeriod };
})(window.NM = window.NM || {});
