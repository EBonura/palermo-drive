// Composes Universal LPC Spritesheet layers (https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) into character frames. Used by tools/lpc/build.mjs.
// Reads the generator's sheet definitions and palettes (JSON: tools/lpc/defs, vendored by build.mjs from a clone of the generator pinned in PIN), downloads the image layers it needs
// (walk, idle, run and sit sheets only) into tools/lpc/layers, recolours them with the generator's own palettes and stacks them by zPos. Nothing from the generator is executed.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
export const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const sharp = createRequire(path.join(ROOT, 'tools/build/package.json'))('sharp');
export { sharp };
export const PIN = '86160e7507d6841259cff624a51a63c1d4847ee3';
export const CLONE = process.env.LPC_CLONE || '/private/tmp/claude-501/palermo-npc/lpc-src/repo';
export const DEFS = fs.existsSync(CLONE) ? CLONE : path.join(HERE, 'defs'), LAYERS = path.join(HERE, 'layers');
const RAW = `https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/${PIN}/spritesheets/`;
export const FRAME = 64, ROW = { back: 0, left: 1, front: 2, right: 3 };

// ---------- definitions and palettes ----------
const defs = new Map();
(function walk(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.json') && !f.name.startsWith('meta_')) { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); if (j.layer_1) defs.set(path.relative(path.join(DEFS, 'sheet_definitions'), p).replace(/\.json$/, ''), j); } catch { /* not a sheet definition */ } } } })(path.join(DEFS, 'sheet_definitions'));
export const getDef = id => { const d = defs.get(id); if (!d) throw new Error('no sheet definition ' + id); return d; };
export const defFile = id => path.join(DEFS, 'sheet_definitions', id + '.json');
const pal = {}; for (const m of ['body', 'hair', 'cloth', 'eye', 'metal']) pal[m] = JSON.parse(fs.readFileSync(path.join(DEFS, 'palette_definitions', m, `${m}_ulpc.json`), 'utf8'));
const BASE = { body: 'light', hair: 'orange', cloth: 'white', eye: 'blue', metal: null };
const hex2 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// ramps of our own in the same 6 step shape (the generator's pinks are muddy: the rosanero pink of Palermo FC needs a clean one)
pal.cloth.rosanero = ['#3a1830', '#8a3a68', '#d8689a', '#f08cb4', '#f8b4cf', '#fde6ef'];
export const ramp = (material, name) => { const r = pal[material] && pal[material][name]; if (!r) throw new Error(`no ${material} ramp ${name}`); return r.map(hex2); };
const HUMAN = ['light', 'amber', 'olive', 'taupe', 'bronze', 'brown', 'black'], EYES = ['blue', 'green', 'brown', 'gray'];
const NATURAL_HAIR = ['ash', 'platinum', 'white', 'gray', 'blonde', 'sandy', 'strawberry', 'gold', 'ginger', 'carrot', 'redhead', 'red', 'light_brown', 'chestnut', 'dark_brown', 'dark_gray', 'black', 'raven'];
// the named ramp whose middle colour is closest to a hex colour
export function nearestRamp(material, hex, only) {
  const [r, g, b] = hex2(hex); let best = null, bd = 1e9;
  const names = only || (material === 'body' ? HUMAN : material === 'eye' ? EYES : Object.keys(pal[material]));
  for (const name of names) { const rr = pal[material][name]; if (!rr) continue; const m = hex2(rr[Math.min(3, rr.length - 1)]); const d = (m[0] - r) ** 2 + (m[1] - g) ** 2 + (m[2] - b) ** 2; if (d < bd) { bd = d; best = name; } }
  return best;
}
export const naturalHair = hex => nearestRamp('hair', hex, NATURAL_HAIR), dyedHair = hex => nearestRamp('hair', hex);
// for definitions that ship one file per colour: the variant whose colour is nearest to a cloth ramp name or hex
export function pickVariant(def, wanted) {
  const vs = def.variants || []; if (!vs.length) return null;
  if (vs.includes(wanted)) return wanted;
  const target = pal.cloth[wanted] ? ramp('cloth', wanted)[3] : hex2(wanted);
  let best = vs[0], bd = 1e9; for (const v of vs) { const r = pal.cloth[v]; if (!r) continue; const m = hex2(r[3]); const d = (m[0] - target[0]) ** 2 + (m[1] - target[1]) ** 2 + (m[2] - target[2]) ** 2; if (d < bd) { bd = d; best = v; } }
  return best;
}
const matsOf = def => { const r = def.recolors; if (!r) return []; if (r.material) return [['color_1', r.material]]; return Object.entries(r).filter(([k, v]) => v && v.material).map(([k, v]) => [k, v.material]); };

// ---------- layer images ----------
export async function layerFile(rel, anim, variant) {   // rel: a path from the definition, e.g. "torso/clothes/shortsleeve/tshirt/male/"; variant: a colour name for definitions that ship one file per colour (rel/anim/variant.png)
  const sub = variant ? path.join(anim, variant + '.png') : anim + '.png';
  const file = path.join(LAYERS, rel, sub);
  if (fs.existsSync(file)) return file;
  if (fs.existsSync(file + '.missing')) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const res = await fetch(RAW + rel + sub); if (!res.ok) { fs.writeFileSync(file + '.missing', ''); return null; }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}
export async function plainFile(relFile) {   // a file at an exact path (the wheelchair sheets)
  const file = path.join(LAYERS, relFile); if (fs.existsSync(file)) return file; if (fs.existsSync(file + '.missing')) return null;
  fs.mkdirSync(path.dirname(file), { recursive: true }); const res = await fetch(RAW + relFile); if (!res.ok) { fs.writeFileSync(file + '.missing', ''); return null; } fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file;
}
const sheets = new Map();
export async function loadSheet(file) { let s = sheets.get(file); if (!s) { const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); s = { data, w: info.width, h: info.height }; sheets.set(file, s); } return s; }

// ---------- stacking ----------
// person: { body, layers: [{ id, mat: { body: 'light', hair: 'black', cloth: 'navy', eye: 'brown' }, variant, bodyType }] }
const warned = new Set();
export async function composeAnim(person, anim) {
  const parts = [];
  for (const L of person.layers) {
    const def = getDef(L.id), bt = L.bodyType || person.body;
    for (let n = 1; n < 6; n++) {
      const ly = def['layer_' + n]; if (!ly) break; if (ly.custom_animation) continue;
      let rel = ly[bt] || (bt === 'muscular' || bt === 'pregnant' ? ly.male : null) || (bt === 'teen' && ly.male ? ly.male : null); if (!rel) continue;
      let file = await layerFile(rel, anim, L.variant);
      if (!file && anim === 'idle') file = await layerFile(rel, 'walk', L.variant);
      if (!file && anim === 'run') file = await layerFile(rel, 'walk', L.variant);
      if (!file) { const k = L.id + bt + anim; if (anim !== 'sit' && !warned.has(k)) { warned.add(k); console.warn('missing layer', L.id, bt, anim); } continue; }
      parts.push({ z: ly.zPos ?? 100, id: L.id, n, file, rel, def, mat: L.mat || {}, src: path.basename(file, '.png') });
    }
  }
  parts.sort((a, b) => a.z - b.z);
  if (!parts.length) return null;
  const W = Math.max(...(await Promise.all(parts.map(async p => (await loadSheet(p.file)).w)))), H = 256, out = new Uint8ClampedArray(W * H * 4);
  for (const p of parts) {
    const sh = await loadSheet(p.file), map = recolorMap(p.def, p.mat), w = Math.min(W, sh.w), h = Math.min(H, sh.h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * sh.w + x) * 4, a = sh.data[i + 3]; if (!a) continue;
      let r = sh.data[i], g = sh.data[i + 1], b = sh.data[i + 2];
      if (map) { const k = map.get((r << 16) | (g << 8) | b); if (k !== undefined) { r = k >> 16; g = (k >> 8) & 255; b = k & 255; } }
      const o = (y * W + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return { data: out, w: W, h: H, used: parts };
}
function recolorMap(def, mat) {
  const ms = matsOf(def); if (!ms.length) return null;
  const m = new Map();
  for (const [key, material] of ms) {
    const target = mat[material]; if (!target) continue;
    const base = BASE[material]; if (!base || !pal[material][base]) continue;
    const src = ramp(material, base), dst = ramp(material, target);
    for (let k = 0; k < src.length; k++) m.set((src[k][0] << 16) | (src[k][1] << 8) | src[k][2], (dst[Math.min(k, dst.length - 1)][0] << 16) | (dst[Math.min(k, dst.length - 1)][1] << 8) | dst[Math.min(k, dst.length - 1)][2]);
  }
  return m;
}
// one 64x64 frame out of a composed sheet; frames beyond the sheet come back empty
export function frameOf(sheet, anim, dir, idx) {
  const out = new Uint8ClampedArray(FRAME * FRAME * 4); if (!sheet) return out; const sx = idx * FRAME, sy = ROW[dir] * FRAME;
  if (sx + FRAME > sheet.w) return out;
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) { const i = ((sy + y) * sheet.w + sx + x) * 4, o = (y * FRAME + x) * 4; out[o] = sheet.data[i]; out[o + 1] = sheet.data[i + 1]; out[o + 2] = sheet.data[i + 2]; out[o + 3] = sheet.data[i + 3]; }
  return out;
}
export function creditsOf(parts) {
  const seen = new Map();
  for (const p of parts) for (const c of p.def.credits || []) { const k = c.file; if (!p.rel.startsWith(c.file) && !c.file.startsWith(p.rel.replace(/\/$/, ''))) continue; if (!seen.has(k)) seen.set(k, { file: c.file, authors: c.authors, licenses: c.licenses, urls: c.urls, notes: c.notes, def: p.id }); }
  return [...seen.values()];
}
