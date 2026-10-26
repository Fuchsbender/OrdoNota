/* OrdoNota – Reiter „Präsentationen“: Kriterien aus dem Kriterienpool zusammenstellen, je Kriterium 0–3 Punkte, Note wie bei Tests. */
(function (NM) {
  'use strict';
  const { h, modal, toast, confirmDialog, fmtNum, fmtScore, fmtDate } = NM.util;
  const G = NM.grades;
  const M = NM.model;
  const UI = NM.ui;

  const LEVELS = [0, 1, 2, 3];
  const WEIGHTS = [1, 2, 3];
  const selected = {}; // gerade bewertete Person je Bewertung (nur bis zum Neuladen)

  function render(view, { course, db }) {
    const level = G.courseLevel(course);
    const half = NM.app.currentHalf(course);
    const list = course.assessments.filter((a) => a.kind === 'pres' && a.half === half);
    const ui = NM.app.state.ui;
    ui.presId = ui.presId || {};
    const cur = list.find((a) => a.id === ui.presId[course.id]) || list[list.length - 1] || null;
    const ids = M.statStudents(course).map((s) => s.id);
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Präsentationen'), UI.halfSwitch(course, false)),
      UI.pickerList({
        items: list,
        currentId: cur && cur.id,
        onPick: (id) => {
          ui.presId[course.id] = id;
          NM.app.saveUi();
          NM.app.rerender();
        },
        onAdd: () => addPres(course, db, half),
        addLabel: '+ Neue Bewertung',
        sub: (a) => {
          const st = G.presStats(a.pres, ids, level);
          return [fmtDate(a.date), `${a.pres.criteria.length} Kriterien`, a.ungraded ? 'nicht gewertet' : null, st.n ? 'Ø ' + fmtNum(level === 'mss' ? st.avgPoints : st.avgDec, 2) : null].filter(Boolean).join(' · ');
        },
      })
    );
    if (!cur) {
      view.append(
        UI.emptyState('Noch keine Präsentation in ' + half, 'Legen Sie eine Bewertung an: Kriterien aus dem Kriterienpool oder einer Vorlage wählen, je Person 0–3 Punkte pro Kriterium vergeben – die Note wird wie bei Tests über den Notenschlüssel berechnet.'),
        templatesCard(course, db),
        poolCard(db)
      );
      return;
    }
    view.append(
      metaCard(course, cur, level),
      criteriaCard(db, cur),
      h('div', { class: 'test-layout' }, h('div', { class: 'pres-main' }, rateCard(course, cur, level), tableCard(course, cur, level)), keyCard(course, cur, level)),
      templatesCard(course, db),
      poolCard(db)
    );
  }

  // ---------- Anlegen ----------

  /** Auswahlliste des Pools mit Haken, nach Gruppen. */
  function poolChecklist(db, exclude = new Set()) {
    const boxes = [];
    const groups = [...new Set(db.criteriaPool.map((c) => c.group || 'Sonstiges'))];
    const el = h(
      'div',
      { class: 'pool-check' },
      groups.map((g) =>
        h(
          'fieldset',
          null,
          h('legend', null, g),
          db.criteriaPool
            .filter((c) => (c.group || 'Sonstiges') === g)
            .map((c) => {
              const cb = h('input', { type: 'checkbox', disabled: exclude.has(c.id) });
              boxes.push([c, cb]);
              return h('label', { class: 'check', title: LEVELS.map((n) => `${n}: ${(c.desc || {})[n] || ''}`).join('\n') }, cb, ' ', c.name, exclude.has(c.id) ? h('span', { class: 'muted small' }, ' (schon gewählt)') : null);
            })
        )
      )
    );
    return { el, selected: () => boxes.filter(([, cb]) => cb.checked).map(([c]) => c) };
  }

  /** Quellen für die Kriterien einer neuen Bewertung: gespeicherte Vorlagen und frühere Bewertungen (alle Kurse). */
  function templates(db) {
    const out = [];
    for (const t of db.presTemplates || []) if (t.criteria.length) out.push({ group: 'Vorlagen', criteria: t.criteria, label: `${t.name} (${t.criteria.length} Kriterien)` });
    for (const c of db.courses) for (const a of c.assessments) if (a.kind === 'pres' && a.pres.criteria.length) out.push({ group: 'Frühere Bewertungen', criteria: a.pres.criteria, label: `${a.name} – ${M.courseTitle(c)} (${a.pres.criteria.length} Kriterien)` });
    return out;
  }

  async function addPres(course, db, half) {
    const name = h('input', { class: 'input', value: 'Präsentation' });
    const tpl = templates(db);
    const from = h(
      'select',
      { class: 'input' },
      h('option', { value: '' }, '— Kriterien aus dem Pool wählen —'),
      ['Vorlagen', 'Frühere Bewertungen'].map((g) => (tpl.some((x) => x.group === g) ? h('optgroup', { label: g }, tpl.map((x, i) => (x.group === g ? h('option', { value: i }, x.label) : null))) : null))
    );
    const pick = poolChecklist(db);
    const v = await modal({
      title: 'Neue Präsentationsbewertung',
      wide: true,
      body: h(
        'div',
        null,
        h('label', { class: 'field' }, h('span', null, 'Bezeichnung'), name),
        tpl.length ? h('label', { class: 'field' }, h('span', null, 'Kriterien übernehmen von (Vorlage oder frühere Bewertung)'), from) : null,
        h('p', { class: 'small' }, 'Kriterien aus dem Kriterienpool (Beschreibung der Stufen 0–3 beim Darüberfahren). Später lassen sich weitere hinzufügen, eigene anlegen, gewichten und sortieren.'),
        pick.el
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        {
          label: 'Anlegen',
          value: 'ok',
          kind: 'primary',
          validate: () => (from.value !== '' || pick.selected().length ? true : (toast('Bitte mindestens ein Kriterium wählen.', 'error'), false)),
        },
      ],
    });
    if (v !== 'ok') return;
    const crit = from.value !== '' ? tpl[Number(from.value)].criteria : pick.selected();
    const a = M.newPres(course, half, db.settings, crit);
    a.name = name.value.trim() || 'Präsentation';
    course.assessments.push(a);
    NM.app.state.ui.presId = NM.app.state.ui.presId || {};
    NM.app.state.ui.presId[course.id] = a.id;
    NM.app.saveUi();
    NM.app.commit();
  }

  // ---------- Eckdaten ----------

  function metaCard(course, a, level) {
    const p = a.pres;
    const T = NM.views.tests;
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
        h('label', { class: 'field grow' }, h('span', null, 'Bezeichnung'), h('input', { class: 'input', value: a.name, 'data-focus-key': 'pres-name', onchange: set((v) => (a.name = v.trim() || a.name)) })),
        h('label', { class: 'field' }, h('span', null, 'Datum'), h('input', { class: 'input', type: 'date', value: a.date, onchange: set((v) => (a.date = v)) })),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Bereich'),
          h(
            'select',
            { class: 'input', onchange: set((v) => (a.cat = v)) },
            h('option', { value: 'other', selected: a.cat !== 'ka' }, 'Sonstige'),
            h('option', { value: 'ka', selected: a.cat === 'ka' }, 'Klassen-/Kursarbeit (Ersatzleistung)')
          )
        ),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Wertung'),
          h(
            'label',
            { class: 'check field-check', title: 'Die Bewertung erscheint ausgegraut in der Notenübersicht und zählt nicht zur Halbjahresnote.' },
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
              const v = NM.util.parseNum(e.target.value);
              if (v === null || v === undefined || v < 0) return toast('Ungültiges Gewicht.', 'error');
              a.weight = v;
              NM.app.commit();
            },
          })
        ),
        level === 'mss' ? null : h('label', { class: 'field' }, h('span', null, 'Notenstufen'), T.gradeStepsSelect(p)),
        h('label', { class: 'field narrow', title: level === 'mss' ? 'Ab diesem Prozentsatz gibt es 4 Punkte' : 'Ab diesem Prozentsatz gibt es eine 4-' }, h('span', null, level === 'mss' ? 'LIMIT 04 P. (%)' : p.wholeGrades ? 'LIMIT 4 (%)' : 'LIMIT 4- (%)'), T.limitInput(p, level)),
        h(
          'div',
          { class: 'field actions-end' },
          h('span', null, ' '),
          h(
            'div',
            { class: 'inline' },
            printButton(course, a),
            h(
              'button',
              {
                class: 'icon-btn danger',
                title: 'Bewertung löschen',
                'aria-label': 'Bewertung löschen',
                onclick: async () => {
                  if (!(await confirmDialog('Bewertung löschen?', `„${a.name}“ mit allen Bewertungen löschen?`, { okLabel: 'Löschen', danger: true }))) return;
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

  function printButton(course, a) {
    return UI.printButton('Drucken: ' + a.name, [
      { id: 'list', icon: '📄', label: 'Bewertungsliste', group: 'teacher', tip: 'Alle Personen mit Thema, Punkten je Kriterium, Summe, Prozent und Note; darunter Notenspiegel und Notenschlüssel.', run: () => NM.print.pres(course, a, 'list') },
      { id: 'key', icon: '📊', label: 'Notenschlüssel und Notenspiegel', group: 'teacher', tip: 'Punktschwellen je Note und Verteilung der Noten mit Statistik – ohne Namen.', run: () => NM.print.pres(course, a, 'key') },
      { id: 'blank', icon: '📝', label: 'Leere Bewertungsbögen', group: 'teacher', tip: 'Je aktive Person ein Bogen mit Name, Kriterien und Kästchen 0–3 samt Stufenbeschreibung – zum Ankreuzen während der Präsentation.', run: () => NM.print.pres(course, a, 'blank') },
      { id: 'guide', icon: '📋', label: 'Bewertungskriterien (Handreichung)', group: 'students', tip: 'Eine Seite für alle vorab: Kriterien mit Gewicht und der Beschreibung jeder Stufe 0–3, ohne Namen und Noten; Notenschlüssel wahlweise.', run: () => guideDialog(course, a) },
      { id: 'sheets', icon: '🗒️', label: 'Bewertungsbogen je Person', group: 'students', tip: 'Je Person eine Seite mit Thema, Punkten je Kriterium samt Beschreibung der erreichten Stufe, Summe, Prozent, Bemerkung; Note wahlweise, Felder für Datum und Unterschrift.', run: () => sheetsDialog(course, a) },
    ]);
  }

  async function guideDialog(course, a) {
    const level = G.courseLevel(course);
    const withKey = h('input', { type: 'checkbox' });
    const v = await modal({
      title: 'Bewertungskriterien drucken',
      body: h('div', null, h('p', { class: 'small' }, 'Handreichung für die Klasse: alle Kriterien mit Gewicht und Beschreibung der Stufen 0–3.'), h('label', { class: 'check' }, withKey, ' Notenschlüssel mit abdrucken (Punkte ab … für jede Note)')),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: '🖨 Drucken', value: 'ok', kind: 'primary' },
      ],
    });
    if (v === 'ok') NM.print.presGuide({ title: a.name, course, criteria: a.pres.criteria, key: withKey.checked ? G.keyForPres(a.pres, level) : null, level });
  }

  async function sheetsDialog(course, a) {
    const level = G.courseLevel(course);
    const rated = M.activeStudents(course).filter((s) => G.presResult(a.pres, s.id, level).score !== null);
    if (!rated.length) return toast('Noch keine Bewertungen zum Drucken.', 'error');
    const who = h('select', { class: 'input' }, h('option', { value: '' }, `Alle bewerteten (${rated.length}, je eine Seite)`), rated.map((s) => h('option', { value: s.id }, M.studentName(s))));
    const grade = h('input', { type: 'checkbox', checked: true });
    const v = await modal({
      title: 'Bewertungsbögen drucken',
      body: h('div', null, h('label', { class: 'field' }, h('span', null, 'Wer'), who), h('label', { class: 'check' }, grade, ' Note mit ausdrucken')),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: '🖨 Drucken', value: 'ok', kind: 'primary' },
      ],
    });
    if (v === 'ok') NM.print.pres(course, a, 'sheets', { sid: who.value || null, withGrade: grade.checked });
  }

  // ---------- Kriterien der Bewertung ----------

  function used(p, c) {
    return Object.values(p.results).some((r) => r.scores && r.scores[c.id] !== undefined && r.scores[c.id] !== null && r.scores[c.id] !== '');
  }

  function criteriaCard(db, a) {
    const p = a.pres;
    const max = G.presAsTest(p).tasks.reduce((s, t) => s + t.max, 0);
    const rows = p.criteria.map((c, i) =>
      h(
        'tr',
        null,
        h('td', { class: 'muted small' }, c.group || ''),
        h('td', { title: LEVELS.map((n) => `${n}: ${(c.desc || {})[n] || ''}`).join('\n') }, c.name),
        h(
          'td',
          null,
          h(
            'select',
            {
              class: 'input input-sm',
              'aria-label': 'Gewicht ' + c.name,
              'data-focus-key': `crit-w-${c.id}`,
              onchange: (e) => {
                c.weight = Number(e.target.value);
                NM.app.commit();
              },
            },
            WEIGHTS.map((w) => h('option', { value: w, selected: G.critWeight(c) === w }, '×' + w))
          )
        ),
        h('td', { class: 'num' }, fmtScore(3 * G.critWeight(c))),
        h(
          'td',
          null,
          h(
            'div',
            { class: 'inline' },
            h('button', { class: 'icon-btn', title: 'Nach oben', 'aria-label': 'Nach oben: ' + c.name, disabled: i === 0, onclick: () => move(p, i, -1) }, '↑'),
            h('button', { class: 'icon-btn', title: 'Nach unten', 'aria-label': 'Nach unten: ' + c.name, disabled: i === p.criteria.length - 1, onclick: () => move(p, i, 1) }, '↓'),
            h('button', { class: 'icon-btn', title: 'Bezeichnung und Stufen bearbeiten', 'aria-label': 'Bearbeiten: ' + c.name, onclick: () => editCriterion(db, c) }, '✎'),
            h(
              'button',
              {
                class: 'icon-btn',
                title: 'Kriterium entfernen',
                'aria-label': 'Entfernen: ' + c.name,
                onclick: async () => {
                  if (used(p, c) && !(await confirmDialog('Kriterium entfernen?', `Für „${c.name}“ sind schon Punkte vergeben. Sie werden gelöscht.`, { okLabel: 'Entfernen', danger: true }))) return;
                  p.criteria = p.criteria.filter((x) => x !== c);
                  for (const r of Object.values(p.results)) if (r.scores) delete r.scores[c.id];
                  NM.app.commit();
                },
              },
              '✕'
            )
          )
        )
      )
    );
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Kriterien'), h('span', { class: 'muted' }, `je 0–3 Punkte · Höchstpunktzahl ${fmtScore(max)}`)),
      p.criteria.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table compact crit-table' }, h('thead', null, h('tr', null, h('th', null, 'Gruppe'), h('th', null, 'Kriterium'), h('th', null, 'Gewicht'), h('th', { class: 'num' }, 'max.'), h('th', null, ''))), h('tbody', null, rows))) : h('p', { class: 'muted' }, 'Noch keine Kriterien.'),
      h(
        'div',
        { class: 'inline wrap' },
        h('button', { class: 'btn btn-ghost', onclick: () => addFromPool(db, a) }, '+ aus dem Pool'),
        h('button', { class: 'btn btn-ghost', onclick: () => addOwn(db, a) }, '+ eigenes Kriterium'),
        p.criteria.length ? h('button', { class: 'btn btn-ghost', title: 'Kriterien mit Reihenfolge und Gewichten als Vorlage für spätere Bewertungen speichern (alle Kurse)', onclick: () => saveAsTemplate(db, a) }, '💾 Als Vorlage speichern') : null
      )
    );
  }

  async function saveAsTemplate(db, a) {
    const name = await NM.util.promptDialog('Als Vorlage speichern', 'Name der Vorlage', a.name);
    if (name === null || !name.trim()) return;
    const old = db.presTemplates.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
    if (old && !(await confirmDialog('Vorlage ersetzen?', `Es gibt schon eine Vorlage „${old.name}“. Ihre Kriterien werden ersetzt.`, { okLabel: 'Ersetzen' }))) return;
    const t = M.newPresTemplate(name.trim(), a.pres.criteria);
    if (old) Object.assign(old, { criteria: t.criteria });
    else db.presTemplates.push(t);
    NM.app.commit();
    toast(`Vorlage „${name.trim()}“ gespeichert.`, 'info');
  }

  function move(p, i, d) {
    const [c] = p.criteria.splice(i, 1);
    p.criteria.splice(i + d, 0, c);
    NM.app.commit();
  }

  async function addFromPool(db, a) {
    const p = a.pres;
    const pick = poolChecklist(db, new Set(p.criteria.map((c) => c.poolId)));
    const v = await modal({ title: 'Kriterien aus dem Pool', wide: true, body: pick.el, buttons: [{ label: 'Abbrechen', value: null }, { label: 'Hinzufügen', value: 'ok', kind: 'primary' }] });
    if (v !== 'ok') return;
    for (const c of pick.selected()) p.criteria.push(M.presCriterion(c));
    NM.app.commit();
  }

  /** Dialog für ein Kriterium (Gruppe, Bezeichnung, Stufen 0–3); poolLabel: zusätzlicher Haken „auch im Pool …“. */
  async function criterionDialog(title, c, poolLabel) {
    const groups = [...new Set(NM.app.db().criteriaPool.map((x) => x.group).filter(Boolean))];
    const group = h('input', { class: 'input', value: c.group || '', list: 'crit-groups' });
    const name = h('input', { class: 'input', value: c.name || '' });
    const desc = LEVELS.map((n) => h('input', { class: 'input', value: (c.desc || {})[n] || '', placeholder: ['nicht erfüllt', 'ansatzweise', 'überwiegend', 'vollständig'][n] }));
    const toPool = poolLabel ? h('input', { type: 'checkbox', checked: true }) : null;
    const v = await modal({
      title,
      wide: true,
      body: h(
        'div',
        null,
        h('datalist', { id: 'crit-groups' }, groups.map((g) => h('option', { value: g }))),
        h('div', { class: 'form-grid' }, h('label', { class: 'field' }, h('span', null, 'Kriterium'), name), h('label', { class: 'field' }, h('span', null, 'Gruppe'), group)),
        h('h3', null, 'Beschreibung je Stufe'),
        LEVELS.map((n) => h('label', { class: 'field' }, h('span', null, `${n} ${n === 1 ? 'Punkt' : 'Punkte'}`), desc[n])),
        toPool ? h('label', { class: 'check' }, toPool, ' ', poolLabel) : null
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Speichern', value: 'ok', kind: 'primary', validate: () => (name.value.trim() ? true : (toast('Bitte eine Bezeichnung eingeben.', 'error'), false)) },
      ],
    });
    if (v !== 'ok') return null;
    return { group: group.value.trim(), name: name.value.trim(), desc: Object.fromEntries(LEVELS.map((n) => [n, desc[n].value.trim()])), toPool: !!(toPool && toPool.checked) };
  }

  async function addOwn(db, a) {
    const r = await criterionDialog('Eigenes Kriterium', {}, 'auch in den Kriterienpool übernehmen (für spätere Bewertungen)');
    if (!r) return;
    const c = { id: NM.util.uid(), group: r.group, name: r.name, desc: r.desc };
    if (r.toPool) db.criteriaPool.push(c);
    a.pres.criteria.push(M.presCriterion(c));
    NM.app.commit();
  }

  async function editCriterion(db, c) {
    const inPool = db.criteriaPool.find((x) => x.id === c.poolId);
    const r = await criterionDialog('Kriterium bearbeiten', c, inPool ? 'Änderung auch im Kriterienpool speichern' : null);
    if (!r) return;
    Object.assign(c, { group: r.group, name: r.name, desc: r.desc });
    if (inPool && r.toPool) Object.assign(inPool, { group: r.group, name: r.name, desc: Object.assign({}, r.desc) });
    NM.app.commit();
  }

  // ---------- Bewerten (eine Person, große Knöpfe) ----------

  function rateCard(course, a, level) {
    const p = a.pres;
    const students = M.activeStudents(course);
    if (!students.length) return h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.'));
    const idx = Math.max(0, students.findIndex((s) => s.id === selected[a.id]));
    const s = students[idx];
    const pick = (i) => {
      selected[a.id] = students[(i + students.length) % students.length].id;
      NM.app.rerender();
    };
    const r = (p.results[s.id] = p.results[s.id] || { scores: {} });
    r.scores = r.scores || {};
    const res = G.presResult(p, s.id, level);
    const setField = (key) => (e) => {
      const v = e.target.value.trim();
      if (v) r[key] = v;
      else delete r[key];
      NM.app.commit();
    };
    const rows = p.criteria.map((c) => {
      const v = r.scores[c.id];
      const has = v !== undefined && v !== null && v !== '';
      return h(
        'div',
        { class: 'rate-row' },
        h('div', { class: 'rate-name' }, h('strong', null, c.name), G.critWeight(c) !== 1 ? h('span', { class: 'chip' }, '×' + G.critWeight(c)) : null, h('div', { class: 'muted small' }, has ? (c.desc || {})[v] || '' : c.group || '')),
        h(
          'div',
          { class: 'rate-btns', role: 'group', 'aria-label': c.name },
          LEVELS.map((n) =>
            h(
              'button',
              {
                class: 'rate-btn' + (has && Number(v) === n ? ' active' : ''),
                title: `${n}: ${(c.desc || {})[n] || ''}`,
                'aria-pressed': String(has && Number(v) === n),
                'data-focus-key': `rate-${c.id}-${n}`,
                disabled: !!r.status && r.status !== 'ungewertet',
                onclick: () => {
                  if (has && Number(v) === n) delete r.scores[c.id];
                  else r.scores[c.id] = n;
                  NM.app.commit();
                },
              },
              n
            )
          )
        )
      );
    });
    return h(
      'div',
      { class: 'card rate-card' },
      h(
        'div',
        { class: 'card-head' },
        h('h2', null, 'Bewerten'),
        h(
          'div',
          { class: 'inline' },
          h('button', { class: 'icon-btn', title: 'Vorherige Person', 'aria-label': 'Vorherige Person', onclick: () => pick(idx - 1) }, '‹'),
          h(
            'select',
            {
              class: 'input input-sm',
              'aria-label': 'Person',
              'data-focus-key': 'rate-person',
              onchange: (e) => {
                selected[a.id] = e.target.value;
                NM.app.rerender();
              },
            },
            students.map((x) => h('option', { value: x.id, selected: x === s }, M.studentName(x) + (G.presResult(p, x.id, level).score !== null ? ' ✓' : '')))
          ),
          h('button', { class: 'icon-btn', title: 'Nächste Person', 'aria-label': 'Nächste Person', onclick: () => pick(idx + 1) }, '›')
        )
      ),
      h(
        'div',
        { class: 'form-row' },
        h('label', { class: 'field grow' }, h('span', null, 'Thema'), h('input', { class: 'input', value: r.topic || '', 'data-focus-key': `rate-topic-${s.id}`, onchange: setField('topic') })),
        h('label', { class: 'field' }, h('span', null, 'Datum'), h('input', { class: 'input', type: 'date', value: r.date || '', onchange: setField('date') })),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Status'),
          UI.statusSelect(r.status, (v) => {
            r.status = v;
            NM.app.commit();
          }, `rate-status-${s.id}`)
        )
      ),
      p.criteria.length ? h('div', { class: 'rate-list' }, rows) : h('p', { class: 'muted' }, 'Bitte oben Kriterien hinzufügen.'),
      h('label', { class: 'field' }, h('span', null, 'Bemerkung (erscheint auf dem Bewertungsbogen)'), h('textarea', { class: 'input', rows: 2, 'data-focus-key': `rate-note-${s.id}`, onchange: setField('note') }, r.note || '')),
      h(
        'div',
        { class: 'rate-result' },
        h('span', null, 'Summe ', h('strong', null, res.score === null ? '–' : fmtScore(res.score)), ` / ${fmtScore(res.max)}`),
        h('span', null, res.score === null || !res.max ? '' : fmtNum((res.score / res.max) * 100, 0) + ' %'),
        res.p === null ? h('span', { class: 'muted' }, r.status ? UI.STATUS_SHORT[r.status] : 'noch keine Note') : UI.gradeBadge(res.p, level)
      )
    );
  }

  // ---------- Übersicht aller Personen ----------

  function tableCard(course, a, level) {
    const p = a.pres;
    const all = M.activeStudents(course);
    const results = new Map(all.map((s) => [s.id, G.presResult(p, s.id, level)]));
    const raw = (s, c) => ((p.results[s.id] || {}).scores || {})[c.id];
    const sort = UI.sorter('pres', {
      topic: { get: (s) => (p.results[s.id] || {}).topic || null, first: 'asc' },
      ...Object.fromEntries(p.criteria.map((c) => ['crit:' + c.id, { get: (s) => raw(s, c), first: 'desc' }])),
      sum: { get: (s) => results.get(s.id).score, first: 'desc' },
      grade: { get: (s) => results.get(s.id).p, first: 'desc' },
      status: { get: (s) => UI.STATUS_SHORT[(p.results[s.id] || {}).status] || null, first: 'asc' },
    });
    const students = sort.rows(all);
    const head = h(
      'tr',
      null,
      sort.nameHeads(),
      h('th', null, sort.head('topic', 'Thema')),
      p.criteria.map((c) => h('th', { class: 'center task-col', title: c.name }, sort.head('crit:' + c.id, h('span', { class: 'col-head' }, h('span', { class: 'col-name crit-short' }, c.name), h('span', { class: 'col-sub' }, '0–3' + (G.critWeight(c) !== 1 ? ' ×' + G.critWeight(c) : '')))))),
      h('th', { class: 'num' }, sort.head('sum', 'Σ')),
      h('th', { class: 'num' }, '%'),
      h('th', { class: 'center' }, sort.head('grade', 'Note')),
      h('th', { class: 'col-tight' }, sort.head('status', 'Status')),
      h('th', null, '')
    );
    const rows = students.map((s, ri) => {
      const r = (p.results[s.id] = p.results[s.id] || { scores: {} });
      r.scores = r.scores || {};
      const res = results.get(s.id);
      return h(
        'tr',
        { class: (r.status ? 'row-muted' : '') + (selected[a.id] === s.id ? ' row-current' : '') },
        UI.nameCells(s),
        h('td', { class: 'muted small topic-col', title: r.topic || '' }, r.topic || ''),
        p.criteria.map((c, ci) =>
          h(
            'td',
            { class: 'center task-col' },
            UI.numberInput({
              value: r.scores[c.id],
              grid: 'pres-' + a.id,
              row: ri,
              col: ci,
              key: `ps-${s.id}-${c.id}`,
              max: 3,
              onSet: (v) => {
                if (v !== null && (v !== Math.round(v) || v > 3)) {
                  toast('Je Kriterium 0, 1, 2 oder 3 Punkte.', 'error');
                  return NM.app.rerender();
                }
                if (v === null) delete r.scores[c.id];
                else r.scores[c.id] = v;
                NM.app.commit();
              },
            })
          )
        ),
        h('td', { class: 'num strong' }, res.score === null ? '' : fmtScore(res.score)),
        h('td', { class: 'num muted' }, res.score === null || !res.max ? '' : fmtNum((res.score / res.max) * 100, 0)),
        h('td', { class: 'center' }, res.p === null ? (r.status ? h('span', { class: 'muted small' }, UI.STATUS_SHORT[r.status]) : '') : UI.gradeBadge(res.p, level)),
        h(
          'td',
          null,
          UI.statusSelect(r.status, (v) => {
            r.status = v;
            NM.app.commit();
          }, `ps-status-${s.id}`)
        ),
        h(
          'td',
          null,
          h(
            'button',
            {
              class: 'icon-btn',
              title: 'Oben bewerten (Thema, Knöpfe 0–3, Bemerkung)',
              'aria-label': 'Bewerten: ' + M.studentName(s),
              onclick: () => {
                selected[a.id] = s.id;
                NM.app.rerender();
                const card = document.querySelector('.rate-card');
                if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
              },
            },
            '✎'
          )
        )
      );
    });
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Übersicht'), h('span', { class: 'muted small' }, 'Punkte 0–3 direkt eintragen; Enter/↓ nächste Person, Tab nächstes Kriterium')),
      students.length === 0 ? h('p', { class: 'muted' }, 'Bitte zuerst im Reiter „Kurs & Schüler“ Namen eintragen.') : h('div', { class: 'table-wrap', 'data-scroll-key': 'pres-results' }, h('table', { class: 'table grid-table' }, h('thead', null, head), h('tbody', null, rows)))
    );
  }

  function keyCard(course, a, level) {
    const p = a.pres;
    const st = G.presStats(p, M.statStudents(course).map((s) => s.id), level);
    return NM.views.tests.keyCardFor(course, level, { focusId: a.id, key: G.keyForPres(p, level), counts: st.counts, holder: p, st, results: p.results });
  }

  // ---------- Vorlagen (für alle Kurse) ----------

  function templatesCard(course, db) {
    const ui = NM.app.state.ui;
    const list = db.presTemplates || [];
    return h(
      'details',
      {
        class: 'card pool-card tpl-card',
        open: !!ui.tplOpen,
        ontoggle: (e) => {
          ui.tplOpen = e.target.open;
          NM.app.saveUi();
        },
      },
      h('summary', null, h('h2', null, 'Vorlagen'), h('span', { class: 'muted small' }, ` ${list.length} ${list.length === 1 ? 'Vorlage' : 'Vorlagen'} · gelten für alle Kurse`)),
      h('p', { class: 'muted small' }, 'Eine Vorlage ist ein benannter Satz von Kriterien mit Reihenfolge und Gewichten, z. B. „Referat“ oder „Plakatpräsentation“. Sie steht beim Anlegen einer Bewertung unter „Kriterien übernehmen von“ zur Auswahl. Speichern auch über „💾 Als Vorlage speichern“ in der Karte „Kriterien“.'),
      list.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h(
              'table',
              { class: 'table compact tpl-table' },
              h('tbody', null, list.map((t) =>
                h(
                  'tr',
                  null,
                  h('td', null, h('strong', null, t.name)),
                  h('td', { class: 'muted small', title: t.criteria.map((c) => c.name + (G.critWeight(c) !== 1 ? ' ×' + G.critWeight(c) : '')).join('\n') }, `${t.criteria.length} Kriterien: ` + t.criteria.map((c) => c.name).join(', ')),
                  h(
                    'td',
                    null,
                    h(
                      'div',
                      { class: 'inline' },
                      h('button', { class: 'btn btn-sm', title: 'Bewertungskriterien dieser Vorlage als Handreichung für die Klasse drucken', 'data-tpl-print': t.id, onclick: () => NM.print.presGuide({ title: t.name, course, criteria: t.criteria, level: G.courseLevel(course) }) }, '🖨 Handreichung'),
                      h(
                        'button',
                        {
                          class: 'icon-btn',
                          title: 'Umbenennen',
                          'aria-label': 'Umbenennen: ' + t.name,
                          onclick: async () => {
                            const n = await NM.util.promptDialog('Vorlage umbenennen', 'Name der Vorlage', t.name);
                            if (n === null || !n.trim()) return;
                            t.name = n.trim();
                            NM.app.commit();
                          },
                        },
                        '✎'
                      ),
                      h(
                        'button',
                        {
                          class: 'icon-btn',
                          title: 'Vorlage löschen',
                          'aria-label': 'Vorlage löschen: ' + t.name,
                          onclick: async () => {
                            if (!(await confirmDialog('Vorlage löschen?', `„${t.name}“ löschen? Bewertungen, die damit angelegt wurden, bleiben unverändert.`, { okLabel: 'Löschen', danger: true }))) return;
                            db.presTemplates = db.presTemplates.filter((x) => x !== t);
                            NM.app.commit();
                          },
                        },
                        '✕'
                      )
                    )
                  )
                )
              ))
            )
          )
        : h('p', { class: 'muted' }, 'Noch keine Vorlagen.'),
      h('button', { class: 'btn btn-ghost', onclick: () => newTemplate(db) }, '+ Vorlage aus dem Pool')
    );
  }

  async function newTemplate(db) {
    const name = h('input', { class: 'input', placeholder: 'z. B. Referat, Plakatpräsentation' });
    const pick = poolChecklist(db);
    const v = await modal({
      title: 'Neue Vorlage',
      wide: true,
      body: h('div', null, h('label', { class: 'field' }, h('span', null, 'Name der Vorlage'), name), h('p', { class: 'small' }, 'Kriterien wählen (Gewichte und Reihenfolge lassen sich in einer Bewertung anpassen und mit „💾 Als Vorlage speichern“ übernehmen).'), pick.el),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Anlegen', value: 'ok', kind: 'primary', validate: () => (!name.value.trim() ? (toast('Bitte einen Namen eingeben.', 'error'), false) : !pick.selected().length ? (toast('Bitte mindestens ein Kriterium wählen.', 'error'), false) : true) },
      ],
    });
    if (v !== 'ok') return;
    db.presTemplates.push(M.newPresTemplate(name.value.trim(), pick.selected()));
    NM.app.commit();
  }

  // ---------- Kriterienpool (für alle Kurse) ----------

  function poolCard(db) {
    const ui = NM.app.state.ui;
    const groups = [...new Set(db.criteriaPool.map((c) => c.group || 'Sonstiges'))];
    const missing = M.missingDefaultCriteria(db.criteriaPool);
    return h(
      'details',
      {
        class: 'card pool-card',
        open: !!ui.poolOpen,
        ontoggle: (e) => {
          ui.poolOpen = e.target.open;
          NM.app.saveUi();
        },
      },
      h('summary', null, h('h2', null, 'Kriterienpool'), h('span', { class: 'muted small' }, ` ${db.criteriaPool.length} Kriterien · gilt für alle Kurse`)),
      h('p', { class: 'muted small' }, 'Änderungen am Pool wirken nur auf neue Bewertungen; bestehende Bewertungen behalten ihre Kriterien.'),
      groups.map((g) =>
        h(
          'div',
          { class: 'pool-group' },
          h('h3', null, g),
          db.criteriaPool
            .filter((c) => (c.group || 'Sonstiges') === g)
            .map((c) =>
              h(
                'div',
                { class: 'pool-item' },
                h('span', { title: LEVELS.map((n) => `${n}: ${(c.desc || {})[n] || ''}`).join('\n') }, c.name),
                h(
                  'button',
                  {
                    class: 'icon-btn',
                    title: 'Bearbeiten',
                    'aria-label': 'Bearbeiten: ' + c.name,
                    onclick: async () => {
                      const r = await criterionDialog('Kriterium im Pool bearbeiten', c, null);
                      if (!r) return;
                      Object.assign(c, { group: r.group, name: r.name, desc: r.desc });
                      NM.app.commit();
                    },
                  },
                  '✎'
                ),
                h(
                  'button',
                  {
                    class: 'icon-btn',
                    title: 'Aus dem Pool löschen',
                    'aria-label': 'Aus dem Pool löschen: ' + c.name,
                    onclick: async () => {
                      if (!(await confirmDialog('Kriterium löschen?', `„${c.name}“ aus dem Pool löschen? Bestehende Bewertungen behalten das Kriterium.`, { okLabel: 'Löschen', danger: true }))) return;
                      db.criteriaPool = db.criteriaPool.filter((x) => x !== c);
                      NM.app.commit();
                    },
                  },
                  '✕'
                )
              )
            )
        )
      ),
      h(
        'button',
        {
          class: 'btn btn-ghost',
          onclick: async () => {
            const r = await criterionDialog('Neues Kriterium im Pool', {}, null);
            if (!r) return;
            db.criteriaPool.push({ id: NM.util.uid(), group: r.group, name: r.name, desc: r.desc });
            NM.app.commit();
          },
        },
        '+ Kriterium'
      ),
      missing.length
        ? h(
            'button',
            {
              class: 'btn btn-ghost',
              title: 'Fehlende Kriterien aus dem Startbestand von OrdoNota hinzufügen: ' + missing.map((c) => c.name).join(', '),
              onclick: () => {
                db.criteriaPool.push(...M.missingDefaultCriteria(db.criteriaPool));
                NM.app.commit();
                toast(`${missing.length} ${missing.length === 1 ? 'Kriterium' : 'Kriterien'} aus dem Startbestand ergänzt.`, 'info');
              },
            },
            `Startbestand ergänzen (${missing.length})`
          )
        : null
    );
  }

  NM.views = NM.views || {};
  NM.views.pres = { render };
})((globalThis.NM = globalThis.NM || {}));
