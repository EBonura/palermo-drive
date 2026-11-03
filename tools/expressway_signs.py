#!/usr/bin/env python3
"""Motorway direction signs from the OSM `destination` tags (data/city/pbf_hwy_*.json.gz, the cache tools/tiles.py bakes the roads from).

Writes src/expressway-signs.js (src/expressway.js builds them). Only what OSM says is used: the place names, the `ref`s (A19, SS121 ...), the
lane the text belongs to (`destination:lanes`), and where the way is. Nothing is invented:
  * motorway_link / trunk_link with a `destination`: a roadside exit sign (one green board on two posts) near the start of the slip road;
  * motorway / trunk ways with `destination:lanes` or `destination`: an overhead gantry across the carriageway before the end of the way,
    one green panel per run of lanes with the same text.
Positions and headings are in game metres (same projection as tools/tiles.py, x east, z south). A way's travel direction is its node order,
reversed for oneway=-1. Tunnel and bridge ways are skipped.

    python3 tools/expressway_signs.py [DATA_DIR]
"""
import glob
import gzip
import json
import math
import os
import sys

from bake import KX, KZ, LAT0, LON0   # noqa: E402  (same projection as the tiles)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
CITY = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data"), "city")   # optional argument: another checkout's data folder
OUT = os.path.join(ROOT, "src", "expressway-signs.js")


def proj(lat, lon):
    return round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1)


def along(pts, dist):
    """The point `dist` m along the polyline and its unit direction."""
    d = 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L > 0 and d + L >= dist:
            t = (dist - d) / L
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        d += L
    a, b = pts[-2], pts[-1]
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    return pts[-1], ((b[0] - a[0]) / L, (b[1] - a[1]) / L)


def length(pts):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))


def split(v):
    return [s.strip() for s in (v or "").split(";") if s.strip()]


def main():
    out = []
    for f in sorted(glob.glob(os.path.join(CITY, "pbf_hwy_*.json.gz"))):
        for e in json.load(gzip.open(f))["elements"]:
            t = e.get("tags") or {}
            hw = t.get("highway")
            if e.get("type") != "way" or hw not in ("motorway", "trunk", "motorway_link", "trunk_link") or not e.get("geometry"):
                continue
            if t.get("tunnel") in ("yes", "building_passage") or t.get("bridge") in ("yes", "viaduct"):
                continue
            pts = [proj(g["lat"], g["lon"]) for g in e["geometry"]]
            if t.get("oneway") == "-1":
                pts = pts[::-1]
            L = length(pts)
            ref = t.get("ref") if hw in ("motorway", "trunk") else None
            if hw.endswith("_link"):
                dest = split(t.get("destination"))
                if not dest or L < 40:
                    continue
                (x, z), (dx, dz) = along(pts, 18)
                refs = split(t.get("destination:ref")) + split(t.get("destination:ref:to"))
                out.append({"k": "x", "id": e["id"], "x": round(x, 1), "z": round(z, 1), "tx": round(dx, 3), "tz": round(dz, 3),
                            "t": dest[:3], "r": refs[:3]})
            else:
                lanes = (t.get("destination:lanes") or "").split("|") if t.get("destination:lanes") else []
                if lanes:
                    rl = (t.get("destination:ref:lanes") or t.get("destination:ref:to:lanes") or "").split("|")
                    rl += [""] * (len(lanes) - len(rl))
                    panels = []
                    for i, ln in enumerate(lanes):
                        d = split(ln)
                        r = split(rl[i])
                        if not d and not r:
                            panels.append(None)
                            continue
                        if panels and panels[-1] and panels[-1]["t"] == d[:2] and panels[-1]["r"] == r[:2]:
                            panels[-1]["n"] += 1
                        else:
                            panels.append({"n": 1, "t": d[:2], "r": r[:2]})
                    n_lanes = len(lanes)
                else:
                    dest = split(t.get("destination"))
                    if not dest:
                        continue
                    refs = split(t.get("destination:ref")) + split(t.get("destination:ref:to"))
                    panels = [{"n": int(t.get("lanes", 2)) if str(t.get("lanes", "")).isdigit() else 2, "t": dest[:3], "r": refs[:2]}]
                    n_lanes = panels[0]["n"]
                panels = [p for p in panels]
                if L < 20 or not any(panels):
                    continue
                d = L - 90 if L > 150 else min(8.0, L * 0.4)   # a long way: before its end; a short one (the stretch where the lanes part): near its start
                (x, z), (dx, dz) = along(pts, d)
                out.append({"k": "g", "id": e["id"], "x": round(x, 1), "z": round(z, 1), "tx": round(dx, 3), "tz": round(dz, 3),
                            "nl": n_lanes, "p": panels})
    out.sort(key=lambda s: (s["k"], s["id"]))
    with open(OUT, "w") as fh:
        fh.write("// Generated by tools/expressway_signs.py from the OSM destination tags (motorway and slip road ways). Do not edit.\n")
        fh.write("// k x: roadside exit sign at (x, z), travelling along (tx, tz): t place names, r refs. k g: gantry over the carriageway: nl lanes, p panels {n lanes, t names, r refs} (null: a lane with no sign).\n")
        fh.write("export default [\n" + ",\n".join(json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in out) + "\n];\n")
    print(len(out), "signs:", sum(1 for s in out if s["k"] == "x"), "exit signs,", sum(1 for s in out if s["k"] == "g"), "gantries ->", OUT)


if __name__ == "__main__":
    main()
