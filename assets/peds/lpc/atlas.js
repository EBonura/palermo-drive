// The pedestrian atlas made from Universal LPC Spritesheet layers (see tools/lpc/build.mjs and assets/peds/lpc/LICENSE.md). Same interface as assets/peds/atlas.js,
// but the cells are prebuilt: atlas.png (RGBA, one cell per direction and pose of every cast entry) and index.json (which cell is which) are fetched once and the
// pixels are packed to 16-bit (RGB 5-5-5 + 1 bit alpha) on the GPU side like the generated atlas. LPC art is drawn for a pixel density of about 3.5 cm per pixel, the
// same as the far cells of the generated atlas, so there is only one level of detail and no near atlas.
import * as THREE from 'three';

export function createLpcAtlas(cast, base) {
  const N = cast.length, CPE = 24;
  const farSz = new THREE.Vector2(1, 1), farIdx = cast.map(() => new Int32Array(CPE).fill(-1)), farDone = new Uint8Array(N);
  const far = new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RGBAFormat, THREE.UnsignedShort5551Type);
  far.colorSpace = THREE.NoColorSpace; far.unpackAlignment = 2; far.flipY = false; far.generateMipmaps = false; far.magFilter = THREE.NearestFilter; far.minFilter = THREE.NearestFilter; far.needsUpdate = true;
  const near = new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RGBAFormat, THREE.UnsignedShort5551Type); near.unpackAlignment = 2; near.needsUpdate = true;
  const stats = { farBytes: 0, nearBytes: 2, farMipBytes: 0, farTexels: 0, nearTexels: 1, farCells: 0, built: 0, farBuilt: 0, nearBuilt: 0, slots: 0, maxSlots: 0, buildMs: 0, nearMs: 0, farMs: 0, lpc: true, loaded: false };
  const out = { far, near, farSz, farW: 1, farH: 1, nearW: 1, nearH: 1, farCol: 1, nearCol: 1, farIdx, nearIdx: new Int32Array(N * CPE).fill(-1), farDone, FCW: 1, FCH: 1, NCW: 1, NCH: 1, stats,
    pump() {}, want() {}, settle() {}, prioritise() {}, buildNow() {}, nearReady: () => false, pending: () => 0, dispose() { far.dispose(); near.dispose(); } };
  const load = async () => {
    try {
      const index = await (await fetch(base + 'index.json')).json();
      const bmp = await createImageBitmap(await (await fetch(base + 'atlas.png')).blob());
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
      const px = g.getImageData(0, 0, cv.width, cv.height).data, n = cv.width * cv.height, data = new Uint16Array(n);
      for (let i = 0, k = 0; i < n; i++, k += 4) data[i] = px[k + 3] > 127 ? ((px[k] >> 3) << 11) | ((px[k + 1] >> 3) << 6) | ((px[k + 2] >> 3) << 1) | 1 : (px[k] >> 6 << 11) | (px[k + 1] >> 6 << 6) | (px[k + 2] >> 6 << 1);
      [out.FCW, out.FCH] = index.cell; out.farCol = index.cols; out.farW = cv.width; out.farH = cv.height;
      index.entries.forEach((e, v) => { if (v >= N || e.id !== cast[v].id) return; for (const c of Object.keys(e.cells)) farIdx[v][+c] = e.cells[c]; farDone[v] = 1; });   // entries are in the order of the cast (assets/peds/sprites.js)
      far.dispose(); far.image = { data, width: cv.width, height: cv.height }; far.generateMipmaps = true; far.minFilter = THREE.LinearMipmapLinearFilter; far.onUpdate = () => { far.image.data = null; far.onUpdate = null; }; far.needsUpdate = true;
      farSz.set(cv.width, cv.height);
      stats.farBytes = n * 2; stats.farMipBytes = Math.round(n * 2 * 1.34); stats.farTexels = n; stats.farCells = index.entries.length * CPE; stats.loaded = true;
    } catch (e) { console.warn('LPC pedestrian atlas failed to load', e); }
  };
  load();
  // The pixels are dropped after the upload, so a lost GL context (phones can do this in the background) takes the crowd with it: fetch them again.
  document.getElementById('view')?.addEventListener('webglcontextrestored', load);
  return out;
}
