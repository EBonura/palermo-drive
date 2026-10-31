#!/bin/sh
# Headless screenshot of the stand-alone facade viewer (no other game modules): tools/district-shot.sh out.png "campos=x,y,z&look=x,y,z[&tiles=..]"
OUT="$1"; Q="$2"
PROFILE=$(mktemp -d "${TMPDIR:-/tmp}/palermo-dshot.XXXXXX")
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir="$PROFILE" \
  --use-angle=metal --enable-gpu --ignore-gpu-blocklist --hide-scrollbars --window-size=1280,720 \
  --enable-logging=stderr --v=0 \
  --virtual-time-budget=40000 --screenshot="$OUT" "http://localhost:8790/tools/district-view.html?$Q" 2>"$PROFILE.log"
grep -E 'CONSOLE|Uncaught' "$PROFILE.log" | grep 'localhost:8790' | grep -viE 'GPU stall|Automatic fallback' | cut -c1-400 | head -20
rm -rf "$PROFILE" "$PROFILE.log"
