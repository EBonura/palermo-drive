#!/usr/bin/env python3
"""Download the Mapillary reference photos for the faithfulness rounds (outside the repo).

  python3 tools/mapillary_refs.py [OUT_DIR]        default OUT_DIR=/private/tmp/claude-501/round2

Reads docs/faithfulness/survey/mapillary.json (the viewpoints that have a photo), asks the Mapillary Graph API
for each image (position, heading, capture date, 1024 px thumbnail) and writes, per viewpoint id:
  OUT_DIR/ref/<id>.jpg    the photo (panoramas are cropped to the viewpoint heading, about 75 degrees wide)
  OUT_DIR/meta/<id>.json  { lat, lon, heading, captured, is_pano, vp: {lat, lon, heading} } where lat/lon/heading
                          are the PHOTO position and heading (what the game camera should copy)
Skips files that already exist. The token is read from data/mapillary_token (git-ignored) or $MAPILLARY_TOKEN and
is sent only as an Authorization header: it is never printed or written anywhere.
The photos are CC BY-SA: they stay outside the repo and are only looked at, never committed or copied into the game.
"""
import json, os, sys, io, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/claude-501/round2'
os.makedirs(OUT + '/ref', exist_ok=True); os.makedirs(OUT + '/meta', exist_ok=True)
tok = os.environ.get('MAPILLARY_TOKEN') or open(ROOT + '/data/mapillary_token').read().strip()
FIELDS = 'thumb_1024_url,thumb_2048_url,computed_geometry,geometry,compass_angle,computed_compass_angle,captured_at,is_pano'

def get(url, binary=False):
    req = urllib.request.Request(url, headers={'Authorization': 'OAuth ' + tok})
    data = urllib.request.urlopen(req, timeout=60).read()
    return data if binary else json.loads(data)

def fetch_url(url):  # CDN thumbnails are public signed URLs: no header needed
    return urllib.request.urlopen(url, timeout=60).read()

def one(v):
    vid = v['id']
    if os.path.exists(f'{OUT}/ref/{vid}.jpg') and os.path.exists(f'{OUT}/meta/{vid}.json'):
        return vid, 'have'
    try:
        r = get(f"https://graph.mapillary.com/{v['mapillary_image_id']}?fields={FIELDS}")
        pano = bool(r.get('is_pano'))
        g = (r.get('computed_geometry') or r['geometry'])['coordinates']
        comp = r.get('computed_compass_angle', r.get('compass_angle')) if not v['is_pano'] else r.get('compass_angle', 0)
        im = Image.open(io.BytesIO(fetch_url(r['thumb_2048_url'] if pano else r['thumb_1024_url']))).convert('RGB')
        if pano:  # equirectangular: cut 75 degrees around the viewpoint heading (plain crop, slightly stretched at the edges)
            W, H = im.size; centre = ((v['heading'] - (comp or 0)) % 360) / 360 * W + W / 2
            cw = W * 75 / 360; ch = cw * 0.75
            x0 = int(centre - cw / 2); y0 = int(H / 2 - ch / 2)
            strip = Image.new('RGB', (int(cw), int(ch)))
            for dx, sx in ((0, x0 % W),):
                strip.paste(im.crop((sx, y0, min(sx + int(cw), W), y0 + int(ch))), (0, 0))
                got = min(sx + int(cw), W) - sx
                if got < int(cw): strip.paste(im.crop((0, y0, int(cw) - got, y0 + int(ch))), (got, 0))
            im = strip.resize((1024, 768))
            heading = v['heading']
        else:
            heading = v['compass_angle_used']
        im.thumbnail((1024, 1024)); im.save(f'{OUT}/ref/{vid}.jpg', quality=88)
        json.dump({'id': vid, 'lat': g[1], 'lon': g[0], 'heading': heading, 'captured': v['captured'], 'is_pano': pano,
                   'vp': {'lat': v['lat'], 'lon': v['lon'], 'heading': v['heading']}, 'area': v['area'], 'name': v['name'],
                   'distance_m': v['distance_m'], 'age_years': v['age_years']}, open(f'{OUT}/meta/{vid}.json', 'w'))
        return vid, 'ok'
    except Exception as e:
        return vid, 'ERR ' + type(e).__name__ + ' ' + str(e)[:80]

vps = [x for x in json.load(open(ROOT + '/docs/faithfulness/survey/mapillary.json'))['viewpoints'] if x['coverage'] == 'photo']
with ThreadPoolExecutor(4) as ex:
    res = list(ex.map(one, vps))
bad = [r for r in res if r[1].startswith('ERR')]
print(len(res), 'viewpoints,', sum(r[1] == 'ok' for r in res), 'downloaded,', sum(r[1] == 'have' for r in res), 'already there,', len(bad), 'failed')
for b in bad: print(b)
