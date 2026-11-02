// Builds the pedestrian atlas from LPC layers: node tools/lpc/build.mjs
// For every entry of the cast (assets/peds/sprites.js) it picks a stack of LPC layers (cast.mjs), composes the walk, idle, run and sit sheets, paints our extras on top (extras.mjs),
// crops all frames to one cell size and packs them into assets/peds/lpc/atlas.png (RGBA, alpha 0 or 255) with index.json (cell numbers), cast.js, CREDITS.json and CREDITS.md.
import fs from 'fs'; import path from 'path';
import { sharp, creditsOf, ROOT, HERE, CLONE, defFile, DEFS } from './lib.mjs';
import { stackOf } from './cast.mjs'; import { personFrames, mergePair, swapPose } from './frames.mjs'; import { castJs } from './castjs.mjs';
const { VARIANTS } = await import(path.join(ROOT, 'assets/peds/sprites.js'));
const OUT = process.argv[2] || path.join(ROOT, 'assets/peds/lpc'), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, DI = { front: 0, back: 1, left: 2 };
const list = [], allUsed = [];
for (let e = 0; e < VARIANTS.length; e++) {
  const sp = VARIANTS[e]; if (ONLY && !ONLY.includes(sp.id)) { list.push(null); continue; }
  let frames;
  if (sp.pair) {
    const stacks = sp.pair.map((p, i) => stackOf({ ...p, id: sp.id + i }, e)), want = { drink: false, sit: false };
    const a = await personFrames(stacks[0], want), b = await personFrames(stacks[1], want); allUsed.push(...a.used, ...b.used);
    const sw = {}; for (const k of Object.keys(b.frames)) sw[k] = b.frames[k.slice(0, -1) + swapPose(+k.slice(-1))] || b.frames[k];
    frames = mergePair(a.frames, sw, 4);
  } else {
    const P = stackOf(sp, e), r = await personFrames(P, { drink: !!sp.drink && !sp.chair, sit: !!sp.sit && !P.noSit }); frames = r.frames; allUsed.push(...r.used);
  }
  list.push({ sp, frames });
  if (e % 20 === 0) console.log('entry', e, sp.id);
}
// one cell size for everybody: the union of the figures, plus a margin (the couples, the dog and the pram are the wide ones)
let x0 = 64, y0 = 64, x1 = 0, y1 = 0; const widest = [], tallest = [], lowest = [];
for (const it of list) if (it) { const pairEntry = !!it.sp.pair; let bx0 = 64, bx1 = 0, by0 = 64, by1 = 0; for (const f of Object.values(it.frames)) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (f[(y * 64 + x) * 4 + 3]) { if (!pairEntry) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (y > by1) by1 = y; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; } widest.push([bx1 - bx0 + 1, it.sp.id]); tallest.push([60 - by0, it.sp.id]); lowest.push([by1, it.sp.id]); }
widest.sort((a, b) => b[0] - a[0]); tallest.sort((a, b) => b[0] - a[0]); console.log('widest', widest.slice(0, 8).map(w => w.join(' ')).join(', '), '| tallest', tallest.slice(0, 8).map(w => w.join(' ')).join(', '), '| lowest', lowest.sort((a, b) => b[0] - a[0]).slice(0, 6).map(w => w.join(' ')).join(', '), '| median w', widest[widest.length >> 1][0], 'h', tallest[tallest.length >> 1][0]);
const CX0 = Math.max(0, x0 - 1), CW = Math.min(64 - CX0, 38, (x1 - x0 + 1) + 2 + ((x1 - x0 + 1) & 1)), CY0 = Math.max(0, y0 - 1), CH = Math.min(64 - CY0, 55, y1 - y0 + 3);
const GROUND = 60 - CY0 + 1;   // the feet of a standing LPC figure end on row 59 of the frame
console.log('union of the single figures: x', x0, x1, 'y', y0, y1, '(the couples are cropped to the cell)'); console.log('cell', CW, 'x', CH, 'crop at', CX0, CY0, 'ground row', GROUND);
const cells = []; list.forEach((it, e) => { if (!it) return; for (const dir of ['front', 'back', 'left']) for (let pose = 0; pose < 8; pose++) if (it.frames[dir + pose]) cells.push([e, DI[dir] * 8 + pose, it.frames[dir + pose]]); });
const COLS = Math.floor(2048 / CW), rowsN = Math.ceil(cells.length / COLS), W = COLS * CW, H = rowsN * CH, atlas = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { atlas[i * 4] = 22; atlas[i * 4 + 1] = 16; atlas[i * 4 + 2] = 26; atlas[i * 4 + 3] = 0; }
const index = { cell: [CW, CH], ground: GROUND, cols: COLS, atlas: [W, H], pin: '86160e7', entries: list.map((it, e) => ({ id: VARIANTS[e].id, cells: {} })) };
cells.forEach(([e, c, f], n) => {
  index.entries[e].cells[c] = n; const cx = (n % COLS) * CW, cy = Math.floor(n / COLS) * CH;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const sx = CX0 + x, sy = CY0 + y; if (sx > 63 || sy > 63) continue; const i = (sy * 64 + sx) * 4, o = ((cy + y) * W + cx + x) * 4; if (f[i + 3]) { atlas[o] = f[i]; atlas[o + 1] = f[i + 1]; atlas[o + 2] = f[i + 2]; atlas[o + 3] = 255; } }
});
fs.mkdirSync(OUT, { recursive: true });
await sharp(atlas, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'atlas.png'));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
fs.writeFileSync(path.join(OUT, 'cast.js'), castJs(index, 0.0348, 20));
const credits = creditsOf(allUsed); fs.writeFileSync(path.join(OUT, 'CREDITS.json'), JSON.stringify(credits, null, 1));
// keep the sheet definitions and palettes the build used (data only) so it can be rerun without a clone of the generator
if (CLONE && fs.existsSync(CLONE) && DEFS === CLONE) {
  const ids = new Set(allUsed.map(p => p.id)); const dst = path.join(HERE, 'defs');
  for (const id of ids) { const f = defFile(id), t = path.join(dst, 'sheet_definitions', id + '.json'); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.copyFileSync(f, t); }
  fs.cpSync(path.join(CLONE, 'palette_definitions'), path.join(dst, 'palette_definitions'), { recursive: true });
}
console.log('atlas', W, 'x', H, '=', (W * H * 2 / 1e6).toFixed(2), 'MB at 16 bit (', (W * H * 2 * 1.34 / 1e6).toFixed(2), 'with mips ),', cells.length, 'cells,', list.filter(Boolean).length, 'entries,', credits.length, 'credited files');
