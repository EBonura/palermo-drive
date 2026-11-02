// Builds the two friends of the officina (src/garage-officina.js): assets/peds/lpc/garage.png + garage.json, a small atlas of their own so that the street crowd's atlas stays as it is.
// The mechanic (amico1: quiff, rectangular glasses, stubble) in blue dungarees with a spanner and a rag; the loiterer (amico2: copper waves, round tortoiseshell glasses, forearm tattoos)
// in his jacket with an espresso. Cells: person x direction (front, left, back; right is mirrored at runtime) x 2 poses (0: standing, 1: the second idle frame, with the cup raised).
// node tools/lpc/garage.mjs   (needs the layers of tools/lpc/layers; run tools/lpc/credits.mjs afterwards if layers were added)
import fs from 'fs'; import path from 'path'; import { sharp, creditsOf, ROOT } from './lib.mjs';
import { stackOf } from './cast.mjs'; import { personFrames } from './frames.mjs';
const { VARIANTS } = await import(path.join(ROOT, 'assets/peds/sprites.js'));
const OUT = process.argv[2] || path.join(ROOT, 'assets/peds/lpc'), byId = id => VARIANTS.findIndex(v => v.id === id);
const MECH = { ...VARIANTS[byId('amico1_tuta')], id: 'mecca', top: '#24365c', sleeve: 'long', sleeveStripe: false, chain: false, bottom: { type: 'trousers', col: '#24365c' }, shoes: '#3a2a20', drink: null };
const LOIT = { ...VARIANTS[byId('amico2_giacca')], id: 'friend', drink: { type: 'glass', col: '#ffffff' } };
const WHO = [['mechanic', MECH, [['bib', 'navy'], ['rag', 'red'], ['wrench']]], ['loiterer', LOIT, []]], DIRS = ['front', 'left', 'back'], used = [], frames = [];
for (const [name, sp, more] of WHO) {
  const P = stackOf(sp, 900 + frames.length); P.extras.push(...more);
  const r = await personFrames(P, { drink: true, sit: false }); used.push(...r.used);
  frames.push({ name, f: r.frames });
}
let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
for (const w of frames) for (const f of Object.values(w.f)) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (f[(y * 64 + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const CW = x1 - x0 + 3, CH = 62 - (y0 - 1), CX0 = x0 - 1, CY0 = y0 - 1;   // the cell ends two rows under the soles (which are on row 59)
const cells = [], who = {}; for (const w of frames) { who[w.name] = {}; DIRS.forEach((d, di) => [0, 1].forEach(pose => { who[w.name][di * 2 + pose] = cells.length; cells.push(w.f[d + (pose ? 5 : 0)]); })); }
const COLS = 6, rows = Math.ceil(cells.length / COLS), W = COLS * CW, H = rows * CH, atlas = Buffer.alloc(W * H * 4);
cells.forEach((f, n) => { const cx = (n % COLS) * CW, cy = Math.floor(n / COLS) * CH; for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const sx = CX0 + x, sy = CY0 + y; if (sx > 63 || sy > 63) continue; const i = (sy * 64 + sx) * 4, o = ((cy + y) * W + cx + x) * 4; if (f[i + 3]) { atlas[o] = f[i]; atlas[o + 1] = f[i + 1]; atlas[o + 2] = f[i + 2]; atlas[o + 3] = 255; } } });
await sharp(atlas, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'garage.png'));
fs.writeFileSync(path.join(OUT, 'garage.json'), JSON.stringify({ cell: [CW, CH], ground: 2, cols: COLS, atlas: [W, H], px: 0.0348, who }));
// credits: add any layer these two use that the crowd does not
const cf = path.join(OUT, 'CREDITS.json'), have = JSON.parse(fs.readFileSync(cf, 'utf8')), add = creditsOf(used).filter(c => !have.some(h => h.file === c.file));
if (add.length) { fs.writeFileSync(cf, JSON.stringify([...have, ...add], null, 1)); console.log('credits added:', add.map(a => a.file).join(', ')); }
console.log('garage atlas', W, 'x', H, 'cell', CW, 'x', CH, cells.length, 'cells');
