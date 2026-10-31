#!/bin/sh
# Rebake palermo-data.js every few minutes while tools/lidar.py is still sampling,
# so a page refresh shows the buildings measured so far. Stops when the sampler exits.
cd "$(dirname "$0")/.."
while pgrep -f "tools/lidar.py" >/dev/null; do
  sleep 240
  # The sampler rewrites lidar.json in place; skip a round if we caught it mid-write.
  python3 -c "import json; json.load(open('data/lidar.json'))" 2>/dev/null || continue
  python3 tools/bake.py data/osm.json palermo-data.tmp.js && mv palermo-data.tmp.js palermo-data.js
done
python3 tools/bake.py data/osm.json palermo-data.tmp.js && mv palermo-data.tmp.js palermo-data.js
echo "final bake done"
