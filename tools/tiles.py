"""Bake the whole-city world tiles (see docs/TILES.md).

One command regenerates world/manifest.json and world/tiles/*.json:

    tools/.venv/bin/python tools/tiles.py              bake (extracts the PBF on first use)
    tools/.venv/bin/python tools/tiles.py --overpass   use the Overpass API (cached per box in data/city/) instead
    tools/.venv/bin/python tools/tiles.py --fetch-only only extract/download, no bake
    tools/.venv/bin/python tools/tiles.py --offline    Overpass path: bake from the cache, never touch the network
    tools/.venv/bin/python -I tools/tiles.py --publish bake into data/world_stage, then copy only changed tiles + manifest into world/
    tools/.venv/bin/python -I tools/tiles.py --out DIR bake into DIR instead of world/ (then --publish-from DIR to install it)

Default source is data/city/isole-latest.osm.pbf (Geofabrik, ODbL, needs `osmium` in the venv). It is read in
three passes and cached as Overpass-shaped `out geom` files data/city/pbf_<cat>_NNN.json.gz (rebuilt when the
PBF is newer). Delete those files to force a re-extract.
Sources: OpenStreetMap contributors (ODbL), Regione Sicilia lidar via data/lidar.json (CC BY 4.0),
AWS Terrarium tiles for the far terrain, INGV TINITALY 10 m DEM for the hills (tools/dem.py, CC BY 4.0) pinned to the lidar
above its 204 m raster saturation (tools/lidar_hills.py).
"""
import glob
import gzip
import json
import math
import multiprocessing as mp
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
from bake import (KX, KZ, LAT0, LON0, area, building_height, flat, hash01, lidar_shape,  # noqa: E402
                  load_terrarium, stitch, unproj)
from despike import despike_grid  # noqa: E402

CITY = os.path.join(ROOT, "data", "city")
WORLD = os.path.join(ROOT, "world")
T = 500
BBOX_LL = (38.045, 13.235, 38.230, 13.455)  # s, w, n, e (docs/TILES.md); Palermo's municipal boundary (OSM relation 39513) spans 38.0499..38.2246, 13.2422..13.4521
UA = "palermo-drive-tiles/0.1 (hobby three.js game, OSM ODbL data; contact via github EBonura)"
ENDPOINTS = ["https://z.overpass-api.de/api/interpreter", "https://overpass-api.de/api/interpreter"]

# Sub-boxes for fetching: 4 x 3 boxes, split further automatically when Overpass gives up.
ROWS, COLS = 4, 3


def proj(lat, lon):
    return round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1)


# ----------------------------------------------------------------------------------------------
# Fetching
# ----------------------------------------------------------------------------------------------
HIGHWAYS = ("motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
            "tertiary|tertiary_link|unclassified|residential|living_street|service|pedestrian|footway|path|cycleway|track|bridleway")


def query_for(cat, b):
    bb = f"{b[0]:.5f},{b[1]:.5f},{b[2]:.5f},{b[3]:.5f}"
    head = "[out:json][timeout:300][maxsize:1073741824];\n"
    if cat == "bld":
        body = f'(way["building"]({bb});relation["building"]({bb}););'
    elif cat == "hwy":
        body = f'way["highway"~"^({HIGHWAYS})$"]({bb});'
    elif cat == "misc":
        body = (f'way["natural"="coastline"]({bb});'
                f'way["leisure"~"^(park|garden|golf_course|pitch|track|beach_resort)$"]({bb});relation["leisure"~"^(park|garden|golf_course|pitch|track|beach_resort)$"]({bb});'
                f'way["landuse"~"^(grass|forest|village_green|meadow|recreation_ground|flowerbed|farmland|farmyard|allotments|orchard|vineyard|plant_nursery|cemetery|railway|brownfield|construction|quarry|landfill|greenfield)$"]({bb});'
                f'relation["landuse"~"^(grass|forest|village_green|meadow|recreation_ground|flowerbed|farmland|farmyard|allotments|orchard|vineyard|plant_nursery|cemetery|railway|brownfield|construction|quarry|landfill|greenfield)$"]({bb});'
                f'way["natural"~"^(wood|beach|sand|water|scrub|heath|grassland|fell|bare_rock|scree|rock|shingle|cliff)$"]({bb});relation["natural"~"^(wood|beach|sand|water|scrub|heath|grassland|fell|bare_rock|scree|rock|shingle|cliff)$"]({bb});'
                f'way["man_made"~"^(pier|breakwater)$"]({bb});')
    elif cat == "props":
        body = (f'node["natural"="tree"]({bb});way["natural"="tree_row"]({bb});'
                f'node["highway"="street_lamp"]({bb});'
                f'node["amenity"~"^(waste_disposal|waste_basket|recycling|bench|fountain|drinking_water|bicycle_parking|'
                f'motorcycle_parking|post_box|telephone|fuel|cafe|bar|restaurant|ice_cream|pub|fast_food)$"]({bb});'
                f'way["amenity"~"^(parking|fountain|marketplace|bicycle_parking|motorcycle_parking)$"]({bb});'
                f'node["barrier"~"^(bollard|cycle_barrier|lift_gate|block)$"]({bb});'
                f'node["highway"~"^(crossing|bus_stop|traffic_signals)$"]({bb});'
                f'node["public_transport"="platform"]({bb});'
                f'node["shop"]({bb});'
                f'node["tourism"~"^(artwork|attraction|viewpoint)$"]({bb});node["memorial"]({bb});'
                f'node["historic"~"^(memorial|monument|wayside_cross|wayside_shrine)$"]({bb});'
                f'node["emergency"="fire_hydrant"]({bb});'
                f'node["man_made"~"^(flagpole|street_cabinet|surveillance|utility_pole|pole)$"]({bb});')
    else:
        raise ValueError(cat)
    return head + body + "\nout geom;"


ONLY = None       # --tiles i_j,i_j: debugging, bake just these tiles (use with --out; the manifest then lists only them)
PARTIAL = False   # --partial: bake from whatever is cached (plus data/context_tiles seeds) when Overpass is down
MISSING = []


class Split(Exception):
    pass


def overpass(q, tries=30):
    """POST a query. Busy servers (429/5xx) get exponential backoff and the mirrors in turn;
    only a query-level timeout or out-of-memory answer raises Split (use smaller boxes)."""
    data = urllib.parse.urlencode({"data": q}).encode()
    wait = 20
    for attempt in range(tries):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        req = urllib.request.Request(url, data=data, headers={
            "User-Agent": UA, "Accept-Encoding": "gzip", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=420) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            js = json.loads(raw)
            remark = js.get("remark", "")
            if "runtime error" in remark:
                if "timed out" in remark or "out of memory" in remark:
                    raise Split(remark)
                raise urllib.error.URLError(remark)
            return raw
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code} from {url}, waiting {wait}s", flush=True)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError) as e:
            print(f"  fetch error {e!r}, waiting {wait}s", flush=True)
        time.sleep(wait)
        wait = min(wait * 1.5, 120)
    raise SystemExit("Overpass keeps failing, rerun later (cached boxes are kept)")


def box_key(b):
    return f"{b[0]:.4f}_{b[1]:.4f}_{b[2]:.4f}_{b[3]:.4f}"


def quarters(b):
    s, w, n, e = b
    ms, mw = (s + n) / 2, (w + e) / 2
    return [(s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)]


def top_boxes():
    s, w, n, e = BBOX_LL
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            out.append((s + (n - s) * r / ROWS, w + (e - w) * c / COLS,
                        s + (n - s) * (r + 1) / ROWS, w + (e - w) * (c + 1) / COLS))
    return out


def cache_paths(cat, b):
    base = os.path.join(CITY, f"{cat}_{box_key(b)}")
    return base + ".json.gz", base + ".split"


def ensure(cat, b, offline=False, depth=0):
    """Make sure box b is cached (splitting it if Overpass can't do it in one go). Yields cache files."""
    path, marker = cache_paths(cat, b)
    if os.path.exists(path):
        return [path]
    if not os.path.exists(marker):
        if offline:
            if PARTIAL:
                MISSING.append((cat, box_key(b)))
                return []
            raise SystemExit(f"missing cache {path} (run without --offline)")
        print(f"fetch {cat} {box_key(b)}", flush=True)
        try:
            raw = overpass(query_for(cat, b))
        except Split as e:
            print(f"  too big ({e}), splitting", flush=True)
            open(marker, "w").write("split\n")
        else:
            with gzip.open(path, "wb") as f:
                f.write(raw)
            print(f"  {len(raw) / 1e6:.1f} MB", flush=True)
            time.sleep(4)
            return [path]
    out = []
    for q in quarters(b):
        out += ensure(cat, q, offline, depth + 1)
    return out


def cache_files(cat, offline=False):
    out = []
    for b in top_boxes():
        out += ensure(cat, b, offline)
    return out


def iter_elements(files):
    """Stream elements from cache files, each (type, id) only once."""
    seen = set()
    for f in files:
        opener = gzip.open if f.endswith(".gz") else open
        with opener(f, "rb") as fh:
            els = json.load(fh)
        if isinstance(els, dict):
            els = els["elements"]
        for e in els:
            k = (e["type"], e["id"])
            if k in seen:
                continue
            seen.add(k)
            yield e
        del els


# ----------------------------------------------------------------------------------------------
# Geofabrik extract (default source when data/city/isole-latest.osm.pbf exists)
# ----------------------------------------------------------------------------------------------
PBF = os.path.join(CITY, "isole-latest.osm.pbf")
PBF_MARGIN = 0.03            # degrees around the bbox that are kept (ways crossing it stay whole)
USE_PBF = True               # --overpass switches to the Overpass path
PBF_PART = 30000             # elements per cache file

_AMENITY_PROPS = {"waste_disposal", "waste_basket", "recycling", "bench", "fountain", "drinking_water",
                  "bicycle_parking", "motorcycle_parking", "post_box", "telephone", "fuel", "cafe", "bar",
                  "restaurant", "ice_cream", "pub", "fast_food"}
_HW_SET = set(HIGHWAYS.split("|"))

# Land cover that tints the terrain (src/world.js reads areas[].k). Only sand/green/water also become street layers.
NATURAL_COVER = {"wood": "forest", "beach": "sand", "sand": "sand", "water": "water", "scrub": "scrub", "heath": "scrub",
                 "grassland": "grass", "fell": "grass", "bare_rock": "rock", "scree": "rock", "rock": "rock",
                 "shingle": "rock", "cliff": "rock"}
LANDUSE_COVER = {"forest": "forest", "grass": "green", "village_green": "green", "recreation_ground": "green", "flowerbed": "green",
                 "meadow": "grass", "farmland": "farm", "farmyard": "farm", "allotments": "farm", "orchard": "orchard",
                 "vineyard": "orchard", "plant_nursery": "farm", "cemetery": "cemetery", "railway": "rail",
                 "brownfield": "dirt", "construction": "dirt", "quarry": "dirt", "landfill": "dirt", "greenfield": "dirt"}
LEISURE_COVER = {"park": "green", "garden": "green", "golf_course": "green", "pitch": "pitch", "track": "dirt",
                 "beach_resort": "sand"}


def cover_kind(t):
    """Area kind of a closed way / multipolygon from its tags, or None."""
    return (NATURAL_COVER.get(t.get("natural")) or LANDUSE_COVER.get(t.get("landuse")) or LEISURE_COVER.get(t.get("leisure")))


def _is_place(t):
    """Named things worth a landmark entry that are not buildings or parks (stadiums, harbours, capes ...)."""
    if not t.get("name"):
        return False
    return bool(t.get("place") or t.get("leisure") in ("stadium", "sports_centre", "marina")
                or t.get("harbour") or t.get("landuse") in ("harbour", "port", "military")
                or t.get("waterway") in ("dock", "boatyard") or t.get("natural") in ("bay", "peninsula", "cape", "peak", "beach")
                or t.get("man_made") in ("lighthouse", "pier", "breakwater", "works")
                or t.get("tourism") in ("attraction", "viewpoint", "theme_park", "museum")
                or t.get("amenity") in ("theatre", "ferry_terminal", "restaurant", "bar", "nightclub", "university", "hospital")
                or t.get("historic") in ("castle", "monument", "fort", "ruins", "archaeological_site"))


WATERWAYS = {"river", "stream", "canal", "drain", "ditch", "brook"}   # lines under bridges (Oreto, Papireto, culverts); cat "wtr"
BARRIERS = {"wall", "fence", "retaining_wall", "city_wall", "hedge", "guard_rail", "gate", "handrail", "chain", "jersey_barrier", "cable_barrier"}   # cat "bar"


def _way_cats(t):
    """Overpass-equivalent category membership of a way's tags."""
    cats = []
    if _is_place(t):
        cats.append("places")
    if "building" in t:
        cats.append("bld")
    if t.get("highway") in _HW_SET:
        cats.append("hwy")
    if (t.get("natural") == "coastline" or cover_kind(t)
            or t.get("man_made") in ("pier", "breakwater")):
        cats.append("misc")
    if t.get("waterway") in WATERWAYS:
        cats.append("wtr")
    if t.get("barrier") in BARRIERS or t.get("historic") == "citywalls":
        cats.append("bar")
    a = t.get("amenity")
    if (t.get("natural") == "tree_row" or a in ("parking", "fountain", "marketplace", "bicycle_parking",
                                                   "motorcycle_parking")):
        cats.append("props")
    return cats


def _rel_cats(t):
    cats = []
    if _is_place(t):
        cats.append("places")
    if "building" in t:
        cats.append("bld")
    if cover_kind(t):
        cats.append("misc")
    return cats


def _node_is_prop(t):
    return bool(t.get("natural") == "tree" or t.get("highway") in ("street_lamp", "crossing", "bus_stop", "traffic_signals")
                or t.get("amenity") in _AMENITY_PROPS or t.get("barrier") in ("bollard", "cycle_barrier", "lift_gate", "block")
                or t.get("public_transport") == "platform" or t.get("shop")
                or t.get("tourism") in ("artwork", "attraction", "viewpoint") or t.get("memorial")
                or t.get("historic") in ("memorial", "monument", "wayside_cross", "wayside_shrine")
                or t.get("emergency") == "fire_hydrant"
                or t.get("man_made") in ("flagpole", "street_cabinet", "surveillance", "utility_pole", "pole"))


def pbf_cache_files(cat):
    return sorted(glob.glob(os.path.join(CITY, f"pbf_{cat}_*.json.gz")))


def pbf_extract():
    """Read the Geofabrik PBF in three passes (relations, nodes, ways) and write Overpass-shaped
    `out geom` elements per category to data/city/pbf_<cat>_<n>.json.gz."""
    import osmium
    from array import array
    s, w, n, e = BBOX_LL
    s, w, n, e = s - PBF_MARGIN, w - PBF_MARGIN, n + PBF_MARGIN, e + PBF_MARGIN
    t0 = time.time()
    log = lambda m: print(f"[pbf {time.time() - t0:.0f}s] {m}", flush=True)
    tags_of = lambda o: {t.k: t.v for t in o.tags}

    # pass 1: relations worth keeping (multipolygons of buildings, parks, water ...)
    rels, member_ids = {}, set()
    for r in osmium.FileProcessor(PBF, osmium.osm.RELATION):
        t = r.tags
        if not (t.get("building") or t.get("natural") or t.get("leisure") or t.get("landuse") or t.get("name")):
            continue
        tg = tags_of(r)
        if not _rel_cats(tg):
            continue
        mem = [(m.role, m.ref) for m in r.members if m.type == "w" and m.role in ("outer", "inner")]
        if mem:
            rels[r.id] = (tg, mem)
            member_ids.update(ref for _, ref in mem)
    log(f"{len(rels)} candidate relations, {len(member_ids)} member ways")

    # pass 2: node locations inside the margin box, plus the street-furniture nodes
    loc = {}
    props, places = [], []
    for o in osmium.FileProcessor(PBF, osmium.osm.NODE):
        if not o.location.valid():
            continue
        lat, lon = o.location.lat, o.location.lon
        if s <= lat <= n and w <= lon <= e:
            loc[o.id] = (lat, lon)
            if len(o.tags):
                tg = tags_of(o)
                if _node_is_prop(tg):
                    props.append({"type": "node", "id": o.id, "lat": lat, "lon": lon, "tags": tg})
                if _is_place(tg):
                    places.append({"type": "node", "id": o.id, "lat": lat, "lon": lon, "tags": tg})
    log(f"{len(loc)} nodes in the box, {len(props)} furniture nodes")

    # pass 3: ways
    out = {"bld": [], "hwy": [], "misc": [], "props": props, "places": places, "wtr": [], "bar": []}
    member_geom = {}

    def geometry(refs):
        pts = [{"lat": loc[r][0], "lon": loc[r][1]} for r in refs if r in loc]
        if len(pts) > 1 and refs[0] == refs[-1] and pts[0] != pts[-1]:
            pts.append(pts[0])
        return pts

    for o in osmium.FileProcessor(PBF, osmium.osm.WAY):
        t = o.tags
        cats = _way_cats(t) if len(t) else []
        is_member = o.id in member_ids
        if not cats and not is_member:
            continue
        refs = [nd.ref for nd in o.nodes]
        if not any(r in loc for r in refs):
            continue
        g = geometry(refs)
        if len(g) < 2:
            continue
        if is_member:
            member_geom[o.id] = g
        if cats:
            el = {"type": "way", "id": o.id, "tags": tags_of(o), "geometry": g}
            for c in cats:
                out[c].append(el)
    log(f"ways: " + ", ".join(f"{k} {len(v)}" for k, v in out.items()))

    for rid, (tg, mem) in rels.items():
        members = [{"type": "way", "ref": ref, "role": role, "geometry": member_geom[ref]}
                   for role, ref in mem if ref in member_geom]
        if not members:
            continue
        el = {"type": "relation", "id": rid, "tags": tg, "members": members}
        for c in _rel_cats(tg):
            out[c].append(el)
    log("relations added: " + ", ".join(f"{k} {len(v)}" for k, v in out.items()))

    for f in glob.glob(os.path.join(CITY, "pbf_*_*.json.gz")):
        os.remove(f)
    for cat, els in out.items():
        for i in range(0, max(len(els), 1), PBF_PART):
            with gzip.open(os.path.join(CITY, f"pbf_{cat}_{i // PBF_PART:03d}.json.gz"), "wt", encoding="utf-8") as f:
                json.dump({"elements": els[i:i + PBF_PART]}, f, separators=(",", ":"), ensure_ascii=False)
    log("cache written")


def pbf_files():
    cats = ("misc", "hwy", "bld", "props", "places", "wtr", "bar")
    fresh = all(pbf_cache_files(c) for c in cats) and all(
        os.path.getmtime(f) > os.path.getmtime(PBF) for c in cats for f in pbf_cache_files(c))
    if not fresh:
        pbf_extract()
    return {c: pbf_cache_files(c) for c in cats}


def fetch_all(offline=False):
    os.makedirs(CITY, exist_ok=True)
    if USE_PBF and os.path.exists(PBF):
        return pbf_files()
    files = {cat: cache_files(cat, offline) for cat in ("misc", "hwy", "bld", "props")}
    if PARTIAL:
        seeds = sorted(glob.glob(os.path.join(ROOT, "data", "context_tiles", "*.json")))
        files["bld"] += seeds   # `out tags geom` dumps of buildings + major roads (another tool's cache)
        files["hwy"] += seeds
        print(f"PARTIAL: {len(MISSING)} boxes missing {sorted(set(m[0] for m in MISSING))}, +{len(seeds)} seed files")
    return files


def ensure_terrarium(z=12, margin_m=None):
    """Download the Terrarium z12 tiles the (widened) far grid needs. Returns the folder."""
    folder = os.path.join(ROOT, "data", "terrarium")
    os.makedirs(folder, exist_ok=True)
    x0, z0, x1, z1 = world_rect(FAR_MARGIN if margin_m is None else margin_m)
    pts = [unproj(x0, z0), unproj(x1, z1)]
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    for X in range(tx(pts[0][1]), tx(pts[1][1]) + 1):
        for Y in range(ty(pts[0][0]), ty(pts[1][0]) + 1):
            p = os.path.join(folder, f"{z}_{X}_{Y}.png")
            if os.path.exists(p):
                continue
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{X}/{Y}.png"
            print("terrarium", url, flush=True)
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            open(p, "wb").write(urllib.request.urlopen(req, timeout=60).read())
    return folder


def world_rect(margin=0.0):
    s, w, n, e = BBOX_LL
    x0, z1 = proj(s, w)
    x1, z0 = proj(n, e)
    return x0 - margin, z0 - margin, x1 + margin, z1 + margin


# ----------------------------------------------------------------------------------------------
# Parsing OSM into projected geometry
# ----------------------------------------------------------------------------------------------
ROAD_WIDTH = {  # roads[] widths (as in bake.py, plus the big roads the whole city has)
    "motorway": 14, "motorway_link": 6, "trunk": 12, "trunk_link": 6, "primary": 11, "primary_link": 6,
    "secondary": 10, "secondary_link": 6, "tertiary": 8, "tertiary_link": 6, "unclassified": 6,
    "residential": 6, "living_street": 5, "pedestrian": 6, "service": 4, "footway": 2.2, "path": 2,
    "cycleway": 2, "track": 3.5, "bridleway": 2.5,
}
# Dirt tracks stay centreline-only (no asphalt). src/world.js draws every roads[] entry with k == "track" as a dirt strip, so
# bridleways (same surface, narrower) are baked as k "track" too; the width tells them apart.
ROAD_KIND = {"bridleway": "track"}
CARRIAGEWAY = {  # drivable asphalt widths when OSM has no width/lanes (streets.py values plus big roads)
    "motorway": 8, "motorway_link": 4.5, "trunk": 9, "trunk_link": 4.5, "primary": 10, "primary_link": 4.5,
    "secondary": 9, "secondary_link": 4.5, "tertiary": 8, "tertiary_link": 4.5, "unclassified": 6,
    "residential": 5.5, "living_street": 4.5, "service": 3.5,
}
COVERED_OPEN = ("motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link")   # classes where covered=yes is a cutting, not a passage
PEDESTRIAN = {"pedestrian": 7, "footway": 2.5}   # cycleway/path stay centreline-only, as before
URBAN_REACH = 24.0   # (only without data/road_surfaces.json) ground within this distance of a building and not road/green/... is raised pavement
MARGIN = 30.0        # metres computed beyond each tile so street polygons line up across borders
CHUNK = T / 8        # street polygons are cut into 62.5 m cells (drape over terrain, cull well)
DENSIFY = 8
FAR_STEP = 100
FAR_MARGIN = 3000
CTR_WALLS = os.path.join(ROOT, "data", "walls.json")   # Regione Siciliana CTR walls and fences, tools/fences.py
CTR_CREDIT = "Walls, fences and trees: Regione Siciliana, Carta Tecnica Regionale 1:10.000 (ed. 2012-13), CC BY 4.0"
UA_CREDIT = "Contains modified Copernicus Land Monitoring Service information: Urban Atlas Street Tree Layer 2018, European Environment Agency (EEA)"
COLOUR_CREDIT = "Roof and ground colours derived from the Regione Siciliana SITR Ortofoto ATA 2012-2013 (Regione Siciliana, Assessorato Regionale del Territorio e dell'Ambiente, Dipartimento Urbanistica), CC BY 4.0. Colours were extracted and rebalanced; no imagery is included"
TRANSIT_CREDIT = "Bus and tram routes, stops and timetables: AMAT Palermo S.p.A. open data (GTFS, Comune di Palermo), CC BY 4.0; tram geometry follows OpenStreetMap (ODbL). Drinking fountains: Comune di Palermo / AMAP S.p.A. open data, CC BY 4.0"
VERDE_CREDIT = "Green areas: Comune di Palermo, Perimetrazione aree verdi (open data), CC BY 4.0"
RS_PATH = os.path.join(ROOT, "data", "road_surfaces.json")   # tools/road_surfaces.py, see docs/sources/comune-road-surfaces.md
RS_ON = os.path.exists(RS_PATH)   # without it the old model stays: every bit of ground within URBAN_REACH of a building is raised pavement
PED_STONE = ("paving_stones", "sett", "stone", "cobblestone", "unhewn_cobblestone", "granite", "cobblestone:flattened")
RS_PED_ASPHALT = ()   # street names that stay asphalt although OSM says highway=pedestrian (Mapillary and OSM surface=asphalt say Via Maqueda is one: see docs/TILES.md)
RS_PED_REACH = 8.0   # metres each side of an OSM pedestrian street line that count as the street (the Comune platform inside that is the whole street, wall to wall)
NOKERB_R = 2500.0   # board item n6: beyond this distance from Quattro Canti a local road with no Comune pavement polygon has no kerb
NOKERB_CLASSES = {"residential", "service", "track", "unclassified", "living_street", "tertiary", "secondary", "primary"}
FRONTAGE = 0.25      # share of the 16 m strip along the road that is building: above it the street has a built frontage and keeps its pavement
FRONTAGE_R = 16.0
NOKERB_CHUNK = 60.0
NOKERB_LOCAL = {"residential", "service", "track", "unclassified", "living_street"}
RS_SLACK = 2.5       # metres of carriageway kept beyond half the OSM road width on each side (OSM lines sit 1 to 2 m off the survey)
RS_SIMPLIFY = 0.2   # metres: street polygon outlines are thinned this much (the Comune survey is 1:2000)
RS_CREDIT = "Street surfaces: Comune di Palermo, Perimetrazione area stradale and Aree pedonali, CC BY 4.0"
CTC_CREDIT = "Building volumes and heights: Comune di Palermo, Carta Tecnica Comunale, Unita' Volumetriche (2013), CC BY 4.0 IT"
TIN_CREDIT = "TINITALY 1.1 DEM, INGV (Tarquini et al.), CC BY 4.0, doi:10.13127/tinitaly/1.1"
LIDAR_CREDIT = ("Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale, "
                "PST-A lidar Regione Sicilia, CC BY 4.0")


def way_pts(e):
    return [proj(g["lat"], g["lon"]) for g in e["geometry"]]


def is_closed(e):
    g = e.get("geometry") or []
    return len(g) > 3 and g[0] == g[-1]


def ring_of(e):
    pts = way_pts(e)
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def member_rings(e, role):
    segs = [[(g["lat"], g["lon"]) for g in m["geometry"]] for m in e.get("members", [])
            if m["type"] == "way" and m.get("role") == role and m.get("geometry")]
    rings = []
    for r in stitch(segs):
        pts = [proj(*c) for c in r]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) >= 3:
            rings.append(pts)
    return rings


def assign_inners(outers, inners):
    """Which inner rings belong to which outer ring."""
    if len(outers) == 1:
        return [inners]
    from shapely.geometry import Point, Polygon
    polys = [Polygon(o).buffer(0) for o in outers]
    res = [[] for _ in outers]
    for ring in inners:
        pt = Point(ring[0])
        for k, pg in enumerate(polys):
            if pg.contains(pt):
                res[k].append(ring)
                break
    return res


TAG_FIELDS = (("name", "n"), ("building", "t"), ("building:levels", "lv"), ("historic", "hi"),
              ("amenity", "am"), ("building:colour", "col"), ("roof:shape", "rs"))


def cx_cz(outer):
    return sum(p[0] for p in outer) / len(outer), sum(p[1] for p in outer) / len(outer)


# ----------------------------------------------------------------------------------------------
# Building heights from the dense lidar rasters (tools/lidar_raster.py)
# ----------------------------------------------------------------------------------------------
try:
    import lidar_raster as lr
    RASTER_BLOCKS = {tuple(int(v) for v in f[:-4].split("_"))
                     for f in os.listdir(os.path.join(lr.ROOT, "dsm")) if f.endswith(".npz")}
except Exception as _e:  # noqa: BLE001
    lr, RASTER_BLOCKS = None, set()
    print("lidar_raster unavailable:", _e)

try:
    import dem          # TINITALY 10 m DEM (tools/dem.py): the hills, where the lidar rasters saturate or do not reach
    import lidar_hills  # lidar elevations above the 204 m raster saturation, from GetFeatureInfo (tools/lidar_hills.py)
    if not os.path.exists(dem.RAW):
        raise FileNotFoundError(dem.RAW)
except Exception as _e:  # noqa: BLE001
    dem = lidar_hills = None
    print("hill DEM unavailable (terrain falls back to the far grid):", _e)

WALL_CLEAR = 2.0     # sample points stay this far inside the walls (pixels are 2 m)
MAX_SAMPLES = 300
SPLIT_SPREAD = 5.0   # p90 - p10 of the roof samples above which a building gets height sections


def in_raster(outer):
    if not RASTER_BLOCKS:
        return False
    xs, zs = [p[0] for p in outer], [p[1] for p in outer]
    for x in (min(xs), max(xs)):
        for z in (min(zs), max(zs)):
            if (math.floor(x / lr.BLOCK), math.floor(z / lr.BLOCK)) in RASTER_BLOCKS:
                return True
    return False


def gap_clusters(vals, gap=2.0):
    """1D clustering: sorted values split where consecutive values are more than `gap` apart. Returns labels."""
    order = sorted(range(len(vals)), key=lambda i: vals[i])
    lab = [0] * len(vals)
    c = 0
    for a, b in zip(order, order[1:]):
        if vals[b] - vals[a] > gap:
            c += 1
        lab[b] = c
    return lab


def raster_shape(outer, holes):
    """Roof shape from the DSM (median over a grid of interior samples) minus the DTM under the building.

    Same return as bake.lidar_shape: (roof, parts, split, ground), absolute elevations, or None when the
    raster has too little data (then lidar.json / OSM estimates take over)."""
    import numpy as np
    import shapely
    from shapely.geometry import Polygon
    if lr is None or not in_raster(outer):
        return None
    pg = Polygon(outer, [h for h in holes if len(h) >= 3])
    if not pg.is_valid:
        pg = shapely.make_valid(pg)
        pgs = polys_of(pg)
        if not pgs:
            return None
        pg = max(pgs, key=lambda q: q.area)
    inner = pg.buffer(-WALL_CLEAR)
    if inner.is_empty:
        inner = pg.buffer(-0.8)
    minx, minz, maxx, maxz = (inner if not inner.is_empty else pg).bounds
    A = (inner if not inner.is_empty else pg).area
    step = max(2.0, math.sqrt(A / MAX_SAMPLES))
    xs, zs = np.meshgrid(np.arange(minx + step / 2, maxx, step), np.arange(minz + step / 2, maxz, step))
    xs, zs = xs.ravel(), zs.ravel()
    if len(xs):
        m = shapely.contains_xy(inner if not inner.is_empty else pg, xs, zs)
        xs, zs = xs[m], zs[m]
    if len(xs) == 0:
        rp = pg.representative_point()
        xs, zs = np.array([rp.x]), np.array([rp.y])
    dsm = lr.sample_dsm(xs, zs)
    dtm = lr.sample_dtm(xs, zs, "bilinear")
    ok = ~np.isnan(dsm) & ~np.isnan(dtm)
    n = len(xs)
    if ok.sum() < max(1, 0.5 * n):
        return None
    xs, zs, dsm, dtm = xs[ok], zs[ok], dsm[ok].astype(float), dtm[ok].astype(float)
    ground = float(np.median(dtm))
    roofs = np.maximum(dsm, dtm + 2.5)
    main = float(np.median(roofs))
    nv = len(roofs)
    spread = float(np.percentile(roofs, 90) - np.percentile(roofs, 10))
    if nv < 3 or spread <= SPLIT_SPREAD:
        return main, None, False, ground
    # Height levels, each sample belongs to one; stray levels with very few samples are merged into the
    # nearest bigger one, levels within 1.5 m of the main roof snap to it.
    lab = np.array(gap_clusters(list(roofs), 2.5))
    for _ in range(4):
        counts = np.bincount(lab)
        small = [c for c in range(len(counts)) if 0 < counts[c] < max(2, 0.08 * nv)]
        if not small or len(small) == len(np.nonzero(counts)[0]):
            break
        med = {c: float(np.median(roofs[lab == c])) for c in range(len(counts)) if counts[c]}
        big = [c for c in med if c not in small]
        for c in small:
            tgt = min(big, key=lambda b: abs(med[b] - med[c]))
            lab[lab == c] = tgt
    level = {}
    for c in np.unique(lab):
        r = float(np.median(roofs[lab == c]))
        level[int(c)] = main if abs(r - main) < 1.5 else r
    snapped = np.array([level[int(c)] for c in lab])
    if len(set(round(v, 1) for v in snapped)) < 2:
        return main, None, False, ground
    # Cells: every location of the footprint takes the level of its nearest sample (Voronoi on a grid).
    cell = 1.0 if pg.area <= 3000 else 2.0
    bx0, bz0, bx1, bz1 = pg.bounds
    cx, cz = np.meshgrid(np.arange(bx0 + cell / 2, bx1, cell), np.arange(bz0 + cell / 2, bz1, cell))
    cx, cz = cx.ravel(), cz.ravel()
    mm = shapely.contains_xy(pg, cx, cz)
    cx, cz = cx[mm], cz[mm]
    if len(cx) == 0:
        return main, None, False, ground
    nearest = np.empty(len(cx), np.int64)
    for a in range(0, len(cx), 4000):
        d = (cx[a:a + 4000, None] - xs[None, :]) ** 2 + (cz[a:a + 4000, None] - zs[None, :]) ** 2
        nearest[a:a + 4000] = d.argmin(axis=1)
    cell_level = snapped[nearest]
    parts = []
    split = not holes
    for v in sorted(set(round(float(x), 1) for x in cell_level)):
        if not split and v - main <= 3.5:
            continue
        sel = np.abs(cell_level - v) < 0.06
        sq = shapely.box(cx[sel] - cell / 2, cz[sel] - cell / 2, cx[sel] + cell / 2, cz[sel] + cell / 2)
        u = I(poly_only(shapely.unary_union(sq).simplify(0.6)), pg)
        for q in polys_of(u):
            if q.area > 2:
                parts.append([flat([(round(a, 1), round(b, 1)) for a, b in q.exterior.coords[:-1]]), round(v, 1)])
    if not parts:
        return main, None, False, ground
    return main, parts, split, ground


CTC_HEIGHTS = os.path.join(ROOT, "data", "footprints_osm_heights.json")   # tools/footprints.py, see docs/sources/comune-ctc-buildings.md
CTC_EXTRA = os.path.join(ROOT, "data", "footprints_extra.json")
CTC_ON = os.path.exists(CTC_HEIGHTS)


ROOF_RC = {}   # building id -> roof colour of the orthophoto (tools/colours.py), filled in build()


def ctc_shape(rec):
    """(roof, parts, split, ground) from a Carta Tecnica Comunale record, in the same form as raster_shape: absolute elevations.
    The record's `parts` hold heights relative to the foot. The roof is the eave (a pitched roof gets its rise on top at runtime, flag `e`)."""
    g = rec["g"]
    roof = rec["r"] if "r" in rec else g + rec["h"]
    parts = [[p, round(g + h, 1)] for p, h in rec["parts"]] if rec.get("parts") else None
    return roof, parts, bool(parts and rec.get("split")), g


def parse_buildings(files, lidar):
    """Same records as bake.py. Returns (buildings, labels) where each is a list of dicts with
    the tile-independent payload plus '_c' (centroid) and '_geom' (outer, holes) for streets."""
    from shapely.geometry import Polygon  # noqa: F401
    out, labels = [], []
    stats = {"raster": 0, "lidar_json": 0, "ctc": 0, "ctc_extra": 0, "estimate": 0, "split": 0, "towers": 0}
    ctc = json.load(open(CTC_HEIGHTS)) if os.path.exists(CTC_HEIGHTS) else {}

    def add(key, oid, tags, outer, holes, ctc_rec=None):
        if len(outer) < 3:
            return
        fp = abs(area(outer))
        if fp < 4:
            return
        h = building_height(oid, tags, fp)
        kind = tags.get("building", "yes")
        b = {"id": key, "h": round(h, 1), "c": int(hash01(oid + 7) * 1000), "p": flat(outer)}
        if key in ROOF_RC:
            b["rc"] = ROOF_RC[key]
        for tag, field in TAG_FIELDS:
            if tags.get(tag) and not (tag == "building" and tags[tag] == "yes"):
                b[field] = tags[tag]
        if holes:
            b["holes"] = [flat(hh) for hh in holes if len(hh) >= 3]
        shape = raster_shape(outer, holes)
        src = "raster"
        if not shape and lidar:
            rec = lidar["b"].get(key)
            if rec:  # a server change made some samples report surface == ground exactly: not measurements
                rec = [None if isinstance(r, list) and r[1] == r[0] else r for r in rec]
            shape = lidar_shape(rec, outer, holes)
            src = "lidar_json"
        ctc_rec = ctc_rec or ctc.get(key)
        if not shape and ctc_rec:   # measured eave heights where there is no lidar roof (the survey is from 2013)
            shape = ctc_shape(ctc_rec)
            src = "ctc_extra" if key[0] == "x" else "ctc"
            b["e"] = 1
        if shape:
            roof, parts, split, ground = shape
            b["r"] = round(roof, 1)
            b["g"] = round(ground, 1)
            b["h"] = round(max(roof - ground, 2.5), 1)  # measured height replaces the estimate
            stats[src] += 1
            if parts:
                b["parts"] = parts
                stats["split" if split else "towers"] += 1
                if split:
                    b["split"] = 1
        if not shape:
            stats["estimate"] += 1
        if kind in ("church", "cathedral", "basilica", "chapel"):
            b["k"] = "church"
        cx, cz = cx_cz(outer)
        b["_c"] = (cx, cz)
        b["_g"] = (outer, [hh for hh in holes if len(hh) >= 3])
        out.append(b)
        if tags.get("name") and fp > 300:
            labels.append({"n": tags["name"], "x": round(cx, 1), "z": round(cz, 1), "h": round(h, 1),
                           "r": round(40 + math.sqrt(fp) * 0.7), "_c": (cx, cz)})

    for e in iter_elements(files):
        tags = e.get("tags") or {}
        if "building" not in tags:
            continue
        if e["type"] == "way":
            if is_closed(e) and e.get("geometry"):
                add(f"w{e['id']}", e["id"], tags, ring_of(e), [])
        elif e["type"] == "relation":
            outers = member_rings(e, "outer")
            inners = member_rings(e, "inner")
            for k, (o, ins) in enumerate(zip(outers, assign_inners(outers, inners) if outers else [])):
                add(f"r{e['id']}.{k}", e["id"], tags, o, ins)
    if os.path.exists(CTC_EXTRA):   # buildings the Comune's survey has and OSM lacks (already cut against the OSM footprints)
        for rec in json.load(open(CTC_EXTRA))["buildings"]:
            add(rec["id"], rec["oid"], rec["tags"], rec["outer"], rec.get("holes", []), rec)
    return out, labels, stats


def parse_misc(files):
    """Coastline segments, area polygons by kind, pier lines."""
    from shapely.geometry import LineString, Polygon
    coast, areas, piers = [], [], []

    kind_of = cover_kind

    for e in iter_elements(files):
        t = e.get("tags") or {}
        if e["type"] == "way" and e.get("geometry"):
            if t.get("natural") == "coastline":
                coast.append(way_pts(e))
            elif t.get("man_made") in ("pier", "breakwater"):
                pts = way_pts(e)
                if is_closed(e) and len(pts) >= 4:
                    areas.append(("pier", Polygon(pts).buffer(0), t.get("name")))
                elif len(pts) >= 2:
                    piers.append(LineString(pts))
            else:
                k = kind_of(t)
                if k and is_closed(e):
                    pts = way_pts(e)
                    if len(pts) >= 4:
                        areas.append((k, Polygon(pts).buffer(0), t.get("name")))
        elif e["type"] == "relation":
            k = kind_of(t)
            if not k:
                continue
            outers, inners = member_rings(e, "outer"), member_rings(e, "inner")
            if not outers:
                continue
            for o, ins in zip(outers, assign_inners(outers, inners)):
                pg = Polygon(o, [i for i in ins if len(i) >= 3]).buffer(0)
                areas.append((k, pg, t.get("name")))
    return coast, areas, piers


OV_LOCAL, OV_CLEAR = 120.0, 16.0   # a flyover longer than this keeps the road on the ground only within OV_CLEAR m of a crossing (src/bridges.js PLATEAU and ramps)
STRUCTS = []       # (line, tags, 'b'|'t', carriageway width) of every OSM bridge and tunnel way, see tools/structures.py
PED_STREETS = []   # (line, tags, width) of every OSM highway=pedestrian way (not area), for the pedestrian zones of streets_for_tile


def ped_roadlike(t):
    """A highway=pedestrian way that OSM also tags as a road with traffic: a bus lane (psv), lanes, a speed limit of 30 or more, or
    sidewalks of its own (the sidewalk is then the pavement and the way is the carriageway)."""
    ms = str(t.get("maxspeed", ""))
    return (t.get("psv") in ("yes", "designated") or "lanes" in t or ms == "IT:urban" or (ms.isdigit() and int(ms) >= 30)
            or t.get("sidewalk") in ("both", "left", "right", "yes"))


PK_OFF = {"no", "no_parking", "no_stopping", "no_standing", "separate", "none"}
PK_ON = {"lane", "street_side", "on_kerb", "half_on_kerb", "shoulder", "yes", "marked", "parallel", "perpendicular", "diagonal"}
PK_ORI = {"parallel": "p", "perpendicular": "q", "diagonal": "d"}


def parking_lanes(t):
    """Parking on each side of a way from the OSM parking:* tags, as two characters (left, right of the way direction): p parallel, q perpendicular,
    d diagonal, n none (no parking or stopping, or a lot of its own: separate), - nothing said. '' when no side says anything. Side tags win over both."""
    out = []
    for side in ("left", "right"):
        code = "-"
        for key in (f"parking:lane:{side}", f"parking:{side}", f"parking:condition:{side}", "parking:lane:both", "parking:both", "parking:condition:both"):
            v = t.get(key)
            if v is None:
                continue
            if v in PK_OFF:
                code = "n"
            elif v in PK_ON:
                ori = t.get(f"parking:{side}:orientation") or t.get("parking:both:orientation") or t.get(f"parking:lane:{side}:orientation") or v
                code = PK_ORI.get(ori, "p")
            else:
                continue
            break
        if code == "-" and t.get("parking:lane") in ("left", "right", "both", "no"):   # the old single tag
            pl = t["parking:lane"]
            code = "n" if pl == "no" or (pl != "both" and pl != side) else PK_ORI.get(t.get("parking:orientation", ""), "p")
        out.append(code)
    return "" if out == ["-", "-"] else "".join(out)


def parse_highways(files):
    from shapely.geometry import LineString, Polygon
    from streets import width_of
    import structures
    roads, car, ped, plazas, short_tn = [], [], [], [], []
    PED_STREETS.clear()
    STRUCTS.clear()
    for e in iter_elements(files):
        t = e.get("tags") or {}
        hw = t.get("highway")
        if e["type"] != "way" or not e.get("geometry") or hw not in ROAD_WIDTH:
            continue
        pts = way_pts(e)
        if len(pts) < 2:
            continue
        closed = is_closed(e)
        # covered=yes alone is not a tunnel on a main road: OSM puts it on stretches that run in an open cutting under the bridges of a junction (the Viale Regione
        # Siciliana under Piazza Albert Einstein, 543 m). They were dropped as tunnels but never built as one (that needs tunnel=yes), so the road was missing.
        # (On a residential or service way covered=yes is a passage through a building, which stays as it was.)
        tunnel = t.get("tunnel") in ("yes", "culvert", "building_passage") or (t.get("covered") == "yes" and hw not in COVERED_OPEN)
        if hw == "pedestrian" and closed and t.get("area") == "yes":
            pg = Polygon(pts).buffer(0)
            plazas.append(pg)
            ped.append(pg)
            continue
        r = {"w": ROAD_WIDTH[hw], "k": ROAD_KIND.get(hw, hw)}
        if t.get("name"):
            r["n"] = t["name"]
        if tunnel:
            r["tn"] = 1
        elif t.get("bridge") in ("yes", "viaduct", "movable"):
            r["br"] = 1
        # Same fields and encoding as tools/bake.py (traffic reads o and j city-wide): o one-way (1 along the points, -1 against),
        # l lanes, ms maxspeed, j junction. cw (real carriageway width, only when it differs from the class default) is for src/streets.js roadMarks.
        ow = t.get("oneway")
        if ow in ("yes", "true", "1") or t.get("junction") == "roundabout":
            r["o"] = 1
        elif ow == "-1":
            r["o"] = -1
        for tag, field in (("lanes", "l"), ("maxspeed", "ms")):
            try:
                r[field] = int(t[tag])
            except (KeyError, ValueError):
                pass
        if t.get("junction"):
            r["j"] = t["junction"]
        sw = [t.get(k) for k in ("sidewalk", "sidewalk:both")] + [t.get("sidewalk:left"), t.get("sidewalk:right")]
        if any(v in ("no", "none") for v in sw[:2]) or (sw[2] in ("no", "none") and sw[3] in ("no", "none")):
            r["sw"] = "n"   # OSM: no sidewalk on this road (board item n6)
        elif any(v in ("yes", "both", "left", "right", "separate") for v in sw):
            r["sw"] = "y"
        pk = parking_lanes(t)
        if pk:
            r["pk"] = pk   # parking lanes left / right of the way direction (src/props.js parked cars)
        if hw in CARRIAGEWAY:
            cw = round(width_of(t, CARRIAGEWAY[hw]), 1)
            if cw != CARRIAGEWAY[hw]:
                r["cw"] = cw
        roads.append((r, LineString(pts)))
        if hw == "pedestrian" and not tunnel:
            PED_STREETS.append((LineString(pts), t, r["w"]))
        brg = t.get("bridge") in ("yes", "viaduct", "movable", "aqueduct") and not tunnel
        if (brg or t.get("tunnel") == "yes") and hw in ROAD_WIDTH and hw not in ("track", "bridleway") and not closed:
            cwd = width_of(t, CARRIAGEWAY[hw]) if hw in CARRIAGEWAY else PEDESTRIAN.get(hw, ROAD_WIDTH[hw])
            STRUCTS.append((LineString(pts), dict(t, _id=e["id"]), "b" if brg else "t", cwd))
        if tunnel:
            if t.get("tunnel") == "yes" and hw in CARRIAGEWAY and LineString(pts).length < structures.MIN_TUNNEL:
                short_tn.append((r, LineString(pts), hw, t))   # too short to be built as a tunnel: see below
            continue
        if hw in CARRIAGEWAY:
            car.append(LineString(pts).buffer(width_of(t, CARRIAGEWAY[hw]) / 2, quad_segs=4))
        elif hw in PEDESTRIAN and not (RS_ON and hw == "pedestrian"):   # pedestrian streets come from the decree list (road_surfaces)
            ped.append(LineString(pts).buffer(width_of(t, PEDESTRIAN[hw]) / 2, quad_segs=4))
    # A tunnel way under 20 m gets no tunnel record (structures.MIN_TUNNEL) and `tn` drops it from the streets and from traffic, so where it is the road
    # that passes under a bridge of a junction (Via Liberta under the ramps at Isola delle Femmine) the road vanished for the length of the deck. Under a
    # bridge it is an ordinary road at ground level, and the bridge above it becomes a flyover (structures.py finds the crossing).
    bridges = [ls for ls, t, kind, _cw in STRUCTS if kind == "b" and t.get("highway") not in ("footway", "path", "cycleway", "steps", "pedestrian")]
    for r, ls, hw, t in short_tn:
        if any(ls.buffer(1.0).intersects(b) for b in bridges):
            r.pop("tn", None)
            car.append(ls.buffer(width_of(t, CARRIAGEWAY[hw]) / 2, quad_segs=4))
    return roads, car, ped, plazas


def parse_waterways(files):
    """[(LineString, tags)] of OSM waterway lines (rivers, streams, drains), for structures.py."""
    from shapely.geometry import LineString
    out = []
    for e in iter_elements(files):
        t = e.get("tags") or {}
        if e["type"] == "way" and e.get("geometry") and t.get("waterway") in WATERWAYS and len(e["geometry"]) >= 2:
            out.append((LineString(way_pts(e)), t))
    return out


def parse_places(files):
    """Named stadiums, harbours, capes, districts ...: (name, x, z, size, kind). Only landmark candidates."""
    out = []
    for e in iter_elements(files):
        t = e.get("tags") or {}
        if not t.get("name"):
            continue
        kind = (t.get("place") or t.get("leisure") or t.get("harbour") and "harbour" or t.get("landuse")
                or t.get("natural") or t.get("man_made") or t.get("tourism") or t.get("amenity") or t.get("historic") or "place")
        if e["type"] == "node":
            x, z = proj(e["lat"], e["lon"])
            out.append((t["name"], x, z, 0.0, kind))
            continue
        pts = []
        if e["type"] == "way":
            pts = way_pts(e) if e.get("geometry") else []
        else:
            for m in e.get("members", []):
                pts += [proj(g["lat"], g["lon"]) for g in m.get("geometry", [])]
        if len(pts) >= 2:
            xs, zs = [p[0] for p in pts], [p[1] for p in pts]
            out.append((t["name"], (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2,
                        (max(xs) - min(xs)) * (max(zs) - min(zs)), kind))
    return out


def parse_props(files):
    """Street furniture, same structure/field names as props-data.js (window.PALERMO_PROPS)."""
    items, areas = [], []
    for e in iter_elements(files):
        t = e.get("tags")
        if not t:
            continue
        if e["type"] == "node":
            k = prop_kind(t)
            if not k:
                continue
            x, z = proj(e["lat"], e["lon"])
            it = {"k": k, "x": x, "z": z}
            for src, dst in PROP_TAGS:
                if t.get(src):
                    it[dst] = t[src]
            items.append(it)
        elif e["type"] == "way" and e.get("geometry"):
            pts = way_pts(e)
            if len(pts) < 2:
                continue
            fl = flat(pts)
            a = t.get("amenity")
            if t.get("natural") == "tree_row":
                rec = {"k": "tree_row", "p": fl}
            elif a in ("parking", "bicycle_parking", "motorcycle_parking"):
                rec = {"k": "parking" if a == "parking" else "bikepark", "p": fl, "ptype": t.get("parking", ""),
                       "access": t.get("access", ""), "cap": t.get("capacity", "")}
            elif a == "marketplace":
                rec = {"k": "market", "p": fl}
            elif a == "fountain":
                rec = {"k": "fountain", "p": fl}
            else:
                continue
            rec["_c"] = cx_cz(pts)
            areas.append(rec)
    return items, areas


PROP_TAGS = (("species", "sp"), ("genus", "ge"), ("leaf_type", "lt"), ("leaf_cycle", "lc"), ("height", "h"),
             ("name", "n"), ("shop", "shop"), ("direction", "dir"), ("lamp_mount", "mount"), ("support", "support"),
             ("denotation", "den"), ("crossing", "cr"), ("traffic_signals", "ts"), ("lamp_type", "ltype"),
             ("waste", "waste"), ("backrest", "back"), ("seats", "seats"), ("capacity", "cap"),
             ("artwork_type", "art"), ("amenity", "am"), ("outdoor_seating", "out"), ("memorial", "mem"),
             ("tourism", "tour"), ("man_made", "mm"))


def prop_kind(t):
    """Same mapping as tools/props.py kind_of (kept in sync by hand, props.js expects these kinds)."""
    if t.get("natural") == "tree":
        return "tree"
    h = t.get("highway")
    if h == "street_lamp":
        return "lamp"
    if h == "crossing":
        return "crossing"
    if h == "bus_stop" or t.get("public_transport") == "platform":
        return "busstop"
    if h == "traffic_signals":
        return "signal"
    a = t.get("amenity")
    if a in ("waste_disposal", "recycling"):
        return "bin_big"
    if a == "waste_basket":
        return "bin_small"
    if a == "bench":
        return "bench"
    if a == "fountain":
        return "fountain"
    if a == "drinking_water":
        return "water"
    if a in ("bicycle_parking", "motorcycle_parking"):
        return "bikepark"
    if a in ("cafe", "bar", "restaurant", "ice_cream", "pub", "fast_food"):
        return "cafe"
    if a == "post_box":
        return "postbox"
    if a == "telephone":
        return "phone"
    if a == "fuel":
        return "fuel"
    if t.get("emergency") == "fire_hydrant":
        return "hydrant"
    if t.get("barrier") in ("bollard", "block", "cycle_barrier", "lift_gate"):
        return "bollard"
    if t.get("tourism") == "artwork" or t.get("memorial") or t.get("historic") in (
            "memorial", "monument", "wayside_cross", "wayside_shrine"):
        return "monument"
    if t.get("man_made") in ("flagpole", "street_cabinet", "surveillance", "utility_pole", "pole"):
        return t["man_made"]
    if t.get("shop"):
        return "shop"
    return None


# ----------------------------------------------------------------------------------------------
# Land polygon from the coastline
# ----------------------------------------------------------------------------------------------
# Mondello beach (board item c5): the OSM coastline leaves a dry beach of 25 to 45 m in the middle of the bay, the photographs and the satellite views show 50 to 80 m.
# BEACH_BACK is the landward edge of the sand (z, x) from the OSM beach polygon (the same table as LAND in src/lmc-mondello.js); where the shore is nearer than BEACH_WANT the coast is pushed
# seaward by the difference (at most BEACH_MAX, smoothed along the beach, nothing in the Stabilimento's stretch). The strip is kept in BEACH_STRIP: it is sand too.
BEACH_BACK = [(-10020, -3128), (-9980, -3137), (-9940, -3158), (-9900, -3159), (-9860, -3153), (-9820, -3147), (-9780, -3141), (-9740, -3128), (-9700, -3104), (-9660, -3081), (-9620, -3061),
              (-9580, -3029), (-9540, -3020), (-9500, -3000), (-9460, -2987), (-9420, -2966), (-9380, -2942), (-9340, -2912), (-9300, -2874), (-9260, -2839), (-9220, -2804), (-9180, -2766),
              (-9140, -2728), (-9100, -2687), (-9060, -2644), (-9020, -2598)]
BEACH_WANT, BEACH_MAX, BEACH_Z = 58.0, 26.0, (-9990, -9080)
BEACH_SKIP = (-9690, -9510)     # the Antico Stabilimento stands on piles in the water here
BEACH_STRIP = None


def widen_beach(land):
    """land plus the Mondello beach strip (see BEACH_BACK); sets BEACH_STRIP."""
    global BEACH_STRIP
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union

    def back(z):
        if z <= BEACH_BACK[0][0]:
            return BEACH_BACK[0][1]
        for (za, xa), (zb, xb) in zip(BEACH_BACK, BEACH_BACK[1:]):
            if za <= z <= zb:
                return xa + (xb - xa) * (z - za) / (zb - za)
        return BEACH_BACK[-1][1]

    zs = list(range(BEACH_Z[0], BEACH_Z[1] + 1, 10))
    shore, extra = [], []
    for z in zs:
        bx = back(z)
        inter = LineString([(bx + 4.0, z), (bx + 160.0, z)]).intersection(land)
        segs = [inter] if inter.geom_type == "LineString" else [g for g in getattr(inter, "geoms", []) if g.geom_type == "LineString"]
        x0 = bx + 4.0
        seg = next((g for g in segs if abs(g.coords[0][0] - (bx + 4.0)) < 0.01), None)   # the land piece that starts at the back of the beach
        sx = max(c[0] for c in seg.coords) if seg is not None else None
        shore.append(sx)
        extra.append(0.0 if sx is None else max(0.0, min(BEACH_MAX, BEACH_WANT - (sx - bx))))
    for _ in range(3):   # smooth along the beach
        extra = [sum(extra[max(0, i - 1):i + 2]) / len(extra[max(0, i - 1):i + 2]) for i in range(len(extra))]
    for i, z in enumerate(zs):   # nothing in the Stabilimento's stretch, tapering out over 40 m on both sides
        d = max(BEACH_SKIP[0] - z, z - BEACH_SKIP[1], 0.0)
        if BEACH_SKIP[0] <= z <= BEACH_SKIP[1]:
            extra[i] = 0.0
        else:
            extra[i] *= min(1.0, d / 40.0)
    inner, outer = [], []
    for z, sx, e in zip(zs, shore, extra):
        if sx is None or e < 0.5:
            continue
        inner.append((sx - 1.0, z))
        outer.append((sx + e, z))
    # the strip is cut into runs of consecutive samples
    strips, run_i, run_o, last = [], [], [], None
    for (ix, z), (ox, _) in zip(inner, outer):
        if last is not None and z - last > 15:
            if len(run_i) > 1:
                strips.append(Polygon(run_i + run_o[::-1]).buffer(0))
            run_i, run_o = [], []
        run_i.append((ix, z)); run_o.append((ox, z)); last = z
    if len(run_i) > 1:
        strips.append(Polygon(run_i + run_o[::-1]).buffer(0))
    BEACH_STRIP = unary_union(strips).difference(land) if strips else None
    return unary_union([land] + strips).buffer(0) if strips else land


def build_land(coast, rect):
    """Land = faces of (bbox border + coastline) that lie on the left of the coast ways (OSM rule)."""
    import shapely
    from shapely.geometry import LineString, Point, box
    from shapely.ops import polygonize, unary_union
    B = box(*rect)
    lines = []
    for pts in coast:
        if len(pts) >= 2:
            g = LineString(pts).intersection(B)
            lines += [g] if isinstance(g, LineString) else [x for x in getattr(g, "geoms", []) if isinstance(x, LineString)]
    faces = list(polygonize(unary_union([B.exterior] + lines)))
    tree = shapely.STRtree(faces)
    votes = [[0, 0] for _ in faces]   # [land, sea]
    for ln in lines:
        c = list(ln.coords)
        for a, b in zip(c, c[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dz)
            if L < 0.5:
                continue
            mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            # left of travel in (x east, z south) coordinates is (dz, -dx)
            for side, (ox, oz) in ((0, (dz / L * 0.3, -dx / L * 0.3)), (1, (-dz / L * 0.3, dx / L * 0.3))):
                for i in tree.query(Point(mx + ox, mz + oz), predicate="within"):
                    votes[i][side] += 1
    land = [f for f, v in zip(faces, votes) if v[0] > v[1]]
    if not land:
        land = [B]
    return widen_beach(unary_union(land).buffer(0))


# ----------------------------------------------------------------------------------------------
# Streets per tile
# ----------------------------------------------------------------------------------------------
G = {}  # filled before forking the workers


def polys_of(geom):
    from shapely.geometry import MultiPolygon, Polygon
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def ring_flat(coords):
    return [round(c, 1) for p in list(coords)[:-1] for c in p[:2]]


def chunked(geom, tx0, tz0):
    """Cut a layer into cells aligned to the tile origin, densified: [[outer, hole, ...], ...]."""
    import shapely
    from shapely.geometry import box
    from shapely.ops import unary_union
    out = []
    pg = polys_of(geom.buffer(0)) if not geom.is_empty else []
    if not pg:
        return out
    tree = shapely.STRtree(pg)
    n = int(round(T / CHUNK))
    for a in range(n):
        for b in range(n):
            cell = box(tx0 + a * CHUNK, tz0 + b * CHUNK, tx0 + (a + 1) * CHUNK, tz0 + (b + 1) * CHUNK)
            hits = [pg[i] for i in tree.query(cell)]
            if not hits:
                continue
            piece = poly_only(unary_union([I(h, cell) for h in hits]))
            for p in polys_of(piece):
                if p.area < 0.5:
                    continue
                p = shapely.segmentize(shapely.set_precision(p, 0.1), DENSIFY)
                for q in polys_of(p):
                    if q.area < 0.3:
                        continue
                    out.append([ring_flat(q.exterior.coords)] + [ring_flat(r.coords) for r in q.interiors])
    return out


def query_geoms(tree, geoms, rect):
    return [geoms[i] for i in tree.query(rect)]


def poly_only(g):
    """Polygonal part of a geometry (overlay results can carry stray lines/points)."""
    from shapely.geometry import MultiPolygon, Polygon
    if g is None or g.is_empty:
        return Polygon()
    if isinstance(g, (Polygon, MultiPolygon)):
        return g
    ps = polys_of(g)
    return MultiPolygon(ps) if ps else Polygon()


def _ov(op, a, b):
    import shapely
    if a.is_empty:
        return a
    if b.is_empty:
        return a if op == "difference" else b
    try:
        return poly_only(getattr(a, op)(b))
    except shapely.errors.GEOSException:
        pass
    try:
        return poly_only(getattr(shapely, op)(a.buffer(0), b.buffer(0)))
    except shapely.errors.GEOSException:
        return poly_only(getattr(shapely, op)(a, b, grid_size=0.05))


def D(a, b):
    return _ov("difference", a, b)


def I(a, b):  # noqa: E743
    return _ov("intersection", a, b)


RS_LAYERS = ("carriageway", "pavement", "verge", "plaza", "pedestrian", "platform")


def load_road_surfaces():
    """data/road_surfaces.json -> {layer: (geoms, STRtree)} in game metres. Shoulders (motorway hard shoulder) count as carriageway."""
    import shapely
    from shapely.geometry import Polygon
    d = json.load(open(RS_PATH))
    out = {}
    for name in RS_LAYERS:
        geoms = []
        for rec in d[name]:
            ring = list(zip(rec["p"][0::2], rec["p"][1::2]))
            if len(ring) < 3:
                continue
            holes = [list(zip(h[0::2], h[1::2])) for h in rec.get("h", []) if len(h) >= 6]
            g = Polygon(ring, holes)
            if not g.is_valid:
                g = shapely.make_valid(g)
                if g.is_empty:
                    continue
            if name == "verge" and rec.get("k") == "shoulder":
                out.setdefault("shoulder", []).append(g)
            else:
                geoms.append(g)
        out[name] = geoms
    out.setdefault("shoulder", [])
    return {k: (v, shapely.STRtree(v)) for k, v in out.items()}


def streets_for_tile(tx0, tz0):
    import shapely
    from shapely.geometry import LineString, box
    from shapely.ops import unary_union
    tile = box(tx0, tz0, tx0 + T, tz0 + T)
    R = box(tx0 - MARGIN, tz0 - MARGIN, tx0 + T + MARGIN, tz0 + T + MARGIN)
    empty = {"asphalt": [], "paving": [], "raised": [], "green": [], "water": [], "sand": [], "curbs": [],
             "aoi": [tx0, tz0, tx0 + T, tz0 + T]}
    land = I(G["land"], R)
    if land.is_empty:
        return empty
    bl = poly_only(unary_union(query_geoms(G["bld_tree"], G["bld_geoms"], R)))
    space = D(land, bl)

    def layer(tree, geoms):
        hits = query_geoms(tree, geoms, R)
        return poly_only(unary_union([I(h, R) for h in hits])) if hits else shapely.Polygon()

    car = layer(G["car_tree"], G["car_geoms"])
    ped = layer(G["ped_tree"], G["ped_geoms"])
    verge = shapely.Polygon()
    if "rs" in G:
        # Comune street polygons (tools/road_surfaces.py): the carriageway is asphalt, pavement bands are the raised layer, the strip beyond
        # them where no building stands is the verge; squares, car parks and decreed pedestrian streets are paving. Ground in none of
        # these is private land (courtyards, gardens, lots) and stays terrain.
        def rs(name):
            geoms, tr = G["rs"][name]
            hits = [geoms[i] for i in tr.query(R)]
            return poly_only(unary_union([I(h, R) for h in hits])) if hits else shapely.Polygon()
        carr, pave, verg = rs("carriageway"), rs("pavement"), rs("verge")
        tz = layer(G["tunnel_tree"], G["tunnel_geoms"])
        if not tz.is_empty:   # the Comune polygons do not skip tunnels: the ground above one is no street (a surface road crossing it is put back)
            carr = unary_union([D(carr, tz), I(car, tz)])
            pave, verg = D(pave, tz), D(verg, tz)
        # The Comune polygon is the whole street space, medians and promenades included (Viale della Liberta, a tree-lined avenue between two
        # roadways, is one polygon). Asphalt is only what lies near an OSM road line; the rest is a median or island: raised, like a pavement.
        lanes = layer(G["lane_tree"], G["lane_geoms"])
        island = D(carr, lanes) if not lanes.is_empty else shapely.Polygon()
        carr = I(carr, lanes) if not lanes.is_empty else carr
        nko, nkc = layer(G["nko_tree"], G["nko_geoms"]), layer(G["nkc_tree"], G["nkc_geoms"])
        if not nko.is_empty or not nkc.is_empty:   # roads with no pavement (n6): the carriageway beyond the lanes is bare ground, not a raised band
            island = D(island, unary_union([nko, nkc]))
        if not nko.is_empty:
            pave = D(pave, nko)
        pave = unary_union([pave, island])
        medn = layer(G["medn_tree"], G["medn_geoms"])   # the narrow median of a dual carriageway: its own kerbed concrete layer, not walkable (n2)
        carr = unary_union([carr, rs("shoulder")])
        azl = layer(G["az_tree"], G["az_geoms"])
        if not azl.is_empty:
            pave = unary_union([pave, azl])
        pstreet = D(layer(G["pz_tree"], G["pz_geoms"]), layer(G["keep_tree"], G["keep_geoms"]))
        qstrip = D(I(G["quay_strip"], R), carr) if not G["quay_strip"].is_empty else shapely.Polygon()   # the harbour's quay apron is paved, the roads on it stay roads
        pedz = unary_union([rs("plaza"), D(rs("pedestrian"), layer(G["asph_tree"], G["asph_geoms"])), ped, pstreet, qstrip])
        paving = I(pedz, space)
        asphalt = D(I(carr, space), paving)
        # Comune green (aree verdi): the medians and islands of the Comune are not road, so they are cut out of the asphalt; every class is
        # grass (the `green` layer, kerb height) unless it is paving or water
        gv_idx = G["gv_tree"].query(R)
        gv_all = poly_only(unary_union([I(G["gv_geoms"][k], R) for k in gv_idx])) if len(gv_idx) else shapely.Polygon()
        gv_cut = poly_only(unary_union([I(G["gv_geoms"][k], R) for k in gv_idx if G["gv_cls"][k] in ("median", "island")])) if len(gv_idx) else shapely.Polygon()
        if not gv_cut.is_empty:
            asphalt = D(asphalt, gv_cut)
        water = D(I(layer(G["water_tree"], G["water_geoms"]), space), asphalt)
        sand = D(D(D(I(layer(G["sand_tree"], G["sand_geoms"]), space), asphalt), paving), water)
        green = D(D(D(D(I(layer(G["green_tree"], G["green_geoms"]), space), asphalt), paving), water), sand)
        if not gv_all.is_empty:
            green = poly_only(unary_union([green, D(D(D(D(I(gv_all, space), asphalt), paving), water), sand)]))
        medw = layer(G["medw_tree"], G["medw_geoms"])
        if not medw.is_empty:   # the wide median is a planted strip (n2), where the survey draws neither a pavement nor a verge
            medw = D(D(medw, pave), verg)
            green = poly_only(unary_union([green, D(D(D(D(I(medw, space), asphalt), paving), water), sand)]))
        median = shapely.Polygon()
        if not medn.is_empty:   # where the survey draws a pavement or a verge in it, that stays
            median = poly_only(D(D(D(D(D(D(I(D(D(medn, pave), verg), space), asphalt), paving), water), sand), green), carr))
        taken = unary_union([asphalt, paving, green, water, sand, median])
        raised = D(I(pave, space), taken)
        verge = D(D(I(verg, space), taken), raised)
        raised, verge = poly_only(raised.buffer(-0.05).buffer(0.05)), poly_only(verge.buffer(-0.05).buffer(0.05))
        cut = layer(G["cut_tree"], G["cut_geoms"])   # bridge decks (src/bridges.js draws them) take the road off the ground under them
        if not cut.is_empty:
            asphalt, raised, verge, paving, median = (D(g, cut) for g in (asphalt, raised, verge, paving, median))
        asphalt, raised, verge, paving, median = (poly_only(g.simplify(RS_SIMPLIFY)) for g in (asphalt, raised, verge, paving, median))   # the survey is 1:2000
    else:
        asphalt = I(car, space)
        paving = D(I(ped, space), asphalt)
        water = D(I(layer(G["water_tree"], G["water_geoms"]), space), asphalt)
        sand = D(D(D(I(layer(G["sand_tree"], G["sand_geoms"]), space), asphalt), paving), water)
        green = D(D(D(D(I(layer(G["green_tree"], G["green_geoms"]), space), asphalt), paving), water), sand)
        if bl.is_empty:
            raised = shapely.Polygon()
        else:
            zone = bl.buffer(URBAN_REACH, quad_segs=2)
            raised = D(D(D(D(D(I(space, zone), asphalt), paving), green), water), sand)
            raised = poly_only(raised.buffer(-0.15).buffer(0.15))

    curbs = []
    if not RS_ON:
        median = shapely.Polygon()
    touch = unary_union([raised, green, median]).buffer(0.3)
    if not asphalt.is_empty and not touch.is_empty:
        for p in polys_of(shapely.orient_polygons(asphalt)):
            for ring in [p.exterior] + list(p.interiors):
                seg = LineString(ring.coords).intersection(touch).intersection(tile)
                for g in ([seg] if isinstance(seg, LineString) else getattr(seg, "geoms", [])):
                    if isinstance(g, LineString) and g.length > 0.5:
                        g = shapely.segmentize(g, DENSIFY)
                        curbs.append([round(c, 1) for pt in g.coords for c in pt[:2]])

    out = {"aoi": empty["aoi"]}
    for name, geom in (("asphalt", asphalt), ("paving", paving), ("raised", raised), ("verge", verge), ("median", median), ("green", green),
                       ("water", water), ("sand", sand)):
        g = I(geom, tile)
        out[name] = chunked(g, tx0, tz0) if not g.is_empty else []
    out["curbs"] = curbs
    return {k: out[k] for k in ("asphalt", "paving", "raised", "verge", "median", "green", "water", "sand", "curbs", "aoi") if k not in ("verge", "median") or out[k]}


def clip_line(ls, tile):
    g = ls.intersection(tile)
    parts = [g] if g.geom_type == "LineString" else [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]
    return [p for p in parts if p.length > 0.5]


def tile_payload(i, j):
    """Everything for tile (i, j) as a dict, or None when the tile is empty."""
    import shapely
    from shapely.geometry import box
    tx0, tz0 = i * T, j * T
    tile = box(tx0, tz0, tx0 + T, tz0 + T)
    key = f"{i}_{j}"
    blds = [{k: v for k, v in b.items() if not k.startswith("_")} for b in G["tile_bld"].get(key, [])]
    labels = [{k: v for k, v in lb.items() if not k.startswith("_")} for lb in G["tile_lab"].get(key, [])]

    roads = []
    for ri in G["road_tree"].query(tile):
        rec, ls = G["roads"][ri]
        for part in clip_line(ls, tile):
            r = dict(rec)
            r.pop("sw", None)   # bake-time only (n6)
            r["p"] = [round(c, 1) for pt in part.coords for c in pt[:2]]
            roads.append(r)
    for ls in (G["pier_geoms"][k] for k in G["pier_tree"].query(tile)):
        for part in clip_line(ls, tile):
            roads.append({"w": 5, "k": "pier", "p": [round(c, 1) for pt in part.coords for c in pt[:2]]})

    areas = []
    landt = I(G["land"], tile)
    for ai in G["area_tree"].query(tile):
        kind, geom = G["areas"][ai]
        g = I(geom, tile)
        if kind != "pier":
            g = I(g, landt)
        for p in polys_of(g):
            if p.area < 2:
                continue
            for q in polys_of(shapely.set_precision(p, 0.1)):
                rec = {"k": kind, "p": ring_flat(q.exterior.coords)}
                if q.interiors:
                    rec["holes"] = [ring_flat(r.coords) for r in q.interiors]
                areas.append(rec)

    pitems = G["tile_props"].get(key, [])
    pareas = [{k: v for k, v in a.items() if k != "_c"} for a in G["tile_pareas"].get(key, [])]
    counts = {}
    for it in pitems:
        counts[it["k"]] = counts.get(it["k"], 0) + 1
    for a in pareas:
        counts[a["k"]] = counts.get(a["k"], 0) + 1

    st = streets_for_tile(tx0, tz0)
    has_streets = any(st.get(k) for k in ("asphalt", "paving", "raised", "verge", "median", "green", "water", "sand", "curbs"))
    near = G["near_for"](i, j)
    tr, rail = (G["tram"].tile(tx0, tz0, T) if G.get("tram") is not None else (None, []))
    fn = []
    if G.get("fence_tree") is not None:
        import fences as fnc
        from shapely.ops import unary_union
        cutg = unary_union([G["cut_geoms"][k] for k in G["cut_tree"].query(tile)]) if "cut_tree" in G and len(G["cut_tree"].query(tile)) else None
        carr_g, carr_t = G["rs"]["carriageway"] if "rs" in G else ([], shapely.STRtree([]))
        fn = fnc.tile_fences(tx0, tz0, T, G["fence_items"], G["fence_tree"], G["bld_geoms"], G["bld_tree"], cutg, carr_g, carr_t, I, D, poly_only)

    if not (blds or roads or areas or pitems or pareas or labels or has_streets or near or G["tile_struct"].get(key) or fn or tr or rail):
        return None
    out = {"buildings": blds, "roads": roads, "streets": st, "areas": areas, "labels": labels,
           "props": {"items": pitems, "areas": pareas, "counts": counts}}
    if G.get("quay_decks"):
        import quays as qy
        qrec = qy.tile_record(G["quay_decks"], G["quay_walls"], G["quay_wall_all"], i, j, T)
        if qrec:
            out["quays"] = qrec
    if G["tile_struct"].get(key):
        out["structs"] = G["tile_struct"][key]
    if rail:
        fn = rail + fn
    if fn:
        out["fences"] = fn
    if tr:
        out["tram"] = tr
    if G["tile_gt"].get(key):
        out["gt"] = G["tile_gt"][key]
    if near:
        out["near"] = near
    return out


def write_tile(ij):
    i, j = ij
    try:
        return _write_tile(i, j)
    except Exception as ex:  # noqa: BLE001  one bad tile must not stop the bake
        import traceback
        traceback.print_exc()
        return ("ERR", f"{i}_{j}", repr(ex))


def _write_tile(i, j):
    d = tile_payload(i, j)
    if d is None:
        return None
    raw = json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode()
    path = os.path.join(WORLD, "tiles", f"{i}_{j}.json")
    with open(path, "wb") as f:
        f.write(raw)
    gz = len(gzip.compress(raw, 6))
    return (f"{i}_{j}", len(d["buildings"]), len(raw), gz,
            {"roads": len(d["roads"]), "asphalt": len(d["streets"]["asphalt"]), "props": len(d["props"]["items"])})


# ----------------------------------------------------------------------------------------------
# Terrain
# ----------------------------------------------------------------------------------------------
NEAR_STEP = 10.0     # metres between near-terrain samples
NEAR_BLEND = 120.0   # lidar-vs-far-grid offset fades out over this distance beyond the raster coverage
# Hills. Terrarium (the far grid's source) is 100 m off on Monte Pellegrino's slopes, the lidar rasters read nothing above 204 m,
# so above HILL_LO..HILL_HI metres the terrain comes from TINITALY (10 m, tools/dem.py), pinned to the lidar wherever there is
# lidar (rasters below 204 m, lidar_hills.py point queries above): TIN minus lidar is smoothed over HILL_BIAS_SIGMA metres and
# added to the TIN, fading out HILL_BIAS_REACH metres away from the lidar so the DEM keeps its own shape where there is none.
HILL_LO, HILL_HI = 80.0, 140.0
HILL_BIAS_SIGMA = 40.0
HILL_BIAS_REACH = 200.0
# t8: outside the lidar belt the ground is TINITALY too (Terrarium reads roofs and treetops: +5.7 m against the survey's foot elevations at 2 000
# buildings, TIN +2.2 m with rms 4.3), pinned to what is known: the lidar where there is some, and the Comune survey's building foot elevations
# (tools/footprints.py: `g` of every CTR-height building, 72 k points, accurate to 1.4 m rms against the lidar) elsewhere. The residual (control
# minus TIN) is smoothed over CTR_SIGMA metres, trusted in proportion to how many points fed it and faded out CTR_REACH metres from the last one.
CTR_SIGMA = 45.0
CTR_REACH = 220.0
CTR_WEIGHT = 0.4          # a survey point counts as this fraction of a lidar cell in the smoothing
COAST_FLOOR, COAST_REACH = 1.0, 80.0   # the DEM reads 0 to 2 m on the shore where the old ground said 1 to 3: land within COAST_REACH of the sea keeps at least this, so the shore line does not move
CTR_HOLDOUT = os.environ.get("T8_HOLDOUT") == "1"   # test: leave out every tenth survey point so the result can be checked against it


def _smooth(lo, hi, v):
    import numpy as np
    t = np.clip((v - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def far_interp(far):
    """Bilinear sampler of the far grid (what the runtime sees where there is no near grid)."""
    import numpy as np
    h = np.array(far["h"], dtype=np.float64).reshape(far["nz"], far["nx"])

    def f(x, z):
        fx = np.clip((np.asarray(x) - far["x0"]) / far["s"], 0, far["nx"] - 1.001)
        fz = np.clip((np.asarray(z) - far["z0"]) / far["s"], 0, far["nz"] - 1.001)
        i0, j0 = fx.astype(int), fz.astype(int)
        tx, tz = fx - i0, fz - j0
        return (h[j0, i0] * (1 - tx) * (1 - tz) + h[j0, i0 + 1] * tx * (1 - tz)
                + h[j0 + 1, i0] * (1 - tx) * tz + h[j0 + 1, i0 + 1] * tx * tz)
    return f


# ----- DTM cleaning -----
# The decoded 2 m lidar DTM (tools/lidar_raster.py) matches the MASE point queries to 0.5 m rms, but the MASE DTM itself is a rough
# ground model in town: plateaus with 1 to 4 m steps, pits at building footprints and dark halos around them (the ground
# classification has no returns under roofs), a 3 m "pit" in a courtyard here and there. Sampled raw at 10 m that is a 5 to 10 m
# bump or dip every 25 m in places like Acquasanta, where the real ground is a gentle slope, and roads drape on it. So before the
# lattice is sampled the DTM is rebuilt from the pixels that can be trusted: footprints plus CLEAN_HALO metres are dropped, and the
# rest goes through a robust (Cauchy weighted) Gaussian mean, which ignores outliers beyond CLEAN_C metres, fills the dropped
# pixels from their surroundings and turns the plateaus into a smooth slope.
CLEAN_PX = 2.0       # the raster pixel
CLEAN_SIGMA = 3.0    # pixels (6 m) of the robust mean
CLEAN_C = 0.8        # metres: residuals beyond this count for little
CLEAN_HALO = 3.0     # metres around building footprints that are dropped
CLEAN_CLOSE = 16.0   # metres: pits narrower than twice this are filled on flat ground
CLEAN_ON = True


def _footprint_mask(x0, z0, nx, nz):
    """uint8 mask (nz, nx) of the 2 m grid at (x0, z0): building footprints plus CLEAN_HALO metres."""
    import cv2
    import numpy as np
    import shapely
    m = np.zeros((nz, nx), np.uint8)
    tree, geoms = G.get("bld_tree"), G.get("bld_geoms")
    if tree is None:
        return m
    box = shapely.box(x0, z0, x0 + nx * CLEAN_PX, z0 + nz * CLEAN_PX)
    for k in tree.query(box):
        for poly in polys_of(geoms[k]):
            pts = np.round((np.asarray(poly.exterior.coords) - (x0, z0)) / CLEAN_PX * 16).astype(np.int32)
            cv2.fillPoly(m, [pts], 1, shift=4)
    r = int(round(CLEAN_HALO / CLEAN_PX))
    if r > 0:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    return m


def clean_dtm(x0, z0, nx, nz):
    """Cleaned DTM on the 2 m grid whose pixel (r, c) has its centre at (x0 + (c + .5) * 2, z0 + (r + .5) * 2); NaN where the lidar has
    no data. A pure function of position (the window only needs to be about 40 m wider than what is used), so tiles agree on borders."""
    import cv2
    import numpy as np
    xs = x0 + (np.arange(nx) + 0.5) * CLEAN_PX
    zs = z0 + (np.arange(nz) + 0.5) * CLEAN_PX
    X, Z = np.meshgrid(xs, zs)
    D = lr.sample_dtm(X, Z, "nearest").astype(np.float32)
    have = np.isfinite(D)
    if not have.any():
        return D
    if not CLEAN_ON:
        return D
    ok = have & (_footprint_mask(x0, z0, nx, nz) == 0)
    Dz = np.where(have, D, 0).astype(np.float32)
    okf = ok.astype(np.float32)
    blur = lambda a, s: cv2.GaussianBlur(a, (0, 0), s, borderType=cv2.BORDER_REPLICATE)
    out = np.full(D.shape, np.nan, np.float32)
    cover = blur(have.astype(np.float32), 6.0) > 0.25
    todo = cover.copy()
    for sig in (CLEAN_SIGMA, 4 * CLEAN_SIGMA):
        den = blur(okf, sig)
        mu = np.where(den > 1e-3, blur(Dz * okf, sig) / np.maximum(den, 1e-3), np.nan)
        for _ in range(4):
            r = np.nan_to_num(D - mu, nan=0.0)
            w = okf / (1.0 + (r / CLEAN_C) ** 2)
            dw = blur(w, sig)
            mu = np.where(dw > 1e-3, blur(Dz * w, sig) / np.maximum(dw, 1e-3), np.nan)
        got = todo & np.isfinite(mu) & (blur(okf, sig) > 0.02)
        out[got] = mu[got]
        todo &= ~got
        if not todo.any():
            break
    # pits narrower than 2 * CLEAN_CLOSE metres that survived (courtyards, basements, shaded halos) are filled up to their rim, on
    # flat ground only: a closing would also fill real gullies and shave valley floors on slopes
    k = int(round(CLEAN_CLOSE / CLEAN_PX))
    if k > 0:
        # no-data pixels take the local mean of the data around them (normalised blur), not the median of the whole window: the
        # window is different for every tile, and that made the cleaned DTM (and so `near`) differ between neighbouring tiles
        okm = np.isfinite(out).astype(np.float32)
        den = cv2.GaussianBlur(okm, (0, 0), 8.0)
        num = cv2.GaussianBlur(np.where(np.isfinite(out), out, 0).astype(np.float32), (0, 0), 8.0)
        loc = np.where(den > 0.01, num / np.maximum(den, 0.01), 0.0)
        fill = np.where(np.isfinite(out), out, loc).astype(np.float32)
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))
        closed = cv2.erode(cv2.dilate(fill, ker), ker)
        gy, gx = np.gradient(cv2.GaussianBlur(closed, (0, 0), 4.0), CLEAN_PX)   # slope of the filled surface, not of the pit walls
        flat = 1.0 - np.clip((np.hypot(gx, gy) - 0.05) / 0.07, 0, 1)    # 1 below 5 % slope, 0 above 12 %
        up = np.maximum(closed - fill, 0) * flat
        out = np.where(np.isfinite(out), out + up, out)
        out = np.where(np.isfinite(out), cv2.GaussianBlur(np.where(np.isfinite(out), out, fill), (0, 0), 1.5), out)
    return out


class _CleanWindow:
    """Bilinear sampler of clean_dtm over a window, built once per near_for call."""

    def __init__(self, x0, z0, x1, z1):
        import numpy as np
        self.x0 = math.floor(x0 / CLEAN_PX) * CLEAN_PX
        self.z0 = math.floor(z0 / CLEAN_PX) * CLEAN_PX
        self.nx = int(math.ceil((x1 - self.x0) / CLEAN_PX))
        self.nz = int(math.ceil((z1 - self.z0) / CLEAN_PX))
        self.a = clean_dtm(self.x0, self.z0, self.nx, self.nz)
        self._fp = None

    def footprint_at(self, x, z):
        """True where (x, z) is inside a building footprint or its CLEAN_HALO."""
        import numpy as np
        if self._fp is None:
            self._fp = _footprint_mask(self.x0, self.z0, self.nx, self.nz)
        ii = np.clip(np.floor((np.asarray(x) - self.x0) / CLEAN_PX).astype(int), 0, self.nx - 1)
        jj = np.clip(np.floor((np.asarray(z) - self.z0) / CLEAN_PX).astype(int), 0, self.nz - 1)
        return self._fp[jj, ii] > 0

    def sample(self, x, z):
        import numpy as np
        fx = (np.asarray(x) - self.x0) / CLEAN_PX - 0.5
        fz = (np.asarray(z) - self.z0) / CLEAN_PX - 0.5
        i0, j0 = np.floor(fx).astype(int), np.floor(fz).astype(int)
        tx, tz = fx - i0, fz - j0
        acc = np.zeros(fx.shape)
        ws = np.zeros(fx.shape)
        for di, dj, w in ((0, 0, (1 - tx) * (1 - tz)), (1, 0, tx * (1 - tz)), (0, 1, (1 - tx) * tz), (1, 1, tx * tz)):
            ii, jj = i0 + di, j0 + dj
            inb = (ii >= 0) & (ii < self.nx) & (jj >= 0) & (jj < self.nz)
            v = np.full(fx.shape, np.nan)
            v[inb] = self.a[jj[inb], ii[inb]]
            ok = np.isfinite(v)
            acc += np.where(ok, v * w, 0)
            ws += np.where(ok, w, 0)
        return np.where(ws > 0.5, acc / np.maximum(ws, 1e-9), np.nan)


# ----- road bench -----
# Roads on a slope need ground that follows the road, not the hillside: a level bench along every drivable road (full weight across
# the carriageway and its margins, easing back to the raw ground over BENCH_EASE metres) at the ground height under the road
# centreline smoothed along the road (a median of 5 samples, then a Gaussian of BENCH_SIGMA metres), so a switchback is not a sawtooth
# of the ground's noise but the road still sits where the lidar saw it. (The first version averaged 17 samples on rings of 20 and 45 m
# around each road point, like the runtime bench: on a spur or a hairpin that mean is up to 10 m under the road itself.) It used to be carved by src/world.js at load time per tile, from the roads
# clipped to that tile and from whichever neighbours happened to be loaded, so a tile with a bench next to one without had a 2 m
# step along the border (Via Pietro Bonanno at x = 500) and neighbouring benches disagreed. Here it is a function of position:
# roads are the whole OSM ways, the ground is the bake's own lattice, and it goes into the tile's near grid (5 m cells, `bench: 1`),
# so streets, props, buildings, the car and the terrain mesh all see the same surface. Tiles where it changes the ground by less than
# BENCH_MIN metres keep the plain 10 m grid.
BENCH_KINDS = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary",
               "tertiary_link", "unclassified", "residential", "living_street", "service", "track"}
# Footpaths get the same bench, but only where they cross a steep hillside: draped on the raw ground the old pilgrims' path up Monte Pellegrino (Via al Santuario)
# lay at 60 degrees across its width, like a ribbon on its side. Elsewhere they stay on the plain ground, so the town's pavements do not cut the ground.
BENCH_FOOT = {"footway", "pedestrian"}   # the ones drawn as a surface; a path is only a centreline and does not need it
BENCH_FOOT_CUT = 6.0     # no bench where it would move the ground by more than this: a path over a cliff is not worth a scar on the mountain
BENCH_FOOT_SLOPE = 0.25   # rise across the path per metre above which it gets a bench
BENCH_EASE = 11.0
BENCH_S = 5.0
BENCH_PAD = 7        # lattice nodes (10 m) around the tile that the bench reads
BENCH_MIN = 0.3


BENCH_SIGMA = 9.0    # metres of Gaussian smoothing along the road


def _along(h, step=3.0):
    """Heights sampled every `step` metres along a road, made smooth: running median of 5, then a Gaussian of BENCH_SIGMA."""
    import numpy as np
    n = len(h)
    if n < 3:
        return h
    pad = np.pad(h, 2, mode="edge")
    med = np.median(np.stack([pad[k:k + n] for k in range(5)]), axis=0)
    sig = BENCH_SIGMA / step
    r = int(math.ceil(3 * sig))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sig) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(med, r, mode="edge"), k, mode="valid")


def _bench(i, j, Vp, pa0, pb0):
    """Benched ground on the tile's 5 m grid from the padded 10 m lattice Vp (origin node pa0, pb0), or None when it hardly matters."""
    import numpy as np
    import shapely
    s = NEAR_STEP
    tx0, tz0 = i * T, j * T
    nzp, nxp = Vp.shape

    def B(x, z):
        fx = np.clip((np.asarray(x) / s - pa0), 0, nxp - 1.001)
        fz = np.clip((np.asarray(z) / s - pb0), 0, nzp - 1.001)
        a, b = fx.astype(int), fz.astype(int)
        tx, tz = fx - a, fz - b
        return (Vp[b, a] * (1 - tx) + Vp[b, a + 1] * tx) * (1 - tz) + (Vp[b + 1, a] * (1 - tx) + Vp[b + 1, a + 1] * tx) * tz

    def blur(x, z):
        tot, n = B(x, z), 1
        for r in (20, 45):
            for k in range(8):
                a = k * math.pi / 4
                tot = tot + B(x + math.cos(a) * r, z + math.sin(a) * r)
                n += 1
        return tot / n

    reach_max = 8 / 2 + 1.5 + BENCH_EASE + 4
    win = shapely.box(tx0 - reach_max - 2, tz0 - reach_max - 2, tx0 + T + reach_max + 2, tz0 + T + reach_max + 2)
    n = int(round(T / BENCH_S)) + 1
    GX, GZ = np.meshgrid(tx0 + np.arange(n) * BENCH_S, tz0 + np.arange(n) * BENCH_S)
    W = np.zeros((n, n))
    WH = np.zeros((n, n))
    best = np.full((n, n), 1e9)
    found = False
    for ri in G["road_tree"].query(win):
        rec, ls = G["roads"][ri]
        foot = rec["k"] in BENCH_FOOT
        if (rec["k"] not in BENCH_KINDS and not foot) or rec.get("tn") or rec.get("br"):
            continue
        half = max(rec["w"], 3) / 2
        flat, reach = half + 1.5, half + 1.5 + BENCH_EASE
        m_ = BENCH_PAD * s - 2          # the lattice reaches this far outside the tile; the smoothing needs all of it
        part = ls.intersection(shapely.box(tx0 - m_, tz0 - m_, tx0 + T + m_, tz0 + T + m_))
        for seg in ([part] if part.geom_type == "LineString" else list(getattr(part, "geoms", []))):
            if seg.geom_type != "LineString" or seg.is_empty:
                continue
            seg = shapely.segmentize(seg, 3.0)
            c = np.asarray(seg.coords)[:, :2]
            if len(c) < 2:
                continue
            h = _along(B(c[:, 0], c[:, 1]))
            found = True
            for q in range(len(c) - 1):
                ax, az, bx, bz = c[q, 0], c[q, 1], c[q + 1, 0], c[q + 1, 1]
                dx, dz = bx - ax, bz - az
                l2 = dx * dx + dz * dz or 1.0
                if foot:   # only where it crosses a steep hillside
                    l_ = math.sqrt(l2); nx_, nz_ = -dz / l_ * 4, dx / l_ * 4; mx_, mz_ = (ax + bx) / 2, (az + bz) / 2
                    if abs(float(B(mx_ + nx_, mz_ + nz_)) - float(B(mx_ - nx_, mz_ - nz_))) / 8 < BENCH_FOOT_SLOPE or max(abs(float(B(ax, az)) - h[q]), abs(float(B(ax + nx_ * 0.6, az + nz_ * 0.6)) - h[q]), abs(float(B(ax - nx_ * 0.6, az - nz_ * 0.6)) - h[q])) > BENCH_FOOT_CUT:
                        continue
                i0 = max(0, math.floor((min(ax, bx) - reach - tx0) / BENCH_S))
                i1 = min(n - 1, math.ceil((max(ax, bx) + reach - tx0) / BENCH_S))
                j0 = max(0, math.floor((min(az, bz) - reach - tz0) / BENCH_S))
                j1 = min(n - 1, math.ceil((max(az, bz) + reach - tz0) / BENCH_S))
                if i1 < i0 or j1 < j0:
                    continue
                px, pz = GX[j0:j1 + 1, i0:i1 + 1], GZ[j0:j1 + 1, i0:i1 + 1]
                tt = np.clip(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1)
                d = np.hypot(px - ax - dx * tt, pz - az - dz * tt)
                bsub = best[j0:j1 + 1, i0:i1 + 1]
                ok = (d < reach) & (d < bsub)
                if not ok.any():
                    continue
                e = np.where(d <= flat, 1.0, 1 - _smooth(flat, reach, d))
                bsub[ok] = d[ok]
                W[j0:j1 + 1, i0:i1 + 1][ok] = e[ok]
                WH[j0:j1 + 1, i0:i1 + 1][ok] = (e * (h[q] + (h[q + 1] - h[q]) * tt))[ok]
    if not found:
        return None
    base = B(GX, GZ)
    out = base * (1 - W) + WH
    if np.abs(out - base).max() < BENCH_MIN:
        return None
    return out


def near_for(i, j):
    """Per-tile DTM grid: the lidar where it has data, the TINITALY DEM (lidar-corrected) on the hills, the far grid elsewhere;
    the offset to the far grid fades out over NEAR_BLEND metres beyond the data so the tile joins the coarse terrain without a step.
    Everything is a function of position computed on a padded lattice, so neighbouring tiles agree on their shared border."""
    import cv2
    import numpy as np
    import shapely
    if lr is None or not RASTER_BLOCKS:
        return None
    s = NEAR_STEP
    tx0, tz0 = i * T, j * T
    hills = dem is not None
    pad = NEAR_BLEND + 2 * s
    big = pad + (HILL_BIAS_REACH + 3 * HILL_BIAS_SIGMA if hills else 0)
    if not any((bi, bj) in RASTER_BLOCKS
               for bi in range(math.floor((tx0 - pad) / lr.BLOCK), math.floor((tx0 + T + pad) / lr.BLOCK) + 1)
               for bj in range(math.floor((tz0 - pad) / lr.BLOCK), math.floor((tz0 + T + pad) / lr.BLOCK) + 1)) and not hills:
        return None
    a0, a1 = round((tx0 - big) / s), round((tx0 + T + big) / s)
    b0, b1 = round((tz0 - big) / s), round((tz0 + T + big) / s)
    WX, WZ = np.meshgrid(np.arange(a0, a1 + 1) * s, np.arange(b0, b1 + 1) * s)
    far = G["far_f"]
    farv = far(WX, WZ)
    on_land = shapely.contains_xy(G["land"], WX, WZ)
    cw = _CleanWindow(WX.min() - 4, WZ.min() - 4, WX.max() + 4, WZ.max() + 4)
    L = cw.sample(WX, WZ)
    if hills:
        # the point lattice (tools/lidar_hills.py: exact DTM, from LATTICE_LO metres up) replaces the decoded raster wherever it has
        # answers, since the raster is quantised there; lattice nodes under building footprints are dropped and refilled from their
        # neighbours (the same unreliable DTM under roofs as in clean_dtm)
        Gh = lidar_hills.sample(WX, WZ)
        has_g = np.isfinite(Gh)
        if has_g.any():
            good = has_g & ~cw.footprint_at(WX, WZ)
            gf = good.astype(np.float32)
            sg = 1.5
            den = cv2.GaussianBlur(gf, (0, 0), sg, borderType=cv2.BORDER_REPLICATE)
            fill = cv2.GaussianBlur(np.where(good, Gh, 0).astype(np.float32), (0, 0), sg, borderType=cv2.BORDER_REPLICATE) / np.maximum(den, 1e-3)
            Gh = np.where(good, Gh, np.where(has_g & (den > 0.05), fill, np.nan))
            L = np.where(np.isfinite(Gh), Gh, L)
        N = dem.sample(WX, WZ)
        wt = np.where(np.isfinite(N), 1.0, 0.0)   # TINITALY wherever it has data (t8)
    else:
        N, wt = None, np.zeros_like(farv)
    valid_t = ~np.isnan(L) & on_land            # true lidar height known
    off = np.where(valid_t, L - farv, 0.0)
    valid = valid_t.copy()
    if hills and (wt > 0.01).any():
        has_n = np.isfinite(N) & on_land
        both = valid_t & has_n
        # control points beyond the lidar: the survey's building foot elevations (t8)
        cnum = np.zeros(farv.shape, np.float32)
        cw_ = np.zeros(farv.shape, np.float32)
        P = G.get("ctr")
        if P is not None and len(P):
            sel = (P[:, 0] >= WX.min()) & (P[:, 0] <= WX.max()) & (P[:, 1] >= WZ.min()) & (P[:, 1] <= WZ.max())
            Q = P[sel]
            if len(Q):
                ci = np.clip(np.rint((Q[:, 0] - WX.min()) / s).astype(int), 0, WX.shape[1] - 1)
                cj = np.clip(np.rint((Q[:, 1] - WZ.min()) / s).astype(int), 0, WX.shape[0] - 1)
                Nq = N[cj, ci]
                ok_q = np.isfinite(Nq) & has_n[cj, ci] & ~valid_t[cj, ci]
                np.add.at(cnum, (cj[ok_q], ci[ok_q]), (CTR_WEIGHT * (Q[ok_q, 2] - Nq[ok_q])).astype(np.float32))
                np.add.at(cw_, (cj[ok_q], ci[ok_q]), CTR_WEIGHT)
        ctrl = both | (cw_ > 0)
        if ctrl.any():
            m = both.astype(np.float32) + cw_
            sig = HILL_BIAS_SIGMA / s
            sig_c = CTR_SIGMA / s
            num = cv2.GaussianBlur(np.where(both, L - np.nan_to_num(N), 0.0).astype(np.float32) + cnum, (0, 0), sig_c)
            den = cv2.GaussianBlur(m, (0, 0), sig_c)
            c = np.where(den > 1e-3, num / np.maximum(den, 1e-3), 0.0)
            conf = np.clip(den / 0.1, 0, 1)
            if both.any():   # near the lidar its own, tighter smoothing decides
                numL = cv2.GaussianBlur(np.where(both, L - np.nan_to_num(N), 0.0).astype(np.float32), (0, 0), sig)
                denL = cv2.GaussianBlur(both.astype(np.float32), (0, 0), sig)
                cL = np.where(denL > 1e-3, numL / np.maximum(denL, 1e-3), 0.0)
                wL = np.clip(denL / 0.5, 0, 1)
                c, conf = cL * wL + c * conf * (1 - wL), 1.0
            dist = cv2.distanceTransform((~(valid_t | (cw_ > 0))).astype(np.uint8), cv2.DIST_L2, 5) * s
            reach = np.where(valid_t, HILL_BIAS_REACH, CTR_REACH)
            c = c * conf * (1 - _smooth(0.0, 1.0, dist / np.maximum(reach, 1)))
        else:
            c = np.zeros_like(farv)
        tin_only = (wt > 0.01) & has_n & ~valid_t
        off = np.where(tin_only, wt * (np.nan_to_num(N) + c - farv), off)
        valid |= tin_only
    if not valid.any():
        return None
    # restrict the nearest-valid search to the tile plus the blend distance
    k = int(round((big - pad) / s))
    sl = (slice(k, -k or None), slice(k, -k or None)) if k else (slice(None), slice(None))
    vx, vz, vo = WX[sl][valid[sl]], WZ[sl][valid[sl]], off[sl][valid[sl]]
    if not len(vx):
        return None
    # the tile's own lattice points (inclusive of both borders)
    ia0, ia1 = round(tx0 / s), round((tx0 + T) / s)
    ib0, ib1 = round(tz0 / s), round((tz0 + T) / s)
    P = BENCH_PAD   # lattice nodes beyond the tile, for the road bench (it samples the ground up to 45 m around a road)
    X, Z = np.meshgrid(np.arange(ia0 - P, ia1 + P + 1) * s, np.arange(ib0 - P, ib1 + P + 1) * s)
    qx, qz = X.ravel(), Z.ravel()
    best = np.full(len(qx), np.inf)
    bo = np.zeros(len(qx))
    for a in range(0, len(qx), 500):
        d = (qx[a:a + 500, None] - vx[None, :]) ** 2 + (qz[a:a + 500, None] - vz[None, :]) ** 2
        kk = d.argmin(axis=1)
        best[a:a + 500] = np.sqrt(d[np.arange(len(kk)), kk])
        bo[a:a + 500] = vo[kk]
    t = np.clip(best / NEAR_BLEND, 0, 1)
    fall = 1 - t * t * (3 - 2 * t)
    val = far(qx, qz) + bo * fall
    # the shore: tin_only ground (no lidar) near the sea is not allowed below COAST_FLOOR (distance to the sea measured on the window's land mask)
    coast = cv2.distanceTransform(on_land.astype(np.uint8), cv2.DIST_L2, 5) * s
    ci = np.clip(np.rint(qx / s).astype(int) - a0, 0, WX.shape[1] - 1)
    cj = np.clip(np.rint(qz / s).astype(int) - b0, 0, WX.shape[0] - 1)
    cd = coast[cj, ci]
    lid_q = valid_t[cj, ci]
    val = np.where((~lid_q) & (cd > 0), np.maximum(val, COAST_FLOOR * (1 - _smooth(0.0, COAST_REACH, cd))), val)
    # The land polygon only exists inside the bbox rectangle, so "not land" means sea only there. Outside it (the tiles that
    # straddle the bbox edge) the clamp would drop real ground to -1.5 m while the neighbouring far-grid tile stays at its true
    # height: the 35 m and 248 m steps on 10_6|10_7 and -14_-16|-14_-15. Outside the rectangle the far grid decides, as before.
    rx0, rz0, rx1, rz1 = world_rect()
    # strictly inside: the east edge (x = 8210.0) is a lattice node, and contains_xy is false on the boundary, which clamped a one node trench along it
    in_rect = (qx > rx0) & (qx < rx1) & (qz > rz0) & (qz < rz1)
    land_q = shapely.contains_xy(G["land"], qx, qz) | ~in_rect
    val = np.where(land_q, val, np.minimum(val, -1.5))
    nxp, nzp = ia1 - ia0 + 1 + 2 * P, ib1 - ib0 + 1 + 2 * P
    inner = np.zeros((nzp, nxp), bool)
    inner[P:-P, P:-P] = True
    if best[inner.ravel()].min() > NEAR_BLEND:
        return None
    Vp = val.reshape(nzp, nxp)
    Vp = despike_grid(Vp, s)[0]   # isolated nodes and short fins on the cliffs (tools/despike.py): the padded lattice, so neighbouring tiles agree
    own = Vp[P:-P, P:-P]
    hb = _bench(i, j, Vp, ia0 - P, ib0 - P) if CLEAN_ON else None
    if hb is not None:
        bs = BENCH_S
        return {"x0": ia0 * s, "z0": ib0 * s, "s": bs, "nx": int(round(T / bs)) + 1, "nz": int(round(T / bs)) + 1,
                "h": [round(float(v), 1) for v in hb.ravel()], "bench": 1}
    return {"x0": ia0 * s, "z0": ib0 * s, "s": s, "nx": ia1 - ia0 + 1, "nz": ib1 - ib0 + 1,
            "h": [round(float(v), 1) for v in own.ravel()]}


def far_sea_clamp(far, land, rect):
    """The far grid as the game draws it: inside the baked box, a node off the coastline is sea and goes under the water. The elevation sources read a few metres over the sea
    near the coast, and where a sea cell has no tile nothing hides the far mesh there, so it stood over the water as a flat brown slab (Addaura, tile 1_-15)."""
    import numpy as np
    import shapely
    x0, z0, x1, z1 = rect
    gx, gz = np.meshgrid(far["x0"] + np.arange(far["nx"]) * far["s"], far["z0"] + np.arange(far["nz"]) * far["s"])
    sea = (gx >= x0) & (gx <= x1) & (gz >= z0) & (gz <= z1) & ~shapely.contains_xy(land, gx, gz)
    h = np.array(far["h"], dtype=np.float64).reshape(far["nz"], far["nx"])
    h[sea] = np.minimum(h[sea], -1.5)
    return {**far, "h": [round(float(v), 1) for v in h.ravel()]}

def far_grid(elev, rect):
    """The 100 m grid the game shows beyond the near grids (low detail distance, and before a tile has loaded).
    Terrarium is 4 to 10 m off on the coastal plain (Piazza Mondello read 6 m, the lidar says 1 to 2 m) and 100 to 200 m off on the hills, so
    where better data exists it is used: the lidar (point lattice of tools/lidar_hills.py, else the decoded raster) sampled at the node (a
    3 x 3 box of +-15 m, not a 100 m average: the average smoothed Monte Gallo's wall and Pellegrino's cliffs into ramps), the TINITALY DEM
    on the hills, Terrarium elsewhere. The lidar correction fades out over FAR_FADE nodes beyond the lidar belt."""
    import cv2
    import numpy as np
    x0, z0, x1, z1 = rect
    x0 = math.floor((x0 - FAR_MARGIN) / FAR_STEP) * FAR_STEP
    z0 = math.floor((z0 - FAR_MARGIN) / FAR_STEP) * FAR_STEP
    nx = int((x1 + FAR_MARGIN - x0) / FAR_STEP) + 2
    nz = int((z1 + FAR_MARGIN - z0) / FAR_STEP) + 2
    h = np.array([elev(*unproj(x0 + i * FAR_STEP, z0 + j * FAR_STEP)) for j in range(nz) for i in range(nx)], dtype=np.float64)
    gx, gz = np.meshgrid(x0 + np.arange(nx) * FAR_STEP, z0 + np.arange(nz) * FAR_STEP)
    offs = [(a, b) for a in (-15, 0, 15) for b in (-15, 0, 15)]

    def box(fn):
        v = np.stack([fn(gx + a, gz + b) for a, b in offs])
        n = np.isfinite(v).sum(axis=0)
        return np.where(n >= 5, np.nanmean(np.where(np.isfinite(v), v, np.nan), axis=0), np.nan), v
    if dem is not None:
        tin, _ = box(dem.sample)
        h = np.where(np.isfinite(tin).ravel(), np.nan_to_num(tin).ravel(), h)   # TINITALY everywhere it has data (t8), Terrarium only beyond it
    h = h.reshape(nz, nx)

    if lr is not None and RASTER_BLOCKS:
        _, v = box(lambda x, z: lr.sample_dtm(x, z))
        n = np.isfinite(v).sum(axis=0)
        Lr = np.where(n >= 5, np.nanmedian(np.where(np.isfinite(v), v, np.nan), axis=0), np.nan)
        L = Lr
        if lidar_hills is not None:
            Lg, _ = box(lambda x, z: lidar_hills.sample(x, z))
            L = np.where(np.isfinite(Lg), Lg, Lr)
        land = shapely_contains(G.get("land"), gx, gz) if G.get("land") is not None else np.ones(gx.shape, bool)
        ok = np.isfinite(L) & land
        if ok.any():
            o = np.where(ok, L - h, 0.0).astype(np.float32)
            m = ok.astype(np.float32)
            den = cv2.GaussianBlur(m, (0, 0), 2.0)
            osm = np.where(den > 1e-3, cv2.GaussianBlur(o, (0, 0), 2.0) / np.maximum(den, 1e-3), 0.0)
            dist = cv2.distanceTransform((~ok).astype(np.uint8), cv2.DIST_L2, 5)
            fade = 1 - _smooth(0.0, FAR_FADE, dist)
            h = h + np.where(ok, o, osm * fade)
    if dem is not None and G.get("ctr") is not None and len(G["ctr"]):
        P = G["ctr"]
        fi, fj = (P[:, 0] - x0) / FAR_STEP, (P[:, 1] - z0) / FAR_STEP
        okp = (fi >= 0) & (fi < nx - 1.001) & (fj >= 0) & (fj < nz - 1.001)
        if lr is not None and RASTER_BLOCKS:
            okp &= ~np.isfinite(lr.sample_dtm(P[:, 0], P[:, 1]))     # where the lidar is, it decides
        P, fi, fj = P[okp], fi[okp], fj[okp]
        ii, jj = fi.astype(int), fj.astype(int)
        tx, tz = fi - ii, fj - jj
        hp = h[jj, ii] * (1 - tx) * (1 - tz) + h[jj, ii + 1] * tx * (1 - tz) + h[jj + 1, ii] * (1 - tx) * tz + h[jj + 1, ii + 1] * tx * tz
        num = np.zeros((nz, nx), np.float32)
        wsum = np.zeros((nz, nx), np.float32)
        np.add.at(num, (np.rint(fj).astype(int), np.rint(fi).astype(int)), (P[:, 2] - hp).astype(np.float32))
        np.add.at(wsum, (np.rint(fj).astype(int), np.rint(fi).astype(int)), 1.0)
        sg = CTR_SIGMA * 2 / FAR_STEP
        dn = cv2.GaussianBlur(wsum, (0, 0), sg)
        cc = np.where(dn > 1e-4, cv2.GaussianBlur(num, (0, 0), sg) / np.maximum(dn, 1e-4), 0.0)
        conf = np.clip(dn / 0.35, 0, 1)
        dist = cv2.distanceTransform((wsum == 0).astype(np.uint8), cv2.DIST_L2, 5) * FAR_STEP
        h = h + cc * conf * (1 - _smooth(0.0, CTR_REACH * 2, dist))
    if dem is not None and G.get("land") is not None:
        landn = shapely_contains(G["land"], gx, gz)
        cd = cv2.distanceTransform(landn.astype(np.uint8), cv2.DIST_L2, 5) * FAR_STEP
        lidn = (np.isfinite(L) if (lr is not None and RASTER_BLOCKS) else np.zeros(h.shape, bool))
        h = np.where(landn & ~lidn & (cd > 0) & (cd <= COAST_REACH * 1.5), np.maximum(h, COAST_FLOOR), h)
    return {"x0": x0, "z0": z0, "s": FAR_STEP, "nx": nx, "nz": nz, "h": [round(float(v), 1) for v in h.ravel()]}


def shapely_contains(land, gx, gz):
    import shapely
    return shapely.contains_xy(land, gx, gz)


FAR_FADE = 4.0   # nodes (400 m)


# ----------------------------------------------------------------------------------------------
# Landmarks
# ----------------------------------------------------------------------------------------------
# (display name, regex on the OSM name, optional kinds to look in). First best match wins
# (largest footprint). Missing ones are reported, never guessed.
CURATED = [
    ("Teatro Massimo", r"^Teatro Massimo(?! Bellini)", None),
    ("Teatro Politeama", r"Politeama", None),
    ("Cattedrale di Palermo", r"^Cattedrale|Cattedrale di Palermo|Duomo di Palermo|Cattedrale Metropolitana", None),
    ("Palazzo dei Normanni", r"Palazzo dei Normanni|Palazzo Reale", None),
    ("Stazione Centrale", r"Palermo Centrale|Stazione Centrale", None),
    ("Stadio Renzo Barbera", r"Stadio Renzo Barbera", None),
    ("Parco della Favorita", r"Favorita", {"green", "forest"}),
    ("Mondello", r"Mondello", {"sand"}),
    ("Charleston", r"Charleston", None),   # not in OSM as of the 2026-10 extract
    ("Porto di Palermo", r"^Porto di Palermo$", None),
    ("La Cala", r"^La Cala$", None),
    ("Porto di Mondello", r"^Porto di Mondello$", None),
    ("Castello della Zisa", r"Zisa", None),
    ("Orto Botanico", r"Orto Botanico", None),
    ("Foro Italico", r"Foro Italico", None),
    ("Villa Giulia", r"Villa Giulia", None),
    ("Giardino Inglese", r"Giardino Inglese", None),
    ("Monte Pellegrino", r"^Monte Pellegrino$", None),
    ("Capo Gallo", r"^Capo Gallo$", None),
    ("Ucciardone", r"Ucciardone", None),
    ("Castello a Mare", r"Castello a Mare", None),
    ("Fiera del Mediterraneo", r"Fiera del Mediterraneo", None),
    ("Cappella Palatina", r"Cappella Palatina", None),
    ("Chiesa della Martorana", r"\(La Martorana\)", None),
    ("Palazzo delle Aquile", r"Palazzo delle Aquile|Palazzo Pretorio", None),
    ("Mercato di Ballarò", r"Mercato di Ballar|Mercari do Ballaro", None),
    ("Mercato del Capo", r"Mercato del Capo|Mercari del Capo", None),
    ("Mercato della Vucciria", r"^(La )?Vucciria$", None),
    ("Università di Palermo", r"Universit", None),
    ("Ospedale Civico", r"Ospedale Civico", None),
    ("Ospedale Villa Sofia", r"Villa Sofia", None),
    ("Aeroporto di Boccadifalco", r"Boccadifalco", None),
    ("Catacombe dei Cappuccini", r"Catacombe.*Cappuccini|Cappuccini", None),
]
AUTO_MIN_FOOTPRINT = 2500   # m2: any other named building at least this big becomes a landmark
AUTO_CHURCH_MIN = 700
AUTO_MAX = 500


def landmarks(buildings, area_names, places=()):
    cands = []   # (name, x, z, footprint, kind)
    for b in buildings:
        if b.get("n"):
            outer = b["_g"][0]
            cands.append((b["n"], b["_c"][0], b["_c"][1], abs(area(outer)), "building"))
    for kind, geom, name in area_names:
        if name:
            c = geom.representative_point()
            cands.append((name, c.x, c.y, geom.area, kind))
    cands += list(places)
    out, found, missing, used = [], {}, [], set()
    for disp, rx, kinds in CURATED:
        pat = re.compile(rx, re.I)
        hits = [c for c in cands if pat.search(c[0]) and (kinds is None or c[4] in kinds)]
        if not hits:
            missing.append(disp)
            continue
        best = max(hits, key=lambda c: c[3])
        out.append({"n": disp, "x": round(best[1], 1), "z": round(best[2], 1)})
        found[disp] = best[0]
        used.add(best[0])
    out.insert(0, {"n": "Quattro Canti", "x": 0, "z": 0})
    auto = {}
    for name, x, z, fp, kind in cands:
        if kind != "building" or name in used:
            continue
        if fp >= AUTO_MIN_FOOTPRINT or (fp >= AUTO_CHURCH_MIN and re.search(r"chiesa|basilica|cattedrale|santuario|duomo", name, re.I)):
            if name not in auto or auto[name][2] < fp:
                auto[name] = (x, z, fp)
    for name, (x, z, fp) in sorted(auto.items(), key=lambda kv: -kv[1][2])[:AUTO_MAX]:
        out.append({"n": name, "x": round(x, 1), "z": round(z, 1)})
    return out, found, missing


# ----------------------------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------------------------
def make_valid_list(geoms):
    import shapely
    arr = shapely.make_valid(geoms)
    return list(arr)


def build(offline=False):
    import numpy as np
    import shapely
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union
    t0 = time.time()
    files = fetch_all(offline)
    terra = ensure_terrarium() if not offline else os.path.join(ROOT, "data", "terrarium")
    lidar_path = os.path.join(ROOT, "data", "lidar.json")
    lidar = json.load(open(lidar_path)) if os.path.exists(lidar_path) else None
    rect = world_rect()
    print(f"[{time.time() - t0:.0f}s] parsing OSM", flush=True)

    import colours
    ROOF_RC.update(colours.roof_colours(os.path.join(ROOT, "data", "roof_colours.json")))
    tile_gt = colours.ground_tints(os.path.join(ROOT, "data", "ground_colours.json"))
    print(f"  colours: {len(ROOF_RC)} roof colours, ground tints for {len(tile_gt)} tiles", flush=True)
    buildings, labels, stats = parse_buildings(files["bld"], lidar)
    coast, areas_raw, piers = parse_misc(files["misc"])
    roads, car, ped, plazas = parse_highways(files["hwy"])
    pitems, pareas = parse_props(files["props"])
    places = parse_places(files.get("places", []))
    import structures
    structs = structures.build_structures(STRUCTS, parse_waterways(files.get("wtr", [])), roads, dem)
    import fences as fnc
    fitems = fnc.load_barriers(iter_elements(files.get("bar", [])), os.path.join(ROOT, "data", "walls.json"), proj)
    print(f"  fences: {len(fitems)} barrier lines (OSM {sum(1 for f in fitems if f['src'] == 0)}, CTR {sum(1 for f in fitems if f['src'])})", flush=True)
    tile_struct = {}
    for rec in structs:
        for key in structures.tiles_of(rec, T):
            tile_struct.setdefault(key, []).append(rec)
    print(f"  {len(buildings)} buildings (heights: {stats}), {len(coast)} coast ways, {len(areas_raw)} areas, "
          f"{len(roads)} roads, {len(pitems)} props", flush=True)

    land = build_land(coast, rect)
    print(f"[{time.time() - t0:.0f}s] land {land.area / 1e6:.1f} km2 of {(rect[2] - rect[0]) * (rect[3] - rect[1]) / 1e6:.1f}", flush=True)

    # Assign by centroid to tiles (drop what lies outside the bbox).
    x0, z0, x1, z1 = rect
    tile_of = lambda x, z: (math.floor(x / T), math.floor(z / T))
    inside = lambda x, z: x0 <= x <= x1 and z0 <= z <= z1
    tile_bld, tile_lab, tile_props, tile_pareas = {}, {}, {}, {}
    kept = []
    for b in buildings:
        if inside(*b["_c"]):
            tile_bld.setdefault("%d_%d" % tile_of(*b["_c"]), []).append(b)
            kept.append(b)
    for lb in labels:
        if inside(*lb["_c"]):
            tile_lab.setdefault("%d_%d" % tile_of(*lb["_c"]), []).append(lb)
    for it in pitems:
        if inside(it["x"], it["z"]):
            tile_props.setdefault("%d_%d" % tile_of(it["x"], it["z"]), []).append(it)
    for a in pareas:
        if inside(*a["_c"]):
            tile_pareas.setdefault("%d_%d" % tile_of(*a["_c"]), []).append(a)
    import greenery
    n_crown = greenery.apply_osm_crowns(os.path.join(ROOT, "data", "trees_osm_crowns.json"), tile_props, T)
    tt = greenery.tile_trees(os.path.join(ROOT, "data", "trees.json"), T)
    for key, items in tt.items():
        tile_props.setdefault(key, []).extend(items)
    print(f"  greenery: {sum(len(v) for v in tt.values())} trees in {len(tt)} tiles, {n_crown} OSM trees sized", flush=True)
    import monumental
    monumental.apply(os.path.join(ROOT, "data", "monumental_trees.geojson"), tile_props, T, inside)
    import transit_bake
    for src in (transit_bake.busstop_items(os.path.join(ROOT, "data", "bus_routes.json"), T), transit_bake.fountain_items(os.path.join(ROOT, "data", "fountains.json"), T)):
        for key, items in src.items():
            tile_props.setdefault(key, []).extend(items)
    import tram as trm
    TRAM = trm.Tram() if os.path.exists(trm.PATH) else None
    verges = greenery.load_verges(os.path.join(ROOT, "data", "verges.json"))
    buildings = kept
    # t8: the survey's foot elevations are the ground truth the DEM is pinned to outside the lidar (see CTR_SIGMA)
    ctr_all = [(b["id"], b["_c"][0], b["_c"][1], b["g"]) for b in buildings if b.get("e") and "g" in b]
    hold = [r for r in ctr_all if CTR_HOLDOUT and zlib.crc32(r[0].encode()) % 10 == 0]
    ctr = [r for r in ctr_all if r not in hold] if hold else ctr_all
    G["ctr"] = np.array([(x, z, g) for _, x, z, g in ctr], dtype=np.float64)
    if hold:
        json.dump([{"id": i, "x": x, "z": z, "g": g} for i, x, z, g in hold], open(os.path.join(ROOT, "data", "t8_holdout.json"), "w"))
    print(f"  terrain control: {len(ctr)} survey foot elevations" + (f" ({len(hold)} held out)" if hold else ""), flush=True)

    # Shapely layers for the street computation.
    polys = [Polygon(b["_g"][0], b["_g"][1]) for b in buildings]
    bld_geoms = make_valid_list(polys)
    kind_geoms = {k: [] for k in ("green", "water", "sand", "forest", "pier")}
    area_recs = []
    for kind, geom, name in areas_raw:
        if geom.is_empty:
            continue
        geom = shapely.make_valid(geom) if not geom.is_valid else geom
        area_recs.append((kind, geom, name))
        if kind in kind_geoms:
            kind_geoms[kind].append(geom)
    # board item n4: the CTR's fruit orchards (frutteto, citrus: the Conca d'Oro groves) and olive groves (data/veg_areas.json, docs/sources/ctr-sicilia.md) are land cover too, so the
    # ground reads as a grove and src/props.js plants citrus and olive trees in them. The survey is from 2003 and the city has grown over some: what lies within 8 m of an OSM building goes.
    vp = os.path.join(ROOT, "data", "veg_areas.json")
    if os.path.exists(vp):
        from shapely.geometry import Polygon as _VP
        bt_ = shapely.STRtree(bld_geoms)
        nveg = 0
        for a in json.load(open(vp))["areas"]:
            kd_ = {"orchard": "orchard", "citrus": "orchard", "olive": "olive"}.get(a["c"])
            if not kd_:
                continue
            p_ = a["p"]
            g = _VP([(p_[k], p_[k + 1]) for k in range(0, len(p_), 2)], [[(h[k], h[k + 1]) for k in range(0, len(h), 2)] for h in a.get("holes", [])])
            g = shapely.make_valid(g) if not g.is_valid else g
            hit = bt_.query(g)
            if len(hit):
                g = g.difference(unary_union([bld_geoms[k].buffer(8, quad_segs=2) for k in hit]))
            g = g.simplify(1.5)
            if g.is_empty or g.area < 800:
                continue
            area_recs.append((kd_, g, None))
            nveg += 1
        print(f"  CTR orchards and olive groves: {nveg} areas", flush=True)
    if BEACH_STRIP is not None and not BEACH_STRIP.is_empty:   # the sand the coast was pushed out over (widen_beach)
        kind_geoms["sand"].append(BEACH_STRIP)
        area_recs.append(("sand", BEACH_STRIP, None))
    for pg in plazas:
        area_recs.append(("plaza", pg, None))
    import quays as qy   # the harbour's quay decks (board item n10, tools/quays.py)
    q_decks, q_walls, q_wall_all, q_ext = qy.build(land, piers, kind_geoms["pier"], kind_geoms["sand"], roads)
    for p in q_ext:   # the bands over the water are land for the sea
        area_recs.append(("pier", p, None))
    G["quay_decks"], G["quay_walls"], G["quay_wall_all"] = q_decks, q_walls, q_wall_all
    G["quay_strip"] = unary_union([p for p, h, t, b in q_decks if not t]) if any(not d[2] for d in q_decks) else shapely.Polygon()
    for k in ("forest", "pier"):    # forests are not street surface; piers are drawn by the lead as before
        kind_geoms[k] = []

    def tree(g):
        return shapely.STRtree(g) if g else shapely.STRtree([Polygon()])

    G.update(land=land, bld_geoms=bld_geoms, bld_tree=shapely.STRtree(bld_geoms),
             car_geoms=car, car_tree=tree(car), ped_geoms=ped, ped_tree=tree(ped),
             green_geoms=kind_geoms["green"], green_tree=tree(kind_geoms["green"]),
             water_geoms=kind_geoms["water"], water_tree=tree(kind_geoms["water"]),
             sand_geoms=kind_geoms["sand"], sand_tree=tree(kind_geoms["sand"]),
             roads=roads, road_tree=shapely.STRtree([r[1] for r in roads]),
             pier_geoms=piers, pier_tree=tree(piers),
             areas=[(k, g) for k, g, _ in area_recs], area_tree=tree([g for _, g, _ in area_recs]),
             tile_bld=tile_bld, tile_lab=tile_lab, tile_props=tile_props, tile_pareas=tile_pareas, tile_struct=tile_struct, tram=TRAM, tile_gt=tile_gt, gv_geoms=[g for g, _ in verges], gv_cls=[c for _, c in verges],
             gv_tree=shapely.STRtree([g for g, _ in verges]) if verges else shapely.STRtree([Polygon()]),
             fence_items=fitems, fence_tree=shapely.STRtree([f["g"] for f in fitems]) if fitems else None)

    if RS_ON:
        G["rs"] = load_road_surfaces()
        tun = [ls.buffer(max(rec["w"], 6) / 2 + 6, quad_segs=2) for rec, ls in roads if rec.get("tn")]
        G.update(tunnel_geoms=tun, tunnel_tree=tree(tun))
        cuts = [LineString(zip(r["p"][0::2], r["p"][1::2])).buffer(r["w"] / 2 + 0.6, quad_segs=2) for r in structs if r["k"] == "b" and not r.get("ov")]
        for r in structs:   # a long flyover is lifted only around the roads that pass under it (src/bridges.js): the rest of it takes the road off the ground like any deck
            if r["k"] == "b" and r.get("ov") and r.get("oc") and not r.get("f"):
                ln = LineString(zip(r["p"][0::2], r["p"][1::2]))
                if ln.length > OV_LOCAL:
                    away = ln.difference(shapely.unary_union([ln.interpolate(s).buffer(OV_CLEAR) for s in r["oc"]]))
                    if not away.is_empty:
                        cuts.append(away.buffer(r["w"] / 2 + 0.6, quad_segs=2))
        G.update(cut_geoms=cuts, cut_tree=tree(cuts))
        lanes = [ls.buffer((rec.get("cw") or CARRIAGEWAY.get(rec["k"]) or rec["w"]) / 2 + RS_SLACK, quad_segs=4)
                 for rec, ls in roads if not rec.get("tn") and (rec["k"] in CARRIAGEWAY or rec["k"] == "pedestrian")]
        G.update(lane_geoms=lanes, lane_tree=tree(lanes))
        # roads that have no pavement (board item n6): OSM sidewalk=no, and the residential / service / track / unclassified roads beyond the dense centre
        # (NOKERB_R m from Quattro Canti) that OSM does not say have one: the Comune carriageway beyond the lanes is not a pavement there
        from shapely.geometry import Point
        disc = Point(0, 0).buffer(NOKERB_R)
        bld_tree_n = shapely.STRtree(bld_geoms)
        from shapely.ops import substring
        nko, nkc = [], []
        for rec, ls in roads:
            if rec.get("tn") or rec.get("br") or rec["k"] not in NOKERB_CLASSES:
                continue
            reach = (rec.get("cw") or CARRIAGEWAY.get(rec["k"]) or rec["w"]) / 2 + RS_SLACK + 2.5
            if rec.get("sw") == "n":
                b = D(ls.buffer(reach, quad_segs=3), disc)   # inside the old town the survey's pavements stand (Via Argenteria Vecchia is tagged sidewalk=no and has one)
                if not b.is_empty:
                    nko.append(b)
            elif rec.get("sw") != "y" and rec["k"] in NOKERB_LOCAL:
                # a street with buildings on its frontage keeps the band (the survey's carriageway is the whole street there, pavement included);
                # a street through gardens, fields or a detached-villa suburb does not
                for a in range(0, int(ls.length) + 1, int(NOKERB_CHUNK)):
                    seg = substring(ls, a, min(ls.length, a + NOKERB_CHUNK))
                    if seg.length < 1.0:
                        continue
                    strip = seg.buffer(FRONTAGE_R, cap_style=2)
                    hit = [bld_geoms[k] for k in bld_tree_n.query(strip)]
                    if hit and unary_union(hit).intersection(strip).area / strip.area >= FRONTAGE:
                        continue
                    b = D(seg.buffer(reach, quad_segs=3), disc)
                    if not b.is_empty:
                        nkc.append(b)
        G.update(nko_geoms=nko, nko_tree=tree(nko), nkc_geoms=nkc, nkc_tree=tree(nkc))
        import medians as mdn
        mnarrow, mwide = mdn.build(roads, CARRIAGEWAY)
        G.update(medn_geoms=mnarrow, medn_tree=tree(mnarrow), medw_geoms=mwide, medw_tree=tree(mwide))
        # OSM highway=pedestrian beats the Comune carriageway unless the way is a road in reality: the whole platform near the line is stone
        # paving, no asphalt, no kerbs (the 2016 decree list is incomplete). What decides is the OSM `surface` tag ("whatever is in real life"):
        #   surface=asphalt                        -> asphalt carriageway with kerbs and pavements, as for any road (Via Maqueda: Mapillary 2021 agrees)
        #   paving_stones, sett, stone, cobblestone -> stone paving wall to wall
        #   no surface tag, or another one          -> stone paving (the pedestrian rule), listed separately in the log
        # Ways OSM also tags as a road with traffic (ped_roadlike) and every ordinary OSM road keep their asphalt lanes, so a bus lane or a
        # cross street stays a road inside a stone zone.
        plat_g, plat_t = G["rs"]["platform"]
        pz, keep, asph, az, named = [], [], [], [], {}
        for ls, t, w in PED_STREETS:
            nm, sf = t.get("name", "(unnamed)"), t.get("surface")
            if ped_roadlike(t) or nm in RS_PED_ASPHALT or sf == "asphalt":
                b = ls.buffer(max(w, 6.0) / 2 + 0.5, quad_segs=4)
                keep.append(b)
                asph.append(b)
                reach = ls.buffer(RS_PED_REACH, quad_segs=4)    # the street between the facades: what is not carriageway is pavement
                zone = [plat_g[i] for i in plat_t.query(reach)]
                if zone:
                    az.append(I(unary_union(zone), reach))
                why = "asphalt (road tags)" if ped_roadlike(t) else "asphalt (surface=asphalt)"
                named[(why, nm)] = named.get((why, nm), 0) + ls.length
                continue
            reach = ls.buffer(RS_PED_REACH, quad_segs=4)
            zone = [plat_g[i] for i in plat_t.query(reach)]
            z = I(unary_union(zone), reach) if zone else shapely.Polygon()
            pz.append(unary_union([z, ls.buffer(w / 2, quad_segs=4)]))
            why = "stone (surface=%s)" % sf if sf in PED_STONE else "stone (no surface tag)" if not sf else "stone (surface=%s, rule)" % sf
            named[(why, nm)] = named.get((why, nm), 0) + ls.length
        for rec, ls in roads:
            if not rec.get("tn") and rec["k"] in CARRIAGEWAY:
                keep.append(ls.buffer((rec.get("cw") or CARRIAGEWAY[rec["k"]]) / 2 + 0.5, quad_segs=4))
        G.update(pz_geoms=pz, pz_tree=tree(pz), keep_geoms=keep, keep_tree=tree(keep), asph_geoms=asph, asph_tree=tree(asph), az_geoms=az, az_tree=tree(az))
        G["ped_named"] = named
        for kind in sorted({k for k, _ in named}):
            top = sorted(((m, n) for (k, n), m in named.items() if k == kind), reverse=True)
            print(f"  OSM pedestrian streets drawn as {kind} ({sum(m for m, _ in top) / 1000:.1f} km): "
                  + ", ".join(f"{n} {m:.0f}" for m, n in top if m >= 40), flush=True)
        print(f"[{time.time() - t0:.0f}s] road surfaces: " + ", ".join(f"{k} {len(v[0])}" for k, v in G["rs"].items()) + f", {len(tun)} tunnels", flush=True)

    # Terrain
    elev = load_terrarium(terra)
    far = far_grid(elev, rect)
    G["far_f"] = far_interp(far)
    G["near_for"] = near_for
    shapely.prepare(land)
    print(f"[{time.time() - t0:.0f}s] far terrain {far['nx']}x{far['nz']}", flush=True)

    # Tiles
    os.makedirs(os.path.join(WORLD, "tiles"), exist_ok=True)
    for f in glob.glob(os.path.join(WORLD, "tiles", "*.json")):
        os.remove(f)   # (WORLD is the staging dir with --publish, so the served world/ is never emptied)
    i0, i1 = math.floor(x0 / T), math.floor((x1 - 1e-6) / T)
    j0, j1 = math.floor(z0 / T), math.floor((z1 - 1e-6) / T)
    todo = [(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)
            if not land.disjoint(shapely.box(i * T, j * T, (i + 1) * T, (j + 1) * T))]
    if ONLY:
        todo = [t for t in todo if f"{t[0]}_{t[1]}" in ONLY]
    print(f"[{time.time() - t0:.0f}s] baking {len(todo)} candidate tiles", flush=True)
    results, errors = [], []
    with mp.get_context("fork").Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        for n, r in enumerate(pool.imap_unordered(write_tile, todo, chunksize=2)):
            if r and r[0] == "ERR":
                errors.append(r)
            elif r:
                results.append(r)
            if n % 50 == 0:
                print(f"  {n}/{len(todo)}", flush=True)
    results.sort(key=lambda r: (int(r[0].split("_")[0]), int(r[0].split("_")[1])))

    structures.add_heights(WORLD, structs, G["far_f"], T)
    lm, found, missing = landmarks(buildings, area_recs, [p for p in places if inside(p[1], p[2])])

    polys_land = sorted(polys_of(land), key=lambda p: -p.area)
    land_ring = ring_flat(polys_land[0].simplify(0.3).exterior.coords)
    islands = [ring_flat(p.simplify(0.3).exterior.coords) for p in polys_land[1:] if p.area > 2000]
    manifest = {
        "T": T, "bbox": [round(v, 1) for v in rect],
        "tiles": {r[0]: {"b": r[1], "bytes": r[2]} for r in results},
        "spawn": [0, 0], "landmarks": lm, "far": far_sea_clamp(far, land, rect), "land": land_ring,
        "attribution": ("Map data (c) OpenStreetMap contributors, ODbL. " + LIDAR_CREDIT + ". Far terrain: AWS Terrarium tiles"
                        + (", hills: " + TIN_CREDIT if dem is not None else "")
                        + (". " + CTC_CREDIT if CTC_ON else "") + (". " + RS_CREDIT if RS_ON else "") + (". " + CTR_CREDIT if os.path.exists(CTR_WALLS) else "") + ". " + UA_CREDIT + ". " + VERDE_CREDIT + ". " + TRANSIT_CREDIT + ". " + COLOUR_CREDIT + "."),
        "credits": dict({"osm": "Map data (c) OpenStreetMap contributors, ODbL", "lidar": LIDAR_CREDIT,
                         "terrain": "Mapzen/AWS Terrain Tiles (Terrarium)"},
                        **({"hills": TIN_CREDIT} if dem is not None else {}), **({"buildings": CTC_CREDIT} if CTC_ON else {}),
                        **({"streets": RS_CREDIT} if RS_ON else {}), **({"walls": CTR_CREDIT} if os.path.exists(CTR_WALLS) else {}), **({"monumental": monumental.CREDIT} if os.path.exists(os.path.join(ROOT, "data", "monumental_trees.geojson")) else {}), **{"trees": UA_CREDIT, "green": VERDE_CREDIT, "transit": TRANSIT_CREDIT, "colours": COLOUR_CREDIT}),
    }
    if islands:
        manifest["islands"] = islands
    with open(os.path.join(WORLD, "manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"), ensure_ascii=False)

    total = sum(r[2] for r in results)
    gz = sum(r[3] for r in results)
    print(f"\n{len(results)} tiles, {sum(r[1] for r in results)} buildings, {total / 1e6:.1f} MB raw "
          f"({gz / 1e6:.1f} MB gzip) + manifest {os.path.getsize(os.path.join(WORLD, 'manifest.json')) / 1e3:.0f} KB")
    print("biggest tiles (raw KB, gzip KB, buildings):")
    for r in sorted(results, key=lambda r: -r[2])[:10]:
        print(f"  {r[0]:>8}  {r[2] / 1e3:7.0f}  {r[3] / 1e3:6.0f}  {r[1]:5d}  {r[4]}")
    if errors:
        print("TILE ERRORS:", errors)
    print("landmarks:", len(lm), "| curated found:", len(found), "| missing:", missing)
    print(f"done in {time.time() - t0:.0f}s")


def _terrain_one(ij):
    """Worker of terrain_only: recompute one tile's near grid, patch it into the tile file when it changed (temp file + rename)."""
    i, j = ij
    path = os.path.join(WORLD_LIVE, "tiles", f"{i}_{j}.json")
    try:
        near = G["near_for"](i, j)
        raw = open(path, "rb").read()
        d = json.loads(raw)
        if near == d.get("near"):
            return (f"{i}_{j}", False)
        if near:
            d["near"] = near
        else:
            d.pop("near", None)
        with open(path + ".part", "wb") as f:
            f.write(json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode())
        os.replace(path + ".part", path)
        return (f"{i}_{j}", True)
    except Exception as ex:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        return ("ERR", f"{i}_{j}", repr(ex))


def terrain_only(offline=True):
    """Rebuild only the ground: every tile's `near` grid is recomputed (near_for) and patched into the live tile file, nothing else
    in the tile changes, and the manifest's far grid is rewritten when it changed. Building footprints for the DTM cleaning come from
    the tiles themselves. Tiles written one at a time through a temp name + rename, so the served tree is never half written."""
    import numpy as np
    import shapely
    from shapely.geometry import Polygon
    t0 = time.time()
    files = fetch_all(offline)
    coast, _a, _p = parse_misc(files["misc"])
    rect = world_rect()
    land = build_land(coast, rect)
    print(f"[{time.time() - t0:.0f}s] land {land.area / 1e6:.1f} km2", flush=True)
    names = sorted(f[:-5] for f in os.listdir(os.path.join(WORLD_LIVE, "tiles")) if f.endswith(".json"))
    if ONLY:
        names = [n for n in names if n in ONLY]
    foot, ctr_pts, hold_pts = [], [], []
    for n in sorted(f[:-5] for f in os.listdir(os.path.join(WORLD_LIVE, "tiles")) if f.endswith(".json")):
        for b in json.load(open(os.path.join(WORLD_LIVE, "tiles", n + ".json")))["buildings"]:
            p = b["p"]
            if b.get("e") and "g" in b:
                pt = (sum(p[0::2]) / (len(p) // 2), sum(p[1::2]) / (len(p) // 2), b["g"])
                if CTR_HOLDOUT and zlib.crc32(b["id"].encode()) % 10 == 0:   # same hold-out as build(): every tenth survey point is left out and written to data/t8_holdout.json
                    hold_pts.append((b["id"],) + pt)
                else:
                    ctr_pts.append(pt)
            ring = [(p[k], p[k + 1]) for k in range(0, len(p), 2)]
            if len(ring) >= 3:
                foot.append(Polygon(ring))
    bld = make_valid_list(foot)
    print(f"[{time.time() - t0:.0f}s] {len(bld)} footprints", flush=True)
    elev = load_terrarium(ensure_terrarium() if not offline else os.path.join(ROOT, "data", "terrarium"))
    G["land"] = land
    G["ctr"] = np.array(ctr_pts, dtype=np.float64).reshape(-1, 3)
    if hold_pts:
        json.dump([{"id": i, "x": x, "z": z, "g": g} for i, x, z, g in hold_pts], open(os.path.join(ROOT, "data", "t8_holdout.json"), "w"))
    far = far_grid(elev, rect)
    roads, _car, _ped, _plz = parse_highways(files["hwy"])
    G.update(land=land, bld_geoms=bld, bld_tree=shapely.STRtree(bld), far_f=far_interp(far), near_for=near_for,
             roads=roads, road_tree=shapely.STRtree([r[1] for r in roads]))
    shapely.prepare(land)
    mp_ = os.path.join(WORLD_LIVE, "manifest.json")
    man = json.load(open(mp_))
    far = far_sea_clamp(far, land, rect)
    if man.get("far") != far and not ONLY:
        man["far"] = far
        with open(mp_ + ".part", "w") as f:
            json.dump(man, f, separators=(",", ":"), ensure_ascii=False)
        os.replace(mp_ + ".part", mp_)
        print("manifest far grid updated")
    todo = [tuple(int(v) for v in n.split("_")) for n in names]
    changed, errors = [], []
    with mp.get_context("fork").Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        for n, r in enumerate(pool.imap_unordered(_terrain_one, todo, chunksize=2)):
            if r[0] == "ERR":
                errors.append(r)
            elif r[1]:
                changed.append(r[0])
            if n % 100 == 0:
                print(f"  {n}/{len(todo)}  ({len(changed)} changed)", flush=True)
    print(f"terrain only: {len(changed)} of {len(todo)} tiles changed in {time.time() - t0:.0f}s")
    import structures
    if not ONLY:   # the end heights and the river floors of the bridges and tunnels follow the ground
        recs = {}
        for n in sorted(f[:-5] for f in os.listdir(os.path.join(WORLD_LIVE, "tiles")) if f.endswith(".json")):
            raw = open(os.path.join(WORLD_LIVE, "tiles", n + ".json"), "rb").read()
            if b'"structs"' in raw:
                for r in json.loads(raw).get("structs", []):
                    recs[r["id"]] = r
        structures.add_heights(WORLD_LIVE, list(recs.values()), G["far_f"], T)
    if errors:
        print("TILE ERRORS:", errors)


def publish(stage, dest):
    """Copy only the tiles that differ from `dest` (world/) and then the manifest, each through a temp file + rename so
    a server (or the autopush smoke test) never sees a half-written file. Tiles go first, the manifest last."""
    st, dt = os.path.join(stage, "tiles"), os.path.join(dest, "tiles")
    os.makedirs(dt, exist_ok=True)
    changed, same, removed = [], 0, []
    for f in sorted(os.listdir(st)):
        new = open(os.path.join(st, f), "rb").read()
        p = os.path.join(dt, f)
        if os.path.exists(p) and open(p, "rb").read() == new:
            same += 1
            continue
        with open(p + ".part", "wb") as fh:
            fh.write(new)
        os.replace(p + ".part", p)
        changed.append(f[:-5])
    for f in sorted(os.listdir(dt)):
        if f.endswith(".json") and not os.path.exists(os.path.join(st, f)):
            os.remove(os.path.join(dt, f))
            removed.append(f[:-5])
    mp = os.path.join(dest, "manifest.json")
    raw = open(os.path.join(stage, "manifest.json"), "rb").read()
    if not os.path.exists(mp) or open(mp, "rb").read() != raw:
        with open(mp + ".part", "wb") as fh:
            fh.write(raw)
        os.replace(mp + ".part", mp)
    print(f"published: {len(changed)} tiles changed, {same} identical, {len(removed)} removed; manifest updated")
    print("changed tiles:", " ".join(changed))
    return changed


if __name__ == "__main__":
    USE_PBF = "--overpass" not in sys.argv
    # --out DIR bakes into DIR instead of world/. --publish bakes into data/world_stage and then copies only the tiles
    # that changed (plus the manifest) into world/ atomically, for rebakes while the game is being served.
    if "--out" in sys.argv:
        WORLD = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])
    PUBLISH = "--publish" in sys.argv
    if "--publish-from" in sys.argv:   # publish an already baked staging dir without baking again
        publish(os.path.abspath(sys.argv[sys.argv.index("--publish-from") + 1]), os.path.join(ROOT, "world"))
        sys.exit(0)
    if "--tiles" in sys.argv:
        ONLY = set(sys.argv[sys.argv.index("--tiles") + 1].split(","))
        if PUBLISH:
            raise SystemExit("--tiles is for debugging with --out, not with --publish")
    if PUBLISH:
        WORLD_LIVE, WORLD = WORLD, os.path.join(ROOT, "data", "world_stage")
    if "--terrain-only" in sys.argv:   # only the ground: patch every live tile's near grid (and the far grid), see terrain_only()
        WORLD_LIVE = WORLD if "--out" in sys.argv else os.path.join(ROOT, "world")
        USE_PBF = True
        PARTIAL = False
        terrain_only()
    elif "--fetch-only" in sys.argv:
        fetch_all()
        ensure_terrarium()
        print("fetch done")
    else:
        PARTIAL = "--partial" in sys.argv
        USE_PBF = "--overpass" not in sys.argv
        build(offline="--offline" in sys.argv or PARTIAL)
        if PUBLISH:
            publish(WORLD, WORLD_LIVE)
