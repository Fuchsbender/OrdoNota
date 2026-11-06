#!/usr/bin/env bash
# Baut das OrdoNota-Startprogramm für Linux, Windows und Mac (Intel und Apple Silicon).
#
#   launcher/build.sh            → dist/OrdoNota-<Version>/ und dist/OrdoNota-<Version>.zip (für Kollegen)
#                                  und ./OrdoNota im Programmordner (für dieses Gerät)
#
# Die App-Dateien (index.html, css/, js/, logo/, demo/, cards/) werden ins Programm eingebaut. Liegt neben dem
# Programm eine index.html (wie im Programmordner), nimmt das Programm stattdessen diese Dateien.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"
VER="$(sed -n "s/.*APP_VERSION = '\([^']*\)'.*/\1/p" "$ROOT/js/model.js")"
OUT="$ROOT/dist/OrdoNota-$VER"

echo "OrdoNota $VER"
go test ./...

rm -rf webapp "$ROOT"/dist/OrdoNota-*
mkdir -p webapp "$OUT"
cp -r "$ROOT/index.html" "$ROOT/css" "$ROOT/js" "$ROOT/logo" "$ROOT/demo" "$ROOT/cards" webapp/
trap 'rm -rf webapp' EXIT

build() { # GOOS GOARCH Ziel [ldflags]
  echo "  $1/$2 → ${3#$ROOT/}"
  CGO_ENABLED=0 GOOS="$1" GOARCH="$2" go build -tags embedapp -trimpath -ldflags "-s -w ${4:-}" -o "$3" .
}

build linux amd64 "$OUT/OrdoNota-Linux"
build windows amd64 "$OUT/OrdoNota.exe" "-H=windowsgui"

# Mac: App-Paket; ein kleines Skript wählt die passende Fassung (Intel oder Apple Silicon)
APP="$OUT/OrdoNota.app/Contents"
mkdir -p "$APP/MacOS"
build darwin amd64 "$APP/MacOS/ordonota-x86_64"
build darwin arm64 "$APP/MacOS/ordonota-arm64"
cat > "$APP/MacOS/OrdoNota" <<'SH'
#!/bin/sh
exec "$(dirname "$0")/ordonota-$(uname -m)" "$@"
SH
chmod +x "$APP/MacOS/OrdoNota"
cat > "$APP/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>OrdoNota</string>
  <key>CFBundleIdentifier</key><string>de.ordonota.start</string>
  <key>CFBundleName</key><string>OrdoNota</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VER</string>
  <key>CFBundleVersion</key><string>$VER</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

cp "$ROOT/launcher/LIESMICH.txt" "$OUT/LIESMICH.txt"
cp "$ROOT/LICENSE" "$OUT/LICENSE"
cp "$ROOT/tools/entschluesseln.py" "$OUT/entschluesseln.py"

# ZIP mit Ausführungsrechten (Linux/Mac)
python3 - "$OUT" <<'PY'
import os, sys, zipfile
src = sys.argv[1]
base = os.path.dirname(src)
with zipfile.ZipFile(src + ".zip", "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(d, f)
            info = zipfile.ZipInfo.from_file(p, os.path.relpath(p, base))
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(p, "rb") as fh:
                z.writestr(info, fh.read())
PY

# Für dieses Gerät: Programm in den Programmordner (nimmt die App-Dateien von dort)
if [ "$(uname -s)" = Linux ]; then
  # Über eine Hilfsdatei ersetzen: klappt auch, während OrdoNota läuft
  cp "$OUT/OrdoNota-Linux" "$ROOT/.OrdoNota.neu" && mv -f "$ROOT/.OrdoNota.neu" "$ROOT/OrdoNota"
  echo "  ./OrdoNota (dieses Gerät)"
fi
echo "Fertig: ${OUT#$ROOT/}.zip"
