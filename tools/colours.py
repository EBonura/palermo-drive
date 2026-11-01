"""Roof and ground colours derived from the Regione Siciliana orthophotos, for the world tiles (tools/tiles.py calls these in build()).

Only colour values are used (data/roof_colours.json, data/ground_colours.json, tools/orthophoto_colours.py, docs/sources/sitr-orthophoto-colours.md);
no imagery is stored anywhere.

  roofs   `rc` = "rrggbb" (chroma pulled in by 15 %) on a building whose confidence is at least ROOF_MIN (62,448 of 81,941); the rest keep the zone palette. The runtime puts the
          colour on the roof (a tint on the roof texture), real roofs being mostly neutral grey and dusty tan, not terracotta.
  ground  `gt = {t, a}` per tile: two 25 x 25 grids of 20 m cells, two hex digits per cell (E.g. "88" is neutral): digit 1 the lightness of the photo
          colour relative to the city median of its group (exp((d - 8) * 0.045)), digit 2 the warmth (log of red over blue, relative to the median,
          (d - 8) * step). `t`: terrain (courts, bare ground, green) and `a`: hard surfaces (asphalt, paving, pavement). A relative tint only: it varies the
          terrain and street colours by what the picture shows, it does not replace them. Cells with only shaded pixels (quality 1 to 2) are neutral.
"""
import json
import math
import os

ROOF_MIN = 0.35
LQ = 0.045
GROUPS = {"t": ("court", "bare", "green"), "a": ("asphalt", "paving", "walk")}
STEP = {"t": 0.04, "a": 0.015}


def roof_colours(path):
    if not os.path.exists(path):
        return {}
    b = json.load(open(path))["b"]
    return {k: _soft(v[0].lstrip("#")) for k, v in b.items() if v[1] >= ROOF_MIN}


def _soft(h, keep=0.85):
    """The picture colours are of sun-lit surfaces, not albedo: pull the chroma in by 15 % (towards the same luma)."""
    c = int(h, 16)
    r, g, bl = (c >> 16) & 255, (c >> 8) & 255, c & 255
    y = 0.299 * r + 0.587 * g + 0.114 * bl
    f = lambda v: max(0, min(255, round(y + (v - y) * keep)))
    return "%02x%02x%02x" % (f(r), f(g), f(bl))


def _lin(h):
    c = int(h, 16)
    return [((c >> s & 255) / 255) ** 2.2 for s in (16, 8, 0)]


def _yw(h):
    r, g, b = _lin(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b, math.log((r + 0.01) / (b + 0.01))


def ground_tints(path):
    """-> {'i_j': {'t': str, 'a': str}} (only tiles with at least one cell of data)"""
    if not os.path.exists(path):
        return {}
    tiles = json.load(open(path))["tiles"]
    cells = {}   # (tile, group) -> list of (Y, w) or None per cell
    allv = {"t": [], "a": []}
    for key, cl in tiles.items():
        for grp, names in GROUPS.items():
            best = [None] * 625
            bq = [0] * 625
            for nm in names:
                if nm not in cl:
                    continue
                c, q = cl[nm]["c"], cl[nm]["q"]
                for k in range(625):
                    qq = int(q[k])
                    if qq >= 3 and qq > bq[k] and c[6 * k:6 * k + 6] != "------":
                        bq[k] = qq
                        best[k] = _yw(c[6 * k:6 * k + 6])
            cells[(key, grp)] = best
            allv[grp].extend(v for v in best if v)
    med = {}
    for grp, vs in allv.items():
        ys = sorted(v[0] for v in vs)
        ws = sorted(v[1] for v in vs)
        med[grp] = (ys[len(ys) // 2], ws[len(ws) // 2]) if vs else (0.2, 0.0)
    out = {}
    for key in tiles:
        rec = {}
        for grp in GROUPS:
            s = []
            any_ = False
            for v in cells[(key, grp)]:
                if v is None:
                    s.append("88")
                    continue
                any_ = True
                l = round(8 + math.log(max(0.5, min(1.8, v[0] / med[grp][0]))) / LQ)
                w = round(8 + (v[1] - med[grp][1]) / STEP[grp])
                s.append("%x%x" % (max(0, min(15, l)), max(0, min(15, w))))
            if any_:
                rec[grp] = "".join(s)
        if rec:
            out[key] = rec
    return out
