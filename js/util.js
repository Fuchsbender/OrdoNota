/* Notenmanager – kleine DOM- und Format-Helfer. */
(function (NM) {
  'use strict';

  /** h('div', {class: 'x', onclick: fn}, 'Text', child, [kinder]) */
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'selected') el.selected = !!v;
        else if (k === 'html') el.innerHTML = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    }
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fmtNum(x, digits = 2) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    return Number(x).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** Zahl kompakt: 12 → "12", 12.5 → "12,5" */
  function fmtScore(x) {
    if (x === null || x === undefined || x === '' || Number.isNaN(Number(x))) return '';
    return Number(x).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  function parseNum(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    return d && m && y ? `${d}.${m}.${y}` : iso;
  }
  function fmtDateShort(iso) {
    if (!iso) return '';
    const [, m, d] = String(iso).split('-');
    return d && m ? `${d}.${m}.` : iso;
  }

  function todayISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  /** Farbe für Punkte 0–15 (rot → grün). */
  function gradeStyle(p) {
    if (p === null || p === undefined) return null;
    const hue = Math.round((Math.max(0, Math.min(15, p)) / 15) * 125);
    return `--g-hue:${hue}`;
  }

  // ---------- Toast ----------

  function toast(msg, type = 'info', ms = 3500) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = h('div', { id: 'toasts' });
      document.body.appendChild(host);
    }
    const t = h('div', { class: `toast toast-${type}`, role: 'status' }, msg);
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  // ---------- Dialoge ----------

  /**
   * modal({title, body, buttons:[{label, value, kind:'primary'|'danger'}], onOpen})
   * Liefert Promise mit dem value des gedrückten Buttons (oder null bei Esc).
   * Buttons mit validate: () => true|false verhindern das Schließen.
   */
  function modal({ title, body, buttons, wide = false, onOpen }) {
    return new Promise((resolve) => {
      const dlg = h('dialog', { class: 'modal' + (wide ? ' modal-wide' : '') });
      const form = h('form', { method: 'dialog' });
      const footer = h('div', { class: 'modal-actions' });
      for (const b of buttons || [{ label: 'OK', value: true, kind: 'primary' }]) {
        footer.appendChild(
          h(
            'button',
            {
              type: b.kind === 'primary' ? 'submit' : 'button',
              class: 'btn ' + (b.kind ? 'btn-' + b.kind : ''),
              onclick: (e) => {
                e.preventDefault();
                if (b.validate && !b.validate()) return;
                done(b.value);
              },
            },
            b.label
          )
        );
      }
      form.append(h('h2', null, title), h('div', { class: 'modal-body' }, body), footer);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const primary = (buttons || []).find((b) => b.kind === 'primary') || { value: true };
        if (primary.validate && !primary.validate()) return;
        done(primary.value);
      });
      dlg.appendChild(form);
      dlg.addEventListener('cancel', (e) => {
        e.preventDefault();
        done(null);
      });
      let closed = false;
      function done(v) {
        if (closed) return;
        closed = true;
        dlg.close();
        dlg.remove();
        resolve(v);
      }
      document.body.appendChild(dlg);
      dlg.showModal();
      const first = dlg.querySelector('input, select, textarea');
      if (first) first.focus();
      if (onOpen) onOpen(dlg);
    });
  }

  async function confirmDialog(title, text, { okLabel = 'OK', danger = false } = {}) {
    const v = await modal({
      title,
      body: h('p', null, text),
      buttons: [
        { label: 'Abbrechen', value: false },
        { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' },
      ],
    });
    return v === true;
  }

  async function promptDialog(title, labelText, value = '', { type = 'text' } = {}) {
    const input = h('input', { type, value, class: 'input' });
    const v = await modal({
      title,
      body: h('label', { class: 'field' }, h('span', null, labelText), input),
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'OK', value: 'ok', kind: 'primary' },
      ],
    });
    return v === 'ok' ? input.value : null;
  }

  // ---------- Download ----------

  function download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const a = h('a', { href: URL.createObjectURL(blob), download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  /** CSV mit Semikolon und BOM, damit deutsches Excel es direkt öffnet. */
  function csv(rows) {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
  }

  function safeFilename(s) {
    return String(s).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
  }

  NM.util = {
    h,
    clear,
    uid,
    fmtNum,
    fmtScore,
    parseNum,
    fmtDate,
    fmtDateShort,
    todayISO,
    fmtTime,
    gradeStyle,
    toast,
    modal,
    confirmDialog,
    promptDialog,
    download,
    csv,
    safeFilename,
  };
})((globalThis.NM = globalThis.NM || {}));
