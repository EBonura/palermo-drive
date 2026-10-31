#!/usr/bin/env python3
"""Photo facade textures for a few hero buildings (rectified Wikimedia Commons photos).

    tools/.venv/bin/python tools/facade_photos.py fetch   # download the source photos + licence metadata
    tools/.venv/bin/python tools/facade_photos.py build   # rectify, clean, colour-correct, write textures,
                                                          # assets/facades/photo/map.json, assets/CREDITS.md block
    tools/.venv/bin/python tools/facade_photos.py shots   # in-game screenshots of the same walls (needs the server)
    tools/.venv/bin/python tools/facade_photos.py sheet   # contact sheet: photo | texture | in-game

Needs numpy, pillow, opencv-python-headless (all in tools/.venv). Photos go to SRC (outside the repo, never executed).

map.json: { buildingId: [ { wall, texture, u0, u1, v0, v1, flip, size, license, credit } ] }
  buildingId  id in PALERMO_DATA.buildings
  wall        index i of the footprint edge b.p[2i..2i+1] -> b.p[2i+2..2i+3] (wrapping), in the ORIGINAL ring order of
              b.p (if the renderer reverses the ring to fix the winding, map the index accordingly)
  u0, u1      fraction of that edge (0 at the start vertex, 1 at the end vertex) the texture covers, u0 < u1
  v0, v1      fraction of the wall height (0 = ground g, 1 = roof r) the texture covers
  flip        false: image x grows from u0 to u1 along the edge. true: the image seen from OUTSIDE has its left edge
              at u1 (the edge runs right to left for a viewer in front of it), so mirror the u mapping
  size        [w, h] pixels of the texture
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
MAX_SIDE = 512          # PS2-era: long side of every texture
MARK0, MARK1 = '<!-- facade_photos:begin -->', '<!-- facade_photos:end -->'

# One entry per rectified facade. quad = the 4 corners of the facade plane in the photo as seen in a view
# `dw` px wide (top-left, top-right, bottom-right, bottom-left). cover = [c0, c1] fraction of the footprint edge
# (from its start vertex) that the quad spans. split = cut the result into n equal textures. fix = obstructions to
# paint out: ('poly', [pts]) or ('line', [pts], width), same view coordinates.
SOURCES = [
    dict(key='riso', bid='w926546486', name='Palazzo Belmonte Riso (Corso Vittorio Emanuele)', wall=5, cover=[0, 1],
         title='Palazzo Belmonte Riso Palermo 2024-07-26 11.52.14.jpg', dw=2000,
         quad=[[350, 108], [1660, 338], [1735, 1160], [262, 1150]],
         fix=[('poly', [[1130, 1105], [1320, 1105], [1320, 1345], [1130, 1345]]),
              ('poly', [[620, 940], [700, 940], [700, 1060], [620, 1060]]),
              ('poly', [[480, 1090], [620, 1090], [620, 1300], [480, 1300]]),
              ('line', [[0, 452], [1680, 682]], 7)]),
    dict(key='gangi', bid='r4779709.0', name='Palazzo Valguarnera-Gangi (Piazza Croce dei Vespri)', wall=8, cover=[0, 1],
         title='Palazzo Gangi (Palermo) 14 07 2024 01.jpg', dw=2000,
         quad=[[130, 190], [1680, 180], [1690, 1160], [135, 1180]],
         fix=[('poly', [[1360, 835], [1535, 835], [1540, 1365], [1360, 1365]]),
              ('poly', [[340, 1040], [462, 1040], [462, 1200], [340, 1200]]),
              ('poly', [[700, 1035], [952, 1035], [952, 1215], [700, 1215]])]),
]


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- data
def load_data():
    s = open(os.path.join(ROOT, 'palermo-data.js'), encoding='utf8').read()
    return json.loads(s[s.index('{'): s.rindex('}') + 1])


def wall_info(D, bid, wall):
    b = next(b for b in D['buildings'] if b['id'] == bid)
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
def api(**kw):
    kw['format'] = 'json'
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(kw)
    for i in range(8):
        try:
            time.sleep(1.5)
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA)))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(12 * (i + 1))
    raise RuntimeError('Commons rate limit')


def fname(title):
    return re.sub(r'[ ,()]', lambda m: '_' if m.group() == ' ' else '', title)


def fetch(width=2400):
    os.makedirs(SRC, exist_ok=True)
    for s in SOURCES:
        fn = fname(s['title']); path = os.path.join(SRC, fn)
        if os.path.exists(path) and os.path.exists(path + '.json'):
            continue
        r = api(action='query', titles='File:' + s['title'], prop='imageinfo', iiprop='url|size|extmetadata', iiurlwidth=width)
        ii = list(r['query']['pages'].values())[0]['imageinfo'][0]; m = ii['extmetadata']
        url = ii['thumburl'] if ii['width'] > width else ii['url']
        for i in range(8):
            try:
                time.sleep(2)
                data = urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read(); break
            except urllib.error.HTTPError as e:
                if e.code != 429:
                    raise
                time.sleep(15 * (i + 1))
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
    """Inpaint the obstructions (poles, signs, plants, wires) listed in s['fix']."""
    k = img.shape[1] / s['dw']
    mask = np.zeros(img.shape[:2], np.uint8)
    for f in s.get('fix', []):
        pts = (np.array(f[1], np.float32) * k).astype(np.int32)
        if f[0] == 'poly':
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
    gain = np.clip((g / m) ** 0.55, .8, 1.25)
    f = f * gain
    # flatten large-scale lighting (sun/shade gradients, sky glow) without touching the detail
    lum = f.mean(2)
    sig = max(f.shape[:2]) / 7
    low = cv2.GaussianBlur(lum, (0, 0), sig)
    f = f * np.clip((low.mean() / np.maximum(low, 1e-3)) ** .55, .6, 1.7)[..., None]
    # tone: percentile stretch to a mid-key range, slightly desaturated
    lo, hi = np.percentile(f, 1), np.percentile(f, 99.5)
    f = np.clip((f - lo) / max(hi - lo, 1e-3), 0, 1)
    f = 0.05 + 0.88 * f ** 0.95
    gray = f.mean(2, keepdims=True)
    f = gray + (f - gray) * .92
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
    W2 = 2 * MAX_SIDE
    ppm = W2 / max(Lc, wi['H'])
    wp, hp = int(round(Lc * ppm)), int(round(wi['H'] * ppm))
    src = (np.array(s['quad'], np.float32) * k)
    dst = np.array([[0, 0], [wp, 0], [wp, hp], [0, hp]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (wp, hp), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE), Lc


def build():
    D = load_data()
    os.makedirs(OUT, exist_ok=True)
    mp = {}; creds = []
    for s in SOURCES:
        wi = wall_info(D, s['bid'], s['wall'])
        rect, Lc = rectify(s, wi)
        rect = correct(rect)
        m = meta_for(s)
        n = s.get('split', 1)
        c0, c1 = s['cover']
        for i in range(n):
            x0, x1 = rect.shape[1] * i // n, rect.shape[1] * (i + 1) // n
            piece = rect[:, x0:x1]
            ph, pw = piece.shape[:2]
            sc = MAX_SIDE / max(pw, ph)
            fw, fh = max(4, int(round(pw * sc / 4)) * 4), max(4, int(round(ph * sc / 4)) * 4)
            small = cv2.resize(piece, (fw, fh), interpolation=cv2.INTER_AREA)
            small = cv2.addWeighted(small, 1.25, cv2.GaussianBlur(small, (0, 0), 1.0), -.25, 0)   # slight crunch
            name = s['key'] + (f'_{i + 1}' if n > 1 else '') + '.jpg'
            cv2.imwrite(os.path.join(OUT, name), small, [cv2.IMWRITE_JPEG_QUALITY, 88])
            # u range of this piece, measured from the edge's start vertex. The image shows the quad left to right as
            # seen from outside; when the edge runs right-to-left for that viewer the image-left is at c1.
            a, b = i / n, (i + 1) / n
            if wi['flip']:
                u0, u1 = c1 - (c1 - c0) * b, c1 - (c1 - c0) * a
            else:
                u0, u1 = c0 + (c1 - c0) * a, c0 + (c1 - c0) * b
            credit = f"{m['author']}, {m['title']}, {m['lic']}, {m['url']}"
            mp.setdefault(s['bid'], []).append(dict(
                wall=s['wall'], texture='assets/facades/photo/' + name, u0=round(u0, 4), u1=round(u1, 4), v0=0, v1=1,
                flip=bool(wi['flip']), size=[fw, fh], license=m['lic'], credit=credit))
            log(f"{name}: {fw}x{fh}  {s['name']}  wall {wi['L']:.1f} x {wi['H']:.1f} m  flip={wi['flip']}  {m['lic']}")
        creds.append((s, m))
    json.dump(mp, open(os.path.join(OUT, 'map.json'), 'w'), indent=1)
    write_credits(creds)


def write_credits(creds):
    path = os.path.join(ROOT, 'assets/CREDITS.md')
    txt = open(path, encoding='utf8').read() if os.path.exists(path) else ''
    seen = {}
    for s, m in creds:
        seen.setdefault(m['title'], (s, m))
    rows = ['| Texture | Title | Author | Licence | Source | Changes |', '| --- | --- | --- | --- | --- | --- |']
    for s, m in creds:
        tex = 'facades/photo/' + s['key'] + ('_N' if s.get('split', 1) > 1 else '') + '.jpg'
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
def shots():
    D = load_data()
    os.makedirs(SHOTS, exist_ok=True)
    for s in SOURCES:
        wi = wall_info(D, s['bid'], s['wall']); b = wi['b']
        c0, c1 = s['cover']
        f = (c0 + c1) / 2
        px = wi['a'][0] + (wi['e'][0] - wi['a'][0]) * f; pz = wi['a'][1] + (wi['e'][1] - wi['a'][1]) * f
        d = max(wi['L'] * (c1 - c0), wi['H']) * 1.15 + 8
        # a little off-axis so a corner building doesn't hide it
        y0 = b['g'] + 5
        cx, cz = px + wi['n'][0] * d, pz + wi['n'][1] * d
        q = f"campos={cx:.1f},{y0:.1f},{cz:.1f}&look={px:.1f},{b['g'] + wi['H'] * .45:.1f},{pz:.1f}"
        out = os.path.join(SHOTS, s['key'] + '_game.png')
        log('shot', s['key'], q)
        subprocess.run([os.path.join(ROOT, 'tools/shot.sh'), out, q], cwd=ROOT)


def sheet():
    from PIL import ImageDraw
    D = load_data(); mp = json.load(open(os.path.join(OUT, 'map.json')))
    cw, ch = 560, 330
    rows = []
    for s in SOURCES:
        if s.get('split', 1) > 1 and s['key'] != s['key']:
            continue
        m = meta_for(s)
        ph = cv2.imread(os.path.join(SRC, fname(s['title'])))
        k = ph.shape[1] / s['dw']
        q = (np.array(s['quad'], np.float32) * k).astype(np.int32)
        x0, y0 = q[:, 0].min(), q[:, 1].min(); x1, y1 = q[:, 0].max(), q[:, 1].max()
        padx, pady = int((x1 - x0) * .06), int((y1 - y0) * .06)
        crop = ph[max(0, y0 - pady):y1 + pady, max(0, x0 - padx):x1 + padx]
        photo = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
        ents = [e for e in mp[s['bid']] if os.path.basename(e['texture']).startswith(s['key'])]
        # stitch split textures back together (in the order the viewer sees them)
        ims = [Image.open(os.path.join(ROOT, e['texture'])) for e in ents]
        if len(ims) > 1:
            ims.sort(key=lambda im: 0)
            tw = sum(i.width for i in ims); tex = Image.new('RGB', (tw, ims[0].height)); x = 0
            order = sorted(range(len(ents)), key=lambda i: ents[i]['u0'], reverse=ents[0]['flip'])
            for i in order:
                tex.paste(ims[i], (x, 0)); x += ims[i].width
        else:
            tex = ims[0]
        gp = os.path.join(SHOTS, s['key'] + '_game.png')
        game = Image.open(gp).convert('RGB') if os.path.exists(gp) else Image.new('RGB', (cw, ch), 'gray')
        cells = []
        for im in (photo, tex, game):
            im = im.convert('RGB'); im.thumbnail((cw, ch)); c = Image.new('RGB', (cw, ch + 18), (30, 30, 30))
            c.paste(im, ((cw - im.width) // 2, 18 + (ch - im.height) // 2)); cells.append(c)
        d = [ImageDraw.Draw(c) for c in cells]
        d[0].text((4, 3), f"{s['name']}  |  photo ({m['lic']})", fill='white')
        d[1].text((4, 3), 'rectified texture (final size)', fill='white')
        d[2].text((4, 3), 'in-game now (procedural)', fill='white')
        row = Image.new('RGB', (cw * 3, ch + 18))
        for i, c in enumerate(cells): row.paste(c, (i * cw, 0))
        rows.append(row)
    sh = Image.new('RGB', (cw * 3, (ch + 18) * len(rows)))
    for i, r in enumerate(rows): sh.paste(r, (0, i * (ch + 18)))
    sh.save(SHEET)
    log('wrote', SHEET, sh.size)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    {'fetch': fetch, 'build': build, 'shots': shots, 'sheet': sheet}[cmd]()
