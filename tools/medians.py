"""Medians of the dual carriageways (board item n2).

OSM draws a divided road as two one-way ways. The Comune survey covers part of the city; where it does not, or where its polygon leaves the
space between the roadways as bare ground, nothing was drawn there. This finds the pairs: a one-way road A and an oppositely directed road B of
the same name 4 to 70 m away, running alongside it, and returns the strips between their centre lines (the game subtracts the asphalt):
  narrow (the gap between the asphalt edges under 4.5 m): a kerbed concrete island with the OSM barrier on it where OSM has one (a jersey barrier or a guard rail, fences.py);
  wide: a planted strip (the green layer, kerb height).
"""
import math

HIGH = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "tertiary"}
NARROW = 4.5
MAXGAP = 45.0
MAXFREE = 22.0   # a median wider than this is not a median (two unrelated roads that share a name)
STEP = 6.0


def build(roads, widths, log=print):
    """roads: [(rec, LineString)], widths: class -> default carriageway width. Returns (narrow, wide): lists of polygons."""
    import shapely
    from shapely.geometry import LineString, Polygon
    from shapely.ops import unary_union
    ways = []
    for oi, (rec, ls) in enumerate(roads):
        if rec.get("k") not in HIGH or rec.get("o") not in (1, -1) or rec.get("tn") or rec.get("br") or ls.length < 15:
            continue
        w = rec.get("cw") or widths.get(rec["k"]) or rec["w"]
        ways.append((rec, ls if rec["o"] == 1 else LineString(list(ls.coords)[::-1]), w, oi))
    tree = shapely.STRtree([w[1] for w in ways])
    allw = [ls for rec, ls in roads]
    alltree = shapely.STRtree(allw)
    narrow, wide = [], []
    for i, (ra, la, wa, oa) in enumerate(ways):
        n = max(2, int(la.length / STEP))
        prev = None
        for k in range(n + 1):
            d = la.length * k / n
            p, q = la.interpolate(d), la.interpolate(min(la.length, d + 1.0))
            tx, tz = q.x - p.x, q.y - p.y
            tl = math.hypot(tx, tz)
            if tl < 0.1:
                prev = None
                continue
            tx, tz = tx / tl, tz / tl
            best = None
            for j in tree.query(p.buffer(MAXGAP)):
                if j == i:
                    continue
                rb, lb, wb, ob = ways[j]
                if rb.get("n") != ra.get("n") and not (rb.get("n") and ra.get("n") and rb["n"].split()[0:2] == ra["n"].split()[0:2]):
                    continue
                dd = lb.project(p)
                c = lb.interpolate(dd)
                gap = math.hypot(c.x - p.x, c.y - p.y)
                if gap < 3.0 or gap > MAXGAP:
                    continue
                e = lb.interpolate(min(lb.length, dd + 1.0)); f = lb.interpolate(max(0.0, dd - 1.0))
                ux, uz = e.x - f.x, e.y - f.y
                ul = math.hypot(ux, uz) or 1.0
                if (ux * tx + uz * tz) / ul > -0.8:      # antiparallel
                    continue
                if abs((c.x - p.x) * tx + (c.y - p.y) * tz) > gap * 0.5:   # beside, not ahead
                    continue
                if best is None or gap < best[0]:
                    best = (gap, c, wb, ob)
            if best is None:
                prev = None
                continue
            gap, c, wb, jb = best
            free = gap - wa / 2 - wb / 2
            cut = LineString([(p.x, p.y), (c.x, c.y)])
            if free > MAXFREE or any(g not in (oa, jb) and cut.crosses(allw[g]) for g in alltree.query(cut)):
                prev = None
                continue
            cur = ((p.x, p.y), (c.x, c.y), free, jb)
            if prev is not None and prev[3] == jb and prev[2] > 0.8 and free > 0.8:
                quad = Polygon([prev[0], cur[0], cur[1], prev[1]])
                if quad.is_valid and quad.area > 0.5:
                    (narrow if (free + prev[2]) / 2 < NARROW else wide).append(quad)
            prev = cur
    nu = unary_union(narrow).buffer(0.3).buffer(-0.3) if narrow else None
    wu = unary_union(wide).buffer(0.3).buffer(-0.3) if wide else None
    def polys(g):
        if g is None or g.is_empty:
            return []
        return [g] if g.geom_type == "Polygon" else [x for x in getattr(g, "geoms", []) if x.geom_type == "Polygon" and x.area > 1.0]
    out = (polys(nu), polys(wu))
    log(f"  medians: {len(ways)} one-way carriageways, {len(out[0])} narrow and {len(out[1])} wide median pieces, {sum(p.area for p in out[0] + out[1]) / 1000:.0f} k m2")
    return out
