#!/bin/sh
# Rebuilds the share images assets/ui/cover.png (1200x630, og:image) and cover-portrait.png (1080x1920)
# from a fresh render of the city plus the logo. Needs the dev server on :8790 and Chrome on macOS.
#   assets/ui/make-cover.sh        re-render the two background shots, then compose both covers
#   assets/ui/make-cover.sh keep   compose from the backgrounds already in assets/ui/cover-src/
HERE=$(cd "$(dirname "$0")" && pwd)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/pd-cover.XXXXXX")
shot() { # out.png url width height budget_ms
  "$CHROME" --headless=new --user-data-dir="$TMP/profile$$" --use-angle=metal --enable-gpu --ignore-gpu-blocklist --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=$3,$4 --virtual-time-budget=$5 --screenshot="$1" "$2" 2>/dev/null
}
if [ "$1" != "keep" ]; then
  # high over the Cala and Foro Italico, Monte Pellegrino on the horizon (free camera: x east, y up, z south, metres)
  shot "$TMP/l.png" "http://localhost:8790/?campos=380,80,-140&look=-300,200,-3500" 1800 945 22000
  shot "$TMP/p.png" "http://localhost:8790/?campos=420,95,-260&look=-500,330,-5400" 1080 1920 22000
  sips -s format jpeg -s formatOptions 90 "$TMP/l.png" --out "$HERE/cover-src/bg-landscape.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 90 "$TMP/p.png" --out "$HERE/cover-src/bg-portrait.jpg" >/dev/null
fi
shot "$HERE/cover.png" "http://localhost:8790/assets/ui/cover.html?mode=landscape" 1200 630 6000
shot "$HERE/cover-portrait.png" "http://localhost:8790/assets/ui/cover.html?mode=portrait" 1080 1920 6000
rm -rf "$TMP"
