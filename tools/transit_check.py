#!/usr/bin/env python3
"""Overlays and numbers for the transit datasets (data/tram.json, data/bus_routes.json, data/fountains.json).

  tools/.venv/bin/python -I tools/transit_check.py <out_dir> [gtfs_dir]

Writes PNGs to <out_dir>: the tram on the OSM street map (whole network and three zooms, with the GTFS shape, the matched
track, the stretch labels, stops and platforms), the bus route 806 against the OSM bus relations, and the fountains.
Prints the counts the notes in docs/sources/transit.md quote. Needs data/tram_osm.json and the three outputs.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
MODE_COL = {"street": (230, 40, 40), "median": (20, 90, 220), "roadside": (230, 150, 0), "separate": (0, 150, 60)}
LINE_COL = {1: (200, 30, 60), 2: (30, 120, 200), 3: (40, 150, 60), 4: (160, 60, 190)}


def proj(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


class Canvas:
    def __init__(self, box, w=1600):
        self.x0, self.z0, self.x1, self.z1 = box
        self.s = w / (self.x1 - self.x0)
        self.im = Image.new("RGB", (w, int((self.z1 - self.z0) * self.s)), (246, 243, 236))
        self.d = ImageDraw.Draw(self.im)

    def pt(self, p):
        return ((p[0] - self.x0) * self.s, (p[1] - self.z0) * self.s)

    def line(self, pts, col, width=1):
        if len(pts) > 1:
            self.d.line([self.pt(p) for p in pts], fill=col, width=width)

    def dot(self, p, col, r=4):
        x, y = self.pt(p)
        self.d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=(0, 0, 0))

    def text(self, p, t, col=(0, 0, 0)):
        self.d.text(self.pt(p), t, fill=col)

    def save(self, path):
        self.im.save(path)
        print("wrote", path)


def along(pts, s0, s1):
    out, acc = [], 0.0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        d = math.dist(a, b)
        if acc + d >= s0 and acc <= s1 and d > 0:
            t0, t1 = max(0, (s0 - acc) / d), min(1, (s1 - acc) / d)
            pa = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0)
            pb = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)
            if not out:
                out.append(pa)
            out.append(pb)
        acc += d
    return out


def tram_overlay(out_dir, gtfs_shapes):
    osm, tram = load("tram_osm.json"), load("tram.json")
    allp = [p for t in tram["tracks"] for p in t["pts"]]
    full = (min(p[0] for p in allp) - 150, min(p[1] for p in allp) - 150, max(p[0] for p in allp) + 150, max(p[1] for p in allp) + 150)
    roads = [[proj(*p) for p in w["pts"]] for w in osm["other_ways"] if w["tags"].get("highway")]
    bars = [[proj(*p) for p in w["pts"]] for w in osm["other_ways"] if w["tags"].get("barrier") in ("fence", "guard_rail", "handrail")]
    plats = [[proj(*p) for p in w["pts"]] for w in osm["other_ways"] if w["tags"].get("railway") == "platform"]
    views = {"tram_all": full}
    # three zooms: a median stretch, the terminus at Stazione Centrale, the L4 loop at Notarbartolo
    st = {s["name"]: s for l in tram["lines"] for d in l["directions"] for s in d["stops"]}
    for key, name, r in (("tram_zoom_centrale", "Stazione Centrale", 350), ("tram_zoom_notarbartolo", "Notarbartolo", 450),
                         ("tram_zoom_uditore", "Parco Uditore", 450)):
        if name in st:
            x, z = st[name]["x"], st[name]["z"]
            views[key] = (x - r, z - r * 0.6, x + r, z + r * 0.6)
    for key, box in views.items():
        w = 2200 if key == "tram_all" else 1800
        c = Canvas(box, w)
        for r in roads:
            c.line(r, (190, 190, 190), 1)
        for b in bars:
            c.line(b, (120, 90, 40), 1)
        for p in plats:
            c.line(p, (0, 0, 0), 2)
        if gtfs_shapes:
            for num, shp in gtfs_shapes.items():
                c.line(shp, (0, 0, 0), 1)
        for t in tram["tracks"]:
            if not t["lines"]:
                c.line(t["pts"], (150, 150, 150), 1)
                continue
            for s in t["stretches"]:
                c.line(along(t["pts"], s["s0"], s["s1"]), MODE_COL[s["mode"]], 3)
        for l in tram["lines"]:
            for d in l["directions"]:
                for s in d["stops"]:
                    c.dot(s["on_track"] if "on_track" in s else (s["x"], s["z"]), LINE_COL[l["line"]], 4 if key == "tram_all" else 6)
                    if key != "tram_all":
                        c.text((s["x"] + 6, s["z"]), s["name"])
        c.save(os.path.join(out_dir, key + ".png"))


def bus_overlay(out_dir):
    bus = load("bus_routes.json")
    refs = {r["ref"]: r for r in bus["routes"]}
    osm_rels = load("bus_routes_osm.json")["elements"]
    r806 = refs.get("806")
    if not r806:
        return
    pts = [p for pat in r806["patterns"] for p in pat["shape_pts"]]
    box = (min(p[0] for p in pts) - 400, min(p[1] for p in pts) - 400, max(p[0] for p in pts) + 400, max(p[1] for p in pts) + 400)
    c = Canvas(box, 1800)
    import glob, gzip
    for f in glob.glob(os.path.join(DATA, "city", "pbf_hwy_*.json.gz")):    # the project's OSM road cache as backdrop
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            for w in json.load(fh)["elements"]:
                if w.get("type") == "way" and w["tags"].get("highway") in ("primary", "secondary", "tertiary", "unclassified", "residential", "trunk", "motorway", "service", "living_street"):
                    g = [proj(p["lat"], p["lon"]) for p in w["geometry"]]
                    if any(box[0] < q[0] < box[2] and box[1] < q[1] < box[3] for q in g):
                        c.line(g, (205, 205, 205), 1)
    for e in osm_rels:
        for m in e["members"]:
            if m["type"] == "way" and m.get("geometry"):
                c.line([proj(p["lat"], p["lon"]) for p in m["geometry"]], (150, 170, 220), 2)
    for pat in r806["patterns"]:
        c.line(pat["shape_pts"], (220, 30, 30) if pat["direction"] == 0 else (230, 130, 0), 3)
    ids = {s["id"]: s for s in bus["stops"]}
    for sid in r806["stop_ids"]:
        s = ids[sid]
        c.dot((s["x"], s["z"]), (0, 0, 0), 3)
    c.save(os.path.join(out_dir, "bus_806.png"))
    # every route against OSM: how much of each shape is near an OSM line (the status table)
    return bus["quality"]


def fountain_overlay(out_dir):
    f = load("fountains.json")
    pts = [(p["x"], p["z"]) for p in f["comune"]]
    box = (min(p[0] for p in pts) - 300, min(p[1] for p in pts) - 300, max(p[0] for p in pts) + 300, max(p[1] for p in pts) + 300)
    c = Canvas(box, 1400)
    for p in f["osm_only"]:
        c.dot((p["x"], p["z"]), (120, 120, 120), 3)
    for p in f["comune"]:
        c.dot((p["x"], p["z"]), (20, 90, 220), 3)
    c.save(os.path.join(out_dir, "fountains.png"))
    return f["quality"]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    shapes = None
    if len(sys.argv) > 2:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import transit
        g = transit.load_gtfs(sys.argv[2])
        shapes = {}
        for t in g["trips"].values():
            if t["route_id"].startswith("TRAM"):
                shapes[t["shape_id"]] = g["shapes"][t["shape_id"]]
    tram_overlay(out, shapes)
    print(json.dumps(bus_overlay(out), indent=1)[:2500])
    print(json.dumps(fountain_overlay(out), indent=1))


if __name__ == "__main__":
    main()
