#!/usr/bin/env python3
"""Bake the danger-zone grid (src/danger-data.js) from the ISTAT UPL outlines.

  python3 -I tools/danger.py PATH/Palermo.html            # -> src/danger-data.js
  python3 -I tools/danger.py PATH/Palermo.html --table    # also prints the markdown tables for docs/danger.md

Input: Palermo.html from ISTAT's IDISE 2023 release (the leaflet map of Palermo, 3,600 census sections, each carrying the code of its
UPL, the 55 "Unita di Primo Livello"). The UPL outlines are the union of their sections. They are rasterised on a CELL metre grid in
game metres (x east, z south, Quattro Canti at 0,0, same projection as src/core.js); cells in no section take the neighbouring UPL if one
touches them (street gaps), the rest is "no data" (index 0: sea, port, open country, parks). The grid is stored run-length coded.
The level of each UPL is a game-design call (LEVEL below, see docs/danger.md); IDISE measures socio-economic hardship, not crime.
Re-run after changing LEVEL or NAME. The output is derived, never edit it.
"""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAT0, LON0 = 38.11572, 13.36126
KX, KZ = math.cos(LAT0 * math.pi / 180) * 111320, 110540
CELL = 100
NODATA = 2      # level of the no-data cells (port, open country, parks, sea front)

# code (last 3 digits of the ISTAT ASC code 82053xxx) -> (name shown in the entry toast, final level, IDISE 2023, draft quintile)
U = {}
def u(code, name, level, idise, draft): U[code] = (name, level, idise, draft)
u(1, 'Kalsa', 2, 102.69, 4);               u(2, 'Albergheria', 3, 109.71, 5);        u(3, 'Il Capo', 3, 107.61, 5)
u(4, 'La Loggia', 2, 102.59, 4);           u(5, 'Corso dei Mille', 2, 102.04, 3);    u(6, 'Settecannoli', 3, 102.55, 4)
u(7, 'Roccella', 4, 104.64, 5);            u(8, 'Brancaccio', 5, 106.24, 5);         u(9, 'Ciaculli', 4, 104.15, 5)
u(10, 'Oreto', 3, 104.31, 5);              u(11, 'Guadagna', 2, 101.03, 3);          u(12, 'Falsomiele', 3, 102.27, 4)
u(13, 'Bonagia', 2, 98.97, 2);             u(14, 'Chiavelli', 3, 103.16, 4);         u(15, 'Villagrazia', 2, 100.75, 3)
u(16, 'Montegrappa', 2, 102.75, 4);        u(17, 'Villaggio Santa Rosalia', 3, 102.29, 4); u(18, 'Cuba - Calatafimi', 2, 99.62, 2)
u(19, 'Villa Tasca', 2, 97.51, 2);         u(20, 'Mezzomonreale', 2, 97.94, 2);      u(21, 'Zisa', 4, 105.11, 5)
u(22, 'Quattro Camere', 2, 97.22, 2);      u(23, 'Altarello', 3, 103.89, 5);         u(24, 'Baida', 2, 102.22, 4)
u(25, 'Borgo Vecchio', 2, 101.45, 3);      u(26, 'Politeama', 1, 93.25, 1);          u(27, 'Terrasanta', 1, 94.58, 1)
u(28, 'Olivuzza', 2, 100.77, 3);           u(29, 'Serradifalco', 2, 99.94, 3);       u(30, 'Noce', 3, 103.14, 4)
u(31, 'Leonardo da Vinci', 1, 94.82, 1);   u(32, 'Malaspina', 1, 93.58, 1);          u(33, 'Principe di Palagonia', 1, 92.92, 1)
u(34, 'Uditore', 2, 97.29, 2);             u(35, 'Passo di Rigano', 2, 101.55, 3);   u(36, 'Borgo Nuovo', 4, 104.11, 5)
u(37, 'San Giovanni Apostolo', 2, 100.67, 3); u(38, 'Cruillas', 2, 99.84, 3);        u(39, 'Notarbartolo', 1, 93.03, 1)
u(40, 'Villa Sperlinga', 1, 92.77, 1);     u(41, 'Quartiere Matteotti', 1, 92.57, 1); u(42, 'Villabianca', 1, 94.13, 1)
u(43, 'Resuttana', 1, 92.44, 1);           u(44, 'San Lorenzo', 1, 95.28, 1);        u(45, 'Patti', 2, 99.43, 2)
u(46, 'Pallavicino', 2, 98.28, 2);         u(47, 'ZEN', 5, 111.34, 5);               u(48, 'Tommaso Natale', 2, 99.16, 2)
u(49, 'Sferracavallo', 2, 101.87, 3);      u(50, 'Mondello', 1, 97.86, 2);           u(51, 'Cantieri', 3, 104.25, 5)
u(52, 'Monte Pellegrino', 1, 96.99, 2);    u(53, 'Acquasanta', 3, 103.73, 4);        u(54, 'Arenella', 3, 102.29, 4)
u(55, 'Vergine Maria', 2, 100.32, 3)
UPL_IT = {  # the ISTAT names, for the docs table
    1: 'Tribunali o Kalsa', 2: 'Palazzo Reale o Albergaria', 3: 'Monte di Pietà o Seralcadi', 4: 'Castellammare o Loggia', 5: 'Corso dei Mille - S.Erasmo',
    6: 'Settecannoli', 7: 'Roccella Acqua dei Corsari', 8: 'Brancaccio Conte Federico', 9: 'Ciaculli Croce Verde', 10: 'Oreto Perez', 11: 'Oreto Guadagna',
    12: 'Falsomiele Borgo Ulivia', 13: 'Bonagia', 14: 'Chiavelli - S.Maria di Gesù', 15: 'Villagrazia', 16: 'Montegrappa', 17: 'S.Rosalia',
    18: 'Cuba - Calatafimi', 19: 'Villa Tasca', 20: 'Mezzomonreale', 21: 'Zisa - Ingastone', 22: 'Zisa - 4 Camere', 23: 'Altarello - Tasca Lanza',
    24: 'Boccadifalco - Baida', 25: 'Borgo Vecchio - Principe Scordia', 26: 'Croci - Ruggiero Settimo', 27: 'S.Francesco di Paola - Terrasanta',
    28: 'Olivuzza', 29: 'Parlatore - Serradifalco', 30: 'Noce', 31: 'Leonardo da Vinci - Di Blasi', 32: 'Malaspina - Leonardo da Vinci',
    33: 'Principe di Palagonia', 34: 'Uditore', 35: 'Passo di Rigano', 36: 'Borgo Nuovo', 37: 'San Giovanni Apostolo', 38: 'Cruillas',
    39: 'Notarbartolo - Giardino Inglese', 40: 'Villa Sperlinga', 41: 'Vittorio Veneto', 42: 'Marchese di Villabianca - Sampolo', 43: 'Resuttana',
    44: 'San Lorenzo', 45: 'Patti - Villaggio Ruffini', 46: 'Pallavicino', 47: 'San Filippo Neri', 48: "Tommaso Natale - Sant'Ambrogio - Cardillo",
    49: 'Sferracavallo', 50: 'Partanna Mondello', 51: 'Cantieri', 52: 'Montepellegrino', 53: 'Acquasanta', 54: 'Arenella', 55: 'Vergine Maria'}
# the owner's per-quartiere calls (final), checked against the UPL level below
CALL = {5: ['Zen', 'Brancaccio'],
        4: ['Borgo Nuovo', 'Bellolampo', 'Ciaculli', 'Croce Verde', 'Roccella', 'Zisa'],
        3: ['Albergheria', 'Il Capo', 'Bandita', 'Acqua dei Corsari', 'Pomara', 'Altarello', 'Noce', 'Falsomiele', 'Chiavelli', 'Settecannoli', 'Romagnolo',
            'Arenella', 'Acquasanta', 'Villaggio Santa Rosalia'],
        2: ['Kalsa', 'La Loggia', 'Parco della Favorita'],
        1: ['Mondello', 'Valdesi', 'Addaura', 'Monte Pellegrino', 'Quartiere Matteotti', 'San Lorenzo', 'Resuttana']}

ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_.~'   # 56 symbols for 0..55; run lengths are decimal digits


def load_sections(path):
    t = open(path, encoding='utf8', errors='replace').read()
    j = json.loads(re.search(r'<script type="application/json" data-for="[^"]+"[^>]*>(.*?)</script>', t, re.S).group(1))
    a = [c for c in j['x']['calls'] if c['method'] == 'addPolygons'][0]['args']
    out = []
    for geom, pop in zip(a[0], a[4]):
        code = re.search(r'COM_ASC_DETT&emsp;</th><td>([^<&]*)', pop).group(1).strip()
        if not code.isdigit(): continue
        rings = []
        for poly in geom:
            for r in (poly if isinstance(poly, list) else [poly]):
                rings.append([((lo - LON0) * KX, -(la - LAT0) * KZ) for lo, la in zip(r['lng'], r['lat'])])
        out.append((int(code) % 1000, rings))
    return out


def rasterise(secs):
    xs = [p[0] for _, rs in secs for r in rs for p in r]; zs = [p[1] for _, rs in secs for r in rs for p in r]
    x0, z0 = math.floor(min(xs) / CELL - 1) * CELL, math.floor(min(zs) / CELL - 1) * CELL
    w, h = math.ceil((max(xs) - x0) / CELL) + 2, math.ceil((max(zs) - z0) / CELL) + 2
    g = [[0] * w for _ in range(h)]
    for code, rings in secs:
        zmin = min(p[1] for r in rings for p in r); zmax = max(p[1] for r in rings for p in r)
        for row in range(max(0, int((zmin - z0) / CELL) - 1), min(h, int((zmax - z0) / CELL) + 2)):
            zc = z0 + (row + 0.5) * CELL; cr = []
            for r in rings:
                for i in range(len(r)):
                    (ax, az), (bx, bz) = r[i], r[(i + 1) % len(r)]
                    if (az > zc) != (bz > zc): cr.append(ax + (zc - az) / (bz - az) * (bx - ax))
            cr.sort()
            for k in range(0, len(cr) - 1, 2):
                for c in range(max(0, math.ceil((cr[k] - x0) / CELL - 0.5)), min(w, math.floor((cr[k + 1] - x0) / CELL - 0.5) + 1)): g[row][c] = code
    n0 = sum(v == 0 for r in g for v in r)
    fill = [r[:] for r in g]   # one step of dilation: a cell with no section takes the commonest neighbour (street gaps, 141 m at most)
    for y in range(h):
        for x in range(w):
            if g[y][x]: continue
            cnt = {}
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and g[yy][xx]: cnt[g[yy][xx]] = cnt.get(g[yy][xx], 0) + 1
            if cnt: fill[y][x] = max(cnt, key=cnt.get)
    print(f'grid {w}x{h} cells of {CELL} m, origin ({x0},{z0}); no-data before fill {n0}, after {sum(v == 0 for r in fill for v in r)}', file=sys.stderr)
    return x0, z0, w, h, fill


def rle(flat):
    out = []; i = 0
    while i < len(flat):
        j = i
        while j < len(flat) and flat[j] == flat[i]: j += 1
        out.append(ALPHA[flat[i]] + str(j - i)); i = j
    return ''.join(out)


def quartieri():
    src = open(os.path.join(ROOT, 'src', 'main.js'), encoding='utf8').read()
    blk = src[src.index('const QUARTIERI'):src.index('];', src.index('const QUARTIERI'))]
    return [(n, float(la), float(lo)) for n, la, lo in re.findall(r"\['([^']+)',\s*([\d.]+),\s*([\d.]+)\]", blk)]


def main():
    path = sys.argv[1]
    secs = load_sections(path)
    assert {c for c, _ in secs} == set(U), 'UPL codes differ from the table'
    x0, z0, w, h, g = rasterise(secs)
    flat = [v for r in g for v in r]
    # the per-quartiere calls must agree with the level of the UPL that holds the quartiere (one level per UPL, see docs/danger.md)
    where = {}
    for n, la, lo in quartieri():
        x, z = (lo - LON0) * KX, -(la - LAT0) * KZ; c = int((x - x0) // CELL); r = int((z - z0) // CELL)
        where[n] = g[r][c]
    bad = []
    for lv, names in CALL.items():
        for n in names:
            if U[where[n]][1] != lv: bad.append(f'{n}: call {lv}, UPL {where[n]} {U[where[n]][0]} has {U[where[n]][1]}')
    print('quartieri whose call differs from their UPL level:', *bad, sep='\n  ', file=sys.stderr)
    names = [''] + [U[i][0] for i in range(1, 56)]; levels = [NODATA] + [U[i][1] for i in range(1, 56)]
    js = f"""// Danger levels 1 to 5 per place, from the ISTAT UPL outlines. Baked by tools/danger.py (see docs/danger.md), never edit by hand.
// GRID: {w} x {h} cells of {CELL} m from the origin ({x0}, {z0}) in game metres (x east, z south), row by row, run-length coded:
// a symbol of ALPHA (the UPL index 0..55, 0 = no data) followed by the run length. NAMES and LEVELS are indexed by it.
export const CELL = {CELL}, X0 = {x0}, Z0 = {z0}, W = {w}, H = {h}, NODATA = {NODATA};
export const ALPHA = '{ALPHA}';
export const NAMES = {json.dumps(names, ensure_ascii=False)};
export const LEVELS = {json.dumps(levels)};
export const GRID = '{rle(flat)}';
"""
    open(os.path.join(ROOT, 'src', 'danger-data.js'), 'w', encoding='utf8').write(js)
    print(f'src/danger-data.js: {len(js)} bytes', file=sys.stderr)
    if '--table' in sys.argv:
        cnt = {l: sum(1 for i in range(1, 56) if U[i][1] == l) for l in range(1, 6)}
        print('counts per level', cnt)
        print('\n| Level | UPL | Name in game | IDISE 2023 | Draft | Quartieri inside |\n|---|---|---|---|---|---|')
        inside = {}
        for n, _, _ in quartieri(): inside.setdefault(where[n], []).append(n)
        for i in sorted(range(1, 56), key=lambda i: (-U[i][1], -U[i][2])):
            print(f'| {U[i][1]} | {UPL_IT[i]} | {U[i][0]} | {U[i][2]:.2f} | {U[i][3]} | {", ".join(inside.get(i, [])) or "none"} |')
        print('\n| Quartiere | Level | UPL |\n|---|---|---|')
        for n, _, _ in sorted(quartieri(), key=lambda q: (-U[where[q[0]]][1], q[0])): print(f'| {n} | {U[where[n]][1]} | {UPL_IT[where[n]]} |')


main()
