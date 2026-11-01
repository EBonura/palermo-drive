"""Road surfaces (carriageway, pavement, verge, pedestrian areas) from Comune di Palermo open data and OSM.

Why: tools/tiles.py builds the raised pavement as "all ground within 24 m of a building", which draws pale halos around every
sparse cluster, misses the real 1.5 to 2 m pavements and paves Via Maqueda as a plaza. The Comune publishes where the street
actually is. This script turns that into clean game-metre polygons for the bake (it does NOT touch tiles.py or world/).

Sources (Comune di Palermo open data, CC BY 4.0, https://opendata.comune.palermo.it/):
    dataset 280  Perimetrazione Area Stradale (4,388 polygons, class, EPSG:3004, issued 2013-02-22, surveyed 2011-12)
    dataset 281  Area di Circolazione Pedonale (polygons: vialetto, stairs, passaggio pedonale)
    dataset 850  Le aree pedonali, update to 2016 (CSV: street, decree, ordinance, year, area)
    OSM (data/city/pbf_*.json.gz): carriageway centrelines and widths, sidewalk tags, footway=sidewalk, buildings.

    tools/.venv/bin/python -I tools/road_surfaces.py --download DIR       fetch into DIR/strada, DIR/pedonale, DIR/csv (new, empty folders)
    tools/.venv/bin/python -I tools/road_surfaces.py --strada DIR/strada --pedonale DIR/pedonale --csv DIR/csv/aree_pedonali.csv
        build data/road_surfaces.json (git-ignored)
    ... --report REPORT_DIR   also write the quality numbers (report.json) and the top-down overlays there
    ... --report-only         skip the build (about 10 minutes), read data/road_surfaces.json and only write the report

Needs pyshp (pip install pyshp in tools/.venv). Downloads are untrusted: only .shp/.shx/.dbf/.prj members are extracted, by basename.
"""
import argparse
import glob
import json
import math
import os
import re
import sys
import unicodedata
import urllib.request
import zipfile

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import tiles  # noqa: E402  (parsers only, nothing is baked)
from bake import KX, KZ, LAT0, LON0  # noqa: E402

OUT = os.path.join(ROOT, "data", "road_surfaces.json")
WORLD_TILES = os.path.join(ROOT, "world", "tiles")
UA = "palermo-drive-road-surfaces/0.1 (hobby three.js game; contact via github EBonura)"
BASE = "https://opendata.comune.palermo.it/js/server/uploads/dataset/"
DOWNLOADS = {   # folder: (url, kind)
    "strada": (BASE + "shp/_10012018105549.zip", "zip"),       # dataset 280
    "pedonale": (BASE + "shp/_10012018121305.zip", "zip"),     # dataset 281 (the 2013 zip is gone, 404)
    "csv": (BASE + "csv/_18072024103830.csv", "csv"),          # dataset 850
}
KEEP_EXT = (".shp", ".shx", ".dbf", ".prj")

# Comune class -> short code, strongest first (polygons overlap a little at junctions: the stronger class keeps the overlap).
CLASSES = [("AUTOSTRADA", "motorway"), ("URBANA DI SCORRIMENTO", "arterial"), ("EXTRAURBANA PRINCIPALE", "extra_main"),
           ("EXTRAURBANA SECONDARIA", "extra_sec"), ("URBANA DI QUARTIERE", "urban"), ("STRADA LOCALE/VICINALE", "local")]
CODE_OF = dict(CLASSES)
# The Comune polygon is the whole street space between frontages (carriageway plus pavements). Measured: 52 % of its boundary in
# the centro and 26 % along Via della Liberta lies within 0.5 m of a building; Via Maqueda's polygon is 12.3 m wide, wall to wall 12.1 m.
# So the carriageway is the polygon eroded by the pavement width, and the pavement is the band that was removed.
# Pavement widths come from 1,259 OSM footway=sidewalk ways: the distance from a sidewalk centreline to the polygon edge is 1.05 m (urban,
# p25), 1.38 m (arterial), 1.28 m (extra_main), medians 1.8, 2.4, 2.0; twice the p25 is used (OSM sidewalks are mapped mostly on wide
# streets, Mapillary shows 1.5 to 2 m pavements on ordinary streets).
PAVEMENT_W = {"motorway": 0.0, "arterial": 3.0, "extra_main": 2.0, "extra_sec": 1.5, "urban": 2.0, "local": 1.5}
VERGE_W = {"motorway": 0.0, "arterial": 1.5, "extra_main": 1.5, "extra_sec": 1.5, "urban": 1.0, "local": 1.0}
SHOULDER_W = {"motorway": 3.0}      # hard shoulder (asphalt-like), motorways only
PLAZA_FAR = 10.0                    # carriageway further than this from every OSM centreline, in blobs wider than 2 * PLAZA_OPEN, is a square or car park
PLAZA_OPEN = 4.0
PLAZA_CLASSES = ("urban", "local", "arterial")
SIDEWALK_MAX_HALF = 1.5             # a mapped sidewalk line is the middle of a pavement, taken at most 3 m wide (Mapillary: narrow pavements)
MIN_CARRIAGE = 4.5                  # a street narrower than this plus two bands has no pavement (alley, vicolo)
NEAR_BUILDING = 8.0                 # a polygon edge within this distance of a building gets a pavement, otherwise a verge
OSM_CLASS = {"motorway": "motorway", "motorway_link": "motorway", "trunk": "arterial", "trunk_link": "arterial",
             "primary": "arterial", "primary_link": "arterial", "secondary": "arterial", "secondary_link": "arterial",
             "tertiary": "urban", "tertiary_link": "urban", "unclassified": "local", "residential": "urban",
             "living_street": "local", "service": "local", "pedestrian": "urban"}
# Streets that OSM maps as highway=pedestrian but that are asphalt roads with an edge line (decree list says no, Mapillary says no).
# Source: docs/faithfulness/survey/mapillary.md findings 8 (ce04 ce05 ce27, Aug/Sep 2021) and the 2016 decree list (dataset 850).
ASPHALT_STREETS = {"Via Maqueda"}
CENTRES = {   # name: (lat, lon), stats within RADIUS metres, overlay window WINDOW metres wide
    "centro": (38.11572, 13.36126), "liberta": (38.1330, 13.3500), "mondello": (38.2054, 13.3235),
    "zen": (38.1816, 13.3160), "oreto": (38.1020, 13.3715),
}
RADIUS, WINDOW = 600.0, 480.0


def proj(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


# ----------------------------------------------------------------------------------------------
# Download (each file into its own new empty folder, untrusted)
# ----------------------------------------------------------------------------------------------
def download(base):
    os.makedirs(base, exist_ok=True)
    for name, (url, kind) in DOWNLOADS.items():
        d = os.path.join(base, name)
        os.makedirs(d, exist_ok=True)
        if os.listdir(d):
            sys.exit(f"{d} is not empty, use a new folder")
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        if kind == "csv":
            with open(os.path.join(d, "aree_pedonali.csv"), "wb") as f:
                f.write(data)
        else:
            zp = os.path.join(d, "dl.zip")
            with open(zp, "wb") as f:
                f.write(data)
            with zipfile.ZipFile(zp) as z:
                for m in z.namelist():
                    base_name = os.path.basename(m)     # never trust the path inside the archive
                    if base_name.lower().endswith(KEEP_EXT) and not m.endswith("/"):
                        with open(os.path.join(d, base_name), "wb") as f:
                            f.write(z.read(m))
        print(f"{name}: {len(data) / 1e6:.1f} MB from {url} -> {d}")


# ----------------------------------------------------------------------------------------------
# Comune data
# ----------------------------------------------------------------------------------------------
def to_game(geom, dx=0.0, dz=0.0):
    """EPSG:3004 (Monte Mario / Italy zone 2) geometry -> game metres (x east, z south of Quattro Canti), optionally shifted."""
    from pyproj import Transformer
    tr = Transformer.from_crs(3004, 4326, always_xy=True)

    def f(a):
        lon, lat = tr.transform(a[:, 0], a[:, 1])
        return np.column_stack([(lon - LON0) * KX + dx, -(lat - LAT0) * KZ + dz])
    return shapely.transform(geom, f)


def read_shp(folder, stem):
    import shapefile
    path = glob.glob(os.path.join(folder, stem + ".shp"))
    if not path:
        sys.exit(f"{stem}.shp not found in {folder}")
    r = shapefile.Reader(path[0], encoding="latin-1")
    out = []
    for sr in r.shapeRecords():
        if sr.shape.shapeType == 0:
            continue
        g = shapely.geometry.shape(sr.shape.__geo_interface__)
        g = shapely.force_2d(g)
        out.append((sr.record.as_dict(), g if g.is_valid else shapely.make_valid(g)))
    return out


def load_comune_roads(folder):
    """[(class code, state, polygon in EPSG:3004)] from AREA_STRADALE."""
    out = []
    for rec, g in read_shp(folder, "AREA_STRADALE"):
        cls = rec["CLASSIFICA"].strip()
        if cls not in CODE_OF:
            continue
        out.append((CODE_OF[cls], rec["STATO"].strip() or "IN ESERCIZIO", g))
    return out


def calibrate_shift(com_game, lines):
    """The Comune data goes through a Helmert datum transform (a few metres of error). Find the shift of the Comune polygons that
    centres OSM carriageway centrelines in them: maximise the mean distance-to-polygon-edge of line pixels (0.5 m grid), per window."""
    import cv2
    res = 0.5
    shifts = []
    tree = shapely.STRtree([ln for _, ln in lines])
    ctree = shapely.STRtree(com_game)
    for lat, lon in [CENTRES["liberta"], CENTRES["mondello"], CENTRES["zen"], CENTRES["oreto"], (38.1157, 13.3612), (38.095, 13.40)]:
        cx, cz = proj(lat, lon)
        rect = box(cx - 400, cz - 400, cx + 400, cz + 400)
        w = int(800 / res)

        def tp(c):
            return np.round((np.asarray(c) - [cx - 400, cz - 400]) / res).astype(np.int32)
        m = np.zeros((w, w), np.uint8)
        for i in ctree.query(rect):
            for p in tiles.polys_of(com_game[i]):
                cv2.fillPoly(m, [tp(p.exterior.coords)], 255)
                for r in p.interiors:
                    cv2.fillPoly(m, [tp(r.coords)], 0)
        dt = cv2.distanceTransform(m, cv2.DIST_L2, 5) * res
        ln = np.zeros((w, w), np.uint8)
        for i in tree.query(rect):
            cv2.polylines(ln, [tp(lines[i][1].coords)], False, 255, 1)
        ys, xs = np.nonzero(ln)
        best, bs = (0, 0), -1
        for dz in range(-12, 13):
            for dx in range(-12, 13):
                s = dt[np.clip(ys + dz, 0, w - 1), np.clip(xs + dx, 0, w - 1)].mean()
                if s > bs:
                    best, bs = (dx, dz), s
        shifts.append((-best[0] * res, -best[1] * res))   # moving the lines by best == moving the polygons by -best
    sx = round(float(np.median([s[0] for s in shifts])) * 2) / 2
    sz = round(float(np.median([s[1] for s in shifts])) * 2) / 2
    return sx, sz, shifts


SAINTS = {"san", "santa", "sant", "santo", "s"}
EXPAND = (("pr. pe", "principe"), ("pr.pe", "principe"), ("p. zza", "piazza"), ("p.zza", "piazza"), ("p. zzetta", "piazzetta"),
          ("c. so", "corso"), ("v. le", "viale"))
STOP = {"via", "viale", "piazza", "piazzetta", "corso", "vicolo", "largo", "discesa", "salita", "strada", "di", "del", "della", "dei",
        "delle", "degli", "dello", "al", "alla", "dell", "e", "il", "la"}


def name_tokens(s):
    """Lower-case ASCII tokens without street-type words; san/santa/sant'/s. collapse to 's'."""
    s = unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode().replace("'", " ")
    for a, b in EXPAND:
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return [("s" if t in SAINTS else t) for t in s.split() if t not in STOP]


def tokens_match(row, osm):
    """Every decree token appears in the OSM name; a one-letter token (an initial) matches any token that starts with it."""
    if not row or not osm:
        return False
    return all(any(t == o or (len(t) == 1 and o.startswith(t)) for o in osm) for t in row)


def load_decree(csv_path):
    """Rows of the 2016 pedestrian-area list. Returns [{name, section, decree, ordinance, year, area_m2}]."""
    import csv
    with open(csv_path, encoding="cp1252", newline="") as f:
        rows = list(csv.reader(f, delimiter=";"))
    out = []
    for r in rows[1:]:
        if len(r) < 6 or not r[0].strip() or r[0].strip().lower().startswith("totale"):
            continue
        try:
            area = float(r[5].replace(".", "").replace(",", ".")) if r[5].strip() else None
        except ValueError:
            area = None
        year = int(r[4]) if r[4].strip().isdigit() else None
        out.append({"name": r[0].strip(), "section": r[1].strip(), "decree": r[2].strip(), "ordinance": r[3].strip(),
                    "year": year, "area_m2": area})
    return out


# ----------------------------------------------------------------------------------------------
# OSM
# ----------------------------------------------------------------------------------------------
def osm_buildings():
    """Footprints (outer rings, holes ignored: courtyards do not matter here) straight from the OSM cache, no lidar needed."""
    files = sorted(glob.glob(os.path.join(tiles.CITY, "pbf_bld_*.json.gz")))
    polys = []
    for e in tiles.iter_elements(files):
        t = e.get("tags") or {}
        if "building" not in t:
            continue
        if e["type"] == "way" and e.get("geometry") and tiles.is_closed(e):
            ring = tiles.ring_of(e)
            if len(ring) >= 3:
                polys.append(Polygon(ring))
        elif e["type"] == "relation":
            for o in tiles.member_rings(e, "outer"):
                if len(o) >= 3:
                    polys.append(Polygon(o))
    polys = [p for p in shapely.make_valid(np.array(polys, dtype=object)) if not p.is_empty]
    return [g for p in polys for g in tiles.polys_of(p)]


def osm_highways():
    """Drivable and pedestrian centrelines with their tags, plus sidewalk evidence (tags and footway=sidewalk lines)."""
    from streets import width_of
    files = sorted(glob.glob(os.path.join(tiles.CITY, "pbf_hwy_*.json.gz")))
    roads, sidewalks, nosw = [], [], []
    for e in tiles.iter_elements(files):
        t = e.get("tags") or {}
        hw = t.get("highway")
        if e["type"] != "way" or not e.get("geometry") or not hw:
            continue
        pts = tiles.way_pts(e)
        if len(pts) < 2:
            continue
        ls = LineString(pts)
        if hw == "footway" and t.get("footway") == "sidewalk":
            sidewalks.append(ls)
            continue
        if hw in OSM_CLASS:
            tunnel = t.get("tunnel") in ("yes", "culvert", "building_passage") or t.get("covered") == "yes"
            cw = width_of(t, tiles.CARRIAGEWAY.get(hw, 5.5))
            sw = {k: t[k] for k in ("sidewalk", "sidewalk:both", "sidewalk:left", "sidewalk:right") if k in t}
            closed = tiles.is_closed(e) and t.get("area") == "yes"
            roads.append({"hw": hw, "name": t.get("name"), "cw": cw, "tunnel": tunnel, "line": ls, "sw": sw, "closed_area": closed,
                          "poly": Polygon(pts).buffer(0) if closed and len(pts) >= 4 else None})
    return roads, sidewalks


# ----------------------------------------------------------------------------------------------
# Geometry helpers
# ----------------------------------------------------------------------------------------------
def clean(g, min_area=0.4):
    """Valid polygonal geometry without slivers."""
    if g is None or g.is_empty:
        return Polygon()
    g = tiles.poly_only(shapely.make_valid(g) if not g.is_valid else g)
    g = tiles.poly_only(g.buffer(0.04).buffer(-0.04))
    ps = [p for p in tiles.polys_of(g) if p.area >= min_area]
    if not ps:
        return Polygon()
    try:
        return unary_union(ps)
    except shapely.errors.GEOSException:     # near-coincident edges: snap to a 5 cm grid
        return shapely.union_all(ps, grid_size=0.05)


def edge_band(g, w, min_core):
    """The band of width w inside the polygon edge, only where the street stays at least min_core wide after the band."""
    if w <= 0 or g.is_empty:
        return Polygon()
    r = min_core / 2 + w
    opened = g.buffer(-r, quad_segs=4).buffer(r, quad_segs=4)
    return clean(tiles.I(tiles.D(g, g.buffer(-w, quad_segs=4)), opened))


def to_records(geom, **extra):
    out = []
    for p in tiles.polys_of(geom):
        p = tiles.poly_only(shapely.set_precision(p, 0.1))
        for q in tiles.polys_of(p):
            if q.area < 0.4:
                continue
            rec = dict(extra)
            rec["p"] = tiles.ring_flat(q.exterior.coords)
            if q.interiors:
                rec["h"] = [tiles.ring_flat(r.coords) for r in q.interiors]
            out.append(rec)
    return out


def from_records(recs):
    return [Polygon([(r["p"][i], r["p"][i + 1]) for i in range(0, len(r["p"]), 2)],
                    [[(h[i], h[i + 1]) for i in range(0, len(h), 2)] for h in r.get("h", [])]) for r in recs]


def area_in(geom, window):
    return 0.0 if geom.is_empty else geom.intersection(window).area


# ----------------------------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------------------------
def match_decree(rows, osm_names):
    """Attach to each decree row the OSM pedestrian street names it matches (a row can name several streets: 'a e b', 'a - b')."""
    toks = {n: name_tokens(n) for n in osm_names}
    for row in rows:
        parts = [p for p in re.split(r"\s+e\s+|\s+-\s+|,", row["name"]) if p.strip()] or [row["name"]]
        hits = set()
        for part in parts:
            rt = name_tokens(part)
            hits |= {n for n, ot in toks.items() if tokens_match(rt, ot)}
        row["osm_names"] = sorted(hits)
    return rows


# ----------------------------------------------------------------------------------------------
# Per-cell derivation (forked workers read the big shared geometry from G)
# ----------------------------------------------------------------------------------------------
G = {}
CELL = 1500.0      # metres per work cell
CMARGIN = 60.0     # geometry computed beyond each cell so edge bands line up across cell borders


def rect_clip(g, x0, z0, x1, z1):
    if g is None or g.is_empty:
        return Polygon()
    return tiles.poly_only(shapely.clip_by_rect(g, x0, z0, x1, z1))


def fill_parts(line, covered):
    out = line.difference(covered) if line.intersects(covered) else line
    parts = [out] if out.geom_type == "LineString" else [x for x in getattr(out, "geoms", []) if x.geom_type == "LineString"]
    return [p for p in parts if p.length > 3.0]


def cell_job(ij):
    i, j = ij
    x0, z0, x1, z1 = i * CELL, j * CELL, (i + 1) * CELL, (j + 1) * CELL
    wx0, wz0, wx1, wz1 = x0 - CMARGIN, z0 - CMARGIN, x1 + CMARGIN, z1 + CMARGIN
    win = box(wx0, wz0, wx1, wz1)
    out = {"carriageway": [], "pavement": [], "verge": [], "plaza": []}
    stats = {}
    nz = rect_clip(G["near_zone"], wx0, wz0, wx1, wz1)
    zone = rect_clip(G["ped_zone"], wx0, wz0, wx1, wz1)

    def put(layer, geom, **extra):
        g = rect_clip(geom, x0, z0, x1, z1)
        if not g.is_empty:
            out[layer] += to_records(g, **extra)

    gcl = {code: rect_clip(plat, wx0, wz0, wx1, wz1) for code, plat in G["platform"].items()}
    strips = {code: [] for code in gcl}    # (width, geometry) per mapped OSM footway=sidewalk inside this class's platform
    for k in G["sidewalk_tree"].query(win):
        ln = G["sidewalks"][k]
        mid = ln.interpolate(0.5, normalized=True)
        for code, g in gcl.items():
            if g.is_empty or not g.contains(mid):
                continue
            hw = min(max(mid.distance(g.boundary), 0.75), SIDEWALK_MAX_HALF)    # the line is taken as the middle of the pavement
            try:
                st = tiles.I(ln.buffer(hw, cap_style="flat", quad_segs=2), g)
            except shapely.errors.GEOSException:
                break
            if st.area > 1.0:
                strips[code].append((round(2 * hw, 1), st))
            break

    for code, plat in G["platform"].items():
        g = gcl[code]
        if g.is_empty:
            continue
        pw, vw, sw = PAVEMENT_W[code], VERGE_W[code], SHOULDER_W.get(code, 0.0)
        try:
            pav = clean(tiles.I(edge_band(g, pw, MIN_CARRIAGE), nz)) if pw else Polygon()
            sh = edge_band(g, sw, 6.0) if sw else Polygon()
            vg = clean(tiles.D(tiles.D(edge_band(g, vw, MIN_CARRIAGE), nz), pav)) if vw else Polygon()
            car = clean(tiles.D(g, unary_union([pav, vg, sh])))
            sstrip = clean(unary_union([st for _, st in strips[code]])) if strips[code] else Polygon()
            if not sstrip.is_empty:   # mapped sidewalks win over the class width
                car, pav, vg = (clean(tiles.D(x, sstrip)) if not x.is_empty else x for x in (car, pav, vg))
            if not zone.is_empty:     # decreed pedestrian streets: the bake draws them as paving
                car, pav, vg, sh, sstrip = (clean(tiles.D(x, zone)) if not x.is_empty else x for x in (car, pav, vg, sh, sstrip))
        except shapely.errors.GEOSException:
            stats["_errors"] = stats.get("_errors", 0) + 1
            continue
        if code in PLAZA_CLASSES and not car.is_empty:    # squares, car parks, wide gores: far from any drawn road line
            try:
                near = unary_union([G["drive_lines"][k] for k in G["drive_tree"].query(win)]).buffer(PLAZA_FAR, quad_segs=3)
                far = tiles.D(car, near)
                far = clean(tiles.poly_only(far.buffer(-PLAZA_OPEN, quad_segs=2)).buffer(PLAZA_OPEN, quad_segs=2).intersection(car), 100.0)
                if not far.is_empty:
                    car = clean(tiles.D(car, far))
                    put("plaza", far, c=code, src="comune")
            except shapely.errors.GEOSException:
                stats["_errors"] = stats.get("_errors", 0) + 1
        put("carriageway", car, c=code, src="comune")
        for w, st in strips[code]:
            put("pavement", tiles.D(st, zone), c=code, src="osm_sidewalk", w=w)
        put("pavement", pav, c=code, src="comune", w=pw)
        put("verge", vg, c=code, k="verge", src="comune", w=vw)
        put("verge", sh, c=code, k="shoulder", src="comune", w=sw)

    # OSM fill where the Comune has no polygon (centreline buffer, same rules)
    covered = rect_clip(G["taken_buf"], wx0, wz0, wx1, wz1)
    bl = rect_clip(G["bld_union"], wx0, wz0, wx1, wz1)
    taken = rect_clip(G["taken"], wx0, wz0, wx1, wz1)
    fc, fp, fv = {}, {}, {}
    for k in G["road_tree"].query(win):
        r = G["fill_roads"][k]
        for p in fill_parts(r["line"], covered):
            c = p.interpolate(0.5, normalized=True)
            if x0 <= c.x < x1 and z0 <= c.y < z1:
                stats[r["hw"]] = stats.get(r["hw"], 0.0) + p.length
            code = r["code"]
            cw, pw = r["cw"], PAVEMENT_W[code]
            fc.setdefault(code, []).append(p.buffer(cw / 2, cap_style="flat", quad_segs=3))
            fp.setdefault(code, []).append(p.buffer(cw / 2 + pw, cap_style="flat", quad_segs=3))
            fv.setdefault(code, []).append(p.buffer(cw / 2 + VERGE_W[code], cap_style="flat", quad_segs=3))
    for code in fc:
        try:
            fill_layers(code, fc, fp, fv, bl, taken, zone, nz, put)
        except shapely.errors.GEOSException:
            stats["_errors"] = stats.get("_errors", 0) + 1
    return out, stats


def fill_layers(code, fc, fp, fv, bl, taken, zone, nz, put):
    carp = unary_union(fc[code])
    c = clean(tiles.D(tiles.D(tiles.D(carp, bl), taken), zone))
    pv = Polygon()
    if PAVEMENT_W[code]:
        band = tiles.D(unary_union(fp[code]), carp)
        for cut in (bl, taken, c, zone):
            band = tiles.D(band, cut)
        pv = clean(tiles.I(band, nz))
    band = tiles.D(unary_union(fv[code]), carp)
    for cut in (bl, taken, c, pv, zone, nz):
        band = tiles.D(band, cut)
    vg = clean(band)
    put("carriageway", c, c=code, src="osm")
    put("pavement", pv, c=code, src="osm", w=PAVEMENT_W[code])
    put("verge", vg, c=code, k="verge", src="osm", w=VERGE_W[code])


def pedestrian_zones(roads, platform_all, bld_union, decree):
    """Which OSM highway=pedestrian ways stay paving. Returns (zone geometry, zone records, review list).
    decreed: named in the 2016 decree list. Not decreed and mostly inside a Comune road polygon: the Comune treats it as a road, so it is
    left as carriageway (review list; Via Maqueda is the Mapillary-confirmed case). Not decreed and outside the polygons: OSM-only paving."""
    ped = [r for r in roads if r["hw"] == "pedestrian" and not r["tunnel"]]
    names = sorted({r["name"] for r in ped if r["name"]})
    match_decree(decree, names)
    decreed = {}
    for row in decree:
        for n in row["osm_names"]:
            decreed.setdefault(n, row)
    review, recs, zones = {}, [], []
    for r in ped:
        n = r["name"] or ""
        geom = r["poly"] if r["poly"] is not None else r["line"]
        length = geom.length if r["poly"] is None else r["poly"].exterior.length
        bx = geom.bounds
        local = rect_clip(platform_all, bx[0] - 12, bx[1] - 12, bx[2] + 12, bx[3] + 12)     # the platform is one huge multipolygon
        inside = geom.intersection(local).length if r["poly"] is None else r["poly"].intersection(local).area / max(r["poly"].area, 1e-6) * length
        pct = 100 * min(inside / max(length, 1e-6), 1.0)
        row = decreed.get(n)
        if n in ASPHALT_STREETS:
            status = "asphalt_override"
        elif row:
            status = "decreed"
        elif pct >= 60:
            status = "road_in_comune"
        else:
            status = "osm_only"
        e = review.setdefault((n or "(unnamed)", status), {"name": n or "(unnamed)", "status": status, "ways": 0, "m": 0.0, "in_platform_pct": 0.0})
        e["ways"] += 1
        e["m"] += length
        e["in_platform_pct"] += pct * length
        if status in ("decreed", "osm_only"):
            if r["poly"] is not None:
                z = r["poly"]
            else:
                z = r["line"].buffer(6.5 if status == "decreed" else 3.5, cap_style="flat", quad_segs=3)
                if status == "decreed":
                    z = tiles.I(z, unary_union([local, r["line"].buffer(3.5, cap_style="flat")]))
            z = clean(tiles.D(z, rect_clip(bld_union, bx[0] - 12, bx[1] - 12, bx[2] + 12, bx[3] + 12)))
            if not z.is_empty:
                zones.append(z)
                extra = {"s": status, "n": n}
                if row and row["year"]:
                    extra["y"] = row["year"]
                recs += to_records(z, **extra)
    for e in review.values():
        e["in_platform_pct"] = round(e["in_platform_pct"] / max(e["m"], 1e-6), 1)
        e["m"] = round(e["m"])
    rev = sorted(review.values(), key=lambda e: -e["m"])
    return unary_union(zones) if zones else Polygon(), recs, rev


def build(args):
    import time
    import multiprocessing as mp
    t0 = time.time()

    def log(msg):
        print(f"[{time.time() - t0:5.0f}s] {msg}", flush=True)

    raw = load_comune_roads(args.strada)
    log(f"Comune road polygons: {len(raw)}")
    roads, sidewalks = osm_highways()
    cl_lines = [(r, r["line"]) for r in roads if r["hw"] in ("residential", "tertiary", "secondary", "primary", "unclassified") and not r["tunnel"]]
    game0 = [to_game(g) for _, _, g in raw]
    sx, sz, per_window = calibrate_shift(game0, cl_lines)
    log(f"datum shift from OSM centrelines: dx {sx:+.1f} m, dz {sz:+.1f} m (per window {per_window})")

    by_class = {}
    for (code, state, _), g in zip(raw, game0):
        g = shapely.make_valid(shapely.transform(g, lambda a: a + [sx, sz]))
        by_class.setdefault(code, []).append((state, g))
    platform, taken = {}, Polygon()
    for _, code in CLASSES:     # strongest class first wins the overlap at junctions
        if code not in by_class:
            continue
        u = clean(unary_union([g for _, g in by_class[code]]), 0.2)
        u = clean(tiles.D(u, taken), 0.2)
        platform[code] = u
        taken = unary_union([taken, u])
    construction = unary_union([g for code in by_class for st, g in by_class[code] if st != "IN ESERCIZIO"])
    log("platform per class: " + ", ".join(f"{k} {v.area / 1e6:.2f} km2" for k, v in platform.items()))

    bld = osm_buildings()
    bld_union = unary_union(bld)
    near_zone = clean(unary_union(shapely.buffer(np.array(bld, dtype=object), NEAR_BUILDING, quad_segs=2)))
    log(f"OSM buildings: {len(bld)}, zones built")

    decree = load_decree(args.csv)
    ped_zone, ped_recs, ped_review = pedestrian_zones(roads, taken, bld_union, decree)
    log("pedestrian OSM ways: " + ", ".join(f"{k} {sum(e['m'] for e in ped_review if e['status'] == k) / 1e3:.2f} km"
                                            for k in ("decreed", "osm_only", "road_in_comune", "asphalt_override")))

    fill_roads = []
    total_len = {}
    for r in roads:
        hw = r["hw"]
        if r["tunnel"] or r["closed_area"] or (hw not in tiles.CARRIAGEWAY and hw not in ("pedestrian", "living_street")):
            continue
        total_len[hw] = total_len.get(hw, 0.0) + r["line"].length
        if hw == "pedestrian" and r["name"] not in ASPHALT_STREETS:
            continue    # real pedestrian streets keep their paving, the bake already draws them
        fill_roads.append({"hw": hw, "line": r["line"], "code": OSM_CLASS[hw], "cw": 7.5 if hw == "pedestrian" else r["cw"]})
    taken_buf = taken.buffer(1.5)
    drive = [r["line"] for r in roads if not r["tunnel"] and not r["closed_area"]]
    G.update(drive_lines=drive, drive_tree=shapely.STRtree(drive), sidewalks=sidewalks, sidewalk_tree=shapely.STRtree(sidewalks), platform=platform, near_zone=near_zone, ped_zone=ped_zone, taken=taken, taken_buf=taken_buf, bld_union=bld_union,
             fill_roads=fill_roads, road_tree=shapely.STRtree([r["line"] for r in fill_roads]))

    x0, z0, x1, z1 = tiles.world_rect()
    cells = [(i, j) for i in range(int(math.floor(x0 / CELL)), int(math.floor(x1 / CELL)) + 1)
             for j in range(int(math.floor(z0 / CELL)), int(math.floor(z1 / CELL)) + 1)]
    layers = {"carriageway": [], "pavement": [], "verge": [], "plaza": []}
    uncovered = {}
    with mp.get_context("fork").Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        for n, (o, stats) in enumerate(pool.imap_unordered(cell_job, cells)):
            for k in layers:
                layers[k] += o[k]
            for hw, v in stats.items():
                if hw == "_errors":
                    log(f"  WARNING {v} geometry failures in a cell (that part skipped)")
                else:
                    uncovered[hw] = uncovered.get(hw, 0.0) + v
            if n % 40 == 0:
                log(f"  cells {n}/{len(cells)}")
    layers["platform"] = [rec for code, g in platform.items() for rec in to_records(g, c=code)]
    log("OSM fill: " + ", ".join(f"{k} {v / 1e3:.1f} of {total_len[k] / 1e3:.1f} km uncovered" for k, v in sorted(uncovered.items())))

    ped_polys = []
    for rec, g in read_shp(args.pedonale, "AREA_CIRCOLAZIONE_PEDONALE_A"):
        zona = (rec["ZONA"] or "").strip() or "SENZA NOME"
        ped_polys.append((zona, clean(shapely.transform(to_game(g), lambda a: a + [sx, sz]), 0.5)))
    zones = {"VIALETTO": "path", "PERCORSO A GRADINATE": "stairs", "PASSAGGIO PEDONALE": "crossing", "SENZA NOME": "path"}
    pedestrian_areas = []
    for zona, g in ped_polys:
        pedestrian_areas += to_records(g, z=zones.get(zona, "path"))

    meta = {
        "sources": {
            "roads": "Comune di Palermo, Perimetrazione Area Stradale (dataset 280), CC BY 4.0, issued 2013-02-22, surveyed 2011-12, EPSG:3004",
            "pedestrian_areas": "Comune di Palermo, Area di Circolazione Pedonale (dataset 281), CC BY 4.0, EPSG:3004",
            "pedestrian_decrees": "Comune di Palermo, Le aree pedonali, aggiornamento all'anno 2016 (dataset 850), CC BY 4.0",
            "osm": "Map data (c) OpenStreetMap contributors, ODbL (carriageway centrelines, buildings)",
        },
        "credit": "Contains Comune di Palermo open data (Perimetrazione Area Stradale, Aree pedonali), CC BY 4.0, opendata.comune.palermo.it",
        "crs": "game metres: x east, z south of Quattro Canti (tools/bake.py LAT0/LON0/KX/KZ)",
        "datum_shift_m": [sx, sz],
        "classes": {code: {"pavement_w": PAVEMENT_W[code], "verge_w": VERGE_W[code], "shoulder_w": SHOULDER_W.get(code, 0)} for _, code in CLASSES},
        "rules": {"min_carriageway_m": MIN_CARRIAGE, "near_building_m": NEAR_BUILDING,
                  "layers": {"platform": "Comune polygon, the street space between frontages, disjoint per class",
                             "carriageway": "asphalt; src comune = platform minus bands, src osm = centreline buffer where the Comune has no polygon",
                             "pavement": "edge band of width w where the street stays >= min_carriageway wide after both bands and a building is within near_building_m",
                             "verge": "k verge = edge band of width w away from buildings, k shoulder = motorway hard shoulder",
                             "plaza": "carriageway parts far from any road line (squares, car parks): paving or ground, not asphalt",
                             "pedestrian": "paving: s decreed (2016 decree list, y = year) or osm (OSM only, outside Comune road polygons)",
                             "pedestrian_areas": "Comune dataset 281: z path (park/estate footpaths), stairs, crossing"}},
        "counts": {k: len(v) for k, v in layers.items()} | {"pedestrian": len(ped_recs), "pedestrian_areas": len(pedestrian_areas)},
        "under_construction_ha": round(construction.area / 1e4, 2) if not construction.is_empty else 0,
        "pedestrian_osm_km": {st: round(sum(e["m"] for e in ped_review if e["status"] == st) / 1e3, 2)
                              for st in ("decreed", "osm_only", "road_in_comune", "asphalt_override")},
        "pedestrian_review": ped_review[:120],
        "decree_rows": len(decree),
        "decree_unmatched": [d["name"] for d in decree if not d["osm_names"]],
    }
    result = {"meta": meta, **layers, "pedestrian": ped_recs, "pedestrian_areas": pedestrian_areas,
              "decree": [{k: v for k, v in d.items()} for d in decree]}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(result, f, separators=(",", ":"), ensure_ascii=False)
    log(f"wrote {args.out}: {os.path.getsize(args.out) / 1e6:.1f} MB, counts {meta['counts']}")
    return result


def load_state(result, log):
    """Everything the report needs that is not in the JSON: OSM roads, sidewalks, buildings."""
    roads, sidewalks = osm_highways()
    bld = osm_buildings()
    return {"roads": roads, "sidewalks": sidewalks, "bld_union": unary_union(bld), "shift": result["meta"]["datum_shift_m"], "log": log}


# ----------------------------------------------------------------------------------------------
# Quality report (reads world/tiles, never writes there)
# ----------------------------------------------------------------------------------------------
def world_layers(rect):
    """Current game street layers (and building outlines) inside rect = (x0, z0, x1, z1), as shapely geometries."""
    x0, z0, x1, z1 = rect
    L = {k: [] for k in ("asphalt", "paving", "raised", "green", "water", "sand")}
    B = []
    for i in range(int(math.floor(x0 / 500)), int(math.floor(x1 / 500)) + 1):
        for j in range(int(math.floor(z0 / 500)), int(math.floor(z1 / 500)) + 1):
            path = os.path.join(WORLD_TILES, f"{i}_{j}.json")
            if not os.path.exists(path):
                continue
            with open(path) as f:
                d = json.load(f)
            for k in L:
                for pg in d["streets"][k]:
                    L[k].append(Polygon([(pg[0][n], pg[0][n + 1]) for n in range(0, len(pg[0]), 2)],
                                        [[(h[n], h[n + 1]) for n in range(0, len(h), 2)] for h in pg[1:]]))
            for b in d["buildings"]:
                p = b["p"]
                B.append(Polygon([(p[n], p[n + 1]) for n in range(0, len(p), 2)]))
    out = {k: clean(unary_union([g.buffer(0) for g in v]), 0.1) if v else Polygon() for k, v in L.items()}
    return out, B


def raster(rect, res, layers):
    import cv2
    x0, z0, x1, z1 = rect
    w, h = int((x1 - x0) / res), int((z1 - z0) / res)
    img = np.full((h, w, 3), 255, np.uint8)

    def tp(c):
        return np.round((np.asarray(c) - [x0, z0]) / res).astype(np.int32)
    for g, color in layers:
        if g.is_empty:
            continue
        m = np.zeros((h, w), np.uint8)
        for p in tiles.polys_of(g):
            cv2.fillPoly(m, [tp(p.exterior.coords)], 255)
            for r in p.interiors:
                cv2.fillPoly(m, [tp(r.coords)], 0)
        img[m > 0] = color[::-1]    # layers are given as RGB
    return img


def label(img, text):
    import cv2
    cv2.putText(img, text, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 3)
    cv2.putText(img, text, (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)


def union_of(result, key, **where):
    recs = [r for r in result[key] if all(r.get(k) == v for k, v in where.items())]
    return unary_union(from_records(recs)) if recs else Polygon()


def pct(v):
    return None if v is None else round(float(v), 1)


def report(args, result, st):
    log = st["log"]
    os.makedirs(args.report, exist_ok=True)
    platform = union_of(result, "platform")
    derived = {"carriageway": union_of(result, "carriageway"), "pavement": union_of(result, "pavement"),
               "verge": union_of(result, "verge", k="verge"), "shoulder": union_of(result, "verge", k="shoulder"),
               "pedestrian": union_of(result, "pedestrian"), "plaza": union_of(result, "plaza")}
    osm_car = union_of(result, "carriageway", src="osm")
    meta = result["meta"]
    rep = {"shift_m": st["shift"], "districts": {}}

    # ---- Comune (2011-12) against OSM today ------------------------------------------------
    taken = platform.buffer(1.5)
    shapely.prepare(taken)
    named, tot, unc = {}, {}, {}
    for r in st["roads"]:
        if r["hw"] not in tiles.CARRIAGEWAY or r["tunnel"]:
            continue
        L = r["line"].difference(taken).length
        tot[r["hw"]] = tot.get(r["hw"], 0.0) + r["line"].length / 1e3
        unc[r["hw"]] = unc.get(r["hw"], 0.0) + L / 1e3
        if L > 0 and r["name"]:
            named[r["name"]] = named.get(r["name"], 0.0) + L
    tot, unc = {k: round(v, 1) for k, v in tot.items()}, {k: round(v, 1) for k, v in unc.items()}
    osm_buf = unary_union([r["line"] for r in st["roads"] if r["hw"] in tiles.CARRIAGEWAY and not r["tunnel"]]).buffer(15)
    orphan = tiles.poly_only(platform.difference(osm_buf))
    rep["outdated"] = {
        "osm_drivable_km": round(sum(tot.values()), 1),
        "osm_drivable_km_not_within_1_5m_of_a_comune_polygon": round(sum(unc.values()), 1),
        "by_class_km_total_vs_outside": {k: [tot[k], unc.get(k, 0)] for k in sorted(tot)},
        "top_named_streets_outside_m": {k: round(v) for k, v in sorted(named.items(), key=lambda kv: -kv[1])[:30]},
        "comune_platform_ha": round(platform.area / 1e4, 1),
        "comune_ha_without_osm_road_within_15m": round(orphan.area / 1e4, 1),
        "under_construction_ha": meta["under_construction_ha"],
    }

    # ---- sidewalk evidence -----------------------------------------------------------------
    mids = [s.interpolate(0.5, normalized=True) for s in st["sidewalks"]]
    shapely.prepare(platform)
    cls_of = {c: union_of(result, "platform", c=c) for c in PAVEMENT_W}
    for g in derived.values():
        shapely.prepare(g)
    hits = {k: 0 for k in ("pavement", "carriageway", "verge", "pedestrian", "outside_platform")}
    per_class = {c: [] for c in PAVEMENT_W}
    for p in mids:
        if not platform.contains(p):
            hits["outside_platform"] += 1
            continue
        for k in ("pavement", "verge", "pedestrian", "carriageway"):
            if derived[k].distance(p) < 0.6:
                hits[k] += 1
                break
        for c, g in cls_of.items():
            if not g.is_empty and g.contains(p):
                per_class[c].append(p.distance(g.boundary))
    n = max(1, len(mids))
    rep["sidewalk_ways"] = {"n": len(mids), "mid_lands_in_pct": {k: round(100 * v / n, 1) for k, v in hits.items()},
                            "mid_to_platform_edge_m_p25_p50_p75": {c: [round(float(x), 2) for x in np.percentile(v, [25, 50, 75])]
                                                                  for c, v in per_class.items() if len(v) >= 10}}
    tag_counts = {}
    for r in st["roads"]:
        for k, v in r["sw"].items():
            tag_counts[f"{k}={v}"] = tag_counts.get(f"{k}={v}", 0) + 1
    rep["sidewalk_tags_on_roads"] = dict(sorted(tag_counts.items(), key=lambda kv: -kv[1])[:12])
    rep["streets"] = street_widths(st, derived, platform, ["Via Maqueda", "Via Roma", "Via Emerico Amari", "Via Ruggero Settimo",
                                                           "Via Oreto", "Corso Calatafimi", "Via Notarbartolo", "Corso Vittorio Emanuele"])

    # ---- districts ---------------------------------------------------------------------
    for name, (lat, lon) in CENTRES.items():
        cx, cz = proj(lat, lon)
        circ = Point(cx, cz).buffer(RADIUS, quad_segs=16)
        W, B = world_layers((cx - RADIUS, cz - RADIUS, cx + RADIUS, cz + RADIUS))
        asphalt, raised, paving, green = (W[k].intersection(circ) for k in ("asphalt", "raised", "paving", "green"))
        d = {k: round(area_in(v, circ) / 1e4, 2) for k, v in derived.items()}
        d["platform_comune"] = round(area_in(platform, circ) / 1e4, 2)
        d["carriageway_osm_fill"] = round(area_in(osm_car, circ) / 1e4, 2)
        d["game_asphalt"] = round(asphalt.area / 1e4, 2)
        d["game_paving"] = round(paving.area / 1e4, 2)
        d["game_raised"] = round(raised.area / 1e4, 2)
        d["game_green"] = round(green.area / 1e4, 2)
        d["carriageway_over_game_asphalt"] = round(d["carriageway"] / max(d["game_asphalt"], 1e-6), 2)
        d["circle_ha"] = round(circ.area / 1e4, 1)
        rest, fate = raised, {}
        for key, g in (("carriageway", derived["carriageway"]), ("pavement", derived["pavement"]),
                       ("verge_shoulder", unary_union([derived["verge"], derived["shoulder"]])), ("pedestrian_paving", unary_union([derived["pedestrian"], derived["plaza"]]))):
            fate[key] = tiles.I(rest, g).area
            rest = tiles.D(rest, g)
        near3 = st["bld_union"].buffer(3.0)
        fate["ground_within_3m_of_building"] = tiles.I(rest, near3).area
        fate["ground_open"] = tiles.D(rest, near3).area
        tot_r = max(raised.area, 1e-6)
        d["raised_fate_pct"] = {k: round(100 * v / tot_r, 1) for k, v in fate.items()}
        d["raised_fate_ha"] = {k: round(v / 1e4, 2) for k, v in fate.items()}
        d["raised_share_of_circle_pct"] = round(100 * raised.area / circ.area, 1)
        rep["districts"][name] = d
        log(f"{name}: carriageway {d['carriageway']} (x{d['carriageway_over_game_asphalt']} of game asphalt {d['game_asphalt']}), "
            f"pavement {d['pavement']} ha; raised {d['game_raised']} ha -> {d['raised_fate_pct']}")
        overlay(args, name, cx, cz, W, B, derived, W["raised"])

    if args.citywide:
        rep["citywide"] = citywide_fate(result, log)
        log(f"citywide: {rep['citywide']}")
    with open(os.path.join(args.report, "report.json"), "w") as f:
        json.dump(rep, f, indent=1)
    log(f"report in {args.report}")
    return rep


def citywide_fate(result, log):
    """Where today's raised slab (all 1,119 baked tiles) lands in the proposed layers. Tile chunks are disjoint, so tile sums add up."""
    layers = [("carriageway", from_records(result["carriageway"])), ("pavement", from_records(result["pavement"])),
              ("verge_shoulder", from_records(result["verge"])), ("pedestrian_paving", from_records(result["pedestrian"] + result["plaza"]))]
    trees = [(name, shapely.STRtree(g), g) for name, g in layers]
    tot = {name: 0.0 for name, _ in layers} | {"ground_within_3m_of_building": 0.0, "ground_open": 0.0}
    raised_total = 0.0
    files = sorted(glob.glob(os.path.join(WORLD_TILES, "*.json")))
    for n, path in enumerate(files):
        with open(path) as f:
            d = json.load(f)
        pg = [Polygon([(c[0][i], c[0][i + 1]) for i in range(0, len(c[0]), 2)], [[(h[i], h[i + 1]) for i in range(0, len(h), 2)] for h in c[1:]])
              for c in d["streets"]["raised"]]
        if not pg:
            continue
        rest = clean(unary_union([g.buffer(0) for g in pg]), 0.1)
        raised_total += rest.area
        for name, tree, geoms in trees:
            hits = [geoms[i] for i in tree.query(rest)]
            if not hits:
                continue
            g = unary_union(hits)
            tot[name] += tiles.I(rest, g).area
            rest = tiles.D(rest, g)
        bl = [Polygon([(b["p"][i], b["p"][i + 1]) for i in range(0, len(b["p"]), 2)]) for b in d["buildings"]]
        near3 = unary_union(bl).buffer(3.0) if bl else Polygon()
        tot["ground_within_3m_of_building"] += tiles.I(rest, near3).area
        tot["ground_open"] += tiles.D(rest, near3).area
        if n % 200 == 0:
            log(f"  citywide {n}/{len(files)}")
    return {"raised_ha": round(raised_total / 1e4, 1), "fate_ha": {k: round(v / 1e4, 1) for k, v in tot.items()},
            "fate_pct": {k: round(100 * v / max(raised_total, 1), 1) for k, v in tot.items()}}


def street_widths(st, derived, platform, names):
    """Median Comune platform width, wall-to-wall width, derived carriageway width and pavement width per side along named OSM streets."""
    out = {}
    car, pav, bu = derived["carriageway"], derived["pavement"], st["bld_union"]
    for nm in names:
        sel = [r for r in st["roads"] if r["name"] == nm and (r["hw"] in tiles.CARRIAGEWAY or r["hw"] == "pedestrian") and not r["tunnel"]]
        rows = []
        for r in sel:
            ln = r["line"]
            for k in range(1, int(ln.length // 8)):
                p, q = ln.interpolate(k * 8), ln.interpolate(k * 8 + 1)
                dx, dz = q.x - p.x, q.y - p.y
                m = math.hypot(dx, dz) or 1
                nx, nz = -dz / m, dx / m
                side = []
                for s in (1, -1):
                    ray = LineString([(p.x, p.y), (p.x + s * nx * 25, p.y + s * nz * 25)])

                    def run(g, adjacent=True):
                        x = ray.intersection(g)
                        segs = [x] if x.geom_type == "LineString" else [y for y in getattr(x, "geoms", []) if y.geom_type == "LineString"]
                        if adjacent:
                            return max([y.length for y in segs if y.distance(p) < 1.0] or [0.0])
                        return sum(y.length for y in segs)
                    wall = ray.intersection(bu)
                    wd = 25.0 if wall.is_empty else min(Point(p).distance(y) for y in getattr(wall, "geoms", [wall]))
                    side.append((run(platform), wd, run(car), run(pav, False)))
                rows.append([side[0][0] + side[1][0], side[0][1] + side[1][1], side[0][2] + side[1][2], side[0][3], side[1][3]])
        if rows:
            a = np.array(rows)
            out[nm] = {"stations": len(rows), "comune_platform_w_m": round(float(np.median(a[:, 0])), 1),
                       "wall_to_wall_w_m": round(float(np.median(a[:, 1])), 1), "derived_carriageway_w_m": round(float(np.median(a[:, 2])), 1),
                       "derived_pavement_w_m_per_side": round(float(np.median(np.concatenate([a[:, 3], a[:, 4]]))), 1)}
    return out


PAL = {"asphalt": (120, 120, 126), "paving": (214, 190, 150), "raised": (226, 204, 232), "green": (150, 215, 140),
       "carriageway": (120, 120, 126), "pavement": (232, 218, 178), "verge": (150, 160, 80), "shoulder": (82, 82, 92),
       "plaza": (196, 170, 130), "bld": (58, 58, 60), "removed": (240, 150, 150), "osm": (96, 112, 168)}


def overlay(args, name, cx, cz, W, B, derived, raised):
    import cv2
    half = WINDOW / 2
    rect = (cx - half, cz - half, cx + half, cz + half)
    win = box(*rect)
    res = WINDOW / 800
    bl = unary_union([b for b in B if b.intersects(win)]) if B else Polygon()
    cur = raster(rect, res, [(W["raised"], PAL["raised"]), (W["green"], PAL["green"]), (W["paving"], PAL["paving"]),
                             (W["asphalt"], PAL["asphalt"]), (bl, PAL["bld"])])
    crop = {k: v.intersection(win) for k, v in derived.items()}
    removed = raised.intersection(win)
    for k in crop:
        removed = tiles.D(removed, crop[k]) if not removed.is_empty else removed
    new = raster(rect, res, [(removed, PAL["removed"]), (W["green"], PAL["green"]), (crop["verge"], PAL["verge"]),
                             (crop["pedestrian"], PAL["paving"]), (crop["plaza"], PAL["plaza"]), (crop["pavement"], PAL["pavement"]), (crop["carriageway"], PAL["carriageway"]),
                             (crop["shoulder"], PAL["shoulder"]), (bl, PAL["bld"])])
    label(cur, f"{name} current: lilac raised slab, tan paving, grey asphalt")
    label(new, "proposed: grey road, cream pavement, olive verge, tan = paving/plaza, pink slab removed")
    cv2.imwrite(os.path.join(args.report, f"overlay_{name}.png"), np.hstack([cur, np.full((cur.shape[0], 6, 3), 0, np.uint8), new]))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--download", metavar="DIR", help="download the three sources into new folders under DIR")
    ap.add_argument("--strada", help="folder with AREA_STRADALE.shp")
    ap.add_argument("--pedonale", help="folder with AREA_CIRCOLAZIONE_PEDONALE_A.shp")
    ap.add_argument("--csv", help="aree_pedonali.csv (dataset 850)")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--report", help="write report.json and overlay PNGs here")
    ap.add_argument("--citywide", action="store_true", help="with --report: also the fate of the raised slab over all baked tiles (slow)")
    ap.add_argument("--citywide-only", action="store_true", help="add only the citywide slab numbers to an existing report.json")
    ap.add_argument("--report-only", action="store_true", help="skip the build, read --out and only write the report")
    args = ap.parse_args()
    if args.download:
        download(args.download)
        return
    import time
    t0 = time.time()

    def log(msg):
        print(f"[{time.time() - t0:5.0f}s] {msg}", flush=True)
    if args.citywide_only:
        with open(args.out) as f:
            result = json.load(f)
        path = os.path.join(args.report, "report.json")
        with open(path) as f:
            rep = json.load(f)
        rep["citywide"] = citywide_fate(result, log)
        with open(path, "w") as f:
            json.dump(rep, f, indent=1)
        log(f"citywide: {rep['citywide']}")
        return
    if args.report_only:
        with open(args.out) as f:
            result = json.load(f)
    else:
        if not (args.strada and args.pedonale and args.csv):
            ap.error("--strada, --pedonale and --csv are required (or --download DIR, or --report-only)")
        result = build(args)
    if args.report:
        report(args, result, load_state(result, log))


if __name__ == "__main__":
    main()
