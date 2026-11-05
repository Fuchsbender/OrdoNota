/* OrdoNota – Dateizugriff auf den (Synology-Drive-)Ordner.
 *
 * Im gewählten Ordner liegen:
 *   notenmanager.nmdb          verschlüsselte Datenbank
 *   notenmanager.lock.json     Hinweis, auf welchem Gerät die App gerade offen ist
 *   Sicherungen/               rollierende Sicherungskopien
 *
 * FolderStore greift über die File System Access API direkt auf den Ordner zu (Start per Doppelklick).
 * ServerStore spricht mit dem Startprogramm (launcher/), das die Dateien schreibt – ohne Rückfrage des Browsers.
 */
(function (NM) {
  'use strict';

  const DB_FILE = 'notenmanager.nmdb';
  const LOCK_FILE = 'notenmanager.lock.json';
  const BACKUP_DIR = 'Sicherungen';
  const LOCK_STALE_MIN = 15;

  // ---------- Geräte-Infos (pro Browser) ----------

  function lsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* egal */ }
  }

  function deviceId() {
    let id = lsGet('nm.deviceId');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      lsSet('nm.deviceId', id);
    }
    return id;
  }
  function deviceName() {
    return lsGet('nm.deviceName') || 'Dieses Gerät';
  }
  function setDeviceName(n) {
    lsSet('nm.deviceName', n);
  }

  // ---------- Ordner-Handle in IndexedDB merken ----------

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('notenmanager', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    try {
      const db = await idb();
      return await new Promise((resolve, reject) => {
        const r = db.transaction('handles').objectStore('handles').get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    } catch (e) {
      return undefined;
    }
  }
  async function idbSet(key, val) {
    try {
      const db = await idb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(val, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { /* Ordner muss dann jedes Mal neu gewählt werden */ }
  }

  function supported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  class ConflictError extends Error {}

  function stamp(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  /** Zugriff auf den Datenordner. */
  class FolderStore {
    constructor(dir) {
      this.dir = dir;
      this.knownModified = null;
      this.lastBackup = 0;
    }

    get name() {
      return this.dir.name;
    }

    static async remembered() {
      const dir = await idbGet('dir');
      return dir ? new FolderStore(dir) : null;
    }

    static async pick() {
      const dir = await window.showDirectoryPicker({ id: 'notenmanager', mode: 'readwrite' });
      await idbSet('dir', dir);
      return new FolderStore(dir);
    }

    /** Neuen Datenordner wählen (noch nicht übernehmen): { dir, name, hasDb, same } */
    async pickTarget() {
      const dir = await window.showDirectoryPicker({ id: 'notenmanager', mode: 'readwrite' });
      const t = new FolderStore(dir);
      return { dir, name: dir.name, hasDb: await t.exists(), same: await this.dir.isSameEntry(dir) };
    }

    /** Gewählten Ordner übernehmen, ohne etwas zu kopieren (dort liegt schon eine Datenbank). */
    static async useTarget(t) {
      await idbSet('dir', t.dir);
      return new FolderStore(t.dir);
    }

    /** Datenbank (und auf Wunsch die Sicherungen) in den neuen Ordner kopieren und ihn übernehmen. Der alte bleibt unverändert. */
    async moveTo(t, { backups = false } = {}) {
      const target = new FolderStore(t.dir);
      if (await target.exists()) throw new Error('Im neuen Ordner liegt bereits eine Datenbank.');
      const text = await (await (await this.dir.getFileHandle(DB_FILE)).getFile()).text();
      const fh = await t.dir.getFileHandle(DB_FILE, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      if (backups) {
        const names = await this.listBackups();
        if (names.length) {
          const src = await this.dir.getDirectoryHandle(BACKUP_DIR);
          const dst = await t.dir.getDirectoryHandle(BACKUP_DIR, { create: true });
          for (const n of names) {
            const data = await (await (await src.getFileHandle(n)).getFile()).text();
            const out = await (await dst.getFileHandle(n, { create: true })).createWritable();
            await out.write(data);
            await out.close();
          }
        }
      }
      this.dir = t.dir;
      this.knownModified = (await fh.getFile()).lastModified;
      await idbSet('dir', t.dir);
    }

    /** Muss aus einer Benutzeraktion (Klick) heraus aufgerufen werden. */
    async ensurePermission() {
      const opts = { mode: 'readwrite' };
      if ((await this.dir.queryPermission(opts)) === 'granted') return true;
      return (await this.dir.requestPermission(opts)) === 'granted';
    }

    async exists() {
      try {
        await this.dir.getFileHandle(DB_FILE);
        return true;
      } catch (e) {
        return false;
      }
    }

    async read() {
      const fh = await this.dir.getFileHandle(DB_FILE);
      const file = await fh.getFile();
      this.knownModified = file.lastModified;
      return JSON.parse(await file.text());
    }

    /** Wurde die Datei seit dem letzten Lesen/Schreiben von außen geändert? */
    async changedExternally() {
      if (this.knownModified === null) return false;
      try {
        const fh = await this.dir.getFileHandle(DB_FILE);
        const file = await fh.getFile();
        return file.lastModified !== this.knownModified;
      } catch (e) {
        return false;
      }
    }

    async write(obj, { force = false, backupEveryMin = 10, keepBackups = 10 } = {}) {
      if (!force && (await this.changedExternally())) {
        throw new ConflictError('Die Datenbank wurde inzwischen von einem anderen Gerät geändert.');
      }
      const fh = await this.dir.getFileHandle(DB_FILE, { create: true });
      // Vor dem Überschreiben ggf. die alte Version sichern
      if (Date.now() - this.lastBackup > backupEveryMin * 60000) {
        try {
          const old = await fh.getFile();
          if (old.size > 0) {
            await this.writeBackup(await old.text(), keepBackups);
            this.lastBackup = Date.now();
          }
        } catch (e) {
          console.warn('Sicherung fehlgeschlagen', e);
        }
      }
      const w = await fh.createWritable();
      await w.write(JSON.stringify(obj));
      await w.close();
      this.knownModified = (await fh.getFile()).lastModified;
    }

    async writeBackup(text, keep) {
      const bdir = await this.dir.getDirectoryHandle(BACKUP_DIR, { create: true });
      const name = `notenmanager_${stamp(new Date())}.nmdb`;
      const fh = await bdir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      const names = [];
      for await (const [n, h] of bdir.entries()) {
        if (h.kind === 'file' && /^notenmanager_.*\.nmdb$/.test(n)) names.push(n);
      }
      names.sort();
      while (names.length > keep) await bdir.removeEntry(names.shift());
    }

    async backupNow(obj, keep) {
      await this.writeBackup(JSON.stringify(obj), keep);
      this.lastBackup = Date.now();
    }

    async listBackups() {
      const out = [];
      try {
        const bdir = await this.dir.getDirectoryHandle(BACKUP_DIR);
        for await (const [n, h] of bdir.entries()) if (h.kind === 'file' && n.endsWith('.nmdb')) out.push(n);
      } catch (e) { /* noch keine Sicherungen */ }
      return out.sort().reverse();
    }

    async readBackup(name) {
      const bdir = await this.dir.getDirectoryHandle(BACKUP_DIR);
      const fh = await bdir.getFileHandle(name);
      return JSON.parse(await (await fh.getFile()).text());
    }

    /** Synology legt bei Konflikten Kopien wie "notenmanager_…_Conflict.nmdb" an. */
    async findConflicts() {
      const out = [];
      for await (const [n, h] of this.dir.entries()) {
        if (h.kind === 'file' && n !== DB_FILE && /^notenmanager/i.test(n) && /conflict|konflikt/i.test(n)) out.push(n);
      }
      return out;
    }

    async readLock() {
      try {
        const fh = await this.dir.getFileHandle(LOCK_FILE);
        return JSON.parse(await (await fh.getFile()).text());
      } catch (e) {
        return null;
      }
    }

    /** Lock eines anderen Geräts, das nicht veraltet ist? */
    async foreignLock() {
      const l = await this.readLock();
      if (!l || l.deviceId === deviceId()) return null;
      if (Date.now() - new Date(l.heartbeat).getTime() > LOCK_STALE_MIN * 60000) return null;
      return l;
    }

    async writeLock(since) {
      const now = new Date().toISOString();
      const fh = await this.dir.getFileHandle(LOCK_FILE, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify({ deviceId: deviceId(), device: deviceName(), since: since || now, heartbeat: now }));
      await w.close();
    }

    async releaseLock() {
      const l = await this.readLock();
      if (l && l.deviceId === deviceId()) {
        try { await this.dir.removeEntry(LOCK_FILE); } catch (e) { /* egal */ }
      }
    }
  }

  // ---------- Startprogramm (launcher/) ----------

  /** Läuft die App über das Startprogramm? (Antwort von /api/alive) */
  async function detectServer() {
    if (!/^https?:$/.test(location.protocol)) return false;
    try {
      const r = await fetch('/api/alive', { cache: 'no-store', credentials: 'same-origin' });
      return r.ok && (await r.json()).ok === true;
    } catch (e) {
      return false;
    }
  }

  async function api(path, { method = 'GET', body, headers = {}, keepalive = false } = {}) {
    const h = Object.assign({ 'X-OrdoNota': '1' }, headers);
    const r = await fetch('/api/' + path, { method, body, headers: h, cache: 'no-store', credentials: 'same-origin', keepalive });
    if (r.status === 409) {
      const e = await r.json().catch(() => ({}));
      if (e.error === 'conflict') throw new ConflictError('Die Datenbank wurde inzwischen von einem anderen Gerät geändert.');
      if (e.error === 'nofolder') throw new Error('Kein Datenordner gewählt.');
    }
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      const err = new Error(e.error || 'Startprogramm antwortet nicht (' + r.status + ').');
      err.status = r.status;
      throw err;
    }
    return r;
  }

  /** Zugriff auf den Datenordner über das Startprogramm. Gleiche Schnittstelle wie FolderStore. */
  class ServerStore {
    constructor(info) {
      this.name = info.name;
      this.path = info.dataDir;
      this.knownModified = null;
      this.lastBackup = 0;
      // Lebenszeichen: Das Startprogramm beendet sich, wenn das Fenster zu ist
      if (!ServerStore.ping) ServerStore.ping = setInterval(() => fetch('/api/alive', { cache: 'no-store' }).catch(() => {}), 5000);
    }

    static async remembered() {
      const info = await (await api('info')).json();
      return info.dataDir ? new ServerStore(info) : null;
    }

    static async pick() {
      const path = await ServerStore.pickPath();
      const info = await (await api('folder', { method: 'POST', body: JSON.stringify({ path }) })).json();
      return new ServerStore(info);
    }

    /** Ordner-Dialog des Systems; ohne Dialog (z. B. Linux ohne zenity) Pfad eingeben. */
    static async pickPath() {
      const r = await (await api('pick', { method: 'POST' })).json();
      let path = r.path;
      if (r.cancel) throw Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
      if (!path) {
        path = await NM.util.promptDialog('Datenordner', 'Vollständiger Pfad des Datenordners (z. B. im Synology-Drive-Ordner):', '');
        if (!path) throw Object.assign(new Error('abgebrochen'), { name: 'AbortError' });
      }
      return path;
    }

    /** Neuen Datenordner wählen (noch nicht übernehmen): { path, name, hasDb, same } */
    async pickTarget() {
      const path = await ServerStore.pickPath();
      return (await api('probe', { method: 'POST', body: JSON.stringify({ path }) })).json();
    }

    static async useTarget(t) {
      return new ServerStore(await (await api('folder', { method: 'POST', body: JSON.stringify({ path: t.path }) })).json());
    }

    async moveTo(t, { backups = false } = {}) {
      const r = await (await api('move', { method: 'POST', body: JSON.stringify({ path: t.path, backups }) })).json();
      this.name = r.name;
      this.path = r.dataDir;
      this.knownModified = r.modified;
    }

    async ensurePermission() {
      return true;
    }

    async exists() {
      return (await (await api('db/stat')).json()).exists;
    }

    async read() {
      const r = await api('db');
      this.knownModified = r.headers.get('X-Modified');
      return JSON.parse(await r.text());
    }

    async changedExternally() {
      if (this.knownModified === null) return false;
      try {
        const st = await (await api('db/stat')).json();
        return st.exists && st.modified !== this.knownModified;
      } catch (e) {
        return false;
      }
    }

    async write(obj, { force = false, backupEveryMin = 10, keepBackups = 10 } = {}) {
      const backup = Date.now() - this.lastBackup > backupEveryMin * 60000;
      const headers = { 'Content-Type': 'application/json', 'X-Expect': this.knownModified || '', 'X-Force': force ? '1' : '0', 'X-Backup-Keep': backup ? String(keepBackups) : '0' };
      const r = await (await api('db', { method: 'PUT', body: JSON.stringify(obj), headers })).json();
      if (backup) this.lastBackup = Date.now();
      this.knownModified = r.modified;
    }

    async backupNow(obj, keep) {
      await api('backups', { method: 'POST', body: JSON.stringify(obj), headers: { 'Content-Type': 'application/json', 'X-Backup-Keep': String(keep) } });
      this.lastBackup = Date.now();
    }

    async listBackups() {
      return (await api('backups')).json();
    }

    async readBackup(name) {
      return (await api('backups/' + encodeURIComponent(name))).json();
    }

    async findConflicts() {
      return (await api('conflicts')).json();
    }

    async readLock() {
      try {
        return await (await api('lock')).json();
      } catch (e) {
        return null;
      }
    }

    async foreignLock() {
      const l = await this.readLock();
      if (!l || l.deviceId === deviceId()) return null;
      if (Date.now() - new Date(l.heartbeat).getTime() > LOCK_STALE_MIN * 60000) return null;
      return l;
    }

    async writeLock(since) {
      const now = new Date().toISOString();
      await api('lock', { method: 'PUT', body: JSON.stringify({ deviceId: deviceId(), device: deviceName(), since: since || now, heartbeat: now }), headers: { 'Content-Type': 'application/json' } });
    }

    /** keepalive: Die Anfrage geht auch beim Schließen des Fensters noch raus. */
    async releaseLock() {
      const l = await this.readLock();
      if (l && l.deviceId === deviceId()) await api('lock', { method: 'DELETE', keepalive: true }).catch(() => {});
    }
  }

  /** Speicher im Arbeitsspeicher – nur für die Demo (index.html?demo). */
  class MemoryStore {
    constructor() {
      this.obj = null;
      this.name = 'Demo (nicht gespeichert)';
    }
    async ensurePermission() { return true; }
    async exists() { return !!this.obj; }
    async read() { return JSON.parse(JSON.stringify(this.obj)); }
    async changedExternally() { return false; }
    async write(obj) { this.obj = JSON.parse(JSON.stringify(obj)); }
    async backupNow() {}
    async listBackups() { return []; }
    async findConflicts() { return []; }
    async foreignLock() { return null; }
    async writeLock() {}
    async releaseLock() {}
  }

  NM.storage = {
    FolderStore,
    ServerStore,
    MemoryStore,
    detectServer,
    ConflictError,
    supported,
    deviceId,
    deviceName,
    setDeviceName,
    DB_FILE,
    BACKUP_DIR,
  };
})((globalThis.NM = globalThis.NM || {}));
