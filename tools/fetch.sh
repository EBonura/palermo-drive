#!/bin/sh
# Download OSM data for the drivable area, then bake it.
# Bounding box is south,west,north,east. Keep it in sync with BBOX in bake.py.
set -e
cd "$(dirname "$0")/.."
BB="38.1060,13.3500,38.1240,13.3730"
mkdir -p data
curl -sf -m 180 -A "palermo-drive-prototype/0.1" -X POST https://overpass-api.de/api/interpreter \
  --data-urlencode "data=[out:json][timeout:120];(
    way[\"building\"]($BB);relation[\"building\"]($BB);way[\"highway\"]($BB);
    way[\"natural\"=\"coastline\"](38.09,13.33,38.14,13.39);
    way[\"leisure\"~\"park|garden\"]($BB);way[\"landuse\"=\"grass\"]($BB);
    way[\"man_made\"~\"pier|breakwater\"]($BB);way[\"natural\"=\"water\"]($BB);
  );out body;>;out skel qt;" -o data/osm.json
python3 -I tools/bake.py data/osm.json palermo-data.js
