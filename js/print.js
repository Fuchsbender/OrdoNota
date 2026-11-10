/* OrdoNota – Druckansichten (Notenliste, Test, EPO, Leistungsbögen). */
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

  /** Druckkopf aus den Einstellungen (settings.print, seit 1.47); fehlt etwas, fällt es weg. */
  function printSettings() {
    const db = NM.app.state && NM.app.state.db;
    return (db && db.settings && db.settings.print) || {};
  }

  function schoolBlock(ps) {
    if (!ps.logo && !ps.schoolName) return null;
    return h('div', { class: 'p-school' }, ps.logo ? h('img', { class: 'p-logo', src: ps.logo, alt: ps.schoolName || 'Schullogo' }) : null, ps.schoolName ? h('span', { class: 'p-school-name' }, ps.schoolName) : null);
  }

  /**
   * Gemeinsamer Kopf aller Ausdrucke (seit 1.47): links Logo und Schulname (falls eingetragen), rechts Kurs,
   * Schuljahr/Halbjahr, Lehrkraft und Datum; darunter Titel, Name der Person und Untertitel.
   * opts: kicker (kleine Zeile über dem Titel), person, half, date (Datum der Leistung; sonst „Stand“ = Druckdatum),
   * dateLabel, showDate (false: keine Datumszeile, z. B. bei leeren Bögen mit Datumsfeld), extra (weitere Zeilen rechts), compact (einzeilig für Zettel zum Ausschneiden).
   */
  function header(course, title, sub, { kicker = null, person = null, half = null, date = null, dateLabel = 'Datum', showDate = true, extra = [], compact = false } = {}) {
    const ps = printSettings();
    const school = schoolBlock(ps);
    if (compact) {
      return h(
        'div',
        { class: 'p-head p-head-compact' },
        h('div', { class: 'p-head-left' }, school, h('strong', { class: 'p-head-person' }, person || title)),
        h('div', { class: 'p-head-right' }, [person ? title : null, course ? M.courseTitle(course) : null, date ? fmtDate(date) : null, sub].filter(Boolean).join(' · '))
      );
    }
    const year = NM.app.currentYear();
    const titleBlock = h(
      'div',
      { class: 'p-head-title' },
      kicker ? h('div', { class: 'p-kicker' }, kicker) : null,
      h('h1', null, title),
      person ? h('div', { class: 'p-head-person' }, person) : null,
      sub ? h('div', { class: 'p-sub' }, sub) : null
    );
    const meta = h(
      'div',
      { class: 'p-meta' },
      course ? h('div', null, h('strong', null, M.courseTitle(course))) : null,
      year ? h('div', null, 'Schuljahr ', year.name, half ? ' · ' + half : '') : null,
      ps.teacher ? h('div', null, 'Lehrkraft: ', ps.teacher) : null,
      extra.filter(Boolean).map((x) => h('div', null, x)),
      showDate ? h('div', null, date ? `${dateLabel} ${fmtDate(date)}` : 'Stand ' + new Date().toLocaleDateString('de-DE')) : null
    );
    return h('div', { class: 'p-head' + (school ? ' with-school' : '') }, h('div', { class: 'p-head-row' }, school || titleBlock, meta), school ? titleBlock : null);
  }

  const badge = (p, level) => (p === null || p === undefined ? h('span', { class: 'p-empty' }, '–') : h('span', { class: 'p-grade', style: gradeStyle(p) }, G.label(p, level)));
  // Name für Lehrerlisten, mit I-Markierung (nicht auf Zetteln/Bögen für Schüler)
  const pname = (s) => M.studentName(s) + (s.iStatus ? ' (I)' : '');
  const val = (v) => (v === null || v === undefined ? '–' : fmtNum(v, 2));

  // ---------- Test ----------

  function keyTable(course, a, level, { counts = true, part = null } = {}) {
    const t = a.test;
    const ids = M.statStudents(course).map((s) => s.id);
    const key = part ? G.keyForPart(t, part, level) : G.keyForTest(t, level);
    const st = part ? G.partStats(t, part, ids, level) : G.testStats(t, ids, level);
    return keyTableFor(key, st, level, counts);
  }

  function keyTableFor(key, st, level, counts = true) {
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

  /** Schlüssel des Tests bzw. (getrennt benotete Teile) je Teil mit Überschrift. */
  function keyTables(course, a, level, opts = {}) {
    const t = a.test;
    if (!G.separateParts(t)) return keyTable(course, a, level, opts);
    return h('div', { class: 'p-keyparts' }, t.parts.map((part) => h('div', { class: 'p-keypart' }, h('h3', null, part.name, h('small', null, ` · ${fmtScore(G.testMaxScore(G.partAsTest(t, part)))} P. · LIMIT ${fmtScore(part.limit)} %`)), keyTable(course, a, level, Object.assign({}, opts, { part })))));
  }

  function statsBlock(course, a, level) {
    return statsBlockFor(course, G.testStats(a.test, M.statStudents(course).map((s) => s.id), level), level);
  }

  function statsBlockFor(course, st, level) {
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

  function testMeta(course, a) {
    const t = a.test;
    const level = G.courseLevel(course);
    const parts = G.hasParts(t)
      ? G.separateParts(t)
        ? 'Teile (getrennt benotet, Gewicht ' + t.parts.map((x) => fmtScore(G.partWeight(x))).join(' : ') + '): ' + t.parts.map((x) => x.name).join(', ')
        : 'Teile: ' + t.parts.map((x) => x.name).join(', ')
      : null;
    return [fmtDate(a.date), UI.catLabel(a.cat), `Höchstpunktzahl ${fmtScore(G.testMaxScore(t))}`, G.separateParts(t) ? null : `LIMIT ${fmtScore(t.limit)} %`, !G.separateParts(t) && G.wholeOnly(t, level) ? 'nur ganze Noten' : null, parts].filter(Boolean).join(' · ');
  }

  /** Aufgabentabelle (erreicht/möglich) je Person; bei Teilen mit Zwischensumme je Teil. */
  function taskTable(t, scores, res, cls) {
    const head = [];
    const got = [];
    const max = [];
    G.taskGroups(t).forEach((g, gi) => {
      for (const task of g.tasks) {
        head.push(h('th', null, task.name + (task.bonus ? ' (B)' : '')));
        got.push(h('td', { class: 'n' }, fmtScore(scores[task.id])));
        max.push(h('td', { class: 'n' }, fmtScore(task.max)));
      }
      if (g.part) {
        const pr = res.parts[gi];
        head.push(h('th', { class: 'p-part' }, 'Σ ' + g.part.name));
        got.push(h('td', { class: 'n p-part' }, pr.score === null ? '' : fmtScore(pr.score)));
        max.push(h('td', { class: 'n p-part' }, fmtScore(pr.max)));
      }
    });
    return h(
      'table',
      { class: 'p-table ' + cls },
      h('tr', null, h('th', null, 'Aufgabe'), head, h('th', null, 'Σ')),
      h('tr', null, h('td', null, 'erreicht'), got, h('td', { class: 'n' }, res.score === null ? '' : h('strong', null, fmtScore(res.score)))),
      h('tr', null, h('td', null, 'möglich'), max, h('td', { class: 'n' }, fmtScore(G.testMaxScore(t))))
    );
  }

  /** „Theorie: 2 · Praxis: 3-“ (getrennt benotete Teile). */
  function partGrades(t, res, level) {
    if (!G.separateParts(t)) return null;
    return t.parts.map((part, i) => `${part.name}: ${res.parts[i].p === null ? UI.STATUS_SHORT[res.parts[i].status] || '–' : G.label(res.parts[i].p, level)}`).join(' · ');
  }

  function test(course, a, mode) {
    const level = G.courseLevel(course);
    const t = a.test;
    const students = M.activeStudents(course);
    const sep = G.separateParts(t);
    const groups = G.taskGroups(t);
    if (mode === 'key') {
      return doPrint(`${a.name} – Notenschlüssel`, h('div', { class: 'p-page' }, header(course, a.name, testMeta(course, a), { half: a.half, date: a.date, dateLabel: 'Testdatum' }), h('div', { class: 'p-cols' }, h('div', null, h('h2', null, 'Notenschlüssel'), keyTables(course, a, level)), h('div', null, h('h2', null, sep ? 'Notenspiegel (Gesamtnote)' : 'Notenspiegel'), statsBlock(course, a, level)))));
    }
    if (mode === 'parts') {
      // Ergebnisse nach Teilen: je Person Punkte, Prozent (und Note) je Teil, dann Gesamt
      const rows = students.map((s, i) => {
        const r = t.results[s.id] || {};
        const res = G.testResult(t, s.id, level);
        return h(
          'tr',
          null,
          h('td', { class: 'n' }, i + 1),
          h('td', null, pname(s)),
          t.parts.map((part, pi) => {
            const pr = res.parts[pi];
            return [
              h('td', { class: 'n p-part-start' }, pr.score === null ? '' : fmtScore(pr.score)),
              h('td', { class: 'n' }, pr.score === null || !pr.max ? '' : fmtNum((pr.score / pr.max) * 100, 0)),
              sep ? h('td', { class: 'c' }, pr.p === null ? UI.STATUS_SHORT[pr.status] || '' : badge(pr.p, level)) : null,
            ];
          }),
          h('td', { class: 'n p-part-start' }, res.score === null ? '' : h('strong', null, fmtScore(res.score))),
          h('td', { class: 'n' }, res.score === null || !G.testMaxScore(t) ? '' : fmtNum((res.score / G.testMaxScore(t)) * 100, 0)),
          h('td', { class: 'c' + (r.status === 'ungewertet' ? ' p-ungraded' : '') }, res.p === null ? UI.STATUS_SHORT[r.status] || '' : badge(res.p, level))
        );
      });
      const per = sep ? 3 : 2;
      return doPrint(
        `${a.name} – Ergebnisse nach Teilen`,
        h(
          'div',
          { class: 'p-page' },
          header(course, a.name + ' – Ergebnisse nach Teilen', testMeta(course, a), { half: a.half, date: a.date, dateLabel: 'Testdatum' }),
          h(
            'table',
            { class: 'p-table p-full p-parts' },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                h('th', { rowspan: 2 }, 'Nr.'),
                h('th', { rowspan: 2 }, 'Name'),
                t.parts.map((part) => h('th', { colspan: per, class: 'p-part-start' }, part.name, h('br'), h('small', null, `${fmtScore(G.testMaxScore(G.partAsTest(t, part)))} P.` + (sep ? ` · Gewicht ${fmtScore(G.partWeight(part))}` : '')))),
                h('th', { colspan: 3, class: 'p-part-start' }, 'Gesamt', h('br'), h('small', null, `${fmtScore(G.testMaxScore(t))} P.`))
              ),
              h('tr', null, t.parts.map(() => [h('th', { class: 'p-part-start' }, 'Pkt.'), h('th', null, '%'), sep ? h('th', null, 'Note') : null]), h('th', { class: 'p-part-start' }, 'Pkt.'), h('th', null, '%'), h('th', null, 'Note'))
            ),
            h('tbody', null, rows)
          ),
          h('div', { class: 'p-cols' }, h('div', null, statsBlock(course, a, level)), h('div', null, keyTables(course, a, level, { counts: false })))
        ),
        { landscape: t.parts.length * per + 5 > 12 }
      );
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
          groups.map((g, gi) => [
            g.tasks.map((task) => h('td', { class: 'n' }, r.scores ? fmtScore(r.scores[task.id]) : '')),
            g.part ? h('td', { class: 'n p-part' }, res.parts[gi].score === null ? '' : fmtScore(res.parts[gi].score)) : null,
            g.part && sep ? h('td', { class: 'c p-part' }, res.parts[gi].p === null ? UI.STATUS_SHORT[res.parts[gi].status] || '' : badge(res.parts[gi].p, level)) : null,
          ]),
          h('td', { class: 'n' }, res.score === null ? '' : fmtScore(res.score)),
          h('td', { class: 'n' }, res.score === null || !G.testMaxScore(t) ? '' : fmtNum((res.score / G.testMaxScore(t)) * 100, 0)),
          h('td', { class: 'c' + (r.status === 'ungewertet' ? ' p-ungraded' : '') }, res.p === null ? UI.STATUS_SHORT[r.status] || '' : [badge(res.p, level), r.status === 'ungewertet' ? h('small', null, ' n. gew.') : null]),
          a.cat === 'ka' ? h('td', { class: 'c' }, r.signed ? '✓ ' + NM.util.fmtDateShort(r.signed) : '') : null
        );
      });
      const cols = t.tasks.length + groups.filter((g) => g.part).length * (sep ? 2 : 1);
      return doPrint(
        `${a.name} – Ergebnisliste`,
        h(
          'div',
          { class: 'p-page' },
          header(course, a.name, testMeta(course, a), { half: a.half, date: a.date, dateLabel: 'Testdatum' }),
          h(
            'table',
            { class: 'p-table p-full' },
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                h('th', null, 'Nr.'),
                h('th', null, 'Name'),
                groups.map((g) => [
                  g.tasks.map((task) => h('th', null, task.name, h('br'), h('small', null, fmtScore(task.max) + (task.bonus ? ' B' : '')))),
                  g.part ? h('th', { class: 'p-part' }, 'Σ', h('br'), h('small', null, g.part.name)) : null,
                  g.part && sep ? h('th', { class: 'p-part' }, 'Note', h('br'), h('small', null, g.part.name)) : null,
                ]),
                h('th', null, 'Σ'),
                h('th', null, '%'),
                h('th', null, 'Note'),
                a.cat === 'ka' ? h('th', null, 'Unterschr.') : null
              )
            ),
            h('tbody', null, rows)
          ),
          h('div', { class: 'p-cols' }, h('div', null, statsBlock(course, a, level)), h('div', null, keyTables(course, a, level, { counts: false })))
        ),
        { landscape: cols > 10 }
      );
    }
    // Ergebniszettel zum Ausschneiden
    const slips = students.map((s) => {
      const r = t.results[s.id] || {};
      const res = G.testResult(t, s.id, level);
      const pg = partGrades(t, res, level);
      return h(
        'div',
        { class: 'p-slip' },
        header(course, a.name, null, { compact: true, person: M.studentName(s), date: a.date }),
        taskTable(t, r.scores || {}, res, 'p-slip-table'),
        pg ? h('div', { class: 'p-slip-result' }, 'Teilnoten: ', pg) : null,
        h('div', { class: 'p-slip-result' }, res.p === null ? UI.STATUS_SHORT[r.status] || (pg && res.score !== null ? 'Gesamtnote erst, wenn alle Teile bewertet sind' : 'keine Wertung') : ['Ergebnis: ', res.score !== null && G.testMaxScore(t) ? fmtNum((res.score / G.testMaxScore(t)) * 100, 0) + ' % · ' : '', 'Note ', h('strong', { class: 'p-big' }, G.label(res.p, level)), level === 'mss' ? ` Punkte (${G.wholeGrade(res.p)}${G.tendency(res.p)})` : ''])
      );
    });
    doPrint(`${a.name} – Ergebniszettel`, h('div', { class: 'p-slips' }, slips));
  }

  // ---------- Moodle-Rückmeldung ----------

  const MOODLE_MARK = { ok: ['✓', 'richtig'], part: ['◐', 'teilweise'], wrong: ['✗', 'falsch'], none: ['–', 'keine Antwort'] };

  /** Je Person eine Seite: Ergebnis oben, darunter Frage, Antwort, Lösung und Punkte; Note nur mit withGrade. */
  function moodle(course, a, { sid = null, withGrade = true } = {}) {
    const level = G.courseLevel(course);
    const t = a.test;
    const answers = NM.moodle.answersOf(t);
    const max = G.testMaxScore(t);
    const students = M.activeStudents(course).filter((s) => (!sid || s.id === sid) && G.testResult(t, s.id, level).score !== null);
    // Markierung nach Punkten (auch in Moodle von Hand korrigierte); „keine Antwort“ nur ohne Punkte
    const mark = (v, task, x) => (v === undefined || v === null || v === '' ? '' : Number(v) >= Number(task.max) ? 'ok' : Number(v) > 0 ? 'part' : x.q && !x.a ? 'none' : 'wrong');
    const tile = (label, value, cls) => h('div', { class: 'p-mr-tile' + (cls ? ' ' + cls : '') }, h('span', null, label), h('strong', null, value));
    const pages = students.map((s) => {
      const scores = (t.results[s.id] || {}).scores || {};
      const ans = answers[s.id] || {};
      const res = G.testResult(t, s.id, level);
      const pct = max ? (res.score / max) * 100 : null;
      const rows = G.taskGroups(t).flatMap((g, gi) => [
        g.part ? h('tr', { class: 'p-mr-part' }, h('td', { colspan: 5 }, g.part.name, h('span', null, ` · ${fmtScore(res.parts[gi].score)} / ${fmtScore(res.parts[gi].max)} Punkte` + (G.separateParts(t) && res.parts[gi].p !== null && withGrade ? ` · ${G.label(res.parts[gi].p, level)}` : '')))) : null,
        ...g.tasks.map((task) => taskRow(task, t.tasks.indexOf(task))),
      ]);
      function taskRow(task, i) {
        const x = ans[task.id] || {};
        const v = scores[task.id];
        const m = mark(v, task, x);
        return h(
          'tr',
          { class: m ? 'p-mr-' + m : '' },
          h('td', { class: 'p-mr-nr' }, task.moodleNr || i + 1),
          h('td', { class: 'p-mr-q' }, x.q || task.name),
          h('td', { class: 'p-mr-a' }, x.q ? x.a || h('em', null, 'keine Antwort') : ''),
          h('td', { class: 'p-mr-c' }, x.c || ''),
          h('td', { class: 'p-mr-pts' }, m ? h('span', { class: 'p-mr-sym', title: MOODLE_MARK[m][1] }, MOODLE_MARK[m][0]) : null, `${fmtScore(v)} / ${fmtScore(task.max)}${task.bonus ? ' B' : ''}`)
        );
      }
      return h(
        'div',
        { class: 'p-page p-break p-mr' },
        header(course, a.name, null, { kicker: 'Testergebnis', person: [s.first, s.last].filter(Boolean).join(' '), half: a.half, date: a.date, dateLabel: 'Testdatum' }),
        h(
          'div',
          { class: 'p-mr-summary' },
          tile('Punkte', `${fmtScore(res.score)} / ${fmtScore(max)}`),
          pct === null ? null : tile('Prozent', fmtNum(pct, 1) + ' %'),
          pct === null ? null : h('div', { class: 'p-mr-bar' }, h('div', { style: `width:${Math.max(0, Math.min(100, pct))}%` }))
        ),
        h(
          'table',
          { class: 'p-mr-table' },
          h('colgroup', null, h('col', { style: 'width:6%' }), h('col', { style: 'width:42%' }), h('col', { style: 'width:19%' }), h('col', { style: 'width:19%' }), h('col', { style: 'width:14%' })),
          h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Frage'), h('th', null, 'Deine Antwort'), h('th', null, 'Lösung'), h('th', { class: 'p-mr-pts' }, 'Punkte'))),
          h('tbody', null, rows)
        ),
        h('div', { class: 'p-mr-legend' }, Object.values(MOODLE_MARK).map(([sym, label]) => h('span', null, h('b', null, sym), ' ', label))),
        h(
          'div',
          { class: 'p-mr-foot' },
          withGrade && res.p !== null
            ? h(
                'div',
                { class: 'p-mr-grade' },
                h('span', null, 'Note'),
                h('strong', null, level === 'mss' ? `${G.label(res.p, level)} Punkte` : G.label(res.p, level)),
                h('em', null, G.gradeWord(res.p) + (level === 'mss' ? ` (${G.wholeGrade(res.p)}${G.tendency(res.p)})` : ''))
              )
            : null,
          h('div', { class: 'p-mr-sign' }, h('div', null, h('div', { class: 'p-mr-line' }), 'Datum'), h('div', null, h('div', { class: 'p-mr-line' }), 'Unterschrift Lehrkraft'))
        )
      );
    });
    doPrint(`${a.name} – Moodle-Rückmeldung`, h('div', null, pages));
  }

  // ---------- Trennblätter für OrdoScripto ----------

  /** Je Person eine A4-Seite: Name und Klasse groß, Test, QR-Code „ORDO|<testId>|<schuelerId>“ (6 cm) mit den IDs darunter. */
  function scripto(course, a, { onlyMakeup = false } = {}) {
    const S = NM.scripto;
    const d = S.dataOf(course, a);
    const o = S.owner(course, a);
    const pages = S.sheetStudents(course, a, { onlyMakeup }).map((s) => {
      const sid = d.ids[s.id];
      // Der Code selbst 60 mm breit, die Ruhezone (4 Module je Seite) kommt dazu
      const code = NM.qr.encode(S.qrText(d.testId, sid));
      const mm = ((60 * (code.size + 8)) / code.size).toFixed(1) + 'mm';
      const qr = h('div', { class: 'p-sc-qr', style: `width:${mm};height:${mm}` });
      qr.innerHTML = NM.qr.svg(code, { width: mm, title: S.qrText(d.testId, sid) });
      return h(
        'div',
        { class: 'p-page p-break p-sc', 'data-scripto-sheet': sid },
        header(course, o.name, null, { kicker: 'Trennblatt · OrdoScripto', half: o.half, date: a.date, dateLabel: a !== o ? 'Nachschreibtermin' : 'Datum' }),
        h('div', { class: 'p-sc-name' }, [s.first, s.last].filter(Boolean).join(' ')),
        h('div', { class: 'p-sc-class' }, M.courseTitle(course)),
        qr,
        h('div', { class: 'p-sc-ids' }, d.testId, h('span', null, ' · '), sid),
        h('div', { class: 'p-sc-hint' }, 'Trennblatt – vor die Arbeit des Schülers legen')
      );
    });
    doPrint(`${o.name} – Trennblätter`, h('div', null, pages));
  }

  // ---------- Präsentationen ----------

  const LEVELS = [0, 1, 2, 3];

  function presMeta(course, a) {
    const p = a.pres;
    const max = G.presResult(p, '', G.courseLevel(course)).max;
    return [fmtDate(a.date), UI.catLabel(a.cat), `${p.criteria.length} Kriterien je 0–3 Punkte`, `Höchstpunktzahl ${fmtScore(max)}`, `LIMIT ${fmtScore(p.limit)} %`, G.wholeOnly(p, G.courseLevel(course)) ? 'nur ganze Noten' : null].filter(Boolean).join(' · ');
  }

  /** mode: 'list' | 'key' | 'blank' | 'sheets' ({ sid, withGrade }) */
  function pres(course, a, mode, { sid = null, withGrade = true } = {}) {
    const level = G.courseLevel(course);
    const p = a.pres;
    const students = M.activeStudents(course);
    const st = G.presStats(p, M.statStudents(course).map((s) => s.id), level);
    const key = G.keyForPres(p, level);
    if (mode === 'key') {
      return doPrint(`${a.name} – Notenschlüssel`, h('div', { class: 'p-page' }, header(course, a.name, presMeta(course, a), { half: a.half, date: a.date }), h('div', { class: 'p-cols' }, h('div', null, h('h2', null, 'Notenschlüssel'), keyTableFor(key, st, level)), h('div', null, h('h2', null, 'Notenspiegel'), statsBlockFor(course, st, level)))));
    }
    if (mode === 'list') {
      // Bei Gruppen nach Gruppen geordnet (innerhalb alphabetisch), Personen ohne Gruppe am Ende
      const order = p.groupMode ? (p.groups || []).map((g) => g.id) : [];
      const rank = (s) => {
        const g = G.presGroupOf(p, s.id);
        return g ? order.indexOf(g.id) : order.length;
      };
      const listed = p.groupMode ? students.slice().sort((x, y) => rank(x) - rank(y)) : students;
      const rows = listed.map((s, i) => {
        const r = p.results[s.id] || {};
        const res = G.presResult(p, s.id, level);
        const sc = G.presScores(p, s.id);
        const g = G.presGroupOf(p, s.id);
        return h(
          'tr',
          { class: p.groupMode && i > 0 && rank(listed[i - 1]) !== rank(s) ? 'p-group-start' : null },
          h('td', { class: 'n' }, i + 1),
          h('td', null, pname(s)),
          p.groupMode ? h('td', null, g ? g.name : '–') : null,
          h('td', null, G.presTopic(p, s.id)),
          p.criteria.map((c) => h('td', { class: 'n' }, fmtScore(sc[c.id]), G.presDeviation(p, s.id, c) ? h('sup', { title: 'abweichend von der Gruppe' }, '◆') : null)),
          h('td', { class: 'n' }, res.score === null ? '' : fmtScore(res.score)),
          h('td', { class: 'n' }, res.score === null || !res.max ? '' : fmtNum((res.score / res.max) * 100, 0)),
          h('td', { class: 'c' + (r.status === 'ungewertet' ? ' p-ungraded' : '') }, res.p === null ? UI.STATUS_SHORT[r.status] || '' : badge(res.p, level))
        );
      });
      return doPrint(
        `${a.name} – Bewertungsliste`,
        h(
          'div',
          { class: 'p-page' },
          header(course, a.name, presMeta(course, a), { half: a.half, date: a.date }),
          h(
            'table',
            { class: 'p-table p-full' },
            h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), p.groupMode ? h('th', null, 'Gruppe') : null, h('th', null, 'Thema'), p.criteria.map((c) => h('th', null, c.name, h('br'), h('small', null, '0–3' + (G.critWeight(c) !== 1 ? ' ×' + G.critWeight(c) : '') + (p.groupMode ? (G.presCritIsGroup(p, c) ? ' · Gruppe' : ' · Person') : '')))), h('th', null, 'Σ'), h('th', null, '%'), h('th', null, 'Note'))),
            h('tbody', null, rows)
          ),
          p.groupMode && p.criteria.some((c) => G.presCritIsGroup(p, c)) ? h('p', { class: 'p-note' }, '◆ = abweichend vom Gruppenwert bewertet') : null,
          h('div', { class: 'p-cols' }, h('div', null, statsBlockFor(course, st, level)), h('div', null, keyTableFor(key, st, level, false)))
        ),
        { landscape: p.criteria.length > 6 || (p.groupMode && p.criteria.length > 5) }
      );
    }
    // Bewertungsbogen: leer zum Ankreuzen oder ausgefüllt je Person
    const blank = mode === 'blank';
    const list = blank ? students : students.filter((s) => (!sid || s.id === sid) && G.presResult(p, s.id, level).score !== null);
    const pages = list.map((s) => {
      const r = blank ? {} : p.results[s.id] || {};
      const res = blank ? null : G.presResult(p, s.id, level);
      const g = G.presGroupOf(p, s.id);
      const sc = blank ? {} : G.presScores(p, s.id);
      const topic = blank ? '' : G.presTopic(p, s.id);
      const date = r.date || (g && g.date);
      const note = blank ? '' : [g && g.note, r.note].filter(Boolean).join(' – ');
      const rows = p.criteria.map((c) => {
        const v = sc[c.id];
        const has = v !== undefined && v !== null && v !== '';
        return h(
          'tr',
          null,
          h('td', { class: 'p-pres-crit' }, h('strong', null, c.name), G.critWeight(c) !== 1 ? h('small', null, ` (×${G.critWeight(c)})`) : null, c.group || p.groupMode ? h('div', { class: 'p-pres-group' }, [c.group, p.groupMode ? (G.presCritIsGroup(p, c) ? 'für die Gruppe' : 'je Person') : null].filter(Boolean).join(' · ')) : null),
          LEVELS.map((n) => h('td', { class: 'p-pres-lvl' + (has && Number(v) === n ? ' on' : '') }, h('span', { class: 'p-pres-box' }, has && Number(v) === n ? '✕' : ''), h('span', { class: 'p-pres-n' }, n), h('div', { class: 'p-pres-desc' }, (c.desc || {})[n] || ''))),
          h('td', { class: 'p-pres-pts' }, has ? `${fmtScore(v * G.critWeight(c))} / ${fmtScore(3 * G.critWeight(c))}` : `__ / ${fmtScore(3 * G.critWeight(c))}`)
        );
      });
      const pct = res && res.score !== null && res.max ? (res.score / res.max) * 100 : null;
      return h(
        'div',
        { class: 'p-page p-break p-mr p-pres' },
        header(course, a.name, null, {
          kicker: 'Bewertung der Präsentation',
          person: [s.first, s.last].filter(Boolean).join(' '),
          half: a.half,
          extra: [g ? g.name : null, blank && !date ? 'Datum __________' : null],
          date: date || a.date,
          showDate: !(blank && !date),
        }),
        h('div', { class: 'p-pres-topic' }, 'Thema: ', blank ? h('span', { class: 'p-mr-line p-inline-line' }) : h('strong', null, topic || '–')),
        h(
          'table',
          { class: 'p-pres-table' },
          h('colgroup', null, h('col', { style: 'width:22%' }), LEVELS.map(() => h('col', { style: 'width:17%' })), h('col', { style: 'width:10%' })),
          h('thead', null, h('tr', null, h('th', null, 'Kriterium'), LEVELS.map((n) => h('th', null, `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`)), h('th', null, 'Punkte'))),
          h('tbody', null, rows)
        ),
        blank
          ? h('div', { class: 'p-mr-summary' }, h('div', { class: 'p-mr-tile' }, h('span', null, 'Summe'), h('strong', null, `____ / ${fmtScore(G.presResult(p, '', level).max)}`)), h('div', { class: 'p-mr-tile' }, h('span', null, 'Note'), h('strong', null, '____')))
          : h(
              'div',
              { class: 'p-mr-summary' },
              h('div', { class: 'p-mr-tile' }, h('span', null, 'Punkte'), h('strong', null, `${fmtScore(res.score)} / ${fmtScore(res.max)}`)),
              pct === null ? null : h('div', { class: 'p-mr-tile' }, h('span', null, 'Prozent'), h('strong', null, fmtNum(pct, 1) + ' %')),
              pct === null ? null : h('div', { class: 'p-mr-bar' }, h('div', { style: `width:${Math.max(0, Math.min(100, pct))}%` }))
            ),
        h('div', { class: 'p-pres-note' }, h('span', null, 'Bemerkung'), blank ? h('div', { class: 'p-pres-lines' }) : h('p', null, note || '–')),
        h(
          'div',
          { class: 'p-mr-foot' },
          !blank && withGrade && res.p !== null
            ? h('div', { class: 'p-mr-grade' }, h('span', null, 'Note'), h('strong', null, level === 'mss' ? `${G.label(res.p, level)} Punkte` : G.label(res.p, level)), h('em', null, G.gradeWord(res.p) + (level === 'mss' ? ` (${G.wholeGrade(res.p)}${G.tendency(res.p)})` : '')))
            : null,
          h('div', { class: 'p-mr-sign' }, h('div', null, h('div', { class: 'p-mr-line' }), 'Datum'), h('div', null, h('div', { class: 'p-mr-line' }), 'Unterschrift Lehrkraft'))
        )
      );
    });
    doPrint(`${a.name} – ${blank ? 'Leere Bewertungsbögen' : 'Bewertungsbögen'}`, h('div', null, pages));
  }

  /**
   * Handreichung für Schülerinnen und Schüler: Kriterien mit Beschreibung jeder Stufe, Gewicht und Höchstpunkten,
   * ohne Namen; key (optional): Notenschlüssel der Bewertung.
   */
  function presGuide({ title, course = null, criteria, key = null, level = 'sek1', groupMode = null }) {
    const scope = (c) => (groupMode ? (G.presCritIsGroup({ groupMode }, c) ? 'für die Gruppe' : 'für jede Person einzeln') : null);
    const max = criteria.reduce((s, c) => s + 3 * G.critWeight(c), 0);
    const rows = criteria.map((c) =>
      h(
        'tr',
        null,
        h('td', { class: 'p-pres-crit' }, h('strong', null, c.name), c.group || groupMode ? h('div', { class: 'p-pres-group' }, [c.group, scope(c)].filter(Boolean).join(' · ')) : null),
        LEVELS.map((n) => h('td', { class: 'p-pres-lvl' }, h('span', { class: 'p-pres-n' }, `${n * G.critWeight(c)} P.`), h('div', { class: 'p-pres-desc' }, (c.desc || {})[n] || ''))),
        h('td', { class: 'p-pres-pts' }, G.critWeight(c) !== 1 ? `×${G.critWeight(c)}` : '', h('div', null, `max. ${fmtScore(3 * G.critWeight(c))}`))
      )
    );
    const keyRows = key
      ? key
          .slice()
          .reverse()
          .filter((k) => k.p > 0)
          .map((k) => h('td', null, h('div', null, h('strong', null, G.label(k.p, level))), h('div', null, 'ab ' + fmtScore(k.min))))
      : null;
    doPrint(
      `${title} – Bewertungskriterien`,
      h(
        'div',
        { class: 'p-page p-mr p-pres p-guide' },
        header(course, title, null, { kicker: 'Bewertungskriterien', person: 'So wird deine Präsentation bewertet' }),
        h('p', { class: 'p-guide-intro' }, `Für jedes Kriterium gibt es 0 bis 3 Punkte; die Beschreibung zeigt, was für die jeweilige Stufe erwartet wird. Kriterien mit Gewicht (z. B. ×2) zählen mehrfach. Insgesamt sind ${fmtScore(max)} Punkte möglich.` + (groupMode ? ' Gruppenkriterien werden einmal für die ganze Gruppe bewertet und gelten für alle Mitglieder; bei deutlichen Unterschieden kann eine Person abweichend bewertet werden. Jede Person bekommt eine eigene Note.' : '')),
        h(
          'table',
          { class: 'p-pres-table' },
          h('colgroup', null, h('col', { style: 'width:22%' }), LEVELS.map(() => h('col', { style: 'width:17%' })), h('col', { style: 'width:10%' })),
          h('thead', null, h('tr', null, h('th', null, 'Kriterium'), LEVELS.map((n) => h('th', null, `Stufe ${n}`)), h('th', null, 'Gewicht'))),
          h('tbody', null, rows)
        ),
        key ? h('div', { class: 'p-guide-key' }, h('h2', null, 'Notenschlüssel'), h('table', { class: 'p-table' }, h('tr', null, keyRows))) : null
      ),
      { landscape: false }
    );
  }

  // ---------- Gruppen ----------

  /** Gruppeneinteilung: 'list' (alle Gruppen auf einer Seite) | 'cards' (je Gruppe eine Karte zum Ausschneiden). Ohne Noten und Regeln. */
  function groups(course, set, mode, tiles) {
    const cards = mode === 'cards';
    doPrint(
      `${set.name} – ${cards ? 'Gruppenkarten' : 'Gruppeneinteilung'}`,
      h('div', { class: 'p-page' }, cards ? null : header(course, set.name, `${tiles.length} Gruppen`, { date: set.date || null }), h('div', { class: cards ? 'p-grp-cards' : 'p-grp-grid' }, tiles))
    );
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
      `${a.name} – Bewertungsliste`,
      h(
        'div',
        { class: 'p-page' },
        header(course, a.name, `Mitarbeit · ${lessons.length} Stunden`, { half: a.half }),
        h(
          'table',
          { class: 'p-table p-full p-epo' },
          h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), lessons.map((l) => h('th', null, NM.util.fmtDateShort(l.date))), h('th', null, 'Pkt.'), h('th', null, '%'), h('th', null, 'Note'))),
          h('tbody', null, rows)
        ),
        h('p', { class: 'p-note' }, '++ / + / 0 / - / -- = Bewertung der Stunde · k = abwesend · u = Hausaufgaben unvollständig · h = Hausaufgaben vergessen · m = Material vergessen')
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
    const legend = [...G.EPO_RATINGS.map((k) => `${k} = ${fmtScore(pts[k])}`), 'k = abwesend', `u = HA unvollständig (${signed(pts.u)})`, `h = HA vergessen (${signed(pts.h)})`, `m = Material vergessen${pts.m ? ` (${signed(pts.m)})` : ''}`].join(' · ');
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
        header(course, a.name, period, { compact: true, person: M.studentName(s) }),
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
          `abwesend: ${res.absent} · HA unvollständig: ${res.u} · HA vergessen: ${res.h} · Material vergessen: ${res.m}`,
          res.p === null ? null : [' · Note ', h('strong', { class: 'p-big' }, G.label(res.p, level))]
        ),
        h('div', { class: 'p-sign' }, h('span', null, 'Datum'), h('span', null, 'Unterschrift'))
      );
    });
    doPrint(`${a.name} – Mitarbeitszettel`, h('div', { class: 'p-slips' }, slips));
  }

  // ---------- Sitzplan ----------

  function seating(c) {
    const { st, students, cells } = NM.views.seating.layout(c);
    const names = NM.views.seating.cardNames(students);
    // Umschalter im Sitzplan gilt auch für den Druck; mit Fotos bekommt jede Karte ein Bild (ohne Foto das Personensymbol)
    const withPhotos = !NM.app.state.ui.seatHidePhotos && Object.keys(cells).length > 0;
    const pic = (s) => (s.photo ? h('img', { src: s.photo, alt: '' }) : h('img', { class: 'p-seat-icon', src: M.PERSON_ICON, alt: '' }));
    const desk = h('div', { class: 'p-seat-desk' }, 'Lehrerpult');
    const rows = [];
    for (let y = 0; y < st.rows; y++) {
      const tr = h('tr');
      for (let x = 0; x < st.cols; x++) {
        const sid = cells[x + ',' + y];
        const s = sid && students.find((p) => p.id === sid);
        tr.appendChild(h('td', { class: sid ? 'p-seat' : 'p-seat empty' }, s && withPhotos ? pic(s) : null, sid ? names[sid] : ''));
      }
      rows.push(tr);
    }
    doPrint(
      `${M.courseTitle(c)} – Sitzplan`,
      h('div', { class: 'p-page' }, header(c, 'Sitzplan', st.name), st.desk === 'top' ? desk : null, h('table', { class: 'p-seat-grid' + (withPhotos ? ' with-photos' : '') }, h('tbody', null, rows)), st.desk === 'bottom' ? desk : null),
      { landscape: st.cols > st.rows }
    );
  }

  /** Fehlzeiten eines Halbjahres (seit 1.45): Tage als Spalten mit A/E/U, Summen je Person. */
  function attendance(c, half) {
    const A = NM.attendance;
    const days = A.dates(c, half);
    const PER = 20; // Tage je Tabelle, damit A4 quer reicht
    const chunks = [];
    for (let i = 0; i < days.length; i += PER) chunks.push(days.slice(i, i + PER));
    if (!chunks.length) chunks.push([]);
    const students = M.activeStudents(c);
    const mark = { a: 'A', e: 'E', u: 'U' };
    const tables = chunks.map((ds, ci) =>
      h(
        'table',
        { class: 'p-table p-full p-att' },
        h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Name'), ds.map((d) => h('th', null, NM.util.fmtDateShort(d), A.hoursOf(c.attendance[d]) > 1 ? ` (${A.hoursOf(c.attendance[d])})` : '')), ci === chunks.length - 1 ? [h('th', null, 'Σ'), h('th', null, 'E'), h('th', null, 'U'), h('th', null, 'offen')] : null)),
        h(
          'tbody',
          null,
          students.map((s, i) => {
            const t = A.totals(c, half, s.id);
            return h(
              'tr',
              null,
              h('td', { class: 'n' }, i + 1),
              h('td', null, pname(s)),
              ds.map((d) => h('td', { class: 'c' }, mark[A.get(c, d, s.id)] || '')),
              ci === chunks.length - 1 ? [h('td', { class: 'n' }, t.hours || ''), h('td', { class: 'n' }, t.e || ''), h('td', { class: 'n' }, t.u || ''), h('td', { class: 'n' }, t.a || '')] : null
            );
          })
        )
      )
    );
    doPrint(
      `${M.courseTitle(c)} – Fehlzeiten ${half}`,
      h('div', { class: 'p-page' }, header(c, 'Fehlzeiten', `${days.length} Unterrichtstage`, { half }), tables, h('p', { class: 'p-note' }, 'A = abwesend, Entschuldigung offen · E = entschuldigt · U = unentschuldigt · Zahl in Klammern = Unterrichtsstunden an dem Tag; Summen in Unterrichtsstunden')),
      { landscape: days.length > 8 }
    );
  }

  /** Datum einer Spalte; bei der Sammelspalte eines Ziehen-Pools der Zeitraum der Ziehungen. */
  function drawDate(course, a) {
    const p = NM.draw.poolOfColumn(course, a.id);
    const r = p && NM.draw.poolRange(p);
    if (!r) return NM.util.fmtDateShort(a.date);
    return r[0] === r[1] ? NM.util.fmtDateShort(r[0]) : NM.util.fmtDateShort(r[0]) + '–' + NM.util.fmtDateShort(r[1]);
  }

  // ---------- Notenliste ----------

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
    const list = c.assessments.filter((a) => a.half === half && !G.isMakeup(c, a));
    const ka = list.filter((a) => a.cat === 'ka').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const other = list.filter((a) => a.cat === 'other').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const showKa = Number(c.wKa) > 0 || ka.length > 0;
    const th = (a) => h('th', { class: a.ungraded ? 'p-ungraded' : null }, a.name, h('br'), h('small', null, [drawDate(c, a), Number(a.weight) !== 1 ? '×' + fmtScore(a.weight) : '', a.ungraded ? 'nicht gewertet' : ''].filter(Boolean).join(' ')));
    const rows = students.map((s, i) => {
      const r = G.halfResult(c, half, s.id);
      const cell = (a) => h('td', { class: 'c' + (G.ungradedFor(a, s.id, c) ? ' p-ungraded' : '') }, badge(G.assessmentPoints(a, s.id, level, c), level), G.countingFor(c, a, s.id) !== a ? h('sup', null, 'N') : null);
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
        header(c, 'Notenliste ' + half, `Klassen-/Kursarbeiten ${fmtNum(c.wKa, 0)} % · Sonstige ${fmtNum(c.wOther, 0)} %`, { half }),
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
        h('p', { class: 'p-note' }, '* = gesetzte Note weicht von der gerechneten ab' + ([...ka, ...other].some((a) => G.makeupsOf(c, a).length) ? ' · N = nachgeschrieben' : ''))
      ),
      { landscape: ka.length + other.length > 8 }
    );
  }

  // ---------- Leistungsbögen ----------

  const SHEET_OPTS = [
    ['grades', 'Einzelnoten mit Datum und Gewicht', true],
    ['averages', 'Schnitte (Klassenarbeiten / Sonstige)', true],
    ['final', 'Halbjahres- und Jahresnote (gerechnet und gesetzt)', true],
    ['tests', 'Test-Details je Aufgabe', true],
    ['pres', 'Präsentationen je Kriterium (mit Bemerkung)', true],
    ['epo', 'EPO-Zusammenfassung (Bewertungen, Hausaufgaben, Material, Fehlstunden)', true],
    ['absence', 'Fehlzeiten (Fehlstunden, entschuldigt, unentschuldigt)', true],
    ['comment', 'Bemerkung', true],
  ];

  async function studentsDialog(c) {
    const students = M.activeStudents(c);
    const who = h('select', { class: 'input' }, h('option', { value: '' }, `Alle (${students.length})`), students.map((s) => h('option', { value: s.id }, M.studentName(s))));
    const halves = G.halvesFor(c);
    const halfSel = h('select', { class: 'input' }, h('option', { value: '' }, 'Alle Halbjahre'), halves.map((x) => h('option', { value: x }, x)));
    const boxes = SHEET_OPTS.map(([k, label, def]) => [k, h('input', { type: 'checkbox', checked: def })]);
    const v = await modal({
      title: 'Leistungsbögen drucken',
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
    doPrint(`${M.courseTitle(c)} – Leistungsbögen`, h('div', null, list.map((s) => studentSheet(c, s, hs, opts))));
  }

  function studentSheet(c, s, halves, o) {
    const level = G.courseLevel(c);
    const sections = halves.map((half) => {
      const list = c.assessments.filter((a) => a.half === half && !G.isMakeup(c, a)).sort((a, b) => (a.cat === b.cat ? (a.date || '').localeCompare(b.date || '') : a.cat === 'ka' ? -1 : 1));
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
                    const p = G.assessmentPoints(a, s.id, level, c);
                    const status = G.assessmentStatus(a, s.id, c);
                    const src = G.countingFor(c, a, s.id);
                    return h('tr', null, h('td', null, fmtDate(src.date)), h('td', null, a.name, a.kind !== 'manual' ? h('small', null, ' (' + M.kindLabel(a) + ')') : null, src !== a ? h('small', null, ' – nachgeschrieben') : null, G.ungradedFor(a, s.id, c) ? h('small', null, ' – nicht gewertet') : null), h('td', null, UI.catLabel(a.cat)), h('td', { class: 'n' }, fmtScore(a.weight)), h('td', { class: 'c' }, p === null ? UI.STATUS_SHORT[status] || '–' : badge(p, level)));
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
              taskTable(t, res, tr, ''),
              partGrades(t, tr, level) ? h('p', { class: 'p-note' }, 'Teilnoten: ', partGrades(t, tr, level)) : null
            )
          );
        }
      }
      if (o.pres) {
        for (const a of list.filter((x) => x.kind === 'pres')) {
          const r = a.pres.results[s.id] || {};
          const pr = G.presResult(a.pres, s.id, level);
          if (pr.score === null) continue;
          const sc = G.presScores(a.pres, s.id);
          const topic = G.presTopic(a.pres, s.id);
          parts.push(
            h(
              'div',
              { class: 'p-detail' },
              h('h3', null, a.name, topic ? ` – „${topic}“` : '', ' – Punkte je Kriterium'),
              h(
                'table',
                { class: 'p-table' },
                a.pres.criteria.map((c) => {
                  const v = sc[c.id];
                  const has = v !== undefined && v !== null && v !== '';
                  return h('tr', null, h('td', null, c.name), h('td', { class: 'n' }, has ? `${fmtScore(v * G.critWeight(c))} / ${fmtScore(3 * G.critWeight(c))}` : '–'), h('td', null, has ? (c.desc || {})[v] || '' : ''));
                }),
                h('tr', null, h('th', null, 'Summe'), h('td', { class: 'n' }, `${fmtScore(pr.score)} / ${fmtScore(pr.max)}`), h('td', null, badge(pr.p, level)))
              ),
              r.note ? h('p', { class: 'p-note' }, 'Bemerkung: ', r.note) : null
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
                ` · abwesend: ${r2.absent} · HA unvollständig: ${r2.u} · HA vergessen: ${r2.h} · Material vergessen: ${r2.m}`,
                r2.pct !== null ? ` · ${r2.sum}/${r2.max} Punkte (${fmtNum(r2.pct, 0)} %) → ` : ' · ',
                badge(r2.p, level)
              )
            )
          );
        }
      }
      if (o.absence && NM.attendance.hasData(c, half)) {
        const t = NM.attendance.totals(c, half, s.id);
        parts.push(h('p', { class: 'p-detail' }, h('strong', null, 'Fehlzeiten: '), t.hours ? `${t.hours} Unterrichtsstunden an ${t.days} ${t.days === 1 ? 'Tag' : 'Tagen'} · entschuldigt ${t.e} · unentschuldigt ${t.u}${t.a ? ` · Entschuldigung offen ${t.a}` : ''}` : 'keine'));
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

  NM.print = { test, moodle, scripto, pres, presGuide, groups, epo, epoSlips, seating, attendance, course, studentsDialog };
})((globalThis.NM = globalThis.NM || {}));
