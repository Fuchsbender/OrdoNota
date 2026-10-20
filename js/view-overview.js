/* Notenmanager – Reiter „Notenübersicht“: alle Noten, Gewichtung, Halbjahres- und Jahresnote. */
(function (NM) {
  'use strict';
  const { h, toast, modal, fmtNum, gradeStyle, csv, download, safeFilename } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  // Kürzel für Sonderfälle bei Einzelnoten
  const CODES = { f: 'fehlt', fehlt: 'fehlt', ns: 'nachschreiben', t: 'taeuschung', tv: 'taeuschung', v: 'taeuschung' };

  function render(view, { course }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course, true);
    view.append(
      h(
        'div',
        { class: 'view-head' },
        h('h1', null, 'Notenübersicht'),
        UI.halfSwitch(course, true),
        h('div', { class: 'spacer' }),
        h(
          'div',
          { class: 'inline' },
          h('button', { class: 'btn', onclick: () => NM.print.course(course, half) }, '🖨 Kursliste'),
          h('button', { class: 'btn', onclick: () => NM.print.studentsDialog(course) }, '🖨 Schülerbögen'),
          h('button', { class: 'btn', onclick: () => exportCsv(course) }, '⬇ CSV/Excel')
        )
      )
    );
    if (half === 'Jahr') view.appendChild(yearCard(course, level));
    else view.appendChild(halfCard(course, half, level));
  }

  function weightsLine(course) {
    const parts = [`Klassen-/Kursarbeiten ${fmtNum(course.wKa, 0)} % · Sonstige ${fmtNum(course.wOther, 0)} %`];
    return h('span', { class: 'muted small' }, parts.join(''), ' (änderbar unter „Kurs & Schüler“)');
  }

  function halfCard(course, half, level) {
    const students = M.activeStudents(course);
    const list = course.assessments.filter((a) => a.half === half);
    const ka = list.filter((a) => a.cat === 'ka').sort(byDate);
    const other = list.filter((a) => a.cat === 'other').sort(byDate);
    const showKa = Number(course.wKa) > 0 || ka.length > 0;
    let col = 0;
    const colIndex = new Map();
    for (const a of [...ka, ...other]) if (a.kind === 'manual') colIndex.set(a.id, col++);
    const overCol = col;

    const th = (a) =>
      h(
        'th',
        { class: 'center assess-head kind-' + a.kind + (a.ungraded ? ' ungraded' : ''), title: a.ungraded ? 'Nicht gewertet – zählt nicht zur Note' : null },
        h(
          'button',
          { class: 'link head-btn', title: 'Bearbeiten (Name, Datum, Gewicht, Bereich)', onclick: () => UI.editAssessmentMeta(course, a) },
          UI.assessmentHeader(a)
        ),
        a.kind !== 'manual'
          ? h(
              'button',
              {
                class: 'link tiny',
                title: 'Zum ' + (a.kind === 'test' ? 'Test' : 'EPO-Block'),
                onclick: () => {
                  const ui = NM.app.state.ui;
                  if (a.kind === 'test') ui.testId[course.id] = a.id;
                  else ui.epoId[course.id] = a.id;
                  NM.app.select({ tab: a.kind === 'test' ? 'tests' : 'epo' });
                },
              },
              a.kind === 'test' ? 'Test ›' : 'EPO ›'
            )
          : null
      );

    const head1 = h(
      'tr',
      { class: 'group-row' },
      h('th', { class: 'sticky-col', rowspan: 2 }, 'Name'),
      showKa ? h('th', { class: 'group', colspan: ka.length + 1 }, 'Klassen-/Kursarbeiten') : null,
      h('th', { class: 'group', colspan: other.length + 1 }, 'Sonstige Leistungen'),
      h('th', { class: 'group result', colspan: 3 }, half)
    );
    const head2 = h(
      'tr',
      null,
      showKa ? ka.map(th) : null,
      showKa ? h('th', { class: 'num avg-col' }, 'Ø') : null,
      other.map(th),
      h('th', { class: 'num avg-col' }, 'Ø'),
      h('th', { class: 'num result' }, 'Gerechnet'),
      h('th', { class: 'center result' }, 'Gesetzt'),
      h('th', { class: 'result' }, '')
    );

    const cell = (a, s, ri) => {
      if (a.kind !== 'manual') {
        const p = G.assessmentPoints(a, s.id, level);
        const status = a.kind === 'test' ? (a.test.results[s.id] || {}).status : '';
        return h('td', { class: 'center' + (a.ungraded ? ' ungraded' : '') }, p === null ? (status ? h('span', { class: 'muted small' }, UI.STATUS_SHORT[status]) : h('span', { class: 'muted' }, '·')) : UI.gradeBadge(p, level, 'ro'));
      }
      const g = a.manual.grades[s.id] || {};
      const shown = g.status ? UI.STATUS_SHORT[g.status] : g.p === undefined || g.p === null ? '' : G.label(g.p, level);
      return h(
        'td',
        { class: 'center' },
        h('input', {
          class: 'cell-input grade-input' + (g.status ? ' status' : ''),
          value: shown,
          style: g.status ? null : gradeStyle(g.p),
          'data-grid': 'ov-' + half,
          'data-row': ri,
          'data-col': colIndex.get(a.id),
          'data-focus-key': `ov-${a.id}-${s.id}`,
          'data-select-all': '',
          autocomplete: 'off',
          spellcheck: 'false',
          title: (level === 'mss' ? 'Punkte 00–15' : 'Note, z. B. 2-') + ' · f = fehlt, ns = Nachschreiben, t = Täuschung/Verweigerung',
          onfocus: (e) => e.target.select(),
          onchange: (e) => {
            const raw = e.target.value.trim().toLowerCase();
            if (CODES[raw] || raw === 't/v') {
              a.manual.grades[s.id] = { status: CODES[raw] || 'taeuschung' };
              return NM.app.commit();
            }
            const v = G.parse(raw, level);
            if (v === undefined) {
              e.target.classList.add('invalid');
              return toast(level === 'mss' ? 'Ungültig – Punkte 0 bis 15, oder f / ns / t.' : 'Ungültig – z. B. 1, 1-, 2+ … 5-, 6 (kein 1+), oder f / ns / t.', 'error');
            }
            if (v === null) delete a.manual.grades[s.id];
            else a.manual.grades[s.id] = { p: v };
            NM.app.commit();
          },
        })
      );
    };

    const rows = students.map((s, ri) => {
      const r = G.halfResult(course, half, s.id);
      return h(
        'tr',
        { class: r.override !== null ? 'overridden' : '' },
        h('td', { class: 'sticky-col name-cell' }, h('span', { class: 'row-nr' }, ri + 1), UI.studentLabel(s)),
        showKa ? ka.map((a) => cell(a, s, ri)) : null,
        showKa ? h('td', { class: 'num avg-col' }, UI.valueText(r.ka, level)) : null,
        other.map((a) => cell(a, s, ri)),
        h('td', { class: 'num avg-col' }, UI.valueText(r.other, level)),
        h('td', { class: 'num result' }, h('span', { class: 'raw' }, UI.valueText(r.raw, level)), ' ', UI.gradeBadge(r.rounded, level)),
        h(
          'td',
          { class: 'center result' },
          UI.gradeInput({
            p: r.override,
            level,
            grid: 'ov-' + half,
            row: ri,
            col: overCol,
            key: `ov-set-${half}-${s.id}`,
            placeholder: r.rounded === null ? '' : G.label(r.rounded, level),
            title: 'Gesetzte Note (überschreibt die gerechnete). Leer = gerechnete Note gilt.',
            onSet: (v) => setOverride(course, half, s.id, v),
          })
        ),
        h('td', { class: 'result' }, overrideReasonBtn(course, half, s, r), commentBtn(course, s))
      );
    });

    const addBtns = h(
      'div',
      { class: 'inline wrap' },
      showKa ? h('button', { class: 'btn btn-ghost', onclick: () => addManual(course, half, 'ka') }, '+ Klassen-/Kursarbeit (Note direkt)') : null,
      h('button', { class: 'btn btn-ghost', onclick: () => addManual(course, half, 'other') }, '+ Sonstige Note (HÜ, Heft, Referat …)'),
      h('span', { class: 'muted small' }, 'Tests und EPO-Blöcke erscheinen hier automatisch.')
    );

    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, half), weightsLine(course)),
      addBtns,
      students.length === 0
        ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'ov-' + half }, h('table', { class: 'table grid-table overview-table' }, h('thead', null, head1, head2), h('tbody', null, rows))),
      h(
        'p',
        { class: 'muted small' },
        level === 'mss'
          ? 'Ø = gewichteter Punkteschnitt. Gerundet wird erst am Ende (ab ,5 aufwärts).'
          : 'Ø = gewichteter Schnitt der Dezimalnoten (1- = 1,33 · 2+ = 1,67 …). Gerundet wird erst am Ende auf die nächste Notenstufe, bei Gleichstand zugunsten der Schülerin/des Schülers.',
        ' Einzelnoten: f = fehlt, ns = Nachschreiben, t = Täuschung/Verweigerung (zählt als ',
        level === 'mss' ? '00' : '6',
        ').'
      )
    );
  }

  function byDate(a, b) {
    return (a.date || '').localeCompare(b.date || '');
  }

  function addManual(course, half, cat) {
    const n = course.assessments.filter((a) => a.half === half && a.cat === cat).length + 1;
    const a = M.newManual(half, cat, cat === 'ka' ? 'KA ' + n : 'Note ' + n);
    course.assessments.push(a);
    NM.app.commit({ render: false });
    UI.editAssessmentMeta(course, a, { allowDelete: true }).then((r) => {
      if (r === false) NM.app.rerender();
    });
  }

  function setOverride(course, key, sid, p) {
    course.overrides[key] = course.overrides[key] || {};
    if (p === null) delete course.overrides[key][sid];
    else course.overrides[key][sid] = Object.assign({}, course.overrides[key][sid], { p });
    NM.app.commit();
  }

  function overrideReasonBtn(course, key, s, r) {
    if (r.override === null) return null;
    return h(
      'button',
      {
        class: 'icon-btn' + (r.reason ? ' has-note' : ''),
        title: r.reason ? 'Begründung: ' + r.reason : 'Begründung für die gesetzte Note hinzufügen',
        'aria-label': 'Begründung',
        onclick: async () => {
          const ta = h('textarea', { class: 'input', rows: 3, value: r.reason || '' });
          const v = await modal({
            title: 'Begründung – ' + M.studentName(s),
            body: h('label', { class: 'field' }, h('span', null, `Warum weicht die gesetzte Note (${G.label(r.override, G.courseLevel(course))}) von der gerechneten ab?`), ta),
            buttons: [
              { label: 'Abbrechen', value: null },
              { label: 'Speichern', value: 'ok', kind: 'primary' },
            ],
          });
          if (v !== 'ok') return;
          course.overrides[key][s.id].reason = ta.value.trim();
          NM.app.commit();
        },
      },
      '✎'
    );
  }

  function commentBtn(course, s) {
    const c = course.comments[s.id] || '';
    return h(
      'button',
      {
        class: 'icon-btn' + (c ? ' has-note' : ''),
        title: c ? 'Bemerkung: ' + c : 'Bemerkung zur Person (erscheint auf dem Schülerbogen)',
        'aria-label': 'Bemerkung',
        onclick: async () => {
          const ta = h('textarea', { class: 'input', rows: 4, value: c });
          const v = await modal({
            title: 'Bemerkung – ' + M.studentName(s),
            body: h('label', { class: 'field' }, h('span', null, 'Freitext (z. B. für Elterngespräche)'), ta),
            buttons: [
              { label: 'Abbrechen', value: null },
              { label: 'Speichern', value: 'ok', kind: 'primary' },
            ],
          });
          if (v !== 'ok') return;
          if (ta.value.trim()) course.comments[s.id] = ta.value.trim();
          else delete course.comments[s.id];
          NM.app.commit();
        },
      },
      '💬'
    );
  }

  function yearCard(course, level) {
    const [h1, h2] = G.halvesFor(course);
    const students = M.activeStudents(course);
    const rows = students.map((s, ri) => {
      const r1 = G.halfResult(course, h1, s.id);
      const r2 = G.halfResult(course, h2, s.id);
      const y = G.yearResult(course, s.id);
      const halfCell = (r) =>
        h('td', { class: 'num' }, r.override !== null ? h('span', { class: 'muted small', title: 'gesetzt' }, 'gesetzt ') : h('span', { class: 'raw' }, UI.valueText(r.raw, level)), ' ', UI.gradeBadge(r.final, level));
      return h(
        'tr',
        { class: y.override !== null ? 'overridden' : '' },
        h('td', { class: 'sticky-col name-cell' }, h('span', { class: 'row-nr' }, ri + 1), UI.studentLabel(s)),
        halfCell(r1),
        halfCell(r2),
        h('td', { class: 'num result' }, h('span', { class: 'raw' }, UI.valueText(y.raw, level)), ' ', UI.gradeBadge(y.rounded, level)),
        h(
          'td',
          { class: 'center result' },
          UI.gradeInput({
            p: y.override,
            level,
            grid: 'ov-year',
            row: ri,
            col: 0,
            key: `ov-set-Jahr-${s.id}`,
            placeholder: y.rounded === null ? '' : G.label(y.rounded, level),
            title: 'Gesetzte Jahresnote. Leer = gerechnete Note gilt.',
            onSet: (v) => setOverride(course, 'Jahr', s.id, v),
          })
        ),
        h('td', { class: 'result' }, overrideReasonBtn(course, 'Jahr', s, y), commentBtn(course, s))
      );
    });
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Jahresnote'), h('span', { class: 'muted small' }, `${h1} zählt ${course.wHalf1}, ${h2} zählt ${course.wHalf2} (Standard ⅓ : ⅔). Ist eine Halbjahresnote gesetzt, wird diese verwendet, sonst der ungerundete Schnitt.`)),
      h(
        'div',
        { class: 'table-wrap', 'data-scroll-key': 'ov-year' },
        h(
          'table',
          { class: 'table grid-table overview-table' },
          h('thead', null, h('tr', null, h('th', { class: 'sticky-col' }, 'Name'), h('th', { class: 'num' }, h1), h('th', { class: 'num' }, h2), h('th', { class: 'num result' }, 'Gerechnet'), h('th', { class: 'center result' }, 'Gesetzt'), h('th', { class: 'result' }, ''))),
          h('tbody', null, rows)
        )
      )
    );
  }

  // ---------- Export ----------

  function exportCsv(course) {
    const level = G.courseLevel(course);
    const halves = G.halvesFor(course);
    const students = M.activeStudents(course);
    const lab = (p) => (p === null || p === undefined ? '' : G.label(p, level));
    const num = (v) => (v === null || v === undefined ? '' : fmtNum(v, 2));
    const header = ['Nr', 'Nachname', 'Vorname'];
    const perHalf = halves.map((half) => course.assessments.filter((a) => a.half === half).sort((a, b) => (a.cat === b.cat ? byDate(a, b) : a.cat === 'ka' ? -1 : 1)));
    halves.forEach((half, i) => {
      for (const a of perHalf[i]) header.push(`${half} ${a.name}${Number(a.weight) !== 1 ? ' (×' + a.weight + ')' : ''}`);
      header.push(`${half} Ø KA`, `${half} Ø Sonstige`, `${half} gerechnet`, `${half} Note`);
    });
    if (G.hasYearGrade(course)) header.push('Jahr gerechnet', 'Jahresnote');
    const rows = [header];
    students.forEach((s, i) => {
      const row = [i + 1, s.last, s.first];
      halves.forEach((half, hi) => {
        for (const a of perHalf[hi]) row.push(lab(G.assessmentPoints(a, s.id, level)));
        const r = G.halfResult(course, half, s.id);
        row.push(num(r.ka), num(r.other), num(r.raw), lab(r.final));
      });
      if (G.hasYearGrade(course)) {
        const y = G.yearResult(course, s.id);
        row.push(num(y.raw), lab(y.final));
      }
      rows.push(row);
    });
    const year = NM.app.currentYear();
    download(safeFilename(`Noten_${M.courseTitle(course)}_${year ? year.name : ''}.csv`), csv(rows), 'text/csv;charset=utf-8');
    toast('CSV exportiert – lässt sich direkt in Excel öffnen.', 'success');
  }

  NM.views.overview = { render };
})((globalThis.NM = globalThis.NM || {}));
