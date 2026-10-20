/* Notenmanager – Druckansichten (Kursliste, Test, EPO, Schülerbögen). */
(function (NM) {
  'use strict';
  const { h, clear, modal, fmtNum, fmtScore, fmtDate, gradeStyle } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  function doPrint(title, content, { landscape = false } = {}) {
    let host = document.getElementById('print-root');
    if (!host) {
      host = h('div', { id: 'print-root' });
      document.body.appendChild(host);
    }
    // Seitenrand 0 unterdrückt die Kopf-/Fußzeilen des Browsers (Datum, URL, Seitenzahl).
    // Den Rand oben/unten liefern thead/tfoot, die der Browser auf jeder Seite wiederholt.
    const spacer = () => h('tr', null, h('td', null, h('div', { class: 'p-frame-space' })));
    clear(host).appendChild(h('table', { class: 'p-frame' }, h('thead', null, spacer()), h('tbody', null, h('tr', null, h('td', null, content))), h('tfoot', null, spacer())));
    let pageStyle = document.getElementById('print-page-style');
    if (!pageStyle) {
      pageStyle = h('style', { id: 'print-page-style' });
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 0; }`;
    const oldTitle = document.title;
    document.title = title;
    document.body.classList.add('printing');
    const cleanup = () => {
      document.body.classList.remove('printing');
      document.title = oldTitle;
      clear(host);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  }

  function header(course, title, sub) {
    const year = NM.app.currentYear();
    return h(
      'div',
      { class: 'p-header' },
      h('div', null, h('h1', null, title), sub ? h('div', { class: 'p-sub' }, sub) : null),
      h('div', { class: 'p-meta' }, h('div', null, h('strong', null, M.courseTitle(course))), h('div', null, 'Schuljahr ', year ? year.name : ''), h('div', null, 'Stand ', new Date().toLocaleDateString('de-DE')))
    );
  }

  const badge = (p, level) => (p === null || p === undefined ? h('span', { class: 'p-empty' }, '–') : h('span', { class: 'p-grade', style: gradeStyle(p) }, G.label(p, level)));
  // Name für Lehrerlisten, mit I-Markierung (nicht auf Zetteln/Bögen für Schüler)
  const pname = (s) => M.studentName(s) + (s.iStatus ? ' (I)' : '');
  const val = (v) => (v === null || v === undefined ? '–' : fmtNum(v, 2));

  // ---------- Test ----------

  function keyTable(course, a, level, { counts = true } = {}) {
    const t = a.test;
    const key = G.testKey(level, t.limit, G.testMaxScore(t), t.precision, t.custom);
    const st = G.testStats(t, M.statStudents(course).map((s) => s.id), level);
    return h(
      'table',
      { class: 'p-table p-key' },
      h('thead', null, h('tr', null, h('th', null, level === 'mss' ? 'Punkte' : 'Note'), level === 'mss' ? h('th', null, 'Note') : null, h('th', null, 'ab Pkt.'), h('th', null, 'ab %'), counts ? h('th', null, 'Anzahl') : null)),
      h(
        'tbody',
        null,
        key
          .slice()
          .reverse()
          .map((k) =>
            h(
              'tr',
              null,
              h('td', null, G.label(k.p, level)),
              level === 'mss' ? h('td', null, G.wholeGrade(k.p) + G.tendency(k.p)) : null,
              h('td', { class: 'n' }, fmtScore(k.min)),
              h('td', { class: 'n' }, fmtNum(k.pct, 1)),
              counts ? h('td', { class: 'n' }, st.counts[k.p] || '') : null
            )
          )
      )
    );
  }

  function statsBlock(course, a, level) {
    const st = G.testStats(a.test, M.statStudents(course).map((s) => s.id), level);
    return h(
      'div',
      { class: 'p-stats' },
      h(
        'table',
        { class: 'p-table' },
        h('thead', null, h('tr', null, h('th', null, 'Note'), [1, 2, 3, 4, 5, 6].map((g) => h('th', null, g)), h('th', null, 'Σ'), h('th', null, 'Ø'))),
        h('tbody', null, h('tr', null, h('td', null, 'Anzahl'), [1, 2, 3, 4, 5, 6].map((g) => h('td', { class: 'n' }, st.whole[g])), h('td', { class: 'n' }, st.n), h('td', { class: 'n' }, fmtNum(st.avgDec, 2))))
      ),
      level === 'mss' ? h('p', null, 'Ø Punkte: ', h('strong', null, fmtNum(st.avgPoints, 2))) : null,
      h('p', null, 'Standardabweichung ', level === 'mss' ? '(Punkte)' : '(Noten)', ': ', h('strong', null, fmtNum(level === 'mss' ? st.sdPoints : st.sdDec, 2)), ' · Anteil unter 4: ', h('strong', null, st.weakPct === null ? '–' : fmtNum(st.weakPct, 0) + ' %')),
      iNote(course),
      h('p', null, st.drittel ? h('strong', null, 'Drittelparagraph greift!') : 'Drittelparagraph greift nicht.', ` (${st.weak} von ${st.n} mit 5 oder 6)`)
    );
  }

  function iNote(course) {
    const n = M.activeStudents(course).length - M.statStudents(course).length;
    return n ? h('p', { class: 'p-note' }, `Ohne ${n} ${n === 1 ? 'Person' : 'Personen'} mit I-Status.`) : null;
  }

  function testMeta(a) {
    const t = a.test;
    return [fmtDate(a.date), UI.catLabel(a.cat), `Höchstpunktzahl ${fmtScore(G.testMaxScore(t))}`, `LIMIT ${fmtScore(t.limit)} %`].filter(Boolean).join(' · ');
  }

  function test(course, a, mode) {
    const level = G.courseLevel(course);
    const t = a.test;
    const students = M.activeStudents(course);
    if (mode === 'key') {
      return doPrint(`${a.name} – Notenschlüssel`, h('div', { class: 'p-page' }, header(course, a.name, testMeta(a)), h('div', { class: 'p-cols' }, h('div', null, h('h2', null, 'Notenschlüssel'), keyTable(course, a, level)), h('div', null, h('h2', null, 'Notenspiegel'), statsBlock(course, a, level)))));
    }
    if (mode === 'list') {
      const rows = students.map((s, i) => {
        const r = t.results[s.id] || {};
        const res = G.testResult(t, s.id, level);
        return h(
          'tr',
          null,
          h('td', { class: 'n' }, i + 1),
          h('td', null, pname(s)),
          t.tasks.map((task) => h('td', { class: 'n' }, r.scores ? fmtScore(r.scores[task.id]) : '')),
          h('td', { class: 'n' }, res.score === null ? '' : fmtScore(res.score)),
          h('td', { class: 'n' }, res.score === null || !G.testMaxScore(t) ? '' : fmtNum((res.score / G.testMaxScore(t)) * 100, 0)),
          h('td', { class: 'c' }, res.p === null ? UI.STATUS_SHORT[r.status] || '' : badge(res.p, level))
        );
      });
      return doPrint(
        `${a.name} – Ergebnisse`,
        h(
          'div',
          { class: 'p-page' },
          header(course, a.name, testMeta(a)),
          h(
            'table',
            { class: 'p-table p-full' },
            h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), t.tasks.map((task) => h('th', null, task.name, h('br'), h('small', null, fmtScore(task.max) + (task.bonus ? ' B' : '')))), h('th', null, 'Σ'), h('th', null, '%'), h('th', null, 'Note'))),
            h('tbody', null, rows)
          ),
          h('div', { class: 'p-cols' }, h('div', null, statsBlock(course, a, level)), h('div', null, keyTable(course, a, level, { counts: false })))
        ),
        { landscape: t.tasks.length > 10 }
      );
    }
    // Schülerzettel zum Ausschneiden
    const slips = students.map((s) => {
      const r = t.results[s.id] || {};
      const res = G.testResult(t, s.id, level);
      return h(
        'div',
        { class: 'p-slip' },
        h('div', { class: 'p-slip-head' }, h('strong', null, M.studentName(s)), h('span', null, `${a.name} · ${M.courseTitle(course)} · ${fmtDate(a.date)}`)),
        h(
          'table',
          { class: 'p-table p-slip-table' },
          h('tr', null, h('th', null, 'Aufgabe'), t.tasks.map((task) => h('th', null, task.name + (task.bonus ? ' (B)' : ''))), h('th', null, 'Σ')),
          h('tr', null, h('td', null, 'erreicht'), t.tasks.map((task) => h('td', { class: 'n' }, r.scores ? fmtScore(r.scores[task.id]) : '')), h('td', { class: 'n' }, res.score === null ? '' : h('strong', null, fmtScore(res.score)))),
          h('tr', null, h('td', null, 'möglich'), t.tasks.map((task) => h('td', { class: 'n' }, fmtScore(task.max))), h('td', { class: 'n' }, fmtScore(G.testMaxScore(t))))
        ),
        h('div', { class: 'p-slip-result' }, res.p === null ? UI.STATUS_SHORT[r.status] || 'keine Wertung' : ['Ergebnis: ', res.score !== null && G.testMaxScore(t) ? fmtNum((res.score / G.testMaxScore(t)) * 100, 0) + ' % · ' : '', 'Note ', h('strong', { class: 'p-big' }, G.label(res.p, level)), level === 'mss' ? ` Punkte (${G.wholeGrade(res.p)}${G.tendency(res.p)})` : ''])
      );
    });
    doPrint(`${a.name} – Schülerzettel`, h('div', { class: 'p-slips' }, slips));
  }

  // ---------- EPO ----------

  function epo(course, a) {
    const level = G.courseLevel(course);
    const e = a.epo;
    const lessons = e.lessons.slice().sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    const students = M.activeStudents(course);
    const rows = students.map((s, i) => {
      const row = e.entries[s.id] || {};
      const res = G.epoResult(e, s.id, level);
      return h(
        'tr',
        null,
        h('td', { class: 'n' }, i + 1),
        h('td', null, pname(s)),
        lessons.map((l) => h('td', { class: 'c' }, G.epoCellText(row[l.id]))),
        h('td', { class: 'n' }, res.attended ? `${res.sum}/${res.max}` : ''),
        h('td', { class: 'n' }, res.pct === null ? '' : fmtNum(res.pct, 0)),
        h('td', { class: 'c' }, badge(res.p, level))
      );
    });
    doPrint(
      `${a.name} – Mitarbeit`,
      h(
        'div',
        { class: 'p-page' },
        header(course, a.name, `Mitarbeit · ${lessons.length} Stunden · ${a.half}`),
        h(
          'table',
          { class: 'p-table p-full p-epo' },
          h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), lessons.map((l) => h('th', null, NM.util.fmtDateShort(l.date))), h('th', null, 'Pkt.'), h('th', null, '%'), h('th', null, 'Note'))),
          h('tbody', null, rows)
        ),
        h('p', { class: 'p-note' }, '++ / + / 0 / - / -- = Bewertung der Stunde · k = abwesend · u = Hausaufgaben unvollständig · h = Hausaufgaben vergessen')
      ),
      { landscape: lessons.length > 12 }
    );
  }

  /** EPO-Zettel zum Ausschneiden: je Person Kopf mit Kurs/Zeitraum/Legende, Bewertungen je Datum, Ergebnis, Unterschrift. */
  function epoSlips(course, a) {
    const level = G.courseLevel(course);
    const e = a.epo;
    const lessons = e.lessons.slice().sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    const pts = Object.assign({}, G.EPO_DEFAULT_POINTS, e.points);
    const signed = (v) => (v > 0 ? '+' : '') + fmtScore(v).replace('-', '−');
    const period = lessons.length ? `${fmtDate(lessons[0].date)} – ${fmtDate(lessons[lessons.length - 1].date)}` : 'keine Stunden';
    const legend = [...G.EPO_RATINGS.map((k) => `${k} = ${fmtScore(pts[k])}`), 'k = abwesend', `u = HA unvollständig (${signed(pts.u)})`, `h = HA vergessen (${signed(pts.h)})`].join(' · ');
    // Bei vielen Stunden umbrechen, damit die Tabelle auf A4 hochkant passt
    const PER_ROW = 16;
    const chunks = [];
    for (let i = 0; i < lessons.length; i += PER_ROW) chunks.push(lessons.slice(i, i + PER_ROW));
    const slips = M.activeStudents(course).map((s) => {
      const row = e.entries[s.id] || {};
      const res = G.epoResult(e, s.id, level);
      return h(
        'div',
        { class: 'p-slip p-epo-slip' },
        h('div', { class: 'p-epo-slip-head' }, h('h2', null, M.studentName(s)), h('div', { class: 'p-sub' }, `${M.courseTitle(course)} · ${a.name} · ${period}`)),
        h('div', { class: 'p-note' }, legend),
        chunks.map((ls) =>
          h(
            'table',
            { class: 'p-table p-epo-slip-table' },
            h('tr', null, ls.map((l) => h('th', null, NM.util.fmtDateShort(l.date)))),
            h('tr', null, ls.map((l) => h('td', { class: 'c' }, G.epoCellText(row[l.id]))))
          )
        ),
        h(
          'div',
          { class: 'p-slip-result' },
          res.attended ? `Punkte ${fmtScore(res.sum)} von ${fmtScore(res.max)} (${fmtNum(res.pct, 0)} %) · ` : 'Noch keine Bewertung · ',
          `abwesend: ${res.absent} · HA unvollständig: ${res.u} · HA vergessen: ${res.h}`,
          res.p === null ? null : [' · Note ', h('strong', { class: 'p-big' }, G.label(res.p, level))]
        ),
        h('div', { class: 'p-sign' }, h('span', null, 'Datum'), h('span', null, 'Unterschrift'))
      );
    });
    doPrint(`${a.name} – Schülerzettel`, h('div', { class: 'p-slips' }, slips));
  }

  // ---------- Sitzplan ----------

  function seating(c) {
    const { st, students, cells } = NM.views.seating.layout(c);
    const names = NM.views.seating.cardNames(students);
    const desk = h('div', { class: 'p-seat-desk' }, 'Lehrerpult');
    const rows = [];
    for (let y = 0; y < st.rows; y++) {
      const tr = h('tr');
      for (let x = 0; x < st.cols; x++) {
        const sid = cells[x + ',' + y];
        const s = sid && students.find((p) => p.id === sid);
        tr.appendChild(h('td', { class: sid ? 'p-seat' : 'p-seat empty' }, s && s.photo ? h('img', { src: s.photo, alt: '' }) : null, sid ? names[sid] : ''));
      }
      rows.push(tr);
    }
    doPrint(
      `${M.courseTitle(c)} – Sitzplan`,
      h('div', { class: 'p-page' }, header(c, 'Sitzplan', st.name), st.desk === 'top' ? desk : null, h('table', { class: 'p-seat-grid' + (students.some((s) => s.photo && Object.values(cells).includes(s.id)) ? ' with-photos' : '') }, h('tbody', null, rows)), st.desk === 'bottom' ? desk : null),
      { landscape: st.cols > st.rows }
    );
  }

  // ---------- Kursliste ----------

  function course(c, half) {
    const level = G.courseLevel(c);
    const students = M.activeStudents(c);
    if (half === 'Jahr') {
      const [h1, h2] = G.halvesFor(c);
      const rows = students.map((s, i) => {
        const r1 = G.halfResult(c, h1, s.id);
        const r2 = G.halfResult(c, h2, s.id);
        const y = G.yearResult(c, s.id);
        return h('tr', null, h('td', { class: 'n' }, i + 1), h('td', null, pname(s)), h('td', { class: 'c' }, badge(r1.final, level)), h('td', { class: 'c' }, badge(r2.final, level)), h('td', { class: 'n' }, val(y.raw)), h('td', { class: 'c' }, badge(y.final, level), y.override !== null ? ' *' : ''));
      });
      return doPrint(
        `${M.courseTitle(c)} – Jahresnoten`,
        h(
          'div',
          { class: 'p-page' },
          header(c, 'Jahresnoten', `${h1} : ${h2} = ${c.wHalf1} : ${c.wHalf2}`),
          h('table', { class: 'p-table p-full' }, h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), h('th', null, h1), h('th', null, h2), h('th', null, 'Gerechnet'), h('th', null, 'Jahresnote'))), h('tbody', null, rows)),
          h('p', { class: 'p-note' }, '* = gesetzte Note weicht von der gerechneten ab')
        )
      );
    }
    const list = c.assessments.filter((a) => a.half === half);
    const ka = list.filter((a) => a.cat === 'ka').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const other = list.filter((a) => a.cat === 'other').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const showKa = Number(c.wKa) > 0 || ka.length > 0;
    const th = (a) => h('th', { class: a.ungraded ? 'p-ungraded' : null }, a.name, h('br'), h('small', null, [NM.util.fmtDateShort(a.date), Number(a.weight) !== 1 ? '×' + fmtScore(a.weight) : '', a.ungraded ? 'nicht gewertet' : ''].filter(Boolean).join(' ')));
    const rows = students.map((s, i) => {
      const r = G.halfResult(c, half, s.id);
      const cell = (a) => h('td', { class: 'c' + (a.ungraded ? ' p-ungraded' : '') }, badge(G.assessmentPoints(a, s.id, level), level));
      return h(
        'tr',
        null,
        h('td', { class: 'n' }, i + 1),
        h('td', null, pname(s)),
        showKa ? ka.map(cell) : null,
        showKa ? h('td', { class: 'n avg' }, val(r.ka)) : null,
        other.map(cell),
        h('td', { class: 'n avg' }, val(r.other)),
        h('td', { class: 'n' }, val(r.raw)),
        h('td', { class: 'c' }, badge(r.final, level), r.override !== null ? ' *' : '')
      );
    });
    doPrint(
      `${M.courseTitle(c)} – ${half}`,
      h(
        'div',
        { class: 'p-page' },
        header(c, 'Notenliste ' + half, `Klassen-/Kursarbeiten ${fmtNum(c.wKa, 0)} % · Sonstige ${fmtNum(c.wOther, 0)} %`),
        h(
          'table',
          { class: 'p-table p-full' },
          h(
            'thead',
            null,
            h('tr', null, h('th', { rowspan: 2 }, 'Nr.'), h('th', { rowspan: 2 }, 'Name'), showKa ? h('th', { colspan: ka.length + 1 }, 'Klassen-/Kursarbeiten') : null, h('th', { colspan: other.length + 1 }, 'Sonstige Leistungen'), h('th', { colspan: 2 }, half)),
            h('tr', null, showKa ? ka.map(th) : null, showKa ? h('th', null, 'Ø') : null, other.map(th), h('th', null, 'Ø'), h('th', null, 'Gerechnet'), h('th', null, 'Note'))
          ),
          h('tbody', null, rows)
        ),
        h('p', { class: 'p-note' }, '* = gesetzte Note weicht von der gerechneten ab')
      ),
      { landscape: ka.length + other.length > 8 }
    );
  }

  // ---------- Schülerbögen ----------

  const SHEET_OPTS = [
    ['grades', 'Einzelnoten mit Datum und Gewicht', true],
    ['averages', 'Schnitte (Klassenarbeiten / Sonstige)', true],
    ['final', 'Halbjahres- und Jahresnote (gerechnet und gesetzt)', true],
    ['tests', 'Test-Details je Aufgabe', true],
    ['epo', 'EPO-Zusammenfassung (Bewertungen, Hausaufgaben, Fehlstunden)', true],
    ['comment', 'Bemerkung', true],
  ];

  async function studentsDialog(c) {
    const students = M.activeStudents(c);
    const who = h('select', { class: 'input' }, h('option', { value: '' }, `Alle (${students.length})`), students.map((s) => h('option', { value: s.id }, M.studentName(s))));
    const halves = G.halvesFor(c);
    const halfSel = h('select', { class: 'input' }, h('option', { value: '' }, 'Alle Halbjahre'), halves.map((x) => h('option', { value: x }, x)));
    const boxes = SHEET_OPTS.map(([k, label, def]) => [k, h('input', { type: 'checkbox', checked: def })]);
    const v = await modal({
      title: 'Schülerbögen drucken',
      body: h(
        'div',
        null,
        h('div', { class: 'form-grid' }, h('label', { class: 'field' }, h('span', null, 'Für'), who), h('label', { class: 'field' }, h('span', null, 'Zeitraum'), halfSel)),
        h('h3', null, 'Inhalt'),
        boxes.map(([k, cb], i) => h('label', { class: 'check' }, cb, ' ', SHEET_OPTS[i][1]))
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Drucken', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const opts = Object.fromEntries(boxes.map(([k, cb]) => [k, cb.checked]));
    const list = who.value ? students.filter((s) => s.id === who.value) : students;
    const hs = halfSel.value ? [halfSel.value] : halves;
    doPrint(`${M.courseTitle(c)} – Schülerbögen`, h('div', null, list.map((s) => studentSheet(c, s, hs, opts))));
  }

  function studentSheet(c, s, halves, o) {
    const level = G.courseLevel(c);
    const sections = halves.map((half) => {
      const list = c.assessments.filter((a) => a.half === half).sort((a, b) => (a.cat === b.cat ? (a.date || '').localeCompare(b.date || '') : a.cat === 'ka' ? -1 : 1));
      const r = G.halfResult(c, half, s.id);
      const parts = [h('h2', null, half)];
      if (o.grades) {
        parts.push(
          list.length
            ? h(
                'table',
                { class: 'p-table p-full' },
                h('thead', null, h('tr', null, h('th', null, 'Datum'), h('th', null, 'Leistung'), h('th', null, 'Bereich'), h('th', null, 'Gewicht'), h('th', null, 'Note'))),
                h(
                  'tbody',
                  null,
                  list.map((a) => {
                    const p = G.assessmentPoints(a, s.id, level);
                    const status = a.kind === 'test' ? (a.test.results[s.id] || {}).status : a.kind === 'manual' ? (a.manual.grades[s.id] || {}).status : '';
                    return h('tr', null, h('td', null, fmtDate(a.date)), h('td', null, a.name, a.kind !== 'manual' ? h('small', null, ' (' + M.kindLabel(a) + ')') : null, a.ungraded ? h('small', null, ' – nicht gewertet') : null), h('td', null, UI.catLabel(a.cat)), h('td', { class: 'n' }, fmtScore(a.weight)), h('td', { class: 'c' }, p === null ? UI.STATUS_SHORT[status] || '–' : badge(p, level)));
                  })
                )
              )
            : h('p', { class: 'p-note' }, 'Keine Leistungen erfasst.')
        );
      }
      if (o.tests) {
        for (const a of list.filter((x) => x.kind === 'test')) {
          const t = a.test;
          const res = (t.results[s.id] || {}).scores || {};
          const tr = G.testResult(t, s.id, level);
          if (tr.p === null && !Object.keys(res).length) continue;
          parts.push(
            h(
              'div',
              { class: 'p-detail' },
              h('h3', null, a.name, ' – Punkte je Aufgabe'),
              h(
                'table',
                { class: 'p-table' },
                h('tr', null, h('th', null, 'Aufgabe'), t.tasks.map((task) => h('th', null, task.name + (task.bonus ? ' (B)' : ''))), h('th', null, 'Σ')),
                h('tr', null, h('td', null, 'erreicht'), t.tasks.map((task) => h('td', { class: 'n' }, fmtScore(res[task.id]))), h('td', { class: 'n' }, tr.score === null ? '' : fmtScore(tr.score))),
                h('tr', null, h('td', null, 'möglich'), t.tasks.map((task) => h('td', { class: 'n' }, fmtScore(task.max))), h('td', { class: 'n' }, fmtScore(G.testMaxScore(t))))
              )
            )
          );
        }
      }
      if (o.epo) {
        for (const a of list.filter((x) => x.kind === 'epo')) {
          const r2 = G.epoResult(a.epo, s.id, level);
          parts.push(
            h(
              'div',
              { class: 'p-detail' },
              h('h3', null, a.name, ` – ${a.epo.lessons.length} Stunden`),
              h(
                'p',
                null,
                G.EPO_RATINGS.map((k) => `${k}: ${r2.counts[k]}`).join(' · '),
                ` · abwesend: ${r2.absent} · HA unvollständig: ${r2.u} · HA vergessen: ${r2.h}`,
                r2.pct !== null ? ` · ${r2.sum}/${r2.max} Punkte (${fmtNum(r2.pct, 0)} %) → ` : ' · ',
                badge(r2.p, level)
              )
            )
          );
        }
      }
      if (o.averages || o.final) {
        parts.push(
          h(
            'table',
            { class: 'p-table p-summary' },
            h(
              'tr',
              null,
              o.averages && Number(c.wKa) > 0 ? [h('th', null, `Ø Klassen-/Kursarbeiten (${fmtNum(c.wKa, 0)} %)`), h('td', { class: 'n' }, val(r.ka))] : null,
              o.averages ? [h('th', null, `Ø Sonstige (${fmtNum(c.wOther, 0)} %)`), h('td', { class: 'n' }, val(r.other))] : null,
              o.final ? [h('th', null, 'Gerechnet'), h('td', { class: 'n' }, val(r.raw), ' ', badge(r.rounded, level)), h('th', null, 'Note ' + half), h('td', { class: 'c' }, badge(r.final, level))] : null
            )
          )
        );
        if (o.final && r.override !== null && r.reason) parts.push(h('p', { class: 'p-note' }, 'Begründung: ', r.reason));
      }
      return h('section', { class: 'p-section' }, parts);
    });
    let yearPart = null;
    if (o.final && G.hasYearGrade(c) && halves.length === 2) {
      const y = G.yearResult(c, s.id);
      yearPart = h(
        'section',
        { class: 'p-section' },
        h('h2', null, 'Jahresnote'),
        h('table', { class: 'p-table p-summary' }, h('tr', null, h('th', null, `Gerechnet (${c.wHalf1} : ${c.wHalf2})`), h('td', { class: 'n' }, val(y.raw), ' ', badge(y.rounded, level)), h('th', null, 'Jahresnote'), h('td', { class: 'c' }, badge(y.final, level)))),
        y.override !== null && y.reason ? h('p', { class: 'p-note' }, 'Begründung: ', y.reason) : null
      );
    }
    const comment = o.comment && c.comments[s.id] ? h('section', { class: 'p-section' }, h('h2', null, 'Bemerkung'), h('p', { class: 'p-comment' }, c.comments[s.id])) : null;
    return h(
      'div',
      { class: 'p-page p-break' },
      header(c, M.studentName(s), level === 'mss' ? 'Leistungsübersicht · Punkte 00–15' : 'Leistungsübersicht · Noten 1–6'),
      sections,
      yearPart,
      comment
    );
  }

  NM.print = { test, epo, epoSlips, seating, course, studentsDialog };
})((globalThis.NM = globalThis.NM || {}));
