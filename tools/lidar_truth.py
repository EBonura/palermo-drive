"""True lidar DTM (and DSM) at points, from GetFeatureInfo of the MASE WMS (tools/lidar_raster.py documents the source).

The DTM layer answers with several bands: @3 is the DTM, @6 the DSM (last return: roofs, canopy). `lidar_raster.gfi` and
`lidar.py` historically took the *last* band, which is the DSM wherever something stands on the ground. This module reads the
bands by id, so it is the reference for "what is the real ground height here". Answers are cached in
data/dem_truth/points.json  {"lat,lon (5 decimals)": [dtm, dsm]}  (resumable, gitignored with data/).

    import lidar_truth as lt; lt.query_xz([(x, z), ...])   -> array of (dtm, dsm), NaN where there is no lidar
"""
import json
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lidar_raster as lr  # noqa: E402

ROOT = os.path.join(os.path.dirname(HERE), "data", "dem_truth")
PTS = os.path.join(ROOT, "points.json")
BAND = re.compile(r"@(\d+) Stretched value;Pixel Value; *(\d+);([-\d.]+)")
_lock = threading.Lock()
_cache = None


def _load():
    global _cache
    if _cache is None:
        _cache = json.load(open(PTS)) if os.path.exists(PTS) else {}
    return _cache


def save():
    os.makedirs(ROOT, exist_ok=True)
    with _lock:
        with open(PTS + ".part", "w") as f:
            json.dump(_cache, f, separators=(",", ":"))
        os.replace(PTS + ".part", PTS)


def _ask(lat, lon):
    d = 0.00005
    bb = ",".join(f"{v:.8f}" for v in (lat - d, lon - d, lat + d, lon + d))
    layer = lr.LAYERS["dtm"]
    url = (f"{lr.WMS}&request=GetFeatureInfo&layers={layer}&query_layers={layer}&styles=&crs=EPSG:4326"
           f"&bbox={bb}&width=11&height=11&I=5&J=5&info_format=text/plain")
    txt = lr._http(url).decode("latin-1")
    b = {int(k): float(v) for k, s, v in BAND.findall(txt)}
    if 3 not in b:
        return None
    return [round(b[3], 2), round(b.get(6, b[3]), 2)]


def query_xz(pts, threads=8, progress=True):
    """pts: iterable of (x, z) local metres -> float array (n, 2) of (dtm, dsm); NaN = no lidar there."""
    c = _load()
    keys = []
    for x, z in pts:
        lat, lon = lr.xz_to_latlon(x, z)
        keys.append((f"{lat:.6f},{lon:.6f}", lat, lon))
    todo = [k for k in dict.fromkeys(keys) if k[0] not in c]
    if todo:
        n = [0]
        t0 = time.time()

        def one(k):
            try:
                r = _ask(k[1], k[2])
            except RuntimeError:
                return
            with _lock:
                c[k[0]] = r
                n[0] += 1
            if progress and n[0] % 200 == 0:
                print(f"  truth {n[0]}/{len(todo)} {n[0] / (time.time() - t0):.1f}/s", flush=True)
                if n[0] % 1000 == 0:
                    save()
        with ThreadPoolExecutor(threads) as ex:
            list(ex.map(one, todo))
        save()
    out = np.full((len(keys), 2), np.nan)
    for i, k in enumerate(keys):
        v = c.get(k[0])
        if v:
            out[i] = v
    return out
