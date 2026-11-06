// Erzeugt die Prüfstücke in tests/altdaten/ aus früheren App-Versionen (Git-Verlauf).
// Für jede Version: Demo-Datenbank jener Version (so wie sie sie gespeichert hätte) und die
// damals gerechneten Halbjahres- und Jahresnoten. model.test.html prüft, dass die aktuelle
// App diese Datenbanken öffnet und dieselben Noten rechnet.
//
// Aufruf (nur nötig, wenn eine Version dazukommen soll), im Programmordner:
//   deno run --allow-run=git --allow-write=tests/altdaten tests/altdaten/erzeugen.js
// Die Demo-Daten enthalten nur erfundene Namen.

const VERSIONEN = ['21c7e0a', 'e77a719', 'd88ff03', '8691f35', '69cf1a1', '892c061', 'c6a6225', 'bf5567e', '1a0498a'];

async function gitShow(commit, file) {
  const out = await new Deno.Command('git', { args: ['show', `${commit}:${file}`], stdout: 'piped', stderr: 'null' }).output();
  if (!out.success) return null;
  return new TextDecoder().decode(out.stdout);
}

const liste = [];
for (const commit of VERSIONEN) {
  const NM = {};
  globalThis.NM = NM;
  for (const f of ['js/util.js', 'js/grades.js', 'js/groups.js', 'js/model.js']) {
    const src = await gitShow(commit, f);
    if (src) new Function(src)();
  }
  const M = NM.model, G = NM.grades;
  const db = M.demoDb();
  // Typische Eingriffe von Hand: gesetzte Note mit Begründung, Bemerkung
  const c0 = db.courses[0], s0 = c0.students[0];
  const h1 = G.halvesFor(c0)[0];
  c0.overrides = c0.overrides || {};
  c0.overrides[h1] = Object.assign(c0.overrides[h1] || {}, { [s0.id]: { p: 9, reason: 'Prüfstück' } });
  c0.comments = Object.assign(c0.comments || {}, { [s0.id]: 'Bemerkung aus Version ' + M.APP_VERSION });
  // So hätte die App gespeichert
  db.schema = M.SCHEMA;
  db.savedWith = M.APP_VERSION;
  db.savedAt = '2026-01-01T00:00:00.000Z';
  const noten = {};
  for (const c of db.courses) {
    const nc = (noten[c.id] = {});
    for (const s of c.students) {
      const ns = (nc[s.id] = {});
      for (const h of G.halvesFor(c)) {
        const r = G.halfResult(c, h, s.id);
        ns[h] = [r.raw === null ? null : Math.round(r.raw * 1e6) / 1e6, r.final];
      }
      if (!G.hasYearGrade || G.hasYearGrade(c)) {
        const y = G.yearResult(c, s.id);
        ns.Jahr = [y.raw === null ? null : Math.round(y.raw * 1e6) / 1e6, y.final];
      }
    }
  }
  // Als Skript statt JSON, damit die Testseite die Dateien auch per file:// laden kann
  const name = `v${M.APP_VERSION}.js`;
  await Deno.writeTextFile(`tests/altdaten/${name}`, '// erzeugt von erzeugen.js – Demo-Datenbank und Noten von OrdoNota ' + M.APP_VERSION + '\n(globalThis.ALTDATEN = globalThis.ALTDATEN || []).push(' + JSON.stringify({ version: M.APP_VERSION, schema: M.SCHEMA, commit, db, noten }) + ');\n');
  liste.push(name);
  console.log(name, 'Schema', M.SCHEMA, 'Kurse', db.courses.length);
}
console.log('In tests/model.test.html einbinden:', liste.join(' '));
