/* OrdoNota – Reiter „Ziehen“: zufällig Personen ziehen (z. B. Hausaufgaben einsammeln und bewerten). */
(function (NM) {
  'use strict';
  const { h, toast, confirmDialog, parseNum, fmtDate, fmtDateShort, todayISO, uid } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  // „Heute abwesend“ gilt nur für diese Sitzung und wird nicht gespeichert: Kurs-ID → Set von Schüler-IDs
  const absentToday = {};

  /** Ziehungsdaten des Kurses: out = wer nicht (mehr) im Pool ist, history = bisherige Ziehungen. */
  function drawData(course) {
    course.draw = course.draw || {};
    course.draw.out = course.draw.out || {};
    course.draw.history = course.draw.history || [];
    return course.draw;
  }

  /** Personen im Pool: aktiv, weder gezogen noch von Hand herausgenommen. */
  function pool(course) {
    const d = drawData(course);
    return M.activeStudents(course).filter((s) => !d.out[s.id]);
  }

  function absent(course) {
    return (absentToday[course.id] = absentToday[course.id] || new Set());
  }

  /**
   * n Personen ziehen; sie fallen aus dem Pool. Reicht der Pool nicht, werden die Übrigen gezogen,
   * der Pool aufgefüllt und der Rest daraus gezogen. Abwesende werden übersprungen, bleiben aber im Pool.
   * rand ist für Tests ersetzbar.
   * @returns {{ sids: string[], refilled: boolean }}
   */
  function drawStudents(course, n, away = new Set(), rand = Math.random) {
    const d = drawData(course);
    const shuffle = (list) => {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const available = (skip) => pool(course).filter((s) => !away.has(s.id) && !skip.includes(s.id));
    let sids = shuffle(available([])).slice(0, n).map((s) => s.id);
    let refilled = false;
    if (sids.length < n) {
      d.out = {};
      refilled = true;
      sids = sids.concat(shuffle(available(sids)).slice(0, n - sids.length).map((s) => s.id));
    }
    const date = todayISO();
    for (const sid of sids) d.out[sid] = { how: 'drawn', date };
    return { sids, refilled };
  }

  function render(view, { course }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course);
    const ui = NM.app.state.ui;
    const d = drawData(course);
    const students = M.activeStudents(course);
    const away = absent(course);
    for (const sid of [...away]) if (!students.some((s) => s.id === sid)) away.delete(sid);
    const inPool = pool(course);
    const ready = inPool.filter((s) => !away.has(s.id));

    view.append(h('div', { class: 'view-head' }, h('h1', null, 'Ziehen'), UI.halfSwitch(course, false)));
    if (!students.length) {
      view.appendChild(UI.emptyState('Noch keine Schülerinnen und Schüler', 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.'));
      return;
    }

    const count = h('input', {
      class: 'input',
      type: 'number',
      min: 1,
      max: students.length,
      value: Math.min(ui.drawCount || 3, students.length),
      onchange: (e) => {
        const v = Math.round(parseNum(e.target.value));
        if (!(v >= 1)) return toast('Bitte mindestens 1.', 'error');
        ui.drawCount = Math.min(v, students.length);
        NM.app.saveUi();
      },
    });
    view.appendChild(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'form-row' },
          h('label', { class: 'field narrow' }, h('span', null, 'Anzahl'), count),
          h(
            'div',
            { class: 'field actions-end' },
            h('span', null, ' '),
            h(
              'div',
              { class: 'inline' },
              h('button', { class: 'btn btn-primary', onclick: () => doDraw(course, half, Math.round(parseNum(count.value)) || 1) }, '🎲 Ziehen'),
              h(
                'button',
                {
                  class: 'btn',
                  title: 'Alle aktiven Personen wieder in den Pool aufnehmen',
                  disabled: inPool.length === students.length,
                  onclick: async () => {
                    if (!(await confirmDialog('Pool auffüllen?', 'Alle Gezogenen und Herausgenommenen kommen zurück in den Pool. Bereits vergebene Noten bleiben erhalten.', { okLabel: 'Auffüllen' }))) return;
                    d.out = {};
                    NM.app.commit();
                  },
                },
                '↺ Pool auffüllen'
              )
            )
          ),
          h(
            'div',
            { class: 'draw-info' },
            h('strong', null, `${inPool.length} von ${students.length}`),
            ' im Pool',
            away.size ? h('span', { class: 'muted' }, ` · ${away.size} heute abwesend`) : null,
            h('span', { class: 'muted' }, ` · ziehbar: ${ready.length}`)
          )
        ),
        h('p', { class: 'muted small' }, `Die Gezogenen fallen aus dem Pool, bis er wieder aufgefüllt wird. Sind weniger übrig als gewünscht, wird automatisch aufgefüllt. Jede Ziehung legt in ${half} eine Spalte „HA-Kontrolle“ bei den sonstigen Leistungen an; bewertet werden nur die Gezogenen.`)
      )
    );

    const last = d.history[d.history.length - 1];
    if (last) view.appendChild(lastDrawCard(course, last, level));
    view.appendChild(poolCard(course, d, away));
    if (d.history.length > 1) view.appendChild(historyCard(course, d.history.slice(0, -1).reverse(), level));
  }

  function doDraw(course, half, n) {
    const d = drawData(course);
    const prevOut = JSON.parse(JSON.stringify(d.out));
    const { sids, refilled } = drawStudents(course, n, absent(course));
    if (!sids.length) return toast('Niemand verfügbar – alle sind abwesend oder herausgenommen.', 'error');
    const date = todayISO();
    const a = M.newManual(half, 'other', 'HA-Kontrolle ' + fmtDateShort(date));
    course.assessments.push(a);
    d.history.push({ id: uid(), date, half, aid: a.id, sids, prevOut });
    NM.app.commit();
    if (refilled) toast('Der Pool war zu klein und wurde neu aufgefüllt.', 'info', 5000);
    if (sids.length < n) toast(`Nur ${sids.length} Personen verfügbar.`, 'warn');
  }

  /** Letzte Ziehung: Namen groß, Noten direkt eintragen, rückgängig machen. */
  function lastDrawCard(course, entry, level) {
    const a = course.assessments.find((x) => x.id === entry.aid);
    const people = entry.sids.map((sid) => course.students.find((s) => s.id === sid)).filter(Boolean);
    const names = NM.views.seating.cardNames(people);
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Gezogen am ', fmtDate(entry.date)),
        h('span', { class: 'muted small' }, a ? `Note in „${a.name}“ (${a.half}, Sonstige)` : 'Notenspalte wurde gelöscht'),
        h('button', { class: 'btn btn-sm', title: 'Ziehung zurücknehmen: Pool wie vorher, Notenspalte löschen', onclick: () => undoDraw(course, entry) }, '↶ Rückgängig')
      ),
      h(
        'div',
        { class: 'draw-cards' },
        people.map((s, i) =>
          h(
            'div',
            { class: 'draw-card' },
            h('img', { class: 'draw-photo' + (s.photo ? '' : ' seat-photo-empty'), src: s.photo || M.PERSON_ICON, alt: '' }),
            h('div', { class: 'draw-name' }, names[s.id]),
            h('div', { class: 'muted small' }, M.studentName(s)),
            a ? gradeField(a, s, level, 'draw', i) : null
          )
        )
      )
    );
  }

  async function undoDraw(course, entry) {
    const d = drawData(course);
    const a = course.assessments.find((x) => x.id === entry.aid);
    const graded = a ? Object.keys(a.manual.grades).length : 0;
    const text = 'Die Gezogenen kommen zurück in den Pool' + (a ? ` und die Spalte „${a.name}“ wird gelöscht` : '') + (graded ? ` – mit ${graded} bereits eingetragenen ${graded === 1 ? 'Note' : 'Noten'}.` : '.');
    if (!(await confirmDialog('Ziehung zurücknehmen?', text, { okLabel: 'Zurücknehmen', danger: graded > 0 }))) return;
    d.out = entry.prevOut || {};
    d.history = d.history.filter((x) => x.id !== entry.id);
    course.assessments = course.assessments.filter((x) => x.id !== entry.aid);
    NM.app.commit();
  }

  /** Übersicht: wer ist im Pool, wer wurde wann gezogen; Haken für Pool und „heute abwesend“. */
  function poolCard(course, d, away) {
    const status = (s) => {
      const o = d.out[s.id];
      if (!o) return { order: 0, text: 'im Pool' };
      if (o.how === 'drawn') return { order: 1, text: 'gezogen ' + fmtDateShort(o.date) };
      return { order: 2, text: 'herausgenommen' };
    };
    const sort = UI.sorter('draw', {
      status: { get: (s) => status(s).order, first: 'asc' },
      pool: { get: (s) => (d.out[s.id] ? 0 : 1), first: 'desc' },
      away: { get: (s) => (away.has(s.id) ? 1 : 0), first: 'desc' },
    });
    const rows = sort.rows(M.activeStudents(course)).map((s) => {
      const st = status(s);
      return h(
        'tr',
        { class: d.out[s.id] ? 'row-muted' : '' },
        UI.nameCells(s),
        h('td', null, h('span', { class: 'draw-status draw-status-' + st.order }, st.text)),
        h(
          'td',
          { class: 'center' },
          h('input', {
            type: 'checkbox',
            checked: !d.out[s.id],
            title: 'Im Pool (Haken entfernen = aus dem Pool herausnehmen)',
            onchange: (e) => {
              if (e.target.checked) delete d.out[s.id];
              else d.out[s.id] = { how: 'manual', date: todayISO() };
              NM.app.commit();
            },
          })
        ),
        h(
          'td',
          { class: 'center' },
          h('input', {
            type: 'checkbox',
            checked: away.has(s.id),
            title: 'Heute abwesend: wird bei dieser Ziehung übersprungen, bleibt im Pool (wird nicht gespeichert)',
            onchange: (e) => {
              if (e.target.checked) away.add(s.id);
              else away.delete(s.id);
              NM.app.rerender();
            },
          })
        )
      );
    });
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Pool'), h('span', { class: 'muted small' }, '„Heute abwesend“ gilt nur bis zum Schließen der App.')),
      h(
        'div',
        { class: 'table-wrap', 'data-scroll-key': 'draw-pool' },
        h(
          'table',
          { class: 'table grid-table draw-table' },
          h('thead', null, h('tr', null, sort.nameHeads(), h('th', null, sort.head('status', 'Status')), h('th', { class: 'center' }, sort.head('pool', 'Im Pool')), h('th', { class: 'center' }, sort.head('away', 'Heute abwesend')))),
          h('tbody', null, rows)
        )
      )
    );
  }

  /** Notenfeld für eine gezogene Person; schreibt in die Notenspalte der Ziehung. */
  function gradeField(a, s, level, grid, row) {
    return UI.gradeInput({
      p: (a.manual.grades[s.id] || {}).p,
      level,
      grid,
      row,
      col: 0,
      key: `draw-${a.id}-${s.id}`,
      placeholder: 'Note',
      onSet: (v) => {
        if (v === null) delete a.manual.grades[s.id];
        else a.manual.grades[s.id] = { p: v };
        NM.app.commit();
      },
    });
  }

  /** Frühere Ziehungen; Noten lassen sich hier nachtragen oder ändern. */
  function historyCard(course, list, level) {
    let row = 0;
    return h(
      'details',
      {
        class: 'card details-card',
        open: !!NM.app.state.ui.drawHistOpen,
        ontoggle: (e) => {
          NM.app.state.ui.drawHistOpen = e.target.open;
          NM.app.saveUi();
        },
      },
      h('summary', null, h('h2', null, 'Frühere Ziehungen'), h('span', { class: 'muted small' }, `${list.length} · Noten lassen sich hier nachtragen`)),
      h(
        'table',
        { class: 'table compact' },
        h('tbody', null, list.map((entry) => {
          const a = course.assessments.find((x) => x.id === entry.aid);
          return h(
            'tr',
            null,
            h('td', null, fmtDate(entry.date)),
            h('td', { class: 'muted small' }, a ? `${a.name} (${a.half})` : 'Notenspalte gelöscht'),
            h(
              'td',
              null,
              entry.sids
                .map((sid) => course.students.find((s) => s.id === sid))
                .filter(Boolean)
                .map((s) => h('span', { class: 'draw-hist-item' }, M.studentName(s), a ? gradeField(a, s, level, 'draw-hist', row++) : null))
            )
          );
        }))
      )
    );
  }

  NM.views.draw = { render, pool, drawStudents, absent };
})((globalThis.NM = globalThis.NM || {}));
