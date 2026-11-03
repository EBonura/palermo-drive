#!/usr/bin/env python3
"""Hill detail for the far terrain: assets/world/hills.bin, read by src/hills.js.

The manifest's far grid is 100 m, and Monte Pellegrino, Monte Gallo and the other limestone hills do not survive that: a 150 m wall becomes a
ramp one or two cells wide. Their real shape is in the 10 m TINITALY DEM (tools/dem.py), which the tile bake already uses for the tiles near the
camera. This writes the same DEM at 25 m for every 500 m tile whose relief is above RELIEF, tile by tile (21 x 21 nodes, the edge nodes shared
with the neighbour), so the runtime can build a finer far mesh for the hill tiles that are in view and not yet streamed as terrain. It does not touch
the tiles or the manifest. Where the DEM has no data (open sea, the cell next to it) the manifest's far grid fills in.

    python3 tools/hills_far.py                 # data/dem_tinitaly/tin_raw.tif + world/manifest.json -> assets/world/hills.bin
    python3 tools/hills_far.py --stats         # counts only

File (little endian): 'PHL1', u16 tiles, then per tile i16 i, i16 j, then the heights as one block: per tile 21 rows of 21 i16 (half metres), each stored
as the difference to a planar guess (left + up - up left; the first row and column against their one neighbour, the corner as it is). The DEM is faceted,
so this is the best that gzip gets out of it (about 290 KB for the whole city). Needs numpy and the DEM; the server compresses the file.
"""
import json
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dem  # noqa: E402

ROOT = os.path.dirname(HERE)
RAW = os.environ.get("TIN_RAW") or os.path.join(ROOT, "data", "dem_tinitaly", "tin_raw.tif")
dem.RAW = RAW
T, STEP, N = 500, 25, 21
RELIEF = 40.0     # metres between the lowest and the highest node of a tile


def main():
    man = json.load(open(os.path.join(ROOT, "world", "manifest.json")))
    F = man["far"]
    fh = np.array(F["h"], dtype=np.float64).reshape(F["nz"], F["nx"])

    def far(x, z):
        fx = np.clip((x - F["x0"]) / F["s"], 0, F["nx"] - 1.001)
        fz = np.clip((z - F["z0"]) / F["s"], 0, F["nz"] - 1.001)
        i, j = fx.astype(int), fz.astype(int)
        u, v = fx - i, fz - j
        return fh[j, i] * (1 - u) * (1 - v) + fh[j, i + 1] * u * (1 - v) + fh[j + 1, i] * (1 - u) * v + fh[j + 1, i + 1] * u * v

    x1, z1 = F["x0"] + (F["nx"] - 1) * F["s"], F["z0"] + (F["nz"] - 1) * F["s"]
    i0, i1 = int(np.ceil(F["x0"] / T)), int(np.floor(x1 / T)) - 1
    j0, j1 = int(np.ceil(F["z0"] / T)), int(np.floor(z1 / T)) - 1
    k = np.arange(N) * float(STEP)
    out = []
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            X, Z = np.meshgrid(i * T + k, j * T + k)
            t = dem.sample(X, Z)
            if np.isfinite(t).sum() < N * N * 0.25:
                continue
            h = np.where(np.isfinite(t), t, far(X, Z))
            if h.max() - h.min() < RELIEF:
                continue
            out.append((i, j, h))
    print(len(out), "tiles with relief >", RELIEF)
    if "--stats" in sys.argv:
        return
    q = [np.clip(np.rint(h * 2), 0, 32000).astype(np.int64) for _, _, h in out]
    blocks = []
    for a in q:
        p = np.zeros_like(a)
        p[1:, 1:] = a[1:, :-1] + a[:-1, 1:] - a[:-1, :-1]
        p[0, 1:] = a[0, :-1]
        p[1:, 0] = a[:-1, 0]
        blocks.append((a - p).astype("<i2").tobytes())
    path = os.path.join(ROOT, "assets", "world", "hills.bin")
    with open(path, "wb") as f:
        f.write(b"PHL1" + struct.pack("<H", len(out)))
        for i, j, _ in out:
            f.write(struct.pack("<hh", i, j))
        for b in blocks:
            f.write(b)
    import gzip
    raw = open(path, "rb").read()
    print(path, len(raw), "bytes,", len(gzip.compress(raw, 6)), "gzip")


if __name__ == "__main__":
    main()
