// The driver creator's engine ("Il tuo autista", the screen is in src/garage-ui.js): turns a small spec (body, skin, hair, clothes...) into the pixel-art person of the street crowd, in the
// browser. The same recipe as tools/lpc/frames.mjs, which builds the crowd's atlas: stack the Universal LPC Spritesheet layers of the choices (recoloured with the generator's palettes),
// then paint our own details on top (assets/peds/lpc/extras.js: caps, glasses, stubble, scarf...). The layers and the options are in assets/peds/lpc/driver/ (made by tools/lpc/driver.mjs):
// a layer sheet is fetched when a choice first needs it, so opening the Garage's driver screen costs the manifest (21 KB) and about a dozen small sheets, and driving costs nothing
// (src/driver.js keeps the three seated pictures).
//   const M = await loadManifest();            M.options.hair ...: what the screen offers
//   spec = cleanSpec(saved or {})              fills in and corrects every field; defaultSpec(), randomSpec()
//   const out = await compose(spec);           { sit: { front, left, back }, idle: { front, left, back } }: 64x64 RGBA frames (idle: standing, sit: seated in a seat)
import * as X from '../assets/peds/lpc/extras.js';
import { setPalettes, ramp } from '../assets/peds/lpc/ramps.js';

const BASE = new URL('../assets/peds/lpc/driver/', import.meta.url).href, FRAME = 64, ROW = { back: 0, left: 1, front: 2 }, DIRS = ['front', 'left', 'back'];
let manifest = null, loading = null;
const sheets = new Map();   // 'rel/anim' -> Promise of { data, w, h } or null

export function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  return loading || (loading = fetch(BASE + 'driver.json').then(r => r.json()).then(m => { manifest = m; m.fileSet = new Set(m.files); setPalettes(m.pal); return m; }));
}
function sheet(rel, anim) {
  const key = rel + anim; if (!manifest.fileSet.has(key)) return Promise.resolve(null);
  let p = sheets.get(key);
  if (!p) {
    p = new Promise(res => {
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, img.width, img.height); res({ data: d.data, w: img.width, h: img.height }); };
      img.onerror = () => res(null); img.src = BASE + rel + anim + '.png';
    });
    sheets.set(key, p);
  }
  return p;
}

// ---- the spec
const pick = (list, id, d) => (list.some(o => o.id === id) ? id : d);
export function defaultSpec() {
  return { v: 1, body: 'male', old: false, skin: 'light', eye: 'brown', hair: 'short', hairCol: 'dark_brown', beard: 'none', glasses: 'none', hat: 'none', hatCol: 'brown',
    top: 'tshirt', topCol: 'sky', bottom: 'pants', botCol: 'navy', shoes: 'shoes', shoeCol: 'white', scarf: false, chain: false, earring: false, tattoo: false, leather: false };
}
export function cleanSpec(s) {
  const o = manifest.options, d = defaultSpec(); s = s && typeof s === 'object' ? s : {};
  const body = manifest.bodies.includes(s.body) ? s.body : d.body, ok = list => list.filter(x => x.bodies.includes(body)), id = (list, v, def) => pick(ok(list), v, def);
  return { v: 1, body, old: !!s.old, skin: pick(o.skin, s.skin, d.skin), eye: pick(o.eye, s.eye, d.eye), hair: id(o.hair, s.hair, d.hair), hairCol: pick(o.hairCol, s.hairCol, d.hairCol), beard: id(o.beard, s.beard, d.beard),
    glasses: pick(o.glasses, s.glasses, d.glasses), hat: pick(o.hat, s.hat, d.hat), hatCol: pick(o.cloth, s.hatCol, d.hatCol), top: id(o.top, s.top, d.top), topCol: pick(o.cloth, s.topCol, d.topCol),
    bottom: id(o.bottom, s.bottom, d.bottom), botCol: pick(o.cloth, s.botCol, d.botCol), shoes: id(o.shoes, s.shoes, d.shoes), shoeCol: pick(o.cloth, s.shoeCol, d.shoeCol),
    scarf: !!s.scarf, chain: !!s.chain, earring: !!s.earring, tattoo: !!s.tattoo, leather: !!s.leather && /^(long|longpolo)$/.test(id(o.top, s.top, d.top)) };
}
export function randomSpec(rnd = Math.random) {
  const o = manifest.options, one = list => list[Math.floor(rnd() * list.length)], body = rnd() < 0.5 ? 'male' : 'female', ok = list => list.filter(x => x.bodies.includes(body));
  const s = { body, old: rnd() < 0.2, skin: one(o.skin).id, eye: one(o.eye).id, hair: one(ok(o.hair)).id, hairCol: one(o.hairCol).id, beard: body === 'male' && rnd() < 0.4 ? one(ok(o.beard)).id : 'none',
    glasses: rnd() < 0.3 ? one(o.glasses).id : 'none', hat: rnd() < 0.3 ? one(o.hat).id : 'none', hatCol: one(o.cloth).id, top: one(ok(o.top)).id, topCol: one(o.cloth).id, bottom: one(ok(o.bottom)).id, botCol: one(o.cloth).id,
    shoes: one(ok(o.shoes)).id, shoeCol: one(o.cloth).id, scarf: rnd() < 0.12, chain: rnd() < 0.2, earring: rnd() < 0.2, tattoo: rnd() < 0.15, leather: rnd() < 0.15 };
  return cleanSpec(s);
}

// ---- the stack of layers of a spec (the recipe of tools/lpc/cast.mjs, for the options the creator has)
function stackOf(sp) {
  const M = manifest, L = [{ id: 'body/body', mat: { body: sp.skin } }, { id: M.heads[sp.old ? 'old' : 'young'][sp.body], mat: { body: sp.skin, eye: sp.eye } }];
  const opt = (list, id) => manifest.options[list].find(o => o.id === id), X_ = [], push = (list, id, mat) => { for (const l of opt(list, id).layers) L.push({ id: l, mat }); };
  push('bottom', sp.bottom, { cloth: sp.botCol }); push('shoes', sp.shoes, { cloth: sp.shoeCol }); push('top', sp.top, { cloth: sp.topCol });
  if (sp.hat !== 'fazzoletto') push('hair', sp.hair, { hair: sp.hairCol });
  if (sp.beard !== 'none') push('beard', sp.beard, { hair: sp.hairCol });
  if (sp.beard === 'stubble') X_.push(['stubble']);
  if (sp.scarf) X_.push(['rosaScarf']);
  if (sp.chain) X_.push(['chain']);
  if (sp.leather && /^(long|longpolo)$/.test(sp.top)) X_.push(['leather', 'black']);
  if (sp.tattoo) X_.push(['tattoo', 'arms']);
  if (sp.glasses === 'round') X_.push(['roundGlasses', false]); else if (sp.glasses === 'tortoise') X_.push(['roundGlasses', true]); else if (sp.glasses === 'rect') X_.push(['rectGlasses']);
  if (sp.earring) X_.push(['earring']);
  if (sp.hat === 'coppola') X_.push(['flatCap', sp.hatCol]); else if (sp.hat === 'straw') X_.push(['strawHat', 'tan', 'red']); else if (sp.hat === 'cap') X_.push(['cap', sp.hatCol]);
  else if (sp.hat === 'vigile') X_.push(['peakedCap', 'white', 'navy']); else if (sp.hat === 'fazzoletto') X_.push(['fazzoletto', 'black']);
  return { layers: L, extras: X_ };
}

// ---- compositing, as lib.mjs's composeAnim: parts sorted by their z, recoloured by exact colour match of the base ramp to the chosen one, laid over each other
function recolor(mats, mat) {
  const m = new Map();
  for (const material of mats) {
    const target = mat[material], base = manifest.base[material]; if (!target || !base) continue;
    const src = manifest.pal[material][base].map(h => parseInt(h.slice(1), 16)), dst = manifest.pal[material][target].map(h => parseInt(h.slice(1), 16));
    src.forEach((c, k) => m.set(c, dst[Math.min(k, dst.length - 1)]));
  }
  return m.size ? m : null;
}
async function composeAnim(layers, body, anim) {
  const parts = [];
  await Promise.all(layers.map(async L => {
    const defn = manifest.layers[L.id];
    for (const [n, ly] of defn.entries()) { const rel = ly.rel[body]; if (!rel) continue; const sh = await sheet(rel, anim); if (sh) parts.push({ z: ly.z, n, id: L.id, sh, map: recolor(ly.mats, L.mat), order: layers.indexOf(L) }); }
  }));
  parts.sort((a, b) => a.z - b.z || a.order - b.order || a.n - b.n);
  if (!parts.length) return null;
  const W = Math.max(...parts.map(p => p.sh.w)), H = 256, out = new Uint8ClampedArray(W * H * 4);
  for (const p of parts) {
    const w = Math.min(W, p.sh.w), h = Math.min(H, p.sh.h), d = p.sh.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * p.sh.w + x) * 4; if (!d[i + 3]) continue;
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (p.map) { const k = p.map.get((r << 16) | (g << 8) | b); if (k !== undefined) { r = k >> 16; g = (k >> 8) & 255; b = k & 255; } }
      const o = (y * W + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
    }
  }
  return { data: out, w: W, h: H };
}
function frameOf(sh, dir, idx) {
  const out = new Uint8ClampedArray(FRAME * FRAME * 4); if (!sh) return out; const sx = idx * FRAME, sy = ROW[dir] * FRAME; if (sx + FRAME > sh.w) return out;
  for (let y = 0; y < FRAME; y++) { const i = ((sy + y) * sh.w + sx) * 4; out.set(sh.data.subarray(i, i + FRAME * 4), y * FRAME * 4); }
  return out;
}
const rgbKey = c => (c[0] << 16) | (c[1] << 8) | c[2];

// the three directions of one animation frame, with the painted extras on top
async function frames(sp, st, anim, idx) {
  const isHead = id => /heads\/human/.test(id), isTorso = id => /torso\/shirts/.test(id), body = sp.body;
  const [full, head, torso] = await Promise.all([composeAnim(st.layers, body, anim), composeAnim(st.layers.filter(l => isHead(l.id)), body, anim), composeAnim(st.layers.filter(l => isTorso(l.id)), body, anim)]);
  const skin = ramp('body', sp.skin), skinSet = new Set(skin.map(rgbKey)), res = {};
  for (const dir of DIRS) {
    const f = frameOf(full, dir, idx), hd = X.bbox(frameOf(head, dir, idx));
    if (hd) {
      const A = { hd, dir, sit: false, torso: torso ? X.maskOf(frameOf(torso, dir, idx)) : new Uint8Array(FRAME * FRAME),
        skinAt: (x, y) => { if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return false; const i = (y * FRAME + x) * 4; return !!f[i + 3] && skinSet.has((f[i] << 16) | (f[i + 1] << 8) | f[i + 2]); } };
      for (const [kind, ...a] of st.extras) {
        switch (kind) {
          case 'stubble': X.stubble(f, A, skin); break; case 'roundGlasses': X.roundGlasses(f, A, a[0]); break; case 'rectGlasses': X.rectGlasses(f, A); break;
          case 'leather': X.leatherJacket(f, A, a[0]); break; case 'rosaScarf': X.rosaScarf(f, A, 'rosanero', 'black'); break; case 'chain': X.chain(f, A); break;
          case 'tattoo': X.tattoo(f, A, a[0]); break; case 'earring': X.earring(f, A); break;
          case 'flatCap': X.flatCap(f, A, a[0]); break; case 'peakedCap': X.peakedCap(f, A, a[0], a[1]); break; case 'strawHat': X.strawHat(f, A, a[0], a[1]); break; case 'cap': X.dark_cap(f, A, a[0]); break;
          case 'fazzoletto': X.fazzoletto(f, A, a[0]); break;
          default: break;
        }
      }
    }
    res[dir] = f;
  }
  return res;
}

// everything the screen needs for a spec: the seated person for the lapa (sit sheet, frame 2), and the standing one for the portrait (idle sheet, frame 0)
export async function compose(spec) {
  const sp = cleanSpec(spec), st = stackOf(sp);
  const [sit, idle] = await Promise.all([frames(sp, st, 'sit', 2), frames(sp, st, 'idle', 0)]);
  return { spec: sp, sit, idle };
}
