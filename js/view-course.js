/* OrdoNota – Reiter „Kurs & Schüler“. */
(function (NM) {
  'use strict';
  const { h, toast, confirmDialog, modal, parseNum, uid, download, safeFilename } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  function render(view, { course, db }) {
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, M.courseTitle(course)), h('span', { class: 'pill' }, G.courseLevel(course) === 'mss' ? 'MSS · Punkte 00–15' : 'Sek I · Noten 1–6')),
      h('div', { class: 'grid-2' }, courseCard(course), studentsCard(course)),
      tabsCard(course, db),
      dangerCard(course, db)
    );
  }

  function field(label, input, cls) {
    return h('label', { class: 'field' + (cls ? ' ' + cls : '') }, h('span', null, label), input);
  }

  function courseCard(course) {
    const set = (k) => (e) => {
      course[k] = e.target.value;
      NM.app.commit();
    };
    const jahrgang = h(
      'select',
      { class: 'input', onchange: (e) => changeJahrgang(course, Number(e.target.value)) },
      [5, 6, 7, 8, 9, 10, 11, 12, 13].map((j) => h('option', { value: j, selected: Number(course.jahrgang) === j }, j + (j >= 11 ? ' (MSS)' : '')))
    );
    const type = h(
      'select',
      {
        class: 'input',
        onchange: async (e) => {
          const type = e.target.value;
          const mss = type === 'lk' || type === 'gk';
          const j = Number(course.jahrgang);
          // Die Notenskala hängt am Jahrgang (ab 11: Punkte) – Kursart und Jahrgang passend halten
          const nj = mss && j <= 10 ? M.mssJahrgang(course) : type === 'sek1' && j >= 11 ? 10 : null;
          if (nj !== null) {
            if (!(await changeJahrgang(course, nj))) return;
            toast(`Jahrgangsstufe auf ${nj} gesetzt (${nj >= 11 ? 'MSS, Punkte 00–15' : 'Sek I, Noten 1–6'}). Bitte prüfen.`, 'info', 6000);
          }
          course.type = type;
          const t = G.COURSE_TYPES[course.type];
          course.wKa = t.ka;
          course.wOther = t.other;
          M.einstufungFromType(course);
          NM.app.commit();
        },
      },
      Object.entries(G.COURSE_TYPES).map(([k, t]) => h('option', { value: k, selected: course.type === k }, t.label))
    );
    const pct = (k, other) =>
      h('input', {
        class: 'input',
        type: 'number',
        min: 0,
        max: 100,
        step: 1,
        value: NM.grades.round2(course[k]),
        onchange: (e) => {
          const v = parseNum(e.target.value);
          if (v === null || v === undefined || v < 0 || v > 100) return toast('Bitte 0–100 eingeben.', 'error');
          course[k] = v;
          course[other] = NM.grades.round2(100 - v);
          NM.app.commit();
        },
      });
    const weightFn = (k) =>
      h('input', {
        class: 'input',
        type: 'number',
        min: 0,
        step: 1,
        value: course[k],
        onchange: (e) => {
          const v = parseNum(e.target.value);
          if (!(v > 0)) return toast('Bitte eine positive Zahl eingeben.', 'error');
          course[k] = v;
          NM.app.commit();
        },
      });
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Kursdaten'),
      h(
        'div',
        { class: 'form-grid' },
        field('Klasse / Stufe', h('input', { class: 'input', value: course.klasse, placeholder: 'z. B. 8b oder MSS 12', 'data-focus-key': 'course-klasse', onchange: set('klasse') })),
        field('Fach', h('input', { class: 'input', value: course.fach, placeholder: 'z. B. Mathe', onchange: set('fach') })),
        field('Jahrgangsstufe', jahrgang),
        field('Kursart', type),
        field('Gewicht Klassen-/Kursarbeiten (%)', pct('wKa', 'wOther')),
        field('Gewicht sonstige Leistungen (%)', pct('wOther', 'wKa')),
        G.hasYearGrade(course)
          ? h(
              'div',
              { class: 'field span2' },
              h('span', null, 'Jahresnote: Gewicht 1. Halbjahr : 2. Halbjahr'),
              h('div', { class: 'inline' }, weightFn('wHalf1'), h('span', null, ':'), weightFn('wHalf2'), h('span', { class: 'muted small' }, 'Standard 1 : 2 (⅓ zu ⅔)'))
            )
          : null,
        field(
          'Einstufung',
          h(
            'select',
            { class: 'input', 'data-einstufung': '', title: 'Gilt für alle im Kurs; einzelne Personen lassen sich in der Schülerliste anders einstufen (Spalte „Einst.“)', onchange: (e) => changeEinstufung(course, e.target.value) },
            M.einstufungenFor(course, M.courseEinstufung(course)).map(([v, l]) => h('option', { value: v, selected: M.courseEinstufung(course) === v }, l))
          )
        ),
        field('Notizen zum Kurs', h('textarea', { class: 'input', rows: 2, value: course.note || '', onchange: set('note') }), 'span2')
      ),
      h('p', { class: 'muted small' }, 'Halbjahre: ', G.halvesFor(course).join(', '), G.hasYearGrade(course) ? ' · mit Jahresnote' : ' · jedes Halbjahr wird einzeln benotet')
    );
  }

  /** Einstufung des Kurses für alle setzen; bei abweichend eingestuften Personen nachfragen. */
  async function changeEinstufung(course, v) {
    const own = course.students.filter((s) => s.einstufung !== undefined && s.einstufung !== v);
    let keep = false;
    if (own.length) {
      const r = await modal({
        title: 'Einstufung für alle setzen?',
        body: h('p', null, `${own.length === 1 ? '1 Person ist' : own.length + ' Personen sind'} abweichend vom Kurs eingestuft (${own.map((s) => M.studentName(s) + ': ' + s.einstufung).join(', ')}). Soll die neue Einstufung auch für ${own.length === 1 ? 'sie' : 'diese'} gelten?`),
        buttons: [
          { label: 'Abbrechen', value: null },
          { label: 'Abweichungen behalten', value: 'keep' },
          { label: 'Für alle setzen', value: 'all', kind: 'primary' },
        ],
      });
      if (!r) return NM.app.rerender();
      keep = r === 'keep';
    }
    M.setCourseEinstufung(course, v, { keep });
    NM.app.commit();
  }

  async function changeJahrgang(course, j) {
    const oldHalves = G.halvesFor(course);
    const oldLevel = G.courseLevel(course);
    const newHalves = G.halvesFor({ jahrgang: j });
    const newLevel = G.courseLevel({ jahrgang: j });
    const used = course.assessments.length > 0;
    if (used && (oldLevel !== newLevel || oldHalves.join() !== newHalves.join())) {
      const ok = await confirmDialog(
        'Jahrgangsstufe ändern?',
        `Die Halbjahre ändern sich von ${oldHalves.join('/')} zu ${newHalves.join('/')}. Vorhandene Leistungen werden entsprechend zugeordnet.` +
          (oldLevel !== newLevel
            ? ' Achtung: Die Notenskala wechselt (Sek I ↔ MSS). Eingetragene Noten bleiben als Punkte erhalten. Tests und EPO-Blöcke mit Standard-LIMIT bzw. Standard-Umrechnung bekommen die Standardwerte der neuen Stufe; von Hand geänderte Werte bleiben.'
            : ''),
        { okLabel: 'Ändern' }
      );
      if (!ok) {
        NM.app.rerender();
        return false;
      }
    }
    M.setJahrgang(course, j, NM.app.db().settings);
    if (j >= 11 && course.type === 'sek1') {
      course.type = 'lk';
      M.einstufungFromType(course);
    } else if (j <= 10 && (course.type === 'lk' || course.type === 'gk')) {
      course.type = 'sek1';
      course.wKa = 50;
      course.wOther = 50;
    }
    NM.app.commit();
    return true;
  }

  function studentsCard(course) {
    const sort = UI.sorter('students', {
      iStatus: { get: (s) => (s.iStatus ? 1 : 0), first: 'desc' },
      active: { get: (s) => (s.active !== false ? 1 : 0), first: 'desc' },
      einstufung: { get: (s) => M.EINSTUFUNGEN.findIndex(([k]) => k === M.studentEinstufung(course, s)), first: 'asc' },
    });
    const courseLvl = M.courseEinstufung(course);
    const all = sort.rows(M.sortStudents(course.students));
    const active = all.filter((s) => s.active !== false);
    const inactive = all.filter((s) => s.active === false);
    // Ausgeschiedene stehen unten, außer es wird ausdrücklich nach „Aktiv“ sortiert
    const rows = (sort.key === 'active' ? all : [...active, ...inactive]).map((s, i) => {
      const inp = (k, col) =>
        h('input', {
          class: 'cell-input text-input',
          value: s[k] || '',
          'data-grid': 'students',
          'data-row': i,
          'data-col': col,
          'data-focus-key': `st-${s.id}-${k}`,
          onchange: (e) => {
            s[k] = e.target.value.trim();
            NM.app.commit();
          },
        });
      return h(
        'tr',
        { class: s.active === false ? 'inactive' : '' },
        h('td', { class: 'num muted' }, s.active === false ? '' : i + 1),
        h('td', null, inp('last', 0)),
        h('td', null, inp('first', 1)),
        h(
          'td',
          { class: 'center' },
          h(
            'select',
            {
              class: 'input input-sm' + (s.einstufung ? ' level-own' : ''),
              'data-student-einstufung': s.id,
              'aria-label': 'Einstufung von ' + M.studentName(s),
              title: s.einstufung ? 'Abweichend vom Kurs (' + courseLvl + ')' : 'Wie der Kurs',
              onchange: (e) => {
                M.setStudentEinstufung(course, s, e.target.value);
                NM.app.commit();
              },
            },
            M.einstufungenFor(course, M.studentEinstufung(course, s)).map(([v, l]) => h('option', { value: v, selected: M.studentEinstufung(course, s) === v, title: l }, v === 'U' ? 'undiff.' : v))
          )
        ),
        h(
          'td',
          { class: 'center' },
          h('input', {
            type: 'checkbox',
            checked: !!s.iStatus,
            title: 'I-Status (wird in allen Listen mit „I“ markiert)',
            onchange: (e) => {
              if (e.target.checked) s.iStatus = true;
              else delete s.iStatus;
              NM.app.commit();
            },
          })
        ),
        h(
          'td',
          { class: 'center' },
          h('input', {
            type: 'checkbox',
            checked: s.active !== false,
            title: 'Aktiv (abgewählt = Zu-/Abgang, Noten bleiben erhalten, erscheinen aber nicht in Ausdrucken)',
            onchange: (e) => {
              s.active = e.target.checked;
              NM.app.commit();
            },
          })
        ),
        h('td', { class: 'center' }, h('button', { class: 'icon-btn danger', title: 'Entfernen', 'aria-label': 'Entfernen', onclick: () => removeStudent(course, s) }, '✕'))
      );
    });
    const paste = h('textarea', {
      class: 'input',
      rows: 4,
      placeholder: 'Namen einfügen – eine Zeile pro Person:\nMüller, Anna\nSchmidt\tJonas   (aus Excel kopiert)\nLena Weber',
    });
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Schülerinnen und Schüler ', h('span', { class: 'muted' }, `(${active.length})`)),
        course.students.length ? h('button', { class: 'btn btn-sm', title: 'Schülerliste als Excel-Datei (.xlsx) herunterladen', onclick: () => exportStudents(course) }, '⬇ Excel') : null
      ),
      course.students.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              { class: 'table compact' },
              h(
                'thead',
                null,
                h(
                  'tr',
                  null,
                  h('th', null, 'Nr.'),
                  h('th', null, sort.head('last', 'Nachname')),
                  h('th', null, sort.head('first', 'Vorname')),
                  h('th', { class: 'center', title: 'Einstufung (Standard: wie der Kurs)' }, sort.head('einstufung', 'Einst.')),
                  h('th', { class: 'center' }, sort.head('iStatus', 'I-Status')),
                  h('th', { class: 'center' }, sort.head('active', 'Aktiv')),
                  h('th', null, '')
                )
              ),
              h('tbody', null, rows)
            )
          )
        : h('p', { class: 'muted' }, 'Noch keine Schülerinnen und Schüler.'),
      h(
        'div',
        { class: 'paste-box' },
        paste,
        h(
          'div',
          { class: 'inline' },
          h(
            'button',
            {
              class: 'btn btn-primary',
              onclick: () => {
                const list = M.parseNames(paste.value);
                if (!list.length) return toast('Keine Namen erkannt.', 'error');
                const known = new Set(course.students.map((s) => (s.last + '|' + s.first).toLowerCase()));
                const fresh = list.filter((s) => {
                  const k = (s.last + '|' + s.first).toLowerCase();
                  if (known.has(k)) return false;
                  known.add(k);
                  return true;
                });
                course.students.push(...fresh);
                NM.app.commit();
                toast(`${fresh.length} hinzugefügt` + (list.length > fresh.length ? `, ${list.length - fresh.length} bereits vorhanden` : '') + '.', 'success');
              },
            },
            'Namen übernehmen'
          ),
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                course.students.push({ id: uid(), last: '', first: '', active: true });
                NM.app.commit();
              },
            },
            '+ Einzeln hinzufügen'
          )
        )
      )
    );
  }

  /** Schülerliste als .xlsx: aktive alphabetisch mit Nummer, danach nicht mehr aktive. */
  function exportStudents(course) {
    const all = M.sortStudents(course.students);
    const active = all.filter((s) => s.active !== false);
    const inactive = all.filter((s) => s.active === false);
    const rows = [['Nr.', 'Nachname', 'Vorname', 'I-Status', 'Aktiv']];
    active.forEach((s, i) => rows.push([i + 1, s.last || '', s.first || '', s.iStatus ? 'ja' : '', 'ja']));
    inactive.forEach((s) => rows.push(['', s.last || '', s.first || '', s.iStatus ? 'ja' : '', 'nein']));
    const year = NM.app.currentYear();
    const title = M.courseTitle(course);
    download(safeFilename(`Schuelerliste_${title}_${year ? year.name : ''}.xlsx`), NM.xlsx.workbook({ sheet: title, rows, widths: [6, 22, 18, 9, 7] }));
    toast('Schülerliste als Excel-Datei gespeichert (Download-Ordner). Sie enthält Namen – bitte vertraulich behandeln.', 'success', 5000);
  }

  async function removeStudent(course, s) {
    const hasGrades = course.assessments.some((a) => G.assessmentPoints(a, s.id, G.courseLevel(course)) !== null);
    const ok = await confirmDialog(
      'Schüler/in entfernen?',
      hasGrades
        ? `${M.studentName(s) || 'Diese Person'} hat bereits Noten. Beim Entfernen werden diese gelöscht. Bei einem Abgang besser nur „Aktiv“ abwählen.`
        : `${M.studentName(s) || 'Diese Person'} wird entfernt.`,
      { okLabel: 'Entfernen', danger: true }
    );
    if (!ok) return;
    course.students = course.students.filter((x) => x.id !== s.id);
    for (const a of course.assessments) {
      if (a.manual) delete a.manual.grades[s.id];
      if (a.test) delete a.test.results[s.id];
      if (a.epo) delete a.epo.entries[s.id];
    }
    for (const k of Object.keys(course.overrides)) delete course.overrides[k][s.id];
    delete course.comments[s.id];
    if (course.draw) delete course.draw.out[s.id];
    NM.app.commit();
  }

  /** Reiter dieses Kurses: Abweichungen vom Standard (Einstellungen) in course.tabs. */
  function tabsCard(course, db) {
    const def = db.settings.tabs;
    const own = course.tabs && Object.keys(course.tabs).length;
    return h(
      'div',
      { class: 'card card-subtle' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Reiter in diesem Kurs'),
        own
          ? h(
              'button',
              {
                class: 'btn btn-sm',
                title: 'Eigene Auswahl verwerfen und den Standard aus den Einstellungen verwenden',
                onclick: () => {
                  delete course.tabs;
                  NM.app.commit({ render: false });
                  NM.app.renderShell();
                },
              },
              'Wie Standard'
            )
          : null
      ),
      NM.ui.tabChecks(
        (id) => NM.app.tabOn(course, id),
        (id, on) => {
          course.tabs = course.tabs || {};
          if (on === (def[id] !== false)) delete course.tabs[id];
          else course.tabs[id] = on;
          if (!Object.keys(course.tabs).length) delete course.tabs;
          NM.app.commit({ render: false });
          NM.app.renderShell();
        },
        (id) => (course.tabs && typeof course.tabs[id] === 'boolean' ? h('span', { class: 'muted small', title: 'Weicht vom Standard in den Einstellungen ab' }, ' ◆') : null)
      ),
      h('p', { class: 'muted small' }, 'Ausgeschaltete Reiter verschwinden nur aus der Reiterleiste; Noten daraus bleiben gespeichert und zählen weiter. Standard für alle Kurse: Einstellungen → Reiter.')
    );
  }

  function dangerCard(course, db) {
    return h(
      'div',
      { class: 'card card-subtle' },
      h('h2', null, 'Kurs verwalten'),
      h(
        'div',
        { class: 'inline wrap' },
        h('button', { class: 'btn', onclick: () => copyCourse(course, db) }, 'Kurs kopieren (z. B. ins neue Schuljahr) …'),
        h(
          'button',
          {
            class: 'btn btn-danger',
            onclick: async () => {
              if (!(await confirmCourseDelete(course))) return;
              db.courses = db.courses.filter((c) => c.id !== course.id);
              NM.app.state.ui.courseId = null;
              NM.app.commit({ render: false });
              NM.app.select({ tab: 'overview' });
            },
          },
          'Kurs löschen'
        )
      )
    );
  }

  const DELETE_WORD = 'LÖSCHEN';

  /** Kurs löschen nur nach Eingabe von „LÖSCHEN“. */
  async function confirmCourseDelete(course) {
    const input = h('input', { class: 'input', autocomplete: 'off', spellcheck: 'false', placeholder: DELETE_WORD });
    const matches = () => input.value.trim() === DELETE_WORD;
    const v = await modal({
      title: 'Kurs löschen?',
      body: h(
        'div',
        null,
        h('p', null, `„${M.courseTitle(course)}“ wird mit allen Schülerinnen und Schülern, Noten und Sitzplänen gelöscht. Das lässt sich nur über eine Sicherung rückgängig machen.`),
        h('label', { class: 'field' }, h('span', null, `Zur Bestätigung „${DELETE_WORD}“ eingeben:`), input)
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Endgültig löschen', value: 'delete', kind: 'danger', validate: matches },
      ],
      onOpen: (dlg) => {
        const btn = dlg.querySelector('.btn-danger');
        const sync = () => (btn.disabled = !matches());
        input.addEventListener('input', sync);
        sync();
      },
    });
    // Auch Enter im Eingabefeld schließt den Dialog – deshalb hier noch einmal prüfen
    if (v === null || !matches()) {
      if (v !== null) toast(`Nicht gelöscht – bitte genau „${DELETE_WORD}“ eingeben.`, 'error');
      return false;
    }
    return true;
  }

  async function copyCourse(course, db) {
    const year = h(
      'select',
      { class: 'input' },
      db.years.map((y) => h('option', { value: y.id, selected: y.id === db.years[db.years.length - 1].id }, y.name))
    );
    const klasse = h('input', { class: 'input', value: course.klasse });
    const jg = h('input', { class: 'input', type: 'number', min: 5, max: 13, value: Math.min(13, Number(course.jahrgang) + 1) });
    const withStudents = h('input', { type: 'checkbox', checked: true });
    const v = await modal({
      title: 'Kurs kopieren',
      body: h(
        'div',
        { class: 'form-grid' },
        h('p', { class: 'span2 muted' }, 'Übernommen werden Kursdaten, Gewichtung und (optional) die Schülerliste – keine Noten. Neue Schuljahre legen Sie oben über die Schuljahr-Auswahl an.'),
        field('Ziel-Schuljahr', year),
        field('Jahrgangsstufe', jg),
        field('Klasse / Stufe', klasse, 'span2'),
        h('label', { class: 'check span2' }, withStudents, ' Aktive Schülerinnen und Schüler übernehmen')
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Kopieren', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const j = Math.max(5, Math.min(13, Number(jg.value) || course.jahrgang));
    const copy = M.newCourse(year.value, { klasse: klasse.value.trim(), fach: course.fach, jahrgang: j, type: course.type });
    if (j >= 11 && copy.type === 'sek1') copy.type = 'lk';
    copy.wKa = course.wKa;
    copy.wOther = course.wOther;
    copy.wHalf1 = course.wHalf1;
    copy.wHalf2 = course.wHalf2;
    copy.einstufung = M.courseEinstufung(course);
    if (course.tabs) copy.tabs = Object.assign({}, course.tabs);
    if (withStudents.checked)
      copy.students = M.activeStudents(course).map((s) => Object.assign({ id: uid(), last: s.last, first: s.first, active: true }, s.einstufung ? { einstufung: s.einstufung } : {}));
    db.courses.push(copy);
    NM.app.commit({ render: false });
    NM.app.select({ yearId: year.value, courseId: copy.id, tab: 'course' });
    toast('Kurs kopiert.', 'success');
  }

  NM.views.course = { render };
})((globalThis.NM = globalThis.NM || {}));
