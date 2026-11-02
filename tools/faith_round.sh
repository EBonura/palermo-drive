#!/bin/zsh
# One command for a faithfulness comparison round (game against Mapillary photos at the most important places).
#   tools/faith_round.sh [ROUND_DIR] [PORT]        default ROUND_DIR=/private/tmp/claude-501/round3, PORT=9655
# 1. snapshots the committed game (git archive HEAD) into ROUND_DIR/game, so other people's edits do not change a round halfway
# 2. downloads the reference photos (tools/mapillary_refs.py, tools/mapillary_extra.py; token from data/mapillary_token, never printed)
# 3. serves the snapshot, shoots every viewpoint (tools/faith_shoot.mjs, through the shared browser slots if /private/tmp/claude-501/withbrowser.sh exists)
# 4. builds the contact sheets in ROUND_DIR/sheets (tools/faith_sheet.py: game left, photo right; --grid for the game-only shots)
# Then read the sheets and write docs/faithfulness/survey/round-N.md (see round-2.md for the layout). Photos stay in ROUND_DIR, never in the repo.
set -e
export PATH=/Users/ebonura/.nvm/versions/node/v22.15.0/bin:$PATH
R=${1:-/private/tmp/claude-501/round3}; PORT=${2:-9655}; HERE=$(cd "$(dirname "$0")/.." && pwd); cd "$HERE"
mkdir -p $R/game && git archive HEAD | tar -x -C $R/game && git rev-parse --short HEAD > $R/game/.sha
python3 tools/mapillary_refs.py $R
python3 tools/mapillary_extra.py $R
(cd $R/game && python3 -m http.server $PORT --bind 127.0.0.1 >$R/server.log 2>&1 & echo $! > $R/server.pid)
trap 'kill $(cat $R/server.pid) 2>/dev/null' EXIT
sleep 1
WB=/private/tmp/claude-501/withbrowser.sh; [ -x $WB ] || WB=""
$WB node tools/faith_shoot.mjs --base http://127.0.0.1:$PORT/ --round $R
python3 tools/faith_sheet.py $R
python3 tools/faith_sheet.py $R --only x
python3 tools/faith_sheet.py $R --grid
echo "sheets in $R/sheets (game commit $(cat $R/game/.sha))"
