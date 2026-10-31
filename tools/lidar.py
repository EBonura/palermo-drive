"""Sample the Regione Sicilia 2 m lidar (DTM + DSM last return) for the baked area.

Source: Ministero dell'Ambiente, Geoportale Nazionale, PST-A lidar, CC BY 4.0.
The WMS has no raw raster download, so we ask GetFeatureInfo one point at a
time: each answer carries the DTM (@3) and the DSM (@6) at that pixel.

Writes data/lidar.json: {"b": {osm_key: [[ground, surface], ...]}, "t": {"i,j": ground}}
The cache is resumable: rerunning only fetches what's missing.

Usage: python3 tools/lidar.py data/osm.json data/lidar.json [--test]
"""
import json
import math
import os
import re
import sys
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import BBOX, KX, KZ, LAT0, LON0, stitch  # noqa: E402

WMS = ("http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/servizi-LiDAR/LIDAR_SICILIA.map"
       "&service=WMS&version=1.3.0&request=GetFeatureInfo&layers=EL.LIDAR.SICILIA.2x2.DTM"
       "&query_layers=EL.LIDAR.SICILIA.2x2.DTM&styles=&crs=EPSG:4326&bbox={s},{w},{n},{e}"
       "&width=11&height=11&I=5&J=5&info_format=text/plain")
VAL = re.compile(r"@(\d+) Stretched value;Pixel Value; *\d+;([-\d.]+)")
WORKERS = 4
TERRAIN_STEP = 30  # metres between terrain samples
EDGE_CLEAR = 2.5   # sample points stay this far inside the footprint (lidar pixels are 2 m)


def unproj(x, z):
    return LAT0 - z / KZ, LON0 + x / KX


def query(lat, lon):
    d = 0.00005  # 11 px across ~10 m, centre pixel is the point
    url = WMS.format(s=lat - d, w=lon - d, n=lat + d, e=lon + d)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "palermo-drive-prototype/0.1"})
            txt = urllib.request.urlopen(req, timeout=60).read().decode("latin-1")
            vals = {int(k): float(v) for k, v in VAL.findall(txt)}
            if 3 not in vals:
                return None  # NoData: outside lidar coverage
            return [round(vals[3], 2), round(vals.get(6, vals[3]), 2)]
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return "err"


def seg_dist(px, pz, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dz * dz
    t = 0 if l2 == 0 else max(0, min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2))
    return math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t)


def clearance(p, rings):
    return min(seg_dist(p[0], p[1], r[i - 1], r[i]) for r in rings for i in range(len(r)))


def inside(rings, x, z):
    c = False
    for r in rings:
        for i in range(len(r)):
            (xi, zi), (xj, zj) = r[i], r[i - 1]
            if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
                c = not c
    return c


def sample_points(outer, holes):
    """Interior points well clear of the walls, spread across big footprints."""
    rings = [outer] + holes
    xs, zs = [p[0] for p in outer], [p[1] for p in outer]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    area = abs(sum(outer[i][0] * outer[i - 1][1] - outer[i - 1][0] * outer[i][1] for i in range(len(outer)))) / 2
    want = 1 if area < 150 else 3 if area < 600 else 5 if area < 2000 else 9
    step = max(1.0, min(x1 - x0, z1 - z0) / 12)
    cands = []
    z = z0 + step / 2
    while z < z1:
        x = x0 + step / 2
        while x < x1:
            if inside(rings, x, z):
                d = min(seg_dist(x, z, r[i - 1], r[i]) for r in rings for i in range(len(r)))
                cands.append((d, x, z))
            x += step
        z += step
    if not cands:
        return []
    cands.sort(reverse=True)
    if cands[0][0] < 1.0:
        return [cands[0][1:]]  # sliver: best we can do
    good = [c for c in cands if c[0] >= min(EDGE_CLEAR, cands[0][0] * 0.6)]
    # Greedy farthest-point picking so samples cover the footprint.
    picked = [good[0]]
    while len(picked) < want and len(picked) < len(good):
        nxt = max(good, key=lambda c: min(math.hypot(c[1] - p[1], c[2] - p[2]) for p in picked))
        if min(math.hypot(nxt[1] - p[1], nxt[2] - p[2]) for p in picked) < 4:
            break
        picked.append(nxt)
    return [(round(p[1], 1), round(p[2], 1)) for p in picked]


def building_jobs(osm):
    from bake import proj
    els = json.load(open(osm))["elements"]
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}

    def ring(nids):
        pts = [proj(*nodes[n]) for n in nids if n in nodes]
        return pts[:-1] if len(pts) > 1 and pts[0] == pts[-1] else pts

    jobs = {}
    for e in els:
        if e["type"] == "relation" and "building" in e.get("tags", {}):
            outers = [ways[m["ref"]]["nodes"] for m in e["members"] if m["role"] == "outer" and m["ref"] in ways]
            inners = [ring(r) for r in stitch([ways[m["ref"]]["nodes"] for m in e["members"]
                                               if m["role"] == "inner" and m["ref"] in ways])]
            for k, o in enumerate(stitch(outers)):
                jobs[f"r{e['id']}.{k}"] = sample_points(ring(o), inners)
    for w in ways.values():
        nids = w["nodes"]
        if "building" in w.get("tags", {}) and len(nids) > 3 and nids[0] == nids[-1]:
            jobs[f"w{w['id']}"] = sample_points(ring(nids), [])
    return jobs


def main(osm, out, test=False):
    cache = json.load(open(out)) if os.path.exists(out) else {"b": {}, "t": {}}
    lock = threading.Lock()
    todo = []

    if test:
        # Streets should read ~0 m above ground, building interiors well above.
        from bake import proj
        els = json.load(open(osm))["elements"]
        nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
        streets = [w for w in els if w["type"] == "way" and w.get("tags", {}).get("highway") in ("tertiary", "secondary", "primary")]
        pts = [nodes[w["nodes"][len(w["nodes"]) // 2]] for w in streets[:20] if w["nodes"][len(w["nodes"]) // 2] in nodes]
        jobs = building_jobs(osm)
        bpts = [unproj(*v[0]) for v in list(jobs.values())[::300] if v][:20]
        with ThreadPoolExecutor(WORKERS) as ex:
            s = list(ex.map(lambda p: query(*p), pts))
            b = list(ex.map(lambda p: query(*p), bpts))
        nd = lambda r: [round(x[1] - x[0], 1) for x in r if isinstance(x, list)]
        print("street nDSM:", nd(s))
        print("building nDSM:", nd(b))
        return

    for key, pts in building_jobs(osm).items():
        have = cache["b"].get(key)
        if have is None or len(have) != len(pts) or "err" in have:
            todo.append(("b", key, pts))
    s, w, n, e = BBOX
    from bake import proj
    x0, z1 = proj(s, w)
    x1, z0 = proj(n, e)
    for i in range(int((x1 - x0) // TERRAIN_STEP) + 1):
        for j in range(int((z1 - z0) // TERRAIN_STEP) + 1):
            k = f"{i},{j}"
            if cache["t"].get(k, "err") == "err":
                todo.append(("t", k, [(x0 + i * TERRAIN_STEP, z0 + j * TERRAIN_STEP)]))
    cache["tgrid"] = [x0, z0, TERRAIN_STEP]

    total = sum(len(p) for _, _, p in todo)
    print(f"{len(todo)} jobs, {total} queries")
    done = [0]

    def run(job):
        kind, key, pts = job
        res = [query(*unproj(x, z)) for x, z in pts]
        with lock:
            if kind == "b":
                cache["b"][key] = res
            else:
                r = res[0]
                cache["t"][key] = r if r in (None, "err") else r[0]
            done[0] += len(pts)
            if done[0] % 200 < len(pts):
                print(f"  {done[0]}/{total}", flush=True)
                json.dump(cache, open(out, "w"))

    with ThreadPoolExecutor(WORKERS) as ex:
        list(ex.map(run, todo))
    json.dump(cache, open(out, "w"))
    errs = sum(1 for v in cache["b"].values() for r in v if r == "err")
    print(f"done, {errs} failed queries (rerun to retry)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--test" in sys.argv)
