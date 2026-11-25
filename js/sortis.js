/* OrdoNota – Export „Für OrdoSortis“ (rein, ohne DOM): Personen eines Kurses als CSV.
 * Format laut ../OrdoSortis/docs/KONZEPT.md Abschnitt 7.1 (nur nach Absprache in beiden Apps ändern):
 * Semikolon, UTF-8 ohne BOM, Zeilenende \n, Kopfzeile person_id;nachname;vorname;klasse;schuljahr;email.
 * Schlüssel ist people[].id. Nie dabei: Noten, Notizen, Nachteilsausgleiche, Förderplan, Fotos, I-Status. */
(function (NM) {
  'use strict';

  const HEADER = ['person_id', 'nachname', 'vorname', 'klasse', 'schuljahr', 'email'];

  /** Feld in Anführungszeichen, wenn es ; " oder einen Zeilenumbruch enthält (eigene Maskierung: NM.util.csv setzt BOM und \r\n). */
  function esc(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /**
   * CSV für OrdoSortis: aktive Kurseinträge, Namen aus dem Personenregister, sortiert nach Nachname, Vorname.
   * `heute` (JJJJ-MM-TT) nur für Tests, sonst das heutige Datum. Liefert { name, text }.
   */
  function exportCsv(db, course, heute) {
    const year = (db.years || []).find((y) => y.id === course.yearId);
    const byId = new Map((db.people || []).map((p) => [p.id, p]));
    const rows = [];
    for (const s of course.students || []) {
      if (s.active === false) continue;
      const p = byId.get(s.personId);
      if (!p) continue;
      rows.push({ id: p.id, last: p.last || '', first: p.first || '', email: s.email || '' });
    }
    rows.sort((a, b) => a.last.localeCompare(b.last, 'de') || a.first.localeCompare(b.first, 'de'));
    const lines = [HEADER.join(';')];
    for (const r of rows) lines.push([r.id, r.last, r.first, course.klasse || '', year ? year.name : '', r.email].map(esc).join(';'));
    const day = heute || NM.util.todayISO();
    return { name: `ordosortis_personen_${NM.util.safeFilename(course.klasse || 'Kurs')}_${day}.csv`, text: lines.join('\n') + '\n' };
  }

  NM.sortis = { HEADER, exportCsv };
})((globalThis.NM = globalThis.NM || {}));
