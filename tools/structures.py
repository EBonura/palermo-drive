"""Bridges, viaducts and tunnels for the world tiles (tools/tiles.py calls build_structures).

OSM marks them on the road way itself (bridge=yes|viaduct|movable, tunnel=yes, layer), so each way is one structure with a centreline.
What tiles.py did with them before: nothing but a `br`/`tn` flag on the road (tunnels vanished from the street layers, bridges were
road draped over whatever the ground model said). Here every structure becomes a record the runtime (src/bridges.js) builds:

  {id, k: 'b'|'t', p: [x,z,...] centreline, w: deck width, cw: carriageway width, ly: layer, n: name, hw: highway kind,
   rv: [[x,z,...], ...] river lines near the deck (bridges only), rw: river width, rf: per river vertex the lowest ground across the valley floor (the line cut into <= 8 m pieces by the bake), dep: metres from the deck down to the river bed,
   ov: 1 when the bridge goes over another road (a flyover: ramps and clearance instead of a trench), ow: 1 one-way, f: 1 footway}

The records go into every tile the structure (buffered) touches; the runtime keeps one copy per id. Heights are NOT baked: the deck
follows the game's own ground at both ends (the ground model off the lidar rasters is off by metres, a baked absolute would float).
The depth `dep` is a relative number (TINITALY 10 m DEM: shoulders of the valley minus the river bed), so it survives that error.
"""
import math

from shapely.geometry import LineString, Point, box
from shapely.ops import unary_union

RIVER_W = {"river": 14.0, "canal": 8.0, "stream": 5.0, "brook": 4.0, "drain": 3.5, "ditch": 2.0}
RIVER_WINDOW = 200.0      # metres of river line kept each side of the deck
MIN_BRIDGE = 12.0         # shorter bridges (culverts, gutters) are not built
MIN_TUNNEL = 20.0
SIDEWALK = 1.2            # pavement each side of a vehicle deck, metres
PARAPET = 0.5


def river_width(t):
    try:
        return max(1.0, float(str(t.get("width", "")).replace(",", ".").split()[0]))
    except (ValueError, IndexError):
        return RIVER_W.get(t.get("waterway"), 4.0)


def deck_width(hw, cw):
    if hw in ("footway", "path", "cycleway", "steps", "pedestrian"):
        return round(max(cw, 2.5) + 2 * PARAPET + 0.4, 1)
    return round(cw + 2 * (SIDEWALK + PARAPET), 1)


def build_structures(structs, waterways, roads, dem=None, log=print):
    """structs: [(LineString, tags, kind 'b'|'t', carriageway width)] from parse_highways.
    waterways: [(LineString, tags)]. roads: [(rec, LineString)] (every drivable road, with rec['k'], rec.get('br'), rec.get('tn')).
    Returns a list of records."""
    from shapely import STRtree
    wl = [w for w, t in waterways if t.get("tunnel") not in ("yes", "culvert") and t.get("covered") != "yes"]
    wt = [t for w, t in waterways if t.get("tunnel") not in ("yes", "culvert") and t.get("covered") != "yes"]
    wtree = STRtree(wl) if wl else None
    rl = [ls for rec, ls in roads if not rec.get("tn") and rec["k"] in ("motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
                                                                         "residential", "living_street", "service", "motorway_link", "trunk_link",
                                                                         "primary_link", "secondary_link", "tertiary_link")]
    rtree = STRtree(rl) if rl else None
    out, n_riv, n_over = [], 0, 0
    for line, t, kind, cw in structs:
        L = line.length
        if L < (MIN_BRIDGE if kind == "b" else MIN_TUNNEL):
            continue
        hw = t["highway"]
        rec = {"id": ("b" if kind == "b" else "t") + str(t["_id"]), "k": kind,
               "p": [round(c, 1) for pt in line.coords for c in pt[:2]], "w": deck_width(hw, cw), "cw": round(cw, 1),
               "ly": int(t["layer"]) if str(t.get("layer", "")).lstrip("-").isdigit() else (1 if kind == "b" else -1), "hw": hw}
        if t.get("name"):
            rec["n"] = t["name"]
        if t.get("oneway") in ("yes", "true", "1", "-1"):
            rec["ow"] = 1
        if hw in ("footway", "path", "cycleway", "steps", "pedestrian"):
            rec["f"] = 1
        if kind == "b":
            near = line.buffer(RIVER_WINDOW)
            rivers, rw = [], 0.0
            if wtree is not None:
                for i in wtree.query(line.buffer(2.0)):
                    if not wl[i].intersects(line.buffer(2.0)):
                        continue
                    piece = wl[i].intersection(near)
                    for g in ([piece] if piece.geom_type == "LineString" else [x for x in getattr(piece, "geoms", []) if x.geom_type == "LineString"]):
                        if g.length > 8:
                            rivers.append([round(c, 1) for pt in g.coords for c in pt[:2]])
                            rw = max(rw, river_width(wt[i]))
            if rivers:
                rec["rv"], rec["rw"] = rivers, round(rw, 1)
                n_riv += 1
                if dem is not None:   # depth of the valley: shoulders at the two ends minus the river bed under the deck
                    try:
                        mid = LineString([(rivers[0][k], rivers[0][k + 1]) for k in range(0, len(rivers[0]), 2)])
                        c = line.intersection(mid)
                        cp = c if c.geom_type == "Point" else (c.centroid if not c.is_empty else line.interpolate(0.5, normalized=True))
                        bed = min(float(dem.sample(cp.x + dx, cp.y + dz)) for dx in (-4, 0, 4) for dz in (-4, 0, 4))
                        e0, e1 = line.coords[0], line.coords[-1]
                        sh = (float(dem.sample(e0[0], e0[1])) + float(dem.sample(e1[0], e1[1]))) / 2
                        rec["dep"] = round(max(2.0, min(sh - bed, 16.0)), 1)
                    except Exception as ex:  # noqa: BLE001
                        log(f"  structures: no DEM depth for {rec['id']}: {ex}")
                rec.setdefault("dep", 5.0)
            elif rtree is not None:   # a flyover: another, lower road crosses it
                inner = line.buffer(-0.5) if L > 8 else line
                for i in rtree.query(line):
                    g = rl[i]
                    if g.equals(line) or not g.crosses(line):
                        continue
                    p = g.intersection(line)
                    if p.is_empty or p.geom_type not in ("Point", "MultiPoint"):
                        continue
                    pts = [p] if p.geom_type == "Point" else list(p.geoms)
                    if any(4.0 < line.project(q) < L - 4.0 for q in pts):
                        rec["ov"] = 1
                        n_over += 1
                        break
        out.append(rec)
    log(f"  structures: {sum(1 for r in out if r['k'] == 'b')} bridges ({n_riv} over water, {n_over} over roads), "
        f"{sum(1 for r in out if r['k'] == 't')} tunnels")
    return out


def tiles_of(rec, T):
    """Tile keys 'i_j' the structure (buffered by its width and the river window) touches."""
    pts = rec["p"]
    xs, zs = pts[0::2], pts[1::2]
    m = rec["w"] / 2 + (RIVER_WINDOW if "rv" in rec else 12)
    for r in rec.get("rv", []):
        xs, zs = xs + r[0::2], zs + r[1::2]
    x0, x1, z0, z1 = min(xs) - m, max(xs) + m, min(zs) - m, max(zs) + m
    return [f"{i}_{j}" for i in range(math.floor(x0 / T), math.floor(x1 / T) + 1) for j in range(math.floor(z0 / T), math.floor(z1 / T) + 1)]


def river_floor(rec, ground, step=8.0):
    """The river lines of a bridge cut into pieces of about `step` metres (the game used to do that at load), and for every vertex rf = the lowest
    ground of the valley floor across the river (the line and one half river width to each side) in the tile's own frame. The game digs the bed
    a little under this. It cannot be worked out when the tile loads: the river runs 200 m up and down the valley, over tiles that are not there
    yet (the far grid has no valley), and with the DEM valley in the ground since t8 the bed has to follow the real floor."""
    off = max(2.0, rec.get("rw", 4.0) / 2)
    lines, floors = [], []
    for ln in rec["rv"]:
        pts = [(ln[k], ln[k + 1]) for k in range(0, len(ln), 2)]
        dense = [pts[0]]
        for (ax, az), (bx, bz) in zip(pts, pts[1:]):
            n = max(1, round(math.hypot(bx - ax, bz - az) / step))
            dense += [(ax + (bx - ax) * i / n, az + (bz - az) * i / n) for i in range(1, n + 1)]
        fl = []
        for k, (x, z) in enumerate(dense):
            ax, az = dense[max(0, k - 1)]
            bx, bz = dense[min(len(dense) - 1, k + 1)]
            l = math.hypot(bx - ax, bz - az) or 1.0
            nx, nz = -(bz - az) / l, (bx - ax) / l
            fl.append(round(min(ground(x, z), ground(x + nx * off, z + nz * off), ground(x - nx * off, z - nz * off)), 2))
        lines.append([round(c, 1) for p in dense for c in p])
        floors.append(fl)
    return lines, floors


def add_heights(world_dir, structs, far_f, T, log=print):
    """After the tiles are written: y0, y1 = the ground the game will show at both ends of every structure (the tile's near grid where it
    has one, else the manifest far grid, the same two sources src/world.js tileGround() reads), written into every tile that holds the
    record. Absolute heights in the ground's own frame (which is off by metres away from the lidar rasters, but then so is the road)."""
    import glob
    import json
    import os
    ids = {r["id"] for r in structs}
    if not ids:
        return
    grids = {}

    def near(i, j):
        k = (i, j)
        if k not in grids:
            p = os.path.join(world_dir, "tiles", f"{i}_{j}.json")
            g = None
            if os.path.exists(p):
                n = json.load(open(p)).get("near")
                if n:
                    g = n
            grids[k] = g
        return grids[k]

    def ground(x, z):
        i, j = math.floor(x / T), math.floor(z / T)
        n = near(i, j)
        if n:
            fx = max(0.0, min(n["nx"] - 1.001, (x - n["x0"]) / n["s"]))
            fz = max(0.0, min(n["nz"] - 1.001, (z - n["z0"]) / n["s"]))
            a, b = int(fx), int(fz)
            tx, tz = fx - a, fz - b
            h, nx = n["h"], n["nx"]
            k = b * nx + a
            return (h[k] * (1 - tx) + h[k + 1] * tx) * (1 - tz) + (h[k + nx] * (1 - tx) + h[k + nx + 1] * tx) * tz
        return float(far_f(x, z))

    heights = {}
    rivers = {}
    for r in structs:
        p = r["p"]
        a, b = (p[0], p[1]), (p[-2], p[-1])
        heights[r["id"]] = (round(ground(*a), 2), round(ground(*b), 2))
        if r.get("rv"):
            rivers[r["id"]] = river_floor(r, ground)
    n = 0
    for f in glob.glob(os.path.join(world_dir, "tiles", "*.json")):
        raw = open(f, "rb").read()
        if b'"structs"' not in raw:
            continue
        d = json.loads(raw)
        for r in d.get("structs", []):
            r["y0"], r["y1"] = heights[r["id"]]
            if r["id"] in rivers:
                r["rv"], r["rf"] = rivers[r["id"]]
        tmp = f + ".part"
        with open(tmp, "w") as fh:
            json.dump(d, fh, separators=(",", ":"), ensure_ascii=False)
        os.replace(tmp, f)
        n += 1
    log(f"  structures: end heights written into {n} tiles")
