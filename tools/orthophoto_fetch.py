"""Download the aerial orthophoto blocks behind data/roof_colours.json and data/ground_colours.json (see tools/orthophoto_colours.py).

Source: Regione Siciliana, SITR, "Ortofoto ATA 2012-2013" (flown 2012-13, so about 13 years old). The ArcGIS REST services listed in the
metadata record https://www.sitr.regione.sicilia.it/geoportale/it/metadata/details/608 (CC BY 4.0, see docs/sources/sitr-orthophoto-colours.md):

    ortofoto_2013_15cm_comuni   15 cm, the municipalities of Enna, Messina, Palermo, Ragusa and Trapani (133 sheets cover Palermo)
    ortofoto_2013_25cm_sicilia  25 cm, the whole region (used only where the 15 cm set has no sheet)

Only the colours derived from the pictures go into the repo's data; the pictures stay in the cache folder, which must be outside the repo.

    tools/.venv/bin/python -I tools/orthophoto_fetch.py plan  --cache CACHE_ROOT
    tools/.venv/bin/python -I tools/orthophoto_fetch.py fetch --cache CACHE_ROOT --batch NAME [--near X,Z --radius M] [--limit N] [--svc 15|25] [--every N]

CACHE_ROOT holds one folder per download batch (NAME, created by `fetch`, must not exist yet) plus coverage_15cm.json. A block that is already
in any batch folder is not downloaded again, so an interrupted run can simply be repeated with a new NAME.

The picture is cut into square blocks of the UTM 33N grid (EPSG:25833, the source's own projection, so nothing is resampled twice):
BLOCK metres of core plus PAD metres on every side, 0.25 m per pixel, JPEG. Requests are made by a few threads with a pause between starts.
Downloads are untrusted data: orthophoto_colours.py reads them with -I and never executes anything from them.
"""
import argparse
import json
import math
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from pyproj import Transformer
from shapely import contains_xy
from shapely.geometry import Polygon
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
from bake import KX, KZ, LAT0, LON0  # noqa: E402

UA = "palermo-drive-prototype/0.1 (orthophoto colours; few threads, cached; Regione Siciliana CC BY 4.0 data)"
REST = "https://map.sitr.regione.sicilia.it/gis/rest/services/ortofoto"
SERVICES = {"15": "ortofoto_2013_15cm_comuni", "25": "ortofoto_2013_25cm_sicilia"}
EPSG = 25833
BLOCK = 512.0        # metres of core per block (cells and buildings belong to the block holding their centre)
PAD = 48.0           # metres of picture beyond the core on every side, so footprints that cross a border are still whole
RES = 0.25           # metres per pixel
NPX = int(round((BLOCK + 2 * PAD) / RES))   # 2432 px, under the service limit of 4096
DEFAULT_BBOX = (38.045, 13.235, 38.230, 13.455)  # s, w, n, e, same as tools/tiles.py

_to_utm = Transformer.from_crs(4326, EPSG, always_xy=True)


def local_to_utm(x, z):
    """Game metres (x east, z south, origin Quattro Canti) to UTM 33N (E, N); arrays or scalars."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    return _to_utm.transform(LON0 + x / KX, LAT0 - z / KZ)


def block_core(bi, bj):
    return bi * BLOCK, bj * BLOCK, (bi + 1) * BLOCK, (bj + 1) * BLOCK  # E0, N0, E1, N1


def block_bbox(bi, bj):
    e0, n0, e1, n1 = block_core(bi, bj)
    return e0 - PAD, n0 - PAD, e1 + PAD, n1 + PAD


def block_name(svc, bi, bj):
    return f"{svc}_{bi}_{bj}.jpg"


def find_block(cache, svc, bi, bj):
    """Path of a downloaded block in any batch folder under `cache`, else None."""
    name = block_name(svc, bi, bj)
    for d in sorted(os.listdir(cache)):
        p = os.path.join(cache, d, name)
        if os.path.isfile(p):
            return p
    return None


# ----------------------------------------------------------------------------------------------
# What to fetch
# ----------------------------------------------------------------------------------------------
def http(url, tries=5):
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read(), r.headers.get("Content-Type", "")
        except (urllib.error.URLError, OSError) as e:
            last = e
            time.sleep(min(60, 4 * 3 ** a))
    raise RuntimeError(f"giving up on {url[-100:]}: {last}")


def coverage_15(cache):
    """Union polygon (lon, lat) of the 15 cm sheets (ATA1213_PAL-*), cached as coverage_15cm.json in the cache root."""
    p = os.path.join(cache, "coverage_15cm.json")
    if not os.path.exists(p):
        q = urllib.parse.urlencode({"where": "Name LIKE '%PAL%'", "outFields": "Name", "returnGeometry": "true", "outSR": 4326,
                                    "geometryPrecision": 5, "f": "json"})
        body, _ = http(f"{REST}/{SERVICES['15']}/MapServer/0/query?{q}")
        d = json.loads(body)
        if not d.get("features") or d.get("exceededTransferLimit"):
            sys.exit("unexpected answer from the 15 cm footprint layer")
        with open(p, "w") as f:
            json.dump(d, f)
    d = json.load(open(p))
    return unary_union([Polygon(f["geometry"]["rings"][0]) for f in d["features"]])


def load_centroids(world):
    """(ids, x, z) of every baked building (centroid of its outline), read from world/tiles/*.json."""
    ids, xs, zs = [], [], []
    tdir = os.path.join(world, "tiles")
    for fn in sorted(os.listdir(tdir)):
        if not fn.endswith(".json"):
            continue
        for b in json.load(open(os.path.join(tdir, fn)))["buildings"]:
            p = np.asarray(b["p"], float).reshape(-1, 2)
            ids.append(b["id"])
            xs.append(p[:, 0].mean())
            zs.append(p[:, 1].mean())
    return ids, np.array(xs), np.array(zs)


def plan_blocks(world, cache):
    """{(svc, bi, bj): building count}: the 15 cm set where it has a sheet under the building, else the 25 cm set."""
    ids, x, z = load_centroids(world)
    lon, lat = LON0 + x / KX, LAT0 - z / KZ
    in15 = contains_xy(coverage_15(cache), lon, lat)
    e, n = local_to_utm(x, z)
    bi, bj = np.floor(e / BLOCK).astype(int), np.floor(n / BLOCK).astype(int)
    out = {}
    for s, i, j in zip(np.where(in15, "15", "25"), bi, bj):
        out[(str(s), int(i), int(j))] = out.get((str(s), int(i), int(j)), 0) + 1
    return out, len(ids), int(in15.sum())


# ----------------------------------------------------------------------------------------------
# Download
# ----------------------------------------------------------------------------------------------
def fetch_block(svc, bi, bj, dest):
    e0, n0, e1, n1 = block_bbox(bi, bj)
    q = urllib.parse.urlencode({"bbox": f"{e0},{n0},{e1},{n1}", "bboxSR": EPSG, "imageSR": EPSG, "size": f"{NPX},{NPX}",
                                "format": "jpg", "transparent": "false", "f": "image"})
    body, ctype = http(f"{REST}/{SERVICES[svc]}/MapServer/export?{q}")
    if not ctype.startswith("image/") or len(body) < 20000:
        raise RuntimeError(f"not a picture ({ctype}, {len(body)} bytes): {body[:120]!r}")
    tmp = dest + ".part"
    with open(tmp, "wb") as f:
        f.write(body)
    os.replace(tmp, dest)
    return len(body)


def cmd_plan(a):
    blocks, total, n15 = plan_blocks(a.world, a.cache)
    have = sum(1 for (s, i, j) in blocks if find_block(a.cache, s, i, j))
    print(f"{total} buildings, {n15} under a 15 cm sheet, {total - n15} left to the 25 cm set")
    print(f"{len(blocks)} blocks of {BLOCK:.0f} m ({sum(1 for k in blocks if k[0] == '15')} at 15 cm, "
          f"{sum(1 for k in blocks if k[0] == '25')} at 25 cm); {have} already in the cache")
    print(f"about {len(blocks) * 2.2 / 1000:.1f} GB for the missing ones at ~2 MB per block")


def cmd_fetch(a):
    batch = os.path.join(a.cache, a.batch)
    if os.path.exists(batch):
        sys.exit(f"{batch} exists: every download batch goes into its own new folder")
    blocks, _, _ = plan_blocks(a.world, a.cache)
    if a.svc:  # same blocks from the other service, for cross-checking a sample (a separate cache root, not the one the colours are made from)
        blocks = {(a.svc, k[1], k[2]): n for k, n in blocks.items()}
    todo = [k for k in blocks if not find_block(a.cache, *k)]
    if a.near:
        nx, nz = map(float, a.near.split(","))
        ne, nn = local_to_utm(nx, nz)
        todo = [k for k in todo if math.hypot((k[1] + .5) * BLOCK - ne, (k[2] + .5) * BLOCK - nn) <= a.radius]
    if a.every > 1:  # an even spread over the city for the colour calibration (orthophoto_colours.py calibrate)
        todo = sorted(todo, key=lambda k: (k[1], k[2]))[::a.every]
    # centro first, so a partial run is still usable where it matters
    ce, cn = local_to_utm(0.0, 0.0)
    todo.sort(key=lambda k: math.hypot((k[1] + .5) * BLOCK - ce, (k[2] + .5) * BLOCK - cn))
    if a.limit:
        todo = todo[:a.limit]
    os.makedirs(batch)
    print(f"{len(todo)} blocks into {batch}")
    lock, state = threading.Lock(), {"n": 0, "bytes": 0, "fail": 0}
    gate = threading.Lock()

    def one(k):
        with gate:
            time.sleep(a.delay)  # starts are spaced out, downloads overlap
        svc, bi, bj = k
        try:
            nb = fetch_block(svc, bi, bj, os.path.join(batch, block_name(svc, bi, bj)))
        except Exception as e:  # noqa: BLE001 (report and carry on; a repeat run picks the block up)
            with lock:
                state["fail"] += 1
            print(f"  FAILED {k}: {e}")
            return
        with lock:
            state["n"] += 1
            state["bytes"] += nb
            if state["n"] % 10 == 0 or state["n"] == len(todo):
                print(f"  {state['n']}/{len(todo)} blocks, {state['bytes'] / 1e6:.0f} MB, {state['fail']} failed")

    with ThreadPoolExecutor(a.workers) as ex:
        list(ex.map(one, todo))
    print(f"done: {state['n']} downloaded, {state['fail']} failed")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=("plan", "fetch"))
    ap.add_argument("--cache", required=True, help="cache root outside the repo, e.g. /private/tmp/claude-501/palermo-prep-colours/cache")
    ap.add_argument("--world", default=os.path.join(ROOT, "world"))
    ap.add_argument("--batch", help="fetch: name of the new batch folder inside the cache")
    ap.add_argument("--near", help="fetch: only blocks within --radius metres of this game x,z")
    ap.add_argument("--radius", type=float, default=1500)
    ap.add_argument("--svc", choices=sorted(SERVICES), help="fetch: take every planned block from this service (cross-checks only)")
    ap.add_argument("--every", type=int, default=1, help="fetch: only every Nth planned block (sorted by position)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--delay", type=float, default=0.4, help="seconds between request starts")
    a = ap.parse_args()
    if (os.path.abspath(a.cache) + os.sep).startswith(ROOT + os.sep):
        sys.exit("the cache must be outside the repo (no imagery in the repo)")
    os.makedirs(a.cache, exist_ok=True)
    if a.cmd == "fetch" and not a.batch:
        sys.exit("fetch needs --batch NAME")
    {"plan": cmd_plan, "fetch": cmd_fetch}[a.cmd](a)


if __name__ == "__main__":
    main()
