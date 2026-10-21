/* Notenmanager – Reiter „Sitzplan“: Namenskarten auf einem Raster per Ziehen anordnen. */
(function (NM) {
  'use strict';
  const { h, confirmDialog, promptDialog, toast, uid } = NM.util;
  const M = NM.model;
  const UI = NM.ui;

  const PHOTO_PX = 160;
  // Ausgewählte Karte (Klick ohne Ziehen) – Ziel für Strg+V
  let selectedSid = null;

  function newPlan(name, from) {
    return { id: uid(), name, cols: from ? from.cols : 8, rows: from ? from.rows : 5, desk: from ? from.desk : 'top', pos: {} };
  }

  /** Sitzpläne (Räume) des Kurses; mindestens einer. */
  function plans(course) {
    if (!course.seatingPlans || !course.seatingPlans.length) course.seatingPlans = [newPlan('Raum 1')];
    return course.seatingPlans;
  }

  /** Aktiver Sitzplan (pro Gerät gemerkt, wie der gewählte Test). */
  function seating(course) {
    const list = plans(course);
    const ui = NM.app.state.ui;
    ui.seatingId = ui.seatingId || {};
    const p = list.find((x) => x.id === ui.seatingId[course.id]) || list[0];
    p.pos = p.pos || {};
    return p;
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
    const ui = NM.app.state.ui;
    const card = (s) => {
      const show = !ui.seatHidePhotos;
      const pic = show && !!s.photo;
      return h(
        'div',
        { class: 'seat-card' + (show ? ' has-photo' : '') + (s.id === selectedSid ? ' seat-selected' : ''), 'data-sid': s.id, title: M.studentName(s) + ' – anklicken und Strg+V fügt ein kopiertes Foto ein' },
        // ohne Foto: blasses Personensymbol als Platzhalter
        show ? h('img', { class: 'seat-photo' + (pic ? '' : ' seat-photo-empty'), src: pic ? s.photo : M.PERSON_ICON, alt: '', draggable: 'false' }) : null,
        h('span', { class: 'seat-name' }, names[s.id]),
        pic ? h('button', { class: 'seat-photo-del', title: 'Foto entfernen', 'aria-label': 'Foto entfernen', onclick: () => removePhoto(course, s) }, '×') : null
      );
    };

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
      UI.pickerList({
        items: plans(course),
        currentId: st.id,
        onPick: (id) => {
          ui.seatingId[course.id] = id;
          NM.app.saveUi();
          NM.app.rerender();
        },
        onAdd: () => addRoom(course, st),
        addLabel: '+ Neuer Raum',
        sub: (p) => `${p.cols} × ${p.rows} · ${Object.keys(p.pos || {}).filter((sid) => students.some((s) => s.id === sid)).length} belegt`,
      }),
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'form-row' },
          h(
            'label',
            { class: 'field grow' },
            h('span', null, 'Raum / Bezeichnung'),
            h('input', {
              class: 'input',
              value: st.name,
              'data-focus-key': 'seat-name',
              onchange: (e) => {
                st.name = e.target.value.trim() || st.name;
                NM.app.commit();
              },
            })
          ),
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
              h(
                'button',
                {
                  class: 'btn quick-toggle' + (ui.seatHidePhotos ? '' : ' active'),
                  'aria-pressed': ui.seatHidePhotos ? 'false' : 'true',
                  title: 'Schülerfotos auf den Karten und im Ausdruck ein-/ausblenden (Fotos bleiben gespeichert)',
                  onclick: () => {
                    ui.seatHidePhotos = !ui.seatHidePhotos;
                    NM.app.saveUi();
                    NM.app.rerender();
                  },
                },
                ui.seatHidePhotos ? '▸ Fotos einblenden' : '▾ Fotos ausblenden'
              ),
              h('button', { class: 'btn', onclick: () => NM.print.seating(course) }, '🖨 Drucken'),
              plans(course).length > 1 ? h('button', { class: 'icon-btn danger', title: 'Diesen Raum löschen', 'aria-label': 'Diesen Raum löschen', onclick: () => deleteRoom(course, st) }, '🗑') : null
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
        h(
          'div',
          { class: 'seat-side' },
          h('div', { class: 'card' }, h('h2', { class: 'seat-tray-title' }, 'Noch ohne Platz ', h('span', { class: 'muted' }, `(${unplaced.length})`)), tray),
          savedCard(course, st),
          h(
            'div',
            { class: 'card' },
            h('h2', { class: 'seat-tray-title' }, 'Fotos'),
            h('p', { class: 'muted small' }, 'Foto kopieren (z. B. in WebUntis: Rechtsklick → „Bild kopieren“), Karte anklicken, Strg+V. Oder eine Bilddatei bzw. ein Bild aus dem Browser auf die Karte ziehen. Fotos werden verkleinert und verschlüsselt gespeichert.')
          )
        )
      )
    );
    enableDrag(view, course, st);
    enablePhotoDrop(view, course);
  }

  // ---------- Räume ----------

  async function addRoom(course, cur) {
    const name = await promptDialog('Neuer Raum', 'Bezeichnung, z. B. „Raum 204“ oder „Chemiesaal“', 'Raum ' + (plans(course).length + 1));
    if (name === null) return;
    const p = newPlan(name.trim() || 'Raum', cur);
    course.seatingPlans.push(p);
    NM.app.state.ui.seatingId[course.id] = p.id;
    NM.app.saveUi();
    NM.app.commit();
  }

  async function deleteRoom(course, p) {
    if (!(await confirmDialog('Raum löschen?', `Den Sitzplan „${p.name}“ endgültig löschen? Gespeicherte Stände bleiben erhalten.`, { okLabel: 'Löschen', danger: true }))) return;
    course.seatingPlans = course.seatingPlans.filter((x) => x.id !== p.id);
    NM.app.commit();
  }

  // ---------- Gespeicherte Sitzpläne ----------

  function savedCard(course, st) {
    const list = (course.seatingSaved || []).slice().sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    return h(
      'div',
      { class: 'card' },
      h('h2', { class: 'seat-tray-title' }, 'Gespeicherte Stände'),
      h('button', { class: 'btn btn-sm', onclick: () => savePlan(course, st) }, '💾 Stand speichern …'),
      list.length
        ? h(
            'ul',
            { class: 'plain seat-saved' },
            list.map((p) =>
              h(
                'li',
                null,
                h('div', { class: 'grow' }, h('strong', null, p.name), h('div', { class: 'muted small' }, [p.room, p.savedAt ? new Date(p.savedAt).toLocaleDateString('de-DE') : '', `${Object.keys(p.pos || {}).length} Plätze`].filter(Boolean).join(' · '))),
                h('button', { class: 'btn btn-sm', onclick: () => loadPlan(course, p) }, 'Laden'),
                h('button', { class: 'icon-btn danger', title: 'Löschen', 'aria-label': 'Gespeicherten Plan löschen', onclick: () => deletePlan(course, p) }, '✕')
              )
            )
          )
        : h('p', { class: 'muted small' }, 'Noch keine gespeicherten Stände.')
    );
  }

  async function savePlan(course, st) {
    const name = await promptDialog('Stand speichern', 'Name, z. B. „ab Herbstferien“', `${st.name} ${new Date().toLocaleDateString('de-DE')}`);
    if (name === null) return;
    course.seatingSaved = course.seatingSaved || [];
    course.seatingSaved.push({ id: uid(), name: name.trim() || 'Sitzplan', room: st.name, savedAt: new Date().toISOString(), cols: st.cols, rows: st.rows, desk: st.desk, pos: JSON.parse(JSON.stringify(st.pos)) });
    NM.app.commit();
    toast('Sitzplan gespeichert.');
  }

  async function loadPlan(course, p) {
    const st = seating(course);
    if (!(await confirmDialog('Stand laden?', `„${p.name}“ ersetzt den aktuellen Sitzplan von „${st.name}“. Speichern Sie ihn vorher, wenn Sie ihn behalten möchten.`, { okLabel: 'Laden' }))) return;
    Object.assign(st, { cols: p.cols, rows: p.rows, desk: p.desk, pos: JSON.parse(JSON.stringify(p.pos || {})) });
    NM.app.commit();
  }

  async function deletePlan(course, p) {
    if (!(await confirmDialog('Gespeicherten Plan löschen?', `„${p.name}“ endgültig löschen?`, { okLabel: 'Löschen', danger: true }))) return;
    course.seatingSaved = (course.seatingSaved || []).filter((x) => x.id !== p.id);
    NM.app.commit();
  }

  // ---------- Fotos ----------

  /** Bild (Blob oder URL) quadratisch zuschneiden, verkleinern, als JPEG-Data-URL. */
  function toPhoto(src) {
    return new Promise((resolve, reject) => {
      const url = src instanceof Blob ? URL.createObjectURL(src) : src;
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        // Hochformat-Porträts: eher oben ausschneiden (Gesicht)
        const sx = (img.naturalWidth - side) / 2;
        const sy = img.naturalHeight > img.naturalWidth ? (img.naturalHeight - side) * 0.2 : (img.naturalHeight - side) / 2;
        const c = document.createElement('canvas');
        c.width = c.height = PHOTO_PX;
        c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
        if (src instanceof Blob) URL.revokeObjectURL(url);
        try {
          resolve(c.toDataURL('image/jpeg', 0.82));
        } catch (e) {
          reject(e); // fremdes Bild ohne Freigabe (Canvas „tainted“)
        }
      };
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      img.src = url;
    });
  }

  /** Foto setzen; gleichnamige Personen anderer Kurse desselben Schuljahres ohne Foto bekommen es mit. */
  function setPhoto(course, s, dataUrl) {
    s.photo = dataUrl;
    let others = 0;
    for (const c of NM.app.coursesOfYear()) {
      if (c === course) continue;
      for (const o of c.students) {
        if (!o.photo && o.last === s.last && o.first === s.first && (o.last || o.first)) {
          o.photo = dataUrl;
          others++;
        }
      }
    }
    NM.app.commit();
    toast(others ? `Foto gespeichert (auch in ${others} weiteren Kurs${others === 1 ? '' : 'en'}).` : 'Foto gespeichert.');
  }

  async function removePhoto(course, s) {
    if (!(await confirmDialog('Foto entfernen?', `Foto von ${M.studentName(s)} in diesem Kurs entfernen?`, { okLabel: 'Entfernen', danger: true }))) return;
    delete s.photo;
    NM.app.commit();
  }

  async function addPhotoFrom(course, sid, { file, url }) {
    const s = course.students.find((p) => p.id === sid);
    if (!s) return;
    try {
      setPhoto(course, s, await toPhoto(file || url));
    } catch (e) {
      toast('Das Bild ließ sich nicht übernehmen. Bitte im Browser Rechtsklick → „Bild kopieren“, dann Karte anklicken und Strg+V.', 'error', 7000);
    }
  }

  /** Bilder per Drag & Drop (Dateien oder Bilder aus anderen Browser-Tabs) auf eine Karte. */
  function enablePhotoDrop(root, course) {
    const cardAt = (e) => e.target.closest && e.target.closest('.seat-card');
    root.addEventListener('dragover', (e) => {
      const c = cardAt(e);
      if (!c) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      c.classList.add('seat-over');
    });
    root.addEventListener('dragleave', (e) => {
      const c = cardAt(e);
      if (c && !c.contains(e.relatedTarget)) c.classList.remove('seat-over');
    });
    root.addEventListener('drop', (e) => {
      const c = cardAt(e);
      if (!c) return;
      e.preventDefault();
      c.classList.remove('seat-over');
      const dt = e.dataTransfer;
      const file = [...dt.files].find((f) => f.type.startsWith('image/'));
      if (file) return addPhotoFrom(course, c.dataset.sid, { file });
      const html = dt.getData('text/html');
      const m = html && /<img[^>]+src="([^"]+)"/i.exec(html);
      const url = (m && m[1].replace(/&amp;/g, '&')) || (dt.getData('text/uri-list') || '').split('\n')[0].trim();
      if (url) return addPhotoFrom(course, c.dataset.sid, { url });
      toast('Kein Bild erkannt.', 'error');
    });
  }

  // Strg+V: kopiertes Bild auf die ausgewählte Karte
  document.addEventListener('paste', (e) => {
    if (NM.app.state.ui.tab !== 'seating' || !selectedSid) return;
    const course = NM.app.currentCourse();
    if (!course || !course.students.some((s) => s.id === selectedSid)) return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find((i) => i.type.startsWith('image/'));
    if (!item) return toast('In der Zwischenablage ist kein Bild. Im Browser Rechtsklick auf das Foto → „Bild kopieren“.', 'error', 6000);
    e.preventDefault();
    addPhotoFrom(course, selectedSid, { file: item.getAsFile() });
  });

  /** Ziehen per Pointer-Events (Maus, Stift, Touch). */
  function enableDrag(root, course, st) {
    root.addEventListener('pointerdown', (e) => {
      const cardEl = e.target.closest('.seat-card');
      if (!cardEl || e.button > 0 || e.target.closest('.seat-photo-del')) return;
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
        // Klick ohne nennenswerte Bewegung: Karte auswählen (für Strg+V)
        if (ev.type === 'pointerup' && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) {
          selectedSid = selectedSid === sid ? null : sid;
          document.querySelectorAll('.seat-card').forEach((el) => el.classList.toggle('seat-selected', el.dataset.sid === selectedSid));
          return;
        }
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
