#!/usr/bin/env python3
"""Bake the start picker's city map (src/startmap.js) from the world tiles.

  tools/.venv/bin/python -I tools/startmap.py            # world/ -> assets/ui/startmap.json

Reads world/tiles/*.json (the same data the game streams) and writes one small file with what a 2D overview needs:
roads in three tiers, park / wood / farm / water / sand polygons, and a built-up density grid made from the building
footprints (40 m cells). The coastline, islands and the terrain grid come from world/manifest.json at runtime, so they
are not repeated here. Coordinates are game metres (x east, z south, Quattro Canti at 0,0) stored as integers of Q metres,
polylines delta coded: [n, x0, z0, dx1, dz1, ...]. Re-run it after a tile rebake; the file is derived, never edit it.
"""
import glob, json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Q = 2            # metres per stored unit
CELL = 40        # built-up grid cell, metres
TIER = {}
for k in ('motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'): TIER[k] = 'a'
for k in ('secondary', 'secondary_link', 'tertiary', 'tertiary_link'): TIER[k] = 'b'
for k in ('residential', 'unclassified', 'living_street', 'pedestrian'): TIER[k] = 'c'
AREA = {'green': 'green', 'grass': 'green', 'forest': 'forest', 'scrub': 'forest', 'farm': 'farm', 'orchard': 'farm', 'cemetery': 'green',
        'water': 'water', 'sand': 'sand'}


def dp(pts, tol):
    """Douglas-Peucker on [(x, z)], iterative."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    st = [(0, len(pts) - 1)]
    while st:
        a, b = st.pop()
        ax, az = pts[a]; bx, bz = pts[b]; dx, dz = bx - ax, bz - az; l2 = dx * dx + dz * dz
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, pz = pts[i]
            if l2 == 0: d = math.hypot(px - ax, pz - az)
            else:
                t = max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / l2)); d = math.hypot(px - ax - t * dx, pz - az - t * dz)
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; st.append((a, bi)); st.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def enc(pts):
    out = [len(pts), round(pts[0][0] / Q), round(pts[0][1] / Q)]
    px, pz = out[1], out[2]
    for x, z in pts[1:]:
        qx, qz = round(x / Q), round(z / Q); out += [qx - px, qz - pz]; px, pz = qx, qz
    return out


def main():
    man = json.load(open(os.path.join(ROOT, 'world/manifest.json')))
    x0, z0, x1, z1 = man['bbox']
    nx, nz = int((x1 - x0) // CELL) + 1, int((z1 - z0) // CELL) + 1
    dens = [0.0] * (nx * nz)
    roads = {'a': [], 'b': [], 'c': []}
    areas = {k: [] for k in set(AREA.values())}
    seen = set()
    files = sorted(glob.glob(os.path.join(ROOT, 'world/tiles/*.json')))
    for n, f in enumerate(files):
        d = json.load(open(f))
        for r in d['roads']:
            t = TIER.get(r['k'])
            if not t: continue
            p = r['p']; pts = [(p[i], p[i + 1]) for i in range(0, len(p) - 1, 2)]
            pts = dp(pts, 1.5 if t != 'c' else 2.5)
            if len(pts) >= 2: roads[t].append(enc(pts))
        for a in d['areas']:
            g = AREA.get(a['k'])
            if not g: continue
            p = a['p']; pts = [(p[i], p[i + 1]) for i in range(0, len(p) - 1, 2)]
            if len(pts) < 3: continue
            key = (g, round(pts[0][0]), round(pts[0][1]), len(pts))
            if key in seen: continue
            seen.add(key)
            ar = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))) / 2
            if ar < 500: continue
            pts = dp(pts, 5)
            if len(pts) >= 3: areas[g].append(enc(pts))
        for b in d['buildings']:
            p = b['p']; m = len(p) // 2
            if m < 3: continue
            ar = abs(sum(p[2 * i] * p[2 * ((i + 1) % m) + 1] - p[2 * ((i + 1) % m)] * p[2 * i + 1] for i in range(m))) / 2
            cx, cz = sum(p[0::2]) / m, sum(p[1::2]) / m
            ix, iz = int((cx - x0) // CELL), int((cz - z0) // CELL)
            if 0 <= ix < nx and 0 <= iz < nz: dens[iz * nx + ix] += ar
        if n % 100 == 0: print(n, len(files), file=sys.stderr, flush=True)
    # 16 levels; a cell that is 70 % covered counts as full so the dense centro reads as solid and suburbs as a haze
    full = CELL * CELL * 0.7
    built = ''.join(chr(97 + min(15, int(min(1.0, v / full) * 15.99))) for v in dens)
    out = {'v': 1, 'q': Q, 'roads': roads, 'areas': areas, 'built': {'x0': x0, 'z0': z0, 's': CELL, 'nx': nx, 'nz': nz, 'd': built}}
    dst = os.path.join(ROOT, 'assets/ui/startmap.json')
    with open(dst, 'w') as fh: json.dump(out, fh, separators=(',', ':'))
    print({k: len(v) for k, v in roads.items()}, {k: len(v) for k, v in areas.items()}, os.path.getsize(dst), 'bytes', file=sys.stderr)


if __name__ == '__main__':
    main()
