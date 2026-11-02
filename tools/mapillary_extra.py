#!/usr/bin/env python3
"""Faithfulness rounds: reference photos for the places in tools/faith_places.json (the ones the 304 survey viewpoints miss).

  python3 tools/mapillary_extra.py [OUT_DIR]        default OUT_DIR=/private/tmp/claude-501/round2

For each place: ask the Mapillary Graph API for images inside the place's radius, keep up to n non-panoramic ones (newest first,
different headings, at least 8 m apart) and write OUT_DIR/ref/<id>_<k>.jpg and OUT_DIR/meta/<id>_<k>.json in the same shape as
tools/mapillary_refs.py, so tools/faith_shoot.mjs and tools/faith_sheet.py treat them like any other viewpoint.
Token: data/mapillary_token or $MAPILLARY_TOKEN, sent only as a header, never printed or stored. Photos are CC BY-SA: outside the repo, looked at only.
"""
import json, os, sys, io, math, urllib.request
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else '/private/tmp/claude-501/round2'
os.makedirs(OUT + '/ref', exist_ok=True); os.makedirs(OUT + '/meta', exist_ok=True)
tok = os.environ.get('MAPILLARY_TOKEN') or open(ROOT + '/data/mapillary_token').read().strip()
def get(url):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'OAuth ' + tok}), timeout=60).read())
def dist(a, b):
    return math.hypot((a[0] - b[0]) * 111320 * math.cos(math.radians(a[1])), (a[1] - b[1]) * 110540)
def angd(a, b): return abs((a - b + 180) % 360 - 180)
import datetime
for pl in json.load(open(ROOT + '/tools/faith_places.json'))['places']:
    dl = pl['r'] / (111320 * math.cos(math.radians(pl['lat']))); dp = pl['r'] / 110540
    bb = f"{pl['lon'] - dl},{pl['lat'] - dp},{pl['lon'] + dl},{pl['lat'] + dp}"
    try:
        imgs = get(f"https://graph.mapillary.com/images?bbox={bb}&fields=id,computed_geometry,computed_compass_angle,captured_at,is_pano&limit=1000").get('data', [])
    except Exception as e:
        print(pl['id'], 'search failed', type(e).__name__); continue
    c = [i for i in imgs if not i.get('is_pano') and 'computed_geometry' in i and i.get('computed_compass_angle') is not None
         and dist(i['computed_geometry']['coordinates'], (pl['lon'], pl['lat'])) <= pl['r']]
    c.sort(key=lambda i: -i['captured_at']); keep = []
    for i in c:
        g, h = i['computed_geometry']['coordinates'], i['computed_compass_angle']
        if all(angd(h, k[1]) > 60 or dist(g, k[0]) > 8 for k in keep) and all(angd(h, k[1]) > 40 for k in keep): keep.append((g, h, i))
        if len(keep) >= pl['n']: break
    print(pl['id'], pl['name'], ':', len(imgs), 'images,', len(c), 'in radius,', len(keep), 'kept')
    for k, (g, h, i) in enumerate(keep):
        vid = f"{pl['id']}_{k}"
        try:
            r = get(f"https://graph.mapillary.com/{i['id']}?fields=thumb_1024_url")
            im = Image.open(io.BytesIO(urllib.request.urlopen(r['thumb_1024_url'], timeout=60).read())).convert('RGB'); im.thumbnail((1024, 1024)); im.save(f'{OUT}/ref/{vid}.jpg', quality=88)
            cap = datetime.datetime.fromtimestamp(i['captured_at'] / 1000, datetime.timezone.utc).strftime('%Y-%m-%d')
            json.dump({'id': vid, 'lat': g[1], 'lon': g[0], 'heading': h, 'captured': cap, 'is_pano': False, 'vp': {}, 'area': 'extra', 'name': pl['name'],
                       'distance_m': round(dist(g, (pl['lon'], pl['lat'])), 1), 'age_years': round((datetime.datetime.now(datetime.timezone.utc).timestamp() - i['captured_at'] / 1000) / 31557600, 1)}, open(f'{OUT}/meta/{vid}.json', 'w'))
        except Exception as e:
            print(vid, 'download failed', type(e).__name__)

# game-only places: four headings each, no photo
for pl in json.load(open(ROOT + '/tools/faith_places.json')).get('around', []):
    for k, h in enumerate((0, 90, 180, 270)):
        vid = f"{pl['id']}_{k}"
        json.dump({'id': vid, 'lat': pl['lat'], 'lon': pl['lon'], 'heading': h, 'captured': '', 'is_pano': False, 'vp': {}, 'area': 'around', 'name': pl['name'] + f' {h}deg', 'distance_m': 0, 'age_years': 0}, open(f'{OUT}/meta/{vid}.json', 'w'))
print('game-only places written:', len(json.load(open(ROOT + '/tools/faith_places.json')).get('around', [])))

# landmark stand-off shots: 6 m up, dist metres out on each compass side (or one frontal shot when "front" is given), looking at the centre
for so in json.load(open(ROOT + '/tools/faith_places.json')).get('standoff', []):
    sides = {'N': (0, -1), 'E': (1, 0), 'S': (0, 1), 'W': (-1, 0)} if 'front' not in so else {'F': tuple(so['front']), 'E': (1, 0)}
    for k, (nm, (dx, dz)) in enumerate(sides.items()):
        n = math.hypot(dx, dz); x = so['x'] + dx / n * so['dist']; z = so['z'] + dz / n * so['dist']
        head = math.degrees(math.atan2(so['x'] - x, -(so['z'] - z))) % 360
        vid = f"{so['id']}_{nm}"
        json.dump({'id': vid, 'x': x, 'z': z, 'eye': 6, 'lat': 0, 'lon': 0, 'heading': head, 'captured': '', 'is_pano': False, 'vp': {}, 'area': 'standoff', 'name': f"{so['name']} from {nm}", 'distance_m': so['dist'], 'age_years': 0}, open(f'{OUT}/meta/{vid}.json', 'w'))
print('stand-off places written')
