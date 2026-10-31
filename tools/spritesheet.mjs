// Renders pedestrian sprite contact sheets as PNG (no browser needed): node tools/spritesheet.mjs out.png [--ids a,b] [--zoom 3] [--poses 0,1,2,3,4] [--dirs 0,1,2,3] [--bg #rrggbb] [--cols N]
// Each variant is one block of rows (label strip + one row of cells). With --cols, the blocks wrap into N columns of blocks.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { VARIANTS } from '../assets/peds/sprites.js';
import { CELL_W, CELL_H, cellData } from '../assets/peds/figure.js';

const args = process.argv.slice(2), out = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const zoom = +opt('zoom', 1), bg = opt('bg', '#2b2530'), ids = opt('ids', ''), poses = opt('poses', '0,1,2,3,4').split(',').map(Number), dirs = opt('dirs', '0,1,2,3').split(',').map(Number);
const wrap = +opt('cols', 1);
const list = ids ? ids.split(',').map(id => VARIANTS.find(v => v.id === id)).filter(Boolean) : VARIANTS;
const bgc = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16));
const gap = 2, blockW = poses.length * dirs.length * CELL_W * zoom + gap * dirs.length, blockH = CELL_H * zoom + 4;
const perCol = Math.ceil(list.length / wrap), W = blockW * wrap, H = blockH * perCol;
const buf = Buffer.alloc(W * H * 4); for (let i = 0; i < W * H; i++) { buf[i * 4] = bgc[0]; buf[i * 4 + 1] = bgc[1]; buf[i * 4 + 2] = bgc[2]; buf[i * 4 + 3] = 255; }
const t0 = performance.now();
list.forEach((v, n) => {
  const bx = Math.floor(n / perCol) * blockW, by = (n % perCol) * blockH;
  let cx = bx;
  for (const d of dirs) { for (const p of poses) {
    const cell = cellData(v, d, p);
    for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) {
      const i = (y * CELL_W + x) * 4; if (!cell[i + 3]) continue;
      for (let zy = 0; zy < zoom; zy++) for (let zx = 0; zx < zoom; zx++) { const o = ((by + y * zoom + zy) * W + cx + x * zoom + zx) * 4; buf[o] = cell[i]; buf[o + 1] = cell[i + 1]; buf[o + 2] = cell[i + 2]; }
    }
    cx += CELL_W * zoom;
  } cx += gap; }
});
console.error(`rendered ${list.length} variants x ${dirs.length * poses.length} cells in ${(performance.now() - t0).toFixed(0)} ms -> ${W}x${H}`);
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
