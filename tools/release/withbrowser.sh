#!/bin/zsh
# withbrowser.sh <command...>   run a browser test while holding one of the shared slots, on the separate headless Chrome (never the Chrome app players use).
# Google's chrome-headless-shell lives in ~/.cache/palermo-drive: macOS hands a click on the Chrome icon to any running copy of the Chrome app, so tests must not run that app.
C=$HOME/.cache/palermo-drive; SLOTS=$C/browser-slots; MAX=${BROWSER_SLOTS:-8}; mkdir -p $SLOTS
export PD_CHROME=$C/chrome-headless-shell-mac-arm64/chrome-headless-shell
export PATH=$HOME/.nvm/versions/node/v22.15.0/bin:$PATH
slot=""
while [ -z "$slot" ]; do
  for i in $(seq 1 $MAX); do
    d=$SLOTS/$i
    if [ -d $d ]; then p=$(cat $d/pid 2>/dev/null); if [ -n "$p" ] && ! kill -0 $p 2>/dev/null; then rm -rf $d; fi; fi
    if mkdir $d 2>/dev/null; then echo $$ > $d/pid; slot=$d; break; fi
  done
  [ -n "$slot" ] || sleep 10
done
trap 'rm -rf $slot' EXIT
"$@"
