"""Compare the game's ground (baked tiles + the road bench, tools/terrain_check.py) with the MASE lidar DTM point queries.

Points are drawn along drivable road centrelines inside a set of regions (Acquasanta, the Favorita, the Pellegrino roads, the centro,
Monreale, Baida, Bellolampo, Capo Gallo, Ciaculli...). Each is asked of the WMS (tools/lidar_truth.py, band @3 = DTM, cached in
data/dem_truth/points.json) and compared with `World.ground` of one or more baked worlds. Points without lidar are dropped.

    tools/.venv/bin/python -I tools/terrain_truth.py [--worlds world,data/world_try] [--per 60] [--seed 1] [--unshaped]
"""
import argparse
import math
import os
import random
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lidar_truth as lt  # noqa: E402
import terrain_check as tc  # noqa: E402
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.dirname(HERE)


def xz(lat, lon):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ


# name: (lat0, lon0, lat1, lon1)
REGIONS = {
    "Acquasanta": (38.1380, 13.3600, 38.1480, 13.3680),
    "Favorita": (38.1560, 13.3350, 38.1700, 13.3500),
    "Pellegrino S/E roads": (38.1520, 13.3550, 38.1750, 13.3780),
    "Pellegrino plateau": (38.1650, 13.3400, 38.1800, 13.3600),
    "Arenella/Vergine Maria": (38.1500, 13.3600, 38.1620, 13.3700),
    "Centro": (38.1100, 13.3530, 38.1210, 13.3700),
    "Monreale/Baida": (38.0900, 13.2850, 38.1150, 13.3050),
    "Boccadifalco": (38.1000, 13.3000, 38.1200, 13.3250),
    "Bellolampo": (38.1500, 13.2750, 38.1700, 13.3000),
    "Capo Gallo": (38.2000, 13.2750, 38.2200, 13.3050),
    "Ciaculli/Villagrazia": (38.0550, 13.3500, 38.0950, 13.4000),
}


def road_points(W, box, n, rnd):
    lat0, lon0, lat1, lon1 = box
    (xa, za), (xb, zb) = xz(lat1, lon0), xz(lat0, lon1)
    x0, x1, z0, z1 = min(xa, xb), max(xa, xb), min(za, zb), max(za, zb)
    pts = []
    for (i, j) in sorted(W.tiles):
        if i * tc.T > x1 or (i + 1) * tc.T < x0 or j * tc.T > z1 or (j + 1) * tc.T < z0:
            continue
        t = W.load(i, j)
        if not t:
            continue
        for r in t["d"]["roads"]:
            if r["k"] not in tc.DRIVE or r.get("tn") or r.get("br"):
                continue
            p = np.array(r["p"]).reshape(-1, 2)
            for a, b in zip(p[:-1], p[1:]):
                L = math.hypot(*(b - a))
                for k in range(max(1, int(L / 25))):
                    q = a + (b - a) * (k / max(1, int(L / 25)))
                    if x0 <= q[0] <= x1 and z0 <= q[1] <= z1:
                        pts.append((q[0], q[1]))
    rnd.shuffle(pts)
    return pts[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--worlds", default=os.path.join(ROOT, "world"))
    ap.add_argument("--per", type=int, default=60)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--unshaped", action="store_true")
    a = ap.parse_args()
    rnd = random.Random(a.seed)
    worlds = [(w, tc.World(w if os.path.isabs(w) else os.path.join(ROOT, w), shaping=not a.unshaped)) for w in a.worlds.split(",")]
    base = worlds[0][1]
    allp, reg = [], []
    for name, box in REGIONS.items():
        ps = road_points(base, box, a.per, rnd)
        allp += ps
        reg += [name] * len(ps)
    truth = lt.query_xz(allp)
    dtm = truth[:, 0]
    ok = np.isfinite(dtm)
    print(f"{len(allp)} road points, {int(ok.sum())} with lidar\n")
    reg = np.array(reg)
    hdr = f"{'region':24s} {'n':>4s} {'truth m':>9s}  " + "  ".join(f"{os.path.basename(w.rstrip('/')):>26s}" for w, _ in worlds)
    print(hdr)
    xs, zs = np.array([p[0] for p in allp]), np.array([p[1] for p in allp])
    G = [W.ground(xs, zs) for _, W in worlds]
    for name in list(REGIONS) + ["ALL"]:
        m = ok & ((reg == name) if name != "ALL" else True)
        if not m.any():
            print(f"{name:24s} {0:4d}")
            continue
        cells = []
        for g in G:
            e = g[m] - dtm[m]
            cells.append(f"bias {e.mean():+5.1f} rms {np.sqrt((e ** 2).mean()):4.1f} p95 {np.percentile(abs(e), 95):4.1f} max {abs(e).max():5.1f}")
        print(f"{name:24s} {int(m.sum()):4d} {dtm[m].mean():9.0f}  " + "  ".join(f"{c:>26s}" for c in cells))


if __name__ == "__main__":
    main()
