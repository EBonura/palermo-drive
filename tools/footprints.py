"""Second building-footprint source: Comune di Palermo, Carta Tecnica Comunale "Unita' Volumetriche" (see docs/sources/comune-ctc-buildings.md).

    tools/.venv/bin/python -I tools/footprints.py SHP [--out data/footprints_extra.json] [--report DIR]

SHP is the path of VOLUMETRIE_7792.shp (the other three files of the shapefile sit next to it). Downloads are
untrusted data: unzip them into their own empty folder and pass the path, never run from inside it.

What it does:
  1. reads the 100k building-volume polygons (EPSG:7792, RDN2008 / UTM 33N) and projects them to game metres
     (x east, z south of Quattro Canti, the projection of tools/bake.py);
  2. drops slivers, sheds and anything already covered by an OSM building (data/city/pbf_bld_*.json.gz, the same
     cache tools/tiles.py bakes from);
  3. merges touching volume units into buildings, each unit keeps its own height as a part;
  4. writes data/footprints_extra.json (git-ignored) for tools/tiles.py to feed to its add().

--report DIR also writes the quality numbers (coverage per district, height check against the baked lidar roofs of
world/tiles) as report.json plus top-down comparison images.
"""
import argparse
import glob
import gzip
import json
import math
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
from bake import KX, KZ, LAT0, LON0, stitch  # noqa: E402

CITY = os.path.join(ROOT, "data", "city")
WORLD = os.path.join(ROOT, "world")
OUT = os.path.join(ROOT, "data", "footprints_extra.json")
SRC_CRS = "EPSG:7792"            # RDN2008 / UTM 33N (E,N), what the .prj says; EPSG:25833 differs by well under a metre here
BBOX_LL = (38.045, 13.235, 38.230, 13.455)   # s, w, n, e, the same box as tools/tiles.py

# Filters (metres, square metres)
MIN_AREA = 12.0          # below this a unit is a hut, tank or kiosk
MIN_WIDTH = 2.0          # thinner than this (negative buffer of half of it empties the shape) is a sliver or a wall
SHED_AREA = 40.0         # a unit smaller than this ...
SHED_HEIGHT = 2.6        # ... and lower than this is a shed, carport or garden store
MIN_HEIGHT = 1.5         # lower than this is a wall, terrace or pool surround, not a building
MAX_HEIGHT = 75.0        # taller than anything the comune has outside the tower blocks: treated as a survey error
# Overlap with OSM
OSM_NEAR = 1.0           # OSM footprints are grown by this before measuring, to absorb the 1 to 3 m offset between sources
DROP_COVERED = 0.2       # a unit with more than this share of its area inside (grown) OSM buildings is dropped; mid-range overlaps are
                         # mostly buildings OSM has since redrawn, rebuilt or merged, adding the rest would double them
# Merging
TOUCH_LEN = 1.5          # two units share a building when they share at least this much boundary (or overlap)
MAX_BUILDING = 2500.0    # merged footprint area cap, strongest shared walls merge first
SAME_HEIGHT = 0.8        # parts within this of the building's main height are not kept separately


def proj_ll(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


# ----------------------------------------------------------------------------------------------
# Comune di Palermo volume units
# ----------------------------------------------------------------------------------------------
def load_units(shp):
    """List of dicts {id, g (shapely Polygon, game metres), foot, eave, h}. Multipart shapes become several units."""
    import shapefile
    import shapely
    from pyproj import Transformer
    from shapely.geometry import Polygon
    sf = shapefile.Reader(shp)
    shapes = sf.shapes()
    recs = sf.records()
    tr = Transformer.from_crs(SRC_CRS, "EPSG:4326", always_xy=True)
    pts = np.concatenate([np.asarray(s.points, float) for s in shapes])
    lon, lat = tr.transform(pts[:, 0], pts[:, 1])
    X, Z = proj_ll(np.asarray(lat), np.asarray(lon))
    out, k = [], 0
    for s, r in zip(shapes, recs):
        n = len(s.points)
        xs, zs = X[k:k + n], Z[k:k + n]
        k += n
        starts = list(s.parts) + [n]
        outers, holes = [], []
        for a, b in zip(starts, starts[1:]):
            ring = np.column_stack([xs[a:b], zs[a:b]])
            if len(ring) < 4:
                continue
            sa = 0.5 * float(np.sum(ring[:-1, 0] * ring[1:, 1] - ring[1:, 0] * ring[:-1, 1]))
            # x east, z south flips the handedness: the shapefile's clockwise outers have positive area here
            (outers if sa > 0 else holes).append(ring)
        if not outers:
            continue
        polys = [Polygon(o) for o in outers]
        inner = [[] for _ in outers]
        for h in holes:
            p = Polygon(h).representative_point()
            for i, pg in enumerate(polys):
                if pg.contains(p):
                    inner[i].append(h)
                    break
        for o, hs in zip(outers, inner):
            g = Polygon(o, hs)
            if not g.is_valid:
                g = shapely.make_valid(g)
                gs = [q for q in getattr(g, "geoms", [g]) if q.geom_type == "Polygon" and q.area > 0]
                if not gs:
                    continue
                g = max(gs, key=lambda q: q.area)
            out.append({"id": int(r["ID"]), "g": g, "foot": float(r["QUOTA_PIED"]), "eave": float(r["QUOTA_GRON"]),
                        "h": float(r["ALTEZZA"])})
    return out


# ----------------------------------------------------------------------------------------------
# OSM buildings (the cache tools/tiles.py reads)
# ----------------------------------------------------------------------------------------------
def load_osm(files):
    """[(id, Polygon)] in game metres for every OSM building: closed ways and multipolygon relations, holes kept.
    Ids are the ones tools/tiles.py gives its buildings (w<way>, r<relation>.<k>)."""
    from shapely.geometry import Point, Polygon

    def pts(geom):
        p = [proj_ll(g["lat"], g["lon"]) for g in geom]
        return p[:-1] if len(p) > 1 and p[0] == p[-1] else p

    out, seen = [], set()
    for f in files:
        with (gzip.open if f.endswith(".gz") else open)(f, "rb") as fh:
            els = json.load(fh)
        if isinstance(els, dict):
            els = els["elements"]
        for e in els:
            if "building" not in (e.get("tags") or {}) or (e["type"], e["id"]) in seen:
                continue
            seen.add((e["type"], e["id"]))
            if e["type"] == "way":
                g = e.get("geometry") or []
                if len(g) > 3 and g[0] == g[-1]:
                    out.append((f"w{e['id']}", Polygon(pts(g)).buffer(0)))
            elif e["type"] == "relation":
                def rings(role):
                    segs = [[(g["lat"], g["lon"]) for g in m["geometry"]] for m in e.get("members", [])
                            if m["type"] == "way" and m.get("role") == role and m.get("geometry")]
                    return [pts([{"lat": a, "lon": b} for a, b in r]) for r in stitch(segs)]
                outers = [r for r in rings("outer") if len(r) >= 3]
                inners = [r for r in rings("inner") if len(r) >= 3]
                polys = [Polygon(o).buffer(0) for o in outers]
                holes = [[] for _ in outers]
                for r in inners:
                    p = Point(r[0])
                    for i, pg in enumerate(polys):
                        if pg.contains(p):
                            holes[i].append(r)
                            break
                for k, (o, hs) in enumerate(zip(outers, holes)):
                    out.append((f"r{e['id']}.{k}", Polygon(o, hs).buffer(0)))
    return [(k, g) for k, g in out if not g.is_empty]


# ----------------------------------------------------------------------------------------------
# Filtering against OSM
# ----------------------------------------------------------------------------------------------
def covered_fraction(units, osm_grown):
    """Per unit: share of its area lying inside the (grown) OSM footprints."""
    import shapely
    from shapely import STRtree
    tree = STRtree(osm_grown)
    ug = [u["g"] for u in units]
    qi, ti = tree.query(ug, predicate="intersects")
    cov = np.zeros(len(units))
    if len(qi):
        order = np.argsort(qi, kind="stable")
        qi, ti = qi[order], ti[order]
        cuts = np.flatnonzero(np.diff(qi)) + 1
        for q_grp, t_grp in zip(np.split(qi, cuts), np.split(ti, cuts)):
            u = ug[q_grp[0]]
            if len(t_grp) == 1:
                a = u.intersection(osm_grown[t_grp[0]]).area
            else:
                a = u.intersection(shapely.union_all([osm_grown[t] for t in t_grp])).area
            cov[q_grp[0]] = a / max(u.area, 1e-6)
    return cov


def clip_to_osm(units, osm_grown, osm_exact):
    """Drop covered units, cut the OSM footprints out of the rest. Returns (pieces, stats); a piece is
    {u: unit index, g: Polygon}."""
    import shapely
    from shapely import STRtree
    stats = {"units": len(units)}
    cov = covered_fraction(units, osm_grown)
    stats["covered"] = int((cov > DROP_COVERED).sum())
    tree = STRtree(osm_exact)
    pieces, cut = [], 0
    for i, u in enumerate(units):
        if cov[i] > DROP_COVERED:
            continue
        g = u["g"]
        if cov[i] > 0:
            near = tree.query(g, predicate="intersects")
            if len(near):
                g = g.difference(shapely.union_all([osm_exact[k].buffer(0.3) for k in near]))
                cut += 1
        for q in getattr(g, "geoms", [g]):
            if q.geom_type == "Polygon":
                pieces.append({"u": i, "g": q})
    stats["cut"] = cut
    stats["pieces"] = len(pieces)
    return pieces, stats, cov


def reject(piece, unit):
    """Why a piece is not a building, or None: too low (wall, terrace), too tall (survey error), a speck or a sliver."""
    g = piece["g"]
    if unit["h"] < MIN_HEIGHT:
        return "low"
    if unit["h"] > MAX_HEIGHT:
        return "tall"
    if g.area < MIN_AREA:
        return "small"
    if g.buffer(-MIN_WIDTH / 2).is_empty:
        return "sliver"
    return None


# ----------------------------------------------------------------------------------------------
# Merging units into buildings
# ----------------------------------------------------------------------------------------------
def merge_pieces(pieces):
    """Union-find over pieces that share a wall (>= TOUCH_LEN of boundary, or overlap), the strongest walls first,
    never growing a building past MAX_BUILDING. Returns a group number per piece."""
    import shapely
    from shapely import STRtree
    n = len(pieces)
    gs = [p["g"] for p in pieces]
    tree = STRtree(gs)
    qa, qb = tree.query(gs, predicate="dwithin", distance=0.3)
    keep = qa < qb
    qa, qb = qa[keep], qb[keep]
    A = np.array(gs, dtype=object)
    near = shapely.buffer(A[qb], 0.3)
    shared = shapely.length(shapely.intersection(shapely.boundary(A[qa]), near))
    over = shapely.area(shapely.intersection(A[qa], A[qb]))
    shared = np.where(over > 1.0, 1e3, shared)
    sel = shared >= TOUCH_LEN
    qa, qb, shared = qa[sel], qb[sel], shared[sel]
    parent = list(range(n))
    size = [g.area for g in gs]

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for k in np.argsort(-shared, kind="stable"):
        a, b = find(int(qa[k])), find(int(qb[k]))
        if a != b and size[a] + size[b] <= MAX_BUILDING:
            parent[b] = a
            size[a] += size[b]
    return [find(i) for i in range(n)]


def weighted_median(vals, weights):
    order = np.argsort(vals)
    v, w = np.asarray(vals, float)[order], np.asarray(weights, float)[order]
    c = np.cumsum(w)
    return float(v[np.searchsorted(c, c[-1] / 2)])


def ring_xz(ring):
    return [[round(x, 1), round(z, 1)] for x, z in ring.coords[:-1]]


def stepped(geoms, hs, areas, has_holes):
    """Main height and the parts of a building made of several units. Without a courtyard the parts partition the
    footprint (`split`, every unit that is not at the main height); with one only what stands more than 3.5 m above
    the base mass is kept, as raster_shape does for lidar. A part is [flat x,z list, height]."""
    main = weighted_median(hs, areas)
    split = not has_holes
    mixed = any(abs(h - main) > SAME_HEIGHT for h in hs)
    parts = []
    for g, h in zip(geoms, hs):
        if abs(h - main) <= SAME_HEIGHT and not (split and mixed):
            continue
        if not split and h - main <= 3.5:
            continue
        g = g.simplify(0.25)
        for q in getattr(g, "geoms", [g]):
            if q.geom_type == "Polygon" and q.area > 2:
                parts.append([[c for p in ring_xz(q.exterior) for c in p], round(h, 1)])
    return main, parts, split


def make_building(members, units, serial):
    """One merged building: outline (+ courtyards), main height, and the units that differ as parts."""
    import shapely
    ug = [(m["g"], units[m["u"]]) for m in members]
    areas = [g.area for g, _ in ug]
    hs = [min(u["h"], MAX_HEIGHT) for _, u in ug]
    total = sum(areas)
    shape = shapely.union_all([g for g, _ in ug]).buffer(0.15, join_style=2).buffer(-0.15, join_style=2)
    shape = shape.simplify(0.25)
    polys = [q for q in getattr(shape, "geoms", [shape]) if q.geom_type == "Polygon" and q.area >= MIN_AREA]
    if not polys:
        return None
    poly = max(polys, key=lambda q: q.area)
    holes = [r for r in poly.interiors if shapely.Polygon(r).area >= 6.0]
    main, parts, split = stepped([g for g, _ in ug], hs, areas, bool(holes))
    if total < SHED_AREA and max(hs) < SHED_HEIGHT:
        return None
    uid = min(u["id"] for _, u in ug)
    rec = {"id": f"x{uid}" if serial == 0 else f"x{uid}.{serial}", "oid": uid,
           "tags": {"building": "yes", "height": f"{main:.1f}"},
           "outer": ring_xz(poly.exterior), "h": round(main, 1),
           "g": round(sum(u["foot"] * a for (_, u), a in zip(ug, areas)) / total, 1),
           "n": len(members)}
    if holes:
        rec["holes"] = [ring_xz(r) for r in holes]
    if parts:
        rec["parts"] = parts
        if split:
            rec["split"] = 1
    return rec


def build_buildings(units, pieces):
    """Merge the usable pieces into buildings. Returns (records, stats)."""
    ok, stats = [], {"low": 0, "tall": 0, "small": 0, "sliver": 0}
    for p in pieces:
        why = reject(p, units[p["u"]])
        if why:
            stats[why] += 1
        else:
            ok.append(p)
    groups = merge_pieces(ok)
    by = {}
    for p, gid in zip(ok, groups):
        by.setdefault(gid, []).append(p)
    out, seen = [], {}
    for gid in sorted(by):
        mem = by[gid]
        uid = min(units[m["u"]]["id"] for m in mem)
        rec = make_building(mem, units, seen.get(uid, 0))
        if rec:
            seen[uid] = seen.get(uid, 0) + 1
            out.append(rec)
    stats["usable_pieces"] = len(ok)
    stats["groups"] = len(by)
    stats["shed_or_empty"] = len(by) - len(out)
    stats["buildings"] = len(out)
    return out, stats


# ----------------------------------------------------------------------------------------------
# Quality report
# ----------------------------------------------------------------------------------------------
# Districts as discs of 0.6 x the reach of the zone seeds in src/districts.js (lat, lon, reach m), land only.
DISTRICTS = {
    "centro": [(38.1170, 13.3550, 330), (38.1188, 13.3648, 330), (38.1190, 13.3687, 330), (38.1105, 13.3577, 330),
               (38.1092, 13.3545, 260), (38.1120, 13.3600, 200), (38.1150, 13.3690, 330), (38.1137, 13.3705, 330),
               (38.1090, 13.3650, 330), (38.1125, 13.3635, 330), (38.1157, 13.3613, 330), (38.1195, 13.3572, 330),
               (38.1148, 13.3562, 330), (38.1160, 13.3650, 330)],
    "Oreto": [(38.1020, 13.3715, 500), (38.0985, 13.3700, 500), (38.1040, 13.3600, 400)],
    "Brancaccio": [(38.0980, 13.3810, 600), (38.0930, 13.3830, 600), (38.0960, 13.3900, 500)],
    "Uditore": [(38.1317, 13.3227, 600), (38.1334, 13.3177, 500)],
    "Cruillas": [(38.1428, 13.3217, 420)],
    "ZEN": [(38.1786, 13.3127, 600), (38.1834, 13.3149, 600), (38.1816, 13.3176, 450), (38.1770, 13.3180, 400)],
    "Mondello": [(38.2054, 13.3235, 450), (38.2010, 13.3262, 500), (38.2125, 13.3251, 450)],
}
DISC_SHARE = 0.6


def district_regions():
    """Land part of each district disc, from the baked manifest."""
    import shapely
    from shapely.geometry import Point, Polygon
    with open(os.path.join(WORLD, "manifest.json")) as fh:
        land = json.load(fh)["land"]
    land = Polygon(list(zip(land[0::2], land[1::2]))).buffer(0)
    out = {}
    for name, seeds in DISTRICTS.items():
        discs = [Point(*proj_ll(la, lo)).buffer(r * DISC_SHARE) for la, lo, r in seeds]
        out[name] = shapely.union_all(discs).intersection(land)
    return out


def covered_area(geoms, region):
    import shapely
    from shapely import STRtree
    tree = STRtree(geoms)
    hit = tree.query(region, predicate="intersects")
    if not len(hit):
        return 0.0
    return shapely.union_all([geoms[i] for i in hit]).intersection(region).area


def coverage_table(regions, osm_geoms, added_geoms, ctc_geoms):
    rows = []
    for name, reg in regions.items():
        a = reg.area
        o = covered_area(osm_geoms, reg)
        both = covered_area(osm_geoms + added_geoms, reg)
        c = covered_area(ctc_geoms, reg)
        from shapely import STRtree
        n_osm = len(STRtree(osm_geoms).query(reg, predicate="intersects"))
        n_add = len(STRtree(added_geoms).query(reg, predicate="intersects")) if added_geoms else 0
        rows.append({"district": name, "land_km2": round(a / 1e6, 2), "osm_pct": round(100 * o / a, 1),
                     "osm_plus_extra_pct": round(100 * both / a, 1), "ctc_all_units_pct": round(100 * c / a, 1),
                     "osm_buildings": n_osm, "added_buildings": n_add})
    return rows


def lidar_roofs():
    """{id: (roof, ground)} of the baked OSM buildings that carry a measured roof (r, g absolute elevations)."""
    out = {}
    for f in glob.glob(os.path.join(WORLD, "tiles", "*.json")):
        with open(f) as fh:
            for b in json.load(fh)["buildings"]:
                if "r" in b:
                    out[b["id"]] = (b["r"], b["g"])
    return out


def match_heights(osm, units, min_cover=0.6):
    """Heights for the OSM buildings themselves: {key: {h, g, r, n, parts?, split?}} from the volume units inside each
    building (the unit heights weighted by the area inside; r is the eave elevation, g the foot elevation, both
    absolute). Only buildings whose area is covered at least `min_cover` by units."""
    from shapely import STRtree
    ug = [u["g"] for u in units]
    tree = STRtree(ug)
    out = {}
    keys, geoms = [k for k, _ in osm], [g for _, g in osm]
    qi, ti = tree.query(geoms, predicate="intersects")
    order = np.argsort(qi, kind="stable")
    qi, ti = qi[order], ti[order]
    cuts = np.flatnonzero(np.diff(qi)) + 1
    for q_grp, t_grp in zip(np.split(qi, cuts), np.split(ti, cuts)):
        if not len(q_grp):
            continue
        g = geoms[q_grp[0]]
        inside = [ug[t].intersection(g) for t in t_grp]
        w = np.array([q.area for q in inside])
        sel = w > 0.5
        if not sel.any() or w[sel].sum() / max(g.area, 1e-6) < min_cover:
            continue
        t_grp, w = t_grp[sel], w[sel]
        inside = [q for q, k in zip(inside, sel) if k]
        h = [min(units[t]["h"], MAX_HEIGHT) for t in t_grp]
        main, parts, split = stepped(inside, h, list(w), len(g.interiors) > 0)
        rec = {"h": round(main, 1), "g": round(float(np.average([units[t]["foot"] for t in t_grp], weights=w)), 1),
               "r": round(float(np.average([units[t]["eave"] for t in t_grp], weights=w)), 1), "n": len(t_grp)}
        if parts:
            rec["parts"] = parts
            if split:
                rec["split"] = 1
        out[keys[q_grp[0]]] = rec
    return out


def height_check(matched, roofs):
    rows = [(matched[k], roofs[k]) for k in matched if k in roofs]
    if not rows:
        return {}
    ctc_h = np.array([m["h"] for m, _ in rows])
    lid_h = np.array([r - g for _, (r, g) in rows])
    d = ctc_h - lid_h

    def stats(x):
        return {"n": int(len(x)), "bias_m": round(float(x.mean()), 2), "median_m": round(float(np.median(x)), 2),
                "rms_m": round(float(np.sqrt((x ** 2).mean())), 2), "mae_m": round(float(np.abs(x).mean()), 2)}

    out = {"height": stats(d), "corr": round(float(np.corrcoef(ctc_h, lid_h)[0, 1]), 3),
           "ground_ctc_foot_minus_lidar_g": stats(np.array([m["g"] - g for m, (r, g) in rows])),
           "roof_ctc_eave_minus_lidar_r": stats(np.array([m["r"] - r for m, (r, g) in rows]))}
    bands = [(0, 6), (6, 12), (12, 20), (20, 99)]
    out["by_lidar_height"] = {f"{a}-{b} m": stats(d[(lid_h >= a) & (lid_h < b)]) for a, b in bands if ((lid_h >= a) & (lid_h < b)).any()}
    # a one-parameter fix: lidar ~ k * ctc, and how much error is left with it
    k = float((ctc_h * lid_h).sum() / (ctc_h ** 2).sum())
    out["scale_k"] = round(k, 3)
    out["rms_after_scale"] = round(float(np.sqrt(((k * ctc_h - lid_h) ** 2).mean())), 2)
    return out


def render_pair(path, cx, cz, half, osm_geoms, added, units, pieces_by_reason, title):
    """Top-down, two panels (OSM only | OSM plus the added buildings), 2 px per metre at half = 200.
    Added buildings are orange, darker when taller; CTC units rejected by a filter are outlined red."""
    from PIL import Image, ImageDraw
    from shapely import STRtree
    from shapely.geometry import Polygon, box
    size = 800
    k = size / (2 * half)
    win = box(cx - half, cz - half, cx + half, cz + half)

    def xy(poly):
        return [((x - cx + half) * k, (z - cz + half) * k) for x, z in poly.exterior.coords]

    def draw(d, polys, fill, outline):
        for g in polys:
            for q in getattr(g, "geoms", [g]):
                if q.geom_type == "Polygon":
                    d.polygon(xy(q), fill=fill, outline=outline)
                    for ring in q.interiors:
                        d.polygon([((x - cx + half) * k, (z - cz + half) * k) for x, z in ring.coords], fill=(238, 236, 230), outline=outline)

    near_osm = [osm_geoms[i] for i in STRtree(osm_geoms).query(win, predicate="intersects")]
    img = Image.new("RGB", (size * 2 + 6, size), (255, 255, 255))
    panels = []
    for side in (0, 1):
        pimg = Image.new("RGB", (size, size), (238, 236, 230))
        d = ImageDraw.Draw(pimg)
        draw(d, near_osm, (186, 186, 186), (90, 90, 90))
        if side:
            for g, why in pieces_by_reason:
                if g.intersects(win):
                    draw(d, [g], None, (214, 40, 40))
            for r in added:
                g = Polygon(r["outer"], r.get("holes"))
                if not g.intersects(win):
                    continue
                t = min(r["h"] / 30.0, 1.0)
                draw(d, [g], (int(250 - 60 * t), int(170 - 90 * t), int(60 - 40 * t)), (120, 50, 0))
        d.text((8, 6), ("OSM only" if side == 0 else "OSM + added (orange), rejected (red)") + "  " + title, fill=(0, 0, 0))
        d.line([(8, size - 14), (8 + 50 * k, size - 14)], fill=(0, 0, 0), width=3)
        d.text((8, size - 30), "50 m", fill=(0, 0, 0))
        panels.append(pimg)
    img.paste(panels[0], (0, 0))
    img.paste(panels[1], (size + 6, 0))
    img.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("shp", help="path of VOLUMETRIE_7792.shp")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--osm-heights", default=os.path.join(ROOT, "data", "footprints_osm_heights.json"),
                    help="also write CTC heights for the OSM buildings (keyed by tiles.py building id)")
    ap.add_argument("--report", help="directory for report.json and comparison images")
    a = ap.parse_args()
    t0 = time.time()
    log = lambda m: print(f"[footprints {time.time() - t0:.0f}s] {m}", flush=True)

    units = load_units(a.shp)
    log(f"{len(units)} volume units")
    osm = load_osm(sorted(glob.glob(os.path.join(CITY, "pbf_bld_*.json.gz"))))
    log(f"{len(osm)} OSM buildings")
    osm_geoms = [g for _, g in osm]
    pieces, st, cov = clip_to_osm(units, [g.buffer(OSM_NEAR) for g in osm_geoms], osm_geoms)
    log(f"overlap rule: {st['covered']} units dropped (> {DROP_COVERED:.0%} inside OSM grown by {OSM_NEAR} m), "
        f"{st['cut']} cut, {st['pieces']} pieces left")
    buildings, bst = build_buildings(units, pieces)
    log(f"filters {bst}")

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as fh:
        json.dump({"source": "Comune di Palermo, Carta Tecnica Comunale, Unita' Volumetriche (2013), CC BY 4.0 IT",
                   "height": "h = ALTEZZA (eave minus foot), g = foot elevation, r = eave elevation, metres",
                   "buildings": buildings}, fh, separators=(",", ":"))
    log(f"{len(buildings)} buildings -> {a.out}")
    matched = match_heights(osm, units)
    with open(a.osm_heights, "w") as fh:
        json.dump(matched, fh, separators=(",", ":"))
    log(f"{len(matched)} OSM buildings with a CTC height -> {a.osm_heights}")

    if a.report:
        os.makedirs(a.report, exist_ok=True)
        from shapely.geometry import Polygon
        added_geoms = [Polygon(r["outer"], r.get("holes")) for r in buildings]
        regions = district_regions()
        rep = {"units": st["units"], "overlap": st, "filters": bst,
               "coverage": coverage_table(regions, osm_geoms, added_geoms, [u["g"] for u in units]),
               "height_check": height_check(matched, lidar_roofs())}
        areas = [g.area for g in added_geoms]
        rep["added"] = {"buildings": len(buildings), "area_km2": round(sum(areas) / 1e6, 3),
                        "with_parts": sum("parts" in r for r in buildings), "with_courtyard": sum("holes" in r for r in buildings),
                        "multi_unit": sum(r["n"] > 1 for r in buildings),
                        "h_pct_5_50_95": [round(float(v), 1) for v in np.percentile([r["h"] for r in buildings], [5, 50, 95])]}
        with open(os.path.join(a.report, "report.json"), "w") as fh:
            json.dump(rep, fh, indent=1)
        log("report.json written")
        rejected = []
        keep = {p["u"] for p in pieces if reject(p, units[p["u"]]) is None}
        for p in pieces:
            why = reject(p, units[p["u"]])
            if why:
                rejected.append((p["g"], why))
        for name, reg in regions.items():
            best, bv = None, 0.0
            for r in buildings:
                if not reg.contains(Polygon(r["outer"]).representative_point()):
                    continue
                cx, cz = r["outer"][0]
                key = (int(cx // 200), int(cz // 200))
                v = sum(Polygon(q["outer"]).area for q in buildings
                        if int(q["outer"][0][0] // 200) == key[0] and int(q["outer"][0][1] // 200) == key[1])
                if v > bv:
                    best, bv = key, v
            if best:
                render_pair(os.path.join(a.report, f"{name}.png"), (best[0] + 0.5) * 200, (best[1] + 0.5) * 200, 200,
                            osm_geoms, buildings, units, rejected, name)
        log("images written")


if __name__ == "__main__":
    main()
