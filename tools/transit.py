#!/usr/bin/env python3
"""Build the transit datasets of Palermo Drive: the tram, the AMAT bus routes and the public drinking fountains.

  tools/.venv/bin/python -I tools/transit_osm.py                     # once: tram, bus stops and water out of the OSM extract
  tools/.venv/bin/python -I tools/transit.py <gtfs_dir> <fountains.csv> [tram|bus|fountains|all]

Writes data/tram.json, data/bus_routes.json and data/fountains.json (git-ignored) in game metres: x east, z south of
Quattro Canti, the projection of tools/bake.py. Inputs: the AMAT GTFS feed and the Comune fountain CSV (tools/transit_fetch.py
downloads both, CC BY 4.0), data/tram_osm.json (tools/transit_osm.py) and data/bus_routes_osm.json (what the game uses today).
Nothing here is read by the game yet; docs/sources/transit.md describes the files.

Tram: the GTFS shapes are only a coarse guide (a point every 100 m, about 5 m beside the real tracks), so each line is matched
onto the OSM track graph stop to stop, and the OSM tracks are the geometry. Each stretch is labelled street, median, roadside
or separate from the OSM roads and barriers around it.
"""
import csv
import heapq
import json
import math
import os
import sys
from collections import Counter, defaultdict

from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OSM_TRAM = os.path.join(DATA, "tram_osm.json")
OSM_BUS = os.path.join(DATA, "bus_routes_osm.json")

MATCH_STOP = 100       # m, OSM tram stops within this of a GTFS stop are candidates for it (termini are up to 75 m off)
SHAPE_NEAR = 12        # m, track edges farther than this from the GTFS shape are discouraged when matching
SAMPLE = 8             # m between samples when labelling a track
MIN_STRETCH = 40       # m, shorter runs of a label are absorbed by their neighbour
PARALLEL = 28          # degrees, a road or fence counts as running beside the tram within this
SIDE_ROAD = 40         # m, a parallel road farther than this is not "beside" the tram
BARRIER_NEAR = 8       # m, a fence or wall within this of the track counts as its railing
DRIVABLE = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
            "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "pedestrian"}
RAILING = {"fence", "guard_rail", "handrail", "wall", "retaining_wall", "kerb"}


def proj(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


def r1(v):
    return round(v, 1)


def pts_out(pts):
    return [[r1(x), r1(z)] for x, z in pts]


def dp(pts, tol):
    """Douglas-Peucker on [(x, z)], iterative."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop()
        ax, az = pts[a]
        bx, bz = pts[b]
        dx, dz = bx - ax, bz - az
        l2 = dx * dx + dz * dz
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, pz = pts[i]
            if l2 == 0:
                d = math.hypot(px - ax, pz - az)
            else:
                t = max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / l2))
                d = math.hypot(px - ax - t * dx, pz - az - t * dz)
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            st.append((a, bi))
            st.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def read_csv(path, **kw):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, **kw))


def bearing_diff(a, b):
    """Smallest angle between two undirected lines, degrees (0 to 90)."""
    d = abs(a - b) % 180
    return min(d, 180 - d)


def seg_angle(p, q):
    return math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))


def write_json(name, obj):
    path = os.path.join(DATA, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {path} ({os.path.getsize(path) / 1024:.0f} KB)")


# ----------------------------------------------------------------------------------------------
# GTFS
# ----------------------------------------------------------------------------------------------
def load_gtfs(gdir):
    g = {}
    g["feed"] = read_csv(os.path.join(gdir, "feed_info.txt"))[0]
    g["routes"] = {r["route_id"]: r for r in read_csv(os.path.join(gdir, "routes.txt"))}
    g["trips"] = {t["trip_id"]: t for t in read_csv(os.path.join(gdir, "trips.txt"))}
    g["stops"] = {s["stop_id"]: s for s in read_csv(os.path.join(gdir, "stops.txt"))}
    sh = defaultdict(list)
    for r in read_csv(os.path.join(gdir, "shapes.txt")):
        sh[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
    g["shapes"] = {k: [proj(la, lo) for _, la, lo in sorted(v)] for k, v in sh.items()}
    seq = defaultdict(list)
    for r in read_csv(os.path.join(gdir, "stop_times.txt")):
        seq[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"], r["departure_time"]))
    g["seq"] = {k: sorted(v) for k, v in seq.items()}
    return g


def patterns(g, route_ids):
    """Group the trips of the given routes into patterns: same route, direction, shape and stop list."""
    pat = {}
    for tid, t in g["trips"].items():
        if t["route_id"] not in route_ids or tid not in g["seq"]:
            continue
        sq = g["seq"][tid]
        key = (t["route_id"], t["direction_id"], t["shape_id"], tuple(s for _, s, _ in sq))
        p = pat.setdefault(key, {"trips": 0, "first": "99:99", "last": "00:00"})
        p["trips"] += 1
        dep = sq[0][2][:5]
        p["first"] = min(p["first"], dep)
        p["last"] = max(p["last"], dep)
    return pat


# ----------------------------------------------------------------------------------------------
# tram
# ----------------------------------------------------------------------------------------------
class TrackGraph:
    """The OSM tram ways as a directed graph over their vertices (oneway=yes ways run forwards only)."""

    def __init__(self, ways):
        self.ways = ways
        self.idx, self.xz, self.adj = {}, [], []
        for wi, w in enumerate(ways):
            ids = [self.node(p) for p in w["pts"]]
            fwd_only = w["tags"].get("oneway") in ("yes", "true", "1")
            rev_only = w["tags"].get("oneway") == "-1"
            for a, b in zip(ids, ids[1:]):
                if a == b:
                    continue
                d = math.dist(self.xz[a], self.xz[b])
                if not rev_only:
                    self.adj[a].append((b, d, wi))
                if not fwd_only:
                    self.adj[b].append((a, d, wi))
            w["ids"] = ids

    def node(self, p):
        k = (p[0], p[1])
        if k not in self.idx:
            self.idx[k] = len(self.xz)
            self.xz.append(proj(*k))
            self.adj.append([])
        return self.idx[k]

    def nearest(self, xz, within):
        best, bd = -1, within
        for i, q in enumerate(self.xz):
            d = math.dist(q, xz)
            if d < bd:
                best, bd = i, d
        return best, bd

    def route(self, a, b, shape):
        """Cheapest directed path of vertex ids from a to b; edges far from the GTFS shape and sidings cost extra."""
        dist, prev, heap = {a: 0.0}, {}, [(0.0, a)]
        while heap:
            d, u = heapq.heappop(heap)
            if u == b:
                break
            if d > dist.get(u, 1e18):
                continue
            for v, w, wi in self.adj[u]:
                mid = ((self.xz[u][0] + self.xz[v][0]) / 2, (self.xz[u][1] + self.xz[v][1]) / 2)
                pen = 1.0
                if shape.distance(Point(mid)) > SHAPE_NEAR:
                    pen += 3.0
                if self.ways[wi]["tags"].get("service") in ("siding", "crossover"):
                    pen += 4.0
                nd = d + w * pen
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = (u, wi)
                    heapq.heappush(heap, (nd, v))
        if b not in prev and a != b:
            return None
        path, wis, u = [b], [], b
        while u != a:
            u, wi = prev[u]
            path.append(u)
            wis.append(wi)
        return path[::-1], wis[::-1], dist.get(b, 0.0)


def chains(graph):
    """Merge OSM ways into track chains: ways that meet end to end, alone at their shared vertex and alike in tags."""
    ways = graph.ways
    ends = defaultdict(list)
    for wi, w in enumerate(ways):
        ends[w["ids"][0]].append((wi, "start"))
        ends[w["ids"][-1]].append((wi, "end"))
    key = lambda w: (w["tags"].get("oneway"), w["tags"].get("service"), w["tags"].get("bridge"), w["tags"].get("covered"),
                     w["tags"].get("level"))
    nxt = {}
    for v, lst in ends.items():
        if len(lst) != 2:
            continue
        (a, ea), (b, eb) = lst
        if a == b or key(ways[a]) != key(ways[b]):
            continue
        if ways[a]["tags"].get("oneway") in ("yes", "-1"):
            if ea == "end" and eb == "start":
                nxt[a] = (b, False)
            elif ea == "start" and eb == "end":
                nxt[b] = (a, False)
        else:
            nxt.setdefault(a, (b, ea == eb)) if ea == "end" else None
            nxt.setdefault(b, (a, ea == eb)) if eb == "end" else None
    # simple chain building: follow forward links from ways nobody links to
    linked = {b for b, _ in nxt.values()}
    out, used = [], set()
    for wi in range(len(ways)):
        if wi in used or wi in linked:
            continue
        seq, cur, flip = [(wi, False)], wi, False
        used.add(wi)
        while cur in nxt and nxt[cur][0] not in used:
            b, rev = nxt[cur]
            flip = flip != rev
            seq.append((b, flip))
            used.add(b)
            cur = b
        out.append(seq)
    for wi in range(len(ways)):      # rings and anything left over
        if wi not in used:
            out.append([(wi, False)])
            used.add(wi)
    return out


def tram(g, osm):
    tways = osm["tram_ways"]
    graph = TrackGraph(tways)
    roads = [w for w in osm["other_ways"] if w["tags"].get("highway") in DRIVABLE]
    barriers = [w for w in osm["other_ways"] if w["tags"].get("barrier") in RAILING]
    road_lines = [LineString([proj(*p) for p in w["pts"]]) for w in roads]
    bar_lines = [LineString([proj(*p) for p in w["pts"]]) for w in barriers]
    road_tree, bar_tree = STRtree(road_lines), STRtree(bar_lines)

    def beside(tree, lines, pt, tangent, lim):
        """(left, right) distance to the nearest parallel line on each side of the track point, None when there is none."""
        res = [None, None]
        for i in tree.query(Point(pt).buffer(lim)):
            ln = lines[i]
            pr = ln.project(Point(pt))
            q = ln.interpolate(pr)
            d = q.distance(Point(pt))
            if d > lim:
                continue
            a = ln.interpolate(max(0, pr - 3))
            b = ln.interpolate(min(ln.length, pr + 3))
            if bearing_diff(seg_angle((a.x, a.y), (b.x, b.y)), tangent) > PARALLEL:
                continue
            cross = math.cos(math.radians(tangent)) * (q.y - pt[1]) - math.sin(math.radians(tangent)) * (q.x - pt[0])
            s = 0 if cross < 0 else 1       # z points south, so a negative cross is the travel direction's left
            if res[s] is None or d < res[s]:
                res[s] = d
        return res

    # ---- tracks (physical rails), labelled
    ch = chains(graph)
    tracks = []
    for ci, seq in enumerate(ch):
        pts, wids = [], []
        for wi, flip in seq:
            p = [graph.xz[i] for i in graph.ways[wi]["ids"]]
            if flip:
                p = p[::-1]
            pts += p if not pts else p[1:]
            wids.append(graph.ways[wi]["id"])
        t0 = graph.ways[seq[0][0]]["tags"]
        track = {"id": ci, "osm_ways": wids, "oneway": t0.get("oneway") == "yes",
                 "service": t0.get("service"), "bridge": t0.get("bridge") == "yes", "covered": t0.get("covered") == "yes",
                 "maxspeed_kmh": sorted({int(w["tags"]["maxspeed"]) for wi, _ in seq for w in [graph.ways[wi]] if w["tags"].get("maxspeed", "").isdigit()}),
                 "len": r1(length(pts)), "_pts": pts, "_wi": {wi for wi, _ in seq}}
        ln = LineString(pts)
        n = max(2, int(ln.length / SAMPLE) + 1)
        labels, rail = [], []
        for k in range(n):
            s = ln.length * k / (n - 1)
            p = ln.interpolate(s)
            a, b = ln.interpolate(max(0, s - 4)), ln.interpolate(min(ln.length, s + 4))
            ang = seg_angle((a.x, a.y), (b.x, b.y))
            left, right = beside(road_tree, road_lines, (p.x, p.y), ang, SIDE_ROAD)
            near = min(d for d in (left, right) if d is not None) if (left is not None or right is not None) else None
            if near is not None and near < 2.5:
                lab = "street"
            elif left is not None and right is not None:
                lab = "median"
            elif left is not None or right is not None:
                lab = "roadside"
            else:
                lab = "separate"
            labels.append(lab)
            bl, br = beside(bar_tree, bar_lines, (p.x, p.y), ang, BARRIER_NEAR)
            rail.append(bl is not None or br is not None)
        track["_lab"], track["_rail"], track["_s"] = labels, rail, [ln.length * k / (n - 1) for k in range(n)]
        tracks.append(track)
        track["stretches"] = stretches(track)
    # tracks that are bridges or covered keep their own labels
    return graph, tracks, ch


def stretches(track):
    """Run-length the per-sample labels into stretches (distance along the track), absorbing runs shorter than MIN_STRETCH."""
    labs, sv, rail = list(track["_lab"]), track["_s"], track["_rail"]
    runs = []
    for i, l in enumerate(labs):
        if runs and runs[-1][0] == l:
            runs[-1][2] = i
        else:
            runs.append([l, i, i])
    changed = True
    while changed and len(runs) > 1:
        changed = False
        for i, (l, a, b) in enumerate(runs):
            if (sv[b] - sv[a]) < MIN_STRETCH and len(runs) > 1:
                j = i - 1 if i > 0 else i + 1
                if 0 < i < len(runs) - 1 and (runs[i + 1][2] - runs[i + 1][1]) > (runs[i - 1][2] - runs[i - 1][1]):
                    j = i + 1
                runs[j][1], runs[j][2] = min(runs[j][1], a), max(runs[j][2], b)
                del runs[i]
                changed = True
                break
        merged = []
        for r in runs:
            if merged and merged[-1][0] == r[0]:
                merged[-1][2] = r[2]
            else:
                merged.append(r)
        runs = merged
    out = []
    for l, a, b in runs:
        frac = sum(rail[a:b + 1]) / (b - a + 1)
        out.append({"mode": l, "s0": r1(sv[a] if a else 0), "s1": r1(track["len"] if b == len(sv) - 1 else sv[b]),
                    "railing_osm": round(frac, 2)})
    for i in range(1, len(out)):
        out[i]["s0"] = out[i - 1]["s1"]
    return out


def build_tram(g, osm, out):
    graph, tracks, ch = tram(g, osm)
    way_to_track = {}
    for t in tracks:
        for wi in t["_wi"]:
            way_to_track[wi] = t["id"]
    stops_osm = [n for n in osm["nodes"] if n["tags"].get("railway") == "tram_stop"]
    stop_xz = [proj(n["lat"], n["lon"]) for n in stops_osm]
    plats = [(w, LineString([proj(*p) for p in w["pts"]])) for w in osm["other_ways"] if w["tags"].get("railway") == "platform"]
    lines, report = {}, {}
    seen_stops = {}
    for rid, route in sorted(g["routes"].items()):
        if not rid.startswith("TRAM"):
            continue
        num = int(rid[4:])
        pat = patterns(g, {rid})
        dirs = []
        for (r, direction, shape_id, stops), info in sorted(pat.items(), key=lambda kv: -kv[1]["trips"]):
            if any(d["direction"] == int(direction) for d in dirs):
                continue
            shape = LineString(g["shapes"][shape_id])
            # tie each GTFS stop to a track vertex: the few OSM tram stops around it are candidates (one per platform side
            # and direction), and the best chain of candidates over the whole line wins
            srec, cands = [], []
            for sid in stops:
                s = g["stops"][sid]
                p = proj(float(s["stop_lat"]), float(s["stop_lon"]))
                near = sorted(((math.dist(q, p), i) for i, q in enumerate(stop_xz)))[:6]
                near = [(d, i) for d, i in near if d <= MATCH_STOP or d == near[0][0]]
                cs = []
                for d, i in near:
                    vi, vd = graph.nearest(stop_xz[i], 25)
                    if vi >= 0 and all(vi != c[0] for c in cs):
                        cs.append((vi, d, i))
                if not cs:
                    vi, vd = graph.nearest(p, 100)
                    cs = [(vi, vd, None)]
                cands.append(cs)
                srec.append({"id": sid, "name": s["stop_name"], "p": p})
            # Viterbi over candidates
            best = [{k: (0.0, None, None) for k in range(len(cands[0]))}]
            for k in range(1, len(cands)):
                cur = {}
                for j, cj in enumerate(cands[k]):
                    opt = None
                    for i, ci in enumerate(cands[k - 1]):
                        if i not in best[-1]:
                            continue
                        res = graph.route(ci[0], cj[0], shape) if ci[0] >= 0 and cj[0] >= 0 else None
                        if res is None:
                            continue
                        c = best[-1][i][0] + res[2]
                        if opt is None or c < opt[0]:
                            opt = (c, i, res)
                    if opt:
                        cur[j] = opt
                if not cur:     # no way through: restart the chain at this stop
                    cur = {j: (0.0, None, None) for j in range(len(cands[k]))}
                best.append(cur)
            j = min(best[-1], key=lambda q: best[-1][q][0])
            chosen = [None] * len(cands)
            legs = [None] * len(cands)
            for k in range(len(cands) - 1, -1, -1):
                chosen[k] = j
                legs[k] = best[k][j][2]
                j = best[k][j][1]
                if j is None and k > 0:
                    j = min(best[k - 1], key=lambda q: best[k - 1][q][0])
            vids = []
            for k, c in enumerate(cands):
                vi, dd, oi = c[chosen[k]]
                vids.append(vi)
                srec[k]["osm"] = stops_osm[oi] if oi is not None and dd <= 100 else None
                srec[k]["osm_d"] = dd
                srec[k]["v"] = vi
            full, wis, failed = [], [], []
            for k in range(1, len(vids)):
                res = legs[k]
                if res is None:
                    failed.append(k - 1)
                    continue
                full += res[0] if not full else res[0][1:]
                wis += res[1]
            path = [graph.xz[i] for i in full]
            cum, ssum = [], 0.0
            for i in range(len(path)):
                if i:
                    ssum += math.dist(path[i - 1], path[i])
                cum.append(ssum)
            # stop records: chainage along the path, platform side
            stops_out = []
            pos = {v: cum[full.index(v)] for v in vids if v in full}
            for sr in srec:
                st = {"id": sr["id"], "name": sr["name"].title(), "x": r1(sr["p"][0]), "z": r1(sr["p"][1])}
                if sr["v"] >= 0:
                    on = graph.xz[sr["v"]]
                    st["on_track"] = [r1(on[0]), r1(on[1])]
                    st["s"] = r1(pos.get(sr["v"], 0))
                    plat = None
                    best = 30
                    for w, ln in plats:
                        d = ln.distance(Point(on))
                        if d < best:
                            best, plat = d, (w, ln)
                    if plat:
                        w, ln = plat
                        i = full.index(sr["v"]) if sr["v"] in full else 0
                        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
                        c = ln.centroid
                        cross = (b[0] - a[0]) * (c.y - on[1]) - (b[1] - a[1]) * (c.x - on[0])
                        st["platform"] = {"osm_way": w["id"], "pts": pts_out(list(ln.coords)), "dist": r1(best),
                                          "side": "right" if cross > 0 else "left",
                                          "shelter": w["tags"].get("shelter") == "yes", "bench": w["tags"].get("bench") == "yes"}
                if sr["osm"]:
                    st["osm_stop"] = sr["osm"]["id"]
                    st["osm_stop_dist"] = r1(sr["osm_d"])
                stops_out.append(st)
            tids = []
            for wi in wis:
                t = way_to_track[wi]
                if not tids or tids[-1] != t:
                    tids.append(t)
            # agreement: GTFS shape against the matched OSM path
            mp = LineString(path) if len(path) > 1 else None
            n = max(2, int(shape.length / 3))
            ds = [mp.distance(shape.interpolate(shape.length * k / (n - 1))) for k in range(n)] if mp else []
            dirs.append({"direction": int(direction), "gtfs_shape": shape_id, "trips": info["trips"], "first": info["first"],
                         "last": info["last"], "stops": stops_out, "tracks": tids, "length": r1(cum[-1]) if cum else 0,
                         "path": pts_out(dp(path, 0.2)), "unmatched_stop_pairs": failed,
                         "_ds": ds, "_shape": shape})
        lines[num] = {"line": num, "gtfs_route": rid, "name": route["route_long_name"], "color": "#" + route["route_color"],
                      "directions": sorted(dirs, key=lambda d: d["direction"])}
    # which lines use which track
    uses = defaultdict(set)
    for ln in lines.values():
        for d in ln["directions"]:
            for t in d["tracks"]:
                uses[t].add(ln["line"])
    # track agreement and the OSM route relations as a second opinion
    rels, track_way_ids = {}, {w["id"] for w in osm["tram_ways"]}
    for r in osm["relations"]:
        rels.setdefault(r["tags"]["ref"], set()).update(m["ref"] for m in r["members"] if m["type"] == "w" and m["ref"] in track_way_ids)
    way_ids_used = defaultdict(set)
    for ln in lines.values():
        for d in ln["directions"]:
            for t in d["tracks"]:
                way_ids_used[ln["line"]].update(tracks[t]["osm_ways"])
    stats = {}
    for ln in lines.values():
        for d in ln["directions"]:
            ds = sorted(d.pop("_ds"))
            d.pop("_shape")
            if ds:
                stats[f"L{ln['line']}d{d['direction']}"] = {
                    "gtfs_shape_pts": len(g["shapes"][d["gtfs_shape"]]), "n": len(ds), "mean": round(sum(ds) / len(ds), 2),
                    "median": round(ds[len(ds) // 2], 2), "p95": round(ds[int(len(ds) * .95)], 2), "max": round(ds[-1], 2),
                    "within_10m": round(sum(1 for x in ds if x <= 10) / len(ds), 3)}
    for num, ln in lines.items():
        rw = rels.get(f"L{num}", set())
        mine = way_ids_used[num]
        stats[f"L{num}_osm_relation_ways"] = {"relation": len(rw), "matched": len(mine), "common": len(rw & mine),
                                              "relation_only": len(rw - mine)}
    crossings = [{"x": r1(proj(n["lat"], n["lon"])[0]), "z": r1(proj(n["lat"], n["lon"])[1])}
                 for n in osm["nodes"] if n["tags"].get("railway") == "tram_crossing"]
    buffers = [list(map(r1, proj(n["lat"], n["lon"]))) for n in osm["nodes"] if n["tags"].get("railway") == "buffer_stop"]
    tout = []
    for t in tracks:
        mode_len = Counter()
        for s in t["stretches"]:
            mode_len[s["mode"]] += s["s1"] - s["s0"]
        tout.append({"id": t["id"], "osm_ways": t["osm_ways"], "lines": sorted(uses.get(t["id"], [])), "oneway": t["oneway"],
                     "service": t["service"], "bridge": t["bridge"], "covered": t["covered"], "maxspeed_kmh": t["maxspeed_kmh"],
                     "len": t["len"], "pts": pts_out(t["_pts"]), "stretches": t["stretches"]})
    mode_total = Counter()
    for t in tout:
        if t["lines"]:
            for s in t["stretches"]:
                mode_total[s["mode"]] += s["s1"] - s["s0"]
    doc = {
        "note": "Palermo tram. Geometry from OpenStreetMap (ODbL), line, stop and timetable data from AMAT GTFS (CC BY 4.0; "
                "the Comune states the tram lines in the feed were georeferenced on OSM, so treat the tram data as ODbL / CC BY-SA). "
                "Game metres, x east, z south of Quattro Canti.",
        "feed": {"publisher": g["feed"]["feed_publisher_name"], "start": g["feed"]["feed_start_date"], "end": g["feed"]["feed_end_date"]},
        "electrification": {"type": "overhead contact line", "voltage_v": 750, "gauge_mm": 1435, "source": "OSM tags on the tram ways"},
        "catenary": {"pole_spacing_m": None, "side": None, "colour": "dark red steel poles (Mapillary photos)",
                     "railing": "black iron railing with arched panels on a low concrete plinth beside the median tracks (photos)",
                     "note": "Neither is in OSM (no power=pole or railway=catenary_mast within the network) and the GTFS has none. "
                             "Spacing and side are unknown: the photos (2019 to 2021) show tall dark red steel poles on the median "
                             "next to the railing with bracket arms and wires over the tracks, but no pole count could be taken from them."},
        "lines": [lines[k] for k in sorted(lines)],
        "tracks": tout,
        "crossings": crossings,
        "buffer_stops": buffers,
        "quality": {"agreement_gtfs_vs_osm_path_m": stats, "track_metres_by_mode_on_line_tracks": {k: round(v) for k, v in mode_total.items()}}}
    write_json("tram.json", doc)
    return doc


# ----------------------------------------------------------------------------------------------
# buses
# ----------------------------------------------------------------------------------------------
def build_bus(g, osm, out):
    bus_ids = {rid for rid in g["routes"] if not rid.startswith("TRAM")}
    pat = patterns(g, bus_ids)
    # the OSM routes the game uses today
    cur = defaultdict(list)
    for e in json.load(open(OSM_BUS))["elements"]:
        t = e["tags"]
        ln = []
        for m in e["members"]:
            if m["type"] == "way" and m.get("geometry"):
                ln.append([proj(p["lat"], p["lon"]) for p in m["geometry"]])
        cur[t.get("ref", "")] += [LineString(w) for w in ln if len(w) > 1]
    cur_u = {k: unary_union(v) for k, v in cur.items()}
    pbf_refs = defaultdict(list)
    for r in osm["bus_relations"]:
        pbf_refs[r["tags"].get("ref", "")].append({"id": r["id"], "name": r["tags"].get("name"), "operator": r["tags"].get("operator"),
                                                  "network": r["tags"].get("network")})
    osm_stops = [proj(s["lat"], s["lon"]) for s in osm["bus_stops"]]
    stree = STRtree([Point(p) for p in osm_stops])
    stops_out, routes = {}, {}
    for (rid, direction, shape_id, stops), info in pat.items():
        r = g["routes"][rid]
        sh = g["shapes"].get(shape_id)
        if not sh or len(sh) < 2:
            continue
        entry = routes.setdefault(rid, {"ref": r["route_short_name"], "name": r["route_long_name"], "color": "#" + r["route_color"],
                                        "patterns": []})
        for sid in stops:
            if sid not in stops_out:
                s = g["stops"][sid]
                x, z = proj(float(s["stop_lat"]), float(s["stop_lon"]))
                j = stree.nearest(Point(x, z))
                d = math.dist((x, z), osm_stops[j]) if j is not None else None
                stops_out[sid] = {"id": sid, "name": s["stop_name"].title(), "x": r1(x), "z": r1(z),
                                  "osm_stop_m": r1(d) if d is not None and d <= 40 else None}
        entry["patterns"].append({"direction": int(direction), "shape": shape_id, "trips": info["trips"], "first": info["first"],
                                  "last": info["last"], "stops": list(stops), "len": r1(length(sh)),
                                  "shape_pts": pts_out(dp(sh, 1.0))})
    # compare the main pattern of each route with the OSM relations of the same ref
    summary = {"ok": [], "differs": [], "missing_in_osm": []}
    for rid, e in routes.items():
        e["patterns"].sort(key=lambda p: (-p["trips"], p["direction"]))
        ref = e["ref"]
        o = cur_u.get(ref)
        tot = sum(p["len"] for p in e["patterns"][:2])
        cov = None
        if o is not None and not o.is_empty:
            near = o.buffer(30)
            inside = 0.0
            for p in e["patterns"][:2]:
                sh = g["shapes"][p["shape"]]
                ln = LineString(sh)
                inside += ln.intersection(near).length
            cov = inside / tot if tot else 0
        e["osm"] = {"relations_in_game_data": len(cur.get(ref, [])) > 0, "shape_covered_by_osm": round(cov, 2) if cov is not None else None,
                    "relations_any_operator_in_pbf": pbf_refs.get(ref, [])}
        if o is None:
            e["osm"]["status"] = "missing_in_osm"
        elif cov >= 0.85:
            e["osm"]["status"] = "ok"
        else:
            e["osm"]["status"] = "differs"
        summary[e["osm"]["status"]].append(ref)
        used = {s for p in e["patterns"] for s in p["stops"]}
        e["stop_ids"] = sorted(used, key=int)
    gtfs_refs = {e["ref"] for e in routes.values()}
    osm_only = sorted(k for k in cur_u if k not in gtfs_refs)
    near_stops = [s["osm_stop_m"] for s in stops_out.values()]
    doc = {
        "note": "AMAT bus routes from the GTFS feed (CC BY 4.0), game metres (x east, z south of Quattro Canti). Each route has "
                "patterns (direction, trip count, stop list, shape, simplified to 1 m). osm.status compares the two busiest patterns "
                "with the OSM relations in data/bus_routes_osm.json (ok: 85 percent or more of the shape within 30 m of the OSM line).",
        "feed": {"publisher": g["feed"]["feed_publisher_name"], "start": g["feed"]["feed_start_date"], "end": g["feed"]["feed_end_date"]},
        "routes": [routes[k] for k in sorted(routes, key=lambda k: (not routes[k]["ref"].isdigit(), int(routes[k]["ref"]) if routes[k]["ref"].isdigit() else 0, routes[k]["ref"]))],
        "stops": [stops_out[k] for k in sorted(stops_out, key=int)],
        "quality": {"routes": len(routes), "patterns": sum(len(e["patterns"]) for e in routes.values()), "stops": len(stops_out),
                    "status": {k: sorted(v) for k, v in summary.items()}, "osm_refs_not_in_gtfs": osm_only,
                    "stops_with_osm_bus_stop_within_40m": sum(1 for d in near_stops if d is not None)}}
    write_json("bus_routes.json", doc)
    return doc


# ----------------------------------------------------------------------------------------------
# fountains
# ----------------------------------------------------------------------------------------------
def build_fountains(path, osm):
    rows = read_csv(path, delimiter=";")
    water = [(proj(w["lat"], w["lon"]), w) for w in osm["drinking_water"]]
    wtree = STRtree([Point(p) for p, _ in water])
    out, seen = [], set()
    for r in rows:
        lat, lon = float(r["latitudine"]), float(r["longitudine"])
        key = (round(lat, 5), round(lon, 5))
        x, z = proj(lat, lon)
        j = wtree.nearest(Point(x, z))
        d = math.dist((x, z), water[j][0]) if j is not None else None
        out.append({"x": r1(x), "z": r1(z), "kind": r["Nome"].strip().lower(), "address": r["Indirizzo"].strip().rstrip(","),
                    "lat": lat, "lon": lon, "osm_m": r1(d) if d is not None and d <= 50 else None, "duplicate": key in seen})
        seen.add(key)
    inside = [f for f in out if 38.0 < f["lat"] < 38.3 and 13.2 < f["lon"] < 13.5]
    comune_pts = [(f["x"], f["z"]) for f in out]
    only = []
    for (x, z), w in water:
        if all(math.dist((x, z), c) > 25 for c in comune_pts):
            only.append({"x": r1(x), "z": r1(z), "osm_id": w["id"], "name": w["tags"].get("name")})
    doc = {"note": "Public drinking fountains. comune: Comune di Palermo open data (AMAP SpA list, CC BY 4.0, a 2019 snapshot). "
                   "osm_only: OSM amenity=drinking_water nodes more than 25 m from any Comune entry (ODbL). Game metres.",
           "comune": out, "osm_only": only,
           "quality": {"comune": len(out), "kinds": dict(Counter(f["kind"] for f in out)), "inside_palermo_box": len(inside),
                       "duplicates": sum(1 for f in out if f["duplicate"]), "also_in_osm_within_50m": sum(1 for f in out if f["osm_m"] is not None),
                       "osm_drinking_water": len(water), "osm_only": len(only)}}
    write_json("fountains.json", doc)
    return doc


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    gdir, fcsv = args[0], args[1]
    what = args[2] if len(args) > 2 else "all"
    osm = json.load(open(OSM_TRAM))
    if what in ("tram", "bus", "all"):
        g = load_gtfs(gdir)
        if what in ("tram", "all"):
            build_tram(g, osm, DATA)
        if what in ("bus", "all"):
            build_bus(g, osm, DATA)
    if what in ("fountains", "all"):
        build_fountains(fcsv, osm)


if __name__ == "__main__":
    main()
