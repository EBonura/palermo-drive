"""Roof and ground colours of the whole city, sampled from the Regione Siciliana SITR orthophotos (ATA 2012-13, 15 cm and 25 cm).

Reads the blocks that tools/orthophoto_fetch.py downloaded, the baked tiles in world/tiles (read only) and writes two data files, colours only:

  data/roof_colours.json    {"meta": {...}, "b": {building id: ["#rrggbb", confidence 0..1]}}
  data/ground_colours.json  {"meta": {...}, "tiles": {"i_j": {class: {"c": 6 hex digits per cell, "q": 1 digit per cell}}}}
                            cells are 20 m squares of the game frame, row-major from the tile corner (25 x 25 per 500 m tile), see below

    tools/.venv/bin/python -I tools/orthophoto_colours.py calibrate --cache CACHE_ROOT --check25 CACHE25 [--out data]
    tools/.venv/bin/python -I tools/orthophoto_colours.py sample --cache CACHE_ROOT [--out data] [--near X,Z --radius M] [--workers N]
    tools/.venv/bin/python -I tools/orthophoto_colours.py report --cache CACHE_ROOT --out data --figs DIR [--check25 CACHE25]

How a roof colour is found (per building, at 0.25 m per pixel, in OKLab):
  * the footprint is moved by a per-block offset (OSM outlines sit a few metres off the photo; found by lining the outlines up with the
    brightest edges), shrunk by 0.5 m plus 4 cm per metre of height (aerial pictures lean taller buildings away from the camera) and holes cut out;
  * pixels in shadow, on vegetation, on dark blue solar panels or burnt out are dropped;
  * the remaining pixels vote in a coarse histogram; mean shift from the strongest bins finds up to two modes; if the second mode is the same
    hue but clearly brighter, that is the sun-lit slope of the same roof and wins (the game lights its roofs itself, so we want albedo, not shade);
  * the colour is the median of the pixels near the chosen mode; confidence is how much of the roof the mode explains, how many pixels it has,
    and a small penalty for tall buildings (outline and roof drift apart).

Ground colours (per 20 m cell, per class): classes come from the baked street layers, not from the picture: asphalt, paving, walk (the raised
layer within 4 m of a carriageway or paving), court (any other ground within 24 m of a building: courtyards, yards, lots), green (the baked
green layer), bare (everything else, more than 24 m from a building). Building footprints (grown by 1.5 m), shadows and vegetation (except in
the green class) are left out; the colour is the median of the sun-lit pixels, or of the shaded ones brightened by the city-wide lit/shade
ratio of that class when a cell has no lit pixels (those cells get a lower quality digit). Quality digit q: 0 no data, 1 to 9 = share of the
class area in the cell seen (lit) times a size factor, shaded-only cells at most 4.

Only colours are written. The pictures are read from the cache folder and never copied into the repo.
"""
import argparse
import json
import math
import multiprocessing as mp
import os
import sys
import time

import cv2
import numpy as np
from PIL import Image
from pyproj import Transformer
from shapely import contains_xy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)
import orthophoto_fetch as F  # noqa: E402
from bake import KX, KZ, LAT0, LON0  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
T = 500.0           # world tile size (docs/TILES.md)
CELL = 20.0         # ground cell size, metres
NCELL = int(T / CELL)
GRES = 0.5          # metres per pixel for the ground raster
YEAR = "2012-2013"

# roofs
MIN_ROOF_PX = 40            # pixels left after shrinking, below that the outline is used as it is
SHADOW_L = 0.30             # OKLab lightness below which a roof pixel counts as shadow or a dark panel
BURNT_L = 0.965
MODE_R = 0.06               # mean shift radius in (0.6 L, a, b)
LIT_GAIN = 0.05             # the second mode must be this much lighter (OKLab L) to be the sun-lit slope
SHIFT_M = 6.0               # block offset search range, metres
SHIFT_STEP = 0.5

_inv = Transformer.from_crs(F.EPSG, 4326, always_xy=True)


def utm_to_local(e, n):
    lon, lat = _inv.transform(e, n)
    return (np.asarray(lon) - LON0) * KX, -(np.asarray(lat) - LAT0) * KZ


# ----------------------------------------------------------------------------------------------
# Colour space
# ----------------------------------------------------------------------------------------------
_M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
_M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
_M1I, _M2I = np.linalg.inv(_M1), np.linalg.inv(_M2)


def to_oklab(rgb):
    """sRGB uint8 (..., 3) to OKLab float32 (L 0..1, a and b about -0.3..0.3)."""
    c = rgb.astype(np.float32) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    lms = np.cbrt(lin @ _M1.T.astype(np.float32))
    return lms @ _M2.T.astype(np.float32)


def to_srgb(lab):
    """OKLab (..., 3) to sRGB uint8."""
    lms = (np.asarray(lab, np.float64) @ _M2I.T) ** 3
    lin = np.clip(lms @ _M1I.T, 0, 1)
    c = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255).astype(np.uint8)


def hexcol(lab):
    r, g, b = to_srgb(lab)
    return f"{r:02x}{g:02x}{b:02x}"


def oklch(lab):
    return lab[0], math.hypot(lab[1], lab[2]), math.atan2(lab[2], lab[1])


def delta(a, b):
    """OKLab distance times 100 (about one 'just noticeable' unit per 2)."""
    return 100.0 * float(np.linalg.norm(np.asarray(a) - np.asarray(b)))


# ----------------------------------------------------------------------------------------------
# World access
# ----------------------------------------------------------------------------------------------
class Tiles:
    """Lazy reader of world/tiles/i_j.json (read only) with a small cache."""

    def __init__(self, world):
        self.dir = os.path.join(world, "tiles")
        self.mem = {}

    def get(self, i, j):
        k = (i, j)
        if k not in self.mem:
            if len(self.mem) > 24:
                self.mem.pop(next(iter(self.mem)))
            p = os.path.join(self.dir, f"{i}_{j}.json")
            self.mem[k] = json.load(open(p)) if os.path.exists(p) else None
        return self.mem[k]

    def around(self, xmin, zmin, xmax, zmax, pad=0.0):
        """Tile dicts that touch the rectangle (grown by `pad` metres)."""
        out = []
        for i in range(math.floor((xmin - pad) / T), math.floor((xmax + pad) / T) + 1):
            for j in range(math.floor((zmin - pad) / T), math.floor((zmax + pad) / T) + 1):
                t = self.get(i, j)
                if t:
                    out.append(((i, j), t))
        return out


class Block:
    """One orthophoto block: the picture plus the game-frame to pixel mapping."""

    def __init__(self, svc, bi, bj, path):
        self.svc, self.bi, self.bj = svc, bi, bj
        self.rgb = np.asarray(Image.open(path).convert("RGB"))
        self.e0, self.n0, self.e1, self.n1 = F.block_bbox(bi, bj)
        self.core = F.block_core(bi, bj)
        self.px = F.RES

    def pix(self, x, z, res=None):
        """Game metres to (col, row) pixels of this block (float arrays)."""
        res = res or self.px
        e, n = F.local_to_utm(x, z)
        return (np.asarray(e) - self.e0) / res, (self.n1 - np.asarray(n)) / res

    def in_core(self, e, n):
        c = self.core
        return (e >= c[0]) & (e < c[2]) & (n >= c[1]) & (n < c[3])

    def local_rect(self):
        xs, zs = utm_to_local(np.array([self.e0, self.e1, self.e0, self.e1]), np.array([self.n0, self.n0, self.n1, self.n1]))
        return xs.min(), zs.min(), xs.max(), zs.max()


def rings_of(b):
    """Outer ring and hole rings of a baked building as (n, 2) arrays."""
    out = [np.asarray(b["p"], float).reshape(-1, 2)]
    for h in b.get("holes") or []:
        out.append(np.asarray(h, float).reshape(-1, 2))
    return out


def fill(mask, rings_px, value=255, off=(0, 0)):
    """Even-odd fill: outer ring then holes (rings_px[0] is the outer ring)."""
    ox, oy = off
    for k, r in enumerate(rings_px):
        pts = np.round((r - (ox, oy)) * 16).astype(np.int32)  # 4 bits of sub-pixel precision
        cv2.fillPoly(mask, [pts], value if k == 0 else 0, lineType=cv2.LINE_8, shift=4)


# ----------------------------------------------------------------------------------------------
# Footprint offset
# ----------------------------------------------------------------------------------------------
def edge_points(rings_px, step=4.0):
    out = []
    for r in rings_px:
        q = np.vstack([r, r[:1]])
        for a, b in zip(q[:-1], q[1:]):
            n = max(1, int(np.hypot(*(b - a)) / step))
            t = (np.arange(n) / n)[:, None]
            out.append(a + (b - a) * t)
    return np.vstack(out) if out else np.zeros((0, 2))


def find_offset(gray, pts):
    """(dx, dy) in pixels that puts the footprint edges on the strongest image edges, plus a sharpness score (peak over mean)."""
    g = cv2.GaussianBlur(gray.astype(np.float32), (0, 0), 2.0)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1)
    mag = cv2.GaussianBlur(np.hypot(gx, gy), (0, 0), 1.5)
    h, w = mag.shape
    pts = pts[np.random.default_rng(1).permutation(len(pts))[:60000]]
    rng = int(SHIFT_M / F.RES)
    step = max(1, int(SHIFT_STEP / F.RES))
    shifts = range(-rng, rng + 1, step)
    score = np.zeros((len(shifts), len(shifts)), np.float32)
    for iy, dy in enumerate(shifts):
        for ix, dx in enumerate(shifts):
            xi = np.clip(np.round(pts[:, 0] + dx).astype(int), 0, w - 1)
            yi = np.clip(np.round(pts[:, 1] + dy).astype(int), 0, h - 1)
            score[iy, ix] = mag[yi, xi].mean()
    iy, ix = np.unravel_index(score.argmax(), score.shape)
    s0 = score[len(shifts) // 2, len(shifts) // 2]
    return shifts[ix], shifts[iy], float(score.max() / max(float(score.mean()), 1e-6)), float(score.max() / max(float(s0), 1e-6))


# ----------------------------------------------------------------------------------------------
# Roofs
# ----------------------------------------------------------------------------------------------
def mean_shift(f, seed, r=MODE_R, it=8):
    c = seed
    for _ in range(it):
        d = np.linalg.norm(f - c, axis=1)
        m = d < r
        if not m.any():
            break
        n = f[m].mean(0)
        if np.linalg.norm(n - c) < 1e-3:
            c = n
            break
        c = n
    return c


def dominant(lab):
    """Mode of a pixel cloud (OKLab rows). Returns (centre, count, explained_share, pixels_of_mode_mask) of the roof's colour."""
    f = lab * np.array([0.6, 1.0, 1.0], np.float32)  # lightness counts less: the same roof is lit and shaded
    key = np.floor(lab / np.array([0.04, 0.02, 0.02], np.float32)).astype(np.int32)
    code = key[:, 0] * 10007 + key[:, 1] * 101 + key[:, 2]
    u, inv, cnt = np.unique(code, return_inverse=True, return_counts=True)
    modes = []
    left = np.ones(len(f), bool)
    for _ in range(2):
        if left.sum() < 8:
            break
        cu = np.bincount(inv[left], minlength=len(u))
        seed = f[left & (inv == cu.argmax())].mean(0)
        c = mean_shift(f[left], seed)
        near = (np.linalg.norm(f - c, axis=1) < MODE_R) & left
        if near.sum() == 0:
            break
        modes.append((c / np.array([0.6, 1.0, 1.0]), int(near.sum()), near))
        left &= ~near
    return modes


def roof_colour(rgb_crop, lab_crop, mask, h, tall_pen=True):
    """(lab, confidence, info) for the pixels under `mask` (bool crop), or None."""
    sel = mask
    n_all = int(sel.sum())
    if n_all < 12:
        return None
    lab = lab_crop[sel]
    rgb = rgb_crop[sel].astype(np.int16)
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    bad = (L < SHADOW_L) | (L > BURNT_L)
    bad |= (a < -0.012) & (np.hypot(a, b) > 0.03) & (L < 0.68)      # vegetation, algae
    bad |= (b < -0.025) & (L < 0.52)                                # dark blue solar panels
    ok = ~bad
    n_ok = int(ok.sum())
    if n_ok < 8:
        # nothing usable (a roof entirely in shadow): the colour is only a hint
        c = np.median(lab, axis=0)
        return c, 0.05, {"valid": 0.0, "n": n_all}
    v = lab[ok]
    modes = dominant(v)
    if not modes:
        return None
    c1, k1, m1 = modes[0]
    chosen, kk = c1, k1
    lit = False
    if len(modes) > 1:
        c2, k2, m2 = modes[1]
        l1, ch1, h1 = oklch(c1)
        l2, ch2, h2 = oklch(c2)
        dh = abs((h1 - h2 + math.pi) % (2 * math.pi) - math.pi)
        if k2 >= 0.4 * k1 and l2 > l1 + LIT_GAIN and dh < 0.45 and 0.6 < (ch2 + 1e-3) / (ch1 + 1e-3) < 1.7:
            chosen, kk, lit = c2, k2, True
            k1 = k1 + k2
        elif k2 >= 0.4 * k1 and dh < 0.45 and abs(l2 - l1) <= LIT_GAIN:
            k1 = k1 + k2  # same material, two bins
    d = np.linalg.norm((v - chosen) * np.array([0.6, 1.0, 1.0], np.float32), axis=1)
    near = d < MODE_R
    col = np.median(v[near], axis=0) if near.any() else chosen
    explained = min(1.0, (k1 if lit else kk) / max(1, n_ok))
    valid = n_ok / n_all
    size = min(1.0, n_all / 160.0)
    q = (explained ** 0.8) * (min(1.0, valid / 0.45) ** 0.6) * (size ** 0.5)
    if tall_pen and h and h > 12:
        q *= 1.0 - min(0.3, (h - 12) / 80.0)
    return col, float(min(1.0, q)), {"valid": valid, "n": n_all, "explained": explained, "lit": lit}


def sample_roofs(blk, lab_img, owned, gray):
    """owned: list of (building dict, rings_px). Returns {id: [hex, q]} and per-building diagnostics."""
    H, W = gray.shape
    res = {}
    diag = {}
    for b, rings in owned:
        allpts = np.vstack(rings)
        x0, y0 = np.floor(allpts.min(0)).astype(int) - 2
        x1, y1 = np.ceil(allpts.max(0)).astype(int) + 3
        cx0, cy0, cx1, cy1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
        if cx1 - cx0 < 4 or cy1 - cy0 < 4:
            continue
        mask = np.zeros((cy1 - cy0, cx1 - cx0), np.uint8)
        fill(mask, rings, 255, (cx0, cy0))
        full = int(np.count_nonzero(mask))
        if full < 12:
            continue
        # footprint share inside the picture (outlines that cross the picture's edge are cut)
        inside = full / max(1, int(np.count_nonzero(fill_full(rings, x0, y0, x1, y1))))
        h = float(b.get("h") or 0)
        e = (0.5 + 0.04 * min(h, 40.0)) / F.RES
        m = mask
        for k in (1.0, 0.5, 0.0):
            r = int(round(e * k))
            m = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) if r > 0 else mask
            if np.count_nonzero(m) >= MIN_ROOF_PX:
                break
        out = roof_colour(blk.rgb[cy0:cy1, cx0:cx1], lab_img[cy0:cy1, cx0:cx1], m > 0, h)
        if out is None:
            continue
        col, q, info = out
        q *= min(1.0, inside / 0.7)
        res[b["id"]] = ["#" + hexcol(col), round(q, 3)]
        diag[b["id"]] = (info.get("valid", 0.0), info.get("explained", 0.0), info.get("n", 0))
    return res, diag


def fill_full(rings, x0, y0, x1, y1):
    m = np.zeros((max(1, y1 - y0), max(1, x1 - x0)), np.uint8)
    fill(m, rings, 255, (x0, y0))
    return m


# ----------------------------------------------------------------------------------------------
# Ground
# ----------------------------------------------------------------------------------------------
CLASSES = ("asphalt", "paving", "walk", "court", "green", "bare")   # class ids 1..6 in the raster, in this order
A, P, W, CT, GR, BA = 1, 2, 3, 4, 5, 6
SKIP = 7                    # water and sand: not sampled
WALK_REACH = 4.0            # raised ground this close to a carriageway or paving is sidewalk, farther away it is a courtyard or yard
URBAN_REACH = 24.0          # tools/tiles.py URBAN_REACH: ground this close to a building and in no layer is yard, else bare
SHADE_L = 0.47              # OKLab lightness that splits shadow from sun (valley of the roof and ground histograms)
SHADE_CLASS = {A: 0.47, P: 0.47, W: 0.47, CT: 0.40, GR: 0.30, BA: 0.30}   # grass and earth are dark even in the sun, so their shadow limit is lower
MIN_LIT, MIN_SHADE = 24, 48 # pixels (0.5 m) needed for a lit or a shaded cell colour


def class_raster(blk, tiles, rings_g):
    """uint8 raster at GRES: 0 nothing, 1 asphalt, 2 paving, 3 raised (decided later), 5 green, 7 skip; plus the building raster."""
    ng = int(round(F.NPX * F.RES / GRES))
    cls = np.zeros((ng, ng), np.uint8)
    xmin, zmin, xmax, zmax = blk.local_rect()
    for _, t in tiles.around(xmin, zmin, xmax, zmax, 0):
        for name, val in (("raised", 3), ("green", GR), ("water", SKIP), ("sand", SKIP), ("paving", P), ("asphalt", A)):
            for poly in t["streets"][name]:
                rs = [np.asarray(r, float).reshape(-1, 2) for r in poly]
                allp = np.vstack(rs)
                c, r = blk.pix(allp[:, 0], allp[:, 1], GRES)
                xy = np.stack([c, r], 1)
                k, out = 0, []
                for q in rs:
                    out.append(xy[k:k + len(q)])
                    k += len(q)
                fill(cls, out, val)
    bld = np.zeros((ng, ng), np.uint8)
    for rs in rings_g:
        fill(bld, rs, 255)
    return cls, bld


def refined_classes(blk, tiles, ringsets):
    """Class raster at GRES with the six ground classes (CLASSES order, ids 1..6), SKIP for water and sand, 0 under and next to buildings."""
    k = F.RES / GRES
    rings_g = [[r * k for r in rs] for rs in ringsets]
    cls, bld = class_raster(blk, tiles, rings_g)
    grow = int(round(1.5 / GRES))
    bld_big = cv2.dilate(bld, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    road = ((cls == A) | (cls == P)).astype(np.uint8)
    d_road = cv2.distanceTransform(1 - road, cv2.DIST_L2, 3) * GRES
    d_bld = cv2.distanceTransform(1 - (bld > 0).astype(np.uint8), cv2.DIST_L2, 3) * GRES
    raised = cls == 3
    cls[raised & (d_road <= WALK_REACH)] = W
    cls[raised & (d_road > WALK_REACH)] = CT
    none = cls == 0
    cls[none & (d_bld <= URBAN_REACH)] = CT
    cls[none & (d_bld > URBAN_REACH)] = BA
    cls[bld_big > 0] = 0
    return cls


def ground_cells(blk, tiles, ringsets):
    """Per (class, cell) lit and shaded colour of the ground in the block. Returns a list of tuples
    (cls, cx, cz, n_avail, n_lit, lit_lab, n_shade, shade_lab) with cell indices in the game frame."""
    cls = refined_classes(blk, tiles, ringsets)
    ng = cls.shape[0]
    # pixel centres in the game frame
    cc = (np.arange(ng) + 0.5) * GRES
    e = blk.e0 + cc[None, :] + np.zeros((ng, 1))
    n = blk.n1 - cc[:, None] + np.zeros((1, ng))
    x, z = utm_to_local(e.ravel(), n.ravel())
    cx = np.floor(x / CELL).astype(np.int32).reshape(ng, ng)
    cz = np.floor(z / CELL).astype(np.int32).reshape(ng, ng)
    # a cell belongs to the block holding its centre
    ux, uz = np.unique(cx), np.unique(cz)
    gx, gz = np.meshgrid(ux, uz)
    ce, cn = F.local_to_utm((gx + 0.5) * CELL, (gz + 0.5) * CELL)
    own = blk.in_core(ce, cn)
    in15 = contains_xy(_G["cov"], LON0 + (gx + 0.5) * CELL / KX, LAT0 - (gz + 0.5) * CELL / KZ)
    own &= in15 if blk.svc == "15" else ~in15      # each cell is read from the 15 cm set where there is one, else from the 25 cm set
    ownmap = np.zeros((len(uz), len(ux)), bool)
    ownmap[:] = own
    ix, iz = np.searchsorted(ux, cx), np.searchsorted(uz, cz)
    mine = ownmap[iz, ix]
    small = cv2.resize(blk.rgb, (ng, ng), interpolation=cv2.INTER_AREA)
    lab = to_oklab(small)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    veg = (a < -0.012) & (np.hypot(a, b) > 0.03) & (L < 0.68)
    sel = mine & (cls > 0) & (cls != SKIP)
    keep = sel & ~(veg & ((cls == A) | (cls == P) | (cls == W)))
    key = (iz.astype(np.int64) * len(ux) + ix) * 8 + cls
    avail = np.bincount(key[sel], minlength=len(ux) * len(uz) * 8)
    kk = key[keep]
    order = np.argsort(kk, kind="stable")
    kk = kk[order]
    labs = lab[keep][order]
    out = []
    cut = np.flatnonzero(np.diff(kk)) + 1
    for s, e_ in zip(np.r_[0, cut], np.r_[cut, len(kk)]):
        g = int(kk[s])
        cl, cell = g & 7, g >> 3
        px = labs[s:e_]
        thr = SHADE_CLASS[cl]
        lit = px[px[:, 0] >= thr]
        sh = px[px[:, 0] < thr]
        o = (cl, int(ux[cell % len(ux)]), int(uz[cell // len(ux)]), int(avail[g]), len(lit),
             np.median(lit, axis=0) if len(lit) >= MIN_LIT else None, len(sh), np.median(sh, axis=0) if len(sh) >= MIN_SHADE else None)
        if o[5] is not None or o[7] is not None:
            out.append(o)
    return out


# ----------------------------------------------------------------------------------------------
# One block
# ----------------------------------------------------------------------------------------------
_G = {}   # per process: tile reader, coverage polygon


def init_worker(world, cache):
    _G["tiles"] = Tiles(world)
    _G["cov"] = F.coverage_15(cache)


def block_buildings(blk, tiles):
    """All baked buildings near the block (for masks) and the mask of those owned by it (centre in the core, same set set as the fetch plan)."""
    xmin, zmin, xmax, zmax = blk.local_rect()
    bl = []
    for _, t in tiles.around(xmin, zmin, xmax, zmax, 50):
        bl += t["buildings"]
    if not bl:
        return [], np.zeros(0, bool), []
    cen = np.array([np.asarray(b["p"], float).reshape(-1, 2).mean(0) for b in bl])
    e, n = F.local_to_utm(cen[:, 0], cen[:, 1])
    own = blk.in_core(e, n)
    in15 = contains_xy(_G["cov"], LON0 + cen[:, 0] / KX, LAT0 - cen[:, 1] / KZ)
    own &= in15 if blk.svc == "15" else ~in15
    ringsets = []
    for b in bl:
        rs = rings_of(b)
        allp = np.vstack(rs)
        c, r = blk.pix(allp[:, 0], allp[:, 1])
        xy = np.stack([c, r], 1)
        k, out = 0, []
        for q in rs:
            out.append(xy[k:k + len(q)])
            k += len(q)
        ringsets.append(out)
    return bl, own, ringsets


def process_block(job):
    svc, bi, bj, path = job
    t0 = time.time()
    blk = Block(svc, bi, bj, path)
    bl, own, ringsets = block_buildings(blk, _G["tiles"])
    stat = {"block": f"{svc}_{bi}_{bj}", "owned": int(own.sum()), "shift": [0.0, 0.0], "gain": 1.0}
    roofs, diag = {}, {}
    if own.any():
        gray = cv2.cvtColor(blk.rgb, cv2.COLOR_RGB2GRAY)
        pts = np.vstack([edge_points(ringsets[i]) for i in np.where(own)[0]])
        dx, dy, sharp, gain = find_offset(gray, pts)
        stat["gain"] = round(gain, 3)
        if own.sum() >= 60 and gain > 1.1 and max(abs(dx), abs(dy)) * F.RES < SHIFT_M - 0.5 and (dx or dy):   # sparse blocks and edge-of-range finds are noise
            stat["shift"] = [dx * F.RES, dy * F.RES]
            ringsets = [[r + (dx, dy) for r in rs] for rs in ringsets]
        lab_img = to_oklab(blk.rgb)
        owned = [(bl[i], ringsets[i]) for i in np.where(own)[0]]
        roofs, diag = sample_roofs(blk, lab_img, owned, gray)
    cells = ground_cells(blk, _G["tiles"], ringsets)
    stat["secs"] = round(time.time() - t0, 1)
    return {"svc": svc, "roofs": roofs, "diag": diag, "cells": cells, "stat": stat}


# ----------------------------------------------------------------------------------------------
# Putting the blocks together
# ----------------------------------------------------------------------------------------------
CREDIT = "Ortofoto Regione Siciliana ATA 2012-2013, Regione Siciliana - Assessorato Territorio e Ambiente (SITR), CC BY 4.0"


def list_blocks(cache):
    """{(svc, bi, bj): path} of every downloaded block (a block present in several batch folders is read from the first)."""
    out = {}
    for d in sorted(os.listdir(cache)):
        dd = os.path.join(cache, d)
        if not os.path.isdir(dd):
            continue
        for fn in sorted(os.listdir(dd)):
            if fn.endswith(".jpg"):
                svc, bi, bj = fn[:-4].split("_")
                out.setdefault((svc, int(bi), int(bj)), os.path.join(dd, fn))
    return out


def hue_bin(lab):
    ch = math.hypot(lab[1], lab[2])
    if ch < 0.025:
        return 6
    return int((math.degrees(math.atan2(lab[2], lab[1])) % 360) // 60)


def unshade_roofs(roofs):
    """Roofs whose colour is a shadow (OKLab L < SHADE_L) get the lightness and chroma that sun-lit roofs of the same hue have.

    The factor per hue bin is the ratio of the median lit to the median shaded roof of that bin over the whole city (shade falls on roofs
    regardless of their material, so the two populations share a hue distribution). Returns the number brightened and the factors."""
    rows = {}
    for k, (hx, q) in roofs.items():
        rows[k] = to_oklab(np.array([[int(hx[i:i + 2], 16) for i in (1, 3, 5)]], np.uint8))[0]
    stats = {}
    for k, lab in rows.items():
        bn = hue_bin(lab)
        st = stats.setdefault(bn, {"lit": [], "sh": []})
        (st["sh"] if lab[0] < SHADE_L else st["lit"]).append((lab[0], math.hypot(lab[1], lab[2])))
    fac = {}
    for bn, st in stats.items():
        if len(st["lit"]) >= 30 and len(st["sh"]) >= 30:
            l, s = np.median(st["lit"], axis=0), np.median(st["sh"], axis=0)
            fac[bn] = (float(l[0] / s[0]), float(l[1] / max(s[1], 1e-3)), float(l[0]))
    n = 0
    for k, (hx, q) in list(roofs.items()):
        lab = rows[k]
        if lab[0] >= SHADE_L:
            roofs[k] = [hx, q, 0]
            continue
        f = fac.get(hue_bin(lab))
        if f is None:
            roofs[k] = [hx, round(q * 0.5, 3), 1]
            continue
        lab2 = np.array(lab, np.float64)
        ch = math.hypot(lab2[1], lab2[2])
        ch2 = min(ch * min(f[1], 3.0), 0.2)
        if ch > 1e-6:
            lab2[1], lab2[2] = lab2[1] * ch2 / ch, lab2[2] * ch2 / ch
        lab2[0] = min(lab2[0] * f[0], f[2] * 1.05)
        roofs[k] = ["#" + hexcol(lab2), round(q * 0.5, 3), 1]
        n += 1
    return n, fac


def unshade_cells(cells):
    """cells: {(cls, cx, cz): tuple}. Shade-only cells are lifted by the class-wide lit/shade ratio (from cells that have both)."""
    ratio = {}
    for cl in range(1, 7):
        pairs = [(c[5], c[7]) for k, c in cells.items() if k[0] == cl and c[5] is not None and c[7] is not None and c[4] >= 60 and c[6] >= 60]
        if len(pairs) >= 20:
            lit = np.median([p[0] for p in pairs], axis=0)
            sh = np.median([p[1] for p in pairs], axis=0)
            ch = lambda v: math.hypot(v[1], v[2])  # noqa: E731
            ratio[cl] = (float(lit[0] / sh[0]), float(ch(lit) / max(ch(sh), 1e-3)), len(pairs))
    return ratio


def write_ground(cells, ratio, path, meta, lut=None):
    tiles = {}
    for (cl, cx, cz), c in cells.items():
        n_avail, n_lit, lit, n_sh, sh = c[3], c[4], c[5], c[6], c[7]
        if lit is not None:
            lab = lit
            q = 1 + int(round(8 * min(1.0, n_lit / 300.0) * min(1.0, n_lit / max(1, n_avail) / 0.6)))
        else:
            r = ratio.get(cl)
            if r is None:
                continue
            ch = math.hypot(sh[1], sh[2])
            ch2 = min(ch * min(r[1], 3.0), 0.2)
            lab = np.array(sh, np.float64)
            if ch > 1e-6:
                lab[1], lab[2] = lab[1] * ch2 / ch, lab[2] * ch2 / ch
            lab[0] = min(lab[0] * r[0], 0.95)
            q = 1 + int(round(3 * min(1.0, n_sh / 300.0)))
        ti, tj = cx // NCELL, cz // NCELL
        t = tiles.setdefault(f"{ti}_{tj}", {})
        e = t.setdefault(CLASSES[cl - 1], {"c": ["------"] * NCELL * NCELL, "q": ["0"] * NCELL * NCELL})
        idx = (cz % NCELL) * NCELL + cx % NCELL
        hx = hexcol(lab)
        e["c"][idx] = map_hex(hx, lut) if lut is not None and c[8] == "15" else hx
        e["q"][idx] = str(min(q, 9))
    for t in tiles.values():
        for e in t.values():
            e["c"], e["q"] = "".join(e["c"]), "".join(e["q"])
    with open(path, "w") as f:
        json.dump({"meta": meta, "tiles": tiles}, f, separators=(",", ":"))
    return tiles


# ----------------------------------------------------------------------------------------------
# Colour balance of the 15 cm set
# ----------------------------------------------------------------------------------------------
CAL_FILE = "orthophoto_calibration.json"
CAL_GSD = 4.0   # metres per pixel the two sets are compared at (kills alignment and shadow-edge differences)


def calibrate(a):
    """Per-channel gains that put the 15 cm set on the colour balance of the regional 25 cm set.

    The 15 cm export is over-exposed and has a cold blue-cyan cast on neutral surfaces (sun-lit asphalt reads about 150, 172, 184 where the 25 cm set
    has 130, 138, 142; fields read cyan-grey instead of straw), so raw colours of it are not usable as albedo. The 25 cm set is the reference for
    neutrals (asphalt, concrete and stone come out grey in it) but it is hazy and desaturated, so only the gains are taken from it, never its
    saturation: for every block that exists in both sets (--check25 holds the 25 cm blocks) both pictures are reduced to 4 m pixels (that removes
    alignment and shadow-edge differences), pixels that are lit and nearly neutral in the 25 cm picture are paired, and each channel gets the median
    of 25 cm over 15 cm. Chromatic surfaces (tile roofs, fields) keep the saturation of the 15 cm picture. (A full affine fit to the 25 cm values was
    tried and rejected: it matches the haze, and terracotta roofs came out as grey-pink.)"""
    b15, b25 = list_blocks(a.cache), list_blocks(a.check25)
    ratios = []
    nb = 0
    for (svc, bi, bj), p25 in sorted(b25.items()):
        p15 = b15.get(("15", bi, bj))
        if not p15:
            continue
        im15, im25 = (np.asarray(Image.open(p).convert("RGB")) for p in (p15, p25))
        n = int(F.NPX * F.RES / CAL_GSD)
        s15, s25 = (cv2.resize(im, (n, n), interpolation=cv2.INTER_AREA).reshape(-1, 3) for im in (im15, im25))
        l15, l25 = to_oklab(s15), to_oklab(s25)
        ok = (l15[:, 0] > np.percentile(l15[:, 0], 40)) & (l25[:, 0] > np.percentile(l25[:, 0], 40))   # lit in both, whatever the sun did on either flight
        ok &= np.hypot(l25[:, 1], l25[:, 2]) < 0.02                                                 # neutral in the reference
        ok &= s15.min(1) > 20
        ratios.append(s25[ok].astype(np.float64) / s15[ok].astype(np.float64))
        nb += 1
    r = np.vstack(ratios)
    gain = np.median(r, axis=0)
    coef = np.vstack([np.zeros(3), np.diag(gain)])
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, CAL_FILE), "w") as f:
        json.dump({"note": "gains that put the 15 cm set on the colour balance of the 25 cm set, see tools/orthophoto_colours.py calibrate",
                   "blocks": nb, "pixels": int(len(r)), "gsd_m": CAL_GSD, "gain_rgb": gain.round(4).tolist(),
                   "affine_rgb": "out = coef[0] + coef[1:] . (rgb / 255) * 255, columns r, g, b", "coef": coef.round(5).tolist()}, f)
    print(f"calibration from {nb} blocks, {len(r)} paired neutral pixels; gains r, g, b = {np.round(gain, 3).tolist()} (spread p25-p75: "
          f"{np.round(np.percentile(r, 25, axis=0), 2).tolist()} - {np.round(np.percentile(r, 75, axis=0), 2).tolist()})")


def load_lut(out):
    """Affine map (4, 3) from the calibration file in `out`, or None."""
    p = os.path.join(out, CAL_FILE)
    return np.array(json.load(open(p))["coef"]) if os.path.exists(p) else None


def map_hex(hx, coef):
    """'#rrggbb' or 'rrggbb' through the calibration map."""
    o = "#" if hx.startswith("#") else ""
    h = hx.lstrip("#")
    rgb = np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64) / 255.0
    r, g, b = np.clip(np.round(255 * (coef[0] + rgb @ coef[1:])), 0, 255).astype(int)
    return f"{o}{r:02x}{g:02x}{b:02x}"


def cmd_sample(a):
    blocks = list_blocks(a.cache)
    if a.near:
        nx, nz = map(float, a.near.split(","))
        ne, nn = F.local_to_utm(nx, nz)
        blocks = {k: p for k, p in blocks.items() if math.hypot((k[1] + .5) * F.BLOCK - ne, (k[2] + .5) * F.BLOCK - nn) <= a.radius}
    jobs = [(k[0], k[1], k[2], p) for k, p in sorted(blocks.items())]
    print(f"{len(jobs)} blocks, {a.workers} workers")
    lut = load_lut(a.out)  # the calibration map, None if `calibrate` has not run
    if lut is None:
        print("no orthophoto_calibration.json in --out: colours of the 15 cm set stay raw (cold cast, over-exposed); run `calibrate` first")
    roofs, cells, stats, from15 = {}, {}, [], set()
    t0 = time.time()
    with mp.Pool(a.workers, init_worker, (a.world, a.cache)) as pool:
        for n, r in enumerate(pool.imap_unordered(process_block, jobs), 1):
            roofs.update(r["roofs"])
            if r["svc"] == "15":
                from15.update(r["roofs"])
            stats.append(r["stat"])
            for c in r["cells"]:
                cells[(c[0], c[1], c[2])] = c + (r["svc"],)
            if n % 25 == 0 or n == len(jobs):
                print(f"  {n}/{len(jobs)} blocks, {len(roofs)} roofs, {len(cells)} ground cells, {time.time() - t0:.0f} s")
    nshade, fac = unshade_roofs(roofs)
    ratio = unshade_cells(cells)
    if lut is not None:
        for k in from15:
            roofs[k][0] = map_hex(roofs[k][0], lut)
    os.makedirs(a.out, exist_ok=True)
    common = {"source": "Regione Siciliana SITR, Ortofoto ATA 2012-2013 (15 cm 'comuni' set, 25 cm regional set where no 15 cm sheet)",
              "imagery_date": YEAR, "licence": "CC BY 4.0", "credit": CREDIT, "stored": "derived colour values only, no imagery",
              "colour_note": "sRGB of the picture, lit surfaces, shadows removed. The 15 cm set is over-exposed with a cold cast, so its colours were "
                             "passed through a colour matrix onto the colour balance of the 25 cm set (orthophoto_calibration.json); "
                             "they are still picture colours, not measured albedo",
              "calibrated": lut is not None}
    rmeta = dict(common, format="b: building id -> [hex, confidence 0..1, shaded 0|1]; shaded=1 means no sun-lit pixels were found and the colour was lifted "
                                "by the city-wide lit/shade ratio of its hue bin (confidence already halved)",
                 shade_factors={str(k): [round(x, 3) for x in v] for k, v in sorted(fac.items())}, shaded_roofs=nshade,
                 outline_offset_blocks=sum(1 for s in stats if s["shift"] != [0.0, 0.0]), blocks=len(stats))
    with open(os.path.join(a.out, "roof_colours.json"), "w") as f:
        json.dump({"meta": rmeta, "b": roofs}, f, separators=(",", ":"))
    gmeta = dict(common, cell=CELL, tile=T, ncell=NCELL, classes=list(CLASSES),
                 format="tiles['i_j'][class] = {c: 6 hex digits per cell ('------' none), q: one digit per cell (0 none, 1-4 shaded only, 3-9 lit)}; "
                        "cell k of a tile is column k % 25, row k // 25, covering x = i*500 + col*20 .. +20 and z = j*500 + row*20 .. +20",
                 class_notes={"asphalt": "baked asphalt layer", "paving": "baked paving layer", "walk": "baked raised layer within 4 m of asphalt or paving",
                              "court": "other ground within 24 m of a building (courtyards, yards, raised ground far from roads)",
                              "green": "baked green layer", "bare": "ground in no layer more than 24 m from a building"},
                 shade_ratio={CLASSES[k - 1]: [round(x, 3) for x in v] for k, v in ratio.items()},
                 only_where="blocks that contain at least one baked building")
    tl = write_ground(cells, ratio, os.path.join(a.out, "ground_colours.json"), gmeta, lut)
    with open(os.path.join(a.out, "orthophoto_block_stats.json"), "w") as f:
        json.dump(stats, f)
    print(f"roofs {len(roofs)} ({nshade} shaded and lifted), ground tiles {len(tl)}, cells {len(cells)}; wrote {a.out}")

# ----------------------------------------------------------------------------------------------
# Report: coverage, palettes, side-by-sides
# ----------------------------------------------------------------------------------------------
NODE_ZONES = """
import { ZONES, zoneAt } from %(mod)s;
import fs from 'node:fs';
const pts = JSON.parse(fs.readFileSync(0, 'utf8'));
const pal = {};
for (const [k, z] of Object.entries(ZONES)) pal[k] = { plaster: z.plaster, stone: z.stone, roof: z.roof ?? 1 };
console.log(JSON.stringify({ zones: pts.map(p => zoneAt(p[0], p[1], '', 1e9)), pal }));
"""


def zones_of(xz):
    """District zone of each (x, z) with src/districts.js (the same function the game uses, without the nearest-street rule), plus the palettes."""
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        shutil_copy(os.path.join(ROOT, "src", "districts.js"), os.path.join(d, "districts.mjs"))  # the .js is CommonJS to node, no package.json
        open(os.path.join(d, "run.mjs"), "w").write(NODE_ZONES % {"mod": json.dumps("./districts.mjs")})
        r = subprocess.run(["node", os.path.join(d, "run.mjs")], input=json.dumps(np.asarray(xz).round(1).tolist()), capture_output=True, text=True, check=True)
    o = json.loads(r.stdout)
    return o["zones"], o["pal"]


def shutil_copy(a, b):
    open(b, "wb").write(open(a, "rb").read())


def hex_lab(h):
    h = h.lstrip("#")
    return to_oklab(np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)]], np.uint8))[0]


def roof_class(lab):
    """lab (n, 3) to class names: dark, terracotta, tan, white, grey, other (blue, green, violet)."""
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    ch, hu = np.hypot(a, b), np.degrees(np.arctan2(b, a)) % 360
    out = np.full(len(lab), "other", object)
    warm = (hu >= 15) & (hu < 100)
    out[(ch < 0.03) & (L >= 0.9)] = "white"
    out[(ch < 0.03) & (L < 0.9)] = "grey"
    out[(ch >= 0.03) & (ch < 0.06) & warm] = "tan"
    out[(ch >= 0.06) & warm] = "terracotta"
    out[L < 0.5] = "dark"
    return out


def building_table(world):
    rows = []
    tdir = os.path.join(world, "tiles")
    for fn in sorted(os.listdir(tdir)):
        if not fn.endswith(".json"):
            continue
        for b in json.load(open(os.path.join(tdir, fn)))["buildings"]:
            p = np.asarray(b["p"], float).reshape(-1, 2)
            ar = 0.5 * abs(float(np.dot(p[:, 0], np.roll(p[:, 1], -1)) - np.dot(p[:, 1], np.roll(p[:, 0], -1))))
            rows.append((b["id"], p[:, 0].mean(), p[:, 1].mean(), float(b.get("h") or 0), ar, bool(b.get("col"))))
    return rows


def fmt_pct(x):
    return f"{100 * x:5.1f}"


def render_roofs(blk, bl, rings, roofs, cx, cz, size_m, path):
    """Photo crop beside the same crop with every building filled with its colour (confidence below 0.35 outlined in magenta)."""
    n = int(size_m / F.RES)
    col, row = blk.pix(np.array([cx]), np.array([cz]))
    x0 = int(min(max(col[0] - n // 2, 0), blk.rgb.shape[1] - n))
    y0 = int(min(max(row[0] - n // 2, 0), blk.rgb.shape[0] - n))
    flat = np.full((n, n, 3), 60, np.uint8)
    for b, rs in zip(bl, rings):
        v = roofs.get(b["id"])
        if not v:
            continue
        c = tuple(int(v[0][i:i + 2], 16) for i in (1, 3, 5))
        m = np.zeros((n, n), np.uint8)
        fill(m, rs, 255, (x0, y0))
        flat[m > 0] = c
        if v[1] < 0.35:
            cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            cv2.drawContours(flat, cs, -1, (255, 0, 255), 1)
    pic = np.hstack([blk.rgb[y0:y0 + n, x0:x0 + n], flat])
    pic = cv2.resize(pic, (pic.shape[1] // 2, pic.shape[0] // 2), interpolation=cv2.INTER_AREA) if n > 800 else pic
    cv2.imwrite(path, cv2.cvtColor(pic, cv2.COLOR_RGB2BGR))


def render_ground(blk, tiles, ringsets, gtiles, cx, cz, size_m, path):
    """Photo crop beside the ground class raster painted with the cell colours of data/ground_colours.json."""
    cls = refined_classes(blk, tiles, ringsets)
    ng = cls.shape[0]
    cc = (np.arange(ng) + 0.5) * GRES
    e = blk.e0 + cc[None, :] + np.zeros((ng, 1))
    nn = blk.n1 - cc[:, None] + np.zeros((1, ng))
    x, z = utm_to_local(e.ravel(), nn.ravel())
    cxi = np.floor(x / CELL).astype(int).reshape(ng, ng)
    czi = np.floor(z / CELL).astype(int).reshape(ng, ng)
    out = np.full((ng, ng, 3), 60, np.uint8)
    for k, name in enumerate(CLASSES, 1):
        ys, xs = np.nonzero(cls == k)
        for ti, tj in {(a, b) for a, b in zip((cxi[ys, xs] // NCELL).tolist(), (czi[ys, xs] // NCELL).tolist())}:
            t = gtiles.get(f"{ti}_{tj}", {}).get(name)
            if not t:
                continue
            m = (cls == k) & (cxi // NCELL == ti) & (czi // NCELL == tj)
            idx = (czi % NCELL) * NCELL + cxi % NCELL
            hexes = np.array([t["c"][i * 6:i * 6 + 6] for i in range(NCELL * NCELL)])
            h = hexes[idx[m]]
            ok = h != "------"
            rgb = np.array([[int(s[i:i + 2], 16) for i in (0, 2, 4)] if s != "------" else [60, 60, 60] for s in h], np.uint8).reshape(-1, 3)
            sub = out[m]
            sub[ok] = rgb[ok]
            out[m] = sub
    n = int(size_m / GRES)
    col, row = blk.pix(np.array([cx]), np.array([cz]), GRES)
    x0 = int(min(max(col[0] - n // 2, 0), ng - n))
    y0 = int(min(max(row[0] - n // 2, 0), ng - n))
    photo = cv2.resize(blk.rgb, (ng, ng), interpolation=cv2.INTER_AREA)
    pic = np.hstack([photo[y0:y0 + n, x0:x0 + n], out[y0:y0 + n, x0:x0 + n]])
    cv2.imwrite(path, cv2.cvtColor(pic, cv2.COLOR_RGB2BGR))


def block_for(blocks, svc, x, z):
    e, n = F.local_to_utm(x, z)
    k = (svc, int(e // F.BLOCK), int(n // F.BLOCK))
    return k if k in blocks else None


def cmd_report(a):
    rd = json.load(open(os.path.join(a.out, "roof_colours.json")))
    gd = json.load(open(os.path.join(a.out, "ground_colours.json")))
    roofs = rd["b"]
    rows = building_table(a.world)
    ids = [r[0] for r in rows]
    zone, pal = zones_of([(r[1], r[2]) for r in rows])
    zone = np.array(zone)
    have = np.array([i in roofs for i in ids])
    q = np.array([roofs[i][1] if i in roofs else 0.0 for i in ids])
    sh = np.array([roofs[i][2] if i in roofs else 0 for i in ids])
    lab = to_oklab(np.array([[int(roofs[i][0][k:k + 2], 16) for k in (1, 3, 5)] if i in roofs else [0, 0, 0] for i in ids], np.uint8))
    cl = roof_class(lab)
    h = np.array([r[3] for r in rows])
    ar = np.array([r[4] for r in rows])
    rep = {"buildings": len(rows), "with_colour": int(have.sum())}
    print(f"buildings {len(rows)}, with a colour {int(have.sum())}; confident (q >= 0.5) {fmt_pct((q >= 0.5).mean())} %, usable (q >= 0.35) {fmt_pct((q >= 0.35).mean())} %, "
          f"shaded and lifted {fmt_pct(sh.mean())} %; median q {np.median(q):.2f}")
    print("by height   n       conf%  mean q   |  by footprint  n       conf%  mean q")
    for (lo, hi), (alo, ahi) in zip([(0, 6), (6, 12), (12, 20), (20, 40), (40, 999)], [(0, 40), (40, 100), (100, 300), (300, 1000), (1000, 1e9)]):
        m, m2 = (h >= lo) & (h < hi), (ar >= alo) & (ar < ahi)
        print(f"  {lo:3d}-{hi:<3d} m {m.sum():7d} {fmt_pct((q[m] >= .5).mean())}  {q[m].mean():.2f}   |  {alo:5.0f}-{min(ahi, 99999):<6.0f} m2 {m2.sum():7d} {fmt_pct((q[m2] >= .5).mean())}  {q[m2].mean():.2f}")
    print("\nPER DISTRICT (zone of src/districts.js): n, confident %, shaded %, share of roof colour classes among confident roofs, median L")
    print("zone         n    conf%  shade%  | terracotta  tan  white  grey  dark other | medL medC  | plaster medL medC | roof-mult")
    zrep = {}
    for z in sorted(set(zone), key=lambda z: -(zone == z).sum()):
        m = zone == z
        if m.sum() < 150:
            continue
        c = m & (q >= 0.5)
        cc = {k: float((cl[c] == k).mean()) if c.sum() else 0.0 for k in ("terracotta", "tan", "white", "grey", "dark", "other")}
        pl = np.array([hex_lab(x) for x in pal[z]["plaster"]])
        pch = np.hypot(pl[:, 1], pl[:, 2])
        medl, medc = (np.median(lab[c][:, 0]), np.median(np.hypot(lab[c][:, 1], lab[c][:, 2]))) if c.sum() else (0, 0)
        print(f"{z:11s} {m.sum():6d} {fmt_pct((q[m] >= .5).mean())} {fmt_pct(sh[m].mean())}  | {fmt_pct(cc['terracotta'])} {fmt_pct(cc['tan'])} {fmt_pct(cc['white'])} {fmt_pct(cc['grey'])} "
              f"{fmt_pct(cc['dark'])} {fmt_pct(cc['other'])} | {medl:.2f} {medc:.3f} | {np.median(pl[:, 0]):.2f} {np.median(pch):.3f} | {pal[z]['roof']}")
        zrep[z] = {"n": int(m.sum()), "confident": float((q[m] >= .5).mean()), "shaded": float(sh[m].mean()), "classes": cc, "median_L": float(medl),
                   "median_chroma": float(medc), "plaster_median_L": float(np.median(pl[:, 0])), "plaster_median_chroma": float(np.median(pch)), "roof_mult": pal[z]["roof"]}
    rep["zones"] = zrep
    c = q >= 0.5
    allc = {k: float((cl[c] == k).mean()) for k in ("terracotta", "tan", "white", "grey", "dark", "other")}
    print("\nALL confident roofs:", {k: round(v, 3) for k, v in allc.items()})
    rep["all_classes"] = allc
    for name, hx in (("style guide terrace #d8cfc4", "#d8cfc4"), ("style guide tile #b0603f", "#b0603f")):
        l = hex_lab(hx)
        print(f"  {name}: L {l[0]:.2f} chroma {math.hypot(l[1], l[2]):.3f} hue {math.degrees(math.atan2(l[2], l[1])) % 360:.0f}")
    print(f"  photo roofs: median L {np.median(lab[c][:, 0]):.2f} (p10 {np.percentile(lab[c][:, 0], 10):.2f}, p90 {np.percentile(lab[c][:, 0], 90):.2f}), "
          f"median chroma {np.median(np.hypot(lab[c][:, 1], lab[c][:, 2])):.3f}")
    allpl = np.array([hex_lab(x) for z in pal for x in pal[z]["plaster"]])
    print(f"  all plaster palette entries: median L {np.median(allpl[:, 0]):.2f}, median chroma {np.median(np.hypot(allpl[:, 1], allpl[:, 2])):.3f}")
    print("  lightness deciles of photo roofs (L):", np.percentile(lab[c][:, 0], range(10, 100, 10)).round(2).tolist())

    # ground
    print("\nGROUND (cells of 20 m):")
    grep = {}
    for name in CLASSES:
        cols, qs = [], []
        for t in gd["tiles"].values():
            e = t.get(name)
            if e:
                for k in range(NCELL * NCELL):
                    if e["q"][k] != "0":
                        cols.append(e["c"][k * 6:k * 6 + 6])
                        qs.append(int(e["q"][k]))
        if not cols:
            continue
        rgb = np.array([[int(s[i:i + 2], 16) for i in (0, 2, 4)] for s in cols], np.uint8)
        lb = to_oklab(rgb)
        qq = np.array(qs)
        med = np.median(rgb, axis=0).astype(int)
        print(f"  {name:8s} cells {len(cols):7d}  q>=5 {fmt_pct((qq >= 5).mean())} %  median #{med[0]:02x}{med[1]:02x}{med[2]:02x}  L {np.median(lb[:, 0]):.2f}  "
              f"chroma {np.median(np.hypot(lb[:, 1], lb[:, 2])):.3f}  p10-p90 L {np.percentile(lb[:, 0], 10):.2f}-{np.percentile(lb[:, 0], 90):.2f}")
        grep[name] = {"cells": len(cols), "median_hex": f"#{med[0]:02x}{med[1]:02x}{med[2]:02x}", "median_L": float(np.median(lb[:, 0]))}
    rep["ground"] = grep
    print("  shaded-to-lit ratios (L, chroma, cells):", gd["meta"]["shade_ratio"])
    print("  style guide asphalt base #7e7c76 L %.2f, balate #a69e92 L %.2f, sidewalk #c1c3b8 L %.2f" % tuple(hex_lab(x)[0] for x in ("#7e7c76", "#a69e92", "#c1c3b8")))

    if a.check25:
        cross_check(a, rows, roofs, q)
    if a.figs:
        os.makedirs(a.figs, exist_ok=True)
        figures(a, zone, roofs, gd)
        json.dump(rep, open(os.path.join(a.figs, "report.json"), "w"), indent=1)


def cross_check(a, rows, roofs, q15):
    """Roof colours again from the 25 cm set (a different flight look) for the buildings in a few areas; do the two agree, and does q predict it?"""
    init_worker(a.world, a.cache)
    b25 = list_blocks(a.check25)
    out = {}
    for (svc, bi, bj), path in sorted(b25.items()):
        blk = Block(svc, bi, bj, path)
        bl, own, rs = block_buildings(blk, _G["tiles"])
        own = np.array([blk.in_core(*F.local_to_utm(*np.asarray(b["p"], float).reshape(-1, 2).mean(0))) for b in bl], bool) if len(bl) else own
        gray = cv2.cvtColor(blk.rgb, cv2.COLOR_RGB2GRAY)
        lab_img = to_oklab(blk.rgb)
        r, _ = sample_roofs(blk, lab_img, [(bl[i], rs[i]) for i in np.where(own)[0]], gray)
        out.update(r)
    pairs = [(roofs[i], out[i]) for i in out if i in roofs]
    print(f"\nCROSS-CHECK against the 25 cm set ({len(pairs)} buildings in {len(b25)} blocks around centro, Via Liberta, ZEN, Mondello):")
    l15 = np.array([hex_lab(p[0][0]) for p in pairs])
    l25 = np.array([hex_lab(p[1][0]) for p in pairs])
    q15 = np.array([p[0][1] for p in pairs])
    print("  (the two sets differ in exposure and haze, so compare hue and rank order, not absolute colour)")
    print("  q(15 cm) bin     n   corr L  median |hue diff| deg (both chroma>=0.04)  median chroma ratio 25/15")
    for lo, hi in ((0, .35), (.35, .5), (.5, .7), (.7, 1.01)):
        m = (q15 >= lo) & (q15 < hi)
        if m.sum() < 20:
            continue
        cr = np.corrcoef(np.argsort(np.argsort(l15[m][:, 0])), np.argsort(np.argsort(l25[m][:, 0])))[0, 1]
        c1, c2 = np.hypot(l15[m][:, 1], l15[m][:, 2]), np.hypot(l25[m][:, 1], l25[m][:, 2])
        ch = (c1 >= .04) & (c2 >= .04)
        dh = np.abs((np.degrees(np.arctan2(l15[m][:, 2], l15[m][:, 1])) - np.degrees(np.arctan2(l25[m][:, 2], l25[m][:, 1])) + 180) % 360 - 180)
        print(f"  {lo:.2f}-{min(hi, 1):.2f}  {m.sum():6d}   {cr:.2f}     {np.median(dh[ch]) if ch.sum() else float('nan'):5.1f}  (n {ch.sum()})            {np.median(c2[ch] / c1[ch]) if ch.sum() else float('nan'):.2f}")


def figures(a, zone, roofs, gd):
    init_worker(a.world, a.cache)
    blocks = list_blocks(a.cache)
    spots = [("centro", 4, 2), ("alberg", -312, 577), ("kalsa", 678, 80), ("viaLib", -881, -1490), ("zen", -4253, -6951), ("mondello", -3307, -9913),
             ("sferra", -6854, -9206), ("noce", -2458, -694), ("brancaccio", 1729, 1959)]
    stats = {s["block"]: s for s in json.load(open(os.path.join(a.out, "orthophoto_block_stats.json")))}
    for name, x, z in spots:
        e, n = F.local_to_utm(x, z)
        bi, bj = int(e // F.BLOCK), int(n // F.BLOCK)
        svc = "15" if ("15", bi, bj) in blocks else "25"
        if (svc, bi, bj) not in blocks:
            continue
        blk = Block(svc, bi, bj, blocks[(svc, bi, bj)])
        bl, own, rs = block_buildings(blk, _G["tiles"])
        sh = stats.get(f"{svc}_{bi}_{bj}", {}).get("shift", [0.0, 0.0])
        rs = [[r + (sh[0] / F.RES, sh[1] / F.RES) for r in q] for q in rs]
        render_roofs(blk, bl, rs, roofs, x, z, 140, os.path.join(a.figs, f"roofs_{name}.png"))
        render_ground(blk, _G["tiles"], rs, gd["tiles"], x, z, 140, os.path.join(a.figs, f"ground_{name}.png"))
        print("  figure", name)



def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=("sample", "calibrate", "report"))
    ap.add_argument("--cache", required=True, help="cache root that tools/orthophoto_fetch.py filled (outside the repo)")
    ap.add_argument("--world", default=os.path.join(ROOT, "world"))
    ap.add_argument("--out", default=os.path.join(ROOT, "data"), help="folder for roof_colours.json and ground_colours.json")
    ap.add_argument("--figs", help="report: folder for the side-by-side pictures (outside the repo)")
    ap.add_argument("--check25", help="calibrate, report: cache root of 25 cm blocks (orthophoto_fetch.py fetch --svc 25), for the colour balance and the cross-check")
    ap.add_argument("--near", help="sample: only blocks within --radius metres of this game x,z (for tests)")
    ap.add_argument("--radius", type=float, default=1500)
    ap.add_argument("--workers", type=int, default=10)
    a = ap.parse_args()
    if (os.path.abspath(a.cache) + os.sep).startswith(ROOT + os.sep):
        sys.exit("the cache must be outside the repo (no imagery in the repo)")
    {"sample": cmd_sample, "calibrate": calibrate, "report": cmd_report}[a.cmd](a)


if __name__ == "__main__":
    main()
