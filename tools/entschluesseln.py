#!/usr/bin/env python3
"""Notenmanager – Notfall-Entschlüsselung ohne App.

Entschlüsselt eine Notenmanager-Datenbank (.nmdb, auch Sicherungen) mit dem
Passwort oder dem Wiederherstellungsschlüssel und schreibt den Inhalt als
lesbares JSON. Damit sind die Daten auch dann zugänglich, wenn die App selbst
nicht mehr läuft.

Voraussetzung: Python 3.8+ und das Paket "cryptography"
    pip install cryptography
  oder ohne Installation:
    uv run --with cryptography tools/entschluesseln.py notenmanager.nmdb

Aufruf:
    python3 entschluesseln.py DATEI.nmdb                  (fragt nach dem Passwort)
    python3 entschluesseln.py DATEI.nmdb --wiederherstellung
    python3 entschluesseln.py DATEI.nmdb -o ausgabe.json
    python3 entschluesseln.py DATEI.nmdb --csv ordner/     (zusätzlich eine CSV je Kurs)

ACHTUNG: Die Ausgabe ist NICHT verschlüsselt. Nach Gebrauch löschen.
"""
import argparse
import base64
import csv
import getpass
import hashlib
import json
import os
import re
import sys

FORMAT = "notenmanager-db"


class EntschluesselungsFehler(Exception):
    pass


def _aesgcm():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    except ImportError:
        raise EntschluesselungsFehler(
            'Das Python-Paket "cryptography" fehlt. Installation: pip install cryptography'
        )
    return AESGCM


def normalisiere_wiederherstellungsschluessel(s):
    """Wie in der App: Großbuchstaben, nur A–Z und 0–9 (Bindestriche/Leerzeichen egal)."""
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def entschluesseln(datei_obj, geheimnis, wiederherstellung=False):
    """Gibt den entschlüsselten Inhalt (dict) zurück.

    datei_obj: geladenes JSON der .nmdb-Datei
    geheimnis: Passwort bzw. Wiederherstellungsschlüssel
    """
    if not isinstance(datei_obj, dict) or datei_obj.get("format") != FORMAT:
        raise EntschluesselungsFehler("Diese Datei ist keine Notenmanager-Datenbank.")
    if datei_obj.get("version", 1) > 1:
        raise EntschluesselungsFehler("Unbekannte Dateiversion – bitte neuere Version dieses Werkzeugs verwenden.")
    AESGCM = _aesgcm()
    b = base64.b64decode
    huelle = datei_obj["rec" if wiederherstellung else "pw"]
    if wiederherstellung:
        geheimnis = normalisiere_wiederherstellungsschluessel(geheimnis)
    # 1. Schlüssel ableiten (PBKDF2-SHA256, Parameter stehen in der Datei)
    k = hashlib.pbkdf2_hmac("sha256", geheimnis.encode("utf-8"), b(huelle["salt"]), int(huelle["iter"]), 32)
    # 2. Datenschlüssel auspacken (AES-256-GCM; Prüfsumme hängt am Ende von ct – wie bei WebCrypto)
    try:
        datenschluessel = AESGCM(k).decrypt(b(huelle["iv"]), b(huelle["ct"]), None)
    except Exception:
        raise EntschluesselungsFehler(
            "Wiederherstellungsschlüssel ist nicht korrekt." if wiederherstellung else "Falsches Passwort."
        )
    # 3. Daten entschlüsseln
    try:
        klartext = AESGCM(datenschluessel).decrypt(b(datei_obj["data"]["iv"]), b(datei_obj["data"]["ct"]), None)
    except Exception:
        raise EntschluesselungsFehler("Die Daten sind beschädigt oder wurden verändert.")
    return json.loads(klartext.decode("utf-8"))


# ---------- optionale CSV-Ausgabe (Rohdaten, ohne Berechnung) ----------

def _label(p, mss):
    if p is None:
        return ""
    if mss:
        return f"{p:02d}"
    if p <= 0:
        return "6"
    ganz = 6 - ((p - 1) // 3 + 1)
    tendenz = "+" if p % 3 == 0 else "-" if p % 3 == 1 else ""
    return f"{ganz}{tendenz}"


def schreibe_csv(daten, ordner):
    """Eine CSV je Kurs mit den direkt eingetragenen Noten und gesetzten Noten.

    Testergebnisse und EPO-Bewertungen werden als Rohdaten aufgeführt; die
    Berechnung der Noten erfolgt nur in der App.
    """
    os.makedirs(ordner, exist_ok=True)
    jahre = {j["id"]: j["name"] for j in daten.get("years", [])}
    pfade = []
    for kurs in daten.get("courses", []):
        mss = int(kurs.get("jahrgang", 5)) >= 11
        schueler = sorted(kurs.get("students", []), key=lambda s: (s.get("last", ""), s.get("first", "")))
        spalten = []
        for a in kurs.get("assessments", []):
            spalten.append(a)
        kopf = ["Nachname", "Vorname", "aktiv"]
        for a in spalten:
            kopf.append(f'{a.get("half")} {a.get("name")} ({a.get("kind")}, Gewicht {a.get("weight")})')
        override_keys = sorted(kurs.get("overrides", {}).keys())
        kopf += [f"gesetzt {k}" for k in override_keys] + ["Bemerkung"]
        zeilen = [kopf]
        for s in schueler:
            sid = s["id"]
            z = [s.get("last", ""), s.get("first", ""), "ja" if s.get("active", True) else "nein"]
            for a in spalten:
                if a.get("kind") == "manual":
                    g = a.get("manual", {}).get("grades", {}).get(sid, {})
                    z.append(g.get("status") or _label(g.get("p"), mss))
                elif a.get("kind") == "test":
                    r = a.get("test", {}).get("results", {}).get(sid, {})
                    punkte = sum(float(v) for v in r.get("scores", {}).values() if v not in (None, ""))
                    z.append(r.get("status") or (f"{punkte:g} Pkt." if r.get("scores") else ""))
                else:
                    e = a.get("epo", {}).get("entries", {}).get(sid, {})
                    z.append(" ".join((c.get("r", "") + c.get("hw", "")) for c in e.values()))
            for k in override_keys:
                z.append(_label(kurs["overrides"][k].get(sid, {}).get("p"), mss))
            z.append(kurs.get("comments", {}).get(sid, ""))
            zeilen.append(z)
        name = f'{jahre.get(kurs.get("yearId"), "")}_{kurs.get("klasse", "")}_{kurs.get("fach", "")}'
        name = re.sub(r'[\\/:*?"<>|\s]+', "_", name).strip("_") or kurs["id"]
        pfad = os.path.join(ordner, name + ".csv")
        with open(pfad, "w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f, delimiter=";").writerows(zeilen)
        pfade.append(pfad)
    return pfade


def main(argv=None):
    ap = argparse.ArgumentParser(description="Notenmanager-Datenbank ohne App entschlüsseln.")
    ap.add_argument("datei", help="Pfad zur .nmdb-Datei (auch Sicherungen)")
    ap.add_argument("-w", "--wiederherstellung", action="store_true", help="mit Wiederherstellungsschlüssel statt Passwort")
    ap.add_argument("-o", "--ausgabe", help="Ausgabedatei (Standard: <datei>_klartext.json)")
    ap.add_argument("--csv", metavar="ORDNER", help="zusätzlich eine CSV-Datei je Kurs in diesen Ordner schreiben")
    ap.add_argument("-f", "--ueberschreiben", action="store_true", help="vorhandene Ausgabedatei überschreiben")
    args = ap.parse_args(argv)

    try:
        with open(args.datei, encoding="utf-8") as f:
            datei_obj = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"Datei kann nicht gelesen werden: {e}", file=sys.stderr)
        return 2

    frage = "Wiederherstellungsschlüssel: " if args.wiederherstellung else "Passwort: "
    geheimnis = getpass.getpass(frage)

    try:
        daten = entschluesseln(datei_obj, geheimnis, args.wiederherstellung)
    except EntschluesselungsFehler as e:
        print(e, file=sys.stderr)
        return 1

    ausgabe = args.ausgabe or os.path.splitext(args.datei)[0] + "_klartext.json"
    if os.path.exists(ausgabe) and not args.ueberschreiben:
        print(f"{ausgabe} existiert bereits (mit -f überschreiben).", file=sys.stderr)
        return 2
    with open(ausgabe, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
    kurse = len(daten.get("courses", []))
    schueler = sum(len(c.get("students", [])) for c in daten.get("courses", []))
    print(f"Entschlüsselt: {kurse} Kurse, {schueler} Schülerinnen/Schüler → {ausgabe}")
    if args.csv:
        for p in schreibe_csv(daten, args.csv):
            print(f"CSV: {p}")
    print("ACHTUNG: Die Ausgabe ist unverschlüsselt. Bitte nach Gebrauch löschen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
