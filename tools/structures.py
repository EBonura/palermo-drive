"""Bridges, viaducts and tunnels for the world tiles (tools/tiles.py calls build_structures).

OSM marks them on the road way itself (bridge=yes|viaduct|movable, tunnel=yes, layer), so each way is one structure with a centreline.
What tiles.py did with them before: nothing but a `br`/`tn` flag on the road (tunnels vanished from the street layers, bridges were
road draped over whatever the ground model said). Here every structure becomes a record the runtime (src/bridges.js) builds:

  {id, k: 'b'|'t', p: [x,z,...] centreline, w: deck width, cw: carriageway width, ly: layer, n: name, hw: highway kind,
   rv: [[x,z,...], ...] river lines near the deck (bridges only), rw: river width, rf: per river vertex the lowest ground across the valley floor (the line cut into <= 8 m pieces by the bake), dep: metres from the deck down to the river bed,
   ov: 1 when the bridge goes over another road (a flyover: ramps and clearance instead of a trench), oc: metres along the deck where the lower roads cross under it, ud: for every crossing {s, w: the lower road's width, c: metres along p to the crossing, p: its line round the crossing, f: the ground under p (add_heights)},
   xc: (tunnels) [[metres along p, width along p], ...] of the surface roads that cross over it, xg: per crossing the lowest ground round it (add_heights),
   ap: (tunnels with xc) [start, end]: the road leaving each mouth, outward, AP_LEN m [x,z,...] (src/bridges.js sinks it into a ramp where the tunnel has to go deeper to pass under a road),
   pg: (tunnels) the ground along p every PG_STEP m of its length (and at its end), ag: (tunnels with ap) the ground under every vertex of ap (add_heights): what src/bridges.js
   reads to tell the open cutting from the covered part and how deep the floor has to go, whichever tiles have loaded,
   ow: 1 one-way, f: 1 footway}

The records go into every tile the structure (buffered) touches; the runtime keeps one copy per id. Heights are NOT baked: the deck
follows the game's own ground at both ends (the ground model off the lidar rasters is off by metres, a baked absolute would float).
The depth `dep` is a relative number (TINITALY 10 m DEM: shoulders of the valley minus the river bed), so it survives that error.
"""
import math

from shapely.geometry import LineString, Point, box
from shapely.ops import substring, unary_union

RIVER_W = {"river": 14.0, "canal": 8.0, "stream": 5.0, "brook": 4.0, "drain": 3.5, "ditch": 2.0}
RIVER_WINDOW = 200.0      # metres of river line kept each side of the deck
MIN_BRIDGE = 12.0         # shorter bridges (culverts, gutters) are not built
MIN_TUNNEL = 20.0
SIDEWALK = 1.2            # pavement each side of a vehicle deck, metres
PARAPET = 0.5
DIP_CLEAR = 8.0   # metres from the edge of the lower road to either end of the deck that the sinking road needs
DIP_HALF, DIP_STEP = 56.0, 8.0   # a lower road is followed this far each side of a flyover, with a vertex every DIP_STEP metres (it sinks where it passes under)
AP_LEN, AP_STEP = 80.0, 8.0   # a tunnel's approach roads are followed this far out of each mouth (a ramp at 10 % from 8 m down), a vertex every AP_STEP metres
PG_STEP = 4.0   # pg: the ground along a tunnel, a sample every PG_STEP metres
XG_ALONG, XG_ACROSS = 1.5, 5.0   # xg: the ground is read across the crossing road's width plus XG_ALONG, and out to XG_ACROSS beyond each side of the tunnel
SURFACE = ("motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service", "motorway_link", "trunk_link",
           "primary_link", "secondary_link", "tertiary_link")


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
    lower = [(rec, ls) for rec, ls in roads if not rec.get("tn") and rec["k"] in SURFACE]
    rl = [ls for rec, ls in lower]
    rtree = STRtree(rl) if rl else None
    over = [(rec, ls) for rec, ls in roads if not rec.get("tn") and not rec.get("br") and rec["k"] in SURFACE + ("pedestrian",)]   # what can cross over a tunnel at ground level
    ol = [ls for rec, ls in over]
    otree = STRtree(ol) if ol else None
    out, n_riv, n_over, n_xc = [], 0, 0, 0
    mouths = [pt[:2] for line, t, kind, cw in structs if kind == "t" for pt in (line.coords[0], line.coords[-1])]   # an approach stops at the next tunnel
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
                at = []   # (metres along the deck, lower road, where on it) of every road that passes under the deck (src/bridges.js lifts the deck only around these)
                for i in rtree.query(line):
                    g = rl[i]
                    if g.equals(line) or not g.crosses(line):
                        continue
                    p = g.intersection(line)
                    if p.is_empty or p.geom_type not in ("Point", "MultiPoint"):
                        continue
                    pts = [p] if p.geom_type == "Point" else list(p.geoms)
                    at += [(line.project(q), i, g.project(q)) for q in pts if 4.0 < line.project(q) < L - 4.0]
                if at:
                    at.sort()
                    oc, ud = [], []
                    for s, i, gs in at:
                        if oc and s - oc[-1] <= 6.0:
                            continue
                        oc.append(round(s, 1))
                        # the lower road sinks a little under the deck, so that the deck needs to climb less (DIP in src/bridges.js): its line round the crossing
                        g, lrec = rl[i], lower[i][0]
                        # the lower road must pass well clear of both ends of the deck: the approach road there stays on the ground, and a dip that reached it would leave the deck end standing in the air
                        if not lrec.get("br") and min(g.distance(Point(line.coords[0])), g.distance(Point(line.coords[-1]))) >= lrec["w"] / 2 + DIP_CLEAR:
                            cs = list(g.coords)
                            def at_s(t, g=g, cs=cs):   # a point of the lower road at arc length t, the road carried straight on past its ends
                                if 0.0 <= t <= g.length:
                                    q = g.interpolate(t)
                                    return (q.x, q.y)
                                a, b = (cs[0], cs[1]) if t < 0 else (cs[-1], cs[-2])
                                d = math.hypot(a[0] - b[0], a[1] - b[1]) or 1.0
                                e = -t if t < 0 else t - g.length
                                return (a[0] + (a[0] - b[0]) / d * e, a[1] + (a[1] - b[1]) / d * e)
                            n = int(round(2 * DIP_HALF / DIP_STEP))
                            pts2 = [at_s(gs - DIP_HALF + 2 * DIP_HALF * k / n) for k in range(n + 1)]
                            ud.append({"s": round(s, 1), "w": lrec["w"], "c": float(DIP_HALF), "p": [round(c, 1) for pt in pts2 for c in pt]})
                    rec["ov"] = 1
                    rec["oc"] = oc
                    if len(ud) == len(oc):
                        rec["ud"] = ud
                    n_over += 1
        elif not rec.get("f") and otree is not None:   # a tunnel: the roads and squares that cross over it at ground level, and the roads out of its mouths
            xc = []
            for i in otree.query(line):
                g, lrec = ol[i], over[i][0]
                if not g.crosses(line):
                    continue
                q = g.intersection(line)
                for pt in ([q] if q.geom_type == "Point" else [x for x in getattr(q, "geoms", []) if x.geom_type == "Point"]):
                    s = line.project(pt)
                    if 2.0 < s < L - 2.0 and not any(abs(s - c[0]) < 2.0 for c in xc):
                        # the width the road covers along the tunnel: a road that crosses at a slant (the Viale's side road over the Via Belgio link) reaches further
                        gs = g.project(pt)
                        a0, a1, b0, b1 = line.interpolate(max(0.0, s - 2.0)), line.interpolate(min(L, s + 2.0)), g.interpolate(max(0.0, gs - 2.0)), g.interpolate(min(g.length, gs + 2.0))
                        ux, uz, vx, vz = a1.x - a0.x, a1.y - a0.y, b1.x - b0.x, b1.y - b0.y
                        sin = abs(ux * vz - uz * vx) / ((math.hypot(ux, uz) * math.hypot(vx, vz)) or 1.0)
                        xc.append([round(s, 1), round(lrec["w"] / max(sin, 0.35), 1)])
            if xc:
                rec["xc"] = sorted(xc)
                rec["ap"] = [approach(line, e, rl, rtree, mouths) for e in (0, 1)]
                n_xc += 1
        out.append(rec)
    log(f"  structures: {sum(1 for r in out if r['k'] == 'b')} bridges ({n_riv} over water, {n_over} over roads), "
        f"{sum(1 for r in out if r['k'] == 't')} tunnels ({n_xc} with roads over them)")
    return out


def approach(line, end, rl, rtree, mouths=()):
    """The road out of a tunnel mouth (end 0: the start of `line`, 1: its end), outward, AP_LEN m with a vertex every AP_STEP m: the surface ways that
    join it end to end and carry on straightest (within 45 degrees), then straight on; it stops short where it reaches the mouth of another tunnel
    (Via Pietro Calandra runs under two motorway links 30 m apart: one's ramp would cut the other's roof). OSM's tunnel way is the covered part; where the tunnel has to go
    deeper to pass under a road, the ramp down to it lies on these roads (src/bridges.js)."""
    cs = list(line.coords)
    p, q = (cs[0], cs[1]) if end == 0 else (cs[-1], cs[-2])
    unit = lambda a, b: ((a[0] - b[0]) / (math.hypot(a[0] - b[0], a[1] - b[1]) or 1.0), (a[1] - b[1]) / (math.hypot(a[0] - b[0], a[1] - b[1]) or 1.0))
    d, pts, used, length = unit(p, q), [p[:2]], set(), 0.0
    other = [m for m in mouths if math.dist(m, p[:2]) > 1.5]
    while length < AP_LEN and not any(math.dist(m, p[:2]) < 1.5 for m in other):
        best = None
        for i in rtree.query(Point(p).buffer(1.5)):
            if i in used:
                continue
            c = [x[:2] for x in rl[i].coords]
            seq = c if math.dist(c[0], p[:2]) < 1.5 else c[::-1] if math.dist(c[-1], p[:2]) < 1.5 else None
            if not seq or len(seq) < 2:
                continue
            v = next((x for x in seq[1:] if math.dist(x, seq[0]) > 3.0), seq[-1])
            u = unit(v, seq[0])
            dot = u[0] * d[0] + u[1] * d[1]
            if best is None or dot > best[0]:
                best = (dot, i, seq)
        if best is None or best[0] < 0.7:
            break
        used.add(best[1])
        for x in best[2][1:]:
            length += math.dist(pts[-1], x)
            pts.append(x)
        p, d = best[2][-1], unit(best[2][-1], best[2][-2])
    if length < AP_LEN and not any(math.dist(m, p[:2]) < 1.5 for m in other):
        pts.append((pts[-1][0] + d[0] * (AP_LEN - length), pts[-1][1] + d[1] * (AP_LEN - length)))
    ln = substring(LineString(pts), 0.0, min(AP_LEN, length) if any(math.dist(m, p[:2]) < 1.5 for m in other) else AP_LEN)
    n = max(1, int(round(ln.length / AP_STEP)))
    return [round(c, 1) for k in range(n + 1) for c in ln.interpolate(ln.length * k / n).coords[0][:2]]


def tiles_of(rec, T):
    """Tile keys 'i_j' the structure (buffered by its width and the river window) touches."""
    pts = rec["p"]
    xs, zs = pts[0::2], pts[1::2]
    m = rec["w"] / 2 + (RIVER_WINDOW if "rv" in rec else 12)
    for r in rec.get("rv", []):
        xs, zs = xs + r[0::2], zs + r[1::2]
    for u in rec.get("ud", []) + rec.get("ap", []):
        xs, zs = xs + (u["p"] if isinstance(u, dict) else u)[0::2], zs + (u["p"] if isinstance(u, dict) else u)[1::2]
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


def crossing_ground(rec, ground):
    """xg: for every road that crosses over a tunnel, the lowest ground under it within its width (plus XG_ALONG) along the tunnel and out to XG_ACROSS
    beyond the tunnel's sides: what the tunnel has to stay under for that road to keep its ground (src/bridges.js)."""
    line = LineString(list(zip(rec["p"][0::2], rec["p"][1::2])))
    out = []
    for s, w in rec["xc"]:
        lo = 1e9
        for a in (-(w / 2 + XG_ALONG), 0.0, w / 2 + XG_ALONG):
            t = max(0.0, min(line.length, s + a))
            c, e = line.interpolate(max(0.0, t - 1.0)), line.interpolate(min(line.length, t + 1.0))
            l = math.hypot(e.x - c.x, e.y - c.y) or 1.0
            nx, nz = -(e.y - c.y) / l, (e.x - c.x) / l
            m = line.interpolate(t)
            for b in (-(rec["w"] / 2 + XG_ACROSS), 0.0, rec["w"] / 2 + XG_ACROSS):
                lo = min(lo, ground(m.x + nx * b, m.y + nz * b))
        out.append(round(lo, 2))
    return out


def tunnel_ground(rec, ground):
    """pg: the ground along a tunnel's centreline every PG_STEP m (the last sample at its end); ag: the ground under every vertex of the roads out of its
    mouths (ap). src/bridges.js reads the open cutting, the portals and the depth of the floor from these, so they do not depend on which tiles have loaded."""
    line = LineString(list(zip(rec["p"][0::2], rec["p"][1::2])))
    n = max(1, int(math.ceil(line.length / PG_STEP - 1e-6)))
    pg = [round(ground(*line.interpolate(min(line.length, k * PG_STEP)).coords[0][:2]), 2) for k in range(n + 1)]
    ag = [[round(ground(a[k], a[k + 1]), 2) for k in range(0, len(a), 2)] for a in rec.get("ap", [])]
    return pg, ag


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
    heights_ud = {}
    xgs = {}
    pgs = {}
    for r in structs:
        p = r["p"]
        a, b = (p[0], p[1]), (p[-2], p[-1])
        heights[r["id"]] = (round(ground(*a), 2), round(ground(*b), 2))
        if r.get("rv"):
            rivers[r["id"]] = river_floor(r, ground)
        if r.get("ud"):
            heights_ud[r["id"]] = r
        for u in r.get("ud", []):
            u["f"] = [round(ground(u["p"][k], u["p"][k + 1]), 2) for k in range(0, len(u["p"]), 2)]
        if r.get("xc"):
            xgs[r["id"]] = crossing_ground(r, ground)
        if r["k"] == "t":
            pgs[r["id"]] = tunnel_ground(r, ground)
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
            if "ud" in heights_ud.get(r["id"], {}):
                r["ud"] = heights_ud[r["id"]]["ud"]
            if r["id"] in xgs:
                r["xg"] = xgs[r["id"]]
            if r["id"] in pgs:
                r["pg"] = pgs[r["id"]][0]
                if pgs[r["id"]][1]:
                    r["ag"] = pgs[r["id"]][1]
        tmp = f + ".part"
        with open(tmp, "w") as fh:
            json.dump(d, fh, separators=(",", ":"), ensure_ascii=False)
        os.replace(tmp, f)
        n += 1
    log(f"  structures: end heights written into {n} tiles")
