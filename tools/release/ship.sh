#!/bin/zsh
# ship.sh <commit message file> file...   build the staged state of the ship worktree (~/.cache/palermo-drive/ship-wt), run the checks, push only if everything passes, then bring the main checkout along.
# Stage the change there first, for example: git fetch origin; git reset --hard origin/main; git cherry-pick -n <commits>
C=$HOME/.cache/palermo-drive; W=$C/ship-wt; M=$HOME/Desktop/repos/palermo-drive; MSG=$1; shift
export PATH=$HOME/.nvm/versions/node/v22.15.0/bin:$PATH; setopt pipefail
git -C $W diff --name-only --diff-filter=U | grep -q . && { echo "HOLD: unmerged files"; exit 1; }
[ -e "$(git -C $W rev-parse --git-path CHERRY_PICK_HEAD)" ] && { echo "HOLD: a cherry-pick is in progress"; exit 1; }
grep -lE '^(<<<<<<<|>>>>>>>)' $W/src/*.js $W/src/p2p/*.js 2>/dev/null | grep -q . && { echo "HOLD: conflict markers"; exit 1; }
ln -sfn $M/tools/build/node_modules $W/tools/build/node_modules
(cd $W/tools/build && node build.mjs | tail -1) || { echo "HOLD build"; exit 1; }
$W/tools/release/withbrowser.sh node $W/tools/release/smoke.mjs $W/dist; ok=$?
[ $ok = 0 ] || { echo "HOLD: checks failed"; exit 1; }
[ -n "$MSG" ] || { echo "checks passed, no message so no push"; exit 0; }
cd $W; rm -f tools/build/node_modules; rm -rf dist; git add "$@"; git commit -q -F "$MSG" || exit 1; git log -1 --format='%h %s' | cut -c1-70
GH_TOKEN="$(gh auth token --user EBonura)" git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -q origin HEAD:main || { echo "HOLD: push failed"; exit 1; }
git -C $M fetch -q origin; git -C $M merge -q --ff-only origin/main || echo "main checkout not moved: it has local changes"
echo shipped
