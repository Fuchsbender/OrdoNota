/* OrdoNota – Seite „Personen“ (Personenregister, seit 2.4.0): Liste, Person, Zusammenführen, Trennen,
 * Nachteilsausgleich (2.5, Gesundheitsdaten – nur hier und als Kürzel in Eingabe und Übersicht).
 * Eigene Seite ohne Kursreiter (state.ui.tab = 'people'). Das Register erscheint nie auf dem Beamer und nie im Ausdruck.
 * Die Logik steht rein in js/people.js; hier nur Oberfläche.
 */
(function (NM) {
  'use strict';
  const { h, icon, toast, confirmDialog, modal, fmtDate } = NM.util;
  const M = NM.model;
  const P = NM.people;

  // Nur für diese Sitzung: Suche, Filter, und ob auf schmalen Bildschirmen die Person (statt der Liste) gezeigt wird
  const view = { q: '', filter: 'all', detail: false };

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
      ausgleichSection(db, p),
      h(
        'div',
        { class: 'inline people-actions' },
        h('button', { class: 'btn', 'data-person-merge': '', onclick: () => mergeDialog(db, p) }, 'Mit anderer Person zusammenführen …'),
        es.length > 1 ? h('button', { class: 'btn', 'data-person-split': '', onclick: () => splitDialog(db, p) }, 'Trennen …') : null,
        !es.length ? h('button', { class: 'btn btn-danger', 'data-person-remove': '', onclick: () => removePerson(db, p) }, icon('trash'), ' Aus dem Register löschen') : null
      )
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
  NM.views.people = { render, courseLabel, courseLine };
})((globalThis.NM = globalThis.NM || {}));
