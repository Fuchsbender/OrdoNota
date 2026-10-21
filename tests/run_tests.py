#!/usr/bin/env python3
"""Führt alle automatischen Tests des Notenmanagers in einem unsichtbaren Chromium-Browser aus.

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
    for page in ["grades", "model", "crypto", "storage"]:
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
    for tab in ["course", "tests", "epo", "overview", "settings"]:
        for course in [0, 1]:
            br.eval(f"NM.app.select({{courseId: NM.app.db().courses[{course}].id, tab: '{tab}'}}); 1")
            time.sleep(0.15)
            n = br.eval("document.getElementById('view').children.length")
            report(f"Reiter {tab} (Kurs {course + 1})", bool(n) and not br.errors, "; ".join(br.errors))
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


def main():
    srv, base = serve()
    br = Browser()
    try:
        run_test_pages(br, base)
        run_app_smoke(br, base)
        run_sort_check(br, base)
        run_course_check(br, base)
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
