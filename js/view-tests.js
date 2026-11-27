/* OrdoNota – Reiter „Tests“: Rohpunkte erfassen, Notenschlüssel, Notenspiegel. */
(function (NM) {
  'use strict';
  const { h, icon, clear, modal, toast, confirmDialog, parseNum, uid, fmtNum, fmtScore, fmtDate, todayISO, gradeStyle } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  function render(view, { course, db }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course);
    const inHalf = course.assessments.filter((a) => a.kind === 'test' && a.half === half);
    const ui = NM.app.state.ui;
    // 2.11: Umschalter „Benotet | Kompetenztests | Alle“, nur wenn das Halbjahr Kompetenztests hat
    const C = NM.competencies;
    const hasComp = inHalf.some((a) => C.isCompetencyTest(a));
    ui.testFilter = ui.testFilter || {};
    const filter = hasComp ? ui.testFilter[course.id] || 'all' : 'all';
    const tests = filter === 'graded' ? inHalf.filter((a) => !C.isCompetencyTest(a)) : filter === 'comp' ? inHalf.filter((a) => C.isCompetencyTest(a)) : inHalf;
    const filterSwitch = hasComp
      ? UI.segSwitch(
          'Welche Tests',
          [
            { id: 'graded', label: 'Benotet', title: 'Alle Tests außer Kompetenztests' },
            { id: 'comp', label: 'Kompetenztests', title: 'Nicht gewertete Tests mit Kompetenzen' },
            { id: 'all', label: 'Alle' },
          ],
          filter,
          (id) => {
            ui.testFilter[course.id] = id;
            NM.app.saveUi();
            NM.app.rerender();
          },
          { 'data-test-filter': '' }
        )
      : null;
    // Ohne Auswahl: die neueste Arbeit, die kein Nachschreibtermin ist
    let cur = tests.find((t) => t.id === ui.testId[course.id]) || tests.filter((t) => !G.isMakeup(course, t)).pop() || tests[tests.length - 1] || null;

    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Tests'), UI.halfSwitch(course, false), filterSwitch),
      catalogOffer(course, db),
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
          if (filter === 'comp') ui.testFilter[course.id] = 'all'; // der neue Test ist noch kein Kompetenztest
          NM.app.saveUi();
          NM.app.commit();
        },
        addLabel: '+ Neuer Test',
        sub: (a) => {
          const st = G.testStats(a.test, M.statStudents(course).map((s) => s.id), level);
          const o = G.makeupTarget(course, a);
          return [fmtDate(a.date), o ? 'Nachschreibtermin zu „' + o.name + '“' : UI.catLabel(a.cat), a.ungraded ? 'nicht gewertet' : null, st.n ? 'Ø ' + fmtNum(level === 'mss' ? st.avgPoints : st.avgDec, 2) : null].filter(Boolean).join(' · ');
        },
      })
    );
    if (!cur && inHalf.length) {
      view.appendChild(UI.emptyState(filter === 'comp' ? 'Keine Kompetenztests in ' + half : 'Keine benoteten Tests in ' + half, 'Mit „Alle“ sehen Sie wieder alle Tests des Halbjahres.', null, 'list-check'));
      return;
    }
    if (!cur) {
      view.appendChild(UI.emptyState('Noch kein Test in ' + half, 'Legen Sie einen Test an: Aufgaben mit Höchstpunktzahlen festlegen, Rohpunkte eintragen – Note, Notenspiegel und Drittelparagraph werden automatisch berechnet.', null, 'list-check'));
      return;
    }
    const t = cur.test;
    const moodleCards = [t.moodle ? moodleCard(course, db, cur, null) : null, ...(G.hasParts(t) ? t.parts.filter((x) => x.moodle).map((x) => moodleCard(course, db, cur, x)) : [])];
    const scriptoCard = NM.scripto.dataOf(course, cur) ? scriptoCardFor(course, db, cur) : null;
    view.append(...[metaCard(course, cur, level), ...moodleCards, scriptoCard, G.hasParts(t) ? partsCard(course, db, cur, level) : null, tasksCard(course, db, cur), competenciesCard(course, db, cur), h('div', { class: 'test-layout' }, h('div', { class: 'tests-main' }, resultsCard(course, cur, level), verbalCard(course, cur, level)), keyCard(course, cur, level))].filter(Boolean));
  }

  // ---------- Einstieg Kompetenzen (2.21, PLANUNG.md AQ-1) ----------

  /** Hinweis oben im Reiter: Für das Fach gibt es einen Kompetenzkatalog (nur ohne Katalog am Kurs). */
  function catalogOffer(course, db) {
    const C = NM.competencies;
    const offer = C.offerFor(db, course);
    if (!offer) return '';
    return h(
      'div',
      { class: 'notice comp-offer', 'data-comp-offer': '' },
      h('p', null, `Für ${course.fach} gibt es den Kompetenzkatalog „${offer.name}“. Damit tragen Aufgaben Kompetenzen, und der Reiter „Kompetenzen“ zeigt, was jede Person schon sicher kann.`),
      h(
        'div',
        { class: 'inline' },
        h(
          'button',
          {
            class: 'btn btn-sm btn-primary',
            'data-comp-offer-take': '',
            onclick: () => {
              const cat = C.takeOffer(db, course, offer);
              NM.app.commit({ render: false });
              NM.app.renderShell();
              toast(`Kompetenzkatalog „${cat.name}“ gewählt. Die Kompetenzen tragen Sie in der Karte „Kompetenzen“ je Test ein.`, 'info', 6000);
            },
          },
          'Katalog wählen'
        ),
        h(
          'button',
          {
            class: 'btn btn-sm btn-ghost',
            'data-comp-offer-off': '',
            title: 'Später in den Kursdaten unter „Kompetenzkatalog“ wählen',
            onclick: () => {
              course.catalogHintOff = true;
              NM.app.commit();
            },
          },
          'Nicht jetzt'
        )
      )
    );
  }

  /** Leiser Hinweis in der Karte „Aufgaben“, solange der Kurs keinen Katalog hat. */
  function noCatalogHint(course, db) {
    if (NM.competencies.forCourse(db, course) || NM.competencies.offerFor(db, course)) return null;
    return h(
      'p',
      { class: 'muted small', 'data-comp-nocat': '' },
      'Kompetenzen je Aufgabe gibt es mit einem Kompetenzkatalog am Kurs. ',
      h(
        'button',
        {
          class: 'link',
          'data-comp-nocat-go': '',
          onclick: () => {
            NM.app.select({ tab: 'course' });
            setTimeout(() => {
              const el = document.querySelector('[data-course-catalog]');
              if (el) el.focus();
            }, 0);
          },
        },
        'In den Kursdaten wählen'
      )
    );
  }

  /** Ändert sich, ob ein Test ein Kompetenztest ist, Umschalter auf „Alle“, damit er nicht aus der Liste verschwindet. */
  function keepInList(course) {
    const f = NM.app.state.ui.testFilter;
    if (f && f[course.id] && f[course.id] !== 'all') {
      delete f[course.id];
      NM.app.saveUi();
    }
  }

  function metaCard(course, a, level) {
    const t = a.test;
    const sep = G.separateParts(t);
    const set = (fn) => (e) => {
      fn(e.target.value);
      NM.app.commit();
    };
    const orig = G.makeupTarget(course, a);
    const makeups = G.makeupsOf(course, a);
    const openTest = (x) => {
      NM.app.state.ui.testId[course.id] = x.id;
      NM.app.saveUi();
      NM.app.rerender();
    };
    // Verknüpfung als Nachschreibtermin (nicht bei Arbeiten, die selbst Nachschreibtermine haben)
    const candidates = makeups.length ? [] : course.assessments.filter((x) => x.kind === 'test' && x !== a && x.half === a.half && !x.makeupOf);
    const linkField =
      orig || candidates.length
        ? h(
            'label',
            { class: 'field', title: 'Ein Nachschreibtermin zählt mit der Original-Arbeit als eine Note: Wer hier Punkte oder einen Status hat, bekommt diese Note statt der aus der Arbeit.' },
            h('span', null, 'Nachschreibtermin zu'),
            h(
              'select',
              {
                class: 'input',
                'data-makeup-of': '',
                onchange: (e) => {
                  if (e.target.value) a.makeupOf = e.target.value;
                  else delete a.makeupOf;
                  NM.app.commit();
                },
              },
              h('option', { value: '', selected: !orig }, '– (eigene Leistung)'),
              candidates.map((x) => h('option', { value: x.id, selected: orig === x }, x.name))
            )
          )
        : null;
    const makeupInfo = orig
      ? h(
          'p',
          { class: 'muted small makeup-info' },
          'Zählt mit ',
          h('button', { class: 'link', onclick: () => openTest(orig) }, '„' + orig.name + '“'),
          ' als eine Note (Bereich, Gewicht und Wertung wie dort). Wer hier Punkte oder einen Status hat, bekommt diese Note statt der aus der Arbeit.'
        )
      : makeups.length
        ? h(
            'p',
            { class: 'muted small makeup-info' },
            makeups.length === 1 ? 'Nachschreibtermin: ' : 'Nachschreibtermine: ',
            makeups.map((m, i) => [i ? ', ' : '', h('button', { class: 'link', onclick: () => openTest(m) }, m.name + ' (' + fmtDate(m.date) + ')')]),
            ' – in der Notenübersicht eine gemeinsame Spalte.'
          )
        : null;
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'form-row' },
        h('label', { class: 'field grow' }, h('span', null, 'Bezeichnung'), h('input', { class: 'input', value: a.name, 'data-focus-key': 'test-name', onchange: set((v) => (a.name = v.trim() || a.name)) })),
        h('label', { class: 'field' }, h('span', null, 'Datum'), h('input', { class: 'input', type: 'date', value: a.date, onchange: set((v) => (a.date = v)) })),
        linkField,
        orig ? null : h(
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
        orig ? null : h(
          'label',
          { class: 'field' },
          h('span', null, 'Wertung'),
          h(
            'label',
            { class: 'check field-check', title: 'Der Test erscheint ausgegraut in der Notenübersicht und zählt nicht zur Halbjahresnote. Mit Kompetenzen ist er ein Kompetenztest: Die Notenübersicht zeigt ihn nur auf Wunsch.' },
            h('input', {
              type: 'checkbox',
              checked: !!a.ungraded,
              onchange: (e) => {
                if (e.target.checked) a.ungraded = true;
                else delete a.ungraded;
                keepInList(course);
                NM.app.commit();
              },
            }),
            ' nicht gewertet'
          )
        ),
        orig ? null : h(
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
            orig
              ? null
              : h(
                  'button',
                  {
                    class: 'btn',
                    'data-new-makeup': '',
                    title: 'Neuen Test für die Nachschreibenden anlegen: Aufgaben und Notenschlüssel werden als Vorlage übernommen, in der Notenübersicht bleibt es eine Spalte.',
                    onclick: () => {
                      const m = M.newMakeup(course, a);
                      course.assessments.push(m);
                      NM.app.state.ui.testId[course.id] = m.id;
                      NM.app.saveUi();
                      NM.app.commit();
                      toast('Nachschreibtermin angelegt – Aufgaben und Schlüssel aus „' + a.name + '“ übernommen.', 'success');
                    },
                  },
                  '+ Nachschreibtermin'
                ),
            h('button', { class: 'btn', title: 'Notenspiegel und Punkteverteilung ohne Namen im Vollbild', onclick: () => beamerView(course, a, level) }, icon('arrows-maximize'), ' Beamer'),
            printButton(course, a),
            h(
              'button',
              {
                class: 'icon-btn danger',
                title: 'Test löschen',
                'aria-label': 'Test löschen',
                onclick: async () => {
                  if (!(await confirmDialog('Test löschen?', `„${a.name}“ mit allen Ergebnissen löschen?` + (makeups.length ? ' Die Nachschreibtermine bleiben als eigene Tests erhalten.' : ''), { okLabel: 'Löschen', danger: true }))) return;
                  course.assessments = course.assessments.filter((x) => x.id !== a.id);
                  for (const m of makeups) delete m.makeupOf;
                  NM.app.commit();
                },
              },
              icon('trash')
            )
          )
        )
      ),
      makeupInfo
    );
  }

  /** Alle Ausdrucke eines Tests in einem Auswahlfenster. */
  function printButton(course, a) {
    const t = a.test;
    const ka = a.cat === 'ka';
    return UI.printButton('Drucken: ' + a.name, [
      { id: 'list', icon: 'file-text', label: 'Ergebnisliste', group: 'teacher', tip: 'Alle Personen mit Punkten je Aufgabe, Summe, Prozent und Note' + (ka ? ', mit Spalte „Unterschrift“' : '') + '; darunter Notenspiegel und Notenschlüssel.', run: () => NM.print.test(course, a, 'list') },
      G.hasParts(t) ? { id: 'parts', icon: 'puzzle', label: 'Ergebnisse nach Teilen', group: 'teacher', tip: 'Kompakt: je Person Punkte, Prozent und (bei getrennter Benotung) Note jedes Teils sowie gesamt; darunter Notenspiegel und Schlüssel.', run: () => NM.print.test(course, a, 'parts') } : null,
      { id: 'key', icon: 'chart-bar', label: 'Notenschlüssel und Notenspiegel', group: 'teacher', tip: 'Punktschwellen je Note und Verteilung der Noten mit Statistik und Drittelparagraph – ohne Namen, z. B. für Klassenbuch oder Fachleitung.', run: () => NM.print.test(course, a, 'key') },
      { id: 'students', icon: 'scissors', label: 'Ergebniszettel zum Ausschneiden', group: 'students', tip: 'Je Person ein Abschnitt mit erreichten und möglichen Punkten je Aufgabe, Prozent und Note – mehrere pro Blatt. Bei I-Status mit Verbalbeurteilung steht der Text statt Prozent und Note.', run: () => NM.print.test(course, a, 'students') },
      NM.scripto.dataOf(course, a) ? { id: 'scripto', icon: 'bookmark', label: 'Trennblätter für OrdoScripto', group: 'teacher', tip: 'Je Person eine A4-Seite mit Name, Klasse und QR-Code (Test- und Schüler-ID) – vor die Arbeit legen und mit einscannen; wahlweise nur für die Nachschreibenden.', run: () => scriptoPrint(course, a) } : null,
      NM.moodle.hasData(t) ? { id: 'moodle', icon: 'message', label: 'Moodle-Rückmeldung je Person', group: 'students', tip: 'Je Person eine Seite mit Frage, gegebener Antwort, Lösung und Punkten; Note wahlweise, Felder für Datum und Unterschrift.', run: () => moodlePrint(course, a) } : null,
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
            h('button', { class: 'btn btn-sm', title: `Moodle-Test in den Teil „${part.name}“ übernehmen`, onclick: () => moodleImport(course, db, a.half, a, part.id) }, icon('upload'), ' Moodle'),
            h('button', { class: 'icon-btn', title: 'Teil entfernen', 'aria-label': 'Teil entfernen: ' + part.name, onclick: () => removePart(a, part) }, icon('x'))
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
    const cat = NM.competencies.forCourse(db, course);
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
          : h('button', { class: 'btn btn-sm', 'data-focus-key': 'moodle-import', title: 'Moodle-Test aus der Antworten- und Bewertungen-CSV in diesen Test übernehmen: jede Frage wird eine Aufgabe', onclick: () => moodleImport(course, db, a.half, a) }, icon('upload'), ' Moodle-CSV'),
        // OrdoScripto: nach dem Vorbereiten weiter über die Karte „OrdoScripto“
        NM.scripto.dataOf(course, a)
          ? null
          : h('button', { class: 'btn btn-sm', 'data-scripto-prepare': '', title: 'Pseudonyme Test- und Schüler-IDs für die KI-Korrektur mit OrdoScripto vergeben; danach Trennblätter mit QR-Code drucken und die Import-CSV (ohne Namen) speichern', onclick: () => scriptoPrepare(course, db, a) }, icon('bookmark'), ' Für OrdoScripto vorbereiten')
      ),
      noCatalogHint(course, db),
      G.taskGroups(t).map(({ part, tasks }) =>
        h(
          'div',
          { class: part ? 'task-group' : null },
          part ? h('div', { class: 'task-group-head' }, h('strong', null, part.name), h('span', { class: 'muted small' }, ` · ${fmtScore(G.testMaxScore({ tasks }))} Punkte`)) : null,
          h('div', { class: 'tasks' }, tasks.map((task) => taskItem(t, task, cat)), add(part, false), add(part, true))
        )
      )
    );
  }

  // ---------- Kompetenzen je Aufgabe (seit 2.9, PLANUNG.md AI) ----------

  /** Karte „Kompetenzen“: Raster Aufgaben × Kompetenzen des Kurskatalogs; nur mit Katalog am Kurs. */
  function competenciesCard(course, db, a) {
    const C = NM.competencies;
    const cat = C.forCourse(db, course);
    if (!cat) return null;
    const t = a.test;
    const usedHere = new Set(t.tasks.flatMap((x) => x.competencies || []));
    // Ausgeblendete nur, solange eine Aufgabe dieses Tests sie trägt
    const cols = C.entries(cat).filter((e) => !e.hidden || usedHere.has(e.id));
    const bereichName = new Map(cat.bereiche.map((b) => [b.id, b.name]));
    const pts = C.pointsPer(cat, t.tasks);
    const colClass = (e, i) =>
      ['comp-col', e.level === 'teil' ? 'comp-teil' : '', e.hidden ? 'comp-hidden' : '', i === 0 || cols[i - 1].bereich !== e.bereich ? 'comp-first' : ''].filter(Boolean).join(' ');
    const colTitle = (e) => `${e.id} ${e.name}${e.level === 'teil' ? ' (Teil von ' + e.parent + ')' : ''} · ${bereichName.get(e.bereich)}${e.hidden ? ' · ausgeblendet' : ''}`;
    const cell = (task, e, i) => {
      const on = (task.competencies || []).includes(e.id);
      return h(
        'td',
        { class: colClass(e, i) },
        h('input', {
          type: 'checkbox',
          checked: on,
          disabled: e.hidden && !on,
          'aria-label': `${task.name}: ${e.id} ${e.name}`,
          'data-focus-key': `comp-${task.id}-${e.id}`,
          'data-comp': e.id,
          onchange: (ev) => {
            const was = C.isCompetencyTest(a);
            C.toggleTask(task, e.id, ev.target.checked);
            if (was !== C.isCompetencyTest(a)) keepInList(course);
            NM.app.commit();
          },
        })
      );
    };
    const row = (task) =>
      h(
        'tr',
        { 'data-comp-task': task.id, class: task.bonus ? 'comp-bonus' : null },
        h('th', { class: 'sticky-col comp-task', scope: 'row' }, h('span', { class: 'comp-task-name' }, task.name), h('span', { class: 'muted small' }, ` ${fmtScore(task.max)} P.${task.bonus ? ' · Bonus' : ''}`)),
        cols.map((e, i) => cell(task, e, i))
      );
    const body = [];
    for (const { part, tasks } of G.taskGroups(t)) {
      if (part) body.push(h('tr', { class: 'comp-part' }, h('th', { class: 'sticky-col', scope: 'rowgroup' }, part.name), cols.map((e, i) => h('td', { class: colClass(e, i) }))));
      for (const task of tasks) body.push(row(task));
    }
    const foot = cols.map((e, i) => {
      const v = pts.get(e.id) || 0;
      const few = e.level === 'komp' && v > 0 && v < C.FEW_POINTS;
      return h('td', { class: colClass(e, i) + (few ? ' comp-few' : ''), title: few ? 'wenig Daten: weniger als 3 mögliche Punkte' : null }, v ? fmtScore(v) : '–');
    });
    const none = !usedHere.size;
    return h(
      'div',
      { class: 'card', 'data-comp-card': '' },
      h('div', { class: 'card-head' }, h('h2', null, 'Kompetenzen'), h('span', { class: 'muted' }, `Katalog: ${cat.name}`)),
      none ? h('p', { class: 'muted small' }, 'Haken setzen: Welche Kompetenzen prüft eine Aufgabe? Mehrere je Aufgabe sind möglich. Die Punkte der Aufgabe zählen bei jeder.') : null,
      cols.length
        ? h(
            'div',
            { class: 'table-wrap comp-wrap', 'data-scroll-key': 'comp-grid' },
            h(
              'table',
              { class: 'table compact comp-table' },
              h('thead', null, h('tr', null, h('th', { class: 'sticky-col', scope: 'col' }, 'Aufgabe'), cols.map((e, i) => h('th', { class: colClass(e, i), scope: 'col', title: colTitle(e) }, C.short(e.id))))),
              h('tbody', null, body),
              h('tfoot', null, h('tr', null, h('th', { class: 'sticky-col', scope: 'row' }, 'Punkte je Kompetenz'), foot))
            )
          )
        : h('p', { class: 'muted small' }, `Der Katalog „${cat.name}“ enthält noch keine Kompetenzen (Einstellungen → Kompetenzkataloge).`)
    );
  }

  function taskItem(t, task, cat) {
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
      cat && task.competencies && task.competencies.length
        ? h('span', { class: 'task-comp muted small', title: 'Kompetenzen (ändern in der Karte „Kompetenzen“)' }, task.competencies.map((id) => NM.competencies.short(id)).join(' · '))
        : null,
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
        icon('x')
      )
    );
  }

  /** „Unterschriften 9 / 11“ – gezählt werden Personen mit Note (nicht fehlend/nachschreibend). */
  /** Haken „Ausgleich gewährt“ (results[sid].ausgleich) – nur Vermerk, keine Rechnung. */
  function ausgleichBox(s, r, list) {
    const what = list.map((a) => NM.people.ausgleichName(a) + (a.massnahmen ? ': ' + a.massnahmen : '')).join('; ');
    return h('input', {
      type: 'checkbox',
      checked: !!r.ausgleich,
      'data-focus-key': `ts-ausgleich-${s.id}`,
      'data-ausgleich': s.id,
      title: 'Nachteilsausgleich gewährt? (' + what + ')',
      'aria-label': 'Nachteilsausgleich gewährt: ' + M.studentName(s),
      onchange: (e) => {
        if (e.target.checked) r.ausgleich = true;
        else delete r.ausgleich;
        NM.app.commit();
      },
    });
  }

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
    // Nachschreibtermin: standardmäßig nur, wer in der Original-Arbeit fehlt/nachschreibt oder hier schon etwas hat
    const orig = G.makeupTarget(course, a);
    const showAll = !!(ui.makeupAll || {})[a.id];
    const everyone = M.activeStudents(course);
    const missing = orig ? everyone.filter((s) => missedIn(orig.test, s.id) || G.hasTestEntry(t, s.id)) : everyone;
    const all = orig && !showAll ? missing : everyone;
    const toggleAll = () => {
      ui.makeupAll = Object.assign({}, ui.makeupAll, { [a.id]: !showAll });
      if (showAll) delete ui.makeupAll[a.id];
      NM.app.saveUi();
      NM.app.rerender();
    };
    const results = new Map(all.map((s) => [s.id, G.testResult(t, s.id, level)]));
    // Nachteilsausgleich (2.5): Spalte nur, wenn jemand einen gültigen, zum Fach passenden Ausgleich hat
    const db = NM.app.db();
    const naMap = new Map(all.map((s) => [s.id, NM.people.ausgleicheFuer(db, s, course)]).filter(([, l]) => l.length));
    const na = naMap.size > 0;
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
      ausgleich: { get: (s) => (!naMap.has(s.id) ? null : (t.results[s.id] || {}).ausgleich ? 1 : 0), first: 'asc' },
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
      sign ? h('th', { class: 'center col-tight', title: 'Unterschrift unter der Arbeit gesehen' }, sort.head('signed', 'Unterschrift')) : null,
      na ? h('th', { class: 'center col-tight col-ausgleich', title: 'Nachteilsausgleich bei dieser Arbeit gewährt (nur Vermerk, ändert keine Note)' }, sort.head('ausgleich', 'Ausgleich')) : null
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
        UI.nameCells(s, null, { course }),
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
                label: `${task.name || 'Aufgabe'}: ${M.studentName(s)}`,
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
        h('td', { class: 'center' }, res.p === null ? (r.status ? h('span', { class: 'muted small' }, UI.STATUS_SHORT[r.status]) : '') : UI.gradeBadge(res.p, level), s.iStatus ? verbalHint(s, t, res) : null),
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
          : null,
        na ? h('td', { class: 'center col-ausgleich' }, naMap.has(s.id) ? ausgleichBox(s, r, naMap.get(s.id)) : null) : null
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
      h('td', { colspan: 4 + (sign ? 1 : 0) + (na ? 1 : 0) })
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
                  icon(hidden.has(part.id) ? 'chevron-right' : 'chevron-down'), ' ' + part.name
                )
              )
            : null,
          orig
            ? h(
                'button',
                { class: 'btn btn-sm', 'data-makeup-all': '', 'aria-pressed': String(showAll), title: showAll ? `Nur Personen zeigen, die in „${orig.name}“ fehlen oder nachschreiben` : 'Alle Personen des Kurses zeigen', onclick: toggleAll },
                showAll ? 'Nur Nachschreibende' : `Alle zeigen (${everyone.length})`
              )
            : null
        ),
        h('span', { class: 'muted small' }, 'Enter/↓ springt zur nächsten Person, Tab zur nächsten Aufgabe')
      ),
      students.length === 0
        ? h('p', { class: 'muted' }, orig && everyone.length ? `In „${orig.name}“ fehlt niemand und niemand schreibt nach. Über „Alle zeigen“ lassen sich trotzdem Punkte eintragen.` : 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
        : h('div', { class: 'table-wrap', 'data-scroll-key': 'test-results' }, h('table', { class: 'table grid-table' }, h('thead', null, head), h('tbody', null, rows, avgRow)))
    );
  }

  /** Fehlt die Person in der Arbeit (fehlt/Nachschreiben, auch nur in einem Teil)? */
  /** Personen mit I-Status unter den angezeigten (beim Nachschreibtermin nur die gezeigten). */
  function verbalStudents(course, a) {
    const orig = G.makeupTarget(course, a);
    const showAll = !!((NM.app.state.ui.makeupAll || {})[a.id]);
    return M.activeStudents(course).filter((s) => s.iStatus && (!orig || showAll || missedIn(orig.test, s.id) || G.hasTestEntry(a.test, s.id)));
  }

  /** Kleiner Hinweis unter der Note in der Ergebnistabelle; springt zum Textfeld der Karte „Verbalbeurteilungen“. */
  function verbalHint(s, t, res) {
    const missing = G.verbalMissing(s, t, res);
    const done = !!G.verbalText(t, s.id);
    if (!missing && !done) return null;
    return h(
      'button',
      {
        type: 'button',
        class: 'verbal-hint' + (missing ? ' missing' : ''),
        title: missing ? 'Verbalbeurteilung fehlt noch – zum Textfeld' : 'Verbalbeurteilung vorhanden – zum Textfeld',
        onclick: () => {
          const el = document.querySelector(`[data-focus-key="ts-verbal-${CSS.escape(s.id)}"]`);
          if (el) {
            el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            el.focus({ preventScroll: true });
          }
        },
      },
      missing ? 'verbal fehlt' : 'verbal ✓'
    );
  }

  /** Karte „Verbalbeurteilungen“: je Person mit I-Status Note, Text und „Note auf dem Zettel zeigen“ (2.3.0). */
  function verbalCard(course, a, level) {
    const t = a.test;
    const list = verbalStudents(course, a);
    if (!list.length) return null;
    const max = G.testMaxScore(t);
    const items = list.map((s) => ({ s, res: G.testResult(t, s.id, level), r: t.results[s.id] || {} }));
    const open = items.filter((x) => G.verbalMissing(x.s, t, x.res)).length;
    const result = (x) => {
      if (x.res.p === null) return x.r.status ? UI.STATUS_SHORT[x.r.status] : 'noch keine Note';
      return [UI.gradeBadge(x.res.p, level), x.res.score !== null && max ? ` ${fmtScore(x.res.score)} von ${fmtScore(max)} P.` : ''];
    };
    const blocks = items.map((x) => {
      const { s } = x;
      const text = G.verbalText(t, s.id);
      const missing = G.verbalMissing(s, t, x.res);
      const ensure = () => (t.results[s.id] = t.results[s.id] || { scores: {} });
      const fieldId = 'verbal-' + s.id;
      return h(
        'div',
        { class: 'verbal-item' + (missing ? ' missing' : ''), 'data-verbal': s.id },
        h(
          'div',
          { class: 'verbal-head' },
          h('label', { class: 'verbal-name', for: fieldId }, M.studentName(s)),
          h('span', { class: 'verbal-result' }, result(x)),
          missing ? h('span', { class: 'verbal-flag' }, icon('alert-triangle'), ' fehlt noch') : null
        ),
        h('textarea', {
          id: fieldId,
          class: 'input verbal-text',
          rows: 3,
          'data-focus-key': `ts-verbal-${s.id}`,
          placeholder: 'Was kann die Person schon, woran arbeitet sie weiter?',
          value: x.r.verbal || '',
          onchange: (e) => {
            const r = ensure();
            const v = e.target.value;
            if (v.trim()) r.verbal = v.replace(/\s+$/, '');
            else delete r.verbal;
            NM.app.commit();
          },
        }),
        h(
          'label',
          { class: 'check verbal-show' + (text ? '' : ' off'), title: text ? null : 'Erst mit Verbalbeurteilung: ohne Text steht auf dem Zettel die Note.' },
          h('input', {
            type: 'checkbox',
            checked: !!x.r.showGrade,
            disabled: !text,
            'data-focus-key': `ts-showgrade-${s.id}`,
            onchange: (e) => {
              const r = ensure();
              if (e.target.checked) r.showGrade = true;
              else delete r.showGrade;
              NM.app.commit();
            },
          }),
          h('span', null, 'Note auf dem Zettel zeigen', text ? null : h('span', { class: 'muted small' }, ' (erst mit Verbalbeurteilung)'))
        )
      );
    });
    return h(
      'div',
      { class: 'card verbal-card' },
      h(
        'div',
        { class: 'card-head' },
        h('div', { class: 'inline wrap' }, h('h2', null, 'Verbalbeurteilungen'), open ? h('span', { class: 'verbal-count' }, `${open} fehlt noch`) : null),
        h('span', { class: 'muted small' }, 'Für Personen mit I-Status. Steht auf dem Ergebniszettel statt der Note.')
      ),
      blocks
    );
  }

  function missedIn(test, sid) {
    const r = (test.results || {})[sid] || {};
    return r.status === 'fehlt' || r.status === 'nachschreiben' || Object.values(r.partStatus || {}).some((v) => v === 'fehlt' || v === 'nachschreiben');
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
      max: G.testMaxScore(part ? G.partAsTest(t, part) : t),
      precision: Number((part ? G.partAsTest(t, part) : t).precision) || 1,
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
   * spread = { key, max, precision }: „Punkte verteilen“ (G.spreadKey), angeboten, wenn danach weniger Stufen fehlen.
   */
  function unreachableNotice(level, lost, holder, alt, hint, spread) {
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
    const sp = spread && spread.max > 0 ? G.spreadKey(spread.key, spread.max, spread.precision) : null;
    if (sp && sp.moved.length && G.unreachableSteps(sp.key).length < lost.length)
      fixes.push(
        h('button', { class: 'btn btn-sm', 'data-key-spread': '', title: 'Jede Stufe bekommt einen eigenen Punktwert; die Grenze zum Bestehen bleibt', onclick: () => spreadDialog(level, holder, sp) }, 'Punkte verteilen')
      );
    const ownCustom = lost.some((x) => (holder.custom || {})[x.p] !== undefined || (holder.custom || {})[x.by] !== undefined);
    return h(
      'div',
      { class: 'notice warn key-warn' },
      h('div', null, icon('alert-triangle'), ` ${ownCustom ? 'Schwellen prüfen' : 'Zu wenig Punkte'}: ${lostText} ${lost.length > 1 ? 'sind' : 'ist'} nicht erreichbar (${ownCustom ? 'Schwelle nicht höher als bei' : 'gleiche Schwelle wie'} ${byText}).`),
      hint ? h('div', { class: 'muted small' }, hint) : null,
      fixes.length ? h('div', { class: 'key-warn-fixes' }, fixes) : null
    );
  }

  /** Zeigt den vorgeschlagenen Schlüssel mit allen verschobenen Stufen; „Übernehmen“ schreibt ihn in die eigenen Schwellen. */
  async function spreadDialog(level, holder, sp) {
    const moved = new Map(sp.moved.map((m) => [m.p, m]));
    const still = G.unreachableSteps(sp.key);
    const stillP = new Set(still.map((x) => x.p));
    const rows = sp.key
      .slice()
      .reverse()
      .filter((k) => k.p > 0)
      .map((k) => {
        const m = moved.get(k.p);
        return h(
          'tr',
          { class: [m ? 'custom' : '', stillP.has(k.p) ? 'unreachable' : ''].filter(Boolean).join(' ') },
          h('td', null, UI.gradeBadge(k.p, level)),
          h('td', { class: 'num muted' }, m ? fmtScore(m.from) : ''),
          h('td', { class: 'num' + (m ? ' strong' : '') }, stillP.has(k.p) ? 'entfällt' : fmtScore(k.min))
        );
      });
    const n = sp.moved.length;
    const ok = await modal({
      title: 'Punkte verteilen',
      body: h(
        'div',
        { 'data-key-spread-dialog': '' },
        h('p', null, `Jede Stufe bekommt einen eigenen Punktwert, von der Höchstpunktzahl abwärts. Die Grenze zum Bestehen bleibt, wo sie ist. ${n} ${n === 1 ? 'Stufe wird' : 'Stufen werden'} verschoben (fett).`),
        still.length ? h('p', { class: 'muted small' }, `Für alle Stufen reichen die Punkte nicht: ${still.map((x) => G.label(x.p, level)).join(', ')} ${still.length === 1 ? 'entfällt' : 'entfallen'}.`) : null,
        h(
          'table',
          { class: 'table compact key-table' },
          h('thead', null, h('tr', null, h('th', null, level === 'mss' ? 'Punkte' : 'Note'), h('th', { class: 'num' }, 'bisher ab'), h('th', { class: 'num' }, 'neu ab'))),
          h('tbody', null, rows)
        ),
        h('p', { class: 'muted small' }, 'Danach lassen sich die Schwellen wie gewohnt von Hand ändern; „Zurücksetzen“ stellt den berechneten Schlüssel wieder her.')
      ),
      buttons: [
        { label: 'Abbrechen', value: false },
        { label: 'Übernehmen', value: true, kind: 'primary' },
      ],
    });
    if (ok !== true) return;
    holder.custom = Object.assign({}, holder.custom || {}, sp.custom);
    NM.app.commit();
  }

  /**
   * Notenschlüssel-Karte (auch für Präsentationen): Schlüssel mit änderbaren Schwellen (holder.custom),
   * darunter Notenspiegel, Statistik und Drittelparagraph aus st.
   */
  function keyCardFor(course, level, { focusId, key, counts, holder, st, results, top = null, statsTitle = null, alt = null, hint = '', max = 0, precision = 1 }) {
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
          h('td', { title: lostP.has(k.p) ? 'Nicht erreichbar: gleiche Schwelle wie eine bessere Note' : null }, UI.gradeBadge(k.p, level), lostP.has(k.p) ? [' ', icon('alert-triangle')] : null),
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
                  'aria-label': `Mindestpunkte für ${G.label(k.p, level)}`,
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
      lost.length ? unreachableNotice(level, lost, holder, alt, hint, { key, max, precision }) : null,
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
      h('button', { class: 'btn beamer-close', onclick: close, title: 'Schließen (Esc)' }, icon('x'), ' Schließen'),
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
    const kindLabel = { answers: 'Antworten', grades: 'Bewertungen', komp: 'Kompetenzen' };
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
        (mo.files || []).map((f) =>
          h('button', { class: 'btn btn-sm', title: 'Gespeicherte Originaldatei herunterladen', onclick: () => NM.util.download(f.name, f.text, f.kind === 'komp' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8') }, icon('download'), ` ${kindLabel[f.kind] || 'CSV'}: ${f.name}`)
        ),
        h('button', { class: 'btn btn-sm', title: 'z. B. nach Korrekturen in Moodle: Punkte neu übernehmen, eigene Aufgaben und Einstellungen bleiben', onclick: () => moodleImport(course, db, a.half, a, part ? part.id : null) }, icon('upload'), ' Erneut importieren'),
        (mo.files || []).some((f) => f.kind === 'answers')
          ? h('button', { class: 'btn btn-sm', 'data-comp-companion': '', title: 'Begleitdatei aus dem Bauskript einlesen: Kompetenzen je Frage, Punkte bleiben', onclick: () => companionImport(course, db, a, part) }, icon('upload'), ' Kompetenzen zuordnen')
          : null
      ),
      (mo.files || []).some((f) => f.kind === 'grades')
        ? null
        : h('p', { class: 'muted small' }, 'Ohne Bewertungen-CSV: Punkte per Textvergleich (Antwort = richtige Antwort). Korrekturen, die in Moodle von Hand vorgenommen wurden, fehlen.')
    );
  }

  /**
   * Abschnitt „Kompetenzen“ für den Moodle-Import: Fragen der Begleitdatei zuordnen, unbekannte Kennungen klären.
   * set(parsed) zeichnet neu, apply() legt bei Bedarf Katalog und Kennungen an und liefert { nr: [kennung] } (oder null).
   */
  function companionPlan(course, db, test, part) {
    const C = NM.competencies;
    const MO = NM.moodle;
    const box = h('div', { class: 'comp-import', 'data-comp-import': '' });
    let parsed = null;
    let rows = [];
    let choice = {}; // kennung → '' (weglassen) | 'add:<Bereich>' | 'map:<Kennung>'
    let useCat = true;
    const before = test ? MO.tasksByNr(test, part) : {};

    function info() {
      const comp = parsed.companion;
      const cur = C.forCourse(db, course);
      if (cur) return { cat: cur, mode: 'course' };
      const known = comp.katalog.id ? C.byId(db, comp.katalog.id) : null;
      if (known) return { cat: known, mode: 'known' };
      const tpl = C.TEMPLATES.find((x) => x.catalog.id === comp.katalog.id);
      if (tpl) return { cat: tpl.catalog, mode: 'template', tpl };
      return { cat: null, mode: 'none' };
    }
    const active = () => {
      const i = info();
      return i.cat && (i.mode === 'course' || useCat) ? i : null;
    };
    /** Unbekannte Kennungen der zugeordneten Fragen: [{ id, nrs }] */
    function unknown(cat) {
      const out = new Map();
      for (const r of rows) {
        if (r.frage === null) continue;
        for (const id of parsed.companion.fragen[r.frage].kompetenzen) if (!C.find(cat, id)) out.set(id, (out.get(id) || []).concat(r.nr));
      }
      return [...out].map(([id, nrs]) => ({ id, nrs }));
    }
    const statusText = { ambig: 'nicht eindeutig', none: 'kein Treffer', random: 'verschiedene Texte (Zufallsfrage?)' };

    function draw() {
      clear(box);
      const comp = parsed && parsed.companion;
      if (!comp) return;
      const i = info();
      const notes = [];
      if (i.mode === 'known' || i.mode === 'template')
        notes.push(
          h(
            'label',
            { class: 'check' },
            h('input', { type: 'checkbox', checked: useCat, 'data-comp-use-cat': '', onchange: (e) => ((useCat = e.target.checked), draw()) }),
            i.mode === 'known' ? ` Katalog „${i.cat.name}“ für den Kurs übernehmen` : ` Vorlage „${i.tpl.label}“ übernehmen und für den Kurs wählen`
          )
        );
      if (i.mode === 'none')
        notes.push(
          h(
            'div',
            { class: 'alert alert-warn' },
            `Der Kurs hat keinen Kompetenzkatalog, und den Katalog „${comp.katalog.id || '?'}“ der Begleitdatei gibt es in OrdoNota nicht. Die Kompetenzen werden nicht übernommen. Katalog zuerst unter Einstellungen → Kompetenzkataloge importieren.`
          )
        );
      if (i.mode === 'course' && comp.katalog.id && comp.katalog.id !== i.cat.id)
        notes.push(h('div', { class: 'alert alert-warn' }, `Die Begleitdatei nutzt den Katalog „${comp.katalog.id}“, der Kurs „${i.cat.name}“ (${i.cat.id}). Unbekannte Kennungen unten zuordnen.`));
      else if (i.cat && comp.katalog.version !== null && comp.katalog.version > (i.cat.version || 0))
        notes.push(h('div', { class: 'alert alert-warn' }, `Die Begleitdatei wurde mit Version ${comp.katalog.version} des Katalogs gebaut, in OrdoNota ist Version ${i.cat.version || 0}. Fehlen Kennungen, den Katalog neu importieren.`));
      const act = active();
      const allNoText = rows.length && rows.every((r) => r.status === 'notext');
      const hits = rows.filter((r) => r.frage !== null).length;
      const head = h(
        'p',
        { class: 'small' },
        `✓ Begleitdatei${comp.test ? ` „${comp.test}“` : ''}: ${comp.fragen.length} Fragen, Katalog ${comp.katalog.id || '?'}${comp.katalog.version !== null ? ` (Version ${comp.katalog.version})` : ''}`,
        rows.length && !allNoText ? h('br') : null,
        rows.length && !allNoText ? `${hits} von ${rows.length} Moodle-Fragen zugeordnet` : null
      );
      box.append(h('h3', { class: 'comp-import-title' }, 'Kompetenzen'), head, ...notes);
      if (!rows.length) return;
      if (allNoText) return box.append(h('div', { class: 'alert alert-warn' }, 'Für die Kompetenzen braucht es die Antworten-CSV: Dort steht der Fragetext, über den OrdoNota die Fragen zuordnet.'));
      const opts = (r) => [
        h('option', { value: '' }, '— keine —'),
        comp.fragen.map((f, k) => h('option', { value: String(k), selected: r.frage === k }, f.name || `Frage ${k + 1}`)),
      ];
      const chips = (r) => {
        if (r.frage === null) {
          const old = (before[r.nr] && before[r.nr].competencies) || [];
          return old.length ? h('span', { class: 'muted small' }, 'bleibt: ' + old.join(', ')) : null;
        }
        const ids = comp.fragen[r.frage].kompetenzen;
        const old = (before[r.nr] && before[r.nr].competencies) || [];
        const changed = old.length && old.join('|') !== ids.join('|');
        return [
          ids.length ? ids.map((id) => h('span', { class: 'chip' + (act && !C.find(act.cat, id) ? ' chip-unknown' : ''), title: act && C.find(act.cat, id) ? C.find(act.cat, id).name : 'nicht im Katalog' }, id)) : h('span', { class: 'muted small' }, 'keine'),
          changed ? h('div', { class: 'muted small' }, 'ersetzt: ' + old.join(', ')) : null,
        ];
      };
      const tr = (r) =>
        h(
          'tr',
          { 'data-comp-row': r.nr, class: r.frage === null ? 'comp-unmatched' : null },
          h('td', { class: 'num' }, 'F' + r.nr),
          h('td', { class: 'comp-qtext', title: r.text }, r.text.length > 70 ? r.text.slice(0, 69) + '…' : r.text),
          h(
            'td',
            null,
            h(
              'select',
              {
                class: 'input input-sm',
                'aria-label': `Frage aus der Begleitdatei für F${r.nr}`,
                'data-comp-frage': r.nr,
                onchange: (e) => {
                  r.frage = e.target.value === '' ? null : Number(e.target.value);
                  r.status = r.frage === null ? 'none' : 'hand';
                  draw();
                },
              },
              opts(r)
            ),
            statusText[r.status] && r.frage === null ? h('div', { class: 'comp-status small' }, statusText[r.status]) : null
          ),
          h('td', { class: 'comp-chips' }, chips(r))
        );
      box.append(
        h(
          'div',
          { class: 'table-wrap short' },
          h(
            'table',
            { class: 'table compact comp-import-table' },
            h('thead', null, h('tr', null, h('th', { class: 'num' }, 'Moodle'), h('th', null, 'Fragetext'), h('th', null, 'Frage aus der Begleitdatei'), h('th', null, 'Kompetenzen'))),
            h('tbody', null, rows.map(tr))
          )
        )
      );
      if (!act) return;
      const unk = unknown(act.cat);
      if (!unk.length) return;
      const entries = C.entries(act.cat);
      box.append(
        h('p', { class: 'small comp-unknown-head' }, `Nicht im Katalog „${act.cat.name}“:`),
        h(
          'ul',
          { class: 'comp-unknown-list' },
          unk.map(({ id, nrs }) =>
            h(
              'li',
              { 'data-comp-unknown': id },
              h('span', { class: 'chip chip-unknown' }, id),
              h('span', { class: 'muted small' }, nrs.map((n) => 'F' + n).join(', ')),
              h(
                'select',
                { class: 'input input-sm', 'aria-label': `Was passiert mit ${id}?`, onchange: (e) => ((choice[id] = e.target.value), draw()) },
                h('option', { value: '' }, 'weglassen'),
                act.cat.bereiche.length
                  ? h('optgroup', { label: 'in den Katalog aufnehmen' }, act.cat.bereiche.map((b) => h('option', { value: 'add:' + b.id, selected: choice[id] === 'add:' + b.id }, `aufnehmen in „${b.name}“`)))
                  : null,
                entries.length ? h('optgroup', { label: 'statt dessen' }, entries.map((e) => h('option', { value: 'map:' + e.id, selected: choice[id] === 'map:' + e.id }, `${e.id} ${e.name}`))) : null
              )
            )
          )
        )
      );
    }

    return {
      el: box,
      set(p) {
        parsed = p;
        rows = p && p.companion ? MO.matchCompanion(p, p.companion) : [];
        choice = {};
        draw();
      },
      has: () => !!(parsed && parsed.companion),
      /** Katalog wählen bzw. anlegen, unbekannte Kennungen aufnehmen; Ergebnis { nr: [kennung] } oder null. */
      apply() {
        if (!parsed || !parsed.companion || !rows.length) return null;
        const act = active();
        if (!act) return null;
        let cat = act.cat;
        if (act.mode === 'template') cat = C.addFromTemplate(db, act.tpl.key);
        if (act.mode !== 'course') course.catalogId = cat.id;
        const map = {};
        for (const { id } of unknown(act.cat)) {
          const v = choice[id] || '';
          if (v.startsWith('add:')) map[id] = C.addWithId(cat, v.slice(4), id) ? id : '';
          else if (v.startsWith('map:')) map[id] = v.slice(4);
          else map[id] = '';
        }
        return MO.companionCompetencies(parsed.companion, rows, map);
      },
    };
  }

  /** Dialog an der Karte „Moodle“: nur die Begleitdatei einlesen, Fragetexte aus der gespeicherten Antworten-CSV. */
  async function companionImport(course, db, a, part) {
    const MO = NM.moodle;
    const owner = part || a.test;
    const mo = owner.moodle;
    const stored = (mo.files || []).filter((f) => f.kind !== 'komp');
    const plan = companionPlan(course, db, a.test, part);
    const err = h('div');
    let parsed = null;
    const fileInput = h('input', {
      type: 'file',
      accept: '.json,application/json',
      onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        parsed = MO.parseExport(stored.concat([{ name: f.name, text: await f.text() }]));
        clear(err);
        err.append(...parsed.warnings.filter((w) => !/^„[^“]*\.csv“/.test(w)).map((w) => h('div', { class: 'alert alert-danger' }, w)));
        plan.set(parsed);
      },
    });
    const v = await modal({
      title: part ? `Kompetenzen zuordnen – ${part.name}` : `Kompetenzen zuordnen: ${a.name}`,
      wide: true,
      body: h(
        'div',
        null,
        h('p', { class: 'small' }, 'Die Begleitdatei schreibt das Bauskript neben die Moodle-XML. OrdoNota ordnet ihre Fragen über den Fragetext in der gespeicherten Antworten-CSV zu. Punkte bleiben unverändert.'),
        UI.dropzone(fileInput, 'Begleitdatei hierher ziehen', 'JSON: „Moodle-Test – … (Kompetenzen).json“'),
        err,
        plan.el
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        {
          label: 'Übernehmen',
          value: 'ok',
          kind: 'primary',
          validate: () => (plan.has() ? true : (toast('Bitte zuerst die Begleitdatei wählen.', 'error'), false)),
        },
      ],
    });
    if (v !== 'ok') return;
    const byNr = plan.apply();
    const n = byNr ? MO.setCompetencies(a.test, part, byNr) : 0;
    const komp = parsed.files.find((f) => f.kind === 'komp');
    mo.files = stored.concat(komp ? [komp] : []);
    NM.app.commit();
    toast(byNr ? `Kompetenzen bei ${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'} geändert.` : 'Kompetenzen nicht übernommen (kein Katalog).', 'info', 5000);
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
    const plan = companionPlan(course, db, target ? target.test : null, part);
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
      type: 'file',
      accept: '.csv,text/csv,.json,application/json',
      multiple: true,
      onchange: async (e) => {
        const files = await Promise.all([...e.target.files].map(async (f) => ({ name: f.name, text: await f.text() })));
        parsed = MO.parseExport(files);
        map = MO.matchStudents(parsed.persons, students);
        if (!target || adopt) name.value = parsed.title;
        renderMap();
        plan.set(parsed);
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
            ),
        Object.keys(parsed.pending).length
          ? h(
              'div',
              { class: 'alert alert-warn', 'data-moodle-pending': '' },
              'In Moodle noch nicht bewertet (zählt vorerst 0 Punkte): ',
              Object.entries(parsed.pending)
                .map(([nr, n]) => `F${nr} bei ${n} ${n === 1 ? 'Person' : 'Personen'}`)
                .join(', '),
              '. Nach der Bewertung in Moodle erneut importieren.'
            )
          : null
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
        UI.dropzone(fileInput, 'Dateien hierher ziehen', 'Antworten- und Bewertungen-CSV, dazu wahlweise die Begleitdatei (JSON) mit den Kompetenzen'),
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
        box,
        plan.el
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
    const competencies = plan.apply();
    const sum = MO.applyImport(course, target, parsed, map, { half, settings: db.settings, name: name.value.trim(), partId, replace: own.length > 0 && replace.checked, adopt, competencies });
    NM.app.state.ui.testId[course.id] = sum.assessment.id;
    NM.app.saveUi();
    NM.app.commit();
    toast(
      `Moodle-Import: ${sum.imported} Ergebnisse übernommen` + (sum.missing.length ? `, ${sum.missing.length} × „fehlt“` : '') + (competencies ? `, Kompetenzen bei ${sum.competencies} ${sum.competencies === 1 ? 'Aufgabe' : 'Aufgaben'}` : '') + '.',
      'info',
      5000
    );
    if (plan.has() && !competencies) toast('Kompetenzen aus der Begleitdatei nicht übernommen (kein Katalog).', 'warn', 7000);
    if (sum.mismatch.length) toast(`Hinweis: Bei ${sum.mismatch.join(', ')} weicht die Summe der Fragenpunkte (gerundet) von der Moodle-Bewertung ab.`, 'warn', 9000);
  }

  /** Dialog: Moodle-Rückmeldung drucken (alle oder eine Person, mit oder ohne Note). */
  async function moodlePrint(course, a) {
    const level = G.courseLevel(course);
    const withResult = M.activeStudents(course).filter((s) => G.testResult(a.test, s.id, level).score !== null);
    const who = h('select', { class: 'input' }, h('option', { value: '' }, `Alle (${withResult.length}, je eine Seite)`), withResult.map((s) => h('option', { value: s.id }, M.studentName(s))));
    const grade = h('input', { type: 'checkbox', checked: true });
    // Kompetenzen (2.13): nur wenn der Kurs einen Katalog hat und der Test Kompetenzen trägt
    const hasComp = !!NM.competencies.forCourse(NM.app.state.db, course) && NM.competencies.testHasCompetencies(a);
    const comp = h('input', { type: 'checkbox', checked: true, 'data-moodle-comp': '' });
    const v = await modal({
      title: 'Moodle-Rückmeldung drucken',
      body: h(
        'div',
        null,
        h('label', { class: 'field' }, h('span', null, 'Wer'), who),
        h('label', { class: 'check' }, grade, ' Note mit ausdrucken'),
        hasComp ? h('label', { class: 'check', title: 'Je Kompetenz Zeichen und Punkte aus diesem Test, unter den Fragen' }, comp, ' Kompetenzen in diesem Test') : null
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: [icon('printer'), ' Drucken'], value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    if (!withResult.length) return toast('Noch keine Ergebnisse zum Drucken.', 'error');
    NM.print.moodle(course, a, { sid: who.value || null, withGrade: grade.checked, withComp: hasComp && comp.checked });
  }

  // ---------- OrdoScripto ----------

  /** „Für OrdoScripto vorbereiten“: Test-ID und fehlende Schüler-IDs vergeben (bei Nachschreibterminen in der Arbeit). */
  async function scriptoPrepare(course, db, a) {
    let r;
    try {
      r = NM.scripto.prepare(db, course, a);
    } catch (e) {
      return toast(e.message, 'error', 8000);
    }
    NM.app.commit();
    if (r.created) toast(`Test-ID ${r.data.testId} vergeben, ${r.added.length} Schüler-IDs. Jetzt die Import-CSV speichern und die Trennblätter drucken („Drucken …“).`, 'success', 8000);
    else toast(r.added.length ? `${r.added.length} ${r.added.length === 1 ? 'Schüler-ID' : 'Schüler-IDs'} ergänzt. Die Import-CSV bitte neu speichern.` : 'Alle haben schon eine Schüler-ID.', 'success', 6000);
  }

  function scriptoCardFor(course, db, a) {
    const S = NM.scripto;
    const d = S.dataOf(course, a);
    const o = S.owner(course, a);
    const n = Object.keys(d.ids).length;
    const miss = S.missing(course, a);
    // Spalte „kurs“ der Import-CSV (Einstufung je Person): Anzahl je Wert
    const counts = {};
    for (const s of M.activeStudents(course)) if (d.ids[s.id]) {
      const k = S.kursFor(course, a, s);
      counts[k] = (counts[k] || 0) + 1;
    }
    const kurs = Object.entries(counts).map(([k, c]) => `${c} × ${k}`).join(', ');
    return h(
      'div',
      { class: 'card', 'data-scripto-card': '' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'OrdoScripto'),
        h('span', { class: 'muted small' }, 'Test-ID ', h('strong', { class: 'mono', 'data-scripto-id': '' }, d.testId), ` · ${n} Schüler-IDs · Einstufung ${kurs || '–'} · vorbereitet am `, new Date(d.created).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }))
      ),
      h(
        'div',
        { class: 'inline wrap' },
        h(
          'button',
          {
            class: 'btn btn-sm',
            'data-scripto-csv': '',
            title: 'Datei für den Import in OrdoScripto: nur Test-ID, Schüler-ID und Einstufung, keine Namen',
            onclick: () => {
              const f = S.importCsv(course, a);
              NM.util.download(f.name, f.text, 'text/csv;charset=utf-8');
            },
          },
          icon('download'),
          ` Import-CSV: ${d.testId}_import.csv`
        ),
        miss.length ? h('button', { class: 'btn btn-sm', 'data-scripto-add': '', title: 'Neu hinzugekommene Personen bekommen eine Schüler-ID; vergebene IDs bleiben', onclick: () => scriptoPrepare(course, db, a) }, `+ IDs für ${miss.length} ${miss.length === 1 ? 'neue Person' : 'neue Personen'}`) : null
      ),
      h(
        'p',
        { class: 'muted small' },
        o !== a ? `Gleiche Test-ID wie „${o.name}“: OrdoScripto nimmt die Nachschreibarbeiten in denselben Test auf. ` : '',
        'Trennblätter mit QR-Code über „Drucken …“. Die Zuordnung der IDs zu den Namen bleibt nur hier in der verschlüsselten Datenbank.'
      )
    );
  }

  async function scriptoPrint(course, a) {
    const S = NM.scripto;
    const all = S.sheetStudents(course, a);
    const makeup = S.sheetStudents(course, a, { onlyMakeup: true });
    const isMakeup = S.owner(course, a) !== a;
    const who = h(
      'select',
      { class: 'input', 'data-scripto-who': '' },
      h('option', { value: 'all', selected: !isMakeup || !makeup.length }, `Alle (${all.length}, je eine Seite)`),
      h('option', { value: 'makeup', selected: isMakeup && makeup.length > 0, disabled: !makeup.length }, `Nur Nachschreibende (${makeup.length})`)
    );
    const miss = S.missing(course, a).length;
    const v = await modal({
      title: 'Trennblätter für OrdoScripto',
      body: h(
        'div',
        null,
        h('label', { class: 'field' }, h('span', null, 'Für wen'), who),
        h('p', { class: 'muted small' }, 'Je Person eine Seite. Das Trennblatt kommt beim Scannen vor die Arbeit; OrdoScripto liest den QR-Code und verwirft die Seite.'),
        miss ? h('p', { class: 'small warn-text' }, `${miss} ${miss === 1 ? 'Person hat' : 'Personen haben'} noch keine Schüler-ID (Karte „OrdoScripto“ → „+ IDs“).`) : null
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: [icon('printer'), ' Drucken'], value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const onlyMakeup = who.value === 'makeup';
    if (!(onlyMakeup ? makeup : all).length) return toast('Niemand zum Drucken.', 'error');
    NM.print.scripto(course, a, { onlyMakeup });
  }

  NM.views.tests = { render, moodleImport, keyCardFor, gradeStepsSelect, limitInput };
})((globalThis.NM = globalThis.NM || {}));
