"""Palermo's tram for the world tiles (tools/tiles.py calls Tram.tile per tile; `python tools/tram.py` writes assets/traffic/tram-lines.js).

Source: data/tram.json (tools/transit.py: OSM tram tracks, platforms, stops, AMAT GTFS lines and timetables; see docs/sources/transit.md).
Per tile `tram = {r: [{p, m}], s: [{x, z, n, a: [x0, z0, x1, z1], sh, b}], o: [[x, z, yaw]]}`:
  r  the rails: flat polylines clipped to the tile, m the stretch kind (m median, r roadside, s street, p separate);
  s  the stops with their platform line (a; w its half width when OSM maps the platform as an area; a platform two stops share is on the first only);
  o  catenary poles.
Railings (black iron, arched panels, low plinth; photos only, not in OSM) go into the tile's `fences` as kind f style 0, 1.1 m high, along the
median and roadside stretches, 1.9 m outside each rail, not where another track is near, not at stops and crossings.
POLE_SPACING is a DESIGN VALUE: neither OSM nor the GTFS knows where the poles are and the photos give no count. Dark red steel poles on the
median between the two tracks (single track: 2.3 m to the right), one every 30 m.
"""
import json
import math
import os

from shapely.geometry import LineString, MultiLineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PATH = os.path.join(ROOT, "data", "tram.json")
POLE_SPACING = 30.0
RAIL_OFFSET = 1.9
KEEP_OUT_STOP = 16.0     # no railing within this distance of a stop
KEEP_OUT_CROSSING = 7.0
CREDIT = "Tram: AMAT Palermo S.p.A. open data (GTFS, CC BY 4.0) and OpenStreetMap contributors (ODbL), tram lines georeferenced on OSM"


def _mode(track):
    best, bl = "m", 0
    tot = {}
    for s in track["stretches"]:
        tot[s["mode"]] = tot.get(s["mode"], 0) + s["s1"] - s["s0"]
    for m, l in tot.items():
        if l > bl:
            best, bl = m, l
    return {"median": "m", "roadside": "r", "street": "s", "separate": "p"}.get(best, "m")


def _platform(pl):
    """-> ([x0, z0, x1, z1] platform centreline, half width or None). A platform mapped as a line is its end points (drawn 2.6 m wide);
    one mapped as an area (a closed way, Notarbartolo's island) is the long axis of its smallest enclosing rectangle and half its width."""
    if not pl or len(pl) < 2:
        return None, None
    if len(pl) < 4 or pl[0] != pl[-1]:
        return [pl[0][0], pl[0][1], pl[-1][0], pl[-1][1]], None
    r = list(Polygon(pl).minimum_rotated_rectangle.exterior.coords)[:4]
    e = [math.dist(r[k], r[(k + 1) % 4]) for k in range(4)]
    k = 0 if e[0] < e[1] else 1   # r[k] -> r[k+1] is a short side
    m0 = ((r[k][0] + r[k + 1][0]) / 2, (r[k][1] + r[k + 1][1]) / 2)
    m1 = ((r[k + 2][0] + r[(k + 3) % 4][0]) / 2, (r[k + 2][1] + r[(k + 3) % 4][1]) / 2)
    return [m0[0], m0[1], m1[0], m1[1]], e[k] / 2


class Tram:
    def __init__(self, path=PATH):
        d = json.load(open(path))
        self.d = d
        self.tracks = []
        for t in d["tracks"]:
            if len(t["pts"]) >= 2 and t["len"] >= 8:
                self.tracks.append({"g": LineString(t["pts"]), "m": _mode(t), "line": bool(t["lines"]), "svc": bool(t.get("service"))})
        self.stops = {}
        plat_seen = set()
        for L in d["lines"]:
            for dr in L["directions"]:
                for s in dr["stops"]:
                    if s["id"] in self.stops:
                        continue
                    pl = s["platform"]["pts"] if s.get("platform") else None
                    a, w = _platform(pl)
                    way = s["platform"].get("osm_way") if pl else None
                    if a and way is not None and way in plat_seen:   # an island platform serving both directions: drawn once
                        a = None
                    elif a and way is not None:
                        plat_seen.add(way)
                    self.stops[s["id"]] = {"x": s["x"], "z": s["z"], "n": s["name"], "a": a, "w": w, "sh": 1 if s.get("platform", {}).get("shelter") else 0,
                                           "b": 1 if s.get("platform", {}).get("bench") else 0, "ox": s["on_track"][0], "oz": s["on_track"][1]}
        self.cross = [Point(c["x"], c["z"]) for c in d.get("crossings", [])]
        self.keepout = unary_union([Point(s["x"], s["z"]).buffer(KEEP_OUT_STOP) for s in self.stops.values()] + [c.buffer(KEEP_OUT_CROSSING) for c in self.cross])
        allg = [t["g"] for t in self.tracks]
        self.rails = []   # railing lines (whole network), computed once
        for i, t in enumerate(self.tracks):
            if t["m"] not in ("m", "r") or t["svc"]:
                continue
            others = unary_union([g for j, g in enumerate(allg) if j != i]).buffer(3.4)
            for side in (1, -1):
                try:
                    off = t["g"].offset_curve(RAIL_OFFSET * side)
                except Exception:  # noqa: BLE001
                    continue
                if off.is_empty:
                    continue
                for part in ([off] if off.geom_type == "LineString" else list(getattr(off, "geoms", []))):
                    left = part.difference(others).difference(self.keepout)
                    for q in ([left] if left.geom_type == "LineString" else [x for x in getattr(left, "geoms", []) if x.geom_type == "LineString"]):
                        if q.length >= 4:
                            self.rails.append(q)
        # poles
        self.poles = []
        seen = set()
        for i, t in enumerate(self.tracks):
            if not t["line"]:
                continue
            g = t["g"]
            others = [allg[j] for j in range(len(allg)) if j != i and self.tracks[j]["line"]]
            for s in [k * POLE_SPACING + 8 for k in range(int(g.length // POLE_SPACING))]:
                p = g.interpolate(s)
                q = g.interpolate(min(g.length, s + 1.5))
                yaw = math.atan2(q.x - p.x, q.y - p.y)
                best, bd = None, 99
                for o in others:
                    dd = o.distance(p)
                    if 3.0 < dd < 7.5 and dd < bd:
                        best, bd = o, dd
                if best is not None:
                    n = best.interpolate(best.project(p))
                    x, z = (p.x + n.x) / 2, (p.y + n.y) / 2
                else:
                    x, z = p.x + math.cos(yaw) * 2.3, p.y - math.sin(yaw) * 2.3
                key = (round(x / 14), round(z / 14))
                if key in seen:
                    continue
                seen.add(key)
                self.poles.append((round(x, 1), round(z, 1), round(yaw, 2)))

    def tile(self, tx0, tz0, T):
        """-> (tram dict or None, [railing fence records])"""
        tile = box(tx0, tz0, tx0 + T, tz0 + T)
        r, fences = [], []
        for t in self.tracks:
            if not t["g"].intersects(tile):
                continue
            c = t["g"].intersection(tile)
            for p in ([c] if c.geom_type == "LineString" else [x for x in getattr(c, "geoms", []) if x.geom_type == "LineString"]):
                if p.length > 1:
                    r.append({"p": [round(v, 1) for pt in p.coords for v in pt[:2]], "m": t["m"]})
        for q in self.rails:
            if not q.intersects(tile):
                continue
            c = q.intersection(tile)
            for p in ([c] if c.geom_type == "LineString" else [x for x in getattr(c, "geoms", []) if x.geom_type == "LineString"]):
                if p.length >= 3:
                    fences.append({"k": "f", "h": 1.1, "s": 0, "p": [round(v, 1) for pt in p.simplify(0.2).coords for v in pt[:2]]})
        stops = [s for s in self.stops.values() if tx0 <= s["x"] < tx0 + T and tz0 <= s["z"] < tz0 + T]
        poles = [list(p) for p in self.poles if tx0 <= p[0] < tx0 + T and tz0 <= p[1] < tz0 + T]
        if not (r or stops or poles):
            return None, fences
        out = {"r": r}
        if stops:
            out["s"] = [{"x": round(s["x"], 1), "z": round(s["z"], 1), "n": s["n"], **({"a": [round(v, 1) for v in s["a"]]} if s["a"] else {}), **({"w": round(s["w"], 2)} if s["a"] and s["w"] else {}), "sh": s["sh"], "b": s["b"]} for s in stops]
        if poles:
            out["o"] = poles
        return out, fences

    def lines_js(self, out):
        """assets/traffic/tram-lines.js: the line patterns the runtime trams run on."""
        pats = []
        for L in self.d["lines"]:
            for dr in L["directions"]:
                f = lambda hm: int(hm[:2]) * 60 + int(hm[3:5])
                span = max(30, f(dr["last"]) - f(dr["first"]))
                pats.append({"line": L["line"], "name": L["name"], "color": L["color"], "dir": dr["direction"], "head": round(span / max(1, dr["trips"]), 1),
                             "len": dr["length"], "path": [round(v, 1) for pt in dr["path"] for v in pt],
                             "stops": [{"s": round(s["s"], 1), "n": s["name"]} for s in dr["stops"]]})
        src = ("// Generated by tools/tram.py from data/tram.json (AMAT Palermo GTFS, CC BY 4.0, and OpenStreetMap, ODbL). Game metres.\n"
               "// head: minutes between trams on the line, from the timetable (trips over the service span).\n"
               f"export const TRAM_PATTERNS = {json.dumps(pats, separators=(',', ':'), ensure_ascii=False)};\n")
        open(out, "w").write(src)
        return len(src), len(pats)


if __name__ == "__main__":
    t = Tram()
    n, p = t.lines_js(os.path.join(ROOT, "assets", "traffic", "tram-lines.js"))
    print(f"tram-lines.js: {n} bytes, {p} patterns; {len(t.tracks)} tracks, {len(t.stops)} stops, {len(t.rails)} railing lines, {len(t.poles)} poles")
