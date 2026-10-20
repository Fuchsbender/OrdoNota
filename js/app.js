/* Notenmanager – Anwendungskern: Anmeldung, Speichern, Sperren, Layout, Navigation. */
(function (NM) {
  'use strict';
  const { h, clear, toast, modal, confirmDialog, fmtTime } = NM.util;
  const { Vault } = NM.crypto;
  const S = NM.storage;
  const M = NM.model;

  const DEMO = new URLSearchParams(location.search).has('demo');

  const state = {
    store: null,
    vault: null,
    db: null,
    dirty: false,
    saving: false,
    lastSaved: null,
    saveError: null,
    since: null,
    ui: loadUi(),
  };

  const TABS = [
    { id: 'course', label: 'Kurs & Schüler' },
    { id: 'tests', label: 'Tests' },
    { id: 'epo', label: 'Mitarbeit/EPO' },
    { id: 'overview', label: 'Notenübersicht' },
    { id: 'seating', label: 'Sitzplan' },
    { id: 'settings', label: 'Einstellungen' },
  ];

  function loadUi() {
    try {
      return Object.assign({ tab: 'overview', courseId: null, yearId: null, half: {}, testId: {}, epoId: {}, seatingId: {}, theme: 'auto' }, JSON.parse(localStorage.getItem('nm.ui') || '{}'));
    } catch (e) {
      return { tab: 'overview', courseId: null, yearId: null, half: {}, testId: {}, epoId: {}, seatingId: {}, theme: 'auto' };
    }
  }
  function saveUi() {
    try { localStorage.setItem('nm.ui', JSON.stringify(state.ui)); } catch (e) { /* egal */ }
  }

  const root = () => document.getElementById('app');

  // =====================================================================
  // Start / Anmeldung
  // =====================================================================

  async function boot() {
    applyTheme();
    if (DEMO) {
      state.store = new S.MemoryStore();
      // Demo ohne echte Verschlüsselung (nichts wird gespeichert)
      state.vault = { header: {}, seal: async (d) => d, open: async (d) => d, wipe() {}, setPassword: async () => {}, setRecoveryKey: async () => {}, verifyPassword: async () => true };
      state.db = M.demoDb();
      // Demo: Reiter/Kurs per #tab=…&course=… vorwählbar (für Bildschirmfotos)
      const hp = new URLSearchParams(location.hash.slice(1));
      if (hp.get('tab')) state.ui.tab = hp.get('tab');
      state.ui.courseId = null;
      if (hp.get('course')) state.ui.courseId = state.db.courses[Number(hp.get('course'))].id;
      if (hp.get('theme')) state.ui.theme = hp.get('theme');
      applyTheme();
      startSession();
      return;
    }
    if (!S.supported()) {
      renderUnsupported();
      return;
    }
    state.store = await S.FolderStore.remembered();
    renderStart();
  }

  function renderUnsupported() {
    clear(root()).appendChild(
      authCard(
        'Browser wird nicht unterstützt',
        h('p', null, 'Der Notenmanager speichert die Datenbank direkt in Ihrem Synology-Drive-Ordner. Das ist nur in Chromium-Browsern möglich (Google Chrome, Microsoft Edge, Brave, Thorium).'),
        h('p', { class: 'muted' }, 'Bitte öffnen Sie index.html in einem dieser Browser.')
      )
    );
  }

  function authCard(title, ...content) {
    return h(
      'div',
      { class: 'auth' },
      h('div', { class: 'auth-card' }, h('div', { class: 'auth-logo' }, logo(), h('span', null, 'Notenmanager')), h('h1', null, title), content)
    );
  }

  function logo() {
    return h('span', {
      class: 'logo',
      html: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M5 3h11l3 3v15H5zM7 5v14h10V7h-2V5zm2 5h6v2H9zm0 4h6v2H9z"/></svg>',
    });
  }

  function renderStart(message) {
    const r = clear(root());
    if (!state.store) {
      r.appendChild(
        authCard(
          'Willkommen',
          message ? h('p', { class: 'notice' }, message) : null,
          h('p', null, 'Wählen Sie den Ordner, in dem die Datenbank liegen soll – am besten einen Ordner, den der Synology Drive Client synchronisiert.'),
          h('p', { class: 'muted' }, 'Liegt dort schon eine Datenbank, wird sie geöffnet. Sonst legen Sie eine neue an.'),
          h('button', { class: 'btn btn-primary btn-block', onclick: pickFolder }, 'Datenordner wählen …')
        )
      );
      return;
    }
    const pw = h('input', { type: 'password', class: 'input', autocomplete: 'current-password', placeholder: 'Passwort' });
    const err = h('p', { class: 'error', hidden: true });
    const btn = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Entsperren');
    const form = h(
      'form',
      {
        onsubmit: async (e) => {
          e.preventDefault();
          err.hidden = true;
          btn.disabled = true;
          btn.textContent = 'Wird entschlüsselt …';
          try {
            await unlock(pw.value);
          } catch (ex) {
            err.textContent = ex.message || String(ex);
            err.hidden = false;
            btn.disabled = false;
            btn.textContent = 'Entsperren';
            pw.select();
          }
        },
      },
      h('label', { class: 'field' }, h('span', null, 'Passwort'), pw),
      err,
      btn
    );
    r.appendChild(
      authCard(
        'Datenbank entsperren',
        message ? h('p', { class: 'notice' }, message) : null,
        h('p', { class: 'muted' }, 'Ordner: ', h('strong', null, state.store.name)),
        form,
        h(
          'div',
          { class: 'auth-links' },
          h('button', { class: 'link', onclick: pickFolder }, 'Anderen Ordner wählen'),
          h('button', { class: 'link', onclick: recoverFlow }, 'Passwort vergessen?')
        )
      )
    );
    pw.focus();
  }

  async function pickFolder() {
    try {
      state.store = await S.FolderStore.pick();
    } catch (e) {
      if (e.name !== 'AbortError') toast('Ordner konnte nicht geöffnet werden: ' + e.message, 'error');
      return;
    }
    if (await state.store.exists()) renderStart();
    else renderCreate();
  }

  function renderCreate() {
    const pw1 = h('input', { type: 'password', class: 'input', autocomplete: 'new-password' });
    const pw2 = h('input', { type: 'password', class: 'input', autocomplete: 'new-password' });
    const dev = h('input', { type: 'text', class: 'input', value: S.deviceName() === 'Dieses Gerät' ? '' : S.deviceName(), placeholder: 'z. B. Laptop Schule' });
    const err = h('p', { class: 'error', hidden: true });
    const btn = h('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Datenbank anlegen');
    const form = h(
      'form',
      {
        onsubmit: async (e) => {
          e.preventDefault();
          err.hidden = true;
          if (pw1.value.length < 8) return showErr('Das Passwort muss mindestens 8 Zeichen lang sein.');
          if (pw1.value !== pw2.value) return showErr('Die Passwörter stimmen nicht überein.');
          btn.disabled = true;
          btn.textContent = 'Wird angelegt …';
          try {
            if (!(await state.store.ensurePermission())) throw new Error('Kein Schreibzugriff auf den Ordner.');
            if (dev.value.trim()) S.setDeviceName(dev.value.trim());
            const { vault, recoveryKey } = await Vault.create(pw1.value);
            await showRecoveryKey(recoveryKey, true);
            state.vault = vault;
            state.db = M.newDb();
            state.store.knownModified = null;
            await saveNow(true);
            startSession();
          } catch (ex) {
            showErr(ex.message || String(ex));
            btn.disabled = false;
            btn.textContent = 'Datenbank anlegen';
          }
          function showErr(m) {
            err.textContent = m;
            err.hidden = false;
          }
        },
      },
      h('label', { class: 'field' }, h('span', null, 'Passwort (mind. 8 Zeichen)'), pw1),
      h('label', { class: 'field' }, h('span', null, 'Passwort wiederholen'), pw2),
      h('label', { class: 'field' }, h('span', null, 'Name dieses Geräts'), dev),
      err,
      btn
    );
    clear(root()).appendChild(
      authCard(
        'Neue Datenbank anlegen',
        h('p', { class: 'muted' }, 'Ordner: ', h('strong', null, state.store.name)),
        h('p', null, 'Die Daten werden mit diesem Passwort verschlüsselt. Ohne Passwort oder Wiederherstellungsschlüssel sind sie nicht mehr lesbar.'),
        form,
        h('div', { class: 'auth-links' }, h('button', { class: 'link', onclick: pickFolder }, 'Anderen Ordner wählen'))
      )
    );
    pw1.focus();
  }

  /** Wiederherstellungsschlüssel anzeigen; bei `mandatory` muss das Notieren bestätigt werden. */
  async function showRecoveryKey(key, mandatory) {
    const cb = h('input', { type: 'checkbox' });
    const printKey = () => {
      const w = window.open('', '_blank', 'width=600,height=400');
      if (!w) return toast('Pop-up wurde blockiert.', 'error');
      w.document.write(
        `<!doctype html><meta charset="utf-8"><title>Wiederherstellungsschlüssel</title><body style="font-family:sans-serif;padding:40px"><h2>Notenmanager – Wiederherstellungsschlüssel</h2><p>Erstellt am ${new Date().toLocaleString('de-DE')}</p><p style="font:600 22px monospace;letter-spacing:2px;border:2px solid #000;padding:16px;display:inline-block">${key}</p><p>Sicher aufbewahren. Mit diesem Schlüssel kann ein neues Passwort gesetzt werden.</p></body>`
      );
      w.document.close();
      w.print();
    };
    await modal({
      title: 'Wiederherstellungsschlüssel',
      body: h(
        'div',
        null,
        h('p', null, 'Mit diesem Schlüssel können Sie ein neues Passwort setzen, falls Sie Ihres vergessen. Drucken Sie ihn aus oder notieren Sie ihn und bewahren Sie ihn sicher auf – getrennt vom Rechner.'),
        h('div', { class: 'recovery-key' }, key),
        h('p', null, h('button', { type: 'button', class: 'btn', onclick: printKey }, 'Drucken …'), ' ', h('button', { type: 'button', class: 'btn', onclick: () => navigator.clipboard.writeText(key).then(() => toast('Kopiert.')) }, 'Kopieren')),
        mandatory ? h('label', { class: 'check' }, cb, ' Ich habe den Schlüssel sicher notiert bzw. ausgedruckt.') : null
      ),
      buttons: [
        {
          label: 'Weiter',
          value: true,
          kind: 'primary',
          validate: () => {
            if (mandatory && !cb.checked) {
              toast('Bitte bestätigen Sie, dass Sie den Schlüssel notiert haben.', 'error');
              return false;
            }
            return true;
          },
        },
      ],
    });
  }

  async function unlock(password) {
    if (!(await state.store.ensurePermission())) throw new Error('Kein Zugriff auf den Ordner. Bitte Zugriff erlauben.');
    if (!(await state.store.exists())) {
      renderCreate();
      return;
    }
    const fileObj = await state.store.read();
    const vault = await Vault.unlock(fileObj, password);
    const db = M.migrate(await vault.open(fileObj));
    if (!(await checkLockAndConflicts())) {
      vault.wipe();
      return;
    }
    state.vault = vault;
    state.db = db;
    startSession();
  }

  async function checkLockAndConflicts() {
    const lock = await state.store.foreignLock();
    if (lock) {
      const ok = await confirmDialog(
        'Datenbank ist woanders geöffnet',
        `Die Datenbank ist möglicherweise noch auf „${lock.device}“ geöffnet (seit ${new Date(lock.since).toLocaleString('de-DE')}, zuletzt aktiv ${new Date(lock.heartbeat).toLocaleString('de-DE')}). Wenn Sie auf zwei Geräten gleichzeitig arbeiten, gehen Änderungen verloren. Trotzdem öffnen?`,
        { okLabel: 'Trotzdem öffnen', danger: true }
      );
      if (!ok) return false;
    }
    const conflicts = await state.store.findConflicts();
    if (conflicts.length) {
      await modal({
        title: 'Konfliktkopie gefunden',
        body: h(
          'div',
          null,
          h('p', null, 'Synology Drive hat Konfliktkopien angelegt. Das passiert, wenn auf zwei Geräten gleichzeitig gespeichert wurde:'),
          h('ul', null, conflicts.map((c) => h('li', null, h('code', null, c)))),
          h('p', null, 'Die App öffnet die Hauptdatei. Prüfen Sie, ob in der Konfliktkopie Änderungen fehlen. Sie können sie unter Einstellungen → Sicherungen einsehen, wenn Sie sie in den Ordner „Sicherungen“ verschieben. Löschen Sie die Konfliktkopie danach, damit dieser Hinweis verschwindet.')
        ),
      });
    }
    return true;
  }

  async function recoverFlow() {
    const keyInput = h('input', { class: 'input mono', placeholder: 'XXXX-XXXX-…' });
    const pw1 = h('input', { type: 'password', class: 'input' });
    const pw2 = h('input', { type: 'password', class: 'input' });
    const v = await modal({
      title: 'Passwort zurücksetzen',
      body: h(
        'div',
        null,
        h('p', null, 'Geben Sie Ihren Wiederherstellungsschlüssel und ein neues Passwort ein.'),
        h('label', { class: 'field' }, h('span', null, 'Wiederherstellungsschlüssel'), keyInput),
        h('label', { class: 'field' }, h('span', null, 'Neues Passwort (mind. 8 Zeichen)'), pw1),
        h('label', { class: 'field' }, h('span', null, 'Neues Passwort wiederholen'), pw2)
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        {
          label: 'Passwort setzen',
          value: 'ok',
          kind: 'primary',
          validate: () => {
            if (pw1.value.length < 8) return toast('Das Passwort muss mindestens 8 Zeichen lang sein.', 'error'), false;
            if (pw1.value !== pw2.value) return toast('Die Passwörter stimmen nicht überein.', 'error'), false;
            return true;
          },
        },
      ],
    });
    if (v !== 'ok') return;
    try {
      if (!(await state.store.ensurePermission())) throw new Error('Kein Zugriff auf den Ordner.');
      const fileObj = await state.store.read();
      const vault = await Vault.unlockWithRecovery(fileObj, keyInput.value);
      const db = M.migrate(await vault.open(fileObj));
      await vault.setPassword(pw1.value);
      if (!(await checkLockAndConflicts())) return;
      state.vault = vault;
      state.db = db;
      await saveNow(true);
      toast('Neues Passwort gesetzt.', 'success');
      startSession();
    } catch (e) {
      toast(e.message || String(e), 'error', 6000);
    }
  }

  // =====================================================================
  // Sitzung
  // =====================================================================

  let heartbeatTimer = null;
  let idleTimer = null;
  let lastActivity = Date.now();

  function startSession() {
    state.since = new Date().toISOString();
    state.store.writeLock(state.since).catch(() => {});
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => state.store && state.store.writeLock(state.since).catch(() => {}), 3 * 60000);
    lastActivity = Date.now();
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      const min = Number(state.db && state.db.settings.autoLockMin) || 0;
      if (!DEMO && min > 0 && Date.now() - lastActivity > min * 60000) lockApp('Automatisch gesperrt nach ' + min + ' Minuten ohne Aktivität.');
    }, 20000);
    ensureSelection();
    renderShell();
  }

  for (const ev of ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart']) {
    window.addEventListener(ev, () => (lastActivity = Date.now()), { passive: true });
  }

  async function lockApp(message) {
    if (!state.vault) return;
    if (state.dirty) {
      try {
        await saveNow();
      } catch (e) {
        // Speichern fehlgeschlagen: nicht sperren, sonst gehen Änderungen verloren
        toast('Sperren abgebrochen: Speichern fehlgeschlagen.', 'error');
        return;
      }
    }
    clearInterval(heartbeatTimer);
    clearInterval(idleTimer);
    await state.store.releaseLock().catch(() => {});
    state.vault.wipe();
    state.vault = null;
    state.db = null;
    state.dirty = false;
    if (DEMO) {
      location.reload();
      return;
    }
    renderStart(message);
  }

  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    } else if (state.vault && state.store) {
      state.store.releaseLock();
    }
  });

  // =====================================================================
  // Speichern
  // =====================================================================

  let saveTimer = null;
  let lastChangeAt = 0;

  /** Nach jeder Änderung aufrufen: markiert ungespeichert, speichert verzögert, zeichnet neu. */
  function commit({ render = true } = {}) {
    state.dirty = true;
    lastChangeAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow().catch(() => {}), 1200);
    updateSaveStatus();
    if (render) rerender();
  }

  async function saveNow(force = false) {
    if (!state.vault || !state.db) return;
    if (state.saving) {
      // Nach dem laufenden Speichern erneut versuchen
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveNow(force).catch(() => {}), 800);
      return;
    }
    state.saving = true;
    updateSaveStatus();
    const wasDirtyAt = Date.now();
    try {
      state.db.savedAt = new Date().toISOString();
      state.db.savedWith = M.APP_VERSION;
      const obj = await state.vault.seal(state.db, { savedAt: state.db.savedAt, device: S.deviceName(), app: M.APP_VERSION });
      await state.store.write(obj, { force, keepBackups: state.db.settings.keepBackups, backupEveryMin: state.db.settings.backupEveryMin });
      state.lastSaved = new Date();
      state.saveError = null;
      if (lastChangeAt <= wasDirtyAt) state.dirty = false;
    } catch (e) {
      state.saveError = e;
      if (e instanceof S.ConflictError) {
        state.saving = false;
        updateSaveStatus();
        await handleConflict();
        return;
      }
      toast('Speichern fehlgeschlagen: ' + (e.message || e), 'error', 8000);
      throw e;
    } finally {
      state.saving = false;
      updateSaveStatus();
    }
  }


  async function handleConflict() {
    const v = await modal({
      title: 'Datenbank wurde extern geändert',
      body: h(
        'div',
        null,
        h('p', null, 'Die Datenbankdatei wurde geändert, seit Sie sie geöffnet haben – vermutlich von einem anderen Gerät über Synology Drive.'),
        h('p', null, h('strong', null, 'Neu laden'), ' übernimmt die Version vom anderen Gerät. Ihre ungespeicherten Änderungen auf diesem Gerät gehen dabei verloren.'),
        h('p', null, h('strong', null, 'Überschreiben'), ' speichert Ihre Version. Die Änderungen des anderen Geräts gehen verloren (vorher wird automatisch eine Sicherung angelegt).')
      ),
      buttons: [
        { label: 'Später', value: null },
        { label: 'Neu laden', value: 'reload' },
        { label: 'Überschreiben', value: 'force', kind: 'danger' },
      ],
    });
    if (v === 'reload') {
      try {
        const fileObj = await state.store.read();
        state.db = M.migrate(await state.vault.open(fileObj));
        state.dirty = false;
        ensureSelection();
        renderShell();
        toast('Neu geladen.', 'success');
      } catch (e) {
        toast('Neu laden fehlgeschlagen: ' + e.message, 'error');
      }
    } else if (v === 'force') {
      await state.store.backupNow(await state.store.read(), state.db.settings.keepBackups).catch(() => {});
      await saveNow(true);
    }
  }

  function updateSaveStatus() {
    const el = document.getElementById('save-status');
    if (!el) return;
    let text;
    let cls = 'save-status';
    if (DEMO) {
      text = 'Demo – wird nicht gespeichert';
      cls += ' warn';
    } else if (state.saving) text = 'Speichert …';
    else if (state.saveError) {
      text = 'Nicht gespeichert!';
      cls += ' error';
    } else if (state.dirty) text = 'Ungespeicherte Änderungen';
    else if (state.lastSaved) text = 'Gespeichert ' + fmtTime(state.lastSaved);
    else text = 'Geöffnet';
    el.className = cls;
    el.textContent = text;
    el.title = state.store ? 'Ordner: ' + state.store.name : '';
  }

  // =====================================================================
  // Auswahl / Layout
  // =====================================================================

  function db() {
    return state.db;
  }

  function currentYear() {
    return state.db.years.find((y) => y.id === state.ui.yearId) || state.db.years[state.db.years.length - 1];
  }

  function coursesOfYear() {
    const y = currentYear();
    return state.db.courses.filter((c) => c.yearId === (y && y.id));
  }

  function currentCourse() {
    return state.db.courses.find((c) => c.id === state.ui.courseId && c.yearId === (currentYear() || {}).id) || null;
  }

  function ensureSelection() {
    if (!currentYear()) {
      state.db.years.push({ id: NM.util.uid(), name: '2026/27' });
    }
    state.ui.yearId = currentYear().id;
    if (!currentCourse()) {
      const list = coursesOfYear();
      state.ui.courseId = list.length ? list[0].id : null;
    }
    if (!TABS.some((t) => t.id === state.ui.tab)) state.ui.tab = 'overview';
    saveUi();
  }

  /** Aktuelles Halbjahr des Kurses (pro Kurs gemerkt). */
  function currentHalf(course, allowYear = false) {
    const halves = NM.grades.halvesFor(course);
    let h = state.ui.half[course.id];
    if (h === 'Jahr' && allowYear && NM.grades.hasYearGrade(course)) return h;
    if (!halves.includes(h)) h = guessHalf(halves);
    return h;
  }
  function guessHalf(halves) {
    if (halves.length < 2) return halves[0];
    const m = new Date().getMonth(); // Feb–Jul → zweites Halbjahr
    return m >= 1 && m <= 6 ? halves[1] : halves[0];
  }
  function setHalf(course, half) {
    state.ui.half[course.id] = half;
    saveUi();
    rerender();
  }

  function select(patch) {
    Object.assign(state.ui, patch);
    saveUi();
    renderShell();
  }

  function applyTheme() {
    const t = state.ui.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }

  function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    state.ui.theme = dark ? 'light' : 'dark';
    saveUi();
    applyTheme();
  }

  function renderShell() {
    const r = clear(root());
    document.body.classList.toggle('no-grade-colors', !state.db.settings.gradeColors);
    const yearSel = h(
      'select',
      {
        class: 'input input-sm',
        'aria-label': 'Schuljahr',
        onchange: (e) => {
          if (e.target.value === '__new') return addYear();
          select({ yearId: e.target.value, courseId: null });
          ensureSelection();
          renderShell();
        },
      },
      state.db.years.map((y) => h('option', { value: y.id, selected: y.id === currentYear().id }, 'Schuljahr ' + y.name)),
      h('option', { value: '__new' }, '+ Neues Schuljahr …')
    );
    const top = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, logo(), h('span', null, 'Notenmanager')),
      yearSel,
      h('div', { class: 'spacer' }),
      h('span', { id: 'save-status', class: 'save-status' }),
      h('button', { class: 'icon-btn', title: 'Hell/Dunkel umschalten', 'aria-label': 'Hell/Dunkel umschalten', onclick: toggleTheme, html: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>' }),
      h('button', { class: 'btn btn-sm', onclick: () => lockApp('Gesperrt.'), title: 'Datenbank sperren' }, '🔒 Sperren')
    );
    const side = h('aside', { class: 'sidebar' }, renderCourseList());
    const main = h('main', { class: 'main', id: 'main' });
    r.append(top, h('div', { class: 'layout' }, side, main));
    updateSaveStatus();
    renderMain();
  }

  function renderCourseList() {
    const list = coursesOfYear().slice().sort((a, b) => Number(a.jahrgang) - Number(b.jahrgang) || M.courseTitle(a).localeCompare(M.courseTitle(b), 'de'));
    const cur = currentCourse();
    return h(
      'nav',
      { class: 'course-nav', 'aria-label': 'Kurse' },
      h('div', { class: 'nav-title' }, 'Kurse'),
      list.length === 0 ? h('p', { class: 'muted small' }, 'Noch keine Kurse in diesem Schuljahr.') : null,
      list.map((c) =>
        h(
          'button',
          {
            class: 'course-item' + (cur && cur.id === c.id ? ' active' : ''),
            onclick: () => select({ courseId: c.id, tab: state.ui.tab === 'settings' ? 'overview' : state.ui.tab }),
          },
          h('span', { class: 'course-name' }, M.courseTitle(c)),
          h('span', { class: 'course-meta' }, NM.grades.courseLevel(c) === 'mss' ? 'MSS' : 'Sek I', ' · ', M.activeStudents(c).length, ' SuS')
        )
      ),
      h('button', { class: 'btn btn-ghost btn-block add-course', onclick: addCourse }, '+ Kurs anlegen')
    );
  }

  async function addYear() {
    const name = await NM.util.promptDialog('Neues Schuljahr', 'Bezeichnung', suggestNextYear());
    if (!name) return renderShell();
    const y = { id: NM.util.uid(), name: name.trim() };
    state.db.years.push(y);
    state.ui.yearId = y.id;
    state.ui.courseId = null;
    commit({ render: false });
    renderShell();
  }
  function suggestNextYear() {
    const last = state.db.years[state.db.years.length - 1];
    const m = last && /^(\d{4})/.exec(last.name);
    if (!m) return '';
    const y = Number(m[1]) + 1;
    return `${y}/${String(y + 1).slice(2)}`;
  }

  function addCourse() {
    const c = M.newCourse(currentYear().id, { jahrgang: 5 });
    state.db.courses.push(c);
    state.ui.courseId = c.id;
    state.ui.tab = 'course';
    saveUi();
    commit({ render: false });
    renderShell();
    setTimeout(() => {
      const el = document.querySelector('[data-focus-key="course-klasse"]');
      if (el) el.focus();
    }, 0);
  }

  function renderMain() {
    const main = document.getElementById('main');
    if (!main) return;
    clear(main);
    const course = currentCourse();
    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      TABS.map((t) =>
        h(
          'button',
          {
            role: 'tab',
            class: 'tab' + (state.ui.tab === t.id ? ' active' : ''),
            'aria-selected': state.ui.tab === t.id ? 'true' : 'false',
            disabled: !course && t.id !== 'settings',
            onclick: () => select({ tab: t.id }),
          },
          t.label
        )
      )
    );
    main.appendChild(tabs);
    const view = h('section', { class: 'view', id: 'view' });
    main.appendChild(view);
    if (!course && state.ui.tab !== 'settings') {
      view.appendChild(
        h(
          'div',
          { class: 'empty' },
          h('h2', null, 'Noch kein Kurs ausgewählt'),
          h('p', null, 'Legen Sie links einen Kurs an (Klasse + Fach), fügen Sie die Schülerliste ein und los geht’s.'),
          h('button', { class: 'btn btn-primary', onclick: addCourse }, '+ Kurs anlegen')
        )
      );
      return;
    }
    const v = NM.views[state.ui.tab];
    if (v) v.render(view, { course, db: state.db });
  }

  // ---------- Neuzeichnen mit Fokus-Erhalt ----------

  let rerenderQueued = false;
  function rerender() {
    if (rerenderQueued) return;
    rerenderQueued = true;
    setTimeout(() => {
      rerenderQueued = false;
      const active = document.activeElement;
      const key = active && active.dataset ? active.dataset.focusKey : null;
      let sel = null;
      try {
        sel = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
      } catch (e) { sel = null; }
      const scrollers = [...document.querySelectorAll('[data-scroll-key]')].map((el) => [el.dataset.scrollKey, el.scrollLeft, el.scrollTop]);
      const mainScroll = document.getElementById('main') ? document.getElementById('main').scrollTop : 0;
      // Seitenleiste mit aktualisieren (Schülerzahlen, Kursnamen)
      const side = document.querySelector('.sidebar');
      if (side) {
        clear(side).appendChild(renderCourseList());
      }
      renderMain();
      const main = document.getElementById('main');
      if (main) main.scrollTop = mainScroll;
      for (const [k, l, t] of scrollers) {
        const el = document.querySelector(`[data-scroll-key="${k}"]`);
        if (el) {
          el.scrollLeft = l;
          el.scrollTop = t;
        }
      }
      if (key) {
        const el = document.querySelector(`[data-focus-key="${CSS.escape(key)}"]`);
        if (el) {
          el.focus({ preventScroll: true });
          if (sel && el.setSelectionRange && active.dataset.selectAll !== undefined) el.select();
          else if (sel && el.setSelectionRange) {
            try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* egal */ }
          }
        }
      }
    }, 0);
  }

  // ---------- Tabellen-Navigation: Enter/Pfeile in Notenzellen ----------

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!t || !t.dataset || t.dataset.row === undefined) return;
    let dr = 0;
    let dc = 0;
    if (e.key === 'Enter') dr = e.shiftKey ? -1 : 1;
    else if (e.key === 'ArrowDown') dr = 1;
    else if (e.key === 'ArrowUp') dr = -1;
    else if (e.key === 'ArrowRight' && t.selectionStart === t.value.length && t.selectionEnd === t.value.length) dc = 1;
    else if (e.key === 'ArrowLeft' && t.selectionStart === 0 && t.selectionEnd === 0) dc = -1;
    else return;
    const grid = t.dataset.grid;
    const row = Number(t.dataset.row) + dr;
    const col = Number(t.dataset.col) + dc;
    const next = document.querySelector(`[data-grid="${grid}"][data-row="${row}"][data-col="${col}"]`);
    if (next) {
      e.preventDefault();
      // Änderung übernehmen, dann wandert der Fokus
      t.dispatchEvent(new Event('change', { bubbles: true }));
      next.focus();
      next.select && next.select();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      t.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  NM.app = {
    state,
    DEMO,
    boot,
    commit,
    saveNow,
    rerender,
    renderShell,
    db,
    currentCourse,
    currentHalf,
    setHalf,
    select,
    lockApp,
    showRecoveryKey,
    saveUi,
    applyTheme,
    coursesOfYear,
    currentYear,
  };
  NM.views = NM.views || {};

  document.addEventListener('DOMContentLoaded', boot);
})((globalThis.NM = globalThis.NM || {}));
