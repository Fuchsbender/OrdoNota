/* OrdoNota – Reiter „Kompetenzen“ (seit 2.11, PLANUNG.md AI 8–11): Person × Kompetenz aus allen Tests mit Kompetenzen,
 * Kurszeile (Verteilung je Kompetenz) und Verlauf je Person im Dialog (seit 2.12).
 * Nur Anzeige; die Rechnung steht rein in NM.competencies.evaluate, gespeichert wird nichts. */
(function (NM) {
  'use strict';
  const { h, icon, fmtScore, fmtDate, modal } = NM.util;
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

    // Name öffnet den Verlauf (Dialog mit ‹ › in der Reihenfolge der Tabelle)
    const nameCells = (s, ri) => {
      const [last, first] = UI.nameCells(s, ri + 1, { course });
      const open = () => historyDialog(course, cat, period, rows, ri);
      const clip = last.firstChild;
      const btn = h('button', { type: 'button', class: 'comp-person', 'data-comp-person': s.id, title: 'Verlauf von ' + M.studentName(s) + ' zeigen' });
      while (clip.firstChild) btn.appendChild(clip.firstChild);
      clip.appendChild(btn);
      btn.onclick = open;
      first.classList.add('comp-person-cell');
      first.onclick = open;
      return [last, first];
    };
    const body = rows.map((s, ri) => h('tr', { 'data-student': s.id }, nameCells(s, ri), cols.map((e) => cell(s, e))));
    // Kurszeile: Verteilung je Kompetenz, nur Personen mit Punkten (ohne Namen)
    const distCell = (e) => {
      const d = ev.dist(e.id);
      if (!d.n) return h('td', { class: colClass(e) + ' comp-dist', 'data-comp-dist': e.id }, h('span', { class: 'muted' }, '–'));
      const pc = (k) => Math.round((d[k] / d.n) * 100);
      const text = `${d.sicher} sicher, ${d.teilweise} teilweise, ${d.noch} noch nicht (von ${d.n})`;
      const seg = (k) => (d[k] ? h('span', { class: 'comp-dist-seg st-' + k, style: `flex-grow: ${d[k]}` }) : null);
      return h(
        'td',
        { class: colClass(e) + ' comp-dist', title: `${e.id}: ${text} · ${pc('sicher')} % / ${pc('teilweise')} % / ${pc('noch')} %`, 'data-comp-dist': e.id },
        h('span', { class: 'comp-dist-bar', 'aria-hidden': 'true' }, seg('sicher'), seg('teilweise'), seg('noch')),
        h('span', { class: 'comp-dist-num', 'aria-hidden': 'true' }, h('span', { class: 'st-sicher' }, d.sicher), h('span', { class: 'st-teilweise' }, d.teilweise), h('span', { class: 'st-noch' }, d.noch)),
        h('span', { class: 'sd-visually-hidden' }, text)
      );
    };
    const foot = h('tr', { class: 'comp-dist-row', 'data-comp-dist-row': '' }, h('th', { class: 'sticky-col name-cell', colspan: 2, scope: 'row', title: 'Personen je Stufe: sicher, teilweise, noch nicht' }, 'Kurs'), cols.map(distCell));
    const st = Object.assign({}, C.STUFEN, cat.stufen || {});
    const legendItem = (stufe, text) => h('span', { class: 'comp-legend-item st-' + stufe }, UI.stufeMark(stufe), ' ' + text);

    return h(
      'div',
      { class: 'card', 'data-comp-grid': '' },
      h('div', { class: 'card-head' }, h('h2', null, periodLabel(period)), h('span', { class: 'muted small' }, `Punkte aus ${testsWord(ev.tests)} mit Kompetenzen, Prozent = erreicht ÷ möglich`)),
      students.length === 0
        ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'comp-' + period }, h('table', { class: 'table grid-table comp-grid' }, h('thead', null, head1, head2), h('tbody', null, body), h('tfoot', null, foot))),
      h(
        'p',
        { class: 'comp-legend small' },
        legendItem('sicher', `sicher ab ${st.sicher} %`),
        legendItem('teilweise', `teilweise ab ${st.teilweise} %`),
        legendItem('noch', `noch nicht unter ${st.teilweise} %`),
        h('span', { class: 'comp-legend-item' }, h('span', { class: 'comp-few-dot', 'aria-hidden': 'true' }), ' wenig Daten (unter 3 möglichen Punkten)'),
        h('span', { class: 'comp-legend-item muted' }, '– keine Punkte im Zeitraum'),
        h('span', { class: 'comp-legend-item muted' }, 'Name anklicken: Verlauf')
      ),
      ev.missing.length
        ? h('p', { class: 'muted small', 'data-comp-missing': '' }, 'Noch in keinem Test: ', ev.missing.map((e, i) => [i ? ', ' : '', h('abbr', { title: e.name }, e.id)]))
        : null,
      h('p', { class: 'muted small' }, 'Gezählt werden alle Tests mit Kompetenzen, auch nicht gewertete. Bei einem Nachschreibtermin zählen dessen Punkte; „fehlt“ und Täuschung zählen nicht. Die Zeile „Kurs“ zählt je Kompetenz, wie viele Personen sicher, teilweise oder noch nicht sind. Stufengrenzen: Einstellungen → Kompetenzkataloge.')
    );
  }

  // ---------- Verlauf je Person (seit 2.12) ----------

  /**
   * Tabelle „Kompetenz | Verlauf | Stand“ (auch im Personenregister, dort mit stand = Zellen je Schuljahr).
   * Alle Zeilen teilen eine Zeitachse; die Daten stehen einmal im Kopf.
   */
  function historyTable(cat, rows, standHeads, { courseLabel = null, stand = null, yearOrder = null } = {}) {
    const slots = UI.compSlots(rows, yearOrder);
    const body = rows.map((r) =>
      h(
        'tr',
        { 'data-hist-komp': r.entry.id },
        h('td', { class: 'comp-hist-name' }, h('span', { class: 'comp-hist-id' }, r.entry.id), ' ', r.entry.name),
        h('td', { class: 'comp-hist-line' }, UI.compLine(cat, r.points, { slots, courseLabel })),
        stand ? stand(r) : standCell(r.total, 'data-hist-total')
      )
    );
    return h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'table compact comp-hist' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Kompetenz'), h('th', { scope: 'col', class: 'comp-hist-axis' }, h('span', null, 'Prozent je Test'), UI.compAxis(slots)), standHeads)),
        h('tbody', null, body)
      )
    );
  }

  /** Zelle mit Stand: Zeichen, Prozent, Anzahl Tests (wie im Raster); ohne Punkte „–“. */
  function standCell(c, attr, { tests = true } = {}) {
    if (!c) return h('td', { class: 'comp-hist-stand', [attr]: '' }, h('span', { class: 'muted' }, '–'));
    return h(
      'td',
      { class: 'comp-hist-stand st-' + c.stufe + (c.few ? ' comp-few-data' : ''), [attr]: c.stufe, title: `${fmtScore(c.got)} von ${fmtScore(c.max)} Punkten · ${UI.STUFE_LABEL[c.stufe]}${c.few ? ' · wenig Daten' : ''}` },
      h('span', { class: 'comp-val' }, UI.stufeMark(c.stufe), h('span', { class: 'comp-pct' }, c.pct + ' %'), c.few ? h('span', { class: 'comp-few-dot', 'aria-hidden': 'true' }) : null),
      h('span', { class: 'sd-visually-hidden' }, ', ' + UI.STUFE_LABEL[c.stufe] + (c.few ? ', wenig Daten' : '')),
      tests && c.tests ? h('span', { class: 'muted small' }, ' · ' + testsWord(c.tests)) : null
    );
  }

  function historyBody(course, cat, period, s) {
    const halves = period === 'Jahr' ? G.halvesFor(course) : [period];
    const rows = C.history(cat, course, halves, s.id);
    if (!rows.length) return h('p', { class: 'muted', 'data-hist-empty': '' }, 'Noch keine Punkte im ' + periodLabel(period) + '.');
    return historyTable(cat, rows, h('th', { scope: 'col' }, 'Stand ' + periodLabel(period)));
  }

  /** Dialog „Verlauf: Name“ mit ‹ › (und Pfeiltasten) durch die Personen in der Reihenfolge der Tabelle. */
  function historyDialog(course, cat, period, students, start) {
    let i = start;
    const pos = h('span', { class: 'muted small comp-hist-pos', 'aria-live': 'polite' });
    const prev = h('button', { type: 'button', class: 'btn btn-sm', 'data-hist-prev': '', 'aria-label': 'Vorige Person' }, icon('chevron-left'));
    const next = h('button', { type: 'button', class: 'btn btn-sm', 'data-hist-next': '', 'aria-label': 'Nächste Person' }, icon('chevron-right'));
    const content = h('div', { class: 'comp-hist-content' });
    const body = h('div', { class: 'comp-hist-wrap', 'data-comp-hist': '' }, h('div', { class: 'comp-hist-nav' }, prev, pos, next), content);
    let titleEl = null;
    const show = () => {
      const s = students[i];
      if (titleEl) titleEl.textContent = 'Verlauf: ' + M.studentName(s);
      pos.textContent = `${i + 1} / ${students.length}`;
      prev.disabled = i === 0;
      next.disabled = i === students.length - 1;
      content.replaceChildren(historyBody(course, cat, period, s));
    };
    const go = (d) => {
      const j = i + d;
      if (j < 0 || j >= students.length) return;
      i = j;
      show();
    };
    prev.onclick = () => go(-1);
    next.onclick = () => go(1);
    show();
    return modal({
      title: 'Verlauf: ' + M.studentName(students[i]),
      wide: true,
      body,
      buttons: [{ label: 'Schließen', value: true, kind: 'primary' }],
      onOpen: (dlg) => {
        titleEl = dlg.querySelector('h2');
        dlg.classList.add('comp-hist-dialog');
        dlg.addEventListener('keydown', (e) => {
          if (e.target.closest('input, select, textarea')) return;
          if (e.key === 'ArrowLeft') (e.preventDefault(), go(-1));
          if (e.key === 'ArrowRight') (e.preventDefault(), go(1));
        });
      },
    });
  }

  NM.views = NM.views || {};
  NM.views.competencies = { render, currentPeriod, historyTable, standCell };
})(window.NM = window.NM || {});
