"""Turn OSM centrelines into street polygons: asphalt, flush stone paving, raised
sidewalks/piazzas, grass, plus curb lines. Needs shapely (tools/.venv).

Street space is everything that isn't a building. Carriageways are buffered from
their centrelines and clipped by the buildings, so a vicolo fills wall to wall and
whatever is left beside a road becomes sidewalk.

Usage: tools/.venv/bin/python tools/streets.py data/osm.json data/streets.json
"""
import json
import os
import sys

import shapely
from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import BBOX, proj, stitch  # noqa: E402

# Carriageway widths in metres when OSM has no width/lanes tag.
CARRIAGEWAY = {"primary": 10, "secondary": 9, "tertiary": 8, "unclassified": 6, "residential": 5.5,
               "living_street": 4.5, "service": 3.5}
PEDESTRIAN = {"pedestrian": 7, "footway": 2.5}
MARGIN = 20    # metres of street geometry beyond the drivable box (OSM data stops there)
CHUNK = 64     # polygons are cut into chunks so they drape over terrain and cull well
DENSIFY = 8    # max edge length, also for draping


def width_of(tags, default):
    for k in ("width", "est_width"):
        try:
            return float(tags[k].replace("m", "").replace(",", ".").strip())
        except (KeyError, ValueError):
            pass
    try:
        return int(tags["lanes"]) * 3.0
    except (KeyError, ValueError):
        return default


def polys(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def ring_flat(coords):
    pts = list(coords)[:-1]
    return [round(c, 1) for p in pts for c in p]


def chunked(geom, x0, z0, x1, z1):
    """Cut a layer into CHUNK-sized pieces, densified, as [[outer, hole, ...], ...]."""
    out = []
    geom = geom.buffer(0)
    tree_geoms = polys(geom)
    if not tree_geoms:
        return out
    tree = shapely.STRtree(tree_geoms)
    x = x0
    while x < x1:
        z = z0
        while z < z1:
            cell = box(x, z, x + CHUNK, z + CHUNK)
            hits = [tree_geoms[i] for i in tree.query(cell)]
            if hits:
                piece = unary_union([h.intersection(cell) for h in hits])
                for p in polys(piece):
                    if p.area < 0.5:
                        continue
                    p = shapely.segmentize(shapely.set_precision(p, 0.05), DENSIFY)
                    if p.is_empty or not isinstance(p, Polygon):
                        continue
                    out.append([ring_flat(p.exterior.coords)] + [ring_flat(r.coords) for r in p.interiors])
            z += CHUNK
        x += CHUNK
    return out


def main(src, dst):
    els = json.load(open(src))["elements"]
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}
    line = lambda nids: [proj(*nodes[n]) for n in nids if n in nodes]

    s, w, n, e = BBOX
    bx0, bz1 = proj(s, w)
    bx1, bz0 = proj(n, e)
    x0, z0, x1, z1 = bx0 - MARGIN, bz0 - MARGIN, bx1 + MARGIN, bz1 + MARGIN
    aoi = box(x0, z0, x1, z1)

    # Land: same construction as bake.py (coastline closed to the west).
    coast_ways = [w["nodes"] for w in ways.values() if w.get("tags", {}).get("natural") == "coastline"]
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
    coast = line(chain)
    far = 6000
    land = Polygon(coast + [(-far, coast[-1][1]), (-far, coast[0][1] + far), (coast[0][0], coast[0][1] + far)]).buffer(0)
    aoi = aoi.intersection(land)

    bld = []
    for e in els:
        if e["type"] == "relation" and "building" in e.get("tags", {}):
            outers = [ways[m["ref"]]["nodes"] for m in e["members"] if m["role"] == "outer" and m["ref"] in ways]
            inners = [line(r) for r in stitch([ways[m["ref"]]["nodes"] for m in e["members"]
                                               if m["role"] == "inner" and m["ref"] in ways])]
            for o in stitch(outers):
                pg = Polygon(line(o), [i for i in inners if len(i) >= 4]).buffer(0)
                bld.append(pg)
    for wy in ways.values():
        nids = wy["nodes"]
        if "building" in wy.get("tags", {}) and len(nids) > 3 and nids[0] == nids[-1]:
            pts = line(nids)
            if len(pts) >= 4:
                bld.append(Polygon(pts).buffer(0))
    buildings = unary_union(bld)
    space = aoi.difference(buildings)

    car_parts, ped_parts, green_parts, water_parts = [], [], [], []
    for wy in ways.values():
        tags = wy.get("tags") or {}
        nids = wy["nodes"]
        closed = len(nids) > 3 and nids[0] == nids[-1]
        hw = tags.get("highway")
        pts = line(nids)
        if len(pts) < 2:
            continue
        if hw in CARRIAGEWAY:
            car_parts.append(LineString(pts).buffer(width_of(tags, CARRIAGEWAY[hw]) / 2, quad_segs=4))
        elif hw in PEDESTRIAN:
            if closed and tags.get("area") == "yes":
                ped_parts.append(Polygon(pts).buffer(0))
            else:
                ped_parts.append(LineString(pts).buffer(width_of(tags, PEDESTRIAN[hw]) / 2, quad_segs=4))
        elif closed and (tags.get("leisure") in ("park", "garden") or tags.get("landuse") == "grass"):
            green_parts.append(Polygon(pts).buffer(0))
        elif closed and tags.get("natural") == "water":
            water_parts.append(Polygon(pts).buffer(0))

    asphalt = unary_union(car_parts).intersection(space)
    paving = unary_union(ped_parts).intersection(space).difference(asphalt)
    water = unary_union(water_parts).intersection(space).difference(asphalt) if water_parts else Polygon()
    green = unary_union(green_parts).intersection(space).difference(asphalt).difference(paving).difference(water)
    raised = space.difference(asphalt).difference(paving).difference(green).difference(water)
    # Drop slivers left between buffered roads and walls.
    raised = raised.buffer(-0.15).buffer(0.15)

    # Curbs: carriageway edges that border raised ground. Rings are oriented so
    # the road is on the left of the direction of travel.
    curbs = []
    touch = unary_union([raised, green]).buffer(0.3)
    for p in polys(shapely.orient_polygons(asphalt)):
        for ring in [p.exterior] + list(p.interiors):
            seg = LineString(ring.coords).intersection(touch)
            for g in ([seg] if isinstance(seg, LineString) else getattr(seg, "geoms", [])):
                if isinstance(g, LineString) and g.length > 0.5:
                    g = shapely.segmentize(g, DENSIFY)
                    curbs.append([round(c, 2) for pt in g.coords for c in pt])

    out = {
        "asphalt": chunked(asphalt, x0, z0, x1, z1),
        "paving": chunked(paving, x0, z0, x1, z1),
        "raised": chunked(raised, x0, z0, x1, z1),
        "green": chunked(green, x0, z0, x1, z1),
        "water": chunked(water, x0, z0, x1, z1),
        "curbs": curbs,
        "aoi": [x0, z0, x1, z1],
    }
    json.dump(out, open(dst, "w"), separators=(",", ":"))
    print({k: len(v) for k, v in out.items()}, f"{os.path.getsize(dst) / 1e6:.1f} MB")
    print(f"areas m2: asphalt {asphalt.area:.0f}, paving {paving.area:.0f}, raised {raised.area:.0f}, green {green.area:.0f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
