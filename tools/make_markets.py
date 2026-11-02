#!/usr/bin/env python3
"""Lays out the stall lines of Ballaro, the Vucciria and the Capo along their real streets and writes src/markets-data.js.

Reads the baked world tiles (roads and building outlines, local metres), takes the market streets by name inside a box round each market,
and walks their centre lines: stalls on both sides, facing the street, backs towards the houses, kept out of the building outlines and clear of
the side streets. Deterministic (hash of the position), so a re-run gives the same file.

  python3 tools/make_markets.py            # rewrite src/markets-data.js
  python3 tools/make_markets.py --stats    # only print the counts
"""
import glob, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, 'world', 'tiles')
OUT = os.path.join(ROOT, 'src', 'markets-data.js')

# name pattern, box [x0, z0, x1, z1] (local metres), mix of stall kinds (fruit, veg, fish, meat, misc), fill (share of slots on the busy side, on the quiet side), stall fronts' distance from the centre line
MARKETS = [
    dict(id='ballaro', name='Ballaro', pat=r"Ballar|Chiappara al Carmine|Casa Professa$|^Via Albergheria$|San Nicol. All'Albergheria", box=[-420, 250, 320, 720], anchor=(-10, 450, 230),
         mix=[.30, .26, .10, .10, .24], fill=(.56, .34), fd=1.25),
    dict(id='vucciria', name='Vucciria', pat=r"Maccheronai|Argenteria|Cassari$|Materassai|Garraffello|Caracciolo|Coltellieri|Chiavettieri", box=[100, -420, 560, -150], anchor=(300, -250, 190),
         mix=[.12, .10, .24, .22, .32], fill=(.52, .30), fd=1.25),
    dict(id='capo', name='Capo', pat=r"Sant'Agostino|Beati Paoli|Cappuccinelle|Porta Carini$", box=[-900, -330, -100, -60], anchor=(-450, -210, 250),
         mix=[.28, .24, .18, .12, .18], fill=(.68, .42), fd=1.25),
]
STEP = 2.7        # stall pitch along the street
HALF_W, DEPTH_FRONT, DEPTH_BACK = 1.15, 0.65, 1.15   # footprint: half width along the street, in front of the table (+z), behind it (-z)


def hs(x, z, k=0):
    s = math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453
    return s - math.floor(s)


def load(box):
    ix0, ix1 = math.floor(box[0] / 500) - 1, math.floor(box[2] / 500) + 1
    iz0, iz1 = math.floor(box[1] / 500) - 1, math.floor(box[3] / 500) + 1
    roads, blds = [], []
    for ix in range(ix0, ix1 + 1):
        for iz in range(iz0, iz1 + 1):
            f = os.path.join(TILES, '%d_%d.json' % (ix, iz))
            if not os.path.exists(f):
                continue
            t = json.load(open(f))
            for r in t.get('roads', []):
                p = r['p']; pts = list(zip(p[0::2], p[1::2]))
                roads.append(dict(n=r.get('n') or '', k=r.get('k'), w=r.get('w') or 6, pts=pts))
            for b in t.get('buildings', []):
                p = b['p']; pts = list(zip(p[0::2], p[1::2]))
                xs = [q[0] for q in pts]; zs = [q[1] for q in pts]
                blds.append((min(xs), min(zs), max(xs), max(zs), pts))
    return roads, blds


def in_poly(pts, x, z):
    c = False
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, zi = pts[i]; xj, zj = pts[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi:
            c = not c
        j = i
    return c


def seg_dist(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az
    l2 = dx * dx + dz * dz
    t = 0 if l2 == 0 else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / l2))
    return math.hypot(px - ax - dx * t, pz - az - dz * t)


def run(m):
    roads, blds = load(m['box'])
    pat = re.compile(m['pat'])
    x0, z0, x1, z1 = m['box']
    mine = []
    for r in roads:
        if not pat.search(r['n']):
            continue
        cx = sum(p[0] for p in r['pts']) / len(r['pts']); cz = sum(p[1] for p in r['pts']) / len(r['pts'])
        if x0 <= cx <= x1 and z0 <= cz <= z1:
            mine.append(r)
    others = [r for r in roads if r not in mine and r['k'] not in ('footway', 'path', 'cycleway', 'steps')]
    # everything else that is a street: side streets must stay open (any name that is not one of the market's own)
    side = [(r['pts'][i], r['pts'][i + 1], r['w'] / 2) for r in others for i in range(len(r['pts']) - 1)
            if x0 - 20 <= r['pts'][i][0] <= x1 + 20 and z0 - 20 <= r['pts'][i][1] <= z1 + 20]
    own = [(r['pts'][i], r['pts'][i + 1], r['w'] / 2, r['n']) for r in mine for i in range(len(r['pts']) - 1)]

    def in_building(x, z, pad):
        for (bx0, bz0, bx1, bz1, pts) in blds:
            if x < bx0 - pad or x > bx1 + pad or z < bz0 - pad or z > bz1 + pad:
                continue
            if in_poly(pts, x, z):
                return True
            # near an edge
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                if seg_dist(x, z, a[0], a[1], b[0], b[1]) < pad:
                    return True
        return False

    stalls, taken = [], []
    for r in mine:
        pts = r['pts']; hw = r['w'] / 2
        for i in range(len(pts) - 1):
            ax, az = pts[i]; bx, bz = pts[i + 1]
            L = math.hypot(bx - ax, bz - az)
            if L < 3:
                continue
            tx, tz = (bx - ax) / L, (bz - az) / L
            nx, nz = -tz, tx
            s = hs(ax, az, 3) * STEP
            while s < L - 0.8:
                px, pz = ax + tx * s, az + tz * s
                if math.hypot(px - m['anchor'][0], pz - m['anchor'][1]) > m['anchor'][2]:
                    s += STEP; continue
                for side_i, sg in enumerate((1, -1)):
                    fill = m['fill'][side_i] if hs(round(ax), round(az), 9) < 0.5 else m['fill'][1 - side_i]   # which side is the busy one varies by block
                    if hs(px, pz, 5 + side_i) > fill:
                        continue
                    # the stall's front sits fd from the centre line; its middle (the table) is 0.0 at the front minus 0.65 -> 'c' is the table's centre
                    fd = m['fd']
                    cx, cz = px + nx * sg * (fd + DEPTH_FRONT), pz + nz * sg * (fd + DEPTH_FRONT)
                    fx, fz = -nx * sg, -nz * sg      # facing the centre line
                    ok = True
                    # footprint samples: corners and the middle, in the stall's frame (u along the street, v out to the front)
                    for u in (-HALF_W, 0, HALF_W):
                        for v in (-DEPTH_BACK, -0.3, DEPTH_FRONT):
                            qx = cx + tx * u + fx * v; qz = cz + tz * u + fz * v
                            if in_building(qx, qz, 0.25):
                                ok = False; break
                        if not ok:
                            break
                    if not ok:
                        continue
                    # side streets and junctions stay open: no stall within 2 m (plus half width) of a street that is not part of this market
                    for (a, b, h) in side:
                        if seg_dist(cx, cz, a[0], a[1], b[0], b[1]) < h + 2.0:
                            ok = False; break
                    if not ok:
                        continue
                    # the other stalls (also the ones from the neighbouring way at a shared joint)
                    if any((cx - q[0]) ** 2 + (cz - q[1]) ** 2 < 1.9 ** 2 for q in taken):
                        continue
                    # the opposite row must leave a lane: the two fronts at least 2.2 m apart
                    taken.append((cx, cz))
                    rot = math.atan2(fx, fz)
                    h = hs(cx, cz, 1); acc = 0; kind = 0
                    for ki, w in enumerate(m['mix']):
                        acc += w
                        if h <= acc:
                            kind = ki; break
                    canopy = int(hs(cx, cz, 2) * 8)       # 0..3 striped awnings (red, green, blue, yellow), 4..7 plain tarps
                    crates = 1 if hs(cx, cz, 4) < 0.45 else 0
                    stalls.append([round(cx, 1), round(cz, 1), round(rot, 2), kind, canopy, crates])
                s += STEP
    return stalls, mine


def main():
    only_stats = '--stats' in sys.argv
    data = []
    for m in MARKETS:
        st, ways = run(m)
        xs = [q[0] for q in st] or [0]; zs = [q[1] for q in st] or [0]
        cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
        rad = max(math.hypot(q[0] - cx, q[1] - cz) for q in st) if st else 0
        kinds = [sum(1 for q in st if q[3] == k) for k in range(5)]
        print('%-9s ways %2d  stalls %3d  centre (%.0f, %.0f) radius %.0f  kinds %s' % (m['name'], len(ways), len(st), cx, cz, rad, kinds))
        data.append(dict(id=m['id'], name=m['name'], cx=round(cx), cz=round(cz), r=round(rad + 20), s=st))
    if only_stats:
        return
    with open(OUT, 'w') as f:
        f.write('// Stall lines of the three markets (Ballaro, Vucciria, Capo), laid out along their real streets by tools/make_markets.py from the baked tiles. Generated: do not edit.\n')
        f.write('// s: [x, z, rot, kind, canopy, crates] in local metres; kind 0 fruit 1 vegetables 2 fish 3 meat and cheese 4 misc (olives, spices, bags); canopy 0..3 striped awning, 4..7 plain tarp;\n')
        f.write('// crates: a stack of crates beside the stall. rot is the heading the stall faces (the table front is +z).\n')
        f.write('export const MARKETS = [\n')
        for d in data:
            f.write('  { id: %s, name: %s, cx: %d, cz: %d, r: %d, s: [\n' % (json.dumps(d['id']), json.dumps(d['name']), d['cx'], d['cz'], d['r']))
            for q in d['s']:
                f.write('    ' + json.dumps(q) + ',\n')
            f.write('  ] },\n')
        f.write('];\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


main()
