"""Quays and piers of the port of Palermo (board item n10).

The OSM coastline of the harbour is a polyline: the terrain falls from the town to the sea floor over a 5 to 10 m cell, so the quays were sand slopes and the buildings
on them stood on a slope into the water. This builds the quay decks that src/quays.js turns into flat ground, a vertical wall, a kerb and bollards:

  strip   the land within STRIP m of the coastline in the port zone: carved flat at QUAY_H (and blended into the town over BLEND m), paved by the street layers;
  band    the EXT m of sea beyond the coastline: flat deck, drawn by src/quays.js, ends in the wall (hides the 5 m terrain cell that falls away behind it);
  piers   the OSM man_made=pier / breakwater lines (buffered) and closed pier ways: decks at QUAY_H (PONTOON_H for the short marina pontoons);
  walls   the seaward edges of the decks, minus the gaps: a slipway (the end of a road at the water) and the free end of a long pier. The walls are collision.

Decks are cut on the 50 m grid (a tile is 500 m), so a piece never crosses a tile.  The tile record is
  "quays": { "d": [[h, top, blend, [x, z, ...ring], "0101" wall flag per edge], ...], "w": [[x0, z0, x1, z1, h], ...] }
"""
import math

ZONE = (100.0, -3340.0, 1300.0, -380.0)   # x0, z0, x1, z1 of the harbour (the coast in it is quays, moles and breakwaters, no natural shore but the beaches excluded below)
FREIGHT = (500.0, -3300.0, 1300.0, -1900.0)   # the commercial port: containers and cranes (src/quays.js)
QUAY_H = 1.6
PONTOON_H = 0.8
STRIP, BLEND, EXT = 9.0, 8.0, 2.0
CELL = 50.0


def _lines(g):
    if g.is_empty:
        return []
    if g.geom_type == "LineString":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "LineString"]


def _polys(g):
    if g.is_empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    return [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon"]


def build(land, piers, pier_areas, sand_geoms, roads, log=print):
    """Returns (decks, walls, ext): decks [(polygon, h, top, blend)], walls [(LineString, h)], ext (the band polygons, to add to the sea's land)."""
    from shapely.geometry import MultiPolygon, Point, box
    from shapely.ops import linemerge, unary_union
    zone = box(*ZONE)
    coast = land.boundary.intersection(zone)
    if sand_geoms:
        coast = coast.difference(unary_union(sand_geoms).buffer(15.0))
    pieces = [l for l in _lines(linemerge(_lines(coast)) if not coast.is_empty else coast) if l.length >= 12.0]
    coast = unary_union(pieces) if pieces else coast
    land_in = land.buffer(0)
    strip = unary_union([p.buffer(STRIP, cap_style=2) for p in pieces]).intersection(land_in).intersection(zone) if pieces else None
    band = unary_union([p.buffer(EXT, cap_style=2) for p in pieces]).difference(land_in).intersection(zone) if pieces else None
    decks = []
    if strip is not None and not strip.is_empty:
        for p in _polys(strip):
            decks.append((p, QUAY_H, 0, 1))
    if band is not None and not band.is_empty:
        for p in _polys(band):
            decks.append((p, QUAY_H, 1, 0))
    # piers: the OSM lines (width 5 in the game) and the closed pier ways
    tips = []
    for ls in piers:
        c = ls.centroid
        if not (ZONE[0] < c.x < ZONE[2] and ZONE[1] < c.y < ZONE[3]):
            continue
        h = QUAY_H if ls.length >= 60.0 else PONTOON_H
        decks.append((ls.buffer(2.8 if h == QUAY_H else 1.6, cap_style=2), h, 1, 0))
        if h == QUAY_H and ls.length >= 60.0:   # the free end of a long pier is open: a car can drive off it
            a, b = Point(ls.coords[0]), Point(ls.coords[-1])
            tips.append(b if a.distance(land_in) < b.distance(land_in) else a)
    for pg in pier_areas:
        c = pg.centroid
        if ZONE[0] < c.x < ZONE[2] and ZONE[1] < c.y < ZONE[3]:
            for p in _polys(pg):
                decks.append((p, QUAY_H, 1, 0))
    tops = [(p, h) for p, h, t, b in decks if t]
    # walls: the boundary of every top deck that is over water and not inside another deck
    land_buf = land_in.buffer(0.2)
    walls = []
    for i, (p, h) in enumerate(tops):
        others = [q for j, (q, _) in enumerate(tops) if j != i and q.intersects(p)]
        cut = unary_union([land_buf] + [q.buffer(0.05) for q in others]) if others else land_buf
        for l in _lines(p.boundary.difference(cut)):
            if l.length >= 0.5:
                walls.append((l, h))
    wall_all = unary_union([l for l, _ in walls]) if walls else None
    # gaps: a slipway where a road ends at the water, the free end of a long pier
    gaps = list(tips)
    if wall_all is not None:
        for rec, ls in roads:
            if rec.get("k") in ("pier", "pedestrian", "footway", "steps", "path", "cycleway") or rec.get("br") or rec.get("tn"):
                continue
            for q in (Point(ls.coords[0]), Point(ls.coords[-1])):
                if q.distance(wall_all) < 9.0:
                    gaps.append(wall_all.interpolate(wall_all.project(q)) if wall_all.geom_type == "LineString" else q)
    gapg = unary_union([g.buffer(6.5) for g in gaps]) if gaps else None
    walls_open = []
    for l, h in walls:
        for piece in (_lines(l.difference(gapg)) if gapg is not None else [l]):
            if piece.length >= 0.5:
                walls_open.append((piece, h))
    ext = [p for p, h, t, b in decks if t and h == QUAY_H and p.intersects(box(*ZONE)) and p.area > 4]
    log(f"  quays: {len(decks)} decks ({sum(1 for d in decks if not d[2])} strips, {sum(1 for d in decks if d[2])} bands and piers), {len(walls_open)} wall pieces of {sum(l.length for l, _ in walls_open) / 1000:.1f} km, {len(gaps)} gaps")
    return decks, walls_open, wall_all, ext


def tile_record(decks, walls, wall_all, i, j, T=500.0):
    """The 'quays' record of tile (i, j) or None."""
    from shapely.geometry import box
    tb = box(i * T, j * T, (i + 1) * T, (j + 1) * T)
    d_out, w_out = [], []
    for p, h, top, blend in decks:
        if not p.intersects(tb):
            continue
        part = p.intersection(tb)
        for q in _polys(part):
            x0, z0, x1, z1 = q.bounds
            for cx in range(int(math.floor(x0 / CELL)), int(math.floor((x1 - 1e-6) / CELL)) + 1):
                for cz in range(int(math.floor(z0 / CELL)), int(math.floor((z1 - 1e-6) / CELL)) + 1):
                    for c in _polys(q.intersection(box(cx * CELL, cz * CELL, (cx + 1) * CELL, (cz + 1) * CELL))):
                        if c.area < 0.8:
                            continue
                        c = c.simplify(0.15)
                        co = list(c.exterior.coords)[:-1]
                        if len(co) < 3:
                            continue
                        flags = ""
                        for k in range(len(co)):
                            a, b = co[k], co[(k + 1) % len(co)]
                            from shapely.geometry import Point
                            flags += "1" if (wall_all is not None and Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2).distance(wall_all) < 0.25) else "0"
                        d_out.append([h, top, blend, [round(v, 1) for pt in co for v in pt], flags])
    for l, h in walls:
        if not l.intersects(tb):
            continue
        for s in _lines(l.intersection(tb)):
            c = list(s.coords)
            for a, b in zip(c, c[1:]):
                if math.hypot(b[0] - a[0], b[1] - a[1]) >= 0.4:
                    w_out.append([round(a[0], 1), round(a[1], 1), round(b[0], 1), round(b[1], 1), h])
    if not d_out and not w_out:
        return None
    return {"d": d_out, "w": w_out}
