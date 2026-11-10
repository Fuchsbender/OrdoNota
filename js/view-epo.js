/* OrdoNota – Reiter „Mitarbeit/EPO“: Bewertung über eine feste Zahl von Unterrichtsstunden. */
(function (NM) {
  'use strict';
  const { h, toast, confirmDialog, modal, parseNum, uid, fmtNum, fmtDate, fmtDateShort, todayISO } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  function render(view, { course, db }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course);
    const blocks = course.assessments.filter((a) => a.kind === 'epo' && a.half === half);
    const ui = NM.app.state.ui;
    const cur = blocks.find((b) => b.id === ui.epoId[course.id]) || blocks[blocks.length - 1] || null;

    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Mitarbeit / EPO'), UI.halfSwitch(course, false)),
      UI.pickerList({
        items: blocks,
        currentId: cur && cur.id,
        onPick: (id) => {
          ui.epoId[course.id] = id;
          NM.app.saveUi();
          NM.app.rerender();
        },
        onAdd: () => {
          const e = M.newEpo(course, half, db.settings);
          e.name = 'EPO ' + (blocks.length + 1);
          course.assessments.push(e);
          ui.epoId[course.id] = e.id;
          NM.app.saveUi();
          NM.app.commit();
        },
        addLabel: '+ Neuer EPO-Block',
        sub: (a) => `${a.epo.lessons.length} Stunden` + (a.epo.lessons.length ? ` · ab ${fmtDateShort(sortedLessons(a.epo)[0].date)}` : ''),
      })
    );
    if (!cur) {
      view.appendChild(UI.emptyState('Noch kein EPO-Block in ' + half, 'Ein EPO-Block umfasst eine Reihe von Unterrichtsstunden. Pro Stunde vergeben Sie ++, +, 0, - oder -- (dazu ggf. Hausaufgaben-Vermerke). Daraus wird eine Note berechnet, die automatisch in die Notenübersicht einfließt.'));
      return;
    }
    view.append(metaCard(course, cur), gridCard(course, cur, level), configCard(course, cur, level));
  }

  function sortedLessons(epo) {
    return epo.lessons.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }

  function metaCard(course, a) {
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
        h('label', { class: 'field grow' }, h('span', null, 'Bezeichnung'), h('input', { class: 'input', value: a.name, onchange: set((v) => (a.name = v.trim() || a.name)) })),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Bereich'),
          h(
            'select',
            { class: 'input', onchange: set((v) => (a.cat = v)) },
            h('option', { value: 'other', selected: a.cat === 'other' }, 'Sonstige Leistungen'),
            h('option', { value: 'ka', selected: a.cat === 'ka' }, 'Klassen-/Kursarbeit')
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
          'div',
          { class: 'field actions-end' },
          h('span', null, ' '),
          h(
            'div',
            { class: 'inline' },
            h('button', { class: 'btn btn-primary', onclick: () => addLesson(a) }, '+ Stunde'),
            UI.printButton('Drucken: ' + a.name, [
              { id: 'list', icon: '📄', label: 'Bewertungsliste', group: 'teacher', tip: 'Bewertungsraster aller Stunden mit Summe, Prozent, Fehlstunden, Hausaufgaben-Vermerken und Note je Person.', run: () => NM.print.epo(course, a) },
              { id: 'slips', icon: '✂️', label: 'Mitarbeitszettel zum Ausschneiden', group: 'students', tip: 'Ein Zettel pro Person mit Punktelegende, Bewertungen je Stunde, Ergebnis und Note sowie Feldern für Datum und Unterschrift – mehrere pro Blatt.', run: () => NM.print.epoSlips(course, a) },
            ]),
            h(
              'button',
              {
                class: 'icon-btn danger',
                title: 'EPO-Block löschen',
                'aria-label': 'EPO-Block löschen',
                onclick: async () => {
                  if (!(await confirmDialog('EPO-Block löschen?', `„${a.name}“ mit allen Bewertungen löschen?`, { okLabel: 'Löschen', danger: true }))) return;
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

  async function addLesson(a) {
    const date = h('input', { class: 'input', type: 'date', value: todayISO() });
    const v = await modal({
      title: 'Stunde hinzufügen',
      body: h('label', { class: 'field' }, h('span', null, 'Datum'), date),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Hinzufügen', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const l = { id: uid(), date: date.value };
    a.epo.lessons.push(l);
    // Fehlzeiten dieses Datums (z. B. „Heute abwesend“) als k übernehmen
    const course = NM.app.currentCourse();
    if (course) for (const sid of NM.attendance.awaySet(course, l.date)) NM.attendance.syncToEpo(course, l.date, sid);
    NM.app.commit();
    // Fokus in die erste Zelle der neuen Spalte
    setTimeout(() => {
      const el = document.querySelector(`[data-focus-key^="epo-"][data-focus-key$="-${l.id}"]`);
      if (el) el.focus();
    }, 50);
  }

  async function editLesson(a, l) {
    const date = h('input', { class: 'input', type: 'date', value: l.date });
    const v = await modal({
      title: 'Stunde bearbeiten',
      body: h('label', { class: 'field' }, h('span', null, 'Datum'), date),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Stunde löschen', value: 'delete', kind: 'danger' },
        { label: 'Übernehmen', value: 'ok', kind: 'primary' },
      ],
    });
    if (v === 'ok') {
      l.date = date.value;
      const course = NM.app.currentCourse();
      if (course) NM.attendance.fromEpo(course); // k am neuen Datum als Fehlzeit
      NM.app.commit();
    } else if (v === 'delete') {
      if (!(await confirmDialog('Stunde löschen?', `Die Stunde vom ${fmtDate(l.date)} und alle Bewertungen darin löschen?`, { okLabel: 'Löschen', danger: true }))) return;
      a.epo.lessons = a.epo.lessons.filter((x) => x.id !== l.id);
      for (const row of Object.values(a.epo.entries)) delete row[l.id];
      NM.app.commit();
    }
  }

  /** Alle in einer Stunde noch leeren Zellen mit einem Wert füllen (z. B. 0). */
  async function fillLesson(course, a, l) {
    const sel = h(
      'select',
      { class: 'input' },
      ['0', '+', '++', '-', '--', 'k'].map((x) => h('option', { value: x }, x))
    );
    const v = await modal({
      title: 'Leere Zellen füllen',
      body: h('div', null, h('p', null, `Alle noch leeren Bewertungen der Stunde vom ${fmtDate(l.date)} setzen auf:`), sel),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Füllen', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    for (const s of M.activeStudents(course)) {
      const row = (a.epo.entries[s.id] = a.epo.entries[s.id] || {});
      const c = row[l.id] || { r: '', hw: '' };
      if (!c.r) {
        row[l.id] = Object.assign({}, c, { r: sel.value, hw: c.hw || '' });
        NM.attendance.syncFromEpo(course, a, l, s.id, c, row[l.id]);
      }
    }
    NM.app.commit();
  }

  function gridCard(course, a, level) {
    const epo = a.epo;
    const lessons = sortedLessons(epo);
    const ui = NM.app.state.ui;
    const current = ui.epoQuick ? lessons[lessons.length - 1] : null;
    const pts = Object.assign({}, G.EPO_DEFAULT_POINTS, epo.points);
    const all = M.activeStudents(course);
    const results = new Map(all.map((s) => [s.id, G.epoResult(epo, s.id, level)]));
    const res = (s) => results.get(s.id);
    const sort = UI.sorter('epo', {
      ...Object.fromEntries(lessons.map((l) => ['lesson:' + l.id, { get: (s) => lessonPoints((epo.entries[s.id] || {})[l.id], pts), first: 'desc' }])),
      sum: { get: (s) => (res(s).attended ? res(s).sum : null), first: 'desc' },
      max: { get: (s) => (res(s).attended ? res(s).max : null), first: 'desc' },
      pct: { get: (s) => res(s).pct, first: 'desc' },
      absent: { get: (s) => res(s).absent, first: 'desc' },
      hw: { get: (s) => -(res(s).u * pts.u + res(s).h * pts.h), first: 'desc' },
      mat: { get: (s) => res(s).m, first: 'desc' },
      grade: { get: (s) => res(s).p, first: 'desc' },
    });
    const students = sort.rows(all);
    const head = h(
      'tr',
      null,
      sort.nameHeads(),
      lessons.map((l) =>
        h(
          'th',
          { class: 'center lesson-head' },
          h('button', { class: 'link', title: 'Datum ändern / Stunde löschen', onclick: () => editLesson(a, l) }, fmtDateShort(l.date) || '?'),
          h('button', { class: 'link tiny', title: 'Leere Zellen dieser Stunde füllen', onclick: () => fillLesson(course, a, l) }, 'füllen'),
          sort.toggle('lesson:' + l.id)
        )
      ),
      current ? h('th', { class: 'center quick-head', title: 'Bewertung der neuesten Stunde per Klick' }, 'Schnellwahl ' + (fmtDateShort(current.date) || '?')) : null,
      h('th', { class: 'num' }, sort.head('sum', 'Σ')),
      h('th', { class: 'num' }, sort.head('max', 'Max')),
      h('th', { class: 'num' }, sort.head('pct', '%')),
      h('th', { class: 'num' }, sort.head('absent', 'k', 'Abwesend – sortieren')),
      h('th', { class: 'num' }, sort.head('hw', 'HA', 'Hausaufgaben unvollständig / vergessen – sortieren nach Abzug')),
      h('th', { class: 'num' }, sort.head('mat', 'M', 'Material vergessen – sortieren')),
      h('th', { class: 'center' }, sort.head('grade', 'Note'))
    );
    const rows = students.map((s, ri) => {
      const row = epo.entries[s.id] || {};
      const res = results.get(s.id);
      return h(
        'tr',
        null,
        UI.nameCells(s, null, { photo: !!ui.epoPhotos }),
        lessons.map((l, ci) => {
          const c = row[l.id];
          return h(
            'td',
            { class: 'center' },
            h('input', {
              class: 'cell-input epo-input r-' + ratingClass(c),
              value: G.epoCellText(c),
              'data-grid': 'epo-' + a.id,
              'data-row': ri,
              'data-col': ci,
              'data-focus-key': `epo-${s.id}-${l.id}`,
              'data-select-all': '',
              autocomplete: 'off',
              spellcheck: 'false',
              title: '++ + 0 - --, k = abwesend; u/h = Hausaufgaben, m = Material vergessen (z. B. „+h“, „0m“)',
              onfocus: (e) => e.target.select(),
              onchange: (e) => {
                const v = G.parseEpoCell(e.target.value);
                if (v === undefined) {
                  e.target.classList.add('invalid');
                  return toast('Erlaubt: ++, +, 0, -, --, k – optional mit u oder h und m (z. B. „0u“, „+hm“).', 'error');
                }
                setCell(course, a, l, s.id, v);
                NM.app.commit();
              },
            })
          );
        }),
        current ? h('td', { class: 'center' }, quickButtons(course, a, s.id, current)) : null,
        h('td', { class: 'num strong' }, res.attended ? res.sum : ''),
        h('td', { class: 'num muted' }, res.attended ? res.max : ''),
        h('td', { class: 'num muted' }, res.pct === null ? '' : fmtNum(res.pct, 0)),
        h('td', { class: 'num muted' }, res.absent || ''),
        h('td', { class: 'num muted' }, res.u || res.h ? `${res.u}/${res.h}` : ''),
        h('td', { class: 'num muted' }, res.m || ''),
        h('td', { class: 'center' }, UI.gradeBadge(res.p, level))
      );
    });
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Bewertung je Stunde'),
        lessons.length && students.length
          ? h(
              'span',
              { class: 'head-toggles' },
              toggleBtn(ui, 'epoQuick', ui.epoQuick ? '▾ Schnellwahl ausblenden' : '▸ Schnellwahl einblenden', 'Schaltflächen zum Bewerten der neuesten Stunde ein-/ausblenden'),
              toggleBtn(ui, 'epoPhotos', ui.epoPhotos ? '▾ Fotos ausblenden' : '▸ Fotos einblenden', 'Schülerfotos vor dem Namen ein-/ausblenden (Fotos werden im Reiter „Sitzplan“ hinzugefügt)'),
              h('button', { class: 'btn btn-sm', 'data-tiles-open': '', title: 'Kachelansicht für das Tablet: eine Kachel je Person nach Sitzplan, Tippen bewertet die Stunde', onclick: () => tilesView(course, a) }, '▦ Kacheln')
            )
          : null,
        h(
          'span',
          { class: 'legend' },
          [
            ['++', pts['++']],
            ['+', pts['+']],
            ['0', pts['0']],
            ['-', pts['-']],
            ['--', pts['--']],
          ].map(([k, v]) => h('span', { class: 'chip r-' + ratingClass({ r: k }) }, `${k} = ${v}`)),
          h('span', { class: 'chip' }, 'k = abwesend'),
          h('span', { class: 'chip' }, `u = HA unvollst. (${pts.u})`),
          h('span', { class: 'chip' }, `h = HA vergessen (${pts.h})`),
          h('span', { class: 'chip' }, `m = Material vergessen (${pts.m})`)
        )
      ),
      lessons.length === 0
        ? h('p', { class: 'muted' }, 'Noch keine Stunden. Mit „+ Stunde“ eine Spalte anlegen.')
        : students.length === 0
          ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
          : h('div', { class: 'table-wrap', 'data-scroll-key': 'epo-grid' }, h('table', { class: 'table grid-table epo-table' + (ui.epoPhotos ? ' with-photos' : '') }, h('thead', null, head), h('tbody', null, rows))),
      h('p', { class: 'muted small' }, 'Höchstpunktzahl = anwesende Stunden × ', pts['++'], '. Hausaufgaben-Vermerke werden abgezogen, Material-Vermerke (m) nur gezählt, solange ihre Punkte 0 sind. Enter/↓ springt zur nächsten Person.')
    );
  }

  /** Umschaltknopf für eine Ansichtsoption (nur auf diesem Gerät gespeichert). */
  function toggleBtn(ui, key, label, title) {
    return h(
      'button',
      {
        class: 'btn btn-sm quick-toggle' + (ui[key] ? ' active' : ''),
        'aria-pressed': ui[key] ? 'true' : 'false',
        title,
        onclick: () => {
          ui[key] = !ui[key];
          NM.app.saveUi();
          NM.app.rerender();
        },
      },
      label
    );
  }

  /** Punkte einer Stunde einschließlich Hausaufgaben-Abzug; null = nichts eingetragen oder nur abwesend. */
  function lessonPoints(c, pts) {
    if (!c) return null;
    let v = G.EPO_RATINGS.includes(c.r) ? pts[c.r] : null;
    if (c.hw) v = (v || 0) + pts[c.hw];
    if (c.m && pts.m) v = (v || 0) + pts.m;
    return v;
  }

  /** Zelle einer Stunde setzen (leer → löschen) und die Fehlzeiten abgleichen; speichert nicht. */
  function setCell(course, a, lesson, sid, v) {
    const epo = a.epo;
    epo.entries[sid] = epo.entries[sid] || {};
    const before = epo.entries[sid][lesson.id];
    if (G.epoCellEmpty(v)) delete epo.entries[sid][lesson.id];
    else epo.entries[sid][lesson.id] = v;
    NM.attendance.syncFromEpo(course, a, lesson, sid, before, v);
  }

  /**
   * Schaltflächen zum Bewerten einer Stunde; erneuter Klick auf die aktive Auswahl hebt sie auf.
   * onDone(kind) nach jeder Änderung (kind = 'r' für die Bewertung, sonst 'extra'); Standard: speichern.
   */
  function quickButtons(course, a, sid, lesson, { onDone = () => NM.app.commit(), big = false } = {}) {
    const c = (a.epo.entries[sid] || {})[lesson.id] || { r: '', hw: '' };
    const set = (r, hw, m, kind) => {
      setCell(course, a, lesson, sid, m ? { r, hw, m: 1 } : { r, hw });
      onDone(kind);
    };
    const btn = (label, active, cls, title, onclick, key) =>
      h('button', { class: 'quick-btn' + (big ? ' quick-big' : '') + (active ? ' active ' + cls : ''), title, 'aria-pressed': String(!!active), 'data-quick': key, onclick }, label);
    return h(
      'span',
      { class: 'quick-group' + (big ? ' quick-group-big' : '') },
      ['++', '+', '0', '-', '--', 'k'].map((r) =>
        btn(r, c.r === r, 'r-' + ratingClass({ r }), r === 'k' ? 'abwesend' : 'Mitarbeit ' + r, () => set(c.r === r ? '' : r, c.hw || '', c.m, 'r'), r)
      ),
      h('span', { class: 'quick-sep' }),
      btn('u', c.hw === 'u', 'hw', 'Hausaufgaben unvollständig', () => set(c.r || '', c.hw === 'u' ? '' : 'u', c.m, 'extra'), 'u'),
      btn('h', c.hw === 'h', 'hw', 'Hausaufgaben vergessen', () => set(c.r || '', c.hw === 'h' ? '' : 'h', c.m, 'extra'), 'h'),
      btn('m', !!c.m, 'hw', 'Material vergessen', () => set(c.r || '', c.hw || '', !c.m, 'extra'), 'm')
    );
  }

  // ---------- Kachelansicht für das Tablet (seit 1.46) ----------

  /**
   * Vollbild mit einer Kachel je Person für eine Stunde, angeordnet nach dem Sitzplan (ohne Plätze alphabetisch).
   * Tippen öffnet große Knöpfe wie die Schnellwahl. Zeigt Bewertungen – nicht für den Beamer.
   */
  function tilesView(course, a) {
    const ui = NM.app.state.ui;
    const lessons = sortedLessons(a.epo);
    let lesson = lessons[lessons.length - 1];
    let picked = null;
    const plans = course.seatingPlans || [];
    const title = h('h1', null);
    const grid = h('div', { class: 'tiles-grid' });
    const extra = h('div', { class: 'tiles-free' });
    const sheet = h('div', { class: 'tiles-sheet', hidden: true });
    const lessonSel = h(
      'select',
      { class: 'input', 'data-tiles-lesson': '', 'aria-label': 'Stunde', onchange: (e) => ((lesson = lessons.find((l) => l.id === e.target.value) || lesson), (picked = null), draw()) },
      lessons.map((l) => h('option', { value: l.id, selected: l === lesson }, fmtDate(l.date) || '?'))
    );
    const roomSel =
      plans.length > 1
        ? h(
            'select',
            {
              class: 'input',
              'data-tiles-room': '',
              'aria-label': 'Raum',
              onchange: (e) => {
                ui.seatingId = ui.seatingId || {};
                ui.seatingId[course.id] = e.target.value;
                NM.app.saveUi();
                draw();
              },
            },
            plans.map((p) => h('option', { value: p.id, selected: p.id === (ui.seatingId || {})[course.id] }, p.name))
          )
        : null;
    const photoBtn = h('button', { class: 'btn grp-beamer-toggle' + (ui.epoPhotos ? ' active' : ''), 'aria-pressed': String(!!ui.epoPhotos), 'data-tiles-photos': '', title: 'Fotos ein-/ausblenden', onclick: () => ((ui.epoPhotos = !ui.epoPhotos), NM.app.saveUi(), draw()) }, '📷 Fotos');

    const tile = (s, names) => {
      const c = (a.epo.entries[s.id] || {})[lesson.id];
      const extras = [c && c.hw, c && c.m ? 'm' : ''].filter(Boolean).join(' ');
      return h(
        'button',
        {
          class: 'tile r-' + ratingClass(c) + (picked === s.id ? ' tile-picked' : ''),
          'data-tile': s.id,
          'aria-label': `${M.studentName(s)}: ${G.epoCellText(c) || 'noch nicht bewertet'}`,
          onclick: () => {
            picked = picked === s.id ? null : s.id;
            draw();
          },
        },
        ui.epoPhotos ? h('img', { class: 'tile-photo' + (s.photo ? '' : ' seat-photo-empty'), src: s.photo || M.PERSON_ICON, alt: '' }) : null,
        h('span', { class: 'tile-name' }, names[s.id]),
        h('span', { class: 'tile-val' }, (c && c.r) || '·', extras ? h('small', null, ' ' + extras) : null)
      );
    };

    const draw = () => {
      title.replaceChildren(a.name, h('span', { class: 'muted' }, ' · ' + M.courseTitle(course)));
      const { st, students, cells, unplaced } = NM.views.seating.layout(course);
      const names = NM.views.seating.cardNames(students);
      const byId = new Map(students.map((s) => [s.id, s]));
      const seated = Object.keys(cells).length > 0;
      grid.replaceChildren();
      extra.replaceChildren();
      grid.classList.toggle('tiles-room', seated);
      if (seated) {
        grid.style.gridTemplateColumns = `repeat(${st.cols}, minmax(0, 1fr))`;
        const seatRows = `repeat(${st.rows}, minmax(76px, auto))`;
        grid.style.gridTemplateRows = st.desk === 'top' ? `auto ${seatRows}` : `${seatRows} auto`;
        const desk = h('div', { class: 'tiles-desk', style: `grid-column: 1 / -1` }, 'Lehrerpult');
        if (st.desk === 'top') grid.appendChild(desk);
        const off = st.desk === 'top' ? 2 : 1;
        for (const [key, sid] of Object.entries(cells)) {
          const [x, y] = key.split(',').map(Number);
          const el = tile(byId.get(sid), names);
          el.style.gridColumn = String(x + 1);
          el.style.gridRow = String(y + off);
          grid.appendChild(el);
        }
        if (st.desk === 'bottom') {
          desk.style.gridRow = String(st.rows + 1);
          grid.appendChild(desk);
        }
        if (unplaced.length) extra.append(h('span', { class: 'muted small' }, 'Ohne Platz: '), ...unplaced.map((s) => tile(s, names)));
      } else {
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
        grid.append(...M.sortStudents(students).map((s) => tile(s, names)));
      }
      extra.hidden = !extra.childNodes.length;
      // Bewertungsknöpfe der gewählten Person
      const ps = picked && byId.get(picked);
      sheet.hidden = !ps;
      sheet.replaceChildren();
      if (ps)
        sheet.append(
          h('div', { class: 'tiles-sheet-head' }, h('strong', null, M.studentName(ps)), h('button', { class: 'btn', 'data-tiles-sheet-close': '', onclick: () => ((picked = null), draw()) }, '✕')),
          quickButtons(course, a, ps.id, lesson, {
            big: true,
            onDone: (kind) => {
              NM.app.commit();
              if (kind === 'r') picked = null; // Bewertung gewählt → zurück zur Übersicht
              draw();
            },
          })
        );
    };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (picked) {
        picked = null;
        draw();
      } else close();
    };
    const overlay = h(
      'div',
      { class: 'beamer grp-beamer epo-tiles', role: 'dialog', 'aria-label': 'Kachelansicht' },
      h('div', { class: 'grp-beamer-head' }, title, h('div', { class: 'grp-beamer-bar' }, lessonSel, roomSel, photoBtn, h('button', { class: 'btn', 'data-tiles-close': '', onclick: close, title: 'Schließen (Esc)' }, '✕ Schließen'))),
      grid,
      extra,
      sheet
    );
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    draw();
  }

  function ratingClass(c) {
    if (!c || !c.r) return 'none';
    return { '++': 'pp', '+': 'p', '0': 'z', '-': 'm', '--': 'mm', k: 'k' }[c.r] || 'none';
  }

  function configCard(course, a, level) {
    const epo = a.epo;
    epo.points = Object.assign({}, G.EPO_DEFAULT_POINTS, epo.points);
    epo.table = epo.table || G.epoDefaultTable(level, epo.limit);
    const ptsInputs = ['++', '+', '0', '-', '--', 'u', 'h', 'm'].map((k) =>
      h(
        'label',
        { class: 'field narrow' },
        h('span', null, { u: 'u (HA unvollst.)', h: 'h (HA vergessen)', m: 'm (Material)' }[k] || k),
        h('input', {
          class: 'input',
          type: 'number',
          step: 1,
          value: epo.points[k],
          onchange: (e) => {
            const v = parseNum(e.target.value);
            if (v === null || v === undefined) return toast('Bitte eine Zahl eingeben.', 'error');
            epo.points[k] = v;
            NM.app.commit();
          },
        })
      )
    );
    const top = G.maxPoints(level);
    const rows = [];
    for (let p = top; p >= 1; p--) {
      rows.push(
        h(
          'tr',
          null,
          h('td', null, UI.gradeBadge(p, level)),
          h('td', { class: 'muted small' }, epo.table.strict ? 'mehr als' : 'ab'),
          h(
            'td',
            { class: 'num' },
            h('input', {
              class: 'cell-input num-input',
              value: NM.util.fmtScore(epo.table.mins[p]),
              inputmode: 'decimal',
              'data-focus-key': `epo-table-${p}`,
              onchange: (e) => {
                const v = parseNum(e.target.value);
                if (v === null || v === undefined || v < 0 || v > 100) return toast('Bitte 0–100 eingeben.', 'error');
                epo.table.mins[p] = v;
                NM.app.commit();
              },
            }),
            ' %'
          )
        )
      );
    }
    return h(
      'details',
      {
        class: 'card details-card',
        open: !!NM.app.state.ui.epoCfgOpen,
        ontoggle: (e) => {
          NM.app.state.ui.epoCfgOpen = e.target.open;
          NM.app.saveUi();
        },
      },
      h('summary', null, h('h2', null, 'Einstellungen dieses EPO-Blocks'), h('span', { class: 'muted small' }, 'Punkte je Symbol, Umrechnung % → Note')),
      h(
        'div',
        { class: 'grid-2' },
        h('div', null, h('h3', null, 'Punkte je Symbol'), h('div', { class: 'form-row wrap' }, ptsInputs)),
        h(
          'div',
          null,
          h('h3', null, 'Umrechnung Prozent → ', level === 'mss' ? 'Punkte' : 'Note'),
          h(
            'div',
            { class: 'form-row' },
            h(
              'label',
              { class: 'check' },
              h('input', {
                type: 'checkbox',
                checked: !!epo.table.strict,
                onchange: (e) => {
                  epo.table.strict = e.target.checked;
                  NM.app.commit();
                },
              }),
              ' Schwelle muss überschritten werden („mehr als“)'
            )
          ),
          h(
            'div',
            { class: 'form-row' },
            level === 'sek1'
              ? h(
                  'label',
                  { class: 'field narrow' },
                  h('span', null, 'LIMIT 4- (%)'),
                  h('input', {
                    class: 'input',
                    type: 'number',
                    value: epo.limit,
                    onchange: (e) => {
                      const v = parseNum(e.target.value);
                      if (!(v >= 20 && v <= 80)) return toast('LIMIT bitte zwischen 20 und 80 %.', 'error');
                      epo.limit = v;
                      epo.table = G.epoDefaultTable(level, v);
                      NM.app.commit();
                    },
                  })
                )
              : null,
            h(
              'button',
              {
                class: 'btn btn-sm',
                onclick: () => {
                  epo.table = G.epoDefaultTable(level, epo.limit);
                  epo.points = Object.assign({}, G.EPO_DEFAULT_POINTS);
                  NM.app.commit();
                },
              },
              'Standard wiederherstellen'
            )
          ),
          h('div', { class: 'table-wrap short' }, h('table', { class: 'table compact' }, h('tbody', null, rows)))
        )
      )
    );
  }

  NM.views.epo = { render, tilesView };
})((globalThis.NM = globalThis.NM || {}));
