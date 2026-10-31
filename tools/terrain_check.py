"""City-wide check of the ground under the roads, over the baked world tiles (no browser needed).

It re-implements what src/world.js does with a tile's terrain: `groundY` (the tile's 10 m near grid, bilinear, else the manifest far
grid, then the road bench of computeShape) and the rendered terrain mesh (triangles over a 5 m grid under shaped corridors or 10 m,
20 m at low detail, every vertex at groundY - 0.2). Keep SHAPE_* in step with src/world.js.

For every drivable road, sampled every STEP metres along the centreline, it reports

  mesh    the rendered terrain mesh sticks out above the road surface (the draped asphalt = groundY) by more than MESH_TOL across the
          carriageway or its kerb margin (full detail mesh), or by more than MESH_TOL_LOW with the 20 m low detail mesh
  bank    the ground rises more than BANK_TOL above the road edge within BANK_MARGIN metres beside the carriageway (the terrain hides
          the road from a driver, or the road sits in a trench); where a road bench exists only the rise on top of the natural hillside's
          own counts (an unshaped road: all of it)
  grade   longitudinal grade above GRADE_MAX over 6 m (a real street never does this)
  bump    the centreline height differs from its own +-BUMP_WIN metres running median by more than BUMP_TOL (a bump or a dip that a
          smooth road profile would not have)
  cross   cross fall across the carriageway above CROSS_MAX

and clusters the flagged samples by street name and tile, worst first.

    tools/.venv/bin/python -I tools/terrain_check.py [--world world] [--tiles i_j,i_j | --box x0,z0,x1,z1] [--out report.json] [--top 40]
"""
import argparse
import json
import math
import os
import sys
from collections import defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
T = 500.0
DRIVE = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary",
         "tertiary_link", "unclassified", "residential", "living_street", "service", "track"}
SHAPE_ROADS = DRIVE
SHAPE_EASE, SHAPE_S = 11.0, 2.0
MESH_DROP = 0.2          # src/world.js terrainMesh: vertices at groundY - 0.2

STEP = 3.0
MESH_TOL, MESH_TOL_LOW = 0.2, 0.6
BANK_TOL, BANK_MARGIN = 0.8, 4.0
GRADE_MAX = 0.22
BUMP_TOL, BUMP_WIN = 0.5, 12.0
CROSS_MAX = 0.12


def smooth(a, b, x):
    t = np.clip((np.asarray(x) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class World:
    def __init__(self, base, shaping=True, tiles_filter=None):
        self.base = base
        self.m = json.load(open(os.path.join(base, "manifest.json")))
        f = self.m["far"]
        self.far = (f["x0"], f["z0"], f["s"], f["nx"], f["nz"], np.array(f["h"], np.float64).reshape(f["nz"], f["nx"]))
        self.tiles = {}      # (i, j) -> dict(data, near)
        self.shape = {}      # (i, j) -> (x0, z0, s, nx, nz, W, WH) or None
        self.shaping = shaping
        self.shape_fn = None   # optional override: (World, i, j) -> shape tuple or None
        for key in self.m["tiles"]:
            i, j = (int(v) for v in key.split("_"))
            if tiles_filter is not None and (i, j) not in tiles_filter:
                continue
            self.tiles[(i, j)] = None   # loaded lazily
        self.cache = {}

    def load(self, i, j):
        k = (i, j)
        if k in self.cache:
            return self.cache[k]
        p = os.path.join(self.base, "tiles", f"{i}_{j}.json")
        if not os.path.exists(p):
            self.cache[k] = None
            return None
        d = json.load(open(p))
        n = d.get("near")
        if n:
            n = dict(n, a=np.array(n["h"], np.float64).reshape(n["nz"], n["nx"]))
        self.cache[k] = {"d": d, "near": n}
        return self.cache[k]

    # ---- height sampling (vectorised) ----
    @staticmethod
    def _grid(a, x0, z0, s, nx, nz, x, z):
        fx = np.clip((x - x0) / s, 0, nx - 1.001)
        fz = np.clip((z - z0) / s, 0, nz - 1.001)
        i, j = fx.astype(int), fz.astype(int)
        tx, tz = fx - i, fz - j
        return (a[j, i] * (1 - tx) + a[j, i + 1] * tx) * (1 - tz) + (a[j + 1, i] * (1 - tx) + a[j + 1, i + 1] * tx) * tz

    def far_h(self, x, z):
        x0, z0, s, nx, nz, a = self.far
        return self._grid(a, x0, z0, s, nx, nz, x, z)

    def base_h(self, x, z):
        """Unshaped ground (a tile's own near grid, else the far grid)."""
        x, z = np.broadcast_arrays(np.asarray(x, np.float64), np.asarray(z, np.float64))
        out = self.far_h(x, z)
        ti, tj = np.floor(x / T).astype(int), np.floor(z / T).astype(int)
        keys = ti * 100000 + tj
        for k in np.unique(keys):
            m = keys == k
            i, j = int(ti[m][0]), int(tj[m][0])
            t = self.load(i, j) if (i, j) in self.tiles else None
            if t and t["near"]:
                n = t["near"]
                out[m] = self._grid(n["a"], n["x0"], n["z0"], n["s"], n["nx"], n["nz"], x[m], z[m])
        return out

    def ground(self, x, z):
        x, z = np.broadcast_arrays(np.asarray(x, np.float64), np.asarray(z, np.float64))
        g = self.base_h(x, z)
        if not self.shaping:
            return g
        ti, tj = np.floor(x / T).astype(int), np.floor(z / T).astype(int)
        keys = ti * 100000 + tj
        for k in np.unique(keys):
            i, j = int(ti[keys == k][0]), int(tj[keys == k][0])
            sh = self.get_shape(i, j)
            if sh is None:
                continue
            m = keys == k
            x0, z0, s, nx, nz, W, WH = sh
            fx, fz = (x[m] - x0) / s, (z[m] - z0) / s
            ok = (fx >= 0) & (fz >= 0) & (fx < nx - 1) & (fz < nz - 1)
            ii, jj = np.clip(fx.astype(int), 0, nx - 2), np.clip(fz.astype(int), 0, nz - 2)
            tx, tz = fx - ii, fz - jj
            w = (W[jj, ii] * (1 - tx) + W[jj, ii + 1] * tx) * (1 - tz) + (W[jj + 1, ii] * (1 - tx) + W[jj + 1, ii + 1] * tx) * tz
            wh = (WH[jj, ii] * (1 - tx) + WH[jj, ii + 1] * tx) * (1 - tz) + (WH[jj + 1, ii] * (1 - tx) + WH[jj + 1, ii + 1] * tx) * tz
            gm = g[m]
            g[m] = np.where(ok & (w > 0), gm * (1 - w) + wh, gm)
        return g

    # ---- road bench (port of computeShape in src/world.js) ----
    def get_shape(self, i, j):
        k = (i, j)
        if k not in self.shape:
            self.shape[k] = self.shape_fn(self, i, j) if self.shape_fn else self.compute_shape(i, j)
        return self.shape[k]

    def compute_shape(self, i, j):
        t = self.load(i, j) if (i, j) in self.tiles else None
        if not t:
            return None
        roads = [r for r in t["d"]["roads"] if r["k"] in SHAPE_ROADS and not r.get("tn") and not r.get("br")]
        if not roads:
            return None
        gx, gz = np.meshgrid(i * T + np.arange(9) * T / 8, j * T + np.arange(9) * T / 8)
        b = self.base_h(gx, gz)
        lo, hi = b.min(), b.max()
        has_near = t["near"] is not None
        if (hi < 150) if has_near else (hi - lo < 12):
            return None

        def blur(x, z):
            tot, n = self.base_h(x, z), 1
            for r in (20, 45):
                for k in range(8):
                    a = k * math.pi / 4
                    tot = tot + self.base_h(x + math.cos(a) * r, z + math.sin(a) * r)
                    n += 1
            return tot / n
        return self.build_bench(i, j, roads, blur)

    def build_bench(self, i, j, roads, blur):
        s = SHAPE_S
        R = lambda r: max(r["w"], 3) / 2 + 1.5 + SHAPE_EASE
        px = [],
        allp = np.concatenate([np.array(r["p"]).reshape(-1, 2) for r in roads])
        e = max(R(r) for r in roads)
        bx0, bx1 = allp[:, 0].min() - e, allp[:, 0].max() + e
        bz0, bz1 = allp[:, 1].min() - e, allp[:, 1].max() + e
        bx0, bz0 = max(bx0, i * T - 2), max(bz0, j * T - 2)
        bx1, bz1 = min(bx1, (i + 1) * T + 2), min(bz1, (j + 1) * T + 2)
        x0, z0 = math.floor(bx0 / s) * s, math.floor(bz0 / s) * s
        nx, nz = math.ceil((bx1 - x0) / s) + 2, math.ceil((bz1 - z0) / s) + 2
        if nx < 3 or nz < 3:
            return None
        W = np.zeros((nz, nx))
        WH = np.zeros((nz, nx))
        best = np.full((nz, nx), 1e9)
        for r in roads:
            half = max(r["w"], 3) / 2
            flat, reach = half + 1.5, R(r)
            p = np.array(r["p"]).reshape(-1, 2)
            pts = []
            for a, b2 in zip(p[:-1], p[1:]):
                L = math.hypot(b2[0] - a[0], b2[1] - a[1])
                n = max(1, math.ceil(L / 3))
                for k in range(0 if not pts else 1, n + 1):
                    pts.append((a[0] + (b2[0] - a[0]) * k / n, a[1] + (b2[1] - a[1]) * k / n))
            pts = np.array(pts)
            h = blur(pts[:, 0], pts[:, 1])
            for q in range(len(pts) - 1):
                a, b2 = pts[q], pts[q + 1]
                dx, dz = b2[0] - a[0], b2[1] - a[1]
                l2 = dx * dx + dz * dz or 1.0
                i0 = max(0, math.floor((min(a[0], b2[0]) - reach - x0) / s))
                i1 = min(nx - 1, math.ceil((max(a[0], b2[0]) + reach - x0) / s))
                j0 = max(0, math.floor((min(a[1], b2[1]) - reach - z0) / s))
                j1 = min(nz - 1, math.ceil((max(a[1], b2[1]) + reach - z0) / s))
                if i1 < i0 or j1 < j0:
                    continue
                gx = x0 + np.arange(i0, i1 + 1) * s
                gz = z0 + np.arange(j0, j1 + 1) * s
                PX, PZ = np.meshgrid(gx, gz)
                tt = np.clip(((PX - a[0]) * dx + (PZ - a[1]) * dz) / l2, 0, 1)
                d = np.hypot(PX - a[0] - dx * tt, PZ - a[1] - dz * tt)
                bsub = best[j0:j1 + 1, i0:i1 + 1]
                ok = (d < reach) & (d < bsub)
                if not ok.any():
                    continue
                e = np.where(d <= flat, 1.0, 1 - smooth(flat, reach, d))
                hh = h[q] + (h[q + 1] - h[q]) * tt
                bsub[ok] = d[ok]
                W[j0:j1 + 1, i0:i1 + 1][ok] = e[ok]
                WH[j0:j1 + 1, i0:i1 + 1][ok] = (e * hh)[ok]
        return (x0, z0, s, nx, nz, W, WH)

    # ---- the rendered terrain mesh ----
    def bench_min(self, i, j, R):
        """Per tile: the lowest road bench height within R metres of every bench cell neighbourhood (src/world.js terrainMesh, low detail)."""
        import cv2
        k = (i, j, R)
        if k not in self.cache:
            sh = self.get_shape(i, j)
            if sh is None:
                self.cache[k] = None
            else:
                x0, z0, s, nx, nz, W, WH = sh
                h = np.where(W >= 0.999, WH, 1e9).astype(np.float32)
                r = int(R // s)
                ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
                self.cache[k] = cv2.erode(h, ker, borderValue=1e9)
        return self.cache[k]

    def vertex_h(self, i, j, X, Z, step, low):
        """Heights of the terrain mesh vertices of tile (i, j): groundY - 0.2, pulled below nearby benches at low detail."""
        y = self.ground(X, Z)
        if low and self.shaping:
            sh = self.get_shape(i, j)
            if sh is not None:
                R = step + 1
                bm = self.bench_min(i, j, R)
                x0, z0, s, nx, nz, _, _ = sh
                ci = np.clip(np.round((X - x0) / s).astype(int), 0, nx - 1)
                cj = np.clip(np.round((Z - z0) / s).astype(int), 0, nz - 1)
                m = bm[cj, ci] - 0.3
                y = np.where(m < y, m, y)
        return y - MESH_DROP

    def mesh(self, x, z, low=False):
        """Height of the terrain triangles at (x, z): vertices at groundY - 0.2 on a grid anchored at the owning tile's corner."""
        x, z = np.broadcast_arrays(np.asarray(x, np.float64), np.asarray(z, np.float64))
        out = np.empty(x.shape)
        ti, tj = np.floor(x / T).astype(int), np.floor(z / T).astype(int)
        keys = ti * 100000 + tj
        for k in np.unique(keys):
            m = keys == k
            i, j = int(ti[m][0]), int(tj[m][0])
            t = self.load(i, j) if (i, j) in self.tiles else None
            has_near = bool(t and t["near"])
            shaped = self.shaping and self.get_shape(i, j) is not None
            if low:
                step = (10 if has_near else 25) * 2
            else:
                step = 5 if shaped else (10 if has_near else 25)
            fx, fz = (x[m] - i * T) / step, (z[m] - j * T) / step
            a, b = np.floor(fx).astype(int), np.floor(fz).astype(int)
            tx, tz = fx - a, fz - b
            X0, Z0 = i * T + a * step, j * T + b * step
            ha = self.vertex_h(i, j, X0, Z0, step, low)
            hb = self.vertex_h(i, j, X0, Z0 + step, step, low)
            hc = self.vertex_h(i, j, X0 + step, Z0, step, low)
            hd = self.vertex_h(i, j, X0 + step, Z0 + step, step, low)
            lower = tx + tz <= 1
            out[m] = np.where(lower, ha + tx * (hc - ha) + tz * (hb - ha), hd + (1 - tx) * (hb - hd) + (1 - tz) * (hc - hd))
        return out


def running_median(v, half):
    out = np.empty_like(v)
    for i in range(len(v)):
        out[i] = np.median(v[max(0, i - half):i + half + 1])
    return out


def check_road(W, r):
    """-> list of (kind, s_along, value, x, z) flags and the sampled length."""
    p = np.array(r["p"]).reshape(-1, 2)
    seg = np.hypot(*(p[1:] - p[:-1]).T)
    L = seg.sum()
    if L < 4:
        return [], L
    n = max(2, int(L / STEP) + 1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    sd = np.linspace(0, L, n)
    cx = np.interp(sd, cum, p[:, 0])
    cz = np.interp(sd, cum, p[:, 1])
    tx, tz = np.gradient(cx), np.gradient(cz)
    tl = np.hypot(tx, tz)
    tl[tl == 0] = 1
    nx_, nz_ = -tz / tl, tx / tl
    half = max(r.get("cw") or r["w"], 3) / 2
    flags = []
    hr = W.ground(cx, cz)
    # profile
    ds = sd[1] - sd[0]
    k6 = max(1, round(6 / ds))
    grade = np.abs(hr[k6:] - hr[:-k6]) / (k6 * ds)
    for q in np.nonzero(grade > GRADE_MAX)[0]:
        flags.append(("grade", sd[q], float(grade[q]), cx[q], cz[q]))
    med = running_median(hr, max(1, round(BUMP_WIN / ds)))
    for q in np.nonzero(np.abs(hr - med) > BUMP_TOL)[0]:
        flags.append(("bump", sd[q], float(hr[q] - med[q]), cx[q], cz[q]))
    # lateral
    worst_mesh = np.zeros(n)
    worst_low = np.zeros(n)
    bank = np.zeros(n)
    cross = np.zeros(n)
    for side in (-1, 1):
        for u in (0.0, half * 0.5, half, half + 1.0, half + 2.0, half + BANK_MARGIN):
            qx, qz = cx + side * u * nx_, cz + side * u * nz_
            g = W.ground(qx, qz)
            if u <= half + 1.0:
                m1 = W.mesh(qx, qz) - g
                worst_mesh = np.maximum(worst_mesh, m1)
            if u <= half + 1.0:
                worst_low = np.maximum(worst_low, W.mesh(qx, qz, low=True) - g)
            if u == half:
                cross = np.maximum(cross, np.abs(g - hr) / max(half, 0.5))
            if u > half:
                ex, ez = cx + side * half * nx_, cz + side * half * nz_
                rise = g - W.ground(ex, ez)
                if W.shaping:   # the bench may not make the wall beside the road steeper than the natural hillside
                    rise = rise - np.maximum(W.base_h(qx, qz) - W.base_h(ex, ez), 0)
                bank = np.maximum(bank, rise)
    for q in np.nonzero(worst_mesh > MESH_TOL)[0]:
        flags.append(("mesh", sd[q], float(worst_mesh[q]), cx[q], cz[q]))
    for q in np.nonzero(worst_low > MESH_TOL_LOW)[0]:
        flags.append(("meshlow", sd[q], float(worst_low[q]), cx[q], cz[q]))
    for q in np.nonzero(bank > BANK_TOL)[0]:
        flags.append(("bank", sd[q], float(bank[q]), cx[q], cz[q]))
    for q in np.nonzero(cross > CROSS_MAX)[0]:
        flags.append(("cross", sd[q], float(cross[q]), cx[q], cz[q]))
    return flags, L


def run(W, tile_list, verbose=True):
    flags = []
    length = defaultdict(float)
    for n, (i, j) in enumerate(tile_list):
        t = W.load(i, j)
        if not t:
            continue
        for r in t["d"]["roads"]:
            if r["k"] not in DRIVE or r.get("tn") or r.get("br"):
                continue
            f, L = check_road(W, r)
            length["all"] += L
            name = r.get("n") or f"({r['k']})"
            for kind, s, v, x, z in f:
                flags.append({"kind": kind, "name": name, "tile": f"{i}_{j}", "s": s, "v": v, "x": x, "z": z, "k": r["k"]})
        if verbose and n % 20 == 0:
            print(f"  {n}/{len(tile_list)} tiles, {len(flags)} flags", flush=True)
    return flags, length["all"]


def cluster(flags, step=STEP):
    """Group flags by (kind, street name, tile): count * STEP metres affected, worst value, centre."""
    g = defaultdict(list)
    for f in flags:
        g[(f["kind"], f["name"], f["tile"])].append(f)
    out = []
    for (kind, name, tile), l in g.items():
        w = max(l, key=lambda f: abs(f["v"]))
        out.append({"kind": kind, "name": name, "tile": tile, "metres": len(l) * step, "worst": w["v"], "x": w["x"], "z": w["z"]})
    out.sort(key=lambda c: -c["metres"] * (1 + abs(c["worst"])))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--world", default=os.path.join(ROOT, "world"))
    ap.add_argument("--tiles")
    ap.add_argument("--box", help="x0,z0,x1,z1 local metres")
    ap.add_argument("--out")
    ap.add_argument("--top", type=int, default=40)
    ap.add_argument("--no-shape", action="store_true")
    a = ap.parse_args()
    W = World(a.world, shaping=not a.no_shape)
    keys = sorted(W.tiles)
    if a.tiles:
        want = {tuple(int(v) for v in s.split("_")) for s in a.tiles.split(",")}
        keys = [k for k in keys if k in want]
    if a.box:
        x0, z0, x1, z1 = (float(v) for v in a.box.split(","))
        keys = [k for k in keys if k[0] * T < x1 and (k[0] + 1) * T > x0 and k[1] * T < z1 and (k[1] + 1) * T > z0]
    flags, length = run(W, keys)
    cl = cluster(flags)
    kinds = defaultdict(float)
    for f in flags:
        kinds[f["kind"]] += STEP
    print(f"\n{len(keys)} tiles, {length / 1000:.0f} km of drivable road sampled every {STEP:.0f} m")
    for k in ("mesh", "meshlow", "bank", "grade", "bump", "cross"):
        print(f"  {k:8s} {kinds[k]:9.0f} m flagged ({100 * kinds[k] / max(length, 1):.2f} %)")
    print(f"\nworst clusters (kind, street, tile, metres, worst, x, z):")
    for c in cl[:a.top]:
        print(f"  {c['kind']:8s} {c['name'][:38]:38s} {c['tile']:>9s} {c['metres']:6.0f} m  worst {c['worst']:+6.2f}  at {c['x']:.0f},{c['z']:.0f}")
    if a.out:
        json.dump({"length": length, "kinds": kinds, "clusters": cl, "flags": flags}, open(a.out, "w"))


if __name__ == "__main__":
    main()
