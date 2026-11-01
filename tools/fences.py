"""Walls and fences for the world tiles (tools/tiles.py calls load_barriers once and tile_fences per tile).

Two sources, merged:
  * OpenStreetMap barrier ways (cache category `bar`): wall, retaining_wall, city_wall, fence, guard_rail, jersey_barrier (hedges are
    vegetation and left to the greenery step). 3,297 ways, 118 km of walls, 50 km of fences, 28 km of retaining walls.
  * Regione Siciliana CTR 1:10,000 (data/walls.json, docs/sources/ctr-sicilia.md): E003 wall, E002 fence, E004 dry-stone wall, E005
    retaining wall. 46,894 lines, 3,300 km: mostly field boundaries, so a line is kept when it is within 20 m of a carriageway (`st`) or
    within 30 m of a building. The survey is 2003 with a 2012 patch and only 1:10,000: a CTR line that lies within 3 m of an OSM barrier
    is dropped (OSM is more exact), one on a building outline, on the carriageway or on a bridge deck is cut away.

Per tile: `fences = [{k, h, s, p}]` with k the kind (w wall, d dry-stone, r retaining, c city wall, j concrete barrier, f fence, g guard rail),
h the height in metres (0 for a retaining wall: the runtime reads it off the ground), s the fence style (0 railing, 1 wooden, 2 mesh), p the
flat polyline (0.1 m). Ordered OSM first, then CTR near roads, then CTR near buildings, so the runtime can cap a crowded tile from the end.
Heights: a `height` tag when OSM has one, else a plausible value by kind (the CTR says nothing about height).
"""
import json
import math
import os
import zlib

from shapely.geometry import LineString, box
from shapely.ops import unary_union

OSM_KIND = {"wall": "w", "retaining_wall": "r", "city_wall": "c", "fence": "f", "guard_rail": "g", "jersey_barrier": "j"}
CTR_KIND = {"wall": "w", "drystone": "d", "retaining": "r", "fence": "f"}
HEIGHT = {"w": (1.8, 2.6), "d": (1.0, 1.5), "r": (0, 0), "c": (5.5, 7.0), "j": (0.8, 0.8), "f": (1.3, 1.8), "g": (0.75, 0.75)}
FENCE_STYLE = {"railing": 0, "metal": 0, "bars": 0, "wood": 1, "wooden": 1, "palisade": 1, "chain_link": 2, "wire": 2, "barbed_wire": 2, "wire_fence": 2}
NEAR_BUILDING = 30.0
DEDUP = 3.0
MIN_PIECE = 2.0


def _u(*parts):   # a stable 0..1 hash (python's hash() changes between runs)
    return (zlib.crc32("|".join(str(p) for p in parts).encode()) & 0xFFFF) / 65535.0


def _height(kind, tags, key):
    try:
        h = float(str(tags.get("height", "")).replace(",", ".").split()[0])
        if 0.3 <= h <= 12:
            return round(h, 1)
    except (ValueError, IndexError):
        pass
    lo, hi = HEIGHT[kind]
    return round(lo + (hi - lo) * _u("h", key), 1)


def load_barriers(osm_elements, ctr_path, proj):
    """-> (items, tree-ready geoms). item = dict(g=LineString, k, h, s, src 0 osm / 1 ctr near road / 2 ctr near building)."""
    items = []
    for e in osm_elements:
        t = e.get("tags") or {}
        k = OSM_KIND.get(t.get("barrier") or "")
        if t.get("historic") == "citywalls":
            k = "c"
        if not k or not e.get("geometry") or len(e["geometry"]) < 2:
            continue
        pts = [proj(g["lat"], g["lon"]) for g in e["geometry"]]
        g = LineString(pts)
        if g.length < MIN_PIECE:
            continue
        ft = t.get("fence_type", "")
        s = FENCE_STYLE.get(ft, 1 if _u("s", e["id"]) < 0.35 else 0)
        if k in ("g",):
            s = 0
        items.append({"g": g, "k": k, "h": _height(k, t, e["id"]), "s": s, "src": 0})
    if ctr_path and os.path.exists(ctr_path):
        for n, w in enumerate(json.load(open(ctr_path))["walls"]):
            k = CTR_KIND.get(w["t"])
            if not k or len(w["p"]) < 4:
                continue
            g = LineString(list(zip(w["p"][0::2], w["p"][1::2])))
            if g.length < MIN_PIECE:
                continue
            items.append({"g": g, "k": k, "h": _height(k, {}, f"c{n}"), "s": 2 if _u("s", n) < 0.5 else (1 if _u("t", n) < 0.5 else 0), "src": 1 if w.get("st") else 2})
    return items


def tile_fences(tx0, tz0, T, items, tree, bld_geoms, bld_tree, cut_geoms, carr_geoms, carr_tree, I, D, poly_only):
    """Barrier pieces inside tile (tx0, tz0, T): [dict]. I and D are tiles.py's intersection and difference."""
    tile = box(tx0, tz0, tx0 + T, tz0 + T)
    R = box(tx0 - 40, tz0 - 40, tx0 + T + 40, tz0 + T + 40)
    ids = [i for i in tree.query(tile) if items[i]["g"].intersects(tile)]
    if not ids:
        return []
    bl = unary_union([bld_geoms[i].buffer(0.6) for i in bld_tree.query(R)]) if len(bld_tree.query(R)) else None
    carr = unary_union([carr_geoms[i] for i in carr_tree.query(tile)]) if len(carr_tree.query(tile)) else None
    osm_zone = unary_union([items[i]["g"].buffer(DEDUP) for i in ids if items[i]["src"] == 0]) if any(items[i]["src"] == 0 for i in ids) else None
    out = []
    for i in ids:
        it = items[i]
        g = it["g"].intersection(tile)
        if it["src"] and osm_zone is not None:
            g = g.difference(osm_zone)
        if it["src"] == 2 and bld_tree is not None:   # a field boundary far from every building is not drawn
            if not len(bld_tree.query(it["g"].buffer(NEAR_BUILDING))):
                continue
        for sub in (bl, carr):
            if sub is not None and not g.is_empty:
                g = g.difference(sub)
        if cut_geoms is not None and not g.is_empty:
            g = g.difference(cut_geoms)
        if g.is_empty:
            continue
        parts = [g] if g.geom_type == "LineString" else [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]
        for p in parts:
            p = p.simplify(0.25)
            if p.length < MIN_PIECE:
                continue
            out.append({"k": it["k"], "h": it["h"], "s": it["s"], "src": it["src"], "p": [round(c, 1) for pt in p.coords for c in pt[:2]]})
    out.sort(key=lambda r: r["src"])
    for r in out:
        r.pop("src")
        if r["k"] != "f":
            r.pop("s")
    return out
