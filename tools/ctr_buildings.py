"""Third building-footprint source, for the towns outside the Comune di Palermo's survey: Regione Siciliana, Carta Tecnica Regionale 1:10,000, layer 35 "Edificato" (see docs/sources/ctr-sicilia.md).

    tools/.venv/bin/python -I tools/ctr_buildings.py [--towns monreale,isola,bellolampo,belmonte,capaci] [--refetch]

OpenStreetMap has about 190 buildings in the 700 m round Monreale's Duomo and the CTR has 2000: the old town is solid blocks there. The CTR polygons are the 2003 survey (patched in
2012), whole street blocks in the old towns and single houses in the new ones, with no heights; the game gives them the district's storeys (src/districts.js).

What it does, per town box (lon/lat boxes below, one fetch per box, raw answers cached in data/ctr/<town>.json; only what lies within the town's reach is kept, see CENTRES):
  1. asks the ArcGIS REST service for the object ids in the box, then the polygons 200 at a time (1 s apart), keeping CODICE B001 (civil building), B002 (factory, shed, shop
     building) and B003 (church, bell tower). Huts (B006), roofs (B007), greenhouses, barns and buildings under construction are left out;
  2. projects them to game metres (the projection of tools/bake.py);
  3. drops what an OSM or Comune building already covers (more than 70 % of the polygon inside it grown by 1 m) and cuts the rest of those out of the polygon (grown by 1.5 m, to
     absorb the 1 to 3 m offset between sources), keeps what is left when it is at least 30 m2 and 2.4 m wide;
  4. writes data/footprints_ctr.json for tools/tiles.py (git-ignored), records of the same shape as data/footprints_extra.json but with no height.
"""
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
from bake import KX, KZ, LAT0, LON0  # noqa: E402
from footprints import load_osm  # noqa: E402

import glob  # noqa: E402

import shapely  # noqa: E402
from shapely.geometry import Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
from shapely.strtree import STRtree  # noqa: E402

CITY = os.path.join(ROOT, "data", "city")
CACHE = os.path.join(ROOT, "data", "ctr")
OUT = os.path.join(ROOT, "data", "footprints_ctr.json")
CTC_EXTRA = os.path.join(ROOT, "data", "footprints_extra.json")
URL = "https://map.sitr.regione.sicilia.it/gis/rest/services/ctr_10000/ctr_2013_dbtrs/MapServer/35/query"
UA = "palermo-drive-ctr/0.1 (hobby three.js game, CTR CC BY 4.0; contact via github EBonura)"
# lon0, lat0, lon1, lat1: the towns and a little country round them
TOWNS = {
    "monreale": (13.272, 38.068, 13.310, 38.098),
    "isola": (13.232, 38.184, 13.272, 38.208),
    "bellolampo": (13.255, 38.125, 13.295, 38.152),
    "belmonte": (13.374, 38.044, 13.404, 38.057),
    "capaci": (13.228, 38.160, 13.256, 38.180),
}
# centre (game metres: Via Roma in Monreale, Via Garibaldi in Isola delle Femmine, Via Bellolampo, the OSM place nodes of Belmonte Mezzagno and Capaci) and reach: the rest of the box is not baked (the country keeps its OSM buildings)
CENTRES = {"monreale": (-6250.0, 3750.0, 1500.0), "isola": (-9911.0, -8920.0, 1100.0), "bellolampo": (-7827.0, -2307.0, 1000.0),
           "belmonte": (2610.0, 7428.0, 1100.0), "capaci": (-10693.0, -6079.0, 1000.0)}
KEEP = {"B001": "yes", "B002": "industrial", "B003": "church"}
MIN_AREA, MIN_LEFT, MIN_WIDTH = 20.0, 30.0, 2.4
COVERED, GROW_DROP, GROW_CUT = 0.7, 1.0, 1.5
CHURCH_MAX = 700.0   # a B003 polygon bigger than this is a monastery or an abbey with its church, not a church


def proj_ll(lon, lat):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


def query(box, params):
    p = {"geometry": "%f,%f,%f,%f" % box, "geometryType": "esriGeometryEnvelope", "inSR": 4326, "outSR": 4326, "spatialRel": "esriSpatialRelIntersects", "f": "json", **params}
    req = urllib.request.Request(URL + "?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def fetch(name, box, refetch):
    path = os.path.join(CACHE, name + ".json")
    if os.path.exists(path) and not refetch:
        return json.load(open(path))
    os.makedirs(CACHE, exist_ok=True)
    ids = query(box, {"returnIdsOnly": "true"}).get("objectIds") or []
    print(name, len(ids), "ids", flush=True)
    feats = []
    for i in range(0, len(ids), 200):
        r = query(box, {"objectIds": ",".join(map(str, ids[i:i + 200])), "outFields": "OBJECTID,CODICE,DESCRIZION,ANNORILEV", "returnGeometry": "true"})
        feats += [{"a": f["attributes"], "rings": f["geometry"]["rings"]} for f in r.get("features", []) if f.get("geometry")]
        time.sleep(1)
    json.dump(feats, open(path, "w"))
    return feats


def polygons(f):
    """Shapely polygons in game metres of an Esri polygon: clockwise rings (in lon/lat) are outers, counter-clockwise ones are holes."""
    outers, holes = [], []
    for ring in f["rings"]:
        pts = [proj_ll(lo, la) for lo, la in ring]
        if len(pts) < 4:
            continue
        sa = 0.5 * sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1))
        (outers if sa > 0 else holes).append(pts)   # x east, z south flips the handedness: Esri's clockwise outers have positive area here
    out = []
    for o in outers:
        pg = Polygon(o)
        hs = [h for h in holes if pg.contains(Polygon(h).representative_point())]
        g = Polygon(o, hs)
        if not g.is_valid:
            g = shapely.make_valid(g)
        out += [q for q in getattr(g, "geoms", [g]) if q.geom_type == "Polygon" and q.area > 0]
    return out


def main():
    towns = list(TOWNS)
    if "--towns" in sys.argv:
        towns = sys.argv[sys.argv.index("--towns") + 1].split(",")
    refetch = "--refetch" in sys.argv
    osm = [g for _, g in load_osm(sorted(glob.glob(os.path.join(CITY, "pbf_bld_*.json.gz"))))]
    if os.path.exists(CTC_EXTRA):
        for rec in json.load(open(CTC_EXTRA))["buildings"]:
            osm.append(Polygon(rec["outer"], rec.get("holes", [])).buffer(0))
    tree = STRtree(osm)
    seen, out, stats = set(), [], {}
    for name in towns:
        feats = fetch(name, TOWNS[name], refetch)
        st = stats[name] = {"features": len(feats), "kept_code": 0, "covered": 0, "cut": 0, "added": 0}
        for f in feats:
            code = f["a"]["CODICE"]
            if code not in KEEP or f["a"]["OBJECTID"] in seen:
                continue
            seen.add(f["a"]["OBJECTID"])
            for k, g in enumerate(polygons(f)):
                if g.area < MIN_AREA:
                    continue
                cx, cz, rr = CENTRES[name]
                c = g.centroid
                if math.hypot(c.x - cx, c.y - cz) > rr:
                    continue
                st["kept_code"] += 1
                hit = [osm[i] for i in tree.query(g.buffer(GROW_CUT))]
                if hit:
                    near = unary_union(hit)
                    if g.intersection(near.buffer(GROW_DROP)).area > COVERED * g.area:
                        st["covered"] += 1
                        continue
                    g = g.difference(near.buffer(GROW_CUT))
                    st["cut"] += 1
                for q in (getattr(g, "geoms", [g])):
                    if q.geom_type != "Polygon" or q.area < MIN_LEFT or q.buffer(-MIN_WIDTH / 2).is_empty:
                        continue
                    q = q.simplify(0.3)
                    if q.is_empty or q.geom_type != "Polygon":
                        continue
                    kind = KEEP[code]
                    if code == "B003" and q.area > CHURCH_MAX:
                        kind = "yes"
                    rec = {"id": "c%d.%d" % (f["a"]["OBJECTID"], len(out)), "oid": 900000000 + f["a"]["OBJECTID"], "tags": {"building": kind},
                           "outer": [[round(x, 1), round(z, 1)] for x, z in list(q.exterior.coords)[:-1]]}
                    hs = [[[round(x, 1), round(z, 1)] for x, z in list(r.coords)[:-1]] for r in q.interiors if Polygon(r).area > 6]
                    if hs:
                        rec["holes"] = hs
                    out.append(rec)
                    st["added"] += 1
    json.dump({"source": "Regione Siciliana, Carta Tecnica Regionale 1:10.000 (ed. 2012-13), layer 35 Edificato, CC BY 4.0", "buildings": out}, open(OUT, "w"))
    for n, s in stats.items():
        print(n, s)
    print("wrote", OUT, len(out), "buildings")


if __name__ == "__main__":
    main()
