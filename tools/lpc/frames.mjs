// All the frames (direction x pose, 64x64) of one person: LPC layers composed, then our painted extras on top.
// Poses: 0 idle, 1-4 walk (run for the runners), 5 a drink held, 6 sitting on the ground, 7 sitting and sipping.
import { composeAnim, frameOf, ramp, plainFile, loadSheet, FRAME, ROW } from './lib.mjs';
import * as X from './extras.mjs';
const DIRS = ['back', 'left', 'front'], WALKF = [1, 3, 5, 7];
const isHead = id => /heads\/human/.test(id), isTorso = id => /torso\/(shirts|aprons)/.test(id) && !/sleeves\/torso_clothes_shortsleeves2/.test(id);
const rgbKey = c => (c[0] << 16) | (c[1] << 8) | c[2];
async function chairFrame(variant, dir, idx, part) {
  const file = await plainFile(`body/wheelchair/adult/${part}/${variant}.png`); if (!file) return null; const sh = await loadSheet(file); return frameOf(sh, 'wheelchair', dir, idx % (sh.w / FRAME));
}
const under = (f, bg) => { if (!bg) return; for (let i = 0; i < FRAME * FRAME; i++) if (!f[i * 4 + 3] && bg[i * 4 + 3]) { f[i * 4] = bg[i * 4]; f[i * 4 + 1] = bg[i * 4 + 1]; f[i * 4 + 2] = bg[i * 4 + 2]; f[i * 4 + 3] = 255; } };
const over = (f, fg) => { if (!fg) return; for (let i = 0; i < FRAME * FRAME; i++) if (fg[i * 4 + 3]) { f[i * 4] = fg[i * 4]; f[i * 4 + 1] = fg[i * 4 + 1]; f[i * 4 + 2] = fg[i * 4 + 2]; f[i * 4 + 3] = 255; } };

export async function personFrames(P, want) {   // want: { drink, sit } which optional poses to make
  const used = [], frames = {}, sheets = {}, anims = ['walk', 'idle', 'sit'].concat(P.run ? ['run'] : []);
  const subs = { head: P.layers.filter(l => isHead(l.id)), torso: P.layers.filter(l => isTorso(l.id)) }, subSheets = {};
  if (P.layers.length) for (const a of anims) { sheets[a] = await composeAnim(P, a); if (sheets[a]) used.push(...sheets[a].used); for (const k of ['head', 'torso']) subSheets[k + a] = subs[k].length ? await composeAnim({ body: P.body, layers: subs[k] }, a) : null; }
  const skinRamp = P.layers.length ? ramp('body', P.skinName).map(rgbKey) : [], skinSet = new Set(skinRamp), skinRGB = P.layers.length ? ramp('body', P.skinName) : [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const poses = [0, 1, 2, 3, 4].concat(want.drink ? [5] : []).concat(want.sit ? [6, 7] : []);
  for (const dir of DIRS) for (const pose of poses) {
    let anim, idx;
    if (P.chair) { anim = 'sit'; idx = 2; } else if (pose === 0) { anim = 'idle'; idx = 0; } else if (pose <= 4) { anim = P.run ? 'run' : 'walk'; idx = WALKF[pose - 1]; } else if (pose === 5) { anim = 'idle'; idx = 1; } else if (pose === 6) { anim = 'sit'; idx = 1; } else { anim = 'sit'; idx = 0; }
    const f = P.layers.length ? frameOf(sheets[anim], anim, dir, idx) : new Uint8ClampedArray(FRAME * FRAME * 4);
    const hd = P.layers.length ? X.bbox(frameOf(subSheets['head' + anim], anim, dir, idx)) : null;
    if (hd) {
      const A = { hd, dir, sit: pose === 7, torso: subSheets['torso' + anim] ? X.maskOf(frameOf(subSheets['torso' + anim], anim, dir, idx)) : new Uint8Array(FRAME * FRAME), skinAt: (x, y) => { if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return false; const i = (y * FRAME + x) * 4; return f[i + 3] && skinSet.has((f[i] << 16) | (f[i + 1] << 8) | f[i + 2]); }, bodyMask: X.maskOf(f) };
      const hands = X.handsOf(f, A, hd.y1 + 6, hd.y1 + 34), sipPose = pose === 5 || pose === 7;
      for (const [kind, ...a] of P.extras) {
        switch (kind) {
          case 'stubble': X.stubble(f, A, skinRGB); break; case 'roundGlasses': X.roundGlasses(f, A, a[1]); break; case 'rectGlasses': X.rectGlasses(f, A); break;
          case 'print': X.bandPrint(f, A, a[0], a[1], a[2]); break; case 'suit': X.suitFront(f, A, a[0]); break; case 'leather': X.leatherJacket(f, A, a[0]); break; case 'patches': X.patches(f, A); break;
          case 'rosaScarf': X.rosaScarf(f, A, a[0] || 'rosanero', a[1] || 'black'); break; case 'bandolier': X.bandolier(f, A, a[0]); break; case 'chain': X.chain(f, A); break; case 'stripe': X.stripe(f, A); break;
          case 'tattoo': X.tattoo(f, A, a[0]); break; case 'rip': X.ripKnees(f, A, skinRGB); break; case 'earring': X.earring(f, A); break;
          case 'backpack': X.backpack(f, A, a[0]); break; case 'bib': X.bib(f, A, a[0]); break; case 'rag': X.rag(f, A, a[0]); break;
          case 'wrench': { const w = hands.l; X.wrench(f, w.x, w.y, dir === 'left' ? -1 : 1); break; }
          case 'hold': { const hd2 = a[2] === 'r' ? hands.r : hands.l; if (pose >= 6) break; const x = hd2.x, y = hd2.y; if (a[0] === 'bag') X.bag(f, x, y + 1, a[1]); else if (a[0] === 'purse') X.purse(f, x, y + 1, a[1]); else if (a[0] === 'briefcase') X.briefcase(f, x, y + 1, a[1]); else if (a[0] === 'helmet') X.helmetHand(f, x, y - 2, a[1]); else if (a[0] === 'phone') X.phone(f, x, y - 2); break; }
          case 'drink': { const hnd = dir === 'left' || dir === 'right' ? hands.l : hands.r; if (sipPose) X.sip(f, A, hnd, skinRGB, a[0], a[1]); else if (a[0] === 'glass') X.glass(f, hnd.x, hnd.y, a[1]); else X.bottle(f, hnd.x, hnd.y, a[1]); break; }
          case 'dog': X.dog(f, A, a[0], pose); break; case 'stroller': X.stroller(f, A, a[0], a[1]); break;
          case 'fazzoletto': X.fazzoletto(f, A, a[0]); break; case 'flatCap': X.flatCap(f, A, a[0]); break; case 'topHat': X.topHat(f, A, a[0]); break; case 'cheer': X.cheer(f, A, skinRGB); break; case 'peakedCap': X.peakedCap(f, A, a[0], a[1]); break; case 'strawHat': X.strawHat(f, A, a[0], a[1]); break; case 'helmet': X.helmet(f, A, a[0]); break; case 'cap': X.dark_cap(f, A, a[0]); break;
          default: break;
        }
      }
    }
    for (const [kind, ...a] of P.extras) if (kind === 'wheelchair') { const ci = pose >= 1 && pose <= 4 ? pose & 1 : 0; under(f, await chairFrame(a[0], dir, ci, 'background')); over(f, await chairFrame(a[0], dir, ci, 'foreground')); }
    if (pose >= 6) { f.copyWithin(0, FRAME * 2 * 4); f.fill(0, FRAME * (FRAME - 2) * 4); }   // sitting figures are drawn 2 pixels low in the LPC sheets: lift them to the same ground line
    frames[dir + pose] = f;
  }
  return { frames, used };
}
// two people in one cell (the couples): the second walks out of step
export function mergePair(fa, fb, dx = 6) {
  const out = {};
  for (const k of Object.keys(fa)) { const a = fa[k], b = fb[k] || fb[k.replace(/\d$/, '0')], o = new Uint8ClampedArray(a.length); for (const [src, sh] of [[a, -dx], [b, dx]]) for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) { const sx = x - sh; if (sx < 0 || sx >= FRAME) continue; const i = (y * FRAME + sx) * 4; if (src[i + 3]) { const j = (y * FRAME + x) * 4; o[j] = src[i]; o[j + 1] = src[i + 1]; o[j + 2] = src[i + 2]; o[j + 3] = 255; } } out[k] = o; }
  return out;
}
export const swapPose = p => (p === 1 ? 3 : p === 2 ? 4 : p === 3 ? 1 : p === 4 ? 2 : p);
