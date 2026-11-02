"""e6: open the closed courtyards of the ZEN insulae to the street (board item e6, docs/TILES.md). The OSM footprints close every court with a building or a wall, so the lapa could not
reach any of them; in reality the insulae are entered through ground-floor passages (androni, pilotis). For each free pocket of 250 m2 or more and 4 m or more across inside 700 m of the ZEN
(the car needs 1.8 m, dilated by 1 m on each side) a straight passage is cut from the pocket to the nearest street:
  - a building keeps its upper floors: it is split into the parts left and right of the gap (full height, with collision) and a bridge volume over the gap that starts `yb` = 4 m above the ground
    (a record with `yb`: src/buildings.js draws it from that height with an underside, src/world.js gives it no collision, src/pedestrians.js no footprint). Ids get .1 .2 for the parts, .b for the bridge;
  - walls and fences get a gate-width gap (6 m) and nothing more.
Repeats until no pocket is left. A rebake of the ZEN tiles brings the closed courts back: run this again.

    tools/.venv/bin/python tools/zen_portals.py [--apply]     # without --apply it only reports; originals go to data/portals-backup/
"""
import json, glob, math, os, sys, shutil, heapq
import numpy as np, cv2
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
APPLY = '--apply' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W_ = os.path.join(ROOT, 'world', 'tiles') + '/'
BK = os.path.join(ROOT, 'data', 'portals-backup') + '/'
X0, Z0, X1, Z1 = -4800, -8000, -3000, -6400
W, H = X1 - X0, Z1 - Z0
DRV = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service'}
tiles = {}
for f in glob.glob(W_ + '*.json'):
    n = os.path.basename(f)[:-5]; i, j = map(int, n.split('_'))
    if X0 - 500 <= i * 500 < X1 and Z0 - 500 <= j * 500 < Z1:
        tiles[n] = json.load(open(f))

def px(p): return np.array([[(p[i] - X0), (p[i + 1] - Z0)] for i in range(0, len(p), 2)], np.float32)
def analyse():
    obs = np.zeros((H, W), np.uint8); road = np.zeros((H, W), np.uint8)
    for n, d in tiles.items():
        for b in d['buildings']:
            if b.get('yb'): continue
            cv2.fillPoly(obs, [px(b['p']).astype(np.int32)], 1)
            for h in b.get('holes') or []:
                cv2.fillPoly(obs, [px(h).astype(np.int32)], 0)
        for fe in d.get('fences', []):
            if True: cv2.polylines(obs, [px(fe['p']).astype(np.int32).reshape(-1, 1, 2)], False, 1, 2)
        for r in d['roads']:
            if r['k'] in DRV and not r.get('tn'): cv2.polylines(road, [px(r['p']).astype(np.int32).reshape(-1, 1, 2)], False, 1, max(2, int(r.get('w', 6))))
    obsd = cv2.dilate(obs, np.ones((3, 3), np.uint8)); free = (obsd == 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(free, connectivity=4)
    sl = set(np.unique(lab[(road & free) > 0])) - {0}
    reach = np.isin(lab, list(sl)) & (free > 0)
    return obs, free, reach
def pockets(obs, free, reach):
    near = cv2.dilate(obs, np.ones((61, 61), np.uint8)) > 0
    un = ((free > 0) & ~reach & near).astype(np.uint8)
    m, l2, st, cen = cv2.connectedComponentsWithStats(un, connectivity=4)
    dt = cv2.distanceTransform(un, cv2.DIST_L2, 3)
    out = []
    for k in range(1, m):
        if st[k, 4] < 250: continue
        if dt[l2 == k].max() < 2.0: continue
        out.append((k, st, l2))
    return out, l2, st, dt
ZC, ZR = (-3871, -7167), 700
touched = set(); wcut = set(); cut = 0; ROUTES = []

def plan(obs, free, reach):
    pk, l2, st, dt = pockets(obs, free, reach)
    pk = [q for q in pk if math.hypot(st[q[0], 0] + st[q[0], 2] / 2 + X0 - ZC[0], st[q[0], 1] + st[q[0], 3] / 2 + Z0 - ZC[1]) < ZR]
    print('  pockets in the ZEN (>=250 m2, >=4 m wide):', len(pk), 'area', int(sum(st[k, 4] for k, _, _ in pk)))
    carves = []
    for k, _, _ in pk:
        x, y, w, h, a = st[k]
        x0, y0, x1, y1 = max(0, x - 40), max(0, y - 40), min(W, x + w + 40), min(H, y + h + 40)
        sub_l = l2[y0:y1, x0:x1]; sub_free = free[y0:y1, x0:x1]; sub_reach = reach[y0:y1, x0:x1]; sub_obs = obs[y0:y1, x0:x1]
        hh, ww = sub_l.shape
        INF = 10 ** 9; dist = np.full((hh, ww), INF, np.int32); prev = {}; dq = []
        for yy, xx in zip(*np.nonzero(sub_l == k)): dist[yy, xx] = 0; dq.append((0, yy, xx))
        heapq.heapify(dq); goal = None
        while dq:
            d, yy, xx = heapq.heappop(dq)
            if d > dist[yy, xx]: continue
            if sub_reach[yy, xx]: goal = (yy, xx); break
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = yy + dy, xx + dx
                if not (0 <= ny < hh and 0 <= nx < ww): continue
                c = 0 if (sub_free[ny, nx] and (sub_l[ny, nx] == k or sub_reach[ny, nx])) else 1
                nd = d + c
                if nd < dist[ny, nx]: dist[ny, nx] = nd; prev[(ny, nx)] = (yy, xx); heapq.heappush(dq, (nd, ny, nx))
        if goal is None or dist[goal] > 18: continue
        path = [goal]
        while path[-1] in prev: path.append(prev[path[-1]])
        path = path[::-1]
        ins = [q for q in path if sub_l[q] == k]; outs = [q for q in path if sub_reach[q]]
        if not ins or not outs: continue
        pa = ins[-1]; pb = outs[0]
        a = np.array([pa[1] + x0 + X0 + 0.5, pa[0] + y0 + Z0 + 0.5]); b = np.array([pb[1] + x0 + X0 + 0.5, pb[0] + y0 + Z0 + 0.5])
        dvec = (b - a) / max(1e-6, np.linalg.norm(b - a))
        if PASS == 0: ROUTES.append((int(a_pocket := st[k, 4]), [float(b[0]), float(b[1])], [float(a[0]), float(a[1])], [float(st[k, 0] + st[k, 2] / 2 + X0), float(st[k, 1] + st[k, 3] / 2 + Z0)], dvec.tolist()))
        ln = LineString([tuple(a - dvec * 2.5), tuple(b + dvec * 2.5)])
        carves.append((k, ln.buffer(3.2, cap_style=2), int(dist[goal]), ln.buffer(3.0, cap_style=2)))
    return carves

def apply_carves(carves):
    global cut
    for n, d in tiles.items():
        newb = []
        for b in d['buildings']:
            if b.get('holes') or b.get('parts') or b.get('split'): newb.append(b); continue
            poly = Polygon([(b['p'][i], b['p'][i + 1]) for i in range(0, len(b['p']), 2)])
            if not poly.is_valid: poly = poly.buffer(0)
            hits = [c for c in carves if c[1].intersects(poly)]
            if not hits: newb.append(b); continue
            if b.get('yb'): newb.append(b); continue
            g = poly
            for c in hits: g = g.difference(c[1])
            gap = poly.intersection(unary_union([c[1] for c in hits]))
            parts = [q for q in (list(g.geoms) if isinstance(g, MultiPolygon) else [g]) if q.area > 10 and q.geom_type == 'Polygon']
            bridges = [q for q in (list(gap.geoms) if hasattr(gap, 'geoms') else [gap]) if q.area > 6 and q.geom_type == 'Polygon']
            if not parts and not bridges: newb.append(b); continue
            for si, q in enumerate(parts):
                nb = dict(b); nb['id'] = b['id'] + '.' + str(si + 1)
                nb['p'] = [round(v, 1) for xy in list(q.exterior.coords)[:-1] for v in xy]
                newb.append(nb)
            for si, q in enumerate(bridges):
                nb = dict(b); nb['id'] = b['id'] + '.b' + (str(si + 1) if len(bridges) > 1 else ''); nb['yb'] = 4
                nb['p'] = [round(v, 1) for xy in list(q.exterior.coords)[:-1] for v in xy]
                newb.append(nb)
            cut += 1; touched.add(n)
        d['buildings'] = newb
        # solid walls across the passage: cut the wall line
        nf = []
        for fe in d.get('fences', []):
            if not fe.get('p'): nf.append(fe); continue
            ln = LineString([(fe['p'][i], fe['p'][i + 1]) for i in range(0, len(fe['p']), 2)])
            hits = [c for c in carves if c[3].intersects(ln)]
            if not hits: nf.append(fe); continue
            g = ln
            for c in hits: g = g.difference(c[3])
            parts = list(g.geoms) if hasattr(g, 'geoms') else [g]
            for q in parts:
                if q.length < 0.6 or q.is_empty: continue
                nb = dict(fe); nb['p'] = [round(v, 1) for xy in q.coords for v in xy]; nf.append(nb)
            wcut.add(n)
        if 'fences' in d: d['fences'] = nf

for PASS in range(6):
    print('pass', PASS)
    obs, free, reach = analyse()
    carves = plan(obs, free, reach)
    if not carves: break
    print('  passages planned:', len(carves), 'wall thickness to cut (m):', sorted(c[2] for c in carves))
    apply_carves(carves)
obs, free, reach = analyse()
pk2, l22, st2, dt2 = pockets(obs, free, reach)
print('after: pockets in the whole box:', len(pk2), 'area', int(sum(st2[k, 4] for k, _, _ in pk2)), '; buildings cut:', cut, 'tiles', sorted(touched), 'walls cut in', sorted(wcut))
if APPLY:
    os.makedirs(BK, exist_ok=True)
    for n in touched | wcut:
        if not os.path.exists(BK + n + '.json'): shutil.copy(W_ + n + '.json', BK + n + '.json')
        tmp = W_ + n + '.json.part'
        json.dump(tiles[n], open(tmp, 'w'), separators=(',', ':'), ensure_ascii=False); os.replace(tmp, W_ + n + '.json')
    print('patched', len(touched | wcut), 'tiles')
