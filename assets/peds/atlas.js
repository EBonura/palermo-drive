// Texture atlases for the pedestrian sprites. Owned by the pedestrian work.
//
// Two atlases, both 16-bit (RGB 5-5-5 + 1 bit alpha, half the memory of RGBA8) and both filled on the GPU one cell at a time, so no big CPU copy stays around:
//  - far: one cell per (cast entry, direction, pose) at 1 texel per design unit (24 x 54), every entry of the cast, built a few per frame after start and mipmapped.
//  - near: the same cells at 3 texels per unit (72 x 162), only for the entries whose people stand close to the camera (a handful of "slots", LRU), nearest filtered.
// A cell is found by its top-left texel, which the CPU puts into the instance data, so the cells of an atlas need not sit in any order.
// Only the left, front and back views are drawn: the right view is the left cell mirrored by the shader.
import * as THREE from 'three';
import { Cell, CELL_U } from './raster.js';
import { drawEntry } from './model.js';
import { POSES, CELLS_PER_ENTRY as CPE } from './sprites.js';

export const FAR_S = 1, NEAR_S = 3;
const FCW = CELL_U.w * FAR_S, FCH = CELL_U.h * FAR_S, NCW = CELL_U.w * NEAR_S, NCH = CELL_U.h * NEAR_S;
const hasDrink = sp => !!sp.drink || (sp.pair && sp.pair.some(p => p.drink));
// which (dir, pose) cells an entry has: 3 directions x poses 0..4, 5 (the drink) for the ones holding one, 6 and 7 (sitting on the ground, sipping) for the ones that can sit
export const cellsOf = sp => { const l = []; for (let p = 0; p < POSES; p++) { if (p === 5 && !hasDrink(sp)) continue; if (p > 5 && !sp.sit) continue; for (let d = 0; d < 3; d++) l.push(d * POSES + p); } return l; };

function pack5551(rgba, out, n) {
  for (let i = 0, k = 0; i < n; i++, k += 4) out[i] = rgba[k + 3] > 127 ? ((rgba[k] >> 3) << 11) | ((rgba[k + 1] >> 3) << 6) | ((rgba[k + 2] >> 3) << 1) | 1 : (rgba[k] >> 6 << 11) | (rgba[k + 1] >> 6 << 6) | (rgba[k + 2] >> 6 << 1);
}
const mkTex = (w, h, mips) => {
  const t = new THREE.DataTexture(new Uint16Array(w * h), w, h, THREE.RGBAFormat, THREE.UnsignedShort5551Type);
  t.colorSpace = THREE.NoColorSpace; t.unpackAlignment = 2; t.flipY = false; t.generateMipmaps = mips;
  t.magFilter = THREE.NearestFilter; t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.anisotropy = 1;
  t.onUpdate = () => { t.image.data = null; t.onUpdate = null; };   // the GPU has it: drop the zero-filled CPU copy
  t.needsUpdate = true;
  return t;
};
const stageTex = (w, h) => { const t = new THREE.DataTexture(new Uint16Array(w * h), w, h, THREE.RGBAFormat, THREE.UnsignedShort5551Type); t.unpackAlignment = 2; t.generateMipmaps = false; return t; };

export function createPedAtlas(cast, o = {}) {
  const nearCells = o.nearCells || 320, N = cast.length;
  // ----- far atlas geometry: the cells of all entries, packed 85 per row
  const farCol = Math.floor(2048 / FCW), farIdx = new Array(N);   // farIdx[v][c] = atlas cell number or -1 (c = dir * 8 + pose)
  let total = 0;
  for (let v = 0; v < N; v++) { const a = new Int32Array(CPE).fill(-1); for (const c of cellsOf(cast[v])) a[c] = total++; farIdx[v] = a; }
  const farW = farCol * FCW, farH = Math.ceil(total / farCol) * FCH;
  const far = mkTex(farW, farH, true);
  const nearCol = Math.floor(2880 / NCW), nearRows = Math.ceil(nearCells / nearCol), nearW = nearCol * NCW, nearH = nearRows * NCH;
  const near = mkTex(nearW, nearH, false);
  const st1 = stageTex(FCW, FCH), st3 = stageTex(NCW, NCH);
  const cells = [new Cell(FAR_S, 0), new Cell(NEAR_S, 0)], out1 = new Uint8ClampedArray(FCW * FCH * 4), out3 = new Uint8ClampedArray(NCW * NCH * 4);
  const stats = { farBytes: 0, nearBytes: 0, farMipBytes: 0, farTexels: farW * farH, nearTexels: nearW * nearH, farCells: total, built: 0, farBuilt: 0, nearBuilt: 0, slots: 0, maxSlots: 0, buildMs: 0, nearMs: 0, farMs: 0 };
  stats.farBytes = farW * farH * 2; stats.farMipBytes = Math.round(stats.farBytes * 1.34); stats.nearBytes = nearW * nearH * 2;
  const farDone = new Uint8Array(N), farQueue = [];                       // entries not built yet, in the order they are wanted
  for (let v = 0; v < N; v++) farQueue.push(v);
  let farHead = 0, farCell = 0, lastX = 0, lastY = 0;
  const cellPos = (idx, col, cw, ch) => [(idx % col) * cw, Math.floor(idx / col) * ch];

  // ----- near slots
  const freeCells = []; for (let i = nearCells - 1; i >= 0; i--) freeCells.push(i);
  const slotOf = new Int16Array(N).fill(-1), slots = [];   // slot: { v, cells: Int16Array(CPE) (near atlas cell numbers), todo: [c...], todoI, ready, need }
  const wants = new Map(); let frameNo = 0;
  const nearIdx = new Int32Array(N * CPE).fill(-1);          // nearIdx[v * CPE + c] = near atlas cell number, only once the slot is ready

  // rendering one cell into 16-bit pixels and onto the GPU
  function renderCell(sp, S, c, st, out, w, h) {
    const cell = cells[S === FAR_S ? 0 : 1]; cell.reset(Math.floor(c / POSES)); drawEntry(cell, sp, c % POSES);
    cell.finish(out); pack5551(out, st.image.data, w * h);
  }
  function put(renderer, tex, st, x, y, w, h, last) {
    tex.generateMipmaps = last && tex === far;
    renderer.copyTextureToTexture(st, tex, null, new THREE.Vector2(x, y));
    tex.generateMipmaps = tex === far;
  }
  let renderer = null;
  // build until the budget (ms) is spent: first the cells of the near slots, then the far atlas
  function pump(r, budgetMs, farBudgetMs) {
    renderer = r || renderer; if (!renderer) return;
    const t0 = performance.now(); frameNo++;
    // near
    for (let k = 0; k < slots.length; k++) {
      const s = slots[k]; if (!s || s.ready) continue;
      while (s.todoI < s.todo.length) {
        if (performance.now() - t0 > budgetMs) break;
        const c = s.todo[s.todoI++], sp = cast[s.v], t1 = performance.now(), a = s.cells[c];
        renderCell(sp, NEAR_S, c, st3, out3, NCW, NCH);
        const [x, y] = cellPos(a, nearCol, NCW, NCH); put(renderer, near, st3, x, y, NCW, NCH, false);
        stats.nearBuilt++; stats.nearMs += performance.now() - t1;
      }
      if (s.todoI >= s.todo.length) { s.ready = true; for (let c = 0; c < CPE; c++) nearIdx[s.v * CPE + c] = s.cells[c]; }
      if (performance.now() - t0 > budgetMs) break;
    }
    // far
    let touched = false; const tf = performance.now();
    while (farHead < farQueue.length && performance.now() - tf < farBudgetMs) {
      const v = farQueue[farHead];
      if (farDone[v]) { farHead++; continue; }
      const sp = cast[v], list = cellsOf(sp);
      for (; farCell < list.length; farCell++) {
        const c = list[farCell]; renderCell(sp, FAR_S, c, st1, out1, FCW, FCH);
        const [x, y] = cellPos(farIdx[v][c], farCol, FCW, FCH); put(renderer, far, st1, x, y, FCW, FCH, false); touched = true; lastX = x; lastY = y; stats.farBuilt++;
        if (performance.now() - tf > farBudgetMs && farCell + 1 < list.length) { farCell++; break; }
      }
      if (farCell >= list.length) { farDone[v] = 1; farCell = 0; farHead++; }
    }
    if (touched) put(renderer, far, st1, lastX, lastY, FCW, FCH, true);   // the last cell again, to rebuild the mip chain once per frame
    stats.farMs += performance.now() - tf; stats.buildMs += performance.now() - t0;
  }

  // ask for a far entry to be built next (a spawn or a scripted character needs it now)
  function prioritise(v) { if (!farDone[v]) { farQueue.splice(farHead, 0, v); } }
  // build one entry completely now (a scripted character that has to be on screen this frame)
  function buildNow(r, v) { renderer = r || renderer; if (!renderer || farDone[v]) return; const sp = cast[v]; for (const c of cellsOf(sp)) { renderCell(sp, FAR_S, c, st1, out1, FCW, FCH); const [x, y] = cellPos(farIdx[v][c], farCol, FCW, FCH); put(renderer, far, st1, x, y, FCW, FCH, false); lastX = x; lastY = y; } farDone[v] = 1; put(renderer, far, st1, lastX, lastY, FCW, FCH, true); }

  // near wants: collect during the frame (want), allocate slots at the end of it (settle)
  function want(v, dist) { const d = wants.get(v); if (d === undefined || dist < d) wants.set(v, dist); }
  function settle() {
    if (wants.size === 0) return;
    const list = [...wants.entries()].sort((a, b) => a[1] - b[1]); wants.clear();
    for (const [v] of list) { const s = slotOf[v]; if (s >= 0) slots[s].need = frameNo; }
    for (const [v] of list) {
      if (slotOf[v] >= 0 || !farDone[v]) continue;
      const sp = cast[v], list2 = cellsOf(sp), need = list2.length;
      while (freeCells.length < need) {   // evict the slot unused for the longest time, if it has been idle for a while
        let b = -1, bn = frameNo - 45; for (let k = 0; k < slots.length; k++) { const s = slots[k]; if (s && s.need < bn) { bn = s.need; b = k; } }
        if (b < 0) break; freeSlot(b);
      }
      if (freeCells.length < need) break;
      const s = { v, cells: new Int16Array(CPE).fill(-1), todo: list2, todoI: 0, ready: false, need: frameNo };
      for (const c of list2) s.cells[c] = freeCells.pop();
      let k = slots.indexOf(null); if (k < 0) { k = slots.length; slots.push(null); } slots[k] = s; slotOf[v] = k;
    }
    stats.slots = slots.reduce((n, s) => n + (s ? 1 : 0), 0); if (stats.slots > stats.maxSlots) stats.maxSlots = stats.slots;
  }
  function freeSlot(k) { const s = slots[k]; if (!s) return; for (let c = 0; c < CPE; c++) { if (s.cells[c] >= 0) freeCells.push(s.cells[c]); nearIdx[s.v * CPE + c] = -1; } slotOf[s.v] = -1; slots[k] = null; }
  const nearReady = v => { const k = slotOf[v]; return k >= 0 && slots[k].ready; };
  function dispose() { far.dispose(); near.dispose(); }
  return { far, near, farW, farH, nearW, nearH, farCol, nearCol, farIdx, nearIdx, farDone, pump, want, settle, prioritise, buildNow, nearReady, stats, FCW, FCH, NCW, NCH, dispose, pending: () => farQueue.length - farHead };
}
