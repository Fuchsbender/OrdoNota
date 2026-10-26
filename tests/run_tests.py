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

Ergebnis: Exit-Code 0, wenn alles bestanden ist.
"""
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
    for page in ["grades", "model", "moodle", "pomodoro", "crypto", "storage"]:
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
    for tab in ["course", "tests", "epo", "draw", "overview", "settings"]:
        for course in [0, 1]:
            br.eval(f"NM.app.select({{courseId: NM.app.db().courses[{course}].id, tab: '{tab}'}}); 1")
            time.sleep(0.15)
            n = br.eval("document.getElementById('view').children.length")
            stray = br.eval("[...document.getElementById('view').childNodes].some((x) => x.nodeType === 3 && /null|undefined/.test(x.textContent))")
            report(f"Reiter {tab} (Kurs {course + 1})", bool(n) and not stray and not br.errors, "; ".join(br.errors) + (" ; Text „null“ im Reiter" if stray else ""))
            br.errors = []


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
        ("tests", 0, "Σ", "desc", "(c, s) => { const t = c.assessments.find((a) => a.id === NM.app.state.ui.testId[c.id]) || c.assessments.filter((a) => a.kind === 'test' && a.half === NM.app.currentHalf(c)).pop(); return NM.grades.testResult(t.test, s, NM.grades.courseLevel(c)).score; }"),
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
    ok = all(r and r["cards"] == 7 and r["gap"] <= 20 and r["selOk"] and r["chipOk"] for r in out.values())
    report("Einstellungen ohne Lücken bei 1570/2560 px, Auswahllisten nicht abgeschnitten, Kürzel „MSS12“ passt", ok and not br.errors, str(out) + "; ".join(br.errors))


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
        out.printParts = printed('parts').includes('Teilübersicht');
        out.btn = !![...document.querySelectorAll('.btn')].find((b) => b.textContent === '🖨 Teilübersicht');
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
        const n = c.assessments.length;
        click('Moodle-Import'); await wait();
        await pick([['10a-HÜ Test-Antworten.csv', answers], ['10a-HÜ Test-Bewertungen.csv', grades]]);
        out.rows = document.querySelectorAll('dialog tbody tr').length;
        out.name = document.querySelector('dialog input:not([type=file])').value;
        document.querySelector('dialog .btn-primary').click(); await wait();
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
    ok = bool(res) and res["rows"] == 3 and res["name"] == "HÜ Test" and res["test"] == [1, "HÜ Test", "F1,F2", 0.5, 2, 1.5, "fehlt", 2] \
        and res["card"] and res["printGrade"] == [2, True, True, 1, True, 2] and res["printNoGrade"] == [1, False, True, True] and res["reimport"] == [1, 2, "5"]
    report("Moodle: Import mit Zuordnung, „fehlt“, Ausdruck mit/ohne Note, erneuter Import", ok and not br.errors, str(res) + "; ".join(br.errors))


def run_decrypt_tool(br, base):
    print("Notfallwerkzeug tools/entschluesseln.py:")
    spec = importlib.util.spec_from_file_location("entschluesseln", os.path.join(ROOT, "tools", "entschluesseln.py"))
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)

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


def main():
    srv, base = serve()
    br = Browser()
    try:
        run_test_pages(br, base)
        run_app_smoke(br, base)
        run_sort_check(br, base)
        run_course_check(br, base)
        run_draw_check(br, base)
        run_pomodoro_check(br, base)
        run_transition_check(br, base)
        run_sidebar_check(br, base)
        run_tests_view_check(br, base)
        run_settings_layout_check(br, base)
        run_parts_check(br, base)
        run_moodle_check(br, base)
        run_decrypt_tool(br, base)
    finally:
        br.close()
        srv.shutdown()
    failed = results.count(False)
    print()
    print(f"ERGEBNIS: {len(results) - failed} von {len(results)} bestanden" + ("" if not failed else f" – {failed} FEHLGESCHLAGEN"))
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
