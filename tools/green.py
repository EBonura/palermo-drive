"""Trees, tree rows, planted verges/medians and garden walls for the whole city, from open data (phase 1: datasets only).

Reads the downloads made by tools/green_fetch.py (each source in its own folder, passed as arguments), the baked world tiles
(buildings, roads, OSM trees, forest areas; read only) and the lidar rasters of tools/lidar_raster.py, and writes (all in game metres,
x east, z south of Quattro Canti, the projection of tools/bake.py):

  data/trees.json             NEW trees only (OSM trees are not repeated): lidar crowns, CTR points, Urban Atlas canopy lattice
  data/trees_osm_crowns.json  lidar crown radius and height found for existing OSM trees, keyed by their x, z
  data/tree_rows.json         CTR tree rows and rows detected in the tree points (street rows), OSM rows removed
  data/verges.json            Comune di Palermo "aiuola" polygons classified: median, verge, island, flowerbed, tree_bed
  data/walls.json             CTR walls, fences, hedges, retaining and dry-stone walls, with a street-facing flag
  data/veg_areas.json         CTR vegetation areas (olive grove, orchard, citrus, scrub/wood, park) for species hints
  data/green/stats.json       every number quoted in docs/sources/*.md

    tools/.venv/bin/python -I tools/green.py build --ctr DIR --ua DIR --verde DIR [--refresh-world]
    tools/.venv/bin/python -I tools/green.py qc                       print the quality tables
    tools/.venv/bin/python -I tools/green.py overlay NAME OUT.png     top-down check image (names: see BLOCKS)
    tools/.venv/bin/python -I tools/green.py overlay x,z,half OUT.png

Sources: Regione Siciliana CTR 1:10,000 (CC BY 4.0), Comune di Palermo Area Verde (CC BY 4.0), Copernicus Urban Atlas Street Tree
Layer 2018, MASE PST-A lidar (CC BY 4.0), OpenStreetMap (ODbL, already in the world tiles). See docs/sources/.
"""
import argparse
import glob
import json
import math
import os
import pickle
import sys
import time

import cv2
import numpy as np
import shapefile
import shapely
from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lidar_raster as lr  # noqa: E402
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
GREEN = os.path.join(DATA, "green")
TILES = os.path.join(ROOT, "world", "tiles")
BBOX_LL = (38.045, 13.235, 38.230, 13.455)  # s, w, n, e, same as tools/tiles.py

T25833 = Transformer.from_crs(25833, 4326, always_xy=True)
T3004 = Transformer.from_crs(3004, 4326, always_xy=True)

# ---- tuning (all distances in metres)
DUP_OSM = 4.0          # a new tree this close to an OSM tree is the same tree
DUP_NEW = 3.5          # two new trees closer than this are one
CTR_LIDAR = 5.0        # CTR point and lidar crown top that count as the same tree (CTR 1:10,000 is good to a few metres)
UA_SPACING = 7.5       # hex lattice spacing used to turn a Urban Atlas canopy polygon into trees (about 49 m2 per tree)
UA_EDGE = 1.5          # lattice points stay this far inside the canopy polygon
UA_NEAR = 60.0         # canopy polygons farther than this from any building or road are countryside and skipped
UA_MAX_AREA = 150000   # canopy polygons larger than this (m2) are woods; they are left to the game's forest fill
FOREST_SHARE = 0.5     # a canopy polygon with this share of its area inside OSM forest/scrub is skipped
PEAK_WIN = 5           # lidar crown tops: local maximum of the smoothed canopy height within this many 2 m pixels
BLD_DILATE = 1         # pixels of margin around building footprints in the lidar canopy mask
MIN_CROWN, MAX_CROWN = 1.5, 10.0
WALL_STREET = 20.0     # a wall within this distance of a carriageway edge faces a street
WALL_ON_BUILDING = 0.8  # share of a wall's length lying on a building outline above which it is dropped (the facade is the wall)

DRIVE = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary",
         "tertiary_link", "unclassified", "residential", "living_street", "service", "pedestrian"}
CTR_TREE = {"G003": ("tree", 0), "G022": ("pine", 0), "G017": ("olive", 1), "G016": ("fruit", 1), "G033": ("citrus", 1)}
CTR_WALL = {"E003": "wall", "E002": "fence", "E001": "hedge", "E004": "drystone", "E005": "retaining", "E006": "retaining_foot"}
CTR_AREA = {"G007": "olive", "G008": "orchard", "G034": "citrus", "G006": "vine", "G009": "scrub", "G004": "park", "G005": "nursery"}
ROW_KIND = {"G011": "tree", "G013": "olive", "G014": "orchard"}

# districts for the quality tables: first match wins; circles (lat, lon, radius m) are the seeds of src/districts.js
DISTRICTS = [
    ("favorita", [(38.1620, 13.3378, 700), (38.1700, 13.3330, 700), (38.1590, 13.3430, 500), (38.1760, 13.3360, 700)]),
    ("pellegrino", [(38.1650, 13.3520, 1100)]),
    ("zen", [(38.1786, 13.3127, 600), (38.1834, 13.3149, 600), (38.1816, 13.3176, 450), (38.1770, 13.3180, 400)]),
    ("mondello", [(38.2054, 13.3235, 450), (38.2010, 13.3262, 500), (38.2125, 13.3251, 450), (38.2090, 13.3262, 220), (38.2075, 13.3285, 200)]),
    ("liberta", [(38.1292, 13.3512, 420), (38.1330, 13.3503, 420), (38.1370, 13.3485, 420), (38.1412, 13.3445, 420)]),
    ("brancaccio", [(38.0980, 13.3810, 600), (38.0930, 13.3830, 600), (38.0960, 13.3900, 500)]),
    ("centro", [(38.1170, 13.3550, 330), (38.1188, 13.3648, 330), (38.1190, 13.3687, 330), (38.1105, 13.3577, 330), (38.1092, 13.3545, 260),
                (38.1120, 13.3600, 200), (38.1150, 13.3690, 330), (38.1137, 13.3705, 330), (38.1160, 13.3722, 240), (38.1120, 13.3730, 240),
                (38.1090, 13.3650, 330), (38.1125, 13.3635, 330), (38.1157, 13.3613, 330), (38.1195, 13.3572, 330), (38.1148, 13.3562, 330),
                (38.1160, 13.3650, 330)]),
]
# named places for the top-down overlays: x, z (game metres), half size
BLOCKS = {
    "liberta": (-960.0, -1910.0, 300), "liberta_est": (-225.0, -1820.0, 300), "centro": (0.0, 0.0, 300), "mondello": (-3076.0, -9460.0, 300),
    "favorita": (-1407.0, -4397.0, 300), "pellegrino": (-96.0, -4451.0, 300), "zen": (-4052.0, -7106.0, 300), "brancaccio": (1904.0, 2290.0, 300),
    "foro": (945.0, -382.0, 300),
}


def ll_xz(lon, lat):
    return (np.asarray(lon) - LON0) * KX, -(np.asarray(lat) - LAT0) * KZ


def conv(tr, e, n):
    lon, lat = tr.transform(np.asarray(e, dtype=float), np.asarray(n, dtype=float))
    return ll_xz(lon, lat)


def xz_ll(x, z):
    return LAT0 - z / KZ, LON0 + x / KX


def in_bbox(x, z):
    s, w, n, e = BBOX_LL
    lat, lon = xz_ll(np.asarray(x), np.asarray(z))
    return (lat >= s) & (lat <= n) & (lon >= w) & (lon <= e)


def district_circles():
    out = []
    for name, seeds in DISTRICTS:
        for la, lo, r in seeds:
            x, z = ll_xz(lo, la)
            out.append((name, float(x), float(z), r))
    return out


def district_of(x, z, circles=None):
    """District name per point (arrays); 'other' when no seed circle holds it."""
    circles = circles or district_circles()
    x, z = np.asarray(x, dtype=float), np.asarray(z, dtype=float)
    out = np.full(x.shape, "other", dtype=object)
    done = np.zeros(x.shape, bool)
    for name, cx, cz, r in circles:  # DISTRICTS order = priority
        m = ~done & ((x - cx) ** 2 + (z - cz) ** 2 <= r * r)
        out[m] = name
        done |= m
    return out


def rnd(v, k=1):
    return round(float(v), k)


def flat_pts(a, k=1):
    return [round(float(v), k) for v in np.asarray(a).ravel()]


# ----------------------------------------------------------------------------- the baked world (read only)

def load_world(refresh=False):
    """Buildings, roads, OSM trees and rows, forest/scrub/water areas from world/tiles, cached in data/green/world.pkl."""
    cache = os.path.join(GREEN, "world.pkl")
    if os.path.exists(cache) and not refresh:
        with open(cache, "rb") as f:
            return pickle.load(f)
    W = {"bld": [], "roads": [], "osm_trees": [], "osm_rows": [], "forest": [], "scrub": [], "water": [], "plaza": []}
    files = sorted(glob.glob(os.path.join(TILES, "*.json")))
    t0 = time.time()
    for n, fn in enumerate(files):
        t = json.load(open(fn))
        for b in t["buildings"]:
            p = np.array(b["p"]).reshape(-1, 2)
            if len(p) < 3:
                continue
            holes = [np.array(h).reshape(-1, 2) for h in b.get("holes", []) if len(h) >= 6]
            g = Polygon(p, holes)
            if not g.is_valid:
                g = g.buffer(0)
            if not g.is_empty:
                W["bld"].append(g)
        for r in t["roads"]:
            p = np.array(r["p"]).reshape(-1, 2)
            if len(p) >= 2:
                W["roads"].append({"k": r["k"], "w": r.get("w", 6), "line": LineString(p), "br": bool(r.get("br")), "tn": bool(r.get("tn")),
                                   "n": r.get("n", "")})
        for it in t["props"]["items"]:
            if it["k"] == "tree":
                W["osm_trees"].append((it["x"], it["z"], it.get("sp") or "", it.get("lt") or "", it.get("ge") or ""))
        for a in t["props"]["areas"]:
            if a["k"] == "tree_row":
                p = np.array(a["p"]).reshape(-1, 2)
                if len(p) >= 2:
                    W["osm_rows"].append(LineString(p))
        for a in t["areas"]:
            k = a["k"]
            if k in ("forest", "scrub", "water", "plaza"):
                p = np.array(a["p"]).reshape(-1, 2)
                if len(p) >= 3:
                    g = Polygon(p)
                    if not g.is_valid:
                        g = g.buffer(0)
                    W[k].append(g)
        if n % 200 == 199:
            print(f"  tiles {n + 1}/{len(files)} ({time.time() - t0:.0f}s)", flush=True)
    m = json.load(open(os.path.join(ROOT, "world", "manifest.json")))
    land = [Polygon(np.array(m["land"]).reshape(-1, 2)).buffer(0)] + [Polygon(np.array(i).reshape(-1, 2)).buffer(0) for i in m.get("islands", [])]
    W["land"] = shapely.union_all(land).buffer(4.0)  # a few metres of slack for the coastline against CTR and lidar
    os.makedirs(GREEN, exist_ok=True)
    with open(cache, "wb") as f:
        pickle.dump(W, f)
    return W


# ----------------------------------------------------------------------------- readers for the downloads

def read_ctr(d):
    """-> {layer: [(attributes, geometry in game metres)]}; points are (x, z), lines [array(n, 2)], areas shapely polygons."""
    out = {}
    for layer in (6, 24, 25, 26, 27):
        items = []
        for fn in sorted(glob.glob(os.path.join(d, f"layer{layer}_0*.json"))):
            for ft in json.load(open(fn))["features"]:
                a, g = ft["attributes"], ft.get("geometry")
                if not g:
                    continue
                if "x" in g:
                    x, z = conv(T25833, g["x"], g["y"])
                    items.append((a, (float(x), float(z))))
                elif "paths" in g:
                    items.append((a, [np.column_stack(conv(T25833, *np.array(p).T)) for p in g["paths"] if len(p) >= 2]))
                elif "rings" in g:
                    poly = None
                    for r in g["rings"]:
                        if len(r) < 3:
                            continue
                        q = Polygon(np.column_stack(conv(T25833, *np.array(r).T)))
                        q = q if q.is_valid else q.buffer(0)
                        poly = q if poly is None else poly.symmetric_difference(q)
                    if poly is not None and not poly.is_empty:
                        items.append((a, poly))
        out[layer] = items
    return out


def read_ua(d):
    polys = []
    for fn in sorted(glob.glob(os.path.join(d, "stl_0*.json"))):
        for ft in json.load(open(fn))["features"]:
            poly = None
            for r in ft["geometry"]["rings"]:
                if len(r) < 3:
                    continue
                a = np.array(r)
                q = Polygon(np.column_stack(ll_xz(a[:, 0], a[:, 1])))
                q = q if q.is_valid else q.buffer(0)
                poly = q if poly is None else poly.symmetric_difference(q)
            if poly is not None and not poly.is_empty:
                polys.append((ft["attributes"]["OBJECTID"], poly))
    return polys


def read_verde(d):
    r = shapefile.Reader(os.path.join(d, "AREA_VERDE"))
    out = []
    for sr in r.iterShapeRecords():
        gi = sr.shape.__geo_interface__
        rec = sr.record.as_dict()
        polys = [gi["coordinates"]] if gi["type"] == "Polygon" else gi["coordinates"]
        geom = None
        for rings in polys:
            outer = Polygon(np.column_stack(conv(T3004, *np.array(rings[0])[:, :2].T)),
                            [np.column_stack(conv(T3004, *np.array(h)[:, :2].T)) for h in rings[1:] if len(h) >= 4])
            outer = outer if outer.is_valid else outer.buffer(0)
            geom = outer if geom is None else geom.union(outer)
        if geom is not None and not geom.is_empty:
            out.append((int(rec["ID"]), rec["TIPO"].strip(), geom))
    return out


# ----------------------------------------------------------------------------- small spatial helpers

def thin(points, mind):
    """Greedy: keep points (list of (x, z, ...)) in order, dropping any within mind of an earlier kept one. Returns kept indices."""
    cell = mind
    grid, keep = {}, []
    m2 = mind * mind
    for i, p in enumerate(points):
        cx, cz = int(p[0] // cell), int(p[1] // cell)
        ok = True
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j in grid.get((cx + dx, cz + dz), ()):
                    q = points[j]
                    if (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < m2:
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                break
        if ok:
            grid.setdefault((cx, cz), []).append(i)
            keep.append(i)
    return keep


def nearest(tree, geoms_xy, maxd):
    """For an array of (x, z) points: (distance, index into the tree's geometries), inf/-1 beyond maxd."""
    n = len(geoms_xy)
    dist = np.full(n, np.inf)
    idx = np.full(n, -1)
    if n == 0 or tree is None:
        return dist, idx
    pts = shapely.points(geoms_xy)
    pair, d = tree.query_nearest(pts, max_distance=maxd, return_distance=True, all_matches=False)
    dist[pair[0]] = d
    idx[pair[0]] = pair[1]
    return dist, idx


def inside_any(tree, geoms_xy):
    """bool per point: inside any polygon of the tree."""
    out = np.zeros(len(geoms_xy), bool)
    if len(geoms_xy) == 0 or tree is None:
        return out
    pair = tree.query(shapely.points(geoms_xy), predicate="within")
    out[np.unique(pair[0])] = True
    return out


def to_tree(geoms):
    return STRtree(geoms) if len(geoms) else None


def poly_flat(g, k=1):
    """shapely polygon -> (outer flat, [hole flat]) rounded."""
    return flat_pts(np.array(g.exterior.coords)[:-1], k), [flat_pts(np.array(h.coords)[:-1], k) for h in g.interiors]


def polys_of(g):
    if g.geom_type == "Polygon":
        return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [q for q in g.geoms if q.geom_type == "Polygon"]
    return []


# ----------------------------------------------------------------------------- lidar crowns

def _raster_polys(geoms, bi, bj, fill):
    im = Image.new("L", (lr.NPX, lr.NPX), 0)
    dr = ImageDraw.Draw(im)
    ox, oz = bi * lr.BLOCK, bj * lr.BLOCK
    for g in geoms:
        for q in polys_of(g):
            ext = [((x - ox) / lr.PX - 0.5, (z - oz) / lr.PX - 0.5) for x, z in q.exterior.coords]
            dr.polygon(ext, fill=fill)
            for h in q.interiors:
                dr.polygon([((x - ox) / lr.PX - 0.5, (z - oz) / lr.PX - 0.5) for x, z in h.coords], fill=0)
    return np.array(im) > 0


def _raster_lines(geoms, bi, bj, width_m):
    im = Image.new("L", (lr.NPX, lr.NPX), 0)
    dr = ImageDraw.Draw(im)
    ox, oz = bi * lr.BLOCK, bj * lr.BLOCK
    for g in geoms:
        dr.line([((x - ox) / lr.PX - 0.5, (z - oz) / lr.PX - 0.5) for x, z in g.coords], fill=255, width=max(1, int(width_m / lr.PX)))
    return np.array(im) > 0


def height_floor(dtm):
    """Smallest canopy height believed at this ground elevation: the decoded ramp gets coarse on the hills (docs: lidar_raster)."""
    return np.where(dtm < 60, 2.5, np.where(dtm < 100, 3.5, 5.0))


def lidar_crowns(W, stats):
    """Crown tops from the 2 m canopy height model (DSM last return minus DTM) outside buildings and bridges.
    -> array (n, 6): x, z, r, h, dtm, flag (1 = inside forest or scrub area, 0 otherwise); also stats on coverage."""
    blocks = [tuple(int(v) for v in k.split("_")) for k, v in json.load(open(os.path.join(lr.ROOT, "index.json")))["blocks"].items()
              if v.get("dtm") and v.get("dsm")]
    btree = to_tree(W["bld"])
    bridge = [r["line"] for r in W["roads"] if r["br"]]
    rtree = to_tree(bridge)
    wet = to_tree(W["water"])
    out = []
    covered = 0
    for bi, bj in sorted(blocks):
        e_dsm = lr._layer("dsm").block(bi, bj)
        e_dtm = lr._layer("dtm").block(bi, bj)
        if e_dsm is None or e_dtm is None:
            continue
        dsm = np.where((e_dsm[0] == lr.NODATA) | ((e_dsm[1] & lr.F_SAT) > 0), np.nan, e_dsm[0] / 10.0).astype(np.float32)
        dtm = np.where((e_dtm[0] == lr.NODATA) | ((e_dtm[1] & lr.F_SAT) > 0), np.nan, e_dtm[0] / 10.0).astype(np.float32)
        nd = dsm - dtm
        valid = ~np.isnan(nd)
        covered += int(valid.sum())
        if not valid.any():
            continue
        box = shapely.box(bi * lr.BLOCK - 20, bj * lr.BLOCK - 20, (bi + 1) * lr.BLOCK + 20, (bj + 1) * lr.BLOCK + 20)
        bl = [W["bld"][i] for i in (btree.query(box) if btree else [])]
        mask = _raster_polys(bl, bi, bj, 255)
        if rtree is not None:
            br = [bridge[i] for i in rtree.query(box)]
            if br:
                mask |= _raster_lines(br, bi, bj, 10)
        if wet is not None:
            wt = [W["water"][i] for i in wet.query(box)]
            if wt:
                mask |= _raster_polys(wt, bi, bj, 255)
        mask = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=BLD_DILATE) > 0
        nd0 = np.where(valid & ~mask & (nd > 0) & (nd < 45), nd, 0).astype(np.float32)
        s = cv2.GaussianBlur(nd0, (0, 0), 1.0)
        rng = np.random.default_rng([abs(bi), abs(bj), int(bi < 0), int(bj < 0), 7])
        s = s + rng.uniform(0, 1e-3, s.shape).astype(np.float32)  # break ties on flat crowns deterministically
        thr = height_floor(np.nan_to_num(dtm, nan=0.0))
        mx = cv2.dilate(s, np.ones((PEAK_WIN, PEAK_WIN), np.uint8))
        pk = (s >= mx) & (s >= thr) & valid & ~mask
        rr, cc = np.nonzero(pk)
        if len(rr) == 0:
            continue
        h3 = cv2.dilate(nd0, np.ones((3, 3), np.uint8))[rr, cc]
        # a "crown" whose neighbours inside a building footprint are about as tall (the roof is up to 2 m higher or 0.5 m lower), is the roof edge leaking out of the mask
        roof = cv2.dilate(np.where(mask & valid & (nd < 60), np.maximum(nd, 0), 0).astype(np.float32), np.ones((5, 5), np.uint8))[rr, cc]
        leak = (roof >= h3 - 0.5) & (roof <= h3 + 2.0)
        stats["lidar_roof_leak_rejected"] = stats.get("lidar_roof_leak_rejected", 0) + int(leak.sum())
        rr, cc, h3 = rr[~leak], cc[~leak], h3[~leak]
        if len(rr) == 0:
            continue
        # crown radius: walk 8 rays up to 5 pixels until the canopy drops below a third of the peak or rises again (next crown)
        dirs = [(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)]
        tt = np.maximum(2.0, 0.35 * h3)
        n = len(rr)
        prev = np.broadcast_to(s[rr, cc][:, None], (n, 8)).copy()
        dist = np.full((n, 8), 5.0)
        done = np.zeros((n, 8), bool)
        for k in range(1, 6):
            for di, (dy, dx) in enumerate(dirs):
                cur = s[np.clip(rr + dy * k, 0, lr.NPX - 1), np.clip(cc + dx * k, 0, lr.NPX - 1)]
                step = math.hypot(dy, dx)
                pv = prev[:, di]
                low = ~done[:, di] & (cur < tt)
                rise = ~done[:, di] & ~low & (cur > pv + 0.15)
                f = np.clip((pv - tt) / np.maximum(pv - cur, 1e-3), 0, 1)
                dist[low, di] = ((k - 1) + f[low]) * step
                dist[rise, di] = (k - 1) * step
                done[:, di] |= low | rise
                prev[:, di] = cur
        r = np.clip(dist.mean(axis=1) * lr.PX, MIN_CROWN, MAX_CROWN)
        x = bi * lr.BLOCK + (cc + 0.5) * lr.PX
        z = bj * lr.BLOCK + (rr + 0.5) * lr.PX
        out.append(np.column_stack([x, z, r, h3, dtm[rr, cc], np.zeros(n)]))
    stats["lidar_covered_km2"] = round(covered * lr.PX * lr.PX / 1e6, 2)
    return np.vstack(out) if out else np.zeros((0, 6))


def lidar_has_data(x, z):
    """bool per point: both DTM and DSM decoded there."""
    return ~np.isnan(lr.sample_ndsm(x, z))


def lidar_max_near(x, z, rad=4.0):
    """Largest canopy height within rad metres (3x3 samples around the point), NaN where there is no lidar."""
    best = np.full(np.shape(x), np.nan)
    for dx in (-rad, 0, rad):
        for dz in (-rad, 0, rad):
            v = lr.sample_ndsm(np.asarray(x) + dx, np.asarray(z) + dz)
            best = np.fmax(best, v)
    return best


# ----------------------------------------------------------------------------- trees

def lattice(poly, spacing, seed):
    """Jittered hex lattice of points inside poly eroded by UA_EDGE."""
    inner = poly.buffer(-UA_EDGE)
    if inner.is_empty:
        return np.zeros((0, 2))
    x0, z0, x1, z1 = inner.bounds
    rng = np.random.default_rng(seed)
    dz = spacing * 0.866
    pts = []
    row = 0
    z = z0 + rng.uniform(0, dz)
    ox = rng.uniform(0, spacing)
    while z <= z1:
        xs = np.arange(x0 + ox + (spacing / 2 if row % 2 else 0), x1, spacing)
        pts.append(np.column_stack([xs, np.full(len(xs), z)]))
        z += dz
        row += 1
    if not pts:
        return np.zeros((0, 2))
    p = np.vstack(pts)
    p = p + rng.uniform(-0.2 * spacing, 0.2 * spacing, p.shape)
    return p[shapely.contains_xy(inner, p[:, 0], p[:, 1])]


def build_trees(W, ctr, ua, stats):
    osm = np.array([(t[0], t[1]) for t in W["osm_trees"]])
    osm_tree = to_tree(list(shapely.points(osm)))
    btree = to_tree(W["bld"])
    forest = to_tree(W["forest"] + W["scrub"])
    drive = [r for r in W["roads"] if r["k"] in DRIVE and not r["tn"]]
    road_buf = [r["line"].buffer(max(r["w"], 3) / 2 + 0.3, cap_style=2) for r in drive]
    rbtree = to_tree(road_buf)
    veg = [(a, g) for a, g in ctr[26] + ctr[27] if g.geom_type in ("Polygon", "MultiPolygon")]
    vtree = to_tree([g for _, g in veg])
    vcls = [CTR_AREA.get(a["CODICE"]) for a, _ in veg]
    S = stats["trees"] = {}

    # --- lidar crown tops
    t0 = time.time()
    L = lidar_crowns(W, stats)
    S["lidar_peaks_all"] = len(L)
    # against OSM trees: same tree (give OSM the crown) or a new one; done before the forest filter so park trees count
    d, oi = nearest(osm_tree, [tuple(p) for p in L[:, :2]], DUP_OSM)
    dup = d <= DUP_OSM
    S["lidar_dup_osm"] = int(dup.sum())
    crowns = {}
    for k in np.nonzero(dup)[0]:
        j = int(oi[k])
        if j not in crowns or d[k] < crowns[j][0]:
            crowns[j] = (float(d[k]), float(L[k, 2]), float(L[k, 3]))
    osm_crowns = [{"x": W["osm_trees"][j][0], "z": W["osm_trees"][j][1], "r": rnd(v[1]), "h": rnd(v[2])} for j, v in sorted(crowns.items())]
    S["osm_trees_with_crown"] = len(osm_crowns)
    S["osm_trees_total"] = len(osm)
    S["osm_trees_in_lidar_area"] = int(lidar_has_data(osm[:, 0], osm[:, 1]).sum())
    L = L[~dup]
    # small "crowns" hugging a facade are mostly balconies, awnings and roof edges, not trees
    db, _ = nearest(btree, [tuple(p) for p in L[:, :2]], 4.0)
    facade = (db <= 4.0) & (L[:, 2] < 2.2)
    S["lidar_facade_small_rejected"] = int(facade.sum())
    L = L[~facade]
    S["lidar_in_sea"] = int((~shapely.contains_xy(W["land"], L[:, 0], L[:, 1])).sum())
    L = L[shapely.contains_xy(W["land"], L[:, 0], L[:, 1])]
    infor = inside_any(forest, [tuple(p) for p in L[:, :2]])
    S["lidar_in_forest_or_scrub"] = int(infor.sum())  # kept, flagged f=1: real crowns, but the game fills forests itself
    print(f"  lidar: {len(L)} crown tops ({time.time() - t0:.0f}s)", flush=True)
    keep = thin([tuple(p) for p in L], DUP_NEW)
    L = L[keep]
    infor = infor[keep]
    S["lidar_new"] = len(L)

    trees = []  # dicts: x z s r h k c
    for (x, z, r, h, _, _), fo in zip(L, infor):
        t = {"x": rnd(x), "z": rnd(z), "s": "lidar", "r": rnd(r), "h": rnd(h)}
        if fo:
            t["f"] = 1
        if h / max(r, 1.0) >= 3.2 and h >= 8:
            t["k"] = "tall"  # narrow and tall: palm, cypress or poplar rather than a broadleaf crown
        trees.append(t)

    # cross-checks between the sources (numbers for docs/sources)
    uat = to_tree([g.buffer(4.0) for _, g in ua])
    lx = np.array([(t["x"], t["z"]) for t in trees])
    big = np.array([t.get("r", 0) >= 3.5 for t in trees])
    S["check_lidar_in_ua_canopy"] = round(float(inside_any(uat, [tuple(p) for p in lx]).mean()), 3)
    S["check_lidar_big_crowns_in_ua_canopy"] = round(float(inside_any(uat, [tuple(p) for p in lx[big]]).mean()), 3)
    inl = lidar_has_data(osm[:, 0], osm[:, 1])
    S["check_osm_trees_with_canopy_2_5m_near"] = round(float((lidar_max_near(osm[inl, 0], osm[inl, 1]) >= 2.5).mean()), 3)
    S["check_osm_trees_inside_ua_canopy"] = round(float(inside_any(uat, [tuple(p) for p in osm]).mean()), 3)

    # --- CTR points
    ctr_pts = []
    S["ctr_symbols"] = {}
    for a, (x, z) in ctr[6]:
        c = a["CODICE"]
        if c in CTR_TREE:
            S["ctr_symbols"][c] = S["ctr_symbols"].get(c, 0) + 1
            if in_bbox(x, z):
                ctr_pts.append((x, z, c, a.get("ANNORILEV") or 0))
    S["ctr_in_bbox"] = len(ctr_pts)
    cx = np.array([(p[0], p[1]) for p in ctr_pts])
    drop = ~shapely.contains_xy(W["land"], cx[:, 0], cx[:, 1])
    S["ctr_in_sea"] = int(drop.sum())
    d, _ = nearest(osm_tree, [tuple(p) for p in cx], DUP_OSM)
    dup_osm = d <= DUP_OSM
    S["ctr_dup_osm"] = int(dup_osm.sum())
    in_bld = inside_any(btree, [tuple(p) for p in cx])
    S["ctr_in_building"] = int((in_bld & ~dup_osm).sum())
    on_road = inside_any(rbtree, [tuple(p) for p in cx])
    S["ctr_on_carriageway"] = int((on_road & ~dup_osm & ~in_bld).sum())
    drop |= dup_osm | in_bld
    lid_tree = to_tree(list(shapely.points(np.array([(t["x"], t["z"]) for t in trees])))) if trees else None
    dl, li = nearest(lid_tree, [tuple(p) for p in cx], CTR_LIDAR)
    has = lidar_has_data(cx[:, 0], cx[:, 1]) if len(cx) else np.zeros(0, bool)
    near = lidar_max_near(cx[:, 0], cx[:, 1]) if len(cx) else np.zeros(0)
    merged = (dl <= CTR_LIDAR) & ~drop
    S["ctr_merged_into_lidar"] = int(merged.sum())
    # in the lidar area a point with no canopy within 4 m (and no crown top) is stale or misplaced: not a tree any more
    stale = has & ~merged & ~drop & ~(near >= 2.5)
    # orchard symbols: representative marks, no stand-alone tree to confirm; the lidar rule is for isolated trees only
    kind = [CTR_TREE[p[2]][0] for p in ctr_pts]
    orch = np.array([CTR_TREE[p[2]][1] for p in ctr_pts], bool)
    stale &= ~orch
    S["ctr_lidar_area_total"] = int((has & ~dup_osm & ~in_bld).sum())
    S["ctr_lidar_confirmed"] = int(((has & ~dup_osm & ~in_bld) & (merged | (near >= 2.5))).sum())
    S["ctr_dropped_no_canopy"] = int(stale.sum())
    drop |= stale
    for i, p in enumerate(ctr_pts):
        if drop[i]:
            continue
        if merged[i]:
            t = trees[int(li[i])]
            if kind[i] != "tree":
                t["k"] = kind[i]
            t["s"] = "lidar+ctr"
            t["y"] = int(p[3])
            continue
    ctr_new = [(p, kind[i], bool(orch[i]), bool(has[i] and (near[i] >= 2.5))) for i, p in enumerate(ctr_pts) if not drop[i] and not merged[i]]
    # thin among themselves and against what we have (CTR symbols repeat)
    existing = [(t["x"], t["z"]) for t in trees]
    allp = existing + [(p[0], p[1]) for p, _, _, _ in ctr_new]
    kept = thin(allp, DUP_NEW)
    kept = [k - len(existing) for k in kept if k >= len(existing)]
    S["ctr_dup_new"] = len(ctr_new) - len(kept)
    for k in kept:
        p, kd, orchard, ok = ctr_new[k]
        t = {"x": rnd(p[0]), "z": rnd(p[1]), "s": "ctr", "y": int(p[3])}
        if kd != "tree":
            t["k"] = kd
        if orchard:
            t["o"] = 1  # orchard symbol: one mark per few trees, not a surveyed individual
        if ok:
            t["v"] = 1  # a lidar canopy of at least 2.5 m stands within 4 m
        trees.append(t)
    S["ctr_new"] = len(kept)

    # --- Urban Atlas canopy polygons -> lattice trees, only where there is no lidar and outside OSM forests
    pts_all = np.array([(t["x"], t["z"]) for t in trees])
    keep_tree = to_tree(list(shapely.points(np.vstack([pts_all, osm]))))
    ua_n = {"polygons": len(ua), "skipped_forest": 0, "skipped_big": 0, "skipped_outside": 0, "points_raw": 0}
    new = []
    utree = to_tree(W["bld"] + [r["line"] for r in drive])  # canopy far from any building or road is countryside
    for oid, g in ua:
        if not in_bbox(*g.representative_point().coords[0]):
            ua_n["skipped_outside"] += 1
            continue
        if g.area > UA_MAX_AREA:
            ua_n["skipped_big"] += 1
            continue
        if forest is not None:
            hits = forest.query(g, predicate="intersects")
            if len(hits) and sum(g.intersection(forest.geometries[i]).area for i in hits) >= FOREST_SHARE * g.area:
                ua_n["skipped_forest"] += 1
                continue
        if utree is not None:
            hits = vtree.query(g, predicate="intersects") if vtree is not None else []
            wild = [i for i in hits if vcls[int(i)] in ("olive", "orchard", "citrus", "vine", "scrub")]
            if wild and sum(g.intersection(vtree.geometries[i]).area for i in wild) >= FOREST_SHARE * g.area:
                ua_n["skipped_orchard"] = ua_n.get("skipped_orchard", 0) + 1
                continue
            if not len(utree.query(g.buffer(UA_NEAR), predicate="intersects")):
                ua_n["skipped_remote"] = ua_n.get("skipped_remote", 0) + 1
                continue
        for q in polys_of(g):
            p = lattice(q, UA_SPACING, int(oid))
            if len(p):
                new.append(p)
    P = np.vstack(new) if new else np.zeros((0, 2))
    ua_n["points_raw"] = len(P)
    pl = [tuple(p) for p in P]
    ok = ~lidar_has_data(P[:, 0], P[:, 1]) & shapely.contains_xy(W["land"], P[:, 0], P[:, 1])
    ua_n["points_in_lidar_area_skipped"] = int((~ok).sum())
    d, _ = nearest(keep_tree, pl, DUP_NEW + 0.5)
    near_ok = d > DUP_NEW + 0.5
    ua_n["points_dup_existing"] = int((ok & ~near_ok).sum())
    ok &= near_ok
    ok &= ~inside_any(btree, pl)
    ok &= ~inside_any(rbtree, pl)
    ok &= ~inside_any(forest, pl)
    ua_n["points_kept"] = int(ok.sum())
    for x, z in P[ok]:
        trees.append({"x": rnd(x), "z": rnd(z), "s": "ua"})
    S["ua"] = ua_n

    # --- context hints from the CTR vegetation areas (species)
    pa = np.array([(t["x"], t["z"]) for t in trees])
    if len(pa) and vtree is not None:
        pair = vtree.query(shapely.points(pa), predicate="within")
        seen = set()
        for pi, vi in zip(pair[0], pair[1]):
            if int(pi) in seen or vcls[int(vi)] is None:
                continue
            seen.add(int(pi))
            trees[int(pi)]["c"] = vcls[int(vi)]
    return trees, osm_crowns


# ----------------------------------------------------------------------------- walls

def douglas(a, tol=0.3):
    return np.array(LineString(a).simplify(tol).coords)


def build_walls(W, ctr, stats):
    S = stats["walls"] = {"raw": 0, "by_type": {}, "outside": 0, "short": 0, "on_building": 0}
    btree = to_tree(W["bld"])
    bound = [b.boundary for b in W["bld"]]
    bbtree = to_tree(bound)
    drive = [r for r in W["roads"] if r["k"] in DRIVE and not r["tn"] and not r["br"]]
    edges = [r["line"].buffer(max(r["w"], 3) / 2, cap_style=2) for r in drive]
    etree = to_tree(edges)
    walls = []
    shore = W["land"].boundary
    for a, parts in ctr[24]:
        t = CTR_WALL.get(a["CODICE"])
        if not t:
            continue
        for p in parts:
            S["raw"] += 1
            if not in_bbox(*p[len(p) // 2]):
                S["outside"] += 1
                continue
            if not shapely.contains_xy(W["land"], *p[len(p) // 2]):
                S["in_sea"] = S.get("in_sea", 0) + 1
                continue
            p = douglas(p)
            ln = LineString(p)
            if t == "retaining" and len(p) == 2 and 10 <= ln.length <= 35 and shore.distance(Point(*p[len(p) // 2])) <= 40:
                S["beach_groynes"] = S.get("beach_groynes", 0) + 1  # the comb of short strokes on the Mondello beach, not a wall
                continue
            if ln.length < 2.0:
                S["short"] += 1
                continue
            walls.append((t, p, ln, int(a.get("ANNORILEV") or 0)))
    lines = [w[2] for w in walls]
    # share of each line within 1 m of a building outline: a wall that runs along the facade is the facade
    onb = np.zeros(len(lines))
    for i, ln in enumerate(lines):
        c = bbtree.query(ln.buffer(1.0), predicate="intersects") if bbtree else []
        if len(c):
            u = shapely.union_all([bound[j] for j in c]).buffer(1.0)
            onb[i] = ln.intersection(u).length / ln.length
    out = []
    mids = np.array([ln.interpolate(0.5, normalized=True).coords[0] for ln in lines]) if lines else np.zeros((0, 2))
    dstreet, _ = nearest(etree, [tuple(m) for m in mids], WALL_STREET + 5)
    for i, (t, p, ln, y) in enumerate(walls):
        if onb[i] >= WALL_ON_BUILDING:
            S["on_building"] += 1
            continue
        rec = {"t": t, "p": flat_pts(p), "l": rnd(ln.length)}
        if dstreet[i] <= WALL_STREET:
            rec["st"] = 1
        if y:
            rec["y"] = y
        out.append(rec)
        S["by_type"][t] = S["by_type"].get(t, 0) + 1
    S["kept"] = len(out)
    S["street_facing"] = sum(1 for r in out if r.get("st"))
    S["length_km"] = round(sum(r["l"] for r in out) / 1000, 1)
    S["ctr_survey_year"] = {str(k): sum(1 for r in out if r.get("y") == k) for k in (2003, 2007, 2012)}
    # alignment of the CTR with the OSM outlines: median distance from wall vertices to the nearest building outline
    return out


# ----------------------------------------------------------------------------- verges

def classify_verges(W, verde, stats):
    S = stats["verges"] = {"raw": len(verde), "by_class": {}, "area_m2": {}}
    drive = [r for r in W["roads"] if r["k"] in DRIVE and not r["tn"] and not r["br"]]
    road_poly = [r["line"].buffer(max(r["w"], 3) / 2, cap_style=2) for r in drive]
    rtree = to_tree(road_poly)
    btree = to_tree(W["bld"])
    out = []
    for oid, tipo, g in verde:
        for q in polys_of(g):
            if not in_bbox(*q.representative_point().coords[0]):
                continue
            area = q.area
            mrr = q.minimum_rotated_rectangle
            cs = np.array(mrr.exterior.coords)[:4]
            e1, e2 = cs[1] - cs[0], cs[2] - cs[1]
            l1, l2 = float(np.hypot(*e1)), float(np.hypot(*e2))
            ax = e1 / l1 if l1 >= l2 else e2 / l2
            length, width = max(l1, l2), min(l1, l2)
            n = max(int(q.exterior.length // 2.5), 8)
            bp = shapely.line_interpolate_point(q.exterior, np.linspace(0, q.exterior.length, n, endpoint=False))
            bxy = shapely.get_coordinates(bp)
            d, _ = nearest(rtree, [tuple(p) for p in bxy], 6.0)
            facing = d <= 4.5
            c = np.array(q.centroid.coords[0])
            side = np.sign((bxy[:, 0] - c[0]) * ax[1] - (bxy[:, 1] - c[1]) * ax[0])
            fl = float(facing[side >= 0].mean()) if (side >= 0).any() else 0.0
            fr = float(facing[side < 0].mean()) if (side < 0).any() else 0.0
            f = float(facing.mean())
            aspect = length / max(width, 0.1)
            if tipo == "alberi":
                cls = "tree_bed"
            elif aspect >= 2.5 and width <= 25 and min(fl, fr) >= 0.35:
                cls = "median"
            elif aspect < 2.5 and f >= 0.6 and width >= 2.5:
                cls = "island"
            elif f >= 0.3 and width <= 10:
                cls = "verge"
            else:
                cls = "flowerbed"
            p, holes = poly_flat(q)
            rec = {"id": oid, "c": cls, "p": p, "a": rnd(area), "w": rnd(width), "l": rnd(length)}
            if holes:
                rec["holes"] = holes
            out.append(rec)
            S["by_class"][cls] = S["by_class"].get(cls, 0) + 1
            S["area_m2"][cls] = S["area_m2"].get(cls, 0) + area
    S["area_m2"] = {k: int(v) for k, v in S["area_m2"].items()}
    S["kept"] = len(out)
    return out


# ----------------------------------------------------------------------------- tree rows

def chain_rows(P, W, min_n=4):
    """Detect rows in tree points P (n, 2): chains of neighbours 4 to 22 m apart that continue in a straight line."""
    n = len(P)
    cell = 22.0
    grid = {}
    for i, (x, z) in enumerate(P):
        grid.setdefault((int(x // cell), int(z // cell)), []).append(i)
    edges = []
    for i, (x, z) in enumerate(P):
        cx, cz = int(x // cell), int(z // cell)
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j in grid.get((cx + dx, cz + dz), ()):
                    if j > i:
                        d = math.hypot(P[j][0] - x, P[j][1] - z)
                        if 4.0 <= d <= 22.0:
                            edges.append((d, i, j))
    edges.sort()
    adj = [[] for _ in range(n)]
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def dirv(i, j):
        v = P[j] - P[i]
        return v / (np.hypot(*v) or 1)

    for d, i, j in edges:
        if len(adj[i]) >= 2 or len(adj[j]) >= 2 or find(i) == find(j):
            continue
        ok = True
        for a, b in ((i, j), (j, i)):  # the new edge must continue the existing edge at a
            if adj[a]:
                o = adj[a][0]
                if np.dot(dirv(o, a), dirv(a, b)) < math.cos(math.radians(28)):
                    ok = False
        if ok:
            adj[i].append(j)
            adj[j].append(i)
            parent[find(i)] = find(j)
    seen, chains = set(), []
    for i in range(n):
        if i in seen or len(adj[i]) != 1:
            continue
        ch, prev, cur = [i], -1, i
        while True:
            nxt = [k for k in adj[cur] if k != prev]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            ch.append(cur)
        seen.update(ch)
        if len(ch) >= min_n:
            chains.append(ch)
    return chains


def build_rows(W, ctr, trees, stats):
    S = stats["rows"] = {}
    osm_rows = W["osm_rows"]
    otree = to_tree([r.buffer(5.0) for r in osm_rows])
    out = []
    # CTR rows
    for a, parts in ctr[25]:
        k = ROW_KIND.get(a["CODICE"])
        if not k:
            continue
        for p in parts:
            if not in_bbox(*p[len(p) // 2]) or len(p) < 2:
                continue
            ln = LineString(p)
            if ln.length < 8:
                continue
            c = otree.query(ln, predicate="intersects") if otree else []
            share = 0.0
            if len(c):
                share = ln.intersection(shapely.union_all([otree.geometries[i] for i in c])).length / ln.length
            if share > 0.6:
                S["ctr_dup_osm"] = S.get("ctr_dup_osm", 0) + 1
                continue
            out.append({"s": "ctr", "k": k, "p": flat_pts(douglas(p)), "l": rnd(ln.length), "y": int(a.get("ANNORILEV") or 0)})
    S["ctr"] = len(out)
    # rows detected in the points (new trees and OSM trees together), along streets
    # the Urban Atlas lattice is regular by construction, so it would "find" rows everywhere: only measured or surveyed points
    pts = [(t["x"], t["z"], t.get("r"), t["s"]) for t in trees if t["s"] != "ua" and not t.get("f") and not t.get("o")]
    osm = [(t[0], t[1], None, "osm") for t in W["osm_trees"]]
    allp = pts + osm
    P = np.array([(p[0], p[1]) for p in allp])
    S["detect_input"] = len(P)
    drive = [r["line"] for r in W["roads"] if r["k"] in DRIVE and not r["tn"] and not r["br"]]
    rtree = to_tree(drive)
    ctr_rows = [LineString(np.array(r["p"]).reshape(-1, 2)).buffer(5.0) for r in out]
    ctree = to_tree(ctr_rows)
    n_det = 0
    for ch in chain_rows(P, W):
        q = P[ch]
        ln = LineString(q)
        if ln.length / (len(ch) - 1) > 20:
            continue
        gaps = np.hypot(*np.diff(q, axis=0).T)
        if gaps.std() / gaps.mean() > 0.45:  # an avenue is regular
            continue
        # along a street: a carriageway within 20 m of most trees and roughly parallel
        mid = [tuple(p) for p in q]
        d, ri = nearest(rtree, mid, 20.0)
        if (d < np.inf).mean() < 0.7:
            continue
        v = q[-1] - q[0]
        v = v / (np.hypot(*v) or 1)
        par = []
        for i in ri[ri >= 0]:
            s = drive[int(i)]
            u = np.array(s.coords[-1]) - np.array(s.coords[0])
            u = u / (np.hypot(*u) or 1)
            par.append(abs(float(np.dot(u, v))))
        if not par or np.median(par) < 0.8:
            continue
        # mostly already an OSM row or a CTR row: skip
        inrow = 0
        for p in q:
            if (otree and len(otree.query(Point(*p), predicate="within"))) or (ctree and len(ctree.query(Point(*p), predicate="within"))):
                inrow += 1
        if inrow / len(ch) > 0.6:
            S["detected_dup_row"] = S.get("detected_dup_row", 0) + 1
            continue
        src = sorted({allp[i][3] for i in ch})
        rs = [allp[i][2] for i in ch if allp[i][2]]
        rec = {"s": "detected", "k": "tree", "p": flat_pts(q), "n": len(ch), "sp": rnd(gaps.mean()), "l": rnd(ln.length), "from": src}
        if rs:
            rec["r"] = rnd(np.mean(rs))
        out.append(rec)
        n_det += 1
    S["detected"] = n_det
    S["osm_rows_existing"] = len(osm_rows)
    return out


# ----------------------------------------------------------------------------- vegetation areas

def build_veg_areas(ctr, stats):
    out, by = [], {}
    for a, g in ctr[26] + ctr[27]:
        c = CTR_AREA.get(a["CODICE"])
        if not c:
            continue
        for q in polys_of(g):
            if not in_bbox(*q.representative_point().coords[0]) or q.area < 150:
                continue
            p, holes = poly_flat(q)
            rec = {"c": c, "p": p, "a": rnd(q.area), "y": int(a.get("ANNORILEV") or 0)}
            if holes:
                rec["holes"] = holes
            out.append(rec)
            by[c] = by.get(c, 0) + 1
    stats["veg_areas"] = {"kept": len(out), "by_class": by}
    return out


# ----------------------------------------------------------------------------- build

CREDITS = {
    "ctr": "Regione Siciliana, Carta Tecnica Regionale 1:10.000 (edizione 2012-13), CC BY 4.0",
    "verde": "Comune di Palermo, Perimetrazione aree verdi, CC BY 4.0",
    "ua": "Contains modified Copernicus Land Monitoring Service information: Urban Atlas Street Tree Layer 2018, European Environment Agency",
    "lidar": "Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale, PST-A lidar Regione Sicilia, CC BY 4.0",
    "osm": "Map data (c) OpenStreetMap contributors, ODbL",
}


def dump(path, obj):
    with open(path + ".tmp", "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.replace(path + ".tmp", path)
    print(f"  wrote {os.path.relpath(path, ROOT)} ({os.path.getsize(path) / 1e6:.1f} MB)", flush=True)


def build(a):
    os.makedirs(GREEN, exist_ok=True)
    t0 = time.time()
    print("world tiles", flush=True)
    W = load_world(a.refresh_world)
    print(f"  {len(W['bld'])} buildings, {len(W['roads'])} roads, {len(W['osm_trees'])} OSM trees ({time.time() - t0:.0f}s)", flush=True)
    stats = {"generated": time.strftime("%Y-%m-%d"), "frame": "game metres, x east, z south of Quattro Canti (tools/bake.py)"}
    print("reading downloads", flush=True)
    ctr, ua, verde = read_ctr(a.ctr), read_ua(a.ua), read_verde(a.verde)
    print(f"  CTR {({k: len(v) for k, v in ctr.items()})}, UA {len(ua)} canopy polygons, Comune {len(verde)} green polygons", flush=True)
    print("trees", flush=True)
    trees, osm_crowns = build_trees(W, ctr, ua, stats)
    print("walls", flush=True)
    walls = build_walls(W, ctr, stats)
    print("verges", flush=True)
    verges = classify_verges(W, verde, stats)
    print("tree rows", flush=True)
    rows = build_rows(W, ctr, trees, stats)
    veg = build_veg_areas(ctr, stats)
    fields = {"x/z": "metres", "s": "source: lidar, lidar+ctr, ctr, ua", "r": "crown radius m (lidar only)", "h": "height m (lidar only, last-return model: a low bound)",
              "f": "1 = inside an OSM forest or scrub area", "k": "kind hint: tall, pine, olive, citrus, fruit", "c": "CTR vegetation area it stands in", "o": "1 = CTR orchard symbol",
              "v": "1 = lidar canopy found near a CTR point", "y": "CTR survey year"}
    dump(os.path.join(DATA, "trees.json"), {"meta": {"credits": [CREDITS[k] for k in ("lidar", "ctr", "ua")], "fields": fields,
                                                     "note": "new trees only; OSM trees are in the world tiles and are not repeated"},
                                            "trees": trees})
    dump(os.path.join(DATA, "trees_osm_crowns.json"), {"meta": {"credits": [CREDITS["lidar"]]}, "crowns": osm_crowns})
    dump(os.path.join(DATA, "tree_rows.json"), {"meta": {"credits": [CREDITS["ctr"], CREDITS["lidar"], CREDITS["osm"]],
                                                          "fields": {"s": "ctr or detected", "k": "tree, olive, orchard", "p": "flat x,z polyline", "n": "trees",
                                                                     "sp": "mean spacing m", "l": "length m", "r": "mean crown radius m", "from": "tree sources"}},
                                                 "rows": rows})
    dump(os.path.join(DATA, "verges.json"), {"meta": {"credits": [CREDITS["verde"]], "classes": ["median", "verge", "island", "flowerbed", "tree_bed"]},
                                             "verges": verges})
    dump(os.path.join(DATA, "walls.json"), {"meta": {"credits": [CREDITS["ctr"]], "fields": {"t": "wall, fence, hedge, drystone, retaining, retaining_foot",
                                                                                              "st": "1 = within 20 m of a carriageway edge", "l": "length m", "y": "survey year"},
                                                     "types": {"wall": "Muri divisori", "fence": "Filo spinato, palizzata, staccionata, cancelli", "hedge": "Siepe",
                                                               "drystone": "Muro a secco", "retaining": "Muro di sostegno testa", "retaining_foot": "Muro di sostegno piede"}},
                                            "walls": walls})
    dump(os.path.join(DATA, "veg_areas.json"), {"meta": {"credits": [CREDITS["ctr"]]}, "areas": veg})
    stats["seconds"] = round(time.time() - t0)
    dump(os.path.join(GREEN, "stats.json"), stats)


# ----------------------------------------------------------------------------- quality tables

def qc(a):
    stats = json.load(open(os.path.join(GREEN, "stats.json")))
    W = load_world()
    trees = json.load(open(os.path.join(DATA, "trees.json")))["trees"]
    crowns = json.load(open(os.path.join(DATA, "trees_osm_crowns.json")))["crowns"]
    rows = json.load(open(os.path.join(DATA, "tree_rows.json")))["rows"]
    verges = json.load(open(os.path.join(DATA, "verges.json")))["verges"]
    walls = json.load(open(os.path.join(DATA, "walls.json")))["walls"]
    circ = district_circles()
    names = [d[0] for d in DISTRICTS] + ["other"]

    def per(xs, zs):
        c = {n: 0 for n in names}
        for n in district_of(xs, zs, circ):
            c[n] += 1
        return c

    print("== trees: counts per source (new trees; OSM trees are separate)")
    srcs = ["lidar", "lidar+ctr", "ctr", "ua"]
    X = np.array([t["x"] for t in trees])
    Z = np.array([t["z"] for t in trees])
    S = np.array([t["s"] for t in trees])
    D = district_of(X, Z, circ)
    osm = np.array([(t[0], t[1]) for t in W["osm_trees"]])
    Do = district_of(osm[:, 0], osm[:, 1], circ)
    print(f"{'district':<12}{'osm':>7}" + "".join(f"{s:>11}" for s in srcs) + f"{'new total':>11}{'all':>9}{'crown%':>8}")
    tot = {s: 0 for s in srcs}
    for n in names:
        row = [(S[(D == n)] == s).sum() for s in srcs]
        new = sum(row)
        cr = np.array([("r" in trees[i]) for i in np.nonzero(D == n)[0]])
        print(f"{n:<12}{(Do == n).sum():>7}" + "".join(f"{v:>11}" for v in row) + f"{new:>11}{new + (Do == n).sum():>9}{(100 * cr.mean() if len(cr) else 0):>7.0f}%")
    print(f"{'TOTAL':<12}{len(osm):>7}" + "".join(f"{(S == s).sum():>11}" for s in srcs) + f"{len(trees):>11}{len(trees) + len(osm):>9}")
    withr = sum(1 for t in trees if "r" in t)
    print(f"trees with a lidar crown size: {withr} of {len(trees)} new ({100 * withr / len(trees):.0f}%); OSM trees with a crown: {len(crowns)} of {len(osm)} "
          f"({100 * len(crowns) / len(osm):.0f}%), of those inside lidar coverage: {len(crowns)} of {stats['trees']['osm_trees_in_lidar_area']}")
    print("== trees detail\n", json.dumps(stats["trees"], indent=1))
    print("== walls\n", json.dumps(stats["walls"]))
    print("== verges\n", json.dumps(stats["verges"]))
    print("== rows\n", json.dumps(stats["rows"]), f"total {len(rows)}")
    print("== per district: walls (street-facing), verges by class, rows")
    wx = np.array([np.mean(w["p"][0::2]) for w in walls])
    wz = np.array([np.mean(w["p"][1::2]) for w in walls])
    Dw = district_of(wx, wz, circ)
    vx = np.array([np.mean(v["p"][0::2]) for v in verges])
    vz = np.array([np.mean(v["p"][1::2]) for v in verges])
    Dv = district_of(vx, vz, circ)
    vc = np.array([v["c"] for v in verges])
    rx = np.array([np.mean(r["p"][0::2]) for r in rows])
    rz = np.array([np.mean(r["p"][1::2]) for r in rows])
    Dr = district_of(rx, rz, circ)
    st = np.array([bool(w.get("st")) for w in walls])
    wl = np.array([w["l"] for w in walls])
    print(f"{'district':<12}{'walls':>7}{'street':>8}{'km':>7}{'median':>8}{'verge':>7}{'island':>8}{'flowerbed':>11}{'rows':>6}")
    for n in names:
        m = Dw == n
        print(f"{n:<12}{m.sum():>7}{(m & st).sum():>8}{wl[m].sum() / 1000:>7.1f}" + "".join(f"{((Dv == n) & (vc == c)).sum():>{w}}" for c, w in
                                                                                    (("median", 8), ("verge", 7), ("island", 8), ("flowerbed", 11))) + f"{(Dr == n).sum():>6}")


# ----------------------------------------------------------------------------- overlays

def overlay(a):
    W = load_world()
    if a.where in BLOCKS:
        cx, cz, half = BLOCKS[a.where]
    else:
        cx, cz, half = (float(v) for v in a.where.split(","))
    sc = a.scale
    size = int(2 * half * sc)
    ox, oz = cx - half, cz - half

    def P(x, z):
        return ((x - ox) * sc, (z - oz) * sc)

    box = shapely.box(cx - half - 30, cz - half - 30, cx + half + 30, cz + half + 30)
    im = Image.new("RGB", (size, size), (236, 232, 222))
    dr = ImageDraw.Draw(im, "RGBA")
    if a.lidar:  # canopy height backdrop
        xs = np.arange(ox, ox + 2 * half, 1.0 / sc * 1)
        zs = np.arange(oz, oz + 2 * half, 1.0 / sc * 1)
        X, Z = np.meshgrid(xs, zs)
        nd = lr.sample_ndsm(X, Z)
        v = ~np.isnan(nd)
        c = np.clip(nd, 0, 25) / 25
        img = np.array(im)
        g = np.stack([200 - 120 * c, 215 - 60 * c, 190 - 140 * c], -1)
        img[v] = np.where((nd[v] > 2)[:, None], g[v], img[v]).astype(np.uint8)
        im = Image.fromarray(img)
        dr = ImageDraw.Draw(im, "RGBA")
    for r in W["roads"]:
        if r["k"] in DRIVE and r["line"].intersects(box):
            dr.line([P(x, z) for x, z in r["line"].coords], fill=(150, 150, 150, 255), width=max(2, int(r["w"] * sc)))
    for b in W["bld"]:
        if b.intersects(box):
            dr.polygon([P(x, z) for x, z in b.exterior.coords], fill=(120, 120, 128, 120), outline=(70, 70, 80, 255))
    layers = {k: json.load(open(os.path.join(DATA, f"{k}.json"))) for k in ("trees", "tree_rows", "verges", "walls")}
    col = {"median": (210, 40, 200), "verge": (255, 150, 0), "island": (0, 160, 160), "flowerbed": (230, 60, 60), "tree_bed": (120, 70, 0)}
    for v in layers["verges"]["verges"]:
        p = np.array(v["p"]).reshape(-1, 2)
        if abs(p[:, 0].mean() - cx) < half + 50 and abs(p[:, 1].mean() - cz) < half + 50:
            dr.polygon([P(x, z) for x, z in p], fill=col[v["c"]] + (150,), outline=col[v["c"]] + (255,))
    wcol = {"wall": (20, 20, 20), "fence": (0, 90, 220), "hedge": (0, 150, 0), "drystone": (140, 90, 30), "retaining": (140, 0, 0), "retaining_foot": (200, 100, 100)}
    for w in layers["walls"]["walls"]:
        p = np.array(w["p"]).reshape(-1, 2)
        if abs(p[:, 0].mean() - cx) < half + 50 and abs(p[:, 1].mean() - cz) < half + 50:
            dr.line([P(x, z) for x, z in p], fill=wcol[w["t"]] + (255,), width=2 if w.get("st") else 1)
    for rw in layers["tree_rows"]["rows"]:
        p = np.array(rw["p"]).reshape(-1, 2)
        if abs(p[:, 0].mean() - cx) < half + 50 and abs(p[:, 1].mean() - cz) < half + 50:
            dr.line([P(x, z) for x, z in p], fill=(0, 120, 255, 255) if rw["s"] == "detected" else (255, 0, 120, 255), width=3)
    for r in W["osm_rows"]:
        if r.intersects(box):
            dr.line([P(x, z) for x, z in r.coords], fill=(0, 0, 200, 255), width=3)
    scol = {"lidar": (0, 150, 0), "lidar+ctr": (0, 90, 0), "ctr": (240, 200, 0), "ua": (160, 60, 220)}
    for t in layers["trees"]["trees"]:
        if abs(t["x"] - cx) < half + 10 and abs(t["z"] - cz) < half + 10:
            r = t.get("r", 2.5) * sc
            x, y = P(t["x"], t["z"])
            dr.ellipse([x - r, y - r, x + r, y + r], fill=scol[t["s"]] + (70,), outline=scol[t["s"]] + (255,))
    for x, z, *_ in W["osm_trees"]:
        if abs(x - cx) < half + 10 and abs(z - cz) < half + 10:
            px, py = P(x, z)
            dr.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(0, 60, 255, 255), outline=(255, 255, 255, 255))
    dr.text((6, 6), f"{a.where}  {int(2 * half)} m   blue dot OSM tree; green lidar, dark green lidar+ctr, yellow ctr, purple ua (ring = crown)", fill=(0, 0, 0, 255))
    im.save(a.out)
    print("wrote", a.out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--ctr", required=True)
    b.add_argument("--ua", required=True)
    b.add_argument("--verde", required=True)
    b.add_argument("--refresh-world", action="store_true")
    sub.add_parser("qc")
    o = sub.add_parser("overlay")
    o.add_argument("where")
    o.add_argument("out")
    o.add_argument("--scale", type=float, default=2.0, help="pixels per metre")
    o.add_argument("--lidar", action="store_true", help="draw the lidar canopy height as background")
    a = ap.parse_args()
    {"build": build, "qc": qc, "overlay": overlay}[a.cmd](a)


if __name__ == "__main__":
    main()
