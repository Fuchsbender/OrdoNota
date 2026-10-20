/* Notenmanager – Reiter „Kurs & Schüler“. */
(function (NM) {
  'use strict';
  const { h, toast, confirmDialog, modal, parseNum, uid } = NM.util;
  const G = NM.grades;
  const M = NM.model;

  function render(view, { course, db }) {
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, M.courseTitle(course)), h('span', { class: 'pill' }, G.courseLevel(course) === 'mss' ? 'MSS · Punkte 00–15' : 'Sek I · Noten 1–6')),
      h('div', { class: 'grid-2' }, courseCard(course), studentsCard(course)),
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
        onchange: (e) => {
          course.type = e.target.value;
          const t = G.COURSE_TYPES[course.type];
          course.wKa = t.ka;
          course.wOther = t.other;
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
        field('Notizen zum Kurs', h('textarea', { class: 'input', rows: 2, value: course.note || '', onchange: set('note') }), 'span2')
      ),
      h('p', { class: 'muted small' }, 'Halbjahre: ', G.halvesFor(course).join(', '), G.hasYearGrade(course) ? ' · mit Jahresnote' : ' · jedes Halbjahr wird einzeln benotet')
    );
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
          (oldLevel !== newLevel ? ' Achtung: Die Notenskala wechselt (Sek I ↔ MSS). Eingetragene Noten bleiben als Punkte erhalten.' : ''),
        { okLabel: 'Ändern' }
      );
      if (!ok) return NM.app.rerender();
      for (const a of course.assessments) {
        const i = Math.max(0, oldHalves.indexOf(a.half));
        a.half = newHalves[Math.min(i, newHalves.length - 1)];
      }
      const ov = {};
      oldHalves.forEach((x, i) => {
        if (course.overrides[x] && newHalves[i]) ov[newHalves[i]] = course.overrides[x];
      });
      if (course.overrides.Jahr && j <= 11) ov.Jahr = course.overrides.Jahr;
      course.overrides = ov;
    }
    course.jahrgang = j;
    if (j >= 11 && course.type === 'sek1') {
      course.type = 'lk';
    } else if (j <= 10 && (course.type === 'lk' || course.type === 'gk')) {
      course.type = 'sek1';
      course.wKa = 50;
      course.wOther = 50;
    }
    NM.app.commit();
  }

  function studentsCard(course) {
    const all = M.sortStudents(course.students);
    const active = all.filter((s) => s.active !== false);
    const inactive = all.filter((s) => s.active === false);
    const rows = [...active, ...inactive].map((s, i) => {
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
      h('h2', null, 'Schülerinnen und Schüler ', h('span', { class: 'muted' }, `(${active.length})`)),
      course.students.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              { class: 'table compact' },
              h('thead', null, h('tr', null, h('th', null, 'Nr.'), h('th', null, 'Nachname'), h('th', null, 'Vorname'), h('th', { class: 'center', title: 'I-Status' }, 'I-Status'), h('th', { class: 'center' }, 'Aktiv'), h('th', null, ''))),
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
    NM.app.commit();
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
              const ok = await confirmDialog('Kurs löschen?', `„${M.courseTitle(course)}“ wird mit allen Noten gelöscht. Das lässt sich nur über eine Sicherung rückgängig machen.`, { okLabel: 'Endgültig löschen', danger: true });
              if (!ok) return;
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
    if (withStudents.checked) copy.students = M.activeStudents(course).map((s) => ({ id: uid(), last: s.last, first: s.first, active: true }));
    db.courses.push(copy);
    NM.app.commit({ render: false });
    NM.app.select({ yearId: year.value, courseId: copy.id, tab: 'course' });
    toast('Kurs kopiert.', 'success');
  }

  NM.views.course = { render };
})((globalThis.NM = globalThis.NM || {}));
