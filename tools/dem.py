"""TINITALY 1.1 10 m DEM for the hills of the whole-city bbox (Monte Pellegrino and friends).

Source: INGV, TINITALY/01 (v1.1) digital elevation model of Italy, 10 m cells, UTM WGS84 zone 32N (EPSG:32632),
CC BY 4.0. Attribution: "TINITALY 1.1, INGV (Tarquini et al.), CC BY 4.0, https://doi.org/10.13127/tinitaly/1.1".
Served by INGV's WCS 2.0.1 (GeoServer); one GetCoverage request returns the whole city bbox as a float32 GeoTIFF.

Why: the lidar rasters (tools/lidar_raster.py) are decoded from a rendered picture whose 8-bit ramp saturates at ~204 m and
is only a few metres accurate above ~100 m, so Monte Pellegrino (to 606 m) fell back on the 100 m far grid.

Files (data/dem_tinitaly/, gitignored): tin_raw.tif (float32, -9999 = sea / no data; window E 869400..892200, N 4218200..4242200 since t7).

    python3 -I tools/dem.py fetch      download tin_raw.tif (once, ~21 MB)
Library use (tools/.venv/bin/python -I): `import dem; dem.sample(x, z)` -> metres, NaN where the DEM has no data.
"""
import os
import sys
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bake import KX, KZ, LAT0, LON0  # noqa: E402

ROOT = os.path.join(os.path.dirname(HERE), "data", "dem_tinitaly")
RAW = os.path.join(ROOT, "tin_raw.tif")
WCS = "http://tinitaly.pi.ingv.it/TINItaly_1_1/wcs"
UA = "palermo-drive-tiles/0.1 (hobby three.js game; TINITALY CC BY 4.0)"
# UTM 32N window that covers the city bbox (the zone's grid is rotated ~2.7 deg against the local frame)
E0, E1, N0, N1 = 869400, 892200, 4218200, 4242200   # t7: the whole play area (every world tile plus 600 m); the first window (874000..890000, 4220000..4242000) left the western hills without a near grid
CREDIT = "TINITALY 1.1 DEM, INGV (Tarquini et al.), CC BY 4.0, doi:10.13127/tinitaly/1.1"
NODATA = -9999.0

_cache = {}


def fetch():
    os.makedirs(ROOT, exist_ok=True)
    if os.path.exists(RAW):
        print("already there:", RAW)
        return
    url = (f"{WCS}?service=WCS&version=2.0.1&request=GetCoverage&coverageId=TINItaly_1_1__tinitaly_dem"
           f"&format=image/tiff&subset=E({E0},{E1})&subset=N({N0},{N1})")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    raw = urllib.request.urlopen(req, timeout=300).read()
    if raw[:4] not in (b"MM\x00*", b"II*\x00"):
        raise SystemExit("not a TIFF: " + raw[:200].decode("latin-1"))
    with open(RAW + ".part", "wb") as f:
        f.write(raw)
    os.replace(RAW + ".part", RAW)
    print(f"{len(raw) / 1e6:.1f} MB -> {RAW}")


def _load():
    if "a" not in _cache:
        from PIL import Image
        from pyproj import Transformer
        im = Image.open(RAW)
        a = np.array(im, dtype=np.float32)
        t = im.tag_v2[34264]           # ModelTransformation: 10 0 0 E0 / 0 -10 0 N1 (pixel-is-area, corner origin)
        assert abs(t[0] - 10) < 1e-6 and abs(t[5] + 10) < 1e-6
        a[a <= -1000] = np.nan
        _cache.update(a=a, e0=t[3], n1=t[7], tf=Transformer.from_crs(4326, 32632, always_xy=True))
    return _cache


def sample(x, z):
    """Bilinear elevation at local metres (x, z); NaN where any of the 4 neighbours has no data or off the window."""
    c = _load()
    x, z = np.broadcast_arrays(np.asarray(x, dtype=np.float64), np.asarray(z, dtype=np.float64))
    e, n = c["tf"].transform(LON0 + x / KX, LAT0 - z / KZ)
    u = (np.asarray(e) - c["e0"]) / 10.0 - 0.5     # column coordinate of pixel centres
    v = (c["n1"] - np.asarray(n)) / 10.0 - 0.5
    a = c["a"]
    ok = (u >= 0) & (v >= 0) & (u < a.shape[1] - 1) & (v < a.shape[0] - 1)
    u0 = np.clip(np.floor(u).astype(int), 0, a.shape[1] - 2)
    v0 = np.clip(np.floor(v).astype(int), 0, a.shape[0] - 2)
    fu, fv = u - u0, v - v0
    h = (a[v0, u0] * (1 - fu) * (1 - fv) + a[v0, u0 + 1] * fu * (1 - fv)
         + a[v0 + 1, u0] * (1 - fu) * fv + a[v0 + 1, u0 + 1] * fu * fv)
    return np.where(ok, h, np.nan)


if __name__ == "__main__":
    if sys.argv[1:] == ["fetch"]:
        fetch()
    else:
        print(__doc__)
