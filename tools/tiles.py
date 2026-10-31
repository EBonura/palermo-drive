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
        with gzip.open(f, "rb") as fh:
            els = json.load(fh)["elements"]
        for e in els:
            k = (e["type"], e["id"])
            if k in seen:
                continue
            seen.add(k)
            yield e
        del els


def fetch_all(offline=False):
    os.makedirs(CITY, exist_ok=True)
    return {cat: cache_files(cat, offline) for cat in ("misc", "hwy", "bld", "props")}


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
NEAR_NONE = None


def way_pts(e):
    return [proj(g["lat"], g["lon"]) for g in e["geometry"]]


def is_closed(e):
    n = e.get("nodes") or []
    return len(n) > 3 and n[0] == n[-1]


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


def parse_buildings(files, lidar):
    """Same records as bake.py. Returns (buildings, labels) where each is a list of dicts with
    the tile-independent payload plus '_c' (centroid) and '_geom' (outer, holes) for streets."""
    from shapely.geometry import Polygon  # noqa: F401
    out, labels = [], []
    stats = {"lidar": 0, "split": 0, "towers": 0}

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
        shape = lidar_shape(lidar["b"].get(key), outer, holes) if lidar else None
        if shape:
            roof, parts, split, ground = shape
            b["r"] = round(roof, 1)
            b["g"] = round(ground, 1)
            stats["lidar"] += 1
            if parts:
                b["parts"] = parts
                stats["split" if split else "towers"] += 1
                if split:
                    b["split"] = 1
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
            piece = unary_union([h.intersection(cell) for h in hits])
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


def streets_for_tile(tx0, tz0):
    import shapely
    from shapely.geometry import LineString, box
    from shapely.ops import unary_union
    tile = box(tx0, tz0, tx0 + T, tz0 + T)
    R = box(tx0 - MARGIN, tz0 - MARGIN, tx0 + T + MARGIN, tz0 + T + MARGIN)
    empty = {"asphalt": [], "paving": [], "raised": [], "green": [], "water": [], "sand": [], "curbs": [],
             "aoi": [tx0, tz0, tx0 + T, tz0 + T]}
    land = G["land"].intersection(R)
    if land.is_empty:
        return empty
    bl = unary_union(query_geoms(G["bld_tree"], G["bld_geoms"], R))
    space = land.difference(bl) if not bl.is_empty else land

    def layer(tree, geoms):
        hits = query_geoms(tree, geoms, R)
        return unary_union([h.intersection(R) for h in hits]) if hits else shapely.Polygon()

    car = layer(G["car_tree"], G["car_geoms"])
    ped = layer(G["ped_tree"], G["ped_geoms"])
    asphalt = car.intersection(space)
    paving = ped.intersection(space).difference(asphalt)
    water = layer(G["water_tree"], G["water_geoms"]).intersection(space).difference(asphalt)
    sand = layer(G["sand_tree"], G["sand_geoms"]).intersection(space).difference(asphalt).difference(paving).difference(water)
    green = (layer(G["green_tree"], G["green_geoms"]).intersection(space).difference(asphalt)
             .difference(paving).difference(water).difference(sand))
    if bl.is_empty:
        raised = shapely.Polygon()
    else:
        zone = bl.buffer(URBAN_REACH, quad_segs=2)
        raised = (space.intersection(zone).difference(asphalt).difference(paving).difference(green)
                  .difference(water).difference(sand))
        raised = raised.buffer(-0.15).buffer(0.15)

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
        g = geom.intersection(tile) if not geom.is_empty else geom
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
    landt = G["land"].intersection(tile)
    for ai in G["area_tree"].query(tile):
        kind, geom = G["areas"][ai]
        g = geom.intersection(tile)
        if kind != "pier":
            g = g.intersection(landt)
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
def build_near(lidar, elev, land):
    """Global lidar DTM grid (same construction as bake.near_terrain, faster land test)."""
    import shapely
    x0, z0, step = lidar["tgrid"]
    margin = 10
    t = {tuple(map(int, k.split(","))): v for k, v in lidar["t"].items() if isinstance(v, (int, float))}
    if not t:
        return None
    ni = max(i for i, _ in t) + 1
    nj = max(j for _, j in t) + 1
    nx, nz = ni + 2 * margin, nj + 2 * margin
    h = []
    for J in range(-margin, nj + margin):
        for I in range(-margin, ni + margin):
            x, z = x0 + I * step, z0 + J * step
            if not shapely.contains_xy(land, x, z):
                h.append(round(min(elev(*unproj(x, z)), -1.5), 1))
                continue
            if (I, J) in t:
                h.append(round(t[(I, J)], 1))
                continue
            acc = wsum = 0.0
            for dj in range(-4, 5):
                for di in range(-4, 5):
                    v = t.get((I + di, J + dj))
                    if v is not None:
                        w = 1 / (di * di + dj * dj)
                        acc += v * w
                        wsum += w
            h.append(round(acc / wsum if wsum else max(0.5, elev(*unproj(x, z))), 1))
    return {"x0": x0 - margin * step, "z0": z0 - margin * step, "s": step, "nx": nx, "nz": nz, "h": h}


def make_near_for(g):
    if not g:
        return lambda i, j: None
    s = g["s"]

    def near_for(i, j):
        tx0, tz0 = i * T, j * T
        i0 = max(0, math.floor((tx0 - g["x0"]) / s))
        i1 = min(g["nx"] - 1, math.ceil((tx0 + T - g["x0"]) / s))
        j0 = max(0, math.floor((tz0 - g["z0"]) / s))
        j1 = min(g["nz"] - 1, math.ceil((tz0 + T - g["z0"]) / s))
        if i0 > i1 or j0 > j1:
            return None
        return {"x0": round(g["x0"] + i0 * s, 1), "z0": round(g["z0"] + j0 * s, 1), "s": s,
                "nx": i1 - i0 + 1, "nz": j1 - j0 + 1,
                "h": [g["h"][J * g["nx"] + I] for J in range(j0, j1 + 1) for I in range(i0, i1 + 1)]}
    return near_for


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
    print(f"  {len(buildings)} buildings ({stats}), {len(coast)} coast ways, {len(areas_raw)} areas, "
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
    near = build_near(lidar, elev, land) if lidar else None
    G["near_for"] = make_near_for(near)
    far = far_grid(elev, rect)
    print(f"[{time.time() - t0:.0f}s] terrain done: near={'yes' if near else 'no'} far {far['nx']}x{far['nz']}", flush=True)

    # Tiles
    os.makedirs(os.path.join(WORLD, "tiles"), exist_ok=True)
    for f in glob.glob(os.path.join(WORLD, "tiles", "*.json")):
        os.remove(f)
    i0, i1 = math.floor(x0 / T), math.floor((x1 - 1e-6) / T)
    j0, j1 = math.floor(z0 / T), math.floor((z1 - 1e-6) / T)
    todo = [(i, j) for i in range(i0, i1 + 1) for j in range(j0, j1 + 1)
            if not land.disjoint(shapely.box(i * T, j * T, (i + 1) * T, (j + 1) * T))]
    print(f"[{time.time() - t0:.0f}s] baking {len(todo)} candidate tiles", flush=True)
    results = []
    with mp.get_context("fork").Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        for n, r in enumerate(pool.imap_unordered(write_tile, todo, chunksize=2)):
            if r:
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
        "attribution": "Map data (c) OpenStreetMap contributors, ODbL; lidar Regione Sicilia / MASE CC BY 4.0; terrain AWS Terrarium",
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
    print("landmarks:", len(lm), "| curated found:", len(found), "| missing:", missing)
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    if "--fetch-only" in sys.argv:
        fetch_all()
        ensure_terrarium()
        print("fetch done")
    else:
        build(offline="--offline" in sys.argv)
