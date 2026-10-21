/* OrdoNota – Verschlüsselung (WebCrypto).
 *
 * Aufbau der Datei:
 *   Ein zufälliger Datenschlüssel (AES-256-GCM) verschlüsselt die Daten.
 *   Der Datenschlüssel ist zweimal "eingepackt":
 *     1. mit einem Schlüssel aus dem Passwort (PBKDF2-SHA256, 600 000 Runden)
 *     2. mit einem Schlüssel aus dem Wiederherstellungsschlüssel
 *   So lässt sich das Passwort ändern oder per Wiederherstellungsschlüssel
 *   zurücksetzen, ohne die Daten neu zu verschlüsseln.
 */
(function (NM) {
  'use strict';

  const PW_ITER = 600000;
  const REC_ITER = 100000;
  const FORMAT = 'notenmanager-db';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const b64 = (buf) => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriveKey(secret, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function aesEncrypt(key, bytes) {
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    return { iv: b64(iv), ct: b64(ct) };
  }

  async function aesDecrypt(key, box) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return new Uint8Array(pt);
  }

  async function importDataKey(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // Wiederherstellungsschlüssel: 20 Zufallsbytes in Base32, Gruppen zu 4 Zeichen
  const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I, O, 0, 1 (Verwechslungsgefahr)
  function makeRecoveryKey() {
    const bytes = rand(20);
    let bits = '';
    for (const b of bytes) bits += b.toString(2).padStart(8, '0');
    let out = '';
    for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
    return out.match(/.{4}/g).join('-');
  }
  function normalizeRecoveryKey(s) {
    return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Hält den entsperrten Datenschlüssel im Speicher.
   * `header` enthält die eingepackten Schlüssel (ohne Daten).
   */
  class Vault {
    constructor(dataKey, rawKey, header) {
      this.dataKey = dataKey;
      this.rawKey = rawKey;
      this.header = header;
    }

    /** Neue Datenbank: liefert Vault und Wiederherstellungsschlüssel. */
    static async create(password) {
      const raw = rand(32);
      const recoveryKey = makeRecoveryKey();
      const vault = new Vault(await importDataKey(raw), raw, {});
      await vault.setPassword(password);
      await vault.setRecoveryKey(recoveryKey);
      return { vault, recoveryKey };
    }

    static async unlock(fileObj, password) {
      check(fileObj);
      const k = await deriveKey(password, unb64(fileObj.pw.salt), fileObj.pw.iter);
      let raw;
      try {
        raw = await aesDecrypt(k, fileObj.pw);
      } catch (e) {
        throw new Error('Falsches Passwort.');
      }
      return new Vault(await importDataKey(raw), raw, { pw: fileObj.pw, rec: fileObj.rec });
    }

    static async unlockWithRecovery(fileObj, recoveryKey) {
      check(fileObj);
      const k = await deriveKey(normalizeRecoveryKey(recoveryKey), unb64(fileObj.rec.salt), fileObj.rec.iter);
      let raw;
      try {
        raw = await aesDecrypt(k, fileObj.rec);
      } catch (e) {
        throw new Error('Wiederherstellungsschlüssel ist nicht korrekt.');
      }
      return new Vault(await importDataKey(raw), raw, { pw: fileObj.pw, rec: fileObj.rec });
    }

    async setPassword(password) {
      const salt = rand(16);
      const k = await deriveKey(password, salt, PW_ITER);
      const box = await aesEncrypt(k, this.rawKey);
      this.header.pw = Object.assign({ salt: b64(salt), iter: PW_ITER }, box);
    }

    async setRecoveryKey(recoveryKey) {
      const salt = rand(16);
      const k = await deriveKey(normalizeRecoveryKey(recoveryKey), salt, REC_ITER);
      const box = await aesEncrypt(k, this.rawKey);
      this.header.rec = Object.assign({ salt: b64(salt), iter: REC_ITER }, box);
    }

    async verifyPassword(fileObjOrHeader, password) {
      try {
        const pw = fileObjOrHeader.pw;
        const k = await deriveKey(password, unb64(pw.salt), pw.iter);
        await aesDecrypt(k, pw);
        return true;
      } catch (e) {
        return false;
      }
    }

    /** Daten (Objekt) verschlüsseln → Dateiobjekt. */
    async seal(data, meta) {
      const json = enc.encode(JSON.stringify(data));
      const box = await aesEncrypt(this.dataKey, json);
      return Object.assign(
        { format: FORMAT, version: 1, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256' },
        meta || {},
        { pw: this.header.pw, rec: this.header.rec, data: box }
      );
    }

    async open(fileObj) {
      check(fileObj);
      const pt = await aesDecrypt(this.dataKey, fileObj.data);
      return JSON.parse(dec.decode(pt));
    }

    wipe() {
      if (this.rawKey) this.rawKey.fill(0);
      this.rawKey = null;
      this.dataKey = null;
    }
  }

  function check(fileObj) {
    if (!fileObj || fileObj.format !== FORMAT) throw new Error('Diese Datei ist keine OrdoNota-Datenbank.');
    if (fileObj.version > 1) throw new Error('Die Datenbank stammt aus einer neueren Version von OrdoNota.');
  }

  NM.crypto = { Vault, makeRecoveryKey, normalizeRecoveryKey };
})((globalThis.NM = globalThis.NM || {}));
