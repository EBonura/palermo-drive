// Adds the given cast entries to the atlas that is already built, without rebuilding the rest: ONLY=wanderer,wanderer_tweed node tools/lpc/append.mjs
// The full build (build.mjs) needs the generator's clone for the layers of every type; this one only needs the layers of the entries it adds. The entries must be the LAST ones of VARIANTS
// (assets/peds/sprites.js) so the cell numbers of everyone else stay as they are. It keeps the cell size and the crop of the existing atlas (12, 8 of the 64 px frame, found by matching a known figure).
import fs from 'fs'; import path from 'path';
import { sharp, ROOT } from './lib.mjs'; import { stackOf } from './cast.mjs'; import { personFrames } from './frames.mjs';
const { VARIANTS } = await import(path.join(ROOT, 'assets/peds/sprites.js'));
const OUT = process.argv[2] || path.join(ROOT, 'assets/peds/lpc'), ONLY = (process.env.ONLY || '').split(',').filter(Boolean), CX0 = 12, CY0 = 8, DI = { front: 0, back: 1, left: 2 };
if (!ONLY.length) throw new Error('say which entries: ONLY=id,id');
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'))), [CW, CH] = index.cell, cols = index.cols;
const raw = await sharp(path.join(OUT, 'atlas.png')).raw().toBuffer({ resolveWithObject: true }), W = raw.info.width;
const cells = [];
for (const id of ONLY) {
  const e = VARIANTS.findIndex(v => v.id === id); if (e < 0) throw new Error('no such entry ' + id);
  if (index.entries[e] && Object.keys(index.entries[e].cells).length) { console.log(id, 'is already in the atlas (entry', e + ')'); continue; }
  if (e !== index.entries.length) throw new Error(`${id} is entry ${e} but the atlas has ${index.entries.length}: only the last entries of VARIANTS can be appended, in order`);
  const sp = VARIANTS[e], r = await personFrames(stackOf(sp, e), { drink: !!sp.drink && !sp.chair, sit: !!sp.sit });
  index.entries.push({ id, cells: {} });
  for (const dir of ['front', 'back', 'left']) for (let pose = 0; pose < 8; pose++) if (r.frames[dir + pose]) cells.push([e, DI[dir] * 8 + pose, r.frames[dir + pose]]);
}
if (!cells.length) process.exit(0);
let next = Math.max(...index.entries.flatMap(en => Object.values(en.cells)), -1) + 1;
const rows = Math.ceil((next + cells.length) / cols), H = Math.max(raw.info.height, rows * CH), atlas = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { atlas[i * 4] = 22; atlas[i * 4 + 1] = 16; atlas[i * 4 + 2] = 26; atlas[i * 4 + 3] = 0; }
raw.data.copy(atlas, 0, 0, W * raw.info.height * 4);
for (const [e, c, f] of cells) {
  const n = next++; index.entries[e].cells[c] = n; const cx = (n % cols) * CW, cy = Math.floor(n / cols) * CH;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const sx = CX0 + x, sy = CY0 + y; if (sx > 63 || sy > 63) continue; const i = (sy * 64 + sx) * 4, o = ((cy + y) * W + cx + x) * 4; if (f[i + 3]) { atlas[o] = f[i]; atlas[o + 1] = f[i + 1]; atlas[o + 2] = f[i + 2]; atlas[o + 3] = 255; } }
}
index.atlas = [W, H];
await sharp(atlas, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'atlas.png.tmp'));
fs.renameSync(path.join(OUT, 'atlas.png.tmp'), path.join(OUT, 'atlas.png')); fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
console.log('appended', cells.length, 'cells; atlas', W, 'x', H);
