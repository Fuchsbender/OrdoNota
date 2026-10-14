/* Notenmanager – Reiter „Tests“: Rohpunkte erfassen, Notenschlüssel, Notenspiegel. */
(function (NM) {
  'use strict';
  const { h, toast, confirmDialog, parseNum, uid, fmtNum, fmtScore, fmtDate, gradeStyle } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  function render(view, { course, db }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course);
    const tests = course.assessments.filter((a) => a.kind === 'test' && a.half === half);
    const ui = NM.app.state.ui;
    let cur = tests.find((t) => t.id === ui.testId[course.id]) || tests[tests.length - 1] || null;

    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Tests'), UI.halfSwitch(course, false)),
      UI.pickerList({
        items: tests,
        currentId: cur && cur.id,
        onPick: (id) => {
          ui.testId[course.id] = id;
          NM.app.saveUi();
          NM.app.rerender();
        },
        onAdd: () => {
          const t = M.newTest(course, half, db.settings);
          course.assessments.push(t);
          ui.testId[course.id] = t.id;
          NM.app.saveUi();
          NM.app.commit();
        },
        addLabel: '+ Neuer Test',
        sub: (a) => {
          const st = G.testStats(a.test, M.activeStudents(course).map((s) => s.id), level);
          return [fmtDate(a.date), UI.catLabel(a.cat), st.n ? 'Ø ' + fmtNum(level === 'mss' ? st.avgPoints : st.avgDec, 2) : null].filter(Boolean).join(' · ');
        },
      })
    );
    if (!cur) {
      view.appendChild(UI.emptyState('Noch kein Test in ' + half, 'Legen Sie einen Test an: Aufgaben mit Höchstpunktzahlen festlegen, Rohpunkte eintragen – Note, Notenspiegel und Drittelparagraph werden automatisch berechnet.'));
      return;
    }
    view.append(metaCard(course, cur, level), tasksCard(cur), h('div', { class: 'test-layout' }, resultsCard(course, cur, level), keyCard(course, cur, level)));
  }

  function metaCard(course, a, level) {
    const t = a.test;
    const set = (fn) => (e) => {
      fn(e.target.value);
      NM.app.commit();
    };
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'form-row' },
        h('label', { class: 'field grow' }, h('span', null, 'Bezeichnung'), h('input', { class: 'input', value: a.name, 'data-focus-key': 'test-name', onchange: set((v) => (a.name = v.trim() || a.name)) })),
        h('label', { class: 'field' }, h('span', null, 'Datum'), h('input', { class: 'input', type: 'date', value: a.date, onchange: set((v) => (a.date = v)) })),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Bereich'),
          h(
            'select',
            { class: 'input', onchange: set((v) => (a.cat = v)) },
            h('option', { value: 'ka', selected: a.cat === 'ka' }, 'Klassen-/Kursarbeit'),
            h('option', { value: 'other', selected: a.cat === 'other' }, 'Sonstige (z. B. HÜ)')
          )
        ),
        h(
          'label',
          { class: 'field narrow' },
          h('span', null, 'Gewicht'),
          h('input', {
            class: 'input',
            type: 'number',
            min: 0,
            step: 0.5,
            value: a.weight,
            onchange: (e) => {
              const v = parseNum(e.target.value);
              if (v === null || v === undefined || v < 0) return toast('Ungültiges Gewicht.', 'error');
              a.weight = v;
              NM.app.commit();
            },
          })
        ),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Punkte-Genauigkeit'),
          h(
            'select',
            { class: 'input', onchange: set((v) => (t.precision = Number(v))) },
            [
              [1, 'Ganze Punkte'],
              [0.5, 'Halbe Punkte'],
              [0.1, 'Zehntel'],
            ].map(([v, l]) => h('option', { value: v, selected: Number(t.precision) === v }, l))
          )
        ),
        h(
          'label',
          { class: 'field narrow', title: level === 'mss' ? 'Ab diesem Prozentsatz gibt es 4 Punkte (4-)' : 'Ab diesem Prozentsatz gibt es eine 4-' },
          h('span', null, level === 'mss' ? 'LIMIT 04 P. (%)' : 'LIMIT 4- (%)'),
          h('input', {
            class: 'input',
            type: 'number',
            min: 20,
            max: 80,
            step: 1,
            value: t.limit,
            onchange: (e) => {
              const v = parseNum(e.target.value);
              if (!(v >= 20 && v <= 80)) return toast('LIMIT bitte zwischen 20 und 80 %.', 'error');
              t.limit = v;
              NM.app.commit();
            },
          })
        ),
        h(
          'div',
          { class: 'field actions-end' },
          h('span', null, ' '),
          h(
            'div',
            { class: 'inline' },
            h('button', { class: 'btn', onclick: () => NM.print.test(course, a, 'key') }, '🖨 Schlüssel'),
            h('button', { class: 'btn', onclick: () => NM.print.test(course, a, 'list') }, '🖨 Liste'),
            h('button', { class: 'btn', onclick: () => NM.print.test(course, a, 'students') }, '🖨 Schülerzettel'),
            h(
              'button',
              {
                class: 'icon-btn danger',
                title: 'Test löschen',
                'aria-label': 'Test löschen',
                onclick: async () => {
                  if (!(await confirmDialog('Test löschen?', `„${a.name}“ mit allen Ergebnissen löschen?`, { okLabel: 'Löschen', danger: true }))) return;
                  course.assessments = course.assessments.filter((x) => x.id !== a.id);
                  NM.app.commit();
                },
              },
              '🗑'
            )
          )
        )
      )
    );
  }

  function tasksCard(a) {
    const t = a.test;
    const max = G.testMaxScore(t);
    const bonusMax = t.tasks.filter((x) => x.bonus).reduce((s, x) => s + (Number(x.max) || 0), 0);
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Aufgaben'), h('span', { class: 'muted' }, `Höchstpunktzahl ${fmtScore(max)}`, bonusMax ? ` + ${fmtScore(bonusMax)} Bonus` : '')),
      h(
        'div',
        { class: 'tasks' },
        t.tasks.map((task, i) =>
          h(
            'div',
            { class: 'task' + (task.bonus ? ' bonus' : '') },
            h('input', {
              class: 'input input-sm task-name',
              value: task.name,
              title: 'Bezeichnung',
              'data-focus-key': `task-name-${task.id}`,
              onchange: (e) => {
                task.name = e.target.value.trim();
                NM.app.commit();
              },
            }),
            h('input', {
              class: 'input input-sm task-max',
              value: fmtScore(task.max),
              title: 'Höchstpunktzahl',
              inputmode: 'decimal',
              'data-focus-key': `task-max-${task.id}`,
              onchange: (e) => {
                const v = parseNum(e.target.value);
                if (!(v >= 0)) return toast('Ungültige Punktzahl.', 'error');
                task.max = v;
                NM.app.commit();
              },
            }),
            h(
              'label',
              { class: 'task-bonus', title: 'Bonus: zählt zur erreichten Punktzahl, nicht zur Höchstpunktzahl' },
              h('input', {
                type: 'checkbox',
                checked: !!task.bonus,
                onchange: (e) => {
                  task.bonus = e.target.checked;
                  NM.app.commit();
                },
              }),
              'Bonus'
            ),
            h(
              'button',
              {
                class: 'icon-btn',
                title: 'Aufgabe entfernen',
                'aria-label': 'Aufgabe entfernen',
                onclick: async () => {
                  const used = Object.values(t.results).some((r) => r.scores && r.scores[task.id] !== undefined && r.scores[task.id] !== null && r.scores[task.id] !== '');
                  if (used && !(await confirmDialog('Aufgabe entfernen?', 'Für diese Aufgabe sind schon Punkte eingetragen. Sie werden gelöscht.', { okLabel: 'Entfernen', danger: true }))) return;
                  t.tasks.splice(i, 1);
                  for (const r of Object.values(t.results)) if (r.scores) delete r.scores[task.id];
                  NM.app.commit();
                },
              },
              '✕'
            )
          )
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost',
            onclick: () => {
              t.tasks.push({ id: uid(), name: String(t.tasks.filter((x) => !x.bonus).length + 1), max: 5 });
              NM.app.commit();
            },
          },
          '+ Aufgabe'
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost',
            onclick: () => {
              t.tasks.push({ id: uid(), name: 'Bonus', max: 2, bonus: true });
              NM.app.commit();
            },
          },
          '+ Bonusaufgabe'
        )
      )
    );
  }

  function resultsCard(course, a, level) {
    const t = a.test;
    const students = M.activeStudents(course);
    const max = G.testMaxScore(t);
    const head = h(
      'tr',
      null,
      h('th', { class: 'sticky-col' }, 'Name'),
      t.tasks.map((task) => h('th', { class: 'num' + (task.bonus ? ' bonus' : '') }, h('span', { class: 'col-head' }, h('span', { class: 'col-name' }, task.name || '–'), h('span', { class: 'col-sub' }, fmtScore(task.max) + (task.bonus ? ' B' : ''))))),
      h('th', { class: 'num' }, 'Σ'),
      h('th', { class: 'num' }, '%'),
      h('th', { class: 'center' }, 'Note'),
      h('th', null, 'Status')
    );
    const rows = students.map((s, ri) => {
      const r = (t.results[s.id] = t.results[s.id] || { scores: {} });
      r.scores = r.scores || {};
      const res = G.testResult(t, s.id, level);
      const blocked = r.status === 'fehlt' || r.status === 'nachschreiben' || r.status === 'taeuschung';
      return h(
        'tr',
        { class: blocked ? 'row-muted' : '' },
        h('td', { class: 'sticky-col name-cell' }, M.studentName(s)),
        t.tasks.map((task, ci) =>
          h(
            'td',
            { class: 'num' },
            UI.numberInput({
              value: r.scores[task.id],
              grid: 'test-' + a.id,
              row: ri,
              col: ci,
              key: `ts-${s.id}-${task.id}`,
              max: task.max,
              cls: task.bonus ? 'bonus' : '',
              onSet: (v) => {
                if (v === null) delete r.scores[task.id];
                else r.scores[task.id] = v;
                NM.app.commit();
              },
            })
          )
        ),
        h('td', { class: 'num strong' }, res.score === null ? '' : fmtScore(res.score)),
        h('td', { class: 'num muted' }, res.score === null || !max ? '' : fmtNum((res.score / max) * 100, 0)),
        h('td', { class: 'center' }, res.p === null ? (r.status ? h('span', { class: 'muted small' }, UI.STATUS_SHORT[r.status]) : '') : UI.gradeBadge(res.p, level)),
        h(
          'td',
          null,
          UI.statusSelect(r.status, (v) => {
            r.status = v;
            NM.app.commit();
          }, `ts-status-${s.id}`)
        )
      );
    });
    // Aufgabenschnitt
    const avgRow = h(
      'tr',
      { class: 'foot' },
      h('td', { class: 'sticky-col' }, 'Ø gelöst'),
      t.tasks.map((task) => {
        const vals = students.map((s) => (t.results[s.id] && t.results[s.id].scores ? t.results[s.id].scores[task.id] : null)).filter((v) => v !== null && v !== undefined && v !== '');
        const avg = vals.length ? vals.reduce((x, y) => x + Number(y), 0) / vals.length : null;
        return h('td', { class: 'num muted small' }, avg === null || !task.max ? '' : fmtNum((avg / task.max) * 100, 0) + ' %');
      }),
      h('td', { colspan: 4 })
    );
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Ergebnisse'), h('span', { class: 'muted small' }, 'Enter/↓ springt zur nächsten Person, Tab zur nächsten Aufgabe')),
      students.length === 0
        ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'test-results' }, h('table', { class: 'table grid-table' }, h('thead', null, head), h('tbody', null, rows, avgRow)))
    );
  }

  function keyCard(course, a, level) {
    const t = a.test;
    const max = G.testMaxScore(t);
    const key = G.testKey(level, t.limit, max, t.precision, t.custom);
    const ids = M.activeStudents(course).map((s) => s.id);
    const st = G.testStats(t, ids, level);
    const anyCustom = key.some((k) => k.custom);
    const rows = key
      .slice()
      .reverse()
      .map((k) =>
        h(
          'tr',
          { class: k.custom ? 'custom' : '' },
          h('td', null, UI.gradeBadge(k.p, level)),
          level === 'mss' ? h('td', { class: 'muted small' }, G.wholeGrade(k.p) + G.tendency(k.p)) : null,
          h(
            'td',
            { class: 'num' },
            k.p === 0
              ? h('span', { class: 'muted' }, '0')
              : h('input', {
                  class: 'cell-input num-input' + (k.custom ? ' custom' : ''),
                  value: fmtScore(k.min),
                  title: k.custom ? 'Von Hand gesetzt' : 'Berechnet – zum Anpassen überschreiben',
                  'data-focus-key': `key-${a.id}-${k.p}`,
                  'data-select-all': '',
                  inputmode: 'decimal',
                  onfocus: (e) => e.target.select(),
                  onchange: (e) => {
                    const v = parseNum(e.target.value);
                    t.custom = t.custom || {};
                    if (v === null) delete t.custom[k.p];
                    else if (v === undefined || v < 0) return toast('Ungültige Punktzahl.', 'error');
                    else t.custom[k.p] = v;
                    NM.app.commit();
                  },
                })
          ),
          h('td', { class: 'num muted' }, fmtNum(k.pct, 1)),
          h('td', { class: 'num' }, st.counts[k.p] || '')
        )
      );
    return h(
      'div',
      { class: 'card key-card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Notenschlüssel'),
        anyCustom
          ? h(
              'button',
              {
                class: 'btn btn-sm',
                onclick: () => {
                  t.custom = {};
                  NM.app.commit();
                },
              },
              'Zurücksetzen'
            )
          : null
      ),
      h(
        'table',
        { class: 'table compact key-table' },
        h('thead', null, h('tr', null, h('th', null, level === 'mss' ? 'Punkte' : 'Note'), level === 'mss' ? h('th', null, 'Note') : null, h('th', { class: 'num' }, 'ab Pkt.'), h('th', { class: 'num' }, 'ab %'), h('th', { class: 'num' }, 'Anz.'))),
        h('tbody', null, rows)
      ),
      distribution(st, level),
      h(
        'div',
        { class: 'stats' },
        h('div', null, h('span', { class: 'muted' }, 'Teilnehmende'), h('strong', null, st.n)),
        h('div', null, h('span', { class: 'muted' }, 'Ø Note'), h('strong', null, fmtNum(st.avgDec, 2))),
        level === 'mss' ? h('div', null, h('span', { class: 'muted' }, 'Ø Punkte'), h('strong', null, fmtNum(st.avgPoints, 2))) : null,
        h('div', null, h('span', { class: 'muted' }, '5 und 6'), h('strong', null, st.weak))
      ),
      st.drittel
        ? h('div', { class: 'alert alert-danger' }, h('strong', null, 'Drittelparagraph greift! '), 'Mehr als ein Drittel der Arbeiten ist mangelhaft oder ungenügend (Täuschung/Verweigerung nicht mitgezählt). Die Arbeit muss von der Schulleitung genehmigt werden.')
        : st.n
          ? h('div', { class: 'alert alert-ok' }, 'Drittelparagraph greift nicht.')
          : null
    );
  }

  function distribution(st, level) {
    const bars = [1, 2, 3, 4, 5, 6].map((g) => ({ label: String(g), n: st.whole[g], p: g === 6 ? 0 : 17 - 3 * g }));
    const maxN = Math.max(1, ...bars.map((b) => b.n));
    return h(
      'div',
      { class: 'dist', role: 'img', 'aria-label': 'Notenspiegel: ' + bars.map((b) => `${b.label}: ${b.n}`).join(', ') },
      bars.map((b) =>
        h(
          'div',
          { class: 'dist-col' },
          h('span', { class: 'dist-n' }, b.n || ''),
          h('div', { class: 'dist-bar', style: `height:${(b.n / maxN) * 100}%;${gradeStyle(b.p)}` }),
          h('span', { class: 'dist-label' }, b.label)
        )
      )
    );
  }

  NM.views.tests = { render };
})((globalThis.NM = globalThis.NM || {}));
