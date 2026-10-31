#!/usr/bin/env python3
"""Photo facade textures for a few hero buildings (rectified Wikimedia Commons photos).

    tools/.venv/bin/python tools/facade_photos.py fetch   # download the source photos + licence metadata
    tools/.venv/bin/python tools/facade_photos.py build   # rectify, clean, colour-correct, write textures,
                                                          # assets/facades/photo/map.json, assets/CREDITS.md block
    tools/.venv/bin/python tools/facade_photos.py shots [key ...]  # in-game screenshots of the same walls (needs the server)
    tools/.venv/bin/python tools/facade_photos.py sheet   # contact sheet: photo | texture | in-game

Needs numpy, pillow, opencv-python-headless (all in tools/.venv). Photos go to SRC (outside the repo, never executed).

map.json (same convention src/buildings.js reads): { buildingId: [ { wall, texture, u0, u1, v0, v1, ... } ] }
  wall        index i of the footprint edge b.p[2i..2i+1] -> next vertex, in the ORIGINAL ring order of b.p
  u0, u1      texture u at the edge's start vertex and at its end vertex (1, 0 when the photographed wall reads right
              to left for a viewer standing in front of it, i.e. the image must run end -> start)
  v0, v1      texture v at the pavement and at the cornice (0 = bottom of the image); always 0 and 1 here
  flip        informational: true when u0 > u1
  photographed  [pu0, pu1, pv0]: the part of the wall that is really photographed (fractions of the edge from the start
              vertex, and of the height from the ground). The rest of the texture is mirrored padding, so a partly
              photographed facade still fits the whole wall.
  size, license, credit   texture size in px, licence, full credit string
Every texture has the same density (TEXELS_PER_M), capped at MAX_SIDE px on the long side.
"""
import json, math, os, re, subprocess, sys, time, urllib.parse, urllib.request
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/private/tmp/claude-501/facade-src/photos'
OUT = os.path.join(ROOT, 'assets/facades/photo')
SHOTS = '/private/tmp/claude-501/facade-src/shots'
SHEET = os.path.join(OUT, 'contact-sheet.png')
UA = {'User-Agent': 'PalermoDriveFacadeTool/0.1 (game prototype)'}
TEXELS_PER_M = 19.2     # PS2-era density: a 26.7 m palazzo gets 512 px
MAX_SIDE = 1024         # cap for very long walls (buildings.js stores every photo in a 1024 x 1024 layer)
MARK0, MARK1 = '<!-- facade_photos:begin -->', '<!-- facade_photos:end -->'

# assets/facades/photo/sources.json: one entry per rectified facade (key, bid, name, wall, cover, title, dw, quad, fix, auto, v0, split). quad = the 4 corners of the facade plane in the photo as seen in a view
# `dw` px wide (top-left, top-right, bottom-right, bottom-left). cover = [c0, c1] fraction of the footprint edge
# (from its start vertex) that the quad spans. auto = the quad reaches outside the photo, keep the largest photographed
# block. v0 = drop that fraction of the wall height at the bottom (clutter). fix = obstructions to
# paint out: ('poly', [pts]) or ('line', [pts], width), same view coordinates.
SOURCES = [s for s in json.load(open(os.path.join(OUT, 'sources.json'))) if not s.get('todo')]   # todo = photo fetched, quad not set yet


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- data
TILES = os.path.join(ROOT, 'world/tiles')
BINDEX = '/private/tmp/claude-501/facade-src/bindex2.json'


def building_index():
    """id -> [cx, cz, tile, name, g] for every building in world/tiles (cached outside the repo)."""
    if not os.path.exists(BINDEX):
        out = []
        for f in os.listdir(TILES):
            for b in json.load(open(os.path.join(TILES, f))).get('buildings', []):
                p = b['p']; n = len(p) // 2
                out.append([b['id'], round(sum(p[0::2]) / n, 1), round(sum(p[1::2]) / n, 1), f[:-5], b.get('n'), b.get('g')])
        os.makedirs(os.path.dirname(BINDEX), exist_ok=True)
        json.dump(out, open(BINDEX, 'w'))
    return {r[0]: r[1:] for r in json.load(open(BINDEX))}


_IDX = None


def get_building(bid):
    global _IDX
    if _IDX is None:
        _IDX = building_index()
    tile = _IDX[bid][2]
    return next(b for b in json.load(open(os.path.join(TILES, tile + '.json')))['buildings'] if b['id'] == bid)


def neighbour_buildings(bid):
    """Footprints of the buildings in the same and the 8 surrounding tiles (for the screenshot camera)."""
    global _IDX
    if _IDX is None:
        _IDX = building_index()
    i, j = map(int, _IDX[bid][2].split('_'))
    out = []
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            f = os.path.join(TILES, f'{i + di}_{j + dj}.json')
            if os.path.exists(f):
                out += [b['p'] for b in json.load(open(f))['buildings']]
    return out


def ground_of(bid):
    """Ground elevation for the screenshot camera: the building's own g, else the median g of lidar buildings within 200 m."""
    global _IDX
    if _IDX is None:
        _IDX = building_index()
    r = _IDX[bid]
    if r[4] is not None:
        return r[4]
    gs = sorted(v[4] for v in _IDX.values() if v[4] is not None and abs(v[0] - r[0]) < 200 and abs(v[1] - r[1]) < 200)
    return gs[len(gs) // 2] if gs else 5.0


def wall_info(bid, wall):
    b = get_building(bid)
    p = b['p']; n = len(p) // 2
    ax, az = p[2 * wall], p[2 * wall + 1]
    bx, bz = p[2 * ((wall + 1) % n)], p[2 * ((wall + 1) % n) + 1]
    L = math.hypot(bx - ax, bz - az)
    t = ((bx - ax) / L, (bz - az) / L)
    nx, nz = t[1], -t[0]
    mx, mz = (ax + bx) / 2, (az + bz) / 2
    if point_in(mx + nx * .5, mz + nz * .5, p):
        nx, nz = -nx, -nz
    right = (nz, -nx)                      # right-hand direction of a viewer facing the wall
    flip = (t[0] * right[0] + t[1] * right[1]) < 0
    H = (b['r'] - b['g']) if b.get('r') is not None and b.get('g') is not None else b['h']
    return dict(b=b, L=L, H=H, a=(ax, az), e=(bx, bz), n=(nx, nz), mid=(mx, mz), flip=flip)


def point_in(x, z, p):
    c = False; n = len(p) // 2; j = n - 1
    for i in range(n):
        xi, zi, xj, zj = p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            c = not c
        j = i
    return c


# ---------------------------------------------------------------- fetch
_LAST = [0.0]


def _get(url, parse):
    """GET with the pacing Commons asks for (a few requests, then 429 with Retry-After)."""
    for i in range(12):
        w = _LAST[0] + 7.0 - time.time()
        if w > 0:
            time.sleep(w)
        _LAST[0] = time.time()
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
            return json.loads(data) if parse else data
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(float(e.headers.get('Retry-After') or 30) + 2)
    raise RuntimeError('Commons rate limit')


def api(**kw):
    kw['format'] = 'json'
    return _get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(kw), True)


def fname(title):
    return re.sub(r'[ ,()]', lambda m: '_' if m.group() == ' ' else '', title)


def fetch(width=2400):
    os.makedirs(SRC, exist_ok=True)
    for s in json.load(open(os.path.join(OUT, 'sources.json'))):
        fn = fname(s['title']); path = os.path.join(SRC, fn)
        if os.path.exists(path) and os.path.exists(path + '.json'):
            continue
        r = api(action='query', titles='File:' + s['title'], prop='imageinfo', iiprop='url|size|extmetadata', iiurlwidth=width)
        ii = list(r['query']['pages'].values())[0]['imageinfo'][0]; m = ii['extmetadata']
        url = ii['thumburl'] if ii['width'] > width else ii['url']
        data = _get(url, False)
        open(path, 'wb').write(data)
        meta = dict(title=s['title'], orig=[ii['width'], ii['height']], url=ii['descriptionurl'], file=fn,
                    lic=m.get('LicenseShortName', {}).get('value'), licurl=m.get('LicenseUrl', {}).get('value'),
                    artist=m.get('Artist', {}).get('value'))
        json.dump(meta, open(path + '.json', 'w'))
        log('fetched', fn, meta['lic'])


def meta_for(s):
    m = json.load(open(os.path.join(SRC, fname(s['title']) + '.json')))
    artist = re.sub(r'<[^>]+>', '', m.get('artist') or 'unknown').replace('&amp;', '&').strip()
    artist = re.sub(r'\s+', ' ', artist)
    m['author'] = artist
    return m


# ---------------------------------------------------------------- image work
def paint_out(img, s):
    """Remove the obstructions listed in s['fix']: ('mirror', poly, axis_x) copies the mirror image of a symmetric facade
    over the polygon, ('poly', pts) / ('line', pts, width) are inpainted (OpenCV Telea)."""
    k = img.shape[1] / s['dw']
    mask = np.zeros(img.shape[:2], np.uint8)
    for f in s.get('fix', []):
        pts = (np.array(f[1], np.float32) * k).astype(np.int32)
        if f[0] == 'mirror':
            m = np.zeros(img.shape[:2], np.uint8); cv2.fillPoly(m, [pts], 255)
            flip = cv2.warpAffine(img, np.float32([[-1, 0, 2 * f[2] * k], [0, 1, 0]]), (img.shape[1], img.shape[0]),
                                  flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            img = np.where(m[..., None] > 0, flip, img)
        elif f[0] == 'poly':
            cv2.fillPoly(mask, [pts], 255)
        else:
            cv2.polylines(mask, [pts], False, 255, max(1, int(f[2] * k)))
    if mask.any():
        img = cv2.inpaint(img, mask, 6, cv2.INPAINT_TELEA)
    return img


def correct(img):
    """Neutral, flat light: soften the baked sun and white-balance towards grey (the game lights the wall itself)."""
    f = img.astype(np.float32) / 255
    # partial gray-world white balance (sun-baked photos are warm)
    m = f.reshape(-1, 3).mean(0); g = m.mean()
    gain = np.clip((g / m) ** 0.3, .85, 1.2)
    f = f * gain
    # flatten large-scale lighting (sun/shade gradients, sky glow) without touching the detail
    lum = f.mean(2)
    sig = max(f.shape[:2]) / 7
    low = cv2.GaussianBlur(lum, (0, 0), sig)
    f = f * np.clip((low.mean() / np.maximum(low, 1e-3)) ** .55, .6, 1.7)[..., None]
    # tone: percentile stretch to a mid-key range, slightly desaturated
    lo, hi = np.percentile(f, 1), np.percentile(f, 99.5)
    f = np.clip((f - lo) / max(hi - lo, 1e-3), 0, 1)
    f = 0.07 + 0.93 * f ** 0.82       # the game's lighting multiplies the texture, so keep it a touch bright
    gray = f.mean(2, keepdims=True)
    f = gray + (f - gray) * 1.0
    return (np.clip(f, 0, 1) * 255).astype(np.uint8)


def rectify(s, wi):
    path = os.path.join(SRC, fname(s['title']))
    img = cv2.imread(path)
    if img is None:
        raise SystemExit('missing ' + path + ' (run fetch)')
    if img.shape[1] > 2 * s['dw']:   # work near display size for speed; masks scale with it
        k = 2 * s['dw'] / img.shape[1]
        img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    img = paint_out(img, s)
    k = img.shape[1] / s['dw']
    c0, c1 = s['cover']
    Lc = wi['L'] * (c1 - c0)
    ppm = min(2 * TEXELS_PER_M, 2 * MAX_SIDE / max(wi['L'], wi['H']))
    wp, hp = int(round(Lc * ppm)), int(round(wi['H'] * ppm))
    src = (np.array(s['quad'], np.float32) * k)
    dst = np.array([[0, 0], [wp, 0], [wp, hp], [0, hp]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(img, M, (wp, hp), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    xa, xb, v0 = 0.0, 1.0, s.get('v0', 0)    # v0: drop the cluttered bottom; texture then covers v0..1 of the wall
    if s.get('auto'):
        # the wall quad reaches outside the photo: keep the largest block that is really photographed
        ok = cv2.warpPerspective(np.full(img.shape[:2], 255, np.uint8), M, (wp, hp), flags=cv2.INTER_NEAREST,
                                 borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        ok = cv2.erode(ok, np.ones((9, 9), np.uint8)) > 0
        best = (0, xa, xb, v0)
        for vv in np.arange(v0, .45, .02):
            rows = ok[:int(round(hp * (1 - vv)))]
            cols = rows.all(0)
            i = 0
            while i < wp:
                if cols[i]:
                    j = i
                    while j < wp and cols[j]: j += 1
                    area = (j - i) * (1 - vv)
                    if area > best[0]: best = (area, i / wp, j / wp, vv)
                    i = j
                else:
                    i += 1
        _, xa, xb, v0 = best
    h1 = int(round(hp * (1 - v0)))
    return out[:h1, int(xa * wp):int(xb * wp)], (xa, xb, v0)


def build():
    os.makedirs(OUT, exist_ok=True)
    mp = {}; creds = []
    for s in SOURCES:
        wi = wall_info(s['bid'], s['wall'])
        rect, (xa, xb, v0) = rectify(s, wi)
        rect = correct(rect)
        m = meta_for(s)
        ppm = min(2 * TEXELS_PER_M, 2 * MAX_SIDE / max(wi['L'], wi['H']))
        # where the photographed block sits on the wall, seen from outside (p = 0 at the viewer's left end)
        c0, c1 = s['cover']; flip = wi['flip']
        pc0, pc1 = (1 - c1, 1 - c0) if flip else (c0, c1)
        p0, p1 = pc0 + xa * (pc1 - pc0), pc0 + xb * (pc1 - pc0)
        fullw, fullh = int(round(wi['L'] * ppm)), int(round(wi['H'] * ppm))
        padl = int(round(p0 * fullw)); padr = max(0, fullw - padl - rect.shape[1]); padb = max(0, fullh - rect.shape[0])
        full = cv2.copyMakeBorder(rect, 0, 0, padl, padr, cv2.BORDER_REFLECT)       # sides: mirrored facade bays
        if padb:                                                                  # bottom (cluttered, cropped): smooth plinth wash
            band = cv2.copyMakeBorder(full, 0, padb, 0, 0, cv2.BORDER_REPLICATE)[-padb - 2:]
            band = cv2.GaussianBlur(band, (0, 0), sigmaX=full.shape[1] / 40, sigmaY=0.1)
            full = np.vstack([full, (band[2:] * .9).astype(np.uint8)])
        full = full[:fullh, :fullw]
        sc = min(TEXELS_PER_M, MAX_SIDE / max(wi['L'], wi['H'])) / ppm
        fw, fh = max(4, int(round(fullw * sc / 4)) * 4), max(4, int(round(fullh * sc / 4)) * 4)
        small = cv2.resize(full, (fw, fh), interpolation=cv2.INTER_AREA)
        small = cv2.addWeighted(small, 1.25, cv2.GaussianBlur(small, (0, 0), 1.0), -.25, 0)   # slight crunch
        name = s['key'] + '.jpg'
        cv2.imwrite(os.path.join(OUT, name), small, [cv2.IMWRITE_JPEG_QUALITY, 88])
        # photographed range as fractions of the edge from its start vertex
        u_a, u_b = (1 - p1, 1 - p0) if flip else (p0, p1)
        credit = f"{m['author']}, {m['title']}, {m['lic']}, {m['url']}"
        mp.setdefault(s['bid'], []).append(dict(
            wall=s['wall'], texture='assets/facades/photo/' + name,
            u0=1 if flip else 0, u1=0 if flip else 1, v0=0, v1=1, flip=bool(flip),
            photographed=[round(u_a, 3), round(u_b, 3), round(v0, 3)], size=[fw, fh], license=m['lic'], credit=credit))
        log(f"{name}: {fw}x{fh}  {s['name']}  wall {wi['L']:.1f} x {wi['H']:.1f} m  flip={flip}  photographed u {u_a:.2f}-{u_b:.2f} v>{v0:.2f}  {m['lic']}")
        creds.append((s, m))
    tmp = os.path.join(OUT, 'map.json.tmp')                  # the game reloads this file live: swap it in atomically
    json.dump(mp, open(tmp, 'w'), indent=1)
    os.replace(tmp, os.path.join(OUT, 'map.json'))
    write_credits(creds)


def write_credits(creds):
    path = os.path.join(ROOT, 'assets/CREDITS.md')
    txt = open(path, encoding='utf8').read() if os.path.exists(path) else ''
    seen = {}
    for s, m in creds:
        seen.setdefault(m['title'], (s, m))
    rows = ['| Texture | Title | Author | Licence | Source | Changes |', '| --- | --- | --- | --- | --- | --- |']
    for s, m in creds:
        tex = 'facades/photo/' + s['key'] + '.jpg'
        lic = f"[{m['lic']}]({m['licurl']})" if m.get('licurl') else m['lic']
        rows.append(f"| `{tex}` ({s['name']}) | {m['title']} | {m['author']} | {lic} | {m['url']} | rectified and downscaled "
                    f"(perspective-corrected, obstructions painted out, colour-neutralised, {MAX_SIDE} px max) |")
    block = (f"{MARK0}\n\n## Photo facade textures (`facades/photo/`, built by `tools/facade_photos.py`)\n\n"
             "Source photos are from Wikimedia Commons. Textures marked CC BY-SA 4.0 or 3.0 would make the derived "
             "texture share-alike; CC BY needs the credit shown; CC0 needs nothing (credit given anyway).\n\n"
             + '\n'.join(rows) + f"\n\n{MARK1}\n")
    if MARK0 in txt:
        txt = re.sub(re.escape(MARK0) + '.*?' + re.escape(MARK1) + r'\n?', lambda _: block, txt, flags=re.S)
    else:
        txt = txt.rstrip('\n') + '\n\n' + block
    open(path, 'w', encoding='utf8').write(txt)


# ---------------------------------------------------------------- in-game shots + contact sheet
def shot(out, query, budget=int(os.environ.get('VT', 60000))):
    """Headless Chrome screenshot like tools/shot.sh, with a longer virtual-time budget so far tiles can stream in."""
    import shutil, tempfile
    prof = tempfile.mkdtemp(prefix='palermo-shot.')
    try:
        subprocess.run(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '--headless=new', f'--user-data-dir={prof}',
                        '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--window-size=1280,720',
                        f'--virtual-time-budget={budget}', f'--screenshot={out}', f'http://localhost:8790/?help=0&{query}'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def clear_distance(bid, px, pz, n, want):
    """How far in front of the wall point (px, pz) a camera can stand without a building in between (<= want)."""
    near = []
    for bp in neighbour_buildings(bid):
        xs, zs = bp[0::2], bp[1::2]
        if min(xs) - 5 < px + n[0] * want and max(xs) + 5 > px or True:
            if max(xs) >= min(px, px + n[0] * want) - 2 and min(xs) <= max(px, px + n[0] * want) + 2 and \
               max(zs) >= min(pz, pz + n[1] * want) - 2 and min(zs) <= max(pz, pz + n[1] * want) + 2:
                near.append(bp)
    d = 2.0
    while d < want:
        if any(point_in(px + n[0] * d, pz + n[1] * d, p) for p in near):
            return max(d - 1.5, 6.0)
        d += 1.0
    return want


def shots():
    os.makedirs(SHOTS, exist_ok=True)
    for s in SOURCES:
        if len(sys.argv) > 2 and s['key'] not in sys.argv[2:]:
            continue
        wi = wall_info(s['bid'], s['wall']); b = wi['b']
        c0, c1 = s['cover']
        f = (c0 + c1) / 2
        px = wi['a'][0] + (wi['e'][0] - wi['a'][0]) * f; pz = wi['a'][1] + (wi['e'][1] - wi['a'][1]) * f
        want = max(wi['L'] * (c1 - c0), wi['H']) * 1.15 + 8
        d = clear_distance(s['bid'], px, pz, wi['n'], want)
        cx, cz = px + wi['n'][0] * d, pz + wi['n'][1] * d
        y0 = ground_of(s['bid']) + (4 if d >= want - .5 else 4 + (want - d) * .5)      # tight street: stand higher and look down
        q = f"campos={cx:.1f},{y0:.1f},{cz:.1f}&look={px:.1f},{ground_of(s['bid']) + wi['H'] * .45:.1f},{pz:.1f}"
        for tag, extra in (('photo', ''), ('proc', '&photomap=none')):   # photomap=none: procedural baseline
            if os.environ.get('TAGS') and tag not in os.environ['TAGS'].split(','):
                continue
            out = os.path.join(SHOTS, f"{s['key']}_{tag}.png")
            log('shot', s['key'], tag, q)
            shot(out, q + extra)


def sheet(per_page=7):
    from PIL import ImageDraw
    mp = json.load(open(os.path.join(OUT, 'map.json')))
    cw, ch = 480, 290
    rows = []
    for s in SOURCES:
        m = meta_for(s)
        ph = cv2.imread(os.path.join(SRC, fname(s['title'])))
        k = ph.shape[1] / s['dw']
        q = (np.array(s['quad'], np.float32) * k).astype(np.int32)
        x0, y0 = max(0, q[:, 0].min()), max(0, q[:, 1].min()); x1, y1 = q[:, 0].max(), q[:, 1].max()
        padx, pady = int((x1 - x0) * .06), int((y1 - y0) * .06)
        crop = ph[max(0, y0 - pady):y1 + pady, max(0, x0 - padx):x1 + padx]
        photo = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        tex = Image.open(os.path.join(ROOT, 'assets/facades/photo', s['key'] + '.jpg'))
        games = []
        for tag in ('proc', 'photo'):
            gp = os.path.join(SHOTS, f"{s['key']}_{tag}.png")
            games.append(Image.open(gp).convert('RGB') if os.path.exists(gp) else Image.new('RGB', (cw, ch), 'gray'))
        cells = []
        for im in (photo, tex, *games):
            im = im.convert('RGB'); im.thumbnail((cw, ch)); c = Image.new('RGB', (cw, ch + 18), (30, 30, 30))
            c.paste(im, ((cw - im.width) // 2, 18 + (ch - im.height) // 2)); cells.append(c)
        d = [ImageDraw.Draw(c) for c in cells]
        d[0].text((4, 3), f"{s['name'][:48]}  |  photo ({m['lic']})", fill='white')
        d[1].text((4, 3), 'rectified texture (final size)', fill='white')
        d[2].text((4, 3), 'in-game, procedural facade', fill='white')
        d[3].text((4, 3), 'in-game, photo facade', fill='white')
        row = Image.new('RGB', (cw * 4, ch + 18))
        for i, c in enumerate(cells): row.paste(c, (i * cw, 0))
        rows.append(row)
    for pg in range((len(rows) + per_page - 1) // per_page):
        part = rows[pg * per_page:(pg + 1) * per_page]
        sh = Image.new('RGB', (cw * 4, (ch + 18) * len(part)))
        for i, r in enumerate(part): sh.paste(r, (0, i * (ch + 18)))
        path = SHEET if pg == 0 else SHEET.replace('.png', f'-{pg + 1}.png')
        sh.save(path)
        log('wrote', path, sh.size)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    {'fetch': fetch, 'build': build, 'shots': shots, 'sheet': sheet}[cmd]()
