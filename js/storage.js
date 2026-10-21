/* OrdoNota – Dateizugriff auf den (Synology-Drive-)Ordner.
 *
 * Im gewählten Ordner liegen:
 *   notenmanager.nmdb          verschlüsselte Datenbank
 *   notenmanager.lock.json     Hinweis, auf welchem Gerät die App gerade offen ist
 *   Sicherungen/               rollierende Sicherungskopien
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
    MemoryStore,
    ConflictError,
    supported,
    deviceId,
    deviceName,
    setDeviceName,
    DB_FILE,
    BACKUP_DIR,
  };
})((globalThis.NM = globalThis.NM || {}));
