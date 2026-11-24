/* OrdoNota – Seite „Personen“ (Personenregister, seit 2.4.0): Liste, Person, Zusammenführen, Trennen,
 * Nachteilsausgleich (2.5, Gesundheitsdaten – nur hier und als Kürzel in Eingabe und Übersicht),
 * Notizverlauf (2.6, intern – nie gedruckt, nie auf dem Beamer; Dialoge auch für Sitzplan und Notenübersicht),
 * Förderplan (2.7, Gesundheitsdaten – Fassungen, Fortschreiben, Vergleich; nie gedruckt, nie auf dem Beamer).
 * Eigene Seite ohne Kursreiter (state.ui.tab = 'people'). Das Register erscheint nie auf dem Beamer und nie im Ausdruck.
 * Die Logik steht rein in js/people.js; hier nur Oberfläche.
 */
(function (NM) {
  'use strict';
  const { h, icon, toast, confirmDialog, modal, fmtDate } = NM.util;
  const M = NM.model;
  const P = NM.people;

  // Nur für diese Sitzung: Suche, Filter, und ob auf schmalen Bildschirmen die Person (statt der Liste) gezeigt wird
  const view = { q: '', filter: 'all', detail: false, notePid: null, noteFilter: 'all', editNote: null, draft: {}, fpOpen: new Set() };

  const yearOf = (db, c) => (db.years || []).find((y) => y.id === c.yearId);
  const shortYear = (name) => String(name || '').replace(/^20(\d\d)\/(\d\d)$/, '$1/$2');

  /** „8b M“, aus einem anderen Schuljahr mit Jahr: „7b M 25/26“. */
  function courseLabel(db, c) {
    const cur = NM.app.currentYear();
    const y = yearOf(db, c);
    return M.courseTitle(c) + (y && (!cur || cur.id !== y.id) ? ' ' + shortYear(y.name) : '');
  }

  /** Kurseinträge einer Person, neuestes Schuljahr zuerst. */
  function sortedEntries(db, pid) {
    const order = (db.years || []).map((y) => y.id);
    return P.entries(db, pid)
      .slice()
      .sort((a, b) => order.indexOf(b.course.yearId) - order.indexOf(a.course.yearId) || M.courseTitle(a.course).localeCompare(M.courseTitle(b.course), 'de'));
  }

  function personName(p) {
    return M.studentName(p) || 'Ohne Namen';
  }

  /** Kurzzeile unter dem Namen: Kurse oder „seit … in keinem Kurs“. */
  function courseLine(db, p) {
    const es = sortedEntries(db, p.id);
    if (!es.length) return p.orphanSince ? 'seit ' + fmtDate(p.orphanSince) + ' in keinem Kurs' : 'in keinem Kurs';
    return es.map((e) => courseLabel(db, e.course)).join(' · ');
  }

  function render(root, { db }) {
    const people = P.list(db);
    const all = M.sortStudents(people.slice());
    const orphans = all.filter((p) => !P.entries(db, p.id).length);
    const q = P.nameKey(view.q, '').replace(/\|$/, '');
    const shown = (view.filter === 'orphans' ? orphans : all).filter((p) => !q || (p.last + ' ' + p.first).toLowerCase().includes(q) || (p.first + ' ' + p.last).toLowerCase().includes(q));
    let sel = P.byId(db, NM.app.state.ui.personId);
    if (!sel && view.detail) view.detail = false;
    const pairs = P.suggestPairs(db);

    const head = h(
      'div',
      { class: 'view-head people-head' },
      h('h1', { class: 'people-title' }, 'Personen ', h('span', { class: 'muted' }, `(${people.length})`)),
      h('div', { class: 'spacer' }),
      h(
        'button',
        { class: 'btn', 'data-merge-suggest': '', disabled: !pairs.length, title: pairs.length ? 'Vorschläge: gleicher Name oder gleiche Mail-Adresse' : 'Keine Vorschläge zum Zusammenführen', onclick: () => suggestDialog(db) },
        'Zusammenführen …',
        pairs.length ? h('span', { class: 'pill' }, pairs.length) : null
      )
    );

    const search = h('input', {
      class: 'input',
      type: 'search',
      placeholder: 'Name suchen',
      'aria-label': 'Person suchen (Vor- oder Nachname)',
      'data-focus-key': 'people-search',
      'data-people-search': '',
      value: view.q,
      oninput: (e) => {
        view.q = e.target.value;
        NM.app.rerender();
      },
    });
    const filterBtn = (id, label, n) =>
      h('button', { type: 'button', class: 'seg' + (view.filter === id ? ' active' : ''), 'aria-pressed': String(view.filter === id), 'data-people-filter': id, onclick: () => ((view.filter = id), NM.app.rerender()) }, label, h('span', { class: 'seg-count' }, n));

    const items = shown.map((p) =>
      h(
        'li',
        null,
        h(
          'button',
          {
            type: 'button',
            class: 'people-item' + (sel && sel.id === p.id ? ' active' : '') + (P.entries(db, p.id).length ? '' : ' orphan'),
            'aria-current': sel && sel.id === p.id ? 'true' : null,
            'data-person': p.id,
            'data-focus-key': 'person-' + p.id,
            onclick: () => choose(p.id),
          },
          h('span', { class: 'people-name' }, personName(p)),
          h('span', { class: 'people-meta' }, courseLine(db, p))
        )
      )
    );
    const list = h(
      'div',
      { class: 'card people-list' },
      search,
      h('div', { class: 'segmented people-filter', role: 'group', 'aria-label': 'Filter' }, filterBtn('all', 'Alle', all.length), filterBtn('orphans', 'Ohne Kurs', orphans.length)),
      h('p', { class: 'muted small people-count', 'aria-live': 'polite' }, shown.length === all.length ? `${all.length} Personen` : `${shown.length} von ${all.length} Personen`),
      shown.length
        ? h('ul', { class: 'people-items', 'data-scroll-key': 'people-items', onkeydown: listKey }, items)
        : h('p', { class: 'muted' }, people.length ? 'Keine Person passt zur Suche.' : 'Noch keine Personen. Sie entstehen, sobald Namen in einem Kurs stehen.')
    );

    const detail = h('div', { class: 'people-detail' }, sel ? detailCard(db, sel) : h('div', { class: 'card people-empty' }, h('p', { class: 'muted' }, 'Links eine Person wählen.')));
    root.append(head, h('div', { class: 'people-layout' + (view.detail && sel ? ' show-detail' : '') }, list, detail));
  }

  function choose(pid) {
    NM.app.state.ui.personId = pid;
    NM.app.saveUi();
    view.detail = true;
    NM.app.rerender();
    // Schmal: die Person ersetzt die Liste, Fokus auf ihre Überschrift
    setTimeout(() => {
      const t = document.querySelector('.people-layout.show-detail .people-detail h2');
      if (t && getComputedStyle(document.querySelector('.people-list')).display === 'none') t.focus();
    }, 0);
  }

  /** Pfeil hoch/runter, Pos1, Ende in der Liste; Enter wählt (Knopf). */
  function listKey(e) {
    const step = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }[e.key];
    if (!step) return;
    const list = [...e.currentTarget.querySelectorAll('.people-item')];
    const at = list.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const to = step === 'first' ? 0 : step === 'last' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, at + step));
    list[to].focus();
  }

  function detailCard(db, p) {
    const es = sortedEntries(db, p.id);
    const nameInput = (k, label) =>
      h(
        'label',
        { class: 'field' },
        h('span', null, label),
        h('input', {
          class: 'input',
          value: p[k] || '',
          'data-focus-key': 'person-name-' + k,
          'data-person-name': k,
          onchange: (e) => {
            p[k] = e.target.value.trim();
            // Nur in einem Kurs: Register und Kurs tragen denselben Namen (sonst überschreibt ensure den Registernamen)
            if (es.length === 1) es[0].student[k] = p[k];
            NM.app.commit();
          },
        })
      );
    const nameHint = es.length === 1 ? 'Steht nur in einem Kurs: Der Name ändert sich dort mit.' : es.length ? 'Die Kurse behalten ihren Namen.' : '';
    const rows = es.map((e) => {
      const y = yearOf(db, e.course);
      const differs = P.nameKey(e.student.last, e.student.first) !== P.nameKey(p.last, p.first);
      return h(
        'tr',
        null,
        h('td', null, y ? y.name : ''),
        h('td', null, M.courseTitle(e.course)),
        h('td', null, differs ? M.studentName(e.student) : h('span', { class: 'muted' }, 'wie oben'), e.student.active === false ? h('span', { class: 'muted' }, ' · nicht aktiv') : null),
        h('td', { class: 'right' }, h('button', { class: 'btn btn-sm', 'data-goto-course': e.course.id, onclick: () => NM.app.select({ yearId: e.course.yearId, courseId: e.course.id, tab: 'course' }) }, 'Zum Kurs'))
      );
    });
    return h(
      'div',
      { class: 'card people-card' },
      h('button', { type: 'button', class: 'btn btn-sm people-back', onclick: back }, icon('chevron-left'), 'Alle Personen'),
      h('h2', { tabindex: '-1' }, personName(p)),
      p.orphanSince || !es.length ? h('p', { class: 'people-orphan' }, icon('info-circle'), ' ', courseLine(db, p)) : null,
      h('h3', null, 'Name im Register'),
      h('div', { class: 'form-grid people-names' }, nameInput('last', 'Nachname'), nameInput('first', 'Vorname')),
      nameHint ? h('p', { class: 'muted small' }, nameHint) : null,
      h('h3', null, 'Kurse'),
      es.length
        ? h(
            'div',
            { class: 'table-wrap' },
            h('table', { class: 'table compact people-courses' }, h('thead', null, h('tr', null, h('th', null, 'Schuljahr'), h('th', null, 'Kurs'), h('th', null, 'Name im Kurs'), h('th', null, ''))), h('tbody', null, rows))
          )
        : h('p', { class: 'muted' }, 'Steht in keinem Kurs.'),
      competencySection(db, p),
      ausgleichSection(db, p),
      notesSection(db, p),
      foerderSection(db, p),
      h(
        'div',
        { class: 'inline people-actions' },
        h('button', { class: 'btn', 'data-person-merge': '', onclick: () => mergeDialog(db, p) }, 'Mit anderer Person zusammenführen …'),
        es.length > 1 ? h('button', { class: 'btn', 'data-person-split': '', onclick: () => splitDialog(db, p) }, 'Trennen …') : null,
        !es.length ? h('button', { class: 'btn btn-danger', 'data-person-remove': '', onclick: () => removePerson(db, p) }, icon('trash'), ' Aus dem Register löschen') : null
      )
    );
  }

  // ---------- Kompetenzen (2.12, PLANUNG AI 11) ----------
  // Verlauf über alle Kurse und Schuljahre, je Katalog (Fach) eine Tabelle; nichts gespeichert.

  function competencySection(db, p) {
    const groups = NM.competencies.personHistory(db, P.entries(db, p.id));
    if (!groups.length) return null;
    const VC = NM.views.competencies;
    return h(
      'section',
      { class: 'people-comp', 'data-people-comp': '' },
      h('h3', null, 'Kompetenzen'),
      groups.map((g) =>
        h(
          'div',
          { class: 'people-comp-cat', 'data-people-comp-cat': g.cat.id },
          h('h4', null, [g.cat.fach, g.cat.name].filter(Boolean).join(' · ')),
          VC.historyTable(
            g.cat,
            g.rows,
            g.years.map((y) => h('th', { scope: 'col', class: 'comp-hist-year', title: 'Stand im Schuljahr ' + y.name }, shortYear(y.name))),
            { courseLabel: (c) => courseLabel(db, c), yearOrder: g.years.map((y) => y.id), stand: (r) => g.years.map((y) => VC.standCell(r.perYear[y.id] || null, 'data-hist-year', { tests: false })) }
          )
        )
      ),
      h('p', { class: 'muted small' }, 'Aus allen Tests mit Kompetenzen in den Kursen der Person, je Schuljahr erreicht ÷ möglich.' + (groups.some((g) => g.years.length > 1) ? ' Die gestrichelte senkrechte Linie trennt die Schuljahre.' : ''))
    );
  }

  // ---------- Nachteilsausgleich (2.5) ----------

  function faecherText(a) {
    return a.faecher && a.faecher.length ? a.faecher.join(', ') : 'alle Fächer';
  }

  function ausgleichSection(db, p) {
    const list = P.ausgleicheOf(p);
    const items = list.map((a) => {
      const old = P.ausgleichAbgelaufen(a);
      return h(
        'li',
        { class: 'na-item' + (old ? ' na-old' : ''), 'data-ausgleich-id': a.id },
        h(
          'div',
          { class: 'na-text' },
          h(
            'span',
            { class: 'na-line' },
            h('span', { class: 'na-kurz' }, P.ausgleichKurz(a)),
            h('span', null, ' · ', faecherText(a)),
            a.bis ? h('span', { class: old ? 'na-expired' : '' }, ' · ', old ? 'abgelaufen am ' : 'bis ', fmtDate(a.bis)) : null
          ),
          a.massnahmen ? h('span', { class: 'na-massnahmen', title: a.massnahmen }, a.massnahmen) : null
        ),
        h('button', { type: 'button', class: 'btn btn-sm', 'data-ausgleich-edit': a.id, 'aria-label': 'Nachteilsausgleich ' + P.ausgleichName(a) + ' ändern', onclick: () => ausgleichDialog(db, p, a) }, icon('pencil'), ' Ändern')
      );
    });
    return [
      h('h3', null, 'Nachteilsausgleich'),
      list.length ? h('ul', { class: 'plain na-list' }, items) : h('p', { class: 'muted' }, 'Kein Nachteilsausgleich eingetragen.'),
      h('button', { type: 'button', class: 'btn btn-sm', 'data-ausgleich-add': '', onclick: () => ausgleichDialog(db, p, null) }, 'Ausgleich hinzufügen …'),
    ];
  }

  async function ausgleichDialog(db, p, a) {
    const cur = a || { art: 'lrs', faecher: [], massnahmen: '' };
    const art = h(
      'select',
      { class: 'input', 'data-na-art': '' },
      P.AUSGLEICH_ARTEN.map(([v, l]) => h('option', { value: v, selected: cur.art === v }, l))
    );
    const text = h('input', { class: 'input', maxlength: String(P.AUSGLEICH_KURZ_MAX), value: cur.text || '', 'data-na-text': '', placeholder: 'z. B. ADHS' });
    const textField = h('label', { class: 'field' }, h('span', null, 'Kürzel (höchstens ' + P.AUSGLEICH_KURZ_MAX + ' Zeichen)'), text);
    // Fächer: „alle Fächer“ oder Haken aus den Kursen der Person (dazu Fächer, die schon eingetragen sind)
    const known = P.faecherDerPerson(db, p.id);
    for (const f of cur.faecher || []) if (!known.some((k) => k.toLowerCase() === String(f).toLowerCase())) known.push(f);
    const chosen = new Set((cur.faecher || []).map((f) => String(f).toLowerCase()));
    const allBox = h('input', { type: 'checkbox', checked: !chosen.size, 'data-na-alle': '' });
    const subjectBoxes = known.map((f) => ({ f, cb: h('input', { type: 'checkbox', checked: chosen.has(f.toLowerCase()), 'data-na-fach': f }) }));
    const subjectList = h(
      'div',
      { class: 'na-faecher' },
      subjectBoxes.length ? subjectBoxes.map(({ f, cb }) => h('label', { class: 'check' }, cb, ' ', f)) : h('p', { class: 'muted small' }, 'Die Kurse der Person haben kein Fach eingetragen.')
    );
    const massnahmen = h('textarea', { class: 'input', rows: 3, 'data-na-massnahmen': '', placeholder: 'z. B. 25 % mehr Zeit, Rechtschreibung wird nicht bewertet' }, cur.massnahmen || '');
    const bis = h('input', { class: 'input', type: 'date', value: cur.bis || '', 'data-na-bis': '' });
    const sync = () => {
      textField.hidden = art.value !== 'sonst';
      subjectList.hidden = allBox.checked;
    };
    art.addEventListener('change', sync);
    allBox.addEventListener('change', sync);
    sync();
    const picked = () => subjectBoxes.filter(({ cb }) => cb.checked).map(({ f }) => f);
    const valid = () => {
      if (art.value === 'sonst' && !text.value.trim()) return toast('Bitte ein Kürzel eintragen.', 'error'), text.focus(), false;
      if (!allBox.checked && !picked().length) return toast('Bitte mindestens ein Fach wählen oder „alle Fächer“.', 'error'), false;
      return true;
    };
    const buttons = [{ label: 'Abbrechen', value: false }];
    if (a) buttons.push({ label: 'Löschen', value: 'delete', kind: 'danger' });
    buttons.push({ label: 'Speichern', value: true, kind: 'primary', validate: valid });
    const v = await modal({
      title: (a ? 'Nachteilsausgleich ändern' : 'Nachteilsausgleich hinzufügen') + ': ' + personName(p),
      body: h(
        'div',
        { class: 'na-form' },
        h('label', { class: 'field' }, h('span', null, 'Art'), art),
        textField,
        h('fieldset', { class: 'na-fieldset' }, h('legend', null, 'Fächer'), h('label', { class: 'check' }, allBox, ' alle Fächer'), subjectList),
        h('label', { class: 'field' }, h('span', null, 'Maßnahmen'), massnahmen),
        h('label', { class: 'field' }, h('span', null, 'Gültig bis (leer = ohne Ende)'), bis),
        h('p', { class: 'muted small' }, 'Das Kürzel erscheint in der Punkteeingabe, der Notenübersicht und der Kursliste, nie auf dem Beamer und nie im Ausdruck. Die App rechnet nichts um.')
      ),
      buttons,
    });
    if (v === 'delete') {
      if (!(await confirmDialog('Nachteilsausgleich löschen', P.ausgleichName(a) + ' bei ' + personName(p) + ' löschen? Die Haken „Ausgleich gewährt“ an den Arbeiten bleiben.', { okLabel: 'Löschen', danger: true }))) return;
      P.removeAusgleich(db, p.id, a.id);
      NM.app.commit();
      return toast('Nachteilsausgleich gelöscht.', 'success');
    }
    if (v !== true) return;
    P.setAusgleich(db, p.id, { id: a && a.id, art: art.value, text: text.value, faecher: allBox.checked ? [] : picked(), massnahmen: massnahmen.value, bis: bis.value });
    NM.app.commit();
    toast(a ? 'Nachteilsausgleich geändert.' : 'Nachteilsausgleich eingetragen.', 'success');
  }

  // ---------- Notizverlauf (2.6) ----------

  /** Kurs einer Notiz kurz („8b M“), „ohne Kurs“ oder „gelöschter Kurs“. */
  function noteCourse(db, n) {
    if (!n.courseId) return 'ohne Kurs';
    const c = (db.courses || []).find((x) => x.id === n.courseId);
    return c ? courseLabel(db, c) : 'gelöschter Kurs';
  }

  /** Kurse für die Auswahl: Kurse der Person (ohne doppelte), dazu der Kurs der Notiz, falls es ihn noch gibt. */
  function noteCourses(db, p, n) {
    const seen = new Set();
    const out = [];
    for (const e of sortedEntries(db, p.id)) if (!seen.has(e.course.id)) seen.add(e.course.id) && out.push(e.course);
    const c = n && n.courseId && (db.courses || []).find((x) => x.id === n.courseId);
    if (c && !seen.has(c.id)) out.push(c);
    return out;
  }

  function courseSelect(db, courses, value, attrs) {
    return h(
      'select',
      Object.assign({ class: 'input' }, attrs),
      h('option', { value: '', selected: !value }, 'ohne Kurs'),
      courses.map((c) => h('option', { value: c.id, selected: value === c.id }, courseLabel(db, c)))
    );
  }

  function notesSection(db, p) {
    if (view.notePid !== p.id) Object.assign(view, { notePid: p.id, noteFilter: 'all', editNote: null });
    const courses = noteCourses(db, p, null);
    const cur = NM.app.state.ui.courseId;
    const draft = (view.draft[p.id] = view.draft[p.id] || { datum: NM.util.todayISO(), courseId: courses.some((c) => c.id === cur) ? cur : '', text: '' });
    const date = h('input', { class: 'input', type: 'date', value: draft.datum, 'aria-label': 'Datum der Notiz', 'data-note-new-datum': '', onchange: (e) => (draft.datum = e.target.value) });
    const course = courseSelect(db, courses, draft.courseId, { 'aria-label': 'Kurs der Notiz', 'data-note-new-kurs': '', onchange: (e) => (draft.courseId = e.target.value) });
    const text = h('textarea', { class: 'input', rows: 3, 'aria-label': 'Neue Notiz (Strg+Enter speichert)', placeholder: 'Neue Notiz …', 'data-focus-key': 'note-new-' + p.id, 'data-note-new-text': '', oninput: (e) => (draft.text = e.target.value), onkeydown: (e) => ctrlEnter(e, save) }, draft.text);
    const save = () => {
      if (!text.value.trim()) return toast('Bitte einen Text eintragen.', 'error'), text.focus();
      P.setNotiz(db, p.id, { datum: date.value, courseId: course.value, text: text.value });
      view.draft[p.id] = { datum: NM.util.todayISO(), courseId: course.value, text: '' };
      NM.app.commit();
      toast('Notiz gespeichert.', 'success');
      focusLater('note-new-' + p.id);
    };
    const composer = h(
      'div',
      { class: 'note-new' },
      h('div', { class: 'note-meta-fields' }, date, course),
      text,
      h('div', { class: 'note-new-actions' }, h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-note-save': '', onclick: save }, 'Notiz speichern'))
    );
    const filterOpts = [['all', 'Alle Kurse'], ...courses.map((c) => [c.id, courseLabel(db, c)]), ['none', 'ohne Kurs']];
    const shown = P.notizen(p, view.noteFilter);
    const total = P.notizenOf(p).length;
    const filter = total
      ? h(
          'select',
          { class: 'input input-sm note-filter', 'aria-label': 'Notizen nach Kurs filtern', 'data-note-filter': '', onchange: (e) => ((view.noteFilter = e.target.value), NM.app.rerender()) },
          filterOpts.map(([v, l]) => h('option', { value: v, selected: view.noteFilter === v }, l))
        )
      : null;
    return [
      h('div', { class: 'note-head' }, h('h3', null, 'Notizen ', total ? h('span', { class: 'muted' }, `(${total})`) : null), filter),
      composer,
      shown.length
        ? h('ul', { class: 'plain note-list' }, shown.map((n) => (view.editNote === n.id ? noteEditItem(db, p, n) : noteItem(db, p, n))))
        : h('p', { class: 'muted' }, total ? 'Keine Notizen für diese Auswahl.' : 'Noch keine Notizen.'),
    ];
  }

  function noteItem(db, p, n) {
    return h(
      'li',
      { class: 'note-item', 'data-note-id': n.id },
      h(
        'div',
        { class: 'note-body' },
        h('span', { class: 'note-meta' }, fmtDate(n.datum), ' · ', noteCourse(db, n)),
        h('p', { class: 'note-text' }, n.text)
      ),
      h('button', { type: 'button', class: 'btn btn-sm', 'data-note-edit': n.id, 'data-focus-key': 'note-edit-btn-' + n.id, 'aria-label': 'Notiz vom ' + fmtDate(n.datum) + ' ändern', onclick: () => ((view.editNote = n.id), NM.app.rerender(), focusLater('note-edit-' + n.id)) }, icon('pencil'), ' Ändern')
    );
  }

  function noteEditItem(db, p, n) {
    const date = h('input', { class: 'input', type: 'date', value: n.datum, 'aria-label': 'Datum der Notiz', 'data-note-edit-datum': '' });
    const course = courseSelect(db, noteCourses(db, p, n), n.courseId || '', { 'aria-label': 'Kurs der Notiz', 'data-note-edit-kurs': '' });
    // Kurs gelöscht: Auswahl behält ihn als „gelöschter Kurs“, damit Speichern nichts verliert
    if (n.courseId && !(db.courses || []).some((c) => c.id === n.courseId)) course.prepend(h('option', { value: n.courseId, selected: true }, 'gelöschter Kurs'));
    const close = () => ((view.editNote = null), NM.app.rerender(), focusLater('note-edit-btn-' + n.id));
    const save = () => {
      if (!text.value.trim()) return toast('Bitte einen Text eintragen oder die Notiz löschen.', 'error'), text.focus();
      P.setNotiz(db, p.id, { id: n.id, datum: date.value, courseId: course.value, text: text.value });
      view.editNote = null;
      NM.app.commit();
      focusLater('note-edit-btn-' + n.id);
    };
    const text = h('textarea', {
      class: 'input',
      rows: 4,
      'aria-label': 'Text der Notiz (Strg+Enter speichert, Esc bricht ab)',
      'data-focus-key': 'note-edit-' + n.id,
      'data-note-edit-text': '',
      onkeydown: (e) => {
        if (e.key === 'Escape') return e.preventDefault(), close();
        ctrlEnter(e, save);
      },
    }, n.text);
    return h(
      'li',
      { class: 'note-item note-editing', 'data-note-id': n.id },
      h(
        'div',
        { class: 'note-body' },
        h('div', { class: 'note-meta-fields' }, date, course),
        text,
        h(
          'div',
          { class: 'inline note-edit-actions' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-primary btn-sm',
              'data-note-edit-save': '',
              onclick: save,
            },
            'Speichern'
          ),
          h('button', { type: 'button', class: 'btn btn-sm', onclick: close }, 'Abbrechen'),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-sm btn-danger note-delete',
              'data-note-delete': '',
              onclick: async () => {
                if (!(await confirmDialog('Notiz löschen', 'Notiz vom ' + fmtDate(n.datum) + ' löschen?', { okLabel: 'Löschen', danger: true }))) return;
                P.removeNotiz(db, p.id, n.id);
                view.editNote = null;
                NM.app.commit();
                toast('Notiz gelöscht.', 'success');
              },
            },
            icon('trash'),
            ' Löschen'
          )
        )
      )
    );
  }

  /** Strg+Enter (Mac: Cmd+Enter) im Textfeld speichert. */
  function ctrlEnter(e, fn) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      fn();
    }
  }

  /** In einem Dialog: Strg+Enter löst den Hauptknopf aus (mit seiner Prüfung). */
  function ctrlEnterSubmit(e) {
    ctrlEnter(e, () => e.target.closest('form').requestSubmit());
  }

  function focusLater(key) {
    setTimeout(() => {
      const el = document.querySelector(`[data-focus-key="${key}"]`);
      if (el) el.focus();
    }, 0);
  }

  // ---------- Förderplan (2.7) ----------

  function zeitraum(f) {
    if (f.von && f.bis) return fmtDate(f.von) + ' – ' + fmtDate(f.bis);
    if (f.von) return 'ab ' + fmtDate(f.von);
    if (f.bis) return 'bis ' + fmtDate(f.bis);
    return '';
  }

  /** Ziele und Maßnahmen einer Fassung (Überschrift + Text, leer = „–“). */
  function fpTexts(f) {
    const block = (label, text) => [h('h4', { class: 'fp-label' }, label), h('p', { class: 'fp-text' + (text ? '' : ' muted') }, text || '–')];
    return [block('Ziele', f.ziele), block('Maßnahmen', f.massnahmen)];
  }

  function fpMeta(f, current) {
    const z = zeitraum(f);
    return h('p', { class: 'fp-meta' }, current ? 'Gilt seit ' : '', fmtDate(f.datum), ' · ', h('strong', null, P.schwerpunktText(f)), z ? ' · Zeitraum ' + z : '');
  }

  function foerderSection(db, p) {
    const list = P.foerderplaene(p);
    const cur = list[0];
    const head = h(
      'div',
      { class: 'note-head' },
      h('h3', null, 'Förderplan ', list.length > 1 ? h('span', { class: 'muted' }, `(${list.length} Fassungen)`) : null),
      list.length > 1 ? h('button', { type: 'button', class: 'btn btn-sm', 'data-fp-compare': '', onclick: () => fpCompare(db, p) }, 'Fassungen vergleichen …') : null
    );
    if (!cur)
      return [
        head,
        h('p', { class: 'muted' }, 'Kein Förderplan eingetragen.'),
        h('button', { type: 'button', class: 'btn btn-sm', 'data-fp-new': '', onclick: () => fpDialog(db, p, 'new') }, 'Förderplan anlegen …'),
      ];
    const older = list.slice(1);
    return [
      head,
      h(
        'div',
        { class: 'fp-current', 'data-fp-id': cur.id },
        fpMeta(cur, true),
        fpTexts(cur),
        h(
          'div',
          { class: 'inline fp-actions' },
          h('button', { type: 'button', class: 'btn btn-sm', 'data-fp-continue': '', title: 'Neue Fassung, vorausgefüllt mit der geltenden', onclick: () => fpDialog(db, p, 'continue', cur) }, 'Fortschreiben …'),
          h('button', { type: 'button', class: 'btn btn-sm', 'data-fp-edit': cur.id, onclick: () => fpDialog(db, p, 'edit', cur) }, icon('pencil'), ' Ändern')
        )
      ),
      older.length
        ? h(
            'details',
            { class: 'fp-older', open: view.fpOpen.has('older-' + p.id), ontoggle: (e) => toggleOpen('older-' + p.id, e.target.open) },
            h('summary', null, `Frühere Fassungen (${older.length})`),
            h(
              'ul',
              { class: 'plain fp-older-list' },
              older.map((f) =>
                h(
                  'li',
                  null,
                  h(
                    'details',
                    { class: 'fp-version', 'data-fp-id': f.id, open: view.fpOpen.has(f.id), ontoggle: (e) => toggleOpen(f.id, e.target.open) },
                    h('summary', null, fmtDate(f.datum), ' · ', P.schwerpunktText(f)),
                    h('div', { class: 'fp-version-body' }, fpMeta(f, false), fpTexts(f), h('button', { type: 'button', class: 'btn btn-sm', 'data-fp-edit': f.id, onclick: () => fpDialog(db, p, 'edit', f) }, icon('pencil'), ' Ändern'))
                  )
                )
              )
            )
          )
        : null,
    ];
  }

  function toggleOpen(key, open) {
    if (open) view.fpOpen.add(key);
    else view.fpOpen.delete(key);
  }

  /** Fassung anlegen ('new'), fortschreiben ('continue', vorausgefüllt, neue Fassung) oder ändern ('edit'). */
  async function fpDialog(db, p, mode, base = null) {
    const src = base || {};
    const boxes = P.SCHWERPUNKTE.map(([k, l]) => ({ k, cb: h('input', { type: 'checkbox', checked: (src.schwerpunkte || []).includes(k), 'data-fp-sp': k }), l }));
    const sonst = h('input', { class: 'input', value: src.sonst || '', 'data-fp-sonst': '', 'aria-label': 'Sonstiger Förderschwerpunkt', placeholder: 'Welcher?' });
    const sonstBox = boxes.find((b) => b.k === 'sonst').cb;
    const syncSonst = () => (sonst.hidden = !sonstBox.checked);
    sonstBox.addEventListener('change', syncSonst);
    syncSonst();
    const datum = h('input', { class: 'input', type: 'date', value: mode === 'edit' ? src.datum : NM.util.todayISO(), 'data-fp-datum': '' });
    const von = h('input', { class: 'input', type: 'date', value: mode === 'edit' ? src.von || '' : '', 'data-fp-von': '' });
    const bis = h('input', { class: 'input', type: 'date', value: mode === 'edit' ? src.bis || '' : '', 'data-fp-bis': '' });
    const area = (v, key, rows) => h('textarea', { class: 'input', rows, 'data-fp-text': key, onkeydown: ctrlEnterSubmit }, v || '');
    const ziele = area(src.ziele, 'ziele', 5);
    const massnahmen = area(src.massnahmen, 'massnahmen', 5);
    const data = () => ({ id: mode === 'edit' ? src.id : null, datum: datum.value, schwerpunkte: boxes.filter((b) => b.cb.checked).map((b) => b.k), sonst: sonst.value, von: von.value, bis: bis.value, ziele: ziele.value, massnahmen: massnahmen.value });
    // Prüfen wie beim Speichern, ohne zu speichern (Kopie der Person)
    const valid = () => {
      try {
        P.setFoerderplan({ people: [{ id: 'probe' }] }, 'probe', data());
        return true;
      } catch (err) {
        return toast(err.message, 'error'), false;
      }
    };
    const title = { new: 'Förderplan anlegen', continue: 'Förderplan fortschreiben', edit: 'Fassung ändern' }[mode] + ': ' + personName(p);
    const buttons = [{ label: 'Abbrechen', value: false }];
    if (mode === 'edit') buttons.push({ label: 'Fassung löschen', value: 'delete', kind: 'danger' });
    buttons.push({ label: mode === 'continue' ? 'Als neue Fassung speichern' : 'Speichern', value: true, kind: 'primary', validate: valid });
    const v = await modal({
      title,
      wide: true,
      body: h(
        'div',
        { class: 'fp-form' },
        mode === 'continue' ? h('p', { class: 'muted small' }, 'Vorausgefüllt mit der Fassung vom ' + fmtDate(src.datum) + '. Sie bleibt unverändert erhalten.') : null,
        h('label', { class: 'field fp-date' }, h('span', null, mode === 'edit' ? 'Datum der Fassung' : 'Datum der neuen Fassung'), datum),
        h('fieldset', { class: 'na-fieldset' }, h('legend', null, 'Förderschwerpunkte'), h('div', { class: 'fp-sp' }, boxes.map((b) => h('label', { class: 'check' }, b.cb, ' ', b.l))), sonst),
        h('div', { class: 'fp-range' }, h('label', { class: 'field' }, h('span', null, 'Zeitraum von (optional)'), von), h('label', { class: 'field' }, h('span', null, 'bis (optional)'), bis)),
        h('label', { class: 'field' }, h('span', null, 'Ziele'), ziele),
        h('label', { class: 'field' }, h('span', null, 'Maßnahmen'), massnahmen),
        h('p', { class: 'muted small' }, 'Der offizielle Plan liegt in der Schulakte. Hier nur die Arbeitsfassung, nie gedruckt, nie auf dem Beamer.')
      ),
      buttons,
    });
    if (v === 'delete') {
      if (!(await confirmDialog('Fassung löschen', 'Fassung vom ' + fmtDate(src.datum) + ' bei ' + personName(p) + ' löschen?', { okLabel: 'Löschen', danger: true }))) return;
      P.removeFoerderplan(db, p.id, src.id);
      NM.app.commit();
      return toast('Fassung gelöscht.', 'success');
    }
    if (v !== true) return;
    P.setFoerderplan(db, p.id, data());
    NM.app.commit();
    toast(mode === 'continue' ? 'Neue Fassung gespeichert.' : 'Förderplan gespeichert.', 'success');
  }

  /** Zwei Fassungen nebeneinander (nur Ansicht). Vorgewählt: links die vorherige, rechts die geltende. */
  async function fpCompare(db, p) {
    const list = P.foerderplaene(p);
    if (list.length < 2) return;
    const pick = [list[1].id, list[0].id];
    const grid = h('div', { class: 'fp-compare' });
    const select = (i) =>
      h(
        'select',
        { class: 'input', 'aria-label': i ? 'Fassung rechts' : 'Fassung links', 'data-fp-cmp': String(i), onchange: (e) => ((pick[i] = e.target.value), fill()) },
        list.map((f, k) => h('option', { value: f.id, selected: pick[i] === f.id }, fmtDate(f.datum) + (k === 0 ? ' (gilt)' : '')))
      );
    const col = (f) =>
      h(
        'div',
        { class: 'fp-col' },
        h('p', { class: 'fp-meta' }, h('strong', null, P.schwerpunktText(f))),
        h('p', { class: 'fp-meta' }, zeitraum(f) ? 'Zeitraum ' + zeitraum(f) : 'ohne Zeitraum'),
        fpTexts(f)
      );
    const heads = [select(0), select(1)];
    function fill() {
      const f = pick.map((id) => list.find((x) => x.id === id));
      grid.replaceChildren(h('div', { class: 'fp-col-head' }, heads[0]), h('div', { class: 'fp-col-head' }, heads[1]), col(f[0]), col(f[1]));
    }
    fill();
    await modal({ title: 'Förderplan vergleichen: ' + personName(p), wide: true, body: grid, buttons: [{ label: 'Schließen', value: true, kind: 'primary' }] });
  }

  /** Schnelleintrag (Sitzplan): Datum heute, Kurs fest. */
  async function quickNoteDialog(course, s) {
    const db = NM.app.db();
    const p = P.byId(db, s.personId);
    if (!p) return toast('Person nicht im Register.', 'error');
    const date = h('input', { class: 'input', type: 'date', value: NM.util.todayISO(), 'data-note-quick-datum': '' });
    const text = h('textarea', { class: 'input', rows: 4, 'data-note-quick-text': '', placeholder: 'Was ist passiert?', 'aria-description': 'Strg+Enter speichert', onkeydown: ctrlEnterSubmit });
    const v = await modal({
      title: 'Notiz: ' + M.studentName(s),
      body: h(
        'div',
        { class: 'note-quick' },
        h('p', { class: 'muted small' }, M.courseTitle(course), ' · nur für Sie, wird nie gedruckt'),
        h('label', { class: 'field' }, h('span', null, 'Datum'), date),
        h('label', { class: 'field' }, h('span', null, 'Notiz'), text)
      ),
      onOpen: () => text.focus(),
      buttons: [
        { label: 'Abbrechen', value: false },
        { label: 'Notiz speichern', value: true, kind: 'primary', validate: () => !!text.value.trim() || (toast('Bitte einen Text eintragen.', 'error'), text.focus(), false) },
      ],
    });
    if (v !== true) return;
    P.setNotiz(db, p.id, { datum: date.value, courseId: course.id, text: text.value });
    NM.app.commit();
    toast('Notiz gespeichert.', 'success');
  }

  /** Notizen eines Kurses (Notenübersicht): Verlauf, neue Notiz, Sprung zur Seite „Personen“. */
  async function courseNotesDialog(course, s) {
    const db = NM.app.db();
    const p = P.byId(db, s.personId);
    if (!p) return toast('Person nicht im Register.', 'error');
    const list = P.notizen(p, course.id);
    const date = h('input', { class: 'input', type: 'date', value: NM.util.todayISO(), 'aria-label': 'Datum der neuen Notiz', 'data-note-dlg-datum': '' });
    const text = h('textarea', { class: 'input', rows: 3, 'aria-label': 'Neue Notiz (Strg+Enter speichert)', placeholder: 'Neue Notiz …', 'data-note-dlg-text': '', onkeydown: ctrlEnterSubmit });
    let jump = false;
    const v = await modal({
      title: 'Notizen: ' + M.studentName(s),
      wide: true,
      body: h(
        'div',
        { class: 'note-dlg' },
        h('p', { class: 'muted small' }, M.courseTitle(course), ' · nur für Sie, wird nie gedruckt'),
        h('div', { class: 'note-new' }, h('div', { class: 'note-meta-fields' }, date), text),
        list.length
          ? h('ul', { class: 'plain note-list note-dlg-list' }, list.map((n) => h('li', { class: 'note-item' }, h('div', { class: 'note-body' }, h('span', { class: 'note-meta' }, fmtDate(n.datum)), h('p', { class: 'note-text' }, n.text)))))
          : h('p', { class: 'muted' }, 'Noch keine Notizen in diesem Kurs.'),
        h('button', { type: 'button', class: 'link note-all', 'data-note-all': '', onclick: (e) => ((jump = true), e.target.closest('dialog').querySelector('[data-note-close]').click()) }, 'Alle Notizen auf der Seite Personen ›')
      ),
      buttons: [
        { label: 'Schließen', value: false },
        { label: 'Notiz speichern', value: true, kind: 'primary', validate: () => !!text.value.trim() || (toast('Bitte einen Text eintragen.', 'error'), text.focus(), false) },
      ],
      onOpen: (dlg) => {
        dlg.querySelector('.modal-actions .btn').setAttribute('data-note-close', '');
        text.focus();
      },
    });
    if (v === true) {
      P.setNotiz(db, p.id, { datum: date.value, courseId: course.id, text: text.value });
      NM.app.commit();
      toast('Notiz gespeichert.', 'success');
    }
    if (jump) open(p.id);
  }

  /** Seite „Personen“ mit dieser Person öffnen (auch schmal: gleich die Person statt der Liste). */
  function open(pid) {
    Object.assign(view, { notePid: pid, noteFilter: 'all', editNote: null, detail: true });
    NM.app.state.ui.personId = pid;
    NM.app.saveUi();
    NM.app.select({ tab: 'people' });
  }

  function back() {
    view.detail = false;
    NM.app.rerender();
    setTimeout(() => {
      const b = document.querySelector('.people-item.active') || document.querySelector('[data-people-search]');
      if (b) b.focus();
    }, 0);
  }

  /** Eine Person im Dialog: Name und Kurse. */
  function who(db, p) {
    return h('span', { class: 'people-who' }, h('strong', null, personName(p)), ' ', h('span', { class: 'muted' }, '(' + courseLine(db, p) + ')'));
  }

  async function suggestDialog(db) {
    const pairs = P.suggestPairs(db);
    if (!pairs.length) return toast('Keine Vorschläge zum Zusammenführen.', 'info');
    const boxes = pairs.map(() => h('input', { type: 'checkbox', 'data-pair': '' }));
    const v = await modal({
      title: 'Personen zusammenführen',
      wide: true,
      body: h(
        'div',
        null,
        h('p', null, 'Diese Personen könnten dieselben sein. Haken Sie an, was zusammengehört. Die ältere Person bleibt, ihr Name gilt. Die Namen in den Kursen bleiben, wie sie sind.'),
        h(
          'ul',
          { class: 'plain merge-list' },
          pairs.map((x, i) =>
            h(
              'li',
              null,
              h('label', { class: 'check merge-pair' }, boxes[i], h('span', null, who(db, x.keep), ' = ', who(db, x.gone), ' ', h('span', { class: 'merge-reason' }, x.reason === 'mail' ? 'gleiche Mail-Adresse' : 'gleicher Name')))
            )
          )
        )
      ),
      buttons: [
        { label: 'Abbrechen', value: false },
        { label: 'Zusammenführen', value: true, kind: 'primary' },
      ],
    });
    if (v !== true) return;
    const chosen = pairs.filter((x, i) => boxes[i].checked).map((x) => ({ keepId: x.keep.id, goneId: x.gone.id }));
    if (!chosen.length) return toast('Nichts angehakt, nichts zusammengeführt.', 'info');
    const r = P.mergePairs(db, chosen);
    NM.app.commit();
    toast(`${r.done} ${r.done === 1 ? 'Paar' : 'Paare'} zusammengeführt` + (r.skipped ? `, ${r.skipped} übersprungen (inzwischen dieselbe Person oder im selben Kurs)` : '') + '.', 'success');
  }

  async function mergeDialog(db, p) {
    const others = M.sortStudents(P.list(db).filter((x) => x.id !== p.id));
    if (!others.length) return toast('Es gibt keine andere Person.', 'info');
    let picked = null;
    const listEl = h('ul', { class: 'plain merge-pick' });
    const fill = (q) => {
      listEl.replaceChildren();
      const key = String(q || '').trim().toLowerCase();
      const hits = others.filter((x) => !key || (x.last + ' ' + x.first).toLowerCase().includes(key) || (x.first + ' ' + x.last).toLowerCase().includes(key)).slice(0, 50);
      if (!hits.length) listEl.append(h('li', { class: 'muted' }, 'Keine Person gefunden.'));
      for (const x of hits) {
        const blocked = P.shareCourse(db, p.id, x.id);
        const radio = h('input', { type: 'radio', name: 'merge-target', value: x.id, disabled: blocked, checked: picked === x.id, onchange: () => (picked = x.id) });
        listEl.append(h('li', null, h('label', { class: 'check' + (blocked ? ' off' : '') }, radio, h('span', null, who(db, x), blocked ? h('span', { class: 'merge-reason' }, ' steht im selben Kurs') : null))));
      }
    };
    fill('');
    const v = await modal({
      title: 'Mit anderer Person zusammenführen',
      wide: true,
      body: h(
        'div',
        null,
        h('p', null, h('strong', null, personName(p)), ' bleibt, ihr Name gilt. Die gewählte Person geht in ihr auf, ihre Kurse gehören dann dazu. Personen im selben Kurs lassen sich nicht zusammenführen.'),
        h('input', { class: 'input', type: 'search', placeholder: 'Name suchen', 'aria-label': 'Person suchen', oninput: (e) => fill(e.target.value) }),
        listEl
      ),
      buttons: [
        { label: 'Abbrechen', value: false },
        { label: 'Zusammenführen', value: true, kind: 'primary', validate: () => !!picked || (toast('Bitte eine Person wählen.', 'error'), false) },
      ],
    });
    if (v !== true || !picked) return;
    try {
      P.merge(db, p.id, picked);
    } catch (err) {
      return toast(err.message, 'error');
    }
    NM.app.commit();
    toast('Zusammengeführt.', 'success');
  }

  async function splitDialog(db, p) {
    const es = sortedEntries(db, p.id);
    const boxes = es.map(() => h('input', { type: 'checkbox', 'data-split-entry': '' }));
    const v = await modal({
      title: 'Person trennen',
      body: h(
        'div',
        null,
        h('p', null, 'Die angehakten Kurseinträge werden zu einer neuen Person mit dem Namen des ersten Eintrags. Mindestens ein Eintrag bleibt bei ', h('strong', null, personName(p)), '.'),
        h(
          'ul',
          { class: 'plain' },
          es.map((e, i) => h('li', null, h('label', { class: 'check' }, boxes[i], h('span', null, courseLabel(db, e.course), ': ', M.studentName(e.student) || 'ohne Namen'))))
        )
      ),
      buttons: [
        { label: 'Abbrechen', value: false },
        {
          label: 'Trennen',
          value: true,
          kind: 'primary',
          validate: () => {
            const n = boxes.filter((b) => b.checked).length;
            if (!n) return toast('Bitte mindestens einen Kurseintrag anhaken.', 'error'), false;
            if (n === es.length) return toast('Mindestens ein Kurseintrag muss bei der Person bleiben.', 'error'), false;
            return true;
          },
        },
      ],
    });
    if (v !== true) return;
    const neu = P.split(db, p.id, es.filter((e, i) => boxes[i].checked).map((e) => e.student.id));
    NM.app.commit();
    toast(`Getrennt: ${personName(neu)} ist jetzt eine eigene Person.`, 'success');
  }

  async function removePerson(db, p) {
    if (!(await confirmDialog('Aus dem Register löschen?', `${personName(p)} steht in keinem Kurs und wird aus dem Personenregister gelöscht.`, { okLabel: 'Löschen', danger: true }))) return;
    P.remove(db, p.id);
    NM.app.state.ui.personId = null;
    view.detail = false;
    NM.app.saveUi();
    NM.app.commit();
    toast('Aus dem Register gelöscht.', 'success');
  }

  NM.views = NM.views || {};
  NM.views.people = { render, courseLabel, courseLine, quickNoteDialog, courseNotesDialog, open };
})((globalThis.NM = globalThis.NM || {}));
