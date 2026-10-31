"""Bake the whole-city world tiles (see docs/TILES.md).

One command regenerates world/manifest.json and world/tiles/*.json:

    tools/.venv/bin/python tools/tiles.py              fetch (cached), then bake
    tools/.venv/bin/python tools/tiles.py --fetch-only only download into data/city/
    tools/.venv/bin/python tools/tiles.py --offline    bake from the cache, never touch the network

Raw Overpass answers are cached per sub-box in data/city/ (delete a file to refetch it).
Sources: OpenStreetMap contributors (ODbL), Regione Sicilia lidar via data/lidar.json (CC BY 4.0),
AWS Terrarium tiles for the far terrain.
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

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
from bake import (KX, KZ, LAT0, LON0, area, building_height, flat, hash01, lidar_shape,  # noqa: E402
                  load_terrarium, stitch, unproj)

CITY = os.path.join(ROOT, "data", "city")
WORLD = os.path.join(ROOT, "world")
T = 500
BBOX_LL = (38.065, 13.285, 38.225, 13.420)  # s, w, n, e (docs/TILES.md)
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
            "tertiary|tertiary_link|unclassified|residential|living_street|service|pedestrian|footway|path|cycleway")


def query_for(cat, b):
    bb = f"{b[0]:.5f},{b[1]:.5f},{b[2]:.5f},{b[3]:.5f}"
    head = "[out:json][timeout:300][maxsize:1073741824];\n"
    if cat == "bld":
        body = f'(way["building"]({bb});relation["building"]({bb}););'
    elif cat == "hwy":
        body = f'way["highway"~"^({HIGHWAYS})$"]({bb});'
    elif cat == "misc":
        body = (f'way["natural"="coastline"]({bb});'
                f'way["leisure"~"^(park|garden)$"]({bb});relation["leisure"~"^(park|garden)$"]({bb});'
                f'way["landuse"~"^(grass|forest|village_green|meadow)$"]({bb});'
                f'relation["landuse"~"^(grass|forest|village_green|meadow)$"]({bb});'
                f'way["natural"~"^(wood|beach|water)$"]({bb});relation["natural"~"^(wood|beach|water)$"]({bb});'
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


def _way_cats(t):
    """Overpass-equivalent category membership of a way's tags."""
    cats = []
    if "building" in t:
        cats.append("bld")
    if t.get("highway") in _HW_SET:
        cats.append("hwy")
    if (t.get("natural") in ("coastline", "wood", "beach", "water") or t.get("leisure") in ("park", "garden")
            or t.get("landuse") in ("grass", "forest", "village_green", "meadow")
            or t.get("man_made") in ("pier", "breakwater")):
        cats.append("misc")
    a = t.get("amenity")
    if (t.get("natural") == "tree_row" or a in ("parking", "fountain", "marketplace", "bicycle_parking",
                                                   "motorcycle_parking")):
        cats.append("props")
    return cats


def _rel_cats(t):
    cats = []
    if "building" in t:
        cats.append("bld")
    if (t.get("natural") in ("wood", "beach", "water") or t.get("leisure") in ("park", "garden")
            or t.get("landuse") in ("grass", "forest", "village_green", "meadow")):
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
        if not (t.get("building") or t.get("natural") or t.get("leisure") or t.get("landuse")):
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
    props = []
    for o in osmium.FileProcessor(PBF, osmium.osm.NODE):
        if not o.location.valid():
            continue
        lat, lon = o.location.lat, o.location.lon
        if s <= lat <= n and w <= lon <= e:
            loc[o.id] = (lat, lon)
            if len(o.tags) and _node_is_prop(tags_of(o)):
                props.append({"type": "node", "id": o.id, "lat": lat, "lon": lon, "tags": tags_of(o)})
    log(f"{len(loc)} nodes in the box, {len(props)} furniture nodes")

    # pass 3: ways
    out = {"bld": [], "hwy": [], "misc": [], "props": props}
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
    cats = ("misc", "hwy", "bld", "props")
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
    "cycleway": 2,
}
CARRIAGEWAY = {  # drivable asphalt widths when OSM has no width/lanes (streets.py values plus big roads)
    "motorway": 8, "motorway_link": 4.5, "trunk": 9, "trunk_link": 4.5, "primary": 10, "primary_link": 4.5,
    "secondary": 9, "secondary_link": 4.5, "tertiary": 8, "tertiary_link": 4.5, "unclassified": 6,
    "residential": 5.5, "living_street": 4.5, "service": 3.5,
}
PEDESTRIAN = {"pedestrian": 7, "footway": 2.5}   # cycleway/path stay centreline-only, as before
URBAN_REACH = 24.0   # ground within this distance of a building and not road/green/... is raised pavement
MARGIN = 30.0        # metres computed beyond each tile so street polygons line up across borders
CHUNK = T / 8        # street polygons are cut into 62.5 m cells (drape over terrain, cull well)
DENSIFY = 8
FAR_STEP = 100
FAR_MARGIN = 3000
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


def parse_buildings(files, lidar):
    """Same records as bake.py. Returns (buildings, labels) where each is a list of dicts with
    the tile-independent payload plus '_c' (centroid) and '_geom' (outer, holes) for streets."""
    from shapely.geometry import Polygon  # noqa: F401
    out, labels = [], []
    stats = {"raster": 0, "lidar_json": 0, "estimate": 0, "split": 0, "towers": 0}

    def add(key, oid, tags, outer, holes):
        if len(outer) < 3:
            return
        fp = abs(area(outer))
        if fp < 4:
            return
        h = building_height(oid, tags, fp)
        kind = tags.get("building", "yes")
        b = {"id": key, "h": round(h, 1), "c": int(hash01(oid + 7) * 1000), "p": flat(outer)}
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
    return out, labels, stats


def parse_misc(files):
    """Coastline segments, area polygons by kind, pier lines."""
    from shapely.geometry import LineString, Polygon
    coast, areas, piers = [], [], []

    def kind_of(t):
        if t.get("natural") == "beach":
            return "sand"
        if t.get("natural") == "water":
            return "water"
        if t.get("landuse") in ("forest",) or t.get("natural") == "wood":
            return "forest"
        if t.get("leisure") in ("park", "garden") or t.get("landuse") in ("grass", "village_green", "meadow"):
            return "green"
        return None

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


def parse_highways(files):
    from shapely.geometry import LineString, Polygon
    from streets import width_of
    roads, car, ped, plazas = [], [], [], []
    for e in iter_elements(files):
        t = e.get("tags") or {}
        hw = t.get("highway")
        if e["type"] != "way" or not e.get("geometry") or hw not in ROAD_WIDTH:
            continue
        pts = way_pts(e)
        if len(pts) < 2:
            continue
        closed = is_closed(e)
        tunnel = t.get("tunnel") in ("yes", "culvert", "building_passage") or t.get("covered") == "yes"
        if hw == "pedestrian" and closed and t.get("area") == "yes":
            pg = Polygon(pts).buffer(0)
            plazas.append(pg)
            ped.append(pg)
            continue
        r = {"w": ROAD_WIDTH[hw], "k": hw}
        if t.get("name"):
            r["n"] = t["name"]
        if tunnel:
            r["tn"] = 1
        elif t.get("bridge") in ("yes", "viaduct", "movable"):
            r["br"] = 1
        roads.append((r, LineString(pts)))
        if tunnel:
            continue
        if hw in CARRIAGEWAY:
            car.append(LineString(pts).buffer(width_of(t, CARRIAGEWAY[hw]) / 2, quad_segs=4))
        elif hw in PEDESTRIAN:
            ped.append(LineString(pts).buffer(width_of(t, PEDESTRIAN[hw]) / 2, quad_segs=4))
    return roads, car, ped, plazas


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
    return unary_union(land).buffer(0)


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
    touch = unary_union([raised, green]).buffer(0.3)
    if not asphalt.is_empty and not touch.is_empty:
        for p in polys_of(shapely.orient_polygons(asphalt)):
            for ring in [p.exterior] + list(p.interiors):
                seg = LineString(ring.coords).intersection(touch).intersection(tile)
                for g in ([seg] if isinstance(seg, LineString) else getattr(seg, "geoms", [])):
                    if isinstance(g, LineString) and g.length > 0.5:
                        g = shapely.segmentize(g, DENSIFY)
                        curbs.append([round(c, 1) for pt in g.coords for c in pt[:2]])

    out = {"aoi": empty["aoi"]}
    for name, geom in (("asphalt", asphalt), ("paving", paving), ("raised", raised), ("green", green),
                       ("water", water), ("sand", sand)):
        g = I(geom, tile)
        out[name] = chunked(g, tx0, tz0) if not g.is_empty else []
    out["curbs"] = curbs
    return {k: out[k] for k in ("asphalt", "paving", "raised", "green", "water", "sand", "curbs", "aoi")}


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
    has_streets = any(st[k] for k in ("asphalt", "paving", "raised", "green", "water", "sand", "curbs"))
    near = G["near_for"](i, j)
    if not (blds or roads or areas or pitems or pareas or labels or has_streets or near):
        return None
    out = {"buildings": blds, "roads": roads, "streets": st, "areas": areas, "labels": labels,
           "props": {"items": pitems, "areas": pareas, "counts": counts}}
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


def near_for(i, j):
    """Per-tile DTM grid: the lidar raster where it has data, the far grid elsewhere, the offset between the
    two fading out over NEAR_BLEND metres so the tile joins the coarse terrain without a step."""
    import numpy as np
    import shapely
    if lr is None or not RASTER_BLOCKS:
        return None
    s = NEAR_STEP
    tx0, tz0 = i * T, j * T
    pad = NEAR_BLEND + 2 * s
    if not any((bi, bj) in RASTER_BLOCKS
               for bi in range(math.floor((tx0 - pad) / lr.BLOCK), math.floor((tx0 + T + pad) / lr.BLOCK) + 1)
               for bj in range(math.floor((tz0 - pad) / lr.BLOCK), math.floor((tz0 + T + pad) / lr.BLOCK) + 1)):
        return None
    a0, a1 = round((tx0 - pad) / s), round((tx0 + T + pad) / s)
    b0, b1 = round((tz0 - pad) / s), round((tz0 + T + pad) / s)
    WX, WZ = np.meshgrid(np.arange(a0, a1 + 1) * s, np.arange(b0, b1 + 1) * s)
    dtm = lr.sample_dtm(WX, WZ, "bilinear")
    on_land = shapely.contains_xy(G["land"], WX, WZ)
    valid = ~np.isnan(dtm) & on_land
    if not valid.any():
        return None
    far = G["far_f"]
    off = np.where(valid, dtm - far(WX, WZ), 0.0)
    vx, vz, vo = WX[valid], WZ[valid], off[valid]
    # the tile's own lattice points (inclusive of both borders)
    ia0, ia1 = round(tx0 / s), round((tx0 + T) / s)
    ib0, ib1 = round(tz0 / s), round((tz0 + T) / s)
    X, Z = np.meshgrid(np.arange(ia0, ia1 + 1) * s, np.arange(ib0, ib1 + 1) * s)
    qx, qz = X.ravel(), Z.ravel()
    best = np.full(len(qx), np.inf)
    bo = np.zeros(len(qx))
    for a in range(0, len(qx), 500):
        d = (qx[a:a + 500, None] - vx[None, :]) ** 2 + (qz[a:a + 500, None] - vz[None, :]) ** 2
        k = d.argmin(axis=1)
        best[a:a + 500] = np.sqrt(d[np.arange(len(k)), k])
        bo[a:a + 500] = vo[k]
    t = np.clip(best / NEAR_BLEND, 0, 1)
    fall = 1 - t * t * (3 - 2 * t)
    val = far(qx, qz) + bo * fall
    land_q = shapely.contains_xy(G["land"], qx, qz)
    val = np.where(land_q, val, np.minimum(val, -1.5))
    if best.min() > NEAR_BLEND:
        return None
    return {"x0": ia0 * s, "z0": ib0 * s, "s": s, "nx": ia1 - ia0 + 1, "nz": ib1 - ib0 + 1,
            "h": [round(float(v), 1) for v in val]}


def far_grid(elev, rect):
    x0, z0, x1, z1 = rect
    x0 = math.floor((x0 - FAR_MARGIN) / FAR_STEP) * FAR_STEP
    z0 = math.floor((z0 - FAR_MARGIN) / FAR_STEP) * FAR_STEP
    nx = int((x1 + FAR_MARGIN - x0) / FAR_STEP) + 2
    nz = int((z1 + FAR_MARGIN - z0) / FAR_STEP) + 2
    h = [round(elev(*unproj(x0 + i * FAR_STEP, z0 + j * FAR_STEP))) for j in range(nz) for i in range(nx)]
    return {"x0": x0, "z0": z0, "s": FAR_STEP, "nx": nx, "nz": nz, "h": h}


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
    ("Stadio Renzo Barbera", r"Barbera|Stadio Renzo", None),
    ("Parco della Favorita", r"Favorita", {"green", "forest"}),
    ("Mondello", r"Mondello", {"sand"}),
    ("Charleston", r"Charleston", None),
    ("Porto di Palermo", r"^Porto di Palermo|Porto$|^La Cala|Cala$", None),
    ("Castello della Zisa", r"Zisa", None),
    ("Orto Botanico", r"Orto Botanico", None),
    ("Foro Italico", r"Foro Italico", None),
    ("Villa Giulia", r"Villa Giulia", None),
    ("Giardino Inglese", r"Giardino Inglese", None),
    ("Monte Pellegrino", r"Pellegrino|Santa Rosalia", None),
    ("Capo Gallo", r"Capo Gallo", None),
    ("Cala", r"^La Cala$|^Cala$", None),
    ("Ucciardone", r"Ucciardone", None),
    ("Castello a Mare", r"Castello a Mare", None),
    ("Fiera del Mediterraneo", r"Fiera del Mediterraneo", None),
    ("Cappella Palatina", r"Cappella Palatina", None),
    ("Chiesa della Martorana", r"Martorana|Santa Maria dell'Ammiraglio", None),
    ("Palazzo delle Aquile", r"Palazzo delle Aquile|Palazzo Pretorio", None),
    ("Mercato di Ballarò", r"Ballar", None),
    ("Mercato del Capo", r"Mercato del Capo", None),
    ("Mercato della Vucciria", r"Vucciria", None),
    ("Università di Palermo", r"Universit", None),
    ("Ospedale Civico", r"Ospedale Civico", None),
    ("Ospedale Villa Sofia", r"Villa Sofia", None),
    ("Aeroporto di Boccadifalco", r"Boccadifalco", None),
    ("Catacombe dei Cappuccini", r"Catacombe.*Cappuccini|Cappuccini", None),
]
AUTO_MIN_FOOTPRINT = 2500   # m2: any other named building at least this big becomes a landmark
AUTO_CHURCH_MIN = 700
AUTO_MAX = 500


def landmarks(buildings, area_names):
    cands = []   # (name, x, z, footprint, kind)
    for b in buildings:
        if b.get("n"):
            outer = b["_g"][0]
            cands.append((b["n"], b["_c"][0], b["_c"][1], abs(area(outer)), "building"))
    for kind, geom, name in area_names:
        if name:
            c = geom.representative_point()
            cands.append((name, c.x, c.y, geom.area, kind))
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
    import shapely
    from shapely.geometry import LineString, Polygon
    t0 = time.time()
    files = fetch_all(offline)
    terra = ensure_terrarium() if not offline else os.path.join(ROOT, "data", "terrarium")
    lidar_path = os.path.join(ROOT, "data", "lidar.json")
    lidar = json.load(open(lidar_path)) if os.path.exists(lidar_path) else None
    rect = world_rect()
    print(f"[{time.time() - t0:.0f}s] parsing OSM", flush=True)

    buildings, labels, stats = parse_buildings(files["bld"], lidar)
    coast, areas_raw, piers = parse_misc(files["misc"])
    roads, car, ped, plazas = parse_highways(files["hwy"])
    pitems, pareas = parse_props(files["props"])
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
    buildings = kept

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
    for pg in plazas:
        area_recs.append(("plaza", pg, None))
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
             tile_bld=tile_bld, tile_lab=tile_lab, tile_props=tile_props, tile_pareas=tile_pareas)

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
        os.remove(f)
    i0, i1 = math.floor(x0 / T), math.floor((x1 - 1e-6) / T)
    j0, j1 = math.floor(z0 / T), math.floor((z1 - 1e-6) / T)
    todo = [(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)
            if not land.disjoint(shapely.box(i * T, j * T, (i + 1) * T, (j + 1) * T))]
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

    lm, found, missing = landmarks(buildings, area_recs)

    polys_land = sorted(polys_of(land), key=lambda p: -p.area)
    land_ring = ring_flat(polys_land[0].simplify(0.3).exterior.coords)
    islands = [ring_flat(p.simplify(0.3).exterior.coords) for p in polys_land[1:] if p.area > 2000]
    manifest = {
        "T": T, "bbox": [round(v, 1) for v in rect],
        "tiles": {r[0]: {"b": r[1], "bytes": r[2]} for r in results},
        "spawn": [0, 0], "landmarks": lm, "far": far, "land": land_ring,
        "attribution": "Map data (c) OpenStreetMap contributors, ODbL. " + LIDAR_CREDIT + ". Far terrain: AWS Terrarium tiles.",
        "credits": {"osm": "Map data (c) OpenStreetMap contributors, ODbL", "lidar": LIDAR_CREDIT,
                    "terrain": "Mapzen/AWS Terrain Tiles (Terrarium)"},
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


if __name__ == "__main__":
    USE_PBF = "--overpass" not in sys.argv
    if "--fetch-only" in sys.argv:
        fetch_all()
        ensure_terrarium()
        print("fetch done")
    else:
        PARTIAL = "--partial" in sys.argv
        USE_PBF = "--overpass" not in sys.argv
        build(offline="--offline" in sys.argv or PARTIAL)
