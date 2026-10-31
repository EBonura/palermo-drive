#!/bin/sh
# Headless screenshot of the running game: tools/shot.sh out.png "spot=2&cam=1&turn=135"
# Free camera instead: tools/shot.sh out.png "campos=x,y,z&look=x,y,z"   (y is height in metres above sea)
# Needs the local server on 8790. Prints page console errors, if any, after the shot.
OUT="$1"; Q="$2"
# A fresh profile per run so several shots can run at once.
PROFILE=$(mktemp -d "${TMPDIR:-/tmp}/palermo-shot.XXXXXX")
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir="$PROFILE" \
  --use-angle=metal --enable-gpu --ignore-gpu-blocklist --hide-scrollbars --window-size=1280,720 \
  --enable-logging=stderr --v=0 \
  --virtual-time-budget=20000 --screenshot="$OUT" "http://localhost:8790/?help=0&$Q" 2>"$PROFILE.log"
grep -E 'CONSOLE|Uncaught' "$PROFILE.log" | grep 'localhost:8790' | grep -viE 'GPU stall|Automatic fallback' | head -20
rm -rf "$PROFILE" "$PROFILE.log"
