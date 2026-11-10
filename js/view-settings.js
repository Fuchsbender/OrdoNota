/* OrdoNota – Reiter „Einstellungen“. */
(function (NM) {
  'use strict';
  const { h, toast, modal, confirmDialog, parseNum, promptDialog } = NM.util;
  const S = NM.storage;

  function render(view, { db }) {
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Einstellungen')),
      h('div', { class: 'masonry' }, securityCard(db), defaultsCard(db), storageCard(db), yearsCard(db), tabsCard(db), displayCard(db), pomodoroCard(db), infoCard())
    );
  }

  /** Ergebnis von NM.model.check als Dialog; ändert nichts an der Datenbank. */
  function checkDialog(db) {
    const res = NM.model.check(db);
    const err = res.filter((p) => p.level === 'fehler');
    const info = res.filter((p) => p.level !== 'fehler');
    const list = (items) => h('ul', { class: 'check-list' }, items.map((p) => h('li', null, h('strong', null, p.where), ': ', p.text)));
    return modal({
      title: 'Datenbank prüfen',
      wide: res.length > 0,
      body: h(
        'div',
        null,
        h('p', null, `Datenbank gespeichert mit Version ${db.savedWith || '?'}, geöffnet mit Version ${NM.model.APP_VERSION} (Datenformat ${NM.model.SCHEMA}).`),
        err.length
          ? [h('p', { class: 'error' }, `${err.length} Problem(e), die Rechnung oder Anzeige stören können:`), list(err)]
          : h('p', { class: 'notice' }, '✓ Keine Probleme gefunden. Alle Kurse, Leistungen und Noten sind lesbar.'),
        info.length ? [h('p', { class: 'muted' }, `${info.length} Hinweis(e) zu übrig gebliebenen Einträgen (stören nicht, z. B. Punkte gelöschter Personen):`), list(info)] : null,
        err.length ? h('p', { class: 'muted small' }, 'Die Prüfung ändert nichts. Bei Problemen hilft oft eine Sicherung von vor dem Update (Sicherung wiederherstellen).') : null
      ),
    });
  }

  function numField(label, value, onSet, { min, max, step = 1, hint } = {}) {
    return h(
      'label',
      { class: 'field' },
      h('span', null, label),
      h('input', {
        class: 'input',
        type: 'number',
        min,
        max,
        step,
        value,
        onchange: (e) => {
          const v = parseNum(e.target.value);
          if (v === null || v === undefined || (min !== undefined && v < min) || (max !== undefined && v > max)) {
            return toast(`Bitte einen Wert zwischen ${min} und ${max} eingeben.`, 'error');
          }
          onSet(v);
          NM.app.commit();
        },
      }),
      hint ? h('small', { class: 'muted' }, hint) : null
    );
  }

  function securityCard(db) {
    const st = NM.app.state;
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Sicherheit'),
      h(
        'div',
        { class: 'inline wrap' },
        h('button', { class: 'btn', onclick: changePassword }, 'Passwort ändern …'),
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              if (!(await confirmDialog('Neuer Wiederherstellungsschlüssel', 'Der bisherige Wiederherstellungsschlüssel wird ungültig. Fortfahren?', { okLabel: 'Neu erzeugen' }))) return;
              const key = NM.crypto.makeRecoveryKey();
              await st.vault.setRecoveryKey(key);
              await NM.app.saveNow();
              await NM.app.showRecoveryKey(key, true);
            },
          },
          'Neuen Wiederherstellungsschlüssel erzeugen …'
        )
      ),
      h(
        'div',
        { class: 'form-grid' },
        numField('Automatisch sperren nach (Minuten, 0 = nie)', db.settings.autoLockMin, (v) => (db.settings.autoLockMin = v), { min: 0, max: 240 })
      ),
      h('p', { class: 'muted small' }, 'Verschlüsselung: AES-256-GCM, Schlüssel aus dem Passwort per PBKDF2-SHA256 (600 000 Runden). Ohne Passwort oder Wiederherstellungsschlüssel lassen sich die Daten nicht entschlüsseln – auch nicht von Synology.')
    );
  }

  async function changePassword() {
    const st = NM.app.state;
    const old = h('input', { type: 'password', class: 'input', autocomplete: 'current-password' });
    const pw1 = h('input', { type: 'password', class: 'input', autocomplete: 'new-password' });
    const pw2 = h('input', { type: 'password', class: 'input', autocomplete: 'new-password' });
    const v = await modal({
      title: 'Passwort ändern',
      body: h(
        'div',
        null,
        h('label', { class: 'field' }, h('span', null, 'Aktuelles Passwort'), old),
        h('label', { class: 'field' }, h('span', null, 'Neues Passwort (mind. 8 Zeichen)'), pw1),
        h('label', { class: 'field' }, h('span', null, 'Neues Passwort wiederholen'), pw2)
      ),
      buttons: [
        { label: 'Abbrechen', value: null },
        {
          label: 'Ändern',
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
    if (!(await st.vault.verifyPassword(st.vault.header, old.value))) return toast('Das aktuelle Passwort ist falsch.', 'error');
    await st.vault.setPassword(pw1.value);
    await NM.app.saveNow();
    toast('Passwort geändert.', 'success');
  }

  function defaultsCard(db) {
    const s = db.settings;
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Standardwerte für neue Tests'),
      h(
        'div',
        { class: 'form-grid' },
        numField('LIMIT Sek I: 4- ab … %', s.limitSek1, (v) => (s.limitSek1 = v), { min: 20, max: 80, hint: 'Gleichmäßige Abstände bis zur 1; 5- bei der Hälfte' }),
        numField('LIMIT MSS: 04 Punkte ab … %', s.limitMss, (v) => (s.limitMss = v), { min: 20, max: 80, hint: 'Wie Excel-Vorlage; 01 Punkt bei der Hälfte' }),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Punkte-Genauigkeit'),
          h(
            'select',
            {
              class: 'input',
              onchange: (e) => {
                s.precision = Number(e.target.value);
                NM.app.commit();
              },
            },
            [
              [1, 'Ganze Punkte'],
              [0.5, 'Halbe Punkte'],
              [0.1, 'Zehntel'],
            ].map(([v, l]) => h('option', { value: v, selected: Number(s.precision) === v }, l))
          )
        ),
        h(
          'label',
          { class: 'field' },
          h('span', null, 'Bereich'),
          h(
            'select',
            {
              class: 'input',
              onchange: (e) => {
                s.testCat = e.target.value === 'ka' ? 'ka' : 'other';
                NM.app.commit();
              },
            },
            h('option', { value: 'other', selected: s.testCat !== 'ka' }, 'Sonstige (z. B. HÜ)'),
            h('option', { value: 'ka', selected: s.testCat === 'ka' }, 'Klassen-/Kursarbeit')
          )
        )
      ),
      h('p', { class: 'muted small' }, 'Bestehende Tests behalten ihre Werte; jeder Test lässt sich einzeln anpassen.')
    );
  }

  function storageCard(db) {
    const st = NM.app.state;
    const s = db.settings;
    const listHost = h('div', { class: 'backup-list' }, h('p', { class: 'muted small' }, 'Wird geladen …'));
    st.store.listBackups().then((names) => {
      NM.util.clear(listHost);
      if (!names.length) return listHost.appendChild(h('p', { class: 'muted small' }, 'Noch keine Sicherungen.'));
      listHost.appendChild(
        h(
          'ul',
          { class: 'plain' },
          names.map((n) =>
            h(
              'li',
              null,
              h('code', null, n.replace(/^notenmanager_/, '').replace(/\.nmdb$/, '').replace('_', ' ')),
              h('button', { class: 'link', onclick: () => restoreBackup(n) }, 'Wiederherstellen')
            )
          )
        )
      );
    });
    const dev = h('input', {
      class: 'input',
      value: S.deviceName(),
      onchange: (e) => {
        S.setDeviceName(e.target.value.trim() || 'Dieses Gerät');
        st.store.writeLock(st.since).catch(() => {});
        toast('Gerätename gespeichert.', 'success');
      },
    });
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Speicherort & Sicherungen'),
      h('p', null, 'Datenordner: ', h('strong', { title: st.store.path || '' }, st.store.name), ' · Datei ', h('code', null, S.DB_FILE)),
      !st.server ? null : h('p', { class: 'muted small' }, 'Gestartet über das Startprogramm: ', h('code', null, st.store.path)),
      h('p', { class: 'muted small' }, 'Der Synology Drive Client spiegelt diesen Ordner auf die DiskStation. Bitte die App immer nur auf einem Gerät gleichzeitig öffnen.'),
      h(
        'div',
        { class: 'form-grid' },
        h('label', { class: 'field' }, h('span', null, 'Name dieses Geräts'), dev),
        numField('Anzahl aufbewahrter Sicherungen', s.keepBackups, (v) => (s.keepBackups = v), { min: 1, max: 100 }),
        numField('Sicherung höchstens alle … Minuten', s.backupEveryMin, (v) => (s.backupEveryMin = v), { min: 1, max: 1440 })
      ),
      h(
        'div',
        { class: 'inline wrap' },
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              try {
                await NM.app.saveNow();
                const obj = await st.vault.seal(db, { savedAt: new Date().toISOString(), device: S.deviceName() });
                await st.store.backupNow(obj, s.keepBackups);
                toast('Sicherung angelegt.', 'success');
                NM.app.rerender();
              } catch (e) {
                toast('Sicherung fehlgeschlagen: ' + e.message, 'error');
              }
            },
          },
          'Jetzt sichern'
        ),
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              const obj = await st.vault.seal(db, { savedAt: new Date().toISOString(), device: S.deviceName() });
              NM.util.download(`ordonota_export_${new Date().toISOString().slice(0, 10)}.nmdb`, JSON.stringify(obj), 'application/octet-stream');
            },
          },
          'Verschlüsselte Kopie herunterladen'
        ),
        NM.app.DEMO ? null : h('button', { class: 'btn', onclick: restoreFromFile, title: 'Eine heruntergeladene Kopie oder Sicherung (.nmdb) einspielen' }, 'Aus Datei wiederherstellen …'),
        NM.app.DEMO ? null : h('button', { class: 'btn', onclick: changeFolder, title: 'Datenbank in einen anderen Ordner kopieren und ab dann dort speichern' }, 'Datenordner wechseln …'),
        h('button', { class: 'btn', onclick: () => checkDialog(db), title: 'Aufbau der Datenbank prüfen (z. B. nach einem Update); ändert nichts' }, 'Datenbank prüfen …')
      ),
      h('h3', null, 'Sicherungen im Ordner „', S.BACKUP_DIR, '“'),
      listHost
    );
  }

  async function restoreBackup(name) {
    const st = NM.app.state;
    if (!(await confirmDialog('Sicherung wiederherstellen?', `Der aktuelle Stand wird durch die Sicherung „${name}“ ersetzt. Der aktuelle Stand wird vorher selbst gesichert.`, { okLabel: 'Wiederherstellen', danger: true }))) return;
    try {
      await restoreFrom(await st.store.readBackup(name), 'Sicherung wiederhergestellt.');
    } catch (e) {
      toast('Wiederherstellen fehlgeschlagen: ' + e.message, 'error');
    }
  }

  /** Eine Datenbank-Datei (z. B. „Verschlüsselte Kopie herunterladen“) einspielen. */
  async function restoreFromFile() {
    const file = await NM.util.pickFile('.nmdb,application/json');
    if (!file) return;
    let fileObj;
    try {
      fileObj = JSON.parse(await file.text());
    } catch (e) {
      fileObj = null;
    }
    if (!fileObj || fileObj.format !== 'notenmanager-db') return toast(`„${file.name}“ ist keine OrdoNota-Datenbank.`, 'error', 6000);
    if (!(await confirmDialog('Aus Datei wiederherstellen?', `Der aktuelle Stand wird durch „${file.name}“ ersetzt und vorher selbst gesichert. Ihr Passwort bleibt gleich, auch wenn die Datei ein anderes hat.`, { okLabel: 'Wiederherstellen', danger: true }))) return;
    try {
      await restoreFrom(fileObj, `„${file.name}“ wiederhergestellt.`);
    } catch (e) {
      toast('Wiederherstellen fehlgeschlagen: ' + e.message, 'error');
    }
  }

  /** Stand übernehmen; mit dem aktuellen Schlüssel neu verschlüsselt (das Passwort bleibt). */
  async function restoreFrom(fileObj, doneText) {
    const st = NM.app.state;
    let data;
    try {
      data = await st.vault.open(fileObj);
    } catch (e) {
      // Sicherung mit anderem Schlüssel (z. B. alte Datenbank): mit Passwort versuchen
      const pw = await promptDialog('Passwort der Sicherung', 'Diese Datei wurde mit einem anderen Schlüssel verschlüsselt. Passwort dieser Datei:', '', { type: 'password' });
      if (pw === null) return;
      const v = await NM.crypto.Vault.unlock(fileObj, pw);
      data = await v.open(fileObj);
      v.wipe();
    }
    const cur = await st.vault.seal(st.db, { savedAt: new Date().toISOString(), device: S.deviceName() });
    await st.store.backupNow(cur, st.db.settings.keepBackups + 1);
    st.db = NM.model.migrate(data);
    await NM.app.saveNow();
    NM.app.renderShell();
    toast(doneText, 'success');
  }

  /** Datenordner wechseln: Datenbank (und auf Wunsch Sicherungen) kopieren; der alte Ordner bleibt unverändert. */
  async function changeFolder() {
    const st = NM.app.state;
    let t;
    try {
      t = await st.store.pickTarget();
    } catch (e) {
      if (e.name !== 'AbortError') toast('Ordner konnte nicht geöffnet werden: ' + e.message, 'error');
      return;
    }
    if (t.same) return toast('Das ist bereits der aktuelle Datenordner.');
    await NM.app.saveNow();
    if (st.dirty || st.saveError) return toast('Wechsel abgebrochen: Der aktuelle Stand ist nicht gespeichert.', 'error');
    if (t.hasDb) {
      const ok = await confirmDialog(
        'Dort liegt schon eine Datenbank',
        `Im Ordner „${t.name}“ liegt bereits eine OrdoNota-Datenbank. Sie wird nicht überschrieben. Soll die App stattdessen diese Datenbank öffnen? Die aktuelle ist gespeichert und bleibt im bisherigen Ordner.`,
        { okLabel: 'Diese Datenbank öffnen' }
      );
      if (ok) await NM.app.switchStore(await st.store.constructor.useTarget(t), `Ordner „${t.name}“: Bitte mit dem Passwort dieser Datenbank entsperren.`);
      return;
    }
    const nBackups = (await st.store.listBackups()).length;
    const v = await modal({
      title: 'Datenordner wechseln',
      body: h(
        'div',
        null,
        h('p', null, 'Die Datenbank wird nach „', h('strong', null, t.name), '“ kopiert und ab jetzt dort gespeichert. Der bisherige Ordner „', st.store.name, '“ bleibt unverändert; Sie können ihn danach löschen.'),
        nBackups ? h('p', null, `Im bisherigen Ordner liegen ${nBackups} Sicherungen. Sollen sie mitkopiert werden?`) : null
      ),
      buttons: nBackups
        ? [
            { label: 'Abbrechen', value: null },
            { label: 'Nur Datenbank', value: 'db' },
            { label: 'Mit Sicherungen', value: 'all', kind: 'primary' },
          ]
        : [
            { label: 'Abbrechen', value: null },
            { label: 'Wechseln', value: 'db', kind: 'primary' },
          ],
    });
    if (!v) return;
    try {
      await st.store.releaseLock().catch(() => {});
      await st.store.moveTo(t, { backups: v === 'all' });
      await st.store.writeLock(st.since).catch(() => {});
      toast(`Datenordner gewechselt: „${t.name}“. Der bisherige Ordner ist unverändert.`, 'success', 6000);
      NM.app.rerender();
    } catch (e) {
      await st.store.writeLock(st.since).catch(() => {});
      toast('Wechsel fehlgeschlagen: ' + e.message, 'error', 8000);
    }
  }

  function yearsCard(db) {
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Schuljahre'),
      h(
        'ul',
        { class: 'plain' },
        db.years.map((y) => {
          const n = db.courses.filter((c) => c.yearId === y.id).length;
          return h(
            'li',
            null,
            h('strong', null, y.name),
            h('span', { class: 'muted small' }, ` · ${n} Kurs${n === 1 ? '' : 'e'}`),
            h(
              'button',
              {
                class: 'link',
                onclick: async () => {
                  const name = await promptDialog('Schuljahr umbenennen', 'Bezeichnung', y.name);
                  if (!name) return;
                  y.name = name.trim();
                  NM.app.commit({ render: false });
                  NM.app.renderShell();
                },
              },
              'Umbenennen'
            ),
            n === 0 && db.years.length > 1
              ? h(
                  'button',
                  {
                    class: 'link danger',
                    onclick: () => {
                      db.years = db.years.filter((x) => x.id !== y.id);
                      NM.app.commit({ render: false });
                      NM.app.renderShell();
                    },
                  },
                  'Löschen'
                )
              : null
          );
        })
      ),
      h('p', { class: 'muted small' }, 'Neue Schuljahre legen Sie oben über die Schuljahr-Auswahl an. Kurse lassen sich unter „Kurs & Schüler“ ins neue Schuljahr kopieren.')
    );
  }

  function pomodoroCard(db) {
    if (!db.settings.pomodoro) db.settings.pomodoro = NM.pomodoro.config(db.settings);
    const p = db.settings.pomodoro;
    return h(
      'div',
      { class: 'card' },
      h('h2', null, '🍅 Pomodoro-Timer'),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: p.enabled,
          onchange: (e) => {
            p.enabled = e.target.checked;
            if (!p.enabled) NM.pomodoro.reset();
            NM.app.commit({ render: false });
            NM.app.renderShell();
          },
        }),
        ' Pomodoro-Timer in der Kopfzeile anzeigen'
      ),
      h('p', { class: 'muted small' }, 'Arbeitsphasen (rot) und Pausen (grün) im Wechsel; pausiert ist der Timer gelb. Bedienung in der Kopfzeile neben dem Schuljahr: ▶ Start, ⏸ Pause, ↺ Zurücksetzen, ⚙ Einstellungen. Der Timer läuft auch weiter, wenn die App gesperrt wird.'),
      p.enabled ? NM.pomodoro.settingsForm(db.settings) : null
    );
  }

  function tabsCard(db) {
    const def = db.settings.tabs;
    const own = db.courses.filter((c) => c.tabs && Object.keys(c.tabs).length).length;
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Reiter'),
      h('p', { class: 'muted small' }, 'Standard für alle Kurse: Ausgeschaltete Reiter verschwinden aus der Reiterleiste. Vorhandene Noten bleiben gespeichert und zählen weiter. „Kurs & Schüler“ und „Einstellungen“ sind immer da.'),
      NM.ui.tabChecks(
        (id) => def[id] !== false,
        (id, on) => {
          if (on) delete def[id];
          else def[id] = false;
          NM.app.commit({ render: false });
          NM.app.renderShell();
        }
      ),
      h('p', { class: 'muted small' }, own ? `${own} ${own === 1 ? 'Kurs weicht' : 'Kurse weichen'} davon ab (einstellbar im Reiter „Kurs & Schüler“).` : 'Einzelne Kurse können abweichen (Reiter „Kurs & Schüler“).'),
      tabOrderList(db)
    );
  }

  /** Reihenfolge der Reiter mit ▲▼ (alternativ in der Reiterleiste ziehen); gilt für alle Kurse. */
  function tabOrderList(db) {
    const tabs = NM.app.orderedTabs();
    const ids = tabs.map((t) => t.id);
    const move = (id, d) => NM.app.setTabOrder(NM.model.moveTab(ids, id, d));
    return h(
      'div',
      { class: 'tab-order' },
      h('h3', null, 'Reihenfolge'),
      h('p', { class: 'muted small' }, 'Gilt für alle Kurse. Reiter lassen sich auch direkt in der Reiterleiste ziehen.'),
      h(
        'ol',
        { class: 'tab-order-list' },
        tabs.map((t, i) =>
          h(
            'li',
            { 'data-tab-order': t.id },
            h('span', null, t.label),
            h('button', { class: 'icon-btn', disabled: i === 0, 'aria-label': 'Nach vorn: ' + t.label, title: 'Nach vorn', onclick: () => move(t.id, -1) }, '▲'),
            h('button', { class: 'icon-btn', disabled: i === tabs.length - 1, 'aria-label': 'Nach hinten: ' + t.label, title: 'Nach hinten', onclick: () => move(t.id, 1) }, '▼')
          )
        )
      ),
      db.settings.tabOrder && db.settings.tabOrder.length ? h('button', { class: 'btn', onclick: () => NM.app.setTabOrder(NM.app.TABS.map((t) => t.id)) }, 'Standardreihenfolge') : null
    );
  }

  function displayCard(db) {
    const ui = NM.app.state.ui;
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Darstellung'),
      h(
        'label',
        { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: db.settings.gradeColors,
          onchange: (e) => {
            db.settings.gradeColors = e.target.checked;
            NM.app.commit({ render: false });
            NM.app.renderShell();
          },
        }),
        ' Noten farbig hinterlegen (grün → rot)'
      ),
      h(
        'label',
        { class: 'field' },
        h('span', null, 'Farbschema'),
        h(
          'select',
          {
            class: 'input',
            onchange: (e) => {
              ui.theme = e.target.value;
              NM.app.saveUi();
              NM.app.applyTheme();
            },
          },
          [
            ['auto', 'Wie das System'],
            ['light', 'Hell'],
            ['dark', 'Dunkel'],
          ].map(([v, l]) => h('option', { value: v, selected: (ui.theme || 'auto') === v }, l))
        )
      ),
      themeTiles('light', 'Helles Design'),
      themeTiles('dark', 'Dunkles Design')
    );
  }

  /**
   * Vorschaukacheln der Designs eines Modus. Jede Kachel trägt data-theme/data-variant und zeigt so ihre eigenen Farben.
   * Ein Klick wählt das Design; ist der Modus fest eingestellt, wechselt er mit, damit die Wahl sofort sichtbar ist.
   */
  function themeTiles(mode, label) {
    const ui = NM.app.state.ui;
    const cur = NM.app.themeVariant(mode);
    return h(
      'div',
      { class: 'field' },
      h('span', null, label),
      h(
        'div',
        { class: 'theme-tiles', role: 'group', 'aria-label': label },
        NM.app.THEMES[mode].map(([id, name]) =>
          h(
            'button',
            {
              type: 'button',
              class: 'theme-tile',
              'data-theme': mode,
              'data-variant': id,
              'data-theme-pick': mode + ':' + id,
              'aria-pressed': String(id === cur),
              title: `${label}: ${name}`,
              onclick: () => {
                ui[mode + 'Theme'] = id;
                if (ui.theme === 'light' || ui.theme === 'dark') ui.theme = mode;
                NM.app.saveUi();
                NM.app.applyTheme();
                NM.app.rerender();
              },
            },
            h(
              'span',
              { class: 'theme-prev', 'aria-hidden': 'true' },
              h('span', { class: 'theme-prev-line' }),
              h('span', { class: 'theme-prev-line muted' }),
              h(
                'span',
                { class: 'theme-prev-row' },
                h('span', { class: 'theme-prev-accent' }),
                [125, 62, 0].map((hue) => h('span', { class: 'theme-prev-grade', style: `--g-hue:${hue}` }))
              )
            ),
            h('span', { class: 'theme-name' }, name)
          )
        )
      )
    );
  }

  function infoCard() {
    return h(
      'div',
      { class: 'card card-subtle' },
      h('h2', null, 'Hinweise'),
      h('p', { class: 'muted small' }, `OrdoNota Version ${NM.model.APP_VERSION} · Datenformat ${NM.model.SCHEMA}`),
      NM.app.DEMO
        ? h('p', { class: 'muted small' }, 'Dies ist der Demo-Modus mit Beispieldaten. Es wird nichts gespeichert.')
        : h(
            'p',
            null,
            h('button', { class: 'btn', onclick: NM.app.openDemo, title: 'Beispieldaten in einem neuen Fenster; Ihre Datenbank bleibt offen und unverändert' }, '▶ Demo ansehen'),
            ' ',
            h('span', { class: 'muted small' }, 'Öffnet die Beispieldaten in einem neuen Fenster. Dort wird nichts gespeichert.')
          ),
      h(
        'ul',
        null,
        h('li', null, 'Datenschutz: In Rheinland-Pfalz ist für die Verarbeitung von Schülerdaten auf privaten Geräten in der Regel eine Genehmigung der Schulleitung nötig.'),
        h('li', null, 'Sek I: Noten 1 bis 6 mit Tendenz, ohne 1+. Intern als Punkte gespeichert (1 = 14, 1- = 13, … 6 = 0).'),
        h('li', null, 'MSS: Punkte 00–15 (15 = 1+, 00 = 6).'),
        h('li', null, 'Tastatur: In Tabellen springt Enter bzw. ↓ zur nächsten Person, Tab zur nächsten Spalte.')
      )
    );
  }

  NM.views.settings = { render, checkDialog };
})((globalThis.NM = globalThis.NM || {}));
