// The driver ("Il tuo autista"). Every vehicle has one, a billboard in the seat that turns to the camera but shows the picture that matches the angle between where the vehicle points and
// where the camera is (the back of the head in the chase view, the face through the windscreen from the front). It is three small pictures (seated, seen from the front, the side and the
// back, 64x64 RGBA each, cropped to CELL) kept next to each other in one texture. Until the player makes their own, that is the default driver, an ordinary man baked into
// src/driver-default.js by tools/lpc/default-driver.mjs (so the street downloads no layer). The Garage's driver screen (src/garage-ui.js, src/driver-compose.js) builds a pixel-art person from
// LPC layers; what the street needs of it is those three pictures, saved in localStorage next to the options that made them, and a saved driver wins over the default in the player's own
// vehicle (the Garage and the street). The vehicles of other players and of the racers always have the default.
//   driver.has()              the player made a driver (the default does not count)
//   driver.spec()             the options it was made from (the creator reopens with them)
//   driver.set(frames, spec)  frames: { front, left, back }, each 64x64 RGBA bytes of the seated person (src/driver-compose.js); saves, and the player's own vehicles on screen update
//   driver.clear()            forget the driver: the player's vehicles go back to the default one
//   driver.dress(rig, own)    called for every vehicle rig that is made (src/vehicle-models.js): puts the sprite in the seat; own: the player's (a saved driver, else the default)
import * as THREE from 'three';
import { DEFAULT_DRIVER_PNG } from './driver-default.js';

const KEY = 'pd.driver', CELL = { x: 12, y: 6, w: 40, h: 58 };   // the part of each 64x64 frame that is kept: x, y of the top left, size in pixels (fits every hat, hairdo and arm)
const PX = 0.0215;                      // metres per pixel on the lapa's seat: a seated person is 0.8 m from the seat to the top of the head
const SEAT_ROW = 47;                    // the row of the frame where the hips are in the seated pose
const SEAT = { y: 1.06, z: 0.14 };      // the top of the seat cushion and where the driver sits (vehicle units of the lapa, before the Lapa 50's 0.86 scale)
const SPOT = {                          // where the bottom middle of the sprite is in the driver group of the others (x, y, z of the vehicle's tilt group): on the saddle, the car's driving seat, the sulky's bench
  vespa: [0, 0.188, 0.2628], scooterone: [0, 0.298, 0.5803], motorino: [0, 0.103, 0.3056], tascia: [0.3, -0.367, 0.1064], sulky: [0, 0.0792, -0.333],
};

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
let spec = null, made = false;
const listeners = new Set();

function makeTexture() {   // the three frames next to each other: front, left, back
  const canvas = document.createElement('canvas'); canvas.width = CELL.w * 3; canvas.height = CELL.h;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  return { canvas, tex };
}
const mine = makeTexture(), stock = makeTexture();   // mine: the player's own vehicles (the default until they make a driver); stock: everyone else's, always the default
const draw = (t, img) => { const g = t.canvas.getContext('2d'); g.clearRect(0, 0, t.canvas.width, t.canvas.height); g.drawImage(img, 0, 0); t.tex.needsUpdate = true; };
let stockImg = null;   // the default driver's picture, once decoded
{ const img = new Image();   // a data URL of a few KB, decoded at once; the sprites are see-through until then
  img.onload = () => { stockImg = img; draw(stock, img); if (!made) draw(mine, img); };
  img.src = DEFAULT_DRIVER_PNG; }

function paint(frames) {
  const g = mine.canvas.getContext('2d'), out = g.createImageData(CELL.w * 3, CELL.h);
  ['front', 'left', 'back'].forEach((d, k) => { const f = frames[d]; for (let y = 0; y < CELL.h; y++) for (let x = 0; x < CELL.w; x++) {
    const i = ((CELL.y + y) * 64 + CELL.x + x) * 4, o = (y * CELL.w * 3 + k * CELL.w + x) * 4; out.data[o] = f[i]; out.data[o + 1] = f[i + 1]; out.data[o + 2] = f[i + 2]; out.data[o + 3] = f[i + 3]; } });
  g.putImageData(out, 0, 0); mine.tex.needsUpdate = true;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, spec, png: mine.canvas.toDataURL('image/png') })); } catch (e) { /* private window or full: the driver lasts until the page is closed */ }
}
(function load() {   // a saved driver: its pictures come back from the data URL (a few KB), no layers are fetched
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return; }
  if (!s || s.v !== 1 || !s.spec || typeof s.png !== 'string' || !s.png.startsWith('data:image/png;base64,')) return;   // only our own kind of picture: a tampered save cannot make the page fetch an address
  const img = new Image();
  img.onload = () => { if (made) return; spec = s.spec; made = true; draw(mine, img); for (const f of listeners) f(); };
  img.src = s.png;
})();

// ---- the billboard in the seat
function dressTo(rig, own) {
  const tp = rig.tpl.spec.tiltPivot, s = rig.kind === 'lapa' ? tp[1] / 0.45 : 1, k = PX * s, w = CELL.w * k, h = CELL.h * k;   // the lapae scale their whole model (the Lapa 50 by 0.86) and pivot at 0.45 m of it
  const at = rig.kind === 'lapa' ? [0 - tp[0], SEAT.y * s - (64 - SEAT_ROW) * k - tp[1], SEAT.z * s - tp[2]] : SPOT[rig.type];   // the plane's bottom edge is the bottom row of the frame
  if (!at) return;
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), uv = geo.attributes.uv;
  const mat = new THREE.MeshLambertMaterial({ map: (own ? mine : stock).tex, alphaTest: 0.5 });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.position.set(...at);
  mesh.onBeforeRender = (r, sc, cam) => {   // upright, towards the camera; the picture that matches the angle between the vehicle's nose and the camera
    const par = mesh.parent; par.getWorldQuaternion(_q); _f.set(0, 0, 1).applyQuaternion(_q); _f.y = 0;
    mesh.getWorldPosition(_p); cam.getWorldPosition(_c); const dx = _c.x - _p.x, dz = _c.z - _p.z, a = Math.atan2(dx, dz);
    _q2.setFromAxisAngle(_y, a); mesh.quaternion.copy(_q).invert().multiply(_q2);
    const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl, right = fx * Math.cos(a) - fz * Math.sin(a), toCam = fx * Math.sin(a) + fz * Math.cos(a), th = Math.atan2(right, toCam);
    let cell = 0, flip = false; if (Math.abs(th) < Math.PI / 4) cell = 0; else if (Math.abs(th) > Math.PI * 3 / 4) cell = 2; else { cell = 1; flip = th > 0; }
    const u0 = cell / 3, u1 = (cell + 1) / 3, l = flip ? u1 : u0, rr = flip ? u0 : u1;
    uv.setXY(0, l, 1); uv.setXY(1, rr, 1); uv.setXY(2, l, 0); uv.setXY(3, rr, 0); uv.needsUpdate = true;
    mesh.updateMatrixWorld();
  };
  rig.driver.add(mesh);
  const od = rig.dispose; rig.dispose = () => { mesh.parent && mesh.parent.remove(mesh); geo.dispose(); mat.dispose(); od(); };   // the textures are shared and stay
}

export const driver = {
  has: () => made,
  spec: () => spec,
  set(frames, s) { spec = s; made = true; paint(frames); save(); for (const f of listeners) f(); },
  clear() { spec = null; made = false; try { localStorage.removeItem(KEY); } catch (e) { /* nothing saved */ } if (stockImg) draw(mine, stockImg); for (const f of listeners) f(); },   // before the default has decoded, its onload fills mine
  dress(rig, own = false) { if (rig) dressTo(rig, own); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
