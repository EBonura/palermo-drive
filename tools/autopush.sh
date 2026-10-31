#!/bin/sh
# Push every verified change to GitHub Pages while work is in progress (the owner tests on a phone).
# Each round: if anything changed, load the game headless (title screen and a driving spot) and push
# only if the page logged no errors. Run once with "once", or loop forever with no argument.
cd "$(dirname "$0")/.."
export GH_TOKEN="$(gh auth token --user EBonura)"

smoke() {
  # desktop title, desktop driving, and a phone in landscape with the touch UI (low quality path)
  for run in "1280,720|" "1280,720|spot=1&cam=0" "844,390|spot=2&touch"; do
    size=${run%%|*}; q=${run#*|}
    P=$(mktemp -d "${TMPDIR:-/tmp}/pd-smoke.XXXXXX")
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir="$P" \
      --use-angle=metal --enable-gpu --ignore-gpu-blocklist --window-size="$size" \
      --enable-logging=stderr --v=0 --virtual-time-budget=20000 --screenshot="$P/s.png" \
      "http://localhost:8790/?$q" 2>"$P.log"
    errs=$(grep -E 'Uncaught|ERROR:CONSOLE|SyntaxError|TypeError|ReferenceError' "$P.log" | grep 'localhost:8790' | grep -v 'computeBoundingSphere' | head -3)
    rm -rf "$P" "$P.log"
    if [ -n "$errs" ]; then echo "smoke failed ($q): $errs"; return 1; fi
  done
}

round() {
  [ -z "$(git status --porcelain)" ] && return 0
  if smoke; then
    files=$(git status --porcelain | awk '{print $2}' | sed 's#^src/##' | head -8 | tr '\n' ' ')
    git add -A && git commit -q -m "Progress: $files" && \
      git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -q origin main && \
      echo "$(date +%H:%M:%S) pushed: $files"
  fi
}

if [ "$1" = once ]; then round; exit; fi
while true; do round; sleep 120; done
