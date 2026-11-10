#!/usr/bin/env python3
"""Führt alle automatischen Tests von OrdoNota in einem unsichtbaren Chromium-Browser aus.

Aufruf (im Programmordner):
    uv run --with websocket-client --with cryptography python tests/run_tests.py
  oder nach  pip install websocket-client cryptography :
    python3 tests/run_tests.py

Geprüft werden:
  1. Notenlogik, Datenmodell, Verschlüsselung, Speicher (die tests/*.test.html-Seiten)
  2. Start der App im Demo-Modus und alle Reiter ohne JavaScript-Fehler
  3. Das Notfallwerkzeug tools/entschluesseln.py gegen eine von der App verschlüsselte Datenbank
  4. Das Startprogramm launcher/ (Go-Tests und echter Server; übersprungen, wenn Go fehlt)

Ergebnis: Exit-Code 0, wenn alles bestanden ist.
"""
import base64
import functools
import http.server
import importlib.util
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BROWSERS = [
    "thorium-browser", "chromium", "chromium-browser", "google-chrome", "google-chrome-stable",
    "microsoft-edge", "microsoft-edge-stable", "brave-browser", "brave",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

try:
    import websocket
except ImportError:
    sys.exit('Das Python-Paket "websocket-client" fehlt: pip install websocket-client')


def find_browser():
    for b in BROWSERS:
        p = shutil.which(b) or (b if os.path.isfile(b) else None)
        if p:
            return p
    sys.exit("Kein Chromium-Browser gefunden (Chrome, Edge, Chromium, Brave oder Thorium).")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Browser:
    """Minimaler Chrome-DevTools-Treiber."""

    def __init__(self):
        self.port = free_port()
        self.profile = tempfile.mkdtemp(prefix="nm-test-")
        self.proc = subprocess.Popen(
            [find_browser(), "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
             f"--remote-debugging-port={self.port}", "--remote-allow-origins=*",
             f"--user-data-dir={self.profile}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json"))
                page = next(t for t in tabs if t["type"] == "page")
                break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("Browser startet nicht.")
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=180, suppress_origin=True)
        self.mid = 0
        self.errors = []
        self.call("Runtime.enable")
        self.call("Page.enable")

    def call(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("method") == "Runtime.exceptionThrown":
                d = msg["params"]["exceptionDetails"]
                self.errors.append((d.get("exception") or {}).get("description") or d.get("text"))
            if msg.get("id") == self.mid:
                return msg

    def open(self, url):
        self.errors = []
        self.call("Page.navigate", url=url)
        time.sleep(0.5)

    def eval(self, expr):
        r = self.call("Runtime.evaluate", expression=f"eval({json.dumps(expr)})", awaitPromise=True, returnByValue=True)
        res = r.get("result", {})
        if "exceptionDetails" in res:
            raise RuntimeError(res["exceptionDetails"].get("exception", {}).get("description", "JS-Fehler"))
        return res.get("result", {}).get("value")

    def wait(self, expr, timeout=120):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                if self.eval(expr):
                    return True
            except RuntimeError:
                pass
            time.sleep(0.2)
        return False

    def close(self):
        try:
            self.ws.close()
        finally:
            self.proc.terminate()
            try:
                self.proc.wait(5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
            shutil.rmtree(self.profile, ignore_errors=True)


def serve():
    port = free_port()
    handler = functools.partial(QuietHandler, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{port}"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


results = []


def report(name, ok, detail=""):
    results.append(ok)
    print(("  OK    " if ok else "  FEHL  ") + name + (f"  → {detail}" if detail and not ok else ""))


def run_test_pages(br, base):
    print("Testseiten:")
    for page in ["grades", "model", "attendance", "update", "moodle", "qr", "pomodoro", "groups", "random", "timer", "draw", "crypto", "storage"]:
        br.open(f"{base}/tests/{page}.test.html")
        done = br.wait("/^(ALLE TESTS BESTANDEN|\\d+ FEHLGESCHLAGEN|FEHLER)/.test(document.getElementById('out').textContent)")
        text = br.eval("document.getElementById('out').textContent") or ""
        first = text.split("\n")[0]
        ok = done and first == "ALLE TESTS BESTANDEN" and not br.errors
        fails = [l for l in text.split("\n") if l.startswith("FAIL")]
        report(f"{page}.test.html  ({first or 'keine Ausgabe'})", ok, "; ".join(fails + br.errors)[:500])


def run_app_smoke(br, base):
    print("App (Demo-Modus):")
    br.open(f"{base}/index.html?demo")
    report("App startet", br.wait("!!document.querySelector('.overview-table')", 30), "; ".join(br.errors))
    for tab in ["course", "tests", "epo", "pres", "draw", "random", "overview", "settings"]:
        for course in [0, 1]:
            br.eval(f"NM.app.select({{courseId: NM.app.db().courses[{course}].id, tab: '{tab}'}}); 1")
            time.sleep(0.15)
            n = br.eval("document.getElementById('view').children.length")
            stray = br.eval("[...document.getElementById('view').childNodes].some((x) => x.nodeType === 3 && /null|undefined/.test(x.textContent))")
            report(f"Reiter {tab} (Kurs {course + 1})", bool(n) and not stray and not br.errors, "; ".join(br.errors) + (" ; Text „null“ im Reiter" if stray else ""))
            br.errors = []


def run_old_db_check(br, base):
    print("Alte Datenbanken (tests/altdaten) in der App:")
    import glob, os
    files = sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "altdaten", "v*.js")),
                   key=lambda f: [int(x) for x in os.path.basename(f)[1:-3].split(".")])
    for f in files:
        name = os.path.basename(f)
        br.open(f"{base}/index.html?demo")
        br.wait("!!document.querySelector('.overview-table')", 30)
        br.errors = []
        res = br.eval("""(async () => {
            const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
            globalThis.ALTDATEN = [];
            await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'tests/altdaten/%s'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
            const fx = ALTDATEN[0];
            NM.app.state.db = NM.model.migrate(JSON.parse(JSON.stringify(fx.db)));
            const db = NM.app.db(), bad = [];
            const fehler = NM.model.check(db).filter((p) => p.level === 'fehler').length;
            for (const c of db.courses) {
                for (const tab of ['course', 'tests', 'epo', 'pres', 'draw', 'random', 'groups', 'overview', 'seating', 'settings']) {
                    NM.app.select({ yearId: c.yearId, courseId: c.id, tab }); await wait();
                    const v = document.getElementById('view');
                    const stray = [...v.childNodes].some((x) => x.nodeType === 3 && /null|undefined|NaN/.test(x.textContent))
                        || /\\bNaN\\b|undefined/.test(v.textContent);
                    if (!v.children.length || stray) bad.push(c.klasse + '/' + tab);
                }
                if (NM.grades.hasYearGrade(c)) {
                    NM.app.setHalf(c, 'Jahr'); NM.app.select({ tab: 'overview' }); await wait();
                    if (!document.querySelector('#view table') || /\\bNaN\\b|undefined/.test(document.getElementById('view').textContent)) bad.push(c.klasse + '/Jahr');
                }
            }
            // Dialog „Datenbank prüfen“ öffnet und meldet keine Probleme
            NM.views.settings.checkDialog(db); await wait();
            const dlg = document.querySelector('dialog.modal');
            const dialogOk = !!dlg && dlg.textContent.includes('Keine Probleme gefunden') && dlg.textContent.includes(NM.model.APP_VERSION);
            if (dlg) dlg.querySelector('.modal-actions button').click();
            return { version: fx.version, fehler, bad, dialogOk }; })()""" % name)
        ok = bool(res) and res["fehler"] == 0 and not res["bad"] and res["dialogOk"] and not br.errors
        report(f"{name}: alle Reiter beider Kurse ohne Fehler, „Datenbank prüfen“ ohne Probleme", ok, str(res) + "; ".join(br.errors)[:500])


def run_sort_check(br, base):
    print("Sortieren nach Spaltenköpfen:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    # Schüler-IDs der Tabellenzeilen in Anzeigereihenfolge (aus dem ersten data-focus-key je Zeile)
    ids = """[...document.querySelectorAll('.grid-table tbody tr:not(.foot)')].map((tr) => {
        const k = tr.querySelector('[data-focus-key]').dataset.focusKey;
        return NM.app.currentCourse().students.find((s) => k.includes(s.id)).id; })"""
    click = "(t) => { const b = [...document.querySelectorAll('thead .sort-btn')].find((x) => x.firstChild.textContent === t); b.click(); return !!b; }"
    cases = [
        ("tests", 0, "Σ", "desc", "(c, s) => { const t = c.assessments.find((a) => a.id === NM.app.state.ui.testId[c.id]) || c.assessments.filter((a) => a.kind === 'test' && a.half === NM.app.currentHalf(c) && !NM.grades.isMakeup(c, a)).pop(); return NM.grades.testResult(t.test, s, NM.grades.courseLevel(c)).score; }"),
        ("tests", 0, "Σ", "asc", None),
        ("epo", 0, "Note", "desc", "(c, s) => { const e = c.assessments.filter((a) => a.kind === 'epo' && a.half === NM.app.currentHalf(c)).pop(); return NM.grades.epoResult(e.epo, s, NM.grades.courseLevel(c)).p; }"),
        ("overview", 0, "Gerechnet", "asc", "(c, s) => NM.grades.halfResult(c, NM.app.currentHalf(c, true), s).raw"),
        ("overview", 1, "Gerechnet", "desc", "(c, s) => NM.grades.halfResult(c, NM.app.currentHalf(c, true), s).raw"),
        ("overview", 0, "Vorname", "asc", "(c, s) => c.students.find((x) => x.id === s).first"),
    ]
    getter = None
    for tab, course, label, direction, g in cases:
        getter = g or getter
        br.errors = []
        try:
            if g:
                br.eval(f"NM.app.state.ui.sort = {{}}; NM.app.select({{courseId: NM.app.db().courses[{course}].id, tab: '{tab}'}}); 1")
                time.sleep(0.2)
            br.eval(f"({click})({json.dumps(label)})")
            time.sleep(0.2)
            ok = br.eval(f"""(() => {{ const c = NM.app.currentCourse(); const get = {getter};
                const vals = ({ids}).map((s) => {{ const v = get(c, s); return v === '' ? null : v; }});
                const cmp = (x, y) => (typeof x === 'string' ? x.localeCompare(y, 'de') : x - y);
                const v = vals.filter((x) => x !== null && x !== undefined);
                return new Set(v).size > 1 && vals.slice(v.length).every((x) => x === null || x === undefined)
                    && v.every((x, i) => !i || ('{direction}' === 'asc' ? cmp(v[i - 1], x) <= 0 : cmp(v[i - 1], x) >= 0)); }})()""")
        except RuntimeError as e:
            ok, br.errors = False, br.errors + [str(e)]
        report(f"{tab} (Kurs {course + 1}) nach „{label}“ {'auf' if direction == 'asc' else 'ab'}steigend", bool(ok) and not br.errors, "; ".join(br.errors))


def run_course_check(br, base):
    print("Kurs & Schüler (Excel-Export, Kurs löschen), EPO-Fotos:")
    import base64, io, zipfile
    import xml.etree.ElementTree as ET
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    # Excel-Datei so erzeugen wie der Knopf, aber als Base64 zurückgeben statt herunterladen
    b64 = br.eval("""(async () => {
        const c = NM.app.db().courses[0];
        c.students.push({ id: 'x1', last: 'Özdemir & <Test>', first: 'Zoë', active: false, iStatus: true });
        let blob = null;
        const origUrl = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
        URL.createObjectURL = (b) => { blob = b; return 'about:blank'; };
        HTMLAnchorElement.prototype.click = function () {};   // nicht wirklich herunterladen
        try { NM.app.select({ courseId: c.id, tab: 'course' }); await new Promise((r) => setTimeout(r, 100));
              [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Excel')).click(); }
        finally { URL.createObjectURL = origUrl; HTMLAnchorElement.prototype.click = origClick; }
        const buf = new Uint8Array(await blob.arrayBuffer());
        let s = ''; for (const x of buf) s += String.fromCharCode(x);
        return btoa(s); })()""")
    ok, detail = False, ""
    try:
        z = zipfile.ZipFile(io.BytesIO(base64.b64decode(b64)))
        bad = z.testzip()
        for n in z.namelist():
            ET.fromstring(z.read(n))
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        rows = []
        for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iterfind(".//m:row", ns):
            rows.append(["".join(c.itertext()) for c in r.iterfind("m:c", ns)])
        ok = (bad is None and rows[0] == ["Nr.", "Nachname", "Vorname", "I-Status", "Aktiv"]
              and rows[1][0] == "1" and rows[-1] == ["Özdemir & <Test>", "Zoë", "ja", "nein"] and len(rows) == 14)
        detail = f"{len(rows)} Zeilen, letzte: {rows[-1]}"
    except Exception as e:
        detail = repr(e)
    report("Schülerliste als .xlsx (ZIP, XML, Umlaute/Sonderzeichen, Kopfzeile)", ok and not br.errors, detail + "; ".join(br.errors))

    # Kurs löschen: nur mit „LÖSCHEN“
    br.errors = []
    res = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 100));
        const n0 = NM.app.db().courses.length;
        const open = async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Kurs löschen').click(); await wait();
            return [document.querySelector('dialog .input'), document.querySelector('dialog .btn-danger')]; };
        const type = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input')); };
        let [inp, btn] = await open();
        const out = { disabledEmpty: btn.disabled };
        type(inp, 'löschen'); out.disabledLower = btn.disabled;
        inp.form.requestSubmit(); await wait();          // Enter mit falschem Wort
        out.keptAfterWrong = NM.app.db().courses.length === n0;
        [inp, btn] = await open();
        type(inp, 'LÖSCHEN'); out.enabled = !btn.disabled;
        btn.click(); await wait(); await wait();
        out.deleted = NM.app.db().courses.length === n0 - 1;
        return out; })()""")
    report("Kurs löschen: Knopf gesperrt ohne „LÖSCHEN“", bool(res) and res["disabledEmpty"] and res["disabledLower"], str(res))
    report("Kurs löschen: falsches Wort + Enter löscht nicht", bool(res) and res["keptAfterWrong"], str(res))
    report("Kurs löschen: mit „LÖSCHEN“ gelöscht", bool(res) and res["enabled"] and res["deleted"] and not br.errors, str(res) + "; ".join(br.errors))

    # Kursart MSS-Grundkurs bei neuem Kurs (Jahrgang 5) stellt auf MSS um
    br.errors = []
    res5 = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        const db = NM.app.db(); const c = NM.model.newCourse(db.years[0].id, { klasse: 'MSS 13', jahrgang: 5 });
        db.courses.push(c); NM.app.select({ courseId: c.id, tab: 'course' }); await wait();
        const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'gk'));
        sel.value = 'gk'; sel.dispatchEvent(new Event('change')); await wait();
        const out = { gk: [c.type, c.jahrgang, NM.grades.courseLevel(c), Math.round(c.wKa)] };
        sel.value = 'sek1'; sel.dispatchEvent(new Event('change')); await wait();
        out.sek1 = [c.type, c.jahrgang, NM.grades.courseLevel(c)];
        db.courses = db.courses.filter((x) => x.id !== c.id);
        return out; })()""")
    report("Kursart MSS-Grundkurs stellt Jahrgang/Punkteskala um (und zurück)", bool(res5) and res5["gk"] == ["gk", 13, "mss", 33] and res5["sek1"] == ["sek1", 10, "sek1"] and not br.errors, str(res5) + "; ".join(br.errors))

    # EPO: Fotos per Umschalter (frische Demo – der Lösch-Test hat Kurs 1 entfernt)
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        const c = NM.app.db().courses[0];
        delete c.students[0].photo;   // Demo hat für alle ein Symbolfoto – eine Person ohne Foto
        NM.app.state.ui.epoPhotos = false; NM.app.select({ courseId: c.id, tab: 'epo' }); await wait();
        const before = document.querySelectorAll('.epo-table .name-photo').length;
        [...document.querySelectorAll('.quick-toggle')].find((b) => b.textContent.includes('Fotos')).click(); await wait();
        return { before, imgs: document.querySelectorAll('.epo-table img.name-photo:not(.name-photo-empty)').length,
                 empty: document.querySelectorAll('.epo-table .name-photo-empty').length,
                 rows: document.querySelectorAll('.epo-table tbody tr').length }; })()""")
    res2 = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        NM.app.state.ui.seatHidePhotos = false; NM.app.select({ tab: 'seating' }); await wait();
        const shown = document.querySelectorAll('.seat-card img.seat-photo:not(.seat-photo-empty)').length;
        const icons = document.querySelectorAll('.seat-card img.seat-photo-empty').length;
        [...document.querySelectorAll('.quick-toggle')].find((b) => b.textContent.includes('Fotos')).click(); await wait();
        return { shown, icons, hidden: document.querySelectorAll('.seat-card img.seat-photo').length, cards: document.querySelectorAll('.seat-card').length }; })()""")
    # Druck: mit Fotos hat jeder belegte Platz ein Bild (Foto oder Symbol), ausgeblendet keiner
    res3 = br.eval("""(async () => {
        const c = NM.app.currentCourse(); const origPrint = window.print; window.print = () => {};
        try {
            c.seatingPlans[0].pos = {}; NM.views.seating.layout(c).students.forEach((s, i) => (c.seatingPlans[0].pos[s.id] = { x: i % 4, y: Math.floor(i / 4) }));
            const count = () => { NM.print.seating(c); const r = document.getElementById('print-root');
                return [r.querySelectorAll('td.p-seat:not(.empty)').length, r.querySelectorAll('td.p-seat img').length, r.querySelectorAll('img.p-seat-icon').length]; };
            NM.app.state.ui.seatHidePhotos = false; const on = count();
            NM.app.state.ui.seatHidePhotos = true; const off = count();
            return { on, off };
        } finally { window.print = origPrint; } })()""")
    report("Sitzplan-Druck: Platzhalter mit Fotos, nichts ohne Fotos", bool(res3) and res3["on"][0] > 0 and res3["on"][1] == res3["on"][0] and res3["on"][2] == 1 and res3["off"][1] == 0 and not br.errors, str(res3))
    # Raster bearbeiten: + oben verschiebt alle nach unten, − links nimmt Personen aus Spalte 1 vom Plan
    res4 = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        const c = NM.app.currentCourse(); const st = c.seatingPlans[0];
        st.cols = 4; st.rows = 3; st.pos = {};
        const ids = NM.model.activeStudents(c).map((s) => s.id);
        ids.slice(0, 6).forEach((id, i) => (st.pos[id] = { x: i % 3, y: Math.floor(i / 3) }));
        NM.app.state.ui.seatEdit = true; NM.app.rerender(); await wait();
        const btn = (side, label) => document.querySelector('.seat-edge-' + side + ' button:' + (label === '+' ? 'first-child' : 'last-child'));
        const out = { edges: document.querySelectorAll('.seat-edge').length };
        btn('top', '+').click(); await wait();
        out.afterTop = [st.rows, st.pos[ids[0]].y, st.pos[ids[3]].y];
        btn('right', '+').click(); await wait();
        out.afterRight = [st.cols, st.pos[ids[0]].x];
        btn('left', '-').click(); await wait();
        document.querySelector('dialog .btn-primary, dialog .btn-danger').click(); await wait();
        out.afterLeft = [st.cols, Object.keys(st.pos).length, st.pos[ids[1]].x];
        btn('bottom', '-').click(); await wait();   // unterste Reihe ist leer → ohne Rückfrage
        out.afterBottom = [st.rows, !!document.querySelector('dialog')];
        NM.app.state.ui.seatEdit = false;
        return out; })()""")
    report("Sitzplan: Raster an allen Seiten erweitern/verkleinern", bool(res4) and res4["edges"] == 4 and res4["afterTop"] == [4, 1, 2]
           and res4["afterRight"] == [5, 0] and res4["afterLeft"] == [4, 4, 0] and res4["afterBottom"] == [3, False] and not br.errors, str(res4) + "; ".join(br.errors))
    report("Sitzplan: Symbol ohne Foto, Fotos ausblenden", bool(res2) and res2["shown"] > 0 and res2["icons"] == 1 and res2["hidden"] == 0 and res2["cards"] > 0 and not br.errors, str(res2))
    report("EPO: Fotos ein-/ausblenden (Foto bzw. Platzhalter je Person)", bool(res) and res["before"] == 0 and res["empty"] == 1 and res["imgs"] == res["rows"] - 1 and not br.errors, str(res) + "; ".join(br.errors))


def run_epo_material_check(br, base):
    """EPO: Zusatz m (Material vergessen) per Eingabe und Schnellwahl, Spalte M, Punkte-Einstellung, Ausdruck."""
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        const G = NM.grades, M = NM.model;
        const c = NM.app.db().courses[0];
        NM.app.state.ui.epoQuick = true;
        NM.app.select({ courseId: c.id, tab: 'epo' }); await wait();
        const blocks = c.assessments.filter((x) => x.kind === 'epo' && x.half === NM.app.currentHalf(c));
        const a = blocks.find((x) => x.id === (NM.app.state.ui.epoId || {})[c.id]) || blocks[blocks.length - 1];
        if (!a) return { noBlock: true };
        const lessons = a.epo.lessons.slice().sort((x, y) => (x.date || '').localeCompare(y.date || ''));
        const last = lessons[lessons.length - 1];
        const s = M.activeStudents(c)[1];
        const out = {};
        const cell = () => document.querySelector('[data-focus-key="epo-' + s.id + '-' + last.id + '"]');
        if (!cell()) return { noCell: true };
        out.head = [...document.querySelectorAll('.epo-table thead th')].some((th) => th.textContent.trim().startsWith('M'));
        out.legend = [...document.querySelectorAll('.legend .chip')].some((x) => x.textContent.startsWith('m = Material'));
        cell().value = '+hm'; cell().dispatchEvent(new Event('change')); await wait();
        out.typed = JSON.stringify(a.epo.entries[s.id][last.id]) === JSON.stringify({ r: '+', hw: 'h', m: 1 }) && cell().value === '+hm';
        cell().value = '+mm'; cell().dispatchEvent(new Event('change')); await wait();
        out.invalid = cell().classList.contains('invalid') && a.epo.entries[s.id][last.id].m === 1;
        NM.app.rerender(); await wait();
        // Schnellwahl: m aus, dann wieder an; nur m → Eintrag bleibt
        const row = cell().closest('tr');
        const mBtn = () => [...row.querySelectorAll('.quick-btn')].find((b) => b.textContent === 'm');
        out.btnActive = mBtn().classList.contains('active');
        mBtn().click(); await wait();
        out.off = !('m' in a.epo.entries[s.id][last.id]) && a.epo.entries[s.id][last.id].hw === 'h';
        [...cell().closest('tr').querySelectorAll('.quick-btn')].find((b) => b.textContent === 'm').click(); await wait();
        out.on = a.epo.entries[s.id][last.id].m === 1;
        cell().value = 'm'; cell().dispatchEvent(new Event('change')); await wait();
        out.onlyM = JSON.stringify(a.epo.entries[s.id][last.id]) === JSON.stringify({ r: '', hw: '', m: 1 });
        const r = G.epoResult(a.epo, s.id, G.courseLevel(c));
        const mCell = cell().closest('tr').querySelectorAll('td.num.muted');
        out.count = r.m >= 1 && [...mCell].some((td) => td.textContent === String(r.m));
        // Punkte für m in den Einstellungen: −1 senkt die Summe um die Anzahl
        const before = r.sum;
        a.epo.points.m = -1; NM.app.commit(); await wait();
        out.points = G.epoResult(a.epo, s.id, G.courseLevel(c)).sum === before - r.m;
        out.cfg = [...document.querySelectorAll('label.field span')].some((x) => x.textContent === 'm (Material)');
        a.epo.points.m = 0; NM.app.commit(); await wait();
        // Ausdruck: Zettel und Leistungsbogen nennen Material
        const origPrint = window.print; window.print = () => {};
        try {
            NM.print.epoSlips(c, a);
            const t = document.getElementById('print-root').textContent;
            out.slips = t.includes('m = Material vergessen') && t.includes('Material vergessen: ' + r.m);
            NM.print.epo(c, a);
            out.list = document.getElementById('print-root').textContent.includes('m = Material vergessen');
        } finally { window.print = origPrint; }
        NM.app.state.dirty = false;
        return out; })()""")
    report("EPO: Material vergessen (m) per Eingabe und Schnellwahl, Spalte M, Punkte einstellbar, Ausdrucke",
           bool(res) and all(res.get(k) for k in ["head", "legend", "typed", "invalid", "btnActive", "off", "on", "onlyM", "count", "points", "cfg", "slips", "list"])
           and not br.errors, str(res) + "; ".join(br.errors))


def run_attendance_check(br, base):
    """Fehlzeiten: „Heute abwesend“ wird gespeichert, EPO-k ⇄ Fehlzeit, Karte (reihum, + Tag), Notenübersicht, Ausdruck."""
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const A = NM.attendance, M = NM.model, today = NM.util.todayISO();
        const c = NM.app.db().courses[0];
        const [p, q] = M.activeStudents(c);
        const out = {};
        // Ziehen: Heute abwesend → Fehlzeit von heute, in Gruppen sichtbar
        NM.app.select({ courseId: c.id, tab: 'draw' }); await wait();
        const box = [...document.querySelectorAll('.draw-table tbody tr')].find((tr) => tr.textContent.includes(p.last)).querySelector('td:last-child input[type=checkbox]');
        box.click(); await wait();
        out.drawSaved = A.get(c, today, p.id) === 'a' && NM.app.state.dirty !== false;
        NM.app.select({ tab: 'groups' }); await wait();
        out.groupsSeen = !!document.querySelector('[data-focus-key="away-' + p.id + '"]') && document.querySelector('[data-focus-key="away-' + p.id + '"]').checked;
        document.querySelector('[data-focus-key="away-' + p.id + '"]').click(); await wait();
        out.groupsOff = A.get(c, today, p.id) === '';
        // EPO: k in einer Stunde → abwesend an dem Datum
        const half = NM.app.currentHalf(c);
        const blocks = c.assessments.filter((x) => x.kind === 'epo' && x.half === half);
        const a = blocks.find((x) => x.id === (NM.app.state.ui.epoId || {})[c.id]) || blocks[blocks.length - 1];
        const l = a.epo.lessons.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '')).pop();
        NM.app.select({ tab: 'epo' }); await wait();
        const cell = () => document.querySelector('[data-focus-key="epo-' + q.id + '-' + l.id + '"]');
        cell().value = 'kh'; cell().dispatchEvent(new Event('change')); await wait();
        out.epoK = A.get(c, l.date, q.id) === 'a';
        // Kurs & Schüler: Karte, reihum a → e → u → –, k folgt
        NM.app.select({ tab: 'course' }); await wait();
        out.card = !!document.querySelector('.att-card') && document.querySelectorAll('.att-table thead th.att-day').length === A.dates(c, half).length;
        const btn = () => document.querySelector('[data-att="' + q.id + '|' + l.date + '"]');
        out.cellA = btn() && btn().textContent === 'A';
        btn().click(); await wait();
        out.cellE = btn().textContent === 'E' && A.get(c, l.date, q.id) === 'e' && a.epo.entries[q.id][l.id].r === 'k';
        btn().click(); await wait(); btn().click(); await wait();
        out.cellNone = btn().textContent === '' && A.get(c, l.date, q.id) === '' && JSON.stringify(a.epo.entries[q.id][l.id]) === JSON.stringify({ r: '', hw: 'h' });
        btn().click(); await wait(); btn().click(); await wait();  // e
        out.totals = JSON.stringify(A.totals(c, half, q.id)).includes('"e":' + A.hoursOf(c.attendance[l.date]));
        // + Tag mit 2 Stunden
        document.querySelector('[data-att-add]').click(); await wait();
        const d = document.querySelector('[data-att-date]'), hrs = document.querySelector('[data-att-hours]');
        const newDay = half === NM.grades.halvesFor(c)[0] ? '2026-10-05' : '2027-03-15';
        d.value = newDay; hrs.value = '2';
        [...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Hinzufügen').click(); await wait(300);
        out.added = !!c.attendance[newDay] && c.attendance[newDay].hours === 2 && !!document.querySelector('[data-att-day="' + newDay + '"]');
        const uBefore = A.totals(c, half, p.id).u;
        document.querySelector('[data-att="' + p.id + '|' + newDay + '"]').click(); await wait();
        document.querySelector('[data-att="' + p.id + '|' + newDay + '"]').click(); await wait();
        document.querySelector('[data-att="' + p.id + '|' + newDay + '"]').click(); await wait();
        const pt = A.totals(c, half, p.id);
        out.unexcused = pt.u === uBefore + 2;
        // Notenübersicht: Spalte Fehlst., Druckauswahl mit Fehlzeiten
        NM.app.select({ tab: 'overview' }); await wait();
        out.ovCol = [...document.querySelectorAll('.overview-table th')].some((th) => th.textContent === 'Fehlst.')
          && [...document.querySelectorAll('.overview-table tbody tr')].some((tr) => tr.textContent.includes(p.last) && tr.querySelector('td.att-col').textContent === pt.hours + ' (' + pt.u + ' U)');
        document.querySelector('[data-print-menu]').click(); await wait();
        out.menu = !!document.querySelector('[data-print="attendance"]');
        document.querySelector('dialog [data-print="attendance"]') && [...document.querySelectorAll('dialog button')].find((b) => /Abbrechen|Schließen|✕/.test(b.textContent)) ? [...document.querySelectorAll('dialog button')].find((b) => /Abbrechen|Schließen|✕/.test(b.textContent)).click() : null;
        await wait();
        const origPrint = window.print; window.print = () => {};
        try {
            NM.print.attendance(c, half);
            const r = document.getElementById('print-root');
            out.print = r.querySelectorAll('table.p-att tbody tr').length === M.activeStudents(c).length && r.textContent.includes('Fehlzeiten') && r.textContent.includes('unentschuldigt');
        } finally { window.print = origPrint; }
        NM.app.state.dirty = false;
        return out; })()""")
    report("Fehlzeiten: Heute abwesend gespeichert, EPO-k ⇄ Fehlzeit, Karte reihum und + Tag, Spalte in der Notenübersicht, Ausdruck",
           bool(res) and all(res.get(k) for k in ["drawSaved", "groupsSeen", "groupsOff", "epoK", "card", "cellA", "cellE", "cellNone", "totals", "added", "unexcused", "ovCol", "menu", "print"])
           and not br.errors, str(res) + "; ".join(br.errors))


def run_epo_tiles_check(br, base):
    """EPO-Kachelansicht (Tablet): nach Sitzplan bzw. alphabetisch, Tippen bewertet, Zusätze, k → Fehlzeit, Esc, Touch-Größen."""
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    br.call("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)

    def tap(selector):
        r = br.eval("(() => { const el = document.querySelector(%s); if (!el) return null; const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()" % json.dumps(selector))
        if not r:
            return False
        br.call("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": r[0], "y": r[1]}])
        br.call("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        br.eval("new Promise((r) => setTimeout(r, 250))")
        return True

    setup = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const c = NM.app.db().courses[0], M = NM.model;
        const ids = M.activeStudents(c).map((s) => s.id);
        c.seatingPlans = [{ id: 'r1', name: 'Raum 1', cols: 6, rows: 3, desk: 'top', pos: {} }];
        ids.slice(0, ids.length - 1).forEach((id, i) => (c.seatingPlans[0].pos[id] = { x: i % 5, y: Math.floor(i / 5) }));
        NM.app.state.ui.seatingId = { [c.id]: 'r1' };
        NM.app.select({ courseId: c.id, tab: 'epo' }); await wait();
        document.querySelector('[data-tiles-open]').click(); await wait();
        const half = NM.app.currentHalf(c);
        const blocks = c.assessments.filter((x) => x.kind === 'epo' && x.half === half);
        const a = blocks.find((x) => x.id === (NM.app.state.ui.epoId || {})[c.id]) || blocks[blocks.length - 1];
        window.__t = { c, a, l: a.epo.lessons.slice().sort((x, y) => (x.date || '').localeCompare(y.date || '')).pop(), ids };
        const tiles = [...document.querySelectorAll('.tiles-grid [data-tile]')];
        const t0 = document.querySelector('[data-tile="' + ids[6] + '"]');
        return { overlay: !!document.querySelector('.epo-tiles'), tiles: tiles.length, free: document.querySelectorAll('.tiles-free [data-tile]').length,
                 pos: [t0.style.gridColumn, t0.style.gridRow], desk: !!document.querySelector('.tiles-desk'),
                 minH: Math.min(...tiles.map((t) => t.getBoundingClientRect().height)) }; })()""")
    sid = br.eval("window.__t.ids[2]")
    tap(f'[data-tile="{sid}"]')
    s1 = br.eval("""(() => { const sh = document.querySelector('.tiles-sheet');
        const btns = [...sh.querySelectorAll('.quick-btn')];
        return { open: !sh.hidden, n: btns.length, minBtn: Math.min(...btns.map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))) }; })()""")
    tap('.tiles-sheet [data-quick="+"]')
    s2 = br.eval("""(() => { const { a, l, ids } = window.__t; const e = (a.epo.entries[ids[2]] || {})[l.id];
        return { r: e && e.r, closed: document.querySelector('.tiles-sheet').hidden, cls: document.querySelector('[data-tile="' + ids[2] + '"]').classList.contains('r-p') }; })()""")
    tap(f'[data-tile="{sid}"]')
    tap('.tiles-sheet [data-quick="m"]')
    tap('.tiles-sheet [data-quick="k"]')
    s3 = br.eval("""(() => { const { c, a, l, ids } = window.__t; const e = a.epo.entries[ids[2]][l.id];
        return { cell: NM.grades.epoCellText(e), att: NM.attendance.get(c, l.date, ids[2]), text: document.querySelector('[data-tile="' + ids[2] + '"]').textContent }; })()""")
    s4 = br.eval("""(async () => { const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const { c, ids } = window.__t;
        document.querySelector('[data-tile="' + ids[0] + '"]').click(); await wait();
        const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        esc(); await wait();
        const sheetClosed = document.querySelector('.tiles-sheet').hidden && !!document.querySelector('.epo-tiles');
        esc(); await wait();
        const gone = !document.querySelector('.epo-tiles');
        // ohne Sitzplätze: alphabetisch
        c.seatingPlans[0].pos = {};
        document.querySelector('[data-tiles-open]').click(); await wait();
        const order = [...document.querySelectorAll('.tiles-grid [data-tile]')].map((t) => t.dataset.tile);
        const alpha = JSON.stringify(order) === JSON.stringify(NM.model.sortStudents(NM.model.activeStudents(c)).map((s) => s.id)) && !document.querySelector('.tiles-desk');
        document.querySelector('[data-tiles-close]').click(); await wait();
        NM.app.state.dirty = false;
        return { sheetClosed, gone, alpha, closed: !document.querySelector('.epo-tiles') }; })()""")
    br.call("Emulation.setTouchEmulationEnabled", enabled=False)
    ok = (bool(setup) and setup["overlay"] and setup["tiles"] == 11 and setup["free"] == 1 and setup["pos"] == ["2", "3"] and setup["desk"] and setup["minH"] >= 44
          and s1["open"] and s1["n"] == 9 and s1["minBtn"] >= 44
          and s2["r"] == "+" and s2["closed"] and s2["cls"]
          and s3["cell"] == "km" and s3["att"] == "a" and "k" in s3["text"]
          and all(s4.values()))
    report("EPO-Kacheln (Touch): nach Sitzplan mit Pult und „Ohne Platz“, Tippen bewertet, m und k (Fehlzeit), Esc, alphabetisch ohne Plätze, Touch-Größen ≥ 44 px",
           ok and not br.errors, str([setup, s1, s2, s3, s4]) + "; ".join(br.errors))


def run_print_head_check(br, base):
    """Einheitlicher Druckkopf (1.47): Einstellungen mit Logo-Upload (verkleinert), Kopf in allen Druckarten, Zettel kompakt, leere Angaben fallen weg."""
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const out = {}, db = NM.app.db(), P = db.settings.print;
        const origPrint = window.print; window.print = () => {};
        try {
            out.demo = [P.schoolName, P.teacher, P.logo];
            NM.app.select({ tab: 'settings' }); await wait();
            const field = (k) => document.querySelector('[data-print-field="' + k + '"]');
            out.card = [field('schoolName').value, field('teacher').value, !document.querySelector('[data-print-logo]')];
            field('teacher').value = '  T. Lehrkraft '; field('teacher').dispatchEvent(new Event('change')); await wait();
            out.teacher = P.teacher;
            // Logo 1200 × 400 hochladen → 600 × 200
            const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 400;
            const g = cv.getContext('2d'); g.fillStyle = '#c00'; g.fillRect(0, 0, 1200, 400);
            const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
            const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
            const inp = document.querySelector('[data-print-logo-file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
            for (let i = 0; i < 30 && !P.logo; i++) await wait(100);
            await wait();
            const img = new Image(); img.src = P.logo; await img.decode();
            out.logo = [P.logo.slice(0, 22), img.naturalWidth, img.naturalHeight, !!document.querySelector('[data-print-logo]')];
            // kein Bild → abgelehnt, Logo bleibt
            const dt2 = new DataTransfer(); dt2.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
            inp.files = dt2.files; inp.dispatchEvent(new Event('change')); await wait();
            out.reject = P.logo.startsWith('data:image/png');
            // Kopf in den Druckarten
            const c = db.courses[0], half = NM.app.currentHalf(c);
            const test = c.assessments.find((a) => a.kind === 'test' && a.half === half) || c.assessments.find((a) => a.kind === 'test');
            const epo = c.assessments.find((a) => a.kind === 'epo');
            const pres = c.assessments.find((a) => a.kind === 'pres');
            const root = () => document.getElementById('print-root');
            const head = (fn) => { fn(); const hs = [...root().querySelectorAll('.p-head')]; const h0 = hs[0];
                const r = h0 ? { n: hs.length, compact: h0.classList.contains('p-head-compact'), logo: !!h0.querySelector('img.p-logo'), school: h0.textContent.includes('Beispielschule'),
                    teacher: h0.textContent.includes('T. Lehrkraft'), course: h0.textContent.includes(NM.model.courseTitle(c)), old: !!root().querySelector('.p-header, .p-mr-head, .p-slip-head, .p-epo-slip-head') } : null;
                document.body.classList.remove('printing'); return r; };
            out.kinds = {
                course: head(() => NM.print.course(c, half)),
                year: head(() => NM.print.course(c, 'Jahr')),
                testList: head(() => NM.print.test(c, test, 'list')),
                testKey: head(() => NM.print.test(c, test, 'key')),
                slips: head(() => NM.print.test(c, test, 'slips')),
                epo: head(() => NM.print.epo(c, epo)),
                epoSlips: head(() => NM.print.epoSlips(c, epo)),
                presList: head(() => NM.print.pres(c, pres, 'list')),
                presBlank: head(() => NM.print.pres(c, pres, 'blank')),
                guide: head(() => NM.print.presGuide({ title: 'Plakat', course: c, criteria: pres.pres.criteria })),
                seating: head(() => NM.print.seating(c)),
                attendance: head(() => NM.print.attendance(c, half)),
            };
            NM.print.test(c, test, 'list');
            out.date = root().querySelector('.p-head .p-meta').textContent.includes('Testdatum ' + NM.util.fmtDate(test.date));
            document.body.classList.remove('printing');
            NM.print.test(c, test, 'slips');
            const ch = root().querySelector('.p-head-compact');
            out.compactRow = [!!ch.querySelector('.p-head-person'), ch.querySelector('.p-head-right').textContent.includes(test.name), !ch.textContent.includes('T. Lehrkraft')];
            document.body.classList.remove('printing');
            // leere Angaben fallen weg: wie früher Titel links
            Object.assign(P, { schoolName: '', teacher: '', logo: '' });
            NM.print.course(c, half);
            const hd = root().querySelector('.p-head');
            out.empty = [!hd.classList.contains('with-school'), !hd.querySelector('.p-school'), !hd.textContent.includes('Lehrkraft'), !!hd.querySelector('.p-head-row > .p-head-title h1')];
            document.body.classList.remove('printing');
            // Migration und Prüfung
            const d2 = { schema: NM.model.SCHEMA, settings: { print: { schoolName: 7, teacher: ' X ', logo: 'javascript:alert(1)' } }, years: [], courses: [] };
            NM.model.migrate(d2);
            out.migrate = d2.settings.print;
            const d3 = { schema: NM.model.SCHEMA, settings: { print: { logo: 'http://x/y.png' } }, years: [], courses: [] };
            out.check = NM.model.check(d3).some((x) => x.where === 'Einstellungen');
            const d4 = { schema: NM.model.SCHEMA, years: [], courses: [] }; NM.model.migrate(d4);
            out.fresh = d4.settings.print;
        } finally { window.print = origPrint; NM.app.state.dirty = false; }
        return out; })()""")
    k = (res or {}).get("kinds", {})
    full = [n for n in k if n not in ("slips", "epoSlips")]
    ok = (bool(res) and res["demo"] == ["Beispielschule", "M. Muster", ""] and res["card"] == ["Beispielschule", "M. Muster", True]
          and res["teacher"] == "T. Lehrkraft" and res["logo"] == ["data:image/png;base64,", 600, 200, True] and res["reject"]
          and all(k.get(n) and not k[n]["compact"] and k[n]["logo"] and k[n]["school"] and k[n]["teacher"] and k[n]["course"] and not k[n]["old"] for n in full)
          and all(k.get(n) and k[n]["compact"] and k[n]["logo"] and k[n]["school"] and k[n]["n"] > 1 and not k[n]["old"] for n in ("slips", "epoSlips"))
          and res["date"] and all(res["compactRow"]) and all(res["empty"])
          and res["migrate"] == {"schoolName": "", "teacher": "X", "logo": ""} and res["check"]
          and res["fresh"] == {"schoolName": "", "teacher": "", "logo": ""})
    report("Druckkopf: Schulname/Lehrkraft/Logo (verkleinert auf 600 px) in den Einstellungen, ein Kopf für alle Druckarten, Zettel kompakt, leere Angaben fallen weg, Migration/Prüfung",
           ok and not br.errors, str(res) + "; ".join(br.errors))


def run_draw_check(br, base):
    print("Ziehen (Pool, Auffüllen, Noten, Rückgängig):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = () => new Promise((r) => setTimeout(r, 150));
        const c = NM.app.db().courses[0];                     // 12 Personen
        NM.app.state.ui.drawCount = 5;
        NM.app.select({ courseId: c.id, tab: 'draw' }); await wait();
        const D = NM.views.draw, out = {};
        const click = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t)).click();
        const nA = c.assessments.length;
        click('🎲 Ziehen'); await wait();
        const h1 = c.draw.history[0];
        out.first = [h1.sids.length, D.pool(c).length, c.assessments.length - nA, new Set(h1.sids).size];
        click('🎲 Ziehen'); await wait();
        const h2 = c.draw.history[1];
        out.noRepeat = h2.sids.every((sid) => !h1.sids.includes(sid));
        // Ein Abwesender und ein Herausgenommener werden übersprungen
        const rest = D.pool(c).map((s) => s.id);           // 2 übrig
        out.restBefore = rest.length;
        click('🎲 Ziehen'); await wait();                        // 2 übrig + 3 aus neu gefülltem Pool
        const h3 = c.draw.history[2];
        out.refill = [h3.sids.length, rest.every((sid) => h3.sids.includes(sid)), new Set(h3.sids).size, D.pool(c).length];
        // Note eintragen landet in der Notenspalte
        const inp = document.querySelector('.draw-card .grade-input');
        inp.value = '2-'; inp.dispatchEvent(new Event('change')); await wait();
        const a3 = c.assessments.find((a) => a.id === h3.aid);
        out.grade = [Object.keys(a3.manual.grades).length, a3.cat, a3.kind];
        // Rückgängig: Pool wie vorher, Spalte weg
        click('Rückgängig'); await wait(); document.querySelector('dialog .btn-danger, dialog .btn-primary').click(); await wait();
        out.undo = [c.draw.history.length, D.pool(c).length, !!c.assessments.find((a) => a.id === h3.aid)];
        // Notenübersicht: Felder der Nicht-Gezogenen ausgegraut
        NM.app.select({ tab: 'overview' }); await wait();
        const h2a = c.assessments.find((a) => a.id === h2.aid);
        const cells = NM.model.activeStudents(c).map((s) => document.querySelector(`[data-focus-key="ov-${h2a.id}-${s.id}"]`).closest('td'));
        out.greyed = [cells.filter((td) => td.classList.contains('not-drawn')).length, cells.length - h2.sids.length];
        NM.app.select({ tab: 'draw' }); await wait();
        // Note in einer früheren Ziehung nachtragen (Liste zeigt die erste Ziehung)
        const hi = document.querySelector('.draw-hist-item .grade-input');
        hi.value = '3+'; hi.dispatchEvent(new Event('change')); await wait();
        const a1 = c.assessments.find((a) => a.id === h1.aid);
        out.histGrade = [Object.keys(a1.manual.grades).length, NM.grades.label(Object.values(a1.manual.grades)[0].p, 'sek1'), document.querySelectorAll('.draw-hist-item .grade-input').length];
        // Haken „Im Pool“ und „heute abwesend“: bei vollem Pool alle anderen 10 ziehen, ohne dass aufgefüllt wird
        // (beim Auffüllen kämen Herausgenommene laut Doku zurück – das darf hier nicht vom Zufall der vorigen Ziehungen abhängen)
        c.draw.out = {};
        const [away, outS] = NM.model.activeStudents(c);
        c.draw.out[outS.id] = { how: 'manual', date: '2026-10-21' };
        const pick = D.drawStudents(c, 10, new Set([away.id]), () => 0);
        out.skip = [pick.sids.includes(away.id), pick.sids.includes(outS.id), !c.draw.out[away.id], pick.refilled, pick.sids.length];
        return out; })()""")
    ok = bool(res) and res["first"] == [5, 7, 1, 5] and res["noRepeat"] and res["restBefore"] == 2 \
        and res["refill"][0] == 5 and res["refill"][1] and res["refill"][2] == 5 and res["refill"][3] == 7 \
        and res["grade"] == [1, "other", "manual"] and res["undo"] == [2, 2, False] and res["histGrade"] == [1, "3+", 5] and res["greyed"][0] == res["greyed"][1] == 7 and res["skip"] == [False, False, True, False, 10]
    report("Ziehen: ohne Wiederholung, Auffüllen, Note (auch nachträglich), Rückgängig, Abwesende/Herausgenommene", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_draw_pools_check(br, base):
    print("Ziehen: benannte Pools, Sammelspalte, Prüfung, Zusammenfassen:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0];          // 12 Personen
        NM.app.state.ui.drawCount = 5;
        NM.app.select({ courseId: c.id, tab: 'draw' }); await wait();
        const q = (sel) => document.querySelector(sel);
        const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(t));
        const out = {}, nA = c.assessments.length;
        // Neuer Pool
        q('[data-draw-new]').click(); await wait();
        const inp = q('dialog input'); inp.value = 'HA Runde 1'; q('dialog .btn-primary').click(); await wait();
        const pool = c.draw.pools[0], col = () => c.assessments.find((a) => a.id === pool.aid);
        out.created = [c.draw.pools.length, c.assessments.length - nA, col().name, q('.draw-pools .seg.active').textContent, NM.app.state.ui.drawPool[c.id] === pool.id];
        q('[data-draw-go]').click(); await wait();
        // Note für eine Gezogene eintragen
        const gi = q('.draw-card .grade-input'); gi.value = '2'; gi.dispatchEvent(new Event('change')); await wait();
        out.grade = [Object.keys(col().manual.grades).length, pool.history.length];
        out.check = q('.draw-check') ? q('.draw-check summary').textContent : null;
        // Notenübersicht: eine Spalte, Nicht-Gezogene blass
        NM.app.select({ tab: 'overview' }); await wait();
        const cells = NM.model.activeStudents(c).map((s) => q(`[data-focus-key="ov-${pool.aid}-${s.id}"]`).closest('td'));
        out.overview = [cells.filter((td) => td.classList.contains('not-drawn')).length, !!q('.overview-table').textContent.includes('HA Runde 1')];
        NM.app.select({ tab: 'draw' }); await wait();
        q('[data-draw-go]').click(); await wait();
        q('[data-draw-go]').click(); await wait();          // nur noch 2 übrig
        out.finished = [pool.history.length, NM.draw.finished(c, pool), !!q('.draw-done'), !q('[data-draw-go]'), c.assessments.length - nA, q('.draw-pools .seg.active').textContent.endsWith('✓')];
        // Rückgängig der letzten Ziehung: 2 wieder übrig, kein Fehler
        btn('Rückgängig').click(); await wait(); q('dialog .btn-primary, dialog .btn-danger').click(); await wait();
        out.undo = [pool.history.length, NM.draw.left(c, pool).length, !!q('[data-draw-go]')];
        // Klassisch: drei Ziehungen, dann zusammenfassen
        q('[data-draw-pool="classic"]').click(); await wait();
        NM.app.state.ui.drawCount = 3;
        for (let i = 0; i < 3; i++) { btn('🎲 Ziehen').click(); await wait(); }
        const hist = c.draw.history.slice(-3);
        const half = NM.app.currentHalf(c);
        for (const e of hist) c.assessments.find((a) => a.id === e.aid).manual.grades[e.sids[0]] = { p: 8 };
        NM.app.commit(); await wait();
        q('[data-draw-merge]').click(); await wait();
        const boxes = [...document.querySelectorAll('dialog [data-merge-aid]')];
        q('dialog [data-merge-name]').value = 'HA alt';
        q('dialog .btn-primary').click(); await wait(300);
        const merged = c.draw.pools.find((p) => p.name === 'HA alt');
        out.merge = [boxes.length >= 3, !!merged, c.draw.history.length, merged && Object.keys(c.assessments.find((a) => a.id === merged.aid).manual.grades).length,
                     hist.every((e) => !c.assessments.some((a) => a.id === e.aid)), merged && q('.draw-pools .seg.active').textContent === 'HA alt'];
        // Pool löschen: Spalte bleibt
        q('[data-draw-del]').click(); await wait(); q('dialog .btn-primary').click(); await wait();
        out.del = [c.draw.pools.some((p) => p.name === 'HA alt'), c.assessments.some((a) => a.name === 'HA alt'), q('.draw-pools .seg.active').dataset.drawPool];
        out.dbcheck = NM.model.check(NM.model.migrate(JSON.parse(JSON.stringify(db)))).filter((p) => p.level === 'fehler').length;
        return out; })()""")
    ok = bool(res) and res["created"] == [1, 1, "HA Runde 1", "HA Runde 1", True] and res["grade"] == [1, 1] and res["check"] and "4 Gezogene noch ohne Note" in res["check"] \
        and res["overview"] == [7, True] and res["finished"] == [3, True, True, True, 1, True] and res["undo"] == [2, 2, True] \
        and res["merge"] == [True, True, 0, 3, True, True] and res["del"] == [False, True, "classic"] and res["dbcheck"] == 0
    report("Ziehen-Pools: neuer Pool mit Sammelspalte, eine Runde bis fertig, Rückgängig, Prüfung, Notenübersicht, Zusammenfassen, Löschen ohne Notenverlust", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_random_check(br, base):
    print("Tools: Zufall (Zahl, Personen, Würfel, Karten):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    js = """(async () => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const c = NM.app.db().courses[0];                     // 12 Personen
        const nA = c.assessments.length, drawBefore = JSON.stringify(c.draw || {});
        NM.app.state.ui.random = { min: 1, max: 100, count: 1, noRepeat: false, die: 6, dice: 1, deck: '52' };
        NM.app.select({ courseId: c.id, tab: 'random' }); await wait(300);
        const S = NM.views.random.session(c), out = {};
        const q = (sel) => document.querySelector(sel);
        const set = (sel, v) => { const x = q(sel); if (x.type === 'checkbox') x.checked = v; else x.value = v; x.dispatchEvent(new Event('change')); };
        const go = async (k) => { const b = q(`[data-rnd-go="${k}"]`); b.click(); for (let i = 0; i < 60 && b.disabled; i++) await wait(100); };
        out.tools = document.querySelectorAll('.rnd-tool .rnd-full').length;
        // Zufallszahl (mit Animation), danach ohne Animation viele Male
        set('[data-rnd-min]', '5'); set('[data-rnd-max]', '7');
        await go('number');
        out.number = [Number(q('.rnd-number').textContent) === S.numbers[0], S.numbers[0] >= 5 && S.numbers[0] <= 7];
        out.nA = nA; out.drawBefore = drawBefore;
        return out; })()"""
    res = br.eval(js)
    br.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce"}])
    res2 = br.eval("""(async () => {
        const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
        const c = NM.app.db().courses[0];
        const S = NM.views.random.session(c), out = {};
        const q = (sel) => document.querySelector(sel);
        const set = (sel, v) => { const x = q(sel); if (x.type === 'checkbox') x.checked = v; else x.value = v; x.dispatchEvent(new Event('change')); };
        const go = async (k) => { const b = q(`[data-rnd-go="${k}"]`); b.click(); for (let i = 0; i < 60 && b.disabled; i++) await wait(100); await wait(); };
        for (let i = 0; i < 30; i++) await go('number');
        out.range = [Math.min(...S.numbers), Math.max(...S.numbers), S.numbers.length];
        // Personen: keine Wiederholung, Auffüllen, Abwesende
        set('[data-rnd-count]', '5'); set('[data-rnd-norepeat]', true);
        await go('people'); const a = S.people.slice();
        await go('people'); const b = S.people.slice();
        out.people = [a.length, b.length, b.some((x) => a.includes(x)), document.querySelectorAll('.rnd-people .draw-card').length, /object/.test(q('.rnd-people').textContent)];
        const rest = NM.model.activeStudents(c).map((s) => s.id).filter((id) => !a.includes(id) && !b.includes(id));
        await go('people');
        out.refill = [rest.every((id) => S.people.includes(id)), new Set(S.people).size];
        const awayId = NM.model.activeStudents(c)[0].id; NM.views.draw.setAbsent(c, awayId, true);
        const away = NM.views.draw.absent(c);
        set('[data-rnd-norepeat]', false); set('[data-rnd-count]', '12');
        await go('people');
        out.absent = [S.people.length, S.people.includes(awayId), away.has(awayId)];
        NM.views.draw.setAbsent(c, awayId, false);
        // Würfel: 3 × W20, Ergebnis vorn
        set('[data-rnd-die]', '20'); set('[data-rnd-dice]', '3');
        await go('dice');
        const cv = [...document.querySelectorAll('.rnd-dice canvas')];
        out.dice = [cv.length, cv.map((x) => Number(x.dataset.value)).join() === S.dice.values.join(), q('.rnd-sum').textContent === S.dice.values.join(' + ') + ' = ' + S.dice.sum,
                    S.dice.rest.every((r, i) => NM.random.frontLabel(20, NM.random.qMatrix(r)) === S.dice.values[i]), S.dice.values.every((v) => v >= 1 && v <= 20)];
        // Karten: 52, Skat, eigene
        out.pile = [!!q('.rnd-pile .rnd-pile-card'), q('.rnd-pile').textContent];
        for (let i = 0; i < 3; i++) await go('card');
        const d52 = S.decks['52'];
        const img = q('.rnd-hand .rnd-card img.rnd-card-front');
        out.cards = [d52.left.length, new Set(d52.drawn.map((x) => x.id)).size, document.querySelectorAll('.rnd-mini').length, img.getAttribute('src') === `cards/${d52.last[0].suit}${d52.last[0].rank}.svg`, /49 von 52/.test(q('[data-rnd="cards"]').textContent)];
        await new Promise((r) => { if (img.complete) r(); else img.onload = img.onerror = r; });
        out.svg = img.naturalWidth > 0;
        // mehrere Karten auf einmal, auch per Klick auf den Stapel
        set('[data-rnd-ncards]', '5'); await go('card');
        out.multi = [d52.last.length, document.querySelectorAll('.rnd-hand .rnd-card').length, d52.left.length, new Set(d52.drawn.map((x) => x.id)).size, d52.drawn.slice(0, 5).map((x) => x.id).join() === d52.last.map((x) => x.id).join()];
        q('.rnd-pile').click(); await wait();
        out.pileClick = [d52.left.length, document.querySelectorAll('.rnd-hand .rnd-card').length];
        set('[data-rnd-ncards]', '50'); await go('card');
        out.rest = [d52.left.length, d52.last.length, q('.rnd-pile').classList.contains('empty'), q('[data-rnd-go="card"]').disabled, !!q('.rnd-pile')];
        set('[data-rnd-ncards]', '1');
        q('[data-rnd-shuffle]').click(); await wait();
        out.shuffle = S.decks['52'].left.length;
        set('[data-rnd-deck]', '32'); await go('card');
        out.skat = [S.decks['32'].total, S.decks['32'].left.length, ['7', '8', '9', '10', 'B', 'D', 'K', 'A'].includes(S.decks['32'].drawn[0].rank)];
        set('[data-rnd-deck]', 'custom');
        out.customHidden = q('.rnd-edit').hidden;
        set('[data-rnd-cards]', ['Thema A', '', '  Thema B ', 'Rolle C'].join(String.fromCharCode(10)));
        q('[data-rnd-cards-save]').click(); await wait(300);
        for (let i = 0; i < 4; i++) await go('card');
        const dc = S.decks.custom;
        out.custom = [JSON.stringify(c.randomCards), dc.drawn.length, dc.drawn.map((x) => x.text).sort().join('|'), q('[data-rnd-go="card"]').disabled, q('.rnd-hand .rnd-card-text').textContent.length > 0];
        // nichts in der Notenliste, Ziehen-Pool unverändert
        out.untouched = [c.assessments.length === %d, JSON.stringify(c.draw || {}) === %s];
        return out; })()""".replace('%d', str(res and res.get('nA'))).replace('%s', json.dumps(res and res.get('drawBefore'))))
    br.call("Emulation.setEmulatedMedia", features=[])
    ok = bool(res) and bool(res2) and res["tools"] == 5 and res["number"] == [True, True] \
        and res2["range"][0] >= 5 and res2["range"][1] <= 7 and res2["range"][0] < res2["range"][1] \
        and res2["people"] == [5, 5, False, 5, False] and res2["refill"] == [True, 5] and res2["absent"] == [11, False, True] \
        and res2["dice"] == [3, True, True, True, True] and res2["pile"] == [True, "52"] and res2["cards"] == [49, 3, 2, True, True] and res2["svg"] and res2["multi"] == [5, 5, 44, 8, True] \
        and res2["pileClick"] == [39, 5] and res2["rest"] == [0, 39, True, True, True] and res2["shuffle"] == 52 \
        and res2["skat"] == [32, 31, True] and res2["customHidden"] is False \
        and res2["custom"] == ['["Thema A","Thema B","Rolle C"]', 3, "Rolle C|Thema A|Thema B", True, True] and res2["untouched"] == [True, True]
    report("Zufall: Zahl im Bereich, Personen ohne Wiederholung/Abwesende, 3D-Würfel mit Summe, Karten (Bilder, Stapel, mehrere, 52/32/eigene), keine Noten", ok and not br.errors, str(res) + str(res2) + "; ".join(br.errors))


MOODLE_HEAD = 'Nachname,Vorname,E-Mail-Adresse,Status,Begonnen,Beendet,Dauer,"Bewertung/2,00"'
MOODLE_ANSWERS = "\n".join([
    MOODLE_HEAD + ",Frage 1,Antwort 1,Richtige Antwort 1,Frage 2,Antwort 2,Richtige Antwort 2",
    "Becker,Lea,lea@x.de,Beendet,1. September 2026  10:05,x,x,\"2,00\",Wie viel ist 2+2?,4,4,Hauptstadt?,Berlin,Berlin",
    "Demir,Can,can@x.de,Beendet,1. September 2026  10:05,x,x,\"1,00\",Wie viel ist 2+2?,5,4,Hauptstadt?,Berlin,Berlin",
    "Fischer,Mia,mia@x.de,In Bearbeitung,1. September 2026  10:05,-,-,-,Wie viel ist 2+2?,-,4,Hauptstadt?,-,Berlin",
])
MOODLE_GRADES = "\n".join([
    MOODLE_HEAD + ',"F 1 /1,00","F 2 /1,00"',
    "Becker,Lea,lea@x.de,Beendet,1. September 2026  10:05,x,x,\"2,00\",1,1",
    "Demir,Can,can@x.de,Beendet,1. September 2026  10:05,x,x,\"1,50\",\"0,50\",1",
    "Fischer,Mia,mia@x.de,In Bearbeitung,1. September 2026  10:05,-,-,-,-,-",
    "Gesamtdurchschnitt,,,,,,,\"1,75\",\"0,75\",1",
])


def run_pomodoro_check(br, base):
    print("Pomodoro-Timer (Einstellung, Kopfzeile, Phasen):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
        const P = NM.pomodoro, st = P.state();
        P.reset();
        const out = { off: !document.querySelector('.pomo') };
        NM.app.select({ tab: 'settings' }); await wait();
        const box = [...document.querySelectorAll('label.check')].find((l) => l.textContent.includes('Pomodoro')).querySelector('input');
        box.checked = true; box.dispatchEvent(new Event('change')); await wait();
        const pomo = () => document.querySelector('.pomo');
        const btn = (t) => [...pomo().querySelectorAll('button')].find((b) => b.title === t);
        out.on = [!!pomo(), pomo().className, document.querySelector('.pomo-time').textContent, ['Start', 'Pause', 'Zurücksetzen', 'Pomodoro-Einstellungen'].every((t) => !!btn(t))];
        const settings = NM.app.db().settings.pomodoro;
        settings.tick = 'off'; settings.alarm = 'off';
        btn('Start').click(); await wait();
        out.work = [pomo().className, btn('Start').disabled, btn('Pause').disabled];
        btn('Pause').click(); await wait();
        out.paused = [pomo().className, st.running];
        btn('Start').click(); await wait();
        st.endsAt = Date.now() - 10; P.tick(); await wait();           // Pomodoro vorbei → kurze Pause
        out.brk = [pomo().className, st.phase, st.index, document.querySelector('.pomo-time').textContent <= '05:00'];
        btn('Pause').click(); await wait();
        out.brkPaused = pomo().className;
        btn('Zurücksetzen').click(); await wait();
        out.reset = [pomo().className, st.phase, st.index, document.querySelector('.pomo-time').textContent];
        btn('Pomodoro-Einstellungen').click(); await wait();
        out.dialog = document.querySelectorAll('dialog input[type=number]').length;
        const work = document.querySelector('dialog input[type=number]:nth-of-type(1)');
        const f = [...document.querySelectorAll('dialog label.field')].find((l) => l.textContent.startsWith('Länge eines Pomodoros')).querySelector('input');
        f.value = '30'; f.dispatchEvent(new Event('change')); await wait();
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.len = [settings.work, document.querySelector('.pomo-time').textContent];
        box.checked = false;
        NM.app.select({ tab: 'settings' }); await wait();
        const box2 = [...document.querySelectorAll('label.check')].find((l) => l.textContent.includes('Pomodoro')).querySelector('input');
        box2.checked = false; box2.dispatchEvent(new Event('change')); await wait();
        out.offAgain = !document.querySelector('.pomo');
        return out; })()""")
    ok = bool(res) and res["off"] and res["on"] == [True, "pomo pomo-idle", "25:00", True] and res["work"] == ["pomo pomo-work", True, False] \
        and res["paused"] == ["pomo pomo-paused", False] and res["brk"] == ["pomo pomo-break", "short", 1, True] and res["brkPaused"] == "pomo pomo-paused" \
        and res["reset"] == ["pomo pomo-idle", "work", 1, "25:00"] and res["dialog"] == 4 and res["len"] == [30, "30:00"] and res["offAgain"]
    report("Pomodoro: aktivieren, Start (rot), Pause (gelb), Pausenphase (grün), Zurücksetzen, Einstellungen, deaktivieren", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_transition_check(br, base):
    print("Weiche Übergänge (Reiter, Kurs, Halbjahr):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
        const enter = () => document.getElementById('view').classList.contains('view-enter');
        const ink = () => { const i = document.querySelector('.tab-ink'), a = document.querySelector('.tab.active');
            return Math.abs(i.getBoundingClientRect().left - a.getBoundingClientRect().left) < 1 && Math.abs(i.offsetWidth - a.offsetWidth) < 1; };
        const c = NM.app.db().courses;
        const out = {};
        NM.app.select({ courseId: c[0].id, tab: 'tests' });
        out.tab = [enter(), document.querySelector('.tab-ink').classList.contains('moving')];
        await wait(); out.inkTab = ink();
        NM.app.commit(); await wait();
        out.input = [enter(), document.querySelector('.tab-ink').classList.contains('moving')];
        NM.app.setHalf(c[0], 'HJ2'); await wait(50);
        out.half = enter();
        NM.app.rerender(); await wait();
        out.after = enter();
        NM.app.select({ courseId: c[1].id }); await wait(50);
        out.course = [enter(), document.querySelector('.tab-ink').classList.contains('moving')];
        await wait(); out.inkCourse = ink();
        return out; })()""")
    ok = bool(res) and res["tab"] == [True, True] and res["inkTab"] and res["input"] == [False, False] and res["half"] and not res["after"] \
        and res["course"] == [True, False] and res["inkCourse"]
    report("Übergang bei Reiter/Kurs/Halbjahr, nicht beim Neuzeichnen nach Eingaben; Unterstrich am aktiven Reiter", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_sidebar_check(br, base):
    print("Kursliste ein-/ausklappen:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const side = () => document.querySelector('.sidebar');
        const out = { open: side().getBoundingClientRect().width };
        document.querySelector('.side-toggle').click(); await wait(450);     // Gleitanimation abwarten
        const chips = [...document.querySelectorAll('.course-chip')];
        out.closed = [side().classList.contains('collapsed'), side().getBoundingClientRect().width, chips.length, NM.app.state.ui.sideCollapsed];
        chips[1].click(); await wait();
        out.switch = [NM.app.currentCourse().id === NM.app.db().courses[1].id, side().classList.contains('collapsed'), document.querySelectorAll('.course-chip.active').length];
        document.querySelector('.side-toggle').click(); await wait(450);
        out.reopen = [side().classList.contains('collapsed'), document.querySelectorAll('.course-item').length];
        return out; })()""")
    ok = bool(res) and res["open"] > 200 and res["closed"][0] and res["closed"][1] < 80 and res["closed"][2] == 2 and res["closed"][3] is True \
        and res["switch"] == [True, True, 1] and res["reopen"] == [False, 2]
    report("Kursliste: einklappen, Kurs über Kürzel wechseln, ausklappen", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_tests_view_check(br, base):
    print("Tests-Reiter (Breite, Unterschrift bei Klassenarbeiten):")
    br.call("Emulation.setDeviceMetricsOverride", width=2560, height=1300, deviceScaleFactor=1, mobile=False)
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const c = NM.app.db().courses[0];
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const a = c.assessments.find((x) => x.kind === 'test');
        const out = { wide: document.getElementById('view').getBoundingClientRect().width > 1600 };
        const boxes = () => [...document.querySelectorAll('[data-focus-key^="ts-signed-"]')];
        out.ka = [a.cat, boxes().length];
        const sid = c.students[0].id;
        const box = document.querySelector(`[data-focus-key="ts-signed-${sid}"]`);
        box.checked = true; box.dispatchEvent(new Event('change')); await wait();
        out.signed = [a.test.results[sid].signed === NM.util.todayISO(), document.querySelector('.card-head .chip, .card-head .pill').textContent === 'Unterschriften 1 / 11'];
        NM.print.test(c, a, 'list'); await wait();
        out.print = document.getElementById('print-root').textContent.includes('Unterschr.');
        document.body.classList.remove('printing');
        a.cat = 'other'; NM.app.rerender(); await wait();
        out.other = boxes().length;
        a.cat = 'ka'; NM.app.rerender(); await wait();
        return out; })()""")
    br.call("Emulation.clearDeviceMetricsOverride")
    ok = bool(res) and res["wide"] and res["ka"] == ["ka", 12] and res["signed"] == [True, True] and res["print"] and res["other"] == 0
    report("Tests: volle Breite, Unterschrift abhaken/zählen/drucken, nur bei Klassenarbeiten", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_task_add_click_check(br, base):
    print("Tests: Punkte eingeben, dann „+ Aufgabe“ mit einem Klick:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    pos = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const c = NM.app.db().courses[0];
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const a = c.assessments.find((x) => x.kind === 'test');
        window.__t = a.test;
        const inp = document.querySelector('.task-max');
        inp.focus(); inp.select();
        window.__task = a.test.tasks.find((x) => inp.dataset.focusKey === 'task-max-' + x.id);
        const btn = [...document.querySelectorAll('.tasks button')].find((b) => b.textContent === '+ Aufgabe');
        btn.scrollIntoView({ block: 'center' }); await wait(50);
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, n: a.test.tasks.length }; })()""")
    br.call("Input.insertText", text="7")
    for typ in ("mousePressed", "mouseReleased"):
        br.call("Input.dispatchMouseEvent", type=typ, x=pos["x"], y=pos["y"], button="left", clickCount=1)
        time.sleep(0.05)
    time.sleep(0.4)
    res = br.eval("({ n: __t.tasks.length, max: __task.max })")
    # Nach echtem Klick (Nutzeraktivierung) würde „Seite verlassen?“ das nächste Laden blockieren
    br.eval("(NM.app.state.dirty = false, 1)")
    ok = res["n"] == pos["n"] + 1 and res["max"] == 7
    report("Ein Klick übernimmt die Punkte und legt die Aufgabe an", ok and not br.errors, f"{pos} {res} " + "; ".join(br.errors))


def run_makeup_check(br, base):
    print("Nachschreibtermin (eine Spalte mit der Original-Arbeit):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0], G = NM.grades;
        const out = {};
        const ka = c.assessments.find((x) => x.kind === 'test' && x.name === 'KA 1 – Terme');
        const demoNs = G.makeupsOf(c, ka)[0];
        const s11 = c.students[11];
        // Übersicht: keine eigene Spalte, Note mit „N“ in der KA-Spalte
        NM.app.state.ui.half[c.id] = 'HJ1'; NM.app.select({ courseId: c.id, tab: 'overview' }); await wait();
        const heads = () => [...document.querySelectorAll('.overview-table thead th.assess-head')].map((th) => th.textContent);
        out.noOwnCol = !heads().some((t) => t.includes('Nachschreibtermin')) && heads().some((t) => t.includes('KA 1'));
        out.mark = document.querySelectorAll('.overview-table td.makeup-cell').length;
        out.demoP = G.assessmentPoints(ka, s11.id, 'sek1', c) === G.testResult(demoNs.test, s11.id, 'sek1').p && G.halfResult(c, 'HJ1', s11.id).ka !== null;
        out.check = NM.model.check(db).filter((x) => /Nachschreib/.test(x.text || x.msg || JSON.stringify(x))).length;
        // Tests: „+ Nachschreibtermin“ an der KA
        NM.app.state.ui.testId[c.id] = ka.id; NM.app.select({ tab: 'tests' }); await wait();
        document.querySelector('[data-new-makeup]').click(); await wait();
        const ns = c.assessments[c.assessments.length - 1];
        ns.date = '2099-01-01';
        out.created = ns.makeupOf === ka.id && NM.app.state.ui.testId[c.id] === ns.id && ns.test.tasks.length === ka.test.tasks.length;
        out.info = !!document.querySelector('.makeup-info') && !document.querySelector('[data-new-makeup]');
        const rows = () => document.querySelectorAll('.grid-table tbody tr:not(.foot)').length;
        out.rowsMissing = rows();
        document.querySelector('[data-makeup-all]').click(); await wait();
        out.rowsAll = rows();
        document.querySelector('[data-makeup-all]').click(); await wait();
        out.rowsBack = rows();
        // Punkte im neuen (späteren) Termin → zählen statt des ersten Nachschreibtermins
        ns.test.results[s11.id] = { scores: { [ns.test.tasks[0].id]: 2, [ns.test.tasks[2].id]: 6 } };
        NM.app.commit(); await wait();
        out.s11 = G.assessmentPoints(ka, s11.id, 'sek1', c) === G.testResult(ns.test, s11.id, 'sek1').p && G.countingFor(c, ka, s11.id) === ns;
        out.half = G.halfResult(c, 'HJ1', s11.id).ka !== null;
        // Gewicht der KA ändern → Nachschreibtermin folgt
        ka.weight = 3; NM.app.commit(); await wait();
        out.sync = ns.weight === 3 && demoNs.weight === 3;
        // Verknüpfung über die Auswahl lösen → eigene Spalte
        const sel = document.querySelector('[data-makeup-of]');
        sel.value = ''; sel.dispatchEvent(new Event('change')); await wait();
        out.unlinked = ns.makeupOf === undefined;
        NM.app.select({ tab: 'overview' }); await wait();
        out.ownCol = heads().filter((t) => t.includes('Nachschreibtermin')).length;
        // wieder verknüpfen, dann Original löschen → beide werden eigene Tests
        NM.app.select({ tab: 'tests' }); await wait();
        const sel2 = document.querySelector('[data-makeup-of]');
        sel2.value = ka.id; sel2.dispatchEvent(new Event('change')); await wait();
        out.relinked = ns.makeupOf === ka.id;
        c.assessments = c.assessments.filter((x) => x !== ka); NM.app.commit(); await wait();
        out.orphan = ns.makeupOf === undefined && demoNs.makeupOf === undefined;
        NM.app.state.dirty = false;
        return out; })()""")
    report("Übersicht: Nachschreibtermin in der Spalte der Arbeit (mit „N“), Rechnung, Datenbank prüfen",
           res["noOwnCol"] and res["mark"] == 1 and res["demoP"] and res["check"] == 0, str(res))
    report("Tests: „+ Nachschreibtermin“, nur Fehlende (umschaltbar), Punkte zählen in der KA, Gewicht folgt",
           res["created"] and res["info"] and res["rowsMissing"] == 1 and res["rowsAll"] == 12 and res["rowsBack"] == 1 and res["s11"] and res["half"] and res["sync"], str(res))
    report("Verknüpfung lösen/setzen, Original löschen macht eigene Tests",
           res["unlinked"] and res["ownCol"] == 1 and res["relinked"] and res["orphan"] and not br.errors, str(res) + " " + "; ".join(br.errors))


def qr_lesen(art, inhalt, endung):
    """QR-Codes mit zxing-cpp lesen (tests/qr_lesen.py in eigener uv-Umgebung). Liefert (Ergebnis, Fehlertext)."""
    tmp = tempfile.mkdtemp(prefix="nm-qr-")
    try:
        pfad = os.path.join(tmp, "eingabe" + endung)
        with open(pfad, "wb") as f:
            f.write(inhalt)
        skript = os.path.join(ROOT, "tests", "qr_lesen.py")
        uv = shutil.which("uv")
        cmd = ([uv, "run", "-q", "--with", "zxing-cpp", "--with", "pillow", "--with", "pypdfium2", "python", "-I", skript]
               if uv else [sys.executable, "-I", skript])
        p = subprocess.run(cmd + [art, pfad], capture_output=True, text=True, timeout=300, cwd=tmp)
        if p.returncode:
            return None, ("zxing-cpp nicht verfügbar (uv installieren oder pip install zxing-cpp pillow pypdfium2): " if not uv else "") + p.stderr[-400:]
        return json.loads(p.stdout), ""
    except Exception as e:  # noqa: BLE001
        return None, str(e)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def run_scripto_check(br, base):
    print("OrdoScripto (IDs, Import-CSV, Trennblätter mit QR-Code, zxing-cpp):")
    # 1. Modulmatrizen aus der App: mehrere Inhalte, Versionen 1–10, alle Masken
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    faelle = br.eval("""(() => {
        const out = [];
        const texts = ['S-7F3K9Q', 'ORDO|T-2026-01', 'ORDO|T-2026-0142|S-7F3K9Q', 'ORDO|T-2027-8999|S-ZZ2345', 'Ä ö ü ß – € UTF-8', 'x'.repeat(150)];
        for (const t of texts) for (let v = 1; v <= 10; v++) for (let m = 0; m < 8; m++) {
            if (NM.qr.byteCapacity(v) < new TextEncoder().encode(t).length) continue;
            const q = NM.qr.encode(t, { minVersion: v, mask: m });
            out.push({ t, v: q.version, m: q.mask, mod: q.modules });
        }
        return out; })()""")
    gelesen, fehler = qr_lesen("matrizen", json.dumps([f["mod"] for f in faelle]).encode(), ".json")
    falsch = [f"V{f['v']} M{f['m']} {f['t'][:20]!r} → {g!r}" for f, g in zip(faelle, gelesen or [])  if g != f["t"]]
    versionen = sorted({f["v"] for f in faelle})
    report(f"zxing-cpp liest {len(faelle)} Codes exakt (Versionen {versionen[0]}–{versionen[-1]}, alle 8 Masken, UTF-8)",
           gelesen is not None and len(gelesen) == len(faelle) and not falsch and versionen == list(range(1, 11)),
           fehler or "; ".join(falsch[:5]))

    # 2. Oberfläche: vorbereiten (Einstufung erfragen), Karte, Import-CSV, Druckauswahl
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const db = NM.app.db(), c = db.courses[0], S = NM.scripto, M = NM.model;
        const out = {};
        M.setCourseEinstufung(c, 'U');
        const ka = c.assessments.find((x) => x.kind === 'test' && x.name === 'KA 1 – Terme');
        NM.app.state.ui.half[c.id] = ka.half; NM.app.state.ui.testId[c.id] = ka.id;
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const menuHas = async (id) => { document.querySelector('[data-print-menu]').click(); await wait();
            const has = !!document.querySelector('dialog [data-print="' + id + '"]');
            [...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Abbrechen').click(); await wait(); return has; };
        out.before = [!!document.querySelector('[data-scripto-prepare]'), !document.querySelector('[data-scripto-card]'), await menuHas('scripto')];
        // Vorbereiten ohne Rückfrage (die Einstufung geht unverändert in die CSV)
        document.querySelector('[data-scripto-prepare]').click(); await wait(300);
        out.noAsk = !document.querySelector('dialog[open]');
        const d = ka.test.scripto;
        const act = M.activeStudents(c);
        out.prepared = [out.noAsk, S.TEST_ID.test(d.testId), act.every((s) => S.STUDENT_ID.test(d.ids[s.id])), new Set(Object.values(d.ids)).size === act.length,
            !!document.querySelector('[data-scripto-card]'), !document.querySelector('[data-scripto-prepare]'), (document.querySelector('[data-scripto-id]') || {}).textContent === d.testId, await menuHas('scripto')];
        // Import-CSV
        const dl = []; const origDl = NM.util.download; NM.util.download = (n, t) => dl.push([n, t]);
        document.querySelector('[data-scripto-csv]').click(); await wait();
        NM.util.download = origDl;
        const lines = dl.length ? dl[0][1].split('\\n') : [];
        out.csv = [dl.length, dl[0] && dl[0][0] === d.testId + '_import.csv', lines[0], lines.length - 2 === act.length, lines.slice(1, -1).every((l) => l.split(';').length === 3 && l.endsWith(';U')),
            !c.students.some((s) => dl[0][1].includes(s.last) || dl[0][1].includes(s.first))];
        // Druckauswahl → Trennblätter für alle
        document.querySelector('[data-print-menu]').click(); await wait();
        document.querySelector('dialog [data-print="scripto"]').click(); await wait();
        out.whoKa = document.querySelector('dialog [data-scripto-who]').value;
        document.querySelector('dialog .btn-primary').click(); await wait(300);
        const sheets = [...document.querySelectorAll('#print-root [data-scripto-sheet]')];
        out.sheets = [sheets.length === act.length, sheets.map((x) => x.dataset.scriptoSheet).join() === act.map((s) => d.ids[s.id]).join(),
            sheets[0].textContent.includes(act[0].first + ' ' + act[0].last), sheets[0].textContent.includes(M.courseTitle(c)), sheets[0].textContent.includes(d.testId + ' · ' + d.ids[act[0].id]),
            sheets[0].textContent.includes('Trennblatt – vor die Arbeit des Schülers legen'), !!sheets[0].querySelector('.p-sc-qr svg'), document.body.classList.contains('printing')];
        out.expected = act.map((s) => S.qrText(d.testId, d.ids[s.id]));
        return out; })()""")
    report("Vorbereiten: ohne Rückfrage, Test-ID, eine ID je Person, Karte, Druckauswahl",
           res["before"] == [True, True, False] and res["prepared"] == [True, True, True, True, True, True, True, True], str({k: res[k] for k in ("before", "prepared")}))
    report("Import-CSV: Dateiname, Kopfzeile, eine Zeile je Person, drei Spalten, Einstufung U, keine Namen",
           res["csv"] == [1, True, "test_id;schueler_id;kurs", True, True, True], str(res["csv"]))
    report("Trennblätter: je Person eine Seite in Listenreihenfolge, Name, Klasse, IDs, Hinweis, QR-Code",
           res["whoKa"] == "all" and all(res["sheets"]), str(res["sheets"]) + " " + res["whoKa"])
    # Trennblätter als PDF (wie „Als PDF speichern“) mit 300 dpi rastern und mit zxing-cpp lesen
    pdf = br.call("Page.printToPDF", preferCSSPageSize=True, printBackground=True).get("result", {}).get("data")
    seiten, fehler = qr_lesen("pdf", base64.b64decode(pdf or ""), ".pdf")
    erwartet = [[t] for t in res["expected"]]
    report(f"PDF der Trennblätter: {len(res['expected'])} Seiten, jeder QR-Code liest sich exakt als ORDO|Test-ID|Schüler-ID",
           seiten == erwartet, fehler or f"{(seiten or [])[:3]} … erwartet {erwartet[:3]}")

    # 3. Nachschreibtermin, neue Person, Kursdialog
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        window.dispatchEvent(new Event('afterprint'));
        const db = NM.app.db(), c = db.courses[0], S = NM.scripto, G = NM.grades, M = NM.model;
        const out = {};
        const ka = c.assessments.find((x) => x.kind === 'test' && x.name === 'KA 1 – Terme');
        const d = ka.test.scripto, before = JSON.stringify(d.ids), seq = db.settings.scriptoSeq;
        const ns = G.makeupsOf(c, ka)[0];
        NM.app.state.ui.testId[c.id] = ns.id; NM.app.rerender(); await wait();
        out.makeupCard = [(document.querySelector('[data-scripto-id]') || {}).textContent === d.testId, !document.querySelector('[data-scripto-prepare]'), !ns.test.scripto];
        document.querySelector('[data-print-menu]').click(); await wait();
        document.querySelector('dialog [data-print="scripto"]').click(); await wait();
        out.whoNs = document.querySelector('dialog [data-scripto-who]').value;
        document.querySelector('dialog .btn-primary').click(); await wait(300);
        const want = S.makeupStudents(c, ns).map((s) => d.ids[s.id]);
        out.nsSheets = [want.length > 0, [...document.querySelectorAll('#print-root [data-scripto-sheet]')].map((x) => x.dataset.scriptoSheet).join() === want.join(),
            document.querySelector('#print-root').textContent.includes('Nachschreibtermin')];
        window.dispatchEvent(new Event('afterprint'));
        // neuer Nachschreibtermin: kopiert keine IDs, nutzt die der Arbeit
        const ns2 = M.newMakeup(c, ka);
        out.copy = ns2.test.scripto === undefined && S.dataOf(c, ns2) === d;
        // neue Person: Knopf „+ IDs“, vergebene bleiben
        c.students.push({ id: 'neu-scripto', last: 'Neumann', first: 'Nele', active: true });
        NM.app.commit(); await wait();
        const add = document.querySelector('[data-scripto-add]');
        out.addBtn = !!add && add.textContent.includes('1 neue Person');
        add.click(); await wait();
        const old = JSON.parse(before);
        out.added = [S.STUDENT_ID.test(d.ids['neu-scripto'] || ''), Object.keys(old).every((k) => old[k] === d.ids[k]), !document.querySelector('[data-scripto-add]'), db.settings.scriptoSeq === seq, d.testId === ka.test.scripto.testId];
        // anderer Test: neue Test-ID, andere Pseudonyme
        const other = c.assessments.find((x) => x.kind === 'test' && x !== ka && !G.isMakeup(c, x));
        const r = S.prepare(db, c, other);
        out.other = [r.data.testId !== d.testId, S.nextSeq(db) === seq + 2, Object.keys(r.data.ids).every((k) => r.data.ids[k] !== d.ids[k])];
        // Kurs & Schüler: Kurs auf E (keine Abweichungen → ohne Rückfrage), eine Person E1, dann Kurs E2 mit Rückfrage
        NM.app.select({ tab: 'course' }); await wait();
        const sel = () => document.querySelector('[data-einstufung]');
        out.courseField = !!sel() && sel().value === 'U' && sel().options.length === 5;
        sel().value = 'E'; sel().dispatchEvent(new Event('change')); await wait();
        out.courseSet = c.einstufung === 'E' && !document.querySelector('dialog[open]') && S.importCsv(c, ka).text.trim().split('\\n').slice(1).every((l) => l.endsWith(';E'));
        const p = M.activeStudents(c)[2];
        const ps = () => document.querySelector('[data-student-einstufung="' + p.id + '"]');
        out.studentField = ps().value === 'E' && !ps().classList.contains('level-own');
        ps().value = 'G'; ps().dispatchEvent(new Event('change')); await wait();
        const line = () => S.importCsv(c, ka).text.split('\\n').find((l) => l.includes(d.ids[p.id]));
        out.studentSet = p.einstufung === 'G' && ps().classList.contains('level-own') && line().endsWith(';G') && M.activeStudents(c).filter((x) => x.einstufung).length === 1;
        sel().value = 'E2'; sel().dispatchEvent(new Event('change')); await wait();
        out.ask = !!document.querySelector('dialog[open]') && document.querySelector('dialog[open]').textContent.includes(p.last);
        [...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Abweichungen behalten').click(); await wait();
        out.kept = c.einstufung === 'E2' && p.einstufung === 'G' && line().endsWith(';G') && S.kursFor(c, ka, M.activeStudents(c)[0]) === 'E2';
        sel().value = 'E1'; sel().dispatchEvent(new Event('change')); await wait();
        [...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Für alle setzen').click(); await wait();
        out.all = c.einstufung === 'E1' && p.einstufung === undefined && ps().value === 'E1' && line().endsWith(';E1');
        // Oberstufe: Auswahl undifferenziert, Grundkurs, Leistungskurs (der alte Wert E1 bleibt sichtbar)
        const jg = c.jahrgang; c.jahrgang = 12; NM.app.commit(); await wait();
        const opts = (el) => [...el.options].map((o) => o.value).join(',');
        out.mssOpts = [opts(sel()), opts(ps())];
        sel().value = 'LK'; sel().dispatchEvent(new Event('change')); await wait();
        ps().value = 'GK'; ps().dispatchEvent(new Event('change')); await wait();
        out.mss = c.einstufung === 'LK' && p.einstufung === 'GK' && opts(sel()) === 'U,GK,LK' && line().endsWith(';GK') && S.kursFor(c, ka, M.activeStudents(c)[0]) === 'LK';
        M.setCourseEinstufung(c, 'E1'); c.jahrgang = jg; NM.app.commit(); await wait();
        out.check = M.check(db).filter((x) => x.level === 'fehler').length;
        NM.app.state.dirty = false;
        return out; })()""")
    report("Nachschreibtermin: gleiche Test-ID und IDs, vorausgewählt „nur Nachschreibende“, keine Kopie",
           all(res["makeupCard"]) and res["whoNs"] == "makeup" and all(res["nsSheets"]) and res["copy"], str(res))
    report("Neue Person: „+ IDs“ ergänzt, vergebene IDs bleiben; anderer Test bekommt neue Test-ID und Pseudonyme",
           res["addBtn"] and all(res["added"]) and all(res["other"]), str(res))
    report("Einstufung: Kurs (5 Stufen) für alle, je Person abweichend, Rückfrage behalten/für alle; CSV mit der Einstufung je Person; MSS mit GK/LK",
           res["courseField"] and res["courseSet"] and res["studentField"] and res["studentSet"] and res["ask"] and res["kept"] and res["all"]
           and res["mssOpts"] == ["U,E1,GK,LK", "U,E1,GK,LK"] and res["mss"]
           and res["check"] == 0 and not br.errors, str(res) + " " + "; ".join(br.errors))


def run_unreachable_check(br, base):
    print("Notenschlüssel: Warnung bei zu wenig Punkten:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0];
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const half = NM.app.currentHalf(c);
        const a = NM.model.newTest(c, half, db.settings);
        a.test.tasks = [{ id: 'a1', name: 'A1', max: 18 }]; a.test.precision = 1; a.test.limit = 50;
        c.assessments.push(a); NM.app.state.ui.testId[c.id] = a.id; NM.app.commit(); await wait();
        const warn = () => document.querySelector('.key-warn');
        const btn = (t) => [...document.querySelectorAll('.key-warn button')].find((b) => b.textContent === t);
        const out = { text: warn() && warn().textContent, rows: document.querySelectorAll('.key-table tr.unreachable').length,
                      buttons: [...document.querySelectorAll('.key-warn button')].map((b) => b.textContent) };
        btn('½ Halbe Punkte').click(); await wait();
        out.half = [a.test.precision, !!warn()];
        a.test.precision = 1; NM.app.rerender(); await wait();
        btn('Nur ganze Noten').click(); await wait();
        out.whole = [!!a.test.wholeGrades, !!warn()];
        a.test.tasks[0].max = 40; delete a.test.wholeGrades; NM.app.rerender(); await wait();
        out.enough = !!warn();
        return out; })()""")
    ok = bool(res) and "2 und 3- sind nicht erreichbar" in (res["text"] or "") and res["rows"] == 2 \
        and res["buttons"] == ["½ Halbe Punkte", "Nur ganze Noten"] and res["half"] == [0.5, False] \
        and res["whole"] == [True, False] and res["enough"] is False
    report("Schlüssel: Warnung bei doppelten Schwellen, halbe Punkte/ganze Noten lösen sie", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_tabs_check(br, base):
    print("Reiter ein-/ausschalten (Standard und je Kurs):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), [c1, c2] = db.courses;
        const tabs = () => [...document.querySelectorAll('.tabs .tab')].map((b) => b.textContent);
        const active = () => document.querySelector('.tabs .tab.active').textContent;
        const toggle = (id, on) => { const x = document.querySelector(`[data-tab-check="${id}"]`); x.checked = on; x.dispatchEvent(new Event('change')); };
        const out = { all: tabs().length };
        // Standard: Sitzplan aus (Einstellungen)
        NM.app.select({ courseId: c1.id, tab: 'settings' }); await wait();
        toggle('seating', false); await wait();
        out.def = [db.settings.tabs.seating, tabs().includes('Sitzplan'), document.querySelectorAll('[data-tab-check]').length];
        // Kurs 1: Sitzplan wieder an, Präsentationen aus (Kurs & Schüler)
        NM.app.select({ tab: 'course' }); await wait();
        toggle('seating', true); await wait();
        toggle('pres', false); await wait();
        out.own = [JSON.stringify(c1.tabs), tabs().includes('Sitzplan'), tabs().includes('Präsentationen'), document.querySelectorAll('.tab-checks .muted').length];
        // ausgeschalteter Reiter → Notenübersicht; Sprunglink „Präs. ›“ fehlt
        NM.app.select({ tab: 'pres' }); await wait();
        out.fallback = [active(), !!document.querySelector('.overview-table'), [...document.querySelectorAll('.assess-head .link.tiny')].some((b) => b.textContent === 'Präs. ›')];
        // Kurs 2 folgt dem Standard
        NM.app.select({ courseId: c2.id, tab: 'course' }); await wait();
        out.other = [tabs().includes('Sitzplan'), tabs().includes('Präsentationen')];
        // Notenübersicht aus → „Kurs & Schüler“
        toggle('overview', false); await wait();
        NM.app.select({ tab: 'overview' }); await wait();
        out.noOverview = active();
        // Wie Standard
        NM.app.select({ tab: 'course' }); await wait();
        [...document.querySelectorAll('button')].find((b) => b.textContent === 'Wie Standard').click(); await wait();
        out.reset = [c2.tabs === undefined, tabs().includes('Notenübersicht')];
        return out; })()""")
    ok = bool(res) and res["all"] == 10 and res["def"] == [False, False, 8] and res["own"] == ['{"seating":true,"pres":false}', True, False, 2] \
        and res["fallback"] == ["Notenübersicht", True, False] and res["other"] == [False, True] and res["noOverview"] == "Kurs & Schüler" and res["reset"] == [True, True]
    report("Reiter: Standard in Einstellungen, Abweichung je Kurs, Ersatzreiter, Sprunglinks, „Wie Standard“", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_tab_order_check(br, base):
    print("Reiter umsortieren:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0];
        const tabs = () => [...document.querySelectorAll('.tabs .tab')].map((b) => b.dataset.tab);
        const out = { start: tabs().join() };
        NM.app.select({ courseId: c.id, tab: 'settings' }); await wait();
        // ▲ bei „Notenübersicht“ zweimal: vor „Zufall“ ... (Standard: …, draw, random, groups, overview, …)
        const up = (id) => document.querySelector(`[data-tab-order="${id}"] button`).click();
        up('overview'); await wait(); up('overview'); await wait();
        out.up = [tabs().join(), db.settings.tabOrder.join()];
        out.checks = [...document.querySelectorAll('[data-tab-check]')].map((x) => x.dataset.tabCheck).join();
        // Ziehen in der Reiterleiste: „Sitzplan“ vor „Tests“
        const src = document.querySelector('.tabs [data-tab="seating"]'), dst = document.querySelector('.tabs [data-tab="tests"]');
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
        const r = dst.getBoundingClientRect();
        dst.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 2, clientY: r.top + 5 }));
        dst.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true, clientX: r.left + 2, clientY: r.top + 5 }));
        await wait();
        out.drag = tabs().join();
        // Ausgeschalteter Reiter behält seinen Platz
        db.settings.tabs.pres = false; NM.app.renderShell(); await wait();
        out.off = tabs().join();
        delete db.settings.tabs.pres; NM.app.renderShell(); await wait();
        out.on = tabs().join();
        // Standardreihenfolge
        [...document.querySelectorAll('.tab-order button')].find((b) => b.textContent === 'Standardreihenfolge').click(); await wait();
        out.reset = [tabs().join(), db.settings.tabOrder.length];
        return out; })()""")
    std = "course,tests,epo,pres,draw,random,groups,overview,seating,settings"
    up = "course,tests,epo,pres,draw,overview,random,groups,seating,settings"
    drag = "course,seating,tests,epo,pres,draw,overview,random,groups,settings"
    ok = bool(res) and res["start"] == std and res["up"] == [up, up] and res["checks"] == "tests,epo,pres,draw,overview,random,groups,seating" \
        and res["drag"] == drag and res["off"] == drag.replace("pres,", "") and res["on"] == drag and res["reset"] == [std, 0]
    report("Reiter: ▲▼ in den Einstellungen, Ziehen in der Reiterleiste, Haken in derselben Reihenfolge, Standardreihenfolge", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_overview_fold_check(br, base):
    print("Notenübersicht: Gruppen einklappen, Ziehungen bündeln:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0];
        NM.app.state.ui.ovFold = {};
        NM.app.select({ courseId: c.id, tab: 'overview' }); await wait();
        const half = NM.app.currentHalf(c, true);
        // Zwei Ziehungsspalten anlegen (wie der Reiter „Ziehen“)
        const [s1, s2, s3] = c.students;
        const z1 = NM.model.newManual(half, 'other', 'HA-Kontrolle 01.10.'); z1.date = '2026-10-01'; z1.manual.grades[s1.id] = { p: 11 };
        const z2 = NM.model.newManual(half, 'other', 'HA-Kontrolle 08.10.'); z2.date = '2026-10-08'; z2.manual.grades[s2.id] = { p: 8 }; z2.manual.grades[s1.id] = { status: 'fehlt' };
        c.assessments.push(z1, z2);
        c.draw = c.draw || { out: {}, history: [] };
        c.draw.history.push({ id: 'h1', date: z1.date, half, aid: z1.id, sids: [s1.id], prevOut: {} }, { id: 'h2', date: z2.date, half, aid: z2.id, sids: [s2.id, s1.id], prevOut: {} });
        NM.app.commit(); await wait();
        const heads = () => document.querySelectorAll('.overview-table thead tr:nth-child(2) th').length;
        const raws = () => [...document.querySelectorAll('.overview-table tbody td.result .raw')].map((x) => x.textContent).join('|');
        const fold = (k) => document.querySelector(`[data-fold="${k}"]`).click();
        const cols = () => [...document.querySelectorAll('.overview-table [data-col]')].map((x) => Number(x.dataset.col));
        const out = { heads: heads(), raw: raws() };
        const kaN = c.assessments.filter((a) => a.half === half && a.cat === 'ka' && !NM.grades.isMakeup(c, a)).length;
        fold('ka'); await wait();
        out.ka = [out.heads - heads() === kaN, raws() === out.raw, document.querySelector('[data-fold="ka"]').textContent.includes('(' + kaN + ')'), NM.app.state.ui.ovFold.ka];
        fold('ka'); await wait();
        fold('other'); await wait();
        out.other = [heads() < out.heads, raws() === out.raw, !document.querySelector('.draw-bundle-btn')];
        fold('other'); await wait();
        const btn = document.querySelector('.draw-bundle-btn');
        out.btn = btn && btn.textContent;
        btn.click(); await wait();
        const bundle = [...document.querySelectorAll('.overview-table thead th.draw-bundle')];
        const row1 = [...document.querySelectorAll('.overview-table tbody tr')].find((tr) => tr.textContent.includes(s1.last));
        const cell1 = row1.querySelector('td.draw-bundle');
        const c2 = cols();
        out.bundle = [heads() === out.heads - 1, bundle.length, bundle[0] && bundle[0].textContent, cell1 && cell1.textContent, raws() === out.raw,
                      Math.max(...c2) + 1 === new Set(c2).size];
        // Ausdruck zeigt weiter alle Spalten
        NM.print.course(c, half); await wait();
        out.print = document.getElementById('print-root').textContent.includes('HA-Kontrolle 08.10.');
        document.body.classList.remove('printing');
        document.querySelector('.draw-bundle-btn').click(); await wait();
        out.back = heads() === out.heads;
        return out; })()""")
    ok = bool(res) and res["ka"] == [True, True, True, True] and res["other"] == [True, True, True] and res["btn"] == "Ziehungen bündeln (2)" \
        and res["bundle"][:3] == [True, 1, "Ziehen (2)01.10.–08.10."] and "f" in (res["bundle"][3] or "") and "2" in (res["bundle"][3] or "") \
        and res["bundle"][4] and res["bundle"][5] and res["print"] and res["back"]
    report("Notenübersicht: Gruppen ein-/ausklappen (Noten unverändert), Ziehungen bündeln mit Zeitraum, Ausdruck vollständig", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_timer_check(br, base):
    print("Tools: Timer (Countdown, Designs, Pop-up):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), c = db.courses[0], nA = c.assessments.length;
        const alarms = [];
        NM.pomodoro.alarm = (k, v) => alarms.push(k);
        NM.app.select({ courseId: c.id, tab: 'random' }); await wait(300);
        const q = (sel, d = document) => d.querySelector(sel);
        const digits = (d = document) => q('.tmr-digits', d).textContent;
        const stage = (d = document) => q('.tmr-face', d).dataset.stage;
        const out = { label: [...document.querySelectorAll('.tabs .tab')].find((b) => b.dataset.tab === 'random').textContent, head: q('#view h1').textContent };
        const inp = q('[data-tmr-input]'); inp.value = '0:03'; inp.dispatchEvent(new Event('change')); await wait();
        out.set = [digits(), stage()];
        q('[data-tmr-go]').click(); await wait(1200);
        out.run = [digits(), stage(), q('[data-tmr-go]').textContent];
        q('[data-tmr-go]').click(); const paused = digits(); await wait(1100);
        out.pause = [digits() === paused, stage(), q('.tmr-over').textContent, q('[data-tmr-go]').textContent];
        // Reiterwechsel: läuft weiter
        q('[data-tmr-go]').click(); await wait(200);
        NM.app.select({ tab: 'overview' }); await wait(2600);
        NM.app.select({ tab: 'random' }); await wait(300);
        out.done = [digits(), stage(), q('.tmr-over').textContent.startsWith('Zeit ist um!'), alarms.join()];
        // +1 Minute nach dem Ende → läuft wieder
        [...document.querySelectorAll('.tmr-buttons button')].find((b) => b.textContent === '+ 1 Min.').click(); await wait(300);
        out.plus = [digits(), stage()];
        q('[data-tmr-reset]').click(); await wait();
        out.reset = [stage(), q('[data-tmr-go]').textContent];
        // Schnellwahl
        q('[data-tmr-quick="10"]').click(); await wait();
        out.quick = [digits(), q('[data-tmr-input]').value, NM.app.state.ui.random.timerMs];
        // Designs
        out.designs = [];
        for (const d of ['digits', 'bar', 'hourglass', 'ring']) {
            const sel = q('[data-tmr-design]'); sel.value = d; sel.dispatchEvent(new Event('change')); await wait();
            out.designs.push(q('.tmr-face').dataset.tmrFace === d && !!q('.tmr-digits').textContent);
        }
        out.noGrades = c.assessments.length === nA;
        // Einstellungen aller Werkzeuge werden gespeichert (früher ging z. B. „von“ der Zufallszahl verloren)
        const mi = q('[data-rnd-min]'); mi.value = '3'; mi.dispatchEvent(new Event('change')); await wait();
        out.saved = [JSON.parse(localStorage.getItem('nm.ui.demo')).random.min, JSON.parse(localStorage.getItem('nm.ui.demo')).random.timerDesign];
        return out; })()""")
    # Pop-up: Fenster öffnen nur mit Nutzergeste (wie ein echter Klick)
    r = br.call("Runtime.evaluate", userGesture=True, awaitPromise=True, returnByValue=True, expression="""(async () => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const q = (sel, d = document) => d.querySelector(sel);
        const digits = (d = document) => q('.tmr-digits', d).textContent;
        const stage = (d = document) => q('.tmr-face', d).dataset.stage;
        q('[data-tmr-popup]').click(); await wait(800);
        const w = NM.views.random.timer.clock.popup, pd = w && w.document;
        const out = { popup: pd ? [!!q('.tmr-face', pd), digits(pd) === digits(), pd.title] : null };
        if (pd) { q('[data-tmr-go]', pd).click(); await wait(1300); out.popupRun = [stage(pd), stage(), digits(pd) === digits()]; q('[data-tmr-go]', pd).click(); w.close(); }
        q('[data-tmr-reset]').click(); await wait();
        return out; })()""")
    res2 = r.get("result", {}).get("result", {}).get("value") or {}
    if res: res.update(res2)
    ok = bool(res) and res["label"] == "Tools" and res["head"] == "Tools" and res["set"] == ["00:03", "idle"] \
        and res["run"][0] in ("00:02", "00:01") and res["run"][1] == "end" and res["run"][2] == "⏸ Pause" \
        and res["pause"] == [True, "paused", "angehalten", "▶ Weiter"] \
        and res["done"][:3] == ["00:00", "done", True] and res["done"][3] == "gong" \
        and res["plus"][0] in ("01:00", "00:59") and res["plus"][1] in ("run", "warn") and res["reset"] == ["idle", "▶ Start"] \
        and res["quick"] == ["10:00", "10:00", 600000] and res["designs"] == [True] * 4 \
        and res.get("popup") and res["popup"][:2] == [True, True] and res["popupRun"] == ["run", "run", True] and res["noGrades"] and res["saved"] == [3, "ring"]
    report("Timer: Zeit setzen, Start/Pause, läuft beim Reiterwechsel weiter, Ende mit Signal, ±1 Min., Schnellwahl, 4 Designs, Pop-up steuert denselben Timer", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_tools_layout_check(br, base):
    print("Tools: gleich große Kacheln, Ring läuft im Uhrzeigersinn:")
    br.call("Emulation.setDeviceMetricsOverride", width=1600, height=1000, deviceScaleFactor=1, mobile=False)
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
        const c = NM.app.db().courses[0];
        NM.app.select({ courseId: c.id, tab: 'random' }); await wait(400);
        const sizes = [...document.querySelectorAll('.rnd-tool')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
        const q = (sel) => document.querySelector(sel);
        const sel = q('[data-tmr-design]'); sel.value = 'ring'; sel.dispatchEvent(new Event('change')); await wait();
        const inp = q('[data-tmr-input]'); inp.value = '0:08'; inp.dispatchEvent(new Event('change')); await wait();
        q('[data-tmr-go]').click(); await wait(2000);
        const prog = q('.tmr-ring-prog');
        const C = Number(prog.getAttribute('stroke-dasharray')), off = Number(prog.getAttribute('stroke-dashoffset'));
        q('[data-tmr-reset]').click(); await wait();
        return { sizes, n: new Set(sizes).size, ratio: off / C }; })()""")
    br.call("Emulation.clearDeviceMetricsOverride")
    report("Alle Werkzeug-Kacheln gleich groß", bool(res) and len(res["sizes"]) == 5 and res["n"] == 1, str(res))
    # Rest endet bei 12 Uhr: negativer Versatz (nach 2 von 8 s etwa −¼ des Umfangs)
    report("Timer-Ring läuft im Uhrzeigersinn", bool(res) and -0.4 < res["ratio"] < -0.15 and not br.errors, str(res) + "; ".join(br.errors))


def run_tools_menu_check(br, base):
    print("Tools: Werkzeuge je Kurs ein-/ausschalten und sortieren:")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const db = NM.app.db(), [c, d] = db.courses;
        const tiles = () => [...document.querySelectorAll('.rnd-tool')].map((e) => e.dataset.rnd).join();
        NM.app.select({ courseId: c.id, tab: 'random' }); await wait(400);
        const out = { start: tiles() };
        document.querySelector('[data-tools-menu]').click(); await wait();
        const dlg = () => document.querySelector('dialog.modal');
        out.title = dlg().querySelector('h2').textContent;
        dlg().querySelector('[data-tool-check="dice"]').click(); await wait();
        dlg().querySelector('[data-tool-item="cards"] button').click(); await wait();   // ▲
        out.after = [tiles(), c.tools.off.join(), c.tools.order.join(), !!dlg()];
        [...dlg().querySelectorAll('button')].find((b) => b.textContent === 'Fertig').click(); await wait();
        // anderer Kurs unberührt
        NM.app.select({ courseId: d.id, tab: 'random' }); await wait(400);
        out.other = tiles();
        // alles aus → Hinweis, Standard stellt alles wieder her
        NM.model.setTools(d, NM.model.toolList(d).map((x) => ({ id: x.id, on: false }))); NM.app.commit(); await wait();
        out.empty = [tiles(), !!document.querySelector('#view .empty-state, #view .empty')];
        document.querySelector('[data-tools-menu]').click(); await wait();
        dlg().querySelector('[data-tools-reset]').click(); await wait();
        out.reset = [tiles(), d.tools.off.length, d.tools.order.length];
        [...dlg().querySelectorAll('button')].find((b) => b.textContent === 'Fertig').click(); await wait();
        return out; })()""")
    std = "timer,number,people,dice,cards"
    ok = bool(res) and res["start"] == std and res["title"] == "Werkzeuge in „8b Mathe“" \
        and res["after"] == ["timer,number,people,cards", "dice", "timer,number,people,cards,dice", True] \
        and res["other"] == std and res["empty"] == ["", True] and res["reset"] == [std, 0, 0]
    report("Tools: Haken und ▲▼ wirken sofort, nur im Kurs, alles aus zeigt Hinweis, Standard", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_demo_link_check(br, base):
    print("Demo aus der App öffnen:")
    br.open(f"{base}/index.html")
    br.wait("!!document.querySelector('.auth-links')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const opened = [];
        window.open = (u, t) => { opened.push([u, t]); return null; };
        const btn = [...document.querySelectorAll('.auth-links button')].find((b) => b.textContent === 'Demo ansehen');
        if (btn) btn.click();
        return { btn: !!btn, url: opened.length ? new URL(opened[0][0]).search : null, target: opened.length ? opened[0][1] : null }; })()""")
    br.eval("localStorage.setItem('nm.ui', JSON.stringify({ tab: 'tests', marker: 'echt' }))")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    res2 = br.eval("""(async () => {
        const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
        NM.app.select({ tab: 'settings' }); await wait();
        const note = [...document.querySelectorAll('.card p')].some((p) => p.textContent.includes('Dies ist der Demo-Modus'));
        const real = JSON.parse(localStorage.getItem('nm.ui') || '{}');
        return { note, realKept: real.marker === 'echt' && real.tab === 'tests', demoKey: !!localStorage.getItem('nm.ui.demo') }; })()""")
    br.eval("localStorage.removeItem('nm.ui'); localStorage.removeItem('nm.ui.demo')")
    ok = bool(res) and res["btn"] and res["url"] == "?demo" and res["target"] == "_blank" and bool(res2) and res2["note"] and res2["realKept"] and res2["demoKey"]
    report("Demo: Link auf dem Startbildschirm öffnet ?demo im neuen Fenster, Hinweis in den Einstellungen, eigene Ansicht bleibt unberührt", ok and not br.errors, str(res) + str(res2) + "; ".join(br.errors))


def run_settings_layout_check(br, base):
    print("Layout Einstellungen (Pomodoro aktiv) und eingeklappte Kursliste:")
    out = {}
    for width in (1570, 2560):
        br.call("Emulation.setDeviceMetricsOverride", width=width, height=1300, deviceScaleFactor=1, mobile=False)
        br.open(f"{base}/index.html?demo")
        br.wait("!!document.querySelector('.overview-table')", 30)
        br.errors = []
        res = br.eval("""(async () => {
            const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
            NM.app.db().settings.pomodoro.enabled = true;
            if (!NM.app.state.ui.sideCollapsed) { document.querySelector('.side-toggle').click(); await wait(450); }
            NM.app.select({ tab: 'settings' }); await wait();
            const cards = [...document.querySelectorAll('.masonry > .card')].map((c) => c.getBoundingClientRect());
            // Größte Lücke zwischen zwei Karten derselben Spalte
            let gap = 0;
            for (const c of cards) {
                const above = cards.filter((o) => Math.abs(o.left - c.left) < 2 && o.bottom <= c.top).map((o) => c.top - o.bottom);
                if (above.length) gap = Math.max(gap, Math.min(...above));
            }
            // Auswahllisten breit genug für den längsten Eintrag (Canvas-Messung)
            const ctx = document.createElement('canvas').getContext('2d');
            const selOk = [...document.querySelectorAll('.masonry select')].every((s) => {
                ctx.font = getComputedStyle(s).font;
                const need = Math.max(...[...s.options].map((o) => ctx.measureText(o.text).width));
                return s.clientWidth >= need + 24;
            });
            const chipOk = [...document.querySelectorAll('.course-chip .course-name, .course-chip .course-meta')]
                .every((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().left >= e.closest('.course-chip').getBoundingClientRect().left - 1);
            const r = { cards: cards.length, gap: Math.round(gap), selOk, chipOk };
            document.querySelector('.side-toggle').click(); await wait(450);
            return r; })()""")
        out[width] = res
    br.call("Emulation.clearDeviceMetricsOverride")
    ok = all(r and r["cards"] == 9 and r["gap"] <= 20 and r["selOk"] and r["chipOk"] for r in out.values())
    report("Einstellungen ohne Lücken bei 1570/2560 px, Auswahllisten nicht abgeschnitten, Kürzel „MSS12“ passt", ok and not br.errors, str(out) + "; ".join(br.errors))


def run_theme_check(br, base):
    print("Farbschemata: je drei helle und dunkle Designs:")
    br.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "light"}])
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    # Kontrast (WCAG): Schrift ≥ 4.5:1 auf allen Flächen, Akzent- und Statusfarben ≥ 3:1, Schrift auf den Notenfarben ≥ 4.5:1
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const probe = document.createElement('div'); document.body.append(probe);
        const rgb = (css) => { probe.style.color = ''; probe.style.color = css; return getComputedStyle(probe).color.match(/[\\d.]+/g).slice(0, 3).map(Number); };
        const lum = (c) => { const f = (v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const cr = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const out = { themes: {}, bgs: [] };
        for (const mode of ['light', 'dark']) for (const [id] of NM.app.THEMES[mode]) {
            Object.assign(NM.app.state.ui, { theme: mode, [mode + 'Theme']: id }); NM.app.applyTheme(); await wait(50);
            const root = document.documentElement, low = [];
            const check = (fg, bg, min) => { const r = cr(fg, bg); if (r < min) low.push(`${fg} auf ${bg}: ${r.toFixed(2)}`); };
            for (const bg of ['var(--bg)', 'var(--surface)', 'var(--surface-2)']) {
                for (const fg of ['var(--text)', 'var(--muted)']) check(fg, bg, 4.5);
                for (const fg of ['var(--accent)', 'var(--ok)', 'var(--warn)', 'var(--danger)']) check(fg, bg, 3);
            }
            check('var(--on-accent)', 'var(--accent)', 4.5);
            for (const p of [0, 5, 10, 15]) check('var(--g-text)', `hsl(${Math.round(p / 15 * 125)} var(--g-s) var(--g-l))`, 4.5);
            out.themes[mode + ':' + id] = [root.dataset.theme, root.dataset.variant, getComputedStyle(root).colorScheme, low];
            out.bgs.push(getComputedStyle(document.body).backgroundColor);
        }
        probe.remove();
        // Einstellungen: Kacheln, Wahl wirkt sofort und wechselt den fest eingestellten Modus mit
        Object.assign(NM.app.state.ui, { theme: 'light', lightTheme: 'standard', darkTheme: 'standard' }); NM.app.saveUi(); NM.app.applyTheme();
        NM.app.select({ tab: 'settings' }); await wait(300);
        const tiles = [...document.querySelectorAll('[data-theme-pick]')];
        out.tiles = tiles.map((t) => t.dataset.themePick + (t.getAttribute('aria-pressed') === 'true' ? '*' : ''));
        // jede Kachel zeigt ihre eigenen Farben
        out.tileBgs = new Set(tiles.map((t) => getComputedStyle(t).backgroundColor)).size;
        document.querySelector('[data-theme-pick="light:lavendel"]').click(); await wait(300);
        out.pickLight = [document.documentElement.dataset.theme, document.documentElement.dataset.variant];
        document.querySelector('[data-theme-pick="dark:nord"]').click(); await wait(300);
        out.pickDark = [document.documentElement.dataset.theme, document.documentElement.dataset.variant, document.querySelector('[data-theme-pick="dark:nord"]').getAttribute('aria-pressed')];
        const saved = JSON.parse(localStorage.getItem('nm.ui.demo'));
        out.saved = [saved.theme, saved.lightTheme, saved.darkTheme];
        return out; })()""")
    # Neu laden: Wahl bleibt (je Gerät im Browser-Speicher)
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    res2 = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        const at = () => [document.documentElement.dataset.theme, document.documentElement.dataset.variant];
        const out = { reload: at() };
        // Mond-Symbol: nur hell ↔ dunkel, das gewählte Design bleibt
        const moon = document.querySelector('.topbar [aria-label="Hell/Dunkel umschalten"]');
        moon.click(); await wait(); out.moon1 = at(); moon.click(); await wait(); out.moon2 = at();
        // „Wie das System“
        NM.app.select({ tab: 'settings' }); await wait(300);
        const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'auto' && o.text === 'Wie das System'));
        sel.value = 'auto'; sel.dispatchEvent(new Event('change')); await wait();
        out.auto = at();
        return out; })()""")
    br.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "dark"}])
    time.sleep(0.3)
    res3 = br.eval("[document.documentElement.dataset.theme, document.documentElement.dataset.variant]")
    # Timer-Fenster übernimmt das Design (Fenster nur mit Nutzergeste)
    r = br.call("Runtime.evaluate", userGesture=True, awaitPromise=True, returnByValue=True, expression="""(async () => {
        const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
        NM.app.select({ tab: 'random' }); await wait();
        document.querySelector('[data-tmr-popup]').click(); await wait(800);
        const w = NM.views.random.timer.clock.popup, pd = w && w.document;
        const out = pd ? [pd.documentElement.dataset.theme, pd.documentElement.dataset.variant, getComputedStyle(pd.body).backgroundColor === getComputedStyle(document.body).backgroundColor] : null;
        if (w) w.close();
        return out; })()""")
    popup = r.get("result", {}).get("result", {}).get("value")
    # Aufräumen: Standard für die übrigen Tests
    br.eval("""(() => { Object.assign(NM.app.state.ui, { theme: 'auto', lightTheme: 'standard', darkTheme: 'standard' }); NM.app.saveUi(); NM.app.applyTheme(); NM.app.select({ tab: 'overview' }); return 1; })()""")
    br.call("Emulation.setEmulatedMedia", features=[])
    themes = (res or {}).get("themes", {})
    ok_c = len(themes) == 6 and all(v[3] == [] and v[0] == k.split(":")[0] and v[1] == k.split(":")[1] and v[2] == ("dark" if v[0] == "dark" else "light") for k, v in themes.items()) \
        and len(set(res["bgs"])) == 6
    report("Sechs Designs: Attribute, color-scheme, eigener Hintergrund, Kontrast (Schrift ≥ 4.5:1, Akzent/Status ≥ 3:1, Notenfarben)", ok_c and not br.errors, str(themes) + "; ".join(br.errors))
    ok_s = bool(res) and res["tiles"] == ["light:standard*", "light:salbei", "light:lavendel", "dark:standard*", "dark:nord", "dark:aubergine"] \
        and res["tileBgs"] == 6 and res["pickLight"] == ["light", "lavendel"] and res["pickDark"] == ["dark", "nord", "true"] \
        and res["saved"] == ["dark", "lavendel", "nord"]
    report("Einstellungen: Vorschaukacheln je Modus, Wahl wirkt sofort und wird gespeichert", ok_s and not br.errors, str(res and {k: res[k] for k in ("tiles", "tileBgs", "pickLight", "pickDark", "saved")}))
    ok_r = bool(res2) and res2["reload"] == ["dark", "nord"] and res2["moon1"] == ["light", "lavendel"] and res2["moon2"] == ["dark", "nord"] \
        and res2["auto"] == ["light", "lavendel"] and res3 == ["dark", "nord"] and popup == ["dark", "nord", True]
    report("Design bleibt nach dem Neuladen, Mond-Symbol schaltet nur hell/dunkel, „Wie das System“ folgt dem System, Timer-Fenster übernimmt das Design", ok_r and not br.errors, str(res2) + str(res3) + str(popup) + "; ".join(br.errors))


def run_parts_check(br, base):
    print("Arbeit in Teilen (Theorie/Praxis):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const c = NM.app.db().courses[0];
        const a = c.assessments.find((x) => x.kind === 'test');
        const t = a.test;
        NM.app.state.ui.testId[c.id] = a.id;
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const before = Object.fromEntries(c.students.map((s) => [s.id, NM.grades.testResult(t, s.id, 'sek1').p]));
        const box = document.querySelector('[data-focus-key="test-parts"]');
        box.checked = true; box.dispatchEvent(new Event('change')); await wait();
        const out = {};
        out.on = [t.parts.map((x) => x.name).join(), t.partMode, t.tasks.every((x) => x.partId === t.parts[0].id), document.querySelectorAll('.parts-table tbody tr').length, document.querySelectorAll('.task-group').length];
        out.same = c.students.every((s) => NM.grades.testResult(t, s.id, 'sek1').p === before[s.id]);
        // Aufgabe im Teil Praxis anlegen und Punkte eintragen
        [...document.querySelectorAll('.task-group')][1].querySelector('.btn-ghost').click(); await wait();
        const prax = t.tasks.find((x) => x.partId === t.parts[1].id);
        const sid = c.students[0].id;
        const cell = document.querySelector(`[data-focus-key="ts-${sid}-${prax.id}"]`);
        cell.value = '4'; cell.dispatchEvent(new Event('change')); await wait();
        out.partCols = document.querySelectorAll('thead th.part-col').length;
        out.partSum = NM.grades.testResult(t, sid, 'sek1').parts[1].score;
        // Teil in der Ergebnistabelle ausblenden: Aufgabenspalten weg, Σ des Teils bleibt
        const th1 = t.tasks.find((x) => x.partId === t.parts[0].id);
        document.querySelector(`[data-focus-key="part-toggle-${t.parts[0].id}"]`).click(); await wait();
        out.hide = [!document.querySelector(`[data-focus-key="ts-${sid}-${th1.id}"]`), !!document.querySelector(`[data-focus-key="ts-${sid}-${prax.id}"]`), document.querySelectorAll('thead th.part-col').length, NM.app.state.ui.hiddenParts[a.id].length];
        document.querySelector(`[data-focus-key="part-toggle-${t.parts[0].id}"]`).click(); await wait();
        out.show = !!document.querySelector(`[data-focus-key="ts-${sid}-${th1.id}"]`);
        // getrennt benoten
        const mode = document.querySelector('[data-focus-key="part-mode"]');
        mode.value = 'separate'; mode.dispatchEvent(new Event('change')); await wait();
        out.sep = [t.partMode, t.parts.every((x) => x.limit === t.limit && x.custom), document.querySelectorAll('thead th.part-col').length, document.querySelectorAll('.key-parts .seg').length];
        const r0 = NM.grades.testResult(t, sid, 'sek1');
        out.grade = r0.p !== null && r0.parts.every((x) => x.p !== null);
        // Person ohne Praxis-Punkte: Gesamtnote leer, Status für den Teil setzbar
        const sid2 = c.students[1].id;
        out.missing = NM.grades.testResult(t, sid2, 'sek1').p;
        const ps = document.querySelector(`[data-focus-key="ts-pstatus-${sid2}-${t.parts[1].id}"]`);
        ps.value = 'nachschreiben'; ps.dispatchEvent(new Event('change')); await wait();
        out.pstatus = t.results[sid2].partStatus[t.parts[1].id];
        // Schlüssel des zweiten Teils
        [...document.querySelectorAll('.key-parts .seg')][1].click(); await wait();
        out.keyPart = document.querySelector('.key-parts .seg.active').textContent;
        // dritter Teil, Ausdrucke, Beamer
        [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent === '+ Teil').click(); await wait();
        out.three = [t.parts.length, t.parts[2].limit === t.limit];
        const printed = (mode) => { NM.print.test(c, a, mode); const txt = document.getElementById('print-root').textContent; document.body.classList.remove('printing'); return txt; };
        out.print = ['parts', 'list', 'students', 'key'].map((m) => { const x = printed(m); return x.includes('Theorie') && x.includes('Praxis'); });
        out.printParts = printed('parts').includes('Ergebnisse nach Teilen');
        document.querySelector('[data-print-menu]').click(); await wait();
        out.btn = !!document.querySelector('dialog .print-option[data-print="parts"]');
        document.querySelector('dialog .modal-actions .btn').click(); await wait();
        [...document.querySelectorAll('.btn')].find((b) => b.textContent === '⛶ Beamer').click(); await wait();
        out.beamer = document.querySelectorAll('.beamer h2').length;
        document.querySelector('.beamer-close').click(); await wait();
        // Teile aufheben: Aufgaben bleiben, Teilfelder weg
        const nTasks = t.tasks.length;
        const box2 = document.querySelector('[data-focus-key="test-parts"]');
        box2.checked = false; box2.dispatchEvent(new Event('change')); await wait();
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.off = [!t.parts, !t.partMode, t.tasks.length === nTasks, t.tasks.every((x) => !x.partId), !t.results[sid2].partStatus, document.querySelectorAll('.parts-table').length];
        return out; })()""")
    ok = bool(res) and res["on"] == ["Theorie,Praxis", "sum", True, 2, 2] and res["same"] and res["partCols"] == 2 and res["partSum"] == 4 and res["hide"] == [True, True, 2, 1] and res["show"] \
        and res["sep"] == ["separate", True, 4, 2] and res["grade"] and res["missing"] is None and res["pstatus"] == "nachschreiben" \
        and res["keyPart"] == "Praxis" and res["three"] == [3, True] and res["print"] == [True] * 4 and res["printParts"] and res["btn"] \
        and res["beamer"] >= 5 and res["off"] == [True, True, True, True, True, 0]
    report("Teile: einschalten, Aufgabe/Punkte je Teil, Teil ausblenden, getrennt benoten, Status je Teil, Schlüssel je Teil, Ausdrucke, Beamer, aufheben", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_print_menu_check(br, base):
    print("Druckauswahl (Tests, EPO, Notenübersicht):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const c = NM.app.db().courses[0];
        const out = {};
        // Menü öffnen, Optionen lesen, eine Druckart wählen → Dokumenttitel der Druckansicht
        const pick = async (id) => {
            const btns = document.querySelectorAll('[data-print-menu]');
            btns[0].click(); await wait();
            const opts = [...document.querySelectorAll('dialog .print-option')];
            const info = { n: opts.length, ids: opts.map((o) => o.dataset.print), tips: opts.every((o) => o.title.length > 20), groups: [...document.querySelectorAll('dialog .print-menu h3')].map((x) => x.textContent), menus: btns.length };
            document.querySelector(`dialog .print-option[data-print="${id}"]`).click(); await wait();
            info.open = !!document.querySelector('dialog');
            info.title = document.title;
            document.body.classList.remove('printing');
            return info;
        };
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        out.oldButtons = [...document.querySelectorAll('.btn')].filter((b) => b.textContent.startsWith('🖨') && !b.hasAttribute('data-print-menu')).length;
        out.tests = await pick('list');
        NM.app.select({ tab: 'epo' }); await wait();
        out.epo = await pick('slips');
        NM.app.select({ tab: 'overview' }); await wait();
        out.overview = await pick('course');
        // Abbrechen druckt nichts
        document.querySelector('[data-print-menu]').click(); await wait();
        document.querySelector('dialog .modal-actions .btn').click(); await wait();
        out.cancel = [!document.querySelector('dialog'), !document.body.classList.contains('printing')];
        return out; })()""")
    t, e, o = (res or {}).get("tests", {}), (res or {}).get("epo", {}), (res or {}).get("overview", {})
    ok = bool(res) and res["oldButtons"] == 0 and t.get("ids", [])[:1] == ["list"] and "key" in t.get("ids", []) and "students" in t.get("ids", []) and t.get("tips") \
        and t.get("groups") == ["Für die Lehrkraft", "Zum Austeilen"] and t.get("menus") == 1 and not t.get("open") and t.get("title", "").endswith("– Ergebnisliste") \
        and e.get("ids") == ["list", "slips"] and e.get("title", "").endswith("– Mitarbeitszettel") \
        and o.get("ids") == ["course", "attendance", "sheets"] and o.get("tips") and res["cancel"] == [True, True]
    report("Druckauswahl: ein Knopf je Reiter, Druckarten mit Tooltip nach Lehrkraft/Austeilen, Auswahl druckt, Abbrechen nicht", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_pres_check(br, base):
    print("Präsentationen (Kriterienpool, Bewerten, Ausdrucke):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const db = NM.app.db();
        const c = db.courses[0];
        NM.app.state.ui.half[c.id] = 'HJ2';
        const a = c.assessments.find((x) => x.kind === 'pres');
        NM.app.state.ui.presId[c.id] = a.id;
        NM.app.select({ courseId: c.id, tab: 'pres' }); await wait();
        const p = a.pres;
        const out = { tab: !!document.querySelector('.rate-card'), picker: document.querySelector('.picker-item.active .picker-name').textContent, rows: document.querySelectorAll('[data-scroll-key="pres-results"] tbody tr').length };
        // Live bewerten: Person ohne Bewertung wählen, je Kriterium „2“
        const s = c.students[7];
        const sel = document.querySelector('[data-focus-key="rate-person"]');
        sel.value = s.id; sel.dispatchEvent(new Event('change')); await wait();
        for (const cr of p.criteria) { document.querySelector(`[data-focus-key="rate-${cr.id}-2"]`).click(); await wait(80); }
        const topic = document.querySelector(`[data-focus-key="rate-topic-${s.id}"]`);
        topic.value = 'Wahrscheinlichkeit'; topic.dispatchEvent(new Event('change')); await wait();
        const r = NM.grades.presResult(p, s.id, 'sek1');
        out.rate = [r.score, r.max, p.results[s.id].topic, document.querySelectorAll('.rate-btn.active').length];
        // nochmal klicken hebt auf
        document.querySelector(`[data-focus-key="rate-${p.criteria[0].id}-2"]`).click(); await wait();
        out.toggle = p.results[s.id].scores[p.criteria[0].id] === undefined;
        // Tabelle: 3 eintragen, 5 abgelehnt
        const cell = () => document.querySelector(`[data-focus-key="ps-${s.id}-${p.criteria[0].id}"]`);
        cell().value = '3'; cell().dispatchEvent(new Event('change')); await wait();
        out.cell = p.results[s.id].scores[p.criteria[0].id];
        cell().value = '5'; cell().dispatchEvent(new Event('change')); await wait();
        out.invalid = p.results[s.id].scores[p.criteria[0].id];
        // Gewicht ×3
        const w = document.querySelector(`[data-focus-key="crit-w-${p.criteria[1].id}"]`);
        w.value = '3'; w.dispatchEvent(new Event('change')); await wait();
        out.max = NM.grades.presResult(p, s.id, 'sek1').max;
        // Kriterium aus dem Pool hinzufügen
        const n0 = p.criteria.length;
        [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent === '+ aus dem Pool').click(); await wait();
        document.querySelector('dialog .pool-check input:not([disabled])').checked = true;
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.fromPool = p.criteria.length - n0;
        // Eigenes Kriterium, auch in den Pool
        const pool0 = db.criteriaPool.length;
        [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent === '+ eigenes Kriterium').click(); await wait();
        const inputs = document.querySelectorAll('dialog input.input');
        inputs[0].value = 'Kreativität'; inputs[1].value = 'Inhalt'; inputs[2].value = 'keine eigenen Ideen'; inputs[5].value = 'originell';
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.own = [p.criteria[p.criteria.length - 1].name, p.criteria[p.criteria.length - 1].desc[3], db.criteriaPool.length - pool0];
        // Neue Bewertung mit Kriterien einer früheren Bewertung
        document.querySelector('.picker-add').click(); await wait();
        const from = document.querySelectorAll('dialog select')[0];
        from.value = [...from.querySelectorAll('optgroup[label="Frühere Bewertungen"] option')].find((o) => o.textContent.includes('Referat Statistik')).value; from.dispatchEvent(new Event('change'));
        document.querySelector('dialog .btn-primary').click(); await wait();
        const list = c.assessments.filter((x) => x.kind === 'pres');
        const added = list[list.length - 1];
        out.tpl = [list.length, added.pres.criteria.length === p.criteria.length, added.pres.criteria[0].id !== p.criteria[0].id, NM.app.state.ui.presId[c.id] === added.id];
        // Druckauswahl und Ausdrucke
        document.querySelector('[data-print-menu]').click(); await wait();
        out.menu = [...document.querySelectorAll('dialog .print-option')].map((o) => o.dataset.print);
        document.querySelector('dialog .modal-actions .btn').click(); await wait();
        const printed = (mode, o) => { NM.print.pres(c, a, mode, o); const txt = document.getElementById('print-root').textContent; const t = document.title; const grade = !!document.querySelector('#print-root .p-mr-grade'); document.body.classList.remove('printing'); return [t, txt, grade]; };
        const [t1, x1] = printed('list');
        const [t2, x2] = printed('blank');
        const [t3, x3, g3] = printed('sheets', { withGrade: false });
        const [, , g3b] = printed('sheets', { withGrade: true });
        const [t4] = printed('key');
        out.print = [t1.endsWith('Bewertungsliste') && x1.includes('Wahrscheinlichkeit'), t2.endsWith('Leere Bewertungsbögen') && x2.includes('Kreativität'), t3.endsWith('Bewertungsbögen') && x3.includes('Kreativität') && x3.includes('Wahrscheinlichkeit') && !g3 && g3b, t4.endsWith('Notenschlüssel')];
        out.sheetsN = (() => { NM.print.pres(c, a, 'sheets', {}); const n = document.querySelectorAll('#print-root .p-pres').length; document.body.classList.remove('printing'); return n; })();
        // Notenübersicht HJ2: Spalte mit Sprung zur Präsentation
        NM.app.select({ tab: 'overview' }); await wait();
        const jump = [...document.querySelectorAll('.link.tiny')].find((b) => b.textContent === 'Präs. ›');
        out.overview = !!jump && !!document.querySelector('.kind-pres');
        jump.click(); await wait();
        out.jump = NM.app.state.ui.tab === 'pres';
        // Pool-Eintrag löschen: bestehende Bewertung behält das Kriterium
        NM.app.state.ui.presId[c.id] = a.id; NM.app.rerender(); await wait();
        document.querySelector('.pool-card').open = true; await wait();
        const del = [...document.querySelectorAll('.pool-item .icon-btn')].find((b) => b.getAttribute('aria-label') === 'Aus dem Pool löschen: Kreativität');
        del.click(); await wait();
        document.querySelector('dialog .btn-danger').click(); await wait();
        out.poolDel = [!db.criteriaPool.some((x) => x.name === 'Kreativität'), p.criteria.some((x) => x.name === 'Kreativität')];
        // Startbestand ergänzen: Knopf nur, wenn Kriterien fehlen
        const restore = () => [...document.querySelectorAll('.pool-card .btn-ghost')].find((b) => b.textContent.startsWith('Startbestand ergänzen'));
        const noBtn = !restore();
        const lesb = [...document.querySelectorAll('.pool-item .icon-btn')].find((b) => b.getAttribute('aria-label') === 'Aus dem Pool löschen: Lesbarkeit');
        lesb.click(); await wait(); document.querySelector('dialog .btn-danger').click(); await wait();
        const label = restore() && restore().textContent;
        restore().click(); await wait();
        out.restore = [noBtn, label, db.criteriaPool.some((x) => x.name === 'Lesbarkeit'), !restore()];
        // Vorlagen: aus der Bewertung speichern (zweimal gleicher Name → ersetzen), aus dem Pool anlegen, verwenden, drucken, löschen
        const saveTpl = async (name, replace) => {
            [...document.querySelectorAll('.btn-ghost')].find((b) => b.textContent === '💾 Als Vorlage speichern').click(); await wait();
            document.querySelector('dialog input').value = name; document.querySelector('dialog .btn-primary').click(); await wait();
            if (replace) { document.querySelector('dialog .btn-primary').click(); await wait(); }
        };
        const t0 = db.presTemplates.length;
        const tpl = (n) => db.presTemplates.find((t) => t.name === n);
        out.stdTpl = [t0, ['Kurzvortrag (ohne Handout)', 'Vortrag', 'Hausaufgaben vorstellen'].every((n) => tpl(n) && tpl(n).criteria.every((k) => k.desc[0] && k.desc[3])), tpl('Hausaufgaben vorstellen').criteria.some((k) => k.name === 'Lösungsweg erklären' && k.weight === 2)];
        await saveTpl('Referat', false);
        await saveTpl('referat', true);
        out.tplSave = [db.presTemplates.length - t0, tpl('Referat').name, tpl('Referat').criteria.length === p.criteria.length, tpl('Referat').criteria[1].weight];
        document.querySelector('.tpl-card').open = true; await wait();
        [...document.querySelectorAll('.tpl-card .btn-ghost')].find((b) => b.textContent === '+ Vorlage aus dem Pool').click(); await wait();
        document.querySelector('dialog input.input').value = 'Plakat';
        [...document.querySelectorAll('dialog .pool-check input')].slice(0, 2).forEach((x) => (x.checked = true));
        document.querySelector('dialog .btn-primary').click(); await wait();
        document.querySelector('.picker-add').click(); await wait();
        const from2 = document.querySelectorAll('dialog select')[0];
        const opt = [...from2.options].find((o) => o.textContent.startsWith('Plakat'));
        from2.value = opt.value;
        out.groups = [...from2.querySelectorAll('optgroup')].map((g) => g.label);
        document.querySelector('dialog .btn-primary').click(); await wait();
        const newest = c.assessments.filter((x) => x.kind === 'pres').pop();
        out.fromTpl = [db.presTemplates.length - t0, newest.pres.criteria.length, newest.pres.criteria[0].poolId === db.criteriaPool[0].id];
        // Handreichung über die Druckauswahl (mit Notenschlüssel)
        document.querySelector('[data-print-menu]').click(); await wait();
        out.menu2 = [...document.querySelectorAll('dialog .print-option')].map((o) => o.dataset.print);
        document.querySelector('dialog .print-option[data-print="guide"]').click(); await wait();
        document.querySelector('dialog input[type=checkbox]').checked = true;
        document.querySelector('dialog .btn-primary').click(); await wait();
        const g1 = [document.title, document.getElementById('print-root').textContent];
        document.body.classList.remove('printing');
        out.guide = [g1[0].endsWith('– Bewertungskriterien'), g1[1].includes(newest.pres.criteria[0].desc[3]), g1[1].includes('Notenschlüssel'), !g1[1].includes(c.students[0].last)];
        document.querySelector('.tpl-card').open = true; await wait();
        document.querySelector(`[data-tpl-print="${tpl('Plakat').id}"]`).click(); await wait();
        out.tplPrint = document.title === 'Plakat – Bewertungskriterien' && !document.getElementById('print-root').textContent.includes('Notenschlüssel');
        document.body.classList.remove('printing');
        [...document.querySelectorAll('.tpl-card .icon-btn')].find((b) => b.getAttribute('aria-label') === 'Vorlage löschen: Plakat').click(); await wait();
        document.querySelector('dialog .btn-danger').click(); await wait();
        out.tplDel = [db.presTemplates.length - t0, newest.pres.criteria.length];
        // Standardvorlagen ergänzen: Knopf nur, wenn eine fehlt
        const stdBtn = () => [...document.querySelectorAll('.tpl-card .btn-ghost')].find((b) => b.textContent.startsWith('Standardvorlagen ergänzen'));
        const noStd = !stdBtn();
        document.querySelector('.tpl-card').open = true; await wait();
        [...document.querySelectorAll('.tpl-card .icon-btn')].find((b) => b.getAttribute('aria-label') === 'Vorlage löschen: Vortrag').click(); await wait();
        document.querySelector('dialog .btn-danger').click(); await wait();
        const stdLabel = stdBtn() && stdBtn().textContent;
        stdBtn().click(); await wait();
        out.stdRestore = [noStd, stdLabel, !!tpl('Vortrag'), !stdBtn()];
        return out; })()""")
    ok = bool(res) and res["tab"] and res["picker"] == "Referat Statistik" and res["rows"] == 12 \
        and res["rate"][0] == 12 and res["rate"][1] == 18 and res["rate"][2] == "Wahrscheinlichkeit" and res["rate"][3] == 5 and res["toggle"] \
        and res["cell"] == 3 and res["invalid"] == 3 and res["max"] == 24 and res["fromPool"] == 1 and res["own"] == ["Kreativität", "originell", 1] \
        and res["tpl"] == [4, True, True, True] and res["menu"] == ["list", "key", "blank", "guide", "sheets"] and res["print"] == [True] * 4 \
        and res["sheetsN"] == 7 and res["overview"] and res["jump"] and res["poolDel"] == [True, True] and res["restore"] == [True, "Startbestand ergänzen (1)", True, True] \
        and res["tplSave"] == [1, "Referat", True, 3] and res["groups"] == ["Vorlagen", "Frühere Bewertungen"] and res["fromTpl"] == [2, 2, True] \
        and res["menu2"] == ["list", "key", "blank", "guide", "sheets"] and res["guide"] == [True] * 4 and res["tplPrint"] and res["tplDel"] == [1, 2] \
        and res["stdTpl"] == [3, True, True] and res["stdRestore"] == [True, "Standardvorlagen ergänzen (1)", True, True]
    report("Präsentationen: bewerten (Knöpfe, Tabelle), Gewicht, Kriterien aus Pool/eigene, Vorlagen, Handreichung, Ausdrucke, Notenübersicht, Pool", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_group_check(br, base):
    print("Gruppenpräsentationen (Gruppen, Gruppenwert, Abweichung, Druck, Auflösen):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const G = NM.grades;
        const db = NM.app.db();
        const c = db.courses[0];
        const a = c.assessments.find((x) => x.name === 'Gruppenpräsentation Zufall');
        const p = a.pres;
        NM.app.state.ui.half[c.id] = 'HJ2';
        NM.app.state.ui.presId[c.id] = a.id;
        NM.app.select({ courseId: c.id, tab: 'pres' }); await wait();
        const q = (k) => document.querySelector(`[data-focus-key="${k}"]`);
        const out = {};
        out.start = [q('pres-mode').value, document.querySelectorAll('.grp-row').length, !!q('rate-group'), document.querySelectorAll('.grp-member').length, document.querySelector('.grp-card').textContent.includes('Ohne Gruppe')];
        const g1 = p.groups[0];
        const [m0, m1] = g1.members;
        const gl = p.criteria.find((x) => x.name === 'Gliederung');
        const fs = p.criteria.find((x) => x.name === 'Freies Sprechen');
        // Gruppenwert setzen: gilt für alle Mitglieder
        q(`grp-${gl.id}-0`).click(); await wait();
        out.groupVal = [g1.scores[gl.id], g1.members.map((sid) => G.presScores(p, sid)[gl.id])];
        // Personenkriterium je Mitglied
        q(`grp-${m0}-${fs.id}-1`).click(); await wait();
        out.personVal = [p.results[m0].scores[fs.id], G.presScores(p, m1)[fs.id] !== 1 || p.results[m1].scores[fs.id] === 1];
        // Abweichung in der Personenansicht setzen und zurücksetzen
        q(`grp-person-${m1}`).click(); await wait();
        out.personView = [!!q('rate-person'), q('rate-person').value === m1];
        q(`rate-${gl.id}-2`).click(); await wait();
        const devSet = [G.presDeviation(p, m1, gl), G.presScores(p, m1)[gl.id], !!document.querySelector('.dev-note')];
        q(`rate-reset-${gl.id}`).click(); await wait();
        q(`rate-${gl.id}-0`).click(); await wait(); // Gruppenwert gewählt → keine Abweichung
        out.dev = [...devSet, G.presDeviation(p, m1, gl), G.presScores(p, m1)[gl.id]];
        // Tabelle: Gruppenwert grau, andere Zahl = Abweichung
        const cell = () => q(`ps-${m0}-${gl.id}`);
        const fromGroup = cell().classList.contains('from-group');
        cell().value = '3'; cell().dispatchEvent(new Event('change')); await wait();
        out.table = [fromGroup, cell().classList.contains('dev'), G.presDeviation(p, m0, gl), [...document.querySelectorAll('[data-scroll-key="pres-results"] th')].some((th) => th.textContent.includes('Gruppe'))];
        cell().value = '0'; cell().dispatchEvent(new Event('change')); await wait();
        out.tableBack = G.presDeviation(p, m0, gl);
        // Bewertungsart je Kriterium
        q(`crit-scope-${gl.id}`).value = 'person'; q(`crit-scope-${gl.id}`).dispatchEvent(new Event('change')); await wait();
        out.scope = [gl.scope, G.presScores(p, m1)[gl.id] === undefined];
        q(`crit-scope-${gl.id}`).value = 'group'; q(`crit-scope-${gl.id}`).dispatchEvent(new Event('change')); await wait();
        out.scopeBack = [gl.scope === undefined, G.presScores(p, m1)[gl.id]];
        // Gruppen bearbeiten: neue Gruppe, Person hinzufügen und herausnehmen, löschen
        [...document.querySelectorAll('.grp-card .btn-ghost')].find((b) => b.textContent === '+ Gruppe').click(); await wait();
        const g4 = p.groups[3];
        const add = q(`grp-add-${g4.id}`);
        const free = add.options[1].value;
        add.value = free; add.dispatchEvent(new Event('change')); await wait();
        const added = [p.groups.length, g4.name, g4.members.slice()];
        [...document.querySelectorAll('.grp-chip .chip-x')].find((b) => b.getAttribute('aria-label').startsWith('Aus Gruppe 4')).click(); await wait();
        const removed = g4.members.length;
        [...document.querySelectorAll('.grp-row .icon-btn')].find((b) => b.getAttribute('aria-label') === 'Gruppe löschen: Gruppe 4').click(); await wait();
        out.edit = [added[0], added[1], added[2].length, removed, p.groups.length];
        // Ausdrucke
        const printed = (fn) => { fn(); const t = document.getElementById('print-root').textContent; document.body.classList.remove('printing'); return t; };
        const list = printed(() => NM.print.pres(c, a, 'list'));
        const sheet = printed(() => NM.print.pres(c, a, 'sheets', { sid: m1 }));
        const guide = printed(() => NM.print.presGuide({ title: 'X', criteria: p.criteria, groupMode: p.groupMode }));
        out.print = [list.includes('Gruppe 1') && list.includes(g1.topic), sheet.includes('Gruppe 1') && sheet.includes('für die Gruppe') && sheet.includes(g1.topic), guide.includes('für jede Person einzeln') && guide.includes('ganze Gruppe')];
        // Gruppen übernehmen in eine neue Bewertung
        const b = NM.model.newPres(c, 'HJ2', db.settings, p.criteria);
        b.name = 'Zweite Runde'; b.pres.groupMode = 'group'; b.pres.groups = [];
        c.assessments.push(b); NM.app.state.ui.presId[c.id] = b.id; NM.app.commit(); await wait();
        const imp = q('grp-import');
        imp.value = 'pres:' + a.id; imp.dispatchEvent(new Event('change')); await wait();
        out.import = [b.pres.groups.length, b.pres.groups.map((g) => g.members.length).join(), b.pres.groups.every((g) => !Object.keys(g.scores).length)];
        // Auflösen: Gruppenwerte werden Einzelbewertung, Noten bleiben gleich
        NM.app.state.ui.presId[c.id] = a.id; NM.app.rerender(); await wait();
        const before = c.students.map((s) => G.presResult(p, s.id, 'sek1').p).join();
        q('pres-mode').value = ''; q('pres-mode').dispatchEvent(new Event('change')); await wait();
        document.querySelector('dialog .btn-primary').click(); await wait();
        const after = c.students.map((s) => G.presResult(p, s.id, 'sek1').p).join();
        out.dissolve = [p.groupMode === undefined, p.groups === undefined, before === after, p.results[m1].topic === g1.topic, !document.querySelector('.grp-card')];
        NM.app.select({ tab: 'overview' }); await wait();
        return out; })()""")
    ok = bool(res) and res["start"] == ["mixed", 3, True, 3, True] and res["groupVal"][0] == 0 and res["groupVal"][1] == [0, 0, 0] \
        and res["personVal"] == [1, True] and res["personView"] == [True, True] and res["dev"] == [True, 2, True, False, 0] \
        and res["table"] == [True, True, True, True] and res["tableBack"] is False and res["scope"] == ["person", True] and res["scopeBack"] == [True, 0] \
        and res["edit"] == [4, "Gruppe 4", 1, 0, 3] and res["print"] == [True] * 3 and res["import"] == [3, "3,4,3", True] and res["dissolve"] == [True] * 5
    report("Gruppenpräsentationen: Gruppenwert für alle, Personenkriterien, Abweichung setzen/zurücksetzen, Tabelle, Gruppen bearbeiten/übernehmen, Druck, Auflösen ohne Notenänderung", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_groups_tab_check(br, base):
    print("Reiter Gruppen (Einteilung, Regeln, Abwesende, Fixieren, Verschieben, Puzzle, Beamer, Druck, Präsentation):")
    # Großes Fenster, damit beim Ziehen Start und Ziel gleichzeitig sichtbar sind
    br.call("Emulation.setDeviceMetricsOverride", width=1600, height=1200, deviceScaleFactor=1, mobile=False)
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async () => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const db = NM.app.db();
        const c = db.courses[0];
        const q = (k) => document.querySelector(`[data-focus-key="${k}"]`);
        const out = {};
        NM.app.select({ courseId: c.id, tab: 'groups' }); await wait();
        out.start = [document.querySelector('.picker-item.active .picker-name').textContent, document.querySelectorAll('.grp-box').length, !document.querySelector('.notice.warn'), document.querySelectorAll('.tab').length];
        // Neue Einteilung: je 4, leistungsgemischt
        document.querySelector('.picker-add').click(); await wait();
        q('grp-n').value = '4'; q('grp-n').dispatchEvent(new Event('input'));
        q('grp-mode').value = 'mixed';
        const preview = document.querySelector('dialog .small.muted').textContent;
        document.querySelector('dialog .btn-primary').click(); await wait();
        const set = c.groupSets[c.groupSets.length - 1];
        const all = () => set.groups.flatMap((g) => g.members);
        out.created = [preview.includes('12 Personen') && preview.includes('4 · 4 · 4'), set.groups.map((g) => g.members.length).join(), new Set(all()).size, set.opts.mode, NM.app.state.ui.groupSetId[c.id] === set.id, NM.groups.check(set.groups, c.groupRules).apart.length];
        // Abwesend: beim Neuwürfeln ausgelassen
        const away = c.students[2].id;
        document.querySelector('.grp-away').open = true; await wait();
        q('away-' + away).click(); await wait();
        q('gs-roll').click(); await wait();
        out.away = [all().includes(away), all().length, !!document.querySelector(`.grp-free [data-sid="${away}"]`)];
        // Fixieren: Gruppe bleibt beim Neuwürfeln
        const g0 = set.groups[0];
        q('gb-lock-' + g0.id).click(); await wait();
        const keep = g0.members.join();
        for (let i = 0; i < 3; i++) { q('gs-roll').click(); await wait(100); }
        out.lock = [g0.locked, set.groups[0].members.join() === keep, set.groups.length];
        // Anklicken: verschieben und tauschen
        const [ga, gb] = [set.groups[1], set.groups[2]];
        const x = ga.members[0];
        q(`gp-${set.id}-${x}`).click(); await wait();
        document.querySelector(`.grp-box[data-group="${gb.id}"]`).click(); await wait();
        const moved = gb.members.includes(x) && !ga.members.includes(x);
        const [y, z] = [ga.members[0], gb.members[0]];
        q(`gp-${set.id}-${y}`).click(); await wait(); q(`gp-${set.id}-${z}`).click(); await wait();
        out.click = [moved, ga.members.includes(z) && gb.members.includes(y)];
        // Ziehen und Ablegen
        // Ziehen per Pointer-Events (wie im Sitzplan): auf eine Gruppe = verschieben, auf eine Person = tauschen, Lücke = nichts
        const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
        const drag = async (el, toEl, at) => {
            (toEl || el).scrollIntoView({ block: 'center' }); await wait(50);
            const [x0, y0] = center(el);
            el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x0, clientY: y0, button: 0, bubbles: true }));
            document.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + 10, clientY: y0 + 10, bubbles: true }));
            const [x1, y1] = at || center(toEl);
            document.dispatchEvent(new PointerEvent('pointermove', { clientX: x1, clientY: y1, bubbles: true }));
            const ghost = !!document.querySelector('.grp-ghost');
            const marked = toEl ? toEl.classList.contains('drag-over') || !!toEl.closest('.drag-over') : null;
            document.dispatchEvent(new PointerEvent('pointerup', { clientX: x1, clientY: y1, bubbles: true }));
            await wait();
            return [ghost, marked];
        };
        const chipOf = (sid) => q(`gp-${set.id}-${sid}`);
        const boxOf = (g) => document.querySelector(`.grp-box[data-group="${g.id}"]`);
        const [gh1, mk1] = await drag(chipOf(y), boxOf(ga).querySelector('.grp-task'));
        const movedA = ga.members.includes(y) && !gb.members.includes(y) && !ga.task;
        const [u, v] = [ga.members[0], gb.members[0]];
        await drag(chipOf(u), chipOf(v));
        const swapped = ga.members.includes(v) && gb.members.includes(u);
        const before = JSON.stringify(set.groups.map((g) => g.members));
        const gr = document.querySelector('.grp-set .grp-grid').getBoundingClientRect();
        await drag(chipOf(u), null, [gr.right - 2, gr.bottom + 200]);
        out.drag = [gh1, mk1, movedA, swapped, JSON.stringify(set.groups.map((g) => g.members)) === before, !document.querySelector('.grp-ghost, .drag-over'), !document.body.classList.contains('grp-dragging')];
        // Name und Auftrag
        q('gb-task-' + ga.id).value = 'Plakat gestalten'; q('gb-task-' + ga.id).dispatchEvent(new Event('change')); await wait();
        q('gb-name-' + ga.id).value = 'Team Rot'; q('gb-name-' + ga.id).dispatchEvent(new Event('change')); await wait();
        out.edit = [ga.task, ga.name];
        // Regel „nicht zusammen“ für zwei in derselben Gruppe → Warnung
        document.querySelector('.grp-rules').open = true; await wait();
        // Paar ohne bestehende Regel (nach dem Ziehen kann zufällig das Regelpaar der Demo in Gruppe A stehen)
        const known = (x, y) => c.groupRules.apart.concat(c.groupRules.together).some((r) => r.includes(x) && r.includes(y));
        const pairs = ga.members.flatMap((x, i) => ga.members.slice(i + 1).map((y) => [x, y]));
        const [p1, p2] = pairs.find(([x, y]) => !known(x, y));
        q('rule-apart-a').value = p1; q('rule-apart-b').value = p2; q('rule-apart-add').click(); await wait();
        out.rule = [c.groupRules.apart.length, document.querySelector('.notice.warn') && document.querySelector('.notice.warn').textContent.includes('Nicht zusammen')];
        q('gb-lock-' + g0.id).click(); await wait();
        q('gs-roll').click(); await wait();
        out.ruleRoll = NM.groups.check(set.groups, c.groupRules).apart.length;
        // Beamer: Gruppen groß, ohne Noten und Regeln
        q('gs-beamer').click(); await wait();
        const bm = document.querySelector('.grp-beamer');
        out.beamer = [!!bm, bm.querySelectorAll('.grp-tile').length === set.groups.length, !bm.textContent.includes('Ø'), !bm.textContent.includes('Nicht zusammen')];
        // Schrift füllt den Bildschirm, ohne zu scrollen; Fotos und Nachnamen per Umschalter
        const grid = bm.querySelector('.grp-beamer-grid');
        const s0 = c.students.find((x) => x.id === set.groups.find((g) => g.members.length).members[0]);
        const tileText = () => bm.querySelector('.grp-tile').textContent;
        out.beamerFit = [parseFloat(grid.style.fontSize) >= 24, grid.scrollHeight <= grid.clientHeight + 1];
        bm.querySelector('[data-beamer-toggle="photos"]').click(); await wait();
        bm.querySelector('[data-beamer-toggle="last"]').click(); await wait();
        out.beamerToggle = [bm.querySelectorAll('.grp-photo').length === all().length, !tileText().includes(s0.last), tileText().includes(s0.first), NM.app.state.ui.groupBeamer.photos, NM.app.state.ui.groupBeamer.last, grid.scrollHeight <= grid.clientHeight + 1];
        bm.querySelector('[data-beamer-toggle="photos"]').click(); bm.querySelector('[data-beamer-toggle="last"]').click(); await wait();
        out.beamerBack = [bm.querySelectorAll('.grp-photo').length, tileText().includes(s0.last)];
        bm.querySelector('[data-beamer-close]').click(); await wait();
        // Druck
        document.querySelector('[data-print-menu]').click(); await wait();
        out.menu = [...document.querySelectorAll('dialog .print-option')].map((o) => o.dataset.print);
        document.querySelector('dialog .print-option[data-print="list"]').click(); await wait();
        const txt = document.getElementById('print-root').textContent;
        out.print = [document.title.endsWith('Gruppeneinteilung'), document.querySelectorAll('#print-root .p-grp').length === set.groups.length, !txt.includes('Ø')];
        document.body.classList.remove('printing');
        // Anzeige in der App: Fotos und Nachnamen umschalten
        const first = c.students.find((x) => x.id === set.groups[0].members[0]);
        const chipText = () => q(`gp-${set.id}-${first.id}`).textContent;
        q('gv-photos').click(); await wait(); q('gv-last').click(); await wait();
        out.view = [document.querySelectorAll('.grp-set .grp-person .grp-photo').length > 0, chipText().includes(first.first), !chipText().includes(first.last), NM.app.state.ui.groupView.photos, NM.app.state.ui.groupView.last];
        q('gv-photos').click(); await wait(); q('gv-last').click(); await wait();
        out.viewBack = [document.querySelectorAll('.grp-set .grp-photo').length, chipText().includes(first.last)];
        // Gruppenpuzzle: Expertengruppen erscheinen unter den Stammgruppen (gleiche Einteilung, kein eigener Eintrag)
        const pickers = document.querySelectorAll('.picker-item:not(.picker-add)').length;
        q('gs-experts').click(); await wait();
        const ex = c.groupSets[c.groupSets.length - 1];
        const exCard = document.querySelector('.grp-experts');
        out.puzzle = [ex.homeId === set.id, ex.groups.length === Math.max(...set.groups.map((g) => g.members.length)), ex.groups[0].members.length === set.groups.length, !!exCard && exCard.querySelectorAll('.grp-box').length === ex.groups.length, document.querySelectorAll('.picker-item:not(.picker-add)').length === pickers, !q('gs-experts'), !!document.querySelector('.grp-set .grp-letter')];
        // Stammgruppen ändern → Hinweis, „↻ Neu bilden“ passt an (Teilthema bleibt)
        q('gb-task-' + ex.groups[0].id).value = 'Text A'; q('gb-task-' + ex.groups[0].id).dispatchEvent(new Event('change')); await wait();
        const [h0, h1] = [set.groups[0], set.groups[1]];
        [h0.members[0], h1.members[1]] = [h1.members[1], h0.members[0]]; NM.app.commit(); await wait();
        const stale = !!document.querySelector('.grp-experts .notice.warn');
        q('ex-rebuild').click(); await wait();
        out.rebuild = [stale, !document.querySelector('.grp-experts .notice.warn'), ex.groups[0].task, c.groupSets.filter((x) => x.homeId === set.id).length];
        // Anzahl der Teilthemen ändern: bleibt beim Neu verteilen, Namen und Teilthemen bleiben, Buchstaben in den Stammgruppen passen
        q('gb-name-' + ex.groups[1].id).value = 'Profis B'; q('gb-name-' + ex.groups[1].id).dispatchEvent(new Event('change')); await wait();
        q('ex-count').value = '4'; q('ex-count').dispatchEvent(new Event('change')); await wait();
        const n4 = [ex.groups.length, ex.groups.map((g) => g.name).join(), ex.groups.flatMap((g) => g.members).length === set.groups.flatMap((g) => g.members).length];
        q('ex-rebuild').click(); await wait();
        const letterOk = [...document.querySelectorAll('.grp-set:not(.grp-experts) .grp-person')].every((el) => { const l = el.querySelector('.grp-letter'); const i = ex.groups.findIndex((g) => g.members.includes(el.dataset.sid)); return !l || l.textContent === NM.groups.letter(i); });
        q('ex-add').click(); await wait();
        out.count = [...n4, ex.groups.length, ex.groups[1].name, ex.groups[0].task, letterOk, ex.groups[4].name];
        ex.groups.pop(); NM.app.commit(); await wait();
        // Beamer: Umschalter Stamm-/Expertengruppen
        q('gs-beamer').click(); await wait();
        const bm2 = document.querySelector('.grp-beamer');
        const t1 = bm2.querySelector('h1').textContent;
        bm2.querySelector('[data-beamer-which="experts"]').click(); await wait();
        out.beamerExperts = [t1.startsWith(set.name), bm2.querySelector('h1').textContent.includes('Expertengruppen'), bm2.querySelectorAll('.grp-tile').length === ex.groups.length];
        bm2.querySelector('[data-beamer-close]').click(); await wait();
        q('ex-beamer').click(); await wait();
        out.beamerExperts.push(document.querySelector('.grp-beamer h1').textContent.includes('Expertengruppen'));
        document.querySelector('[data-beamer-close]').click(); await wait();
        // In eine Präsentation übernehmen (Einzel → Gruppen, Auftrag → Thema)
        NM.app.state.ui.groupSetId[c.id] = 'gs1'; NM.app.rerender(); await wait();
        const pres = c.assessments.find((a) => a.name === 'Referat Statistik');
        q('gs-to-pres').value = pres.id; q('gs-to-pres').dispatchEvent(new Event('change')); await wait();
        out.toPres = [pres.pres.groupMode, pres.pres.groups.length, pres.pres.groups[0].topic, pres.pres.groups[0].members.length];
        // Präsentation: Gruppen aus einer Einteilung übernehmen
        const gp = c.assessments.find((a) => a.name === 'HA vorstellen');
        gp.pres.groupMode = 'group'; gp.pres.groups = [];
        NM.app.state.ui.half[c.id] = 'HJ2'; NM.app.state.ui.presId[c.id] = gp.id;
        NM.app.select({ tab: 'pres' }); await wait();
        const imp = q('grp-import');
        out.importOpts = [...imp.querySelectorAll('optgroup')].map((g) => g.label);
        imp.value = 'set:gs1'; imp.dispatchEvent(new Event('change')); await wait();
        out.fromSet = [gp.pres.groups.length, gp.pres.groups[1].topic];
        NM.app.select({ tab: 'groups' }); await wait();
        return out; })()""")
    ok = bool(res) and res["start"] == ["Stationenlernen Prozent", 4, True, 10] and res["created"] == [True, "4,4,4", 12, "mixed", True, 0] \
        and res["away"] == [False, 11, True] and res["lock"] == [True, True, 3] and res["click"] == [True, True] and res["drag"] == [True] * 7 \
        and res["edit"] == ["Plakat gestalten", "Team Rot"] and res["rule"] == [2, True] and res["ruleRoll"] == 0 and res["beamer"] == [True] * 4 and res["beamerFit"] == [True, True] and res["beamerToggle"] == [True, True, True, True, False, True] and res["beamerBack"] == [0, True] \
        and res["menu"] == ["list", "cards"] and res["print"] == [True] * 3 and res["puzzle"] == [True] * 7 and res["view"] == [True, True, True, True, False] and res["viewBack"] == [0, True] \
        and res["rebuild"] == [True, True, "Text A", 1] and res["count"] == [4, "Experten A,Profis B,Experten C,Experten D", True, 5, "Profis B", "Text A", True, "Experten E"] and res["beamerExperts"] == [True] * 4 \
        and res["toPres"] == ["mixed", 4, "Station 1: Grundwert", 3] and res["importOpts"][0].startswith("Gruppeneinteilungen") and res["fromSet"] == [4, "Station 2: Prozentwert"]
    br.call("Emulation.clearDeviceMetricsOverride")
    report("Gruppen: Einteilung (Größe, leistungsgemischt), Abwesende, Fixieren, Anklicken/Ziehen, Auftrag, Regel mit Warnung, Beamer ohne Noten, Druck, Gruppenpuzzle, Übernahme in Präsentation", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_moodle_check(br, base):
    print("Moodle-Import (Dialog, Übernahme, Ausdruck):")
    br.open(f"{base}/index.html?demo")
    br.wait("!!document.querySelector('.overview-table')", 30)
    br.errors = []
    res = br.eval("""(async (answers, grades) => {
        const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
        window.print = () => {};
        const c = NM.app.db().courses[0];
        NM.app.select({ courseId: c.id, tab: 'tests' }); await wait();
        const click = (t, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(t)).click();
        const pick = async (files) => {
            const inp = document.querySelector('dialog input[type=file]');
            const dt = new DataTransfer();
            files.forEach(([name, text]) => dt.items.add(new File([text], name, { type: 'text/csv' })));
            inp.files = dt.files; inp.dispatchEvent(new Event('change')); await wait(400);
        };
        const out = {};
        out.noPickerButton = ![...document.querySelectorAll('.picker-item')].some((b) => b.textContent.includes('Moodle'));
        // In einen bestehenden Test mit Punkten: Ersetzen nicht vorausgewählt, Warnung erst mit Haken
        const half = NM.app.currentHalf(c);
        const old = c.assessments.find((x) => x.kind === 'test' && x.half === half && !NM.grades.hasParts(x.test) && Object.keys(x.test.results).length);
        NM.app.state.ui.testId[c.id] = old.id; NM.app.rerender(); await wait();
        const oldTasks = old.test.tasks.length;
        click('Moodle-CSV'); await wait();
        const rep = () => document.querySelector('dialog [data-moodle-replace]');
        const warn = () => !document.querySelector('dialog .alert-danger').hidden;
        out.keep = [rep().checked, warn()];
        rep().checked = true; rep().dispatchEvent(new Event('change')); out.keep.push(warn());
        rep().checked = false; rep().dispatchEvent(new Event('change'));
        await pick([['10a-HÜ Test-Antworten.csv', answers], ['10a-HÜ Test-Bewertungen.csv', grades]]);
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.keep.push(old.test.tasks.length - oldTasks, old.name !== 'HÜ Test');
        // Neuer Test: A1/A2 werden ersetzt, Bezeichnung und Datum aus Moodle
        const n = c.assessments.length;
        click('+ Neuer Test'); await wait();
        click('Moodle-CSV'); await wait();
        out.replaceDefault = rep().checked;
        await pick([['10a-HÜ Test-Antworten.csv', answers], ['10a-HÜ Test-Bewertungen.csv', grades]]);
        out.rows = document.querySelectorAll('dialog tbody tr').length;
        out.name = document.querySelector('dialog input.input:not([type=file])').value;
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.newButton = [...document.querySelectorAll('.card-head button')].some((b) => b.textContent.includes('Moodle-CSV'));
        const a = c.assessments[c.assessments.length - 1];
        const sid = (last) => c.students.find((s) => s.last === last).id;
        const r = (last) => NM.grades.testResult(a.test, sid(last), 'sek1');
        out.test = [c.assessments.length - n, a.name, a.test.tasks.map((t) => t.name).join(), a.test.precision, r('Becker').score, r('Demir').score, (a.test.results[sid('Fischer')] || {}).status, a.test.moodle.files.length];
        out.card = !!document.querySelector('.card h2') && [...document.querySelectorAll('.card h2')].some((x) => x.textContent === 'Moodle');
        // Ausdruck mit und ohne Note
        NM.print.moodle(c, a, { withGrade: true }); await wait();
        const root = document.getElementById('print-root');
        out.printGrade = [root.querySelectorAll('.p-page').length, !!root.querySelector('.p-mr-grade'), root.textContent.includes('Hauptstadt?'), root.querySelectorAll('tr.p-mr-part').length, root.textContent.includes('sehr gut'), root.querySelectorAll('.p-mr-sign').length];
        NM.print.moodle(c, a, { withGrade: false, sid: sid('Demir') }); await wait();
        out.printNoGrade = [root.querySelectorAll('.p-page').length, !!root.querySelector('.p-mr-grade'), root.textContent.includes('1,5 / 2'), root.textContent.includes('Unterschrift Lehrkraft')];
        document.body.classList.remove('printing');
        // Erneut importieren: nur Bewertungen, Demir korrigiert
        NM.app.rerender(); await wait();
        click('Erneut importieren'); await wait();
        await pick([['10a-HÜ Test-Bewertungen.csv', grades.replace('"1,50","0,50",1', '"2,00",1,1')]]);
        document.querySelector('dialog .btn-primary').click(); await wait();
        out.reimport = [c.assessments.length - n, r('Demir').score, a.test.moodle.answers[sid('Demir')][a.test.tasks[0].id].a];
        return out; })(%s, %s)""" % (json.dumps(MOODLE_ANSWERS), json.dumps(MOODLE_GRADES)))
    ok = bool(res) and res["noPickerButton"] and res["keep"] == [False, False, True, 2, True] and res["replaceDefault"] is True and res["newButton"] is False \
        and res["rows"] == 3 and res["name"] == "HÜ Test" and res["test"] == [1, "HÜ Test", "F1,F2", 0.5, 2, 1.5, "fehlt", 2] \
        and res["card"] and res["printGrade"] == [2, True, True, 1, True, 2] and res["printNoGrade"] == [1, False, True, True] and res["reimport"] == [1, 2, "5"]
    report("Moodle: Import im Test (Aufgaben ersetzen/behalten), Zuordnung, „fehlt“, Ausdruck mit/ohne Note, erneuter Import", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_launcher_check(br, base):
    """Startprogramm (launcher/): Go-Tests, echter Server, App legt Datenbank an und speichert in den Ordner."""
    print("Startprogramm (launcher/):")
    go = shutil.which("go")
    if not go:
        print("  –     übersprungen: Go ist nicht installiert")
        return
    lroot = os.path.join(ROOT, "launcher")
    r = subprocess.run([go, "test", "./..."], cwd=lroot, capture_output=True, text=True)
    report("go test", r.returncode == 0, (r.stdout + r.stderr)[-500:])
    tmp = tempfile.mkdtemp(prefix="nm-launcher-")
    exe = os.path.join(tmp, "ordonota" + (".exe" if os.name == "nt" else ""))
    r = subprocess.run([go, "build", "-o", exe, "."], cwd=lroot, capture_output=True, text=True)
    report("Programm baut", r.returncode == 0, r.stderr[-500:])
    if r.returncode:
        shutil.rmtree(tmp, ignore_errors=True)
        return
    data, cfg = os.path.join(tmp, "Daten ä"), os.path.join(tmp, "cfg")
    os.makedirs(data)
    port = free_port()
    args = [exe, "--no-browser", "--port", str(port), "--config-dir", cfg, "--data", data, "--app-dir", ROOT]
    env = dict(os.environ, ORDONOTA_NO_DESKTOP="1")
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, env=env)
    spec = importlib.util.spec_from_file_location("entschluesseln", os.path.join(ROOT, "tools", "entschluesseln.py"))
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    dbf, lockf = os.path.join(data, "notenmanager.nmdb"), os.path.join(data, "notenmanager.lock.json")

    def setting(path, password):
        """keepBackups aus der Datei (None, wenn nicht lesbar)."""
        try:
            with open(path, encoding="utf-8") as f:
                return tool.entschluesseln(json.load(f), password)["settings"]["keepBackups"]
        except Exception:
            return None

    def modal_with(title):
        return f"[...document.querySelectorAll('dialog.modal h2')].some((x) => x.textContent.includes({json.dumps(title)}))"

    def click_modal(label):
        br.eval(f"(() => {{ const d = [...document.querySelectorAll('dialog.modal')].pop(); [...d.querySelectorAll('button')].find((b) => b.textContent === {json.dumps(label)}).click(); return 1; }})()")
    try:
        url = proc.stdout.readline().strip()
        report("Server startet", url.startswith(f"http://127.0.0.1:{port}/start?t="), url)
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/info")
            report("Ohne Kennwort kein Zugriff", False, "Antwort 200")
        except urllib.error.HTTPError as e:
            report("Ohne Kennwort kein Zugriff", e.code == 401, str(e.code))
        second = subprocess.run(args, capture_output=True, text=True, env=env, timeout=10)
        report("Zweiter Start erkennt laufendes Programm", second.returncode == 0 and second.stdout.strip() == url, second.stdout + second.stderr)

        br.open(url)
        ok = br.wait("!!(window.NM && NM.app && NM.app.state.server && NM.app.state.store && document.querySelector('.auth-card input[type=password]'))", 30)
        report("App erkennt das Startprogramm", ok and br.eval("NM.app.state.store.name") == "Daten ä", "; ".join(br.errors))
        ver = br.eval("(document.querySelector('.auth-card .auth-version') || {}).textContent")
        report("Sperrbildschirm zeigt die Version", ver == "Version " + br.eval("NM.model.APP_VERSION"), str(ver))
        pw = "Prüf-Passwort 2026"
        # Entsperren ohne Datenbank → „Neue Datenbank anlegen“
        br.eval(f"(() => {{ const i = document.querySelector('.auth-card input[type=password]'); i.value = {json.dumps(pw)}; i.form.requestSubmit(); return 1; }})()")
        br.wait("document.querySelectorAll('.auth-card input[type=password]').length === 2", 20)
        br.eval(f"(() => {{ const [a, b] = document.querySelectorAll('.auth-card input[type=password]'); a.value = b.value = {json.dumps(pw)}; a.form.requestSubmit(); return 1; }})()")
        br.wait("!!document.querySelector('dialog.modal input[type=checkbox]')", 60)
        br.eval("(() => { const d = document.querySelector('dialog.modal'); d.querySelector('input[type=checkbox]').checked = true; d.querySelector('.btn-primary').click(); return 1; })()")
        ok = br.wait("!!document.getElementById('save-status')", 60)
        for _ in range(50):
            if os.path.exists(dbf) and os.path.exists(lockf):
                break
            time.sleep(0.2)
        report("Datenbank und Lock im Ordner angelegt (ohne Rückfrage)", ok and os.path.exists(dbf) and os.path.exists(lockf), "; ".join(br.errors))
        with open(dbf, encoding="utf-8") as f:
            outer = json.load(f)
        report("Datei mit Notfallwerkzeug lesbar", outer.get("format") == "notenmanager-db" and "schema" in tool.entschluesseln(outer, pw))
        br.eval("NM.app.state.db.settings.keepBackups = 7; NM.app.commit(); 1")
        def saved():
            return setting(dbf, pw) == 7
        for _ in range(40):
            time.sleep(0.25)
            if saved():
                break
        report("Änderung wird in den Ordner gespeichert", saved())
        # Anderes Gerät ändert die Datei → Konflikt-Dialog statt Überschreiben
        time.sleep(0.05)
        os.utime(dbf, None)
        br.eval("NM.app.state.db.settings.keepBackups = 8; NM.app.commit(); 1")
        ok = br.wait("[...document.querySelectorAll('dialog.modal h2')].some((x) => x.textContent.includes('extern geändert'))", 15)
        report("Externe Änderung erkannt (Konflikt-Dialog)", ok and saved() and not br.errors, "; ".join(br.errors))
        click_modal("Überschreiben")
        ok = False
        for _ in range(40):
            time.sleep(0.25)
            if setting(dbf, pw) == 8:
                ok = True
                break
        names = br.eval("NM.app.state.store.listBackups()")
        report("Überschreiben speichert, alter Stand als Sicherung", ok and isinstance(names, list) and len(names) >= 1, str(names))

        # Aus Datei wiederherstellen: Kopie mit anderem Passwort, das eigene Passwort bleibt
        other = "Anderes Passwort 123"
        br.eval(f"""(async () => {{ const db = JSON.parse(JSON.stringify(NM.app.state.db)); db.settings.keepBackups = 3;
            const r = await NM.crypto.Vault.create({json.dumps(other)}); const obj = await r.vault.seal(db, {{ savedAt: 'kopie' }});
            window.__kopie = JSON.stringify(obj);
            NM.util.pickFile = async () => new File([window.__kopie], 'kopie.nmdb'); return 1; }})()""")
        br.eval("NM.app.select({ tab: 'settings' }); 1")
        br.wait("[...document.querySelectorAll('button')].some((b) => b.textContent === 'Aus Datei wiederherstellen …')", 10)
        br.eval("[...document.querySelectorAll('button')].find((b) => b.textContent === 'Aus Datei wiederherstellen …').click(); 1")
        br.wait(modal_with("Aus Datei wiederherstellen"), 10)
        click_modal("Wiederherstellen")
        br.wait("!!document.querySelector('dialog.modal input[type=password]')", 30)
        br.eval(f"(() => {{ const d = document.querySelector('dialog.modal'); d.querySelector('input').value = {json.dumps(other)}; d.querySelector('.btn-primary').click(); return 1; }})()")
        ok = False
        for _ in range(80):
            time.sleep(0.25)
            if setting(dbf, pw) == 3:
                ok = True
                break
        report("Aus Datei wiederherstellen (fremdes Passwort, eigenes bleibt)", ok and not br.errors, "; ".join(br.errors))

        # Datenordner wechseln mit Sicherungen; alter Ordner bleibt
        neu = os.path.join(tmp, "Neuer Ordner")
        os.makedirs(neu)
        br.eval("NM.app.rerender(); 1")
        br.wait("[...document.querySelectorAll('button')].some((b) => b.textContent === 'Datenordner wechseln …')", 10)
        br.eval("[...document.querySelectorAll('button')].find((b) => b.textContent === 'Datenordner wechseln …').click(); 1")
        br.wait("!!document.querySelector('dialog.modal input')", 10)
        br.eval(f"(() => {{ const d = document.querySelector('dialog.modal'); d.querySelector('input').value = {json.dumps(neu)}; d.querySelector('.btn-primary').click(); return 1; }})()")
        br.wait(modal_with("Datenordner wechseln"), 10)
        click_modal("Mit Sicherungen")
        ok = br.wait("NM.app.state.store.name === 'Neuer Ordner'", 20)
        ndb = os.path.join(neu, "notenmanager.nmdb")
        with open(os.path.join(cfg, "config.json"), encoding="utf-8") as f:
            conf = json.load(f)
        report("Datenordner wechseln (Datenbank, Sicherungen, gemerkt)",
               ok and setting(ndb, pw) == 3 and sorted(os.listdir(os.path.join(neu, "Sicherungen"))) == sorted(os.listdir(os.path.join(data, "Sicherungen")))
               and conf["dataDir"] == neu and os.path.exists(dbf) and not os.path.exists(lockf), "; ".join(br.errors))
        br.eval("NM.app.state.db.settings.keepBackups = 4; NM.app.commit(); 1")
        for _ in range(40):
            time.sleep(0.25)
            if setting(ndb, pw) == 4:
                break
        report("Nach dem Wechsel wird im neuen Ordner gespeichert", setting(ndb, pw) == 4 and setting(dbf, pw) == 3)

        # Leerer Ordner: vorhandene Datenbank aus Datei übernehmen
        leer = os.path.join(tmp, "Leer")
        os.makedirs(leer)
        br.eval(f"(async () => {{ await NM.app.switchStore(await NM.storage.ServerStore.useTarget({{ path: {json.dumps(leer)} }})); return 1; }})()")
        br.wait("!!document.querySelector('.auth-card input[type=password]')", 20)
        br.eval(f"(() => {{ const i = document.querySelector('.auth-card input[type=password]'); i.value = 'egal egal'; i.form.requestSubmit(); return 1; }})()")
        br.wait("[...document.querySelectorAll('.auth-links button')].some((b) => b.textContent.startsWith('Vorhandene Datenbank'))", 20)
        br.eval("[...document.querySelectorAll('.auth-links button')].find((b) => b.textContent.startsWith('Vorhandene Datenbank')).click(); 1")
        br.wait("!!document.querySelector('dialog.modal input[type=password]')", 10)
        br.eval(f"(() => {{ const d = document.querySelector('dialog.modal'); d.querySelector('input').value = {json.dumps(other)}; d.querySelector('.btn-primary').click(); return 1; }})()")
        ok = br.wait("!!document.getElementById('save-status')", 60)
        ldb = os.path.join(leer, "notenmanager.nmdb")
        for _ in range(40):
            if os.path.exists(ldb):
                break
            time.sleep(0.25)
        report("Leerer Ordner: Datenbank aus Datei übernehmen (mit deren Passwort)", ok and setting(ldb, other) == 3, "; ".join(br.errors))
    except Exception as e:
        report("Startprogramm im Browser", False, str(e))
    finally:
        proc.terminate()
        try:
            proc.wait(5)
        except subprocess.TimeoutExpired:
            proc.kill()
        if os.name != "nt":
            report("Beim Beenden wird der eigene Lock freigegeben", not os.path.exists(lockf))
        br.open("about:blank")
        shutil.rmtree(tmp, ignore_errors=True)


def run_decrypt_tool(br, base):
    print("Notfallwerkzeug tools/entschluesseln.py:")
    spec = importlib.util.spec_from_file_location("entschluesseln", os.path.join(ROOT, "tools", "entschluesseln.py"))
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)

    # CSV-Ausgabe auch für Datenbanken früherer Versionen (tests/altdaten, ohne Migration)
    import glob, tempfile
    bad = []
    for f in sorted(glob.glob(os.path.join(ROOT, "tests", "altdaten", "v*.js"))):
        text = open(f, encoding="utf-8").read()
        fx = json.loads(text[text.index(".push(") + 6:text.rindex(");")])
        with tempfile.TemporaryDirectory() as tmp:
            try:
                pfade = tool.schreibe_csv(fx["db"], tmp)
                if len(pfade) != len(fx["db"]["courses"]):
                    bad.append(f"{fx['version']}: {len(pfade)} CSV-Dateien")
            except Exception as e:  # noqa: BLE001
                bad.append(f"{fx['version']}: {e!r}")
    report("CSV-Ausgabe für Datenbanken aller früheren Versionen", not bad, "; ".join(bad))

    br.open(f"{base}/index.html?demo")
    br.wait("!!window.NM && !!NM.crypto && !!NM.model")
    pw = "Prüf-Passwort ä€ 2026"
    sample = br.eval(
        "(async () => { const db = NM.model.migrate(NM.model.demoDb());"
        f" const r = await NM.crypto.Vault.create({json.dumps(pw)});"
        " const file = await r.vault.seal(db, { savedAt: 'test' });"
        " return { file: JSON.parse(JSON.stringify(file)), rk: r.recoveryKey, db: JSON.parse(JSON.stringify(db)) }; })()"
    )
    try:
        out = tool.entschluesseln(sample["file"], pw)
        report("Entschlüsseln mit Passwort (Umlaute/€)", out == sample["db"])
    except Exception as e:
        report("Entschlüsseln mit Passwort (Umlaute/€)", False, str(e))
    try:
        rk = sample["rk"].lower().replace("-", " ")
        out = tool.entschluesseln(sample["file"], rk, wiederherstellung=True)
        report("Entschlüsseln mit Wiederherstellungsschlüssel", out == sample["db"])
    except Exception as e:
        report("Entschlüsseln mit Wiederherstellungsschlüssel", False, str(e))
    try:
        tool.entschluesseln(sample["file"], "falsch")
        report("Falsches Passwort abgelehnt", False, "keine Fehlermeldung")
    except tool.EntschluesselungsFehler as e:
        report("Falsches Passwort abgelehnt", "Falsches Passwort" in str(e))
    tampered = json.loads(json.dumps(sample["file"]))
    tampered["data"]["ct"] = tampered["data"]["ct"][:-8] + "AAAAAAA="
    try:
        tool.entschluesseln(tampered, pw)
        report("Manipulierte Datei erkannt", False, "keine Fehlermeldung")
    except tool.EntschluesselungsFehler:
        report("Manipulierte Datei erkannt", True)
    # Kommandozeile + CSV in einem temporären Ordner
    tmp = tempfile.mkdtemp(prefix="nm-entschl-")
    try:
        path = os.path.join(tmp, "notenmanager.nmdb")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(sample["file"], f)
        orig = tool.getpass.getpass
        tool.getpass.getpass = lambda prompt="": pw
        try:
            code = tool.main([path, "--csv", os.path.join(tmp, "csv")])
        finally:
            tool.getpass.getpass = orig
        klartext = os.path.join(tmp, "notenmanager_klartext.json")
        ok = code == 0 and os.path.exists(klartext) and json.load(open(klartext, encoding="utf-8")) == sample["db"]
        csvs = os.listdir(os.path.join(tmp, "csv")) if os.path.isdir(os.path.join(tmp, "csv")) else []
        report("Kommandozeile schreibt JSON", ok)
        report(f"CSV je Kurs ({len(csvs)} Dateien)", len(csvs) == len(sample["db"]["courses"]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # Arbeit in Teilen: Rohpunkte je Teil in der CSV (Aufgabe ohne gültigen Teil → erster Teil)
    teile = {"parts": [{"id": "T", "name": "Theorie"}, {"id": "P", "name": "Praxis"}],
             "tasks": [{"id": "a", "partId": "T"}, {"id": "b", "partId": "P"}, {"id": "c"}]}
    text = tool._teilpunkte(teile, {"scores": {"a": 3, "b": 4.5, "c": 1}})
    text2 = tool._teilpunkte(teile, {"scores": {"a": 3}, "partStatus": {"P": "nachschreiben"}})
    report("CSV: Rohpunkte je Teil", text == "Theorie 4 + Praxis 4.5" and text2 == "Theorie 3 + Praxis nachschreiben", text + " | " + text2)
    # Gruppenpräsentation: Gruppenwert, Abweichung und Personenkriterium in der CSV
    gp = {"groupMode": "mixed", "criteria": [{"id": "i"}, {"id": "v", "scope": "person"}],
          "groups": [{"id": "g", "name": "G1", "members": ["a", "b"], "scores": {"i": 3, "v": 0}}],
          "results": {"a": {"scores": {"v": 2}}, "b": {"scores": {"i": 1}}}}
    wa, ga = tool._praes_punkte(gp, "a")
    wb, _ = tool._praes_punkte(gp, "b")
    report("CSV: Gruppenpräsentation (Gruppenwert, Abweichung)", wa == {"i": 3.0, "v": 2.0} and wb == {"i": 1.0} and ga["name"] == "G1", f"{wa} | {wb}")
    # OrdoScripto (1.41): Test-ID im Spaltenkopf, Pseudonym je Person; Nachschreibtermin mit den IDs der Arbeit
    tmp = tempfile.mkdtemp(prefix="nm-csv-")
    try:
        sc = {"testId": "T-2026-0007", "ids": {"a": "S-7F3K9Q"}, "created": "2026-11-10T08:00:00Z"}
        kurs = {"id": "k", "klasse": "9a", "fach": "M", "jahrgang": 9, "einstufung": "E",
                "students": [{"id": "a", "last": "A", "first": "X"}, {"id": "b", "last": "B", "first": "Y", "einstufung": "E2"}],
                "assessments": [{"id": "t1", "kind": "test", "half": "HJ1", "name": "KA", "weight": 1,
                                 "test": {"tasks": [], "results": {"a": {"scores": {"x": 3}}}, "scripto": sc}},
                                {"id": "t2", "kind": "test", "half": "HJ1", "name": "NS", "weight": 1, "makeupOf": "t1",
                                 "test": {"tasks": [], "results": {"a": {"status": "fehlt"}}}}]}
        pfad = tool.schreibe_csv({"years": [], "courses": [kurs]}, tmp)[0]
        with open(pfad, encoding="utf-8-sig") as f:
            zeilen = [z.rstrip("\n").split(";") for z in f]
        ok = ("OrdoScripto T-2026-0007" in zeilen[0][4] and "OrdoScripto T-2026-0007" in zeilen[0][5]
              and zeilen[1][4:6] == ["3 Pkt. [S-7F3K9Q]", "fehlt [S-7F3K9Q]"] and zeilen[2][4:6] == ["", ""])
        report("CSV: Pseudonyme für OrdoScripto (Test-ID im Kopf, Schüler-ID je Person, Nachschreibtermin)", ok, str(zeilen))
        report("CSV: Einstufung je Person (Kurs E, Abweichung E2)", zeilen[0][3] == "Einstufung" and zeilen[1][3] == "E" and zeilen[2][3] == "E2", str(zeilen))
        # Fehlzeiten (1.45): je Halbjahr Fehlstunden gesamt (E/U/offen)
        kurs["attendance"] = {"2026-09-01": {"half": "HJ1", "hours": 2, "abs": {"a": "e", "b": "a"}},
                              "2026-09-08": {"half": "HJ1", "hours": 1, "abs": {"a": "u"}},
                              "2026-03-02": {"half": "HJ2", "hours": 1, "abs": {"b": "u"}}}
        pfad = tool.schreibe_csv({"years": [], "courses": [kurs]}, tmp)[0]
        with open(pfad, encoding="utf-8-sig") as f:
            zf = [z.rstrip("\n").split(";") for z in f]
        i1, i2 = zf[0].index("Fehlstunden HJ1 (E/U/offen)"), zf[0].index("Fehlstunden HJ2 (E/U/offen)")
        report("CSV: Fehlzeiten je Halbjahr in Unterrichtsstunden", [zf[1][i1], zf[2][i1], zf[1][i2], zf[2][i2]] == ["3 (2/1/0)", "2 (0/0/2)", "", "1 (0/1/0)"], str(zf))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    srv, base = serve()
    br = Browser()
    try:
        run_test_pages(br, base)
        run_app_smoke(br, base)
        run_sort_check(br, base)
        run_course_check(br, base)
        run_epo_material_check(br, base)
        run_attendance_check(br, base)
        run_epo_tiles_check(br, base)
        run_print_head_check(br, base)
        run_draw_check(br, base)
        run_draw_pools_check(br, base)
        run_random_check(br, base)
        run_timer_check(br, base)
        run_tools_layout_check(br, base)
        run_tools_menu_check(br, base)
        run_pomodoro_check(br, base)
        run_transition_check(br, base)
        run_sidebar_check(br, base)
        run_tests_view_check(br, base)
        run_task_add_click_check(br, base)
        run_makeup_check(br, base)
        run_unreachable_check(br, base)
        run_tabs_check(br, base)
        run_tab_order_check(br, base)
        run_overview_fold_check(br, base)
        run_settings_layout_check(br, base)
        run_theme_check(br, base)
        run_demo_link_check(br, base)
        run_old_db_check(br, base)
        run_parts_check(br, base)
        run_print_menu_check(br, base)
        run_pres_check(br, base)
        run_group_check(br, base)
        run_groups_tab_check(br, base)
        run_moodle_check(br, base)
        run_scripto_check(br, base)
        run_decrypt_tool(br, base)
        run_launcher_check(br, base)
    finally:
        br.close()
        srv.shutdown()
    failed = results.count(False)
    print()
    print(f"ERGEBNIS: {len(results) - failed} von {len(results)} bestanden" + ("" if not failed else f" – {failed} FEHLGESCHLAGEN"))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
