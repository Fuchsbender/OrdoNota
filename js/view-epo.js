/* Notenmanager – Reiter „Mitarbeit/EPO“: Bewertung über eine feste Zahl von Unterrichtsstunden. */
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
            h('button', { class: 'btn', onclick: () => NM.print.epo(course, a) }, '🖨 Liste'),
            h('button', { class: 'btn', title: 'Ein Zettel pro Person zum Ausschneiden, mit Feld für Datum und Unterschrift', onclick: () => NM.print.epoSlips(course, a) }, '🖨 Schülerzettel'),
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
      if (!c.r) row[l.id] = { r: sel.value, hw: c.hw || '' };
    }
    NM.app.commit();
  }

  function gridCard(course, a, level) {
    const epo = a.epo;
    const students = M.activeStudents(course);
    const lessons = sortedLessons(epo);
    const ui = NM.app.state.ui;
    const current = ui.epoQuick ? lessons[lessons.length - 1] : null;
    const head = h(
      'tr',
      null,
      h('th', { class: 'sticky-col' }, 'Name'),
      lessons.map((l) =>
        h(
          'th',
          { class: 'center lesson-head' },
          h('button', { class: 'link', title: 'Datum ändern / Stunde löschen', onclick: () => editLesson(a, l) }, fmtDateShort(l.date) || '?'),
          h('button', { class: 'link tiny', title: 'Leere Zellen dieser Stunde füllen', onclick: () => fillLesson(course, a, l) }, 'füllen')
        )
      ),
      current ? h('th', { class: 'center quick-head', title: 'Bewertung der neuesten Stunde per Klick' }, 'Schnellwahl ' + (fmtDateShort(current.date) || '?')) : null,
      h('th', { class: 'num' }, 'Σ'),
      h('th', { class: 'num' }, 'Max'),
      h('th', { class: 'num' }, '%'),
      h('th', { class: 'num', title: 'Abwesend' }, 'k'),
      h('th', { class: 'num', title: 'Hausaufgaben unvollständig / vergessen' }, 'HA'),
      h('th', { class: 'center' }, 'Note')
    );
    const rows = students.map((s, ri) => {
      const row = epo.entries[s.id] || {};
      const res = G.epoResult(epo, s.id, level);
      return h(
        'tr',
        null,
        h('td', { class: 'sticky-col name-cell' }, UI.studentLabel(s)),
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
              title: '++ + 0 - --, k = abwesend; u/h = Hausaufgaben (z. B. „+h“)',
              onfocus: (e) => e.target.select(),
              onchange: (e) => {
                const v = G.parseEpoCell(e.target.value);
                if (v === undefined) {
                  e.target.classList.add('invalid');
                  return toast('Erlaubt: ++, +, 0, -, --, k – optional mit u oder h (z. B. „0u“).', 'error');
                }
                epo.entries[s.id] = epo.entries[s.id] || {};
                if (!v.r && !v.hw) delete epo.entries[s.id][l.id];
                else epo.entries[s.id][l.id] = v;
                NM.app.commit();
              },
            })
          );
        }),
        current ? h('td', { class: 'center' }, quickButtons(epo, s.id, current.id)) : null,
        h('td', { class: 'num strong' }, res.attended ? res.sum : ''),
        h('td', { class: 'num muted' }, res.attended ? res.max : ''),
        h('td', { class: 'num muted' }, res.pct === null ? '' : fmtNum(res.pct, 0)),
        h('td', { class: 'num muted' }, res.absent || ''),
        h('td', { class: 'num muted' }, res.u || res.h ? `${res.u}/${res.h}` : ''),
        h('td', { class: 'center' }, UI.gradeBadge(res.p, level))
      );
    });
    const pts = Object.assign({}, G.EPO_DEFAULT_POINTS, epo.points);
    return h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Bewertung je Stunde'),
        lessons.length && students.length
          ? h(
              'button',
              {
                class: 'btn btn-sm quick-toggle' + (ui.epoQuick ? ' active' : ''),
                'aria-pressed': ui.epoQuick ? 'true' : 'false',
                title: 'Schaltflächen zum Bewerten der neuesten Stunde ein-/ausblenden',
                onclick: () => {
                  ui.epoQuick = !ui.epoQuick;
                  NM.app.saveUi();
                  NM.app.rerender();
                },
              },
              ui.epoQuick ? '▾ Schnellwahl ausblenden' : '▸ Schnellwahl einblenden'
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
          h('span', { class: 'chip' }, `h = HA vergessen (${pts.h})`)
        )
      ),
      lessons.length === 0
        ? h('p', { class: 'muted' }, 'Noch keine Stunden. Mit „+ Stunde“ eine Spalte anlegen.')
        : students.length === 0
          ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.')
          : h('div', { class: 'table-wrap', 'data-scroll-key': 'epo-grid' }, h('table', { class: 'table grid-table epo-table' }, h('thead', null, head), h('tbody', null, rows))),
      h('p', { class: 'muted small' }, 'Höchstpunktzahl = anwesende Stunden × ', pts['++'], '. Hausaufgaben-Vermerke werden abgezogen. Enter/↓ springt zur nächsten Person.')
    );
  }

  /** Schaltflächen zum Bewerten einer Stunde; erneuter Klick auf die aktive Auswahl hebt sie auf. */
  function quickButtons(epo, sid, lid) {
    const c = (epo.entries[sid] || {})[lid] || { r: '', hw: '' };
    const set = (r, hw) => {
      epo.entries[sid] = epo.entries[sid] || {};
      if (!r && !hw) delete epo.entries[sid][lid];
      else epo.entries[sid][lid] = { r, hw };
      NM.app.commit();
    };
    const btn = (label, active, cls, title, onclick) =>
      h('button', { class: 'quick-btn' + (active ? ' active ' + cls : ''), title, onclick }, label);
    return h(
      'span',
      { class: 'quick-group' },
      ['++', '+', '0', '-', '--', 'k'].map((r) =>
        btn(r, c.r === r, 'r-' + ratingClass({ r }), r === 'k' ? 'abwesend' : 'Mitarbeit ' + r, () => set(c.r === r ? '' : r, c.hw || ''))
      ),
      h('span', { class: 'quick-sep' }),
      btn('u', c.hw === 'u', 'hw', 'Hausaufgaben unvollständig', () => set(c.r || '', c.hw === 'u' ? '' : 'u')),
      btn('h', c.hw === 'h', 'hw', 'Hausaufgaben vergessen', () => set(c.r || '', c.hw === 'h' ? '' : 'h'))
    );
  }

  function ratingClass(c) {
    if (!c || !c.r) return 'none';
    return { '++': 'pp', '+': 'p', '0': 'z', '-': 'm', '--': 'mm', k: 'k' }[c.r] || 'none';
  }

  function configCard(course, a, level) {
    const epo = a.epo;
    epo.points = Object.assign({}, G.EPO_DEFAULT_POINTS, epo.points);
    epo.table = epo.table || G.epoDefaultTable(level, epo.limit);
    const ptsInputs = ['++', '+', '0', '-', '--', 'u', 'h'].map((k) =>
      h(
        'label',
        { class: 'field narrow' },
        h('span', null, k === 'u' ? 'u (HA unvollst.)' : k === 'h' ? 'h (HA vergessen)' : k),
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

  NM.views.epo = { render };
})((globalThis.NM = globalThis.NM || {}));
