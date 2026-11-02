#!/bin/sh
# Rebuilds the share images assets/ui/cover.png (1200x630, og:image) and cover-portrait.png (1080x1920)
# from a fresh render of the game plus the logo. Needs a static server on :8790 (PORT=n to change it; e.g. python3 -m http.server 8790 from the repo root) and Chrome on macOS.
#   assets/ui/make-cover.sh        re-render the two background shots, then compose both covers
#   assets/ui/make-cover.sh keep   compose from the backgrounds already in assets/ui/cover-src/
HERE=$(cd "$(dirname "$0")" && pwd)
PORT=${PORT:-8790}
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/pd-cover.XXXXXX")
shot() { # out.png url width height budget_ms
  "$CHROME" --headless=new --user-data-dir="$TMP/profile$$" --use-angle=metal --enable-gpu --ignore-gpu-blocklist --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=$3,$4 --virtual-time-budget=$5 --screenshot="$1" "$2" 2>/dev/null
}
if [ "$1" != "keep" ]; then
  # the lapa in the Quattro Canti crossing, seen from behind in the game's own chase camera (?clean: no HUD), with whoever is walking by (far chase camera, cam=1; x east, z south, heading 0 = south down Via Maqueda)
  shot "$TMP/l.png" "http://localhost:$PORT/?help=0&play&clean&cam=1&at=17.5,0,0" 1800 945 30000
  shot "$TMP/p.png" "http://localhost:$PORT/?help=0&play&clean&cam=1&at=17.5,0,0" 1080 1920 30000
  sips -s format jpeg -s formatOptions 90 "$TMP/l.png" --out "$HERE/cover-src/bg-landscape.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 90 "$TMP/p.png" --out "$HERE/cover-src/bg-portrait.jpg" >/dev/null
fi
shot "$HERE/cover.png" "http://localhost:$PORT/assets/ui/cover.html?mode=landscape" 1200 630 6000
shot "$HERE/cover-portrait.png" "http://localhost:$PORT/assets/ui/cover.html?mode=portrait" 1080 1920 6000
rm -rf "$TMP"
