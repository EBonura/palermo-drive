"""Lidar DTM above the 204 m saturation of the rendered rasters, from GetFeatureInfo point queries (MASE Geoportale).

tools/lidar_raster.py decodes elevations from a picture whose 8-bit ramp clips at ~204 m, so Monte Pellegrino (to 606 m) reads
as no data there. The same WMS answers GetFeatureInfo with the true elevation of the 2 m lidar pixel under a point, at any height.
This tool queries a 20 m lattice (world x, z multiples of STEP) wherever the lidar footprint exists but the raster has no value
(and the land is real, per the TINITALY DEM), and stores the answers; `sample(x, z)` then returns a bilinear height or NaN.

Source/licence: same as lidar_raster.py (Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale, PST-A lidar
Regione Sicilia, CC BY 4.0). Output: data/dem_lidar_hills/points.json  {"ix,iz": metres | null}  (gitignored, resumable).

    tools/.venv/bin/python -I tools/lidar_hills.py fetch [--threads 6]
Library: tools/.venv/bin/python -I, `import lidar_hills as lh; lh.sample(x, z)`.
"""
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lidar_raster as lr  # noqa: E402
import lidar_truth as lt  # noqa: E402

ROOT = os.path.join(os.path.dirname(HERE), "data", "dem_lidar_hills")
PTS = os.path.join(ROOT, "points_dtm.json")   # points.json (the first version) took the DSM band: canopy and roofs, not ground
STEP = 20.0
LATTICE_LO = 55.0   # metres (TINITALY height) above which the point lattice replaces the decoded raster
WINDOW = (-6800.0, 5200.0, -12200.0, 8200.0)   # x0, x1, z0, z1 (the whole-city bbox, a little generous)

_cache = {}


def candidates():
    """Lattice cells (ix, iz) that are inside the lidar footprint, land, and without a decoded raster value."""
    import dem
    x0, x1, z0, z1 = WINDOW
    ix = np.arange(int(x0 / STEP), int(x1 / STEP) + 1)
    iz = np.arange(int(z0 / STEP), int(z1 / STEP) + 1)
    gi, gj = np.meshgrid(ix, iz)
    gx, gz = gi * STEP, gj * STEP
    s, w, n, e = lr.CITY_BBOX
    mask = lr.probe("2x2")
    lat, lon = lr.xz_to_latlon(gx, gz)
    c = ((lon - w) / (e - w) * lr.PROBE_N).astype(int)
    r = ((n - lat) / (n - s) * lr.PROBE_N).astype(int)
    ok = (c >= 0) & (c < lr.PROBE_N) & (r >= 0) & (r < lr.PROBE_N)
    fp = np.zeros(gx.shape, bool)
    fp[ok] = mask[r[ok], c[ok]]
    ld = lr.sample_dtm(gx, gz, "bilinear")
    tin = dem.sample(gx, gz)
    # above the raster's 204 m saturation (no decoded value), and from LATTICE_LO up where the raster does decode: there its 8-bit ramp is
    # only good to a few metres and quantised (terraces on the slopes, dimples on the foothills), the point queries are exact
    need = fp & np.isfinite(tin) & ((~np.isfinite(ld) & (tin > 150)) | (np.isfinite(ld) & (tin > LATTICE_LO) & (tin <= 150)))
    return [(int(a), int(b)) for a, b in zip(gi[need], gj[need])]


def _load():
    return json.load(open(PTS)) if os.path.exists(PTS) else {}


def _save(d):
    os.makedirs(ROOT, exist_ok=True)
    with open(PTS + ".part", "w") as f:
        json.dump(d, f, separators=(",", ":"))
    os.replace(PTS + ".part", PTS)


def fetch(threads=6):
    cand = candidates()
    done = _load()
    todo = [c for c in cand if f"{c[0]},{c[1]}" not in done]
    print(f"{len(cand)} lattice points need a query, {len(todo)} still to do", flush=True)
    lock = threading.Lock()
    t0 = time.time()
    count = [0]

    def one(c):
        x, z = c[0] * STEP, c[1] * STEP
        lat, lon = lr.xz_to_latlon(x, z)
        try:
            r = lt._ask(lat, lon)   # [dtm, dsm] by band id (@3 / @6); lr.gfi_point returns the last band, the DSM
        except RuntimeError:
            return
        with lock:
            done[f"{c[0]},{c[1]}"] = None if r is None else round(r[0], 1)
            count[0] += 1
            if count[0] % 500 == 0:
                _save(done)
                rate = count[0] / (time.time() - t0)
                print(f"  {count[0]}/{len(todo)}  {rate:.1f}/s  eta {(len(todo) - count[0]) / rate / 60:.0f} min", flush=True)

    with ThreadPoolExecutor(threads) as ex:
        list(ex.map(one, todo))
    _save(done)
    print("done", len(done))


def sample(x, z):
    """Bilinear height from the lattice (NaN-aware: unanswered neighbours are dropped); NaN without enough data."""
    if "g" not in _cache:
        d = _load()
        ks = [tuple(int(v) for v in k.split(",")) for k in d]
        ix0, ix1 = min(k[0] for k in ks), max(k[0] for k in ks)
        iz0, iz1 = min(k[1] for k in ks), max(k[1] for k in ks)
        g = np.full((iz1 - iz0 + 1, ix1 - ix0 + 1), np.nan, np.float32)
        for k, v in d.items():
            a, b = (int(t) for t in k.split(","))
            if v is not None:
                g[b - iz0, a - ix0] = v
        _cache.update(g=g, ix0=ix0, iz0=iz0)
    g, ix0, iz0 = _cache["g"], _cache["ix0"], _cache["iz0"]
    x, z = np.broadcast_arrays(np.asarray(x, dtype=np.float64), np.asarray(z, dtype=np.float64))
    u, v = x / STEP - ix0, z / STEP - iz0
    ok = (u >= 0) & (v >= 0) & (u < g.shape[1] - 1) & (v < g.shape[0] - 1)
    u0 = np.clip(np.floor(u).astype(int), 0, g.shape[1] - 2)
    v0 = np.clip(np.floor(v).astype(int), 0, g.shape[0] - 2)
    fu, fv = u - u0, v - v0
    num = np.zeros(u.shape)
    den = np.zeros(u.shape)
    for dv, du, wgt in ((0, 0, (1 - fu) * (1 - fv)), (0, 1, fu * (1 - fv)), (1, 0, (1 - fu) * fv), (1, 1, fu * fv)):
        c = g[v0 + dv, u0 + du]
        good = np.isfinite(c)
        num += np.where(good, c * wgt, 0.0)
        den += np.where(good, wgt, 0.0)
    # neighbours without an answer (the raster covers them, or no lidar) are left out; too little weight left means no data
    return np.where(ok & (den >= 0.6), num / np.maximum(den, 1e-9), np.nan)


if __name__ == "__main__":
    if sys.argv[1:2] == ["fetch"]:
        th = int(sys.argv[sys.argv.index("--threads") + 1]) if "--threads" in sys.argv else 6
        fetch(th)
    else:
        print(__doc__)
