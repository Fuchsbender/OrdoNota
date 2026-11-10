"""QR-Codes mit zxing-cpp zurücklesen (für tests/run_tests.py).

Läuft in einer eigenen Umgebung, weil zxing-cpp, Pillow und pypdfium2 nur hier gebraucht werden:

    uv run --with zxing-cpp --with pillow --with pypdfium2 python tests/qr_lesen.py matrizen DATEI.json
    uv run --with zxing-cpp --with pillow --with pypdfium2 python tests/qr_lesen.py pdf DATEI.pdf

„matrizen“: JSON-Liste von Modulmatrizen (Listen von Zeilen mit true/false) → JSON-Liste der gelesenen Texte.
„pdf“: jede Seite mit 300 dpi in Graustufen rastern (wie der Scan-Import von OrdoScripto) → JSON-Liste je Seite
mit allen gelesenen QR-Texten. Dieselbe Bibliothek liest die Trennblätter später in OrdoScripto.
"""

import json
import sys

import zxingcpp
from PIL import Image


def lies(bild):
    return [r.text for r in zxingcpp.read_barcodes(bild, formats=zxingcpp.BarcodeFormat.QRCode)]


def matrix_bild(mod, px=6, ruhe=4):
    n = len(mod)
    bild = Image.new("L", ((n + 2 * ruhe) * px,) * 2, 255)
    for y, zeile in enumerate(mod):
        for x, dunkel in enumerate(zeile):
            if dunkel:
                bild.paste(0, ((x + ruhe) * px, (y + ruhe) * px, (x + ruhe + 1) * px, (y + ruhe + 1) * px))
    return bild


def main(art, pfad):
    if art == "matrizen":
        with open(pfad, encoding="utf-8") as f:
            matrizen = json.load(f)
        out = [(lies(matrix_bild(m)) or [None])[0] for m in matrizen]
    elif art == "pdf":
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(pfad)
        out = [lies(seite.render(scale=300 / 72, grayscale=True).to_pil().convert("L")) for seite in doc]
    else:
        raise SystemExit("Aufruf: qr_lesen.py matrizen|pdf DATEI")
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:3])
