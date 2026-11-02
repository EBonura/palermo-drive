#!/usr/bin/env python3
"""Faithfulness rounds, step 3: contact sheets, game on the left and the Mapillary photo on the right, id and photo date printed on each.

  python3 tools/faith_sheet.py [ROUND_DIR] [--per 6] [--only ce,po]

Reads ROUND/shots/<id>.png (tools/faith_shoot.mjs) and ROUND/ref/<id>.jpg + ROUND/meta/<id>.json (tools/mapillary_refs.py), writes
ROUND/sheets/sheet-NN.jpg (6 pairs each, two pairs per row, most important places first) and ROUND/sheets/index.txt (which ids are on which sheet).
Needs only Pillow. Nothing here goes into the repo: the photos are CC BY-SA.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:]]
per = int(args[args.index('--per') + 1]) if '--per' in args else 6
only = args[args.index('--only') + 1].split(',') if '--only' in args else None
grid = '--grid' in args   # game-only shots (no photo): 3 x 2 shots per sheet, id printed on each
pos = [a for i, a in enumerate(args) if not a.startswith('--') and (i == 0 or not args[i - 1].startswith('--'))]
ROUND = pos[0] if pos else '/private/tmp/claude-501/round2'

# the places a Palermitan would check first, in this order; everything else follows by id
PRIORITY = ('ce01 ce02 ce03 ce04 ce05 ce27 ce08 ce10 ce12 ce13 ce15 ce18 ce09 ce16 ce22 ce25 ce32 '
            'po01 po02 po08 po09 po10 po11 po12 pt01 pt02 pt03 pt04 pt05 pt06 pt07 pt08 pt19 pt14 '
            'lm01 lm14 lm09 lm18 mo01 mo02 mo05 mo06 mo07 mo12 pe32 pe06 pe08 pe13 pe14 pe15 pe16 '
            'zi05 zi06 zi08 zi15 su02 su04 su05 su07 lm19 lm23').split()
ids = sorted(f[:-4] for f in os.listdir(ROUND + '/shots') if f.endswith('.png') and os.path.exists(f'{ROUND}/ref/{f[:-4]}.jpg') != grid)
ids = [i for i in PRIORITY if i in ids] + [i for i in ids if i not in PRIORITY]
if only: ids = [i for i in ids if any(i.startswith(o) for o in only)]
os.makedirs(ROUND + '/sheets', exist_ok=True)
W, H, G, LAB = 384, 288, 6, 20
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
except Exception: font = ImageFont.load_default()

def fit(im):
    im = im.convert('RGB'); im.thumbnail((W, H)); out = Image.new('RGB', (W, H), (30, 30, 30)); out.paste(im, ((W - im.width) // 2, (H - im.height) // 2)); return out

cols = 2; pw = 2 * W + G
if grid:
    for s in range(0, len(ids), 6):
        chunk = ids[s:s + 6]; sheet = Image.new('RGB', (3 * (W + G), 2 * (H + LAB + G)), (12, 12, 12)); d = ImageDraw.Draw(sheet)
        for k, i in enumerate(chunk):
            r, c = divmod(k, 3); x0 = c * (W + G); y0 = r * (H + LAB + G)
            sheet.paste(fit(Image.open(f'{ROUND}/shots/{i}.png')), (x0, y0 + LAB)); d.text((x0 + 2, y0 + 2), f"{i}  {json.load(open(f'{ROUND}/meta/{i}.json'))['name']}", fill=(255, 255, 255), font=font)
        sheet.save(f'{ROUND}/sheets/around-{s // 6 + 1:02d}.jpg', quality=82)
    print(len(ids), 'game-only shots in', ROUND + '/sheets/around-NN.jpg'); sys.exit(0)
index = []
for s in range(0, len(ids), per):
    chunk = ids[s:s + per]; rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * pw + (cols - 1) * 14, rows * (H + LAB + G)), (12, 12, 12)); d = ImageDraw.Draw(sheet)
    for k, i in enumerate(chunk):
        m = json.load(open(f'{ROUND}/meta/{i}.json')); r, c = divmod(k, cols); x0 = c * (pw + 14); y0 = r * (H + LAB + G)
        sheet.paste(fit(Image.open(f'{ROUND}/shots/{i}.png')), (x0, y0 + LAB))
        sheet.paste(fit(Image.open(f'{ROUND}/ref/{i}.jpg')), (x0 + W + G, y0 + LAB))
        d.text((x0 + 2, y0 + 2), f"{i}  {m['name'][:34]}   GAME", fill=(255, 255, 255), font=font)
        d.text((x0 + W + G + 2, y0 + 2), f"PHOTO {m['captured'][:7]} ({m['age_years']} y)" + ('  pano crop' if m['is_pano'] else ''), fill=(255, 220, 120), font=font)
    n = s // per + 1; name = f"sheet-{''.join(only)}-{n:02d}.jpg" if only else f'sheet-{n:02d}.jpg'
    sheet.save(f'{ROUND}/sheets/{name}', quality=82)
    index.append(f"{name}: {' '.join(chunk)}")
open(ROUND + '/sheets/index' + (('-' + ''.join(only)) if only else '') + '.txt', 'w').write('\n'.join(index) + '\n')
print(len(ids), 'pairs,', len(index), 'sheets in', ROUND + '/sheets')
