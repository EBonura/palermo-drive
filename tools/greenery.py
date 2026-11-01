"""Trees and Comune green for the world tiles (tools/tiles.py calls these in build()).

  data/trees.json (tools/green.py: lidar crowns, CTR points, Urban Atlas lattice, see docs/sources/lidar-canopy.md, ctr-sicilia.md,
  urban-atlas-stl.md) -> tree prop items in each tile's `props.items` ({k: 'tree', x, z, r, h, kd}); the runtime (src/props.js) places them
  like the OSM trees: not on a carriageway or a building, a model by `kd`, scaled to the crown radius `r`.
    * trees in an OSM forest or scrub area (`f`) are left to the forest instancing of src/world.js;
    * real trees (lidar, CTR) keep the biggest crowns up to REAL_CAP per tile;
    * the Urban Atlas lattice (126,159 invented positions inside canopy polygons, no size) is thinned to UA_CAP per tile, evenly (a grid
      of cells, one tree each) so a park still looks like a park and a phone is not asked for 1,300 trees on one tile.
  data/trees_osm_crowns.json: crown radius and height for the OSM trees it matched (within 4 m).
  data/verges.json (Comune di Palermo, Perimetrazione aree verdi): polygons of medians, islands, verges, flowerbeds, tree beds; tiles.py draws
  them as `green` over the street layers (medians and islands are cut out of the asphalt, the Comune polygons win over the derived road).
"""
import json
import math
import os
import zlib

from shapely.geometry import Polygon

REAL_CAP = 320       # lidar and CTR trees per 500 m tile
UA_CAP = 90          # lattice trees per tile
UA_CELL = 36.0       # metres: one lattice tree per cell of this size at most
VERGE_CLASSES = ("median", "island", "verge", "flowerbed", "tree_bed")
CUT_CLASSES = ("median", "island")       # these are ringed by carriageways by construction: safe to cut out of the asphalt


def _u(*parts):
    return (zlib.crc32("|".join(str(p) for p in parts).encode()) & 0xFFFF) / 65535.0


def tile_trees(path, T):
    """-> {'i_j': [item]}"""
    if not os.path.exists(path):
        return {}
    d = json.load(open(path))["trees"]
    real, ua = {}, {}
    for n, t in enumerate(d):
        if t.get("f"):
            continue
        key = f"{math.floor(t['x'] / T)}_{math.floor(t['z'] / T)}"
        it = {"k": "tree", "x": round(t["x"], 1), "z": round(t["z"], 1)}
        if t.get("r"):
            it["r"] = round(t["r"], 1)
        if t.get("h"):
            it["h"] = round(t["h"], 1)
        kd = t.get("k")
        if kd:
            it["kd"] = kd
        elif t["s"] == "ctr" and t.get("c") == "olive":
            it["kd"] = "olive"
        (ua if t["s"] == "ua" else real).setdefault(key, []).append((n, it))
    out = {}
    for key, lst in real.items():
        lst.sort(key=lambda a: -(a[1].get("r") or 2.0))
        out.setdefault(key, []).extend(it for _, it in lst[:REAL_CAP])
    for key, lst in ua.items():
        chosen, taken = [], {}
        for n, it in sorted(lst, key=lambda a: _u("ua", a[0])):
            c = (math.floor(it["x"] / UA_CELL), math.floor(it["z"] / UA_CELL))
            if c in taken:
                continue
            taken[c] = 1
            chosen.append(it)
            if len(chosen) >= UA_CAP:
                break
        out.setdefault(key, []).extend(chosen)
    return out


def apply_osm_crowns(path, tile_props, T):
    """Crown size for the OSM tree items the lidar matched. Mutates the items."""
    if not os.path.exists(path):
        return 0
    n = 0
    for c in json.load(open(path))["crowns"]:
        key = f"{math.floor(c['x'] / T)}_{math.floor(c['z'] / T)}"
        best, bd = None, 4.0
        for it in tile_props.get(key, []):
            if it.get("k") == "tree":
                dd = math.hypot(it["x"] - c["x"], it["z"] - c["z"])
                if dd < bd:
                    best, bd = it, dd
        if best is not None and "r" not in best:
            best["r"], best["h"] = round(c["r"], 1), round(c["h"], 1)
            n += 1
    return n


def load_verges(path):
    """-> [(Polygon, class)]"""
    if not os.path.exists(path):
        return []
    out = []
    for v in json.load(open(path))["verges"]:
        if v["c"] not in VERGE_CLASSES or len(v["p"]) < 6:
            continue
        g = Polygon(list(zip(v["p"][0::2], v["p"][1::2])))
        if not g.is_valid:
            g = g.buffer(0)
        if not g.is_empty and g.area > 1.5:
            out.append((g, v["c"]))
    return out
