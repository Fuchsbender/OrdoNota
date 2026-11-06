/* OrdoNota – Reiter „Notenübersicht“: alle Noten, Gewichtung, Halbjahres- und Jahresnote. */
(function (NM) {
  'use strict';
  const { h, toast, modal, fmtNum, gradeStyle, csv, download, safeFilename } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  // Kürzel für Sonderfälle bei Einzelnoten
  const CODES = { f: 'fehlt', fehlt: 'fehlt', ns: 'nachschreiben', t: 'taeuschung', tv: 'taeuschung', v: 'taeuschung' };

  // Sprung aus dem Spaltenkopf in den Reiter der Leistung: [Name, gemerkte Auswahl, Reiter, Knopftext]
  const JUMP = {
    test: ['Test', 'testId', 'tests', 'Test ›'],
    epo: ['EPO-Block', 'epoId', 'epo', 'EPO ›'],
    pres: ['Präsentation', 'presId', 'pres', 'Präs. ›'],
  };

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
          UI.printButton('Drucken: ' + M.courseTitle(course), [
            { id: 'course', icon: '📄', label: half === 'Jahr' ? 'Notenliste der Jahresnoten' : `Notenliste ${half}`, group: 'teacher', tip: half === 'Jahr' ? 'Alle Personen mit beiden Halbjahresnoten, gerechneter Jahresnote und Jahresnote; gesetzte Noten mit *.' : 'Alle Personen mit allen Leistungen des Halbjahres, Schnitten und Halbjahresnote; gesetzte Noten mit *.', run: () => NM.print.course(course, half) },
            { id: 'sheets', icon: '👤', label: 'Leistungsbögen je Person', group: 'students', tip: 'Eine Seite je Person mit Einzelnoten, Schnitten und Zeugnisnote, z. B. für Elterngespräche. Personen, Zeitraum und Inhalt wählen Sie im nächsten Schritt.', run: () => NM.print.studentsDialog(course) },
          ]),
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

  /** Unterzeile der Sammelspalte eines Pools: Zeitraum der Ziehungen statt Datum. */
  function poolSub(course, a) {
    const p = NM.draw.poolOfColumn(course, a.id);
    const r = p && NM.draw.poolRange(p);
    if (!r) return null;
    const f = NM.util.fmtDateShort;
    return [r[0] === r[1] ? f(r[0]) : f(r[0]) + '–' + f(r[1]), Number(a.weight) !== 1 ? '×' + NM.util.fmtScore(a.weight) : null, a.ungraded ? 'nicht gewertet' : null].filter(Boolean).join(' · ');
  }

  /** Zeitraum mehrerer Spalten, z. B. „12.09.–03.10.“ */
  function drawRange(cols) {
    const d = cols.map((a) => a.date).filter(Boolean).sort();
    if (!d.length) return '';
    const f = (x) => x.slice(8, 10) + '.' + x.slice(5, 7) + '.';
    return d[0] === d[d.length - 1] ? f(d[0]) : f(d[0]) + '–' + f(d[d.length - 1]);
  }

  /** Gebündelte Ziehungsspalten: die Noten der Person nebeneinander (nur Anzeige; bearbeiten nach dem Aufklappen). */
  function bundleCell(cols, s, level) {
    const items = cols
      .map((a) => {
        const g = a.manual.grades[s.id] || {};
        if (g.status) return { a, text: UI.STATUS_SHORT[g.status] };
        if (g.p === undefined || g.p === null) return null;
        return { a, text: G.label(g.p, level), p: g.p };
      })
      .filter(Boolean);
    return h(
      'td',
      { class: 'center draw-bundle', title: items.map((x) => `${x.a.name}: ${x.text}`).join('\n') || 'Keine Note aus Ziehungen' },
      items.length ? items.map((x) => (x.p !== undefined ? UI.gradeBadge(x.p, level, 'ro') : h('span', { class: 'muted small' }, x.text))) : h('span', { class: 'muted' }, '·')
    );
  }

  function halfCard(course, half, level) {
    // Nachschreibtermine stehen in der Spalte ihrer Original-Arbeit
    const list = course.assessments.filter((a) => a.half === half && !G.isMakeup(course, a));
    const ka = list.filter((a) => a.cat === 'ka').sort(byDate);
    const other = list.filter((a) => a.cat === 'other').sort(byDate);
    const all = M.activeStudents(course);
    const results = new Map(all.map((s) => [s.id, G.halfResult(course, half, s.id)]));
    const res = (s) => results.get(s.id);
    const calc = calcFirst(level);
    const sort = UI.sorter('ov', {
      ...Object.fromEntries(list.map((a) => ['a:' + a.id, { get: (s) => G.assessmentPoints(a, s.id, level, course), first: 'desc' }])),
      ka: { get: (s) => res(s).ka, first: calc },
      other: { get: (s) => res(s).other, first: calc },
      raw: { get: (s) => res(s).raw, first: calc },
      override: { get: (s) => res(s).override, first: 'desc' },
    });
    const students = sort.rows(all);
    const showKa = Number(course.wKa) > 0 || ka.length > 0;
    // Spalten aus dem Reiter „Ziehen“: wer nicht gezogen wurde, bekommt ein ausgegrautes Feld
    const drawn = NM.draw.drawnSets(course);
    // Eingeklappte Gruppen und gebündelte Ziehungsspalten (pro Gerät, nur Ansicht; Ausdrucke zeigen alles)
    const fold = NM.app.state.ui.ovFold || {};
    const toggleFold = (k) => {
      const ui = NM.app.state.ui;
      ui.ovFold = Object.assign({}, ui.ovFold, { [k]: !fold[k] });
      NM.app.saveUi();
      NM.app.rerender();
    };
    const drawCols = other.filter((a) => a.kind === 'manual' && drawn.has(a.id));
    const BUNDLE = { bundle: true };
    const kaCols = fold.ka ? [] : ka;
    let otherCols = fold.other ? [] : other;
    if (!fold.other && fold.draw && drawCols.length) {
      const first = other.indexOf(drawCols[0]);
      otherCols = other.filter((a) => !drawCols.includes(a));
      otherCols.splice(other.slice(0, first).filter((a) => !drawCols.includes(a)).length, 0, BUNDLE);
    }
    let col = 0;
    const colIndex = new Map();
    for (const a of [...(showKa ? kaCols : []), ...otherCols]) if (a.kind === 'manual') colIndex.set(a.id, col++);
    const overCol = col;
    const foldBtn = (k, label, n) =>
      h(
        'button',
        { class: 'link fold-btn', 'data-fold': k, 'aria-expanded': fold[k] ? 'false' : 'true', title: fold[k] ? label + ' einblenden' : label + ' einklappen (nur Ø bleibt)', onclick: () => toggleFold(k) },
        (fold[k] ? '▸ ' : '▾ ') + label + (fold[k] && n ? ` (${n})` : '')
      );

    const th = (a) =>
      h(
        'th',
        { class: 'center assess-head kind-' + a.kind + (a.ungraded ? ' ungraded' : ''), title: a.ungraded ? 'Nicht gewertet – zählt nicht zur Note' : null },
        h(
          'button',
          { class: 'link head-btn', title: 'Bearbeiten (Name, Datum, Gewicht, Bereich)', onclick: () => UI.editAssessmentMeta(course, a) },
          UI.assessmentHeader(a, poolSub(course, a))
        ),
        a.kind !== 'manual' && NM.app.tabOn(course, JUMP[a.kind][2])
          ? h(
              'button',
              {
                class: 'link tiny',
                title: 'Zum ' + JUMP[a.kind][0],
                onclick: () => {
                  const ui = NM.app.state.ui;
                  ui[JUMP[a.kind][1]] = ui[JUMP[a.kind][1]] || {};
                  ui[JUMP[a.kind][1]][course.id] = a.id;
                  NM.app.select({ tab: JUMP[a.kind][2] });
                },
              },
              JUMP[a.kind][3]
            )
          : null,
        sort.toggle('a:' + a.id)
      );

    const head1 = h(
      'tr',
      { class: 'group-row' },
      sort.nameHeads({ rowspan: 2 }),
      showKa ? h('th', { class: 'group', colspan: kaCols.length + 1 }, ka.length ? foldBtn('ka', 'Klassen-/Kursarbeiten', ka.length) : 'Klassen-/Kursarbeiten') : null,
      h(
        'th',
        { class: 'group', colspan: otherCols.length + 1 },
        other.length ? foldBtn('other', 'Sonstige Leistungen', other.length) : 'Sonstige Leistungen',
        drawCols.length > 1 && !fold.other
          ? h('button', { class: 'link tiny draw-bundle-btn', title: fold.draw ? 'Ziehungsspalten wieder einzeln zeigen' : 'Spalten aus dem Reiter „Ziehen“ zu einer Spalte zusammenschieben (nur Ansicht)', onclick: () => toggleFold('draw') }, fold.draw ? 'Ziehungen einzeln' : `Ziehungen bündeln (${drawCols.length})`)
          : null
      ),
      h('th', { class: 'group result', colspan: 3 }, half)
    );
    const head2 = h(
      'tr',
      null,
      showKa ? kaCols.map(th) : null,
      showKa ? h('th', { class: 'num avg-col' }, sort.head('ka', 'Ø', 'Ø Klassen-/Kursarbeiten – sortieren')) : null,
      otherCols.map((a) =>
        a === BUNDLE
          ? h('th', { class: 'center assess-head draw-bundle' }, h('button', { class: 'link head-btn', title: 'Ziehungen wieder einzeln zeigen', onclick: () => toggleFold('draw') }, h('span', { class: 'col-head' }, h('span', { class: 'col-name' }, `Ziehen (${drawCols.length})`), h('span', { class: 'col-sub' }, drawRange(drawCols)))))
          : th(a)
      ),
      h('th', { class: 'num avg-col' }, sort.head('other', 'Ø', 'Ø Sonstige Leistungen – sortieren')),
      h('th', { class: 'num result' }, sort.head('raw', 'Gerechnet')),
      h('th', { class: 'center result' }, sort.head('override', 'Gesetzt')),
      h('th', { class: 'result' }, '')
    );

    const cell = (a, s, ri) => {
      if (a.kind !== 'manual') {
        const p = G.assessmentPoints(a, s.id, level, course);
        const status = G.assessmentStatus(a, s.id, course);
        const off = G.ungradedFor(a, s.id, course);
        const src = G.countingFor(course, a, s.id);
        const tip = [src !== a ? 'Nachgeschrieben (' + src.name + ', ' + NM.util.fmtDate(src.date) + ')' : null, off && !a.ungraded ? 'Nicht gewertet – zählt nicht zur Note' : null].filter(Boolean).join(' · ') || null;
        return h('td', { class: 'center' + (off ? ' ungraded' : '') + (src !== a ? ' makeup-cell' : ''), title: tip }, p === null ? (status ? h('span', { class: 'muted small' }, UI.STATUS_SHORT[status]) : h('span', { class: 'muted' }, '·')) : UI.gradeBadge(p, level, 'ro'));
      }
      const g = a.manual.grades[s.id] || {};
      const shown = g.status ? UI.STATUS_SHORT[g.status] : g.p === undefined || g.p === null ? '' : G.label(g.p, level);
      const notDrawn = drawn.has(a.id) && !drawn.get(a.id).has(s.id) && !shown;
      return h(
        'td',
        { class: 'center' + (notDrawn ? ' not-drawn' : ''), title: notDrawn ? 'Nicht gezogen – bei Bedarf trotzdem eintragbar' : null },
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
      const r = res(s);
      return h(
        'tr',
        { class: r.override !== null ? 'overridden' : '' },
        UI.nameCells(s, ri + 1),
        showKa ? kaCols.map((a) => cell(a, s, ri)) : null,
        showKa ? h('td', { class: 'num avg-col' }, UI.valueText(r.ka, level)) : null,
        otherCols.map((a) => (a === BUNDLE ? bundleCell(drawCols, s, level) : cell(a, s, ri))),
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

  /** Erster Klick auf eine Schnitt-Spalte zeigt die Besten oben (Sek I: kleine Dezimalnote, MSS: viele Punkte). */
  function calcFirst(level) {
    return level === 'mss' ? 'desc' : 'asc';
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
        title: c ? 'Bemerkung: ' + c : 'Bemerkung zur Person (erscheint auf dem Leistungsbogen)',
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
    const all = M.activeStudents(course);
    const years = new Map(all.map((s) => [s.id, G.yearResult(course, s.id)]));
    const yr = (s) => years.get(s.id);
    const calc = calcFirst(level);
    const sort = UI.sorter('year', {
      h1: { get: (s) => yr(s).h1, first: calc },
      h2: { get: (s) => yr(s).h2, first: calc },
      raw: { get: (s) => yr(s).raw, first: calc },
      override: { get: (s) => yr(s).override, first: 'desc' },
    });
    const students = sort.rows(all);
    const rows = students.map((s, ri) => {
      const r1 = G.halfResult(course, h1, s.id);
      const r2 = G.halfResult(course, h2, s.id);
      const y = yr(s);
      const halfCell = (r) =>
        h('td', { class: 'num' }, r.override !== null ? h('span', { class: 'muted small', title: 'gesetzt' }, 'gesetzt ') : h('span', { class: 'raw' }, UI.valueText(r.raw, level)), ' ', UI.gradeBadge(r.final, level));
      return h(
        'tr',
        { class: y.override !== null ? 'overridden' : '' },
        UI.nameCells(s, ri + 1),
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
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              sort.nameHeads(),
              h('th', { class: 'num' }, sort.head('h1', h1)),
              h('th', { class: 'num' }, sort.head('h2', h2)),
              h('th', { class: 'num result' }, sort.head('raw', 'Gerechnet')),
              h('th', { class: 'center result' }, sort.head('override', 'Gesetzt')),
              h('th', { class: 'result' }, '')
            )
          ),
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
    const perHalf = halves.map((half) => course.assessments.filter((a) => a.half === half && !G.isMakeup(course, a)).sort((a, b) => (a.cat === b.cat ? byDate(a, b) : a.cat === 'ka' ? -1 : 1)));
    halves.forEach((half, i) => {
      for (const a of perHalf[i]) header.push(`${half} ${a.name}${Number(a.weight) !== 1 ? ' (×' + a.weight + ')' : ''}`);
      header.push(`${half} Ø KA`, `${half} Ø Sonstige`, `${half} gerechnet`, `${half} Note`);
    });
    if (G.hasYearGrade(course)) header.push('Jahr gerechnet', 'Jahresnote');
    const rows = [header];
    students.forEach((s, i) => {
      const row = [i + 1, s.last, s.first];
      halves.forEach((half, hi) => {
        for (const a of perHalf[hi]) row.push(lab(G.assessmentPoints(a, s.id, level, course)));
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
