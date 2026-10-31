// Storey histograms from the lidar-measured buildings of each zone, by footprint class (s < 100 m2, m 100 to 300, l > 300).
// node tools/district-calibrate.mjs periph rural tn        prints the `flA` literal for src/districts.js
// Where a zone has lidar coverage, its generic (unmeasured) buildings should follow the same distribution; zones without coverage
// (the sacco belt, Noce, Uditore ...) use storey tables checked against Street View instead (docs/faithfulness/buildings.md).
// Named, typed and tiny (< 40 m2) buildings are left out of the histograms.
import fs from 'fs';
import { ZONES, zoneAt } from '../src/districts.js';
const dir = decodeURIComponent(new URL('../world/tiles/', import.meta.url).pathname);
const zs = process.argv.slice(2); if (!zs.length) { console.log('usage: node tools/district-calibrate.mjs zone [zone ...]'); process.exit(1); }
const cls = a => a < 100 ? 0 : a < 300 ? 1 : 2, H = Object.fromEntries(zs.map(z => [z, [{}, {}, {}]])), N = Object.fromEntries(zs.map(z => [z, [0, 0, 0]]));
for (const f of fs.readdirSync(dir)) {
  const d = JSON.parse(fs.readFileSync(dir + f));
  for (const b of d.buildings) {
    if (b.r === undefined || b.t || b.n || b.hi || b.k) continue;
    const p = b.p; let cx = 0, cz = 0, a = 0; const n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) { cx += p[i]; cz += p[i + 1]; const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1]; }
    cx /= n; cz /= n; a = Math.abs(a) / 2; if (a < 40) continue;
    const z = zoneAt(cx, cz, '', 1e9); if (!H[z]) continue;
    const fh = ZONES[z].fh || 3.2, fl = Math.min(8, Math.max(1, Math.round((b.r - (b.g || 0) - 1.7) / fh)));
    H[z][cls(a)][fl] = (H[z][cls(a)][fl] || 0) + 1; N[z][cls(a)]++;
  }
}
for (const z of zs) {
  const t = H[z].map((h, c) => '[' + Object.entries(h).filter(([k, v]) => v / N[z][c] >= 0.01).map(([k, v]) => `[${k}, ${Math.round(v / N[z][c] * 100)}]`).join(', ') + ']');
  console.log(`${z}: n=${N[z].join('/')}  flA: [${t.join(', ')}],`);
}
