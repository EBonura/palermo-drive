"""Bake an Overpass JSON dump of central Palermo into palermo-data.js.

Coordinates are projected to local metres around Quattro Canti:
x grows east, z grows south (three.js convention, -z is north).

If data/lidar.json (from tools/lidar.py) and data/terrarium/ tiles sit next to
the OSM dump, buildings get their measured roof heights and the map gets terrain.

Usage: python3 tools/bake.py data/osm.json palermo-data.js
"""
import json
import math
import os
import sys

LAT0, LON0 = 38.11572, 13.36126  # Quattro Canti
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0

# Area the car is allowed to roam in (same box the Overpass query used).
BBOX = (38.1060, 13.3500, 38.1240, 13.3730)  # s, w, n, e

ROAD_WIDTH = {
    "primary": 11, "secondary": 10, "tertiary": 8, "unclassified": 6,
    "residential": 6, "living_street": 5, "pedestrian": 6, "service": 4,
    "footway": 2.2, "path": 2, "cycleway": 2,
}

FLOOR = 3.4


def proj(lat, lon):
    return round((lon - LON0) * KX, 1), round(-(lat - LAT0) * KZ, 1)


def flat(pts):
    return [c for p in pts for c in p]


def hash01(n):
    # Deterministic per-id noise so heights and colours don't change between bakes.
    n = (n * 2654435761) & 0xFFFFFFFF
    n ^= n >> 15
    n = (n * 2246822519) & 0xFFFFFFFF
    n ^= n >> 13
    return (n & 0xFFFFFF) / 0xFFFFFF


def area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, z1 = pts[i]
        x2, z2 = pts[(i + 1) % len(pts)]
        a += x1 * z2 - x2 * z1
    return a / 2


def parse_m(v):
    try:
        return float(v.replace("m", "").replace(",", ".").strip())
    except (ValueError, AttributeError):
        return None


def building_height(oid, tags, footprint):
    h = parse_m(tags.get("height"))
    if h:
        return h
    lv = parse_m(tags.get("building:levels"))
    if lv:
        return lv * FLOOR + 1
    kind = tags.get("building", "yes")
    r = hash01(oid)
    if kind in ("church", "cathedral", "basilica"):
        return 18 + r * 10
    if kind == "chapel":
        return 9 + r * 4
    if kind in ("garage", "garages", "shed", "hut", "kiosk", "roof", "carport"):
        return 3 + r
    if kind == "ruins":
        return 4 + r * 4
    if footprint < 40:
        return FLOOR * (1 + round(r)) + 0.5
    # Centro storico palazzi are mostly 3 to 6 storeys.
    floors = 3 + int(r * 3.999)
    return floors * FLOOR + 1


def stitch(segments):
    """Join member ways (lists of node ids) into closed rings."""
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[-2::-1]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[:0:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def median(v):
    v = sorted(v)
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def clip_half(poly, a, b):
    """Keep the part of poly closer to a than to b (one Voronoi half-plane)."""
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    nx, nz = b[0] - a[0], b[1] - a[1]
    side = lambda p: (p[0] - mx) * nx + (p[1] - mz) * nz
    out = []
    for i in range(len(poly)):
        p, q = poly[i - 1], poly[i]
        sp, sq = side(p), side(q)
        if (sp > 0) != (sq > 0):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
        if sq <= 0:
            out.append(q)
    return out


def lidar_shape(rec, outer, holes):
    """Turn lidar samples into a main roof and, for mixed-height buildings, sections.

    Returns (roof, parts, split, ground) with absolute elevations, or None without data.
    """
    from lidar import clearance, sample_points
    pts = sample_points(outer, holes)
    if not rec or len(rec) != len(pts):
        return None
    good = [(p, r) for p, r in zip(pts, rec) if isinstance(r, list)]
    if not good:
        return None
    # Anything under 2.5 m is a sample that landed in an unmapped courtyard or on a terrace edge.
    roofs = [(p, max(r[1], r[0] + 2.5)) for p, r in good]
    main = median([r for _, r in roofs])
    ground = median([r[0] for _, r in good])
    spread = max(r for _, r in roofs) - min(r for _, r in roofs)
    if len(roofs) < 3 or spread <= 4:
        return main, None, False, ground
    snap = lambda r: main if abs(r - main) < 1.5 else r
    parts = []
    if not holes:
        # Voronoi cells of the samples, each extruded to its own measured roof.
        for i, (p, r) in enumerate(roofs):
            poly = list(outer)
            for j, (q, _) in enumerate(roofs):
                if j != i and len(poly) >= 3:
                    poly = clip_half(poly, p, q)
            if len(poly) >= 3 and abs(area(poly)) > 2:
                parts.append([flat([(round(x, 1), round(z, 1)) for x, z in poly]), round(snap(r), 1)])
        return main, parts, bool(parts), ground
    # Courtyard buildings keep their footprint; towers and domes go on top as blocks.
    for i, (p, r) in enumerate(roofs):
        if r - main <= 3.5:
            continue
        hs = max(1.5, clearance(p, [outer] + holes) / 1.414)
        sq = [(p[0] - hs, p[1] - hs), (p[0] + hs, p[1] - hs), (p[0] + hs, p[1] + hs), (p[0] - hs, p[1] + hs)]
        for j, (q, _) in enumerate(roofs):
            if j != i and len(sq) >= 3:
                sq = clip_half(sq, p, q)
        if len(sq) >= 3:
            parts.append([flat([(round(x, 1), round(z, 1)) for x, z in sq]), round(r, 1)])
    return main, parts or None, False, ground


def unproj(x, z):
    return LAT0 - z / KZ, LON0 + x / KX


def load_terrarium(folder):
    """Elevation lookup from Terrarium z12 PNG tiles (AWS open terrain tiles)."""
    from PIL import Image
    tiles = {}
    for f in os.listdir(folder):
        if f.endswith(".png"):
            _, x, y = map(int, f[:-4].split("_"))
            tiles[(x, y)] = Image.open(os.path.join(folder, f)).convert("RGB").load()
    n = 2 ** 12 * 256

    def px(X, Y):
        t = tiles.get((X // 256, Y // 256))
        if t is None:
            return 0.0
        r, g, b = t[X % 256, Y % 256]
        return r * 256 + g + b / 256 - 32768

    def elev(lat, lon):
        fx = (lon + 180) / 360 * n - 0.5
        fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - 0.5
        x0, y0 = int(fx), int(fy)
        tx, ty = fx - x0, fy - y0
        top = px(x0, y0) * (1 - tx) + px(x0 + 1, y0) * tx
        bot = px(x0, y0 + 1) * (1 - tx) + px(x0 + 1, y0 + 1) * tx
        return top * (1 - ty) + bot * ty
    return elev


def point_in(pts, x, z):
    c = False
    for i in range(len(pts)):
        (xi, zi), (xj, zj) = pts[i], pts[i - 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            c = not c
    return c


def near_terrain(lidar, elev, land, margin=10):
    """Lidar DTM grid around the playable area; gaps filled from neighbours, sea from Terrarium."""
    x0, z0, step = lidar["tgrid"]
    t = {tuple(map(int, k.split(","))): v for k, v in lidar["t"].items() if isinstance(v, (int, float))}
    # Size the grid from the drivable box, not from the samples present: while tools/lidar.py is
    # still running only part of the terrain is sampled, and the gaps get filled below.
    s_, w_, n_, e_ = BBOX
    bx1, _ = proj(s_, e_)
    _, bz1 = proj(s_, w_)
    ni = int((bx1 - x0) // step) + 1
    nj = int((bz1 - z0) // step) + 1
    nx, nz = ni + 2 * margin, nj + 2 * margin
    h = []
    for J in range(-margin, nj + margin):
        for I in range(-margin, ni + margin):
            x, z = x0 + I * step, z0 + J * step
            if not point_in(land, x, z):
                h.append(round(min(elev(*unproj(x, z)), -1.5), 1))
                continue
            if (I, J) in t:
                h.append(round(t[(I, J)], 1))
                continue
            acc = wsum = 0.0
            for dj in range(-4, 5):
                for di in range(-4, 5):
                    v = t.get((I + di, J + dj))
                    if v is not None:
                        w = 1 / (di * di + dj * dj)
                        acc += v * w
                        wsum += w
            h.append(round(acc / wsum if wsum else max(0.5, elev(*unproj(x, z))), 1))
    return {"x0": x0 - margin * step, "z0": z0 - margin * step, "s": step, "nx": nx, "nz": nz, "h": h}


def lidar_keys(lidar):
    return [tuple(map(int, k.split(","))) for k in lidar["t"]]


def far_terrain(elev, step=150, half=14000):
    n = int(2 * half / step) + 1
    h = [round(elev(*unproj(-half + i * step, -half + j * step))) for j in range(n) for i in range(n)]
    return {"x0": -half, "z0": -half, "s": step, "nx": n, "nz": n, "h": h}


def main(src, dst):
    here = os.path.dirname(os.path.abspath(src))
    lidar_path = os.path.join(here, "lidar.json")
    lidar = json.load(open(lidar_path)) if os.path.exists(lidar_path) else None
    terra_dir = os.path.join(here, "terrarium")
    elev = load_terrarium(terra_dir) if os.path.isdir(terra_dir) else None
    els = json.load(open(src))["elements"]
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}

    def ring_pts(node_ids):
        pts = [proj(*nodes[n]) for n in node_ids if n in nodes]
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts = pts[:-1]
        return pts

    buildings, roads, areas, labels = [], [], [], []
    stats = {"lidar": 0, "split": 0, "towers": 0}

    def add_building(key, oid, tags, outer, holes):
        if len(outer) < 3:
            return
        fp = abs(area(outer))
        if fp < 4:
            return
        h = building_height(oid, tags, fp)
        kind = tags.get("building", "yes")
        b = {"id": key, "h": round(h, 1), "c": int(hash01(oid + 7) * 1000), "p": flat(outer)}
        for tag, field in (("name", "n"), ("building", "t"), ("building:levels", "lv"), ("historic", "hi"),
                           ("amenity", "am"), ("building:colour", "col"), ("roof:shape", "rs")):
            if tags.get(tag) and not (tag == "building" and tags[tag] == "yes"):
                b[field] = tags[tag]
        if holes:
            b["holes"] = [flat(hh) for hh in holes if len(hh) >= 3]
        shape = lidar_shape(lidar["b"].get(key), outer, holes) if lidar else None
        if shape:
            roof, parts, split, ground = shape
            b["r"] = round(roof, 1)  # absolute roof elevation, metres above sea level
            b["g"] = round(ground, 1)  # lidar ground under the building
            stats["lidar"] += 1
            if parts:
                b["parts"] = parts
                stats["split" if split else "towers"] += 1
                if split:
                    b["split"] = 1
        if kind in ("church", "cathedral", "basilica", "chapel"):
            b["k"] = "church"
        buildings.append(b)
        name = tags.get("name")
        if name and fp > 300:
            cx = sum(p[0] for p in outer) / len(outer)
            cz = sum(p[1] for p in outer) / len(outer)
            # Big palazzi need a bigger trigger radius, their centroid is far from the street.
            labels.append({"n": name, "x": round(cx, 1), "z": round(cz, 1), "h": round(h, 1),
                           "r": round(40 + math.sqrt(fp) * 0.7)})

    for e in els:
        if e["type"] == "relation" and "building" in e.get("tags", {}):
            outers = [ways[m["ref"]]["nodes"] for m in e["members"]
                      if m["type"] == "way" and m["role"] == "outer" and m["ref"] in ways]
            inners = [ways[m["ref"]]["nodes"] for m in e["members"]
                      if m["type"] == "way" and m["role"] == "inner" and m["ref"] in ways]
            inner_rings = [ring_pts(r) for r in stitch(inners)]
            for k, o in enumerate(stitch(outers)):
                # Good enough for courtyards: every inner goes into every outer it can.
                add_building(f"r{e['id']}.{k}", e["id"], e["tags"], ring_pts(o), inner_rings)

    for w in ways.values():
        tags = w.get("tags")
        if not tags:
            continue
        nids = w["nodes"]
        closed = len(nids) > 3 and nids[0] == nids[-1]
        if "building" in tags and closed:
            add_building(f"w{w['id']}", w["id"], tags, ring_pts(nids), [])
        elif "highway" in tags:
            hw = tags["highway"]
            if hw == "pedestrian" and closed and tags.get("area") == "yes":
                areas.append({"k": "plaza", "p": flat(ring_pts(nids))})
                continue
            if hw not in ROAD_WIDTH:
                continue
            pts = [proj(*nodes[n]) for n in nids if n in nodes]
            if len(pts) < 2:
                continue
            r = {"w": ROAD_WIDTH[hw], "k": hw, "p": flat(pts)}
            if tags.get("name"):
                r["n"] = tags["name"]
            roads.append(r)
        elif tags.get("leisure") in ("park", "garden") or tags.get("landuse") == "grass":
            if closed:
                areas.append({"k": "green", "p": flat(ring_pts(nids))})
        elif tags.get("natural") == "water" and closed:
            areas.append({"k": "water", "p": flat(ring_pts(nids))})
        elif tags.get("man_made") in ("pier", "breakwater"):
            pts = ring_pts(nids) if closed else [proj(*nodes[n]) for n in nids if n in nodes]
            if closed and len(pts) >= 3:
                areas.append({"k": "pier", "p": flat(pts)})
            elif len(pts) >= 2:
                roads.append({"w": 5, "k": "pier", "p": flat(pts)})

    # Land polygon: coastline (land on the left, running south to north),
    # closed around the west so everything inland is ground.
    coast_ways = [w["nodes"] for w in ways.values()
                  if w.get("tags", {}).get("natural") == "coastline"]
    chain = coast_ways.pop(0)
    while coast_ways:
        for i, c in enumerate(coast_ways):
            if c[0] == chain[-1]:
                chain += c[1:]
            elif c[-1] == chain[0]:
                chain = c[:-1] + chain
            else:
                continue
            coast_ways.pop(i)
            break
        else:
            break
    coast = [proj(*nodes[n]) for n in chain if n in nodes]
    far = 6000
    first, last = coast[0], coast[-1]
    land = coast + [(-far, last[1]), (-far, first[1] + far), (first[0], first[1] + far)]

    s, w_, n, e_ = BBOX
    x0, z1 = proj(s, w_)
    x1, z0 = proj(n, e_)

    out = {
        "attribution": "Map data © OpenStreetMap contributors, ODbL",
        "bounds": [x0, z0, x1, z1],
        "land": flat(land),
        "buildings": buildings,
        "roads": roads,
        "areas": areas,
        "labels": labels,
    }
    if lidar and elev and any(isinstance(v, (int, float)) for v in lidar["t"].values()):
        out["near"] = near_terrain(lidar, elev, land)
    if elev:
        out["far"] = far_terrain(elev)
    streets_path = os.path.join(here, "streets.json")
    if os.path.exists(streets_path):
        out["streets"] = json.load(open(streets_path))
    with open(dst, "w") as f:
        f.write("window.PALERMO_DATA=")
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
        f.write(";\n")
    print(f"{len(buildings)} buildings ({stats['lidar']} lidar, {stats['split']} split into sections, "
          f"{stats['towers']} with towers), {len(roads)} roads, {len(areas)} areas, "
          f"{len(labels)} labels, terrain near={'near' in out} far={'far' in out} -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
