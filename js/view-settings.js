/* OrdoNota – Reiter „Einstellungen“. */
(function (NM) {
  'use strict';
  const { h, toast, modal, confirmDialog, parseNum, promptDialog } = NM.util;
  const S = NM.storage;

  function render(view, { db }) {
    view.append(
      h('div', { class: 'view-head' }, h('h1', null, 'Einstellungen')),
      h('div', { class: 'masonry' }, securityCard(db), defaultsCard(db), storageCard(db), yearsCard(db), displayCard(db), pomodoroCard(db), infoCard())
    );
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
      h('p', null, 'Datenordner: ', h('strong', null, st.store.name), ' · Datei ', h('code', null, S.DB_FILE)),
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
        )
      ),
      h('h3', null, 'Sicherungen im Ordner „', S.BACKUP_DIR, '“'),
      listHost
    );
  }

  async function restoreBackup(name) {
    const st = NM.app.state;
    if (!(await confirmDialog('Sicherung wiederherstellen?', `Der aktuelle Stand wird durch die Sicherung „${name}“ ersetzt. Der aktuelle Stand wird vorher selbst gesichert.`, { okLabel: 'Wiederherstellen', danger: true }))) return;
    try {
      const fileObj = await st.store.readBackup(name);
      let data;
      try {
        data = await st.vault.open(fileObj);
      } catch (e) {
        // Sicherung mit anderem Schlüssel (z. B. alte Datenbank): mit Passwort versuchen
        const pw = await promptDialog('Passwort der Sicherung', 'Diese Sicherung wurde mit einem anderen Schlüssel verschlüsselt. Passwort der Sicherung:', '', { type: 'password' });
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
      toast('Sicherung wiederhergestellt.', 'success');
    } catch (e) {
      toast('Wiederherstellen fehlgeschlagen: ' + e.message, 'error');
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
      )
    );
  }

  function infoCard() {
    return h(
      'div',
      { class: 'card card-subtle' },
      h('h2', null, 'Hinweise'),
      h('p', { class: 'muted small' }, `OrdoNota Version ${NM.model.APP_VERSION} · Datenformat ${NM.model.SCHEMA}`),
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

  NM.views.settings = { render };
})((globalThis.NM = globalThis.NM || {}));
