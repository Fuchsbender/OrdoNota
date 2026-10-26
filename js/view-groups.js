/* OrdoNota – Reiter „Gruppen“: Gruppen bilden (zufällig, leistungsgemischt/-gleich, mit Regeln), Gruppenpuzzle, Beamer, Druck. */
(function (NM) {
  'use strict';
  const { h, modal, toast, confirmDialog, fmtDate, todayISO, uid } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;
  const GR = NM.groups;

  const MODES = [
    ['random', 'zufällig'],
    ['mixed', 'leistungsgemischt'],
    ['similar', 'leistungsgleich'],
  ];
  let picked = null; // angeklickte Person zum Verschieben/Tauschen: { setId, sid }

  function data(course) {
    course.groupSets = course.groupSets || [];
    course.groupRules = course.groupRules || {};
    course.groupRules.apart = course.groupRules.apart || [];
    course.groupRules.together = course.groupRules.together || [];
    return course;
  }

  const fullName = (s) => [s.first, s.last].filter(Boolean).join(' ');

  function byId(course) {
    return new Map(course.students.map((s) => [s.id, s]));
  }

  /** Leistung je Person: gerundete Halbjahresnote (Punkte 0–15) des aktuellen Halbjahres; wird nie gespeichert. */
  function scores(course) {
    const half = NM.app.currentHalf(course);
    const out = {};
    for (const s of M.activeStudents(course)) {
      const r = G.halfResult(course, half, s.id);
      if (r.final !== null && r.final !== undefined) out[s.id] = r.final;
    }
    return out;
  }

  /** Vorheriger Gruppensatz für „Abwechslung“ (der zuletzt angelegte andere Satz). */
  function previousSet(course, set) {
    const list = course.groupSets.filter((x) => x !== set && !x.homeId);
    return list[list.length - 1] || null;
  }

  function render(view, { course }) {
    data(course);
    const ui = NM.app.state.ui;
    ui.groupSetId = ui.groupSetId || {};
    const sets = course.groupSets.filter((x) => !x.homeId); // Expertengruppen erscheinen unter ihren Stammgruppen
    const sel = course.groupSets.find((x) => x.id === ui.groupSetId[course.id]);
    const cur = (sel && (sel.homeId ? sets.find((x) => x.id === sel.homeId) : sel)) || sets[sets.length - 1] || null;
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Gruppen')),
      UI.pickerList({
        items: sets,
        currentId: cur && cur.id,
        onPick: (id) => {
          ui.groupSetId[course.id] = id;
          NM.app.saveUi();
          NM.app.rerender();
        },
        onAdd: () => newSet(course),
        addLabel: '+ Neue Einteilung',
        sub: (x) => [fmtDate(x.date), `${x.groups.length} Gruppen`, course.groupSets.some((e) => e.homeId === x.id) ? 'Gruppenpuzzle' : null].filter(Boolean).join(' · '),
      })
    );
    if (!M.activeStudents(course).length) {
      view.append(UI.emptyState('Noch keine Namen', 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.'));
      return;
    }
    if (!cur) view.append(UI.emptyState('Noch keine Gruppeneinteilung', 'Für Gruppenaufträge, Lernaufträge, Gruppenpuzzle oder Vorträge: „+ Neue Einteilung“ – Größe oder Anzahl vorgeben, zufällig oder nach Leistung gemischt, mit Regeln wie „nicht zusammen“. Die Einteilung lässt sich danach neu würfeln, per Ziehen anpassen, am Beamer zeigen, drucken und in eine Präsentation übernehmen.'));
    else view.append(...setCard(course, cur));
    view.append(absentCard(course), rulesCard(course));
  }

  // ---------- Neue Einteilung ----------

  function optionsForm(course, opts = {}) {
    const by = h('select', { class: 'input', 'data-focus-key': 'grp-by' }, h('option', { value: 'size', selected: opts.by !== 'count' }, 'Personen je Gruppe'), h('option', { value: 'count', selected: opts.by === 'count' }, 'Anzahl Gruppen'));
    const num = h('input', { class: 'input', type: 'number', min: 1, step: 1, value: opts.n || 4, 'data-focus-key': 'grp-n' });
    const mode = h('select', { class: 'input', 'data-focus-key': 'grp-mode' }, MODES.map(([v, l]) => h('option', { value: v, selected: (opts.mode || 'random') === v }, l)));
    const vary = h('input', { type: 'checkbox', checked: opts.vary !== false, 'data-focus-key': 'grp-vary' });
    const away = NM.views.draw.absent(course);
    const n = M.activeStudents(course).filter((s) => !away.has(s.id)).length;
    const preview = h('p', { class: 'small muted' });
    const update = () => {
      const v = Math.max(1, Math.round(Number(num.value) || 1));
      const sz = GR.sizes(n, by.value === 'count' ? { count: v } : { size: v });
      preview.textContent = `${n} Personen${away.size ? ` (ohne ${away.size} abwesende)` : ''} → ${sz.length} Gruppen: ${sz.join(' · ')}`;
    };
    by.onchange = update;
    num.oninput = update;
    update();
    const el = h(
      'div',
      null,
      h('div', { class: 'form-grid' }, h('label', { class: 'field' }, h('span', null, 'Einteilen nach'), by), h('label', { class: 'field' }, h('span', null, 'Zahl'), num)),
      preview,
      h('label', { class: 'field' }, h('span', null, 'Verfahren'), mode),
      h('p', { class: 'small muted' }, 'Leistungsgemischt: jede Gruppe hat einen ähnlichen Notenschnitt. Leistungsgleich: Personen mit ähnlicher Note zusammen. Grundlage ist die Halbjahresnote des aktuellen Halbjahres; sie erscheint nur hier in der App.'),
      h('label', { class: 'check' }, vary, ' Abwechslung: möglichst nicht mit denselben Personen wie in der letzten Einteilung'),
      h('p', { class: 'small muted' }, 'Regeln („nicht zusammen“, „zusammen“) aus der Karte „Regeln“ werden immer beachtet.')
    );
    return { el, value: () => ({ by: by.value, n: Math.max(1, Math.round(Number(num.value) || 1)), mode: mode.value, vary: vary.checked }) };
  }

  async function newSet(course) {
    const name = h('input', { class: 'input', value: 'Gruppen ' + fmtDate(todayISO()), 'data-focus-key': 'grp-set-name' });
    const form = optionsForm(course);
    const v = await modal({
      title: 'Neue Gruppeneinteilung',
      wide: true,
      body: h('div', null, h('label', { class: 'field' }, h('span', null, 'Bezeichnung'), name), form.el),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: '🎲 Gruppen bilden', value: 'ok', kind: 'primary' },
      ],
    });
    if (v !== 'ok') return;
    const set = { id: uid(), name: name.value.trim() || 'Gruppen', date: todayISO(), opts: form.value(), groups: [] };
    course.groupSets.push(set);
    roll(course, set);
    NM.app.state.ui.groupSetId[course.id] = set.id;
    NM.app.saveUi();
    NM.app.commit();
  }

  /** (Neu) würfeln: fixierte Gruppen bleiben, alle anderen anwesenden Personen werden neu verteilt. */
  function roll(course, set) {
    const o = set.opts || { by: 'size', n: 4, mode: 'random', vary: true };
    const away = NM.views.draw.absent(course);
    const locked = set.groups.filter((g) => g.locked);
    const fixed = new Set(locked.flatMap((g) => g.members));
    const ids = M.activeStudents(course)
      .map((s) => s.id)
      .filter((sid) => !away.has(sid) && !fixed.has(sid));
    let sz;
    if (locked.length) {
      // Anzahl der Gruppen bleibt, nur die offenen werden neu gefüllt
      const open = Math.max(1, set.groups.length - locked.length);
      sz = GR.sizes(ids.length, { count: open });
    } else sz = GR.sizes(ids.length, o.by === 'count' ? { count: o.n } : { size: o.n });
    const prev = o.vary ? previousSet(course, set) : null;
    const built = GR.build(ids, { sizes: sz, mode: o.mode, scores: o.mode === 'random' ? {} : scores(course), rules: course.groupRules, previous: prev && prev.groups });
    const openGroups = set.groups.filter((g) => !g.locked);
    const out = [];
    let k = 0;
    for (const g of set.groups) {
      if (g.locked) out.push(g);
      else if (k < built.length) out.push(Object.assign(g, { members: built[k++] }));
    }
    while (k < built.length) out.push({ id: uid(), name: '', members: built[k++] });
    for (const g of openGroups) if (!out.includes(g) && g.members) g.members = [];
    set.groups = out.filter((g) => g.locked || g.members.length);
    let n = 1;
    for (const g of set.groups) if (!g.name) {
      while (set.groups.some((x) => x.name === 'Gruppe ' + n)) n++;
      g.name = 'Gruppe ' + n++;
    }
  }

  // ---------- Eine Einteilung (Stammgruppen) und ihre Expertengruppen ----------

  /** Anzeige in der App (pro Gerät gemerkt): Fotos und Nachnamen. */
  function viewOpts() {
    const ui = NM.app.state.ui;
    ui.groupView = ui.groupView || {};
    for (const [k, v] of Object.entries({ photos: false, last: true })) if (typeof ui.groupView[k] !== 'boolean') ui.groupView[k] = v;
    return ui.groupView;
  }

  function viewToggles() {
    const o = viewOpts();
    const t = (key, label, title) =>
      h(
        'button',
        {
          class: 'btn btn-sm grp-view-toggle' + (o[key] ? ' active' : ''),
          'aria-pressed': String(!!o[key]),
          'data-focus-key': 'gv-' + key,
          title,
          onclick: () => {
            o[key] = !o[key];
            NM.app.saveUi();
            NM.app.rerender();
          },
        },
        label
      );
    return h('div', { class: 'inline grp-view-toggles' }, t('photos', '📷 Fotos', 'Fotos (bzw. Personensymbol) bei den Namen zeigen'), t('last', 'Nachnamen', 'Nachnamen zeigen oder ausblenden (bei gleichen Vornamen bleibt die Initiale)'));
  }

  /**
   * Gruppenkarten einer Einteilung mit Verschieben/Tauschen (Ziehen oder Anklicken) und Ablage „Nicht eingeteilt“.
   * opts: { sc: Halbjahresnoten (Ø je Gruppe), letters: Teilthema-Buchstaben zeigen, lockable, taskHint }
   */
  function board(course, set, { sc = null, letters = false, lockable = true, taskHint = 'Auftrag oder Thema (erscheint auf Beamer und Ausdruck)' } = {}) {
    const students = byId(course);
    const away = NM.views.draw.absent(course);
    const o = viewOpts();
    const name = displayName(course, o.last);
    const assigned = new Set(set.groups.flatMap((g) => g.members));
    const free = M.activeStudents(course).filter((s) => !assigned.has(s.id));
    const ready = picked && picked.setId === set.id;
    const move = (sid, target) => {
      for (const g of set.groups) g.members = g.members.filter((x) => x !== sid);
      if (target) target.members.push(sid);
      picked = null;
      NM.app.commit();
    };
    const swap = (a, b) => {
      const ga = set.groups.find((g) => g.members.includes(a));
      const gb = set.groups.find((g) => g.members.includes(b));
      if (!ga && !gb) return;
      // Eine der beiden kann „nicht eingeteilt“ sein: dann nimmt sie den Platz der anderen ein
      if (ga) ga.members[ga.members.indexOf(a)] = b;
      if (gb) gb.members[gb.members.indexOf(b)] = a;
      picked = null;
      NM.app.commit();
    };
    const chip = (sid, g, i) => {
      const s = students.get(sid);
      return h(
        'button',
        {
          class: 'grp-person' + (picked && picked.setId === set.id && picked.sid === sid ? ' picked' : '') + (away.has(sid) ? ' away' : '') + (o.photos ? ' with-photo' : ''),
          draggable: 'true',
          'data-sid': sid,
          'data-focus-key': `gp-${set.id}-${sid}`,
          title: (s ? fullName(s) + ' – ' : '') + 'ziehen oder anklicken und dann eine Gruppe bzw. Person anklicken (verschieben/tauschen)' + (sc && sc[sid] !== undefined ? ` · Halbjahresnote ${G.label(sc[sid], G.courseLevel(course))}` : ''),
          ondragstart: (e) => e.dataTransfer.setData('text/plain', set.id + '|' + sid),
          onclick: (e) => {
            e.stopPropagation();
            if (!picked || picked.setId !== set.id) picked = { setId: set.id, sid };
            else if (picked.sid === sid) picked = null;
            else return swap(picked.sid, sid);
            NM.app.rerender();
          },
        },
        o.photos ? h('img', { class: 'grp-photo', src: (s && s.photo) || M.PERSON_ICON, alt: '' }) : null,
        letters && g ? h('span', { class: 'grp-letter', title: 'Expertin/Experte für Teilthema ' + GR.letter(i) }, GR.letter(i)) : null,
        s ? name(s) : '?'
      );
    };
    const dropZone = (target) => ({
      ondragover: (e) => e.preventDefault(),
      ondrop: (e) => {
        e.preventDefault();
        const [setId, sid] = e.dataTransfer.getData('text/plain').split('|');
        if (sid && setId === set.id) move(sid, target);
      },
      onclick: () => {
        if (picked && picked.setId === set.id) move(picked.sid, target);
      },
    });
    const cards = set.groups.map((g) => {
      const vals = sc ? g.members.map((sid) => sc[sid]).filter((v) => v !== undefined) : [];
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return h(
        'div',
        Object.assign({ class: 'grp-box' + (g.locked ? ' locked' : '') + (ready ? ' drop-ready' : ''), 'data-group': g.id }, dropZone(g)),
        h(
          'div',
          { class: 'grp-box-head' },
          h('input', {
            class: 'input input-sm grp-box-name',
            value: g.name,
            'aria-label': 'Name der Gruppe',
            'data-focus-key': 'gb-name-' + g.id,
            onclick: (e) => e.stopPropagation(),
            onchange: (e) => {
              g.name = e.target.value.trim() || g.name;
              NM.app.commit();
            },
          }),
          h('span', { class: 'muted small' }, g.members.length),
          avg !== null ? h('span', { class: 'muted small', title: 'Ø Halbjahresnote der Gruppe (nur in der App)' }, 'Ø ' + NM.util.fmtNum(G.courseLevel(course) === 'mss' ? avg : G.pointsToDecimal(avg), 1)) : null,
          lockable
            ? h(
                'button',
                {
                  class: 'icon-btn' + (g.locked ? ' active' : ''),
                  title: g.locked ? 'Fixiert: bleibt beim Neuwürfeln erhalten (Klick löst)' : 'Fixieren: bleibt beim Neuwürfeln erhalten',
                  'aria-label': (g.locked ? 'Lösen: ' : 'Fixieren: ') + g.name,
                  'aria-pressed': String(!!g.locked),
                  'data-focus-key': 'gb-lock-' + g.id,
                  onclick: (e) => {
                    e.stopPropagation();
                    if (g.locked) delete g.locked;
                    else g.locked = true;
                    NM.app.commit();
                  },
                },
                g.locked ? '🔒' : '🔓'
              )
            : null,
          h(
            'button',
            {
              class: 'icon-btn',
              title: 'Gruppe löschen (Mitglieder werden „nicht eingeteilt“)',
              'aria-label': 'Gruppe löschen: ' + g.name,
              onclick: (e) => {
                e.stopPropagation();
                set.groups = set.groups.filter((x) => x !== g);
                NM.app.commit();
              },
            },
            '✕'
          )
        ),
        h('input', {
          class: 'input input-sm grp-task',
          value: g.task || '',
          placeholder: taskHint,
          'aria-label': 'Auftrag ' + g.name,
          'data-focus-key': 'gb-task-' + g.id,
          onclick: (e) => e.stopPropagation(),
          onchange: (e) => {
            const v = e.target.value.trim();
            if (v) g.task = v;
            else delete g.task;
            NM.app.commit();
          },
        }),
        h('div', { class: 'grp-people' }, g.members.map((sid, i) => chip(sid, g, i)))
      );
    });
    return [
      h('div', { class: 'grp-grid' }, cards),
      h('div', Object.assign({ class: 'grp-free' + (ready ? ' drop-ready' : ''), 'data-group': '' }, dropZone(null)), h('span', { class: 'muted small' }, free.length ? 'Nicht eingeteilt:' : 'Alle aktiven Personen sind eingeteilt.'), free.map((s) => chip(s.id, null, 0))),
    ];
  }

  function addGroupButton(set, key) {
    return h(
      'button',
      {
        class: 'btn btn-ghost',
        'data-focus-key': key,
        onclick: () => {
          let n = set.groups.length + 1;
          while (set.groups.some((g) => g.name === 'Gruppe ' + n)) n++;
          set.groups.push({ id: uid(), name: 'Gruppe ' + n, members: [] });
          NM.app.commit();
        },
      },
      '+ Gruppe'
    );
  }

  function printMenu(course, set) {
    return UI.printButton('Drucken: ' + set.name, [
      { id: 'list', icon: '📄', label: 'Gruppeneinteilung', group: 'students', tip: 'Alle Gruppen mit Auftrag und Mitgliedern auf einer Seite – zum Aushängen. Ohne Noten und Regeln.', run: () => printSet(course, set, 'list') },
      { id: 'cards', icon: '🗂️', label: 'Gruppenkarten', group: 'students', tip: 'Je Gruppe eine Karte mit Name, Auftrag und Mitgliedern zum Ausschneiden und Austeilen.', run: () => printSet(course, set, 'cards') },
    ]);
  }

  function beamerButton(course, set, key, which) {
    return h('button', { class: 'btn', 'data-focus-key': key, title: 'Im Vollbild für den Beamer zeigen – große Schrift, ohne Noten; Fotos und Nachnamen umschaltbar', onclick: () => beamer(course, set, which) }, '📽 Beamer');
  }

  function setCard(course, set) {
    const away = NM.views.draw.absent(course);
    const students = byId(course);
    const nm = (sid) => (students.get(sid) ? fullName(students.get(sid)) : '?');
    const prev = previousSet(course, set);
    const issues = GR.check(set.groups, course.groupRules, set.opts && set.opts.vary && prev ? prev.groups : null);
    const sc = set.opts && set.opts.mode !== 'random' ? scores(course) : null;
    const expertSet = course.groupSets.find((x) => x.homeId === set.id);
    const warn = [];
    const pairText = ([a, b]) => `${nm(a)} & ${nm(b)}`;
    if (issues.apart.length) warn.push('Nicht zusammen, aber in einer Gruppe: ' + issues.apart.map(pairText).join(', '));
    if (issues.together.length) warn.push('Zusammen, aber getrennt: ' + issues.together.map(pairText).join(', '));
    const awayIn = set.groups.flatMap((g) => g.members).filter((sid) => away.has(sid));
    if (awayIn.length) warn.push('Heute abwesend, aber eingeteilt: ' + awayIn.map(nm).join(', '));
    const pres = course.assessments.filter((a) => a.kind === 'pres');
    const main = h(
      'div',
      { class: 'card grp-set' },
      h(
        'div',
        { class: 'form-row' },
        h('label', { class: 'field grow' }, h('span', null, 'Bezeichnung'), h('input', { class: 'input', value: set.name, 'data-focus-key': 'gs-name', onchange: (e) => ((set.name = e.target.value.trim() || set.name), NM.app.commit()) })),
        h('label', { class: 'field' }, h('span', null, 'Datum'), h('input', { class: 'input', type: 'date', value: set.date || '', onchange: (e) => ((set.date = e.target.value), NM.app.commit()) })),
        h(
          'div',
          { class: 'field actions-end' },
          h('span', null, ' '),
          h(
            'div',
            { class: 'inline wrap' },
            h('button', { class: 'btn', 'data-focus-key': 'gs-roll', title: 'Alle nicht fixierten Gruppen neu mischen (anwesende Personen)', onclick: () => (roll(course, set), NM.app.commit()) }, '🎲 Neu würfeln'),
            h('button', { class: 'btn btn-ghost', 'data-focus-key': 'gs-opts', onclick: () => editOptions(course, set) }, '⚙ Verfahren'),
            beamerButton(course, set, 'gs-beamer', 'home'),
            printMenu(course, set),
            h(
              'button',
              {
                class: 'icon-btn danger',
                title: 'Einteilung löschen',
                'aria-label': 'Einteilung löschen',
                onclick: async () => {
                  if (!(await confirmDialog('Einteilung löschen?', `„${set.name}“ löschen?` + (expertSet ? ' Die Expertengruppen werden mitgelöscht.' : ''), { okLabel: 'Löschen', danger: true }))) return;
                  course.groupSets = course.groupSets.filter((x) => x !== set && x !== expertSet);
                  NM.app.commit();
                },
              },
              '🗑'
            )
          )
        )
      ),
      h(
        'div',
        { class: 'grp-set-info' },
        h(
          'p',
          { class: 'small muted' },
          `${(MODES.find(([v]) => v === (set.opts || {}).mode) || MODES[0])[1]} · ${set.opts && set.opts.by === 'count' ? set.opts.n + ' Gruppen' : 'je ' + ((set.opts && set.opts.n) || 4) + ' Personen'}${set.opts && set.opts.vary ? ' · Abwechslung' : ''} · Personen ziehen oder anklicken, um sie zu verschieben oder zu tauschen; 🔒 fixiert eine Gruppe beim Neuwürfeln.` + (expertSet ? ' Buchstabe = Teilthema im Gruppenpuzzle.' : '')
        ),
        viewToggles()
      ),
      warn.length ? h('div', { class: 'notice warn' }, warn.map((w) => h('div', null, '⚠ ' + w))) : null,
      issues.repeats && set.opts && set.opts.vary ? h('p', { class: 'small muted' }, `${issues.repeats} Paar${issues.repeats === 1 ? '' : 'e'} wie in „${prev.name}“.`) : null,
      ...board(course, set, { sc, letters: !!expertSet }),
      h(
        'div',
        { class: 'inline wrap' },
        addGroupButton(set, 'gs-add'),
        expertSet ? null : h('button', { class: 'btn btn-ghost', 'data-focus-key': 'gs-experts', title: 'Gruppenpuzzle: Diese Gruppen sind die Stammgruppen. Daraus werden darunter Expertengruppen (je Teilthema eine) gebildet.', onclick: () => makeExperts(course, set) }, '🧩 Expertengruppen bilden'),
        pres.length
          ? h(
              'select',
              { class: 'input input-sm', 'aria-label': 'In Präsentation übernehmen', 'data-focus-key': 'gs-to-pres', onchange: (e) => toPres(course, set, e.target.value) },
              h('option', { value: '' }, '→ In Präsentation übernehmen …'),
              pres.map((a) => h('option', { value: a.id }, `${a.name} (${a.half})`))
            )
          : null
      )
    );
    return expertSet ? [main, expertCard(course, set, expertSet)] : [main];
  }

  /** Expertengruppen des Gruppenpuzzles, direkt unter den Stammgruppen. */
  function expertCard(course, home, ex) {
    const expected = GR.experts(home.groups.filter((g) => g.members.length)).map((m) => m.slice().sort().join());
    const actual = ex.groups.map((g) => g.members.slice().sort().join());
    const stale = expected.length !== actual.length || expected.some((m, i) => m !== actual[i]);
    return h(
      'div',
      { class: 'card grp-set grp-experts' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, '🧩 Expertengruppen'),
        h(
          'div',
          { class: 'inline wrap' },
          h('button', { class: 'btn btn-ghost', 'data-focus-key': 'ex-rebuild', title: 'Expertengruppen aus den aktuellen Stammgruppen neu bilden (Teilthemen bleiben)', onclick: () => makeExperts(course, home) }, '↻ Neu bilden'),
          beamerButton(course, home, 'ex-beamer', 'experts'),
          printMenu(course, ex),
          h(
            'button',
            {
              class: 'icon-btn danger',
              title: 'Expertengruppen löschen',
              'aria-label': 'Expertengruppen löschen',
              onclick: async () => {
                if (!(await confirmDialog('Expertengruppen löschen?', 'Die Expertengruppen löschen? Die Stammgruppen bleiben.', { okLabel: 'Löschen', danger: true }))) return;
                course.groupSets = course.groupSets.filter((x) => x !== ex);
                NM.app.commit();
              },
            },
            '🗑'
          )
        )
      ),
      h('p', { class: 'small muted' }, 'Aus jeder Stammgruppe sitzt die Person mit Teilthema A in Gruppe A usw. Nach der Expertenphase kehren alle in ihre Stammgruppe zurück.'),
      stale ? h('div', { class: 'notice warn' }, '⚠ Die Stammgruppen wurden seitdem geändert. „↻ Neu bilden“ passt die Expertengruppen an.') : null,
      ...board(course, ex, { lockable: false, taskHint: 'Teilthema (z. B. Text A, Station B)' }),
      h('div', { class: 'inline wrap' }, addGroupButton(ex, 'ex-add'))
    );
  }

  async function editOptions(course, set) {
    const form = optionsForm(course, set.opts || {});
    const v = await modal({
      title: 'Verfahren: ' + set.name,
      wide: true,
      body: form.el,
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Übernehmen', value: 'keep' },
        { label: '🎲 Übernehmen und neu würfeln', value: 'roll', kind: 'primary' },
      ],
    });
    if (!v) return;
    set.opts = form.value();
    if (v === 'roll') roll(course, set);
    NM.app.commit();
  }

  /** Expertengruppen zu Stammgruppen bilden oder neu bilden (Namen und Teilthemen vorhandener Gruppen bleiben). */
  function makeExperts(course, set) {
    const ex = GR.experts(set.groups.filter((g) => g.members.length));
    if (ex.length < 2) return toast('Für ein Gruppenpuzzle braucht es Stammgruppen mit mindestens zwei Personen.', 'error');
    let e = course.groupSets.find((x) => x.homeId === set.id);
    if (!e) {
      e = { id: uid(), name: set.name + ' – Expertengruppen', date: set.date || todayISO(), homeId: set.id, groups: [] };
      course.groupSets.push(e);
    }
    e.groups = ex.map((members, i) => Object.assign({ id: uid(), name: 'Experten ' + GR.letter(i) }, e.groups[i] ? { id: e.groups[i].id, name: e.groups[i].name, task: e.groups[i].task } : {}, { members }));
    for (const g of e.groups) if (!g.task) delete g.task;
    NM.app.commit();
    toast(`${ex.length} Expertengruppen gebildet (Teilthemen A–${GR.letter(ex.length - 1)}).`, 'info');
  }

  async function toPres(course, set, id) {
    const a = course.assessments.find((x) => x.id === id);
    if (!a) return;
    await NM.views.pres.applyGroups(a, set, course);
    NM.app.rerender();
  }

  // ---------- Abwesend und Regeln ----------

  function absentCard(course) {
    const away = NM.views.draw.absent(course);
    const students = M.activeStudents(course);
    return h(
      'details',
      { class: 'card pool-card grp-away' },
      h('summary', null, h('h2', null, 'Heute abwesend'), h('span', { class: 'muted small' }, away.size ? ` ${away.size} · ` + students.filter((s) => away.has(s.id)).map(fullName).join(', ') : ' niemand')),
      h('p', { class: 'muted small' }, 'Abwesende werden beim Würfeln ausgelassen. Gilt nur bis zum Neuladen, gemeinsam mit dem Reiter „Ziehen“.'),
      h(
        'div',
        { class: 'grp-away-list' },
        students.map((s) =>
          h(
            'label',
            { class: 'check' },
            h('input', {
              type: 'checkbox',
              checked: away.has(s.id),
              'data-focus-key': 'away-' + s.id,
              onchange: (e) => {
                if (e.target.checked) away.add(s.id);
                else away.delete(s.id);
                NM.app.rerender();
              },
            }),
            ' ',
            M.studentName(s)
          )
        )
      )
    );
  }

  function rulesCard(course) {
    const r = course.groupRules;
    const students = M.activeStudents(course);
    const all = byId(course);
    const nm = (sid) => (all.get(sid) ? M.studentName(all.get(sid)) : '?');
    const section = (key, title, hint) => {
      const a = h('select', { class: 'input input-sm', 'aria-label': title + ': erste Person', 'data-focus-key': `rule-${key}-a` }, h('option', { value: '' }, '— Person —'), students.map((s) => h('option', { value: s.id }, M.studentName(s))));
      const b = h('select', { class: 'input input-sm', 'aria-label': title + ': zweite Person', 'data-focus-key': `rule-${key}-b` }, h('option', { value: '' }, '— Person —'), students.map((s) => h('option', { value: s.id }, M.studentName(s))));
      return h(
        'div',
        { class: 'grp-rule' },
        h('h3', null, title),
        h('p', { class: 'muted small' }, hint),
        r[key].length
          ? h(
              'div',
              { class: 'grp-members' },
              r[key].map((p) =>
                h(
                  'span',
                  { class: 'chip grp-chip' },
                  `${nm(p[0])} & ${nm(p[1])}`,
                  h(
                    'button',
                    {
                      class: 'chip-x',
                      title: 'Regel löschen',
                      'aria-label': `Regel löschen: ${nm(p[0])} & ${nm(p[1])}`,
                      onclick: () => {
                        r[key] = r[key].filter((x) => x !== p);
                        NM.app.commit();
                      },
                    },
                    '×'
                  )
                )
              )
            )
          : h('p', { class: 'muted small' }, 'Keine.'),
        h(
          'div',
          { class: 'inline wrap' },
          a,
          b,
          h(
            'button',
            {
              class: 'btn btn-ghost btn-sm',
              'data-focus-key': `rule-${key}-add`,
              onclick: () => {
                if (!a.value || !b.value || a.value === b.value) return toast('Bitte zwei verschiedene Personen wählen.', 'error');
                const other = key === 'apart' ? 'together' : 'apart';
                const same = (p) => (p[0] === a.value && p[1] === b.value) || (p[0] === b.value && p[1] === a.value);
                if (r[key].some(same)) return toast('Diese Regel gibt es schon.', 'error');
                if (r[other].some(same)) return toast('Für dieses Paar gibt es schon die gegenteilige Regel.', 'error');
                r[key].push([a.value, b.value]);
                NM.app.commit();
              },
            },
            '+ Regel'
          )
        )
      );
    };
    return h(
      'details',
      { class: 'card pool-card grp-rules', open: !!NM.app.state.ui.groupRulesOpen, ontoggle: (e) => ((NM.app.state.ui.groupRulesOpen = e.target.open), NM.app.saveUi()) },
      h('summary', null, h('h2', null, 'Regeln'), h('span', { class: 'muted small' }, ` ${r.apart.length + r.together.length} · gelten für alle Einteilungen dieses Kurses`)),
      h('p', { class: 'muted small' }, '🔒 Regeln sind vertraulich: Sie werden verschlüsselt im Kurs gespeichert und nur hier angezeigt – nie auf dem Beamer oder im Ausdruck.'),
      h('div', { class: 'grp-rule-cols' }, section('apart', 'Nicht zusammen', 'Diese Paare kommen nie in dieselbe Gruppe.'), section('together', 'Zusammen', 'Diese Paare bleiben in einer Gruppe (z. B. Unterstützung).'))
    );
  }

  // ---------- Beamer und Druck ----------

  /** Namen für Beamer und Ausdruck; ohne Nachnamen nur der Vorname (bei gleichen Vornamen mit Initiale). */
  function displayName(course, last) {
    if (last) return (s) => fullName(s);
    const count = {};
    for (const s of course.students) count[s.first] = (count[s.first] || 0) + 1;
    return (s) => (!s.first ? s.last : count[s.first] > 1 && s.last ? `${s.first} ${s.last[0]}.` : s.first);
  }

  /** Kacheln je Gruppe; opts.photos: Foto bzw. Personensymbol vor dem Namen, opts.last: Nachnamen zeigen. */
  function groupTiles(course, set, cls, { photos = false, last = true } = {}) {
    const all = byId(course);
    const name = displayName(course, last);
    const expertSet = course.groupSets.find((x) => x.homeId === set.id);
    return set.groups
      .filter((g) => g.members.length)
      .map((g) =>
        h(
          'div',
          { class: cls + (photos ? ' with-photos' : '') },
          h('h3', null, g.name),
          g.task ? h('div', { class: cls + '-task' }, g.task) : null,
          h(
            'ul',
            null,
            g.members.map((sid, i) => {
              const s = all.get(sid);
              return h('li', null, photos ? h('img', { class: 'grp-photo', src: (s && s.photo) || M.PERSON_ICON, alt: '' }) : null, expertSet ? h('span', { class: 'grp-letter' }, GR.letter(i)) : null, h('span', null, s ? name(s) : '?'));
            })
          )
        )
      );
  }

  /** Vollbild für den Beamer: Schrift so groß wie möglich, Fotos und Nachnamen per Umschalter (pro Gerät gemerkt). */
  /** which: 'home' (Stammgruppen bzw. normale Einteilung) | 'experts'; bei einem Gruppenpuzzle lässt sich im Vollbild umschalten. */
  function beamer(course, home, which = 'home') {
    const ex = course.groupSets.find((x) => x.homeId === home.id);
    const shown = () => (which === 'experts' && ex ? ex : home);
    const title = h('h1', null);
    const ui = NM.app.state.ui;
    const opt = (ui.groupBeamer = Object.assign({ photos: false, last: true }, ui.groupBeamer || {}));
    const grid = h('div', { class: 'grp-beamer-grid' });
    const toggle = (key, label, title) =>
      h(
        'button',
        {
          class: 'btn grp-beamer-toggle' + (opt[key] ? ' active' : ''),
          'aria-pressed': String(!!opt[key]),
          'data-beamer-toggle': key,
          title,
          onclick: (e) => {
            opt[key] = !opt[key];
            e.currentTarget.classList.toggle('active', opt[key]);
            e.currentTarget.setAttribute('aria-pressed', String(opt[key]));
            NM.app.saveUi();
            draw();
          },
        },
        label
      );
    // Größte Schrift, bei der alle Gruppen ohne Scrollen auf den Bildschirm passen
    const fit = () => {
      let size = Math.max(16, Math.min(96, Math.floor(overlay.clientHeight / 8)));
      for (; size > 14; size -= 2) {
        grid.style.fontSize = size + 'px';
        if (grid.scrollHeight <= grid.clientHeight + 1 && grid.scrollWidth <= grid.clientWidth + 1) break;
      }
      grid.style.fontSize = size + 'px';
    };
    const switcher = ex
      ? h(
          'div',
          { class: 'segmented' },
          [
            ['home', 'Stammgruppen'],
            ['experts', 'Expertengruppen'],
          ].map(([v, label]) =>
            h(
              'button',
              {
                class: 'seg' + (which === v ? ' active' : ''),
                'aria-pressed': String(which === v),
                'data-beamer-which': v,
                onclick: (e) => {
                  which = v;
                  for (const b of e.currentTarget.parentNode.children) {
                    b.classList.toggle('active', b === e.currentTarget);
                    b.setAttribute('aria-pressed', String(b === e.currentTarget));
                  }
                  draw();
                },
              },
              label
            )
          )
        )
      : null;
    const draw = () => {
      const set = shown();
      title.replaceChildren(set === ex ? '🧩 Expertengruppen' : home.name, h('span', { class: 'muted' }, ' · ' + M.courseTitle(course)));
      grid.replaceChildren(...groupTiles(course, set, 'grp-tile', opt));
      fit();
      // Fotos laden nachträglich und ändern die Höhe
      for (const img of grid.querySelectorAll('img')) if (!img.complete) img.addEventListener('load', fit, { once: true });
    };
    const close = () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', fit);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      overlay.remove();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const overlay = h(
      'div',
      { class: 'beamer grp-beamer', role: 'dialog', 'aria-label': 'Beamer-Ansicht' },
      h(
        'div',
        { class: 'grp-beamer-head' },
        title,
        h(
          'div',
          { class: 'grp-beamer-bar' },
          switcher,
          toggle('photos', '📷 Fotos', 'Fotos (bzw. Personensymbol) vor den Namen zeigen'),
          toggle('last', 'Nachnamen', 'Nachnamen zeigen oder ausblenden (bei gleichen Vornamen bleibt die Initiale)'),
          h('button', { class: 'btn', 'data-beamer-close': '', onclick: close, title: 'Schließen (Esc)' }, '✕ Schließen')
        )
      ),
      grid
    );
    document.body.appendChild(overlay);
    draw();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', fit);
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    overlay.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) close();
      else fit();
    });
  }

  function printSet(course, set, mode) {
    NM.print.groups(course, set, mode, groupTiles(course, set, mode === 'cards' ? 'p-grp-card' : 'p-grp'));
  }

  NM.views = NM.views || {};
  NM.views.groups = { render };
})((globalThis.NM = globalThis.NM || {}));
