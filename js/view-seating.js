/* Notenmanager – Reiter „Sitzplan“: Namenskarten auf einem Raster per Ziehen anordnen. */
(function (NM) {
  'use strict';
  const { h, confirmDialog } = NM.util;
  const M = NM.model;

  const DEFAULTS = { cols: 8, rows: 5, desk: 'top', pos: {} };

  function seating(course) {
    course.seating = Object.assign({}, DEFAULTS, course.seating);
    course.seating.pos = course.seating.pos || {};
    return course.seating;
  }

  /** Vornamen; bei gleichen Vornamen im Kurs mit Initiale des Nachnamens. */
  function cardNames(students) {
    const count = {};
    for (const s of students) count[s.first || s.last] = (count[s.first || s.last] || 0) + 1;
    const out = {};
    for (const s of students) {
      const base = s.first || s.last || '?';
      out[s.id] = count[base] > 1 && s.first && s.last ? `${s.first} ${s.last[0]}.` : base;
    }
    return out;
  }

  /** Belegung: Zelle "x,y" → Schüler-ID; Personen außerhalb des Rasters gelten als nicht platziert. */
  function layout(course) {
    const st = seating(course);
    const students = M.activeStudents(course);
    const cells = {};
    const placed = new Set();
    for (const s of students) {
      const p = st.pos[s.id];
      if (!p || p.x >= st.cols || p.y >= st.rows || cells[p.x + ',' + p.y]) continue;
      cells[p.x + ',' + p.y] = s.id;
      placed.add(s.id);
    }
    return { st, students, cells, unplaced: students.filter((s) => !placed.has(s.id)) };
  }

  function render(view, { course }) {
    const { st, students, cells, unplaced } = layout(course);
    const names = cardNames(students);
    const card = (s) => h('div', { class: 'seat-card', 'data-sid': s.id, title: M.studentName(s) }, h('span', null, names[s.id]));

    const grid = h('div', { class: 'seat-grid', style: `--cols:${st.cols}` });
    for (let y = 0; y < st.rows; y++) {
      for (let x = 0; x < st.cols; x++) {
        const sid = cells[x + ',' + y];
        const s = sid && students.find((p) => p.id === sid);
        grid.appendChild(h('div', { class: 'seat-cell', 'data-x': x, 'data-y': y }, s ? card(s) : null));
      }
    }
    const desk = h('div', { class: 'seat-desk' }, 'Lehrerpult');
    const tray = h(
      'div',
      { class: 'seat-tray', 'data-tray': '' },
      unplaced.length ? unplaced.map(card) : h('span', { class: 'muted small' }, 'Alle sitzen. Karten hierher ziehen, um sie vom Plan zu nehmen.')
    );

    const num = (label, key, min, max) =>
      h(
        'label',
        { class: 'field narrow' },
        h('span', null, label),
        h('input', {
          class: 'input',
          type: 'number',
          min,
          max,
          value: st[key],
          onchange: (e) => {
            const v = Math.round(Number(e.target.value));
            if (!(v >= min && v <= max)) return NM.util.toast(`Bitte eine Zahl von ${min} bis ${max}.`, 'error');
            st[key] = v;
            NM.app.commit();
          },
        })
      );

    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Sitzplan')),
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'form-row' },
          num('Spalten', 'cols', 1, 16),
          num('Reihen', 'rows', 1, 12),
          h(
            'label',
            { class: 'field' },
            h('span', null, 'Lehrerpult'),
            h(
              'select',
              {
                class: 'input',
                onchange: (e) => {
                  st.desk = e.target.value;
                  NM.app.commit();
                },
              },
              h('option', { value: 'top', selected: st.desk === 'top' }, 'oben'),
              h('option', { value: 'bottom', selected: st.desk === 'bottom' }, 'unten')
            )
          ),
          h(
            'div',
            { class: 'field actions-end' },
            h('span', null, ' '),
            h(
              'div',
              { class: 'inline' },
              h('button', { class: 'btn', title: 'Noch nicht platzierte Personen auf freie Plätze verteilen (zufällig)', onclick: () => fillRandom(course) }, '🎲 Freie Plätze füllen'),
              h('button', { class: 'btn', onclick: () => clearAll(course) }, 'Alle abräumen'),
              h('button', { class: 'btn', onclick: () => NM.print.seating(course) }, '🖨 Drucken')
            )
          )
        )
      ),
      h(
        'div',
        { class: 'seat-layout' },
        h(
          'div',
          { class: 'card seat-room' },
          st.desk === 'top' ? desk : null,
          h('div', { class: 'seat-wrap', 'data-scroll-key': 'seat-grid' }, grid),
          st.desk === 'bottom' ? desk : null,
          h('p', { class: 'muted small' }, 'Karten mit der Maus (oder dem Finger) auf einen Platz ziehen. Auf einen besetzten Platz gezogen, tauschen die beiden die Plätze.')
        ),
        h('div', { class: 'card seat-side' }, h('h2', { class: 'seat-tray-title' }, 'Noch ohne Platz ', h('span', { class: 'muted' }, `(${unplaced.length})`)), tray)
      )
    );
    enableDrag(view, course, st);
  }

  /** Ziehen per Pointer-Events (Maus, Stift, Touch). */
  function enableDrag(root, course, st) {
    root.addEventListener('pointerdown', (e) => {
      const cardEl = e.target.closest('.seat-card');
      if (!cardEl || e.button > 0) return;
      e.preventDefault();
      const sid = cardEl.dataset.sid;
      const r = cardEl.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const ghost = cardEl.cloneNode(true);
      ghost.classList.add('seat-ghost');
      Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', left: r.left + 'px', top: r.top + 'px' });
      document.body.appendChild(ghost);
      cardEl.classList.add('seat-dragging');
      let over = null;
      let lastEv = e;
      // Am oberen/unteren Rand des Inhaltsbereichs automatisch scrollen
      const scroller = document.getElementById('main');
      const timer = setInterval(() => {
        if (!scroller) return;
        const b = scroller.getBoundingClientRect();
        const edge = 60;
        const dyScroll = lastEv.clientY < b.top + edge ? -14 : lastEv.clientY > b.bottom - edge ? 14 : 0;
        if (dyScroll) {
          scroller.scrollTop += dyScroll;
          move(lastEv);
        }
      }, 30);
      const target = (ev) => {
        ghost.style.display = 'none';
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        ghost.style.display = '';
        return el && el.closest('.seat-cell, [data-tray]');
      };
      const move = (ev) => {
        lastEv = ev;
        ghost.style.left = ev.clientX - dx + 'px';
        ghost.style.top = ev.clientY - dy + 'px';
        const t = target(ev);
        if (t !== over) {
          if (over) over.classList.remove('seat-over');
          over = t;
          if (over) over.classList.add('seat-over');
        }
      };
      const up = (ev) => {
        clearInterval(timer);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        ghost.remove();
        cardEl.classList.remove('seat-dragging');
        if (over) over.classList.remove('seat-over');
        const t = ev.type === 'pointerup' ? target(ev) : null;
        if (!t) return;
        if (t.hasAttribute('data-tray')) {
          delete st.pos[sid];
        } else {
          const x = Number(t.dataset.x);
          const y = Number(t.dataset.y);
          const from = st.pos[sid];
          const otherEl = t.querySelector('.seat-card');
          const other = otherEl && otherEl.dataset.sid !== sid ? otherEl.dataset.sid : null;
          // Tauschen: die verdrängte Person bekommt den alten Platz (oder geht in die Ablage)
          if (other) {
            if (from && from.x < st.cols && from.y < st.rows) st.pos[other] = { x: from.x, y: from.y };
            else delete st.pos[other];
          }
          st.pos[sid] = { x, y };
        }
        NM.app.commit();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    });
  }

  function fillRandom(course) {
    const { st, cells, unplaced } = layout(course);
    const free = [];
    for (let y = 0; y < st.rows; y++) for (let x = 0; x < st.cols; x++) if (!cells[x + ',' + y]) free.push({ x, y });
    if (!unplaced.length) return NM.util.toast('Alle haben bereits einen Platz.');
    if (free.length < unplaced.length) NM.util.toast(`Nur ${free.length} freie Plätze für ${unplaced.length} Personen – Raster vergrößern.`, 'error');
    const people = unplaced.slice();
    for (let i = people.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [people[i], people[j]] = [people[j], people[i]];
    }
    people.slice(0, free.length).forEach((s, i) => (st.pos[s.id] = free[i]));
    NM.app.commit();
  }

  async function clearAll(course) {
    if (!(await confirmDialog('Sitzplan abräumen?', 'Alle Karten kommen zurück in die Ablage „Noch ohne Platz“.', { okLabel: 'Abräumen' }))) return;
    seating(course).pos = {};
    NM.app.commit();
  }

  NM.views.seating = { render, layout, cardNames };
})((globalThis.NM = globalThis.NM || {}));
