/* OrdoNota – Reiter „Tests“: Rohpunkte erfassen, Notenschlüssel, Notenspiegel. */
(function (NM) {
  'use strict';
  const { h, clear, modal, toast, confirmDialog, parseNum, uid, fmtNum, fmtScore, fmtDate, todayISO, gradeStyle } = NM.util;
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
          const st = G.testStats(a.test, M.statStudents(course).map((s) => s.id), level);
          return [fmtDate(a.date), UI.catLabel(a.cat), a.ungraded ? 'nicht gewertet' : null, st.n ? 'Ø ' + fmtNum(level === 'mss' ? st.avgPoints : st.avgDec, 2) : null].filter(Boolean).join(' · ');
        },
      })
    );
    if (!cur) {
      view.appendChild(UI.emptyState('Noch kein Test in ' + half, 'Legen Sie einen Test an: Aufgaben mit Höchstpunktzahlen festlegen, Rohpunkte eintragen – Note, Notenspiegel und Drittelparagraph werden automatisch berechnet.'));
      return;
    }
    const t = cur.test;
    const moodleCards = [t.moodle ? moodleCard(course, db, cur, null) : null, ...(G.hasParts(t) ? t.parts.filter((x) => x.moodle).map((x) => moodleCard(course, db, cur, x)) : [])];
    view.append(...[metaCard(course, cur, level), ...moodleCards, G.hasParts(t) ? partsCard(course, db, cur, level) : null, tasksCard(course, db, cur), h('div', { class: 'test-layout' }, resultsCard(course, cur, level), keyCard(course, cur, level))].filter(Boolean));
  }

  function metaCard(course, a, level) {
    const t = a.test;
    const sep = G.separateParts(t);
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
          { class: 'field' },
          h('span', null, 'Wertung'),
          h(
            'label',
            { class: 'check field-check', title: 'Der Test erscheint ausgegraut in der Notenübersicht und zählt nicht zur Halbjahresnote.' },
            h('input', {
              type: 'checkbox',
              checked: !!a.ungraded,
              onchange: (e) => {
                if (e.target.checked) a.ungraded = true;
                else delete a.ungraded;
                NM.app.commit();
              },
            }),
            ' nicht gewertet'
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
          h('span', null, 'Teile'),
          h(
            'label',
            { class: 'check field-check', title: 'Die Arbeit besteht aus mehreren Teilen, z. B. Theorie und Praxis – gemeinsam bepunktet oder getrennt benotet' },
            h('input', { type: 'checkbox', checked: G.hasParts(t), 'data-focus-key': 'test-parts', onchange: (e) => toggleParts(a, e.target.checked) }),
            ' Arbeit in Teilen'
          )
        ),
        sep ? null : h('label', { class: 'field' }, h('span', null, 'Punkte-Genauigkeit'), precisionSelect(t)),
        sep || level === 'mss'
          ? null
          : h('label', { class: 'field', title: 'Bei Tests mit wenigen Punkten: nur 1, 2, 3, 4, 5, 6 vergeben. Eine ganze Note beginnt dort, wo sonst ihre Minus-Note beginnt (4 ab LIMIT).' }, h('span', null, 'Notenstufen'), gradeStepsSelect(t)),
        sep
          ? null
          : h(
              'label',
              { class: 'field narrow', title: level === 'mss' ? 'Ab diesem Prozentsatz gibt es 4 Punkte (4-)' : 'Ab diesem Prozentsatz gibt es eine 4-' },
              h('span', null, level === 'mss' ? 'LIMIT 04 P. (%)' : t.wholeGrades ? 'LIMIT 4 (%)' : 'LIMIT 4- (%)'),
              limitInput(t, level)
            ),
        h(
          'div',
          { class: 'field actions-end' },
          h('span', null, ' '),
          h(
            'div',
            { class: 'inline' },
            h('button', { class: 'btn', title: 'Notenspiegel und Punkteverteilung ohne Namen im Vollbild', onclick: () => beamerView(course, a, level) }, '⛶ Beamer'),
            printButton(course, a),
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

  /** Alle Ausdrucke eines Tests in einem Auswahlfenster. */
  function printButton(course, a) {
    const t = a.test;
    const ka = a.cat === 'ka';
    return UI.printButton('Drucken: ' + a.name, [
      { id: 'list', icon: '📄', label: 'Ergebnisliste', group: 'teacher', tip: 'Alle Personen mit Punkten je Aufgabe, Summe, Prozent und Note' + (ka ? ', mit Spalte „Unterschrift“' : '') + '; darunter Notenspiegel und Notenschlüssel.', run: () => NM.print.test(course, a, 'list') },
      G.hasParts(t) ? { id: 'parts', icon: '🧩', label: 'Ergebnisse nach Teilen', group: 'teacher', tip: 'Kompakt: je Person Punkte, Prozent und (bei getrennter Benotung) Note jedes Teils sowie gesamt; darunter Notenspiegel und Schlüssel.', run: () => NM.print.test(course, a, 'parts') } : null,
      { id: 'key', icon: '📊', label: 'Notenschlüssel und Notenspiegel', group: 'teacher', tip: 'Punktschwellen je Note und Verteilung der Noten mit Statistik und Drittelparagraph – ohne Namen, z. B. für Klassenbuch oder Fachleitung.', run: () => NM.print.test(course, a, 'key') },
      { id: 'students', icon: '✂️', label: 'Ergebniszettel zum Ausschneiden', group: 'students', tip: 'Je Person ein Abschnitt mit erreichten und möglichen Punkten je Aufgabe, Prozent und Note – mehrere pro Blatt.', run: () => NM.print.test(course, a, 'students') },
      NM.moodle.hasData(t) ? { id: 'moodle', icon: '💬', label: 'Moodle-Rückmeldung je Person', group: 'students', tip: 'Je Person eine Seite mit Frage, gegebener Antwort, Lösung und Punkten; Note wahlweise, Felder für Datum und Unterschrift.', run: () => moodlePrint(course, a) } : null,
    ]);
  }

  // Einstellungen des Schlüssels – für den Test oder (bei getrennt benoteten Teilen) für einen Teil

  function precisionSelect(obj, cls = '') {
    return h(
      'select',
      {
        class: 'input ' + cls,
        'aria-label': 'Punkte-Genauigkeit',
        onchange: (e) => {
          obj.precision = Number(e.target.value);
          NM.app.commit();
        },
      },
      [
        [1, 'Ganze Punkte'],
        [0.5, 'Halbe Punkte'],
        [0.1, 'Zehntel'],
      ].map(([v, l]) => h('option', { value: v, selected: Number(obj.precision) === v }, l))
    );
  }

  function gradeStepsSelect(obj, cls = '') {
    return h(
      'select',
      {
        class: 'input ' + cls,
        'aria-label': 'Notenstufen',
        onchange: async (e) => {
          const whole = e.target.value === 'whole';
          if (obj.custom && Object.keys(obj.custom).length) {
            if (!(await confirmDialog('Notenstufen umstellen?', 'Von Hand geänderte Schwellen im Notenschlüssel passen nicht mehr und werden zurückgesetzt.', { okLabel: 'Umstellen' }))) return NM.app.rerender();
            obj.custom = {};
          }
          if (whole) obj.wholeGrades = true;
          else delete obj.wholeGrades;
          NM.app.commit();
        },
      },
      h('option', { value: 'tend', selected: !obj.wholeGrades }, 'mit Tendenzen (2+, 2, 2-)'),
      h('option', { value: 'whole', selected: !!obj.wholeGrades }, 'nur ganze Noten (1–6)')
    );
  }

  function limitInput(obj, level, cls = '') {
    return h('input', {
      class: 'input ' + cls,
      type: 'number',
      min: 20,
      max: 80,
      step: 1,
      value: obj.limit,
      'aria-label': level === 'mss' ? 'LIMIT 04 Punkte (%)' : 'LIMIT (%)',
      onchange: (e) => {
        const v = parseNum(e.target.value);
        if (!(v >= 20 && v <= 80)) return toast('LIMIT bitte zwischen 20 und 80 %.', 'error');
        obj.limit = v;
        NM.app.commit();
      },
    });
  }

  // ---------- Arbeit in Teilen ----------

  async function toggleParts(a, on) {
    const t = a.test;
    if (on) {
      t.parts = [
        { id: uid(), name: 'Theorie', weight: 1 },
        { id: uid(), name: 'Praxis', weight: 1 },
      ];
      t.partMode = 'sum';
      for (const task of t.tasks) task.partId = t.parts[0].id;
      // Ein vorhandener Moodle-Import gehört jetzt zum ersten Teil (dort liegen seine Aufgaben)
      if (t.moodle) {
        t.parts[0].moodle = t.moodle;
        delete t.moodle;
      }
      return NM.app.commit();
    }
    const sep = G.separateParts(t);
    if (!(await confirmDialog('Teile aufheben?', 'Alle Aufgaben werden wieder zu einer Arbeit mit einem Notenschlüssel zusammengefasst.' + (sep ? ' Schlüssel, Gewichte und Status der einzelnen Teile gehen verloren.' : ''), { okLabel: 'Aufheben' }))) return NM.app.rerender();
    t.tasks = G.orderedTasks(t);
    const mos = t.parts.map((x) => x.moodle).filter(Boolean);
    if (mos.length && !t.moodle) t.moodle = mos.length === 1 ? mos[0] : NM.moodle.mergeData(mos);
    for (const task of t.tasks) delete task.partId;
    for (const r of Object.values(t.results)) delete r.partStatus;
    delete t.parts;
    delete t.partMode;
    NM.app.commit();
  }

  function setPartMode(t, mode) {
    t.partMode = mode;
    if (mode === 'separate') {
      // Jeder Teil startet mit den Einstellungen des Tests
      for (const part of t.parts) initPartKey(t, part);
    }
    NM.app.commit();
  }

  function initPartKey(t, part) {
    if (part.limit === undefined) part.limit = t.limit;
    if (part.precision === undefined) part.precision = t.precision;
    if (part.wholeGrades === undefined && t.wholeGrades) part.wholeGrades = true;
    part.custom = part.custom || {};
  }

  function addPart(t) {
    const part = { id: uid(), name: 'Teil ' + (t.parts.length + 1), weight: 1 };
    if (G.separateParts(t)) initPartKey(t, part);
    t.parts.push(part);
    NM.app.commit();
  }

  async function removePart(a, part) {
    const t = a.test;
    if (t.parts.length <= 1) return toggleParts(a, false);
    const tasks = G.partTasks(t, part);
    const ids = new Set(tasks.map((x) => x.id));
    const used = Object.values(t.results).some((r) => Object.keys(r.scores || {}).some((id) => ids.has(id)));
    const what = tasks.length ? ` mit ${tasks.length} ${tasks.length === 1 ? 'Aufgabe' : 'Aufgaben'}` : '';
    if (!(await confirmDialog('Teil entfernen?', `„${part.name}“${what} entfernen?` + (used ? ' Die eingetragenen Punkte dieses Teils werden gelöscht.' : ''), { okLabel: 'Entfernen', danger: true }))) return;
    t.tasks = t.tasks.filter((x) => !ids.has(x.id));
    for (const r of Object.values(t.results)) {
      if (r.scores) for (const id of ids) delete r.scores[id];
      if (r.partStatus) delete r.partStatus[part.id];
    }
    t.parts = t.parts.filter((x) => x !== part);
    NM.app.commit();
  }

  function partsCard(course, db, a, level) {
    const t = a.test;
    const sep = G.separateParts(t);
    const head = h(
      'tr',
      null,
      h('th', null, 'Teil'),
      h('th', { class: 'num' }, 'Aufgaben'),
      h('th', { class: 'num' }, 'Höchstpunkte'),
      sep
        ? [
            h('th', { class: 'num', title: 'Gewicht der Teilnote in der Gesamtnote' }, 'Gewicht'),
            h('th', null, level === 'mss' ? 'LIMIT 04 P. (%)' : 'LIMIT (%)'),
            h('th', null, 'Genauigkeit'),
            level === 'mss' ? null : h('th', null, 'Notenstufen'),
          ]
        : null,
      h('th', null, '')
    );
    const rows = t.parts.map((part) => {
      const tasks = G.partTasks(t, part);
      return h(
        'tr',
        null,
        h(
          'td',
          null,
          h('input', {
            class: 'input input-sm part-name',
            value: part.name,
            'data-focus-key': `part-name-${part.id}`,
            'aria-label': 'Name des Teils',
            onchange: (e) => {
              part.name = e.target.value.trim() || part.name;
              NM.app.commit();
            },
          })
        ),
        h('td', { class: 'num' }, tasks.length),
        h('td', { class: 'num' }, fmtScore(G.testMaxScore({ tasks }))),
        sep
          ? [
              h(
                'td',
                { class: 'num' },
                h('input', {
                  class: 'input input-sm part-weight',
                  type: 'number',
                  min: 0.5,
                  step: 0.5,
                  value: G.partWeight(part),
                  'aria-label': 'Gewicht ' + part.name,
                  onchange: (e) => {
                    const v = parseNum(e.target.value);
                    if (!(v > 0)) return toast('Ungültiges Gewicht.', 'error');
                    part.weight = v;
                    NM.app.commit();
                  },
                })
              ),
              h('td', null, limitInput(part, level, 'input-sm part-limit')),
              h('td', null, precisionSelect(part, 'input-sm')),
              level === 'mss' ? null : h('td', null, gradeStepsSelect(part, 'input-sm')),
            ]
          : null,
        h(
          'td',
          null,
          h(
            'div',
            { class: 'inline' },
            h('button', { class: 'btn btn-sm', title: `Moodle-Test in den Teil „${part.name}“ übernehmen`, onclick: () => moodleImport(course, db, a.half, a, part.id) }, '⬆ Moodle'),
            h('button', { class: 'icon-btn', title: 'Teil entfernen', 'aria-label': 'Teil entfernen: ' + part.name, onclick: () => removePart(a, part) }, '✕')
          )
        )
      );
    });
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Teile'),
        h(
          'label',
          { class: 'inline small' },
          'Wertung ',
          h(
            'select',
            { class: 'input input-sm', 'data-focus-key': 'part-mode', onchange: (e) => setPartMode(t, e.target.value) },
            h('option', { value: 'sum', selected: !sep }, 'gemeinsam bepunktet (ein Notenschlüssel)'),
            h('option', { value: 'separate', selected: sep }, 'getrennt benotet (Note je Teil, gewichtet)')
          )
        )
      ),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table compact parts-table' }, h('thead', null, head), h('tbody', null, rows))),
      h(
        'div',
        { class: 'inline wrap' },
        h('button', { class: 'btn btn-ghost', onclick: () => addPart(t) }, '+ Teil'),
        h(
          'span',
          { class: 'muted small' },
          sep
            ? `Gesamtnote = gewichteter Schnitt der Teilnoten (${t.parts.map((x) => fmtScore(G.partWeight(x))).join(' : ')}), auf eine Notenstufe gerundet. Sie entsteht erst, wenn alle Teile bewertet sind.`
            : 'Alle Punkte zählen zusammen; die Note ergibt sich aus der Gesamtpunktzahl. Die Teile gliedern Aufgaben, Ergebnisse und Ausdrucke.'
        )
      )
    );
  }

  function tasksCard(course, db, a) {
    const t = a.test;
    const max = G.testMaxScore(t);
    const bonusMax = t.tasks.filter((x) => x.bonus).reduce((s, x) => s + (Number(x.max) || 0), 0);
    const add = (part, bonus) =>
      h(
        'button',
        {
          class: 'btn btn-ghost',
          onclick: () => {
            const task = bonus ? { id: uid(), name: 'Bonus', max: 2, bonus: true } : { id: uid(), name: nextTaskName(t.tasks), max: 5 };
            if (part) task.partId = part.id;
            t.tasks.push(task);
            NM.app.commit();
          },
        },
        bonus ? '+ Bonusaufgabe' : '+ Aufgabe'
      );
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Aufgaben'),
        h('span', { class: 'muted' }, `Höchstpunktzahl ${fmtScore(max)}`, bonusMax ? ` + ${fmtScore(bonusMax)} Bonus` : ''),
        // Moodle-Import in den Test (bei Teilen je Teil in der Karte „Teile“, erneut über die Karte „Moodle“)
        G.hasParts(t) || t.moodle
          ? null
          : h('button', { class: 'btn btn-sm', 'data-focus-key': 'moodle-import', title: 'Moodle-Test aus der Antworten- und Bewertungen-CSV in diesen Test übernehmen: jede Frage wird eine Aufgabe', onclick: () => moodleImport(course, db, a.half, a) }, '⬆ Moodle-CSV')
      ),
      G.taskGroups(t).map(({ part, tasks }) =>
        h(
          'div',
          { class: part ? 'task-group' : null },
          part ? h('div', { class: 'task-group-head' }, h('strong', null, part.name), h('span', { class: 'muted small' }, ` · ${fmtScore(G.testMaxScore({ tasks }))} Punkte`)) : null,
          h('div', { class: 'tasks' }, tasks.map((task) => taskItem(t, task)), add(part, false), add(part, true))
        )
      )
    );
  }

  function taskItem(t, task) {
    return h(
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
            t.tasks.splice(t.tasks.indexOf(task), 1);
            for (const r of Object.values(t.results)) if (r.scores) delete r.scores[task.id];
            NM.app.commit();
          },
        },
        '✕'
      )
    );
  }

  /** „Unterschriften 9 / 11“ – gezählt werden Personen mit Note (nicht fehlend/nachschreibend). */
  function signCount(t, students) {
    const due = students.filter((s) => (t.results[s.id] || {}).signed || !['fehlt', 'nachschreiben'].includes((t.results[s.id] || {}).status) && Object.values((t.results[s.id] || {}).scores || {}).some((v) => v !== '' && v !== null && v !== undefined));
    const n = due.filter((s) => (t.results[s.id] || {}).signed).length;
    return h('span', { class: due.length && n === due.length ? 'pill' : 'chip', title: 'Unterschrift unter der Arbeit gesehen (Personen mit Note)' }, `Unterschriften ${n} / ${due.length}`);
  }

  // Nächste freie Bezeichnung A1, A2, … (nach der höchsten vorhandenen Nummer)
  function nextTaskName(tasks) {
    const nums = tasks.filter((x) => !x.bonus).map((x) => /^A?(\d+)/i.exec(x.name || '')).filter(Boolean).map((m) => Number(m[1]));
    return 'A' + ((nums.length ? Math.max(...nums) : 0) + 1);
  }

  const colHead = (name, sub) => h('span', { class: 'col-head' }, h('span', { class: 'col-name' }, name), h('span', { class: 'col-sub' }, sub));

  function resultsCard(course, a, level) {
    const t = a.test;
    const max = G.testMaxScore(t);
    const sep = G.separateParts(t);
    // Ausgeblendete Teile: nur Σ (und Teilnote) ohne Aufgabenspalten; pro Gerät gemerkt
    const ui = NM.app.state.ui;
    const hidden = new Set(((ui.hiddenParts || {})[a.id] || []).filter((id) => G.hasParts(t) && t.parts.some((x) => x.id === id)));
    const groups = G.taskGroups(t).map((g) => (g.part && hidden.has(g.part.id) ? { part: g.part, tasks: [], hidden: true } : g));
    const toggle = (part) => {
      const list = new Set((ui.hiddenParts = ui.hiddenParts || {})[a.id] || []);
      if (list.has(part.id)) list.delete(part.id);
      else list.add(part.id);
      ui.hiddenParts[a.id] = [...list];
      NM.app.saveUi();
      NM.app.rerender();
    };
    const all = M.activeStudents(course);
    const results = new Map(all.map((s) => [s.id, G.testResult(t, s.id, level)]));
    const score = (s, task) => ((t.results[s.id] || {}).scores || {})[task.id];
    const sort = UI.sorter('test', {
      ...Object.fromEntries(t.tasks.map((task) => ['task:' + task.id, { get: (s) => score(s, task), first: 'desc' }])),
      ...Object.fromEntries(
        groups
          .filter((g) => g.part)
          .flatMap((g, i) => [
            ['part:' + g.part.id, { get: (s) => results.get(s.id).parts[i].score, first: 'desc' }],
            ['pgrade:' + g.part.id, { get: (s) => results.get(s.id).parts[i].p, first: 'desc' }],
          ])
      ),
      sum: { get: (s) => results.get(s.id).score, first: 'desc' },
      pct: { get: (s) => results.get(s.id).score, first: 'desc' },
      grade: { get: (s) => results.get(s.id).p, first: 'desc' },
      status: { get: (s) => UI.STATUS_SHORT[(t.results[s.id] || {}).status] || null, first: 'asc' },
      signed: { get: (s) => ((t.results[s.id] || {}).signed ? 1 : 0), first: 'asc' },
    });
    // Klassen-/Kursarbeit: Unterschrift der Eltern gesehen (nur Vermerk, ohne Einfluss auf die Note)
    const sign = a.cat === 'ka';
    const students = sort.rows(all);
    const head = h(
      'tr',
      null,
      sort.nameHeads(),
      groups.map((g) => [
        g.tasks.map((task) => h('th', { class: 'center task-col' + (task.bonus ? ' bonus' : '') }, sort.head('task:' + task.id, colHead(task.name || '–', fmtScore(task.max) + (task.bonus ? ' B' : ''))))),
        g.part ? h('th', { class: 'num part-col' }, sort.head('part:' + g.part.id, colHead('Σ', g.part.name))) : null,
        g.part && sep ? h('th', { class: 'center part-col' }, sort.head('pgrade:' + g.part.id, colHead('Note', g.part.name))) : null,
      ]),
      h('th', { class: 'num' }, sort.head('sum', 'Σ')),
      h('th', { class: 'num' }, sort.head('pct', '%')),
      h('th', { class: 'center' }, sort.head('grade', 'Note')),
      h('th', { class: 'col-tight' }, sort.head('status', 'Status')),
      sign ? h('th', { class: 'center col-tight', title: 'Unterschrift unter der Arbeit gesehen' }, sort.head('signed', 'Unterschrift')) : null
    );
    const rows = students.map((s, ri) => {
      const r = (t.results[s.id] = t.results[s.id] || { scores: {} });
      r.scores = r.scores || {};
      const res = results.get(s.id);
      const blocked = !!r.status; // auch „nicht gewertet“: Note bleibt sichtbar, Zeile ausgegraut
      let ci = 0;
      return h(
        'tr',
        { class: blocked ? 'row-muted' : '' },
        UI.nameCells(s),
        groups.map((g, gi) => [
          g.tasks.map((task) =>
            h(
              'td',
              { class: 'center task-col' },
              UI.numberInput({
                value: r.scores[task.id],
                grid: 'test-' + a.id,
                row: ri,
                col: ci++,
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
          g.part ? h('td', { class: 'num part-col' }, res.parts[gi].score === null ? '' : fmtScore(res.parts[gi].score)) : null,
          g.part && sep ? h('td', { class: 'center part-col' }, partGradeCell(s, r, g.part, res.parts[gi], level)) : null,
        ]),
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
        ),
        sign
          ? h(
              'td',
              { class: 'center' },
              h('input', {
                type: 'checkbox',
                checked: !!r.signed,
                'data-focus-key': `ts-signed-${s.id}`,
                title: r.signed ? 'Unterschrift gesehen am ' + fmtDate(r.signed) : 'Unterschrift gesehen?',
                'aria-label': 'Unterschrift gesehen: ' + M.studentName(s),
                onchange: (e) => {
                  if (e.target.checked) r.signed = todayISO();
                  else delete r.signed;
                  NM.app.commit();
                },
              })
            )
          : null
      );
    });
    // Aufgabenschnitt
    const avgRow = h(
      'tr',
      { class: 'foot' },
      h('td', { class: 'sticky-col', colspan: 2 }, 'Ø gelöst'),
      groups.map((g) => [
        g.tasks.map((task) => {
          const avg = taskAverage(t, M.statStudents(course), task);
          return h('td', { class: 'center muted small' }, avg === null || !task.max ? '' : fmtNum((avg / task.max) * 100, 0) + ' %');
        }),
        g.part ? h('td', { class: 'part-col' }) : null,
        g.part && sep ? h('td', { class: 'part-col' }) : null,
      ]),
      h('td', { colspan: sign ? 5 : 4 })
    );
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h(
          'div',
          { class: 'inline wrap' },
          h('h2', null, 'Ergebnisse'),
          sign ? signCount(t, all) : null,
          G.hasParts(t)
            ? t.parts.map((part) =>
                h(
                  'button',
                  {
                    class: 'btn btn-sm part-toggle' + (hidden.has(part.id) ? ' off' : ''),
                    'aria-pressed': String(!hidden.has(part.id)),
                    'data-focus-key': `part-toggle-${part.id}`,
                    title: hidden.has(part.id) ? `Aufgaben von „${part.name}“ einblenden` : `Aufgaben von „${part.name}“ ausblenden (Summe und Note bleiben sichtbar)`,
                    onclick: () => toggle(part),
                  },
                  (hidden.has(part.id) ? '▸ ' : '▾ ') + part.name
                )
              )
            : null
        ),
        h('span', { class: 'muted small' }, 'Enter/↓ springt zur nächsten Person, Tab zur nächsten Aufgabe')
      ),
      students.length === 0
        ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'test-results' }, h('table', { class: 'table grid-table' }, h('thead', null, head), h('tbody', null, rows, avgRow)))
    );
  }

  /** Teilnote (getrennt benotete Teile); ohne Note Auswahl „fehlt“/„Nachschreiben“ nur für diesen Teil. */
  function partGradeCell(s, r, part, pr, level) {
    const ps = (r.partStatus || {})[part.id] || '';
    if (pr.p !== null && !ps) return UI.gradeBadge(pr.p, level);
    if (r.status) return '';
    return h(
      'select',
      {
        class: 'cell-select',
        title: `Status im Teil „${part.name}“`,
        'aria-label': `Status im Teil ${part.name}: ${M.studentName(s)}`,
        'data-focus-key': `ts-pstatus-${s.id}-${part.id}`,
        onchange: (e) => {
          r.partStatus = r.partStatus || {};
          if (e.target.value) r.partStatus[part.id] = e.target.value;
          else delete r.partStatus[part.id];
          if (!Object.keys(r.partStatus).length) delete r.partStatus;
          NM.app.commit();
        },
      },
      [
        ['', '—'],
        ['fehlt', 'fehlt'],
        ['nachschreiben', 'NS'],
      ].map(([v, l]) => h('option', { value: v, selected: ps === v }, l))
    );
  }

  const keyPart = {}; // gewählter Teil im Notenschlüssel je Test (getrennt benotete Teile)

  function keyCard(course, a, level) {
    const t = a.test;
    const ids = M.statStudents(course).map((s) => s.id);
    const st = G.testStats(t, ids, level);
    // Getrennt benotete Teile: Schlüssel des gewählten Teils, Notenspiegel und Drittelparagraph der Gesamtnote
    const part = G.separateParts(t) ? t.parts.find((x) => x.id === keyPart[a.id]) || t.parts[0] : null;
    return keyCardFor(course, level, {
      focusId: a.id + (part ? '-' + part.id : ''),
      key: part ? G.keyForPart(t, part, level) : G.keyForTest(t, level),
      alt: (patch) => (part ? G.keyForPart(t, Object.assign({}, part, patch), level) : G.keyForTest(Object.assign({}, t, patch), level)),
      counts: part ? G.partStats(t, part, ids, level).counts : st.counts,
      holder: part || t,
      st,
      results: t.results,
      top: part
        ? h(
            'div',
            { class: 'key-parts' },
            h(
              'div',
              { class: 'segmented', role: 'group', 'aria-label': 'Teil' },
              t.parts.map((x) =>
                h(
                  'button',
                  {
                    class: 'seg' + (x === part ? ' active' : ''),
                    'aria-pressed': String(x === part),
                    onclick: () => {
                      keyPart[a.id] = x.id;
                      NM.app.rerender();
                    },
                  },
                  x.name
                )
              )
            ),
            h('p', { class: 'muted small' }, `Höchstpunktzahl ${fmtScore(G.testMaxScore(G.partAsTest(t, part)))} · LIMIT ${fmtScore(part.limit)} %` + (G.wholeOnly(part, level) ? ' · nur ganze Noten' : ''))
          )
        : null,
      statsTitle: part ? 'Notenspiegel der Gesamtnote' : null,
    });
  }

  /**
   * Warnung bei nicht erreichbaren Notenstufen (zu wenig Punkte für alle Stufen) mit Schnellknöpfen.
   * alt(patch) liefert den Schlüssel mit geänderten Einstellungen; angeboten wird nur, was das Problem löst.
   */
  function unreachableNotice(level, lost, holder, alt, hint) {
    const L = (p) => G.label(p, level);
    const lostText = lost.map((x) => L(x.p)).join(', ').replace(/, ([^,]*)$/, ' und $1');
    const byText = lost.map((x) => L(x.by)).join(', ').replace(/, ([^,]*)$/, ' bzw. $1');
    const solves = (patch) => alt && !G.unreachableSteps(alt(patch)).length;
    const fixes = [];
    if (holder.precision !== undefined) {
      const finer = [0.5, 0.1].filter((v) => v < (Number(holder.precision) || 1));
      const v = finer.find((x) => solves({ precision: x }));
      if (v)
        fixes.push(
          h('button', { class: 'btn btn-sm', title: 'Punkte-Genauigkeit umstellen – Schwellen und Summen werden genauer gerundet', onclick: () => {
            holder.precision = v;
            NM.app.commit();
          } }, v === 0.5 ? '½ Halbe Punkte' : 'Zehntel-Punkte')
        );
    }
    if (level !== 'mss' && !holder.wholeGrades && solves({ wholeGrades: true, custom: {} }))
      fixes.push(
        h('button', { class: 'btn btn-sm', title: 'Nur ganze Noten 1–6 vergeben', onclick: async () => {
          if (holder.custom && Object.keys(holder.custom).length) {
            if (!(await confirmDialog('Notenstufen umstellen?', 'Von Hand geänderte Schwellen im Notenschlüssel passen nicht mehr und werden zurückgesetzt.', { okLabel: 'Umstellen' }))) return;
            holder.custom = {};
          }
          holder.wholeGrades = true;
          NM.app.commit();
        } }, 'Nur ganze Noten')
      );
    const ownCustom = lost.some((x) => (holder.custom || {})[x.p] !== undefined || (holder.custom || {})[x.by] !== undefined);
    return h(
      'div',
      { class: 'notice warn key-warn' },
      h('div', null, `⚠ ${ownCustom ? 'Schwellen prüfen' : 'Zu wenig Punkte'}: ${lostText} ${lost.length > 1 ? 'sind' : 'ist'} nicht erreichbar (${ownCustom ? 'Schwelle nicht höher als bei' : 'gleiche Schwelle wie'} ${byText}).`),
      hint ? h('div', { class: 'muted small' }, hint) : null,
      fixes.length ? h('div', { class: 'key-warn-fixes' }, fixes) : null
    );
  }

  /**
   * Notenschlüssel-Karte (auch für Präsentationen): Schlüssel mit änderbaren Schwellen (holder.custom),
   * darunter Notenspiegel, Statistik und Drittelparagraph aus st.
   */
  function keyCardFor(course, level, { focusId, key, counts, holder, st, results, top = null, statsTitle = null, alt = null, hint = '' }) {
    const anyCustom = key.some((k) => k.custom);
    const lost = key.some((k) => k.min > 0) ? G.unreachableSteps(key) : [];
    const lostP = new Set(lost.map((x) => x.p));
    const rows = key
      .slice()
      .reverse()
      .map((k) =>
        h(
          'tr',
          { class: [k.custom ? 'custom' : '', lostP.has(k.p) ? 'unreachable' : ''].filter(Boolean).join(' ') },
          h('td', { title: lostP.has(k.p) ? 'Nicht erreichbar: gleiche Schwelle wie eine bessere Note' : null }, UI.gradeBadge(k.p, level), lostP.has(k.p) ? ' ⚠' : null),
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
                  'data-focus-key': `key-${focusId}-${k.p}`,
                  'data-select-all': '',
                  inputmode: 'decimal',
                  onfocus: (e) => e.target.select(),
                  onchange: (e) => {
                    const v = parseNum(e.target.value);
                    holder.custom = holder.custom || {};
                    if (v === null) delete holder.custom[k.p];
                    else if (v === undefined || v < 0) return toast('Ungültige Punktzahl.', 'error');
                    else holder.custom[k.p] = v;
                    NM.app.commit();
                  },
                })
          ),
          h('td', { class: 'num muted' }, fmtNum(k.pct, 1)),
          h('td', { class: 'num' }, counts[k.p] || '')
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
                  holder.custom = {};
                  NM.app.commit();
                },
              },
              'Zurücksetzen'
            )
          : null
      ),
      top,
      lost.length ? unreachableNotice(level, lost, holder, alt, hint) : null,
      h(
        'table',
        { class: 'table compact key-table' },
        h('thead', null, h('tr', null, h('th', null, level === 'mss' ? 'Punkte' : 'Note'), level === 'mss' ? h('th', null, 'Note') : null, h('th', { class: 'num' }, 'ab Pkt.'), h('th', { class: 'num' }, 'ab %'), h('th', { class: 'num' }, 'Anz.'))),
        h('tbody', null, rows)
      ),
      statsTitle ? h('h3', { class: 'key-sub' }, statsTitle) : null,
      distribution(st, level),
      h(
        'div',
        { class: 'stats' },
        h('div', null, h('span', { class: 'muted' }, 'Teilnehmende'), h('strong', null, st.n)),
        h('div', null, h('span', { class: 'muted' }, 'Ø Note'), h('strong', null, fmtNum(st.avgDec, 2))),
        level === 'mss' ? h('div', null, h('span', { class: 'muted' }, 'Ø Punkte'), h('strong', null, fmtNum(st.avgPoints, 2))) : null,
        sdTile(st, level),
        h('div', null, h('span', { class: 'muted' }, '5 und 6'), h('strong', null, st.weak)),
        weakTile(st)
      ),
      iHint(course, { results }),
      st.drittel
        ? h('div', { class: 'alert alert-danger' }, h('strong', null, 'Drittelparagraph greift! '), 'Mehr als ein Drittel der Arbeiten ist mangelhaft oder ungenügend (Täuschung/Verweigerung nicht mitgezählt). Die Arbeit muss von der Schulleitung genehmigt werden.')
        : st.n
          ? h('div', { class: 'alert alert-ok' }, 'Drittelparagraph greift nicht.')
          : null
    );
  }

  /** Standardabweichung in der Einheit des Schnitts (Sek I: Note, MSS: Punkte). */
  function sdTile(st, level) {
    const v = level === 'mss' ? st.sdPoints : st.sdDec;
    return h('div', { title: 'Standardabweichung ' + (level === 'mss' ? 'der Punkte' : 'der Noten') }, h('span', { class: 'muted' }, 'Std.-Abw.'), h('strong', null, fmtNum(v, 2)));
  }

  function weakTile(st) {
    return h('div', { title: 'Anteil mit Note 5 oder 6' }, h('span', { class: 'muted' }, 'unter 4'), h('strong', null, st.weakPct === null ? '–' : fmtNum(st.weakPct, 0) + ' %'));
  }

  /** Hinweis, wenn Personen mit I-Status oder nicht gewertete Arbeiten aus der Statistik herausgenommen sind. */
  function iHint(course, t) {
    const n = M.activeStudents(course).length - M.statStudents(course).length;
    const u = M.statStudents(course).filter((s) => (t.results[s.id] || {}).status === 'ungewertet').length;
    const parts = [n ? `${n} ${n === 1 ? 'Person' : 'Personen'} mit I-Status` : null, u ? `${u} nicht ${u === 1 ? 'gewertete Arbeit' : 'gewertete Arbeiten'}` : null].filter(Boolean);
    return parts.length ? h('p', { class: 'muted small' }, `Ohne ${parts.join(' und ')}.`) : null;
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

  /** Durchschnittlich erreichte Punkte einer Aufgabe (nur eingetragene, gewertete Werte); null = keine. */
  function taskAverage(t, students, task) {
    const vals = students
      .map((s) => t.results[s.id] || {})
      .filter((r) => r.status !== 'ungewertet')
      .map((r) => (r.scores ? r.scores[task.id] : null))
      .filter((v) => v !== null && v !== undefined && v !== '');
    return vals.length ? vals.reduce((x, y) => x + Number(y), 0) / vals.length : null;
  }

  /** Vollbild-Ansicht für den Beamer: Notenspiegel und Punkteverteilung, keine Namen. */
  function beamerView(course, a, level) {
    const t = a.test;
    const max = G.testMaxScore(t);
    const step = Number(t.precision) || 1;
    const students = M.statStudents(course);
    const st = G.testStats(t, students.map((s) => s.id), level);
    const taskRows = G.orderedTasks(t).map((task) => {
      const avg = taskAverage(t, students, task);
      const pct = avg === null || !task.max ? null : Math.min(100, (avg / task.max) * 100);
      return h(
        'div',
        { class: 'task-bar' + (task.bonus ? ' bonus' : '') },
        h('span', { class: 'task-bar-name' }, (task.name || '–') + (task.bonus && !/bonus/i.test(task.name || '') ? ' (Bonus)' : '')),
        h('div', { class: 'task-bar-track' }, h('div', { class: 'task-bar-fill', style: `width:${pct || 0}%` })),
        h('span', { class: 'task-bar-val' }, avg === null ? '–' : `${fmtNum(avg, 1)} / ${fmtScore(task.max)}`),
        h('span', { class: 'task-bar-pct muted' }, pct === null ? '' : fmtNum(pct, 0) + ' %')
      );
    });
    // Bereich je Stufe: von der eigenen Schwelle bis knapp unter die nächsthöhere
    const rangeTable = (key, maxScore, step, counts) => {
      const ordered = key.slice().sort((x, y) => y.p - x.p);
      const rows = ordered.map((k, i) => {
        const upper = i === 0 ? maxScore : ordered[i - 1].min - step;
        const range = upper < k.min ? '–' : upper === k.min ? fmtScore(k.min) : `${fmtScore(k.min)} – ${fmtScore(upper)}`;
        return h(
          'tr',
          null,
          h('td', null, UI.gradeBadge(k.p, level)),
          level === 'mss' ? h('td', { class: 'muted' }, G.wholeGrade(k.p) + G.tendency(k.p)) : null,
          h('td', { class: 'num' }, range),
          h('td', { class: 'num strong' }, counts[k.p] || '')
        );
      });
      return h(
        'table',
        { class: 'table compact' },
        h('thead', null, h('tr', null, h('th', null, level === 'mss' ? 'Punkte' : 'Note'), level === 'mss' ? h('th', null, 'Note') : null, h('th', { class: 'num' }, 'Rohpunkte'), h('th', { class: 'num' }, 'Anzahl'))),
        h('tbody', null, rows)
      );
    };
    const ids = students.map((s) => s.id);
    // Getrennt benotete Teile: Punkteverteilung je Teil (eigener Schlüssel)
    const distTables = G.separateParts(t)
      ? t.parts.map((part) => {
          const pt = G.partAsTest(t, part);
          return [h('h2', null, 'Punkteverteilung ' + part.name), rangeTable(G.keyForPart(t, part, level), G.testMaxScore(pt), Number(pt.precision) || 1, G.partStats(t, part, ids, level).counts)];
        })
      : [h('h2', null, 'Punkteverteilung'), rangeTable(G.keyForTest(t, level), max, step, st.counts)];
    const close = () => {
      document.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      overlay.remove();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const overlay = h(
      'div',
      { class: 'beamer', role: 'dialog', 'aria-label': 'Beamer-Ansicht' },
      h('button', { class: 'btn beamer-close', onclick: close, title: 'Schließen (Esc)' }, '✕ Schließen'),
      h('h1', null, a.name || 'Test', h('span', { class: 'muted' }, ' · ' + fmtDate(a.date))),
      h(
        'div',
        { class: 'beamer-body' },
        h(
          'section',
          null,
          h('h2', null, 'Notenspiegel'),
          distribution(st, level),
          h(
            'div',
            { class: 'stats' },
            h('div', null, h('span', { class: 'muted' }, 'Teilnehmende'), h('strong', null, st.n)),
            h('div', null, h('span', { class: 'muted' }, 'Ø Note'), h('strong', null, fmtNum(st.avgDec, 2))),
            level === 'mss' ? h('div', null, h('span', { class: 'muted' }, 'Ø Punkte'), h('strong', null, fmtNum(st.avgPoints, 2))) : null,
            sdTile(st, level),
            weakTile(st),
            h('div', null, h('span', { class: 'muted' }, 'Höchstpunktzahl'), h('strong', null, fmtScore(max)))
          ),
          taskRows.length ? h('h2', { class: 'beamer-sub' }, 'Ø erreicht je Aufgabe') : null,
          taskRows.length ? h('div', { class: 'task-bars' }, taskRows) : null
        ),
        h('section', null, distTables)
      )
    );
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    // Vollbild per Esc verlassen schließt auch die Ansicht
    overlay.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) close();
    });
  }

  // ---------- Moodle ----------

  function moodleCard(course, db, a, part) {
    const mo = part ? part.moodle : a.test.moodle;
    const kindLabel = { answers: 'Antworten', grades: 'Bewertungen' };
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, part ? `Moodle – ${part.name}` : 'Moodle'),
        h('span', { class: 'muted small' }, 'Importiert am ', new Date(mo.importedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }))
      ),
      h(
        'div',
        { class: 'inline wrap' },
        (mo.files || []).map((f) => h('button', { class: 'btn btn-sm', title: 'Gespeicherte Originaldatei herunterladen', onclick: () => NM.util.download(f.name, f.text, 'text/csv;charset=utf-8') }, `⬇ ${kindLabel[f.kind] || 'CSV'}: ${f.name}`)),
        h('button', { class: 'btn btn-sm', title: 'z. B. nach Korrekturen in Moodle: Punkte neu übernehmen, eigene Aufgaben und Einstellungen bleiben', onclick: () => moodleImport(course, db, a.half, a, part ? part.id : null) }, '⬆ Erneut importieren')
      ),
      (mo.files || []).some((f) => f.kind === 'grades')
        ? null
        : h('p', { class: 'muted small' }, 'Ohne Bewertungen-CSV: Punkte per Textvergleich (Antwort = richtige Antwort). Korrekturen, die in Moodle von Hand vorgenommen wurden, fehlen.')
    );
  }

  /** Dialog: Moodle-CSV-Dateien wählen, Personen zuordnen, in einen neuen (target = null) oder bestehenden Test (ggf. in einen Teil) übernehmen. */
  async function moodleImport(course, db, half, target, partId = null) {
    const part = target && partId ? (target.test.parts || []).find((x) => x.id === partId) : null;
    const again = target && (part ? !!part.moodle : !!target.test.moodle);
    const MO = NM.moodle;
    const students = M.activeStudents(course);
    let parsed = null;
    let map = new Map();
    const box = h('div');
    const name = h('input', { class: 'input' });
    // Bisherige eigene Aufgaben (ohne Moodle-Frage) des Tests bzw. Teils: ersetzen? Vorausgewählt, solange keine Punkte eingetragen sind
    const filled = (v) => v !== null && v !== undefined && v !== '';
    const own = target ? (part ? G.partTasks(target.test, part) : target.test.tasks).filter((x) => x.moodleNr === undefined) : [];
    const scored = own.filter((x) => Object.values(target.test.results || {}).some((r) => filled((r.scores || {})[x.id])));
    const anyScore = target && Object.values(target.test.results || {}).some((r) => Object.values(r.scores || {}).some(filled));
    // Frisch angelegter Test: Bezeichnung und Datum aus Moodle übernehmen
    const adopt = !!target && !part && !again && !anyScore && target.name === 'Neuer Test';
    const replace = h('input', { type: 'checkbox', checked: !again && !scored.length, 'data-moodle-replace': '', onchange: () => (replaceWarn.hidden = !(replace.checked && scored.length)) });
    const replaceWarn = h('div', { class: 'alert alert-danger', hidden: !(replace.checked && scored.length) }, `Eingetragene Punkte in ${scored.map((x) => x.name).join(', ')} werden gelöscht.`);
    const fileInput = h('input', {
      class: 'input',
      type: 'file',
      accept: '.csv,text/csv',
      multiple: true,
      onchange: async (e) => {
        const files = await Promise.all([...e.target.files].map(async (f) => ({ name: f.name, text: await f.text() })));
        parsed = MO.parseExport(files);
        map = MO.matchStudents(parsed.persons, students);
        if (!target || adopt) name.value = parsed.title;
        renderMap();
      },
    });

    function renderMap() {
      clear(box);
      const kinds = parsed.files.map((f) => f.kind);
      box.append(
        parsed.warnings.map((w) => h('div', { class: 'alert alert-danger' }, w)),
        !parsed.files.length
          ? null
          : h(
              'p',
              { class: 'small' },
              kinds.includes('answers') ? '✓ Antworten-CSV (Fragen und Antworten)' : '– keine Antworten-CSV: der Ausdruck enthält keine Fragen und Antworten',
              h('br'),
              kinds.includes('grades') ? '✓ Bewertungen-CSV (Punkte je Frage, mit Korrekturen aus Moodle)' : '– keine Bewertungen-CSV: Punkte per Textvergleich, Korrekturen in Moodle fehlen',
              h('br'),
              `${parsed.questions.length} Fragen · ${parsed.persons.length} Personen`
            )
      );
      if (!parsed.persons.length) return;
      const assigned = new Set(map.values());
      const rows = parsed.persons.map((p) =>
        h(
          'tr',
          null,
          h('td', null, [p.last, p.first].filter(Boolean).join(', ') || p.email, p.email ? h('div', { class: 'muted small' }, p.email) : null),
          h('td', null, p.finished ? 'beendet' : h('span', { class: 'muted' }, 'nicht beendet → fehlt')),
          h('td', { class: 'num' }, p.finished && p.total !== null ? `${fmtScore(p.total)} / ${fmtScore(parsed.totalMax)}` : ''),
          h(
            'td',
            null,
            h(
              'select',
              {
                class: 'input input-sm',
                onchange: (e) => {
                  if (e.target.value) map.set(p, e.target.value);
                  else map.delete(p);
                  renderMap();
                },
              },
              h('option', { value: '' }, '— nicht übernehmen —'),
              students.map((s) => h('option', { value: s.id, selected: map.get(p) === s.id }, M.studentName(s) + (assigned.has(s.id) && map.get(p) !== s.id ? ' (schon zugeordnet)' : '')))
            )
          )
        )
      );
      const without = students.filter((s) => !assigned.has(s.id));
      box.append(
        h('div', { class: 'table-wrap short' }, h('table', { class: 'table compact' }, h('thead', null, h('tr', null, h('th', null, 'Moodle'), h('th', null, 'Status'), h('th', { class: 'num' }, 'Punkte'), h('th', null, 'Kursmitglied'))), h('tbody', null, rows))),
        without.length ? h('p', { class: 'muted small' }, 'Ohne Moodle-Ergebnis (bekommen „fehlt“, wenn noch keine Punkte eingetragen sind): ', without.map(M.studentName).join('; ')) : null
      );
    }

    const v = await modal({
      title: !target ? 'Moodle-Import' : part ? `Moodle-Import in „${part.name}“: ${target.name}` : again ? `Moodle-Import erneut: ${target.name}` : `Moodle-Import: ${target.name}`,
      wide: true,
      body: h(
        'div',
        null,
        h('p', { class: 'small' }, 'Aus Moodle (Test → Ergebnisse) die Antworten-CSV und die Bewertungen-CSV herunterladen und hier beide auswählen. Die Note berechnet OrdoNota mit dem eigenen Notenschlüssel. Beide Dateien werden verschlüsselt im Test gespeichert.'),
        again ? h('p', { class: 'small' }, 'Die Punkte der Moodle-Fragen werden ersetzt. Eigene Aufgaben, Notenschlüssel und Einstellungen bleiben erhalten.') : null,
        part && !again ? h('p', { class: 'small' }, `Jede Moodle-Frage wird eine Aufgabe (F1, F2, …) im Teil „${part.name}“. Die anderen Teile bleiben unverändert.`) : null,
        target && !part && !again ? h('p', { class: 'small' }, 'Jede Moodle-Frage wird eine Aufgabe (F1, F2, …) dieses Tests.' + (adopt ? ' Bezeichnung und Datum kommen aus Moodle.' : '')) : null,
        h('label', { class: 'field' }, h('span', null, 'CSV-Dateien (eine oder beide)'), fileInput),
        !target || adopt ? h('label', { class: 'field' }, h('span', null, 'Bezeichnung'), name) : null,
        own.length
          ? h(
              'div',
              null,
              h('label', { class: 'check' }, replace, ` Bisherige Aufgaben ersetzen (${own.map((x) => x.name).join(', ')})`),
              h('p', { class: 'muted small' }, 'Mit Haken werden diese Aufgaben samt Punkten entfernt, ohne Haken kommen die Moodle-Fragen zusätzlich dazu.'),
              replaceWarn
            )
          : null,
        box
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        {
          label: 'Importieren',
          value: 'ok',
          kind: 'primary',
          validate: () => {
            if (!parsed || !parsed.persons.length) return toast('Bitte zuerst die Moodle-CSV-Dateien wählen.', 'error'), false;
            if (new Set(map.values()).size !== map.size) return toast('Ein Kursmitglied ist mehreren Moodle-Personen zugeordnet.', 'error'), false;
            return true;
          },
        },
      ],
    });
    if (v !== 'ok') return;
    const sum = MO.applyImport(course, target, parsed, map, { half, settings: db.settings, name: name.value.trim(), partId, replace: own.length > 0 && replace.checked, adopt });
    NM.app.state.ui.testId[course.id] = sum.assessment.id;
    NM.app.saveUi();
    NM.app.commit();
    toast(`Moodle-Import: ${sum.imported} Ergebnisse übernommen` + (sum.missing.length ? `, ${sum.missing.length} × „fehlt“` : '') + '.', 'info', 5000);
    if (sum.mismatch.length) toast(`Hinweis: Bei ${sum.mismatch.join(', ')} weicht die Summe der Fragenpunkte (gerundet) von der Moodle-Bewertung ab.`, 'warn', 9000);
  }

  /** Dialog: Moodle-Rückmeldung drucken (alle oder eine Person, mit oder ohne Note). */
  async function moodlePrint(course, a) {
    const level = G.courseLevel(course);
    const withResult = M.activeStudents(course).filter((s) => G.testResult(a.test, s.id, level).score !== null);
    const who = h('select', { class: 'input' }, h('option', { value: '' }, `Alle (${withResult.length}, je eine Seite)`), withResult.map((s) => h('option', { value: s.id }, M.studentName(s))));
    const grade = h('input', { type: 'checkbox', checked: true });
    const v = await modal({
      title: 'Moodle-Rückmeldung drucken',
      body: h('div', null, h('label', { class: 'field' }, h('span', null, 'Wer'), who), h('label', { class: 'check' }, grade, ' Note mit ausdrucken')),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: '🖨 Drucken', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    if (!withResult.length) return toast('Noch keine Ergebnisse zum Drucken.', 'error');
    NM.print.moodle(course, a, { sid: who.value || null, withGrade: grade.checked });
  }

  NM.views.tests = { render, moodleImport, keyCardFor, gradeStepsSelect, limitInput };
})((globalThis.NM = globalThis.NM || {}));
