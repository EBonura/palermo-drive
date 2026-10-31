"""Dense lidar rasters (DTM + DSM last return, 2 m) for the whole-city bbox of docs/TILES.md.

Source: Ministero dell'Ambiente (MASE), Geoportale Nazionale, PST-A lidar, Regione Sicilia,
CC BY 4.0 (attribution: "Ministero dell'Ambiente e della Sicurezza Energetica, PST-A lidar").

The WMS only serves *rendered* images, so elevations are decoded from the picture:

* The layer is drawn with a fixed 8-bit colour ramp ("stretched value" s, elevation ~= 0.8066*s - 1.74 m,
  s clipped at 255 so anything above ~204 m saturates) and then, since the Oct 2026 server change,
  blended with a hillshade that adds the *same* integer to R, G and B of every pixel.
  The chroma (G-R, B-R) therefore depends on s only. data/lidar_raster/ramp_lut.json maps chroma ->
  elevation; it is calibrated once against GetFeatureInfo (`calibrate`).
* Resolution of the decode is that of the ramp (about 1 colour per 1.4 stretch levels, ~1 m).
* We request EPSG:4326 images whose bbox is exactly an axis-aligned rectangle of the game's local
  metre frame (the local projection is linear in lat/lon), 2 m per pixel, so sampling is a plain
  array lookup in (x, z).

Layout (all under data/lidar_raster/):
  raw/<dtm|dsm>/<bi>_<bj>.png   the server's RGBA PNG, cached, resumable (alpha 0 = no data)
  <dtm|dsm>/<bi>_<bj>.npz       decoded: e (int16 decimetres, -32768 = no data), f (uint8 flags)
  ramp_lut.json                 chroma -> elevation table
  index.json                    block list, coverage stats, attribution
Blocks are BLOCK = 2000 m squares on the world grid (4 x 4 tiles of 500 m): block (bi, bj) covers
x in [bi*2000, (bi+1)*2000), z in [bj*2000, (bj+1)*2000), 1000 x 1000 px, row 0 = north edge.

Library use (run with tools/.venv/bin/python):
    import lidar_raster as lr
    lr.sample_dtm(x, z); lr.sample_dsm(x, z)      # scalars or numpy arrays, NaN = no data
    lr.sample_ndsm(x, z)                          # dsm - dtm, i.e. height above ground

CLI (python3 tools/lidar_raster.py <cmd>):
    fetch [--layers dtm dsm] [--delay 1.0]   download missing raw blocks (sequential, resumable)
    calibrate [--per 3]                      (re)build ramp_lut.json against GetFeatureInfo
    build                                    decode raw -> npz, write index.json
    coverage [out.png]                       coverage map
    validate [--fresh 20] [--seed 1]         compare with GetFeatureInfo and with data/lidar.json
"""
import io
import json
import math
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "lidar_raster")
WMS = "http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/servizi-LiDAR/LIDAR_SICILIA.map&service=WMS&version=1.3.0"
UA = "palermo-drive-prototype/0.1 (lidar_raster; sequential, cached; CC BY 4.0 data)"
LAYERS = {"dtm": "EL.LIDAR.SICILIA.2x2.DTM", "dsm": "EL.LIDAR.SICILIA.2x2.DSM_LAST"}

# docs/TILES.md whole-city bbox
CITY_BBOX = (38.065, 13.285, 38.225, 13.420)  # s, w, n, e
PX = 2.0           # metres per pixel (native lidar resolution)
NPX = 1000         # pixels per block side
BLOCK = PX * NPX   # 2000 m
NODATA = -32768
SAT_M = 204.0      # the 8-bit stretch saturates here: values at s == 255 are only "at least ~204 m"
# flag bits in the decoded f array
F_SAT, F_NEAREST, F_CLAMP = 1, 2, 4  # saturated ramp, chroma not in LUT (nearest used), a channel hit 0


def city_rect():
    s, w, n, e = CITY_BBOX
    return ((w - LON0) * KX, (e - LON0) * KX, -(n - LAT0) * KZ, -(s - LAT0) * KZ)  # x0, x1, z0, z1


def block_list():
    x0, x1, z0, z1 = city_rect()
    return [(bi, bj) for bj in range(math.floor(z0 / BLOCK), math.floor(z1 / BLOCK) + 1)
            for bi in range(math.floor(x0 / BLOCK), math.floor(x1 / BLOCK) + 1)]


def block_bbox(bi, bj):
    """WMS 1.3.0 EPSG:4326 bbox (minlat, minlon, maxlat, maxlon) of a block."""
    x0, z0 = bi * BLOCK, bj * BLOCK
    return (LAT0 - (z0 + BLOCK) / KZ, LON0 + x0 / KX, LAT0 - z0 / KZ, LON0 + (x0 + BLOCK) / KX)


# ----------------------------------------------------------------------------- http

def _http(url, tries=6):
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=120).read()
        except (urllib.error.URLError, OSError) as e:  # includes 5xx and timeouts
            last = e
            time.sleep(min(120, 5 * 3 ** a))  # 5, 15, 45, 120 s ...: the service has maintenance windows
    raise RuntimeError(f"giving up on {url[-120:]}: {last}")


def getmap(layer, bbox, w, h):
    bb = ",".join(f"{v:.8f}" for v in bbox)
    return _http(f"{WMS}&request=GetMap&layers={layer}&styles=&crs=EPSG:4326&bbox={bb}&width={w}&height={h}&format=image/png")


_VAL = re.compile(r"@(\d+) Stretched value;Pixel Value; *(\d+);([-\d.]+)")


def gfi(layer, bbox, w, h, i, j):
    """(stretched, elevation) of the source pixel under pixel (i, j) of a w x h request, None if no data."""
    bb = ",".join(f"{v:.8f}" for v in bbox)
    url = (f"{WMS}&request=GetFeatureInfo&layers={layer}&query_layers={layer}&styles=&crs=EPSG:4326"
           f"&bbox={bb}&width={w}&height={h}&I={i}&J={j}&info_format=text/plain")
    txt = _http(url).decode("latin-1")
    m = _VAL.findall(txt)
    if not m:
        return None
    k, s, v = m[-1]  # last band is the elevation (the first one is the mosaic "objectid;count" row)
    return int(s), float(v)


def gfi_point(layer, lat, lon):
    d = 0.00005
    return gfi(layer, (lat - d, lon - d, lat + d, lon + d), 11, 11, 5, 5)


def xz_to_latlon(x, z):
    return LAT0 - z / KZ, LON0 + x / KX


# ----------------------------------------------------------------------------- fetch

def raw_path(layer, bi, bj):
    return os.path.join(ROOT, "raw", layer, f"{bi}_{bj}.png")


def fetch(layers=("dtm", "dsm"), delay=1.0):
    blocks = block_list()
    todo = [(l, b) for l in layers for b in blocks if not os.path.exists(raw_path(l, *b))]
    print(f"{len(blocks)} blocks x {len(layers)} layers, {len(todo)} requests to make", flush=True)
    t0 = time.time()
    for n, (layer, (bi, bj)) in enumerate(todo, 1):
        raw = getmap(LAYERS[layer], block_bbox(bi, bj), NPX, NPX)
        Image.open(io.BytesIO(raw)).verify()  # an error page raises here and the block stays missing
        p = raw_path(layer, bi, bj)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p + ".part", "wb") as f:
            f.write(raw)
        os.replace(p + ".part", p)
        print(f"  [{n}/{len(todo)}] {layer} {bi},{bj} {len(raw) // 1024} KB  ({time.time() - t0:.0f}s)", flush=True)
        time.sleep(delay)


# ----------------------------------------------------------------------------- decode

def _load_rgba(path):
    return np.array(Image.open(path).convert("RGBA"))


def _chroma(rgb):
    r = rgb[..., 0].astype(np.int16)
    return rgb[..., 1].astype(np.int16) - r, rgb[..., 2].astype(np.int16) - r


def _key(gr, br):
    return (gr.astype(np.int32) + 128) * 256 + (br.astype(np.int32) + 128)


class Lut:
    def __init__(self, path=os.path.join(ROOT, "ramp_lut.json")):
        d = json.load(open(path))
        self.keys, self.elev, self.sat = [], [], []
        for k, (e, sat) in d["chroma"].items():
            gr, br = (int(v) for v in k.split(","))
            self.keys.append((gr, br))
            self.elev.append(e)
            self.sat.append(sat)
        self.keys = np.array(self.keys)
        self.elev = np.array(self.elev, dtype=np.float32)
        self.sat = np.array(self.sat, dtype=bool)
        self.index = {(int(g), int(b)): i for i, (g, b) in enumerate(self.keys)}

    def lookup(self, gr, br):
        """-> elevation, flags for unique chroma arrays (nearest known chroma if absent)."""
        e = np.empty(len(gr), np.float32)
        f = np.zeros(len(gr), np.uint8)
        for n, (g, b) in enumerate(zip(gr.tolist(), br.tolist())):
            i = self.index.get((g, b))
            if i is None:
                i = int(np.argmin((self.keys[:, 0] - g) ** 2 + (self.keys[:, 1] - b) ** 2))
                f[n] |= F_NEAREST
            e[n] = SAT_M if self.sat[i] else self.elev[i]
            if self.sat[i]:
                f[n] |= F_SAT
        return e, f


def decode(rgba, lut):
    """RGBA image -> (int16 decimetres, uint8 flags)."""
    valid = rgba[..., 3] > 0
    out = np.full(valid.shape, NODATA, np.int16)
    flags = np.zeros(valid.shape, np.uint8)
    if not valid.any():
        return out, flags
    rgb = rgba[..., :3]
    gr, br = _chroma(rgb)
    keys = _key(gr, br)[valid]
    uk, inv = np.unique(keys, return_inverse=True)
    ugr, ubr = (uk // 256) - 128, (uk % 256) - 128
    ue, uf = lut.lookup(ugr, ubr)
    out[valid] = np.round(ue[inv] * 10).astype(np.int16)
    fl = uf[inv]
    fl = fl | np.where(rgb[valid].min(axis=1) == 0, F_CLAMP, 0).astype(np.uint8)
    flags[valid] = fl
    return out, flags


def build():
    lut = Lut()
    index = {"blocks": {}, "block_m": BLOCK, "px_m": PX, "npx": NPX,
             "attribution": "Ministero dell'Ambiente e della Sicurezza Energetica, Geoportale Nazionale, PST-A lidar "
                            "Regione Sicilia, CC BY 4.0",
             "city_bbox_latlon": CITY_BBOX}
    for layer in LAYERS:
        d = os.path.join(ROOT, "raw", layer)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".png"):
                continue
            bi, bj = (int(v) for v in fn[:-4].split("_"))
            e, f = decode(_load_rgba(os.path.join(d, fn)), lut)
            nvalid = int((e != NODATA).sum())
            index["blocks"].setdefault(f"{bi}_{bj}", {})[layer] = nvalid
            if nvalid:
                od = os.path.join(ROOT, layer)
                os.makedirs(od, exist_ok=True)
                np.savez_compressed(os.path.join(od, f"{bi}_{bj}.npz"), e=e, f=f)
            else:
                p = os.path.join(ROOT, layer, f"{bi}_{bj}.npz")
                if os.path.exists(p):
                    os.remove(p)
            print(f"{layer} {bi},{bj}: {nvalid / NPX ** 2:.0%} valid", flush=True)
    json.dump(index, open(os.path.join(ROOT, "index.json"), "w"), indent=1)
    _RASTERS.clear()


# ----------------------------------------------------------------------------- calibrate

def calibrate(per=3, seed=1):
    """Pick cached DTM blocks that between them show every chroma, ask GetFeatureInfo for `per` pixels of each
    chroma, and store the median elevation per chroma."""
    rnd = random.Random(seed)
    imgs = {}
    for fn in sorted(os.listdir(os.path.join(ROOT, "raw", "dtm"))):
        if fn.endswith(".png"):
            a = _load_rgba(os.path.join(ROOT, "raw", "dtm", fn))
            if (a[..., 3] > 0).any():
                imgs[tuple(int(v) for v in fn[:-4].split("_"))] = a
    chroma_of = {}
    for b, a in imgs.items():
        v = a[..., 3] > 0
        gr, br = _chroma(a[..., :3])
        chroma_of[b] = _key(gr, br)[v]
    cover, chosen = set(), []
    while True:  # greedy: blocks that add the most unseen chroma
        best = max(imgs, key=lambda b: len(set(np.unique(chroma_of[b]).tolist()) - cover), default=None)
        if best is None:
            break
        new = set(np.unique(chroma_of[best]).tolist()) - cover
        if not new:
            break
        cover |= new
        chosen.append(best)
    print(f"calibrating on blocks {chosen}: {len(cover)} chroma values", flush=True)
    samples = {}  # key -> [(s, elev)]
    for key in sorted(cover):
        cands = []
        for b in chosen:
            a = imgs[b]
            v = a[..., 3] > 0
            gr, br = _chroma(a[..., :3])
            ys, xs = np.nonzero(v & (_key(gr, br) == key) & (a[..., :3].min(axis=2) > 0))
            cands += [(b, int(y), int(x)) for y, x in zip(ys, xs)]
        for b, y, x in rnd.sample(cands, min(per, len(cands))):
            r = gfi(LAYERS["dtm"], block_bbox(*b), NPX, NPX, x, y)
            if r:
                samples.setdefault(key, []).append(r)
            time.sleep(0.3)
    lut = {}
    for key, l in samples.items():
        s = np.array([a for a, _ in l])
        e = np.array([v for _, v in l])
        lut[f"{key // 256 - 128},{key % 256 - 128}"] = [round(float(np.median(e)), 2), bool(np.median(s) >= 255)]
    os.makedirs(ROOT, exist_ok=True)
    json.dump({"note": "chroma (G-R,B-R) -> [median elevation m, saturated]", "chroma": lut},
              open(os.path.join(ROOT, "ramp_lut.json"), "w"))
    print(f"wrote ramp_lut.json with {len(lut)} chroma values", flush=True)


# ----------------------------------------------------------------------------- sampling

class _Layer:
    def __init__(self, name):
        self.name = name
        self.blocks = {}

    def block(self, bi, bj):
        k = (bi, bj)
        if k not in self.blocks:
            p = os.path.join(ROOT, self.name, f"{bi}_{bj}.npz")
            if os.path.exists(p):
                z = np.load(p)
                self.blocks[k] = (z["e"], z["f"])
            else:
                self.blocks[k] = None
        return self.blocks[k]

    def pixels(self, gi, gj, flags=False):
        """Values (metres, NaN = none) at global pixel indices (gi, gj) (int arrays)."""
        gi, gj = np.asarray(gi), np.asarray(gj)
        out = np.full(gi.shape, np.nan, np.float32)
        fl = np.zeros(gi.shape, np.uint8)
        bi, bj = gi // NPX, gj // NPX
        pairs = np.unique(np.stack([bi.ravel(), bj.ravel()], 1), axis=0)
        for a, b in pairs:
            blk = self.block(int(a), int(b))
            if blk is None:
                continue
            m = (bi == a) & (bj == b)
            e = blk[0][gj[m] - b * NPX, gi[m] - a * NPX]
            out[m] = np.where(e == NODATA, np.nan, e / 10.0)
            fl[m] = blk[1][gj[m] - b * NPX, gi[m] - a * NPX]
        return (out, fl) if flags else out

    def sample(self, x, z, method="nearest", flags=False):
        x, z = np.asarray(x, dtype=np.float64), np.asarray(z, dtype=np.float64)
        scalar = x.ndim == 0 and z.ndim == 0
        x, z = np.atleast_1d(x), np.atleast_1d(z)
        if method == "nearest":
            r = self.pixels(np.floor(x / PX).astype(np.int64), np.floor(z / PX).astype(np.int64), flags)
        else:  # bilinear between pixel centres, renormalised over the valid neighbours
            fx, fz = x / PX - 0.5, z / PX - 0.5
            i0, j0 = np.floor(fx).astype(np.int64), np.floor(fz).astype(np.int64)
            tx, tz = fx - i0, fz - j0
            acc = np.zeros(x.shape)
            wsum = np.zeros(x.shape)
            for di, dj, wgt in ((0, 0, (1 - tx) * (1 - tz)), (1, 0, tx * (1 - tz)), (0, 1, (1 - tx) * tz), (1, 1, tx * tz)):
                v = self.pixels(i0 + di, j0 + dj)
                ok = ~np.isnan(v)
                acc += np.where(ok, v * wgt, 0)
                wsum += np.where(ok, wgt, 0)
            r = np.where(wsum > 0, acc / np.where(wsum > 0, wsum, 1), np.nan).astype(np.float32)
            if flags:
                r = (r, self.pixels(np.floor(x / PX).astype(np.int64), np.floor(z / PX).astype(np.int64), True)[1])
        if scalar:
            return (float(r[0][0]), int(r[1][0])) if flags else float(r[0])
        return r


_RASTERS = {}


def _layer(name):
    if name not in _RASTERS:
        _RASTERS[name] = _Layer(name)
    return _RASTERS[name]


def sample_dtm(x, z, method="nearest", flags=False):
    """Ground elevation (m above sea level) at local metres (x east, z south). NaN where there is no data.
    method 'bilinear' suits the (smooth) terrain; flags=True also returns the F_* bit field."""
    return _layer("dtm").sample(x, z, method, flags)


def sample_dsm(x, z, method="nearest", flags=False):
    """Surface (last return: roofs, canopy) elevation in metres. Use 'nearest' to keep roof edges sharp."""
    return _layer("dsm").sample(x, z, method, flags)


def sample_ndsm(x, z):
    """Height of whatever stands on the ground (dsm - dtm), clipped at 0; NaN where either is missing."""
    return np.maximum(_layer("dsm").sample(x, z) - _layer("dtm").sample(x, z), 0)


# ----------------------------------------------------------------------------- coverage map

def coverage(out):
    x0, x1, z0, z1 = city_rect()
    scale = 0.05  # px per m (20 m per pixel)
    bis = [b[0] for b in block_list()]
    bjs = [b[1] for b in block_list()]
    gx0, gz0 = min(bis) * BLOCK, min(bjs) * BLOCK
    W, H = int((max(bis) + 1) * BLOCK * scale - gx0 * scale), int((max(bjs) + 1) * BLOCK * scale - gz0 * scale)
    img = np.zeros((H, W, 3), np.uint8)
    img[:] = (24, 26, 30)
    step = int(round(1 / scale))  # decimate to 20 m
    for (bi, bj) in block_list():
        for name, col in (("dsm", (70, 150, 220)), ("dtm", (90, 200, 120))):
            blk = _layer(name).block(bi, bj)
            if blk is None:
                continue
            e = blk[0][::10, ::10] != NODATA  # 20 m grid
            y0 = int((bj * BLOCK - gz0) * scale)
            xx0 = int((bi * BLOCK - gx0) * scale)
            sub = img[y0:y0 + e.shape[0], xx0:xx0 + e.shape[1]]
            if name == "dtm":
                sub[e] = col
            else:  # blue where DSM exists but DTM does not, grey-blue mix where both
                both = e & (sub == col).all(axis=2)
                sub[e & ~both] = col
                sub[both] = (60, 190, 190)
    # the city bbox, tile grid, block grid, Quattro Canti
    from PIL import ImageDraw
    im = Image.fromarray(img)
    dr = ImageDraw.Draw(im)
    P = lambda x, z: ((x - gx0) * scale, (z - gz0) * scale)
    for bi, bj in block_list():
        dr.rectangle([*P(bi * BLOCK, bj * BLOCK), *P((bi + 1) * BLOCK, (bj + 1) * BLOCK)], outline=(90, 90, 100))
        dr.text(P(bi * BLOCK + 40, bj * BLOCK + 40), f"{bi},{bj}", fill=(150, 150, 160))
    dr.rectangle([*P(x0, z0), *P(x1, z1)], outline=(255, 200, 60), width=2)
    qx, qz = P(0, 0)
    dr.ellipse([qx - 4, qz - 4, qx + 4, qz + 4], outline=(255, 80, 80), width=2)
    dr.text((qx + 6, qz - 6), "Quattro Canti", fill=(255, 120, 120))
    dr.text((6, 4), "green = DTM+? / cyan = DTM and DSM / blue = DSM only; yellow = TILES.md bbox; blocks 2000 m",
            fill=(220, 220, 220))
    im.save(out)
    print("wrote", out, im.size)


# ----------------------------------------------------------------------------- validation

def _stats(name, err):
    err = np.asarray([e for e in err if e is not None and not np.isnan(e)])
    if not len(err):
        print(f"{name}: no samples")
        return
    a = np.abs(err)
    print(f"{name}: n={len(err)} bias={err.mean():+.2f} m  rmse={np.sqrt((err ** 2).mean()):.2f} m  "
          f"MAE={a.mean():.2f}  p50={np.percentile(a, 50):.2f} p90={np.percentile(a, 90):.2f} "
          f"p95={np.percentile(a, 95):.2f} p99={np.percentile(a, 99):.2f} max={a.max():.2f}")


def validate(fresh=20, seed=1):
    rnd = random.Random(seed)
    # 1. fresh GetFeatureInfo points, 10 anywhere with data and 10 where nDSM > 4 m (roofs / trees)
    cands = []
    for (bi, bj) in block_list():
        a, b = _layer("dtm").block(bi, bj), _layer("dsm").block(bi, bj)
        if a is None or b is None:
            continue
        both = (a[0] != NODATA) & (b[0] != NODATA) & (a[1] & F_SAT == 0)
        ys, xs = np.nonzero(both)
        if len(ys):
            sel = rnd.sample(range(len(ys)), min(400, len(ys)))
            cands += [(bi * NPX + int(xs[k]), bj * NPX + int(ys[k])) for k in sel]
    rnd.shuffle(cands)
    pts = []
    for gi, gj in cands:  # pixel interior points, away from pixel edges
        x, z = (gi + 0.5) * PX, (gj + 0.5) * PX
        pts.append((x, z, float(sample_ndsm(x, z))))
    low = [p for p in pts if p[2] < 1.5][:fresh // 2]
    high = [p for p in pts if p[2] > 4][:fresh - len(low)]
    print(f"--- {len(low) + len(high)} fresh GetFeatureInfo points ({len(low)} ground-level, {len(high)} raised)")
    e_dtm, e_dsm, e_h = [], [], []
    for x, z, nd in low + high:
        lat, lon = xz_to_latlon(x, z)
        g, s = gfi_point(LAYERS["dtm"], lat, lon), gfi_point(LAYERS["dsm"], lat, lon)
        time.sleep(0.4)
        if not g or not s:
            continue
        rd, rs = sample_dtm(x, z), sample_dsm(x, z)
        e_dtm.append(rd - g[1])
        e_dsm.append(rs - s[1])
        e_h.append((rs - rd) - (s[1] - g[1]))
        print(f"  ({x:8.1f},{z:8.1f}) dtm {g[1]:7.2f} vs {rd:7.2f}   dsm {s[1]:7.2f} vs {rs:7.2f}   height {s[1] - g[1]:6.2f} vs {rs - rd:6.2f}")
    _stats("DTM err", e_dtm)
    _stats("DSM err", e_dsm)
    _stats("height (dsm-dtm) err", e_h)
    # 2. the lead's earlier per-point GetFeatureInfo samples (free, no requests)
    lj = os.path.join(os.path.dirname(ROOT), "lidar.json")
    if os.path.exists(lj):
        import lidar
        jobs = lidar.building_jobs(os.path.join(os.path.dirname(ROOT), "osm.json"))
        d = json.load(open(lj))["b"]
        xs, zs, g, s = [], [], [], []
        for k, p in jobs.items():
            r = d.get(k)
            if r and len(r) == len(p):
                for (x, z), v in zip(p, r):
                    if isinstance(v, list):
                        xs.append(x)
                        zs.append(z)
                        g.append(v[0])
                        s.append(v[1])
        xs, zs, g, s = map(np.array, (xs, zs, g, s))
        rd, rs = sample_dtm(xs, zs), sample_dsm(xs, zs)
        m = ~np.isnan(rd) & ~np.isnan(rs)
        print(f"--- {m.sum()} of {len(xs)} building points in data/lidar.json have raster data")
        _stats("DTM err (nearest)", (rd - g)[m])
        _stats("DTM err (bilinear)", (sample_dtm(xs, zs, "bilinear") - g)[m])
        _stats("DSM err (nearest)", (rs - s)[m])
        _stats("height err", ((rs - rd) - (s - g))[m])
        print(f"    true height: mean {np.mean((s - g)[m]):.1f} m, p10/p50/p90 = "
              f"{np.percentile((s - g)[m], 10):.1f}/{np.percentile((s - g)[m], 50):.1f}/{np.percentile((s - g)[m], 90):.1f}")


if __name__ == "__main__":
    ap = sys.argv[1:]
    cmd = ap[0] if ap else "help"
    arg = lambda name, default: type(default)(ap[ap.index(name) + 1]) if name in ap else default
    if cmd == "fetch":
        ls = [l for l in ("dtm", "dsm") if l in ap] or ["dtm", "dsm"]
        fetch(ls, arg("--delay", 1.0))
    elif cmd == "calibrate":
        calibrate(arg("--per", 3))
    elif cmd == "build":
        build()
    elif cmd == "coverage":
        coverage(ap[1] if len(ap) > 1 else os.path.join(ROOT, "coverage.png"))
    elif cmd == "validate":
        validate(arg("--fresh", 20), arg("--seed", 1))
    else:
        print(__doc__)
