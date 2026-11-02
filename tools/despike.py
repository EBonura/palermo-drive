"""Despike the terrain: isolated nodes and short fins in the near grids ("vertex explosions", board request of the owner).

The lidar and TINITALY lattices of the hills have mixed samples on cliff faces: a node on a 300 m drop takes the height of the top or of the foot, so single nodes and one-column fins
stand 50 to 170 m above or below their neighbours (x -30, z -5730 in tile -1_-12 on Monte Pellegrino was a fin of 160 m). Two tests, both against the interpolation across the node:

  node  the residual against the mean of each of the four opposite neighbour pairs (W-E, N-S, NW-SE, NE-SW) is above T in all four, with the same sign (a peak or a pit one node wide)
  fin   a run of at most 3 nodes along a row or a column whose cross residual (against the two nodes across the run) is above 2 T with the same sign, the run bounded by nodes
        that are not, and not touching the grid edge

T = 15 m on a 5 m grid, scaled with the step. A real cliff edge or crest is not flagged: along it the residual is small; a step has residuals of opposite sign. The flagged node takes the value
interpolated across its smoothest direction (the opposite pair with the smallest difference); up to three passes, so a chain of spikes unravels.

    tools/.venv/bin/python tools/despike.py            # report only
    tools/.venv/bin/python tools/despike.py --apply    # patch world/tiles/*.json (the grid `near.h`), originals to data/despike-backup/

`despike_grid(a, s)` is also called by tools/tiles.py near_for on the padded lattice (so neighbouring tiles agree on their border), a rebake keeps the fix.
"""
import glob
import json
import os
import shutil
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T_NODE = 15.0   # metres at a 5 m step


def _pass(a, s, T):
    """One pass: returns (new array, list of (j, i, old, new, magnitude, kind))."""
    T = T * s / 5.0
    TF = 2 * T
    out = a.copy()
    flags = []
    nz, nx = a.shape
    sea = a <= -1.4   # the sea clamp (-1.5 m) of tools/tiles.py: the coast and the edge of the baked area are real steps, not spikes
    nearsea = sea.copy()
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            nearsea[1:-1, 1:-1] |= sea[1 + dj:nz - 1 + dj or None, 1 + di:nx - 1 + di or None]
    if nx < 5 or nz < 5:
        return out, flags
    c = a[1:-1, 1:-1]
    W, E, N, S = a[1:-1, :-2], a[1:-1, 2:], a[:-2, 1:-1], a[2:, 1:-1]
    NW, NE, SW, SE = a[:-2, :-2], a[:-2, 2:], a[2:, :-2], a[2:, 2:]
    prs = [(W, E), (N, S), (NW, SE), (NE, SW)]
    res = np.stack([c - (p + q) / 2 for p, q in prs])
    spike = ((res > T).all(axis=0) | (res < -T).all(axis=0)) & ~nearsea[1:-1, 1:-1]
    diff = np.stack([np.abs(p - q) for p, q in prs])
    k = diff.argmin(axis=0)
    mean = np.stack([(p + q) / 2 for p, q in prs])
    interp = np.take_along_axis(mean, k[None], 0)[0]
    mag = np.abs(res).min(axis=0)
    jj, ii = np.nonzero(spike)
    for j, i in zip(jj, ii):
        out[j + 1, i + 1] = interp[j, i]
        flags.append((j + 1, i + 1, a[j + 1, i + 1], interp[j, i], mag[j, i], 'node'))
    # fins: cross residuals; axis 0 runs along z (a column), cross = x; axis 1 runs along x, cross = z
    for axis in (0, 1):
        cr = np.zeros_like(a)
        if axis == 0:
            cr[:, 1:-1] = a[:, 1:-1] - (a[:, :-2] + a[:, 2:]) / 2
        else:
            cr[1:-1, :] = a[1:-1, :] - (a[:-2, :] + a[2:, :]) / 2
        for sg in (1, -1):
            m = (sg * cr > TF) & ~nearsea
            m2 = sg * cr > TF * 0.5
            # work along the axis: shift helpers
            def sh(x, d):   # x shifted so that sh[j] = x[j + d] along the run axis (zero-padded)
                y = np.zeros_like(x)
                if axis == 0:
                    if d > 0: y[:-d] = x[d:]
                    elif d < 0: y[-d:] = x[:d]
                    else: y = x.copy()
                else:
                    if d > 0: y[:, :-d] = x[:, d:]
                    elif d < 0: y[:, -d:] = x[:, :d]
                    else: y = x.copy()
                return y
            runs = []
            for L in (1, 2, 3):
                ok = np.ones_like(m)
                for q in range(L):
                    ok &= sh(m, q)
                ok &= ~sh(m2, -1) & ~sh(m2, L)
                runs.append((L, ok))
            for L, ok in runs:
                jj, ii = np.nonzero(ok)
                for j, i in zip(jj, ii):
                    for q in range(L):
                        y, x = (j + q, i) if axis == 0 else (j, i + q)
                        if not (1 <= y < nz - 1 and 1 <= x < nx - 1):
                            continue
                        if axis == 0:
                            val = (a[y, x - 1] + a[y, x + 1]) / 2
                        else:
                            val = (a[y - 1, x] + a[y + 1, x]) / 2
                        if out[y, x] == a[y, x]:
                            out[y, x] = val
                            flags.append((y, x, a[y, x], val, abs(cr[y, x]), 'fin'))
    return out, flags


def despike_grid(a, s, T=T_NODE, passes=6):
    """a: 2-D array (rows = z, columns = x) with step s metres. Returns (fixed array, flags)."""
    a = np.asarray(a, dtype=np.float64)
    allf = []
    for _ in range(passes):
        a2, fl = _pass(a, s, T)
        if not fl:
            break
        allf.extend(fl)
        a = a2
    return a, allf


def main():
    apply = '--apply' in sys.argv
    T = T_NODE
    for k, v in enumerate(sys.argv):
        if v == '--T':
            T = float(sys.argv[k + 1])
    rep = []
    bk = os.path.join(ROOT, 'data', 'despike-backup')
    for f in sorted(glob.glob(os.path.join(ROOT, 'world', 'tiles', '*.json'))):
        raw = open(f, 'rb').read()
        d = json.loads(raw)
        g = d.get('near')
        if not g:
            continue
        nx, nz, s = g['nx'], g['nz'], g['s']
        a = np.array(g['h'], dtype=np.float64).reshape(nz, nx)
        b, fl = despike_grid(a, s, T)
        if not fl:
            continue
        tid = os.path.basename(f)[:-5]
        for (j, i, old, new, mag, kind) in fl:
            rep.append((tid, g['x0'] + i * s, g['z0'] + j * s, round(float(old), 1), round(float(new), 1), round(float(mag), 1), kind))
        if apply:
            os.makedirs(bk, exist_ok=True)
            if not os.path.exists(os.path.join(bk, tid + '.json')):
                shutil.copy(f, os.path.join(bk, tid + '.json'))
            g['h'] = [round(float(v), 1) for v in b.ravel()]
            with open(f + '.part', 'wb') as fh:
                fh.write(json.dumps(d, separators=(',', ':'), ensure_ascii=False).encode())
            os.replace(f + '.part', f)
    rep.sort(key=lambda r: -r[5])
    print('nodes fixed:', len(rep), 'in', len(set(r[0] for r in rep)), 'tiles', '(applied)' if apply else '(report only)')
    for r in rep[:40]:
        print('  tile %s  x %.0f z %.0f  %s m -> %s m  (residual %s m, %s)' % r)
    json.dump(rep, open(os.path.join(ROOT, 'data', 'despike-report.json'), 'w'))


if __name__ == '__main__':
    main()
